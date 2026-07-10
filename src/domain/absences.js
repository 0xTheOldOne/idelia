/**
 * Fabrique, normalisation & chevauchements d'une Absence.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Seules concessions techniques tolérées (comme dans `schema.js`/`personnes.js`/
 * `tournees.js`) : `genId()` pour l'identifiant et `new Date().toISOString()`
 * pour les horodatages.
 *
 * Les helpers de chevauchement comparent des chaînes `"YYYY-MM-DD"` par ordre
 * lexicographique (ADR 0010) : aucun objet `Date` n'est manipulé ici.
 */

import { TYPES_ABSENCE } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';

/**
 * @typedef {Object} Absence
 * @property {string} id - Identifiant unique, immuable.
 * @property {(string|null)} personneId - Référence à une Personne.
 * @property {string} type - Motif de l'absence (voir {@link TYPES_ABSENCE}).
 * @property {string} dateDebut - Date de début `"YYYY-MM-DD"`.
 * @property {string} dateFin - Date de fin `"YYYY-MM-DD"`, inclusive, ≥ `dateDebut`.
 * @property {string} creneau - `'MATIN'`, `'APRES_MIDI'` ou `'JOURNEE'`.
 * @property {string} statut - `'DEMANDE'`, `'VALIDE'` ou `'REFUSE'` (voir `STATUTS_ABSENCE`
 *   dans `schema.js`). En v1, saisie directe sans workflow ([feature 0017]) :
 *   toujours `'VALIDE'` à la création, champ dormant préservé pour l'import/export
 *   et le moteur (aucune décision explicite tant que le workflow n'est pas réactivé).
 * @property {string} commentaire - Commentaire libre, facultatif (chaîne vide sinon).
 * @property {string} demandeLe - Horodatage ISO UTC de la demande.
 * @property {(string|null)} decideLe - Horodatage ISO UTC de la décision, `null` tant qu'aucune décision.
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * Construit une `Absence` complète et normalisée à partir d'un objet
 * partiel (typiquement les champs saisis dans le formulaire), en appliquant
 * les valeurs par défaut et en générant les champs techniques.
 *
 * Saisie directe (feature 0017) : il n'existe qu'un seul gestionnaire en v1
 * ([ADR 0014]), donc aucun workflow de demande/validation — une absence
 * saisie est **effective immédiatement**. Le champ `statut` est forcé à
 * `'VALIDE'` par défaut (dormant, préservé pour l'import/export et le
 * moteur) ; un `champs.statut` explicite reste respecté (ex. donnée
 * importée d'une version antérieure).
 *
 * La cohérence `dateFin ≥ dateDebut` est portée par le formulaire
 * (Vuelidate), pas par cette fabrique : elle ne garantit que la
 * normalisation structurelle.
 *
 * @param {Object} [champs] - Champs partiels d'une Absence.
 * @returns {Absence} Absence complète, prête à être stockée.
 */
export function creerAbsence(champs = {}) {
  const maintenant = new Date().toISOString();

  return {
    id: champs.id ?? genId(),
    personneId: champs.personneId ?? null,
    type: champs.type ?? TYPES_ABSENCE[0],
    dateDebut: champs.dateDebut ?? '',
    dateFin: champs.dateFin ?? '',
    creneau: champs.creneau ?? 'JOURNEE',
    statut: champs.statut ?? 'VALIDE',
    commentaire: String(champs.commentaire ?? '').trim(),
    demandeLe: champs.demandeLe ?? maintenant,
    decideLe: champs.decideLe ?? null,
    createdAt: champs.createdAt ?? maintenant,
    updatedAt: maintenant,
  };
}

/**
 * Indique si deux créneaux se chevauchent : `true` si l'un des deux vaut
 * `'JOURNEE'` (qui couvre toute la journée) ou s'ils sont égaux. Deux
 * demi-journées distinctes (`MATIN`/`APRES_MIDI`) ne se chevauchent pas.
 *
 * @param {string} a - Code créneau (`CRENEAUX`).
 * @param {string} b - Code créneau (`CRENEAUX`).
 * @returns {boolean} `true` si les créneaux se chevauchent.
 */
