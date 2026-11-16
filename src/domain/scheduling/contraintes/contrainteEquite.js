/**
 * Contrainte souple **globale** « équité » (§7.3 du plan, features 0020/0021/0043).
 *
 * Un seul critère : le **rythme de travail** de chaque personne active (tout le
 * monde en a un). On compare les jours travaillés (dates distinctes) aux jours
 * attendus sur la période (`joursAttendusSurPeriode` : prorata ouverture /
 * présence / absences validées journée entière).
 * - Coût marginal (génération) : `poids × max(0, jours + 1 − attenduArrondi)` pour
 *   un jour nouveau ; 0 si la personne travaille déjà ce jour-là ou reste sous
 *   l'attendu.
 * - Évaluation (validation) : `EQUITE_RYTHME_DEPASSE` dès le moindre dépassement ;
 *   `EQUITE_RYTHME_NON_ATTEINT` à partir de 2 jours sous l'attendu, pour les
 *   **titulaires** seulement (une remplaçante n'a pas à atteindre son rythme, 0021).
 * - Défense : une personne sans entrée dans les jours attendus (inactive, rythme
 *   invalide) coûte 0 et n'est jamais signalée.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { messagePour } from '../modele/messages.js';
import { joursAttendusSurPeriode } from '@/domain/rythmeMensuel.js';
import { estRemplacante } from '@/domain/remplacement.js';

/** Poids souple par défaut (surchargeable via `entree.poids.equite`, `contraintes/index.js`). */
const POIDS_EQUITE_DEFAUT = 4;

/** Nombre de jours sous l'attendu arrondi toléré avant d'alerter « rythme non atteint ». */
const TOLERANCE_SOUS_RYTHME = 1;

/**
 * Construit la contrainte souple globale « équité » par le rythme.
 *
 * @param {number} [poids=POIDS_EQUITE_DEFAUT] - Poids souple, surchargeable
 *   par la fabrique (`contraintes/index.js`, `entree.poids.equite`).
 * @param {import('../modele/types.js').Entree} [entree] - Sert à précalculer
 *   les jours attendus de chaque personne active ; sans elle, la contrainte
 *   est neutre (coût 0, aucune violation).
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteEquite(poids = POIDS_EQUITE_DEFAUT, entree = null) {
  /** @type {Map<string, import('@/domain/rythmeMensuel.js').AttenduRythme>} */
  const attendus = new Map();
  for (const personne of entree?.personnes ?? []) {
    if (personne.actif === false) continue;
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
      const attendu = attendus.get(personneId);
      if (!attendu) return 0;

      const jours = ctx.index.joursTravaillesParPersonne.get(personneId) ?? new Set();
      if (jours.has(demande.date)) return 0;
      return poids * Math.max(0, jours.size + 1 - attendu.attenduArrondi);
    },

    evaluer(ctx) {
      const violations = [];

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
        } else if (!estRemplacante(personne) && jours < cible - TOLERANCE_SOUS_RYTHME) {
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
