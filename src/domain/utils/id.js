/**
 * Génération d'identifiants uniques.
 *
 * Module pur : aucun import Vue/Vuex (ADR 0008).
 */

/**
 * Génère un identifiant unique au format **GUID / UUID v4**
 * (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`), **toujours** — y compris en
 * secours. Règle du porteur : aucun identifiant technique lisible par un
 * humain (pas de `p-claire`, `id-…`).
 *
 * `crypto.randomUUID` n'existe qu'en contexte sécurisé (HTTPS/localhost) :
 * à défaut, on construit le même format à partir de `crypto.getRandomValues`
 * (disponible partout), voire de `Math.random` en dernier recours.
 *
 * @returns {string} GUID (UUID v4).
 */
export function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const octets = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(octets);
  } else {
    for (let i = 0; i < octets.length; i += 1) octets[i] = Math.floor(Math.random() * 256);
  }
  // Bits de version (4) et de variante (10xx) imposés par la RFC 4122.
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;

  const hex = [...octets].map((octet) => octet.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
