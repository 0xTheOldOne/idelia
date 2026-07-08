/**
 * Contrainte dure « repos légal » : `reglesCabinet.reposHebdoMin` (jours de
 * repos par semaine ISO, sur l'intersection avec la période) et
 * `reglesCabinet.maxJoursConsecutifs` (jours de travail d'affilée, toutes
 * tournées confondues) — vérifiés **dynamiquement** pendant la génération
 * (`autoriseAffectation`), et intégralement en validation (`evaluer`).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { semaineIsoDe } from '../utils/dates.js';
import { messagePour } from '../modele/messages.js';

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} personneId
 * @returns {string}
 */
function nomPersonneDe(entree, personneId) {
  const personne = entree.personnes.find((p) => p.id === personneId);
  return personne ? `${personne.prenom} ${personne.nom}` : 'Cette personne';
}

/**
 * Longueur de la plus longue séquence de jours calendaires consécutifs
 * d'une liste de dates triées et dédupliquées.
 *
 * @param {string[]} joursTries - Dates `"YYYY-MM-DD"`, triées, dédupliquées.
 * @returns {number} Longueur de la plus longue séquence consécutive (0 si vide).
 */
function calculerRunMaxConsecutif(joursTries) {
  let max = 0;
  let courant = 0;
  let precedent = null;

  for (const jour of joursTries) {
    courant = precedent !== null && dateUtil.diffDays(precedent, jour) === 1 ? courant + 1 : 1;
    max = Math.max(max, courant);
    precedent = jour;
  }

  return max;
}

/**
 * Liste les semaines calendaires ISO (lundi → dimanche) **entièrement
 * incluses** dans la période — les semaines coupées en bord de période ne
 * sont pas évaluées, faute de visibilité au-delà (limite documentée §12 du
 * plan).
 *
 * @param {{debut: string, fin: string}} periode
 * @returns {{debut: string, fin: string}[]} Semaines complètes, triées.
 */
function listerSemainesCompletes(periode) {
  const debutsSemaines = new Set(dateUtil.rangeInclusive(periode.debut, periode.fin).map(semaineIsoDe));

  return [...debutsSemaines]
    .sort()
    .map((debut) => ({ debut, fin: dateUtil.addDays(debut, 6) }))
    .filter((semaine) => semaine.debut >= periode.debut && semaine.fin <= periode.fin);
}

/**
 * Compte les jours travaillés (déjà triés) compris dans `[debut, fin]`
 * inclusifs.
 *
 * @param {string[]} joursTries
 * @param {string} debut
 * @param {string} fin
 * @returns {number}
 */
function compterJoursDansPlage(joursTries, debut, fin) {
  return joursTries.filter((jour) => jour >= debut && jour <= fin).length;
}

/**
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteReposLegal() {
  return {
    id: 'repos-legal',
    type: 'REPOS_LEGAL',
    durete: 'dure',
    granularite: 'personne-periode',

    autoriseAffectation(personneId, demande, ctx) {
      const { reglesCabinet, periode } = ctx.entree;
      const maxConsecutifs = reglesCabinet.maxJoursConsecutifs;
      const reposHebdoMin = reglesCabinet.reposHebdoMin;
      const joursExistants = ctx.index.joursTravaillesParPersonne.get(personneId) ?? new Set();
      const joursTries = [...new Set([...joursExistants, demande.date])].sort();

      if (Number.isFinite(maxConsecutifs) && calculerRunMaxConsecutif(joursTries) > maxConsecutifs) {
        return false;
      }

      const semaineDebut = semaineIsoDe(demande.date);
      const semaineFin = dateUtil.addDays(semaineDebut, 6);
      const semaineEntierementIncluse = semaineDebut >= periode.debut && semaineFin <= periode.fin;

      if (semaineEntierementIncluse && Number.isFinite(reposHebdoMin)) {
        const joursTravaillesSemaine = compterJoursDansPlage(joursTries, semaineDebut, semaineFin);
        if (7 - joursTravaillesSemaine < reposHebdoMin) return false;
      }

      return true;
    },

    evaluer(ctx) {
      const { reglesCabinet, periode } = ctx.entree;
      const maxConsecutifs = reglesCabinet.maxJoursConsecutifs;
      const reposHebdoMin = reglesCabinet.reposHebdoMin;
      const semainesCompletes = listerSemainesCompletes(periode);
      const violations = [];

      for (const [personneId, joursSet] of ctx.index.joursTravaillesParPersonne) {
        const joursTries = [...joursSet].sort();

        if (Number.isFinite(maxConsecutifs)) {
          const runMax = calculerRunMaxConsecutif(joursTries);
          if (runMax > maxConsecutifs) {
            violations.push({
              contrainteId: 'repos-legal',
              severite: 'erreur',
              cible: { personneId },
              code: 'TROP_JOURS_CONSECUTIFS',
              message: messagePour('TROP_JOURS_CONSECUTIFS', {
                nomPersonne: nomPersonneDe(ctx.entree, personneId),
                jours: runMax,
                maxAutorise: maxConsecutifs,
              }),
              penalite: 0,
              params: { personneId, joursConsecutifs: runMax, maxAutorise: maxConsecutifs },
            });
          }
        }

        if (Number.isFinite(reposHebdoMin)) {
          for (const semaine of semainesCompletes) {
            const joursTravaillesSemaine = compterJoursDansPlage(joursTries, semaine.debut, semaine.fin);
            const joursRepos = 7 - joursTravaillesSemaine;

            if (joursRepos < reposHebdoMin) {
              violations.push({
                contrainteId: 'repos-legal',
                severite: 'erreur',
                cible: { personneId },
                code: 'REPOS_HEBDO_INSUFFISANT',
                message: messagePour('REPOS_HEBDO_INSUFFISANT', {
                  nomPersonne: nomPersonneDe(ctx.entree, personneId),
                  joursRepos,
                  minRequis: reposHebdoMin,
                  semaineDebut: semaine.debut,
                }),
                penalite: 0,
                params: { personneId, semaineDebut: semaine.debut, joursRepos, minRequis: reposHebdoMin },
              });
            }
          }
        }
      }

      return violations;
    },
  };
}
