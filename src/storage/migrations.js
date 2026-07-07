/**
 * Pipeline de migration du document persisté (ADR 0005).
 *
 * Squelette de la feature 001 : la version courante du schéma est posée et
 * la fonction `migrate` existe déjà (pipeline vide), mais aucune migration
 * réelle n'est implémentée — ce sera fait au fil des évolutions du schéma
 * à partir de la feature 002.
 */

/** Version courante du schéma de données. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Applique les migrations nécessaires pour amener un document chargé à la
 * version courante du schéma.
 *
 * @param {object} doc - Document tel que chargé depuis le stockage.
 * @returns {object} Document migré (identique en 001, pipeline vide).
 */
export function migrate(doc) {
  return doc;
}
