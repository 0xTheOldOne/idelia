/**
 * Jours fériés légaux nationaux français (feature 0023), calculés localement.
 *
 * Module pur : aucun import Vue/Vuex, aucun réseau ; dates uniquement via
 * `dateUtil` (ADR 0010). Périmètre : les 11 fériés nationaux (code du travail,
 * art. L3133-1). Alsace-Moselle et fériés d'outre-mer : hors périmètre.
 */

import { dateUtil } from '../utils/dates.js';

/**
 * @typedef {Object} JourFerie
 * @property {string} date - `"YYYY-MM-DD"`.
 * @property {string} libelle - Ex. « Toussaint ».
 */

/**
 * Dimanche de Pâques (calendrier grégorien), par l'algorithme anonyme de
 * Meeus/Jones/Butcher : arithmétique entière seulement, aucun objet `Date`.
 *
 * @param {number} annee - Année entière >= 1583.
 * @returns {(string|null)} `"YYYY-MM-DD"`, ou `null` si l'année est invalide.
 */
export function datePaques(annee) {
  if (!Number.isInteger(annee) || annee < 1583) return null;
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/**
 * Les 11 jours fériés légaux nationaux d'une année, triés par date.
 *
 * @param {number} annee
 * @returns {JourFerie[]} Vide si l'année est invalide.
 */
export function joursFeriesAnnee(annee) {
  const paques = datePaques(annee);
  if (!paques) return [];
  const fixe = (mmjj, libelle) => ({ date: `${annee}-${mmjj}`, libelle });
  const mobile = (n, libelle) => ({ date: dateUtil.addDays(paques, n), libelle });
  return [
    fixe('01-01', "Jour de l'an"),
    mobile(1, 'Lundi de Pâques'),
    fixe('05-01', 'Fête du Travail'),
    fixe('05-08', 'Victoire 1945'),
    mobile(39, 'Ascension'),
    mobile(50, 'Lundi de Pentecôte'),
    fixe('07-14', 'Fête nationale'),
    fixe('08-15', 'Assomption'),
    fixe('11-01', 'Toussaint'),
    fixe('11-11', 'Armistice 1918'),
    fixe('12-25', 'Noël'),
  ].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

/**
 * Jours fériés compris entre deux dates (bornes incluses).
 *
 * @param {string} dateDebut - `"YYYY-MM-DD"`.
 * @param {string} dateFin - `"YYYY-MM-DD"`.
 * @returns {Map<string, string>} date → libellé du férié.
 */
export function joursFeriesEntre(dateDebut, dateFin) {
  const resultat = new Map();
  const anneeDebut = Number(dateDebut.slice(0, 4));
  const anneeFin = Number(dateFin.slice(0, 4));
  for (let annee = anneeDebut; annee <= anneeFin; annee++) {
    for (const { date, libelle } of joursFeriesAnnee(annee)) {
      if (date >= dateDebut && date <= dateFin) resultat.set(date, libelle);
    }
  }
  return resultat;
}