export function creneauxSeChevauchent(a, b) {
  return a === 'JOURNEE' || b === 'JOURNEE' || a === b;
}

/**
 * Indique si deux intervalles de dates inclusifs `"YYYY-MM-DD"` se
 * chevauchent, par comparaison lexicographique de chaînes (ADR 0010) —
 * aucun objet `Date`.
 *
 * @param {string} debutA - Date de début de la première période.
 * @param {string} finA - Date de fin de la première période (inclusive).
 * @param {string} debutB - Date de début de la seconde période.
 * @param {string} finB - Date de fin de la seconde période (inclusive).
 * @returns {boolean} `true` si les deux périodes se recoupent.
 */
export function periodesSeChevauchent(debutA, finA, debutB, finB) {
  return debutA <= finB && debutB <= finA;
}

/**
 * Indique si deux absences se chevauchent : même personne, périodes qui se
 * recoupent et créneaux compatibles, en excluant l'identité (`a.id !==
 * b.id`, pour ne pas comparer une absence à elle-même en édition).
 *
 * @param {Absence} a
 * @param {Absence} b
 * @returns {boolean} `true` si `a` et `b` sont en conflit.
 */
export function absencesSeChevauchent(a, b) {
  return (
    a.id !== b.id &&
    a.personneId === b.personneId &&
    periodesSeChevauchent(a.dateDebut, a.dateFin, b.dateDebut, b.dateFin) &&
    creneauxSeChevauchent(a.creneau, b.creneau)
  );
}

/**
 * Liste les absences de `absences` qui chevauchent `absenceCible` (voir
 * {@link absencesSeChevauchent}). Utilisé pour un avertissement non
 * bloquant à la saisie (`0007`), réutilisable par le moteur (`0009`).
 *
 * @param {Absence} absenceCible
 * @param {Absence[]} absences - Absences à comparer à `absenceCible`.
 * @returns {Absence[]} Absences en conflit, `[]` si aucune.
 */
export function chevauchementsPour(absenceCible, absences) {
  return absences.filter((absence) => absencesSeChevauchent(absenceCible, absence));
}

/**
 * Déduit l'état temporel **factuel** d'une absence par rapport à
 * `aujourdhui` : `'PASSEE'` si sa date de fin est déjà dépassée, `'A_VENIR'`
 * si sa date de début n'est pas encore atteinte, `'EN_COURS'` sinon
 * (aujourd'hui est compris dans la période). Comparaison lexicographique de
 * chaînes `"YYYY-MM-DD"` (ADR 0010) : **aucun objet `Date`** n'est manipulé
 * ici.
 *
 * Ce repère est **purement descriptif** — il ne reflète jamais une décision
 * ou une approbation ([ADR 0014], feature 0017) : `aujourdhui` est fourni
 * par l'appelant, jamais lu depuis l'horloge, pour que ce module reste pur.
 *
 * @param {{ dateDebut: string, dateFin: string }} absence
 * @param {string} aujourdhui - Date du jour `"YYYY-MM-DD"`, injectée par l'appelant.
 * @returns {'PASSEE'|'EN_COURS'|'A_VENIR'} État temporel factuel.
 */
export function etatTemporelAbsence(absence, aujourdhui) {
  if (absence.dateFin < aujourdhui) return 'PASSEE';
  if (absence.dateDebut > aujourdhui) return 'A_VENIR';
  return 'EN_COURS';
}

/**
 * Filtre les absences « à venir » : celles dont la date de fin n'est pas
 * encore dépassée (`dateFin >= dateReference`, comparaison lexicographique
 * de chaînes `"YYYY-MM-DD"`, ADR 0010) **et** dont le statut n'est pas
 * `'REFUSE'` (une absence refusée n'est jamais « à venir »). Triées par
 * `dateDebut` croissant. Pure et déterministe : `dateReference` (aujourd'hui)
 * est fournie par l'appelant, jamais lue via `Date.now()` ici.
 *
 * @param {Absence[]} absences
 * @param {string} dateReference - Date du jour `"YYYY-MM-DD"`, injectée par l'appelant.
 * @returns {Absence[]} Absences à venir, triées par `dateDebut` croissant.
 */
