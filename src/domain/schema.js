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

import { normaliserIconeTournee } from '@/domain/iconesTournee.js';
import { normaliserIdentifiants } from '@/domain/identifiantsPro.js';
import { normaliserCacheVacances, normaliserZoneScolaire } from '@/domain/calendrier/vacancesScolaires.js';
import { adresseVide, normaliserAdresse } from '@/domain/adresse.js';
import { normaliserLogo } from '@/domain/cabinet.js';
import { normaliserDateNaissance } from '@/domain/coordonnees.js';
import { normaliserModeleContrat } from '@/domain/contrats/modeles.js';

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
  'UN_WEEKEND_SUR_X',
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

/** Types d'un modèle de contrat (0041). @type {ReadonlyArray<string>} */
export const TYPES_MODELE_CONTRAT = Object.freeze(['CONTRAT', 'AVENANT']);

/** Types d'un champ à compléter d'un modèle de contrat (0041). @type {ReadonlyArray<string>} */
export const TYPES_CHAMP_LIBRE = Object.freeze(['TEXTE', 'DATE', 'NOMBRE', 'TAUX_RETROCESSION']);

/** Bornes de la saisie d'un taux de rétrocession (%), alignées sur `Personne.tauxRetrocession`. */
export const BORNES_TAUX_RETROCESSION = Object.freeze({ min: 0, max: 100 });

/**
 * Palette de couleurs de repère suggérées (Personnes/Tournees), accordée à
 * l'identité « Teal & Sable » (feature 0014) : douze teintes bien distinctes,
 * saturation/luminosité moyennes pour rester lisibles en pastille comme en
 * fond de cellule de planning. Palette au niveau **application** (non éditable
 * en v1) : `fromSaveDocument` la ré-applique toujours, elle suit la version.
 * @type {ReadonlyArray<string>}
 */
export const COULEURS_PAR_DEFAUT = Object.freeze([
  '#0E8A8F', // teal (famille marque)
  '#2E7CB8', // bleu
  '#5B5BD6', // indigo
  '#8E4EC6', // violet
  '#C43E8E', // magenta
  '#D14D5A', // rose
  '#E0713C', // terracotta
  '#D99A26', // ambre (écho de l'accent)
  '#8A9A2E', // olive
  '#2E9E5B', // vert
  '#96603A', // terre / mocha (chaud, accordé au sable)
  '#5E7387', // ardoise (neutre bleuté)
]);

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ParametresCabinet
 * @property {string} nomCabinet
 * @property {import('@/domain/adresse.js').AdressePostale} adresseCabinet - Adresse postale du cabinet (0039).
 * @property {(string|null)} logo - Data URL PNG/JPEG (0039), `null` = aucun logo.
 * @property {number[]} joursOuverture - Jours ISO 1-7 (1 = lundi … 7 = dimanche).
 * @property {string[]} creneauxActifs - Sous-ensemble de {@link CRENEAUX}.
 * @property {number} reposHebdoMin
 * @property {number} maxJoursConsecutifs
 * @property {number} premierJourSemaine - Jour ISO 1-7.
 * @property {string[]} couleursParDefaut
 * @property {(string|null)} zoneScolaire - Code de zone de vacances scolaires (0023), `null` = aucune.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * @typedef {Object} EtatRacine
 * @property {{ parametres: ParametresCabinet }} cabinet
 * @property {{ items: object[] }} personnes
 * @property {{ items: object[] }} tournees
 * @property {{ items: object[] }} absences
 * @property {{ items: object[], selectionId: (string|null) }} plannings
 * @property {{ entrees: import('@/domain/calendrier/vacancesScolaires.js').EntreeVacances[] }} vacancesScolaires - Cache des vacances (0023).
 * @property {{ modeles: import('@/domain/contrats/modeles.js').ModeleContrat[], documents: object[] }} contrats - Modèles de contrats (0041) ; `documents` réservé à 0042.
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
 * @property {import('@/domain/calendrier/vacancesScolaires.js').EntreeVacances[]} vacancesScolaires - Cache des vacances scolaires (0023).
 * @property {import('@/domain/contrats/modeles.js').ModeleContrat[]} modelesContrats - Modèles de contrats (0041).
 * @property {object[]} documentsContrats - Documents contractuels (toujours vide en 0041, réservé à 0042).
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
        adresseCabinet: adresseVide(),
        logo: null,
        joursOuverture: [1, 2, 3, 4, 5, 6],
        creneauxActifs: ['MATIN', 'APRES_MIDI'],
        reposHebdoMin: 2,
        maxJoursConsecutifs: 6,
        premierJourSemaine: 1,
        couleursParDefaut: COULEURS_PAR_DEFAUT,
        zoneScolaire: null,
        updatedAt: new Date().toISOString(),
      },
    },
    personnes: { items: [] },
    tournees: { items: [] },
    absences: { items: [] },
    plannings: { items: [], selectionId: null },
    vacancesScolaires: { entrees: [] },
    contrats: { modeles: [], documents: [] },
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
    vacancesScolaires: rootState.vacancesScolaires.entrees,
    modelesContrats: rootState.contrats.modeles,
    documentsContrats: rootState.contrats.documents,
  };
}

