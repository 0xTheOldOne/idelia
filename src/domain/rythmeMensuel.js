/**
 * Rythme mensuel d'une personne : « jours travaillés par mois » (feature 0020).
 * Depuis 0043, le rythme est **obligatoire** pour toute personne (titulaire ou
 * remplaçante) : le temps de travail en % (`quotite`) n'existe plus.
 *
 * Module pur (ADR 0008) : aucun import Vue/Vuex, imports relatifs uniquement
 * (chargeable par un script Node sans Vite). Dates en chaînes `"YYYY-MM-DD"`,
 * jours ISO 1-7 (ADR 0010), toujours via `dateUtil`.
 */

import { dateUtil } from './utils/dates.js';
import { estPresentLe } from './presence.js';

/** Rythme minimal (jours par mois). */
export const RYTHME_MIN = 1;
/** Rythme maximal (jours par mois). */
export const RYTHME_MAX = 31;

/**
 * @typedef {Object} AttenduRythme
 * @property {number} rythme            - `joursTravaillesParMois` de la personne.
 * @property {number} attendu           - Jours attendus sur la période (réel, au prorata).
 * @property {number} attenduArrondi    - `Math.round(attendu)` : valeur affichée et comparée.
 * @property {number} joursDisponibles  - Jours ouverts de la période où la personne est présente et non absente toute la journée.
 */

/**
 * Normalise une saisie de rythme : vide, `null` ou `undefined` → `null`,
 * sinon `Number(valeur)` (sans arrondi : la validation refuse les décimales).
 *
 * @param {*} valeur - Saisie brute (nombre ou chaîne).
 * @returns {(number|null)}
 */
export function normaliserRythmeMensuel(valeur) {
  if (valeur === '' || valeur === null || valeur === undefined) return null;
  return Number(valeur);
}

/** Semaines dans un mois moyen (52 / 12). */
export const SEMAINES_PAR_MOIS = 52 / 12;

/**
 * Indique si un rythme est acceptable : entier de {@link RYTHME_MIN} à
 * {@link RYTHME_MAX}. `null`, `''` et `undefined` sont INVALIDES (0043).
 *
 * @param {*} valeur - Saisie brute.
 * @returns {boolean}
 */
export function estRythmeMensuelValide(valeur) {
  const rythme = normaliserRythmeMensuel(valeur);
  if (rythme === null) return false;
  return Number.isInteger(rythme) && rythme >= RYTHME_MIN && rythme <= RYTHME_MAX;
}

/** Rythme stocké strictement valide : nombre entier de 1 à 31 (pas de chaîne). */
export function estRythmeStockeValide(valeur) {
  return Number.isInteger(valeur) && valeur >= RYTHME_MIN && valeur <= RYTHME_MAX;
}

/**
 * Rythme proposé à la migration v14 depuis l'ancienne quotité (§3.2 de 0043).
 * Pure et déterministe.
 *
 * - `J` = nombre de jours ISO distincts (1..7) d'ouverture du cabinet ;
 * - `r` = repos hebdomadaire minimal (entier 0..7, sinon 0) ;
 * - jours par semaine = `min(J, 7 − r)`, ou 5 si < 1 (cabinet absent ou sans jour) ;
 * - quotité = nombre fini borné à [0, 100], sinon 100 ;
 * - rythme = `round(quotité / 100 × jours par semaine × 52 / 12)`, borné à [1, 31].
 *
 * @param {*} quotite - Ancienne quotité (0..100 attendu, tolère tout).
 * @param {{ joursOuverture?: *, reposHebdoMin?: * } | null | undefined} cabinet
 * @returns {number} Entier de 1 à 31.
 */
export function rythmeDepuisQuotite(quotite, cabinet) {
  const jours = new Set(
    (Array.isArray(cabinet?.joursOuverture) ? cabinet.joursOuverture : []).filter(
      (j) => Number.isInteger(j) && j >= 1 && j <= 7
    )
  );
  const repos = cabinet?.reposHebdoMin;
  const reposValide = Number.isInteger(repos) && repos >= 0 && repos <= 7 ? repos : 0;
  let joursParSemaine = Math.min(jours.size, 7 - reposValide);
  if (joursParSemaine < 1) joursParSemaine = 5;

  const q = typeof quotite === 'number' && Number.isFinite(quotite) ? Math.min(100, Math.max(0, quotite)) : 100;
  const rythme = Math.round((q / 100) * joursParSemaine * SEMAINES_PAR_MOIS);
  return Math.min(RYTHME_MAX, Math.max(RYTHME_MIN, rythme));
}

/**
 * Noms complets (« Prénom Nom ») des personnes ACTIVES (objets, `actif !== false`)
 * dont le rythme n'est pas un entier valide. Lit un document brut (n'importe
 * quelle version) : ne lève jamais.
 *
 * @param {*} personnes
 * @returns {string[]}
 */
export function personnesSansRythmeValide(personnes) {
  if (!Array.isArray(personnes)) return [];
  const chaine = (v) => (typeof v === 'string' ? v : '');
  return personnes
    .filter(
      (p) =>
        p && typeof p === 'object' && !Array.isArray(p) && p.actif !== false
        && !estRythmeStockeValide(p.joursTravaillesParMois)
    )
    .map((p) => `${chaine(p.prenom)} ${chaine(p.nom)}`.trim());
}

