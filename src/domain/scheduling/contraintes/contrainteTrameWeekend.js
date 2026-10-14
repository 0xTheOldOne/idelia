/**
 * Contrainte **souple silencieuse** « trame des weekends » (feature 0022) :
 * sur un weekend de sa trame « un weekend sur X », une personne passe avant les
 * autres, sans jamais y être obligée ni signalée (le moteur sait interdire,
 * pas obliger ; le repos des weekends hors trame est porté par
 * `contraintePreference.js`).
 *
 * Même patron que `contrainteRemplacement.js` : `evaluer` renvoie toujours
 * `[]` ; la règle agit via `coutMarginal` (glouton) et `coutGlobal`
 * (recherche locale), deux lectures de la même règle à garder cohérentes.
 * Deux termes, chacun de `poids` (3 par défaut, voir `POIDS_TRAME_WEEKEND_DEFAUT`;
 * « titulaires d'abord » reste prioritaire sur une personne sans trame) :
 *
 * 1. **Bonus** : chaque jour ouvert d'un weekend de trame où la personne ne
 *    travaille pas encore coûte `poids` (l'affecter le fait disparaître).
 * 2. **Réservation** : dans une semaine qui contient des jours de trame non
 *    encore travaillés, chaque jour de semaine travaillé au-delà de ce que le
 *    repos hebdomadaire autorise (`7 - reposHebdoMin` jours, moins les jours de
 *    trame restant à tenir) coûte `poids`. Sans cela, le glouton remplit la
 *    semaine avant le weekend et le repos légal interdit ensuite le weekend.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { periodesSeChevauchent } from '@/domain/absences.js';
import { estTrameValide, estWeekendTravaille } from '@/domain/trameWeekend.js';
import { dateUtil } from '@/domain/utils/dates.js';
import { semaineIsoDe } from '../utils/dates.js';

/**
 * Poids par défaut (par jour de trame non travaillé / par excédent de réservation).
 * Volontairement **au-dessus** du coût d'une remplaçante (2) : la génération traite
 * les weekends en premier (MRV), moment où l'équité voit la titulaire seule
 * « chargée » (surcharge marginale jusqu'à 4) ; un bonus de 1 ne suffisait pas à
 * lui faire tenir son propre weekend face à une remplaçante.
 */
const POIDS_TRAME_WEEKEND_DEFAUT = 3;

/**
 * @param {number} [poids=POIDS_TRAME_WEEKEND_DEFAUT]
 * @param {import('../modele/types.js').Entree} entree
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteTrameWeekend(poids = POIDS_TRAME_WEEKEND_DEFAUT, entree) {
  /** @type {Map<string, import('@/domain/trameWeekend.js').TrameWeekend[]>} */
  const tramesParPersonne = new Map();
  for (const personne of entree?.personnes ?? []) {
    if (personne.actif === false) continue;
    const trames = (personne.preferences ?? [])
      .filter((p) => p.actif === true && p.type === 'UN_WEEKEND_SUR_X' && estTrameValide(p.params))
      .map((p) => p.params);
    if (trames.length > 0) tramesParPersonne.set(personne.id, trames);
  }

  const absences = (entree?.absences ?? []).filter((a) => a.statut === 'VALIDE');
  const reposHebdoMin = entree?.reglesCabinet?.reposHebdoMin;
  const periode = entree?.periode;

  /** `true` si au moins une trame de la personne fait travailler ce jour-là. */
  const estJourDeTrame = (personneId, date) =>
    (tramesParPersonne.get(personneId) ?? []).some((trame) => estWeekendTravaille(date, trame) === true);

  const estAbsente = (personneId, date) =>
    absences.some((a) => a.personneId === personneId && periodesSeChevauchent(a.dateDebut, a.dateFin, date, date));

  const jourTravaille = (personneId, date, ctx) =>
    ctx.index.joursTravaillesParPersonne.get(personneId)?.has(date) ?? false;

  /** Nombre de jours de travail qu'une semaine complète autorise (`Infinity` si non borné). */
  const maxJoursSemaine = (semaineDebut) => {
    if (!Number.isFinite(reposHebdoMin) || !periode) return Infinity;
    const complete = semaineDebut >= periode.debut && dateUtil.addDays(semaineDebut, 6) <= periode.fin;
    return complete ? 7 - reposHebdoMin : Infinity;
  };

  /**
   * Excédent de réservation d'une personne sur une semaine : jours hors trame
   * travaillés + jours de trame restant à tenir, au-delà du maximum autorisé.
   *
   * @param {Set<string>} joursTravailles - Jours travaillés de la personne (avec l'hypothèse éventuelle).
   * @param {string[]} joursSemaine - Jours ouverts de la semaine dans la période.
   */
  const excedent = (personneId, semaineDebut, joursSemaine, joursTravailles) => {
    const max = maxJoursSemaine(semaineDebut);
    if (max === Infinity) return 0;
    let horsTrame = 0;
    let reste = 0;
    for (const date of joursSemaine) {
      const trame = estJourDeTrame(personneId, date);
      if (joursTravailles.has(date)) {
        if (!trame) horsTrame += 1;
      } else if (trame && !estAbsente(personneId, date)) {
        reste += 1;
      }
    }
    return Math.max(0, horsTrame + reste - max);
  };

  const joursDeLaSemaine = (ctx, semaineDebut) => {
    const fin = dateUtil.addDays(semaineDebut, 6);
    return (ctx.joursPeriode ?? []).filter((d) => d >= semaineDebut && d <= fin);
  };

  return {
    id: 'trame-weekend',
    type: 'TRAME_WEEKEND',
    durete: 'souple',
    poids,
    granularite: 'global',

    coutMarginal(personneId, demande, ctx) {
      if (!tramesParPersonne.has(personneId)) return 0;
      const date = demande.date;
      if (jourTravaille(personneId, date, ctx)) return 0; // déjà présente ce jour-là : rien ne change
      const semaineDebut = semaineIsoDe(date);
      const jours = joursDeLaSemaine(ctx, semaineDebut);
      const avant = ctx.index.joursTravaillesParPersonne.get(personneId) ?? new Set();
      const apres = new Set(avant).add(date);
      const bonus = estJourDeTrame(personneId, date) ? -1 : 0;
      const delta = excedent(personneId, semaineDebut, jours, apres) - excedent(personneId, semaineDebut, jours, avant);
      return poids * (bonus + delta);
    },

    /** `poids ×` (jours de trame non travaillés + excédents de réservation), pour toutes les personnes à trame. */
    coutGlobal(ctx) {
      if (tramesParPersonne.size === 0) return 0;
      const dates = [...(ctx.joursPeriode ?? [])].sort();
      const semaines = [...new Set(dates.map(semaineIsoDe))];
      let total = 0;
      for (const personneId of tramesParPersonne.keys()) {
        const travailles = ctx.index.joursTravaillesParPersonne.get(personneId) ?? new Set();
        for (const date of dates) {
          if (estJourDeTrame(personneId, date) && !travailles.has(date)) total += 1;
        }
        for (const semaineDebut of semaines) {
          total += excedent(personneId, semaineDebut, joursDeLaSemaine(ctx, semaineDebut), travailles);
        }
      }
      return poids * total;
    },

    evaluer() {
      return [];
    },
  };
}
