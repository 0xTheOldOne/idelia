/**
 * Contrainte souple **globale** « équité » (§7.3 du plan). Deux groupes de
 * personnes actives, équilibrés séparément (feature 0020) :
 * - **sans rythme** (`joursTravaillesParMois` vide) : écart de charge (nombre
 *   de créneaux affectés, pondéré par `personne.quotite / 100`) à la moyenne
 *   du groupe ;
 * - **avec rythme** : écart entre les jours travaillés (dates distinctes) et
 *   les jours attendus sur la période (`joursAttendusSurPeriode` : prorata
 *   ouverture / présence / absences validées journée entière). Le rythme prime
 *   sur la quotité.
 * Impacte le choix pendant la génération (`coutMarginal`) et signale les
 * déséquilibres résiduels en validation (`evaluer`).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { messagePour } from '../modele/messages.js';
import { joursAttendusSurPeriode } from '@/domain/rythmeMensuel.js';

/** Poids souple par défaut (surchargeable via `entree.poids.equite`, `contraintes/index.js`). */
const POIDS_EQUITE_DEFAUT = 4;

/** Écart minimal (en créneaux) en-dessous duquel un déséquilibre n'est pas signalé. */
const SEUIL_ECART_MIN = 2;

/** Écart minimal, en proportion de la moyenne d'équipe, en-dessous duquel un déséquilibre n'est pas signalé. */
const SEUIL_ECART_RATIO = 0.25;

/** Nombre de jours sous l'attendu arrondi toléré avant d'alerter « rythme non atteint ». */
const TOLERANCE_SOUS_RYTHME = 1;

/**
 * Indique si une personne a un rythme mensuel saisi.
 *
 * @param {import('@/domain/personnes.js').Personne} personne
 * @returns {boolean}
 */
function aUnRythme(personne) {
  return personne.joursTravaillesParMois != null;
}

/**
 * Charge « normalisée » d'une personne : nombre de créneaux affectés ramené
 * à un temps plein (division par `quotite / 100`), pour comparer
 * équitablement des quotités différentes.
 *
 * @param {import('@/domain/personnes.js').Personne} personne
 * @param {number} nbAffectations
 * @returns {number}
 */
function chargeNormalisee(personne, nbAffectations) {
  const quotite = Number.isFinite(personne.quotite) && personne.quotite > 0 ? personne.quotite : 100;
  return nbAffectations / (quotite / 100);
}

/**
 * Charge normalisée courante de chaque personne active **sans rythme** de
 * l'entrée, à partir du `PlanningIndexe`.
 *
 * @param {import('../modele/types.js').Entree} entree
 * @param {import('../modele/types.js').PlanningIndexe} index
 * @returns {{personne: import('@/domain/personnes.js').Personne, nbAffectations: number, charge: number}[]}
 */
function chargesDeLequipe(entree, index) {
  return entree.personnes
    .filter((personne) => personne.actif !== false && !aUnRythme(personne))
    .map((personne) => {
      const nbAffectations = (index.parPersonne.get(personne.id) ?? []).length;
      return { personne, nbAffectations, charge: chargeNormalisee(personne, nbAffectations) };
    });
}

/**
 * Moyenne des charges normalisées du groupe (`0` si groupe vide).
 *
 * @param {{charge: number}[]} charges
 * @returns {number}
 */
function moyenne(charges) {
  if (charges.length === 0) return 0;
  return charges.reduce((somme, c) => somme + c.charge, 0) / charges.length;
}

