/**
 * Vacances scolaires (feature 0023) : zones, années scolaires, normalisation
 * pure d'une réponse de l'API du calendrier scolaire (ADR 0020).
 *
 * Module pur : aucun import Vue/Vuex, aucun `fetch` (l'accès réseau vit dans
 * `src/adaptateurs/calendrierScolaire.js`). Dates via `dateUtil` (ADR 0010).
 */

import { dateUtil } from '../utils/dates.js';

/**
 * @typedef {Object} PeriodeVacances
 * @property {string} libelle - Ex. « Vacances de la Toussaint » (80 car. max).
 * @property {string} debut - `"YYYY-MM-DD"`, dernier jour de cours, inclus.
 * @property {string} fin - `"YYYY-MM-DD"`, veille de la reprise, incluse.
 */

/**
 * @typedef {Object} EntreeVacances
 * @property {string} zone - Code de `ZONES_SCOLAIRES`.
 * @property {string} anneeScolaire - `"AAAA-AAAA"`.
 * @property {(string|null)} recupereLe - Horodatage ISO UTC.
 * @property {PeriodeVacances[]} periodes
 */

/**
 * @typedef {Object} ZoneScolaire
 * @property {string} code - Code stable stocké dans les sauvegardes.
 * @property {string} libelle - Libellé de la liste déroulante.
 * @property {string} court - Libellé court (« zone A », « La Réunion »).
 * @property {string} valeurApi - Valeur exacte du champ `zones` de l'API.
 */

/** @type {ReadonlyArray<ZoneScolaire>} */
export const ZONES_SCOLAIRES = Object.freeze(
  [
    {
      code: 'ZONE_A',
      libelle: 'Zone A — Besançon, Bordeaux, Clermont-Ferrand, Dijon, Grenoble, Limoges, Lyon, Poitiers',
      court: 'zone A',
      valeurApi: 'Zone A',
    },
    {
      code: 'ZONE_B',
      libelle:
        'Zone B — Aix-Marseille, Amiens, Lille, Nancy-Metz, Nantes, Nice, Normandie, Orléans-Tours, Reims, Rennes, Strasbourg',
      court: 'zone B',
      valeurApi: 'Zone B',
    },
    {
      code: 'ZONE_C',
      libelle: 'Zone C — Créteil, Montpellier, Paris, Toulouse, Versailles',
      court: 'zone C',
      valeurApi: 'Zone C',
    },
    { code: 'CORSE', libelle: 'Corse', court: 'Corse', valeurApi: 'Corse' },
    { code: 'GUADELOUPE', libelle: 'Guadeloupe', court: 'Guadeloupe', valeurApi: 'Guadeloupe' },
    { code: 'MARTINIQUE', libelle: 'Martinique', court: 'Martinique', valeurApi: 'Martinique' },
    { code: 'GUYANE', libelle: 'Guyane', court: 'Guyane', valeurApi: 'Guyane' },
    // L'API écrit « Réunion » (sans article) : constaté par sonde réelle.
    { code: 'REUNION', libelle: 'La Réunion', court: 'La Réunion', valeurApi: 'Réunion' },
    { code: 'MAYOTTE', libelle: 'Mayotte', court: 'Mayotte', valeurApi: 'Mayotte' },
  ].map((z) => Object.freeze(z)),
);

const LIBELLE_MAX = 80;
const ENREGISTREMENTS_MAX = 500;
const DUREE_MAX_JOURS = 120;
const ANNEES_MAX = 4;
const MOIS_MAX = 120; // garde-fou d'itérations de anneesScolairesCouvrant
const PERIODES_PAR_ENTREE_MAX = 50;
const ENTREES_MAX = 10;
const RE_ANNEE_SCOLAIRE = /^\d{4}-\d{4}$/;

/**
 * Texte sans accents ni casse ni espaces superflus, pour comparaison tolérante.
 * @param {*} v
 * @returns {string}
 */
