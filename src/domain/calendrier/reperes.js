/**
 * Repères calendaires d'un jour (feature 0023) : source unique pour la grille
 * du planning et la diffusion/impression. Affichage seul.
 *
 * Module pur : aucun import Vue/Vuex, aucun réseau ; dates via `dateUtil` (ADR 0010).
 */

import { dateUtil } from '../utils/dates.js';
import { joursFeriesEntre } from './joursFeries.js';
import { vacancesEntre, zoneScolaireParCode } from './vacancesScolaires.js';

/**
 * @typedef {Object} RepereJour - Repère calendaire d'un jour (affichage seul).
 * @property {('FERIE'|'DIMANCHE'|'VACANCES_SCOLAIRES')} code
 * @property {string} libelle - Texte de légende, identique pour tous les jours d'un même code.
 * @property {string} court - Marqueur d'impression (« F », « V »), '' si aucun.
 * @property {string} detail - Propre au jour (« Toussaint », « Vacances de la Toussaint »), '' sinon.
 */

/**
 * @typedef {Object} SourcesReperes
 * @property {Map<string, string>} [feries] - date → nom du férié.
 * @property {Map<string, string>} [vacances] - date → libellé de la période de vacances.
 * @property {string} [libelleVacances] - Légende, ex. « Vacances scolaires (zone A) ».
 */

/**
 * Construit les sources de repères pour une fenêtre de dates.
 *
 * @param {Object} params
 * @param {string} params.dateDebut - `"YYYY-MM-DD"`.
 * @param {string} params.dateFin - `"YYYY-MM-DD"`.
 * @param {import('./vacancesScolaires.js').PeriodeVacances[]} [params.periodesVacances]
 * @param {(string|null)} [params.zone] - Code de zone scolaire.
 * @returns {SourcesReperes}
 */
export function construireSourcesReperes({ dateDebut, dateFin, periodesVacances = [], zone = null }) {
  const court = zoneScolaireParCode(zone)?.court;
  return {
    feries: joursFeriesEntre(dateDebut, dateFin),
    vacances: vacancesEntre(periodesVacances, dateDebut, dateFin),
    libelleVacances: court ? `Vacances scolaires (${court})` : 'Vacances scolaires',
  };
}

/**
 * Repères d'un jour, dans l'ordre : férié, dimanche, vacances scolaires.
 * Sans `sources`, seul le dimanche sort (comportement de la feature 0012).
 *
 * @param {string} date - `"YYYY-MM-DD"`.
 * @param {SourcesReperes} [sources]
 * @returns {RepereJour[]}
 */
export function reperesDuJour(date, sources = {}) {
  const reperes = [];
  const ferie = sources.feries?.get(date);
  if (ferie !== undefined) {
    reperes.push({ code: 'FERIE', libelle: 'Jour férié', court: 'F', detail: ferie });
  }
  if (dateUtil.weekdayISO(date) === 7) {
    reperes.push({ code: 'DIMANCHE', libelle: 'Dimanche', court: '', detail: '' });
  }
  const vacances = sources.vacances?.get(date);
  if (vacances !== undefined) {
    reperes.push({
      code: 'VACANCES_SCOLAIRES',
      libelle: sources.libelleVacances ?? 'Vacances scolaires',
      court: 'V',
      detail: vacances,
    });
  }
  return reperes;
}
