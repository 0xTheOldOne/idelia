/**
 * Contenu d'un modèle de contrat : Delta Quill manipulé comme un simple objet JSON
 * (0041, ADR 0023). Module pur : aucun import Vue/Vuex/Quill, aucun accès au DOM.
 *
 * Un contenu stocké est toujours un document complet (aucune op `retain` ni `delete`),
 * jamais du HTML.
 */

import { estCleMarqueurValide } from '@/domain/contrats/catalogueMarqueurs.js';

/** Attributs de texte autorisés et leurs valeurs admises. */
export const ATTRIBUTS_AUTORISES = Object.freeze({
  bold: [true],
  italic: [true],
  underline: [true],
  header: [1, 2],
  list: ['ordered', 'bullet'],
  align: ['center', 'right', 'justify'],
});

/** Plafonds d'un contenu de modèle. */
export const MAX_OPS = 20000;
export const MAX_CARACTERES = 200000;

/**
 * @returns {{ ops: object[] }} Document vide valide : `{ ops: [{ insert: '\n' }] }`.
 */
export function deltaVide() {
  return { ops: [{ insert: '\n' }] };
}

const aPropre = (objet, cle) => Object.prototype.hasOwnProperty.call(objet, cle);
const estObjetSimple = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Attributs : objet simple, clés autorisées, valeurs admises. */
function attributsValides(attributs) {
  if (!estObjetSimple(attributs)) return false;
  return Object.keys(attributs).every(
    (nom) => aPropre(ATTRIBUTS_AUTORISES, nom) && ATTRIBUTS_AUTORISES[nom].includes(attributs[nom])
  );
}

/**
 * Contrôle strict : objet `{ ops: [] }`, chaque op n'a QUE `insert` (+ `attributes` facultatif) ;
 * `insert` = chaîne, ou `{ marqueur: { cle } }` avec une clé de forme valide ;
 * attributs ∈ ATTRIBUTS_AUTORISES (rejet de link, image, color, script…) ;
 * plafonds MAX_OPS / MAX_CARACTERES. Ne lève jamais.
 *
 * @param {*} delta
 * @returns {boolean}
 */
export function estDeltaModeleValide(delta) {
  try {
    if (!estObjetSimple(delta) || !Array.isArray(delta.ops)) return false;
    if (Object.keys(delta).some((k) => k !== 'ops')) return false;
    if (delta.ops.length > MAX_OPS) return false;
    let caracteres = 0;
    for (const op of delta.ops) {
      if (!estObjetSimple(op) || !aPropre(op, 'insert')) return false;
      if (Object.keys(op).some((k) => k !== 'insert' && k !== 'attributes')) return false;
      if (aPropre(op, 'attributes') && !attributsValides(op.attributes)) return false;
      const { insert } = op;
      if (typeof insert === 'string') {
        caracteres += insert.length;
        if (caracteres > MAX_CARACTERES) return false;
      } else {
        if (!estObjetSimple(insert)) return false;
        const cles = Object.keys(insert);
        if (cles.length !== 1 || cles[0] !== 'marqueur') return false;
        const marqueur = insert.marqueur;
        if (!estObjetSimple(marqueur)) return false;
        const clesMarqueur = Object.keys(marqueur);
        if (clesMarqueur.length !== 1 || clesMarqueur[0] !== 'cle') return false;
        if (typeof marqueur.cle !== 'string' || !estCleMarqueurValide(marqueur.cle)) return false;
        caracteres += 1;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Clés des marqueurs présents, dans l'ordre d'apparition, sans doublon.
 *
 * @param {{ ops?: object[] }} delta
 * @returns {string[]}
 */
export function clesMarqueursUtilisees(delta) {
  const cles = [];
  for (const op of delta?.ops ?? []) {
    const cle = op?.insert?.marqueur?.cle;
    if (typeof cle === 'string' && !cles.includes(cle)) cles.push(cle);
  }
  return cles;
}
