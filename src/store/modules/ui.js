import { storageRepository } from '@/storage/storageRepository.js';
import { normaliserPreferenceTheme, resoudreTheme } from '@/domain/theme.js';
import { ecouterThemeSysteme, systemePrefereSombre } from '@/adaptateurs/themeNavigateur.js';

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
 * `preferenceTheme`/`systemeSombre` (feature 0038, ADR 0022) : préférence de
 * thème (`AUTO`, `CLAIR`, `SOMBRE`), sur le même modèle que `menuReplie` —
 * état volatil en mémoire, reflété sur son propre canal `storageRepository`
 * (clé `idelia:prefs-theme`). `systemeSombre` est le reflet volatil de
 * `prefers-color-scheme: dark` (jamais persisté, conservé par `REINITIALISER`).
 * Le getter `themeEffectif` (`CLAIR`/`SOMBRE`) est appliqué sur `<html>` par
 * `src/main.js`.
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
 * `src/store/index.js`. **Volatils, jamais persistés** : le handle est
 * mémorisé dans IndexedDB par `storageRepository` (feature 0032, ADR 0021) ;
 * ces reflets restent volatils et sont recalculés à chaque démarrage par
 * l'action racine `reprendreSauvegardeFichier`.
 *
 * `fichierSauvegardeMemorise`/`fichierEnAttenteAccord`/`bandeauRepriseMasque`/
 * `fichierSauvegardeIntrouvable` (feature 0032) : reflets volatils de la
 * mémorisation du fichier (texte « Idelia s'en souviendra »), du fichier en
 * attente d'accord du navigateur (bandeau de reprise), du masquage du
 * bandeau pour la session et du fichier introuvable (fenêtre d'avertissement).
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

/** Garde : l'écoute du thème de l'ordinateur n'est branchée qu'une seule fois. */
let ecouteThemeBranchee = false;

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

/** @returns {object} État initial du module (aussi utilisé par `REINITIALISER`). */
function etatInitial() {
  return {
    dernierExportLe: null,
    menuReplie: false,
    preferenceTheme: 'AUTO',
    systemeSombre: false,
    sauvegardeAutoActive: false,
    sauvegardeAutoIntervalleMinutes: 15,
    fichierSauvegardeActif: false,
    nomFichierSauvegarde: null,
    dernierFichierEnregistreLe: null,
    fichierSauvegardeMemorise: false,
    fichierEnAttenteAccord: null,
    bandeauRepriseMasque: false,
    fichierSauvegardeIntrouvable: null,
  };
}

export default {
  namespaced: true,
  state: etatInitial,
  getters: {
    menuReplie: (state) => state.menuReplie,
    preferenceTheme: (state) => state.preferenceTheme,
    themeEffectif: (state) => resoudreTheme(state.preferenceTheme, state.systemeSombre),
  },
  mutations: {
    SET_DERNIER_EXPORT(state, iso) {
      state.dernierExportLe = iso;
    },
    SET_MENU_REPLIE(state, valeur) {
      state.menuReplie = valeur;
    },
    SET_PREFERENCE_THEME(state, preference) {
      state.preferenceTheme = preference;
    },
    SET_SYSTEME_SOMBRE(state, booleen) {
      state.systemeSombre = booleen;
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
    SET_FICHIER_SAUVEGARDE_MEMORISE(state, valeur) {
      state.fichierSauvegardeMemorise = valeur;
    },
    SET_FICHIER_EN_ATTENTE_ACCORD(state, nom) {
      state.fichierEnAttenteAccord = nom;
    },
    SET_BANDEAU_REPRISE_MASQUE(state, valeur) {
      state.bandeauRepriseMasque = valeur;
    },
    SET_FICHIER_SAUVEGARDE_INTROUVABLE(state, nom) {
      state.fichierSauvegardeIntrouvable = nom;
    },
    /**
     * Remet tout l'état du module à ses valeurs initiales, sauf
     * `systemeSombre` qui reflète l'ordinateur et non une préférence.
     */
    REINITIALISER(state) {
      const { systemeSombre } = state;
      Object.assign(state, etatInitial(), { systemeSombre });
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
     * Masque le bandeau de reprise de la sauvegarde pour la session
     * (« Plus tard »).
     * @param {import('vuex').ActionContext} context
     */
    masquerBandeauReprise({ commit }) {
      commit('SET_BANDEAU_REPRISE_MASQUE', true);
    },

    /**
     * Ferme la fenêtre « fichier de sauvegarde introuvable ».
     * @param {import('vuex').ActionContext} context
     */
    acquitterFichierIntrouvable({ commit }) {
      commit('SET_FICHIER_SAUVEGARDE_INTROUVABLE', null);
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
     * Restitue la préférence de thème mémorisée, lit le réglage de
     * l'ordinateur et branche (une seule fois) l'écoute de ses changements.
     * Appelée au démarrage (`src/main.js`), avant le montage.
     * @param {import('vuex').ActionContext} context
     */
    initialiserTheme({ commit }) {
      commit('SET_SYSTEME_SOMBRE', systemePrefereSombre());
      commit('SET_PREFERENCE_THEME', normaliserPreferenceTheme(storageRepository.lirePreferenceTheme()));
      if (!ecouteThemeBranchee) {
        ecouteThemeBranchee = true;
        ecouterThemeSysteme((sombre) => commit('SET_SYSTEME_SOMBRE', sombre));
      }
    },

    /**
     * Change la préférence de thème (valeur normalisée) et la mémorise via
     * `storageRepository` (canal dédié, hors `SaveDocument`).
     * @param {import('vuex').ActionContext} context
     * @param {string} preference - `'AUTO'`, `'CLAIR'` ou `'SOMBRE'`.
     */
    choisirTheme({ commit }, preference) {
      const valeur = normaliserPreferenceTheme(preference);
      commit('SET_PREFERENCE_THEME', valeur);
      storageRepository.enregistrerPreferenceTheme(valeur);
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
      commit('REINITIALISER');
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
