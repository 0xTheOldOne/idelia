/**
 * Copie profonde d'une valeur sérialisable en JSON (Delta Quill, champs libres…).
 * Préférée à `structuredClone`, qui échoue sur les proxies réactifs du state Vuex.
 * @template T
 * @param {T} valeur
 * @returns {T}
 */
export function copieJson(valeur) {
  return JSON.parse(JSON.stringify(valeur));
}
