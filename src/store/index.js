import { createStore } from 'vuex';

import {
  etatParDefaut,
  toSaveDocument,
  fromSaveDocument,
  verifierIntegrite,
} from '@/domain/schema.js';
import { CURRENT_SCHEMA_VERSION, migrate } from '@/storage/migrations.js';
import { storageRepository } from '@/storage/storageRepository.js';
import { dateUtil } from '@/domain/utils/dates.js';

import cabinet from './modules/cabinet';
import personnes from './modules/personnes';
import tournees from './modules/tournees';
import absences from './modules/absences';
import plannings from './modules/plannings';
import ui from './modules/ui';

/**
 * Store racine de l'application (feature 002).
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
 * Plugin de persistance : observe toutes les mutations du store et planifie
 * une écriture débouncée pour toute mutation qui modifie de la donnée
 * persistée.
 *
 * Garde anti-boucle **critique** : ignore les mutations du module `ui`
 * (jamais persisté) ainsi que les mutations de statut de sauvegarde
 * elles-mêmes (`SET_STATUT_SAUVEGARDE`, `SET_DERNIERE_SAUVEGARDE`), sinon
 * chaque écriture réussie redéclencherait une nouvelle écriture, à l'infini.
 *
 * @param {import('vuex').Store} store - Store racine.
 */
function persistancePlugin(store) {
  store.subscribe((mutation) => {
    if (mutation.type.startsWith('ui/')) return;
    if (mutation.type === 'SET_STATUT_SAUVEGARDE' || mutation.type === 'SET_DERNIERE_SAUVEGARDE') {
      return;
    }
    planifier(store);
  });
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
     * @returns {Promise<void>}
     */
    async bootstrap({ commit }) {
      let doc = null;
      try {
        doc = await storageRepository.load();

        if (doc === null) {
          commit('REPLACE_ALL', etatParDefaut());
          return;
        }

        doc = migrate(doc);
        const { ok, erreurs } = verifierIntegrite(doc);
        if (ok) {
          commit('REPLACE_ALL', fromSaveDocument(doc));
        } else {
          console.error(erreurs);
          commit('REPLACE_ALL', etatParDefaut());
          commit('SET_STATUT_SAUVEGARDE', 'ERREUR_CHARGEMENT');
        }
      } catch (e) {
        console.error(e);
        commit('REPLACE_ALL', etatParDefaut());
        commit('SET_STATUT_SAUVEGARDE', 'ERREUR_CHARGEMENT');
      }
    },

    /**
     * Importe un document de sauvegarde (fichier ou texte JSON), le migre,
     * vérifie son intégrité, puis remplace l'état courant et flush la
     * persistance immédiatement. Ne lève jamais : toute erreur est
     * capturée et renvoyée sous forme de résultat exploitable par la
     * future UI d'import (feature 008).
     *
     * @param {import('vuex').ActionContext} context
     * @param {File|string} fichierOuTexte - Fichier (`File`, avec `.text()`)
     *   ou chaîne JSON directe.
     * @returns {Promise<{ ok: boolean, message: string, erreurs?: string[] }>}
     */
    async importer({ commit, state }, fichierOuTexte) {
      let texte;
      try {
        texte = typeof fichierOuTexte?.text === 'function'
          ? await fichierOuTexte.text()
          : fichierOuTexte;
      } catch {
        return { ok: false, message: 'Impossible de lire le fichier fourni.' };
      }

      let doc;
      try {
        doc = JSON.parse(texte);
      } catch {
        return { ok: false, message: "Fichier illisible : ce n'est pas un JSON valide." };
      }

      try {
        doc = migrate(doc);
      } catch (e) {
        return { ok: false, message: e.message };
      }

      const { ok, erreurs } = verifierIntegrite(doc);
      if (!ok) {
        return { ok: false, message: 'La sauvegarde contient des incohérences.', erreurs };
      }

      commit('REPLACE_ALL', fromSaveDocument(doc));
      // `flushImmediat` n'a besoin que de `state`/`commit` : on lui passe le
      // contexte d'action local (module racine non namespacé, il est donc
      // équivalent à ceux exposés par le store complet) plutôt que de
      // dépendre du `this` lié en interne par Vuex aux actions.
      await flushImmediat({ state, commit });
      commit('SET_DERNIERE_SAUVEGARDE', new Date().toISOString());
      commit('SET_STATUT_SAUVEGARDE', 'ENREGISTRE');

      return { ok: true, message: 'Import réussi.' };
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
    async reinitialiser({ commit }) {
      commit('REPLACE_ALL', etatParDefaut());
      await storageRepository.clear();
    },
  },

  modules: {
    cabinet,
    personnes,
    tournees,
    absences,
    plannings,
    ui,
  },

  plugins: [persistancePlugin],
});
