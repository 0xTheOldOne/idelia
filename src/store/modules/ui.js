/**
 * Module Vuex — ui.
 *
 * État d'interface **volatile**, non persisté (contrairement aux autres
 * modules, voir ADR 0005 et §4.2/4.3 de la feature 002). State minimal
 * pour l'instant : sera enrichi par les features consommatrices (mode
 * d'affichage, filtres, drag & drop, ouverture de panneaux…).
 *
 * Volontairement **aucune mutation `REPLACE`** ici : ce module n'est
 * jamais hydraté depuis le `SaveDocument` ni inclus dans `REPLACE_ALL`
 * (voir `src/store/index.js`), et le plugin de persistance ignore toute
 * mutation `ui/*`.
 */
export default {
  namespaced: true,
  state: () => ({}),
  getters: {},
  mutations: {},
  actions: {},
};
