/**
 * Contraintes de **remplacement** (feature 0021) : une remplaçante
 * (`statut === 'REMPLACANT'`) ne travaille que pour couvrir l'absence d'une
 * titulaire. `type: 'REMPLACEMENT'` est commun aux fabriques de ce fichier.
 *
 * - `creerContrainteRemplacementSurAbsence` (dure) : une remplaçante n'est
 *   candidate que si une titulaire est absente sur les horaires du segment, et
 *   jamais plus de remplaçantes distinctes un jour que de titulaires absentes.
 *   Un placement **manuel** qui viole la règle est signalé en `avertissement`
 *   (jamais bloqué) ; un placement automatique devenu illégitime reste une
 *   `erreur`.
 * - `creerContrainteRemplacementPrioritaire` (souple) : la remplaçante rattachée
 *   à une titulaire absente passe avant les autres remplaçantes ; avertissement
 *   si elle est disponible mais non planifiée alors qu'une autre l'est.
 *
 * Source de vérité des absences qui ouvrent un remplacement :
 * `src/domain/remplacement.js`. Le même comptage (`remplacantesSurAbsenceLe`)
 * sert `autoriseAffectation` et `evaluer` (cohérence génération / validation).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { periodesSeChevauchent } from '@/domain/absences.js';
import {
  estRemplacante,
  absencesARemplacerLe,
  absencesSurHoraires,
  titulairesAbsentes,
} from '@/domain/remplacement.js';
import { messagePour } from '../modele/messages.js';
import { horairesDeAffectation } from './contrainteAbsence.js';

/**
 * Précalcul commun aux fabriques : remplaçantes actives (ordre de l'entrée),
 * absences ouvrant un remplacement par date (mémo) et comptage des
 * remplaçantes qui travaillent « sur absence ».
 *
 * @param {import('../modele/types.js').Entree} entree
 */
function preparerRemplacement(entree) {
  const personnes = entree.personnes ?? [];
  const absences = entree.absences ?? [];
  const remplacantes = personnes.filter((p) => p.actif !== false && estRemplacante(p));
  const remplacantesParId = new Map(remplacantes.map((p) => [p.id, p]));
  const memo = new Map();

  /** Absences de titulaires qui libèrent une place le jour `date` (mémo). */
  function absencesDuJour(date) {
    if (!memo.has(date)) memo.set(date, absencesARemplacerLe(date, { personnes, absences }));
    return memo.get(date);
  }

  /** Titulaires distinctes absentes le jour `date` (ordre de l'entrée). */
  function titulairesAbsentesLe(date) {
    return titulairesAbsentes(absencesDuJour(date), personnes);
  }

  /** `true` si l'affectation d'une remplaçante recouvre une absence de titulaire. */
  function surAbsence(affectation, ctx) {
    const horaires = horairesDeAffectation(affectation, ctx.entree ?? entree);
    if (!horaires) return false; // référence introuvable : jamais de crash
    return absencesSurHoraires(absencesDuJour(affectation.date), horaires.heureDebut, horaires.heureFin).length > 0;
  }

  /**
   * Remplaçantes (ordre de `remplacantes`) ayant au moins une affectation le
   * jour `date` qui recouvre une absence, avec ces affectations.
   *
   * @returns {{personne: Object, affectations: Object[]}[]}
   */
  function remplacantesSurAbsenceLe(date, ctx) {
    const resultat = [];
    for (const personne of remplacantes) {
      const affectations = (ctx.index.parPersonne.get(personne.id) ?? []).filter(
        (a) => a.date === date && surAbsence(a, ctx)
      );
      if (affectations.length > 0) resultat.push({ personne, affectations });
    }
    return resultat;
  }

  return { absences, remplacantes, remplacantesParId, absencesDuJour, titulairesAbsentesLe, surAbsence, remplacantesSurAbsenceLe };
}

/**
 * Nom complet d'une personne, libellé neutre si introuvable.
 *
 * @param {Object} [personne]
 * @returns {string}
 */
function nomComplet(personne) {
  return personne ? `${personne.prenom} ${personne.nom}` : 'Cette personne';
}

