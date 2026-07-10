/**
 * Module Vuex — plannings.
 *
 * State shape (feature 0002) : `{ items: [], selectionId: null }`, hydraté
 * par `app/bootstrap` (voir `src/store/index.js`) via la mutation
 * `REPLACE`. Module **persisté** (voir ADR 0005) pour `items` uniquement :
 * `selectionId` est une sélection volatile, non sérialisée dans le
 * `SaveDocument` (voir `src/domain/schema.js`). Aucun accès `localStorage`
 * ici : la persistance est gérée par le plugin dédié du store racine.
 *
 * Génération (feature 0010) : l'appel au moteur pur (`@/domain/scheduling`)
 * passe **uniquement** par les actions `genererPropose`/`evaluerCourant`
 * (ADR 0008) ; la construction du `Planning` est déléguée au domaine
 * (`@/domain/planning.js`, `creerPlanning`). Les diagnostics (violations,
 * tournées non couvertes, score) ne sont **jamais** persistés : ils sont
 * retournés à l'appelant (`genererPropose`) ou recalculés à la demande
 * (`evaluerCourant`).
 *
 * Édition manuelle (feature 0011) : `ajouterAffectation`/`retirerAffectation`/
 * `deplacerAffectation`/`basculerVerrouillage` appliquent chacune un geste
 * d'édition sur les affectations du planning courant, via le domaine
 * (`creerAffectationManuelle`) et le moteur pur (`appliquerChangement`,
 * ADR 0008 — jamais appelé depuis un composant). Chaque geste capture au
 * préalable un instantané volatil (`snapshotEdition`, non sérialisé) des
 * affectations d'avant.
 *
 * Undo (feature 0011, tâche 2) : `annulerDerniereEdition` restaure ce
 * snapshot (`RESTAURER_SNAPSHOT`) puis l'efface — undo **1 niveau, sans
 * redo**. Le getter `peutAnnuler` invalide automatiquement un snapshot
 * devenu obsolète (autre planning sélectionné) en comparant
 * `snapshotEdition.planningId` au planning courant.
 *
 * Régénération en place (feature 0011, tâche 6) : `regenerer` remplace les
 * affectations du planning **courant** (mutation `UPDATE_AFFECTATIONS` sur
 * le même `id`, jamais `ADD`/`SELECT` d'un nouveau `Planning`), en
 * préservant les affectations verrouillées. Retourne le `Resultat` complet
 * du moteur (comme `genererPropose`), pour que la vue alimente ses
 * diagnostics volatils sans second passage moteur.
 */
