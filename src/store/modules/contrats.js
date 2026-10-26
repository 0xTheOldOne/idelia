/**
 * Module Vuex — contrats (0041).
 *
 * State : `{ modeles: [], documents: [] }`, hydraté par `REPLACE_ALL` du store
 * racine. `documents` (0042) : documents contractuels générés depuis un modèle.
 * Module **persisté** (ADR 0005) : la persistance est gérée par le plugin du
 * store racine, jamais ici.
 *
 * Mutations fines ; construction/normalisation dans le domaine
 * (`src/domain/contrats/`), horodatages posés dans les actions.
 *
 * Documents (0042) : un brouillon est modifiable et supprimable ; un document
 * signé est définitif (jamais modifié ni supprimé, seulement archivé). À la
 * signature, nom + adresse du cabinet sont figés dans `enteteCabinet` (jamais
 * le logo). Les modèles ne sont jamais supprimés : l'intégrité `modeleId` tient.
 * L'état d'édition d'un brouillon vit dans la vue ; le store reçoit le contenu
 * à l'enregistrement explicite. Aucune action
 * ne rejette : une id introuvable est ignorée. Archivage = `actif: false`
 * (convention `Personne.actif`), jamais de suppression définitive.
 */
import { creerModeleContrat, dupliquerModeleContrat } from '@/domain/contrats/modeles.js';
import { modelesDeDepart } from '@/domain/contrats/modelesDeDepart.js';
import { estDeltaModeleValide } from '@/domain/contrats/delta.js';
import {
  genererDocument,
  ecartTauxRetrocession,
  estModifiable,
  estSupprimable,
  estArchivable,
  estDateSignatureValide,
  figerEnteteCabinet,
  trierDocuments,
} from '@/domain/contrats/documents.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Émet un toast via le module `notifications`.
 * @param {Function} dispatch
 * @param {string} type - 'succes' | 'info' | 'erreur'.
 * @param {string} message
 */
function notifier(dispatch, type, message) {
  dispatch('notifications/notifier', { type, message }, { root: true });
}

const MESSAGE_TITRE = 'Le titre doit contenir entre 1 et 200 caractères.';

