/**
 * Recherche locale — hill-climbing anytime + redémarrages seedés (§5.13 du
 * plan `0009`). Améliore le résultat du glouton **sans jamais casser une
 * contrainte dure**, ni jamais toucher une affectation `verrouillee: true`.
 *
 * Voisinage à 3 mouvements : **REASSIGNER** (changer la personne d'une
 * affectation existante), **ECHANGER** (permuter les personnes de deux
 * affectations), **DEPLACER** (déplacer une personne vers un slot légal non
 * couvert). Boucle **anytime**, bornée par `budgetMs` ; conserve le
 * **meilleur** résultat rencontré. Pas de recuit simulé (§12 du plan, KISS).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Tout l'aléa passe par `rng`, consommé dans un ordre stable ; seul
 * `performance.now()`/`Date.now()` (chronométrage du budget anytime, non
 * décisionnel) est toléré ici.
 */

import { creerAffectationAuto } from '../modele/affectation.js';
import { indexer } from '../modele/planning.js';
import { calculerNonCouvertures } from '../contraintes/contrainteCouverture.js';

/** Nombre d'itérations sans amélioration avant un redémarrage seedé (repart du meilleur résultat connu). */
const ITERATIONS_AVANT_REDEMARRAGE = 40;

/**
 * Nombre de redémarrages consécutifs sans la moindre amélioration du
 * **meilleur** résultat connu avant de considérer la recherche convergée et
 * de s'arrêter, même si `budgetMs` n'est pas écoulé — évite de consommer
 * inutilement tout le budget sur un cas trivial déjà optimal (§9 du plan :
 * la génération sur un jeu d'exemple réduit doit rester de l'ordre de
 * quelques dizaines de millisecondes, pas systématiquement `budgetMs`).
 */
const REDEMARRAGES_AVANT_CONVERGENCE = 5;

/**
 * Horodatage courant en millisecondes — seule concession technique tolérée
 * pour le **chronométrage** du budget anytime, sans jamais influencer une
 * décision d'affectation.
 *
 * @returns {number}
 */
function maintenant() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

/**
 * Évalue un état candidat (tableau d'`Affectation`) au regard du catalogue
 * **complet** de contraintes : nombre d'erreurs dures et score souple.
 * Réutilise directement `contrainte.evaluer(ctx)` — même source de vérité
 * que `validerPlanning`, sans réinstancier le catalogue ni trier le résultat
 * (inutile ici, seuls les agrégats comptent).
 *
 * @param {import('../modele/affectation.js').Affectation[]} affectationsCandidates
 * @param {import('../modele/types.js').Contrainte[]} contraintes
 * @param {import('../modele/types.js').ContexteEvaluation} ctxBase
 * @returns {{nbErreursDures: number, score: number}}
 */
function evaluerEtat(affectationsCandidates, contraintes, ctxBase) {
  const ctx = { ...ctxBase, index: indexer(affectationsCandidates) };
  let nbErreursDures = 0;
  let score = 0;

  for (const contrainte of contraintes) {
    for (const violation of contrainte.evaluer(ctx)) {
      if (violation.severite === 'erreur') {
        nbErreursDures += 1;
      } else {
        score += violation.penalite ?? 0;
      }
    }
  }

  return { nbErreursDures, score };
}

/**
 * Liste les slots (tournée/date/créneau) actuellement non couverts, un
 * élément par personne manquante (`manque` unités par tournée/date/créneau).
 *
 * @param {import('../modele/types.js').Demande[]} demandes
 * @param {import('../modele/types.js').PlanningIndexe} indexPlanning
 * @returns {{tourneeId: string, date: string, creneau: string}[]}
 */
function listerSlotsNonCouverts(demandes, indexPlanning) {
  const slots = [];
  for (const nonCouverture of calculerNonCouvertures(demandes, indexPlanning)) {
    for (let i = 0; i < nonCouverture.manque; i += 1) {
      slots.push({
        tourneeId: nonCouverture.tourneeId,
        date: nonCouverture.date,
        creneau: nonCouverture.creneau,
      });
    }
  }
  return slots;
}

/**
 * Mouvement REASSIGNER : change la personne d'une affectation modifiable
 * choisie au hasard (RNG) pour une autre personne active, elle aussi choisie
 * au hasard.
 *
 * @param {import('../modele/affectation.js').Affectation[]} affectations
 * @param {import('../modele/affectation.js').Affectation[]} modifiables - Sous-ensemble non verrouillé de `affectations`, ordre stable.
 * @param {import('@/domain/personnes.js').Personne[]} personnesActives
 * @param {function(): number} rng
 * @returns {import('../modele/affectation.js').Affectation[]} Nouveau tableau (immuable).
 */
