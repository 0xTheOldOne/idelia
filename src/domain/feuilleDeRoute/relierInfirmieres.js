/**
 * Liaison code « PS » Vega → personne de l'équipe (feature 0034), via `Personne.initialesVega`.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Imports relatifs uniquement (chargé aussi sans Vite par les scripts de vérification).
 */

import { normaliserInitialesVega } from '../initialesVega.js';

/**
 * @typedef {Object} PersonneReliee        // projection minimale d'une Personne
 * @property {string} id
 * @property {string} prenom
 * @property {string} nom
 * @property {boolean} actif
 * @property {string} statut                 // 'TITULAIRE' | 'REMPLACANT'
 * @property {(string|null)} titulaireId
 * @property {(number|null)} tauxRetrocession
 * @property {(string|null)} couleur         // "#RRGGBB" attendu, non garanti (JSON importé)
 *
 * @typedef {'SANS_TITULAIRE'|'SANS_TAUX'|'CODE_INCONNU'} MotifAlerteCompte
 *
 * @typedef {Object} CompteDuCode
 * @property {string} cle                    // id de la détentrice du compte, ou "ps:<CODE>" (code non relié)
 * @property {(PersonneReliee|null)} titulaire   // détentrice du compte ; null = code non relié
 * @property {(PersonneReliee|null)} remplacante // remplaçante RATTACHÉE dont c'est le code ; null sinon
 * @property {(number|null)} taux            // taux de la remplaçante rattachée (entier 0..100) ; null sinon ou non renseigné
 * @property {(MotifAlerteCompte|null)} alerte
 *
 * @typedef {Object} InfirmiereVega
 * @property {string} code                 // code PS tel que lu dans le PDF
 * @property {(PersonneReliee|null)} personne // null = code non relié à l'équipe
 */

/**
 * Projection minimale d'une personne.
 * @param {Object} p
 * @returns {PersonneReliee}
 */
function projeter(p) {
  return {
    id: p.id,
    prenom: p.prenom,
    nom: p.nom,
    actif: p.actif !== false,
    statut: p.statut,
    titulaireId: p.titulaireId ?? null,
    tauxRetrocession: p.tauxRetrocession ?? null,
    couleur: p.couleur ?? null,
  };
}

/**
 * Indexe les personnes par initiales Vega (normalisées). Les personnes sans initiales sont
 * ignorées. En cas de collision (JSON modifié à la main) : une active l'emporte sur une
 * archivée ; à statut égal, la première de la liste.
 * @param {Array<{id: string, prenom: string, nom: string, actif?: boolean, initialesVega?: (string|null)}>} personnes
 * @returns {Map<string, PersonneReliee>}
 */
export function indexerParInitialesVega(personnes) {
  /** @type {Map<string, PersonneReliee>} */
  const index = new Map();
  for (const p of personnes ?? []) {
    const cle = normaliserInitialesVega(p.initialesVega);
    if (cle === null) continue;
    const actif = p.actif !== false;
    const existante = index.get(cle);
    if (existante && (existante.actif || !actif)) continue;
    index.set(cle, projeter(p));
  }
  return index;
}

/**
 * Retrouve l'infirmière d'un code PS (casse ignorée).
 * @param {string} code
 * @param {Map<string, PersonneReliee>} index
 * @returns {InfirmiereVega}
 */
export function infirmiereDuCode(code, index) {
  const cle = normaliserInitialesVega(code);
  return { code, personne: (cle !== null && index.get(cle)) || null };
}

/**
 * « Claire Martin (FC) » si reliée, sinon « FC ».
 * @param {InfirmiereVega} infirmiere
 * @returns {string}
 */
export function libelleInfirmiere(infirmiere) {
  const { personne, code } = infirmiere;
  return personne ? `${personne.prenom} ${personne.nom} (${code})` : code;
}

/**
 * « FC (Claire) » si reliée, sinon « FC ».
 * @param {InfirmiereVega} infirmiere
 * @returns {string}
 */
export function libelleCourtInfirmiere(infirmiere) {
  const { personne, code } = infirmiere;
  return personne ? `${code} (${personne.prenom})` : code;
}

/**
 * Codes PS distincts des passages des cas, absents de l'index, triés.
 * @param {Array<{passages: Array<{ps: string}>}>} cas
 * @param {Map<string, PersonneReliee>} index
 * @returns {string[]}
 */
export function codesNonRelies(cas, index) {
  const codes = new Set();
  for (const c of cas) {
    for (const p of c.passages) {
      if (infirmiereDuCode(p.ps, index).personne === null) codes.add(p.ps);
    }
  }
  return [...codes].sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Compte sur lequel arrive l'argent d'un code PS (feature 0036) : celui de la titulaire de
 * référence (`titulaireId`, un seul niveau) pour une remplaçante rattachée, sinon le sien.
 * @param {string} ps
 * @param {Map<string, PersonneReliee>} index            // indexerParInitialesVega
 * @param {Array<Object>} personnes                      // toutes (actives et archivées)
 * @returns {CompteDuCode}
 */
export function compteDuCode(ps, index, personnes) {
  const { personne } = infirmiereDuCode(ps, index);
  if (personne === null) {
    return { cle: 'ps:' + (normaliserInitialesVega(ps) ?? ps), titulaire: null, remplacante: null, taux: null, alerte: 'CODE_INCONNU' };
  }
  if (personne.statut !== 'REMPLACANT') {
    return { cle: personne.id, titulaire: personne, remplacante: null, taux: null, alerte: null };
  }
  const brute = personne.titulaireId === null ? undefined : (personnes ?? []).find((p) => p.id === personne.titulaireId);
  if (!brute) {
    return { cle: personne.id, titulaire: personne, remplacante: null, taux: null, alerte: 'SANS_TITULAIRE' };
  }
  const t = personne.tauxRetrocession;
  const taux = Number.isInteger(t) && t >= 0 && t <= 100 ? t : null;
  return {
    cle: brute.id,
    titulaire: projeter(brute),
    remplacante: personne,
    taux,
    alerte: taux === null ? 'SANS_TAUX' : null,
  };
}
