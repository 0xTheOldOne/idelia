/**
 * Règle de remplacement (feature 0021) : une remplaçante ne travaille que pour
 * couvrir l'absence d'une titulaire. Ce module est la **source de vérité
 * unique** de « quelles absences ouvrent un remplacement », réutilisée par la
 * contrainte du moteur et par l'aide du sélecteur de personne.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage`, aucun objet
 * `Date`. Ne lève pas pour des entrées manquantes (listes vides) ; suppose des éléments
 * objets, comme le reste du moteur.
 */

import { periodesSeChevauchent, creneauChevaucheHoraires, CRENEAU_PLAGES } from '@/domain/absences.js';

/**
 * @typedef {import('@/domain/personnes.js').Personne} Personne
 * @typedef {import('@/domain/absences.js').Absence} Absence
 */

/**
 * Indique si une personne est remplaçante (`statut === 'REMPLACANT'`).
 *
 * @param {Personne} personne
 * @returns {boolean}
 */
export function estRemplacante(personne) {
  return personne?.statut === 'REMPLACANT';
}

/**
 * Absences qui libèrent une place le jour `date` : statut `'VALIDE'`, personne
 * présente dans `personnes`, active et `'TITULAIRE'`, période couvrant `date`.
 * Seules les absences de titulaires comptent (une remplaçante qui pose ses
 * congés ne libère aucune place). Ordre : celui de `absences`.
 *
 * @param {string} date - `"YYYY-MM-DD"`.
 * @param {{personnes?: Personne[], absences?: Absence[]}} [sources]
 * @returns {Absence[]}
 */
export function absencesARemplacerLe(date, { personnes = [], absences = [] } = {}) {
  const titulairesActives = new Set(
    (Array.isArray(personnes) ? personnes : [])
      .filter((p) => p.actif !== false && p.statut === 'TITULAIRE')
      .map((p) => p.id)
  );
  return (Array.isArray(absences) ? absences : []).filter(
    (a) =>
      a.statut === 'VALIDE' &&
      titulairesActives.has(a.personneId) &&
      periodesSeChevauchent(a.dateDebut, a.dateFin, date, date)
  );
}

/**
 * Sous-ensemble des absences dont le créneau recouvre les horaires `"HH:mm"`
 * (pivot midi, feature 0016).
 *
 * @param {Absence[]} absences
 * @param {string} heureDebut
 * @param {string} heureFin
 * @returns {Absence[]}
 */
export function absencesSurHoraires(absences, heureDebut, heureFin) {
  return (Array.isArray(absences) ? absences : []).filter(
    (a) => Object.hasOwn(CRENEAU_PLAGES, a.creneau) && creneauChevaucheHoraires(a.creneau, heureDebut, heureFin)
  );
}

/**
 * Raccourci : absences de titulaires à couvrir le jour `date` sur les horaires donnés.
 *
 * @param {string} date
 * @param {string} heureDebut
 * @param {string} heureFin
 * @param {{personnes?: Personne[], absences?: Absence[]}} [sources]
 * @returns {Absence[]}
 */
export function absencesACouvrir(date, heureDebut, heureFin, sources) {
  return absencesSurHoraires(absencesARemplacerLe(date, sources), heureDebut, heureFin);
}

/**
 * Titulaires distinctes concernées par une liste d'absences, dans l'ordre de
 * `personnes` (déterminisme).
 *
 * @param {Absence[]} absences
 * @param {Personne[]} personnes
 * @returns {Personne[]}
 */
export function titulairesAbsentes(absences, personnes) {
  const ids = new Set((Array.isArray(absences) ? absences : []).map((a) => a.personneId));
  return (Array.isArray(personnes) ? personnes : []).filter((p) => ids.has(p.id));
}
