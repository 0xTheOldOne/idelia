/**
 * Module Vuex — absences & congés.
 *
 * State shape (feature 0002) : `{ items: [] }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * CRUD (feature 0007) : les mutations restent **fines** (aucune logique
 * métier ni horodatage) ; la construction/normalisation d'une absence vit
 * dans le domaine (`src/domain/absences.js`, `creerAbsence`), les
 * horodatages techniques (`updatedAt`, `decideLe`) sont posés dans les
 * actions.
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
     * au domaine (`creerAbsence`), qui pose `statut: 'DEMANDE'`,
     * `demandeLe` et `decideLe: null`.
     * @param {{ commit: Function }} context
     * @param {object} champs - Champs partiels d'une Absence.
     */
    ajouter({ commit }, champs) {
      commit('ADD', creerAbsence(champs));
    },
    /**
     * Met à jour une absence existante par fusion immuable d'un patch
     * partiel, en rafraîchissant `updatedAt` (horodatage technique ISO UTC,
     * ADR 0010). `champs` ne contient que les champs factuels du
     * formulaire : `id`, `createdAt`, `statut`, `demandeLe`, `decideLe`
     * sont préservés par la fusion.
     * @param {{ commit: Function }} context
     * @param {{ id: string }} payload - `{ id, ...champs }`.
     */
    modifier({ commit }, { id, ...champs }) {
      commit('UPDATE', { id, patch: { ...champs, updatedAt: new Date().toISOString() } });
    },
    /**
     * Supprime définitivement une absence (suppression physique, protégée
     * par une confirmation côté UI).
     * @param {{ commit: Function }} context
     * @param {string} id
     */
    supprimer({ commit }, id) {
      commit('REMOVE', id);
    },
    /**
     * Valide une absence en attente : `statut` passe à `'VALIDE'` et
     * `decideLe` est posé (horodatage ISO UTC de la décision).
     * @param {{ commit: Function }} context
     * @param {string} id
     */
    valider({ commit }, id) {
      commit('UPDATE', {
        id,
        patch: { statut: 'VALIDE', decideLe: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
    },
    /**
     * Refuse une absence en attente : `statut` passe à `'REFUSE'` et
     * `decideLe` est posé (horodatage ISO UTC de la décision).
     * @param {{ commit: Function }} context
     * @param {string} id
     */
    refuser({ commit }, id) {
      commit('UPDATE', {
        id,
        patch: { statut: 'REFUSE', decideLe: new Date().toISOString(), updatedAt: new Date().toISOString() },
      });
    },
    /**
     * Annule une décision : `statut` repasse à `'DEMANDE'` et `decideLe`
     * est remis à `null`.
     * @param {{ commit: Function }} context
     * @param {string} id
     */
    remettreEnDemande({ commit }, id) {
      commit('UPDATE', {
        id,
        patch: { statut: 'DEMANDE', decideLe: null, updatedAt: new Date().toISOString() },
      });
    },
  },
};
