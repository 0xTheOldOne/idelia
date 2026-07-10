import { genId } from '@/domain/utils/id.js';

/**
 * Module Vuex — notifications (feature 0018).
 *
 * État **volatile**, jamais persisté (comme `ui`, voir `src/store/modules/ui.js`
 * et la garde dédiée dans `src/store/index.js`). Sert de « bus de messages » :
 * n'importe quel module de store ou composant peut émettre un toast via
 * `dispatch('notifications/notifier', {...})`, sans import ni couplage direct
 * au composant d'affichage (`PileNotifications.vue`, qui lit `state.items` de
 * façon réactive).
 *
 * Volontairement **aucune mutation `REPLACE`** ici : ce module n'est jamais
 * hydraté depuis le `SaveDocument` ni inclus dans `REPLACE_ALL` (voir
 * `src/store/index.js`), et le plugin de persistance ignore toute mutation
 * `notifications/*`.
 */

/** Types valides d'un toast ; toute valeur hors de cette liste retombe sur 'info'. */
const TYPES_VALIDES = ['succes', 'info', 'avertissement', 'erreur'];

/** Durées d'affichage par défaut (ms) avant disparition automatique. */
const DUREE_PAR_DEFAUT = {
  succes: 4500,
  info: 4500,
  avertissement: 6000,
  erreur: 8000,
};

/**
 * Minuteurs de disparition automatique, indexés par id de toast — variable
 * **de module** (comme `timer`/`handleFichierSauvegarde` dans
 * `src/store/index.js`) : un `setTimeout` n'est pas sérialisable, il ne doit
 * donc jamais vivre dans `state`. Permet de suspendre puis relancer le
 * minuteur d'un toast précis (pause au survol/focus, revue features
 * 0018/0019 §3) sans perdre sa référence.
 * @type {Map<string, ReturnType<typeof setTimeout>>}
 */
const minuteurs = new Map();

export default {
  namespaced: true,
  state: () => ({ items: [] }),
  mutations: {
    AJOUTER(state, toast) {
      state.items.push(toast);
    },
    RETIRER(state, id) {
      state.items = state.items.filter((t) => t.id !== id);
      const minuteur = minuteurs.get(id);
      if (minuteur) {
        clearTimeout(minuteur);
        minuteurs.delete(id);
      }
    },
  },
  actions: {
    /**
     * Émet un toast. C'est le seul point d'entrée du « bus de messages » :
     * n'importe quel module de store ou composant peut l'appeler.
     * @param {import('vuex').ActionContext} context
     * @param {{ type?: string, message: string, duree?: number }} payload
     *   `duree` en ms ; `0` = ne disparaît jamais tout seul (fermeture manuelle
     *   uniquement). Absent : durée par défaut selon `type`.
     * @returns {string|null} L'id du toast créé, ou `null` si `message` est vide.
     */
    notifier({ commit }, { type = 'info', message, duree } = {}) {
      if (!message) return null;
      const typeFinal = TYPES_VALIDES.includes(type) ? type : 'info';
      const id = genId();
      const dureeMs = duree ?? DUREE_PAR_DEFAUT[typeFinal];
      // `duree` est mémorisée sur le toast pour pouvoir relancer un minuteur
      // identique après une pause (`reprendre`).
      commit('AJOUTER', { id, type: typeFinal, message, duree: dureeMs });
      if (dureeMs > 0) {
        minuteurs.set(id, setTimeout(() => commit('RETIRER', id), dureeMs));
      }
      return id;
    },
    /** Ferme un toast manuellement (clic sur la croix). */
    retirer({ commit }, id) {
      commit('RETIRER', id);
    },
    /**
     * Met en pause le minuteur de disparition d'un toast (survol/focus),
     * sans le retirer de l'affichage : `clearTimeout` seul, le toast reste
     * dans `state.items` jusqu'à `reprendre` ou une fermeture manuelle.
     * Tolérant si le toast n'a pas (ou plus) de minuteur en cours.
     * @param {import('vuex').ActionContext} context
     * @param {string} id
     */
    suspendre({}, id) {
      const minuteur = minuteurs.get(id);
      if (!minuteur) return;
      clearTimeout(minuteur);
      minuteurs.delete(id);
    },
    /**
     * Relance le minuteur de disparition d'un toast après une pause
     * (`suspendre`). Tolérant si le toast a déjà disparu entre-temps (fermé
     * manuellement pendant le survol, par exemple) ou n'a pas de durée
     * (`duree` à `0`, fermeture manuelle uniquement).
     * @param {import('vuex').ActionContext} context
     * @param {string} id
     */
    reprendre({ commit, state }, id) {
      const toast = state.items.find((t) => t.id === id);
      if (!toast || !(toast.duree > 0)) return;
      minuteurs.set(id, setTimeout(() => commit('RETIRER', id), toast.duree));
    },
  },
};
