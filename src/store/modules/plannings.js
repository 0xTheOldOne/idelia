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
 * Génération (feature 010) : l'appel au moteur pur (`@/domain/scheduling`)
 * passe **uniquement** par les actions `genererPropose`/`evaluerCourant`
 * (ADR 0008) ; la construction du `Planning` est déléguée au domaine
 * (`@/domain/planning.js`, `creerPlanning`). Les diagnostics (violations,
 * tournées non couvertes, score) ne sont **jamais** persistés : ils sont
 * retournés à l'appelant (`genererPropose`) ou recalculés à la demande
 * (`evaluerCourant`).
 */
import { genererPlanning, diagnostiquer } from '@/domain/scheduling';
import { creerPlanning } from '@/domain/planning.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Assemble l'`Entree` du moteur (typedef `009 §5.2`) à partir des sources
 * du store, sans logique métier (simple collecte). Le moteur filtre lui-même
 * les tournées applicables et les absences par statut (`009 §5.4`/`§7`).
 * Helper interne, non exporté : factorise `genererPropose`/`evaluerCourant`.
 *
 * @param {Object} rootGetters
 * @param {Object} rootState
 * @param {{ debut: string, fin: string }} periode
 * @returns {import('@/domain/scheduling/modele/types.js').Entree}
 */
function assemblerEntree(rootGetters, rootState, periode) {
  return {
    periode,
    personnes: rootGetters['personnes/actifs'],
    tournees: rootGetters['tournees/actives'],
    absences: rootState.absences.items,
    reglesCabinet: rootGetters['cabinet/parametres'],
  };
}

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
    /**
     * Ajoute un planning complet et déjà normalisé à la collection.
     * @param {{ items: object[] }} state
     * @param {object} planning - `Planning` complet (voir `creerPlanning`).
     */
    ADD(state, planning) {
      state.items.push(planning);
    },
    /**
     * Sélectionne le planning courant (volatil, non persisté).
     * @param {{ selectionId: string|null }} state
     * @param {string|null} id
     */
    SELECT(state, id) {
      state.selectionId = id;
    },
    /**
     * Retire un planning de la collection ; si c'était le planning
     * sélectionné, remet `selectionId` à `null`.
     * @param {{ items: object[], selectionId: string|null }} state
     * @param {string} id
     */
    REMOVE(state, id) {
      state.items = state.items.filter((pl) => pl.id !== id);
      if (state.selectionId === id) {
        state.selectionId = null;
      }
    },
  },
  actions: {
    /**
     * Génère une nouvelle proposition de planning pour la période donnée,
     * la persiste (`BROUILLON`) et la sélectionne. L'appel au moteur pur
     * passe exclusivement par cette action (ADR 0008) ; seul le `Planning`
     * produit est persisté, le `Resultat` (diagnostics) est retourné tel
     * quel à l'appelant, jamais stocké.
     *
     * @param {import('vuex').ActionContext} context
     * @param {{ dateDebut: string, dateFin: string, seed?: number, variante?: number }} payload
     * @returns {import('@/domain/scheduling/modele/types.js').Resultat} Résultat complet du moteur.
     */
    genererPropose({ commit, rootGetters, rootState }, { dateDebut, dateFin, seed = 0, variante = 0 }) {
      const entree = assemblerEntree(rootGetters, rootState, { debut: dateDebut, fin: dateFin });
      const resultat = genererPlanning(entree, { seed, variante });

      const planning = creerPlanning({
        nom: `Planning du ${dateUtil.formatDateFr(dateDebut)} au ${dateUtil.formatDateFr(dateFin)}`,
        dateDebut,
        dateFin,
        affectations: resultat.affectations,
        parametresGeneration: resultat.meta,
      });

      commit('ADD', planning);
      commit('SELECT', planning.id);

      return resultat;
    },
    /**
     * Recalcule les diagnostics (`violations`, `tourneesNonCouvertes`,
     * `score`) du planning courant, sans jamais les stocker ni modifier
     * l'état (lecture seule, aucun `commit`). Sert au rechargement de la
     * page (le `Resultat` volatil issu de `genererPropose` a disparu).
     *
     * @param {import('vuex').ActionContext} context
     * @returns {{violations: import('@/domain/scheduling/modele/types.js').Violation[], tourneesNonCouvertes: import('@/domain/scheduling/modele/types.js').NonCouverture[], score: number}}
     */
    evaluerCourant({ getters, rootGetters, rootState }) {
      const planning = getters.courant;
      if (!planning) {
        return { violations: [], tourneesNonCouvertes: [], score: 0 };
      }

      const entree = assemblerEntree(rootGetters, rootState, {
        debut: planning.dateDebut,
        fin: planning.dateFin,
      });

      return diagnostiquer(planning.affectations, entree);
    },
  },
};
