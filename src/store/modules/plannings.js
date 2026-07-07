/**
 * Module Vuex — plannings.
 *
 * State shape (feature 002) : `{ items: [], selectionId: null }`, hydraté
 * par `app/bootstrap` (voir `src/store/index.js`) via la mutation
 * `REPLACE`. Module **persisté** (voir ADR 0005) pour `items` uniquement :
 * `selectionId` est une sélection volatile, non sérialisée dans le
 * `SaveDocument` (voir `src/domain/schema.js`). Aucun accès `localStorage`
 * ici : la persistance est gérée par le plugin dédié du store racine.
 *
 * Les actions CRUD (planning, affectations, génération) sont différées
 * aux features 009-011.
 */
export default {
  namespaced: true,
  state: () => ({ items: [], selectionId: null }),
  getters: {
    byId: (state) => (id) => state.items.find((pl) => pl.id === id),
    courant: (state, getters) =>
      state.selectionId ? getters.byId(state.selectionId) : null,
  },
  mutations: {
    /**
     * Remplace intégralement la collection de plannings et la sélection
     * courante (hydratation).
     * @param {{ items: object[], selectionId: string|null }} state
     * @param {{ items?: object[], selectionId?: string|null }} payload -
     *   `items` : `Planning[]` (voir 02-modele-de-domaine.md), par défaut `[]`.
     *   `selectionId` : id du planning sélectionné, par défaut `null`.
     */
    REPLACE(state, { items = [], selectionId = null } = {}) {
      state.items = items;
      state.selectionId = selectionId;
    },
  },
  actions: {},
};
