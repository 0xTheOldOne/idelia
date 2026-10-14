/**
 * Identifiants professionnels d'une personne (RPPS, ADELI, ordinal, CPS,
 * carte professionnelle, SIRET) : clés, libellés, normalisation, contrôle de
 * forme non bloquant (feature 0030).
 *
 * Module pur : aucun import Vue/Vuex (ADR 0008), aucun import tout court.
 */

/** Longueur maximale d'un identifiant stocké. */
export const LONGUEUR_MAX_IDENTIFIANT = 30;

/**
 * @typedef {Object} ChampIdentifiant
 * @property {string} cle - Clé dans `Personne.identifiants`.
 * @property {string} libelle - Libellé complet (fiche et consultation).
 * @property {string} aide - Aide courte sous le champ.
 */

/**
 * Les 6 champs, dans l'ordre d'affichage.
 * @type {ReadonlyArray<Readonly<ChampIdentifiant>>}
 */
export const CHAMPS_IDENTIFIANTS = Object.freeze([
  Object.freeze({
    cle: 'rpps',
    libelle: 'Numéro RPPS',
    aide: '11 chiffres. Répertoire partagé des professionnels de santé.',
  }),
  Object.freeze({
    cle: 'adeli',
    libelle: 'Numéro ADELI',
    aide: '9 caractères. Ancien numéro, remplacé peu à peu par le RPPS.',
  }),
  Object.freeze({
    cle: 'ordinal',
    libelle: 'Numéro ordinal (Ordre des infirmiers)',
    aide: "Numéro d'inscription attribué par l'Ordre.",
  }),
  Object.freeze({
    cle: 'cps',
    libelle: 'Numéro de carte CPS',
    aide: 'Inscrit sur la carte de professionnel de santé.',
  }),
  Object.freeze({
    cle: 'carteProfessionnelle',
    libelle: 'Numéro de carte professionnelle',
    aide: "Inscrit sur la carte délivrée par l'Ordre.",
  }),
  Object.freeze({
    cle: 'siret',
    libelle: 'Numéro SIRET',
    aide: "14 chiffres. Identifiant de l'activité libérale.",
  }),
]);

/**
 * Bloc d'identifiants vide (objet neuf à chaque appel).
 * @returns {Object<string, null>} Les 6 clés à `null`.
 */
export function identifiantsVides() {
  const bloc = {};
  for (const { cle } of CHAMPS_IDENTIFIANTS) bloc[cle] = null;
  return bloc;
}

/**
 * Normalise un identifiant : chaîne ou nombre → texte sans aucun espace
 * (insécables compris), en majuscules, tronqué à 30 caractères ; vide ou
 * autre type → `null`.
 *
 * @param {*} valeur
 * @returns {(string|null)}
 */
export function normaliserIdentifiant(valeur) {
  if (typeof valeur !== 'string' && typeof valeur !== 'number') return null;
  // Pré-coupe large avant les remplacements : une chaîne géante importée ne
  // doit pas figer l'onglet.
  const texte = String(valeur).slice(0, 200).replace(/\s+/g, '').toLocaleUpperCase('fr').slice(0, LONGUEUR_MAX_IDENTIFIANT);
  return texte === '' ? null : texte;
}

/**
 * Normalise le bloc complet : 6 clés connues, toujours présentes ; clés
 * inconnues ignorées ; valeur non objet (ou tableau) → bloc vide.
 * Lecture uniquement des clés connues, en propriétés propres (pas de pollution).
 *
 * @param {*} valeur
 * @returns {Object<string, (string|null)>}
 */
export function normaliserIdentifiants(valeur) {
  const bloc = identifiantsVides();
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return bloc;
  for (const { cle } of CHAMPS_IDENTIFIANTS) {
    if (Object.prototype.hasOwnProperty.call(valeur, cle)) bloc[cle] = normaliserIdentifiant(valeur[cle]);
  }
  return bloc;
}

/**
 * Somme de Luhn d'une suite de chiffres.
 * @param {string} chiffres
 * @returns {boolean}
 */
function cleLuhnValide(chiffres) {
  let somme = 0;
  for (let i = 0; i < chiffres.length; i += 1) {
    let chiffre = Number(chiffres[chiffres.length - 1 - i]);
    if (i % 2 === 1) {
      chiffre *= 2;
      if (chiffre > 9) chiffre -= 9;
    }
    somme += chiffre;
  }
  return somme % 10 === 0;
}

const SUITE_MESSAGE = 'Vous pouvez tout de même enregistrer.';

/**
 * Avertissement non bloquant sur la forme d'un identifiant.
 *
 * @param {string} cle - Clé de `CHAMPS_IDENTIFIANTS`.
 * @param {*} valeur - Valeur saisie (normalisée ici).
 * @returns {(string|null)} Message français, ou `null` (vide, correct, ou clé sans contrôle).
 */
export function avertissementIdentifiant(cle, valeur) {
  const v = normaliserIdentifiant(valeur);
  if (v === null) return null;
  if (cle === 'rpps') {
    return /^\d{11}$/.test(v) ? null : `À vérifier : un numéro RPPS compte 11 chiffres. ${SUITE_MESSAGE}`;
  }
  if (cle === 'adeli') {
    return /^(\d{2}|2A|2B)\d{7}$/.test(v)
      ? null
      : `À vérifier : un numéro ADELI compte 9 caractères, en chiffres (2A ou 2B au début pour la Corse). ${SUITE_MESSAGE}`;
  }
  if (cle === 'siret') {
    if (!/^\d{14}$/.test(v)) return `À vérifier : un numéro SIRET compte 14 chiffres. ${SUITE_MESSAGE}`;
    return cleLuhnValide(v)
      ? null
      : `À vérifier : ce numéro SIRET semble contenir une faute de frappe. ${SUITE_MESSAGE}`;
  }
  return null;
}

/**
 * Les 6 lignes à afficher (consultation), dans l'ordre.
 *
 * @param {*} identifiants - Bloc (normalisé ici).
 * @returns {Array<{cle: string, libelle: string, valeur: (string|null)}>}
 */
export function lignesIdentifiants(identifiants) {
  const bloc = normaliserIdentifiants(identifiants);
  return CHAMPS_IDENTIFIANTS.map(({ cle, libelle }) => ({ cle, libelle, valeur: bloc[cle] }));
}

/**
 * Au moins un identifiant renseigné ?
 *
 * @param {*} identifiants
 * @returns {boolean}
 */
export function aDesIdentifiants(identifiants) {
  const bloc = normaliserIdentifiants(identifiants);
  return CHAMPS_IDENTIFIANTS.some(({ cle }) => bloc[cle] !== null);
}
