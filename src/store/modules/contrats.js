/**
 * Module Vuex — contrats (0041).
 *
 * State : `{ modeles: [], documents: [] }`, hydraté par `REPLACE_ALL` du store
 * racine. `documents` est la place réservée à 0042 : 0041 ne l'alimente jamais.
 * Module **persisté** (ADR 0005) : la persistance est gérée par le plugin du
 * store racine, jamais ici.
 *
 * Mutations fines ; construction/normalisation dans le domaine
 * (`src/domain/contrats/`), horodatages posés dans les actions. Aucune action
 * ne rejette : une id introuvable est ignorée. Archivage = `actif: false`
 * (convention `Personne.actif`), jamais de suppression définitive.
 */
import { creerModeleContrat, dupliquerModeleContrat } from '@/domain/contrats/modeles.js';
import { modelesDeDepart } from '@/domain/contrats/modelesDeDepart.js';
import { estDeltaModeleValide } from '@/domain/contrats/delta.js';

/**
 * Émet un toast via le module `notifications`.
 * @param {Function} dispatch
 * @param {string} type - 'succes' | 'info' | 'erreur'.
 * @param {string} message
 */
function notifier(dispatch, type, message) {
  dispatch('notifications/notifier', { type, message }, { root: true });
}

/** Tri par titre, locale française. */
const parTitre = (a, b) => a.titre.localeCompare(b.titre, 'fr');

export default {
  namespaced: true,
  state: () => ({ modeles: [], documents: [] }),
  getters: {
    modeleById: (state) => (id) => state.modeles.find((m) => m.id === id),
    modelesActifs: (state) => state.modeles.filter((m) => m.actif !== false).sort(parTitre),
    modelesArchives: (state) => state.modeles.filter((m) => m.actif === false).sort(parTitre),
    documents: (state) => state.documents,
  },
  mutations: {
    /**
     * Remplace les deux collections (hydratation).
     * @param {{ modeles: object[], documents: object[] }} state
     * @param {{ modeles: object[], documents: object[] }} payload
     */
    REPLACE(state, { modeles, documents }) {
      state.modeles = modeles;
      state.documents = documents;
    },
    /**
     * Ajoute un modèle complet et déjà normalisé.
     * @param {{ modeles: object[] }} state
     * @param {object} modele - `ModeleContrat`.
     */
    ADD_MODELE(state, modele) {
      state.modeles.push(modele);
    },
    /**
     * Fusion immuable par id ; sans effet si l'id est introuvable.
     * @param {{ modeles: object[] }} state
     * @param {{ id: string, patch: object }} payload
     */
    UPDATE_MODELE(state, { id, patch }) {
      const index = state.modeles.findIndex((m) => m.id === id);
      if (index === -1) return;
      state.modeles.splice(index, 1, { ...state.modeles[index], ...patch });
    },
  },
  actions: {
    /**
     * Crée les modèles de départ si aucun modèle n'existe (archivés compris).
     * @returns {boolean} `true` si des modèles ont été créés.
     */
    assurerModelesDeDepart({ state, commit, dispatch }) {
      if (state.modeles.length > 0) return false;
      for (const modele of modelesDeDepart()) commit('ADD_MODELE', modele);
      notifier(dispatch, 'info', 'Deux modèles de départ ont été préparés. Faites-les relire avant de les utiliser.');
      return true;
    },
    /**
     * Crée un modèle vide.
     * @param {{ titre: string, type: string }} champs
     * @returns {string} id du modèle créé.
     */
    creerModele({ commit, dispatch }, { titre, type }) {
      const modele = creerModeleContrat({ titre, type });
      commit('ADD_MODELE', modele);
      notifier(dispatch, 'succes', `Le modèle « ${modele.titre} » a été créé.`);
      return modele.id;
    },
    /**
     * Enregistre explicitement le contenu et les champs à compléter.
     * Refuse un contenu hors liste blanche (il rendrait la sauvegarde illisible à l'import).
     * @param {{ id: string, contenu: object, champsLibres: object[] }} payload
     * @returns {boolean} `false` si le contenu a été refusé.
     */
    enregistrerModele({ commit, dispatch, getters }, { id, contenu, champsLibres }) {
      if (!estDeltaModeleValide(contenu)) {
        notifier(
          dispatch,
          'erreur',
          "Le modèle n'a pas pu être enregistré : le texte contient des éléments non pris en charge ou est trop long. Annulez le dernier collage (Ctrl+Z) puis réessayez."
        );
        return false;
      }
      commit('UPDATE_MODELE', { id, patch: { contenu, champsLibres, updatedAt: new Date().toISOString() } });
      const modele = getters.modeleById(id);
      notifier(dispatch, 'succes', modele ? `Le modèle « ${modele.titre} » a été enregistré.` : 'Le modèle a été enregistré.');
      return true;
    },
    /**
     * Renomme un modèle et/ou change son type.
     * @param {{ id: string, titre?: string, type?: string }} payload
     */
    renommerModele({ commit, dispatch, getters }, { id, titre, type }) {
      const patch = { updatedAt: new Date().toISOString() };
      if (titre !== undefined) patch.titre = String(titre).trim();
      if (type !== undefined) patch.type = type;
      commit('UPDATE_MODELE', { id, patch });
      const modele = getters.modeleById(id);
      notifier(dispatch, 'succes', modele ? `Le modèle « ${modele.titre} » a été modifié.` : 'Le modèle a été modifié.');
    },
    /**
     * Duplique un modèle (copie indépendante).
     * @param {string} id
     * @returns {(string|null)} id de la copie, `null` si le modèle est introuvable.
     */
    dupliquerModele({ commit, dispatch, getters }, id) {
      const original = getters.modeleById(id);
      if (!original) return null;
      const copie = dupliquerModeleContrat(original);
      commit('ADD_MODELE', copie);
      notifier(dispatch, 'succes', `Le modèle « ${copie.titre} » a été créé.`);
      return copie.id;
    },
    /** @param {string} id */
    archiverModele({ commit, dispatch, getters }, id) {
      commit('UPDATE_MODELE', { id, patch: { actif: false, updatedAt: new Date().toISOString() } });
      const modele = getters.modeleById(id);
      notifier(dispatch, 'info', modele ? `Le modèle « ${modele.titre} » a été archivé.` : 'Le modèle a été archivé.');
    },
    /** @param {string} id */
    restaurerModele({ commit, dispatch, getters }, id) {
      commit('UPDATE_MODELE', { id, patch: { actif: true, updatedAt: new Date().toISOString() } });
      const modele = getters.modeleById(id);
      notifier(dispatch, 'succes', modele ? `Le modèle « ${modele.titre} » a été restauré.` : 'Le modèle a été restauré.');
    },
  },
};
