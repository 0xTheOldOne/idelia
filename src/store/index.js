import { createStore } from 'vuex';

import { etatParDefaut, toSaveDocument, fromSaveDocument } from '@/domain/schema.js';
import { TAILLE_MAX_FICHIER_OCTETS } from '@/domain/validationImport.js';
import { CURRENT_SCHEMA_VERSION, preparerDocument } from '@/storage/migrations.js';
import { storageRepository } from '@/storage/storageRepository.js';
import { dateUtil } from '@/domain/utils/dates.js';
import { logoNonConforme, MESSAGE_LOGO_NON_REPRIS } from '@/domain/cabinet.js';

import cabinet from './modules/cabinet';
import personnes from './modules/personnes';
import tournees from './modules/tournees';
import absences from './modules/absences';
import plannings from './modules/plannings';
import ui from './modules/ui';
import notifications from './modules/notifications';
import vacancesScolaires from './modules/vacancesScolaires';

/**
 * Store racine de l'application (feature 0002).
 *
 * Porte l'état racine (statut de sauvegarde), la mutation d'hydratation
 * atomique `REPLACE_ALL`, les actions d'orchestration `bootstrap` /
 * `importer` / `exporter` / `reinitialiser`, et le plugin de persistance
 * débouncé. La logique pure (défauts, (dé)sérialisation, intégrité,
 * migration) vit dans `src/domain/schema.js` et `src/storage/migrations.js` ;
 * ce fichier ne fait qu'orchestrer ces briques et le `storageRepository`
 * (ADR 0005).
 */

// ---------------------------------------------------------------------------
// Contrôleur de débounce (plugin de persistance)
// ---------------------------------------------------------------------------

/**
 * Identifiant du timer de débounce en cours, partagé entre le plugin de
 * persistance (écriture débouncée ~400 ms) et le flush immédiat déclenché
 * par l'action `importer`.
 * @type {ReturnType<typeof setTimeout>|null}
 */
let timer = null;

/**
 * Handle du « fichier de sauvegarde actif » (File System Access API,
 * feature 0019, ADR 0018), variable **de module** comme `timer` : un
 * `FileSystemFileHandle` n'est pas sérialisable, il ne doit donc jamais
 * vivre dans `state`. Vaut `null` tant qu'aucun fichier n'a été choisi ou repris.
 * Mémorisé dans IndexedDB via `storageRepository` (feature 0032, ADR 0021) ;
 * sa reprise après rechargement passe par `reprendreSauvegardeFichier`.
 * @type {FileSystemFileHandle|null}
 */
let handleFichierSauvegarde = null;

/**
 * Handle mémorisé dont la permission n'est pas (encore) accordée : attend le
 * clic « Reprendre la sauvegarde… » (feature 0032).
 * @type {FileSystemFileHandle|null}
 */
let handleEnAttenteAccord = null;

/**
 * `true` si des données ont changé dans CET onglet depuis la dernière écriture
 * réussie du fichier actif. Le minuteur automatique n'écrit que dans ce cas
 * (protection multi-onglets, feature 0032 §4.3). Le bouton manuel écrit toujours.
 */
let modifieDepuisEcritureFichier = false;

/**
 * Résultat du chargement initial des données (`bootstrap`) :
 * `'DONNEES'` (document chargé et valide), `'VIDE'` (aucune donnée stockée),
 * `'ERREUR'` (donnée illisible ou invalide).
 * @typedef {'DONNEES'|'VIDE'|'ERREUR'} ResultatChargement
 */

/** Message du toast persistant quand les données du navigateur sont absentes. */
const MESSAGE_DONNEES_ABSENTES = (nom) =>
  `Vos données n'ont pas été retrouvées dans ce navigateur. Par prudence, Idelia n'écrira plus dans votre fichier de sauvegarde « ${nom} », qui reste intact : pour récupérer vos données, utilisez « Restaurer une sauvegarde » dans Paramètres.`;

/**
 * Persiste immédiatement l'état courant via `storageRepository.save`, et met
 * à jour le statut de sauvegarde en conséquence. N'est jamais appelée
 * directement par le code applicatif : toujours via `planifier` (débounce)
 * ou `flushImmediat` (écriture immédiate, hors debounce).
 *
 * @param {import('vuex').Store} store - Store racine.
 * @returns {Promise<void>}
 */
