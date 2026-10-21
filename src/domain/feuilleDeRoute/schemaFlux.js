/**
 * Définition Mermaid du chemin de l'argent (feature 0036, ADR 0022).
 *
 * Module pur : aucun import Vue/Vuex (ADR 0008). Imports relatifs uniquement.
 * Le texte est entièrement produit ici : libellés échappés, couleurs en liste blanche.
 */

import { formaterEuros } from '../utils/montants.js';
import { estCouleurFoncee } from '../utils/couleurs.js';

/** Longueur maximale d'un libellé de nœud. */
const LONGUEUR_MAX_LIBELLE = 60;

/** Caractères à neutraliser dans un libellé entre guillemets → entité Mermaid. */
const TABLE = {
  '"': '#quot;',
  '<': '#lt;',
  '>': '#gt;',
  '#': '#35;',
  ';': '#59;',
  '`': '#96;',
  '|': '#124;',
  // `$` : ferme la surface KaTeX de Mermaid (un nom `$$x$$` ne doit jamais devenir une formule).
  $: '#36;',
};

/** Couleur acceptée dans une ligne `style` (liste blanche). */
const COULEUR_VALIDE = /^#[0-9A-Fa-f]{6}$/;

/** Espace insécable, comme dans les montants de `formaterEuros`. */
const ESPACE_INSECABLE = String.fromCodePoint(0xa0);

/**
 * Échappe un texte pour un libellé Mermaid entre guillemets, en une seule passe
 * (pas de double échappement) : " → #quot;  < → #lt;  > → #gt;  # → #35;  ; → #59;
 * ` → #96;  | → #124;  $ → #36; ; caractères de contrôle et retours à la ligne → espace ;
 * caractères de format invisibles (bidi, largeur nulle : \p{Cf}) supprimés ; espaces multiples réduits ; coupé à 60 caractères.
 * @param {string} texte
 * @returns {string}
 */
export function echapperLibelleMermaid(texte) {
  const propre = String(texte ?? '')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/\p{Cf}/gu, '')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, LONGUEUR_MAX_LIBELLE);
  return propre.replace(/["<>#;`|$]/g, (c) => TABLE[c]);
}

/**
 * Libellé d'une arête de rétrocession.
 * @param {import('./fluxComptes.js').Retrocession} r
 * @returns {string}
 */
function libelleRetrocession(r) {
  const somme = formaterEuros(r.partRemplacanteCentimes ?? Math.abs(r.soldeCentimes));
  if (r.sens === 'RECOIT') {
    const suite = r.taux === null ? 'taux à renseigner' : `taux ${r.taux}${ESPACE_INSECABLE}%`;
    return `+${ESPACE_INSECABLE}${somme} (${suite})`;
  }
  const suite = r.taux === null ? ' (taux à renseigner)' : '';
  return `à déduire :${ESPACE_INSECABLE}${somme}${suite}`;
}

/**
 * Texte Mermaid `flowchart LR` du chemin de l'argent, ou null s'il n'y a ni virement
 * ni rétrocession.
 * @param {import('./fluxComptes.js').FluxComptes} flux
 * @param {Map<string, string>} libelles      // libellesFlux(flux)
 * @returns {(string|null)}
 */
export function definitionSchemaFlux(flux, libelles) {
  if (!flux || (flux.virements.length === 0 && flux.retrocessions.length === 0)) return null;

  // Comptes qui participent à un virement ou à une rétrocession.
  const participants = new Set();
  for (const v of flux.virements) {
    participants.add(v.de);
    participants.add(v.vers);
  }
  for (const r of flux.retrocessions) participants.add(r.titulaire.id);

  /** @type {Map<string, {id: string, arrondi: boolean, couleur: (string|null)}>} */
  const noeuds = new Map();
  const ajouter = (cle, arrondi, couleur) => {
    if (noeuds.has(cle)) return;
    noeuds.set(cle, { id: `n${noeuds.size}`, arrondi, couleur: couleur ?? null });
  };
  for (const c of flux.comptes) {
    if (participants.has(c.cle)) ajouter(c.cle, false, c.titulaire?.couleur);
  }
  for (const r of flux.retrocessions) ajouter(r.remplacante.id, true, r.remplacante.couleur);

  const lignes = ['flowchart LR'];
  for (const [cle, n] of noeuds) {
    const libelle = echapperLibelleMermaid(libelles.get(cle) ?? '');
    lignes.push(n.arrondi ? `  ${n.id}("${libelle}")` : `  ${n.id}["${libelle}"]`);
  }
  for (const v of flux.virements) {
    lignes.push(`  ${noeuds.get(v.de).id} -->|"${formaterEuros(v.montantCentimes)}"| ${noeuds.get(v.vers).id}`);
  }
  for (const r of flux.retrocessions) {
    const fleche = r.sens === 'RECOIT' ? '-->' : '-.->';
    lignes.push(
      `  ${noeuds.get(r.titulaire.id).id} ${fleche}|"${libelleRetrocession(r)}"| ${noeuds.get(r.remplacante.id).id}`,
    );
  }
  for (const n of noeuds.values()) {
    if (typeof n.couleur !== 'string' || !COULEUR_VALIDE.test(n.couleur)) continue;
    const texte = estCouleurFoncee(n.couleur) ? '#fff' : '#212529';
    lignes.push(`  style ${n.id} fill:${n.couleur},color:${texte},stroke:#212529`);
  }
  return lignes.join('\n');
}
