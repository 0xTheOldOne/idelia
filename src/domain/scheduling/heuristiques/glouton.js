/**
 * Construction gloutonne (algorithme MRV — Minimum Remaining Values) du
 * planning (§5.12 du plan `0009`), fidèle au pseudocode de
 * `docs/architecture/05-moteur-de-planification.md` §3.
 *
 * Traite les `Demande` restantes (après retrait de celles déjà couvertes par
 * une affectation verrouillée) dans l'ordre du nombre de candidats légaux
 * croissant, départagé par le RNG seedé. Pour chaque demande, choisit le
 * candidat légal au coût marginal souple minimal (départage RNG). Les
 * contraintes dures **temporelles** (repos légal, jours consécutifs) sont
 * re-vérifiées **dynamiquement** à chaque affectation posée (l'index est
 * reconstruit avant chaque décision). Ne lève **jamais** : une demande sans
 * candidat légal est simplement laissée non couverte, jamais une exception.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Tout l'aléa passe par `rng`, consommé dans un ordre stable (jamais
 * d'itération non triée d'objet/Map/Set avant consommation).
 */

import { creerAffectationAuto } from '../modele/affectation.js';
import { indexer } from '../modele/planning.js';
import { coutMarginalAgrege } from './scoring.js';

/**
 * Retire de `demandes` celles déjà couvertes par une affectation verrouillée
 * (même tournée/date/segment) — une affectation verrouillée « consomme »
 * exactement une unité de demande de ce slot.
 *
 * @param {import('../modele/types.js').Demande[]} demandes
 * @param {import('../modele/affectation.js').Affectation[]} verrouillees
 * @returns {import('../modele/types.js').Demande[]} Demandes non couvertes par une affectation verrouillée.
 */
function retirerDemandesCouvertes(demandes, verrouillees) {
  const disponibles = new Map();
  for (const affectation of verrouillees) {
    const cle = `${affectation.tourneeId}|${affectation.date}|${affectation.segmentIndex}`;
    disponibles.set(cle, (disponibles.get(cle) ?? 0) + 1);
  }

  const demandesRestantes = [];
  for (const demande of demandes) {
    const cle = `${demande.tourneeId}|${demande.date}|${demande.segmentIndex}`;
    const restant = disponibles.get(cle) ?? 0;
    if (restant > 0) {
      disponibles.set(cle, restant - 1);
      continue;
    }
    demandesRestantes.push(demande);
  }

  return demandesRestantes;
}

/**
 * Liste des identifiants de personnes actives légales pour `demande` selon
 * **toutes** les contraintes dures dont `autoriseAffectation` existe.
 *
 * @param {import('../modele/types.js').Demande} demande
 * @param {import('@/domain/personnes.js').Personne[]} personnesActives - Ordre stable (celui de `entree.personnes`).
 * @param {import('../modele/types.js').Contrainte[]} contraintesDures
 * @param {import('../modele/types.js').ContexteEvaluation} ctx
 * @returns {string[]} Identifiants de personnes candidates, dans l'ordre de `personnesActives`.
 */
function candidatsLegaux(demande, personnesActives, contraintesDures, ctx) {
  return personnesActives
    .map((personne) => personne.id)
    .filter((personneId) =>
      contraintesDures.every((contrainte) => contrainte.autoriseAffectation(personneId, demande, ctx))
    );
}

/**
 * Trie les demandes par nombre de candidats légaux croissant (MRV),
 * départage stable par le RNG seedé — consommé une fois par demande, dans
 * l'ordre stable d'origine de `demandes` (jamais un ordre d'itération non
 * trié).
 *
 * @param {import('../modele/types.js').Demande[]} demandes
 * @param {import('@/domain/personnes.js').Personne[]} personnesActives
 * @param {import('../modele/types.js').Contrainte[]} contraintesDures
 * @param {import('../modele/types.js').ContexteEvaluation} ctx
 * @param {function(): number} rng
 * @returns {import('../modele/types.js').Demande[]} Demandes triées par MRV.
 */
