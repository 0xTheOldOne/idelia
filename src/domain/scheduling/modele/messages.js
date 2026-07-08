/**
 * Table `code -> gabarit` et fonction `messagePour(code, params)` : sépare
 * le `code` stable (`Violation.code`) du message FR affiché, prêt à être
 * affiché **tel quel** par une future UI (`010`/`011`) — jamais de code
 * brut ni de jargon technique dans le texte.
 *
 * Réutilise `src/domain/libelles.js` (`libelleCreneau`, `libelleTypeAbsence`)
 * pour rester cohérent avec le vocabulaire déjà vu par l'utilisateur dans les
 * écrans Souhaits/Absences/Tournées (§5.6/§8 du plan). Les contraintes
 * préférence/équité/continuité (tâche 3) ajouteront leurs propres gabarits
 * ici.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * `messagePour` ne lève **jamais** : un `code` inconnu renvoie un message
 * neutre plutôt qu'une exception (§7.4 du plan, « jamais de crash »).
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { libelleCreneau, libelleTypeAbsence, libelleJour } from '@/domain/libelles.js';

/**
 * Libellé FR du jour de semaine d'une date, en minuscules (« mercredi »),
 * prêt à s'insérer dans une phrase (« le mercredi 12/08/2026 »).
 *
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @returns {string} Libellé FR en minuscules, ou chaîne vide si `date` est absente.
 */
function jourFr(date) {
  if (!date) return '';
  return libelleJour(dateUtil.weekdayISO(date)).toLowerCase();
}

/**
 * Arrondit un nombre à une décimale, pour un affichage lisible d'une charge
 * moyenne/pondérée (équité).
 *
 * @param {number} valeur
 * @returns {number}
 */
function arrondi1(valeur) {
  return Math.round((valeur ?? 0) * 10) / 10;
}

/**
 * Gabarit commun aux préférences « ne travaille pas / est en repos… mais est
 * affectée » (`JOUR_OFF_RECURRENT`, `CRENEAU_OFF`, `INDISPO_HEBDO`,
 * `JOURS_REPOS_SOUHAITES`) : réutilise `decrirePreference` (fourni en
 * `descriptionPreference`) pour rester cohérent avec l'écran Souhaits (§5.6
 * du plan).
 *
 * @param {Object} params
 * @returns {string}
 */
function affecteMalgrePreference({ nomPersonne = 'Cette personne', descriptionPreference = '', date, creneau } = {}) {
  return (
    `${nomPersonne} — ${descriptionPreference} — mais est affectée le ${jourFr(date)} ` +
    `${dateUtil.formatDateFr(date)} (${libelleCreneau(creneau)}).`
  );
}

/**
 * Gabarits de message FR, indexés par `code` (voir `Violation.code`).
 * Chaque gabarit est une fonction `(params) => string`, défensive vis-à-vis
 * de `params` incomplets (valeurs par défaut neutres, jamais `undefined`
 * affiché tel quel).
 *
 * @type {Object<string, function(Object=): string>}
 */
