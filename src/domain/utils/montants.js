/**
 * Formatage des montants. Les calculs se font toujours en centimes (entiers).
 *
 * Module pur : aucun import Vue/Vuex (ADR 0008).
 */

const FORMAT_EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/**
 * Formate un montant en centimes pour l'affichage (ex. 2095 → « 20,95 € »).
 * @param {number} centimes
 * @returns {string}
 */
export function formaterEuros(centimes) {
  return FORMAT_EUROS.format(centimes / 100);
}
