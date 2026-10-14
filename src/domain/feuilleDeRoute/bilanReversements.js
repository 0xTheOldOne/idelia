/**
 * Bilan de la période (feature 0035) : cumule, par code PS, ce que chaque infirmière a touché
 * et sa part sur l'ensemble des cas d'un fichier, puis calcule la liste minimale de virements
 * qui solde toute la période (même glouton que les reversements par cas, 0034).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Tous les calculs d'argent se font en centimes (entiers), sans nouvel arrondi.
 * Rien n'est conservé : aucune donnée patient n'entre dans le bilan.
 */

import { calculerReversements } from './detecterRelais.js';

/**
 * @typedef {import('./detecterRelais.js').CasRelais} CasRelais
 * @typedef {import('./detecterRelais.js').Reversement} Reversement
 *
 * @typedef {Object} LigneBilan
 * @property {string} ps                 // code Vega
 * @property {number} nbPassages         // Σ de ses passages sur les cas retenus
 * @property {number} toucheCentimes     // Σ PartRelais.toucheCentimes
 * @property {number} partCentimes       // Σ PartRelais.partCentimes
 * @property {number} soldeCentimes      // toucheCentimes − partCentimes ; > 0 = doit reverser, < 0 = doit recevoir
 *
 * @typedef {Object} BilanPeriode
 * @property {LigneBilan[]} lignes       // triées par code ; vide si aucun cas retenu
 * @property {Reversement[]} virements   // compensation globale ; vide si soldes nuls
 * @property {number} totalCentimes      // Σ totalCentimes des cas retenus
 * @property {number} nbCasRetenus       // cas avec montants complets
 * @property {number} nbCasExclus        // cas montantIncomplet (non comptés)
 * @property {string[]} datesCasExclus   // "YYYY-MM-DD" distinctes, triées — jamais de nom de patient
 */

/**
 * Calcule le bilan d'une liste de cas. Les cas au montant illisible sont exclus et signalés
 * uniquement par leur jour.
 * @param {CasRelais[]} cas
 * @returns {BilanPeriode}
 */
export function calculerBilan(cas) {
  const liste = Array.isArray(cas) ? cas.filter(Boolean) : [];
  const retenus = liste.filter((c) => !c.montantIncomplet);
  const exclus = liste.filter((c) => c.montantIncomplet);

  /** @type {Map<string, LigneBilan>} */
  const parCode = new Map();
  let totalCentimes = 0;
  for (const c of retenus) {
    totalCentimes += c.totalCentimes ?? 0;
    for (const part of c.parts ?? []) {
      let ligne = parCode.get(part.ps);
      if (!ligne) {
        ligne = { ps: part.ps, nbPassages: 0, toucheCentimes: 0, partCentimes: 0, soldeCentimes: 0 };
        parCode.set(part.ps, ligne);
      }
      ligne.nbPassages += part.nbPassages;
      ligne.toucheCentimes += part.toucheCentimes;
      ligne.partCentimes += part.partCentimes;
    }
  }

  const lignes = [...parCode.values()].sort((a, b) => a.ps.localeCompare(b.ps, 'fr'));
  for (const l of lignes) l.soldeCentimes = l.toucheCentimes - l.partCentimes;

  const virements = calculerReversements(
    lignes.map((l) => ({ ps: l.ps, ecartCentimes: l.soldeCentimes })),
  );

  const datesCasExclus = [...new Set(exclus.map((c) => c.date))].sort();

  return {
    lignes,
    virements,
    totalCentimes,
    nbCasRetenus: retenus.length,
    nbCasExclus: exclus.length,
    datesCasExclus,
  };
}

/**
 * Indique si la période s'étend sur plus d'un mois civil (chaînes "YYYY-MM-DD", ADR 0010).
 * @param {({debut: string, fin: string}|null|undefined)} periode
 * @returns {boolean}
 */
export function couvrePlusieursMois(periode) {
  if (!periode || typeof periode.debut !== 'string' || typeof periode.fin !== 'string') {
    return false;
  }
  return periode.debut.slice(0, 7) !== periode.fin.slice(0, 7);
}
