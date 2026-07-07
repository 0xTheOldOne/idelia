/**
 * Module Vuex — absences & congés.
 *
 * State shape (feature 002) : `{ items: [] }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * Les actions CRUD (ajouter/modifier une absence, changer son statut) sont
 * différées à la feature 007.
 */
export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    byId: (state) => (id) => state.items.find((a) => a.id === id),
    parPersonne: (state) => (personneId) =>
      state.items.filter((a) => a.personneId === personneId),
  },
  mutations: {
    /**
     * Remplace intégralement la collection d'absences (hydratation).
     * @param {{ items: object[] }} state
     * @param {object[]} items - `Absence[]` (voir 02-modele-de-domaine.md).
     */
    REPLACE(state, items) {
      state.items = items;
    },
  },
  actions: {},
};
