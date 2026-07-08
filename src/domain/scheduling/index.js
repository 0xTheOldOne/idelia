/**
 * Moteur de planification — API PUBLIQUE (§5.15 du plan `009`), seul point
 * d'entrée pour `010`/`011` (jamais un import d'un sous-fichier interne
 * directement) : surface stable, réorganisation interne possible sans
 * casser les appelants.
 *
 * Surface **finale** (tâche 5/5) : `genererPlanning`, `validerPlanning`,
 * `creerContraintes`, `TYPES_CONTRAINTE`, `calculerScore`, `indexer`,
 * `appliquerChangement`.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */
export { genererPlanning } from './genererPlanning.js';
export { validerPlanning } from './validerPlanning.js';
export { creerContraintes, TYPES_CONTRAINTE } from './contraintes/index.js';
export { calculerScore } from './heuristiques/scoring.js';
export { indexer, appliquerChangement } from './modele/planning.js';
