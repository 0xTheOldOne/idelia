/**
 * Fabrique complète du catalogue de contraintes (§5.9 du plan) : **seule**
 * source de vérité des règles métier, partagée par `genererPlanning` et
 * `validerPlanning` (§5.1). `creerContraintes(entree)` instancie, dans cet
 * ordre :
 * 1. les **8 contraintes fixes** du cabinet (une instance chacune) ;
 * 2. **une contrainte par préférence active** (`preference.actif === true`)
 *    de **chaque personne active** de `entree.personnes`.
 *
 * Exporte aussi `TYPES_CONTRAINTE` (valeurs possibles de `Contrainte.type`)
 * et `POIDS_SOUPLES_PAR_DEFAUT` (poids des contraintes souples globales,
 * surchargeable partiellement par `entree.poids`, fusion superficielle).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { creerContrainteAbsenceValidee, creerContrainteAbsenceDemandee } from './contrainteAbsence.js';
import { creerContrainteChevauchement } from './contrainteChevauchement.js';
import { creerContrainteCouverture } from './contrainteCouverture.js';
import { creerContrainteReposLegal } from './contrainteReposLegal.js';
import { creerContrainteJourOuverture } from './contrainteJourOuverture.js';
import { creerContraintePreference } from './contraintePreference.js';
import { creerContrainteEquite } from './contrainteEquite.js';
import { creerContrainteContinuite } from './contrainteContinuite.js';
import { creerContrainteContinuiteSegments } from './contrainteContinuiteSegments.js';

/**
 * Poids par défaut des contraintes souples **globales** (niveau cabinet,
 * §7.3 du plan). `absenceDemandee` documente ici le poids déjà fixé en dur
 * dans `contrainteAbsence.js` (non pondérable par le référent, donnée du
 * domaine) ; `equite`/`continuite`/`continuiteSegments` sont réellement
 * surchargeables via `entree.poids`.
 *
 * @type {Readonly<{absenceDemandee: number, equite: number, continuite: number, continuiteSegments: number}>}
 */
export const POIDS_SOUPLES_PAR_DEFAUT = Object.freeze({
  absenceDemandee: 5,
  equite: 4,
  continuite: 2,
  continuiteSegments: 3,
});

/**
 * Valeurs possibles de `Contrainte.type` : une par fichier de contrainte
 * fixe, plus une par `TYPES_PREFERENCE` (`schema.js`).
 *
 * @type {ReadonlyArray<string>}
 */
export const TYPES_CONTRAINTE = Object.freeze([
  'ABSENCE',
  'CHEVAUCHEMENT',
  'COUVERTURE',
  'REPOS_LEGAL',
  'JOUR_OUVERTURE',
  'EQUITE',
  'CONTINUITE',
  'CONTINUITE_SEGMENTS',
  'PREFERENCE_JOUR_OFF_RECURRENT',
  'PREFERENCE_CRENEAU_OFF',
  'PREFERENCE_INDISPO_HEBDO',
  'PREFERENCE_MAX_JOURS_CONSECUTIFS',
  'PREFERENCE_MIN_JOURS_CONSECUTIFS',
  'PREFERENCE_JOURS_REPOS_SOUHAITES',
  'PREFERENCE_NB_JOURS_SEMAINE',
  'PREFERENCE_TOURNEE',
]);

/**
 * Construit le catalogue complet des contraintes pour une `Entree` donnée.
 * **Identique** que l'appelant soit `genererPlanning` ou `validerPlanning`
 * (§5.1 du plan) : jamais deux listes distinctes pour une même règle.
 *
 * @param {import('../modele/types.js').Entree} entree
 * @returns {import('../modele/types.js').Contrainte[]}
 */
export function creerContraintes(entree) {
  const poids = { ...POIDS_SOUPLES_PAR_DEFAUT, ...(entree.poids ?? {}) };

  const contraintes = [
    creerContrainteAbsenceValidee(),
    creerContrainteAbsenceDemandee(),
    creerContrainteChevauchement(),
    creerContrainteCouverture(),
    creerContrainteReposLegal(),
    creerContrainteJourOuverture(),
    creerContrainteEquite(poids.equite),
    creerContrainteContinuite(poids.continuite),
    creerContrainteContinuiteSegments(poids.continuiteSegments),
  ];

  const personnesActives = (entree.personnes ?? []).filter((personne) => personne.actif !== false);
  for (const personne of personnesActives) {
    const preferencesActives = (personne.preferences ?? []).filter((preference) => preference.actif === true);
    for (const preference of preferencesActives) {
      contraintes.push(creerContraintePreference(preference, personne));
    }
  }

  return contraintes;
}
