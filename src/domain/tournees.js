/**
 * Fabrique & normalisation d'une Tournee.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Seules concessions techniques tolérées (comme dans `schema.js`/`personnes.js`) :
 * `genId()` pour l'identifiant et `new Date().toISOString()` pour les
 * horodatages.
 */

import { CRENEAUX, COULEURS_PAR_DEFAUT } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';

/**
 * @typedef {Object} Tournee
 * @property {string} id - Identifiant unique, immuable.
 * @property {string} nom
 * @property {string} code - Code court d'affichage, facultatif (chaîne vide sinon).
 * @property {string} secteur - Zone géographique, facultative (chaîne vide sinon).
 * @property {string} creneau - `'MATIN'`, `'APRES_MIDI'` ou `'JOURNEE'` (voir {@link CRENEAUX}).
 * @property {string} heureDebut - Heure de début `"HH:mm"`.
 * @property {string} heureFin - Heure de fin `"HH:mm"`.
 * @property {number[]} joursApplication - Jours ISO 1..7 où la tournée s'applique, triés et dédupliqués.
 * @property {number} nbPersonnesRequises - Effectif requis, entier ≥ 1.
 * @property {string} couleur - Couleur de repère au format hex `#RRGGBB`.
 * @property {boolean} archivee - Soft-delete : `true` = archivée.
 * @property {(string|null)} dateDebutValidite - Date `"YYYY-MM-DD"`, ou `null`.
 * @property {(string|null)} dateFinValidite - Date `"YYYY-MM-DD"`, ou `null`.
 * @property {(number|null)} ordreAffichage - Réordonnancement manuel (non édité en 0006).
 * @property {string} notes
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * Coerce une valeur en liste de jours ISO 8601 valides (1..7), triée et
 * dédupliquée. Tolère les valeurs manquantes/invalides (ignorées). Même
 * logique que le helper homonyme de `preferences.js`.
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
 * Construit une `Tournee` complète et normalisée à partir d'un objet
 * partiel (typiquement les champs saisis dans un formulaire), en appliquant
 * les valeurs par défaut et en générant les champs techniques.
 *
 * La cohérence `heureFin > heureDebut` et `dateFinValidite ≥
 * dateDebutValidite` est portée par le formulaire (Vuelidate), pas par cette
 * fabrique : elle ne garantit que la normalisation structurelle.
 *
 * @param {Object} [champs] - Champs partiels d'une Tournee.
 * @returns {Tournee} Tournee complète, prête à être stockée.
 */
export function creerTournee(champs = {}) {
  const maintenant = new Date().toISOString();

  return {
    id: champs.id ?? genId(),
    nom: String(champs.nom ?? '').trim(),
    code: String(champs.code ?? '').trim(),
    secteur: String(champs.secteur ?? '').trim(),
    creneau: champs.creneau ?? CRENEAUX[0],
    heureDebut: champs.heureDebut ?? '',
    heureFin: champs.heureFin ?? '',
    joursApplication: normaliserJours(champs.joursApplication),
    nbPersonnesRequises: champs.nbPersonnesRequises ?? 1,
    couleur: champs.couleur ?? COULEURS_PAR_DEFAUT[0],
    archivee: champs.archivee ?? false,
    dateDebutValidite: champs.dateDebutValidite ?? null,
    dateFinValidite: champs.dateFinValidite ?? null,
    ordreAffichage: champs.ordreAffichage ?? null,
    notes: champs.notes ?? '',
    createdAt: champs.createdAt ?? maintenant,
    updatedAt: maintenant,
  };
}