function appliquerReassigner(affectations, modifiables, personnesActives, rng) {
  const affectationChoisie = modifiables[Math.floor(rng() * modifiables.length)];
  const autresPersonnes = personnesActives.filter((personne) => personne.id !== affectationChoisie.personneId);
  if (autresPersonnes.length === 0) return affectations;

  const nouvellePersonne = autresPersonnes[Math.floor(rng() * autresPersonnes.length)];
  const maintenantIso = new Date().toISOString();

  return affectations.map((affectation) =>
    affectation.id === affectationChoisie.id
      ? { ...affectation, personneId: nouvellePersonne.id, updatedAt: maintenantIso }
      : affectation
  );
}

/**
 * Mouvement ECHANGER : permute les personnes de deux affectations
 * modifiables distinctes, choisies au hasard (RNG).
 *
 * @param {import('../modele/affectation.js').Affectation[]} affectations
 * @param {import('../modele/affectation.js').Affectation[]} modifiables - Ordre stable, longueur ≥ 2 (garanti par l'appelant).
 * @param {function(): number} rng
 * @returns {import('../modele/affectation.js').Affectation[]} Nouveau tableau (immuable).
 */
function appliquerEchanger(affectations, modifiables, rng) {
  const indexA = Math.floor(rng() * modifiables.length);
  let indexB = Math.floor(rng() * modifiables.length);
  if (indexB === indexA) indexB = (indexB + 1) % modifiables.length;

  const affectationA = modifiables[indexA];
  const affectationB = modifiables[indexB];
  const maintenantIso = new Date().toISOString();

  return affectations.map((affectation) => {
    if (affectation.id === affectationA.id) {
      return { ...affectation, personneId: affectationB.personneId, updatedAt: maintenantIso };
    }
    if (affectation.id === affectationB.id) {
      return { ...affectation, personneId: affectationA.personneId, updatedAt: maintenantIso };
    }
    return affectation;
  });
}

/**
 * Mouvement DEPLACER : retire une affectation modifiable choisie au hasard
 * (RNG) et réaffecte la **même** personne à un slot actuellement non couvert,
 * lui aussi choisi au hasard (RNG). La légalité (aucune dure cassée) est
 * vérifiée par l'appelant via `evaluerEtat`, jamais ici.
 *
 * @param {import('../modele/affectation.js').Affectation[]} affectations
 * @param {import('../modele/affectation.js').Affectation[]} modifiables - Ordre stable, non vide (garanti par l'appelant).
 * @param {{tourneeId: string, date: string, creneau: string}[]} slotsLibres - Ordre stable, non vide (garanti par l'appelant).
 * @param {function(): number} rng
 * @returns {import('../modele/affectation.js').Affectation[]} Nouveau tableau (immuable).
 */
function appliquerDeplacer(affectations, modifiables, slotsLibres, rng) {
  const affectationChoisie = modifiables[Math.floor(rng() * modifiables.length)];
  const slotChoisi = slotsLibres[Math.floor(rng() * slotsLibres.length)];

  const sansOrigine = affectations.filter((affectation) => affectation.id !== affectationChoisie.id);
  const nouvelleAffectation = creerAffectationAuto(
    affectationChoisie.personneId,
    slotChoisi.tourneeId,
    slotChoisi.date,
    slotChoisi.creneau
  );

  return [...sansOrigine, nouvelleAffectation];
}

/**
 * Tire un mouvement voisin réalisable (REASSIGNER/ECHANGER/DEPLACER), en ne
 * considérant que les types effectivement possibles dans l'état courant.
 * Renvoie `null` si **aucun** mouvement n'est possible (rien à modifier, ni
 * à couvrir) — l'appelant arrête alors la boucle, jamais une exception.
 *
 * @param {import('../modele/affectation.js').Affectation[]} affectations
 * @param {import('../modele/types.js').ContexteEvaluation} ctx - `ctx.demandes`/`ctx.entree.personnes` utilisés.
 * @param {function(): number} rng
 * @returns {(import('../modele/affectation.js').Affectation[]|null)}
 */