function comparable(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @param {*} v
 * @returns {(string|null)} Code de zone connu, sinon `null`.
 */
export function normaliserZoneScolaire(v) {
  return ZONES_SCOLAIRES.some((z) => z.code === v) ? v : null;
}

/**
 * @param {*} code
 * @returns {(ZoneScolaire|undefined)}
 */
export function zoneScolaireParCode(code) {
  return ZONES_SCOLAIRES.find((z) => z.code === code);
}

/**
 * Année scolaire (« AAAA-AAAA ») d'une date : septembre à décembre ouvrent
 * l'année scolaire, janvier à août la terminent. Arithmétique de chaînes.
 *
 * @param {string} date - `"YYYY-MM-DD"`.
 * @returns {string}
 */
export function anneeScolaireDe(date) {
  const annee = Number(date.slice(0, 4));
  const mois = Number(date.slice(5, 7));
  return mois >= 9 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
}

/**
 * Années scolaires à connaître pour couvrir une période : celles de chaque mois,
 * plus l'année précédente pour tout mois de septembre (les vacances d'été
 * appartiennent à l'année qui se termine et durent jusqu'à la rentrée).
 *
 * @param {string} dateDebut - `"YYYY-MM-DD"`.
 * @param {string} dateFin - `"YYYY-MM-DD"`.
 * Plafond : **4 années scolaires au plus** (les plus anciennes, donc celles qui
 * couvrent le début de la période, dans l'ordre) — une période très longue ne
 * déclenche jamais plus de 4 requêtes. Dates invalides ou inversées : `[]`.
 *
 * @returns {string[]} Triées, sans doublon, 4 au plus.
 */
export function anneesScolairesCouvrant(dateDebut, dateFin) {
  if (!dateUtil.estDateValide(dateDebut) || !dateUtil.estDateValide(dateFin) || dateDebut > dateFin) return [];
  const annees = new Set();
  const ajouter = (date) => {
    annees.add(anneeScolaireDe(date));
    if (date.slice(5, 7) === '09') {
      const a = Number(date.slice(0, 4));
      annees.add(`${a - 1}-${a}`);
    }
  };
  ajouter(dateDebut);
  ajouter(dateFin);
  let mois = dateUtil.debutMois(dateDebut);
  for (let i = 0; i < MOIS_MAX && mois <= dateFin && annees.size < ANNEES_MAX + 1; i++) {
    ajouter(mois);
    mois = dateUtil.moisSuivant(mois);
  }
  return [...annees].sort().slice(0, ANNEES_MAX);
}

/**
 * Normalise la réponse brute de l'API du calendrier scolaire en périodes.
 *
 * Règles :
 * 1. 500 premiers enregistrements seulement ; non-objets ignorés.
 * 2. Filtrage défensif : `zones` égal à la `valeurApi` de la zone et
 *    `annee_scolaire` égal à l'année demandée (quand présents).
 * 3. Lignes dont `population` commence par « Enseignants » écartées
 *    (comparaison sans casse ni accents) ; « Élèves… », « - », vide conservés.
 * 4. Libellé = `description` nettoyée, 80 caractères max ; vide : ignorée.
 * 5. Dates : instants avec fuseau (minuit local) convertis par
 *    `dateUtil.dateCalendaireDepuisInstant` (jamais de découpage de chaîne).
 * 6. `debut` = jour de `start_date` (dernier jour de cours) ; `fin` = jour de
 *    `end_date` moins 1 (veille de la reprise). Si `end_date` <= `start_date`
 *    (ex. pont d'un seul jour), la période est [debut, debut]. Ignorée si une
 *    date est invalide ou si la durée dépasse 120 jours.
 * 7. Dédoublonnage par `libelle|debut|fin` ; tri par `debut` puis `libelle`.
 * 8. Un résultat vide est renvoyé tel quel (`[]`) : à ne pas mettre en cache.
 *
 * @param {*} enregistrements - Tableau d'enregistrements bruts de l'API.
 * @param {{ zone: string, anneeScolaire: string }} options - `zone` : code de zone.
 * @returns {(PeriodeVacances[]|null)} `null` si la réponse n'est pas un tableau.
 */
export function normaliserReponseCalendrierScolaire(enregistrements, { zone, anneeScolaire }) {
  if (!Array.isArray(enregistrements)) return null;
  const valeurZone = zoneScolaireParCode(zone)?.valeurApi;
  if (!valeurZone) return [];
  const zoneAttendue = comparable(valeurZone);
  const parCle = new Map();

  for (const rec of enregistrements.slice(0, ENREGISTREMENTS_MAX)) {
    if (rec === null || typeof rec !== 'object' || Array.isArray(rec)) continue;
    if (rec.zones != null && comparable(rec.zones) !== zoneAttendue) continue;
    if (rec.annee_scolaire != null && String(rec.annee_scolaire).trim() !== anneeScolaire) continue;
    if (comparable(rec.population).startsWith('enseignants')) continue;
    if (typeof rec.description !== 'string') continue;
    const libelle = rec.description.replace(/\s+/g, ' ').trim().slice(0, LIBELLE_MAX).trim();
    if (!libelle) continue;
    const debut = dateUtil.dateCalendaireDepuisInstant(rec.start_date);
    const reprise = dateUtil.dateCalendaireDepuisInstant(rec.end_date);
    if (!debut || !reprise) continue;
    const fin = reprise <= debut ? debut : dateUtil.addDays(reprise, -1);
    if (dateUtil.diffDays(debut, fin) + 1 > DUREE_MAX_JOURS) continue;
    const cle = `${libelle}|${debut}|${fin}`;
    if (!parCle.has(cle)) parCle.set(cle, { libelle, debut, fin });
  }

  return [...parCle.values()].sort(
    (a, b) => (a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0) || a.libelle.localeCompare(b.libelle, 'fr'),
  );
}

/**
 * @param {*} p
 * @returns {(PeriodeVacances|null)} Période revalidée, ou `null`.
 */
function normaliserPeriode(p) {
  if (p === null || typeof p !== 'object') return null;
  if (typeof p.libelle !== 'string') return null;
  const libelle = p.libelle.trim();
  if (!libelle || libelle.length > LIBELLE_MAX) return null;
  if (!dateUtil.estDateValide(p.debut) || !dateUtil.estDateValide(p.fin)) return null;
  if (p.debut > p.fin) return null;
  if (dateUtil.diffDays(p.debut, p.fin) + 1 > DUREE_MAX_JOURS) return null;
  return { libelle, debut: p.debut, fin: p.fin };
}

/**
 * Normalise le cache persisté : ne lève jamais, filtre ce qui est invalide,
 * garde la dernière entrée en cas de doublon (zone, année). Plafonds : 50 périodes
 * par entrée, 10 entrées au total (les plus récentes du tableau).
 *
 * @param {*} valeur
 * @returns {EntreeVacances[]}
 */
export function normaliserCacheVacances(valeur) {
  if (!Array.isArray(valeur)) return [];
  const parCle = new Map();
  for (const e of valeur) {
    if (e === null || typeof e !== 'object') continue;
    const zone = normaliserZoneScolaire(e.zone);
    if (!zone) continue;
    const annee = e.anneeScolaire;
    if (typeof annee !== 'string' || !RE_ANNEE_SCOLAIRE.test(annee)) continue;
    if (Number(annee.slice(5)) !== Number(annee.slice(0, 4)) + 1) continue;
    if (!Array.isArray(e.periodes)) continue;
    const periodes = e.periodes.slice(0, PERIODES_PAR_ENTREE_MAX).map(normaliserPeriode).filter(Boolean);
    if (periodes.length === 0) continue; // jamais d'entrée vide : l'année serait réputée en cache
    const recupereLe =
      typeof e.recupereLe === 'string' && !Number.isNaN(Date.parse(e.recupereLe)) ? e.recupereLe : null;
    const cle = `${zone}|${annee}`;
    parCle.delete(cle); // la dernière occurrence passe en fin de liste (la plus récente)
    parCle.set(cle, { zone, anneeScolaire: annee, recupereLe, periodes });
  }
  return [...parCle.values()].slice(-ENTREES_MAX);
}

/**
 * Années scolaires nécessaires à la période et absentes du cache pour la zone.
 *
 * @param {EntreeVacances[]} entrees
 * @param {string} zone - Code de zone.
 * @param {string} dateDebut
 * @param {string} dateFin
 * @returns {string[]}
 */
export function anneesManquantes(entrees, zone, dateDebut, dateFin) {
  const enCache = new Set(entrees.filter((e) => e.zone === zone).map((e) => e.anneeScolaire));
  return anneesScolairesCouvrant(dateDebut, dateFin).filter((a) => !enCache.has(a));
}

/**
 * Périodes de toutes les entrées d'une zone, à plat.
 *
 * @param {EntreeVacances[]} entrees
 * @param {(string|null)} zone
 * @returns {PeriodeVacances[]}
 */
export function periodesDeZone(entrees, zone) {
  if (!zone) return [];
  return entrees.filter((e) => e.zone === zone).flatMap((e) => e.periodes);
}

/**
 * Jours de vacances compris dans la fenêtre. En cas de chevauchement, la
 * première période (par `debut`) l'emporte.
 *
 * @param {PeriodeVacances[]} periodes
 * @param {string} dateDebut - Fenêtre, `"YYYY-MM-DD"`.
 * @param {string} dateFin - Fenêtre, `"YYYY-MM-DD"`.
 * @returns {Map<string, string>} date → libellé de la période.
 */
export function vacancesEntre(periodes, dateDebut, dateFin) {
  const resultat = new Map();
  const triees = [...periodes].sort((a, b) => (a.debut < b.debut ? -1 : a.debut > b.debut ? 1 : 0));
  for (const p of triees) {
    if (p.fin < dateDebut || p.debut > dateFin) continue;
    const de = p.debut > dateDebut ? p.debut : dateDebut;
    const a = p.fin < dateFin ? p.fin : dateFin;
    for (const date of dateUtil.rangeInclusive(de, a)) {
      if (!resultat.has(date)) resultat.set(date, p.libelle);
    }
  }
  return resultat;
}

/**
 * Message FR (sans jargon, disant quoi faire) pour un résultat de récupération.
 *
 * @param {('MIS_A_JOUR'|'HORS_LIGNE'|'DELAI_DEPASSE'|'ERREUR_SERVICE'|'REPONSE_INVALIDE'|'NON_PUBLIEE'|'TOAST')} code
 * @param {Object} [contexte]
 * @param {string} [contexte.anneeScolaire] - Pour `NON_PUBLIEE`.
 * @param {string} [contexte.zone] - Code de zone, pour `MIS_A_JOUR`.
 * @param {string[]} [contexte.annees] - Années mises à jour, pour `MIS_A_JOUR`.
 * @param {boolean} [contexte.avecCache] - Des dates sont déjà enregistrées (échecs seulement).
 * @returns {string}
 */
export function messageVacances(code, { anneeScolaire = '', zone = '', annees = [], avecCache = false } = {}) {
  const suffixe = avecCache ? ' Les dates déjà enregistrées restent affichées.' : '';
  switch (code) {
    case 'MIS_A_JOUR': {
      const libelleZone = zoneScolaireParCode(zone)?.court ?? '';
      return `Vacances scolaires mises à jour (${libelleZone} : ${annees.join(', ')}).`;
    }
    case 'HORS_LIGNE':
      return `Impossible de récupérer les vacances scolaires : vérifiez que l'ordinateur est connecté à internet, puis réessayez. Le planning reste utilisable.${suffixe}`;
    case 'DELAI_DEPASSE':
      return `Le site de l'Éducation nationale met trop de temps à répondre. Réessayez dans quelques minutes.${suffixe}`;
    case 'ERREUR_SERVICE':
      return `Le site de l'Éducation nationale est momentanément indisponible. Réessayez plus tard.${suffixe}`;
    case 'NON_PUBLIEE':
      return `Les vacances de l'année scolaire ${anneeScolaire} ne sont pas encore publiées. Réessayez plus tard.${suffixe}`;
    case 'TOAST':
      return "Les vacances scolaires n'ont pas pu être récupérées. Le planning reste utilisable ; vous pourrez les mettre à jour depuis les Paramètres.";
    case 'REPONSE_INVALIDE':
    default:
      return `Les dates reçues sont illisibles. Réessayez plus tard ; si le problème continue, signalez-le.${suffixe}`;
  }
}
