/**
 * Pipeline de migration du document persisté (ADR 0005, ADR 0006).
 *
 * `CURRENT_SCHEMA_VERSION` est la **source unique** de la version de schéma
 * dans toute l'application : aucune autre déclaration ne doit exister
 * ailleurs (voir `src/domain/schema.js`, qui la reçoit en paramètre plutôt
 * que de la redéclarer).
 */

/** Version courante du schéma de données. */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Table des migrations séquentielles, indexée par version de départ.
 *
 * Chaque entrée `n` transforme un document de version `n` en un document de
 * version `n + 1` : `{ [n]: (doc) => docVersionNPlus1 }`.
 *
 * @type {Object<number, function(object): object>}
 */
const MIGRATIONS = {};

/**
 * Migration v1 → v2 (feature 0016, ADR 0017) : le modèle « un créneau
 * symbolique + une plage horaire unique » de `Tournee` est remplacé par une
 * liste de segments horaires. **Sans perte** : chaque tournée v1 devient une
 * tournée v2 à un unique segment (une tournée v1 n'ayant, par construction,
 * qu'une seule plage horaire).
 *
 * - Chaque `Tournee` de `doc.tournees` : `libelle` ← ancien `nom` ;
 *   `segments` ← `[{ heureDebut, heureFin, nbPersonnesRequises }]`
 *   (`nbPersonnesRequises` défaut `1` si absent) ; suppression de `nom`,
 *   `creneau`, `heureDebut`, `heureFin`, `nbPersonnesRequises`, `secteur`,
 *   `code` ; conservation de `id`, `joursApplication`, `couleur`,
 *   **`archivee`** (recopié tel quel — une tournée archivée reste
 *   archivée), `dateDebutValidite`, `dateFinValidite`, `ordreAffichage`,
 *   `notes`, `createdAt`, `updatedAt`.
 * - Chaque `Affectation` de `doc.plannings[].affectations` :
 *   `segmentIndex: 0` (l'unique segment de la tournée migrée, correct
 *   puisqu'en v1 une tournée = un seul créneau = une seule plage) ;
 *   suppression de `creneau`.
 * - `doc.absences` : inchangées (elles gardent leur `creneau` symbolique,
 *   voir `src/domain/absences.js`).
 *
 * @param {object} doc - Document de version 1.
 * @returns {object} Document équivalent en version 2 (`schemaVersion` posé par `migrate`).
 */
MIGRATIONS[1] = (doc) => {
  const tournees = Array.isArray(doc.tournees)
    ? doc.tournees.map((tournee) => {
        const { nom, creneau, heureDebut, heureFin, nbPersonnesRequises, secteur, code, ...conserves } = tournee;
        return {
          ...conserves,
          libelle: nom ?? '',
          segments: [
            {
              heureDebut: heureDebut ?? '',
              heureFin: heureFin ?? '',
              nbPersonnesRequises: nbPersonnesRequises ?? 1,
            },
          ],
        };
      })
    : doc.tournees;

  const plannings = Array.isArray(doc.plannings)
    ? doc.plannings.map((planning) => {
        const affectations = Array.isArray(planning.affectations)
          ? planning.affectations.map((affectation) => {
              const { creneau, ...conservees } = affectation;
              return { ...conservees, segmentIndex: 0 };
            })
          : planning.affectations;
        return { ...planning, affectations };
      })
    : doc.plannings;

  return { ...doc, tournees, plannings };
};

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