export function absencesAVenir(absences, dateReference) {
  return absences
    .filter((absence) => absence.dateFin >= dateReference && absence.statut !== 'REFUSE')
    .sort((a, b) => (a.dateDebut < b.dateDebut ? -1 : a.dateDebut > b.dateDebut ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Réconciliation horaire créneau ↔ segment (feature 0016, ADR 0017)
// ---------------------------------------------------------------------------
//
// Les absences restent à la granularité demi-journée (`CRENEAUX` :
// `MATIN`/`APRES_MIDI`/`JOURNEE`, hors périmètre 0016 — public non
// technique). Les tournées, elles, portent des segments aux horaires réels
// (`"HH:mm"`). Les helpers ci-dessous réconcilient les deux : ils ne
// remplacent pas `creneauxSeChevauchent`/`periodesSeChevauchent`/
// `absencesSeChevauchent`/`chevauchementsPour` ci-dessus, toujours utilisés
// par le formulaire d'absences (0007) où les deux côtés sont des buckets.

/**
 * Indique si deux plages horaires `"HH:mm"` se chevauchent **strictement**
 * (recouvrement horaire réel, ADR 0017), par comparaison lexicographique de
 * chaînes (ADR 0010) — aucun objet `Date`. Deux plages qui se **touchent**
 * aux bornes (ex. fin de l'une = début de l'autre, `13:30`/`13:30`) ne se
 * chevauchent **pas**. Seule source de vérité du recouvrement horaire réel,
 * réutilisée par le chevauchement segment-vs-segment et par la
 * réconciliation créneau ↔ segment ({@link creneauChevaucheHoraires}).
 *
 * @param {string} debutA - Heure de début `"HH:mm"` de la première plage.
 * @param {string} finA - Heure de fin `"HH:mm"` de la première plage.
 * @param {string} debutB - Heure de début `"HH:mm"` de la seconde plage.
 * @param {string} finB - Heure de fin `"HH:mm"` de la seconde plage.
 * @returns {boolean} `true` si les deux plages se recouvrent strictement.
 */
export function heuresSeChevauchent(debutA, finA, debutB, finB) {
  return debutA < finB && debutB < finA;
}

/**
 * Plage horaire canonique `"HH:mm"` de chaque créneau symbolique (bucket
 * grossier des absences/préférences), autour d'un **pivot midi**
 * `"13:00"` (ADR 0017, §12 sous-décision A — convention ajustable). Le
 * segment du soir d'une tournée coupée (ex. `17:00–20:00`) tombe dans
 * `APRES_MIDI` ; le segment du matin d'une tournée à horaires larges peut
 * déborder le pivot et recouper `MATIN` **et** `APRES_MIDI`.
 *
 * @type {Object<string, { debut: string, fin: string }>}
 */
export const CRENEAU_PLAGES = Object.freeze({
  MATIN: Object.freeze({ debut: '00:00', fin: '13:00' }),
  APRES_MIDI: Object.freeze({ debut: '13:00', fin: '23:59' }),
  JOURNEE: Object.freeze({ debut: '00:00', fin: '23:59' }),
});

/**
 * Indique si un créneau symbolique (bucket grossier — absence ou préférence
 * de créneau) recouvre une plage horaire réelle `"HH:mm"` (typiquement un
 * segment de tournée), via {@link heuresSeChevauchent} appliqué à la plage
 * canonique du créneau ({@link CRENEAU_PLAGES}).
 *
 * @param {string} creneau - Code créneau (`CRENEAUX`).
 * @param {string} heureDebut - Heure de début `"HH:mm"` de la plage réelle.
 * @param {string} heureFin - Heure de fin `"HH:mm"` de la plage réelle.
 * @returns {boolean} `true` si le créneau recouvre la plage horaire réelle.
 */
export function creneauChevaucheHoraires(creneau, heureDebut, heureFin) {
  const plage = CRENEAU_PLAGES[creneau];
  return heuresSeChevauchent(plage.debut, plage.fin, heureDebut, heureFin);
}
