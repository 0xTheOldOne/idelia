/**
 * Module Vuex — cabinet.
 *
 * State shape (feature 0002) : `{ parametres: null }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * Action `majParametres` (feature 0003) : met à jour les paramètres via une
 * fusion immuable, en réutilisant la mutation `REPLACE` (aucune nouvelle
 * mutation).
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
  actions: {
    /**
     * Met à jour les paramètres du cabinet par fusion immuable d'un patch
     * partiel sur les paramètres courants, en rafraîchissant `updatedAt`
     * (horodatage technique ISO UTC, ADR 0010). Les champs non présents
     * dans `patch` (dont `couleursParDefaut`) sont préservés.
     *
     * Réutilise la mutation `REPLACE` existante ; aucune nouvelle mutation.
     *
     * @param {{ commit: Function, getters: object }} context
     * @param {object} patch - Sous-ensemble de `ParametresCabinet` à modifier.
     */
    majParametres({ commit, getters }, patch) {
      commit('REPLACE', {
        ...getters.parametres,
        ...patch,
        updatedAt: new Date().toISOString(),
      });
    },
  },
};