/**
 * Garantit la forme des blocs d'une personne chargée (jamais bloquant).
 * @param {*} p - Personne du document migré.
 * @returns {object}
 */
function normaliserPersonneChargee(p) {
  return {
    ...p,
    identifiants: normaliserIdentifiants(p?.identifiants),
    adresse: normaliserAdresse(p?.adresse),
    dateNaissance: normaliserDateNaissance(p?.dateNaissance),
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
    // `couleursParDefaut` est une palette de suggestion au niveau application
    // (non éditable en v1) : on ré-applique toujours la palette courante plutôt
    // que celle figée dans une sauvegarde ancienne, pour qu'elle suive la
    // version d'Idelia. Les autres réglages du cabinet sont préservés tels quels.
    cabinet: {
      parametres: {
        ...doc.cabinet,
        couleursParDefaut: COULEURS_PAR_DEFAUT,
        // Zone inconnue → `null`, jamais bloquant (0023).
        zoneScolaire: normaliserZoneScolaire(doc.cabinet?.zoneScolaire),
        adresseCabinet: normaliserAdresse(doc.cabinet?.adresseCabinet),
        // Assainissement (0039) : un logo non conforme ne bloque jamais l'import, il est
        // écarté ici et l'action `importer` le signale.
        logo: normaliserLogo(doc.cabinet?.logo),
      },
    },
    // `identifiants`, `adresse`, `dateNaissance` : forme garantie, jamais bloquant (0030, 0040).
    personnes: { items: (doc.personnes ?? []).map(normaliserPersonneChargee) },
    // `icone` : valeur hors liste (fichier modifié à la main) → `null`, jamais bloquant (0029).
    tournees: { items: (doc.tournees ?? []).map((t) => ({ ...t, icone: normaliserIconeTournee(t?.icone) })) },
    absences: { items: doc.absences ?? [] },
    plannings: { items: doc.plannings ?? [], selectionId: null },
    // Cache malformé → `[]` / entrées filtrées, jamais bloquant (0023).
    vacancesScolaires: { entrees: normaliserCacheVacances(doc.vacancesScolaires) },
    // Forme garantie, contenu Delta jamais réécrit (0041). `documents` : réservé à 0042.
    contrats: {
      modeles: (doc.modelesContrats ?? []).map(normaliserModeleContrat),
      documents: doc.documentsContrats ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Vérification d'intégrité
// ---------------------------------------------------------------------------

/**
 * Vérifie l'intégrité **référentielle** d'un SaveDocument. Suppose le document
 * **structurellement valide** (objets/tableaux, types) : c'est le rôle de
 * `verifierStructure` (`src/domain/validationImport.js`), appelée avant par
 * `verifierDocument`. Renvoie un verdict et des messages en français,
 * destinés à être affichés tels quels par l'UI d'import.
 *
 * Contrôles effectués : `absence.personneId`, `affectation.personneId`,
 * `affectation.tourneeId`, `planning.referentId` (s'il est non nul),
 * `personne.titulaireId` (s'il est non nul, vers une personne active ou
 * archivée) et `preference.params.tourneeIds` (souhaits `PREFERENCE_TOURNEE`)
 * doivent résoudre vers une entité existante. Aucun contrôle référentiel pour
 * `modelesContrats` en 0041 (un modèle ne référence aucune entité) : 0042 y
 * ajoutera `document.personneId` et `document.modeleId`.
 *
 * @param {SaveDocument} doc - Document structurellement valide.
 * @returns {ResultatIntegrite} Verdict et liste des erreurs éventuelles.
 */
export function verifierIntegrite(doc) {
  const erreurs = [];

  const idsPersonnes = new Set(doc.personnes.map((p) => p.id));
  const idsTournees = new Set(doc.tournees.map((t) => t.id));

  for (const absence of doc.absences) {
    if (!idsPersonnes.has(absence.personneId)) {
      erreurs.push(
        `Absence « ${absence.id} » : la personne « ${absence.personneId} » référencée est introuvable.`
      );
    }
  }

  for (const personne of doc.personnes) {
    // Souhaits « Tournée préférée ou évitée » (`PREFERENCE_TOURNEE`, 0006) :
    // chaque tournée référencée dans `params.tourneeIds` doit exister.
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

  // Titulaire remplacée en priorité (`Personne.titulaireId`, 0020) : doit exister.
  for (const personne of doc.personnes) {
    if (personne.titulaireId != null && !idsPersonnes.has(personne.titulaireId)) {
      erreurs.push(
        `Personne « ${personne.id} » : la personne remplacée en priorité « ${personne.titulaireId} » est introuvable.`
      );
    }
  }

  for (const planning of doc.plannings) {
    if (planning.referentId != null && !idsPersonnes.has(planning.referentId)) {
      erreurs.push(
        `Planning « ${planning.id} » : le référent « ${planning.referentId} » référencé est introuvable.`
      );
    }

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

  return { ok: erreurs.length === 0, erreurs };
}
