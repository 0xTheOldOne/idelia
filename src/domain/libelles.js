/**
 * Tables de correspondance code → libellé FR (affichage uniquement).
 *
 * Les **codes** métier (jours ISO, créneaux `CRENEAUX`, statuts
 * `STATUTS_PERSONNE`) sont définis dans `src/domain/schema.js` ; ce module ne
 * porte que leur traduction en libellés lisibles pour l'utilisateur (prêt
 * pour une future i18n).
 *
 * Jours en ISO 8601 uniquement (ADR 0010) : `1` = lundi … `7` = dimanche.
 * Aucun appel à `Date.getDay()` ici — la correspondance est directe.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { STATUTS_PERSONNE } from '@/domain/schema.js';

/**
 * @typedef {object} JourSemaine
 * @property {number} iso - Jour ISO 8601 (1 = lundi … 7 = dimanche).
 * @property {string} libelle - Nom du jour en français, en toutes lettres.
 */

/**
 * Liste ordonnée des jours de la semaine (ordre ISO, lundi → dimanche),
 * prête à itérer pour construire des cases à cocher.
 *
 * @type {JourSemaine[]}
 */
export const JOURS_SEMAINE = [
  { iso: 1, libelle: 'Lundi' },
  { iso: 2, libelle: 'Mardi' },
  { iso: 3, libelle: 'Mercredi' },
  { iso: 4, libelle: 'Jeudi' },
  { iso: 5, libelle: 'Vendredi' },
  { iso: 6, libelle: 'Samedi' },
  { iso: 7, libelle: 'Dimanche' },
];

/**
 * Renvoie le libellé FR d'un jour de semaine à partir de son numéro ISO.
 *
 * @param {number} iso - Jour ISO 8601 (1 = lundi … 7 = dimanche).
 * @returns {string} Libellé FR (ex. `1 → 'Lundi'`), ou chaîne vide si inconnu.
 */
export function libelleJour(iso) {
  const jour = JOURS_SEMAINE.find((j) => j.iso === iso);
  return jour ? jour.libelle : '';
}

/**
 * Table de correspondance code créneau (`schema.js` → `CRENEAUX`) → libellé FR.
 *
 * @type {{ MATIN: string, APRES_MIDI: string, JOURNEE: string }}
 */
export const LIBELLES_CRENEAU = {
  MATIN: 'Matin',
  APRES_MIDI: 'Après-midi',
  JOURNEE: 'Journée entière',
};

/**
 * Renvoie le libellé FR d'un créneau à partir de son code.
 *
 * @param {string} code - Code créneau (`'MATIN'`, `'APRES_MIDI'`, `'JOURNEE'`).
 * @returns {string} Libellé FR (ex. `'APRES_MIDI' → 'Après-midi'`), ou chaîne vide si inconnu.
 */
export function libelleCreneau(code) {
  return LIBELLES_CRENEAU[code] ?? '';
}

/**
 * Table de correspondance code statut (`schema.js` → `STATUTS_PERSONNE`) → libellé FR.
 *
 * @type {{ TITULAIRE: string, REMPLACANT: string }}
 */
export const LIBELLES_STATUT_PERSONNE = {
  TITULAIRE: 'Titulaire',
  REMPLACANT: 'Remplaçant',
};

/**
 * Renvoie le libellé FR d'un statut de personne à partir de son code.
 *
 * @param {string} code - Code statut (`'TITULAIRE'`, `'REMPLACANT'`).
 * @returns {string} Libellé FR (ex. `'REMPLACANT' → 'Remplaçant'`), ou chaîne vide si inconnu.
 */
export function libelleStatutPersonne(code) {
  return LIBELLES_STATUT_PERSONNE[code] ?? '';
}

/**
 * @typedef {object} OptionStatutPersonne
 * @property {string} code - Code statut (voir `STATUTS_PERSONNE`).
 * @property {string} libelle - Libellé FR correspondant.
 */

/**
 * Liste des statuts de personne, prête à itérer pour un `form-select` ou un
 * groupe de boutons radio. Dérivée de `STATUTS_PERSONNE` (schema.js) et de
 * `LIBELLES_STATUT_PERSONNE` pour garantir leur cohérence.
 *
 * @type {OptionStatutPersonne[]}
 */
export const STATUTS_PERSONNE_OPTIONS = STATUTS_PERSONNE.map((code) => ({
  code,
  libelle: libelleStatutPersonne(code),
}));