/**
 * Construit la contrainte souple globale « équité ».
 *
 * @param {number} [poids=POIDS_EQUITE_DEFAUT] - Poids souple, surchargeable
 *   par la fabrique (`contraintes/index.js`, `entree.poids.equite`).
 * @param {import('../modele/types.js').Entree} [entree] - Sert à précalculer
 *   les jours attendus des personnes avec rythme ; sans elle, tout le monde
 *   est traité sur la règle « sans rythme » de charge pondérée.
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteEquite(poids = POIDS_EQUITE_DEFAUT, entree = null) {
  /** @type {Map<string, import('@/domain/rythmeMensuel.js').AttenduRythme>} */
  const attendus = new Map();
  for (const personne of entree?.personnes ?? []) {
    if (personne.actif === false || !aUnRythme(personne)) continue;
    const attendu = joursAttendusSurPeriode(personne, entree.periode, {
      joursOuverture: entree.reglesCabinet?.joursOuverture ?? [],
      absences: entree.absences ?? [],
    });
    if (attendu) attendus.set(personne.id, attendu);
  }

  return {
    id: 'equite',
    type: 'EQUITE',
    durete: 'souple',
    poids,
    granularite: 'global',

    coutMarginal(personneId, demande, ctx) {
      const personne = ctx.entree.personnes.find((p) => p.id === personneId);
      if (!personne) return 0;

      // Groupe « avec rythme » : on vise les jours attendus (jours distincts).
      const attendu = attendus.get(personneId);
      if (attendu) {
        const jours = ctx.index.joursTravaillesParPersonne.get(personneId) ?? new Set();
        if (jours.has(demande.date)) return 0;
        return poids * Math.max(0, jours.size + 1 - attendu.attenduArrondi);
      }
      // Rythme saisi mais invalide : exclue de l'équité (hors des deux groupes).
      if (aUnRythme(personne)) return 0;

      // Groupe « sans rythme » : règle historique.
      const charges = chargesDeLequipe(ctx.entree, ctx.index);
      const moy = moyenne(charges);
      const nbActuel = (ctx.index.parPersonne.get(personneId) ?? []).length;
      const chargeApres = chargeNormalisee(personne, nbActuel + 1);
      const depassement = Math.max(0, chargeApres - moy);

      return poids * depassement;
    },

    evaluer(ctx) {
      const violations = [];

      // Groupe « sans rythme » : règle historique.
      const charges = chargesDeLequipe(ctx.entree, ctx.index);
      if (charges.length > 0) {
        const moy = moyenne(charges);
        const seuil = Math.max(SEUIL_ECART_MIN, moy * SEUIL_ECART_RATIO);

        for (const { personne, charge } of charges) {
          const ecart = Math.abs(charge - moy);
          if (ecart <= seuil) continue;

          violations.push({
            contrainteId: 'equite',
            severite: 'avertissement',
            cible: { personneId: personne.id },
            code: 'EQUITE_DESEQUILIBREE',
            message: messagePour('EQUITE_DESEQUILIBREE', {
              nomPersonne: `${personne.prenom} ${personne.nom}`,
              charge,
              moyenne: moy,
            }),
            penalite: poids * ecart,
            params: { personneId: personne.id, charge, moyenne: moy, ecart },
          });
        }
      }

      // Groupe « avec rythme » : écart aux jours attendus.
      for (const personne of ctx.entree.personnes) {
        const attendu = attendus.get(personne.id);
        if (!attendu || personne.actif === false) continue;

        const jours = (ctx.index.joursTravaillesParPersonne.get(personne.id) ?? new Set()).size;
        const cible = attendu.attenduArrondi;
        let code = null;
        let ecart = 0;
        if (jours > cible) {
          code = 'EQUITE_RYTHME_DEPASSE';
          ecart = jours - cible;
        } else if (jours < cible - TOLERANCE_SOUS_RYTHME) {
          code = 'EQUITE_RYTHME_NON_ATTEINT';
          ecart = cible - jours;
        }
        if (!code) continue;

        violations.push({
          contrainteId: 'equite',
          severite: 'avertissement',
          cible: { personneId: personne.id },
          code,
          message: messagePour(code, {
            nomPersonne: `${personne.prenom} ${personne.nom}`,
            jours,
            rythme: attendu.rythme,
            attendu: cible,
          }),
          penalite: poids * ecart,
          params: { personneId: personne.id, jours, attendu: cible, rythme: attendu.rythme },
        });
      }

      return violations;
    },
  };
}
