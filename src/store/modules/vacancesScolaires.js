import { recupererCalendrierScolaire } from '@/adaptateurs/calendrierScolaire.js';
import { dateUtil } from '@/domain/utils/dates.js';
import {
  anneeScolaireDe,
  anneesManquantes,
  messageVacances,
  normaliserReponseCalendrierScolaire,
  normaliserZoneScolaire,
  periodesDeZone,
  zoneScolaireParCode,
} from '@/domain/calendrier/vacancesScolaires.js';

/**
 * Module Vuex — vacances scolaires (feature 0023, ADR 0020).
 *
 * Cache **persisté** (par le plugin du store racine, jamais d'accès direct au
 * stockage ici) des vacances de la zone choisie dans les Paramètres, par
 * année scolaire. Seul module qui déclenche du réseau, et uniquement via
 * l'adaptateur `recupererCalendrierScolaire`. Aucune logique de dates ici :
 * tout vient de `src/domain/calendrier/`.
 *
 * Les actions **ne rejettent jamais** et renvoient un `ResultatVacances`.
 */

/**
 * @typedef {Object} ResultatVacances
 * @property {boolean} ok
 * @property {('SANS_ZONE'|'A_JOUR'|'MIS_A_JOUR'|'ECHEC')} etat
 * @property {string} message - Message FR prêt à afficher (vide si rien à dire).
 */

// ---------------------------------------------------------------------------
// Volatil (jamais persisté) : variables de module, comme `minuteur` dans ui.js
// ---------------------------------------------------------------------------

/**
 * Échecs de la session, indexés par `zone|annee` → code d'erreur
 * (`HORS_LIGNE`, `DELAI_DEPASSE`, `ERREUR_SERVICE`, `REPONSE_INVALIDE`,
 * `NON_PUBLIEE`). Évite de solliciter le service à chaque navigation.
 * @type {Map<string, string>}
 */
const echecsSession = new Map();

/**
 * Requêtes en cours, indexées par `zone|annee` (dédoublonnage).
 * @type {Map<string, Promise<{ ok: true, periodes: object[] } | { ok: false, erreur: string }>>}
 */
const requetesEnCours = new Map();

/** Un seul toast d'avertissement par session. */
let toastEmis = false;

/** @param {string} zone @param {string} annee @returns {string} */
const cle = (zone, annee) => `${zone}|${annee}`;

/**
 * Récupère une année scolaire pour une zone (sans toucher au store).
 * Réponse vide → `NON_PUBLIEE` (jamais mise en cache).
 *
 * @param {string} zone - Code de zone.
 * @param {string} anneeScolaire
 * @returns {Promise<{ ok: true, periodes: object[] } | { ok: false, erreur: string }>}
 */
function recupererAnnee(zone, anneeScolaire) {
  const k = cle(zone, anneeScolaire);
  if (requetesEnCours.has(k)) return requetesEnCours.get(k);

  const definition = zoneScolaireParCode(zone);
  if (!definition) return Promise.resolve({ ok: false, erreur: 'REPONSE_INVALIDE' });

  const promesse = (async () => {
    try {
      const reponse = await recupererCalendrierScolaire({
        valeurZone: definition.valeurApi,
        anneeScolaire,
      });
      if (!reponse.ok) return { ok: false, erreur: reponse.erreur };
      const periodes = normaliserReponseCalendrierScolaire(reponse.enregistrements, {
        zone,
        anneeScolaire,
      });
      if (periodes === null) return { ok: false, erreur: 'REPONSE_INVALIDE' };
      if (periodes.length === 0) return { ok: false, erreur: 'NON_PUBLIEE' };
      return { ok: true, periodes };
    } catch (e) {
      console.warn('[Idelia] Vacances scolaires : récupération impossible.', e?.name);
      return { ok: false, erreur: 'REPONSE_INVALIDE' };
    } finally {
      requetesEnCours.delete(k);
    }
  })();
  requetesEnCours.set(k, promesse);
  return promesse;
}

