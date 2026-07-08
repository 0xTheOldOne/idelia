/**
 * Scoring des violations et coût marginal agrégé (§5.11 du plan `009`).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

/**
 * Somme des `penalite` des violations `avertissement` — les `erreur` ont
 * `penalite: 0` (elles ne participent pas au score, mais comptent dans
 * `meta.nbErreursDures`, calculé par `genererPlanning.js`). Bas = mieux.
 *
 * @param {import('../modele/types.js').Violation[]} violations
 * @returns {number} Score (0 si `violations` est vide/absent).
 */
export function calculerScore(violations) {
  return (violations ?? [])
    .filter((violation) => violation.severite === 'avertissement')
    .reduce((somme, violation) => somme + (violation.penalite ?? 0), 0);
}

/**
 * Coût marginal **agrégé** d'assigner `personneId` à `demande` : somme des
 * `coutMarginal(personneId, demande, ctx)` de **toutes** les contraintes
 * souples du catalogue qui en exposent un (§5.11 du plan). Utilisé par le
 * glouton pour choisir, parmi des candidats déjà jugés légaux par les dures,
 * celui au moindre coût — ne vérifie **jamais** lui-même la légalité.
 *
 * @param {string} personneId
 * @param {import('../modele/types.js').Demande} demande
 * @param {import('../modele/types.js').Contrainte[]} contraintes - Catalogue complet (le filtrage souple est interne).
 * @param {import('../modele/types.js').ContexteEvaluation} ctx
 * @returns {number} Coût marginal total (0 si aucune contrainte souple ne pénalise ce candidat).
 */
export function coutMarginalAgrege(personneId, demande, contraintes, ctx) {
  let total = 0;

  for (const contrainte of contraintes) {
    if (contrainte.durete !== 'souple' || typeof contrainte.coutMarginal !== 'function') continue;
    total += contrainte.coutMarginal(personneId, demande, ctx) ?? 0;
  }

  return total;
}
