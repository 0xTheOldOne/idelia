/**
 * Module Vuex — personnes (équipe).
 *
 * State shape (feature 002) : `{ items: [] }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * Les actions CRUD (ajouter/modifier/désactiver une personne, gestion des
 * préférences) sont différées à la feature 004.
 */
export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    byId: (state) => (id) => state.items.find((p) => p.id === id),
    actifs: (state) => state.items.filter((p) => p.actif),
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
  },
  actions: {},
};