async function sauvegarder(store) {
  try {
    await storageRepository.save(
      toSaveDocument(store.state, { schemaVersion: CURRENT_SCHEMA_VERSION })
    );
    store.commit('SET_DERNIERE_SAUVEGARDE', new Date().toISOString());
    store.commit('SET_STATUT_SAUVEGARDE', 'ENREGISTRE');
  } catch (e) {
    store.commit('SET_STATUT_SAUVEGARDE', 'ERREUR');
    console.error(e);
  }
}

/**
 * Planifie une écriture débouncée (~400 ms) : annule le timer en cours s'il
 * y en a un, puis en reprogramme un nouveau. Bascule immédiatement le
 * statut sur `EN_COURS` (état transitoire visible dans l'UI le temps du
 * débounce) ; cette mutation est filtrée par la garde anti-boucle du plugin
 * de persistance (`SET_STATUT_SAUVEGARDE`), donc sans risque de reboucler.
 *
 * @param {import('vuex').Store} store - Store racine.
 */
function planifier(store) {
  store.commit('SET_STATUT_SAUVEGARDE', 'EN_COURS');
  clearTimeout(timer);
  timer = setTimeout(() => sauvegarder(store), 400);
}

/**
 * Annule le débounce en cours et déclenche une écriture immédiate. Utilisée
 * par l'action `importer`, qui doit persister sans attendre le délai de
 * débounce habituel.
 *
 * @param {import('vuex').Store} store - Store racine.
 * @returns {Promise<void>}
 */
function flushImmediat(store) {
  clearTimeout(timer);
  return sauvegarder(store);
}

/**
 * Annule l'écriture débouncée en attente, s'il y en a une (ex. après
 * « Tout effacer » : une modification en attente recréerait une clé de données).
 */
function annulerEcritureEnAttente() {
  clearTimeout(timer);
  timer = null;
}

/**
 * Plugin de persistance : observe toutes les mutations du store et planifie
 * une écriture débouncée pour toute mutation qui modifie de la donnée
 * persistée.
 *
 * Garde anti-boucle **critique** : ignore les mutations des modules `ui` et
 * `notifications` (tous deux volatils, jamais persistés — voir feature 0018
 * §4.2) ainsi que les mutations de statut de sauvegarde elles-mêmes
 * (`SET_STATUT_SAUVEGARDE`, `SET_DERNIERE_SAUVEGARDE`), sinon chaque écriture
 * réussie redéclencherait une nouvelle écriture, à l'infini. Ignore aussi
 * `REPLACE_ALL` : l'hydratation (démarrage, import, réinitialisation) n'est
 * pas une modification utilisateur ; l'import persiste lui-même via
 * `flushImmediat`.
 *
 * @param {import('vuex').Store} store - Store racine.
 */
function persistancePlugin(store) {
  const SANS_PERSISTANCE = new Set(['REPLACE_ALL', 'SET_STATUT_SAUVEGARDE', 'SET_DERNIERE_SAUVEGARDE']);
  store.subscribe((mutation) => {
    if (mutation.type.startsWith('ui/') || mutation.type.startsWith('notifications/')) return;
    if (SANS_PERSISTANCE.has(mutation.type)) return;
    modifieDepuisEcritureFichier = true;
    planifier(store);
  });
}

// ---------------------------------------------------------------------------
// Fichier de sauvegarde actif (feature 0019, ADR 0018 — File System Access
// API en amélioration progressive, Chrome/Edge uniquement)
// ---------------------------------------------------------------------------

/**
 * Oublie le fichier en mémoire (handle, attente d'accord) et remet à zéro ses
 * reflets `ui`. N'agit pas sur IndexedDB.
 *
 * @param {Function} commit - `commit` du contexte d'action racine.
 */
function libererFichierEnMemoire(commit) {
  handleFichierSauvegarde = null;
  handleEnAttenteAccord = null;
  commit('ui/SET_FICHIER_SAUVEGARDE_ACTIF', { actif: false, nom: null }, { root: true });
  commit('ui/SET_FICHIER_SAUVEGARDE_MEMORISE', false, { root: true });
  commit('ui/SET_FICHIER_EN_ATTENTE_ACCORD', null, { root: true });
}

