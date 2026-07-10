/**
 * Fabrique & normalisation d'un Planning.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Seules concessions techniques tolérées (comme dans `schema.js`/`tournees.js`/
 * `absences.js`) : `genId()` pour l'identifiant et `new Date().toISOString()`
 * pour les horodatages.
 */

import { STATUTS_PLANNING } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';

/**
 * @typedef {Object} Planning
 * @property {string} id - Identifiant unique, immuable.
 * @property {string} nom - Libellé lisible (ex. « Planning du 13/07/2026 au 19/07/2026 »).
 * @property {string} dateDebut - Date de début `"YYYY-MM-DD"`.
 * @property {string} dateFin - Date de fin `"YYYY-MM-DD"`, >= `dateDebut`.
 * @property {string} statut - `'BROUILLON'`, `'VALIDE'` ou `'PUBLIE'` (voir {@link STATUTS_PLANNING}).
 * @property {import('./scheduling/modele/affectation.js').Affectation[]} affectations - Affectations imbriquées, produites par le moteur.
 * @property {(Object|null)} parametresGeneration - Snapshot des réglages moteur (`Resultat.meta`), pour la reproductibilité.
 * @property {(string|null)} referentId - Référence à une Personne, `null` tant qu'aucun référent n'est choisi.
 * @property {(string|null)} publieLe - Horodatage ISO UTC de publication, `null` tant que non publié.
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * Construit un `Planning` complet et normalisé à partir d'un objet partiel
 * (typiquement le résultat d'une génération moteur), en appliquant les
 * valeurs par défaut et en générant les champs techniques.
 *
 * `creerPlanning` ne recalcule ni ne valide les affectations : elles
 * arrivent déjà conformes du moteur (`resultat.affectations`) et sont
 * déposées telles quelles. Elle ne garantit que la forme structurelle ; la
 * cohérence `dateFin >= dateDebut` est portée par le formulaire (Vuelidate).
 *
 * @param {Object} [champs] - Champs partiels d'un Planning.
 * @returns {Planning} Planning complet, prêt à être stocké.
 */
export function creerPlanning(champs = {}) {
  const maintenant = new Date().toISOString();

  return {
    id: champs.id ?? genId(),
    nom: String(champs.nom ?? '').trim(),
    dateDebut: champs.dateDebut ?? '',
    dateFin: champs.dateFin ?? '',
    statut: champs.statut ?? STATUTS_PLANNING[0], // 'BROUILLON'
    affectations: Array.isArray(champs.affectations) ? champs.affectations : [],
    parametresGeneration: champs.parametresGeneration ?? null,
    referentId: champs.referentId ?? null,
    publieLe: champs.publieLe ?? null,
    createdAt: champs.createdAt ?? maintenant,
    updatedAt: maintenant,
  };
}

/**
 * Construit une `Affectation` posée manuellement par un référent
 * (`origine: 'MANUEL'`, `verrouillee: false`, `commentaire: ''`), en dehors
 * du moteur pur (ADR 0008 — le moteur ne pose que de l'`AUTO`, via
 * `creerAffectationAuto`). Modèle exact de `creerAffectationAuto`
 * (`src/domain/scheduling/modele/affectation.js`), à l'exception de
 * `origine`. Mêmes concessions techniques tolérées : `genId()` +
 * `new Date().toISOString()`.
 *
 * `segmentIndex` (feature 0016, ADR 0017) remplace l'ancien `creneau` : il
 * référence l'indice du segment couvert dans `tournee.segments` (0-based),
 * les horaires réels se résolvant par lookup, jamais dénormalisés sur
 * l'affectation.
 *
 * @param {string} personneId - Identifiant de la Personne affectée.
 * @param {string} tourneeId - Identifiant de la Tournee.
 * @param {string} date - Date `"YYYY-MM-DD"`.
 * @param {number} segmentIndex - Indice (0-based) du segment couvert dans `tournee.segments`.
 * @returns {import('./scheduling/modele/affectation.js').Affectation} Affectation complète, prête à être stockée.
 */
export function creerAffectationManuelle(personneId, tourneeId, date, segmentIndex) {
  const maintenant = new Date().toISOString();

  return {
    id: genId(),
    personneId,
    tourneeId,
    date,
    segmentIndex,
    origine: 'MANUEL',
    verrouillee: false,
    commentaire: '',
    createdAt: maintenant,
    updatedAt: maintenant,
  };
}

/**
 * Sélectionne le planning « pertinent maintenant » : parmi ceux **non
 * terminés** (`dateFin >= dateReference`), celui de plus petite `dateDebut`
 * (le planning en cours ou, à défaut, le prochain à démarrer). Comparaisons
 * de chaînes uniquement (ADR 0010) ; `dateReference` fournie par l'appelant.
 * Alimente l'indicateur « Prochain planning », la carte « À traiter » et la
 * tuile « Ouvrir le planning en cours » (feature 0013).
 *
 * @param {Planning[]} plannings
 * @param {string} dateReference - Date du jour `"YYYY-MM-DD"`, injectée par l'appelant.
 * @returns {(Planning|null)} Le planning pertinent, ou `null` si aucun n'est en cours/à venir.
 */
export function prochainPlanning(plannings, dateReference) {
  const enCoursOuAVenir = plannings.filter((pl) => pl.dateFin >= dateReference);
  if (enCoursOuAVenir.length === 0) return null;

  return enCoursOuAVenir.reduce((plusProche, pl) => (pl.dateDebut < plusProche.dateDebut ? pl : plusProche));
}

/**
 * Résume un diagnostic moteur (`{ violations, tourneesNonCouvertes }`, forme
 * renvoyée par `diagnostiquer`/`evaluerCourant`) en comptes simples, prêts à
 * afficher (feature 0013). Pure synthèse : aucune règle métier nouvelle,
 * aucune reformulation des messages du moteur.
 *
 * @param {{ violations: import('./scheduling/modele/types.js').Violation[], tourneesNonCouvertes: import('./scheduling/modele/types.js').NonCouverture[] }} diagnostic
 * @returns {{ nbErreurs: number, nbAvertissements: number, nbNonCouvertes: number, aResoudre: number }} Résumé chiffré.
 */
export function resumerDiagnostic(diagnostic) {
  const { violations, tourneesNonCouvertes } = diagnostic;
  const nbErreurs = violations.filter((v) => v.severite === 'erreur').length;
  const nbAvertissements = violations.filter((v) => v.severite === 'avertissement').length;
  const nbNonCouvertes = tourneesNonCouvertes.length;
  return { nbErreurs, nbAvertissements, nbNonCouvertes, aResoudre: nbErreurs + nbNonCouvertes };
}
