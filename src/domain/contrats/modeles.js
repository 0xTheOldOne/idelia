/**
 * Fabriques et règles pures des modèles de contrats (0041).
 * Module pur : aucun import Vue/Vuex/Quill.
 */

import { copieJson } from '@/domain/utils/json.js';
import { genId } from '@/domain/utils/id.js';
import { TYPES_MODELE_CONTRAT, BORNES_TAUX_RETROCESSION } from '@/domain/schema.js';
import { deltaVide, estDeltaModeleValide, clesMarqueursUtilisees } from '@/domain/contrats/delta.js';
import { PREFIXE_SAISIE } from '@/domain/contrats/catalogueMarqueurs.js';

/** Longueurs maximales (titre du modèle, libellé d'un champ à compléter). */
export const LONGUEUR_MAX_TITRE_MODELE = 120;
export const LONGUEUR_MAX_LIBELLE_CHAMP = 80;

/**
 * @typedef {Object} ChampLibre
 * @property {string} cle - `'saisie.' + GUID`, unique dans le modèle.
 * @property {string} libelle - 1..80 caractères.
 * @property {string} type - `'TEXTE'` | `'DATE'` | `'NOMBRE'` | `'TAUX_RETROCESSION'` (voir TYPES_CHAMP_LIBRE).
 */

/**
 * @typedef {Object} ModeleContrat
 * @property {string} id - GUID.
 * @property {string} titre - 1..120 caractères.
 * @property {string} type - `'CONTRAT'` | `'AVENANT'` (voir TYPES_MODELE_CONTRAT).
 * @property {{ ops: object[] }} contenu - Delta Quill, jamais de HTML.
 * @property {ChampLibre[]} champsLibres - Champs à compléter (≤ 50).
 * @property {boolean} actif - `false` = archivé.
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/** @param {*} type @returns {string} Type valide, `'CONTRAT'` par défaut. */
function normaliserType(type) {
  return TYPES_MODELE_CONTRAT.includes(type) ? type : 'CONTRAT';
}

/**
 * Crée un modèle complet.
 * @param {{ titre?: string, type?: string, contenu?: object, champsLibres?: ChampLibre[] }} [champs]
 * @returns {ModeleContrat}
 */
export function creerModeleContrat({ titre = '', type, contenu, champsLibres } = {}) {
  const maintenant = new Date().toISOString();
  return {
    id: genId(),
    titre: String(titre ?? '').trim().slice(0, LONGUEUR_MAX_TITRE_MODELE),
    type: normaliserType(type),
    contenu: estDeltaModeleValide(contenu) ? contenu : deltaVide(),
    champsLibres: Array.isArray(champsLibres) ? champsLibres : [],
    actif: true,
    createdAt: maintenant,
    updatedAt: maintenant,
  };
}

/**
 * Copie d'un modèle : nouvel id, titre « Copie de « X » », copie profonde, actif.
 * Les clés des champs à compléter sont conservées telles quelles.
 * @param {ModeleContrat} modele
 * @returns {ModeleContrat}
 */
export function dupliquerModeleContrat(modele) {
  const maintenant = new Date().toISOString();
  return {
    ...modele,
    id: genId(),
    titre: `Copie de « ${modele.titre} »`.slice(0, LONGUEUR_MAX_TITRE_MODELE),
    contenu: copieJson(modele.contenu),
    champsLibres: copieJson(modele.champsLibres ?? []),
    actif: true,
    createdAt: maintenant,
    updatedAt: maintenant,
  };
}

/**
 * Nouveau champ à compléter, avec une clé générée.
 * @param {{ libelle: string, type: string }} champ
 * @returns {ChampLibre}
 */
export function creerChampLibre({ libelle, type }) {
  return { cle: PREFIXE_SAISIE + genId(), libelle: String(libelle ?? '').trim(), type };
}

/**
 * Le champ figure-t-il dans le texte ?
 * @param {{ ops?: object[] }} contenu
 * @param {string} cle
 * @returns {boolean}
 */
export function champLibreUtilise(contenu, cle) {
  return clesMarqueursUtilisees(contenu).includes(cle);
}

/**
 * Premier champ de type TAUX_RETROCESSION, ou `null`.
 * @param {ChampLibre[]} champsLibres
 * @returns {(ChampLibre|null)}
 */
export function champTauxRetrocession(champsLibres) {
  return (champsLibres ?? []).find((c) => c.type === 'TAUX_RETROCESSION') ?? null;
}

/**
 * `false` si un AUTRE champ (clé ≠ `cleEnCours`) a déjà le type TAUX_RETROCESSION.
 * @param {ChampLibre[]} champsLibres
 * @param {(string|null)} [cleEnCours]
 * @returns {boolean}
 */
export function peutAjouterTauxRetrocession(champsLibres, cleEnCours = null) {
  return !(champsLibres ?? []).some((c) => c.type === 'TAUX_RETROCESSION' && c.cle !== cleEnCours);
}

/**
 * Nombre fini dans BORNES_TAUX_RETROCESSION (chaîne numérique acceptée).
 * @param {*} valeur
 * @returns {boolean}
 */
export function estTauxSaisiValide(valeur) {
  if (typeof valeur === 'string' && valeur.trim() === '') return false;
  if (typeof valeur !== 'number' && typeof valeur !== 'string') return false;
  const n = Number(valeur);
  return Number.isFinite(n) && n >= BORNES_TAUX_RETROCESSION.min && n <= BORNES_TAUX_RETROCESSION.max;
}

/**
 * Normalise un modèle brut (désérialisation). Ne réécrit jamais le contenu.
 * @param {object} brut
 * @returns {ModeleContrat}
 */
export function normaliserModeleContrat(brut) {
  return {
    ...brut,
    champsLibres: Array.isArray(brut?.champsLibres) ? brut.champsLibres : [],
    actif: brut?.actif ?? true,
  };
}

