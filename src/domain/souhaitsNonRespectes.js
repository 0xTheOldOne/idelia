/**
 * Souhaits non respectés (0025) : localise, sur les affectations d'un planning,
 * les violations `PREFERENCE_*` produites par le moteur (souhaits de la fiche
 * Souhaits) et fabrique les textes de l'indicateur « pouce baissé ».
 *
 * Module pur (ADR 0008) : aucun import Vue/Vuex, aucun accès stockage, rien du
 * moteur `scheduling/` (les `Violation` sont consommées comme simples données).
 * Calcul dérivé, jamais persisté. Ne lève jamais : toute entrée incohérente est
 * ignorée. Dates `"YYYY-MM-DD"` (ADR 0010), comparées comme chaînes.
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { libelleNaturePreference } from '@/domain/libelles.js';

/**
 * @typedef {Object} SouhaitNonRespecte
 * @property {string}  preferenceId
 * @property {string}  personneId
 * @property {boolean} obligatoire     Violation.severite === 'erreur'
 * @property {string}  message         Violation.message, tel quel (déjà en français)
 */

/**
 * @typedef {Object<string, SouhaitNonRespecte[]>} SouhaitsParAffectation
 * Clé = Affectation.id.
 */

/**
 * @typedef {Object} IndicateurSouhait Prêt à afficher par CellulePlanning.
 * @property {boolean} obligatoire     Au moins un souhait obligatoire.
 * @property {string}  libelle         Infobulle (title) + aria-label du bouton.
 * @property {Array<{nature: string, message: string}>} details  nature = 'Obligatoire' | 'Souhait'
 */

const REGEX_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** @param {*} v @returns {boolean} */
function estObjet(v) {
  return v !== null && typeof v === 'object';
}

/** @param {*} v @returns {boolean} */
function estDateValide(v) {
  return typeof v === 'string' && REGEX_DATE.test(v);
}

/**
 * Indique si un code de violation correspond à un souhait de la fiche Souhaits.
 *
 * @param {*} code
 * @returns {boolean}
 */
export function estCodeSouhait(code) {
  return typeof code === 'string' && code.startsWith('PREFERENCE_');
}

/**
 * Découpe des dates triées en suites de jours consécutifs.
 *
 * @param {string[]} jours - Dates distinctes triées.
 * @returns {string[][]}
 */
function decouperSuites(jours) {
  const suites = [];
  let courante = [];
  for (const jour of jours) {
    if (courante.length > 0 && dateUtil.diffDays(courante[courante.length - 1], jour) !== 1) {
      suites.push(courante);
      courante = [];
    }
    courante.push(jour);
  }
  if (courante.length > 0) suites.push(courante);
  return suites;
}

/**
 * Dates visées par une violation « de période » (sans date dans sa cible).
 *
 * @param {Object} violation
 * @param {string[]} jours - Jours travaillés distincts triés de la personne.
 * @returns {string[]}
 */
function datesDePeriode(violation, jours) {
  const p = violation.params ?? {};
  switch (violation.code) {
    case 'PREFERENCE_MAX_JOURS_CONSECUTIFS': {
      const max = p.maxAutorise;
      if (!Number.isInteger(max) || max < 1) return [];
      const dates = [];
      for (const suite of decouperSuites(jours)) {
        if (suite.length > max) {
          dates.push(...dateUtil.rangeInclusive(dateUtil.addDays(suite[0], max), suite[suite.length - 1]));
        }
      }
      return dates;
    }
    case 'PREFERENCE_NB_JOURS_SEMAINE': {
      if (!Number.isInteger(p.max) || p.max < 0 || !(p.nb > p.max) || !estDateValide(p.semaineDebut)) return [];
      const fin = dateUtil.addDays(p.semaineDebut, 6);
      return jours.filter((j) => j >= p.semaineDebut && j <= fin).slice(p.max);
    }
    case 'PREFERENCE_MIN_JOURS_CONSECUTIFS': {
      if (!estDateValide(p.debut) || !estDateValide(p.fin)) return [];
      return jours.filter((j) => j >= p.debut && j <= p.fin);
    }
    default:
      return [];
  }
}

/**
 * Associe à chaque affectation les souhaits non respectés qui la concernent.
 * Correspondance par coordonnées (personne, tournée, date, segment), jamais par
 * id : une violation périmée ne s'accroche pas à une affectation déplacée.
 *
 * @param {Array<Object>} affectations - `Affectation[]` du planning courant.
 * @param {Array<Object>} violations - `Violation[]` du moteur.
 * @returns {SouhaitsParAffectation}
 */
