/**
 * Contrainte **dure** « présence » (feature 0031) : une personne n'est
 * planifiée que les jours où elle fait partie du cabinet
 * (`dateEntree ≤ date ≤ dateSortie`, bornes incluses, borne vide = ouverte —
 * règle unique dans `src/domain/presence.js`).
 *
 * - `autoriseAffectation` : le moteur ne propose jamais une personne hors présence.
 * - `evaluer` : signale `AVANT_ARRIVEE` / `APRES_DEPART`. **Exception
 *   documentée** au contrat « dure → erreur » : sur une affectation
 *   `origine === 'MANUEL'` (placement voulu, p. ex. journée de doublure) la
 *   sévérité est `avertissement` ; sur une affectation automatique (dates
 *   modifiées après la génération) elle est `erreur`. Pénalité toujours nulle.
 *
 * Raccourci de performance : si aucune personne n'a de date de présence,
 * tout est immédiat (aucun coût ajouté à la recherche locale).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { etatPresenceLe, estPresentLe, aDesDatesDePresence } from '../../presence.js';
import { messagePour } from '../modele/messages.js';

/**
 * Construit la contrainte dure « présence ».
 *
 * @param {import('../modele/types.js').Entree} entree
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContraintePresence(entree) {
  const personnes = entree.personnes ?? [];
  const personneParId = new Map(personnes.map((personne) => [personne.id, personne]));
  const aucuneDate = !personnes.some(aDesDatesDePresence);

  return {
    id: 'presence',
    type: 'PRESENCE',
    durete: 'dure',
    granularite: 'cellule',

    autoriseAffectation(personneId, demande) {
      if (aucuneDate) return true;
      return estPresentLe(personneParId.get(personneId), demande.date);
    },

    evaluer(ctx) {
      if (aucuneDate) return [];
      const violations = [];

      for (const affectation of ctx.index.affectations) {
        const personne = personneParId.get(affectation.personneId);
        if (!personne) continue;
        const etat = etatPresenceLe(personne, affectation.date);
        if (etat === 'PRESENTE') continue;

        const tournee = entree.tournees.find((t) => t.id === affectation.tourneeId);
        const segment = Array.isArray(tournee?.segments) ? tournee.segments[affectation.segmentIndex] : undefined;
        const manuel = affectation.origine === 'MANUEL';
        const borneParams = etat === 'AVANT_ARRIVEE' ? { dateEntree: personne.dateEntree } : { dateSortie: personne.dateSortie };

        violations.push({
          contrainteId: 'presence',
          severite: manuel ? 'avertissement' : 'erreur',
          cible: {
            personneId: affectation.personneId,
            tourneeId: affectation.tourneeId,
            date: affectation.date,
            segmentIndex: affectation.segmentIndex,
          },
          code: etat,
          message: messagePour(etat, {
            nomPersonne: [personne.prenom, personne.nom].filter(Boolean).join(' ') || 'Cette personne',
            date: affectation.date,
            heureDebut: segment?.heureDebut,
            heureFin: segment?.heureFin,
            manuel,
            ...borneParams,
          }),
          penalite: 0,
          params: {
            personneId: affectation.personneId,
            date: affectation.date,
            segmentIndex: affectation.segmentIndex,
            ...borneParams,
            // Valeur normalisée : jamais la donnée importée brute.
            origine: manuel ? 'MANUEL' : 'AUTO',
          },
        });
      }

      return violations;
    },
  };
}
