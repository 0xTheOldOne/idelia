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
 */
import { creerPersonne } from '@/domain/personnes.js';

export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    byId: (state) => (id) => state.items.find((p) => p.id === id),
    actifs: (state) => state.items.filter((p) => p.actif),
    inactifs: (state) => state.items.filter((p) => p.actif === false),
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
  },
};
