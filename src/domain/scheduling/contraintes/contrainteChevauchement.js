/**
 * Contrainte dure « chevauchement » : une personne ne peut être affectée
 * qu'à **une seule** tournée par (date, créneau) — deux créneaux se
 * chevauchent selon la même règle que `creneauxSeChevauchent` (`JOURNEE`
 * chevauche tout, `domain/absences.js`, seule source de vérité de cette
 * règle).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { creneauxSeChevauchent } from '@/domain/absences.js';
import { messagePour } from '../modele/messages.js';

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} personneId
 * @returns {string}
 */
function nomPersonneDe(entree, personneId) {
  const personne = entree.personnes.find((p) => p.id === personneId);
  return personne ? `${personne.prenom} ${personne.nom}` : 'Cette personne';
}

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} tourneeId
 * @returns {string}
 */
function nomTourneeDe(entree, tourneeId) {
  const tournee = entree.tournees.find((t) => t.id === tourneeId);
  return tournee ? tournee.nom : 'cette tournée';
}

/**
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteChevauchement() {
  return {
    id: 'chevauchement',
    type: 'CHEVAUCHEMENT',
    durete: 'dure',
    granularite: 'creneau',

    autoriseAffectation(personneId, demande, ctx) {
      const affectationsPersonne = ctx.index.parPersonne.get(personneId) ?? [];
      return !affectationsPersonne.some(
        (affectation) =>
          affectation.date === demande.date && creneauxSeChevauchent(affectation.creneau, demande.creneau)
      );
    },

    evaluer(ctx) {
      const violations = [];

      for (const [personneId, affectationsPersonne] of ctx.index.parPersonne) {
        for (let i = 0; i < affectationsPersonne.length; i += 1) {
          for (let j = i + 1; j < affectationsPersonne.length; j += 1) {
            const affectationA = affectationsPersonne[i];
            const affectationB = affectationsPersonne[j];

            if (affectationA.date !== affectationB.date) continue;
            if (!creneauxSeChevauchent(affectationA.creneau, affectationB.creneau)) continue;

            violations.push({
              contrainteId: 'chevauchement',
              severite: 'erreur',
              cible: { personneId, date: affectationA.date },
              code: 'CHEVAUCHEMENT',
              message: messagePour('CHEVAUCHEMENT', {
                nomPersonne: nomPersonneDe(ctx.entree, personneId),
                date: affectationA.date,
                nomTourneeA: nomTourneeDe(ctx.entree, affectationA.tourneeId),
                creneauA: affectationA.creneau,
                nomTourneeB: nomTourneeDe(ctx.entree, affectationB.tourneeId),
                creneauB: affectationB.creneau,
              }),
              penalite: 0,
              params: {
                personneId,
                date: affectationA.date,
                affectationIdA: affectationA.id,
                affectationIdB: affectationB.id,
                tourneeIdA: affectationA.tourneeId,
                tourneeIdB: affectationB.tourneeId,
              },
            });
          }
        }
      }

      return violations;
    },
  };
}
