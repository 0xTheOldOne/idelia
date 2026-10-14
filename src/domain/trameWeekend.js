/**
 * Trame « un weekend sur X » (feature 0022) : calcule les weekends travaillés
 * et de repos d'une personne à partir d'une fréquence et d'un weekend repère.
 *
 * Un **weekend** = samedi (ISO 6) + dimanche (ISO 7) de la même semaine,
 * identifié par la date de son **samedi**. Le weekend repère peut être passé
 * ou futur : la formule vaut dans les deux sens.
 *
 * Module pur : aucun import Vue/Vuex, aucun `new Date()` (la date du jour est
 * injectée par l'appelant), jours ISO uniquement via `dateUtil` (ADR 0010).
 */

import { dateUtil } from '@/domain/utils/dates.js';

/** Fréquence minimale : un weekend sur 2. */
export const FREQUENCE_WEEKEND_MIN = 2;
/** Fréquence maximale : un weekend sur 6. */
export const FREQUENCE_WEEKEND_MAX = 6;
/** Fréquence proposée par défaut : un weekend sur 3 (trame du cabinet). */
export const FREQUENCE_WEEKEND_DEFAUT = 3;

/**
 * @typedef {{frequence: number, weekendReference: string}} TrameWeekend
 *   `frequence` : entier 2..6 ; `weekendReference` : samedi (ou dimanche) d'un
 *   weekend travaillé, `"YYYY-MM-DD"`.
 */

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ramène une date de weekend à son samedi.
 *
 * @param {(string|null|undefined)} date - Date `"YYYY-MM-DD"`.
 * @returns {(string|null)} Samedi du weekend, ou `null` si `date` est vide,
 *   mal formée ou ne tombe ni un samedi ni un dimanche.
 */
export function samediDuWeekend(date) {
  if (typeof date !== 'string' || !FORMAT_DATE.test(date)) return null;
  // Refuse une date non calendaire (ex. 2026-02-31) : aller-retour parse/format.
  if (dateUtil.format(dateUtil.parse(date)) !== date) return null;
  const jour = dateUtil.weekdayISO(date);
  if (jour === 6) return date;
  if (jour === 7) return dateUtil.addDays(date, -1);
  return null;
}

/**
 * Indique si une trame est exploitable.
 *
 * @param {Partial<TrameWeekend>} params - Paramètres du souhait.
 * @returns {boolean} `true` si fréquence entière dans [2, 6] et repère valide.
 */
export function estTrameValide(params) {
  const f = params?.frequence;
  return (
    Number.isInteger(f) &&
    f >= FREQUENCE_WEEKEND_MIN &&
    f <= FREQUENCE_WEEKEND_MAX &&
    samediDuWeekend(params?.weekendReference) !== null
  );
}

/**
 * Indique si le weekend d'une date est un weekend travaillé de la trame.
 *
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @param {Partial<TrameWeekend>} params - Paramètres du souhait.
 * @returns {(boolean|null)} `true` travaillé, `false` repos, `null` si la date
 *   n'est ni un samedi ni un dimanche ou si la trame est invalide.
 */
export function estWeekendTravaille(date, params) {
  const samedi = samediDuWeekend(date);
  if (samedi === null || !estTrameValide(params)) return null;
  const ref = samediDuWeekend(params.weekendReference);
  const n = dateUtil.diffDays(ref, samedi) / 7;
  return ((n % params.frequence) + params.frequence) % params.frequence === 0;
}

/**
 * Liste les prochains weekends travaillés (samedis, ordre croissant).
 *
 * @param {Partial<TrameWeekend>} params - Paramètres du souhait.
 * @param {string} aPartirDe - Date `"YYYY-MM-DD"` de départ (injectée).
 * @param {number} [nombre=3] - Nombre de weekends à renvoyer.
 * @returns {string[]} Samedis `"YYYY-MM-DD"`, ou `[]` si trame invalide.
 */
export function prochainsWeekendsTravailles(params, aPartirDe, nombre = 3) {
  if (!estTrameValide(params)) return [];
  if (typeof aPartirDe !== 'string' || !FORMAT_DATE.test(aPartirDe)) return [];
  const f = params.frequence;
  const ref = samediDuWeekend(params.weekendReference);
  const depart =
    samediDuWeekend(aPartirDe) ?? dateUtil.addDays(aPartirDe, 6 - dateUtil.weekdayISO(aPartirDe));
  const n0 = dateUtil.diffDays(ref, depart) / 7;
  const decalage = (-(n0 % f) + f) % f;
  const premier = dateUtil.addDays(depart, 7 * decalage);
  const resultat = [];
  for (let i = 0; i < nombre; i += 1) {
    resultat.push(dateUtil.addDays(premier, 7 * f * i));
  }
  return resultat;
}

/**
 * Libellé d'un weekend, ex. « samedi 24/10 et dimanche 25/10/2026 ».
 *
 * @param {string} samedi - Samedi du weekend `"YYYY-MM-DD"`.
 * @returns {string} Libellé FR, ou chaîne vide si la date est invalide.
 */
export function libelleWeekend(samedi) {
  if (typeof samedi !== 'string' || !FORMAT_DATE.test(samedi)) return '';
  const dimanche = dateUtil.addDays(samedi, 1);
  const jourMoisSamedi = dateUtil.formatDateFr(samedi).slice(0, 5);
  const jourMoisDimanche = dateUtil.formatDateFr(dimanche).slice(0, 5);
  const annee = dimanche.slice(0, 4);
  return `samedi ${jourMoisSamedi} et dimanche ${jourMoisDimanche}/${annee}`;
}
