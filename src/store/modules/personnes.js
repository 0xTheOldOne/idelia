/**
 * Module Vuex — personnes (équipe).
 *
 * State shape (feature 0002) : `{ items: [] }`, hydraté par
 * `app/bootstrap` (voir `src/store/index.js`) via la mutation `REPLACE`.
 * Module **persisté** (voir ADR 0005) : la persistance elle-même est gérée
 * par le plugin dédié du store racine, jamais ici (aucun accès
 * `localStorage`).
 *
 * CRUD (feature 0004) : les mutations restent **fines** (aucune logique
 * métier ni horodatage) ; la construction/normalisation d'une personne vit
 * dans le domaine (`src/domain/personnes.js`, `creerPersonne`), les
 * horodatages techniques (`updatedAt`) sont posés dans les actions.
 *
 * Souhaits & préférences (feature 0005) : les `Preference` vivent **dans**
 * la personne (`personne.preferences`, tableau). Éditer une préférence =
 * mettre à jour la personne (patch `{ preferences: <nouveau tableau>,
 * updatedAt }`) via la mutation `UPDATE` existante — aucune nouvelle
 * mutation nécessaire. La construction/normalisation d'une préférence vit
 * dans le domaine (`src/domain/preferences.js`, `creerPreference`).
 */
import { creerPersonne } from '@/domain/personnes.js';
import { creerPreference } from '@/domain/preferences.js';

/**
 * Nom complet d'une personne pour les messages de notification (feature 0018).
 * Simple interpolation de présentation, aucune logique métier.
 * @param {{ prenom: string, nom: string }} personne
 * @returns {string}
 */
function nomComplet(personne) {
  return `${personne.prenom} ${personne.nom}`;
}

