/**
 * Contrainte dure « chevauchement » : une personne ne peut être affectée à
 * deux vacations dont les **horaires réels se chevauchent** le même jour
 * (feature 0016, ADR 0017 — recouvrement horaire réel entre segments, via
 * `heuresSeChevauchent`, plutôt qu'une égalité de créneau symbolique).
 * **Conséquence clé** : les deux segments disjoints d'une même tournée
 * coupée (matin/soir) ne se chevauchent pas — une même personne peut donc
 * couvrir les deux (cas nominal ADR 0017).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { heuresSeChevauchent } from '@/domain/absences.js';
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
  return tournee ? tournee.libelle : 'cette tournée';
}

/**
 * Résout les horaires réels `"HH:mm"` d'une `Affectation`, par lookup de
 * `tournee.segments[affectation.segmentIndex]` — jamais dénormalisés sur
 * l'affectation elle-même (feature 0016, ADR 0017). `null` si la tournée ou
 * le segment référencé est introuvable (référence orpheline) : jamais de
 * crash, la paire est alors simplement ignorée par l'appelant.
 *
 * @param {import('../modele/affectation.js').Affectation} affectation
 * @param {import('../modele/types.js').Entree} entree
 * @returns {({heureDebut: string, heureFin: string}|null)}
 */
function horairesDeAffectation(affectation, entree) {
  const tournee = entree.tournees.find((t) => t.id === affectation.tourneeId);
  const segment = tournee ? tournee.segments[affectation.segmentIndex] : undefined;
  return segment ? { heureDebut: segment.heureDebut, heureFin: segment.heureFin } : null;
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
      return !affectationsPersonne.some((affectation) => {
        if (affectation.date !== demande.date) return false;
        const horaires = horairesDeAffectation(affectation, ctx.entree);
        if (!horaires) return false; // référence introuvable : jamais de blocage sur une donnée incohérente
        return heuresSeChevauchent(horaires.heureDebut, horaires.heureFin, demande.heureDebut, demande.heureFin);
      });
    },

    evaluer(ctx) {
      const violations = [];

      for (const [personneId, affectationsPersonne] of ctx.index.parPersonne) {
        for (let i = 0; i < affectationsPersonne.length; i += 1) {
          for (let j = i + 1; j < affectationsPersonne.length; j += 1) {
            const affectationA = affectationsPersonne[i];
            const affectationB = affectationsPersonne[j];

            if (affectationA.date !== affectationB.date) continue;

            const horairesA = horairesDeAffectation(affectationA, ctx.entree);
            const horairesB = horairesDeAffectation(affectationB, ctx.entree);
            if (!horairesA || !horairesB) continue;
            if (!heuresSeChevauchent(horairesA.heureDebut, horairesA.heureFin, horairesB.heureDebut, horairesB.heureFin)) {
              continue;
            }

            violations.push({
              contrainteId: 'chevauchement',
              severite: 'erreur',
              cible: { personneId, date: affectationA.date },
              code: 'CHEVAUCHEMENT',
              message: messagePour('CHEVAUCHEMENT', {
                nomPersonne: nomPersonneDe(ctx.entree, personneId),
                date: affectationA.date,
                nomTourneeA: nomTourneeDe(ctx.entree, affectationA.tourneeId),
                heureDebutA: horairesA.heureDebut,
                heureFinA: horairesA.heureFin,
                nomTourneeB: nomTourneeDe(ctx.entree, affectationB.tourneeId),
                heureDebutB: horairesB.heureDebut,
                heureFinB: horairesB.heureFin,
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