/** Nombre maximal de noms cités dans le message de migration. */
const NOMS_MAX_MESSAGE = 5;

/** Longueur maximale d'un nom cité (les noms viennent d'un fichier importé). */
const NOM_LONGUEUR_MAX_MESSAGE = 60;

/**
 * Tronque un nom trop long pour garder le message lisible.
 *
 * @param {string} nom
 * @returns {string}
 */
function abregerNom(nom) {
  return nom.length > NOM_LONGUEUR_MAX_MESSAGE ? `${nom.slice(0, NOM_LONGUEUR_MAX_MESSAGE - 1)}…` : nom;
}

/**
 * Texte du toast annonçant les rythmes proposés par la migration v14.
 * 5 noms au plus, puis « et N autres personnes ».
 *
 * @param {string[]} noms
 * @returns {string} `''` si la liste est vide.
 */
export function messageRythmesProposes(noms) {
  const liste = Array.isArray(noms) ? noms.filter((n) => typeof n === 'string') : [];
  if (liste.length === 0) return '';
  const cites = liste.slice(0, NOMS_MAX_MESSAGE).map(abregerNom);
  const restants = liste.length - cites.length;
  if (restants > 0) cites.push(`${restants} autre${restants > 1 ? 's' : ''} personne${restants > 1 ? 's' : ''}`);
  const texte = cites.length === 1 ? cites[0] : `${cites.slice(0, -1).join(', ')} et ${cites[cites.length - 1]}`;
  const possessif = liste.length > 1 ? 'leur' : 'son';
  return (
    'Le temps de travail en pourcentage n\'existe plus : chaque personne a maintenant un nombre de jours travaillés par mois. '
    + `Vérifiez dans le menu Équipe le nombre de jours calculé pour ${texte}, d'après ${possessif} ancien pourcentage.`
  );
}

/**
 * « 15 jours par mois », « 1 jour par mois » ; `''` si le rythme n'est pas valide.
 *
 * @param {*} valeur
 * @returns {string}
 */
export function libelleRythmeMensuel(valeur) {
  if (!estRythmeMensuelValide(valeur)) return '';
  const rythme = normaliserRythmeMensuel(valeur);
  return `${rythme} jour${rythme > 1 ? 's' : ''} par mois`;
}

/**
 * Jours attendus d'une personne sur une période, selon son rythme mensuel,
 * au prorata mois par mois des jours d'ouverture, de sa présence
 * (`dateEntree`/`dateSortie`) et de ses absences validées sur la journée
 * entière. Les demi-journées et les absences non validées ne retirent rien.
 *
 * @param {{id?: string, joursTravaillesParMois?: *, dateEntree?: (string|null), dateSortie?: (string|null)}} personne
 * @param {{debut: string, fin: string}} periode - Bornes `"YYYY-MM-DD"` incluses.
 * @param {Object} contexte
 * @param {number[]} [contexte.joursOuverture] - Jours ISO 1-7 d'ouverture du cabinet.
 * @param {Array<{personneId: string, dateDebut: string, dateFin: string, creneau: string, statut: string}>} [contexte.absences]
 * @returns {(AttenduRythme|null)} `null` si le rythme n'est pas valide (donnée invalide : il est obligatoire depuis 0043).
 */
export function joursAttendusSurPeriode(personne, periode, { joursOuverture, absences } = {}) {
  const rythme = normaliserRythmeMensuel(personne?.joursTravaillesParMois);
  if (rythme === null || !estRythmeMensuelValide(rythme)) return null;
  if (!periode?.debut || !periode?.fin) {
    return { rythme, attendu: 0, attenduArrondi: 0, joursDisponibles: 0 };
  }

  const ouverts = new Set(Array.isArray(joursOuverture) ? joursOuverture : []);
  const retenues = (Array.isArray(absences) ? absences : []).filter(
    (a) => a.personneId === personne.id && a.statut === 'VALIDE' && a.creneau === 'JOURNEE'
  );

  const estOuvert = (date) => ouverts.has(dateUtil.weekdayISO(date));
  const estAbsente = (date) => retenues.some((a) => date >= a.dateDebut && date <= a.dateFin);

  let attendu = 0;
  let joursDisponibles = 0;

  for (let mois = dateUtil.debutMois(periode.debut); mois <= periode.fin; mois = dateUtil.moisSuivant(mois)) {
    const finMois = dateUtil.finMois(mois);
    const joursOuvertsMois = dateUtil.rangeInclusive(mois, finMois).filter(estOuvert).length;
    if (joursOuvertsMois === 0) continue;

    const debut = mois > periode.debut ? mois : periode.debut;
    const fin = finMois < periode.fin ? finMois : periode.fin;
    if (debut > fin) continue;

    const jours = dateUtil
      .rangeInclusive(debut, fin)
      .filter((date) => estOuvert(date) && estPresentLe(personne, date) && !estAbsente(date)).length;

    attendu += (rythme * jours) / joursOuvertsMois;
    joursDisponibles += jours;
  }

  return { rythme, attendu, attenduArrondi: Math.round(attendu), joursDisponibles };
}
