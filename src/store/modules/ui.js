import { storageRepository } from '@/storage/storageRepository.js';

/**
 * Module Vuex — ui.
 *
 * État d'interface **volatile**, non persisté (contrairement aux autres
 * modules, voir ADR 0005 et §4.2/4.3 de la feature 0002). State minimal
 * pour l'instant : sera enrichi par les features consommatrices (mode
 * d'affichage, filtres, drag & drop, ouverture de panneaux…).
 *
 * Volontairement **aucune mutation `REPLACE`** ici : ce module n'est
 * jamais hydraté depuis le `SaveDocument` ni inclus dans `REPLACE_ALL`
 * (voir `src/store/index.js`), et le plugin de persistance ignore toute
 * mutation `ui/*`.
 *
 * `dernierExportLe` (feature 0008) : suivi **volatil** du dernier export
 * (« Enregistrer une sauvegarde ») lancé durant la session courante, pour
 * alimenter le rappel de sauvegarde de `BlocSauvegarde`. Distinct de
 * `derniereSauvegarde` (racine, dernière écriture locale automatique) :
 * confondre les deux tromperait l'utilisateur. `null` au démarrage et
 * après chaque rechargement (assumé, voir feature 0008 §12) ; jamais
 * persisté, jamais inclus dans le fichier exporté.
 *
 * `menuReplie` (feature 0015) : préférence d'affichage du menu latéral
 * (déplié/replié). En mémoire c'est de l'état **volatil** comme le reste
 * de ce module (donc absent de `REPLACE_ALL`/du plugin de persistance),
 * mais elle est **reflétée** sur un canal dédié de `storageRepository`
 * (clé `idelia:prefs-ui`, distincte du `SaveDocument`) afin de survivre au
 * rechargement sans jamais entrer dans la sauvegarde métier (§4.2 de la
 * feature 0015).
 */
export default {
  namespaced: true,
  state: () => ({
    dernierExportLe: null,
    menuReplie: false,
  }),
  getters: {
    menuReplie: (state) => state.menuReplie,
  },
  mutations: {
    SET_DERNIER_EXPORT(state, iso) {
      state.dernierExportLe = iso;
    },
    SET_MENU_REPLIE(state, valeur) {
      state.menuReplie = valeur;
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

    /**
     * Bascule l'état déplié/replié du menu latéral et mémorise
     * immédiatement le nouveau choix via `storageRepository` (canal dédié,
     * hors `SaveDocument`).
     * @param {import('vuex').ActionContext} context
     */
    basculerMenu({ commit, getters }) {
      const nouvelleValeur = !getters.menuReplie;
      commit('SET_MENU_REPLIE', nouvelleValeur);
      storageRepository.enregistrerPreferenceMenuReplie(nouvelleValeur);
    },

    /**
     * Restitue la préférence de repli du menu mémorisée précédemment.
     * Appelée au démarrage (`src/main.js`), **avant** le montage de
     * l'application, pour appliquer la préférence dès le premier rendu.
     * @param {import('vuex').ActionContext} context
     */
    initialiserMenu({ commit }) {
      commit('SET_MENU_REPLIE', storageRepository.lirePreferenceMenuReplie());
    },
  },
};
