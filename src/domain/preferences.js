/**
 * Fabrique, métadonnées & description d'une `Preference` (souhait/contrainte
 * attaché à une `Personne` — voir docs/architecture/02-modele-de-domaine.md
 * §Preference).
 *
 * Module dédié, distinct de `personnes.js` : le polymorphisme (fabrique +
 * normalisation de `params` par type + métadonnées par type + description en
 * langage humain + échelle d'importance) est cohésif et volumineux, sans
 * rapport avec la fabrique `Personne`.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Seules concessions techniques tolérées (comme dans `schema.js`/`personnes.js`) :
 * `genId()` pour l'identifiant et `new Date().toISOString()` pour les
 * horodatages.
 */

import { TYPES_PREFERENCE, CRENEAUX } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';
import { libelleJour, libelleCreneau } from '@/domain/libelles.js';

/**
 * @typedef {Object} Preference
 * @property {string} id - Identifiant unique, immuable.
 * @property {string} type - Discriminant, ∈ {@link TYPES_PREFERENCE}.
 * @property {string} nature - `'DURE'` (obligatoire) ou `'SOUPLE'` (souhait).
 * @property {number} poids - Importance 1..10, utilisée seulement si `nature === 'SOUPLE'` (défaut `5`).
 * @property {boolean} actif - `false` = mise en pause (exclue temporairement, non supprimée).
 * @property {Object} params - Forme dépendant de `type` (voir `normaliserParams`).
 * @property {string} libelle - Note libre facultative de l'utilisateur.
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

// ---------------------------------------------------------------------------
// Normalisation de `params` (interne)
// ---------------------------------------------------------------------------

/**
 * Coerce une valeur en liste de jours ISO 8601 valides (1..7), triée et
 * dédupliquée. Tolère les valeurs manquantes/invalides (ignorées).
 *
 * @param {*} valeur - Valeur brute (idéalement un `number[]`).
 * @returns {number[]} Jours ISO triés et dédupliqués.
 */
function normaliserJours(valeur) {
  const bruts = Array.isArray(valeur) ? valeur : [];
  const valides = bruts.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 1 && v <= 7);
  return [...new Set(valides)].sort((a, b) => a - b);
}

/**
 * Filtre une valeur pour ne garder qu'un sous-ensemble de {@link CRENEAUX},
 * dans l'ordre canonique de `CRENEAUX` (dédoublonné de fait).
 *
 * @param {*} valeur - Valeur brute (idéalement un `string[]`).
 * @returns {string[]} Sous-ensemble valide de `CRENEAUX`.
 */
function normaliserCreneaux(valeur) {
  const bruts = Array.isArray(valeur) ? valeur : [];
  return CRENEAUX.filter((code) => bruts.includes(code));
}

/**
 * Coerce une valeur en entier, ou `null` si absente/invalide. Ne valide pas
 * de bornes (la validation de saisie vit dans le formulaire, Vuelidate) :
 * garantit seulement une forme structurelle stable.
 *
 * @param {*} valeur - Valeur brute (idéalement un `number`).
 * @returns {(number|null)} Entier, ou `null`.
 */
function normaliserEntier(valeur) {
  const nombre = Number(valeur);
  return Number.isFinite(nombre) ? Math.trunc(nombre) : null;
}

/**
 * Coerce une valeur en liste d'identifiants de tournée valides (chaînes non
 * vides), dédupliqués, en conservant l'ordre de première apparition. Tolère
 * les valeurs manquantes/invalides (ignorées).
 *
 * @param {*} valeur - Valeur brute (idéalement un `string[]`).
 * @returns {string[]} Identifiants de tournée dédupliqués.
 */
function normaliserTourneeIds(valeur) {
  const bruts = Array.isArray(valeur) ? valeur : [];
  const valides = bruts.filter((id) => typeof id === 'string' && id.length > 0);
  return [...new Set(valides)];
}

/**
 * Normalise `params` selon le `type` de préférence : ne conserve que les
 * clés pertinentes pour ce type, coerce jours/créneaux/nombres. Les clés
 * étrangères au type sont silencieusement ignorées.
 *
 * @param {string} type - Discriminant, ∈ {@link TYPES_PREFERENCE}.
 * @param {*} params - `params` brut (objet partiel, forme quelconque).
 * @returns {Object} `params` normalisé, prêt à être stocké.
 */
