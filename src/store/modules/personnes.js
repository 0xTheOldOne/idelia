/**
 * Module Vuex — personnes (équipe).
 *
 * State shape (feature 002) : `{ items: [] }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * CRUD (feature 004) : les mutations restent **fines** (aucune logique
 * métier ni horodatage) ; la construction/normalisation d'une personne vit
 * dans le domaine (`src/domain/personnes.js`, `creerPersonne`), les
 * horodatages techniques (`updatedAt`) sont posés dans les actions.
 *
 * Souhaits & préférences (feature 005) : les `Preference` vivent **dans**
 * la personne (`personne.preferences`, tableau). Éditer une préférence =
 * mettre à jour la personne (patch `{ preferences: <nouveau tableau>,
 * updatedAt }`) via la mutation `UPDATE` existante — aucune nouvelle
 * mutation nécessaire. La construction/normalisation d'une préférence vit
 * dans le domaine (`src/domain/preferences.js`, `creerPreference`).
 */
import { creerPersonne } from '@/domain/personnes.js';
import { creerPreference } from '@/domain/preferences.js';

export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    byId: (state) => (id) => state.items.find((p) => p.id === id),
    actifs: (state) => state.items.filter((p) => p.actif),
    inactifs: (state) => state.items.filter((p) => p.actif === false),
    /**
     * Renvoie le tableau de préférences d'une personne (ou `[]` si la
     * personne est introuvable). Le tri d'affichage n'est pas fait ici
     * (présentation, laissée à l'écran).
     * @param {{}} state
     * @param {object} getters
     * @returns {(id: string) => object[]}
     */
    preferencesDe: (state, getters) => (id) => getters.byId(id)?.preferences ?? [],
  },
  mutations: {
    /**
     * Remplace intégralement la collection de personnes (hydratation).
     * @param {{ items: object[] }} state
     * @param {object[]} items - `Personne[]` (voir 02-modele-de-domaine.md).
     */
    REPLACE(state, items) {
      state.items = items;
    },
    /**
     * Ajoute une personne complète et déjà normalisée à la collection.
     * @param {{ items: object[] }} state
     * @param {object} personne - `Personne` complète (voir `creerPersonne`).
     */
    ADD(state, personne) {
      state.items.push(personne);
    },
    /**
     * Fusion immuable par id : remplace l'élément d'`id` donné par
     * `{ ...ancien, ...patch }`. Ne fait rien si l'id est introuvable.
     * @param {{ items: object[] }} state
     * @param {{ id: string, patch: object }} payload
     */
    UPDATE(state, { id, patch }) {
      const index = state.items.findIndex((p) => p.id === id);
      if (index === -1) return;
      state.items.splice(index, 1, { ...state.items[index], ...patch });
    },
  },
  actions: {
    /**
     * Crée une nouvelle personne à partir de champs partiels (formulaire) et
     * l'ajoute à la collection. La construction/normalisation est déléguée
     * au domaine (`creerPersonne`).
     * @param {{ commit: Function }} context
     * @param {object} champs - Champs partiels d'une Personne.
     */
    ajouter({ commit }, champs) {
      commit('ADD', creerPersonne(champs));
    },
    /**
     * Met à jour une personne existante par fusion immuable d'un patch
     * partiel, en rafraîchissant `updatedAt` (horodatage technique ISO UTC,
     * ADR 0010). Ne touche jamais `id`, `createdAt`, `preferences` (absents
     * de `champs`).
     * @param {{ commit: Function }} context
     * @param {{ id: string }} payload - `{ id, ...champs }`.
     */
    modifier({ commit }, { id, ...champs }) {
      commit('UPDATE', { id, patch: { ...champs, updatedAt: new Date().toISOString() } });
    },
    /**
     * Archive une personne (soft-delete) : `actif` passe à `false`. La
     * personne n'est jamais supprimée physiquement (référençable par
     * l'historique des plannings).
     * @param {{ commit: Function }} context
     * @param {string} id
     */
    desactiver({ commit }, id) {
      commit('UPDATE', { id, patch: { actif: false, updatedAt: new Date().toISOString() } });
    },
    /**
     * Restaure une personne archivée : `actif` repasse à `true`.
     * @param {{ commit: Function }} context
     * @param {string} id
     */
    reactiver({ commit }, id) {
      commit('UPDATE', { id, patch: { actif: true, updatedAt: new Date().toISOString() } });
    },
    /**
     * Ajoute une préférence à une personne. Ne fait rien si la personne est
     * introuvable. La construction/normalisation est déléguée au domaine
     * (`creerPreference`) ; recomposition immuable de `preferences`.
     * @param {{ commit: Function, getters: Object }} context
     * @param {{ personneId: string }} payload - `{ personneId, ...champs }` d'une Preference.
     */
    ajouterPreference({ commit, getters }, { personneId, ...champs }) {
      const personne = getters.byId(personneId);
      if (!personne) return;
      const preference = creerPreference(champs);
      commit('UPDATE', {
        id: personneId,
        patch: { preferences: [...personne.preferences, preference], updatedAt: new Date().toISOString() },
      });
    },
    /**
     * Modifie une préférence existante d'une personne : recompose
     * `preferences` en remplaçant l'élément ciblé par une version
     * renormalisée (via `creerPreference`), en préservant `id`/`createdAt`.
     * Rafraîchit `updatedAt` de la préférence **et** de la personne.
     * @param {{ commit: Function, getters: Object }} context
     * @param {{ personneId: string, preferenceId: string }} payload - `{ personneId, preferenceId, ...champs }`.
     */
    modifierPreference({ commit, getters }, { personneId, preferenceId, ...champs }) {
      const personne = getters.byId(personneId);
      if (!personne) return;
      const preferences = personne.preferences.map((ancienne) =>
        ancienne.id === preferenceId
          ? creerPreference({ ...ancienne, ...champs, id: preferenceId, createdAt: ancienne.createdAt })
          : ancienne
      );
      commit('UPDATE', { id: personneId, patch: { preferences, updatedAt: new Date().toISOString() } });
    },
    /**
     * Supprime physiquement une préférence d'une personne (objet-valeur
     * imbriqué, non référencé : pas de soft-delete nécessaire ici).
     * @param {{ commit: Function, getters: Object }} context
     * @param {{ personneId: string, preferenceId: string }} payload
     */
    supprimerPreference({ commit, getters }, { personneId, preferenceId }) {
      const personne = getters.byId(personneId);
      if (!personne) return;
      const preferences = personne.preferences.filter((p) => p.id !== preferenceId);
      commit('UPDATE', { id: personneId, patch: { preferences, updatedAt: new Date().toISOString() } });
    },
    /**
     * Bascule `actif` d'une préférence (mise en pause / reprise), sans la
     * supprimer. Rafraîchit `updatedAt` de la préférence et de la personne.
     * @param {{ commit: Function, getters: Object }} context
     * @param {{ personneId: string, preferenceId: string }} payload
     */
    basculerPreference({ commit, getters }, { personneId, preferenceId }) {
      const personne = getters.byId(personneId);
      if (!personne) return;
      const maintenant = new Date().toISOString();
      const preferences = personne.preferences.map((p) =>
        p.id === preferenceId ? { ...p, actif: !p.actif, updatedAt: maintenant } : p
      );
      commit('UPDATE', { id: personneId, patch: { preferences, updatedAt: maintenant } });
    },
  },
};
