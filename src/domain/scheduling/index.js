/**
 * Moteur de planification — API PUBLIQUE (§5.15 du plan `0009`, amendée par
 * `0010` §5.3), seul point d'entrée pour `0010`/`0011` (jamais un import d'un
 * sous-fichier interne directement) : surface stable, réorganisation
 * interne possible sans casser les appelants.
 *
 * Surface **actuelle** (8 entrées, après amendement `0010`) :
 * `genererPlanning`, `validerPlanning`, `creerContraintes`,
 * `TYPES_CONTRAINTE`, `calculerScore`, `indexer`, `appliquerChangement`,
 * `diagnostiquer`.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */
export { genererPlanning } from './genererPlanning.js';
export { validerPlanning } from './validerPlanning.js';
export { creerContraintes, TYPES_CONTRAINTE } from './contraintes/index.js';
export { calculerScore } from './heuristiques/scoring.js';
export { indexer, appliquerChangement } from './modele/planning.js';
export { diagnostiquer } from './diagnostiquer.js';
