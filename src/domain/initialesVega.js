/**
 * Règles du champ `Personne.initialesVega` (feature 0034).
 *
 * Module pur : aucun import (chargé par `personnes.js` via `@/` et par
 * `feuilleDeRoute/` en import relatif — ADR 0008).
 */

/** Forme d'un code « PS » Vega : 2 à 4 lettres sans accent ou chiffres, en majuscules. */
export const FORMAT_INITIALES_VEGA = /^[A-Z0-9]{2,4}$/;

/**
 * Normalise une saisie : espaces retirés aux extrémités, majuscules.
 * Ne valide pas le format (voir {@link estInitialesVegaValide}).
 *
 * @param {*} valeur - Saisie brute.
 * @returns {(string|null)} Valeur normalisée, ou `null` si vide.
 */
export function normaliserInitialesVega(valeur) {
  const normalisee = String(valeur ?? '').trim().toUpperCase();
  return normalisee === '' ? null : normalisee;
}

/**
 * Indique si la valeur est acceptable : vide (champ facultatif) ou au bon format.
 *
 * @param {*} valeur - Saisie brute.
 * @returns {boolean}
 */
export function estInitialesVegaValide(valeur) {
  const normalisee = normaliserInitialesVega(valeur);
  return normalisee === null || FORMAT_INITIALES_VEGA.test(normalisee);
}

/**
 * Cherche la première personne (active ou archivée) qui porte ces initiales.
 *
 * @param {*} valeur - Initiales recherchées (saisie brute).
 * @param {Array<{id: string, initialesVega?: (string|null)}>} personnes - Toutes les personnes.
 * @param {(string|null)} [idExclu] - Personne à ignorer (celle en cours d'édition).
 * @returns {(object|null)} La personne trouvée, ou `null` si valeur vide ou libre.
 */
export function personneAvecInitialesVega(valeur, personnes, idExclu = null) {
  const recherchee = normaliserInitialesVega(valeur);
  if (recherchee === null) return null;
  return (
    (personnes ?? []).find(
      (p) => p.id !== idExclu && normaliserInitialesVega(p.initialesVega) === recherchee
    ) ?? null
  );
}