/**
 * Construit la contrainte **dure** « une remplaçante ne vient que pour une
 * absence » (R2 : candidate seulement si une titulaire est absente sur les
 * horaires ; R3 : pas plus de remplaçantes distinctes que de titulaires
 * absentes le même jour).
 *
 * @param {import('../modele/types.js').Entree} entree
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteRemplacementSurAbsence(entree) {
  const { remplacantesParId, absencesDuJour, titulairesAbsentesLe, surAbsence, remplacantesSurAbsenceLe } =
    preparerRemplacement(entree);

  return {
    id: 'remplacement-sur-absence',
    type: 'REMPLACEMENT',
    durete: 'dure',
    granularite: 'global',

    autoriseAffectation(personneId, demande, ctx) {
      if (!remplacantesParId.has(personneId)) return true; // titulaire : jamais concernée

      const absencesSurHorairesDemande = absencesSurHoraires(
        absencesDuJour(demande.date),
        demande.heureDebut,
        demande.heureFin
      );
      if (absencesSurHorairesDemande.length === 0) return false; // R2

      const deja = remplacantesSurAbsenceLe(demande.date, ctx);
      if (deja.some((entreeDeja) => entreeDeja.personne.id === personneId)) return true;
      return deja.length < titulairesAbsentesLe(demande.date).length; // R3
    },

    evaluer(ctx) {
      const violations = [];
      const dates = new Set();

      // R2 : remplaçante planifiée sans absence à couvrir sur ses horaires.
      for (const personne of remplacantesParId.values()) {
        for (const affectation of ctx.index.parPersonne.get(personne.id) ?? []) {
          dates.add(affectation.date);
        }
      }
      const datesTriees = [...dates].sort();

      for (const date of datesTriees) {
        for (const personne of remplacantesParId.values()) {
          for (const affectation of ctx.index.parPersonne.get(personne.id) ?? []) {
            if (affectation.date !== date || surAbsence(affectation, ctx)) continue;
            const horaires = horairesDeAffectation(affectation, ctx.entree ?? entree);
            if (!horaires) continue;
            violations.push({
              contrainteId: 'remplacement-sur-absence',
              severite: affectation.origine === 'MANUEL' ? 'avertissement' : 'erreur',
              cible: {
                personneId: personne.id,
                tourneeId: affectation.tourneeId,
                date: affectation.date,
                segmentIndex: affectation.segmentIndex,
              },
              code: 'REMPLACANTE_SANS_ABSENCE',
              message: messagePour('REMPLACANTE_SANS_ABSENCE', {
                nomPersonne: nomComplet(personne),
                date: affectation.date,
                heureDebut: horaires.heureDebut,
                heureFin: horaires.heureFin,
                origine: affectation.origine,
              }),
              penalite: 0,
              params: {
                personneId: personne.id,
                date: affectation.date,
                segmentIndex: affectation.segmentIndex,
                origine: affectation.origine,
              },
            });
          }
        }
      }

      // R3 : plus de remplaçantes « sur absence » que de titulaires absentes.
      for (const date of datesTriees) {
        const surAbsenceLe = remplacantesSurAbsenceLe(date, ctx);
        const titulaires = titulairesAbsentesLe(date);
        if (surAbsenceLe.length <= titulaires.length) continue;

        const manuel = surAbsenceLe.some(({ affectations }) => affectations.some((a) => a.origine === 'MANUEL'));
        violations.push({
          contrainteId: 'remplacement-sur-absence',
          severite: manuel ? 'avertissement' : 'erreur',
          cible: { date },
          code: 'REMPLACANTES_EN_SURNOMBRE',
          message: messagePour('REMPLACANTES_EN_SURNOMBRE', {
            date,
            nomsRemplacantes: surAbsenceLe.map(({ personne }) => nomComplet(personne)),
            nomsTitulaires: titulaires.map(nomComplet),
          }),
          penalite: 0,
          params: {
            date,
            remplacanteIds: surAbsenceLe.map(({ personne }) => personne.id),
            titulaireIds: titulaires.map((t) => t.id),
          },
        });
      }

      return violations;
    },
  };
}

/** Poids souple par défaut de la priorité à la remplaçante rattachée. */
const POIDS_PRIORITAIRE_DEFAUT = 3;