function trierParMrv(demandes, personnesActives, contraintesDures, ctx, rng) {
  const avecCles = demandes.map((demande) => ({
    demande,
    nbCandidats: candidatsLegaux(demande, personnesActives, contraintesDures, ctx).length,
    tirage: rng(),
  }));

  avecCles.sort((a, b) => {
    if (a.nbCandidats !== b.nbCandidats) return a.nbCandidats - b.nbCandidats;
    return a.tirage - b.tirage;
  });

  return avecCles.map((entree) => entree.demande);
}

/**
 * Choisit, parmi des candidats déjà jugés légaux, celui au coût marginal
 * souple minimal (départage par le RNG seedé, consommé une fois par
 * candidat, dans l'ordre stable de `candidats`).
 *
 * @param {string[]} candidats - Identifiants de personnes, ordre stable.
 * @param {import('../modele/types.js').Demande} demande
 * @param {import('../modele/types.js').Contrainte[]} contraintes - Catalogue complet (`coutMarginalAgrege` filtre les souples).
 * @param {import('../modele/types.js').ContexteEvaluation} ctx
 * @param {function(): number} rng
 * @returns {string} Identifiant de la personne choisie.
 */
function choisirMeilleurCandidat(candidats, demande, contraintes, ctx, rng) {
  const avecCouts = candidats.map((personneId) => ({
    personneId,
    cout: coutMarginalAgrege(personneId, demande, contraintes, ctx),
    tirage: rng(),
  }));

  avecCouts.sort((a, b) => {
    if (a.cout !== b.cout) return a.cout - b.cout;
    return a.tirage - b.tirage;
  });

  return avecCouts[0].personneId;
}

/**
 * Construit le planning par glouton MRV (§5.12 du plan `0009`). Inclut
 * d'emblée `entree.affectationsVerrouillees`, préservées à l'identique (mode
 * hybride, ADR 0007).
 *
 * @param {import('../modele/types.js').Demande[]} demandes - Toutes les demandes de la période (`expanserDemandes`).
 * @param {import('../modele/types.js').Contrainte[]} contraintes - Catalogue complet (`creerContraintes`), même liste que `validerPlanning`.
 * @param {import('../modele/types.js').ContexteEvaluation} ctx - `ctx.entree`/`ctx.joursPeriode` utilisés ; `ctx.index` est ignoré (reconstruit en interne à chaque étape, pour une vérification dynamique des dures temporelles).
 * @param {function(): number} rng - PRNG seedé (`creerRng`).
 * @returns {import('../modele/affectation.js').Affectation[]} Affectations posées (verrouillées comprises), jamais une exception.
 */
export function constructionGloutonne(demandes, contraintes, ctx, rng) {
  const verrouillees = ctx.entree.affectationsVerrouillees ?? [];
  const personnesActives = (ctx.entree.personnes ?? []).filter((personne) => personne.actif !== false);
  const contraintesDures = contraintes.filter(
    (contrainte) => contrainte.durete === 'dure' && typeof contrainte.autoriseAffectation === 'function'
  );

  let affectations = [...verrouillees];

  const demandesRestantes = retirerDemandesCouvertes(demandes, verrouillees);
  const ctxInitial = { ...ctx, index: indexer(affectations) };
  const demandesOrdonnees = trierParMrv(demandesRestantes, personnesActives, contraintesDures, ctxInitial, rng);

  for (const demande of demandesOrdonnees) {
    const ctxCourant = { ...ctx, index: indexer(affectations) };
    const candidats = candidatsLegaux(demande, personnesActives, contraintesDures, ctxCourant);

    if (candidats.length === 0) continue; // aucun candidat légal : demande non couverte, jamais d'exception

    const personneId = choisirMeilleurCandidat(candidats, demande, contraintes, ctxCourant, rng);
    affectations = [
      ...affectations,
      creerAffectationAuto(personneId, demande.tourneeId, demande.date, demande.segmentIndex),
    ];
  }

  return affectations;
}
