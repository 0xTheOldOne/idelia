/**
 * Indexation et modification immuable d'une liste plate d'`Affectation`.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Les index (`Map`/`Set`) ne sont **jamais stockés** ailleurs, toujours
 * recalculés via `indexer(affectations)` (cf. docs/architecture/05).
 * `indexer` et `appliquerChangement` ne mutent jamais leurs entrées.
 */

/**
 * Ajoute `valeur` dans la liste associée à `cle` d'une `Map` (créée au besoin).
 *
 * @param {Map<string, Array>} map
 * @param {string} cle
 * @param {*} valeur
 */
function ajouterDansMap(map, cle, valeur) {
  if (!map.has(cle)) map.set(cle, []);
  map.get(cle).push(valeur);
}

/**
 * Construit les index (`Map`/`Set`) d'un tableau plat d'`Affectation`, sans
 * jamais le muter.
 *
 * @param {import('./affectation.js').Affectation[]} affectations
 * @returns {import('./types.js').PlanningIndexe} Index dérivés du planning.
 */
export function indexer(affectations) {
  const parCreneau = new Map();
  const parPersonne = new Map();
  const parTournee = new Map();
  const joursTravaillesParPersonne = new Map();

  for (const affectation of affectations) {
    ajouterDansMap(parCreneau, `${affectation.date}|${affectation.creneau}`, affectation);
    ajouterDansMap(parPersonne, affectation.personneId, affectation);
    ajouterDansMap(parTournee, affectation.tourneeId, affectation);

    if (!joursTravaillesParPersonne.has(affectation.personneId)) {
      joursTravaillesParPersonne.set(affectation.personneId, new Set());
    }
    joursTravaillesParPersonne.get(affectation.personneId).add(affectation.date);
  }

  return { affectations, parCreneau, parPersonne, parTournee, joursTravaillesParPersonne };
}

/**
 * Applique un `Changement` (`AJOUTER`/`RETIRER`/`DEPLACER`) à une liste
 * plate d'`Affectation`, en renvoyant un **nouveau** tableau — jamais de
 * mutation du tableau d'origine. Implémentation volontairement simple
 * (KISS) : reconstruit le tableau plutôt que de maintenir les index en
 * delta ; l'appelant réindexe (`indexer`) puis revalide au besoin.
 *
 * @param {import('./affectation.js').Affectation[]} affectations
 * @param {import('./types.js').Changement} changement
 * @returns {import('./affectation.js').Affectation[]} Nouveau tableau d'affectations.
 */
export function appliquerChangement(affectations, changement) {
  switch (changement.type) {
    case 'AJOUTER':
      return [...affectations, changement.affectation];
    case 'RETIRER':
      return affectations.filter((affectation) => affectation.id !== changement.affectationId);
    case 'DEPLACER':
      return [
        ...affectations.filter((affectation) => affectation.id !== changement.affectationId),
        changement.affectation,
      ];
    default:
      return [...affectations];
  }
}
