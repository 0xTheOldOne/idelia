/**
 * Copie un texte dans le presse-papiers (API Clipboard asynchrone). Exige un
 * contexte sécurisé (https ou localhost) et un geste utilisateur (appel direct
 * depuis un clic). Ne lève jamais. Pas de repli `execCommand` (obsolète) : le
 * repli est la sélection manuelle, côté interface (feature 0027).
 *
 * @param {string} texte
 * @returns {Promise<boolean>} `true` si copié ; `false` si API absente, contexte non sécurisé ou refus.
 */
export async function copierTexte(texte) {
  try {
    if (!window.isSecureContext || !navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}
