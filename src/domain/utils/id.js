/**
 * Génération d'identifiants uniques.
 *
 * Module pur : aucun import Vue/Vuex (ADR 0008).
 */

/**
 * Génère un identifiant unique (UUID v4 si l'environnement le permet,
 * secours simple sinon — ex. environnement non sécurisé/anciens navigateurs).
 *
 * @returns {string} Identifiant unique.
 */
export function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Secours simple si crypto.randomUUID est indisponible.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
