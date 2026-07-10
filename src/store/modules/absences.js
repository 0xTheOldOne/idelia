/**
 * Module Vuex — absences & congés.
 *
 * State shape (feature 0002) : `{ items: [] }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * Saisie directe, sans workflow (feature 0017) : un seul gestionnaire en
 * v1, aucune authentification ([ADR 0014]) ⇒ pas de circuit
 * demande/validation. `creerAbsence` (`src/domain/absences.js`) force le
 * champ `statut` à `'VALIDE'` dès la création ; ce module ne porte donc
 * plus que le CRUD (`ajouter`/`modifier`/`supprimer`). Les mutations
 * restent **fines** (aucune logique métier ni horodatage) ; la
 * construction/normalisation d'une absence vit dans le domaine, les
 * horodatages techniques (`updatedAt`) sont posés dans les actions.
 *
 * Contrairement à `personnes`/`tournees` (soft-delete), `Absence` n'est
 * référencée par aucune autre entité (§3 de la feature 0007) : sa
 * suppression est donc **physique** (`REMOVE`), protégée par une
 * confirmation côté UI.
 */
import { creerAbsence } from '@/domain/absences.js';

export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    byId: (state) => (id) => state.items.find((a) => a.id === id),
    parPersonne: (state) => (personneId) =>
      state.items.filter((a) => a.personneId === personneId),
  },
  mutations: {
    /**
     * Remplace intégralement la collection d'absences (hydratation).
     * @param {{ items: object[] }} state
     * @param {object[]} items - `Absence[]` (voir 02-modele-de-domaine.md).
     */
    REPLACE(state, items) {
      state.items = items;
    },
    /**
     * Ajoute une absence complète et déjà normalisée à la collection.
     * @param {{ items: object[] }} state
     * @param {object} absence - `Absence` complète (voir `creerAbsence`).
     */
    ADD(state, absence) {
      state.items.push(absence);
    },
    /**
     * Fusion immuable par id : remplace l'élément d'`id` donné par
     * `{ ...ancien, ...patch }`. Ne fait rien si l'id est introuvable.
     * @param {{ items: object[] }} state
     * @param {{ id: string, patch: object }} payload
     */
    UPDATE(state, { id, patch }) {
      const index = state.items.findIndex((a) => a.id === id);
      if (index === -1) return;
      state.items.splice(index, 1, { ...state.items[index], ...patch });
    },
    /**
     * Suppression physique : retire l'élément d'`id` donné de la collection
     * (réaffectation immuable). Absence non référencée par une autre
     * entité : contrairement à `personnes`/`tournees`, pas de soft-delete.
     * @param {{ items: object[] }} state
     * @param {string} id
     */
    REMOVE(state, id) {
      state.items = state.items.filter((a) => a.id !== id);
    },
  },
  actions: {
    /**
     * Crée une nouvelle absence à partir de champs partiels (formulaire) et
     * l'ajoute à la collection. La construction/normalisation est déléguée
     * au domaine (`creerAbsence`), qui pose `statut: 'VALIDE'` (saisie
     * directe, feature 0017), `demandeLe` et `decideLe: null`. Émet un toast
     * de confirmation (feature 0018) nommant la personne concernée
     * (résolue via `rootGetters['personnes/byId']`, lecture inter-module).
     * @param {{ commit: Function, dispatch: Function, rootGetters: Object }} context
     * @param {object} champs - Champs partiels d'une Absence.
     */
    ajouter({ commit, dispatch, rootGetters }, champs) {
      const absence = creerAbsence(champs);
      commit('ADD', absence);
      const personne = rootGetters['personnes/byId'](absence.personneId);
      const message = personne
        ? `L'absence de ${personne.prenom} ${personne.nom} a été enregistrée.`
        : 'Une absence a été enregistrée.';
      dispatch('notifications/notifier', { type: 'succes', message }, { root: true });
    },
    /**
     * Met à jour une absence existante par fusion immuable d'un patch
     * partiel, en rafraîchissant `updatedAt` (horodatage technique ISO UTC,
     * ADR 0010). `champs` ne contient que les champs factuels du
     * formulaire : `id`, `createdAt`, `statut`, `demandeLe`, `decideLe`
     * sont préservés par la fusion. Émet un toast de confirmation (feature
     * 0018) nommant la personne concernée.
     * @param {{ commit: Function, dispatch: Function, getters: Object, rootGetters: Object }} context
     * @param {{ id: string }} payload - `{ id, ...champs }`.
     */
    modifier({ commit, dispatch, getters, rootGetters }, { id, ...champs }) {
      commit('UPDATE', { id, patch: { ...champs, updatedAt: new Date().toISOString() } });
      const absence = getters.byId(id);
      const personne = absence ? rootGetters['personnes/byId'](absence.personneId) : undefined;
      const message = personne
        ? `L'absence de ${personne.prenom} ${personne.nom} a été modifiée.`
        : 'Une absence a été modifiée.';
      dispatch('notifications/notifier', { type: 'succes', message }, { root: true });
    },
    /**
     * Supprime définitivement une absence (suppression physique, protégée
     * par une confirmation côté UI). La personne est résolue **avant** la
     * suppression (sinon l'absence n'existe plus pour retrouver
     * `personneId`). Émet un toast de confirmation (feature 0018).
     * @param {{ commit: Function, dispatch: Function, getters: Object, rootGetters: Object }} context
     * @param {string} id
     */
    supprimer({ commit, dispatch, getters, rootGetters }, id) {
      const absence = getters.byId(id);
      const personne = absence ? rootGetters['personnes/byId'](absence.personneId) : undefined;
      commit('REMOVE', id);
      const message = personne
        ? `L'absence de ${personne.prenom} ${personne.nom} a été supprimée.`
        : 'Une absence a été supprimée.';
      dispatch('notifications/notifier', { type: 'info', message }, { root: true });
    },
  },
};
