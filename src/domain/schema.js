/**
 * Schéma du document persisté (SaveDocument).
 *
 * Placeholder de la feature 001 : matérialise l'emplacement du futur
 * schéma de données. Aucune logique de (dé)sérialisation ni de vérification
 * d'intégrité n'est implémentée ici — ce sera fait en feature 002
 * (voir ADR 0005 — persistance derrière un repository).
 *
 * À terme, ce module exposera notamment :
 * - des enums et valeurs par défaut du domaine ;
 * - `toSaveDocument(state)` : sérialise l'état Vuex vers le document persisté ;
 * - `fromSaveDocument(doc)` : reconstruit l'état Vuex depuis le document persisté ;
 * - `verifierIntegrite(doc)` : contrôle la cohérence du document chargé.
 */

/** Version courante du schéma de données (incrémentée à chaque migration). */
export const CURRENT_SCHEMA_VERSION = 1;

// export function toSaveDocument(state) { /* feature 002 */ }
// export function fromSaveDocument(doc) { /* feature 002 */ }
// export function verifierIntegrite(doc) { /* feature 002 */ }
