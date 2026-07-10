/**
 * Fabrique & normalisation d'une Personne (équipe).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Seules concessions techniques tolérées (comme dans `schema.js`) : `genId()`
 * pour l'identifiant et `new Date().toISOString()` pour les horodatages.
 */

import { STATUTS_PERSONNE, COULEURS_PAR_DEFAUT } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';

/**
 * @typedef {Object} ContactPersonne
 * @property {string|null} email
 * @property {string|null} telephone
 */

/**
 * @typedef {Object} Personne
 * @property {string} id - Identifiant unique, immuable.
 * @property {string} prenom
 * @property {string} nom
 * @property {string} statut - `'TITULAIRE'` ou `'REMPLACANT'` (voir {@link STATUTS_PERSONNE}).
 * @property {boolean} actif - Soft-delete : `false` = archivée.
 * @property {string} couleur - Couleur de repère au format hex `#RRGGBB`.
 * @property {number} quotite - Temps de travail, 0..100 (%).
 * @property {(string|null)} dateEntree - Date d'arrivée `"YYYY-MM-DD"`, ou `null`.
 * @property {(string|null)} dateSortie - Date de départ `"YYYY-MM-DD"`, ou `null`.
 * @property {ContactPersonne} contact
 * @property {string} notes
 * @property {(number|null)} ordreAffichage - Réordonnancement manuel (non édité en 0004).
 * @property {Array} preferences - `Preference[]`, initialisé vide (édité en 0005).
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * Construit une `Personne` complète et normalisée à partir d'un objet
 * partiel (typiquement les champs saisis dans un formulaire), en appliquant
 * les valeurs par défaut et en générant les champs techniques.
 *
 * Le statut n'est validé que par défaut raisonnable : la fabrique fait
 * confiance à l'appelant (formulaire/Vuelidate) pour ne fournir qu'un code
 * de {@link STATUTS_PERSONNE} valide.
 *
 * @param {Object} [champs] - Champs partiels d'une Personne.
 * @returns {Personne} Personne complète, prête à être stockée.
 */
export function creerPersonne(champs = {}) {
  const maintenant = new Date().toISOString();

  return {
    id: champs.id ?? genId(),
    prenom: String(champs.prenom ?? '').trim(),
    nom: String(champs.nom ?? '').trim(),
    statut: champs.statut ?? STATUTS_PERSONNE[0],
    actif: champs.actif ?? true,
    couleur: champs.couleur ?? COULEURS_PAR_DEFAUT[0],
    quotite: champs.quotite ?? 100,
    dateEntree: champs.dateEntree ?? null,
    dateSortie: champs.dateSortie ?? null,
    contact: {
      email: champs.contact?.email ?? null,
      telephone: champs.contact?.telephone ?? null,
    },
    notes: champs.notes ?? '',
    ordreAffichage: champs.ordreAffichage ?? null,
    preferences: champs.preferences ?? [],
    createdAt: champs.createdAt ?? maintenant,
    updatedAt: maintenant,
  };
}
