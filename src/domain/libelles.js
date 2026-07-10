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

import {
  STATUTS_PERSONNE,
  NATURES_PREFERENCE,
  TYPES_PREFERENCE,
  TYPES_ABSENCE,
  STATUTS_ABSENCE,
  STATUTS_PLANNING,
} from '@/domain/schema.js';

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
 * Énumère une liste de jours ISO en toutes lettres, dans l'ordre ISO
 * croissant quel que soit l'ordre d'entrée (« Lundi », « Lundi et Mardi »,
 * « Lundi, Mardi et Jeudi »). Affichage uniquement, réutilisé par `0006`
 * (tournées), `0007` (absences) et `0010` (planning).
 *
 * @param {number[]} joursIso - Jours ISO 8601 (1 = lundi … 7 = dimanche).
 * @returns {string} Énumération FR, ou chaîne vide si la liste est vide.
 */
export function libelleJours(joursIso) {
  const jours = Array.isArray(joursIso) ? [...joursIso].sort((a, b) => a - b) : [];
  const libelles = jours.map(libelleJour).filter(Boolean);
  if (libelles.length === 0) return '';
  if (libelles.length === 1) return libelles[0];
  return `${libelles.slice(0, -1).join(', ')} et ${libelles[libelles.length - 1]}`;
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

/**
 * Table de correspondance code nature de préférence (`schema.js` →
 * `NATURES_PREFERENCE`) → libellé FR.
 *
 * @type {{ DURE: string, SOUPLE: string }}
 */
export const LIBELLES_NATURE_PREFERENCE = {
  DURE: 'Obligatoire',
  SOUPLE: 'Souhait',
};

/**
 * Renvoie le libellé FR d'une nature de préférence à partir de son code.
 *
 * @param {string} code - Code nature (`'DURE'`, `'SOUPLE'`).
 * @returns {string} Libellé FR (ex. `'SOUPLE' → 'Souhait'`), ou chaîne vide si inconnu.
 */
export function libelleNaturePreference(code) {
  return LIBELLES_NATURE_PREFERENCE[code] ?? '';
}

/** Phrases d'aide FR associées à chaque nature, pour les boutons radio du formulaire. */
const AIDES_NATURE_PREFERENCE = {
  DURE: 'Toujours respecté par le planning.',
  SOUPLE: 'Pris en compte si possible.',
};

/**
 * @typedef {object} OptionNaturePreference
 * @property {string} code - Code nature (voir `NATURES_PREFERENCE`).
 * @property {string} libelle - Libellé FR correspondant.
 * @property {string} aide - Phrase d'aide FR expliquant la nature.
 */

/**
 * Options de nature de préférence, prêtes à itérer pour un groupe de
 * boutons radio, chacune accompagnée d'une phrase d'aide en langage clair.
 * Dérivée de `NATURES_PREFERENCE` (schema.js) pour garantir sa cohérence.
 *
 * @type {OptionNaturePreference[]}
 */
export const NATURES_PREFERENCE_OPTIONS = NATURES_PREFERENCE.map((code) => ({
  code,
  libelle: libelleNaturePreference(code),
  aide: AIDES_NATURE_PREFERENCE[code] ?? '',
}));

/**
 * Table de correspondance code type de préférence (`schema.js` →
 * `TYPES_PREFERENCE`) → libellé FR. Couvre les **8** types, y compris
 * `PREFERENCE_TOURNEE` (réactivé en `0006` maintenant que les tournées
 * existent — voir `FormulairePreference`, prop `tourneesActives`, pour le
 * filtrage « aucune tournée disponible »).
 *
 * @type {Object<string, string>}
 */
export const LIBELLES_TYPE_PREFERENCE = {
  JOUR_OFF_RECURRENT: 'Jour non travaillé (chaque semaine)',
  JOURS_REPOS_SOUHAITES: 'Jours de repos souhaités',
  CRENEAU_OFF: 'Demi-journée non travaillée',
  INDISPO_HEBDO: 'Indisponibilité chaque semaine',
  MAX_JOURS_CONSECUTIFS: "Maximum de jours d'affilée",
  MIN_JOURS_CONSECUTIFS: "Minimum de jours d'affilée",
  NB_JOURS_SEMAINE: 'Nombre de jours par semaine',
  PREFERENCE_TOURNEE: 'Tournée préférée ou évitée',
};

/**
 * Renvoie le libellé FR d'un type de préférence à partir de son code.
 *
 * @param {string} code - Code type (voir `TYPES_PREFERENCE`).
 * @returns {string} Libellé FR, ou chaîne vide si inconnu.
 */
export function libelleTypePreference(code) {
  return LIBELLES_TYPE_PREFERENCE[code] ?? '';
}

/**
 * @typedef {object} OptionTypePreference
 * @property {string} code - Code type (voir `TYPES_PREFERENCE`).
 * @property {string} libelle - Libellé FR correspondant.
 */

/**
 * Liste complète des types de préférence, prête à itérer. Dérivée de
 * `TYPES_PREFERENCE` (schema.js) et de `LIBELLES_TYPE_PREFERENCE`. Le
 * sélecteur de type du formulaire n'itère **pas** directement sur cette liste
 * mais sur `TYPES_PREFERENCE_OFFERTS` (`domain/preferences.js`), filtrée côté
 * `FormulairePreference` (retrait de `PREFERENCE_TOURNEE` tant qu'aucune
 * tournée active n'existe).
 *
 * @type {OptionTypePreference[]}
 */
export const TYPES_PREFERENCE_OPTIONS = TYPES_PREFERENCE.map((code) => ({
  code,
  libelle: libelleTypePreference(code),
}));

/**
 * Table de correspondance code sens de préférence de tournée (`PREFERE` /
 * `EVITE`, voir `Preference.params.sens` pour `PREFERENCE_TOURNEE`) → libellé FR.
 *
 * @type {{ PREFERE: string, EVITE: string }}
 */
export const LIBELLES_SENS_PREFERENCE = {
  PREFERE: 'Préfère',
  EVITE: 'Souhaite éviter',
};

/**
 * Renvoie le libellé FR d'un sens de préférence de tournée à partir de son code.
 *
 * @param {string} code - Code sens (`'PREFERE'`, `'EVITE'`).
 * @returns {string} Libellé FR, ou chaîne vide si inconnu.
 */
export function libelleSensPreference(code) {
  return LIBELLES_SENS_PREFERENCE[code] ?? '';
}

/**
 * @typedef {object} OptionSensPreference
 * @property {string} code - `'PREFERE'` | `'EVITE'`.
 * @property {string} libelle - Libellé FR correspondant.
 */

/**
 * Options de sens de préférence de tournée, prêtes à itérer pour un groupe
 * de boutons radio (`FormulairePreference`, champ `PREFERENCE_TOURNEE`).
 *
 * @type {OptionSensPreference[]}
 */
export const SENS_PREFERENCE_OPTIONS = [
  { code: 'PREFERE', libelle: 'Préfère' },
  { code: 'EVITE', libelle: 'Souhaite éviter' },
];

/**
 * Table de correspondance code type d'absence (`schema.js` →
 * `TYPES_ABSENCE`) → libellé FR.
 *
 * @type {Object<string, string>}
 */
export const LIBELLES_TYPE_ABSENCE = {
  CONGE_PAYE: 'Congés payés',
  RTT: 'RTT',
  ARRET_MALADIE: 'Arrêt maladie',
  MATERNITE: 'Congé maternité',
  PATERNITE: 'Congé paternité',
  NAISSANCE: 'Congé naissance',
  FORMATION: 'Formation',
  AUTRE: 'Autre',
};

/**
 * Renvoie le libellé FR d'un type d'absence à partir de son code.
 *
 * @param {string} code - Code type (voir `TYPES_ABSENCE`).
 * @returns {string} Libellé FR, ou chaîne vide si inconnu.
 */
export function libelleTypeAbsence(code) {
  return LIBELLES_TYPE_ABSENCE[code] ?? '';
}

/**
 * @typedef {object} OptionTypeAbsence
 * @property {string} code - Code type (voir `TYPES_ABSENCE`).
 * @property {string} libelle - Libellé FR correspondant.
 */

/**
 * Liste des types d'absence, prête à itérer pour le `form-select` du
 * formulaire. Dérivée de `TYPES_ABSENCE` (schema.js) et de
 * `LIBELLES_TYPE_ABSENCE` pour garantir leur cohérence.
 *
 * @type {OptionTypeAbsence[]}
 */
export const TYPES_ABSENCE_OPTIONS = TYPES_ABSENCE.map((code) => ({
  code,
  libelle: libelleTypeAbsence(code),
}));

/**
 * Table de correspondance code statut d'absence (`schema.js` →
 * `STATUTS_ABSENCE`) → libellé FR. « En attente » (plutôt que « Demande »)
 * est préféré pour un statut affiché sur une carte et dans un filtre.
 *
 * **Dormant en v1 — voir feature 0017** : le workflow demande/validation
 * est retiré de l'UI (`creerAbsence` force `statut` à `'VALIDE'`) ;
 * conservé sans dépendance Vue en vue d'une réactivation post-v1, sans
 * migration.
 *
 * @type {{ DEMANDE: string, VALIDE: string, REFUSE: string }}
 */
export const LIBELLES_STATUT_ABSENCE = {
  DEMANDE: 'En attente',
  VALIDE: 'Validée',
  REFUSE: 'Refusée',
};

/**
 * Renvoie le libellé FR d'un statut d'absence à partir de son code.
 *
 * Dormant en v1 — voir feature 0017 (voir `LIBELLES_STATUT_ABSENCE`).
 *
 * @param {string} code - Code statut (voir `STATUTS_ABSENCE`).
 * @returns {string} Libellé FR, ou chaîne vide si inconnu.
 */
export function libelleStatutAbsence(code) {
  return LIBELLES_STATUT_ABSENCE[code] ?? '';
}

/**
 * @typedef {object} OptionStatutAbsence
 * @property {string} code - Code statut (voir `STATUTS_ABSENCE`).
 * @property {string} libelle - Libellé FR correspondant.
 */

/**
 * Liste des statuts d'absence, prête à itérer (ex. filtre de liste).
 * Dérivée de `STATUTS_ABSENCE` (schema.js) et de `LIBELLES_STATUT_ABSENCE`
 * pour garantir leur cohérence.
 *
 * Dormant en v1 — voir feature 0017 (voir `LIBELLES_STATUT_ABSENCE`).
 *
 * @type {OptionStatutAbsence[]}
 */
export const STATUTS_ABSENCE_OPTIONS = STATUTS_ABSENCE.map((code) => ({
  code,
  libelle: libelleStatutAbsence(code),
}));

/**
 * Table de correspondance code d'état temporel factuel d'une absence
 * (voir `etatTemporelAbsence`, `domain/absences.js`) → libellé FR.
 *
 * Repère purement déduit des dates par rapport à aujourd'hui — **jamais**
 * une approbation ni un statut de validation (feature 0017).
 *
 * @type {{ PASSEE: string, EN_COURS: string, A_VENIR: string }}
 */
export const LIBELLES_ETAT_TEMPOREL_ABSENCE = {
  PASSEE: 'Passée',
  EN_COURS: 'En cours',
  A_VENIR: 'À venir',
};

/**
 * Renvoie le libellé FR d'un état temporel factuel d'absence à partir de
 * son code (voir `etatTemporelAbsence`).
 *
 * @param {string} code - Code état (`'PASSEE'`, `'EN_COURS'`, `'A_VENIR'`).
 * @returns {string} Libellé FR, ou chaîne vide si inconnu.
 */
export function libelleEtatTemporelAbsence(code) {
  return LIBELLES_ETAT_TEMPOREL_ABSENCE[code] ?? '';
}

/**
 * Table de correspondance code statut de planning (`schema.js` →
 * `STATUTS_PLANNING`) → libellé FR. « Diffusé » (plutôt que « Publié ») est
 * le vocabulaire du glossaire pour `PUBLIE` ([ADR 0009], workflow référent).
 *
 * @type {{ BROUILLON: string, VALIDE: string, PUBLIE: string }}
 */
export const LIBELLES_STATUT_PLANNING = {
  BROUILLON: 'Brouillon',
  VALIDE: 'Validé',
  PUBLIE: 'Diffusé',
};

/**
 * Renvoie le libellé FR d'un statut de planning à partir de son code.
 *
 * @param {string} code - Code statut (voir `STATUTS_PLANNING`).
 * @returns {string} Libellé FR (ex. `'PUBLIE' → 'Diffusé'`), ou chaîne vide si inconnu.
 */
export function libelleStatutPlanning(code) {
  return LIBELLES_STATUT_PLANNING[code] ?? '';
}

/**
 * @typedef {object} OptionStatutPlanning
 * @property {string} code - Code statut (voir `STATUTS_PLANNING`).
 * @property {string} libelle - Libellé FR correspondant.
 */

/**
 * Liste des statuts de planning, prête à itérer. Dérivée de
 * `STATUTS_PLANNING` (schema.js) et de `LIBELLES_STATUT_PLANNING` pour
 * garantir leur cohérence.
 *
 * @type {OptionStatutPlanning[]}
 */
export const STATUTS_PLANNING_OPTIONS = STATUTS_PLANNING.map((code) => ({
  code,
  libelle: libelleStatutPlanning(code),
}));
