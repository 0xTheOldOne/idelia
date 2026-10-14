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
 *
 * `sauvegardeAutoActive`/`sauvegardeAutoIntervalleMinutes` (feature 0019) :
 * préférence « sauvegarde automatique », sur le même modèle que
 * `menuReplie` — état volatil en mémoire, reflété sur son propre canal
 * `storageRepository` (clé `idelia:prefs-sauvegarde-auto`, distincte à la
 * fois du `SaveDocument` et de `idelia:prefs-ui`).
 *
 * `fichierSauvegardeActif`/`nomFichierSauvegarde`/`dernierFichierEnregistreLe`
 * (feature 0019, ADR 0018) : reflètent l'état du « fichier de sauvegarde
 * actif » (File System Access API, Chrome/Edge uniquement), dont le handle
 * réel (non sérialisable) vit en variable de module dans
 * `src/store/index.js`. **Volatils, jamais persistés** : après un
 * rechargement de page, `fichierSauvegardeActif` redevient `false` (le
 * handle ne survit pas à la session, choix assumé de l'ADR 0018).
 *
 * Le minuteur de sauvegarde automatique dispatche désormais l'action racine
 * `declencherSauvegardeAutomatique` (`src/store/index.js`) à chaque tick :
 * elle écrit silencieusement dans le fichier actif s'il y en a un, sinon se
 * contente du rappel (toast d'avertissement).
 */

/**
 * Identifiant du minuteur de rappel/sauvegarde automatique en cours, variable
 * **de module** (comme `timer` dans `src/store/index.js`) : un `setInterval`
 * n'est pas une donnée sérialisable, il ne doit donc jamais vivre dans
 * `state`.
 * @type {ReturnType<typeof setInterval>|null}
 */
let minuteur = null;

/**
 * (Ré)arme le minuteur de sauvegarde automatique : annule le précédent s'il y
 * en a un, puis programme un nouveau tick toutes les `intervalleMinutes`
 * minutes. Chaque tick dispatche l'action racine
 * `declencherSauvegardeAutomatique` (`src/store/index.js`), qui décide
 * elle-même s'il faut écrire silencieusement dans le fichier actif ou se
 * contenter d'un rappel (toast) — ce module ne connaît pas ce détail.
 *
 * @param {import('vuex').ActionContext} context
 * @param {number} intervalleMinutes
 */
function armerMinuteur({ dispatch }, intervalleMinutes) {
  clearInterval(minuteur);
  minuteur = setInterval(() => {
    dispatch('declencherSauvegardeAutomatique', null, { root: true });
  }, intervalleMinutes * 60000);
}

/** Désarme le minuteur de sauvegarde automatique, s'il est actif. */
function desarmerMinuteur() {
  clearInterval(minuteur);
  minuteur = null;
}

export default {
  namespaced: true,
  state: () => ({
    dernierExportLe: null,
    menuReplie: false,
    sauvegardeAutoActive: false,
    sauvegardeAutoIntervalleMinutes: 15,
    fichierSauvegardeActif: false,
    nomFichierSauvegarde: null,
    dernierFichierEnregistreLe: null,
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
    SET_SAUVEGARDE_AUTO(state, { active, intervalleMinutes }) {
      state.sauvegardeAutoActive = active;
      state.sauvegardeAutoIntervalleMinutes = intervalleMinutes;
    },
    SET_FICHIER_SAUVEGARDE_ACTIF(state, { actif, nom }) {
      state.fichierSauvegardeActif = actif;
      state.nomFichierSauvegarde = nom;
    },
    SET_DERNIER_FICHIER_ENREGISTRE(state, iso) {
      state.dernierFichierEnregistreLe = iso;
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

    /**
     * Restitue la préférence de sauvegarde automatique mémorisée
     * précédemment et arme le minuteur si elle est active. Appelée au
     * démarrage (`src/main.js`), comme `initialiserMenu`.
     * @param {import('vuex').ActionContext} context
     */
    initialiserSauvegardeAuto({ commit, dispatch }) {
      const preference = storageRepository.lirePreferenceSauvegardeAuto();
      commit('SET_SAUVEGARDE_AUTO', preference);
      if (preference.active) {
        armerMinuteur({ dispatch }, preference.intervalleMinutes);
      }
    },

    /**
     * Remet les préférences d'interface à leurs valeurs par défaut (après
     * « Effacer toutes les données », qui supprime aussi leurs clés de
     * stockage) et désarme le minuteur. N'écrit rien dans le stockage.
     * @param {import('vuex').ActionContext} context
     */
    reinitialiserPreferences({ commit }) {
      desarmerMinuteur();
      commit('SET_MENU_REPLIE', false);
      commit('SET_SAUVEGARDE_AUTO', { active: false, intervalleMinutes: 15 });
      commit('SET_FICHIER_SAUVEGARDE_ACTIF', { actif: false, nom: null });
      commit('SET_DERNIER_FICHIER_ENREGISTRE', null);
      commit('SET_DERNIER_EXPORT', null);
    },

    /**
     * Change le réglage de sauvegarde automatique (activation et/ou
     * fréquence) : mémorise le nouveau choix via `storageRepository` (canal
     * dédié, hors `SaveDocument`), puis réarme ou désarme le minuteur en
     * conséquence.
     * @param {import('vuex').ActionContext} context
     * @param {{ active: boolean, intervalleMinutes: number }} payload
     */
    configurerSauvegardeAuto({ commit, dispatch }, { active, intervalleMinutes }) {
      commit('SET_SAUVEGARDE_AUTO', { active, intervalleMinutes });
      storageRepository.enregistrerPreferenceSauvegardeAuto({ active, intervalleMinutes });
      if (active) {
        armerMinuteur({ dispatch }, intervalleMinutes);
      } else {
        desarmerMinuteur();
      }
    },
  },
};