import { genererPlanning, diagnostiquer, appliquerChangement } from '@/domain/scheduling';
import { creerPlanning, creerAffectationManuelle, resumerDiagnostic } from '@/domain/planning.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Assemble l'`Entree` du moteur (typedef `0009 §5.2`) à partir des sources
 * du store, sans logique métier (simple collecte). Le moteur filtre lui-même
 * les tournées applicables et les absences par statut (`0009 §5.4`/`§7`).
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
  state: () => ({ items: [], selectionId: null, snapshotEdition: null }),
  getters: {
    byId: (state) => (id) => state.items.find((pl) => pl.id === id),
    courant: (state, getters) =>
      state.selectionId ? getters.byId(state.selectionId) : null,
    /**
     * `true` uniquement si un snapshot d'annulation existe **et** cible le
     * planning courant. La comparaison `planningId === courant.id` invalide
     * automatiquement un snapshot devenu obsolète (nouvelle génération qui
     * sélectionne un autre planning, import qui remplace tout) : le bouton
     * « Annuler » se désactive de lui-même, sans nettoyage transverse.
     * @param {{ snapshotEdition: (Object|null) }} state
     * @param {Object} getters
     * @returns {boolean}
     */
    peutAnnuler: (state, getters) =>
      !!state.snapshotEdition && !!getters.courant && state.snapshotEdition.planningId === getters.courant.id,
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
    /**
     * Remplace immuablement les affectations du planning `id` (jamais de
     * mutation en place) et bump son `updatedAt`. Met à jour
     * `parametresGeneration` uniquement si fourni (régénération, feature
     * `0011` tâche 6) : les gestes d'édition manuelle ne le touchent pas.
     * @param {{ items: object[] }} state
     * @param {{ id: string, affectations: object[], parametresGeneration?: (Object|null) }} payload
     */
    UPDATE_AFFECTATIONS(state, { id, affectations, parametresGeneration }) {
      state.items = state.items.map((pl) =>
        pl.id === id
          ? {
              ...pl,
              affectations,
              updatedAt: new Date().toISOString(),
              ...(parametresGeneration !== undefined ? { parametresGeneration } : {}),
            }
          : pl
      );
    },
    /**
     * Capture un instantané volatil des affectations d'un planning, pris
     * juste avant un geste d'édition (undo 1-niveau, non sérialisé — ne
     * touche jamais `items`).
     * @param {{ snapshotEdition: (Object|null) }} state
     * @param {{ planningId: string, affectations: object[] }} payload
     */
    CAPTURER_SNAPSHOT(state, { planningId, affectations }) {
      state.snapshotEdition = { planningId, affectations: [...affectations] };
    },
    /**
     * Réapplique le snapshot d'annulation au planning ciblé (immuable, bump
     * `updatedAt`), puis **efface** le snapshot : undo 1-niveau, après
     * annulation il n'y a plus rien à annuler (pas de redo). No-op si aucun
     * snapshot n'existe.
     * @param {{ items: object[], snapshotEdition: (Object|null) }} state
     */
    RESTAURER_SNAPSHOT(state) {
      const snap = state.snapshotEdition;
      if (!snap) return;
      state.items = state.items.map((pl) =>
        pl.id === snap.planningId
          ? { ...pl, affectations: snap.affectations, updatedAt: new Date().toISOString() }
          : pl
      );
      state.snapshotEdition = null;
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
    /**
     * Ajoute une affectation posée à la main (`origine: 'MANUEL'`) sur le
     * planning courant. Capture un snapshot des affectations d'avant le
     * geste, puis délègue au domaine (`creerAffectationManuelle`) et au
     * moteur pur (`appliquerChangement`, ADR 0008). Ne recalcule pas les
     * diagnostics (recalcul volatil laissé à la vue, `evaluerCourant`).
     *
     * @param {import('vuex').ActionContext} context
     * @param {{ tourneeId: string, personneId: string, date: string, creneau: string }} payload
     */
    ajouterAffectation({ commit, getters }, { tourneeId, personneId, date, creneau }) {
      const courant = getters.courant;
      if (!courant) return;

      commit('CAPTURER_SNAPSHOT', { planningId: courant.id, affectations: courant.affectations });

      const affectation = creerAffectationManuelle(personneId, tourneeId, date, creneau);
      const affectations = appliquerChangement(courant.affectations, { type: 'AJOUTER', affectation });

      commit('UPDATE_AFFECTATIONS', { id: courant.id, affectations });
    },
    /**
     * Retire une affectation du planning courant (immuable, via le moteur
     * pur). Capture un snapshot des affectations d'avant le geste.
     *
     * @param {import('vuex').ActionContext} context
     * @param {{ affectationId: string }} payload
     */
    retirerAffectation({ commit, getters }, { affectationId }) {
      const courant = getters.courant;
      if (!courant) return;

      commit('CAPTURER_SNAPSHOT', { planningId: courant.id, affectations: courant.affectations });

      const affectations = appliquerChangement(courant.affectations, { type: 'RETIRER', affectationId });

      commit('UPDATE_AFFECTATIONS', { id: courant.id, affectations });
    },
    /**
     * Déplace une affectation existante vers une autre case (tournée/date/
     * créneau), en **préservant son identité** : même `id`, `verrouillee`
     * et `commentaire` (le verrou suit l'affectation à destination). Ne
     * fabrique pas d'affectation neuve (pas de `creerAffectationManuelle`) :
     * la destination est construite par spread de la source. Capture un
     * snapshot des affectations d'avant le geste.
     *
     * @param {import('vuex').ActionContext} context
     * @param {{ affectationId: string, versTourneeId: string, versDate: string, versCreneau: string }} payload
     */
    deplacerAffectation({ commit, getters }, { affectationId, versTourneeId, versDate, versCreneau }) {
      const courant = getters.courant;
      if (!courant) return;

      commit('CAPTURER_SNAPSHOT', { planningId: courant.id, affectations: courant.affectations });

      const source = courant.affectations.find((a) => a.id === affectationId);
      const destination = {
        ...source,
        tourneeId: versTourneeId,
        date: versDate,
        creneau: versCreneau,
        origine: 'MANUEL',
        updatedAt: new Date().toISOString(),
        // id, verrouillee, commentaire, personneId, createdAt : préservés (spread de la source)
      };
      const affectations = appliquerChangement(courant.affectations, {
        type: 'DEPLACER',
        affectationId,
        affectation: destination,
      });

      commit('UPDATE_AFFECTATIONS', { id: courant.id, affectations });
    },
    /**
     * Bascule le verrouillage (`verrouillee`) d'une affectation du planning
     * courant et bump son `updatedAt`. Change un champ, pas une position :
     * n'appelle pas `appliquerChangement`. Capture un snapshot des
     * affectations d'avant le geste (le verrouillage est annulable).
     *
     * @param {import('vuex').ActionContext} context
     * @param {{ affectationId: string }} payload
     */
    basculerVerrouillage({ commit, getters }, { affectationId }) {
      const courant = getters.courant;
      if (!courant) return;

      commit('CAPTURER_SNAPSHOT', { planningId: courant.id, affectations: courant.affectations });

      const affectations = courant.affectations.map((a) =>
        a.id === affectationId ? { ...a, verrouillee: !a.verrouillee, updatedAt: new Date().toISOString() } : a
      );

      commit('UPDATE_AFFECTATIONS', { id: courant.id, affectations });
    },
    /**
     * Régénère **en place** les affectations du planning courant (mutation
     * `UPDATE_AFFECTATIONS` sur le **même** `id`, jamais un nouveau
     * `Planning` — complément de `genererPropose`) : le reste des slots est
     * reconstruit par le moteur pur, en **préservant à l'identique** les
     * affectations verrouillées (`entree.affectationsVerrouillees`, ADR
     * 0007). Capture un snapshot des affectations d'avant le geste (une
     * régénération est annulable, comme les gestes d'édition manuelle).
     *
     * Sémantique de `variante` (§4.5) : reconstruit la graine de **base**
     * à partir de `planning.parametresGeneration` (= `Resultat.meta` d'une
     * génération précédente, où `meta.seed` est la graine **effective** =
     * base + variante) puis choisit la graine effective à utiliser —
     * `variante: false` (« à l'identique ») conserve la **même** graine
     * effective, `variante: true` (« essayer une variante ») incrémente la
     * variante à base inchangée (déterministe et progressif, `0009` §6). Si
     * `parametresGeneration` est absent/altéré (import ancien), repli sur
     * `{ seed: 0, variante: 0 }` — dégradé mais sans plantage.
     *
     * @param {import('vuex').ActionContext} context
     * @param {{ variante?: boolean }} [payload]
     * @returns {import('@/domain/scheduling/modele/types.js').Resultat|undefined} Résultat complet du moteur, pour que l'appelant alimente ses diagnostics volatils sans second passage moteur.
     */
    regenerer({ commit, getters, rootGetters, rootState }, { variante = false } = {}) {
      const planning = getters.courant;
      if (!planning) return undefined;

      commit('CAPTURER_SNAPSHOT', { planningId: planning.id, affectations: planning.affectations });

      const pg = planning.parametresGeneration ?? { seed: 0, variante: 0 };
      const base = (pg.seed ?? 0) - (pg.variante ?? 0);
      const options = variante
        ? { seed: base, variante: (pg.variante ?? 0) + 1 }
        : { seed: base, variante: pg.variante ?? 0 };

      const entree = assemblerEntree(rootGetters, rootState, { debut: planning.dateDebut, fin: planning.dateFin });
      entree.affectationsVerrouillees = planning.affectations.filter((a) => a.verrouillee);

      const resultat = genererPlanning(entree, options);

      commit('UPDATE_AFFECTATIONS', {
        id: planning.id,
        affectations: resultat.affectations,
        parametresGeneration: resultat.meta,
      });

      return resultat;
    },
    /**
     * Annule le dernier geste d'édition (ou la dernière régénération) en
     * restaurant le snapshot pris juste avant. No-op si rien n'est
     * annulable (`peutAnnuler`). Lecture seule vis-à-vis du moteur (aucun
     * appel) : c'est la vue qui rafraîchit ensuite ses diagnostics.
     *
     * @param {import('vuex').ActionContext} context
     */
    annulerDerniereEdition({ commit, getters }) {
      if (!getters.peutAnnuler) return;
      commit('RESTAURER_SNAPSHOT');
    },
    /**
     * Résume les conflits (`{ nbErreurs, nbAvertissements, nbNonCouvertes,
     * aResoudre }`) de chaque planning fourni, en le ré-évaluant contre les
     * données courantes (comme `evaluerCourant`). Lecture seule : **aucun**
     * `commit`, ne modifie ni `selectionId` ni `items`. Réutilise le helper
     * interne `assemblerEntree` et le moteur pur `diagnostiquer` (ADR 0008) ;
     * la synthèse est déléguée au domaine (`resumerDiagnostic`). Feature
     * `0013` (tableau de bord) — seule brique côté store de la feature.
     *
     * @param {import('vuex').ActionContext} context
     * @param {{ plannings: object[] }} payload - `Planning[]` à évaluer
     *   (liste plafonnée choisie par l'appelant, ex. plannings récents + le
     *   planning pertinent).
     * @returns {Object<string, {nbErreurs: number, nbAvertissements: number, nbNonCouvertes: number, aResoudre: number}>} Résumé par id de planning.
     */
    resumeConflits({ rootGetters, rootState }, { plannings }) {
      const resume = {};
      for (const pl of plannings) {
        const entree = assemblerEntree(rootGetters, rootState, { debut: pl.dateDebut, fin: pl.dateFin });
        const diagnostic = diagnostiquer(pl.affectations, entree);
        resume[pl.id] = resumerDiagnostic(diagnostic);
      }
      return resume;
    },
  },
};
