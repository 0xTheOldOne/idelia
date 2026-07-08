/**
 * Contrainte souple **globale** « équité » : écart de charge (nombre de
 * créneaux affectés, pondéré par `personne.quotite / 100`) entre personnes
 * actives comparables (§7.3 du plan). Impacte le choix pendant la génération
 * (`coutMarginal`) et signale les déséquilibres résiduels en validation
 * (`evaluer`).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { messagePour } from '../modele/messages.js';

/** Poids souple par défaut (surchargeable via `entree.poids.equite`, `contraintes/index.js`). */
const POIDS_EQUITE_DEFAUT = 4;

/** Écart minimal (en créneaux) en-dessous duquel un déséquilibre n'est pas signalé. */
const SEUIL_ECART_MIN = 2;

/** Écart minimal, en proportion de la moyenne d'équipe, en-dessous duquel un déséquilibre n'est pas signalé. */
const SEUIL_ECART_RATIO = 0.25;

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
 * Charge normalisée courante de chaque personne active de l'entrée, à partir
 * du `PlanningIndexe`.
 *
 * @param {import('../modele/types.js').Entree} entree
 * @param {import('../modele/types.js').PlanningIndexe} index
 * @returns {{personne: import('@/domain/personnes.js').Personne, nbAffectations: number, charge: number}[]}
 */
function chargesDeLequipe(entree, index) {
  return entree.personnes
    .filter((personne) => personne.actif !== false)
    .map((personne) => {
      const nbAffectations = (index.parPersonne.get(personne.id) ?? []).length;
      return { personne, nbAffectations, charge: chargeNormalisee(personne, nbAffectations) };
    });
}

/**
 * Moyenne des charges normalisées de l'équipe (`0` si équipe vide).
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
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteEquite(poids = POIDS_EQUITE_DEFAUT) {
  return {
    id: 'equite',
    type: 'EQUITE',
    durete: 'souple',
    poids,
    granularite: 'global',

    coutMarginal(personneId, demande, ctx) {
      const personne = ctx.entree.personnes.find((p) => p.id === personneId);
      if (!personne) return 0;

      const charges = chargesDeLequipe(ctx.entree, ctx.index);
      const moy = moyenne(charges);
      const nbActuel = (ctx.index.parPersonne.get(personneId) ?? []).length;
      const chargeApres = chargeNormalisee(personne, nbActuel + 1);
      const depassement = Math.max(0, chargeApres - moy);

      return poids * depassement;
    },

    evaluer(ctx) {
      const charges = chargesDeLequipe(ctx.entree, ctx.index);
      if (charges.length === 0) return [];

      const moy = moyenne(charges);
      const seuil = Math.max(SEUIL_ECART_MIN, moy * SEUIL_ECART_RATIO);
      const violations = [];

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

      return violations;
    },
  };
}
