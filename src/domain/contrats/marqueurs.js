/**
 * Résolution des marqueurs d'un modèle de contrat en valeurs FR (0041, destiné à 0042).
 * Module pur : aucun import Vue/Vuex/Quill, aucun accès au DOM, pas de `new Date()`.
 */

import { copieJson } from '@/domain/utils/json.js';
import { dateUtil } from '@/domain/utils/dates.js';
import { adresseSurUneLigne } from '@/domain/adresse.js';
import { libelleStatutPersonne } from '@/domain/libelles.js';
import { normaliserIdentifiant } from '@/domain/identifiantsPro.js';
import { libelleMarqueur, estChampLibre } from '@/domain/contrats/catalogueMarqueurs.js';
import { clesMarqueursUtilisees } from '@/domain/contrats/delta.js';
import { estTauxSaisiValide } from '@/domain/contrats/modeles.js';

/**
 * @typedef {import('@/domain/contrats/modeles.js').ChampLibre} ChampLibre
 */

/**
 * @typedef {Object} ContexteMarqueurs
 * @property {object|null} personne
 * @property {object|null} titulaire - résolu via `personne.titulaireId` (peut être null)
 * @property {import('@/domain/schema.js').ParametresCabinet|null} cabinet - lu : nomCabinet, adresseCabinet
 * @property {string} aujourdhui - "YYYY-MM-DD" (injecté)
 * @property {Object<string, (string|number|null)>} saisies - valeurs des champs libres, par clé
 * @property {ChampLibre[]} champsLibres
 */

const ESPACE_INSECABLE = ' ';

/** Texte non vide (trim) ou `null`. */
function texte(valeur) {
  if (typeof valeur !== 'string') return null;
  const t = valeur.trim();
  return t === '' ? null : t;
}

/** Nombre → texte FR (virgule décimale) ; `null` si non fini. */
function nombreFr(n) {
  return Number.isFinite(n) ? String(n).replace('.', ',') : null;
}

/** « 80 % » avec espace insécable ; `null` si non numérique. */
function pourcentage(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = nombreFr(Number(valeur));
  return n === null ? null : `${n}${ESPACE_INSECABLE}%`;
}

/** Date longue FR ou `null`. */
function dateLongue(valeur) {
  const t = dateUtil.formatDateLongueFr(valeur);
  return t === '' ? null : t;
}

/** « Prénom Nom » ou `null`. */
function nomComplet(p) {
  return texte(`${p?.prenom ?? ''} ${p?.nom ?? ''}`);
}

/** Adresse sur une ligne ou `null`. */
function adresse(valeur) {
  return texte(adresseSurUneLigne(valeur));
}

/** Valeur d'un champ d'une personne (`personne.*` ou `titulaire.*`). */
function valeurPersonne(champ, p) {
  if (!p) return null;
  switch (champ) {
    case 'prenom':
      return texte(p.prenom);
    case 'nom':
      return texte(p.nom);
    case 'nomComplet':
      return nomComplet(p);
    case 'statut':
      return texte(libelleStatutPersonne(p.statut));
    case 'quotite':
      return pourcentage(p.quotite);
    case 'tauxRetrocession':
      return pourcentage(p.tauxRetrocession);
    case 'dateEntree':
      return dateLongue(p.dateEntree);
    case 'dateNaissance':
      return dateLongue(p.dateNaissance);
    case 'adresse':
      return adresse(p.adresse);
    case 'email':
      return texte(p.contact?.email);
    case 'telephone':
      return texte(p.contact?.telephone);
    default:
      // Identifiants professionnels (rpps, adeli, ordinal, cps, carteProfessionnelle, siret).
      return normaliserIdentifiant(p.identifiants?.[champ]);
  }
}

/** Valeur d'un champ à compléter selon son type. */
function valeurSaisie(cle, contexte) {
  const champ = (contexte.champsLibres ?? []).find((c) => c.cle === cle);
  const brute = contexte.saisies?.[cle];
  if (!champ || brute === null || brute === undefined || brute === '') return null;
  switch (champ.type) {
    case 'DATE':
      return dateLongue(brute);
    case 'NOMBRE': {
      const n = typeof brute === 'number' ? brute : Number(String(brute).trim().replace(',', '.'));
      return nombreFr(n);
    }
    case 'TAUX_RETROCESSION':
      return estTauxSaisiValide(brute) ? pourcentage(brute) : null;
    default:
      return texte(String(brute));
  }
}

/**
 * Construit le contexte depuis les données du store (titulaire retrouvé dans `personnes`).
 * @param {{ personne: (object|null), personnes: object[], cabinet: (object|null), aujourdhui: string,
 *   saisies?: object, champsLibres?: ChampLibre[] }} donnees
 * @returns {ContexteMarqueurs}
 */
export function construireContexte({ personne, personnes, cabinet, aujourdhui, saisies, champsLibres }) {
  const titulaireId = personne?.titulaireId ?? null;
  const titulaire = titulaireId ? ((personnes ?? []).find((p) => p.id === titulaireId) ?? null) : null;
  return {
    personne: personne ?? null,
    titulaire,
    cabinet: cabinet ?? null,
    aujourdhui,
    saisies: saisies ?? {},
    champsLibres: champsLibres ?? [],
  };
}

/**
 * Valeur affichable FR d'un marqueur, ou null si absente/vide (= non résolu).
 * @param {string} cle
 * @param {ContexteMarqueurs} contexte
 * @returns {(string|null)}
 */
export function valeurMarqueur(cle, contexte) {
  if (typeof cle !== 'string') return null;
  if (estChampLibre(cle)) return valeurSaisie(cle, contexte);
  const [groupe, champ] = cle.split('.');
  switch (groupe) {
    case 'personne':
      return valeurPersonne(champ, contexte.personne);
    case 'titulaire':
      return valeurPersonne(champ, contexte.titulaire);
    case 'cabinet':
      if (champ === 'nom') return texte(contexte.cabinet?.nomCabinet);
      if (champ === 'adresse') return adresse(contexte.cabinet?.adresseCabinet);
      return null;
    case 'date':
      return champ === 'jour' ? dateLongue(contexte.aujourdhui) : null;
    default:
      return null;
  }
}

/**
 * Nouveau Delta : chaque marqueur résolu devient du texte (attributs de l'embed conservés) ;
 * les non résolus restent des embeds. Delta d'entrée non modifié.
 * @param {{ ops: object[] }} delta
 * @param {ContexteMarqueurs} contexte
 * @returns {{ ops: object[] }}
 */
export function remplacerMarqueurs(delta, contexte) {
  const ops = delta.ops.map((op) => {
    const cle = op?.insert?.marqueur?.cle;
    if (typeof cle !== 'string') return copieJson(op);
    const valeur = valeurMarqueur(cle, contexte);
    if (valeur === null) return copieJson(op);
    return op.attributes ? { insert: valeur, attributes: { ...op.attributes } } : { insert: valeur };
  });
  return { ops };
}

/**
 * Marqueurs sans valeur, uniques, dans l'ordre.
 * @param {{ ops: object[] }} delta
 * @param {ContexteMarqueurs} contexte
 * @returns {Array<{ cle: string, libelle: string }>}
 */
export function marqueursNonResolus(delta, contexte) {
  return clesMarqueursUtilisees(delta)
    .filter((cle) => valeurMarqueur(cle, contexte) === null)
    .map((cle) => ({ cle, libelle: libelleMarqueur(cle, contexte.champsLibres) }));
}