/** Titre non vide après `trim` et d'au plus 200 caractères. */
const titreValide = (titre) => {
  const net = String(titre ?? '').trim();
  return net !== '' && net.length <= 200;
};

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
    documentById: (state) => (id) => state.documents.find((d) => d.id === id),
    documentsDe: (state) => (personneId) => trierDocuments(state.documents.filter((d) => d.personneId === personneId)),
    nbDocumentsDe: (state) => (personneId) => state.documents.filter((d) => d.personneId === personneId).length,
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
    /** @param {{ documents: object[] }} state @param {object} doc - `DocumentContrat` complet. */
    ADD_DOCUMENT(state, doc) {
      state.documents.push(doc);
    },
    /**
     * Fusion immuable par id ; sans effet si l'id est introuvable.
     * @param {{ documents: object[] }} state
     * @param {{ id: string, patch: object }} payload
     */
    UPDATE_DOCUMENT(state, { id, patch }) {
      const index = state.documents.findIndex((d) => d.id === id);
      if (index === -1) return;
      state.documents.splice(index, 1, { ...state.documents[index], ...patch });
    },
    /** @param {{ documents: object[] }} state @param {string} id */
    REMOVE_DOCUMENT(state, id) {
      state.documents = state.documents.filter((d) => d.id !== id);
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
    /**
     * Crée un brouillon de document depuis un modèle pour une personne.
     * @param {{ personneId: string, modeleId: string, titre: string, valeursSaisies: object[] }} payload
     * @returns {{ ok: true, id: string } | { ok: false, message: string }}
     */
    genererDocument({ getters, commit, dispatch, rootState, rootGetters }, { personneId, modeleId, titre, valeursSaisies }) {
      const personnes = rootState.personnes.items;
      const personne = personnes.find((p) => p.id === personneId);
      const modele = getters.modeleById(modeleId);
      const titreNet = String(titre ?? '').trim();
      if (!personne) return { ok: false, message: 'La personne choisie est introuvable.' };
      if (!modele) return { ok: false, message: 'Le modèle choisi est introuvable.' };
      if (!titreValide(titreNet)) {
        return { ok: false, message: MESSAGE_TITRE };
      }
      const doc = genererDocument({
        modele,
        personne,
        personnes,
        cabinet: rootGetters['cabinet/parametres'],
        titre: titreNet,
        valeursSaisies,
        aujourdhui: dateUtil.format(new Date()),
        maintenant: new Date().toISOString(),
      });
      commit('ADD_DOCUMENT', doc);
      notifier(dispatch, 'succes', `Le brouillon « ${doc.titre} » a été créé.`);
      const ecart = ecartTauxRetrocession({ valeursSaisies: doc.valeursSaisies, personne });
      if (ecart) {
        const fiche = ecart.valeurFiche === null
          ? "la fiche n'indique pas de taux"
          : `la fiche indique ${ecart.valeurFiche} %`;
        notifier(dispatch, 'avertissement', `Le taux saisi (${ecart.valeurSaisie} %) diffère de la fiche : ${fiche}.`);
      }
      return { ok: true, id: doc.id };
    },
    /**
     * Enregistre le titre et le contenu d'un brouillon.
     * @param {{ id: string, titre: string, contenu: object }} payload
     * @returns {boolean} `false` si le document n'est pas un brouillon ou si le contenu est refusé.
     */
    enregistrerBrouillon({ commit, dispatch, getters }, { id, titre, contenu }) {
      const doc = getters.documentById(id);
      if (!doc || !estModifiable(doc)) return false;
      if (!estDeltaModeleValide(contenu)) {
        notifier(dispatch, 'erreur', "Le document n'a pas pu être enregistré : le texte contient des éléments non pris en charge ou est trop long. Annulez le dernier collage (Ctrl+Z) puis réessayez.");
        return false;
      }
      if (titre !== undefined && !titreValide(titre)) {
        notifier(dispatch, 'erreur', MESSAGE_TITRE);
        return false;
      }
      const titreNet = String(titre ?? doc.titre).trim();
      commit('UPDATE_DOCUMENT', { id, patch: { titre: titreNet, contenu, updatedAt: new Date().toISOString() } });
      notifier(dispatch, 'succes', `Le brouillon « ${titreNet} » a été enregistré.`);
      return true;
    },
    /**
     * Marque un brouillon comme signé (définitif) et fige l'en-tête du cabinet (nom + adresse, sans logo).
     * @param {{ id: string, signeLe: string, titre?: string, contenu?: object }} payload
     * @returns {boolean} `false` si le document n'est pas un brouillon ou si les données sont refusées.
     */
    marquerSigne({ commit, dispatch, getters, rootGetters }, { id, signeLe, titre, contenu }) {
      const doc = getters.documentById(id);
      if (!doc || !estModifiable(doc)) return false;
      if (!estDateSignatureValide(signeLe, dateUtil.format(new Date()))) {
        notifier(dispatch, 'erreur', 'La date de signature doit être valide et ne pas être dans le futur.');
        return false;
      }
      if (titre !== undefined && !titreValide(titre)) {
        notifier(dispatch, 'erreur', MESSAGE_TITRE);
        return false;
      }
      if (contenu !== undefined && !estDeltaModeleValide(contenu)) {
        notifier(dispatch, 'erreur', "Le document n'a pas pu être signé : le texte contient des éléments non pris en charge ou est trop long.");
        return false;
      }
      const patch = {
        statut: 'SIGNE',
        signeLe,
        enteteCabinet: figerEnteteCabinet(rootGetters['cabinet/parametres']),
        updatedAt: new Date().toISOString(),
      };
      if (titre !== undefined) patch.titre = String(titre).trim();
      if (contenu !== undefined) patch.contenu = contenu;
      commit('UPDATE_DOCUMENT', { id, patch });
      notifier(dispatch, 'succes', `« ${patch.titre ?? doc.titre} » est marqué comme signé le ${dateUtil.formatDateFr(signeLe)}. Il ne peut plus être modifié.`);
      return true;
    },
    /**
     * Supprime un brouillon (jamais un document signé).
     * @param {string} id
     * @returns {boolean}
     */
    supprimerBrouillon({ commit, dispatch, getters }, id) {
      const doc = getters.documentById(id);
      if (!doc || !estSupprimable(doc)) return false;
      commit('REMOVE_DOCUMENT', id);
      notifier(dispatch, 'info', `Le brouillon « ${doc.titre} » a été supprimé.`);
      return true;
    },
    /**
     * Archive un document signé.
     * @param {string} id
     * @returns {boolean}
     */
    archiverDocument({ commit, dispatch, getters }, id) {
      const doc = getters.documentById(id);
      if (!doc || !estArchivable(doc)) return false;
      commit('UPDATE_DOCUMENT', { id, patch: { archive: true, updatedAt: new Date().toISOString() } });
      notifier(dispatch, 'info', `« ${doc.titre} » a été archivé. Vous le retrouverez dans « Documents archivés ».`);
      return true;
    },
    /**
     * Restaure un document signé archivé.
     * @param {string} id
     * @returns {boolean}
     */
    restaurerDocument({ commit, dispatch, getters }, id) {
      const doc = getters.documentById(id);
      if (!doc || !estArchivable(doc)) return false;
      commit('UPDATE_DOCUMENT', { id, patch: { archive: false, updatedAt: new Date().toISOString() } });
      notifier(dispatch, 'info', `« ${doc.titre} » a été restauré.`);
      return true;
    },
  },
};
