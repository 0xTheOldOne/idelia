/**
 * Pipeline de migration du document persisté (ADR 0005, ADR 0006).
 *
 * `CURRENT_SCHEMA_VERSION` est la **source unique** de la version de schéma
 * dans toute l'application : aucune autre déclaration ne doit exister
 * ailleurs (voir `src/domain/schema.js`, qui la reçoit en paramètre plutôt
 * que de la redéclarer).
 */

import { genId } from '@/domain/utils/id.js';

/** Version courante du schéma de données. */
export const CURRENT_SCHEMA_VERSION = 4;

/** Forme d'un GUID (UUID, toutes versions), insensible à la casse. */
const FORMAT_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Migration v2 → v3 (feature 0026) : ajout de `Planning.genereLe`, horodatage
 * ISO UTC de la dernière génération/régénération par le moteur.
 *
 * - Chaque `Planning` de `doc.plannings` reçoit `genereLe: planning.genereLe ?? null`
 *   (idempotent, aucun autre champ touché). Pas de rétro-remplissage depuis
 *   `createdAt` : `null` = date inconnue, rien n'est affiché (honnêteté).
 * - `personnes`, `tournees`, `absences`, `cabinet` : inchangés.
 *
 * @param {object} doc - Document de version 2.
 * @returns {object} Document équivalent en version 3 (`schemaVersion` posé par `migrate`).
 */
MIGRATIONS[2] = (doc) => {
  const plannings = Array.isArray(doc.plannings)
    ? doc.plannings.map((planning) => ({ ...planning, genereLe: planning.genereLe ?? null }))
    : doc.plannings;
  return { ...doc, plannings };
};

/**
 * Migration v3 → v4 : **tout identifiant d'entité devient un GUID** (règle
 * du porteur : aucun identifiant technique lisible, cf.
 * docs/architecture/02-modele-de-domaine.md). Vise les données saisies à la
 * main ou importées d'anciens jeux de test (`p-claire`, `t-t1`…) ; les ids
 * déjà au format GUID sont conservés tels quels (idempotent).
 *
 * - Identifiants remplacés (si non-GUID) : `personnes[].id`,
 *   `personnes[].preferences[].id`, `tournees[].id`, `absences[].id`,
 *   `plannings[].id`, `plannings[].affectations[].id`.
 * - Références réécrites avec la **même** correspondance (intégrité
 *   préservée) : `absences[].personneId`, `preferences[].params.tourneeIds`,
 *   `plannings[].referentId`, `affectations[].personneId` / `.tourneeId`.
 * - Une référence vers un id inconnu est laissée telle quelle
 *   (`verifierIntegrite` la signalera comme avant).
 *
 * @param {object} doc - Document de version 3.
 * @returns {object} Document équivalent en version 4 (`schemaVersion` posé par `migrate`).
 */
MIGRATIONS[3] = (doc) => {
  const correspondance = new Map();
  /** @param {string} id @returns {string} GUID (nouveau si `id` n'en était pas un). */
  const versGuid = (id) => {
    if (typeof id !== 'string' || FORMAT_GUID.test(id)) return id;
    if (!correspondance.has(id)) correspondance.set(id, genId());
    return correspondance.get(id);
  };
  /** @param {string} id @returns {string} Référence réécrite si l'id a été remplacé. */
  const reference = (id) => correspondance.get(id) ?? id;
  const liste = (valeur) => (Array.isArray(valeur) ? valeur : []);

  // 1) Nouveaux identifiants (avant toute réécriture de référence).
  const personnes = liste(doc.personnes).map((personne) => ({
    ...personne,
    id: versGuid(personne.id),
    preferences: Array.isArray(personne.preferences)
      ? personne.preferences.map((preference) => ({ ...preference, id: versGuid(preference.id) }))
      : personne.preferences,
  }));
  const tournees = liste(doc.tournees).map((tournee) => ({ ...tournee, id: versGuid(tournee.id) }));
  const absencesIds = liste(doc.absences).map((absence) => ({ ...absence, id: versGuid(absence.id) }));
  const planningsIds = liste(doc.plannings).map((planning) => ({
    ...planning,
    id: versGuid(planning.id),
    affectations: Array.isArray(planning.affectations)
      ? planning.affectations.map((affectation) => ({ ...affectation, id: versGuid(affectation.id) }))
      : planning.affectations,
  }));

  if (correspondance.size === 0) return doc;

  // 2) Références.
  const personnesRefs = personnes.map((personne) => ({
    ...personne,
    preferences: Array.isArray(personne.preferences)
      ? personne.preferences.map((preference) =>
          Array.isArray(preference.params?.tourneeIds)
            ? {
                ...preference,
                params: { ...preference.params, tourneeIds: preference.params.tourneeIds.map(reference) },
              }
            : preference
        )
      : personne.preferences,
  }));
  const absences = absencesIds.map((absence) => ({ ...absence, personneId: reference(absence.personneId) }));
  const plannings = planningsIds.map((planning) => ({
    ...planning,
    referentId: planning.referentId == null ? planning.referentId : reference(planning.referentId),
    affectations: Array.isArray(planning.affectations)
      ? planning.affectations.map((affectation) => ({
          ...affectation,
          personneId: reference(affectation.personneId),
          tourneeId: reference(affectation.tourneeId),
        }))
      : planning.affectations,
  }));

  return {
    ...doc,
    personnes: Array.isArray(doc.personnes) ? personnesRefs : doc.personnes,
    tournees: Array.isArray(doc.tournees) ? tournees : doc.tournees,
    absences: Array.isArray(doc.absences) ? absences : doc.absences,
    plannings: Array.isArray(doc.plannings) ? plannings : doc.plannings,
  };
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
