/**
 * Validation complète d'un planning (§5.10 du plan `0009`) : construit le
 * `ContexteEvaluation` puis appelle `evaluer(ctx)` de **chaque** contrainte
 * du catalogue `creerContraintes(entree)` -- la **même** source de vérité
 * que `genererPlanning` (§5.1 du plan, aucune règle métier dupliquée).
 *
 * Nuance de nommage volontaire (§5.10) : `validerPlanning` prend directement
 * un tableau d'`Affectation`, pas une entité `Planning` complète, pour
 * permettre à `0011` de valider un état **en cours d'édition** (avant tout
 * `commit` dans le store).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Fonction déterministe : deux appels avec les mêmes arguments renvoient un
 * résultat strictement identique, dans le même ordre.
 */

import { indexer } from './modele/planning.js';
import { expanserDemandes, joursPeriode } from './modele/demande.js';
import { creerContraintes } from './contraintes/index.js';

/**
 * Compare deux `Violation` pour un tri total et déterministe : les `erreur`
 * précèdent toujours les `avertissement` ; au sein d'une même sévérité, tri
 * par `penalite` décroissante ; les égalités sont départagées par
 * `contrainteId` puis `code` (critères stables, jamais un ordre d'itération
 * non trié) pour garantir un ordre strictement reproductible.
 *
 * @param {import('./modele/types.js').Violation} a
 * @param {import('./modele/types.js').Violation} b
 * @returns {number}
 */
function comparerViolations(a, b) {
  if (a.severite !== b.severite) {
    return a.severite === 'erreur' ? -1 : 1;
  }
  if (a.penalite !== b.penalite) {
    return (b.penalite ?? 0) - (a.penalite ?? 0);
  }
  if (a.contrainteId !== b.contrainteId) {
    return a.contrainteId < b.contrainteId ? -1 : 1;
  }
  if (a.code !== b.code) {
    return a.code < b.code ? -1 : 1;
  }
  return 0;
}

/**
 * Valide intégralement un tableau d'`Affectation` au regard de toutes les
 * règles métier du cabinet (§7 du plan `0009`). Ne lève **jamais** : une
 * `entree` limite (aucune personne, aucune tournée, période vide) produit
 * simplement un tableau de violations vide ou réduit, jamais une exception.
 *
 * @param {import('./modele/affectation.js').Affectation[]} affectations - Affectations à valider (peut être un état en cours d'édition, non persisté).
 * @param {import('./modele/types.js').Entree} entree
 * @returns {import('./modele/types.js').Violation[]} Violations triées : erreurs d'abord, puis avertissements par pénalité décroissante.
 */
export function validerPlanning(affectations, entree) {
  const ctx = {
    entree,
    index: indexer(affectations ?? []),
    demandes: expanserDemandes(entree),
    joursPeriode: joursPeriode(entree),
  };

  const contraintes = creerContraintes(entree);
  const violations = [];

  for (const contrainte of contraintes) {
    violations.push(...contrainte.evaluer(ctx));
  }

  return violations.sort(comparerViolations);
}