/**
 * Le fichier mémorisé est introuvable : libère la mémoire, oublie le handle
 * mort dans IndexedDB, puis ouvre la fenêtre d'avertissement.
 *
 * @param {Function} commit - `commit` du contexte d'action racine.
 * @param {string} nom - Nom du fichier introuvable.
 * @returns {Promise<void>}
 */
async function signalerFichierIntrouvable(commit, nom) {
  libererFichierEnMemoire(commit);
  await storageRepository.oublierHandleFichierSauvegarde();
  commit('ui/SET_FICHIER_SAUVEGARDE_INTROUVABLE', nom, { root: true });
}

/**
 * Branche un handle mémorisé dont l'écriture est autorisée : vérifie que le
 * fichier existe encore, puis le rend actif. Le drapeau
 * `modifieDepuisEcritureFichier` n'est PAS forcé : le fichier, peut-être plus
 * récent (synchronisé depuis un autre poste), n'est réécrit qu'après une vraie
 * modification dans cet onglet.
 *
 * @param {Function} commit - `commit` du contexte d'action racine.
 * @param {FileSystemFileHandle} handle
 * @returns {Promise<{ ok: boolean, introuvable?: boolean }>}
 */
async function brancherFichierMemorise(commit, handle) {
  try {
    const fichier = await handle.getFile();
    handleFichierSauvegarde = handle;
    handleEnAttenteAccord = null;
    commit('ui/SET_FICHIER_EN_ATTENTE_ACCORD', null, { root: true });
    commit('ui/SET_FICHIER_SAUVEGARDE_ACTIF', { actif: true, nom: handle.name }, { root: true });
    commit('ui/SET_FICHIER_SAUVEGARDE_MEMORISE', true, { root: true });
    commit('ui/SET_DERNIER_FICHIER_ENREGISTRE', new Date(fichier.lastModified).toISOString(), { root: true });
    return { ok: true };
  } catch (e) {
    // NotFoundError (déplacé, renommé, supprimé), NotAllowedError… : même issue.
    console.error('[Idelia] Fichier de sauvegarde mémorisé inutilisable :', e);
    await signalerFichierIntrouvable(commit, handle.name);
    return { ok: false, introuvable: true };
  }
}

/**
 * Reprend au démarrage le fichier de sauvegarde mémorisé (feature 0032, ADR
 * 0021), sans geste utilisateur. Ne rejette jamais. Ne fait rien sans l'API
 * File System Access (aucune base IndexedDB ouverte sur Firefox/Safari).
 *
 * @param {import('vuex').ActionContext} context
 * @param {{ chargement: ResultatChargement }} payload
 * @returns {Promise<void>}
 */
async function reprendreSauvegardeFichier({ commit, dispatch }, { chargement } = {}) {
  try {
    if (!('showSaveFilePicker' in window)) return;
    const handle = await storageRepository.lireHandleFichierSauvegarde();
    if (!handle) return;
    if (chargement !== 'DONNEES') {
      // Garde-fou (ADR 0021) : ne jamais écraser une bonne sauvegarde par un état vide.
      await storageRepository.oublierHandleFichierSauvegarde();
      dispatch(
        'notifications/notifier',
        { type: 'avertissement', duree: 0, message: MESSAGE_DONNEES_ABSENTES(handle.name) },
        { root: true }
      );
      return;
    }
    let permission;
    try {
      permission = await handle.queryPermission({ mode: 'readwrite' });
    } catch {
      permission = 'prompt';
    }
    if (permission === 'granted') {
      await brancherFichierMemorise(commit, handle);
      return;
    }
    // 'prompt' ou 'denied' : un clic sera nécessaire.
    handleEnAttenteAccord = handle;
    commit('ui/SET_FICHIER_EN_ATTENTE_ACCORD', handle.name, { root: true });
  } catch (e) {
    console.error('[Idelia] Reprise du fichier de sauvegarde impossible :', e);
  }
}

