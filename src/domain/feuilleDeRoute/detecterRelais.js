/**
 * Détection des patients vus par plusieurs infirmières (feature 0033) : un même patient,
 * soigné plusieurs fois le même jour (soins BSA/BSB/BSC) par au moins deux codes PS différents.
 * Le montant total est réparti entre les infirmières au prorata de leurs passages, puis on
 * calcule qui doit reverser combien à qui (feature 0034).
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
 * @property {number} partCentimes             // part équitable (dernière infirmière = reste)
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
 * @property {(number|null)} partParPassageCentimes
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
 * Répartit un total (centimes) entre les infirmières au prorata de leurs passages.
 * La dernière infirmière (ordre de première apparition) reçoit le reste : somme = total.
 * @param {PassageRelais[]} passages
 * @param {number} total
 * @returns {PartRelais[]}
 */
function repartir(passages, total) {
  /** @type {Map<string, number>} */
  const nb = new Map();
  for (const p of passages) nb.set(p.ps, (nb.get(p.ps) ?? 0) + 1);
  const entrees = [...nb];
  let reste = total;
  return entrees.map(([ps, n], i) => {
    const partCentimes =
      i === entrees.length - 1 ? reste : Math.round((total * n) / passages.length);
    reste -= partCentimes;
    const toucheCentimes = passages
      .filter((p) => p.ps === ps)
      .reduce((somme, p) => somme + p.montantCentimes, 0);
    return {
      ps,
      nbPassages: n,
      toucheCentimes,
      partCentimes,
      ecartCentimes: toucheCentimes - partCentimes,
    };
  });
}

/**
 * Calcule les reversements (glouton, centimes entiers) : le plus gros débiteur verse au plus
 * gros créancier le minimum des deux montants, jusqu'à épuisement. À montant égal, l'ordre de
 * première apparition dans `parts` départage (résultat déterministe).
 * @param {PartRelais[]} parts
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
    const montantIncomplet = passages.some((p) => p.montantCentimes === null);
    const totalCentimes = montantIncomplet
      ? null
      : passages.reduce((somme, p) => somme + p.montantCentimes, 0);

    const parts = totalCentimes === null ? [] : repartir(passages, totalCentimes);

    cas.push({
      id: genId(),
      date: tries[0].date,
      patient: tries[0].patient,
      fin: tries[0].fin,
      passages,
      nbPassages: n,
      totalCentimes,
      partParPassageCentimes: totalCentimes === null ? null : Math.round(totalCentimes / n),
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
