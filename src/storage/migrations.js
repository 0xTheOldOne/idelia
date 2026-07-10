/**
 * Pipeline de migration du document persisté (ADR 0005, ADR 0006).
 *
 * `CURRENT_SCHEMA_VERSION` est la **source unique** de la version de schéma
 * dans toute l'application : aucune autre déclaration ne doit exister
 * ailleurs (voir `src/domain/schema.js`, qui la reçoit en paramètre plutôt
 * que de la redéclarer).
 */

/** Version courante du schéma de données. */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Table des migrations séquentielles, indexée par version de départ.
 *
 * Chaque entrée `n` transforme un document de version `n` en un document de
 * version `n + 1` : `{ [n]: (doc) => docVersionNPlus1 }`. Vide en feature
 * `0002` (aucune évolution de schéma pour l'instant) ; à compléter au fil des
 * futures évolutions, ex. `MIGRATIONS[1] = (doc) => ({ ...doc, ... })`.
 *
 * @type {Object<number, function(object): object>}
 */
const MIGRATIONS = {};

/**
 * Amène un document chargé (ou importé) à la version courante du schéma.
 *
 * 1. Garde de version future : un document créé par une version plus
 *    récente d'Idelia est refusé (on ne sait pas l'interpréter en sécurité).
 * 2. Applique séquentiellement les migrations de `MIGRATIONS`, de la
 *    version du document jusqu'à `CURRENT_SCHEMA_VERSION - 1` (aucune
 *    itération tant que `MIGRATIONS` est vide).
 * 3. Retourne le document avec `schemaVersion = CURRENT_SCHEMA_VERSION`.
 *
 * @param {object} doc - Document tel que chargé depuis le stockage ou
 *   importé (doit porter un champ `schemaVersion` entier).
 * @returns {object} Document migré à la version courante du schéma.
 * @throws {Error} Si `doc.schemaVersion` est supérieur à
 *   `CURRENT_SCHEMA_VERSION` (message en français, destiné à être affiché
 *   tel quel à l'utilisateur).
 */
export function migrate(doc) {
  if (doc.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Cette sauvegarde a été créée par une version plus récente d'Idelia (v${doc.schemaVersion}). ` +
        'Mettez l\'application à jour pour l\'ouvrir.'
    );
  }

  let migre = doc;
  for (let v = doc.schemaVersion; v < CURRENT_SCHEMA_VERSION; v += 1) {
    const migration = MIGRATIONS[v];
    if (migration) {
      migre = migration(migre);
    }
  }

  return { ...migre, schemaVersion: CURRENT_SCHEMA_VERSION };
}
