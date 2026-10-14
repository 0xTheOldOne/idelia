/**
 * Icônes de repère des tournées (feature 0029) : codes stables et libellés FR.
 *
 * Module pur : aucun import Vue/Vuex (ADR 0008), et aucun import tout court
 * (chargé par `tournees.js`, `schema.js`, `diffusion.js`, `migrations.js`).
 * Aucune référence à Phosphor ici : la correspondance code → composant vit
 * dans `PastilleTournee.vue`.
 */

/**
 * @typedef {Object} IconeTournee
 * @property {string} code - Code stable MAJUSCULES_SNAKE, stocké dans `Tournee.icone`.
 * @property {string} libelle - Libellé FR affiché sous la vignette du sélecteur.
 */

/**
 * Liste restreinte des icônes, dans l'ordre d'affichage du sélecteur.
 *
 * @type {ReadonlyArray<Readonly<IconeTournee>>}
 */
export const ICONES_TOURNEE = Object.freeze(
  [
    { code: 'SERINGUE', libelle: 'Seringue' },
    { code: 'STETHOSCOPE', libelle: 'Stéthoscope' },
    { code: 'PANSEMENT', libelle: 'Pansement' },
    { code: 'MEDICAMENTS', libelle: 'Médicaments' },
    { code: 'GOUTTE', libelle: 'Goutte' },
    { code: 'TROUSSE', libelle: 'Trousse de soins' },
    { code: 'DOMICILE', libelle: 'Domicile' },
    { code: 'VOITURE', libelle: 'Voiture' },
    { code: 'A_PIED', libelle: 'À pied' },
    { code: 'VELO', libelle: 'Vélo' },
    { code: 'SOLEIL', libelle: 'Soleil' },
    { code: 'LUNE', libelle: 'Lune' },
  ].map((icone) => Object.freeze(icone))
);

/**
 * Trouve l'icône dont le code est exactement `valeur` (comparaison stricte,
 * sans accès par clé d'objet : `'__proto__'`, `'constructor'`… sont inoffensifs).
 *
 * @param {*} valeur
 * @returns {(Readonly<IconeTournee>|undefined)}
 */
function trouverIcone(valeur) {
  if (typeof valeur !== 'string') return undefined;
  return ICONES_TOURNEE.find((icone) => icone.code === valeur);
}

/**
 * Normalise une valeur brute en code d'icône valide.
 *
 * @param {*} valeur - Valeur brute (formulaire, import, ancienne sauvegarde).
 * @returns {(string|null)} Le code s'il appartient à `ICONES_TOURNEE`, sinon `null`.
 */
export function normaliserIconeTournee(valeur) {
  const icone = trouverIcone(valeur);
  return icone ? icone.code : null;
}

/**
 * Libellé FR d'une icône.
 *
 * @param {*} code
 * @returns {string} Libellé, ou `''` si le code est inconnu ou `null`.
 */
export function libelleIconeTournee(code) {
  const icone = trouverIcone(code);
  return icone ? icone.libelle : '';
}
