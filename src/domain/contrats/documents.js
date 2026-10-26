/**
 * Documents contractuels (0042) : génération d'un document figé depuis un modèle,
 * en-tête du cabinet, statuts et règles associées.
 * Module pur : aucun import Vue/Vuex/Quill, aucun accès au DOM, aucun `new Date()`
 * (l'horloge est injectée via `maintenant` / `aujourdhui`).
 */

import { copieJson } from '@/domain/utils/json.js';
import { genId } from '@/domain/utils/id.js';
import { dateUtil } from '@/domain/utils/dates.js';
import { estLogoValide } from '@/domain/cabinet.js';
import { figerEnteteCabinet, normaliserDocument } from '@/domain/contrats/documentsNormalisation.js';
import { estChampLibre } from '@/domain/contrats/catalogueMarqueurs.js';
import { clesMarqueursUtilisees } from '@/domain/contrats/delta.js';
import { construireContexte, marqueursNonResolus, remplacerMarqueurs } from '@/domain/contrats/marqueurs.js';

/** @typedef {'BROUILLON'|'SIGNE'} StatutDocument */
/** @typedef {{ cle: string, libelle: string, type: 'TEXTE'|'DATE'|'NOMBRE'|'TAUX_RETROCESSION', valeur: (string|number|null) }} ValeurSaisie */
/** @typedef {{ cle: string, libelle: string, type: ValeurSaisie['type'], requis: boolean }} ChampGeneration */
/** @typedef {{ nomCabinet: string, adresseCabinet: import('@/domain/adresse.js').AdressePostale }} EnteteCabinet */
/** @typedef {EnteteCabinet & { logo: (string|null) }} EnteteAffichee */

/**
 * @typedef {Object} DocumentContrat
 * @property {string} id - GUID.
 * @property {string} personneId - Personne concernée.
 * @property {string} modeleId - Modèle d'origine.
 * @property {string} titre - 1..200 caractères.
 * @property {string} type - `'CONTRAT'` | `'AVENANT'`, recopié du modèle.
 * @property {{ ops: object[] }} contenu - Delta Quill sans aucun embed `marqueur`.
 * @property {ValeurSaisie[]} valeursSaisies - Ce qui a été saisi à la création.
 * @property {StatutDocument} statut
 * @property {(string|null)} signeLe - "YYYY-MM-DD" ou null en brouillon.
 * @property {(EnteteCabinet|null)} enteteCabinet - null en brouillon ; nom + adresse figés à la signature (jamais le logo).
 * @property {boolean} archive - Seul un document signé s'archive.
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

// Re-exports : l'implémentation vit dans `documentsNormalisation.js` (évite un cycle d'imports avec `schema.js`).
export { figerEnteteCabinet, normaliserDocument };

export const STATUTS_DOCUMENT = Object.freeze(['BROUILLON', 'SIGNE']);

/** Texte posé à la place d'une information de fiche laissée vide : à compléter à la main sur le papier. */
export const BLANC_A_COMPLETER = '……………………';

/** Clés du catalogue qui sont des dates (saisie en `input type="date"`). */
const CLES_DATE = /(^|\.)dateNaissance$|^personne\.dateEntree$/;

/**
 * Libellé FR d'un statut.
 * @param {string} statut
 * @returns {string}
 */
export function libelleStatutDocument(statut) {
  return statut === 'SIGNE' ? 'Signé' : 'Brouillon';
}

/**
 * Champs à demander à la génération, dans l'ordre d'apparition dans le texte.
 * - `libres` : champs à compléter du modèle utilisés dans le texte (requis) ;
 * - `manquants` : informations de fiche absentes, hors `saisie.*` (facultatives).
 * `contexte` = `construireContexte(...)` sans saisies.
 * @param {import('@/domain/contrats/modeles.js').ModeleContrat} modele
 * @param {import('@/domain/contrats/marqueurs.js').ContexteMarqueurs} contexte
 * @returns {{ libres: ChampGeneration[], manquants: ChampGeneration[] }}
 */
export function champsAGenerer(modele, contexte) {
  const champsLibres = modele?.champsLibres ?? [];
  const libres = clesMarqueursUtilisees(modele?.contenu)
    .map((cle) => champsLibres.find((c) => c.cle === cle))
    .filter(Boolean)
    .map((c) => ({ cle: c.cle, libelle: c.libelle, type: c.type, requis: true }));
  const manquants = marqueursNonResolus(modele?.contenu ?? { ops: [] }, contexte)
    .filter(({ cle }) => !estChampLibre(cle))
    .map(({ cle, libelle }) => ({ cle, libelle, type: CLES_DATE.test(cle) ? 'DATE' : 'TEXTE', requis: false }));
  return { libres, manquants };
}

/**
 * '12,5' → 12.5 ; ' 10 ' → 10 ; '' / 'abc' → null.
 * @param {*} texte
 * @returns {(number|null)}
 */
