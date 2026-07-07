/**
 * Utilitaires de dates — seul point d'accès autorisé à l'objet `Date` natif
 * (ADR 0010 : conventions dates & jours ISO).
 *
 * Conventions :
 * - Les dates sont représentées par des chaînes `"YYYY-MM-DD"`.
 * - Les jours de semaine sont exprimés en ISO 8601 : 1 = lundi … 7 = dimanche.
 *
 * Aucun import Vue/Vuex ici : module pur (ADR 0008).
 */

/**
 * Construit un objet `Date` local à partir d'une chaîne `"YYYY-MM-DD"`,
 * sans passer par `new Date(chaine)` (qui interprète la chaîne en UTC et
 * peut décaler le jour selon le fuseau horaire local).
 *
 * @param {string} dateStr - Date au format `"YYYY-MM-DD"`.
 * @returns {Date} Date locale correspondante (à minuit, heure locale).
 */
function parse(dateStr) {
  const [annee, mois, jour] = dateStr.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

/**
 * Formate un objet `Date` en chaîne `"YYYY-MM-DD"`.
 *
 * @param {Date} date - Date à formater.
 * @returns {string} Date au format `"YYYY-MM-DD"`.
 */
function format(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

/**
 * Ajoute (ou retranche, si négatif) un nombre de jours à une date.
 *
 * @param {string} dateStr - Date de départ `"YYYY-MM-DD"`.
 * @param {number} nbJours - Nombre de jours à ajouter (peut être négatif).
 * @returns {string} Nouvelle date `"YYYY-MM-DD"`.
 */
function addDays(dateStr, nbJours) {
  const date = parse(dateStr);
  date.setDate(date.getDate() + nbJours);
  return format(date);
}

/**
 * Calcule le nombre de jours entre deux dates (`dateFinStr - dateDebutStr`).
 *
 * @param {string} dateDebutStr - Date de début `"YYYY-MM-DD"`.
 * @param {string} dateFinStr - Date de fin `"YYYY-MM-DD"`.
 * @returns {number} Différence en jours (positive si `dateFinStr` est après `dateDebutStr`).
 */
function diffDays(dateDebutStr, dateFinStr) {
  const MS_PAR_JOUR = 24 * 60 * 60 * 1000;
  const debut = parse(dateDebutStr);
  const fin = parse(dateFinStr);
  return Math.round((fin.getTime() - debut.getTime()) / MS_PAR_JOUR);
}

/**
 * Renvoie le jour de semaine ISO 8601 (1 = lundi … 7 = dimanche) d'une date.
 *
 * SEUL endroit du code où la conversion `Date.getDay()` (0 = dimanche …
 * 6 = samedi) vers l'échelle ISO 1-7 est effectuée (ADR 0010).
 *
 * @param {string} dateStr - Date `"YYYY-MM-DD"`.
 * @returns {number} Jour ISO (1 = lundi … 7 = dimanche).
 */
function weekdayISO(dateStr) {
  const jourJs = parse(dateStr).getDay(); // 0 = dimanche … 6 = samedi
  return jourJs === 0 ? 7 : jourJs;
}

/**
 * Construit la liste des dates comprises entre deux bornes, incluses.
 *
 * @param {string} dateDebutStr - Date de début `"YYYY-MM-DD"`.
 * @param {string} dateFinStr - Date de fin `"YYYY-MM-DD"` (incluse).
 * @returns {string[]} Liste des dates `"YYYY-MM-DD"`, dans l'ordre chronologique.
 */
function rangeInclusive(dateDebutStr, dateFinStr) {
  const dates = [];
  let courante = dateDebutStr;
  while (diffDays(courante, dateFinStr) >= 0) {
    dates.push(courante);
    courante = addDays(courante, 1);
  }
  return dates;
}

export const dateUtil = {
  parse,
  format,
  addDays,
  diffDays,
  weekdayISO,
  rangeInclusive,
};