/**
 * Reprend le fichier en attente d'accord. À appeler **uniquement depuis un
 * clic** (bandeau ou Paramètres) : `requestPermission` exige un geste
 * utilisateur. Émet elle-même ses toasts (pas de doublon dans les composants).
 *
 * @param {import('vuex').ActionContext} context
 * @returns {Promise<{ ok: boolean, refuse?: boolean, introuvable?: boolean }>}
 */
async function confirmerRepriseSauvegardeFichier({ commit, dispatch }) {
  const handle = handleEnAttenteAccord;
  if (!handle) return { ok: false };
  let permission;
  try {
    permission = await handle.requestPermission({ mode: 'readwrite' });
  } catch (e) {
    console.error(e);
    permission = 'denied';
  }
  if (permission !== 'granted') {
    commit('ui/SET_BANDEAU_REPRISE_MASQUE', true, { root: true });
    dispatch(
      'notifications/notifier',
      {
        type: 'info',
        message: `La sauvegarde dans « ${handle.name} » n'a pas été reprise. Vous pourrez la reprendre plus tard depuis Paramètres, rubrique « Sauvegarde automatique ».`,
      },
      { root: true }
    );
    return { ok: false, refuse: true };
  }
  const resultat = await brancherFichierMemorise(commit, handle);
  if (resultat.ok) {
    dispatch(
      'notifications/notifier',
      { type: 'succes', message: `La sauvegarde reprend dans « ${handle.name} ».` },
      { root: true }
    );
  }
  // Introuvable : la fenêtre d'avertissement s'ouvre d'elle-même, pas de toast.
  return resultat;
}

/**
 * Active un « fichier de sauvegarde » actif (File System Access API,
 * disponible sur Chrome/Edge uniquement). Exige un geste utilisateur
 * (appelée depuis un clic) : `showSaveFilePicker` ne peut pas être invoquée
 * depuis un minuteur. Détecte fiablement une annulation (`AbortError`) :
 * dans ce cas, aucun état n'est modifié (correction réelle du bug
 * d'annulation, ADR 0018).
 *
 * @param {import('vuex').ActionContext} context
 * @returns {Promise<{ ok: boolean, message?: string, annule?: boolean }>}
 */
async function activerSauvegardeFichier({ commit, state }) {
  if (!('showSaveFilePicker' in window)) {
    return {
      ok: false,
      message: 'Votre navigateur ne permet pas cette fonctionnalité (essayez Chrome ou Edge).',
    };
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'idelia-sauvegarde.json',
      types: [{ description: 'Sauvegarde Idelia', accept: { 'application/json': ['.json'] } }],
    });
    // Choisir un autre fichier remplace un éventuel fichier en attente d'accord.
    handleEnAttenteAccord = null;
    commit('ui/SET_FICHIER_EN_ATTENTE_ACCORD', null, { root: true });
    handleFichierSauvegarde = handle;
    commit('ui/SET_FICHIER_SAUVEGARDE_ACTIF', { actif: true, nom: handle.name }, { root: true });
    // Première écriture immédiate : confirme que tout fonctionne de bout en
    // bout, cohérent avec l'intention explicite de l'utilisateur qui vient
    // de choisir un emplacement.
    const resultat = await ecrireSauvegardeFichier({ commit, state });
    if (resultat.ok) {
      const memorise = await storageRepository.enregistrerHandleFichierSauvegarde(handle);
      commit('ui/SET_FICHIER_SAUVEGARDE_MEMORISE', memorise, { root: true });
    }
    return resultat;
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, annule: true };
    console.error("[Idelia] Activation du fichier de sauvegarde impossible :", e);
    return { ok: false, message: "Impossible d'activer le fichier de sauvegarde." };
  }
}

