/**
 * Validation structurelle d'un document de sauvegarde (import et rechargement
 * depuis le stockage local). Module pur : aucun import Vue/Vuex, aucun accès
 * au stockage, ne lève jamais (ADR 0008).
 *
 * Objectif : refuser un fichier forgé ou corrompu (types faux, valeurs hors
 * liste, tailles démesurées) **avant** qu'il n'atteigne le store, le stockage
 * local ou le moteur de planification. Les clés inconnues sont tolérées (on ne
 * supprime rien : risque de perte de données réelles) ; seuls les champs
 * connus sont contrôlés. Un champ facultatif absent ou `null` est accepté.
 */

import {
  CRENEAUX,
  STATUTS_PERSONNE,
  NATURES_PREFERENCE,
  TYPES_PREFERENCE,
  TYPES_ABSENCE,
  STATUTS_ABSENCE,
  ORIGINES_AFFECTATION,
  STATUTS_PLANNING,
  verifierIntegrite,
} from '@/domain/schema.js';

/** Taille maximale d'un fichier de sauvegarde importé (octets) : 10 Mo. */
export const TAILLE_MAX_FICHIER_OCTETS = 10 * 1024 * 1024;

/** Nombre maximal de messages d'erreur remontés à l'utilisateur. */
const MAX_ERREURS = 10;

/** Plafonds de cardinalité des collections. */
const MAX = Object.freeze({
  personnes: 1000,
  tournees: 1000,
  absences: 50000,
  plannings: 1000,
  affectations: 100000,
  preferences: 200,
  segments: 50,
  vacances: 200,
});

const LONGUEUR_ID = 100;
const LONGUEUR_COURTE = 500;
const LONGUEUR_LONGUE = 20000;

const RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_COULEUR = /^#[0-9a-fA-F]{3,8}$/;

/**
 * @param {*} v
 * @returns {boolean} `true` si `v` est un objet « simple » (ni `null`, ni tableau).
 */
