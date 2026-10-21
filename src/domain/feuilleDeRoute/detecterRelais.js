/**
 * Détection des patients vus par plusieurs infirmières (feature 0033) : un même patient,
 * soigné plusieurs fois le même jour (soins BSA/BSB/BSC) par au moins deux codes PS différents.
 * Seul le soin de base (BSA/BSB/BSC) est partagé, à parts égales entre les infirmières
 * distinctes du jour ; les autres soins (IFI, AMI, majorations, IK…) restent à celle qui les a
 * faits (feature 0037). On calcule ensuite qui doit reverser combien à qui (feature 0034).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Tous les calculs d'argent se font en centimes (entiers).
 */

import { genId } from '../utils/id.js';

/**
 * @typedef {import('./extraireSeances.js').Seance} Seance
 *
 * @typedef {Object} PassageRelais
 * @property {string} ps
 * @property {string} heure                    // "HH:mm"
 * @property {string} cotation
 * @property {(number|null)} montantCentimes
 *
 * @typedef {Object} PartRelais
 * @property {string} ps
 * @property {number} nbPassages
 * @property {number} toucheCentimes           // somme des montants de SES lignes
 * @property {number} partCentimes             // ses soins hors BS + sa part du BS
 * @property {number} ecartCentimes            // toucheCentimes − partCentimes ; > 0 = doit reverser
 *
 * @typedef {Object} Reversement
 * @property {string} de                       // code PS qui verse
 * @property {string} vers                     // code PS qui reçoit
 * @property {number} montantCentimes          // > 0
 *
 * @typedef {Object} CasRelais
 * @property {string} id                       // GUID (genId) — sert de :key
 * @property {string} date                     // "YYYY-MM-DD"
 * @property {string} patient
 * @property {(string|null)} fin               // "YYYY-MM-DD" ou null
 * @property {PassageRelais[]} passages        // triés par heure
 * @property {number} nbPassages
 * @property {(number|null)} totalCentimes     // null si un montant est illisible
 * @property {(number|null)} bsCentimes        // montant du soin de base partagé (null si montantIncomplet)
 * @property {(number|null)} partBsCentimes    // part du BS par infirmière, arrondie (affichage)
 * @property {PartRelais[]} parts              // vide si montantIncomplet
 * @property {Reversement[]} reversements      // vide si montantIncomplet ou écarts nuls
 * @property {boolean} montantIncomplet
 */

/**
 * @param {{heure: string}} a
 * @param {{heure: string}} b
 * @returns {number}
 */
function parHeure(a, b) {
  return a.heure < b.heure ? -1 : a.heure > b.heure ? 1 : 0;
}

/**
 * Libellé du moment d'un passage selon sa position (0 = premier).
 * 2 passages : Matin, Soir ; 3 : Matin, Midi, Soir ; sinon « Passage 1 », « Passage 2 »…
 * @param {number} index
 * @param {number} nbPassages
 * @returns {string}
 */
export function libelleMoment(index, nbPassages) {
  if (nbPassages === 2) return ['Matin', 'Soir'][index];
  if (nbPassages === 3) return ['Matin', 'Midi', 'Soir'][index];
  return `Passage ${index + 1}`;
}

/**
 * Tarifs NGAP du soin de base en centimes (métropole). Vérifiés sur les totaux de pied de page
 * du PDF Vega (BSA = 195,00 pour 15 actes, BSB = 1 801,80 pour 99). La cotation Vega est
 * tronquée et ne donne qu'un montant par ligne : seul le tarif permet d'isoler le BS.
 */
export const TARIFS_BS_CENTIMES = Object.freeze({ BSA: 1300, BSB: 1820, BSC: 2870 });

const MOTIF_BS = /^(BS[ABC])(\d+(?:[.,]\d+)?)/;

/**
 * Montant du soin de base d'une cotation (« BSB1+IFI1 (… » → 1820), 0 s'il n'y en a pas.
 * @param {string} cotation
 * @returns {number}
 */
export function montantBsCentimes(cotation) {
  const m = MOTIF_BS.exec(String(cotation ?? ''));
  if (!m) return 0;
  return Math.round(TARIFS_BS_CENTIMES[m[1]] * Number(m[2].replace(',', '.')));
}

/**
 * Répartit un cas entre les infirmières : chacune garde ses soins hors BS, et le BS est partagé
 * à parts égales entre les infirmières distinctes (quel que soit leur nombre de passages).
 * Les centimes qui ne se divisent pas restent à celles qui ont facturé le BS : somme = total.
 * @param {PassageRelais[]} passages
 * @returns {PartRelais[]}
 */
function repartir(passages) {
  /** @type {Map<string, {nbPassages: number, toucheCentimes: number, bsCentimes: number}>} */
  const parPs = new Map();
  for (const p of passages) {
    const e = parPs.get(p.ps) ?? { nbPassages: 0, toucheCentimes: 0, bsCentimes: 0 };
    e.nbPassages += 1;
    e.toucheCentimes += p.montantCentimes;
    e.bsCentimes += montantBsCentimes(p.cotation);
    parPs.set(p.ps, e);
  }
  const entrees = [...parPs];
  const bsTotal = entrees.reduce((s, [, e]) => s + e.bsCentimes, 0);
  const base = Math.floor(bsTotal / entrees.length);
  let centimesRestants = bsTotal - base * entrees.length;
  // Celles qui ont facturé le BS d'abord, puis l'ordre de première apparition.
  const ordreCentimes = [
    ...entrees.filter(([, e]) => e.bsCentimes > 0),
    ...entrees.filter(([, e]) => e.bsCentimes === 0),
  ].map(([ps]) => ps);
  /** @type {Map<string, number>} */
  const partBs = new Map();
  for (const ps of ordreCentimes) {
    partBs.set(ps, base + (centimesRestants > 0 ? 1 : 0));
    if (centimesRestants > 0) centimesRestants -= 1;
  }
  return entrees.map(([ps, e]) => {
    const partCentimes = e.toucheCentimes - e.bsCentimes + partBs.get(ps);
    return {
      ps,
      nbPassages: e.nbPassages,
      toucheCentimes: e.toucheCentimes,
      partCentimes,
      ecartCentimes: e.toucheCentimes - partCentimes,
    };
  });
}