/**
 * Construit la contrainte **souple** « la remplaçante rattachée à une titulaire
 * absente passe en premier » (R4). `evaluer` signale (avertissement) le cas où
 * la remplaçante attitrée est disponible mais non planifiée alors qu'une autre
 * remplaçante l'est ; `coutMarginal` est son reflet pour le glouton.
 *
 * @param {number} [poids=POIDS_PRIORITAIRE_DEFAUT] - Poids souple.
 * @param {import('../modele/types.js').Entree} entree
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteRemplacementPrioritaire(poids = POIDS_PRIORITAIRE_DEFAUT, entree) {
  const { absences, remplacantes, remplacantesParId, titulairesAbsentesLe } = preparerRemplacement(entree);

  /** Remplaçantes actives rattachées à la titulaire `titulaireId` (ordre de l'entrée). */
  const habituellesDe = (titulaireId) => remplacantes.filter((r) => r.titulaireId === titulaireId);

  /** Disponible = aucune absence validée qui touche ce jour-là. */
  const estDisponible = (personne, date) =>
    !absences.some(
      (a) =>
        a.statut === 'VALIDE' &&
        a.personneId === personne.id &&
        periodesSeChevauchent(a.dateDebut, a.dateFin, date, date)
    );

  const travaille = (personneId, date, ctx) =>
    ctx.index.joursTravaillesParPersonne.get(personneId)?.has(date) ?? false;

  return {
    id: 'remplacement-prioritaire',
    type: 'REMPLACEMENT',
    durete: 'souple',
    poids,
    granularite: 'global',

    coutMarginal(personneId, demande, ctx) {
      const personne = remplacantesParId.get(personneId);
      if (!personne) return 0;
      const absentes = titulairesAbsentesLe(demande.date);
      if (absentes.length === 0) return 0;
      if (absentes.some((t) => t.id === personne.titulaireId)) return 0;
      if (travaille(personneId, demande.date, ctx)) return 0;

      const priorite = absentes.some((t) => {
        const habituelles = habituellesDe(t.id);
        return (
          habituelles.some((h) => estDisponible(h, demande.date)) &&
          !habituelles.some((h) => travaille(h.id, demande.date, ctx))
        );
      });
      return priorite ? poids : 0;
    },

    evaluer(ctx) {
      const violations = [];
      if (remplacantes.length === 0) return violations;

      const dates = new Set();
      for (const r of remplacantes) {
        for (const jour of ctx.index.joursTravaillesParPersonne.get(r.id) ?? []) dates.add(jour);
      }

      for (const date of [...dates].sort()) {
        const absentes = titulairesAbsentesLe(date);
        for (const titulaire of absentes) {
          const habituelles = habituellesDe(titulaire.id);
          const dispos = habituelles.filter((h) => estDisponible(h, date));
          if (dispos.length === 0 || habituelles.some((h) => travaille(h.id, date, ctx))) continue;

          const autres = remplacantes.filter(
            (r) =>
              travaille(r.id, date, ctx) &&
              r.titulaireId !== titulaire.id &&
              !absentes.some((t) => t.id === r.titulaireId)
          );
          if (autres.length === 0) continue;

          violations.push({
            contrainteId: 'remplacement-prioritaire',
            severite: 'avertissement',
            cible: { personneId: dispos[0].id, date },
            code: 'REMPLACANTE_HABITUELLE_NON_PLANIFIEE',
            message: messagePour('REMPLACANTE_HABITUELLE_NON_PLANIFIEE', {
              date,
              nomTitulaire: nomComplet(titulaire),
              nomsHabituelles: dispos.map(nomComplet),
              nomsAutres: autres.map(nomComplet),
            }),
            penalite: poids,
            params: {
              titulaireId: titulaire.id,
              date,
              habituelleIds: dispos.map((h) => h.id),
              autreIds: autres.map((r) => r.id),
            },
          });
        }
      }
      return violations;
    },
  };
}
