/**
 * Module Vuex — tournées.
 *
 * State shape (feature 002) : `{ items: [] }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * Les actions CRUD (ajouter/modifier/archiver une tournée) sont différées
 * à la feature 006.
 */
export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    byId: (state) => (id) => state.items.find((t) => t.id === id),
    actives: (state) => state.items.filter((t) => !t.archivee),
  },
  mutations: {
    /**
     * Remplace intégralement la collection de tournées (hydratation).
     * @param {{ items: object[] }} state
     * @param {object[]} items - `Tournee[]` (voir 02-modele-de-domaine.md).
     */
    REPLACE(state, items) {
      state.items = items;
    },
  },
  actions: {},
};
