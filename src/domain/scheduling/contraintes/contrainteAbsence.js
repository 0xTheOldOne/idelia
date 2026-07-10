/**
 * Contraintes liées aux `Absence` : absence `VALIDE` (dure, bloquante) et
 * absence `DEMANDE` (souple, avertissement). Une absence `REFUSE` est
 * **totalement ignorée** dans les deux cas (§7.1/§7.3 du plan).
 *
 * Réutilise les helpers de `src/domain/absences.js` :
 * `periodesSeChevauchent` (recouvrement de dates) et `creneauChevaucheHoraires`
 * (feature 0016, ADR 0017 — réconciliation créneau symbolique de l'absence ↔
 * horaires réels du segment) — seules sources de vérité, jamais
 * réimplémentées ici.
 *
 * `type: 'ABSENCE'` est commun aux deux contraintes de ce fichier (un type
 * par fichier, §5.9 du plan) ; c'est `durete` qui les distingue.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { periodesSeChevauchent, creneauChevaucheHoraires } from '@/domain/absences.js';
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
 * Résout les horaires réels `"HH:mm"` d'une `Affectation`, par lookup de
 * `tournee.segments[affectation.segmentIndex]` (feature 0016, ADR 0017) —
 * jamais dénormalisés sur l'affectation. `null` si la tournée ou le segment
 * référencé est introuvable : jamais de crash, l'affectation est alors
 * simplement ignorée par l'appelant.
 *
 * @param {import('../modele/affectation.js').Affectation} affectation
 * @param {import('../modele/types.js').Entree} entree
 * @returns {({heureDebut: string, heureFin: string}|null)}
 */
function horairesDeAffectation(affectation, entree) {
  const tournee = entree.tournees.find((t) => t.id === affectation.tourneeId);
  const segment = tournee ? tournee.segments[affectation.segmentIndex] : undefined;
  return segment ? { heureDebut: segment.heureDebut, heureFin: segment.heureFin } : null;
}

/**
 * Indique si une `Absence` chevauche un segment horaire réel donné — une
 * `Demande` (via `heureDebut`/`heureFin` dénormalisés) ou une `Affectation`
 * (via {@link horairesDeAffectation}), toutes deux réduites à un seul jour.
 * L'absence reste à la granularité demi-journée (bucket `MATIN`/
 * `APRES_MIDI`/`JOURNEE`, hors périmètre 0016) ; le segment est réel
 * (feature 0016, ADR 0017).
 *
 * @param {import('@/domain/absences.js').Absence} absence
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @param {string} heureDebut - Heure de début `"HH:mm"` du segment.
 * @param {string} heureFin - Heure de fin `"HH:mm"` du segment.
 * @returns {boolean}
 */
function absenceChevaucheSegment(absence, date, heureDebut, heureFin) {
  return (
    periodesSeChevauchent(absence.dateDebut, absence.dateFin, date, date) &&
    creneauChevaucheHoraires(absence.creneau, heureDebut, heureFin)
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
      return !absencesValidees.some((absence) =>
        absenceChevaucheSegment(absence, demande.date, demande.heureDebut, demande.heureFin)
      );
    },

    evaluer(ctx) {
      const violations = [];

      for (const affectation of ctx.index.affectations) {
        const horaires = horairesDeAffectation(affectation, ctx.entree);
        if (!horaires) continue; // référence tournée/segment introuvable : jamais de crash

        const absencesValidees = ctx.entree.absences.filter(
          (absence) => absence.personneId === affectation.personneId && absence.statut === 'VALIDE'
        );

        for (const absence of absencesValidees) {
          if (!absenceChevaucheSegment(absence, affectation.date, horaires.heureDebut, horaires.heureFin)) continue;

          violations.push({
            contrainteId: 'absence-validee',
            severite: 'erreur',
            cible: {
              personneId: affectation.personneId,
              tourneeId: affectation.tourneeId,
              date: affectation.date,
              segmentIndex: affectation.segmentIndex,
            },
            code: 'ABSENCE_VALIDEE',
            message: messagePour('ABSENCE_VALIDEE', {
              nomPersonne: nomPersonneDe(ctx.entree, affectation.personneId),
              date: affectation.date,
              heureDebut: horaires.heureDebut,
              heureFin: horaires.heureFin,
              typeAbsence: absence.type,
            }),
            penalite: 0,
            params: {
              personneId: affectation.personneId,
              absenceId: absence.id,
              date: affectation.date,
              segmentIndex: affectation.segmentIndex,
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
        absenceChevaucheSegment(absence, demande.date, demande.heureDebut, demande.heureFin)
      );
      return chevauche ? POIDS_ABSENCE_DEMANDEE : 0;
    },

    evaluer(ctx) {
      const violations = [];

      for (const affectation of ctx.index.affectations) {
        const horaires = horairesDeAffectation(affectation, ctx.entree);
        if (!horaires) continue; // référence tournée/segment introuvable : jamais de crash

        const absencesDemandees = ctx.entree.absences.filter(
          (absence) => absence.personneId === affectation.personneId && absence.statut === 'DEMANDE'
        );

        for (const absence of absencesDemandees) {
          if (!absenceChevaucheSegment(absence, affectation.date, horaires.heureDebut, horaires.heureFin)) continue;

          violations.push({
            contrainteId: 'absence-demandee',
            severite: 'avertissement',
            cible: {
              personneId: affectation.personneId,
              tourneeId: affectation.tourneeId,
              date: affectation.date,
              segmentIndex: affectation.segmentIndex,
            },
            code: 'ABSENCE_DEMANDEE',
            message: messagePour('ABSENCE_DEMANDEE', {
              nomPersonne: nomPersonneDe(ctx.entree, affectation.personneId),
              date: affectation.date,
              heureDebut: horaires.heureDebut,
              heureFin: horaires.heureFin,
              typeAbsence: absence.type,
            }),
            penalite: POIDS_ABSENCE_DEMANDEE,
            params: {
              personneId: affectation.personneId,
              absenceId: absence.id,
              date: affectation.date,
              segmentIndex: affectation.segmentIndex,
            },
          });
        }
      }

      return violations;
    },
  };
}