/**
 * Réécrit le document courant dans le fichier de sauvegarde actif. Utilisée
 * à la fois par le bouton manuel (`BlocSauvegarde.vue`, « Enregistrer une
 * sauvegarde ») et par le minuteur automatique
 * (`declencherSauvegardeAutomatique`) — d'où son exposition comme action
 * dispatchable **et** fonction appelable directement en interne.
 *
 * @param {import('vuex').ActionContext} context
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function ecrireSauvegardeFichier({ commit, state }) {
  if (!handleFichierSauvegarde) {
    return { ok: false, message: 'Aucun fichier de sauvegarde actif.' };
  }
  try {
    const doc = toSaveDocument(state, { schemaVersion: CURRENT_SCHEMA_VERSION });
    const writable = await handleFichierSauvegarde.createWritable();
    await writable.write(JSON.stringify(doc, null, 2));
    await writable.close();
    modifieDepuisEcritureFichier = false;
    commit('ui/SET_DERNIER_FICHIER_ENREGISTRE', new Date().toISOString(), { root: true });
    return { ok: true };
  } catch (e) {
    // Trace technique pour le diagnostic (le message affiché reste générique).
    console.error('[Idelia] Écriture du fichier de sauvegarde impossible :', e);
    // Handle révoqué/fichier introuvable : on désactive proprement plutôt
    // que de laisser un état « actif » qui ne fonctionne plus silencieusement.
    // Autres erreurs (disque plein, fichier verrouillé…) : passagères, on garde
    // le fichier et on réessaiera au prochain enregistrement.
    if (e.name === 'NotFoundError' || e.name === 'NotAllowedError') {
      libererFichierEnMemoire(commit);
      await storageRepository.oublierHandleFichierSauvegarde();
    }
    return { ok: false, message: "L'écriture dans le fichier de sauvegarde a échoué." };
  }
}

/**
 * Désactive le fichier de sauvegarde actif : oublie le handle en mémoire et
 * dans IndexedDB. N'efface aucune donnée (juste un lien pratique vers un
 * fichier, jamais le fichier lui-même) : geste réversible, sans confirmation.
 *
 * @param {import('vuex').ActionContext} context
 * @returns {Promise<void>}
 */
async function desactiverSauvegardeFichier({ commit }) {
  libererFichierEnMemoire(commit);
  await storageRepository.oublierHandleFichierSauvegarde();
}

/**
 * Point d'entrée du minuteur périodique (`ui.js`) : écrit silencieusement
 * dans le fichier de sauvegarde actif s'il y en a un ; sinon, se contente
 * d'un rappel (toast, feature 0018). Aucune requête réseau : uniquement des
 * API du navigateur local (ADR 0002).
 *
 * @param {import('vuex').ActionContext} context
 */
async function declencherSauvegardeAutomatique({ state, commit, dispatch }) {
  if (handleFichierSauvegarde) {
    // Rien de nouveau dans cet onglet : pas d'écriture, pas de toast (§4.3).
    if (!modifieDepuisEcritureFichier) return;
    const resultat = await ecrireSauvegardeFichier({ commit, state });
    if (!resultat.ok) {
      dispatch(
        'notifications/notifier',
        {
          type: 'avertissement',
          message: 'La sauvegarde automatique du fichier a été interrompue : ' + resultat.message,
        },
        { root: true }
      );
    }
    // Succès : silencieux, l'indicateur du bloc suffit (pas de toast à chaque tick).
  } else {
    dispatch(
      'notifications/notifier',
      {
        type: 'avertissement',
        message:
          "Pensez à enregistrer une sauvegarde : vos données n'ont pas été copiées dans un fichier récemment.",
      },
      { root: true }
    );
  }
}

