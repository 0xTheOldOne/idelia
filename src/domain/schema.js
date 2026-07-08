/**
 * Schéma du document persisté (SaveDocument) et de l'état racine du store.
 *
 * Frontière unique de (dé)sérialisation entre l'état Vuex et le document
 * JSON canonique persisté/exporté (voir docs/architecture/03-modele-de-donnees.md
 * et docs/architecture/02-modele-de-domaine.md). Module pur : aucun import
 * Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 *
 * Ce module ne connaît pas `CURRENT_SCHEMA_VERSION` (source unique dans
 * `src/storage/migrations.js`) : `toSaveDocument` reçoit la version en
 * paramètre pour rester sans dépendance vers la couche `storage/` (ADR 0010
 * pour les horodatages techniques ISO UTC utilisés ici).
 */

// ---------------------------------------------------------------------------
// Enums / constantes du domaine (codes stables, MAJUSCULES_SNAKE)
// ---------------------------------------------------------------------------

/** Créneaux horaires possibles : grain du planning. @type {ReadonlyArray<string>} */
export const CRENEAUX = Object.freeze(['MATIN', 'APRES_MIDI', 'JOURNEE']);

/** Statuts possibles d'une Personne. @type {ReadonlyArray<string>} */
export const STATUTS_PERSONNE = Object.freeze(['TITULAIRE', 'REMPLACANT']);

/** Nature d'une Preference : contrainte stricte (`DURE`) ou souhait optimisé (`SOUPLE`). @type {ReadonlyArray<string>} */
export const NATURES_PREFERENCE = Object.freeze(['DURE', 'SOUPLE']);

/** Types de Preference (polymorphisme — voir docs/architecture/02-modele-de-domaine.md §Preference). @type {ReadonlyArray<string>} */
export const TYPES_PREFERENCE = Object.freeze([
  'JOUR_OFF_RECURRENT',
  'CRENEAU_OFF',
  'MAX_JOURS_CONSECUTIFS',
  'MIN_JOURS_CONSECUTIFS',
  'JOURS_REPOS_SOUHAITES',
  'NB_JOURS_SEMAINE',
  'PREFERENCE_TOURNEE',
  'INDISPO_HEBDO',
]);

/** Types d'Absence. @type {ReadonlyArray<string>} */
export const TYPES_ABSENCE = Object.freeze([
  'CONGE_PAYE',
  'RTT',
  'ARRET_MALADIE',
  'MATERNITE',
  'PATERNITE',
  'NAISSANCE',
  'FORMATION',
  'AUTRE',
]);

/** Statuts de validation d'une Absence. @type {ReadonlyArray<string>} */
export const STATUTS_ABSENCE = Object.freeze(['DEMANDE', 'VALIDE', 'REFUSE']);

/** Origine d'une Affectation : posée par le moteur (`AUTO`) ou à la main (`MANUEL`). @type {ReadonlyArray<string>} */
export const ORIGINES_AFFECTATION = Object.freeze(['AUTO', 'MANUEL']);

/** Statuts d'un Planning. @type {ReadonlyArray<string>} */
export const STATUTS_PLANNING = Object.freeze(['BROUILLON', 'VALIDE', 'PUBLIE']);

/** Palette de couleurs suggérées par défaut (Personnes/Tournees). @type {ReadonlyArray<string>} */
export const COULEURS_PAR_DEFAUT = Object.freeze(['#2E86AB', '#E4572E', '#5B8C5A', '#B5179E']);

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ParametresCabinet
 * @property {string} nomCabinet
 * @property {number[]} joursOuverture - Jours ISO 1-7 (1 = lundi … 7 = dimanche).
 * @property {string[]} creneauxActifs - Sous-ensemble de {@link CRENEAUX}.
 * @property {number} reposHebdoMin
 * @property {number} maxJoursConsecutifs
 * @property {number} premierJourSemaine - Jour ISO 1-7.
 * @property {string[]} couleursParDefaut
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * @typedef {Object} EtatRacine
 * @property {{ parametres: ParametresCabinet }} cabinet
 * @property {{ items: object[] }} personnes
 * @property {{ items: object[] }} tournees
 * @property {{ items: object[] }} absences
 * @property {{ items: object[], selectionId: (string|null) }} plannings
 */

