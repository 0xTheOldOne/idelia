/**
 * Rythme mensuel d'une personne : « jours travaillés par mois » (feature 0020).
 *
 * Module pur (ADR 0008) : aucun import Vue/Vuex, imports relatifs uniquement
 * (chargeable par un script Node sans Vite). Dates en chaînes `"YYYY-MM-DD"`,
 * jours ISO 1-7 (ADR 0010), toujours via `dateUtil`.
 */

import { dateUtil } from './utils/dates.js';
import { estPresentLe } from './presence.js';

/** Rythme minimal (jours par mois). */
export const RYTHME_MIN = 1;
/** Rythme maximal (jours par mois). */
export const RYTHME_MAX = 31;

/**
 * @typedef {Object} AttenduRythme
 * @property {number} rythme            - `joursTravaillesParMois` de la personne.
 * @property {number} attendu           - Jours attendus sur la période (réel, au prorata).
 * @property {number} attenduArrondi    - `Math.round(attendu)` : valeur affichée et comparée.
 * @property {number} joursDisponibles  - Jours ouverts de la période où la personne est présente et non absente toute la journée.
 */

/**
 * Normalise une saisie de rythme : vide, `null` ou `undefined` → `null`,
 * sinon `Number(valeur)` (sans arrondi : la validation refuse les décimales).
 *
 * @param {*} valeur - Saisie brute (nombre ou chaîne).
 * @returns {(number|null)}
 */
export function normaliserRythmeMensuel(valeur) {
  if (valeur === '' || valeur === null || valeur === undefined) return null;
  return Number(valeur);
}

/**
 * Indique si un rythme est acceptable : vide (`null`) ou entier de
 * {@link RYTHME_MIN} à {@link RYTHME_MAX}.
 *
 * @param {*} valeur - Saisie brute.
 * @returns {boolean}
 */
export function estRythmeMensuelValide(valeur) {
  const rythme = normaliserRythmeMensuel(valeur);
  if (rythme === null) return true;
  return Number.isInteger(rythme) && rythme >= RYTHME_MIN && rythme <= RYTHME_MAX;
}

/**
 * Jours attendus d'une personne sur une période, selon son rythme mensuel,
 * au prorata mois par mois des jours d'ouverture, de sa présence
 * (`dateEntree`/`dateSortie`) et de ses absences validées sur la journée
 * entière. Les demi-journées et les absences non validées ne retirent rien.
 *
 * @param {{id?: string, joursTravaillesParMois?: *, dateEntree?: (string|null), dateSortie?: (string|null)}} personne
 * @param {{debut: string, fin: string}} periode - Bornes `"YYYY-MM-DD"` incluses.
 * @param {Object} contexte
 * @param {number[]} [contexte.joursOuverture] - Jours ISO 1-7 d'ouverture du cabinet.
 * @param {Array<{personneId: string, dateDebut: string, dateFin: string, creneau: string, statut: string}>} [contexte.absences]
 * @returns {(AttenduRythme|null)} `null` si la personne n'a pas de rythme valide.
 */
export function joursAttendusSurPeriode(personne, periode, { joursOuverture, absences } = {}) {
  const rythme = normaliserRythmeMensuel(personne?.joursTravaillesParMois);
  if (rythme === null || !estRythmeMensuelValide(rythme)) return null;
  if (!periode?.debut || !periode?.fin) {
    return { rythme, attendu: 0, attenduArrondi: 0, joursDisponibles: 0 };
  }

  const ouverts = new Set(Array.isArray(joursOuverture) ? joursOuverture : []);
  const retenues = (Array.isArray(absences) ? absences : []).filter(
    (a) => a.personneId === personne.id && a.statut === 'VALIDE' && a.creneau === 'JOURNEE'
  );

  const estOuvert = (date) => ouverts.has(dateUtil.weekdayISO(date));
  const estAbsente = (date) => retenues.some((a) => date >= a.dateDebut && date <= a.dateFin);

  let attendu = 0;
  let joursDisponibles = 0;

  for (let mois = dateUtil.debutMois(periode.debut); mois <= periode.fin; mois = dateUtil.moisSuivant(mois)) {
    const finMois = dateUtil.finMois(mois);
    const joursOuvertsMois = dateUtil.rangeInclusive(mois, finMois).filter(estOuvert).length;
    if (joursOuvertsMois === 0) continue;

    const debut = mois > periode.debut ? mois : periode.debut;
    const fin = finMois < periode.fin ? finMois : periode.fin;
    if (debut > fin) continue;

    const jours = dateUtil
      .rangeInclusive(debut, fin)
      .filter((date) => estOuvert(date) && estPresentLe(personne, date) && !estAbsente(date)).length;

    attendu += (rythme * jours) / joursOuvertsMois;
    joursDisponibles += jours;
  }

  return { rythme, attendu, attenduArrondi: Math.round(attendu), joursDisponibles };
}
