/**
 * Contrainte dure « jour d'ouverture » : sécurité pour qu'une affectation
 * (y compris `MANUEL`, posée en `011`) tombant un jour fermé du cabinet
 * soit signalée. La génération ne produit jamais un tel cas (filtré en
 * amont par `expanserDemandes`) ; cette contrainte protège la
 * **validation** d'un planning modifié à la main (§7.1 du plan).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { estJourOuvert } from '../utils/dates.js';
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
export function creerContrainteJourOuverture() {
  return {
    id: 'jour-ouverture',
    type: 'JOUR_OUVERTURE',
    durete: 'dure',
    granularite: 'cellule',

    autoriseAffectation(personneId, demande, ctx) {
      return estJourOuvert(demande.date, ctx.entree.reglesCabinet.joursOuverture);
    },

    evaluer(ctx) {
      const joursOuverture = ctx.entree.reglesCabinet.joursOuverture;
      const violations = [];

      for (const affectation of ctx.index.affectations) {
        if (estJourOuvert(affectation.date, joursOuverture)) continue;

        violations.push({
          contrainteId: 'jour-ouverture',
          severite: 'erreur',
          cible: {
            personneId: affectation.personneId,
            tourneeId: affectation.tourneeId,
            date: affectation.date,
            creneau: affectation.creneau,
          },
          code: 'JOUR_FERME',
          message: messagePour('JOUR_FERME', {
            nomPersonne: nomPersonneDe(ctx.entree, affectation.personneId),
            nomTournee: nomTourneeDe(ctx.entree, affectation.tourneeId),
            date: affectation.date,
          }),
          penalite: 0,
          params: {
            personneId: affectation.personneId,
            tourneeId: affectation.tourneeId,
            date: affectation.date,
            creneau: affectation.creneau,
          },
        });
      }

      return violations;
    },
  };
}
