/**
 * Utilitaires de couleurs (contraste du texte sur une pastille colorée).
 *
 * Module pur : aucun import Vue/Vuex (ADR 0008).
 */

/**
 * Linéarise un canal sRGB (0..255) selon WCAG 2.x.
 *
 * @param {number} canal - Valeur 0..255.
 * @returns {number} Valeur linéaire 0..1.
 */
function canalLineaire(canal) {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Indique si une couleur de fond `#RRGGBB` est « foncée », c.-à-d. si un texte
 * clair y offre un meilleur contraste qu'un texte foncé (luminance relative
 * WCAG 2.x ; seuil d'égalité des contrastes ≈ 0,179). Couleur invalide/absente
 * → `false` (texte foncé, cas sûr sur fond clair).
 *
 * @param {string} hex - Couleur au format `#RRGGBB`.
 * @returns {boolean}
 */
export function estCouleurFoncee(hex) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.2126 * canalLineaire(r) + 0.7152 * canalLineaire(g) + 0.0722 * canalLineaire(b);
  return luminance < 0.179;
}
