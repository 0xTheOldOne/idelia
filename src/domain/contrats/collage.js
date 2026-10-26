/**
 * Conversion des marqueurs écrits `{{cle}}` d'un texte collé en embeds (0041).
 * Module pur : aucun import Vue/Vuex/Quill, aucun accès au DOM.
 */

/**
 * Syntaxe affichée à l'utilisatrice pour un marqueur du catalogue : `{{personne.nom}}`.
 * @param {string} cle
 * @returns {string}
 */
export function syntaxeMarqueur(cle) {
  return `{{${cle}}}`;
}

/** Motif d'un marqueur écrit : `{{`, espaces facultatifs, 2 à 3 segments alphabétiques séparés par des points. */
export const RE_MARQUEUR_TEXTE = /\{\{\s*([A-Za-z]+(?:\.[A-Za-z]+){1,2})\s*\}\}/g;

const LONGUEUR_MAX_CLE = 60;

/**
 * Convertit les marqueurs écrits d'un Delta (ops `insert` texte uniquement) en embeds `marqueur`.
 * Clé du catalogue (casse ignorée → clé canonique) : embed avec les attributs du texte d'origine ;
 * clé inconnue ou `saisie.*` : reste du texte, forme d'origine ajoutée à `inconnus` (unique, dans l'ordre).
 * Delta d'entrée non modifié ; ne lève jamais.
 *
 * @param {{ ops: object[] }} delta
 * @param {ReadonlyArray<string>} clesCatalogue
 * @returns {{ delta: { ops: object[] }, inconnus: string[] }}
 */
export function convertirMarqueursTexte(delta, clesCatalogue) {
  const inconnus = [];
  try {
    const canoniques = new Map(clesCatalogue.map((c) => [c.toLowerCase(), c]));
    const ops = [];
    for (const op of delta.ops) {
      if (typeof op?.insert !== 'string' || !op.insert.includes('{{')) {
        ops.push(op);
        continue;
      }
      const texte = op.insert;
      const avecAttributs = (insert) => (op.attributes ? { insert, attributes: { ...op.attributes } } : { insert });
      let dernier = 0;
      const regex = new RegExp(RE_MARQUEUR_TEXTE.source, 'g');
      let trouve;
      while ((trouve = regex.exec(texte)) !== null) {
        const cle = trouve[1].length <= LONGUEUR_MAX_CLE ? canoniques.get(trouve[1].toLowerCase()) : undefined;
        if (!cle) {
          if (!inconnus.includes(trouve[0])) inconnus.push(trouve[0]);
          continue;
        }
        if (trouve.index > dernier) ops.push(avecAttributs(texte.slice(dernier, trouve.index)));
        ops.push(avecAttributs({ marqueur: { cle } }));
        dernier = trouve.index + trouve[0].length;
      }
      if (dernier < texte.length) ops.push(avecAttributs(texte.slice(dernier)));
    }
    return { delta: { ops }, inconnus };
  } catch {
    return { delta, inconnus };
  }
}

/**
 * Message FR de l'avertissement ; '' si `inconnus` est vide. 5 codes au plus, puis « … ».
 * @param {string[]} inconnus
 * @returns {string}
 */
export function messageMarqueursInconnus(inconnus) {
  if (!inconnus?.length) return '';
  const n = inconnus.length;
  const liste = inconnus.slice(0, 5).join(', ') + (n > 5 ? ', …' : '');
  const intro = n === 1 ? '1 champ non reconnu' : `${n} champs non reconnus`;
  return `${intro} : ${liste} — insérez-les avec « Insérer un champ ».`;
}
