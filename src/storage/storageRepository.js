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
 *
 * Seconde brique (feature 0032, ADR 0021) : IndexedDB, **limitée au seul
 * `FileSystemFileHandle`** du fichier de sauvegarde actif (non sérialisable en
 * JSON, donc impossible dans localStorage). Les données métier restent dans
 * LocalStorage. Tout accès IndexedDB passe par `indexedDb.js`, importé
 * uniquement ici.
 */
import { indexedDb } from './indexedDb.js';

/** Clé (magasin IndexedDB `cles-valeurs`) du handle du fichier de sauvegarde actif. */
const CLE_HANDLE_FICHIER = 'fichier-sauvegarde-actif';

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
 * Clé dédiée à la préférence de thème (feature 0038, ADR 0022), **séparée** du
 * `SaveDocument` et des autres préférences : un réglage = une clé, jamais
 * exportée/importée.
 */
const CLE_PREFS_THEME = 'idelia:prefs-theme';

/** Fréquences (minutes) proposées par `BlocSauvegardeAutomatique.vue` : seules valeurs acceptées. */
export const INTERVALLES_SAUVEGARDE_AUTO = Object.freeze([5, 10, 15, 30, 60]);

/** Préférence de sauvegarde automatique par défaut (désactivée, 15 minutes). */
const PREFERENCE_SAUVEGARDE_AUTO_DEFAUT = Object.freeze({ active: false, intervalleMinutes: 15 });

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
    conserverCopieCorrompue();
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

/** Préfixe commun de toutes les clés `localStorage` d'Idelia. */
const PREFIXE_CLES = 'idelia:';

/**
 * Efface **toutes** les données persistées par Idelia : chaque clé préfixée
 * `idelia:` (document, copie corrompue, préférences…). Rien de sensible ne
 * doit subsister après « Effacer toutes les données ».
 *
 * @returns {Promise<void>}
 */
async function clear() {
  const aSupprimer = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const cle = localStorage.key(i);
    if (cle !== null && cle.startsWith(PREFIXE_CLES)) aSupprimer.push(cle);
  }
  aSupprimer.forEach((cle) => localStorage.removeItem(cle));
  // La base IndexedDB (handle du fichier de sauvegarde) est supprimée aussi,
  // en best-effort : son indisponibilité ne doit pas faire échouer l'effacement.
  try {
    await indexedDb.supprimerBase();
  } catch {
    // Best-effort : IndexedDB indisponible.
  }
}

/**
 * Copie le document stocké (valide en JSON mais refusé à la validation) sous
 * `idelia:data.corrompu`, sans écraser une copie existante. Best-effort :
 * ne lève jamais.
 */
function conserverCopieCorrompue() {
  try {
    const brut = localStorage.getItem(CLE_DONNEES);
    if (brut !== null && localStorage.getItem(CLE_DONNEES_CORROMPUES) === null) {
      localStorage.setItem(CLE_DONNEES_CORROMPUES, brut);
    }
  } catch {
    // Best-effort : quota ou stockage indisponible.
  }
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
 * Lit la préférence de thème (feature 0038). Lecture **synchrone** et
 * tolérante, comme `lirePreferenceMenuReplie` : la normalisation reste dans
 * le domaine (`normaliserPreferenceTheme`).
 *
 * @returns {string|null} La chaîne stockée, ou `null` si absente ou illisible.
 */
function lirePreferenceTheme() {
  try {
    return localStorage.getItem(CLE_PREFS_THEME);
  } catch {
    return null;
  }
}

/**
 * Enregistre la préférence de thème (feature 0038) sur sa clé dédiée
 * `idelia:prefs-theme`. Écriture **best-effort** : les échecs sont ignorés.
 *
 * @param {string} valeur - `'AUTO'`, `'CLAIR'` ou `'SOMBRE'` (déjà normalisée).
 */
function enregistrerPreferenceTheme(valeur) {
  try {
    localStorage.setItem(CLE_PREFS_THEME, valeur);
  } catch {
    // Best-effort : une préférence non mémorisée n'est pas bloquante.
  }
}

/**
 * Lit la préférence de sauvegarde automatique (feature 0019). Lecture
 * **synchrone** et tolérante, sur le même modèle que
 * `lirePreferenceMenuReplie` : valeurs par défaut si
 * la clé est absente ou illisible.
 *
 * @returns {{ active: boolean, intervalleMinutes: number }}
 */
function lirePreferenceSauvegardeAuto() {
  try {
    const brut = localStorage.getItem(CLE_PREFS_SAUVEGARDE_AUTO);
    if (!brut) return { ...PREFERENCE_SAUVEGARDE_AUTO_DEFAUT };
    const valeur = JSON.parse(brut);
    return {
      active: valeur?.active === true,
      intervalleMinutes: INTERVALLES_SAUVEGARDE_AUTO.includes(valeur?.intervalleMinutes) ? valeur.intervalleMinutes : PREFERENCE_SAUVEGARDE_AUTO_DEFAUT.intervalleMinutes,
    };
  } catch {
    return { ...PREFERENCE_SAUVEGARDE_AUTO_DEFAUT };
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

/**
 * Lit le handle du fichier de sauvegarde actif (feature 0032) dans IndexedDB.
 * **Ne rejette jamais** : si IndexedDB est indisponible, si rien n'est stocké
 * ou si la valeur n'a pas la forme d'un `FileSystemFileHandle`, renvoie `null`
 * (la valeur invalide est alors supprimée, best-effort).
 *
 * @returns {Promise<FileSystemFileHandle|null>}
 */
async function lireHandleFichierSauvegarde() {
  try {
    const valeur = await indexedDb.lire(CLE_HANDLE_FICHIER);
    if (valeur === undefined || valeur === null) return null;
    if (
      valeur.kind === 'file' &&
      typeof valeur.getFile === 'function' &&
      typeof valeur.queryPermission === 'function'
    ) {
      return valeur;
    }
    await oublierHandleFichierSauvegarde();
    return null;
  } catch {
    return null;
  }
}

/**
 * Enregistre le handle du fichier de sauvegarde actif (feature 0032) dans
 * IndexedDB. **Ne rejette jamais** (best-effort).
 *
 * @param {FileSystemFileHandle} handle
 * @returns {Promise<boolean>} `true` si l'écriture a réussi.
 */
async function enregistrerHandleFichierSauvegarde(handle) {
  try {
    await indexedDb.ecrire(CLE_HANDLE_FICHIER, handle);
    return true;
  } catch {
    return false;
  }
}

/**
 * Oublie le handle du fichier de sauvegarde actif (feature 0032).
 * **Ne rejette jamais** (best-effort).
 *
 * @returns {Promise<void>}
 */
async function oublierHandleFichierSauvegarde() {
  try {
    await indexedDb.supprimer(CLE_HANDLE_FICHIER);
  } catch {
    // Best-effort : IndexedDB indisponible ou clé déjà absente.
  }
}

export const storageRepository = {
  load,
  save,
  clear,
  lireHandleFichierSauvegarde,
  enregistrerHandleFichierSauvegarde,
  oublierHandleFichierSauvegarde,
  conserverCopieCorrompue,
  isAvailable,
  lirePreferenceMenuReplie,
  enregistrerPreferenceMenuReplie,
  lirePreferenceTheme,
  enregistrerPreferenceTheme,
  lirePreferenceSauvegardeAuto,
  enregistrerPreferenceSauvegardeAuto,
};
