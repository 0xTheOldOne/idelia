/**
 * Helpers de dates spécifiques au moteur de planification — distincts de
 * `src/domain/utils/dates.js` (`dateUtil`), qu'ils **combinent** sans jamais
 * le réimplémenter.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Aucun objet `Date` n'apparaît dans ce fichier hors des appels à `dateUtil`
 * (ADR 0010) : toutes les dates manipulées sont des chaînes `"YYYY-MM-DD"`.
 */

import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Indique si une date tombe un jour d'ouverture du cabinet.
 *
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @param {number[]} joursOuverture - Jours ISO 1..7 ouverts (`ParametresCabinet.joursOuverture`).
 * @returns {boolean} `true` si le jour ISO de `date` fait partie de `joursOuverture`.
 */
export function estJourOuvert(date, joursOuverture) {
  const jours = Array.isArray(joursOuverture) ? joursOuverture : [];
  return jours.includes(dateUtil.weekdayISO(date));
}

/**
 * Indique si une date est comprise dans une plage `[debut, fin]`, bornes
 * optionnelles (comparaison de chaînes `"YYYY-MM-DD"`, comme dans
 * `domain/absences.js`).
 *
 * @param {string} date - Date `"YYYY-MM-DD"` à tester.
 * @param {(string|null)} [debut] - Borne de début inclusive, ou `null`/absente (pas de borne basse).
 * @param {(string|null)} [fin] - Borne de fin inclusive, ou `null`/absente (pas de borne haute).
 * @returns {boolean} `true` si `date` est dans la plage.
 */
export function estDansPlage(date, debut, fin) {
  if (debut && date < debut) return false;
  if (fin && date > fin) return false;
  return true;
}

/**
 * Renvoie la date du lundi de la semaine calendaire ISO (lundi → dimanche)
 * contenant `date` — sert de clé de regroupement par semaine pour
 * `contrainteReposLegal.js` et `contraintePreference.js` (cas `NB_JOURS_SEMAINE`).
 *
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @returns {string} Date `"YYYY-MM-DD"` du lundi de la semaine ISO de `date`.
 */
export function semaineIsoDe(date) {
  const jourIso = dateUtil.weekdayISO(date);
  return dateUtil.addDays(date, -(jourIso - 1));
}
