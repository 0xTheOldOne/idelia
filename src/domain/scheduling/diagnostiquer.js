/**
 * Diagnostic complet d'un planning (amendement `010` à la surface publique
 * de `009`, §5.3 du plan `010`) : factorise la queue déjà présente dans
 * `genererPlanning` (`validerPlanning` + `calculerNonCouvertures` +
 * `calculerScore`), pour que `010`/`011` obtiennent les diagnostics d'un
 * planning **déjà persisté** sans jamais les stocker (recalcul à la
 * demande, le moteur restant l'unique source de vérité).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Fonction déterministe : deux appels avec les mêmes arguments renvoient un
 * résultat strictement identique.
 */

import { indexer } from './modele/planning.js';
import { expanserDemandes } from './modele/demande.js';
import { calculerNonCouvertures } from './contraintes/contrainteCouverture.js';
import { calculerScore } from './heuristiques/scoring.js';
import { validerPlanning } from './validerPlanning.js';

/**
 * Construit `{ violations, tourneesNonCouvertes, score }` pour un tableau
 * d'`Affectation` et une `Entree` donnés : `violations` est strictement ce
 * que renvoie `validerPlanning(affectations, entree)`, `tourneesNonCouvertes`
 * vient de `calculerNonCouvertures(expanserDemandes(entree), indexer(affectations))`,
 * et `score` de `calculerScore(violations)`.
 *
 * @param {import('./modele/affectation.js').Affectation[]} affectations - Affectations à diagnostiquer (peut être un état en cours d'édition, non persisté).
 * @param {import('./modele/types.js').Entree} entree
 * @returns {{violations: import('./modele/types.js').Violation[], tourneesNonCouvertes: import('./modele/types.js').NonCouverture[], score: number}} Diagnostic complet.
 */
export function diagnostiquer(affectations, entree) {
  const violations = validerPlanning(affectations, entree);
  const tourneesNonCouvertes = calculerNonCouvertures(expanserDemandes(entree), indexer(affectations ?? []));
  const score = calculerScore(violations);

  return { violations, tourneesNonCouvertes, score };
}
