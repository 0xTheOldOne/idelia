/**
 * Fabrique interne d'`Affectation`, réservée au moteur de planification.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Seules concessions techniques tolérées (comme dans `schema.js`/
 * `personnes.js`/`tournees.js`/`absences.js`) : `genId()` pour l'identifiant
 * et `new Date().toISOString()` pour les horodatages.
 *
 * `creerAffectationAuto` est la **seule** façon dont le glouton et la
 * recherche locale créent une `Affectation` — garantit que toute sortie du
 * moteur est déjà conforme à la forme canonique (voir
 * docs/architecture/02-modele-de-domaine.md §Affectation), sans
 * transformation ultérieure nécessaire côté `010`.
 */

import { genId } from '@/domain/utils/id.js';

/**
 * @typedef {Object} Affectation
 * @property {string} id - Identifiant unique, immuable.
 * @property {string} personneId - Référence à une Personne.
 * @property {string} tourneeId - Référence à une Tournee.
 * @property {string} date - Date `"YYYY-MM-DD"`.
 * @property {string} creneau - `'MATIN'`, `'APRES_MIDI'` ou `'JOURNEE'` (voir `CRENEAUX`).
 * @property {string} origine - `'AUTO'` (posée par le moteur) ou `'MANUEL'`.
 * @property {boolean} verrouillee - `true` = préservée telle quelle lors d'une régénération.
 * @property {string} commentaire - Commentaire libre, facultatif (chaîne vide par défaut).
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * Construit une `Affectation` posée automatiquement par le moteur
 * (`origine: 'AUTO'`, `verrouillee: false`, `commentaire: ''`).
 *
 * @param {string} personneId - Identifiant de la Personne affectée.
 * @param {string} tourneeId - Identifiant de la Tournee.
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @param {string} creneau - Créneau (`CRENEAUX`).
 * @returns {Affectation} Affectation complète, prête à être stockée.
 */
export function creerAffectationAuto(personneId, tourneeId, date, creneau) {
  const maintenant = new Date().toISOString();

  return {
    id: genId(),
    personneId,
    tourneeId,
    date,
    creneau,
    origine: 'AUTO',
    verrouillee: false,
    commentaire: '',
    createdAt: maintenant,
    updatedAt: maintenant,
  };
}