export default createStore({
  state: () => ({
    derniereSauvegarde: null,
    statutSauvegarde: 'INACTIF',
  }),

  mutations: {
    /**
     * Hydratation atomique de l'état racine : réaffecte en un seul commit
     * les tranches des modules persistés. Une mutation ne pouvant pas
     * `commit` d'autres mutations, les tranches sont réaffectées
     * directement (n'inclut jamais `ui`).
     *
     * @param {object} state - État racine.
     * @param {import('@/domain/schema.js').EtatRacine} etatRacine - Forme
     *   produite par `fromSaveDocument(doc)` ou `etatParDefaut()`.
     */
    REPLACE_ALL(state, etatRacine) {
      state.cabinet.parametres = etatRacine.cabinet.parametres;
      state.personnes.items = etatRacine.personnes.items;
      state.tournees.items = etatRacine.tournees.items;
      state.absences.items = etatRacine.absences.items;
      state.plannings.items = etatRacine.plannings.items;
      state.plannings.selectionId = etatRacine.plannings.selectionId ?? null;
      state.vacancesScolaires.entrees = etatRacine.vacancesScolaires.entrees;
    },

    /**
     * Met à jour le statut de sauvegarde courant. Ignorée par le plugin de
     * persistance (voir `persistancePlugin`) pour éviter toute boucle
     * d'écriture.
     * @param {object} state - État racine.
     * @param {string} statut - `INACTIF|EN_COURS|ENREGISTRE|ERREUR|ERREUR_CHARGEMENT`.
     */
    SET_STATUT_SAUVEGARDE(state, statut) {
      state.statutSauvegarde = statut;
    },

    /**
     * Enregistre l'horodatage de la dernière écriture réussie. Ignorée par
     * le plugin de persistance (voir `persistancePlugin`).
     * @param {object} state - État racine.
     * @param {string} iso - Horodatage ISO UTC.
     */
    SET_DERNIERE_SAUVEGARDE(state, iso) {
      state.derniereSauvegarde = iso;
    },
  },

  actions: {
    /**
     * Charge l'état persisté au démarrage et hydrate le store, en repliant
     * systématiquement sur l'état par défaut en cas d'absence de données,
     * de corruption, d'incohérence ou de version future. Ne rejette
     * jamais : l'application doit toujours pouvoir démarrer.
     *
     * @param {import('vuex').ActionContext} context
     * @returns {Promise<ResultatChargement>} `'DONNEES'`, `'VIDE'` ou `'ERREUR'`.
     */
    async bootstrap({ commit }) {
      try {
        const doc = await storageRepository.load();
        if (doc === null) {
          commit('REPLACE_ALL', etatParDefaut());
          return 'VIDE';
        }

        const preparation = preparerDocument(doc);
        if (!preparation.ok) {
          console.error(preparation.erreurs);
          throw new Error(preparation.message);
        }
        commit('REPLACE_ALL', fromSaveDocument(preparation.doc));
        return 'DONNEES';
      } catch (e) {
        console.error(e);
        // Conserve une copie du contenu refusé avant qu'une écriture ne
        // l'écrase (idempotent : sans effet si `load` l'a déjà fait).
        storageRepository.conserverCopieCorrompue();
        // N'écrase pas le stockage avec l'état vide : l'erreur reste affichée
        // jusqu'à la première vraie modification.
        commit('REPLACE_ALL', etatParDefaut());
        commit('SET_STATUT_SAUVEGARDE', 'ERREUR_CHARGEMENT');
        return 'ERREUR';
      }
    },

    /**
     * Importe un document de sauvegarde (fichier ou texte JSON), le migre,
     * vérifie son intégrité, puis remplace l'état courant et flush la
     * persistance immédiatement. Ne lève jamais : toute erreur est
     * capturée et renvoyée sous forme de résultat exploitable par la
     * future UI d'import (feature 0008).
     *
     * Logo du cabinet (0039) : un logo non conforme n'empêche jamais l'import ; il est
     * remplacé par `null` (`fromSaveDocument`) et un toast d'avertissement le signale.
     *
     * @param {import('vuex').ActionContext} context
     * @param {File|string} fichierOuTexte - Fichier (`File`, avec `.text()`)
     *   ou chaîne JSON directe.
     * @returns {Promise<{ ok: boolean, message: string, erreurs?: string[] }>}
     */
    async importer({ commit, dispatch, state }, fichierOuTexte) {
      const MESSAGE_GENERIQUE = "L'import a échoué. Le fichier n'a pas pu être utilisé ; vos données actuelles sont conservées.";
      try {
        // Pré-contrôle sans lecture pour un `File` ; une chaîne est contrôlée après lecture.
        const taille = fichierOuTexte?.size;
        if (typeof taille === 'number' && taille > TAILLE_MAX_FICHIER_OCTETS) {
          return { ok: false, message: 'Ce fichier est trop volumineux (10 Mo maximum) pour être une sauvegarde Idelia.' };
        }

        let texte;
        try {
          texte = typeof fichierOuTexte?.text === 'function'
            ? await fichierOuTexte.text()
            : fichierOuTexte;
        } catch {
          return { ok: false, message: 'Impossible de lire le fichier fourni.' };
        }
        if (typeof texte !== 'string' || texte.length > TAILLE_MAX_FICHIER_OCTETS) {
          return { ok: false, message: "Ce fichier n'est pas une sauvegarde Idelia valide." };
        }

        let doc;
        try {
          doc = JSON.parse(texte);
        } catch {
          return { ok: false, message: "Fichier illisible : ce n'est pas un JSON valide." };
        }

        const preparation = preparerDocument(doc);
        if (!preparation.ok) {
          return { ok: false, message: preparation.message, erreurs: preparation.erreurs };
        }

        // Logo non conforme (0039) : jamais bloquant, `fromSaveDocument` le ramène à `null`
        // et on prévient l'utilisatrice après l'enregistrement.
        const logoEcarte = logoNonConforme(preparation.doc.cabinet?.logo);

        commit('REPLACE_ALL', fromSaveDocument(preparation.doc));
        // REPLACE_ALL est filtrée par le plugin, mais les données ont changé :
        // le fichier actif (conservé) sera mis à jour au prochain enregistrement.
        modifieDepuisEcritureFichier = true;
        // `flushImmediat` n'a besoin que de `state`/`commit` : on lui passe le
        // contexte d'action local (module racine non namespacé, il est donc
        // équivalent à ceux exposés par le store complet) plutôt que de
        // dépendre du `this` lié en interne par Vuex aux actions.
        await flushImmediat({ state, commit });
        commit('SET_DERNIERE_SAUVEGARDE', new Date().toISOString());
        commit('SET_STATUT_SAUVEGARDE', 'ENREGISTRE');

        if (logoEcarte) {
          dispatch('notifications/notifier', { type: 'avertissement', message: MESSAGE_LOGO_NON_REPRIS }, { root: true });
        }

        return { ok: true, message: 'Import réussi.' };
      } catch (e) {
        console.error(e);
        return { ok: false, message: MESSAGE_GENERIQUE };
      }
    },

    /**
     * Exporte l'état courant en `SaveDocument` JSON et déclenche le
     * téléchargement du fichier via un lien `<a download>` éphémère.
     *
     * @param {import('vuex').ActionContext} context
     */
    exporter({ state }) {
      const doc = toSaveDocument(state, { schemaVersion: CURRENT_SCHEMA_VERSION });
      const contenu = JSON.stringify(doc, null, 2);
      const blob = new Blob([contenu], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `idelia-sauvegarde-${dateUtil.format(new Date())}.json`;
      lien.click();

      URL.revokeObjectURL(url);
    },

    /**
     * Réinitialise l'état à ses valeurs par défaut et efface les données
     * persistées. La confirmation utilisateur (avant perte de données) est
     * une responsabilité de l'UI appelante, pas du store.
     *
     * @param {import('vuex').ActionContext} context
     * @returns {Promise<void>}
     */
    async reinitialiser({ commit, dispatch }) {
      // Une modification utilisateur en attente recréerait une clé de données
      // juste après l'effacement : on l'annule.
      annulerEcritureEnAttente();
      commit('REPLACE_ALL', etatParDefaut());
      libererFichierEnMemoire(commit);
      modifieDepuisEcritureFichier = false;
      // La base IndexedDB (handle) est supprimée par `clear()`.
      await storageRepository.clear();
      await dispatch('ui/reinitialiserPreferences');
      commit('SET_STATUT_SAUVEGARDE', 'INACTIF');
      commit('SET_DERNIERE_SAUVEGARDE', null);
    },

    // Fichier de sauvegarde actif (feature 0019, ADR 0018) — voir les
    // fonctions ci-dessus pour la documentation détaillée de chacune.
    activerSauvegardeFichier,
    ecrireSauvegardeFichier,
    desactiverSauvegardeFichier,
    declencherSauvegardeAutomatique,
    // Mémorisation du fichier entre les sessions (feature 0032, ADR 0021).
    reprendreSauvegardeFichier,
    confirmerRepriseSauvegardeFichier,
  },

  modules: {
    cabinet,
    personnes,
    tournees,
    absences,
    plannings,
    ui,
    notifications,
    vacancesScolaires,
  },

  plugins: [persistancePlugin],
});