/**
 * Calcule les reversements (glouton, centimes entiers) : le plus gros débiteur verse au plus
 * gros créancier le minimum des deux montants, jusqu'à épuisement. À montant égal, l'ordre de
 * première apparition dans `parts` départage (résultat déterministe).
 * Utilisé par cas (0034) et pour le bilan de la période (0035) : seuls `ps` et `ecartCentimes`
 * sont lus.
 * @param {Array<{ps: string, ecartCentimes: number}>} parts
 * @returns {Reversement[]}
 */
export function calculerReversements(parts) {
  const debiteurs = parts
    .filter((p) => p.ecartCentimes > 0)
    .map((p) => ({ ps: p.ps, reste: p.ecartCentimes }));
  const creanciers = parts
    .filter((p) => p.ecartCentimes < 0)
    .map((p) => ({ ps: p.ps, reste: -p.ecartCentimes }));
  /** @type {Reversement[]} */
  const reversements = [];

  /** Index du plus gros montant ; le premier l'emporte à égalité. */
  const indexMax = (liste) => liste.reduce((m, e, i) => (e.reste > liste[m].reste ? i : m), 0);

  while (debiteurs.length > 0 && creanciers.length > 0) {
    const d = indexMax(debiteurs);
    const c = indexMax(creanciers);
    const montantCentimes = Math.min(debiteurs[d].reste, creanciers[c].reste);
    reversements.push({ de: debiteurs[d].ps, vers: creanciers[c].ps, montantCentimes });
    debiteurs[d].reste -= montantCentimes;
    creanciers[c].reste -= montantCentimes;
    if (debiteurs[d].reste === 0) debiteurs.splice(d, 1);
    if (creanciers[c].reste === 0) creanciers.splice(c, 1);
  }
  return reversements;
}

/**
 * Détecte les cas : un cas par (date + patient + Fin), si le groupe contient au moins un soin
 * BSA/BSB/BSC et au moins deux codes PS distincts.
 * @param {Seance[]} seances
 * @returns {CasRelais[]}
 */
export function detecterRelais(seances) {
  /** @type {Map<string, Seance[]>} */
  const groupes = new Map();
  for (const s of seances) {
    const patient = s.patient.replace(/\s+/g, ' ').trim().toUpperCase();
    const cle = JSON.stringify([s.date, patient, s.fin]);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(s);
  }

  /** @type {CasRelais[]} */
  const cas = [];
  for (const groupe of groupes.values()) {
    if (!groupe.some((s) => /^BS[ABC]\d/.test(s.cotation))) continue;
    const tries = [...groupe].sort(parHeure);
    if (new Set(tries.map((s) => s.ps)).size < 2) continue;

    const passages = tries.map((s) => ({
      ps: s.ps,
      heure: s.heure,
      cotation: s.cotation,
      montantCentimes: s.montantCentimes ?? null,
    }));
    const n = passages.length;
    // Montant illisible, ou ligne inférieure au tarif de son BS (lecture douteuse) : non calculé.
    const montantIncomplet = passages.some(
      (p) => p.montantCentimes === null || p.montantCentimes < montantBsCentimes(p.cotation),
    );
    const totalCentimes = montantIncomplet
      ? null
      : passages.reduce((somme, p) => somme + p.montantCentimes, 0);

    const parts = totalCentimes === null ? [] : repartir(passages);
    const bsCentimes = montantIncomplet
      ? null
      : passages.reduce((somme, p) => somme + montantBsCentimes(p.cotation), 0);

    cas.push({
      id: genId(),
      date: tries[0].date,
      patient: tries[0].patient,
      fin: tries[0].fin,
      passages,
      nbPassages: n,
      totalCentimes,
      bsCentimes,
      partBsCentimes: bsCentimes === null ? null : Math.round(bsCentimes / parts.length),
      parts,
      reversements: montantIncomplet ? [] : calculerReversements(parts),
      montantIncomplet,
    });
  }

  return cas.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.passages[0].heure.localeCompare(b.passages[0].heure) ||
      a.patient.localeCompare(b.patient, 'fr'),
  );
}

/**
 * Groupe les cas par date, dans l'ordre chronologique.
 * @param {CasRelais[]} cas
 * @returns {Array<{date: string, cas: CasRelais[]}>}
 */
export function grouperCasParDate(cas) {
  /** @type {Array<{date: string, cas: CasRelais[]}>} */
  const groupes = [];
  for (const c of [...cas].sort((a, b) => a.date.localeCompare(b.date))) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.date === c.date) dernier.cas.push(c);
    else groupes.push({ date: c.date, cas: [c] });
  }
  return groupes;
}