function estObjet(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {*} v
 * @returns {boolean} `true` si `v` est une date calendaire réelle `"YYYY-MM-DD"`.
 */
function estDate(v) {
  if (typeof v !== 'string') return false;
  const m = RE_DATE.exec(v);
  if (!m) return false;
  const mois = Number(m[2]);
  const jour = Number(m[3]);
  if (mois < 1 || mois > 12 || jour < 1) return false;
  const joursDuMois = new Date(Date.UTC(Number(m[1]), mois, 0)).getUTCDate();
  return jour <= joursDuMois;
}

/**
 * Contrôleurs de valeur par type de règle. Chacun renvoie `true` si valide.
 * @type {Record<string, (v: *, opts: object) => boolean>}
 */
const CONTROLEURS = {
  id: (v) => typeof v === 'string' && v.length > 0 && v.length <= LONGUEUR_ID,
  texte: (v, o) => typeof v === 'string' && v.length <= (o.max ?? LONGUEUR_COURTE),
  date: estDate,
  heure: (v) => typeof v === 'string' && (v === '' || RE_HEURE.test(v)), // '' : héritage migration v1
  couleur: (v) => typeof v === 'string' && RE_COULEUR.test(v),
  horodatage: (v) => typeof v === 'string' && v.length <= 40,
  entier: (v, o) =>
    Number.isInteger(v) && v >= (o.min ?? -1e9) && v <= (o.max ?? 1e9),
  nombre: (v, o) => Number.isFinite(v) && v >= (o.min ?? -1e9) && v <= (o.max ?? 1e9),
  booleen: (v) => typeof v === 'boolean',
  objet: estObjet,
  tableau: (v, o) => Array.isArray(v) && v.length <= (o.max ?? 1000),
  enum: (v, o) => o.valeurs.includes(v),
};

/**
 * Contrôle les champs d'un objet selon une table de règles.
 *
 * @param {object} obj - Entité à contrôler.
 * @param {Record<string, object>} regles - `{ champ: { type, requis?, ...options } }`.
 * @param {string} contexte - Préfixe lisible pour les messages.
 * @param {string[]} erreurs - Accumulateur de messages.
 */
function controlerChamps(obj, regles, contexte, erreurs) {
  for (const [champ, regle] of Object.entries(regles)) {
    const v = obj[champ];
    if (v === undefined || v === null) {
      if (regle.requis) erreurs.push(`${contexte} : le champ « ${champ} » est manquant.`);
      continue;
    }
    if (!CONTROLEURS[regle.type](v, regle)) {
      erreurs.push(`${contexte} : le champ « ${champ} » est invalide.`);
    }
  }
}

/**
 * Contrôle une collection d'entités (tableau d'objets) et applique `controle`
 * à chaque élément.
 *
 * @param {*} liste - Valeur à contrôler.
 * @param {string} nom - Nom français de la collection (messages).
 * @param {number} max - Cardinalité maximale.
 * @param {string[]} erreurs - Accumulateur de messages.
 * @param {(item: object, contexte: string) => void} controle - Contrôle d'un élément.
 * @param {string} singulier - Libellé d'un élément (messages).
 */
function controlerCollection(liste, nom, max, erreurs, controle, singulier) {
  if (!Array.isArray(liste)) return; // déjà signalé par la structure racine
  if (liste.length > max) {
    erreurs.push(`Trop d'éléments dans « ${nom} » (maximum ${max}).`);
    return;
  }
  liste.forEach((item, i) => {
    const contexte = `${singulier} n°${i + 1}`;
    if (!estObjet(item)) {
      erreurs.push(`${contexte} : élément invalide.`);
      return;
    }
    controle(item, contexte);
  });
}

const REGLES_CABINET = {
  nomCabinet: { type: 'texte' },
  joursOuverture: { type: 'tableau', max: 7, requis: true },
  creneauxActifs: { type: 'tableau', max: 3, requis: true },
  reposHebdoMin: { type: 'entier', min: 0, max: 7 },
  maxJoursConsecutifs: { type: 'entier', min: 0, max: 366 },
  premierJourSemaine: { type: 'entier', min: 1, max: 7 },
  couleursParDefaut: { type: 'tableau', max: 50 },
  zoneScolaire: { type: 'texte', max: LONGUEUR_ID },
  updatedAt: { type: 'horodatage' },
};

const REGLES_PERSONNE = {
  id: { type: 'id', requis: true },
  prenom: { type: 'texte' },
  nom: { type: 'texte' },
  statut: { type: 'enum', valeurs: STATUTS_PERSONNE },
  actif: { type: 'booleen' },
  couleur: { type: 'couleur' },
  quotite: { type: 'nombre', min: 0, max: 1000 },
  dateEntree: { type: 'date' },
  dateSortie: { type: 'date' },
  contact: { type: 'objet' },
  notes: { type: 'texte', max: LONGUEUR_LONGUE },
  initialesVega: { type: 'texte', max: LONGUEUR_ID },
  ordreAffichage: { type: 'nombre' },
  preferences: { type: 'tableau', max: MAX.preferences },
  joursTravaillesParMois: { type: 'nombre', min: 0, max: 31 },
  titulaireId: { type: 'id' },
  createdAt: { type: 'horodatage' },
  updatedAt: { type: 'horodatage' },
};

const REGLES_PREFERENCE = {
  id: { type: 'id', requis: true },
  type: { type: 'enum', valeurs: TYPES_PREFERENCE, requis: true },
  nature: { type: 'enum', valeurs: NATURES_PREFERENCE },
  poids: { type: 'nombre', min: 0, max: 100 },
  actif: { type: 'booleen' },
  params: { type: 'objet' },
  libelle: { type: 'texte', max: LONGUEUR_LONGUE },
};

const REGLES_TOURNEE = {
  id: { type: 'id', requis: true },
  libelle: { type: 'texte' },
  segments: { type: 'tableau', max: MAX.segments },
  joursApplication: { type: 'tableau', max: 7 },
  couleur: { type: 'couleur' },
  archivee: { type: 'booleen' },
  dateDebutValidite: { type: 'date' },
  dateFinValidite: { type: 'date' },
  ordreAffichage: { type: 'nombre' },
  notes: { type: 'texte', max: LONGUEUR_LONGUE },
  createdAt: { type: 'horodatage' },
  updatedAt: { type: 'horodatage' },
};

const REGLES_SEGMENT = {
  heureDebut: { type: 'heure' },
  heureFin: { type: 'heure' },
  nbPersonnesRequises: { type: 'entier', min: 0, max: 1000 },
};

const REGLES_ABSENCE = {
  id: { type: 'id', requis: true },
  personneId: { type: 'id' },
  type: { type: 'enum', valeurs: TYPES_ABSENCE },
  dateDebut: { type: 'date', requis: true },
  dateFin: { type: 'date', requis: true },
  creneau: { type: 'enum', valeurs: CRENEAUX },
  statut: { type: 'enum', valeurs: STATUTS_ABSENCE },
  commentaire: { type: 'texte', max: LONGUEUR_LONGUE },
  demandeLe: { type: 'horodatage' },
  decideLe: { type: 'horodatage' },
  createdAt: { type: 'horodatage' },
  updatedAt: { type: 'horodatage' },
};

const REGLES_PLANNING = {
  id: { type: 'id', requis: true },
  nom: { type: 'texte' },
  dateDebut: { type: 'date', requis: true },
  dateFin: { type: 'date', requis: true },
  statut: { type: 'enum', valeurs: STATUTS_PLANNING },
  affectations: { type: 'tableau', max: MAX.affectations },
  parametresGeneration: { type: 'objet' },
  referentId: { type: 'id' },
  publieLe: { type: 'horodatage' },
  genereLe: { type: 'horodatage' },
  createdAt: { type: 'horodatage' },
  updatedAt: { type: 'horodatage' },
};

const REGLES_AFFECTATION = {
  id: { type: 'id', requis: true },
  personneId: { type: 'id', requis: true },
  tourneeId: { type: 'id', requis: true },
  date: { type: 'date', requis: true },
  segmentIndex: { type: 'entier', min: 0, max: 1000 },
  origine: { type: 'enum', valeurs: ORIGINES_AFFECTATION },
  verrouillee: { type: 'booleen' },
  commentaire: { type: 'texte', max: LONGUEUR_LONGUE },
  createdAt: { type: 'horodatage' },
  updatedAt: { type: 'horodatage' },
};

/**
 * Pré-contrôle **avant migration** : le document est-il un objet avec un
 * `schemaVersion` entier dans la plage connue ? Ne lève jamais.
 *
 * @param {*} doc - Valeur issue de `JSON.parse` (forme quelconque).
 * @param {number} versionCourante - `CURRENT_SCHEMA_VERSION`.
 * @returns {{ ok: boolean, message?: string }}
 */
export function verifierVersion(doc, versionCourante) {
  if (!estObjet(doc)) {
    return { ok: false, message: "Ce fichier n'est pas une sauvegarde Idelia valide." };
  }
  const v = doc.schemaVersion;
  if (!Number.isInteger(v) || v < 1) {
    return { ok: false, message: "Ce fichier n'est pas une sauvegarde Idelia valide (version manquante ou illisible)." };
  }
  if (v > versionCourante) {
    return {
      ok: false,
      message:
        "Cette sauvegarde a été créée par une version plus récente d'Idelia. " +
        "Mettez l'application à jour pour l'ouvrir.",
    };
  }
  return { ok: true };
}

/**
 * Validation structurelle d'un document **déjà migré** (types, formats,
 * énumérations, tailles). Ne lève jamais.
 *
 * @param {*} doc - Document migré.
 * @returns {{ ok: boolean, erreurs: string[] }} Messages en français.
 */
export function verifierStructure(doc) {
  const erreurs = [];
  if (!estObjet(doc)) {
    return { ok: false, erreurs: ["Le document est invalide : un objet est attendu."] };
  }

  const collections = ['personnes', 'tournees', 'absences', 'plannings'];
  for (const nom of collections) {
    if (!Array.isArray(doc[nom])) erreurs.push(`Le champ « ${nom} » doit être une liste.`);
  }
  if (!estObjet(doc.cabinet)) {
    erreurs.push('Le champ « cabinet » doit être un objet.');
  } else {
    controlerChamps(doc.cabinet, REGLES_CABINET, 'Réglages du cabinet', erreurs);
    if (Array.isArray(doc.cabinet.joursOuverture)
      && !doc.cabinet.joursOuverture.every((j) => Number.isInteger(j) && j >= 1 && j <= 7)) {
      erreurs.push('Réglages du cabinet : les jours d\'ouverture sont invalides.');
    }
    if (Array.isArray(doc.cabinet.creneauxActifs)
      && !doc.cabinet.creneauxActifs.every((c) => CRENEAUX.includes(c))) {
      erreurs.push('Réglages du cabinet : les créneaux actifs sont invalides.');
    }
  }
  if (doc.vacancesScolaires !== undefined && doc.vacancesScolaires !== null
    && (!Array.isArray(doc.vacancesScolaires) || doc.vacancesScolaires.length > MAX.vacances)) {
    erreurs.push('Le champ « vacancesScolaires » est invalide.');
  }

  controlerCollection(doc.personnes, 'personnes', MAX.personnes, erreurs, (p, ctx) => {
    controlerChamps(p, REGLES_PERSONNE, ctx, erreurs);
    if (Array.isArray(p.preferences) && p.preferences.length <= MAX.preferences) {
      p.preferences.forEach((pref, i) => {
        const c = `${ctx}, souhait n°${i + 1}`;
        if (!estObjet(pref)) erreurs.push(`${c} : élément invalide.`);
        else controlerChamps(pref, REGLES_PREFERENCE, c, erreurs);
      });
    }
  }, 'Personne');

  controlerCollection(doc.tournees, 'tournees', MAX.tournees, erreurs, (t, ctx) => {
    controlerChamps(t, REGLES_TOURNEE, ctx, erreurs);
    if (Array.isArray(t.joursApplication)
      && !t.joursApplication.every((j) => Number.isInteger(j) && j >= 1 && j <= 7)) {
      erreurs.push(`${ctx} : les jours d'application sont invalides.`);
    }
    if (Array.isArray(t.segments) && t.segments.length <= MAX.segments) {
      t.segments.forEach((s, i) => {
        const c = `${ctx}, segment n°${i + 1}`;
        if (!estObjet(s)) erreurs.push(`${c} : élément invalide.`);
        else controlerChamps(s, REGLES_SEGMENT, c, erreurs);
      });
    }
  }, 'Tournée');

  controlerCollection(doc.absences, 'absences', MAX.absences, erreurs, (a, ctx) => {
    controlerChamps(a, REGLES_ABSENCE, ctx, erreurs);
  }, 'Absence');

  controlerCollection(doc.plannings, 'plannings', MAX.plannings, erreurs, (pl, ctx) => {
    controlerChamps(pl, REGLES_PLANNING, ctx, erreurs);
    if (Array.isArray(pl.affectations) && pl.affectations.length <= MAX.affectations) {
      pl.affectations.forEach((a, i) => {
        const c = `${ctx}, affectation n°${i + 1}`;
        if (!estObjet(a)) erreurs.push(`${c} : élément invalide.`);
        else controlerChamps(a, REGLES_AFFECTATION, c, erreurs);
      });
    }
  }, 'Planning');

  return { ok: erreurs.length === 0, erreurs };
}

/**
 * Validation complète d'un document **déjà migré** : structure d'abord, puis
 * intégrité référentielle (seulement si la structure est saine, pour ne jamais
 * parcourir des éléments invalides). Ne lève jamais ; au plus
 * {@link MAX_ERREURS} messages sont renvoyés.
 *
 * @param {*} doc - Document migré.
 * @returns {{ ok: boolean, erreurs: string[] }}
 */
export function verifierDocument(doc) {
  try {
    const structure = verifierStructure(doc);
    if (!structure.ok) return { ok: false, erreurs: structure.erreurs.slice(0, MAX_ERREURS) };
    const integrite = verifierIntegrite(doc);
    return { ok: integrite.ok, erreurs: integrite.erreurs.slice(0, MAX_ERREURS) };
  } catch {
    return { ok: false, erreurs: ['Le contenu de la sauvegarde est invalide.'] };
  }
}
