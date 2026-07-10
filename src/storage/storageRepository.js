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
 * Clé dédiée aux préférences d'interface (feature 0015), **séparée** de la
 * clé du document de sauvegarde métier `CLE_DONNEES` : ces préférences ne
 * font jamais partie du `SaveDocument` (ni export, ni import, ni migration).
 */
const CLE_PREFS_UI = 'idelia:prefs-ui';

/**
 * Clé dédiée à la préférence de sauvegarde automatique (feature 0019),
 * **séparée** à la fois de `CLE_DONNEES` (`SaveDocument`) et de
 * `CLE_PREFS_UI` (`0015`) : un réglage = une clé, jamais exportée/importée.
 */
const CLE_PREFS_SAUVEGARDE_AUTO = 'idelia:prefs-sauvegarde-auto';

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

/**
 * Lit la préférence « menu latéral replié » (feature 0015).
 *
 * Lecture **synchrone** (contrairement au reste du repository) : c'est une
 * préférence triviale, lue directement au démarrage pour être appliquée
 * avant le premier rendu (pas de scintillement déplié→replié). Tolérante :
 * renvoie `false` (déplié, valeur par défaut) si la clé est absente ou
 * illisible.
 *
 * @returns {boolean} `true` si le menu doit être affiché replié.
 */
function lirePreferenceMenuReplie() {
  try {
    return localStorage.getItem(CLE_PREFS_UI) === 'true';
  } catch {
    return false;
  }
}

/**
 * Enregistre la préférence « menu latéral replié » (feature 0015), sur sa
 * clé dédiée `idelia:prefs-ui`, indépendante du document de sauvegarde
 * métier. Écriture **best-effort** : les échecs (quota, stockage
 * indisponible…) sont silencieusement ignorés, comme pour le reste du
 * repository.
 *
 * @param {boolean} valeur - `true` pour mémoriser le menu replié.
 */
function enregistrerPreferenceMenuReplie(valeur) {
  try {
    localStorage.setItem(CLE_PREFS_UI, valeur ? 'true' : 'false');
  } catch {
    // Best-effort : une préférence d'UI non mémorisée n'est pas bloquante.
  }
}

/**
 * Lit la préférence de sauvegarde automatique (feature 0019). Lecture
 * **synchrone** et tolérante, sur le même modèle que
 * `lirePreferenceMenuReplie` : valeurs par défaut (désactivée, 15 minutes) si
 * la clé est absente ou illisible.
 *
 * @returns {{ active: boolean, intervalleMinutes: number }}
 */
function lirePreferenceSauvegardeAuto() {
  try {
    const brut = localStorage.getItem(CLE_PREFS_SAUVEGARDE_AUTO);
    if (!brut) return { active: false, intervalleMinutes: 15 };
    const valeur = JSON.parse(brut);
    return {
      active: valeur.active === true,
      intervalleMinutes: Number.isInteger(valeur.intervalleMinutes) ? valeur.intervalleMinutes : 15,
    };
  } catch {
    return { active: false, intervalleMinutes: 15 };
  }
}

/**
 * Enregistre la préférence de sauvegarde automatique (feature 0019), sur sa
 * clé dédiée `idelia:prefs-sauvegarde-auto`, indépendante du document de
 * sauvegarde métier et des préférences d'UI (`0015`). Écriture
 * **best-effort** : les échecs sont silencieusement ignorés, comme pour le
 * reste du repository.
 *
 * @param {{ active: boolean, intervalleMinutes: number }} valeur
 */
function enregistrerPreferenceSauvegardeAuto({ active, intervalleMinutes }) {
  try {
    localStorage.setItem(
      CLE_PREFS_SAUVEGARDE_AUTO,
      JSON.stringify({ active, intervalleMinutes })
    );
  } catch {
    // Best-effort : une préférence non mémorisée n'est pas bloquante.
  }
}

export const storageRepository = {
  load,
  save,
  clear,
  isAvailable,
  lirePreferenceMenuReplie,
  enregistrerPreferenceMenuReplie,
  lirePreferenceSauvegardeAuto,
  enregistrerPreferenceSauvegardeAuto,
};
