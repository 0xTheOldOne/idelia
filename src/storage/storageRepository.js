/**
 * Abstraction de persistance (ADR 0005 — persistance localStorage derrière
 * un repository). Tout accès à `localStorage` doit passer par ce module :
 * il est **interdit** d'utiliser `localStorage` directement ailleurs dans
 * l'application.
 *
 * Squelette de la feature 001 : les signatures sont posées et respectées,
 * mais l'implémentation réelle (lecture/écriture localStorage, gestion des
 * quotas/erreurs) sera faite en feature 002.
 */

/**
 * Charge le document persisté.
 *
 * @returns {Promise<object|null>} Le document sauvegardé, ou `null` si
 *   aucune donnée n'est présente (implémentation non branchée en 001).
 */
async function load() {
  return null;
}

/**
 * Sauvegarde le document fourni.
 *
 * @param {object} doc - Document à persister (SaveDocument).
 * @returns {Promise<void>}
 */
async function save(doc) {
  // Non implémenté en 001 (voir feature 002).
}

/**
 * Efface les données persistées.
 *
 * @returns {Promise<void>}
 */
async function clear() {
  // Non implémenté en 001 (voir feature 002).
}

/**
 * Indique si le mécanisme de stockage est disponible dans l'environnement
 * courant (ex. `localStorage` désactivé en navigation privée stricte).
 *
 * @returns {Promise<boolean>} `true` si le stockage est utilisable.
 */
async function isAvailable() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export const storageRepository = {
  load,
  save,
  clear,
  isAvailable,
};
