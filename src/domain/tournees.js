/**
 * Fabrique & normalisation d'une Tournee (feature 0016, ADR 0017 — modèle à
 * segments horaires : une tournée porte 1 ou 2 segments ; le type
 * complète/coupée est **dérivé** de `segments.length`, jamais stocké).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Seules concessions techniques tolérées (comme dans `schema.js`/`personnes.js`) :
 * `genId()` pour l'identifiant et `new Date().toISOString()` pour les
 * horodatages.
 */

import { COULEURS_PAR_DEFAUT } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';

/**
 * @typedef {Object} Segment
 * @property {string} heureDebut - Heure de début `"HH:mm"`.
 * @property {string} heureFin - Heure de fin `"HH:mm"`, > `heureDebut` (cohérence portée par le formulaire, pas par cette fabrique).
 * @property {number} nbPersonnesRequises - Effectif requis pour ce segment, entier ≥ 1 (défaut `1`).
 */

/**
 * @typedef {Object} Tournee
 * @property {string} id - Identifiant unique, immuable.
 * @property {string} libelle - Nom libre de la tournée, choisi par le gestionnaire (remplace l'ancien `nom`).
 * @property {Segment[]} segments - 1 ou 2 segments horaires. **1 segment = tournée complète ; 2 segments = tournée coupée** (type dérivé, voir {@link estCoupee}).
 * @property {number[]} joursApplication - Jours ISO 1..7 où la tournée s'applique, triés et dédupliqués.
 * @property {string} couleur - Couleur de repère au format hex `#RRGGBB`.
 * @property {boolean} archivee - Soft-delete : `true` = archivée (conservé, ADR 0005/0006).
 * @property {(string|null)} dateDebutValidite - Date `"YYYY-MM-DD"`, ou `null`.
 * @property {(string|null)} dateFinValidite - Date `"YYYY-MM-DD"`, ou `null`.
 * @property {(number|null)} ordreAffichage - Réordonnancement manuel (non édité en 0006).
 * @property {string} notes
 * @property {string} createdAt - Horodatage ISO UTC.
 * @property {string} updatedAt - Horodatage ISO UTC.
 */

/**
 * Coerce une valeur en liste de jours ISO 8601 valides (1..7), triée et
 * dédupliquée. Tolère les valeurs manquantes/invalides (ignorées). Même
 * logique que le helper homonyme de `preferences.js`.
 *
 * @param {*} valeur - Valeur brute (idéalement un `number[]`).
 * @returns {number[]} Jours ISO triés et dédupliqués.
 */
function normaliserJours(valeur) {
  const bruts = Array.isArray(valeur) ? valeur : [];
  const valides = bruts.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 1 && v <= 7);
  return [...new Set(valides)].sort((a, b) => a - b);
}

/**
 * Normalise un segment brut (typiquement saisi dans le formulaire) en
 * `Segment` complet : `nbPersonnesRequises` est coercé en entier ≥ 1 (défaut
 * `1` si absent/invalide), les horaires sont conservés tels quels (chaînes
 * vides si absents). Ne valide pas la cohérence horaire (portée par le
 * formulaire, Vuelidate).
 *
 * @param {*} segment - Segment brut (idéalement `{ heureDebut, heureFin, nbPersonnesRequises }`).
 * @returns {Segment} Segment normalisé.
 */
function normaliserSegment(segment) {
  const brut = segment && typeof segment === 'object' ? segment : {};
  const nbBrut = Number(brut.nbPersonnesRequises);
  const nbPersonnesRequises = Number.isInteger(nbBrut) && nbBrut >= 1 ? nbBrut : 1;

  return {
    heureDebut: typeof brut.heureDebut === 'string' ? brut.heureDebut : '',
    heureFin: typeof brut.heureFin === 'string' ? brut.heureFin : '',
    nbPersonnesRequises,
  };
}

/**
 * Coerce une valeur en liste de 1 ou 2 `Segment`s (ADR 0017) : si `valeur`
 * est absente ou vide, renvoie un unique segment par défaut (tournée
 * complète, horaires vides, effectif `1`) ; sinon normalise chaque segment
 * et **écrête à 2** (un éventuel 3ᵉ segment et au-delà sont ignorés). Ne
 * valide pas la cohérence horaire entre segments (portée par le formulaire).
 *
 * @param {*} valeur - Valeur brute (idéalement un tableau de segments partiels).
 * @returns {Segment[]} 1 ou 2 segments normalisés.
 */