function normaliserParams(type, params) {
  const p = params ?? {};
  switch (type) {
    case 'JOUR_OFF_RECURRENT':
    case 'JOURS_REPOS_SOUHAITES':
      return { joursSemaine: normaliserJours(p.joursSemaine) };
    case 'CRENEAU_OFF':
      return {
        creneaux: normaliserCreneaux(p.creneaux),
        joursSemaine: normaliserJours(p.joursSemaine),
      };
    case 'INDISPO_HEBDO':
      return {
        joursSemaine: normaliserJours(p.joursSemaine),
        creneaux: normaliserCreneaux(p.creneaux),
      };
    case 'MAX_JOURS_CONSECUTIFS':
      return { max: normaliserEntier(p.max) };
    case 'MIN_JOURS_CONSECUTIFS':
      return { min: normaliserEntier(p.min) };
    case 'NB_JOURS_SEMAINE':
      return { min: normaliserEntier(p.min), max: normaliserEntier(p.max) };
    case 'PREFERENCE_TOURNEE':
      return {
        tourneeIds: normaliserTourneeIds(p.tourneeIds),
        sens: p.sens === 'EVITE' ? 'EVITE' : 'PREFERE',
      };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Fabrique
// ---------------------------------------------------------------------------

/**
 * Construit une `Preference` complète et normalisée à partir d'un objet
 * partiel (typiquement les champs saisis dans `FormulairePreference`), en
 * appliquant les valeurs par défaut, en générant les champs techniques et en
 * normalisant `params` selon `type`.
 *
 * @param {Object} [champs] - Champs partiels d'une Preference.
 * @returns {Preference} Preference complète, prête à être stockée.
 */
export function creerPreference(champs = {}) {
  const maintenant = new Date().toISOString();
  const type = champs.type;

  return {
    id: champs.id ?? genId(),
    type,
    nature: champs.nature ?? natureParDefaut(type),
    poids: champs.poids ?? 5,
    actif: champs.actif ?? true,
    params: normaliserParams(type, champs.params),
    libelle: String(champs.libelle ?? '').trim(),
    createdAt: champs.createdAt ?? maintenant,
    updatedAt: maintenant,
  };
}

// ---------------------------------------------------------------------------
// Métadonnées par type
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MetaTypePreference
 * @property {string} champs - Forme des champs de saisie pour ce type
 *   (`'jours'` | `'creneaux+jours?'` | `'jours+creneaux?'` | `'nombreMax'` |
 *   `'nombreMin'` | `'minMax'`), pilote le rendu dynamique du formulaire.
 * @property {string} natureParDefaut - `'DURE'` ou `'SOUPLE'` suggéré par défaut.
 * @property {string} aide - Phrase d'aide FR expliquant le type.
 */

/**
 * Description métier de chaque type de préférence, indexée par code. Pilote
 * le rendu dynamique du formulaire (`FormulairePreference`) et son aide
 * contextuelle.
 *
 * @type {Readonly<Object<string, MetaTypePreference>>}
 */
export const META_TYPES_PREFERENCE = Object.freeze({
  JOUR_OFF_RECURRENT: Object.freeze({
    champs: 'jours',
    natureParDefaut: 'SOUPLE',
    aide: 'Choisissez le ou les jours où cette personne ne travaille jamais.',
  }),
  JOURS_REPOS_SOUHAITES: Object.freeze({
    champs: 'jours',
    natureParDefaut: 'SOUPLE',
    aide: 'Choisissez le ou les jours où cette personne souhaite être en repos.',
  }),
  CRENEAU_OFF: Object.freeze({
    champs: 'creneaux+jours?',
    natureParDefaut: 'DURE',
    aide: "Choisissez le ou les moments de la journée non travaillés, et éventuellement les jours concernés.",
  }),
  INDISPO_HEBDO: Object.freeze({
    champs: 'jours+creneaux?',
    natureParDefaut: 'DURE',
    aide: "Choisissez le ou les jours d'indisponibilité, et éventuellement les moments de la journée concernés.",
  }),
  MAX_JOURS_CONSECUTIFS: Object.freeze({
    champs: 'nombreMax',
    natureParDefaut: 'DURE',
    aide: "Indiquez le nombre maximal de jours travaillés d'affilée.",
  }),
  MIN_JOURS_CONSECUTIFS: Object.freeze({
    champs: 'nombreMin',
    natureParDefaut: 'SOUPLE',
    aide: "Indiquez le nombre minimal de jours travaillés d'affilée.",
  }),
  NB_JOURS_SEMAINE: Object.freeze({
    champs: 'minMax',
    natureParDefaut: 'SOUPLE',
    aide: 'Indiquez un minimum et/ou un maximum de jours travaillés par semaine.',
  }),
  PREFERENCE_TOURNEE: Object.freeze({
    champs: 'tournees',
    natureParDefaut: 'SOUPLE',
    aide: 'Choisissez une ou plusieurs tournées, puis indiquez si la personne les préfère ou souhaite les éviter.',
  }),
});

/**
 * Liste des types de préférence proposés au sélecteur du formulaire :
 * `TYPES_PREFERENCE` dans son intégralité (les 8 types), y compris
 * `PREFERENCE_TOURNEE` — réactivé en `006` maintenant que les tournées
 * existent. Le **filtrage** « aucune tournée disponible » (retirer
 * `PREFERENCE_TOURNEE` tant qu'aucune tournée active n'existe) se fait **côté
 * formulaire** (`FormulairePreference`), pas ici : ce module reste
 * indépendant de tout contexte d'affichage.
 *
 * @type {ReadonlyArray<string>}
 */
export const TYPES_PREFERENCE_OFFERTS = TYPES_PREFERENCE;

/**
 * Renvoie la nature suggérée par défaut pour un type de préférence donné.
 * L'utilisateur peut toujours la changer dans le formulaire.
 *
 * @param {string} type - Discriminant, ∈ {@link TYPES_PREFERENCE}.
 * @returns {string} `'DURE'` ou `'SOUPLE'`.
 */
export function natureParDefaut(type) {
  return META_TYPES_PREFERENCE[type]?.natureParDefaut ?? 'SOUPLE';
}

// ---------------------------------------------------------------------------
// Échelle d'importance (poids)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} NiveauImportance
 * @property {string} code - `'FAIBLE'` | `'MOYENNE'` | `'FORTE'`.
 * @property {string} libelle - Libellé FR en langage clair.
 * @property {number} poids - Poids 1..10 correspondant.
 */

/**
 * Échelle d'importance en 3 niveaux humains, traduisant le `poids` brut
 * (1..10, jargonneux) en mots pour l'utilisateur (« Peu / Assez / Très
 * important »).
 *
 * @type {ReadonlyArray<NiveauImportance>}
 */
export const NIVEAUX_IMPORTANCE = Object.freeze([
  Object.freeze({ code: 'FAIBLE', libelle: 'Peu important', poids: 3 }),
  Object.freeze({ code: 'MOYENNE', libelle: 'Assez important', poids: 5 }),
  Object.freeze({ code: 'FORTE', libelle: 'Très important', poids: 8 }),
]);

/**
 * Convertit un code de niveau d'importance en `poids` brut (1..10).
 *
 * @param {string} code - `'FAIBLE'` | `'MOYENNE'` | `'FORTE'`.
 * @returns {number} Poids correspondant (défaut `5` si code inconnu).
 */
export function niveauVersPoids(code) {
  const niveau = NIVEAUX_IMPORTANCE.find((n) => n.code === code);
  return niveau ? niveau.poids : 5;
}

/**
 * Rapproche un `poids` brut (1..10, éventuellement importé) du niveau
 * d'importance le plus proche, pour un affichage en mots.
 *
 * @param {number} poids - Poids 1..10.
 * @returns {string} Code du niveau le plus proche (`'FAIBLE'` | `'MOYENNE'` | `'FORTE'`).
 */
export function poidsVersNiveau(poids) {
  let plusProche = NIVEAUX_IMPORTANCE[0];
  let ecartMin = Math.abs(poids - plusProche.poids);
  for (const niveau of NIVEAUX_IMPORTANCE) {
    const ecart = Math.abs(poids - niveau.poids);
    if (ecart < ecartMin) {
      ecartMin = ecart;
      plusProche = niveau;
    }
  }
  return plusProche.code;
}

// ---------------------------------------------------------------------------
// Description en langage humain
// ---------------------------------------------------------------------------

/** Phrase créneau avec article, pour une préférence exprimée « en négatif » (ne travaille pas…). */
const CRENEAU_AVEC_ARTICLE = {
  MATIN: 'le matin',
  APRES_MIDI: "l'après-midi",
  JOURNEE: 'la journée entière',
};

/**
 * Joint une liste de fragments FR en une énumération naturelle : « a », «
 * a et b », « a, b et c ».
 *
 * @param {string[]} items - Fragments à joindre (déjà formatés).
 * @returns {string} Énumération FR, ou chaîne vide si la liste est vide.
 */
function joindreListe(items) {
  const liste = items.filter(Boolean);
  if (liste.length === 0) return '';
  if (liste.length === 1) return liste[0];
  return `${liste.slice(0, -1).join(', ')} et ${liste[liste.length - 1]}`;
}

/**
 * Décrit une liste de jours ISO en fragment FR (« le mercredi », « le
 * samedi et le dimanche »).
 *
 * @param {number[]} joursSemaine - Jours ISO 1..7.
 * @returns {string} Fragment FR.
 */
function decrireJours(joursSemaine) {
  const jours = normaliserJours(joursSemaine ?? []);
  if (jours.length === 0) return '(aucun jour choisi pour l\'instant)';
  return joindreListe(jours.map((iso) => `le ${libelleJour(iso).toLowerCase()}`));
}

/**
 * Décrit une préférence `CRENEAU_OFF` (« Ne travaille pas l'après-midi »,
 * éventuellement suivi des jours concernés).
 *
 * @param {Object} params - `{ creneaux, joursSemaine? }`.
 * @returns {string} Phrase FR.
 */
function decrireCreneauOff(params) {
  const creneaux = normaliserCreneaux(params.creneaux ?? []);
  const jours = normaliserJours(params.joursSemaine ?? []);
  const creneauxTxt =
    creneaux.length > 0
      ? joindreListe(creneaux.map((c) => CRENEAU_AVEC_ARTICLE[c]))
      : '(aucun moment choisi pour l\'instant)';
  return jours.length === 0
    ? `Ne travaille pas ${creneauxTxt}`
    : `Ne travaille pas ${creneauxTxt} ${decrireJours(jours)}`;
}

/**
 * Décrit une préférence `INDISPO_HEBDO` (« Indisponible le mardi matin »).
 *
 * @param {Object} params - `{ joursSemaine, creneaux? }`.
 * @returns {string} Phrase FR.
 */
function decrireIndispoHebdo(params) {
  const joursTxt = decrireJours(params.joursSemaine);
  const creneaux = normaliserCreneaux(params.creneaux ?? []);
  if (creneaux.length === 0) return `Indisponible ${joursTxt}`;
  const creneauxTxt = joindreListe(creneaux.map((c) => libelleCreneau(c).toLowerCase()));
  return `Indisponible ${joursTxt} ${creneauxTxt}`;
}

/**
 * Décrit une préférence `MAX_JOURS_CONSECUTIFS` (« Pas plus de 5 jours
 * d'affilée »).
 *
 * @param {(number|null)} max - Nombre maximal de jours consécutifs.
 * @returns {string} Phrase FR.
 */
function decrireMax(max) {
  if (!Number.isInteger(max)) return "Nombre maximal de jours d'affilée non précisé";
  return `Pas plus de ${max} jour${max > 1 ? 's' : ''} d'affilée`;
}

/**
 * Décrit une préférence `MIN_JOURS_CONSECUTIFS` (« Au moins 2 jours
 * d'affilée »).
 *
 * @param {(number|null)} min - Nombre minimal de jours consécutifs.
 * @returns {string} Phrase FR.
 */
function decrireMin(min) {
  if (!Number.isInteger(min)) return "Nombre minimal de jours d'affilée non précisé";
  return `Au moins ${min} jour${min > 1 ? 's' : ''} d'affilée`;
}

/**
 * Décrit une préférence `NB_JOURS_SEMAINE` (« Entre 3 et 4 jours par
 * semaine », « Au moins 3 jours par semaine », « Au plus 4 jours par
 * semaine »).
 *
 * @param {Object} params - `{ min?, max? }`.
 * @returns {string} Phrase FR.
 */
function decrireNbJoursSemaine(params) {
  const min = Number.isInteger(params.min) ? params.min : null;
  const max = Number.isInteger(params.max) ? params.max : null;
  if (min != null && max != null) return `Entre ${min} et ${max} jours par semaine`;
  if (min != null) return `Au moins ${min} jour${min > 1 ? 's' : ''} par semaine`;
  if (max != null) return `Au plus ${max} jour${max > 1 ? 's' : ''} par semaine`;
  return 'Nombre de jours par semaine non précisé';
}

/**
 * Décrit une préférence `PREFERENCE_TOURNEE` (« Préfère certaines
 * tournées » / « Préfère la tournée Nord et la tournée Sud »).
 *
 * Sans résolveur (ou si aucune des tournées ne résout), retombe sur une
 * phrase générique selon `sens` — c'est ce qui garantit la **pureté** de
 * `decrirePreference` : le nommage des tournées est **injecté** par
 * l'appelant (`SouhaitsView`/`FormulairePreference`), jamais résolu ici via
 * un accès au store.
 *
 * @param {Object} params - `{ tourneeIds, sens }`.
 * @param {Object} [options] - Options de résolution (voir `decrirePreference`).
 * @returns {string} Phrase FR.
 */
function decrirePreferenceTournee(params, options) {
  const sens = params.sens === 'EVITE' ? 'EVITE' : 'PREFERE';
  const verbe = sens === 'EVITE' ? 'Souhaite éviter' : 'Préfère';
  const tourneeIds = normaliserTourneeIds(params.tourneeIds);
  const resolveur = typeof options?.nomTournee === 'function' ? options.nomTournee : null;

  const generique = `${verbe} certaines tournées`;
  if (!resolveur || tourneeIds.length === 0) return generique;

  const noms = tourneeIds
    .map((id) => resolveur(id))
    .filter((nom) => typeof nom === 'string' && nom.trim().length > 0)
    .map((nom) => `la tournée ${nom.trim()}`);

  if (noms.length === 0) return generique;
  return `${verbe} ${joindreListe(noms)}`;
}

/**
 * Résume une `Preference` en une phrase française, pour l'affichage dans la
 * liste des souhaits et l'aperçu du formulaire. Pure, tolérante à un type
 * inconnu (n'échoue jamais).
 *
 * @param {Preference} preference - Préférence à décrire (ou brouillon partiel).
 * @param {Object} [options] - Options additives, purement optionnelles
 *   (**rétrocompatible** : tout appel existant sans ce paramètre continue de
 *   fonctionner à l'identique pour les 7 autres types).
 * @param {function(string): string} [options.nomTournee] - Résolveur
 *   id → nom de tournée, utilisé **uniquement** pour `PREFERENCE_TOURNEE`
 *   (nommer les tournées choisies). Sans résolveur, une phrase générique est
 *   utilisée. Injecté par l'appelant pour garder ce module pur (aucun accès
 *   au store `tournees` ici).
 * @returns {string} Phrase FR résumant la préférence.
 */
export function decrirePreference(preference, options) {
  const { type, params } = preference ?? {};
  const p = params ?? {};

  switch (type) {
    case 'JOUR_OFF_RECURRENT':
      return `Ne travaille pas ${decrireJours(p.joursSemaine)}`;
    case 'JOURS_REPOS_SOUHAITES':
      return `Souhaite être en repos ${decrireJours(p.joursSemaine)}`;
    case 'CRENEAU_OFF':
      return decrireCreneauOff(p);
    case 'INDISPO_HEBDO':
      return decrireIndispoHebdo(p);
    case 'MAX_JOURS_CONSECUTIFS':
      return decrireMax(p.max);
    case 'MIN_JOURS_CONSECUTIFS':
      return decrireMin(p.min);
    case 'NB_JOURS_SEMAINE':
      return decrireNbJoursSemaine(p);
    case 'PREFERENCE_TOURNEE':
      return decrirePreferenceTournee(p, options);
    default:
      return 'Préférence de tournée';
  }
}
