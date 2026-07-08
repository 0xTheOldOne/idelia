/**
 * Contraintes liées aux `Absence` : absence `VALIDE` (dure, bloquante) et
 * absence `DEMANDE` (souple, avertissement). Une absence `REFUSE` est
 * **totalement ignorée** dans les deux cas (§7.1/§7.3 du plan).
 *
 * Réutilise les helpers de chevauchement de `src/domain/absences.js`
 * (`periodesSeChevauchent`, `creneauxSeChevauchent`) — seule source de
 * vérité de la règle de chevauchement, jamais réimplémentée ici.
 *
 * `type: 'ABSENCE'` est commun aux deux contraintes de ce fichier (un type
 * par fichier, §5.9 du plan) ; c'est `durete` qui les distingue.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { periodesSeChevauchent, creneauxSeChevauchent } from '@/domain/absences.js';
import { messagePour } from '../modele/messages.js';

/** Poids fixe de l'avertissement « absence demandée » — donnée du domaine, non pondérable par le référent. */
const POIDS_ABSENCE_DEMANDEE = 5;

/**
 * Résout le nom complet d'une personne pour l'affichage, à défaut un
 * libellé neutre (jamais de crash sur une référence orpheline).
 *
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} personneId
 * @returns {string}
 */
function nomPersonneDe(entree, personneId) {
  const personne = entree.personnes.find((p) => p.id === personneId);
  return personne ? `${personne.prenom} ${personne.nom}` : 'Cette personne';
}

/**
 * Indique si une `Absence` chevauche une cellule (date, créneau) donnée —
 * une `Demande` ou une `Affectation`, toutes deux réduites à un seul jour.
 *
 * @param {import('@/domain/absences.js').Absence} absence
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @param {string} creneau
 * @returns {boolean}
 */
function absenceChevaucheCellule(absence, date, creneau) {
  return (
    periodesSeChevauchent(absence.dateDebut, absence.dateFin, date, date) &&
    creneauxSeChevauchent(absence.creneau, creneau)
  );
}

/**
 * Construit la contrainte **dure** « absence validée » : une `Absence` au
 * statut `VALIDE` de la personne, dont la période et le créneau chevauchent
 * la demande, **interdit** l'affectation.
 *
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteAbsenceValidee() {
  return {
    id: 'absence-validee',
    type: 'ABSENCE',
    durete: 'dure',
    granularite: 'cellule',

    autoriseAffectation(personneId, demande, ctx) {
      const absencesValidees = ctx.entree.absences.filter(
        (absence) => absence.personneId === personneId && absence.statut === 'VALIDE'
      );
      return !absencesValidees.some((absence) => absenceChevaucheCellule(absence, demande.date, demande.creneau));
    },

    evaluer(ctx) {
      const violations = [];

      for (const affectation of ctx.index.affectations) {
        const absencesValidees = ctx.entree.absences.filter(
          (absence) => absence.personneId === affectation.personneId && absence.statut === 'VALIDE'
        );

        for (const absence of absencesValidees) {
          if (!absenceChevaucheCellule(absence, affectation.date, affectation.creneau)) continue;

          violations.push({
            contrainteId: 'absence-validee',
            severite: 'erreur',
            cible: {
              personneId: affectation.personneId,
              tourneeId: affectation.tourneeId,
              date: affectation.date,
              creneau: affectation.creneau,
            },
            code: 'ABSENCE_VALIDEE',
            message: messagePour('ABSENCE_VALIDEE', {
              nomPersonne: nomPersonneDe(ctx.entree, affectation.personneId),
              date: affectation.date,
              creneau: affectation.creneau,
              typeAbsence: absence.type,
            }),
            penalite: 0,
            params: {
              personneId: affectation.personneId,
              absenceId: absence.id,
              date: affectation.date,
              creneau: affectation.creneau,
            },
          });
        }
      }

      return violations;
    },
  };
}

/**
 * Construit la contrainte **souple** « absence demandée » : une `Absence`
 * au statut `DEMANDE` chevauchant une affectation produit un
 * avertissement, jamais un blocage (poids fixe, non pondérable par le
 * référent, §7.3 du plan).
 *
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteAbsenceDemandee() {
  return {
    id: 'absence-demandee',
    type: 'ABSENCE',
    durete: 'souple',
    poids: POIDS_ABSENCE_DEMANDEE,
    granularite: 'cellule',

    coutMarginal(personneId, demande, ctx) {
      const absencesDemandees = ctx.entree.absences.filter(
        (absence) => absence.personneId === personneId && absence.statut === 'DEMANDE'
      );
      const chevauche = absencesDemandees.some((absence) =>
        absenceChevaucheCellule(absence, demande.date, demande.creneau)
      );
      return chevauche ? POIDS_ABSENCE_DEMANDEE : 0;
    },

    evaluer(ctx) {
      const violations = [];

      for (const affectation of ctx.index.affectations) {
        const absencesDemandees = ctx.entree.absences.filter(
          (absence) => absence.personneId === affectation.personneId && absence.statut === 'DEMANDE'
        );

        for (const absence of absencesDemandees) {
          if (!absenceChevaucheCellule(absence, affectation.date, affectation.creneau)) continue;

          violations.push({
            contrainteId: 'absence-demandee',
            severite: 'avertissement',
            cible: {
              personneId: affectation.personneId,
              tourneeId: affectation.tourneeId,
              date: affectation.date,
              creneau: affectation.creneau,
            },
            code: 'ABSENCE_DEMANDEE',
            message: messagePour('ABSENCE_DEMANDEE', {
              nomPersonne: nomPersonneDe(ctx.entree, affectation.personneId),
              date: affectation.date,
              creneau: affectation.creneau,
              typeAbsence: absence.type,
            }),
            penalite: POIDS_ABSENCE_DEMANDEE,
            params: {
              personneId: affectation.personneId,
              absenceId: absence.id,
              date: affectation.date,
              creneau: affectation.creneau,
            },
          });
        }
      }

      return violations;
    },
  };
}