/**
 * @typedef {Object} SaveDocument
 * @property {number} schemaVersion
 * @property {{ app: string, appVersion: string, exportedAt: string, generator: string }} meta
 * @property {ParametresCabinet} cabinet
 * @property {object[]} personnes
 * @property {object[]} tournees
 * @property {object[]} absences
 * @property {object[]} plannings
 */

/**
 * @typedef {Object} ResultatIntegrite
 * @property {boolean} ok
 * @property {string[]} erreurs - Messages en français, prêts à afficher tels quels.
 */

// ---------------------------------------------------------------------------
// État par défaut
// ---------------------------------------------------------------------------

/**
 * Construit la forme racine de l'état Vuex au premier lancement : cabinet
 * avec ses valeurs par défaut (docs/architecture/02-modele-de-domaine.md
 * §ParametresCabinet) et collections vides.
 *
 * @returns {EtatRacine} Forme racine par défaut de l'état applicatif.
 */
export function etatParDefaut() {
  return {
    cabinet: {
      parametres: {
        nomCabinet: '',
        joursOuverture: [1, 2, 3, 4, 5, 6],
        creneauxActifs: ['MATIN', 'APRES_MIDI'],
        reposHebdoMin: 2,
        maxJoursConsecutifs: 6,
        premierJourSemaine: 1,
        couleursParDefaut: COULEURS_PAR_DEFAUT,
        updatedAt: new Date().toISOString(),
      },
    },
    personnes: { items: [] },
    tournees: { items: [] },
    absences: { items: [] },
    plannings: { items: [], selectionId: null },
  };
}

// ---------------------------------------------------------------------------
// (Dé)sérialisation
// ---------------------------------------------------------------------------

/**
 * Assemble le document canonique (SaveDocument) à partir de l'état racine
 * Vuex. Ne sérialise ni `ui` ni `plannings.selectionId` (sélection volatile,
 * jamais persistée).
 *
 * `schemaVersion` est **injecté** par l'appelant : ce module ne dépend pas de
 * `src/storage/migrations.js` (où vit `CURRENT_SCHEMA_VERSION`), afin de
 * rester pur et sans dépendance vers la couche stockage.
 *
 * @param {EtatRacine} rootState - État racine du store (ou forme compatible).
 * @param {Object} options
 * @param {number} options.schemaVersion - Version de schéma à écrire dans le document.
 * @param {string} [options.exportedAt] - Horodatage ISO UTC à figer (par défaut l'instant courant).
 * @returns {SaveDocument} Document canonique prêt à être sérialisé en JSON.
 */
export function toSaveDocument(rootState, options) {
  const { schemaVersion, exportedAt } = options;
  return {
    schemaVersion,
    meta: {
      app: 'Idelia',
      appVersion: '1.0.0',
      exportedAt: exportedAt ?? new Date().toISOString(),
      generator: 'idelia-web',
    },
    cabinet: rootState.cabinet.parametres,
    personnes: rootState.personnes.items,
    tournees: rootState.tournees.items,
    absences: rootState.absences.items,
    plannings: rootState.plannings.items,
  };
}

/**
 * Reconstruit la forme racine de l'état Vuex à partir d'un SaveDocument
 * **déjà migré et vérifié** (`migrate` puis `verifierIntegrite` en amont,
 * couche `storage/`). `plannings.selectionId` est une sélection volatile,
 * jamais persistée : elle est toujours remise à `null`.
 *
 * @param {SaveDocument} doc - Document canonique déjà migré et vérifié.
 * @returns {EtatRacine} Forme racine correspondante, prête pour `REPLACE_ALL`.
 */
export function fromSaveDocument(doc) {
  return {
    cabinet: { parametres: doc.cabinet },
    personnes: { items: doc.personnes ?? [] },
    tournees: { items: doc.tournees ?? [] },
    absences: { items: doc.absences ?? [] },
    plannings: { items: doc.plannings ?? [], selectionId: null },
  };
}

// ---------------------------------------------------------------------------
// Vérification d'intégrité
// ---------------------------------------------------------------------------

