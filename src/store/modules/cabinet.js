/**
 * Module Vuex — cabinet.
 *
 * State shape (feature 002) : `{ parametres: null }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * Les actions CRUD (mise à jour des paramètres du cabinet) sont différées
 * à la feature 003.
 */
export default {
  namespaced: true,
  state: () => ({ parametres: null }),
  getters: {
    parametres: (state) => state.parametres,
  },
  mutations: {
    /**
     * Remplace intégralement les paramètres du cabinet (hydratation).
     * @param {{ parametres: object|null }} state
     * @param {object} parametres - `ParametresCabinet` (voir 02-modele-de-domaine.md).
     */
    REPLACE(state, parametres) {
      state.parametres = parametres;
    },
  },
  actions: {},
};
