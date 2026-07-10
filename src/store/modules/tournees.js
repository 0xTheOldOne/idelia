/**
 * Module Vuex — tournées.
 *
 * State shape (feature 0002) : `{ items: [] }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * CRUD (feature 0006) : les mutations restent **fines** (aucune logique
 * métier ni horodatage) ; la construction/normalisation d'une tournée vit
 * dans le domaine (`src/domain/tournees.js`, `creerTournee`), les
 * horodatages techniques (`updatedAt`) sont posés dans les actions.
 *
 * Convention de soft-delete : `archivee` (`true` = archivée), différente du
 * `Personne.actif` (`false` = archivée) — voir 02-modele-de-domaine.md
 * §Tournee. Le vocabulaire données (`archiver`/`restaurer`, `archivees`)
 * coïncide donc avec le vocabulaire UI.
 */
import { creerTournee } from '@/domain/tournees.js';

export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    byId: (state) => (id) => state.items.find((t) => t.id === id),
    actives: (state) => state.items.filter((t) => !t.archivee),
    archivees: (state) => state.items.filter((t) => t.archivee === true),
  },
  mutations: {
    /**
     * Remplace intégralement la collection de tournées (hydratation).
     * @param {{ items: object[] }} state
     * @param {object[]} items - `Tournee[]` (voir 02-modele-de-domaine.md).
     */
    REPLACE(state, items) {
      state.items = items;
    },
    /**
     * Ajoute une tournée complète et déjà normalisée à la collection.
     * @param {{ items: object[] }} state
     * @param {object} tournee - `Tournee` complète (voir `creerTournee`).
     */
    ADD(state, tournee) {
      state.items.push(tournee);
    },
    /**
     * Fusion immuable par id : remplace l'élément d'`id` donné par
     * `{ ...ancien, ...patch }`. Ne fait rien si l'id est introuvable.
     * @param {{ items: object[] }} state
     * @param {{ id: string, patch: object }} payload
     */
    UPDATE(state, { id, patch }) {
      const index = state.items.findIndex((t) => t.id === id);
      if (index === -1) return;
      state.items.splice(index, 1, { ...state.items[index], ...patch });
    },
  },
  actions: {
    /**
     * Crée une nouvelle tournée à partir de champs partiels (formulaire) et
     * l'ajoute à la collection. La construction/normalisation est déléguée
     * au domaine (`creerTournee`). Émet un toast de confirmation (feature
     * 0018) via le module `notifications` (sibling namespaced).
     * @param {{ commit: Function, dispatch: Function }} context
     * @param {object} champs - Champs partiels d'une Tournee.
     */
    ajouter({ commit, dispatch }, champs) {
      const tournee = creerTournee(champs);
      commit('ADD', tournee);
      dispatch(
        'notifications/notifier',
        { type: 'succes', message: `La tournée « ${tournee.libelle} » a été ajoutée.` },
        { root: true }
      );
    },
    /**
     * Met à jour une tournée existante par fusion immuable d'un patch
     * partiel, en rafraîchissant `updatedAt` (horodatage technique ISO UTC,
     * ADR 0010). Ne touche jamais `id`, `createdAt`. Émet un toast de
     * confirmation (feature 0018).
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {{ id: string }} payload - `{ id, ...champs }`.
     */
    modifier({ commit, dispatch, getters }, { id, ...champs }) {
      commit('UPDATE', { id, patch: { ...champs, updatedAt: new Date().toISOString() } });
      const tournee = getters.byId(id);
      const message = tournee
        ? `La tournée « ${tournee.libelle} » a été modifiée.`
        : 'La tournée a été modifiée.';
      dispatch('notifications/notifier', { type: 'succes', message }, { root: true });
    },
    /**
     * Archive une tournée (soft-delete) : `archivee` passe à `true`. La
     * tournée n'est jamais supprimée physiquement (référençable par
     * l'historique des plannings). Émet un toast de confirmation (feature
     * 0018).
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {string} id
     */
    archiver({ commit, dispatch, getters }, id) {
      commit('UPDATE', { id, patch: { archivee: true, updatedAt: new Date().toISOString() } });
      const tournee = getters.byId(id);
      const message = tournee
        ? `La tournée « ${tournee.libelle} » a été archivée.`
        : 'La tournée a été archivée.';
      dispatch('notifications/notifier', { type: 'info', message }, { root: true });
    },
    /**
     * Restaure une tournée archivée : `archivee` repasse à `false`. Émet un
     * toast de confirmation (feature 0018).
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {string} id
     */
    restaurer({ commit, dispatch, getters }, id) {
      commit('UPDATE', { id, patch: { archivee: false, updatedAt: new Date().toISOString() } });
      const tournee = getters.byId(id);
      const message = tournee
        ? `La tournée « ${tournee.libelle} » a été restaurée.`
        : 'La tournée a été restaurée.';
      dispatch('notifications/notifier', { type: 'succes', message }, { root: true });
    },
  },
};
