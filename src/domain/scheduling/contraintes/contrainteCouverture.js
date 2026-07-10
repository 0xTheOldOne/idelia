/**
 * Contrainte dure « couverture » : l'effectif requis (`segment.nbPersonnesRequises`,
 * feature 0016, ADR 0017) doit être atteint par **(tournée, date, segment)**
 * — l'unité de couverture est le segment, pas le créneau symbolique.
 * **Jamais de crash** sur sous-effectif (§7.4 du plan) : une sous-couverture
 * est reportée en `NonCouverture` et en `Violation` (`erreur`), jamais en
 * exception ; on n'affecte jamais plus que le requis (garanti
 * structurellement par l'expansion en unités de `Demande`,
 * `modele/demande.js`).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { messagePour } from '../modele/messages.js';

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} tourneeId
 * @returns {string}
 */
function nomTourneeDe(entree, tourneeId) {
  const tournee = entree.tournees.find((t) => t.id === tourneeId);
  return tournee ? tournee.libelle : 'Cette tournée';
}

/**
 * Compare l'effectif requis (issu des `Demande`) à l'effectif réellement
 * affecté (issu du `PlanningIndexe`), par **(tournée, date, segment)**
 * (feature 0016, ADR 0017 — remplace l'ancien regroupement par créneau).
 * Réutilisée telle quelle par `genererPlanning.js` (feature 0009, tâche 5).
 *
 * @param {import('../modele/types.js').Demande[]} demandes
 * @param {import('../modele/types.js').PlanningIndexe} planningIndexe
 * @returns {import('../modele/types.js').NonCouverture[]} Une entrée par (tournée, date, segment) sous-couvert.
 */
export function calculerNonCouvertures(demandes, planningIndexe) {
  const groupes = new Map();

  for (const demande of demandes) {
    const cle = `${demande.tourneeId}|${demande.date}|${demande.segmentIndex}`;
    const groupe = groupes.get(cle) ?? {
      date: demande.date,
      segmentIndex: demande.segmentIndex,
      heureDebut: demande.heureDebut,
      heureFin: demande.heureFin,
      tourneeId: demande.tourneeId,
      requis: 0,
    };
    groupe.requis += 1;
    groupes.set(cle, groupe);
  }

  const nonCouvertures = [];
  for (const groupe of groupes.values()) {
    const cleSlot = `${groupe.tourneeId}|${groupe.date}|${groupe.segmentIndex}`;
    const affectes = (planningIndexe.parSlot.get(cleSlot) ?? []).length;

    if (affectes < groupe.requis) {
      nonCouvertures.push({
        date: groupe.date,
        segmentIndex: groupe.segmentIndex,
        heureDebut: groupe.heureDebut,
        heureFin: groupe.heureFin,
        tourneeId: groupe.tourneeId,
        requis: groupe.requis,
        affectes,
        manque: groupe.requis - affectes,
      });
    }
  }

  return nonCouvertures;
}

/**
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteCouverture() {
  return {
    id: 'couverture',
    type: 'COUVERTURE',
    durete: 'dure',
    granularite: 'creneau',

    evaluer(ctx) {
      const nonCouvertures = calculerNonCouvertures(ctx.demandes, ctx.index);

      return nonCouvertures.map((nonCouverture) => ({
        contrainteId: 'couverture',
        severite: 'erreur',
        cible: {
          tourneeId: nonCouverture.tourneeId,
          date: nonCouverture.date,
          segmentIndex: nonCouverture.segmentIndex,
        },
        code: 'SOUS_COUVERTURE',
        message: messagePour('SOUS_COUVERTURE', {
          nomTournee: nomTourneeDe(ctx.entree, nonCouverture.tourneeId),
          date: nonCouverture.date,
          heureDebut: nonCouverture.heureDebut,
          heureFin: nonCouverture.heureFin,
          requis: nonCouverture.requis,
          affectes: nonCouverture.affectes,
          manque: nonCouverture.manque,
        }),
        penalite: 0,
        params: { ...nonCouverture },
      }));
    },
  };
}
