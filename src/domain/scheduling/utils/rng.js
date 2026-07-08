/**
 * PRNG seedé, pur (algorithme mulberry32).
 *
 * Tout l'aléa du moteur (départage MRV, ordre de parcours, redémarrages de
 * la recherche locale) passe par **cette unique fonction**, jamais par
 * `Math.random`/`Date.now` (ADR 0008). Même seed ⇒ même séquence, ce qui
 * rend la génération de planning déterministe et reproductible.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage`.
 */

/**
 * Construit un générateur pseudo-aléatoire déterministe.
 *
 * @param {number} seed - Graine initiale (entier, converti en entier non
 *   signé 32 bits).
 * @returns {function(): number} Fonction sans argument qui renvoie, à
 *   chaque appel, un flottant déterministe dans `[0, 1)`. Rappeler
 *   `creerRng` avec la même graine reproduit exactement la même séquence.
 */
export function creerRng(seed) {
  let etat = seed >>> 0;

  return function rng() {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
