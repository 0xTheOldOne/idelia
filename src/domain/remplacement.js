/**
 * Identification des remplaçantes (feature 0021). Le moteur traite les
 * remplaçantes comme un renfort : les titulaires sont servies d'abord.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage`.
 */

/**
 * @typedef {import('@/domain/personnes.js').Personne} Personne
 */

/**
 * Indique si une personne est remplaçante (`statut === 'REMPLACANT'`).
 *
 * @param {Personne} personne
 * @returns {boolean}
 */
export function estRemplacante(personne) {
  return personne?.statut === 'REMPLACANT';
}
