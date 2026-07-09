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