export function indexerSouhaitsNonRespectes(affectations, violations) {
  // Sans prototype : un id importé comme « constructor » ou « __proto__ »
  // ne doit pas tomber sur une propriété héritée.
  const resultat = Object.create(null);
  if (!Array.isArray(affectations) || !Array.isArray(violations)) return resultat;

  // Pré-index : affectations par personne, jours travaillés distincts triés.
  const parPersonne = new Map();
  for (const a of affectations) {
    if (!estObjet(a) || a.id == null || a.personneId == null || !estDateValide(a.date)) continue;
    if (!parPersonne.has(a.personneId)) parPersonne.set(a.personneId, []);
    parPersonne.get(a.personneId).push(a);
  }
  const joursParPersonne = new Map();
  for (const [personneId, liste] of parPersonne) {
    joursParPersonne.set(personneId, [...new Set(liste.map((a) => a.date))].sort());
  }

  for (const v of violations) {
    if (!estObjet(v) || !estCodeSouhait(v.code)) continue;
    const preferenceId = v.params?.preferenceId;
    if (!preferenceId) continue;
    const personneId = v.cible?.personneId ?? v.params?.personneId;
    const deLaPersonne = parPersonne.get(personneId);
    if (!deLaPersonne) continue;

    let cibles;
    const cible = v.cible;
    if (estObjet(cible) && cible.date != null) {
      cibles = deLaPersonne.filter(
        (a) =>
          a.date === cible.date &&
          (cible.tourneeId == null || a.tourneeId === cible.tourneeId) &&
          (cible.segmentIndex == null || a.segmentIndex === cible.segmentIndex),
      );
    } else {
      const dates = new Set(datesDePeriode(v, joursParPersonne.get(personneId) ?? []));
      cibles = deLaPersonne.filter((a) => dates.has(a.date));
    }

    for (const a of cibles) {
      const liste = resultat[a.id] ?? (resultat[a.id] = []);
      if (liste.some((s) => s.preferenceId === preferenceId)) continue;
      liste.push({
        preferenceId,
        personneId,
        obligatoire: v.severite === 'erreur',
        message: v.message ?? '',
      });
    }
  }

  // Obligatoires d'abord, puis ordre d'arrivée (tri stable).
  for (const id of Object.keys(resultat)) {
    resultat[id] = [
      ...resultat[id].filter((s) => s.obligatoire),
      ...resultat[id].filter((s) => !s.obligatoire),
    ];
  }
  return resultat;
}

/**
 * Fabrique les textes de l'indicateur d'un élément de case.
 *
 * @param {SouhaitNonRespecte[]} souhaits
 * @param {string} nomPersonne - « Prénom Nom » (vide : « cette personne »).
 * @returns {?IndicateurSouhait}
 */
export function construireIndicateurSouhait(souhaits, nomPersonne) {
  if (!Array.isArray(souhaits) || souhaits.length === 0) return null;
  const n = souhaits.length;
  const k = souhaits.filter((s) => s?.obligatoire).length;
  const nom = nomPersonne || 'cette personne';
  let libelle;
  if (n === 1) {
    libelle = `${k > 0 ? 'Souhait obligatoire' : 'Souhait'} non respecté pour ${nom}. Voir le détail`;
  } else {
    const dont = k > 0 ? `, dont ${k} obligatoire${k > 1 ? 's' : ''}` : '';
    libelle = `${n} souhaits non respectés pour ${nom}${dont}. Voir le détail`;
  }
  return {
    obligatoire: k > 0,
    libelle,
    details: souhaits.map((s) => ({
      nature: libelleNaturePreference(s?.obligatoire ? 'DURE' : 'SOUPLE'),
      message: sansPrefixeNom(s?.message ?? '', nomPersonne),
    })),
  };
}

/**
 * Retire le préfixe « Prénom Nom — » des messages du moteur (rédigés pour le
 * panneau) : dans la case, le nom figure déjà juste au-dessus.
 *
 * @param {string} message
 * @param {string} [nomPersonne]
 * @returns {string}
 */
function sansPrefixeNom(message, nomPersonne) {
  const prefixe = nomPersonne ? `${nomPersonne} — ` : '';
  if (!prefixe || !message.startsWith(prefixe)) return message;
  const reste = message.slice(prefixe.length);
  return reste.charAt(0).toUpperCase() + reste.slice(1);
}
