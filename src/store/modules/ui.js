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
 *
 * `dernierExportLe` (feature 008) : suivi **volatil** du dernier export
 * (« Enregistrer une sauvegarde ») lancé durant la session courante, pour
 * alimenter le rappel de sauvegarde de `BlocSauvegarde`. Distinct de
 * `derniereSauvegarde` (racine, dernière écriture locale automatique) :
 * confondre les deux tromperait l'utilisateur. `null` au démarrage et
 * après chaque rechargement (assumé, voir feature 008 §12) ; jamais
 * persisté, jamais inclus dans le fichier exporté.
 */
export default {
  namespaced: true,
  state: () => ({
    dernierExportLe: null,
  }),
  getters: {},
  mutations: {
    SET_DERNIER_EXPORT(state, iso) {
      state.dernierExportLe = iso;
    },
  },
  actions: {
    /**
     * Marque un export (« Enregistrer une sauvegarde ») comme effectué à
     * l'instant présent. Horodatage posé ici (jamais dans un composant).
     * @param {import('vuex').ActionContext} context
     */
    enregistrerExport({ commit }) {
      commit('SET_DERNIER_EXPORT', new Date().toISOString());
    },
  },
};
