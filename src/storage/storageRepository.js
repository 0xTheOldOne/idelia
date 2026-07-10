/**
 * Abstraction de persistance (ADR 0005 — persistance localStorage derrière
 * un repository). Tout accès à `localStorage` doit passer par ce module :
 * il est **interdit** d'utiliser `localStorage` directement ailleurs dans
 * l'application.
 *
 * Implémentation réelle (feature 0002) : LocalStorage, clé unique
 * `"idelia:data"`. L'interface reste **asynchrone** (Promises) même si
 * l'implémentation sous-jacente est synchrone, pour permettre une bascule
 * ultérieure vers IndexedDB sans changer les appelants.
 */

/** Clé unique de stockage du document de sauvegarde. */
const CLE_DONNEES = 'idelia:data';

/** Clé de secours où est copié le contenu corrompu détecté au chargement. */
const CLE_DONNEES_CORROMPUES = 'idelia:data.corrompu';

/**
 * Indique si une erreur correspond à un dépassement de quota de stockage
 * (le nom exact varie selon les navigateurs).
 *
 * @param {*} erreur - Erreur capturée lors d'un accès à `localStorage`.
 * @returns {boolean} `true` si l'erreur est un dépassement de quota.
 */
function estErreurQuota(erreur) {
  return (
    erreur instanceof DOMException &&
    (erreur.name === 'QuotaExceededError' || erreur.name.includes('Quota'))
  );
}

/**
 * Charge le document persisté.
 *
 * @returns {Promise<object|null>} Le document sauvegardé, ou `null` si
 *   aucune donnée n'est présente.
 * @throws {Error} Si le contenu stocké n'est pas un JSON valide. Dans ce
 *   cas, le contenu brut est préalablement copié (une seule fois, sans
 *   écraser une copie existante) sous la clé `"idelia:data.corrompu"` afin
 *   de ne rien perdre.
 */
async function load() {
  const brut = localStorage.getItem(CLE_DONNEES);
  if (brut === null) {
    return null;
  }

  try {
    return JSON.parse(brut);
  } catch {
    if (localStorage.getItem(CLE_DONNEES_CORROMPUES) === null) {
      localStorage.setItem(CLE_DONNEES_CORROMPUES, brut);
    }
    throw new Error(
      "Les données sauvegardées sont illisibles (fichier corrompu). Une copie a été conservée."
    );
  }
}

/**
 * Sauvegarde le document fourni.
 *
 * @param {object} doc - Document à persister (SaveDocument).
 * @returns {Promise<void>}
 * @throws {Error} Si l'espace de stockage du navigateur est insuffisant
 *   (message en français destiné à être affiché tel quel à l'utilisateur).
 */
async function save(doc) {
  try {
    localStorage.setItem(CLE_DONNEES, JSON.stringify(doc));
  } catch (erreur) {
    if (estErreurQuota(erreur)) {
      throw new Error(
        "Espace de stockage insuffisant pour enregistrer les données. " +
          'Libérez de la place (ex. exportez puis videz certaines données) et réessayez.'
      );
    }
    throw erreur;
  }
}

/**
 * Efface les données persistées.
 *
 * @returns {Promise<void>}
 */
async function clear() {
  localStorage.removeItem(CLE_DONNEES);
}

/**
 * Indique si le mécanisme de stockage est disponible dans l'environnement
 * courant (ex. `localStorage` désactivé ou quota nul en navigation privée
 * stricte). Effectue un test réel d'écriture/lecture/suppression d'une clé
 * sonde plutôt qu'une simple détection de présence de l'API.
 *
 * @returns {Promise<boolean>} `true` si le stockage est utilisable.
 */
async function isAvailable() {
  const CLE_SONDE = 'idelia:sonde';
  try {
    localStorage.setItem(CLE_SONDE, '1');
    const lu = localStorage.getItem(CLE_SONDE);
    localStorage.removeItem(CLE_SONDE);
    return lu === '1';
  } catch {
    return false;
  }
}

export const storageRepository = {
  load,
  save,
  clear,
  isAvailable,
};
