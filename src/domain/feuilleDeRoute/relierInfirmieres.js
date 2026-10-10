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
 *
 * @typedef {Object} InfirmiereVega
 * @property {string} code                 // code PS tel que lu dans le PDF
 * @property {(PersonneReliee|null)} personne // null = code non relié à l'équipe
 */

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
    index.set(cle, { id: p.id, prenom: p.prenom, nom: p.nom, actif });
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
