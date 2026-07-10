/**
 * Contrainte souple **globale** « continuité intra-journée » (feature 0016,
 * ADR 0017) : sur une tournée **coupée** (2 segments), privilégie la **même
 * personne** matin+soir le même jour, sans jamais l'imposer. Distincte de
 * `contrainteContinuite.js` (continuité jour-à-jour, tous segments
 * confondus) : celle-ci compare les **segments d'un même jour** entre eux.
 *
 * `coutMarginal` : si un **autre** segment de la même tournée/date est déjà
 * couvert par une personne `P`, le candidat `= P` ne coûte rien, un candidat
 * `≠ P` coûte `poids` ; neutre (coût `0`) si aucun autre segment n'est
 * encore posé, ou si la tournée n'est pas coupée. `evaluer` signale, pour
 * chaque tournée coupée/date dont les deux segments sont couverts par des
 * personnes disjointes, un **avertissement** de faible pénalité
 * (`CONTINUITE_SEGMENTS_ROMPUE`) — **jamais** de contrainte dure de
 * couplage (ADR 0017).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { messagePour } from '../modele/messages.js';

/** Poids souple par défaut (surchargeable via `entree.poids.continuiteSegments`, `contraintes/index.js`). */
const POIDS_CONTINUITE_SEGMENTS_DEFAUT = 3;

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} personneId
 * @returns {string}
 */
function nomPersonneDe(entree, personneId) {
  const personne = entree.personnes.find((p) => p.id === personneId);
  return personne ? `${personne.prenom} ${personne.nom}` : 'une personne';
}

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} tourneeId
 * @returns {string}
 */
function nomTourneeDe(entree, tourneeId) {
  const tournee = entree.tournees.find((t) => t.id === tourneeId);
  return tournee ? tournee.libelle : 'Cette tournée';
}

/**
 * Construit la contrainte souple globale « continuité intra-journée ».
 *
 * @param {number} [poids=POIDS_CONTINUITE_SEGMENTS_DEFAUT] - Poids souple,
 *   surchargeable par la fabrique (`contraintes/index.js`,
 *   `entree.poids.continuiteSegments`).
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteContinuiteSegments(poids = POIDS_CONTINUITE_SEGMENTS_DEFAUT) {
  return {
    id: 'continuite-segments',
    type: 'CONTINUITE_SEGMENTS',
    durete: 'souple',
    poids,
    granularite: 'global',

    coutMarginal(personneId, demande, ctx) {
      const tournee = ctx.entree.tournees.find((t) => t.id === demande.tourneeId);
      if (!tournee || tournee.segments.length < 2) return 0; // tournée complète : rien à coupler

      const affectationsTournee = ctx.index.parTournee.get(demande.tourneeId) ?? [];
      const autresSegments = affectationsTournee.filter(
        (a) => a.date === demande.date && a.segmentIndex !== demande.segmentIndex
      );

      if (autresSegments.length === 0) return 0; // aucun autre segment encore posé ce jour-là : neutre

      const dejaAffecteeSurLAutreSegment = autresSegments.some((a) => a.personneId === personneId);
      return dejaAffecteeSurLAutreSegment ? 0 : poids;
    },

    evaluer(ctx) {
      const violations = [];
      const tourneesCoupees = ctx.entree.tournees.filter((tournee) => tournee.segments.length === 2);

      for (const tournee of tourneesCoupees) {
        const affectationsTournee = ctx.index.parTournee.get(tournee.id) ?? [];
        const dates = [...new Set(affectationsTournee.map((a) => a.date))].sort();

        for (const date of dates) {
          const affectationsJour = affectationsTournee.filter((a) => a.date === date);
          const personnesMatin = new Set(
            affectationsJour.filter((a) => a.segmentIndex === 0).map((a) => a.personneId)
          );
          const personnesSoir = new Set(affectationsJour.filter((a) => a.segmentIndex === 1).map((a) => a.personneId));

          // Un segment non couvert relève de la contrainte de couverture, pas de celle-ci.
          if (personnesMatin.size === 0 || personnesSoir.size === 0) continue;

          const continuiteMaintenue = [...personnesMatin].some((id) => personnesSoir.has(id));
          if (continuiteMaintenue) continue;

          const personneIdMatin = [...personnesMatin].sort()[0];
          const personneIdSoir = [...personnesSoir].sort()[0];

          violations.push({
            contrainteId: 'continuite-segments',
            severite: 'avertissement',
            cible: { tourneeId: tournee.id, date },
            code: 'CONTINUITE_SEGMENTS_ROMPUE',
            message: messagePour('CONTINUITE_SEGMENTS_ROMPUE', {
              nomTournee: nomTourneeDe(ctx.entree, tournee.id),
              date,
              nomPersonneMatin: nomPersonneDe(ctx.entree, personneIdMatin),
              nomPersonneSoir: nomPersonneDe(ctx.entree, personneIdSoir),
            }),
            penalite: poids,
            params: { tourneeId: tournee.id, date, personneIdMatin, personneIdSoir },
          });
        }
      }

      return violations;
    },
  };
}
