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
 * Signature stable d'une violation dure (même problème = même signature).
 *
 * @param {import('../modele/types.js').Violation} violation
 * @returns {string}
 */
function signatureDure(violation) {
  return `${violation.contrainteId}|${violation.code}|${JSON.stringify(violation.cible)}|${violation.params?.semaineDebut ?? ''}`;
}

/**
 * Ampleur d'une violation dure (déficit, jours en trop…) : `Violation.ampleur`, 1 par défaut.
 *
 * @param {import('../modele/types.js').Violation} violation
 * @returns {number}
 */
function magnitudeDure(violation) {
  return violation.ampleur ?? 1;
}

/**
 * @typedef {Object} EtatEvalue - Évaluation d'un tableau d'affectations, calculée une seule fois.
 * @property {import('../modele/affectation.js').Affectation[]} affectations
 * @property {import('../modele/types.js').PlanningIndexe} index - Index de `affectations`, réutilisé par le voisinage.
 * @property {number} nbErreursDures
 * @property {number} score
 * @property {import('../modele/types.js').Violation[]} violationsDures
 * @property {(Map<string, number>|null)} dures - Ampleur par signature, construite à la demande (`duresDe`).
 * @property {({modifiables: import('../modele/affectation.js').Affectation[], slotsLibres: {tourneeId: string, date: string, segmentIndex: number}[]}|null)} voisinage - Calculé à la demande (`voisinageDe`).
 */

/**
 * Évalue un état candidat (tableau d'`Affectation`) au regard du catalogue
 * **complet** de contraintes : nombre d'erreurs dures et score souple
 * (pénalités des violations, plus les `coutGlobal` des souples silencieuses
 * de 0021, jamais affichées).
 * Réutilise directement `contrainte.evaluer(ctx)` — même source de vérité
 * que `validerPlanning`, sans réinstancier le catalogue ni trier le résultat
 * (inutile ici, seuls les agrégats comptent).
 *
 * @param {import('../modele/affectation.js').Affectation[]} affectationsCandidates
 * @param {import('../modele/types.js').Contrainte[]} contraintes
 * @param {import('../modele/types.js').ContexteEvaluation} ctxBase
 * @returns {EtatEvalue}
 */
function evaluerEtat(affectationsCandidates, contraintes, ctxBase) {
  const index = indexer(affectationsCandidates);
  const ctx = { ...ctxBase, index };
  let score = 0;
  const violationsDures = [];

  for (const contrainte of contraintes) {
    for (const violation of contrainte.evaluer(ctx)) {
      if (violation.severite === 'erreur') violationsDures.push(violation);
      else score += violation.penalite ?? 0;
    }
    if (typeof contrainte.coutGlobal === 'function') score += contrainte.coutGlobal(ctx) ?? 0;
  }

  return {
    affectations: affectationsCandidates,
    index,
    nbErreursDures: violationsDures.length,
    score,
    violationsDures,
    dures: null,
    voisinage: null,
  };
}

/**
 * Ampleur cumulée des violations dures d'un état, par signature (calculée au
 * premier appel, donc seulement pour les candidats qui améliorent).
 *
 * @param {EtatEvalue} etat
 * @returns {Map<string, number>}
 */
function duresDe(etat) {
  if (!etat.dures) {
    const dures = new Map();
    for (const violation of etat.violationsDures) {
      const signature = signatureDure(violation);
      dures.set(signature, (dures.get(signature) ?? 0) + magnitudeDure(violation));
    }
    etat.dures = dures;
  }
  return etat.dures;
}

/**
 * Indique si un candidat **aggrave** les contraintes dures par rapport à
 * l'état courant : violation absente de l'état courant (nouvelle, y compris
 * en échange d'une autre) ou d'ampleur supérieure. Nécessaire car certaines
 * contraintes n'émettent qu'une violation par personne/semaine : le simple
 * comptage laisserait passer 7 → 8 jours consécutifs.
 *
 * @param {EtatEvalue} etatCandidat
 * @param {EtatEvalue} etatCourant
 * @returns {boolean}
 */
function aggraveLesDures(etatCandidat, etatCourant) {
  const duresCourantes = duresDe(etatCourant);
  for (const [signature, ampleur] of duresDe(etatCandidat)) {
    if (ampleur > (duresCourantes.get(signature) ?? 0)) return true;
  }
  return false;
}

