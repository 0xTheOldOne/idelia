/**
 * Contrainte souple **globale** « continuité » : favorise de garder la même
 * personne sur une tournée d'un jour ouvré au suivant (§7.3 du plan). Utilise
 * `entree.planningPrecedent` pour le premier jour de la période, sinon les
 * jours déjà posés dans la génération courante. Impact principalement sur le
 * **coût marginal** pendant la génération ; les violations produites en
 * validation restent de faible pénalité.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { messagePour } from '../modele/messages.js';

/** Poids souple par défaut (surchargeable via `entree.poids.continuite`, `contraintes/index.js`). */
const POIDS_CONTINUITE_DEFAUT = 2;

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} personneId
 * @returns {string}
 */
function nomPersonneDe(entree, personneId) {
  const personne = entree.personnes.find((p) => p.id === personneId);
  return personne ? `${personne.prenom} ${personne.nom}` : 'une personne';
}

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} tourneeId
 * @returns {string}
 */
function nomTourneeDe(entree, tourneeId) {
  const tournee = entree.tournees.find((t) => t.id === tourneeId);
  return tournee ? tournee.nom : 'Cette tournée';
}

/**
 * Identifie la personne qui a assuré une tournée le jour ouvré précédent le
 * jour de `demande`, en cherchant d'abord dans les jours déjà posés de la
 * génération courante (`ctx.joursPeriode`/`ctx.index`), puis dans
 * `entree.planningPrecedent` si `demande` tombe le premier jour de la
 * période. `null` si aucune personne connue (première tournée, pas
 * d'historique).
 *
 * @param {import('../modele/types.js').Demande} demande
 * @param {import('../modele/types.js').ContexteEvaluation} ctx
 * @returns {(string|null)}
 */
function personnePrecedenteSurTournee(demande, ctx) {
  const jours = ctx.joursPeriode;
  const indexJour = jours.indexOf(demande.date);
  const affectationsTournee = ctx.index.parTournee.get(demande.tourneeId) ?? [];

  if (indexJour > 0) {
    const jourPrecedent = jours[indexJour - 1];
    const affectation = affectationsTournee.find((a) => a.date === jourPrecedent);
    return affectation ? affectation.personneId : null;
  }

  const planningPrecedent = ctx.entree.planningPrecedent;
  const affectationsPrecedentes = Array.isArray(planningPrecedent?.affectations) ? planningPrecedent.affectations : [];
  const candidates = affectationsPrecedentes.filter(
    (a) => a.tourneeId === demande.tourneeId && a.date < demande.date
  );
  if (candidates.length === 0) return null;

  const plusRecente = candidates.reduce((max, a) => (a.date > max.date ? a : max));
  return plusRecente.personneId;
}

/**
 * Construit la contrainte souple globale « continuité ».
 *
 * @param {number} [poids=POIDS_CONTINUITE_DEFAUT] - Poids souple, surchargeable
 *   par la fabrique (`contraintes/index.js`, `entree.poids.continuite`).
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteContinuite(poids = POIDS_CONTINUITE_DEFAUT) {
  return {
    id: 'continuite',
    type: 'CONTINUITE',
    durete: 'souple',
    poids,
    granularite: 'global',

    coutMarginal(personneId, demande, ctx) {
      const precedente = personnePrecedenteSurTournee(demande, ctx);
      if (!precedente) return 0;
      return precedente === personneId ? 0 : poids;
    },

    evaluer(ctx) {
      const jours = ctx.joursPeriode;
      const tourneeIds = [...ctx.index.parTournee.keys()].sort();
      const violations = [];

      for (const tourneeId of tourneeIds) {
        const affectationsTournee = ctx.index.parTournee.get(tourneeId) ?? [];

        for (let i = 0; i < jours.length - 1; i += 1) {
          const jourA = jours[i];
          const jourB = jours[i + 1];
          const affA = affectationsTournee.filter((a) => a.date === jourA);
          const affB = affectationsTournee.filter((a) => a.date === jourB);
          if (affA.length === 0 || affB.length === 0) continue;

          const personnesA = new Set(affA.map((a) => a.personneId));
          const personnesB = new Set(affB.map((a) => a.personneId));
          const continuiteMaintenue = [...personnesA].some((id) => personnesB.has(id));
          if (continuiteMaintenue) continue;

          const personneIdA = [...personnesA].sort()[0];
          const personneIdB = [...personnesB].sort()[0];

          violations.push({
            contrainteId: 'continuite',
            severite: 'avertissement',
            cible: { tourneeId, date: jourB },
            code: 'CONTINUITE_ROMPUE',
            message: messagePour('CONTINUITE_ROMPUE', {
              nomTournee: nomTourneeDe(ctx.entree, tourneeId),
              dateB: jourB,
              nomPersonneA: nomPersonneDe(ctx.entree, personneIdA),
              nomPersonneB: nomPersonneDe(ctx.entree, personneIdB),
            }),
            penalite: poids,
            params: { tourneeId, dateA: jourA, dateB: jourB, personneIdA, personneIdB },
          });
        }
      }

      return violations;
    },
  };
}
