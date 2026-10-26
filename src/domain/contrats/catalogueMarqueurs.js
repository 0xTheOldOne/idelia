/**
 * Catalogue des marqueurs (champs automatiques) d'un modèle de contrat (0041).
 *
 * Un marqueur est stocké dans le Delta sous forme d'embed `{ insert: { marqueur: { cle } } }`.
 * Syntaxe écrite `{{cle}}` (ex. `{{personne.nom}}`) : réservée au COLLAGE d'un texte existant
 * (voir `collage.js`). Le Delta stocké ne contient jamais de `{{…}}` interprété.
 *
 * Les champs à compléter propres au modèle ont une clé `saisie.<GUID>`.
 *
 * Module pur : aucun import Vue/Vuex/Quill.
 */

import { CHAMPS_IDENTIFIANTS } from '@/domain/identifiantsPro.js';
import { estGuid } from '@/domain/utils/id.js';

/** Préfixe des clés de champs à compléter. */
export const PREFIXE_SAISIE = 'saisie.';

/**
 * @typedef {Object} MarqueurCatalogue
 * @property {string} cle
 * @property {string} libelle
 */

/**
 * @typedef {Object} GroupeMarqueurs
 * @property {string} code
 * @property {string} libelle
 * @property {ReadonlyArray<Readonly<MarqueurCatalogue>>} marqueurs
 */

const m = (cle, libelle) => Object.freeze({ cle, libelle });

/** Marqueurs « identifiant professionnel » dérivés de CHAMPS_IDENTIFIANTS, pour une personne. */
const identifiantsPersonne = CHAMPS_IDENTIFIANTS.map(({ cle, libelle }) =>
  m(`personne.${cle}`, `${libelle.replace(/^Numéro /, 'N° ').replace(/ \(.*\)$/, '')} de la personne`)
);

/** Identifiants repris pour la titulaire. */
const CLES_IDENTIFIANTS_TITULAIRE = ['rpps', 'adeli', 'ordinal', 'siret'];
const identifiantsTitulaire = CHAMPS_IDENTIFIANTS.filter(({ cle }) => CLES_IDENTIFIANTS_TITULAIRE.includes(cle)).map(
  ({ cle, libelle }) =>
    m(`titulaire.${cle}`, `${libelle.replace(/^Numéro /, 'N° ').replace(/ \(.*\)$/, '')} de la titulaire remplacée`)
);

/** @type {ReadonlyArray<Readonly<GroupeMarqueurs>>} */
export const GROUPES_MARQUEURS = Object.freeze([
  Object.freeze({
    code: 'PERSONNE',
    libelle: 'Personne concernée',
    marqueurs: Object.freeze([
      m('personne.prenom', 'Prénom de la personne'),
      m('personne.nom', 'Nom de la personne'),
      m('personne.nomComplet', 'Prénom et nom de la personne'),
      m('personne.statut', 'Statut (titulaire ou remplaçant(e))'),
      m('personne.quotite', 'Quotité de travail'),
      m('personne.tauxRetrocession', 'Taux de rétrocession actuel (fiche)'),
      m('personne.dateEntree', "Date d'arrivée au cabinet"),
      m('personne.dateNaissance', 'Date de naissance'),
      m('personne.adresse', 'Adresse de la personne'),
      m('personne.email', 'E-mail de la personne'),
      m('personne.telephone', 'Téléphone de la personne'),
      ...identifiantsPersonne,
    ]),
  }),
  Object.freeze({
    code: 'TITULAIRE',
    libelle: 'Titulaire remplacé(e)',
    marqueurs: Object.freeze([
      m('titulaire.prenom', 'Prénom de la titulaire remplacée'),
      m('titulaire.nom', 'Nom de la titulaire remplacée'),
      m('titulaire.nomComplet', 'Prénom et nom de la titulaire remplacée'),
      m('titulaire.adresse', 'Adresse de la titulaire remplacée'),
      m('titulaire.dateNaissance', 'Date de naissance de la titulaire remplacée'),
      ...identifiantsTitulaire,
    ]),
  }),
  Object.freeze({
    code: 'CABINET',
    libelle: 'Cabinet',
    marqueurs: Object.freeze([m('cabinet.nom', 'Nom du cabinet'), m('cabinet.adresse', 'Adresse du cabinet')]),
  }),
  Object.freeze({
    code: 'DATE',
    libelle: 'Date',
    marqueurs: Object.freeze([m('date.jour', 'Date du jour')]),
  }),
]);

/** Index clé → libellé du catalogue. */
const LIBELLES_CATALOGUE = new Map(GROUPES_MARQUEURS.flatMap((g) => g.marqueurs.map((x) => [x.cle, x.libelle])));

const CLES_CATALOGUE = Object.freeze([...LIBELLES_CATALOGUE.keys()]);

/**
 * Clés du catalogue (sans les `saisie.*`).
 * @returns {ReadonlyArray<string>}
 */
export function clesDuCatalogue() {
  return CLES_CATALOGUE;
}

/**
 * `true` si la clé est un champ à compléter (`saisie.` + GUID).
 * @param {*} cle
 * @returns {boolean}
 */
export function estChampLibre(cle) {
  return typeof cle === 'string' && cle.startsWith(PREFIXE_SAISIE) && estGuid(cle.slice(PREFIXE_SAISIE.length));
}

/**
 * Clé du catalogue, ou `saisie.` suivi d'un GUID.
 * @param {*} cle
 * @returns {boolean}
 */
export function estCleMarqueurValide(cle) {
  return typeof cle === 'string' && (LIBELLES_CATALOGUE.has(cle) || estChampLibre(cle));
}

/**
 * Libellé affiché dans la pastille : catalogue, sinon champ libre, sinon « Champ inconnu ».
 * @param {string} cle
 * @param {Array<{cle: string, libelle: string}>} [champsLibres]
 * @returns {string}
 */
export function libelleMarqueur(cle, champsLibres = []) {
  if (LIBELLES_CATALOGUE.has(cle)) return LIBELLES_CATALOGUE.get(cle);
  const champ = (champsLibres ?? []).find((c) => c.cle === cle);
  return champ ? champ.libelle : 'Champ inconnu';
}
