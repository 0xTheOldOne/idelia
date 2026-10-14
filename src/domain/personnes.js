/**
 * Fabrique & normalisation d'une Personne (équipe).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Seules concessions techniques tolérées (comme dans `schema.js`) : `genId()`
 * pour l'identifiant et `new Date().toISOString()` pour les horodatages.
 */

import { STATUTS_PERSONNE, COULEURS_PAR_DEFAUT } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';
import { normaliserInitialesVega } from '@/domain/initialesVega.js';
import { estCouleurFoncee } from '@/domain/utils/couleurs.js';
import { normaliserRythmeMensuel } from '@/domain/rythmeMensuel.js';

/**
 * @typedef {Object} ContactPersonne
 * @property {string|null} email
 * @property {string|null} telephone
 */

/**
 * @typedef {Object} Personne
 * @property {string} id - Identifiant unique, immuable.
 * @property {string} prenom
 * @property {string} nom
 * @property {string} statut - `'TITULAIRE'` ou `'REMPLACANT'` (voir {@link STATUTS_PERSONNE}).
 * @property {boolean} actif - Soft-delete : `false` = archivée.
 * @property {string} couleur - Couleur de repère au format hex `#RRGGBB`.
 * @property {number} quotite - Temps de travail, 0..100 (%).
 * @property {(number|null)} joursTravaillesParMois - Rythme : jours travaillés par mois complet (1..31), ou `null` (0020).
 * @property {(string|null)} titulaireId - Titulaire remplacée en priorité (id), seulement si statut `REMPLACANT`, sinon `null` (0020).
 * @property {(string|null)} dateEntree - Date d'arrivée `"YYYY-MM-DD"`, ou `null`.
 * @property {(string|null)} dateSortie - Date de départ `"YYYY-MM-DD"`, ou `null`.
 * @property {ContactPersonne} contact
 * @property {string} notes
 * @property {(string|null)} initialesVega - Code « PS » dans Vega (2-4 car. A-Z0-9, majuscules), ou null.
 * @property {(number|null)} ordreAffichage - Réordonnancement manuel (non édité en 0004).
 * @property {Array} preferences - `Preference[]`, initialisé vide (édité en 0005).
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * Construit une `Personne` complète et normalisée à partir d'un objet
 * partiel (typiquement les champs saisis dans un formulaire), en appliquant
 * les valeurs par défaut et en générant les champs techniques.
 *
 * Le statut n'est validé que par défaut raisonnable : la fabrique fait
 * confiance à l'appelant (formulaire/Vuelidate) pour ne fournir qu'un code
 * de {@link STATUTS_PERSONNE} valide.
 *
 * @param {Object} [champs] - Champs partiels d'une Personne.
 * @returns {Personne} Personne complète, prête à être stockée.
 */
export function creerPersonne(champs = {}) {
  const maintenant = new Date().toISOString();
  const statut = champs.statut ?? STATUTS_PERSONNE[0];

  return {
    id: champs.id ?? genId(),
    prenom: String(champs.prenom ?? '').trim(),
    nom: String(champs.nom ?? '').trim(),
    statut,
    actif: champs.actif ?? true,
    couleur: champs.couleur ?? COULEURS_PAR_DEFAUT[0],
    quotite: champs.quotite ?? 100,
    joursTravaillesParMois: normaliserRythmeMensuel(champs.joursTravaillesParMois),
    titulaireId: normaliserTitulaireId(statut, champs.titulaireId),
    dateEntree: champs.dateEntree ?? null,
    dateSortie: champs.dateSortie ?? null,
    contact: {
      email: champs.contact?.email ?? null,
      telephone: champs.contact?.telephone ?? null,
    },
    notes: champs.notes ?? '',
    initialesVega: normaliserInitialesVega(champs.initialesVega),
    ordreAffichage: champs.ordreAffichage ?? null,
    preferences: champs.preferences ?? [],
    createdAt: champs.createdAt ?? maintenant,
    updatedAt: maintenant,
  };
}

/**
 * Repère textuel d'une personne, affiché dans sa pastille de couleur (feature 0034, T5) :
 * ses initiales Vega si renseignées, sinon la 1re lettre du prénom, sinon la 1re
 * lettre du nom, sinon `''`. Majuscules françaises, accents conservés.
 *
 * @param {{prenom?: string, nom?: string, initialesVega?: (string|null)}} [personne]
 * @returns {string} 0 à 4 caractères.
 */
export function reperePersonne(personne) {
  const vega = normaliserInitialesVega(personne?.initialesVega);
  if (vega !== null) return vega;
  const lettre = (texte) => String(texte ?? '').trim().charAt(0).toLocaleUpperCase('fr');
  return lettre(personne?.prenom) || lettre(personne?.nom);
}

/**
 * Couleur du texte d'une pastille : claire sur fond foncé, sinon foncée (contraste AA).
 *
 * @param {string} couleur - Fond de la pastille, `#RRGGBB`.
 * @returns {string} Couleur CSS du texte.
 */
