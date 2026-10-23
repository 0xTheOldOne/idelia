/**
 * Préférence de thème (feature 0038, ADR 0022) : options, normalisation et
 * résolution du mode Automatique. Module pur (aucun import de Vue/Vuex, aucun
 * accès au navigateur).
 */

/** @typedef {'AUTO'|'CLAIR'|'SOMBRE'} PreferenceTheme */
/** @typedef {'CLAIR'|'SOMBRE'} ThemeEffectif */

/** Valeurs acceptées pour la préférence de thème. */
export const PREFERENCES_THEME = Object.freeze(['AUTO', 'CLAIR', 'SOMBRE']);

/** Préférence par défaut : suivre le réglage de l'ordinateur. */
export const PREFERENCE_THEME_DEFAUT = 'AUTO';

/** Options affichées par `BlocApparence` (libellé + aide), dans cet ordre. */
export const OPTIONS_THEME = Object.freeze([
  { code: 'AUTO', libelle: 'Automatique', aide: 'Comme votre ordinateur' },
  { code: 'CLAIR', libelle: 'Clair', aide: 'Fond clair, texte foncé' },
  { code: 'SOMBRE', libelle: 'Sombre', aide: 'Fond foncé, plus doux pour les yeux le soir' },
]);

/**
 * Valeur inconnue, absente ou illisible → `'AUTO'`.
 *
 * @param {*} valeur - Valeur lue (stockage) ou reçue (action).
 * @returns {PreferenceTheme}
 */
export function normaliserPreferenceTheme(valeur) {
  return PREFERENCES_THEME.includes(valeur) ? valeur : PREFERENCE_THEME_DEFAUT;
}

/**
 * Résout le thème réellement appliqué : `'AUTO'` suit le système, sinon la
 * préférence elle-même.
 *
 * @param {PreferenceTheme} preference
 * @param {boolean} systemeSombre - `true` si l'ordinateur est réglé en sombre.
 * @returns {ThemeEffectif}
 */
export function resoudreTheme(preference, systemeSombre) {
  const p = normaliserPreferenceTheme(preference);
  if (p === 'AUTO') return systemeSombre ? 'SOMBRE' : 'CLAIR';
  return p;
}
