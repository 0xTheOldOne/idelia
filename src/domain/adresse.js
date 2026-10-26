/**
 * Adresse postale générique, partagée par l'adresse du cabinet (0039) et
 * celle des personnes (0040) : forme, normalisation, code postal, affichage.
 *
 * Module pur : aucun import (ni Vue, ni Vuex, ni autre module du domaine).
 */

/** @typedef {{ ligne1: string, ligne2: string, codePostal: string, ville: string }} AdressePostale */

/** Longueurs maximales (saisie Vuelidate et contrôle d'import) : une seule source de vérité. */
export const LONGUEURS_MAX_ADRESSE = Object.freeze({ ligne1: 150, ligne2: 150, codePostal: 10, ville: 100 });

/** Code postal français : 5 chiffres (métropole, Corse, outre-mer). */
export const RE_CODE_POSTAL = /^\d{5}$/;

/**
 * `true` si le code postal est vide ('' après normalisation) ou conforme à RE_CODE_POSTAL.
 * @param {*} valeur - Code postal brut ou normalisé.
 * @returns {boolean}
 */
export function estCodePostalValide(valeur) {
  const cp = normaliserCodePostal(valeur);
  return cp === '' || RE_CODE_POSTAL.test(cp);
}

/**
 * Adresse vide (nouvelle instance à chaque appel).
 * @returns {AdressePostale}
 */
export function adresseVide() {
  return { ligne1: '', ligne2: '', codePostal: '', ville: '' };
}

/**
 * Non-chaîne → '' ; sinon tous les espaces retirés (« 69 003 » → « 69003 »).
 * Ne valide pas : voir `estCodePostalValide`.
 * @param {*} valeur
 * @returns {string}
 */
export function normaliserCodePostal(valeur) {
  return typeof valeur === 'string' ? valeur.replace(/\s+/g, '') : '';
}

/**
 * Forme garantie : objet → 4 chaînes (trim ; codePostal via `normaliserCodePostal`) ;
 * champ non-chaîne → '' ; non-objet (ou null/undefined) → `adresseVide()`.
 * @param {*} valeur
 * @returns {AdressePostale}
 */
export function normaliserAdresse(valeur) {
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) {
    return adresseVide();
  }
  const texte = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    ligne1: texte(valeur.ligne1),
    ligne2: texte(valeur.ligne2),
    codePostal: normaliserCodePostal(valeur.codePostal),
    ville: texte(valeur.ville),
  };
}

/**
 * Lignes non vides, prêtes à afficher : [ligne1, ligne2, 'CP Ville'] (la 3ᵉ sans espace superflu).
 * Tolère `null` et `undefined` (adresse vide).
 * @param {AdressePostale|null|undefined} adresse
 * @returns {string[]}
 */
export function lignesAdresse(adresse) {
  const { ligne1, ligne2, codePostal, ville } = normaliserAdresse(adresse);
  return [ligne1, ligne2, [codePostal, ville].filter(Boolean).join(' ')].filter(Boolean);
}

/**
 * Adresse sur une ligne : `lignesAdresse(adresse).join(', ')` ; '' si vide.
 * @param {AdressePostale|null|undefined} adresse
 * @returns {string}
 */
export function adresseSurUneLigne(adresse) {
  return lignesAdresse(adresse).join(', ');
}