/**
 * Vérifie la structure et l'intégrité référentielle d'un SaveDocument. Ne
 * lève jamais : renvoie un verdict et des messages en français, explicites,
 * destinés à être affichés tels quels par la future UI d'import.
 *
 * Contrôles effectués :
 * - structure racine : `schemaVersion` entier ; `cabinet` objet ;
 *   `personnes`/`tournees`/`absences`/`plannings` sont des tableaux ;
 * - intégrité référentielle (si la structure ci-dessus est saine) :
 *   `absence.personneId`, `affectation.personneId`, `affectation.tourneeId`,
 *   `planning.referentId` (s'il est non nul) et `preference.params.tourneeIds`
 *   (souhaits `PREFERENCE_TOURNEE`) doivent résoudre vers une entité existante.
 *
 * @param {*} doc - Document à vérifier (forme quelconque, non garantie).
 * @returns {ResultatIntegrite} Verdict et liste des erreurs éventuelles.
 */
export function verifierIntegrite(doc) {
  if (doc === null || typeof doc !== 'object') {
    return { ok: false, erreurs: ['Le document est invalide : un objet est attendu.'] };
  }

  const erreurs = [];

  if (!Number.isInteger(doc.schemaVersion)) {
    erreurs.push('Le champ « schemaVersion » doit être un nombre entier.');
  }
  if (doc.cabinet === null || typeof doc.cabinet !== 'object' || Array.isArray(doc.cabinet)) {
    erreurs.push('Le champ « cabinet » doit être un objet.');
  }

  const personnesOk = Array.isArray(doc.personnes);
  const tourneesOk = Array.isArray(doc.tournees);
  const absencesOk = Array.isArray(doc.absences);
  const planningsOk = Array.isArray(doc.plannings);

  if (!personnesOk) erreurs.push('Le champ « personnes » doit être une liste.');
  if (!tourneesOk) erreurs.push('Le champ « tournees » doit être une liste.');
  if (!absencesOk) erreurs.push('Le champ « absences » doit être une liste.');
  if (!planningsOk) erreurs.push('Le champ « plannings » doit être une liste.');

  // L'intégrité référentielle ne peut être contrôlée que si les collections
  // impliquées sont effectivement des tableaux exploitables.
  const idsPersonnes = personnesOk ? new Set(doc.personnes.map((p) => p.id)) : null;
  const idsTournees = tourneesOk ? new Set(doc.tournees.map((t) => t.id)) : null;

  if (idsPersonnes && absencesOk) {
    for (const absence of doc.absences) {
      if (!idsPersonnes.has(absence.personneId)) {
        erreurs.push(
          `Absence « ${absence.id} » : la personne « ${absence.personneId} » référencée est introuvable.`
        );
      }
    }
  }

  // Souhaits « Tournée préférée ou évitée » (`PREFERENCE_TOURNEE`, 006) :
  // chaque tournée référencée dans `params.tourneeIds` doit exister.
  if (personnesOk && idsTournees) {
    for (const personne of doc.personnes) {
      const preferences = Array.isArray(personne.preferences) ? personne.preferences : [];
      for (const preference of preferences) {
        if (preference.type !== 'PREFERENCE_TOURNEE') continue;
        const tourneeIds = Array.isArray(preference.params?.tourneeIds) ? preference.params.tourneeIds : [];
        for (const tourneeId of tourneeIds) {
          if (!idsTournees.has(tourneeId)) {
            erreurs.push(
              `Personne « ${personne.id} », souhait « ${preference.id} » : la tournée « ${tourneeId} » référencée est introuvable.`
            );
          }
        }
      }
    }
  }

  if (idsPersonnes && planningsOk) {
    for (const planning of doc.plannings) {
      if (planning.referentId != null && !idsPersonnes.has(planning.referentId)) {
        erreurs.push(
          `Planning « ${planning.id} » : le référent « ${planning.referentId} » référencé est introuvable.`
        );
      }

      if (idsTournees) {
        const affectations = Array.isArray(planning.affectations) ? planning.affectations : [];
        for (const affectation of affectations) {
          if (!idsPersonnes.has(affectation.personneId)) {
            erreurs.push(
              `Planning « ${planning.id} », affectation « ${affectation.id} » : la personne « ${affectation.personneId} » référencée est introuvable.`
            );
          }
          if (!idsTournees.has(affectation.tourneeId)) {
            erreurs.push(
              `Planning « ${planning.id} », affectation « ${affectation.id} » : la tournée « ${affectation.tourneeId} » référencée est introuvable.`
            );
          }
        }
      }
    }
  }

  return { ok: erreurs.length === 0, erreurs };
}
