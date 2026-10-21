/**
 * Insertion d'un SVG généré (mermaid) compatible avec la CSP `style-src 'self'` (ADR 0022).
 *
 * La CSP interdit les `<style>` et les attributs `style="…"` venus d'un texte HTML/SVG, mais
 * autorise le CSSOM. On analyse donc le SVG dans un document inerte, on en extrait les styles,
 * puis on les réapplique par CSSOM (feuille constructible + `style.setProperty`).
 * Aucun `innerHTML`. Rejet défensif de tout contenu exécutable.
 *
 * Hors domaine (ADR 0008) : DOM.
 */

/** Éléments refusés (le SVG de mermaid en mode strict n'en contient pas). */
const ELEMENTS_INTERDITS = ['script', 'foreignObject', 'iframe', 'object', 'embed'];

/** Attribut de transit : porte la valeur de l'attribut `style` retiré avant analyse. */
const ATTRIBUT_TRANSIT = 'data-style-retire';

/**
 * Retire du texte SVG les `<style>` et renomme les attributs `style` AVANT toute analyse :
 * le navigateur signale une violation de CSP dès qu'il analyse un style, même dans un
 * document inerte. Seules les balises sont parcourues (le texte d'un libellé est échappé).
 * @param {string} svg
 * @returns {{texte: string, feuilles: string[]}}
 */
function retirerStylesDuTexte(svg) {
  const feuilles = [];
  const sansStyle = svg.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_, css) => {
    feuilles.push(
      css
        .replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&'),
    );
    return '';
  });
  const texte = sansStyle.replace(/<[a-zA-Z][^>]*>/g, (balise) =>
    balise.replace(
      /(\s)([^\s=/>]+)(\s*=\s*)("[^"]*"|'[^']*')/g,
      (m, esp, nom, egal, valeur) => (nom.toLowerCase() === 'style' ? `${esp}${ATTRIBUT_TRANSIT}${egal}${valeur}` : m),
    ),
  );
  return { texte, feuilles };
}

/**
 * Analyse un SVG, en retire les styles et renvoie de quoi les réappliquer.
 * @param {string} svg
 * @returns {{noeud: SVGElement, feuilles: string[], styles: Array<{element: Element, declarations: Array<[string, string, string]>}>}}
 * @throws {Error} SVG invalide ou contenu exécutable
 */
export function preparerSvg(svg) {
  const { texte, feuilles } = retirerStylesDuTexte(svg);
  const doc = new DOMParser().parseFromString(texte, 'image/svg+xml');
  const racine = doc.documentElement;
  if (!racine || racine.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('SVG invalide');
  }

  // Sécurité défensive : rien d'exécutable.
  for (const nom of ELEMENTS_INTERDITS) {
    if (doc.getElementsByTagNameNS('*', nom).length > 0) throw new Error(`SVG refusé : <${nom}>`);
  }
  for (const el of doc.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      const nom = attr.name.toLowerCase();
      const valeur = attr.value.trim().toLowerCase().replace(/[\u0000-\u0020]/g, '');
      if (nom.startsWith('on')) throw new Error('SVG refusé : attribut on*');
      if ((nom === 'href' || nom.endsWith(':href')) && valeur.startsWith('javascript:')) {
        throw new Error('SVG refusé : lien javascript:');
      }
    }
  }

  // Filet de sécurité : tout `<style>` resté malgré le pré-traitement.
  for (const style of Array.from(doc.getElementsByTagNameNS('*', 'style'))) {
    feuilles.push(style.textContent ?? '');
    style.remove();
  }

  // Déclarations relevées puis attribut retiré.
  // Le découpage passe par le CSSOM (élément jetable hors document), pas par une regex.
  const analyseur = document.createElement('div');
  const styles = [];
  for (const el of Array.from(doc.querySelectorAll(`[${ATTRIBUT_TRANSIT}], [style]`))) {
    analyseur.style.cssText = `${el.getAttribute(ATTRIBUT_TRANSIT) ?? ''};${el.getAttribute('style') ?? ''}`;
    const declarations = [];
    for (const prop of Array.from(analyseur.style)) {
      declarations.push([
        prop,
        analyseur.style.getPropertyValue(prop),
        analyseur.style.getPropertyPriority(prop),
      ]);
    }
    el.removeAttribute(ATTRIBUT_TRANSIT);
    el.removeAttribute('style');
    styles.push({ element: el, declarations });
  }

  return { noeud: racine, feuilles, styles };
}

/**
 * Insère le SVG préparé dans le conteneur (en remplaçant son contenu) et réapplique les styles.
 * @param {HTMLElement} conteneur
 * @param {ReturnType<typeof preparerSvg>} prepare
 * @returns {CSSStyleSheet[]} feuilles ajoutées au document, à retirer par `retirerFeuilles`
 */
export function insererSvg(conteneur, prepare) {
  const noeud = document.importNode(prepare.noeud, true);
  // Les éléments importés sont des copies : on retrouve les cibles par leur position.
  const sources = Array.from(prepare.noeud.querySelectorAll('*'));
  const copies = Array.from(noeud.querySelectorAll('*'));
  const correspondance = new Map(sources.map((s, i) => [s, copies[i]]));
  correspondance.set(prepare.noeud, noeud);

  conteneur.replaceChildren(noeud);

  for (const { element, declarations } of prepare.styles) {
    const cible = correspondance.get(element);
    if (!cible) continue;
    for (const [prop, valeur, priorite] of declarations) {
      if (/url\s*\(/i.test(valeur)) continue; // pas de ressource externe
      cible.style.setProperty(prop, valeur, priorite);
    }
  }

  const ajoutees = [];
  for (const texte of prepare.feuilles) {
    const feuille = new CSSStyleSheet();
    // @import interdit : charger une ressource externe contournerait la CSP voulue.
    feuille.replaceSync(texte.replace(/@import[^;]*;?/gi, ''));
    ajoutees.push(feuille);
  }
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, ...ajoutees];
  return ajoutees;
}

/**
 * Retire du document les feuilles précédemment ajoutées par `insererSvg`.
 * @param {CSSStyleSheet[]} feuilles
 */
export function retirerFeuilles(feuilles) {
  if (!feuilles || feuilles.length === 0) return;
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((f) => !feuilles.includes(f));
}
