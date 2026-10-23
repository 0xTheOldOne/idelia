/**
 * Adaptateur navigateur du thème (feature 0038, ADR 0022) : lecture et écoute
 * de `prefers-color-scheme`, pose de l'attribut `data-bs-theme` et écoute de
 * l'impression. Aucune persistance ici (voir `storageRepository`).
 */

const REQUETE_SOMBRE = '(prefers-color-scheme: dark)';

/**
 * @returns {MediaQueryList|null} La requête média, ou `null` si l'API est absente.
 */
function requeteSysteme() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REQUETE_SOMBRE)
    : null;
}

/**
 * Indique si l'ordinateur est réglé en thème sombre.
 *
 * @returns {boolean} `false` si l'API est absente.
 */
export function systemePrefereSombre() {
  return requeteSysteme()?.matches === true;
}

/**
 * Écoute les changements de thème de l'ordinateur. Sans effet si l'API est absente.
 *
 * @param {(sombre: boolean) => void} rappel
 */
export function ecouterThemeSysteme(rappel) {
  requeteSysteme()?.addEventListener('change', (e) => rappel(e.matches));
}

/**
 * Pose le thème sur `<html>`. Seul endroit qui connaît les valeurs Bootstrap
 * `light` et `dark`.
 *
 * @param {import('@/domain/theme.js').ThemeEffectif} theme
 */
export function appliquerThemeDocument(theme) {
  document.documentElement.setAttribute('data-bs-theme', theme === 'SOMBRE' ? 'dark' : 'light');
}

/**
 * Branche des rappels avant et après l'impression.
 *
 * @param {{ avant: () => void, apres: () => void }} rappels
 */
export function ecouterImpression({ avant, apres }) {
  window.addEventListener('beforeprint', avant);
  window.addEventListener('afterprint', apres);
}