/**
 * Liste les slots (tournée/date/segment) actuellement non couverts, un
 * élément par personne manquante (`manque` unités par tournée/date/segment).
 *
 * @param {import('../modele/types.js').Demande[]} demandes
 * @param {import('../modele/types.js').PlanningIndexe} indexPlanning
 * @returns {{tourneeId: string, date: string, segmentIndex: number}[]}
 */
function listerSlotsNonCouverts(demandes, indexPlanning) {
  const slots = [];
  for (const nonCouverture of calculerNonCouvertures(demandes, indexPlanning)) {
    for (let i = 0; i < nonCouverture.manque; i += 1) {
      slots.push({
        tourneeId: nonCouverture.tourneeId,
        date: nonCouverture.date,
        segmentIndex: nonCouverture.segmentIndex,
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
 * @param {{tourneeId: string, date: string, segmentIndex: number}[]} slotsLibres - Ordre stable, non vide (garanti par l'appelant).
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
    slotChoisi.segmentIndex
  );

  return [...sansOrigine, nouvelleAffectation];
}

/**
 * Voisinage d'un état (affectations modifiables et slots libres), calculé au
 * plus une fois par état.
 *
 * @param {EtatEvalue} etat
 * @param {import('../modele/types.js').Demande[]} demandes
 * @returns {{modifiables: import('../modele/affectation.js').Affectation[], slotsLibres: {tourneeId: string, date: string, segmentIndex: number}[]}}
 */
function voisinageDe(etat, demandes) {
  if (!etat.voisinage) {
    etat.voisinage = {
      modifiables: etat.affectations.filter((affectation) => !affectation.verrouillee),
      slotsLibres: listerSlotsNonCouverts(demandes, etat.index),
    };
  }
  return etat.voisinage;
}

/**
 * Tire un mouvement voisin réalisable (REASSIGNER/ECHANGER/DEPLACER), en ne
 * considérant que les types effectivement possibles dans l'état courant.
 * Renvoie `null` si **aucun** mouvement n'est possible (rien à modifier, ni
 * à couvrir) — l'appelant arrête alors la boucle, jamais une exception.
 *
 * @param {EtatEvalue} etat - État courant (évalué).
 * @param {import('../modele/types.js').Demande[]} demandes
 * @param {import('@/domain/personnes.js').Personne[]} personnesActives
 * @param {function(): number} rng
 * @returns {(import('../modele/affectation.js').Affectation[]|null)}
 */
function tirerMouvement(etat, demandes, personnesActives, rng) {
  const { modifiables, slotsLibres } = voisinageDe(etat, demandes);
  const affectations = etat.affectations;

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
  const demandes = ctx.demandes ?? [];
  const personnesActives = (ctx.entree.personnes ?? []).filter((personne) => personne.actif !== false);

  let meilleur = affectations;
  let etatMeilleur = evaluerEtat(meilleur, contraintes, ctx);
  let etatCourant = etatMeilleur; // invariant : toujours l'évaluation exacte du tableau courant
  let iterationsSansAmelioration = 0;
  let redemarragesSansAmelioration = 0;
  let meilleurAuDernierRedemarrage = { nbErreursDures: etatMeilleur.nbErreursDures, score: etatMeilleur.score };

  while (maintenant() - debut < budgetMs) {
    const candidat = tirerMouvement(etatCourant, demandes, personnesActives, rng);
    if (!candidat) break; // aucun mouvement possible : inutile de continuer à boucler

    const etatCandidat = evaluerEtat(candidat, contraintes, ctx);
    const ameliore = etatCandidat.nbErreursDures < etatCourant.nbErreursDures || etatCandidat.score < etatCourant.score;

    if (ameliore && !aggraveLesDures(etatCandidat, etatCourant)) {
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
          etatMeilleur.nbErreursDures < meilleurAuDernierRedemarrage.nbErreursDures ||
          (etatMeilleur.nbErreursDures === meilleurAuDernierRedemarrage.nbErreursDures &&
            etatMeilleur.score < meilleurAuDernierRedemarrage.score);

        redemarragesSansAmelioration = aProgresseDepuisLeDernierRedemarrage ? 0 : redemarragesSansAmelioration + 1;
        meilleurAuDernierRedemarrage = { nbErreursDures: etatMeilleur.nbErreursDures, score: etatMeilleur.score };

        if (redemarragesSansAmelioration >= REDEMARRAGES_AVANT_CONVERGENCE) break; // convergé : arrêt anticipé, budget non consommé inutilement

        etatCourant = etatMeilleur; // redémarrage seedé : repart du meilleur résultat connu
        iterationsSansAmelioration = 0;
      }
    }
  }

  return meilleur;
}
