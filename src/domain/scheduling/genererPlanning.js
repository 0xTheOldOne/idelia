/**
 * Orchestrateur de génération d'un planning (§5.14 du plan `009`), fidèle au
 * pseudocode de `docs/architecture/05-moteur-de-planification.md` §3.
 * Construit le catalogue de contraintes et les demandes, lance le glouton
 * MRV puis la recherche locale, valide le résultat (**même** validateur que
 * `validerPlanning`, aucune règle dupliquée) et assemble le `Resultat`
 * complet. Ne lève **jamais**, même sur une entrée vide ou irréaliste
 * (§7.4 du plan).
 *
 * Déterministe : `rng = creerRng((options.seed ?? 0) + (options.variante ?? 0))`
 * est la **seule** source d'aléa, consommée dans un ordre stable par le
 * glouton puis la recherche locale (ADR 0008). Seule exception tolérée :
 * `performance.now()`/`Date.now()` pour chronométrer `meta.dureeMs`
 * (chronométrage non décisionnel, sans impact sur le résultat).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { creerRng } from './utils/rng.js';
import { creerContraintes } from './contraintes/index.js';
import { expanserDemandes, joursPeriode } from './modele/demande.js';
import { indexer } from './modele/planning.js';
import { constructionGloutonne } from './heuristiques/glouton.js';
import { ameliorerLocalement } from './heuristiques/rechercheLocale.js';
import { diagnostiquer } from './diagnostiquer.js';

/**
 * Horodatage courant en millisecondes — seule concession technique tolérée
 * pour le **chronométrage** de `meta.dureeMs` (jamais pour une décision
 * d'affectation, comme `genId()`/`toISOString()` ailleurs dans le domaine).
 *
 * @returns {number}
 */
function maintenant() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/**
 * Génère une proposition de planning pour `entree`, en préservant à
 * l'identique `entree.affectationsVerrouillees` (mode hybride, ADR 0007).
 * Ne lève **jamais**, même sur une entrée vide (aucune personne, aucune
 * tournée, période vide) ou structurellement infaisable : une telle
 * situation se traduit par des `violations`/`tourneesNonCouvertes`
 * résiduelles, jamais par une exception.
 *
 * @param {import('./modele/types.js').Entree} entree
 * @param {import('./modele/types.js').Options} [options]
 * @returns {import('./modele/types.js').Resultat} Résultat complet.
 */
export function genererPlanning(entree, options = {}) {
  const debut = maintenant();
  const seed = (options.seed ?? 0) + (options.variante ?? 0);
  const rng = creerRng(seed);

  const contraintes = creerContraintes(entree);
  const demandes = expanserDemandes(entree);
  const ctx = {
    entree,
    demandes,
    joursPeriode: joursPeriode(entree),
    index: indexer(entree.affectationsVerrouillees ?? []),
  };

  let affectations = constructionGloutonne(demandes, contraintes, ctx, rng);
  affectations = ameliorerLocalement(affectations, contraintes, ctx, rng, options.budgetMs ?? 200);

  // MÊME diagnostic que celui recalculé au rechargement (010 §4.3), aucune règle dupliquée.
  const { violations, tourneesNonCouvertes, score } = diagnostiquer(affectations, entree);

  return {
    affectations,
    violations,
    score,
    tourneesNonCouvertes,
    meta: {
      seed,
      variante: options.variante ?? 0,
      dureeMs: maintenant() - debut,
      faisable: violations.every((violation) => violation.severite !== 'erreur'),
      nbErreursDures: violations.filter((violation) => violation.severite === 'erreur').length,
    },
  };
}