export function couleurTexteRepere(couleur) {
  return estCouleurFoncee(couleur) ? '#fff' : '#212529';
}

/**
 * Titulaire remplacée en priorité : conservée seulement pour une remplaçante
 * et si l'id est une chaîne non vide, sinon `null` (0020).
 *
 * @param {string} statut - Statut final de la personne.
 * @param {*} titulaireId - Id saisi (ou `''`/`null`).
 * @returns {(string|null)}
 */
export function normaliserTitulaireId(statut, titulaireId) {
  if (statut !== 'REMPLACANT') return null;
  return typeof titulaireId === 'string' && titulaireId !== '' ? titulaireId : null;
}

/** Comparateur nom puis prénom (français). */
function comparerParNom(a, b) {
  return String(a.nom).localeCompare(String(b.nom), 'fr') || String(a.prenom).localeCompare(String(b.prenom), 'fr');
}

/** « Prénom Nom ». */
function nomComplet(personne) {
  return `${personne.prenom} ${personne.nom}`.trim();
}

/**
 * Options de la liste « Remplace en priorité » : titulaires actives (hors
 * `idExclu`), triées nom puis prénom. Si la titulaire déjà rattachée n'y figure
 * pas (archivée ou plus titulaire), elle est ajoutée à la fin avec une mention.
 *
 * @param {Personne[]} personnes - Toutes les personnes (actives et archivées).
 * @param {Object} [options]
 * @param {(string|null)} [options.idExclu] - Personne en cours d'édition.
 * @param {(string|null)} [options.titulaireIdActuel] - Rattachement actuel.
 * @returns {{id: string, libelle: string}[]}
 */
export function optionsTitulaire(personnes, { idExclu = null, titulaireIdActuel = null } = {}) {
  const liste = Array.isArray(personnes) ? personnes : [];
  const options = liste
    .filter((p) => p.actif !== false && p.statut === 'TITULAIRE' && p.id !== idExclu)
    .sort(comparerParNom)
    .map((p) => ({ id: p.id, libelle: nomComplet(p) }));

  if (titulaireIdActuel && !options.some((o) => o.id === titulaireIdActuel)) {
    const actuelle = liste.find((p) => p.id === titulaireIdActuel);
    if (actuelle) {
      const mention = actuelle.actif === false ? '(personne archivée)' : "(n'est plus titulaire)";
      options.push({ id: actuelle.id, libelle: `${nomComplet(actuelle)} ${mention}` });
    }
  }
  return options;
}

/**
 * Remplaçantes **actives** rattachées à une titulaire, triées nom puis prénom.
 *
 * @param {string} personneId - Id de la titulaire.
 * @param {Personne[]} personnes
 * @returns {Personne[]}
 */
export function remplacantsDe(personneId, personnes) {
  return (Array.isArray(personnes) ? personnes : [])
    .filter((p) => p.actif !== false && p.statut === 'REMPLACANT' && p.titulaireId === personneId)
    .sort(comparerParNom);
}

/**
 * Liste française : « A », « A et B », « A, B et C ».
 *
 * @param {string[]} noms
 * @returns {string}
 */
function listeFrancaise(noms) {
  if (noms.length <= 1) return noms.join('');
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
}

/**
 * Texte de remplacement affiché sur la page Équipe : « Remplace en priorité
 * Claire Martin » (+ « (personne archivée) ») pour une remplaçante rattachée,
 * « Remplacé(e) en priorité par Léa Roux et Marc Petit » pour une titulaire
 * ayant des remplaçantes actives, sinon `''`.
 *
 * @param {Personne} personne
 * @param {Personne[]} personnes - Toutes les personnes (actives et archivées).
 * @returns {string}
 */
export function libelleRemplacement(personne, personnes) {
  const liste = Array.isArray(personnes) ? personnes : [];
  if (personne.statut === 'REMPLACANT' && personne.titulaireId) {
    const titulaire = liste.find((p) => p.id === personne.titulaireId);
    if (!titulaire) return '';
    const mention = titulaire.actif === false ? ' (personne archivée)' : '';
    return `Remplace en priorité ${nomComplet(titulaire)}${mention}`;
  }
  if (personne.statut === 'TITULAIRE') {
    const remplacantes = remplacantsDe(personne.id, liste);
    if (remplacantes.length > 0) {
      return `Remplacé(e) en priorité par ${listeFrancaise(remplacantes.map(nomComplet))}`;
    }
  }
  return '';
}

/**
 * Texte du rythme : « 15 jours par mois », ou `''` sans rythme.
 *
 * @param {Personne} personne
 * @returns {string}
 */
export function libelleRythme(personne) {
  const rythme = normaliserRythmeMensuel(personne?.joursTravaillesParMois);
  return rythme === null ? '' : `${rythme} jours par mois`;
}