export function lireNombreSaisi(texte) {
  if (typeof texte === 'number') return Number.isFinite(texte) ? texte : null;
  if (typeof texte !== 'string') return null;
  const t = texte.trim().replace(',', '.');
  if (t === '' || !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Texte à poser dans le Delta pour un embed non résolu. */
function texteFige(saisie) {
  const valeur = saisie?.valeur;
  if (valeur === null || valeur === undefined) return BLANC_A_COMPLETER;
  const t = saisie.type === 'DATE' ? dateUtil.formatDateLongueFr(String(valeur)) : String(valeur).trim();
  return t === '' ? BLANC_A_COMPLETER : t;
}

/**
 * Construit le document Brouillon (copie figée du modèle, aucun embed restant).
 * @param {{ modele: import('@/domain/contrats/modeles.js').ModeleContrat, personne: object, personnes: object[],
 *   cabinet: (object|null), titre: string, valeursSaisies: ValeurSaisie[], aujourdhui: string, maintenant: string }} p
 * @returns {DocumentContrat}
 */
export function genererDocument({ modele, personne, personnes, cabinet, titre, valeursSaisies, aujourdhui, maintenant }) {
  const saisiesListe = copieJson(valeursSaisies ?? []);
  const saisies = {};
  for (const v of saisiesListe) {
    if (estChampLibre(v.cle)) saisies[v.cle] = v.valeur;
  }
  const contexte = construireContexte({
    personne,
    personnes,
    cabinet,
    aujourdhui,
    saisies,
    champsLibres: modele.champsLibres,
  });
  const remplace = remplacerMarqueurs(copieJson(modele.contenu), contexte);
  // Embeds restants (informations de fiche absentes) : figés en texte, jamais d'embed dans un document.
  const ops = remplace.ops.map((op) => {
    const cle = op?.insert?.marqueur?.cle;
    if (typeof cle !== 'string') return op;
    const texte = texteFige(saisiesListe.find((v) => v.cle === cle));
    return op.attributes ? { insert: texte, attributes: op.attributes } : { insert: texte };
  });
  return {
    id: genId(),
    personneId: personne.id,
    modeleId: modele.id,
    titre: String(titre ?? '').trim(),
    type: modele.type,
    contenu: { ops },
    valeursSaisies: saisiesListe,
    statut: 'BROUILLON',
    signeLe: null,
    enteteCabinet: null,
    archive: false,
    createdAt: maintenant,
    updatedAt: maintenant,
  };
}

/**
 * Champ « taux de rétrocession » : par le type dédié, jamais par le libellé.
 * @param {{ type?: string }} champ
 * @returns {boolean}
 */
export function estChampTaux(champ) {
  return champ?.type === 'TAUX_RETROCESSION';
}

/**
 * Écart entre le taux saisi et `personne.tauxRetrocession`.
 * `null` si aucun champ de ce type, valeurs égales, ou fiche vide d'une personne non remplaçante.
 * @param {{ valeursSaisies: ValeurSaisie[], personne: object }} p
 * @returns {(null|{ valeurSaisie: number, valeurFiche: (number|null) })}
 */
export function ecartTauxRetrocession({ valeursSaisies, personne }) {
  const champ = (valeursSaisies ?? []).find(estChampTaux);
  if (!champ) return null;
  const valeurSaisie = lireNombreSaisi(champ.valeur);
  if (valeurSaisie === null) return null;
  const brute = personne?.tauxRetrocession;
  const valeurFiche = typeof brute === 'number' && Number.isFinite(brute) ? brute : null;
  if (valeurFiche === null) {
    return personne?.statut === 'REMPLACANT' ? { valeurSaisie, valeurFiche: null } : null;
  }
  return valeurFiche === valeurSaisie ? null : { valeurSaisie, valeurFiche };
}

/**
 * En-tête à afficher et imprimer : nom + adresse figés si signé (sinon en direct), logo toujours actuel.
 * @param {DocumentContrat} document
 * @param {(object|null|undefined)} parametres
 * @returns {EnteteAffichee}
 */
export function enteteAffichee(document, parametres) {
  const base =
    document?.statut === 'SIGNE' && document.enteteCabinet
      ? figerEnteteCabinet(document.enteteCabinet)
      : figerEnteteCabinet(parametres);
  return { ...base, logo: estLogoValide(parametres?.logo) ? parametres.logo : null };
}

/** @param {DocumentContrat} doc @returns {boolean} Brouillon. */
export function estModifiable(doc) {
  return doc?.statut === 'BROUILLON';
}

/** @param {DocumentContrat} doc @returns {boolean} Brouillon. */
export function estSupprimable(doc) {
  return doc?.statut === 'BROUILLON';
}

/** @param {DocumentContrat} doc @returns {boolean} Signé. */
export function estArchivable(doc) {
  return doc?.statut === 'SIGNE';
}

/**
 * Date de signature acceptable : date valide et ≤ aujourd'hui.
 * @param {*} date
 * @param {string} aujourdhui - "YYYY-MM-DD"
 * @returns {boolean}
 */
export function estDateSignatureValide(date, aujourdhui) {
  return typeof date === 'string' && dateUtil.estDateValide(date) && date <= aujourdhui;
}

/**
 * Tri d'affichage : createdAt décroissant, puis titre. Ne mute pas l'entrée.
 * @param {DocumentContrat[]} documents
 * @returns {DocumentContrat[]}
 */
export function trierDocuments(documents) {
  return [...documents].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return String(a.titre).localeCompare(String(b.titre), 'fr');
  });
}

/**
 * Nom de fichier proposé : « {titre} - {Prénom Nom} - JJ-MM-AAAA », sans / \ : * ? " < > |.
 * La date est celle de signature, sinon de création.
 * @param {DocumentContrat} document
 * @param {object} personne
 * @returns {string}
 */
export function titreFichierDocument(document, personne) {
  const iso = String(document?.signeLe ?? document?.createdAt ?? '').slice(0, 10);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('-') : '';
  const nom = `${personne?.prenom ?? ''} ${personne?.nom ?? ''}`.trim();
  const titre = String(document?.titre ?? '');
  // Le titre proposé à la création contient déjà le nom : ne pas le répéter.
  const nomUtile = nom && !titre.toLowerCase().includes(nom.toLowerCase()) ? nom : '';
  return [titre, nomUtile, date]
    .filter(Boolean)
    .join(' - ')
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
