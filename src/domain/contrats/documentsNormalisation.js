/**
 * Normalisation d'un document contractuel (0042) : en-tête figé et relecture tolérante.
 * Module pur et léger, séparé de `documents.js` : `schema.js` l'importe, et `documents.js`
 * tire `marqueurs.js` → `libelles.js` → `schema.js` (cycle d'imports sinon).
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { normaliserAdresse } from '@/domain/adresse.js';

/**
 * Copie de l'en-tête à figer à la signature (nom + adresse ; le logo n'est PAS copié).
 * @param {(object|null|undefined)} parametres
 * @returns {import('@/domain/contrats/documents.js').EnteteCabinet}
 */
export function figerEnteteCabinet(parametres) {
  const nom = parametres?.nomCabinet;
  return {
    nomCabinet: typeof nom === 'string' ? nom.trim() : '',
    adresseCabinet: normaliserAdresse(parametres?.adresseCabinet),
  };
}

/**
 * Normalisation tolérante à la relecture. Jamais bloquante.
 * @param {object} doc
 * @returns {import('@/domain/contrats/documents.js').DocumentContrat}
 */
export function normaliserDocument(doc) {
  const { enteteCabinet, ...reste } = doc ?? {};
  const aEntete =
    doc?.statut === 'SIGNE' && enteteCabinet && typeof enteteCabinet === 'object' && !Array.isArray(enteteCabinet);
  return {
    ...reste,
    valeursSaisies: Array.isArray(doc?.valeursSaisies) ? doc.valeursSaisies : [],
    archive: doc?.archive === true,
    signeLe: typeof doc?.signeLe === 'string' && dateUtil.estDateValide(doc.signeLe) ? doc.signeLe : null,
    enteteCabinet: aEntete ? figerEnteteCabinet(enteteCabinet) : null,
  };
}