export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    byId: (state) => (id) => state.items.find((p) => p.id === id),
    actifs: (state) => state.items.filter((p) => p.actif),
    inactifs: (state) => state.items.filter((p) => p.actif === false),
    /**
     * Renvoie le tableau de préférences d'une personne (ou `[]` si la
     * personne est introuvable). Le tri d'affichage n'est pas fait ici
     * (présentation, laissée à l'écran).
     * @param {{}} state
     * @param {object} getters
     * @returns {(id: string) => object[]}
     */
    preferencesDe: (state, getters) => (id) => getters.byId(id)?.preferences ?? [],
  },
  mutations: {
    /**
     * Remplace intégralement la collection de personnes (hydratation).
     * @param {{ items: object[] }} state
     * @param {object[]} items - `Personne[]` (voir 02-modele-de-domaine.md).
     */
    REPLACE(state, items) {
      state.items = items;
    },
    /**
     * Ajoute une personne complète et déjà normalisée à la collection.
     * @param {{ items: object[] }} state
     * @param {object} personne - `Personne` complète (voir `creerPersonne`).
     */
    ADD(state, personne) {
      state.items.push(personne);
    },
    /**
     * Fusion immuable par id : remplace l'élément d'`id` donné par
     * `{ ...ancien, ...patch }`. Ne fait rien si l'id est introuvable.
     * @param {{ items: object[] }} state
     * @param {{ id: string, patch: object }} payload
     */
    UPDATE(state, { id, patch }) {
      const index = state.items.findIndex((p) => p.id === id);
      if (index === -1) return;
      state.items.splice(index, 1, { ...state.items[index], ...patch });
    },
  },
  actions: {
    /**
     * Crée une nouvelle personne à partir de champs partiels (formulaire) et
     * l'ajoute à la collection. La construction/normalisation est déléguée
     * au domaine (`creerPersonne`).
     * @param {{ commit: Function, dispatch: Function }} context
     * @param {object} champs - Champs partiels d'une Personne.
     */
    ajouter({ commit, dispatch }, champs) {
      const personne = creerPersonne(champs);
      commit('ADD', personne);
      dispatch(
        'notifications/notifier',
        { type: 'succes', message: `${nomComplet(personne)} a été ajouté(e) à l'équipe.` },
        { root: true }
      );
    },
    /**
     * Met à jour une personne existante par fusion immuable d'un patch
     * partiel, en rafraîchissant `updatedAt` (horodatage technique ISO UTC,
     * ADR 0010). Ne touche jamais `id`, `createdAt`, `preferences` (absents
     * de `champs`).
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {{ id: string }} payload - `{ id, ...champs }`.
     */
    modifier({ commit, dispatch, getters }, { id, ...champs }) {
      commit('UPDATE', { id, patch: { ...champs, updatedAt: new Date().toISOString() } });
      const personne = getters.byId(id);
      dispatch(
        'notifications/notifier',
        {
          type: 'succes',
          message: personne
            ? `Les informations de ${nomComplet(personne)} ont été mises à jour.`
            : 'Les informations de cette personne ont été mises à jour.',
        },
        { root: true }
      );
    },
    /**
     * Archive une personne (soft-delete) : `actif` passe à `false`. La
     * personne n'est jamais supprimée physiquement (référençable par
     * l'historique des plannings).
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {string} id
     */
    desactiver({ commit, dispatch, getters }, id) {
      commit('UPDATE', { id, patch: { actif: false, updatedAt: new Date().toISOString() } });
      const personne = getters.byId(id);
      dispatch(
        'notifications/notifier',
        {
          type: 'info',
          message: personne ? `${nomComplet(personne)} a été archivé(e).` : 'Cette personne a été archivée.',
        },
        { root: true }
      );
    },
    /**
     * Restaure une personne archivée : `actif` repasse à `true`.
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {string} id
     */
    reactiver({ commit, dispatch, getters }, id) {
      commit('UPDATE', { id, patch: { actif: true, updatedAt: new Date().toISOString() } });
      const personne = getters.byId(id);
      dispatch(
        'notifications/notifier',
        {
          type: 'succes',
          message: personne ? `${nomComplet(personne)} a été restauré(e).` : 'Cette personne a été restaurée.',
        },
        { root: true }
      );
    },
    /**
     * Ajoute une préférence à une personne. Ne fait rien si la personne est
     * introuvable. La construction/normalisation est déléguée au domaine
     * (`creerPreference`) ; recomposition immuable de `preferences`.
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {{ personneId: string }} payload - `{ personneId, ...champs }` d'une Preference.
     */
    ajouterPreference({ commit, dispatch, getters }, { personneId, ...champs }) {
      const personne = getters.byId(personneId);
      if (!personne) return;
      const preference = creerPreference(champs);
      commit('UPDATE', {
        id: personneId,
        patch: { preferences: [...personne.preferences, preference], updatedAt: new Date().toISOString() },
      });
      dispatch(
        'notifications/notifier',
        { type: 'succes', message: `Souhait ajouté pour ${nomComplet(personne)}.` },
        { root: true }
      );
    },
    /**
     * Modifie une préférence existante d'une personne : recompose
     * `preferences` en remplaçant l'élément ciblé par une version
     * renormalisée (via `creerPreference`), en préservant `id`/`createdAt`.
     * Rafraîchit `updatedAt` de la préférence **et** de la personne.
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {{ personneId: string, preferenceId: string }} payload - `{ personneId, preferenceId, ...champs }`.
     */
    modifierPreference({ commit, dispatch, getters }, { personneId, preferenceId, ...champs }) {
      const personne = getters.byId(personneId);
      if (!personne) return;
      const preferences = personne.preferences.map((ancienne) =>
        ancienne.id === preferenceId
          ? creerPreference({ ...ancienne, ...champs, id: preferenceId, createdAt: ancienne.createdAt })
          : ancienne
      );
      commit('UPDATE', { id: personneId, patch: { preferences, updatedAt: new Date().toISOString() } });
      dispatch(
        'notifications/notifier',
        { type: 'succes', message: `Souhait modifié pour ${nomComplet(personne)}.` },
        { root: true }
      );
    },
    /**
     * Supprime physiquement une préférence d'une personne (objet-valeur
     * imbriqué, non référencé : pas de soft-delete nécessaire ici).
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {{ personneId: string, preferenceId: string }} payload
     */
    supprimerPreference({ commit, dispatch, getters }, { personneId, preferenceId }) {
      const personne = getters.byId(personneId);
      if (!personne) return;
      const preferences = personne.preferences.filter((p) => p.id !== preferenceId);
      commit('UPDATE', { id: personneId, patch: { preferences, updatedAt: new Date().toISOString() } });
      dispatch(
        'notifications/notifier',
        { type: 'info', message: `Souhait supprimé pour ${nomComplet(personne)}.` },
        { root: true }
      );
    },
    /**
     * Bascule `actif` d'une préférence (mise en pause / reprise), sans la
     * supprimer. Rafraîchit `updatedAt` de la préférence et de la personne.
     * @param {{ commit: Function, dispatch: Function, getters: Object }} context
     * @param {{ personneId: string, preferenceId: string }} payload
     */
    basculerPreference({ commit, dispatch, getters }, { personneId, preferenceId }) {
      const personne = getters.byId(personneId);
      if (!personne) return;
      const maintenant = new Date().toISOString();
      const preferences = personne.preferences.map((p) =>
        p.id === preferenceId ? { ...p, actif: !p.actif, updatedAt: maintenant } : p
      );
      commit('UPDATE', { id: personneId, patch: { preferences, updatedAt: maintenant } });
      const preferenceMaj = preferences.find((p) => p.id === preferenceId);
      const message = preferenceMaj?.actif
        ? `Souhait de nouveau pris en compte pour ${nomComplet(personne)}.`
        : `Souhait mis en pause pour ${nomComplet(personne)}.`;
      dispatch('notifications/notifier', { type: 'info', message }, { root: true });
    },
  },
};