function normaliserSegments(valeur) {
  const bruts = Array.isArray(valeur) ? valeur : [];
  if (bruts.length === 0) {
    return [{ heureDebut: '', heureFin: '', nbPersonnesRequises: 1 }];
  }
  return bruts.slice(0, 2).map(normaliserSegment);
}

/**
 * Construit une `Tournee` complète et normalisée à partir d'un objet
 * partiel (typiquement les champs saisis dans un formulaire), en appliquant
 * les valeurs par défaut et en générant les champs techniques.
 *
 * La cohérence horaire des segments (`heureFin > heureDebut`, reprise ≥ fin
 * du matin) et `dateFinValidite ≥ dateDebutValidite` sont portées par le
 * formulaire (Vuelidate), pas par cette fabrique : elle ne garantit que la
 * normalisation structurelle.
 *
 * @param {Object} [champs] - Champs partiels d'une Tournee.
 * @returns {Tournee} Tournee complète, prête à être stockée.
 */
export function creerTournee(champs = {}) {
  const maintenant = new Date().toISOString();

  return {
    id: champs.id ?? genId(),
    libelle: String(champs.libelle ?? '').trim(),
    segments: normaliserSegments(champs.segments),
    joursApplication: normaliserJours(champs.joursApplication),
    couleur: champs.couleur ?? COULEURS_PAR_DEFAUT[0],
    archivee: champs.archivee ?? false,
    dateDebutValidite: champs.dateDebutValidite ?? null,
    dateFinValidite: champs.dateFinValidite ?? null,
    ordreAffichage: champs.ordreAffichage ?? null,
    notes: champs.notes ?? '',
    createdAt: champs.createdAt ?? maintenant,
    updatedAt: maintenant,
  };
}

/**
 * Indique si une tournée est « coupée » (2 segments) plutôt que « complète »
 * (1 segment). Le type n'est **jamais** stocké : il est toujours dérivé de
 * `tournee.segments.length` (ADR 0017).
 *
 * @param {Tournee} tournee
 * @returns {boolean} `true` si la tournée porte 2 segments.
 */
export function estCoupee(tournee) {
  return tournee.segments.length === 2;
}

/**
 * Libellé humain du type de tournée, dérivé de {@link estCoupee}. Toujours
 * doublé d'un texte à l'écran (jamais la seule couleur/icône, accessibilité).
 *
 * @param {Tournee} tournee
 * @returns {string} `'Tournée coupée'` ou `'Tournée complète'`.
 */
export function libelleType(tournee) {
  return estCoupee(tournee) ? 'Tournée coupée' : 'Tournée complète';
}

/**
 * Formate les horaires d'un segment en clair, ex. `"07:00 – 13:30"`.
 *
 * @param {Segment} segment
 * @returns {string} Horaires formatés du segment.
 */
export function libelleSegment(segment) {
  return `${segment.heureDebut} – ${segment.heureFin}`;
}

/**
 * Formate les horaires complets d'une tournée : un unique segment pour une
 * tournée complète (ex. `"07:00 – 13:30"`), ou les deux segments reliés par
 * « puis » pour une tournée coupée (ex.
 * `"07:00 – 13:30 puis 17:00 – 20:00"`). Réutilisable partout où une tournée
 * doit s'afficher en clair (liste des tournées, souhaits, planning).
 *
 * @param {Tournee} tournee
 * @returns {string} Horaires formatés de la tournée.
 */
export function libelleHoraires(tournee) {
  return tournee.segments.map(libelleSegment).join(' puis ');
}

/**
 * Effectif total requis par la tournée, tous segments confondus (somme des
 * `nbPersonnesRequises`). Utile pour un résumé « N personnes / jour ».
 *
 * @param {Tournee} tournee
 * @returns {number} Effectif total requis.
 */
export function effectifTotal(tournee) {
  return tournee.segments.reduce((total, segment) => total + segment.nbPersonnesRequises, 0);
}