/**
 * Récupère une à une les années demandées et enregistre les succès (sauf si la
 * zone a changé entre-temps). Mémorise les échecs de session.
 *
 * @param {{ commit: Function, getters: object }} ctx
 * @param {string} zone
 * @param {string[]} annees
 * @returns {Promise<{ reussies: string[], echecs: Array<{ anneeScolaire: string, erreur: string }> }>}
 */
async function recupererAnnees({ commit, getters }, zone, annees) {
  const reussies = [];
  const echecs = [];
  for (const anneeScolaire of annees) {
    const resultat = await recupererAnnee(zone, anneeScolaire);
    if (getters.zoneCourante !== zone) continue; // zone changée pendant la requête : résultat obsolète
    if (resultat.ok) {
      echecsSession.delete(cle(zone, anneeScolaire));
      commit('ENREGISTRER', {
        zone,
        anneeScolaire,
        periodes: resultat.periodes,
        recupereLe: new Date().toISOString(),
      });
      reussies.push(anneeScolaire);
    } else {
      echecsSession.set(cle(zone, anneeScolaire), resultat.erreur);
      echecs.push({ anneeScolaire, erreur: resultat.erreur });
    }
  }
  return { reussies, echecs };
}

/**
 * @param {{ erreur: string, anneeScolaire: string }} echec
 * @param {boolean} avecCache
 * @returns {string}
 */
function messageEchec(echec, avecCache) {
  return messageVacances(echec.erreur, { anneeScolaire: echec.anneeScolaire, avecCache });
}