const GABARITS = {
  ABSENCE_VALIDEE: ({ nomPersonne = 'Cette personne', date, creneau, typeAbsence } = {}) =>
    `${nomPersonne} a une absence validée${typeAbsence ? ` (${libelleTypeAbsence(typeAbsence)})` : ''} ` +
    `le ${dateUtil.formatDateFr(date)} (${libelleCreneau(creneau)}) : elle ne peut pas être affectée sur ce créneau.`,

  ABSENCE_DEMANDEE: ({ nomPersonne = 'Cette personne', date, creneau, typeAbsence } = {}) =>
    `${nomPersonne} a demandé une absence${typeAbsence ? ` (${libelleTypeAbsence(typeAbsence)})` : ''} ` +
    `le ${dateUtil.formatDateFr(date)} (${libelleCreneau(creneau)}), mais est affectée sur ce créneau.`,

  CHEVAUCHEMENT: ({
    nomPersonne = 'Cette personne',
    date,
    nomTourneeA = 'une tournée',
    creneauA,
    nomTourneeB = 'une autre tournée',
    creneauB,
  } = {}) =>
    `${nomPersonne} est affectée deux fois le ${dateUtil.formatDateFr(date)} sur des créneaux qui se ` +
    `chevauchent : « ${nomTourneeA} » (${libelleCreneau(creneauA)}) et « ${nomTourneeB} » (${libelleCreneau(creneauB)}).`,

  SOUS_COUVERTURE: ({ nomTournee = 'Cette tournée', date, creneau, requis = 0, affectes = 0, manque = 0 } = {}) =>
    `La tournée « ${nomTournee} » du ${dateUtil.formatDateFr(date)} (${libelleCreneau(creneau)}) nécessite ` +
    `${requis} personne(s) mais n'en a que ${affectes} : il manque ${manque} personne(s).`,

  TROP_JOURS_CONSECUTIFS: ({ nomPersonne = 'Cette personne', jours = 0, maxAutorise = 0 } = {}) =>
    `${nomPersonne} travaille ${jours} jours d'affilée, au-delà du maximum autorisé (${maxAutorise} jours).`,

  REPOS_HEBDO_INSUFFISANT: ({ nomPersonne = 'Cette personne', joursRepos = 0, minRequis = 0, semaineDebut } = {}) =>
    `${nomPersonne} n'a que ${joursRepos} jour(s) de repos sur la semaine du ${dateUtil.formatDateFr(semaineDebut)}, ` +
    `alors que ${minRequis} sont requis.`,

  JOUR_FERME: ({ nomPersonne = 'Cette personne', nomTournee = 'cette tournée', date } = {}) =>
    `${nomPersonne} est affectée à la tournée « ${nomTournee} » le ${dateUtil.formatDateFr(date)}, ` +
    `un jour où le cabinet est fermé.`,

  // Préférences (§7.2 du plan) : chaque gabarit reprend `descriptionPreference`
  // (calculée via `decrirePreference`, `src/domain/preferences.js`) pour rester
  // cohérent avec le phrasé déjà vu dans l'écran Souhaits.
  PREFERENCE_JOUR_OFF_RECURRENT: affecteMalgrePreference,
  PREFERENCE_JOURS_REPOS_SOUHAITES: affecteMalgrePreference,
  PREFERENCE_CRENEAU_OFF: affecteMalgrePreference,
  PREFERENCE_INDISPO_HEBDO: affecteMalgrePreference,

  PREFERENCE_MAX_JOURS_CONSECUTIFS: ({
    nomPersonne = 'Cette personne',
    descriptionPreference = '',
    joursConsecutifs = 0,
  } = {}) =>
    `${nomPersonne} — ${descriptionPreference} — travaille ${joursConsecutifs} jours d'affilée, ` +
    `au-delà de cette limite personnelle.`,

  PREFERENCE_MIN_JOURS_CONSECUTIFS: ({
    nomPersonne = 'Cette personne',
    descriptionPreference = '',
    longueur = 0,
    debut,
    fin,
  } = {}) =>
    `${nomPersonne} — ${descriptionPreference} — n'a travaillé que ${longueur} jour(s) d'affilée ` +
    `du ${dateUtil.formatDateFr(debut)} au ${dateUtil.formatDateFr(fin)}, avant une coupure.`,

  PREFERENCE_NB_JOURS_SEMAINE: ({
    nomPersonne = 'Cette personne',
    descriptionPreference = '',
    nb = 0,
    semaineDebut,
  } = {}) =>
    `${nomPersonne} — ${descriptionPreference} — travaille ${nb} jour(s) la semaine ` +
    `du ${dateUtil.formatDateFr(semaineDebut)}.`,

  PREFERENCE_TOURNEE: ({
    nomPersonne = 'Cette personne',
    descriptionPreference = '',
    nomTournee = 'cette tournée',
    date,
    creneau,
  } = {}) =>
    `${nomPersonne} — ${descriptionPreference} — mais est affectée à la tournée « ${nomTournee} » ` +
    `le ${dateUtil.formatDateFr(date)} (${libelleCreneau(creneau)}).`,

  EQUITE_DESEQUILIBREE: ({ nomPersonne = 'Cette personne', charge = 0, moyenne = 0 } = {}) =>
    `${nomPersonne} a une charge de travail de ${arrondi1(charge)} créneau(x) sur la période, ` +
    `contre une moyenne d'équipe de ${arrondi1(moyenne)} : la répartition est déséquilibrée.`,

  CONTINUITE_ROMPUE: ({
    nomTournee = 'Cette tournée',
    dateB,
    nomPersonneA = 'une personne',
    nomPersonneB = 'une autre personne',
  } = {}) =>
    `La tournée « ${nomTournee} » change de personne le ${dateUtil.formatDateFr(dateB)} : ` +
    `${nomPersonneA} laisse la place à ${nomPersonneB}, ce qui peut nuire à la continuité du suivi.`,
};

/**
 * Construit le message FR d'une violation à partir de son `code` stable et
 * de ses `params`, prêt à être affiché **tel quel**. Un `code` inconnu ne
 * lève jamais : il renvoie un message neutre (§7.4, « jamais de crash »).
 *
 * @param {string} code - Code stable (voir `Violation.code`).
 * @param {Object} [params] - Données nécessaires au gabarit (personne, tournée, date, créneau…).
 * @returns {string} Message FR, prêt à afficher tel quel.
 */
export function messagePour(code, params = {}) {
  const gabarit = GABARITS[code];
  if (!gabarit) return 'Conflit de planning détecté (détails indisponibles).';
  return gabarit(params ?? {});
}
