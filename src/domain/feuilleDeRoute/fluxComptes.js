/**
 * Flux d'argent entre comptes de titulaires, rétrocessions et alertes (feature 0036).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Imports relatifs uniquement (chargé aussi sans Vite par les scripts de vérification).
 *
 * Principe : l'argent des soins d'une remplaçante rattachée arrive sur le compte de sa
 * titulaire. Les virements se font donc entre comptes ; la titulaire reverse (ou retire)
 * à la remplaçante sa part selon le taux de rétrocession.
 */

import { calculerReversements } from './detecterRelais.js';

/**
 * @typedef {import('./bilanReversements.js').LigneBilan} LigneBilan
 * @typedef {import('./relierInfirmieres.js').CompteDuCode} CompteDuCode
 * @typedef {import('./relierInfirmieres.js').PersonneReliee} PersonneReliee
 *
 * @typedef {Object} CompteFlux
 * @property {string} cle
 * @property {(PersonneReliee|null)} titulaire   // null = code non relié
 * @property {string[]} codes                    // codes PS comptés ici, dans l'ordre des lignes
 * @property {number} soldeCentimes              // Σ soldes de ces codes ; > 0 = doit virer
 *
 * @typedef {Object} VirementCompte
 * @property {string} de                         // cle du compte qui vire
 * @property {string} vers                       // cle du compte qui reçoit
 * @property {number} montantCentimes            // > 0
 *
 * @typedef {Object} Retrocession
 * @property {string} ps                         // code de la remplaçante
 * @property {PersonneReliee} titulaire
 * @property {PersonneReliee} remplacante
 * @property {number} soldeCentimes              // solde signé de la remplaçante (≠ 0)
 * @property {(number|null)} taux
 * @property {(number|null)} partRemplacanteCentimes  // null si taux inconnu
 * @property {(number|null)} partTitulaireCentimes    // null si taux inconnu
 * @property {'RECOIT'|'PAIE'} sens              // RECOIT si solde < 0, PAIE si solde > 0
 *
 * @typedef {Object} AlerteFlux
 * @property {string} ps
 * @property {('SANS_TITULAIRE'|'SANS_TAUX'|'CODE_INCONNU')} motif
 * @property {(PersonneReliee|null)} personne    // pour le lien vers la fiche ; null si code non relié
 *
 * @typedef {Object} FluxComptes
 * @property {CompteFlux[]} comptes              // ordre de première apparition dans les lignes
 * @property {VirementCompte[]} virements
 * @property {Retrocession[]} retrocessions      // ordre des lignes ; aucune pour un solde nul
 * @property {AlerteFlux[]} alertes              // ordre des lignes, une par code au plus
 */

/**
 * Parts d'un solde de remplaçante : la remplaçante reçoit (100 − taux) %, arrondi au centime
 * (demi-centime vers le haut) ; la titulaire absorbe l'écart (somme toujours exacte).
 * @param {number} soldeCentimes   // signé
 * @param {(number|null)} taux     // entier 0..100, ou null
 * @returns {{partRemplacanteCentimes: (number|null), partTitulaireCentimes: (number|null)}}
 */
export function partsRetrocession(soldeCentimes, taux) {
  if (!Number.isInteger(taux) || taux < 0 || taux > 100) {
    return { partRemplacanteCentimes: null, partTitulaireCentimes: null };
  }
  const absolu = Math.abs(soldeCentimes);
  // On multiplie avant de diviser : le produit reste entier.
  const partRemplacanteCentimes = Math.round((absolu * (100 - taux)) / 100);
  return { partRemplacanteCentimes, partTitulaireCentimes: absolu - partRemplacanteCentimes };
}

/**
 * @param {LigneBilan[]} lignes                        // bilan.lignes (seuls ps et soldeCentimes sont lus)
 * @param {(ps: string) => CompteDuCode} resoudreCompte
 * @returns {FluxComptes}
 */
export function calculerFlux(lignes, resoudreCompte) {
  /** @type {Map<string, CompteFlux>} */
  const comptes = new Map();
  /** @type {Retrocession[]} */
  const retrocessions = [];
  /** @type {AlerteFlux[]} */
  const alertes = [];

  for (const ligne of lignes ?? []) {
    const compte = resoudreCompte(ligne.ps);
    let cible = comptes.get(compte.cle);
    if (!cible) {
      cible = { cle: compte.cle, titulaire: compte.titulaire, codes: [], soldeCentimes: 0 };
      comptes.set(compte.cle, cible);
    }
    if (!cible.codes.includes(ligne.ps)) cible.codes.push(ligne.ps);
    cible.soldeCentimes += ligne.soldeCentimes;

    if (compte.alerte !== null) {
      // Pour un code non relié, la personne est null ; sinon la détentrice du compte est la
      // remplaçante elle-même (SANS_TITULAIRE) ou la remplaçante rattachée (SANS_TAUX).
      const personne = compte.alerte === 'CODE_INCONNU' ? null : (compte.remplacante ?? compte.titulaire);
      alertes.push({ ps: ligne.ps, motif: compte.alerte, personne });
    }

    if (compte.remplacante && compte.titulaire && ligne.soldeCentimes !== 0) {
      retrocessions.push({
        ps: ligne.ps,
        titulaire: compte.titulaire,
        remplacante: compte.remplacante,
        soldeCentimes: ligne.soldeCentimes,
        taux: compte.taux,
        ...partsRetrocession(ligne.soldeCentimes, compte.taux),
        sens: ligne.soldeCentimes < 0 ? 'RECOIT' : 'PAIE',
      });
    }
  }

  const liste = [...comptes.values()];
  const virements = calculerReversements(liste.map((c) => ({ ps: c.cle, ecartCentimes: c.soldeCentimes }))).map(
    (r) => ({ de: r.de, vers: r.vers, montantCentimes: r.montantCentimes }),
  );
  return { comptes: liste, virements, retrocessions, alertes };
}

/**
 * Noms affichés, utilisés par les listes du bilan : clé de compte ou id de remplaçante
 * → « Prénom NOM » ; compte non relié → « XY (non relié) ».
 * @param {FluxComptes} flux
 * @returns {Map<string, string>}
 */
export function libellesFlux(flux) {
  /** @type {Map<string, string>} */
  const libelles = new Map();
  for (const c of flux.comptes) {
    libelles.set(c.cle, c.titulaire ? `${c.titulaire.prenom} ${c.titulaire.nom}` : `${c.codes[0]} (non relié)`);
  }
  for (const r of flux.retrocessions) {
    libelles.set(r.remplacante.id, `${r.remplacante.prenom} ${r.remplacante.nom}`);
  }
  return libelles;
}