export default {
  namespaced: true,
  state: () => ({ entrees: [] }),

  getters: {
    entrees: (state) => state.entrees,
    /** Code de la zone choisie dans les Paramètres, ou `null`. */
    zoneCourante: (state, getters, rootState) => rootState.cabinet.parametres?.zoneScolaire ?? null,
    /** Périodes de vacances de la zone courante, à plat. */
    periodesZoneCourante: (state, getters) => periodesDeZone(state.entrees, getters.zoneCourante),
    /** Entrées de la zone courante, triées par année scolaire. */
    entreesZoneCourante: (state, getters) =>
      state.entrees
        .filter((e) => getters.zoneCourante && e.zone === getters.zoneCourante)
        .sort((a, b) => (a.anneeScolaire < b.anneeScolaire ? -1 : a.anneeScolaire > b.anneeScolaire ? 1 : 0)),
  },

  mutations: {
    /**
     * Hydratation (cache déjà normalisé par `fromSaveDocument`).
     * @param {{ entrees: object[] }} state
     * @param {object[]} entrees
     */
    REPLACE(state, entrees) {
      state.entrees = entrees;
    },
    /**
     * Remplace l'entrée du couple (zone, année), ou l'ajoute.
     * @param {{ entrees: object[] }} state
     * @param {{ zone: string, anneeScolaire: string, periodes: object[], recupereLe: string }} entree
     */
    ENREGISTRER(state, { zone, anneeScolaire, periodes, recupereLe }) {
      const entree = { zone, anneeScolaire, recupereLe, periodes };
      const autres = state.entrees.filter((e) => !(e.zone === zone && e.anneeScolaire === anneeScolaire));
      state.entrees = [...autres, entree];
    },
    /**
     * Supprime les entrées des autres zones (`null` → tout supprimer).
     * @param {{ entrees: object[] }} state
     * @param {(string|null)} zone
     */
    GARDER_ZONE(state, zone) {
      state.entrees = zone ? state.entrees.filter((e) => e.zone === zone) : [];
    },
  },

  actions: {
    /**
     * Vérifie que les vacances de la période sont en cache et récupère, en
     * arrière-plan, les années manquantes seulement. Une année déjà en échec
     * dans la session n'est pas redemandée (sauf `forcer`). Au plus un toast
     * d'avertissement par session. Aucune requête sans zone. Ne rejette jamais.
     *
     * @param {import('vuex').ActionContext} context
     * @param {{ dateDebut: string, dateFin: string, silencieux?: boolean, forcer?: boolean }} payload
     * @returns {Promise<ResultatVacances>}
     */
    async assurerCouverture(context, { dateDebut, dateFin, silencieux = false, forcer = false } = {}) {
      try {
        const { state, getters, dispatch } = context;
        const zone = getters.zoneCourante;
        if (!zone) return { ok: true, etat: 'SANS_ZONE', message: '' };

        const manquantes = anneesManquantes(state.entrees, zone, dateDebut, dateFin);
        if (manquantes.length === 0) return { ok: true, etat: 'A_JOUR', message: '' };

        const avecCache = state.entrees.some((e) => e.zone === zone);
        const dejaEnEchec = forcer ? [] : manquantes.filter((a) => echecsSession.has(cle(zone, a)));
        const aDemander = manquantes.filter((a) => !dejaEnEchec.includes(a));

        const { echecs } = await recupererAnnees(context, zone, aDemander);
        const tousEchecs = [
          ...dejaEnEchec.map((a) => ({ anneeScolaire: a, erreur: echecsSession.get(cle(zone, a)) })),
          ...echecs,
        ];
        if (tousEchecs.length === 0) return { ok: true, etat: 'MIS_A_JOUR', message: '' };

        if (!silencieux && !toastEmis && echecs.length > 0) {
          toastEmis = true;
          dispatch(
            'notifications/notifier',
            { type: 'avertissement', message: messageVacances('TOAST') },
            { root: true }
          );
        }
        return { ok: false, etat: 'ECHEC', message: messageEchec(tousEchecs[0], avecCache) };
      } catch (e) {
        console.warn('[Idelia] Vacances scolaires : erreur inattendue.', e?.name);
        return { ok: false, etat: 'ECHEC', message: messageVacances('REPONSE_INVALIDE') };
      }
    },

    /**
     * Mise à jour manuelle (bouton des Paramètres) : redemande les années déjà
     * en cache pour la zone et l'année scolaire en cours. Les années en échec
     * gardent leur ancienne entrée. Pas de toast : le résultat est renvoyé.
     * Ne rejette jamais.
     *
     * @param {import('vuex').ActionContext} context
     * @returns {Promise<ResultatVacances>}
     */
    async mettreAJour(context) {
      try {
        const { state, getters } = context;
        const zone = getters.zoneCourante;
        if (!zone) return { ok: true, etat: 'SANS_ZONE', message: '' };

        echecsSession.clear();
        const annees = [
          ...new Set([
            ...state.entrees.filter((e) => e.zone === zone).map((e) => e.anneeScolaire),
            anneeScolaireDe(dateUtil.format(new Date())),
          ]),
        ].sort();
        const avecCache = state.entrees.some((e) => e.zone === zone);

        const { reussies, echecs } = await recupererAnnees(context, zone, annees);
        if (getters.zoneCourante !== zone) return { ok: true, etat: 'SANS_ZONE', message: '' };
        if (echecs.length > 0) {
          return { ok: false, etat: 'ECHEC', message: messageEchec(echecs[0], avecCache) };
        }
        return {
          ok: true,
          etat: 'MIS_A_JOUR',
          message: messageVacances('MIS_A_JOUR', { zone, annees: reussies }),
        };
      } catch (e) {
        console.warn('[Idelia] Vacances scolaires : erreur inattendue.', e?.name);
        return { ok: false, etat: 'ECHEC', message: messageVacances('REPONSE_INVALIDE') };
      }
    },

    /**
     * Change la zone : enregistre le choix, oublie les dates des autres zones,
     * puis récupère l'année en cours si une zone est choisie. Sans zone
     * (« Aucune »), aucune requête. Ne rejette jamais.
     *
     * @param {import('vuex').ActionContext} context
     * @param {(string|null)} code - Code de zone (`null` ou inconnu = aucune).
     * @returns {Promise<ResultatVacances>}
     */
    async changerZone({ commit, dispatch }, code) {
      const zone = normaliserZoneScolaire(code);
      await dispatch('cabinet/majParametres', { zoneScolaire: zone }, { root: true });
      commit('GARDER_ZONE', zone);
      echecsSession.clear();
      if (!zone) return { ok: true, etat: 'SANS_ZONE', message: '' };
      return dispatch('mettreAJour');
    },
  },
};
