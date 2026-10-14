/**
 * Présence d'une personne au cabinet (feature 0031) : source unique, partagée
 * par le moteur de planification, `rythmeMensuel.js` et l'interface.
 *
 * Sémantique : `dateEntree` = premier jour, `dateSortie` = **dernier jour** au
 * cabinet, bornes **incluses**. Une borne `null`, vide ou mal formée est
 * **ouverte** (pas de limite). Dates `"YYYY-MM-DD"` comparées comme chaînes
 * (ADR 0010).
 *
 * Module pur, imports **relatifs uniquement** (chargeable hors Vite).
 */

import { dateUtil } from './utils/dates.js';

/**
 * @typedef {'PRESENTE'|'AVANT_ARRIVEE'|'APRES_DEPART'} EtatPresence
 */

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Renvoie la borne si elle est une date valide, sinon `null` (borne ouverte).
 *
 * @param {*} valeur
 * @returns {(string|null)}
 */
function borne(valeur) {
  return typeof valeur === 'string' && FORMAT_DATE.test(valeur) ? valeur : null;
}

/**
 * État de présence d'une personne à une date.
 *
 * @param {{dateEntree?: (string|null), dateSortie?: (string|null)}|null|undefined} personne
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @returns {EtatPresence} `'PRESENTE'` si personne absente/nulle (jamais de crash).
 */
export function etatPresenceLe(personne, date) {
  const entree = borne(personne?.dateEntree);
  const sortie = borne(personne?.dateSortie);
  if (entree !== null && date < entree) return 'AVANT_ARRIVEE';
  if (sortie !== null && date > sortie) return 'APRES_DEPART';
  return 'PRESENTE';
}

/**
 * @param {{dateEntree?: (string|null), dateSortie?: (string|null)}|null|undefined} personne
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @returns {boolean}
 */
export function estPresentLe(personne, date) {
  return etatPresenceLe(personne, date) === 'PRESENTE';
}

/**
 * Indique si au moins une borne de présence valide est renseignée.
 *
 * @param {{dateEntree?: (string|null), dateSortie?: (string|null)}|null|undefined} personne
 * @returns {boolean}
 */
export function aDesDatesDePresence(personne) {
  return borne(personne?.dateEntree) !== null || borne(personne?.dateSortie) !== null;
}

/**
 * Libellé court (épicène) d'une absence de présence ; `''` si présente.
 *
 * @param {{dateEntree?: (string|null), dateSortie?: (string|null)}|null|undefined} personne
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @returns {string}
 */
export function libellePresenceLe(personne, date) {
  const etat = etatPresenceLe(personne, date);
  if (etat === 'AVANT_ARRIVEE') return 'Avant son arrivée';
  if (etat === 'APRES_DEPART') return 'Après son départ';
  return '';
}

/**
 * Précision datée d'un état hors présence ; `''` si présente.
 *
 * @param {{dateEntree?: (string|null), dateSortie?: (string|null)}|null|undefined} personne
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @returns {string} Ex. `'arrive le 09/11/2026'`, `'dernier jour : 15/11/2026'`.
 */
export function precisionPresenceLe(personne, date) {
  const etat = etatPresenceLe(personne, date);
  if (etat === 'AVANT_ARRIVEE') return `arrive le ${dateUtil.formatDateFr(personne.dateEntree)}`;
  if (etat === 'APRES_DEPART') return `dernier jour : ${dateUtil.formatDateFr(personne.dateSortie)}`;
  return '';
}

/**
 * Part des `dates` où la personne est présente.
 *
 * @param {{dateEntree?: (string|null), dateSortie?: (string|null)}|null|undefined} personne
 * @param {string[]} dates - Dates `"YYYY-MM-DD"`.
 * @returns {number} Entre 0 et 1 ; `1` si `dates` est vide.
 */
export function fractionPresence(personne, dates) {
  if (!Array.isArray(dates) || dates.length === 0) return 1;
  return dates.filter((date) => estPresentLe(personne, date)).length / dates.length;
}
