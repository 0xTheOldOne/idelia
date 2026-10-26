/**
 * Coordonnées d'une personne (0040) : date de naissance, âges et rubriques
 * « Adresse et naissance » de la consultation.
 *
 * Module pur : aucun import Vue/Vuex (ADR 0008). L'adresse elle-même
 * (forme, normalisation, affichage) vit dans `adresse.js` (0039).
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { normaliserAdresse, lignesAdresse, adresseSurUneLigne } from '@/domain/adresse.js';

/** Âge minimal plausible à la saisie d'une date de naissance (années). */
export const AGE_MIN_NAISSANCE = 16;
/** Âge maximal plausible à la saisie d'une date de naissance (années). */
export const AGE_MAX_NAISSANCE = 100;

/**
 * Champs de l'adresse d'une personne, dans l'ordre d'affichage de la fiche.
 * @type {ReadonlyArray<Readonly<{ cle: string, libelle: string, exemple: string }>>}
 */
export const CHAMPS_ADRESSE_PERSONNE = Object.freeze([
  Object.freeze({ cle: 'ligne1', libelle: 'Numéro et rue', exemple: '12 rue des Lilas' }),
  Object.freeze({ cle: 'ligne2', libelle: "Complément d'adresse", exemple: 'Bâtiment B, appartement 12' }),
  Object.freeze({ cle: 'codePostal', libelle: 'Code postal', exemple: '75011' }),
  Object.freeze({ cle: 'ville', libelle: 'Ville', exemple: 'Paris' }),
]);

/**
 * Date de naissance conservée si c'est une date calendaire existante, sinon `null`.
 * @param {*} valeur
 * @returns {(string|null)} `"YYYY-MM-DD"` ou `null`.
 */
export function normaliserDateNaissance(valeur) {
  return dateUtil.estDateValide(valeur) ? valeur : null;
}

/**
 * Âge en années révolues, par comparaison de chaînes (sans objet `Date`).
 * @param {string} dateNaissance - `"YYYY-MM-DD"`.
 * @param {string} aujourdhui - `"YYYY-MM-DD"`.
 * @returns {(number|null)} `null` si l'une des dates est invalide.
 */
export function ageEnAnnees(dateNaissance, aujourdhui) {
  if (!dateUtil.estDateValide(dateNaissance) || !dateUtil.estDateValide(aujourdhui)) return null;
  const annees = Number(aujourdhui.slice(0, 4)) - Number(dateNaissance.slice(0, 4));
  return aujourdhui.slice(5) < dateNaissance.slice(5) ? annees - 1 : annees;
}

/**
 * `aujourdhui` moins `ans` années ; un 29 février hors année bissextile devient le 28.
 * @param {string} aujourdhui - `"YYYY-MM-DD"`.
 * @param {number} ans
 * @returns {string}
 */
function moinsAnnees(aujourdhui, ans) {
  const annee = Number(aujourdhui.slice(0, 4)) - ans;
  const moisJour = aujourdhui.slice(5);
  const bissextile = (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
  const mj = moisJour === '02-29' && !bissextile ? '02-28' : moisJour;
  return `${String(annee).padStart(4, '0')}-${mj}`;
}

/**
 * Bornes `min` / `max` du champ date de naissance (âges 100 et 16 ans).
 * @param {string} aujourdhui - `"YYYY-MM-DD"`.
 * @returns {{ min: string, max: string }}
 */
export function bornesDateNaissance(aujourdhui) {
  return {
    min: moinsAnnees(aujourdhui, AGE_MAX_NAISSANCE),
    max: moinsAnnees(aujourdhui, AGE_MIN_NAISSANCE),
  };
}

/**
 * `true` si la valeur est vide ou une date valide strictement antérieure à `aujourdhui`.
 * @param {*} valeur
 * @param {string} aujourdhui - `"YYYY-MM-DD"`.
 * @returns {boolean}
 */
export function estDateNaissancePassee(valeur, aujourdhui) {
  if (!valeur) return true;
  return dateUtil.estDateValide(valeur) && valeur < aujourdhui;
}

/**
 * `true` si la valeur est vide ou donne un âge entre AGE_MIN_NAISSANCE et AGE_MAX_NAISSANCE.
 * @param {*} valeur
 * @param {string} aujourdhui - `"YYYY-MM-DD"`.
 * @returns {boolean}
 */
export function estAgeNaissancePlausible(valeur, aujourdhui) {
  if (!valeur) return true;
  const age = ageEnAnnees(valeur, aujourdhui);
  return age !== null && age >= AGE_MIN_NAISSANCE && age <= AGE_MAX_NAISSANCE;
}

/**
 * `true` si au moins une coordonnée (adresse ou date de naissance) est renseignée.
 * @param {{ adresse?: *, dateNaissance?: * }} [personne]
 * @returns {boolean}
 */
export function aDesCoordonnees(personne) {
  const adresse = normaliserAdresse(personne?.adresse);
  return Object.values(adresse).some(Boolean) || normaliserDateNaissance(personne?.dateNaissance) !== null;
}

/**
 * @typedef {Object} RubriqueCoordonnees
 * @property {string} cle - `'adresse'` ou `'dateNaissance'`.
 * @property {string} libelle
 * @property {string[]} lignes - Vide si la rubrique n'est pas renseignée.
 * @property {(string|null)} texteCopie - Texte copié dans le presse-papiers, ou `null`.
 * @property {string} libelleCopie - Complément du nom accessible du bouton de copie.
 * @property {string} confirmation - Message affiché après copie.
 */

/**
 * Rubriques de la consultation « Adresse et naissance », dans l'ordre d'affichage.
 * @param {{ adresse?: *, dateNaissance?: * }} [personne]
 * @returns {RubriqueCoordonnees[]}
 */
export function lignesCoordonnees(personne) {
  const lignes = lignesAdresse(personne?.adresse);
  const naissance = normaliserDateNaissance(personne?.dateNaissance);
  const dateFr = naissance ? dateUtil.formatDateFr(naissance) : '';
  return [
    {
      cle: 'adresse',
      libelle: 'Adresse',
      lignes,
      texteCopie: lignes.length ? adresseSurUneLigne(personne?.adresse) : null,
      libelleCopie: "l'adresse",
      confirmation: 'Adresse copiée.',
    },
    {
      cle: 'dateNaissance',
      libelle: 'Date de naissance',
      lignes: dateFr ? [dateFr] : [],
      texteCopie: dateFr || null,
      libelleCopie: 'la date de naissance',
      confirmation: 'Date de naissance copiée.',
    },
  ];
}
