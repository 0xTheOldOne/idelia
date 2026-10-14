/**
 * Adaptateur réseau du calendrier scolaire (feature 0023, ADR 0020).
 * Seul endroit de l'application qui fait un appel réseau. Aucune donnée du
 * cabinet n'est envoyée : seuls la zone et l'année scolaire figurent dans la
 * requête. Aucune persistance ici (c'est le rôle du store).
 */

/**
 * @typedef {'HORS_LIGNE'|'DELAI_DEPASSE'|'ERREUR_SERVICE'|'REPONSE_INVALIDE'} ErreurCalendrierScolaire
 */

/**
 * @typedef {Object} LigneCalendrierScolaire
 * @property {string} description Ex. « Vacances de la Toussaint ».
 * @property {string} population Ex. « - », « Élèves », « Enseignants ».
 * @property {string} start_date Instant ISO 8601 avec fuseau.
 * @property {string} end_date Instant ISO 8601 avec fuseau.
 * @property {string} zones Ex. « Zone A ».
 * @property {string} annee_scolaire Ex. « 2026-2027 ».
 */

/**
 * @typedef {{ ok: true, enregistrements: LigneCalendrierScolaire[] }
 *   | { ok: false, erreur: ErreurCalendrierScolaire }} ResultatCalendrierScolaire
 */

/** URL de base constante (jamais construite depuis une saisie libre). */
const URL_CALENDRIER_SCOLAIRE =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/exports/json';

/** Liste fermée des valeurs de zone acceptées par l'API. */
export const VALEURS_ZONE_CALENDRIER = Object.freeze([
  'Zone A',
  'Zone B',
  'Zone C',
  'Corse',
  'Guadeloupe',
  'Martinique',
  'Guyane',
  'Réunion',
  'Mayotte',
  'Polynésie',
  'Saint Pierre et Miquelon',
]);

const CHAMPS = ['description', 'population', 'start_date', 'end_date', 'zones', 'annee_scolaire'];
const TAILLE_MAX = 1024 * 1024; // 1 Mo
const DELAI_PAR_DEFAUT_MS = 10000;

/**
 * @param {string} anneeScolaire
 * @returns {boolean} `true` si « AAAA-AAAA » avec deux années consécutives.
 */
function anneeValide(anneeScolaire) {
  if (typeof anneeScolaire !== 'string' || !/^\d{4}-\d{4}$/.test(anneeScolaire)) return false;
  const [debut, fin] = anneeScolaire.split('-').map(Number);
  // Plage plausible 2000-2001 … 2099-2100 : refus avant tout appel réseau.
  return fin === debut + 1 && debut >= 2000 && debut <= 2099;
}

/**
 * @param {unknown} donnees
 * @returns {boolean} `true` si tableau d'objets aux champs chaînes attendus.
 */
function formeValide(donnees) {
  return (
    Array.isArray(donnees) &&
    donnees.every(
      (ligne) =>
        ligne !== null &&
        typeof ligne === 'object' &&
        CHAMPS.every((champ) => typeof ligne[champ] === 'string'),
    )
  );
}

/**
 * Récupère les lignes brutes du calendrier scolaire pour une zone et une
 * année. Ne lève jamais ; la normalisation est faite par le domaine.
 *
 * @param {Object} params
 * @param {string} params.valeurZone Valeur exacte de la zone (liste fermée).
 * @param {string} params.anneeScolaire Format « 2026-2027 ».
 * @param {number} [params.delaiMs=10000] Délai maximal de la requête.
 * @returns {Promise<ResultatCalendrierScolaire>}
 */
export async function recupererCalendrierScolaire({
  valeurZone,
  anneeScolaire,
  delaiMs = DELAI_PAR_DEFAUT_MS,
} = {}) {
  // Refus avant tout appel : valeurs hors liste fermée / format.
  if (!VALEURS_ZONE_CALENDRIER.includes(valeurZone) || !anneeValide(anneeScolaire)) {
    return { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, erreur: 'HORS_LIGNE' };
  }

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    const url = new URL(URL_CALENDRIER_SCOLAIRE);
    url.search = new URLSearchParams({
      select: CHAMPS.join(','),
      where: `zones="${valeurZone}" and annee_scolaire="${anneeScolaire}"`,
    }).toString();

    const reponse = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controleur.signal,
    });

    if (!reponse.ok) return { ok: false, erreur: 'ERREUR_SERVICE' };

    const longueur = Number(reponse.headers.get('Content-Length'));
    if (Number.isFinite(longueur) && longueur > TAILLE_MAX) {
      return { ok: false, erreur: 'REPONSE_INVALIDE' };
    }
    const texte = await reponse.text();
    if (texte.length > TAILLE_MAX) return { ok: false, erreur: 'REPONSE_INVALIDE' };

    let donnees;
    try {
      donnees = JSON.parse(texte);
    } catch {
      return { ok: false, erreur: 'REPONSE_INVALIDE' };
    }
    if (!formeValide(donnees)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
    return { ok: true, enregistrements: donnees };
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, erreur: 'DELAI_DEPASSE' };
    return { ok: false, erreur: 'HORS_LIGNE' };
  } finally {
    clearTimeout(minuteur);
  }
}