function tirerMouvement(affectations, ctx, rng) {
  const modifiables = affectations.filter((affectation) => !affectation.verrouillee);
  const personnesActives = (ctx.entree.personnes ?? []).filter((personne) => personne.actif !== false);
  const slotsLibres = listerSlotsNonCouverts(ctx.demandes ?? [], indexer(affectations));

  const typesDisponibles = [];
  if (modifiables.length > 0 && personnesActives.length > 1) typesDisponibles.push('REASSIGNER');
  if (modifiables.length >= 2) typesDisponibles.push('ECHANGER');
  if (modifiables.length > 0 && slotsLibres.length > 0) typesDisponibles.push('DEPLACER');

  if (typesDisponibles.length === 0) return null;

  const type = typesDisponibles[Math.floor(rng() * typesDisponibles.length)];

  if (type === 'REASSIGNER') return appliquerReassigner(affectations, modifiables, personnesActives, rng);
  if (type === 'ECHANGER') return appliquerEchanger(affectations, modifiables, rng);
  return appliquerDeplacer(affectations, modifiables, slotsLibres, rng);
}

/**
 * Améliore par recherche locale (hill-climbing anytime + redémarrages
 * seedés) le résultat du glouton, sans jamais casser une contrainte dure ni
 * toucher une affectation verrouillée. Conserve le **meilleur** résultat
 * rencontré (jamais pire que l'état initial). Ne lève jamais.
 *
 * @param {import('../modele/affectation.js').Affectation[]} affectations - Résultat du glouton (`constructionGloutonne`).
 * @param {import('../modele/types.js').Contrainte[]} contraintes - Catalogue complet (`creerContraintes`), même liste que `validerPlanning`.
 * @param {import('../modele/types.js').ContexteEvaluation} ctx - `ctx.demandes`/`ctx.entree` utilisés ; `ctx.index` est ignoré (reconstruit en interne à chaque évaluation).
 * @param {function(): number} rng - PRNG seedé (`creerRng`), suite de celui du glouton.
 * @param {number} [budgetMs=200] - Budget de temps anytime (millisecondes).
 * @returns {import('../modele/affectation.js').Affectation[]} Meilleur résultat rencontré.
 */
export function ameliorerLocalement(affectations, contraintes, ctx, rng, budgetMs = 200) {
  const debut = maintenant();

  let meilleur = affectations;
  let etatMeilleur = evaluerEtat(meilleur, contraintes, ctx);
  let courant = meilleur;
  let etatCourant = etatMeilleur;
  let iterationsSansAmelioration = 0;
  let redemarragesSansAmelioration = 0;
  let etatMeilleurAuDernierRedemarrage = etatMeilleur;

  while (maintenant() - debut < budgetMs) {
    const candidat = tirerMouvement(courant, ctx, rng);
    if (!candidat) break; // aucun mouvement possible : inutile de continuer à boucler

    const etatCandidat = evaluerEtat(candidat, contraintes, ctx);
    const neCasseAucuneDure = etatCandidat.nbErreursDures <= etatCourant.nbErreursDures;
    const ameliore = etatCandidat.nbErreursDures < etatCourant.nbErreursDures || etatCandidat.score < etatCourant.score;

    if (neCasseAucuneDure && ameliore) {
      courant = candidat;
      etatCourant = etatCandidat;
      iterationsSansAmelioration = 0;

      const estMeilleurQueLeMeilleur =
        etatCandidat.nbErreursDures < etatMeilleur.nbErreursDures ||
        (etatCandidat.nbErreursDures === etatMeilleur.nbErreursDures && etatCandidat.score < etatMeilleur.score);

      if (estMeilleurQueLeMeilleur) {
        meilleur = candidat;
        etatMeilleur = etatCandidat;
      }
    } else {
      iterationsSansAmelioration += 1;
      if (iterationsSansAmelioration >= ITERATIONS_AVANT_REDEMARRAGE) {
        const aProgresseDepuisLeDernierRedemarrage =
          etatMeilleur.nbErreursDures < etatMeilleurAuDernierRedemarrage.nbErreursDures ||
          (etatMeilleur.nbErreursDures === etatMeilleurAuDernierRedemarrage.nbErreursDures &&
            etatMeilleur.score < etatMeilleurAuDernierRedemarrage.score);

        redemarragesSansAmelioration = aProgresseDepuisLeDernierRedemarrage ? 0 : redemarragesSansAmelioration + 1;
        etatMeilleurAuDernierRedemarrage = etatMeilleur;

        if (redemarragesSansAmelioration >= REDEMARRAGES_AVANT_CONVERGENCE) break; // convergé : arrêt anticipé, budget non consommé inutilement

        courant = meilleur; // redémarrage seedé : repart du meilleur résultat connu
        etatCourant = etatMeilleur;
        iterationsSansAmelioration = 0;
      }
    }
  }

  return meilleur;
}
