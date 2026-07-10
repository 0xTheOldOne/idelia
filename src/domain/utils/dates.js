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

/**
 * Formate un horodatage technique ISO UTC (ex. `updatedAt`, `derniereSauvegarde`)
 * en texte FR lisible (ex. « 7 juillet 2026 à 14:32 »).
 *
 * @param {string} iso - Horodatage ISO 8601 UTC complet (`new Date().toISOString()`).
 * @returns {string} Texte FR lisible, ou chaîne vide si `iso` est vide/absent.
 */
function formatHorodatageFr(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}

/**
 * Formate une date calendaire `"YYYY-MM-DD"` en texte FR courant
 * `"JJ/MM/AAAA"` (ex. « 01/09/2019 »), par simple découpage de chaîne —
 * **aucun objet `Date`** n'est manipulé ici (ADR 0010).
 *
 * @param {string} iso - Date au format `"YYYY-MM-DD"`.
 * @returns {string} Date au format `"JJ/MM/AAAA"`, ou chaîne vide si `iso`
 *   est vide/absent ou mal formé.
 */
function formatDateFr(iso) {
  if (!iso) return '';
  const segments = iso.split('-');
  if (segments.length !== 3) return '';
  const [annee, mois, jour] = segments;
  return `${jour}/${mois}/${annee}`;
}

/**
 * Calcule le premier jour de la semaine contenant `dateStr`, aligné sur
 * `premierJourIso` (1 = lundi … 7 = dimanche). Construit au-dessus de
 * {@link weekdayISO} et {@link addDays}, par simple arithmétique — aucun
 * nouvel objet `Date` exposé.
 *
 * @param {string} dateStr - Date `"YYYY-MM-DD"` de référence.
 * @param {number} premierJourIso - Premier jour de semaine, ISO 1-7.
 * @returns {string} Date `"YYYY-MM-DD"` du premier jour de la semaine.
 */
function debutSemaine(dateStr, premierJourIso) {
  const delta = (weekdayISO(dateStr) - premierJourIso + 7) % 7;
  return addDays(dateStr, -delta);
}

/**
 * Calcule le premier jour du mois contenant `dateStr`, par simple
 * arithmétique de chaîne (aucun objet `Date`).
 *
 * @param {string} dateStr - Date `"YYYY-MM-DD"` de référence.
 * @returns {string} Date `"YYYY-MM-DD"` du premier jour du mois.
 */
function debutMois(dateStr) {
  return `${dateStr.slice(0, 8)}01`;
}

/**
 * Calcule le premier jour du mois suivant celui de `dateStr`, par
 * arithmétique de chaîne sur `"YYYY-MM"` (report décembre → janvier géré).
 *
 * @param {string} dateStr - Date `"YYYY-MM-DD"` de référence.
 * @returns {string} Date `"YYYY-MM-DD"` du premier jour du mois suivant.
 */
function moisSuivant(dateStr) {
  const annee = Number(dateStr.slice(0, 4));
  const mois = Number(dateStr.slice(5, 7));
  const anneeCible = mois === 12 ? annee + 1 : annee;
  const moisCible = mois === 12 ? 1 : mois + 1;
  return `${anneeCible}-${String(moisCible).padStart(2, '0')}-01`;
}

/**
 * Calcule le premier jour du mois précédent celui de `dateStr`, par
 * arithmétique de chaîne sur `"YYYY-MM"` (report janvier → décembre géré).
 *
 * @param {string} dateStr - Date `"YYYY-MM-DD"` de référence.
 * @returns {string} Date `"YYYY-MM-DD"` du premier jour du mois précédent.
 */
function moisPrecedent(dateStr) {
  const annee = Number(dateStr.slice(0, 4));
  const mois = Number(dateStr.slice(5, 7));
  const anneeCible = mois === 1 ? annee - 1 : annee;
  const moisCible = mois === 1 ? 12 : mois - 1;
  return `${anneeCible}-${String(moisCible).padStart(2, '0')}-01`;
}

/**
 * Calcule le dernier jour du mois contenant `dateStr`, construit au-dessus
 * de {@link moisSuivant}, {@link debutMois} et {@link addDays}.
 *
 * @param {string} dateStr - Date `"YYYY-MM-DD"` de référence.
 * @returns {string} Date `"YYYY-MM-DD"` du dernier jour du mois.
 */
function finMois(dateStr) {
  return addDays(moisSuivant(debutMois(dateStr)), -1);
}

/**
 * Calcule le numéro de semaine **ISO 8601** (1..53) de `dateStr`, selon la
 * règle du jeudi : la semaine appartient à l'année de son jeudi, la semaine 1
 * est celle qui contient le premier jeudi de l'année. Construit au-dessus de
 * {@link weekdayISO}, {@link addDays} et {@link diffDays} — aucun nouvel
 * objet `Date` exposé. Déterministe, jamais `Date.now()`.
 *
 * @param {string} dateStr - Date `"YYYY-MM-DD"` de référence.
 * @returns {number} Numéro de semaine ISO 8601 (1 à 53).
 */
function numeroSemaineIso(dateStr) {
  const jourIso = weekdayISO(dateStr);
  const jeudi = addDays(dateStr, 4 - jourIso);
  const anneeJeudi = jeudi.slice(0, 4);
  const premierJanvier = `${anneeJeudi}-01-01`;
  const jourIsoPremierJanvier = weekdayISO(premierJanvier);
  const premierJeudiAnnee = addDays(premierJanvier, (4 - jourIsoPremierJanvier + 7) % 7);
  return diffDays(premierJeudiAnnee, jeudi) / 7 + 1;
}

export const dateUtil = {
  parse,
  format,
  addDays,
  diffDays,
  weekdayISO,
  rangeInclusive,
  formatHorodatageFr,
  formatDateFr,
  debutSemaine,
  debutMois,
  moisSuivant,
  moisPrecedent,
  finMois,
  numeroSemaineIso,
};
