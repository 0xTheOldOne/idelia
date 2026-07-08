/**
 * Expansion de la demande : construit la liste plate des unités de demande
 * (un slot à pourvoir) sur la période, à partir d'une `Entree`.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Immuable : `expanserDemandes`/`joursPeriode` ne mutent jamais `entree`.
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { estJourOuvert, estDansPlage } from '../utils/dates.js';

/**
 * Liste les jours OUVERTS de la période (`entree.reglesCabinet.joursOuverture`),
 * triés chronologiquement.
 *
 * @param {import('./types.js').Entree} entree
 * @returns {string[]} Dates `"YYYY-MM-DD"` des jours ouverts de la période, triées.
 */
export function joursPeriode(entree) {
  const { debut, fin } = entree.periode;
  const joursOuverture = entree.reglesCabinet.joursOuverture;
  return dateUtil.rangeInclusive(debut, fin).filter((date) => estJourOuvert(date, joursOuverture));
}

/**
 * Construit la liste plate des unités de `Demande` de la période : pour
 * chaque jour ouvert, pour chaque `Tournee` applicable ce jour-là (jour ISO
 * ∈ `joursApplication`, date dans `[dateDebutValidite, dateFinValidite]`
 * quand ces bornes sont renseignées), crée `nbPersonnesRequises` unités —
 * une par personne requise. Ce découpage par slot garantit structurellement
 * que le moteur n'affecte jamais plus que le requis.
 *
 * @param {import('./types.js').Entree} entree
 * @returns {import('./types.js').Demande[]} Demandes, une par slot à pourvoir.
 */
export function expanserDemandes(entree) {
  const demandes = [];

  for (const date of joursPeriode(entree)) {
    const jourIso = dateUtil.weekdayISO(date);

    for (const tournee of entree.tournees) {
      if (!tournee.joursApplication.includes(jourIso)) continue;
      if (!estDansPlage(date, tournee.dateDebutValidite, tournee.dateFinValidite)) continue;

      for (let index = 0; index < tournee.nbPersonnesRequises; index += 1) {
        demandes.push({
          id: `${tournee.id}|${date}|${tournee.creneau}|${index}`,
          date,
          jourIso,
          creneau: tournee.creneau,
          tourneeId: tournee.id,
          index,
        });
      }
    }
  }

  return demandes;
}
