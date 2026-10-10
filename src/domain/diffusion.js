/**
 * Modèle du « planning papier » (feature 0012 — diffusion / impression / PDF).
 *
 * Fonctions pures qui transforment un `Planning` + les collections complètes
 * de personnes et de tournées en un modèle prêt à afficher (mois côte à côte,
 * colonnes de tournées, repères de personnes, pagination). Les composants ne
 * font que le rendre.
 *
 * Module pur : aucun import Vue/Vuex, aucun import de `@/domain/scheduling`
 * (ADR 0008) ; dates uniquement via `dateUtil` (ADR 0010).
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { estCouleurFoncee } from '@/domain/utils/couleurs.js';
import { libelleJourCourt, libelleMois } from '@/domain/libelles.js';
import { estCoupee, libelleSegment, libelleHoraires, tourneeApplicableLe } from '@/domain/tournees.js';
import { dateMiseAJour } from '@/domain/planning.js';
import { normaliserInitialesVega } from '@/domain/initialesVega.js';

/** Nombre de « colonnes utiles » (jour + segments de tournées) tenant sur la largeur d'une page A4 portrait. */
export const BUDGET_COLONNES_PAGE = 15;
/** Plafond de mois par page, pour la lisibilité. */
export const MOIS_PAR_PAGE_MAX = 4;

/**
 * @typedef {Object} RepereJour - Repère calendaire d'un jour (affichage seul).
 * @property {string} code - `'DIMANCHE'` (0012). Réservés à 0023 : `'FERIE'`, `'VACANCES_SCOLAIRES'`.
 * @property {string} libelle - Libellé FR pour la légende (ex. « Dimanche »).
 * @property {string} court - Marqueur court affiché près du jour ('' si aucun ; ex. 0023 : « F »).
 */

/**
 * @typedef {Object} SegmentColonne
 * @property {number} index - Indice du segment dans `tournee.segments`.
 * @property {string} libelleVacation - 'Matin' / 'Soir' (tournée coupée) ou '' (tournée complète).
 * @property {string} horaires - `libelleSegment(segment)`.
 */

/**
 * @typedef {Object} ColonneTournee
 * @property {string} tourneeId
 * @property {string} libelle - Libellé réel de la tournée (+ « (archivée) » le cas échéant). Pas de code T1…Tn calculé : l'en-tête affiche ce libellé (coupé par ellipsis côté CSS si trop long), la légende le donne en entier.
 * @property {string} couleur
 * @property {boolean} coupee
 * @property {string} horaires - `libelleHoraires(tournee)`.
 * @property {SegmentColonne[]} segments - 1 ou 2.
 */

/**
 * @typedef {Object} PersonneDiffusion
 * @property {string} personneId
 * @property {string} repere - Initiales Vega si renseignées, sinon initiale(s) unique(s) dans ce tirage (« M », « MD »…), '?' si inconnue.
 * @property {string} nomComplet - « Prénom Nom » (+ « (archivée) »), « Personne inconnue » si introuvable.
 * @property {string} couleur - Hex, ou '' si inconnue.
 * @property {boolean} fonce - `estCouleurFoncee(couleur)`.
 */

/**
 * @typedef {Object} CaseDiffusion - Une case = (jour, tournée, segment).
 * @property {string} tourneeId
 * @property {number} segmentIndex
 * @property {boolean} applicable - Tournée existante ce jour (`tourneeApplicableLe`).
 * @property {PersonneDiffusion[]} personnes - Personnes affectées (triées par repère).
 */

/**
 * @typedef {Object} JourDiffusion
 * @property {string} date
 * @property {number} numero - 1..31.
 * @property {string} jourCourt - `libelleJourCourt(weekdayISO(date))`.
 * @property {boolean} ferme - Jour hors `joursOuverture`.
 * @property {boolean} ligneFermee - `ferme` ET aucune personne dans aucune case → rendu « Fermé » sur toute la ligne.
 * @property {RepereJour[]} reperes
 * @property {CaseDiffusion[]} cases - Dans l'ordre des colonnes (segments aplatis).
 */

/**
 * @typedef {Object} MoisDiffusion
 * @property {string} cle - 'YYYY-MM'.
 * @property {string} libelle - 'Juillet 2026'.
 * @property {JourDiffusion[]} jours - Uniquement les jours de la période du planning.
 */

/**
 * @typedef {Object} Diffusion
 * @property {string} titre - 'Idelia'.
 * @property {string} sousTitre - 'Planning du JJ/MM/AAAA au JJ/MM/AAAA'.
 * @property {(string|null)} miseAJourIso
 * @property {string} miseAJourTexte - « JJ/MM/AAAA à HH:mm » (date et heure locales), '' si aucune date.
 * @property {ColonneTournee[]} colonnes
 * @property {MoisDiffusion[][]} pages - Mois regroupés par page imprimée.
 * @property {PersonneDiffusion[]} legendePersonnes - Personnes présentes, triées par nom complet (fr).
 * @property {RepereJour[]} legendeReperes - Repères effectivement présents (dédupliqués par code).
 * @property {boolean} vide - Aucune affectation dans le planning.
 */

/**
 * Repères calendaires d'un jour — **point d'extension de la feature 0023**.
 * En 0012 : uniquement le dimanche. Le paramètre `sources` est **réservé**
 * (non lu ici) : 0023 y passera ses données (fériés, vacances scolaires) et
 * ajoutera ses codes (`'FERIE'`, `'VACANCES_SCOLAIRES'`) sans changer la
 * signature ni les composants (rendu générique par code).
 *
 * @param {string} date - `"YYYY-MM-DD"`
 * @param {Object} [sources] - Réservé à 0023.
 * @returns {RepereJour[]}
 */
// eslint-disable-next-line no-unused-vars
export function reperesDuJour(date, sources = {}) {
  return dateUtil.weekdayISO(date) === 7 ? [{ code: 'DIMANCHE', libelle: 'Dimanche', court: '' }] : [];
}

/**
 * Première lettre en majuscule d'un texte (accents conservés), '' si vide.
 * @param {string} texte
 * @returns {string}
 */
function initiale(texte) {
  const t = String(texte ?? '').trim();
  return t ? t.charAt(0).toLocaleUpperCase('fr') : '';
}

/**
 * Calcule des repères **uniques au sein du tirage**, déterministes
 * (indépendants de l'ordre d'entrée).
 *
 * - Une personne avec `initialesVega` (normalisées) garde **exactement** ce code.
 * - Les autres : initiale du prénom ; en cas de collision (ou si le code est
 *   déjà réservé par une initiale Vega), initiale prénom + initiale nom ; si
 *   le problème persiste, suffixe numérique dans l'ordre stable (« MD1 », « MD2 »),
 *   en sautant les codes déjà pris.
 *
 * @param {Array<{ id: string, prenom: string, nom: string, initialesVega?: (string|null) }>} personnes
 * @returns {Map<string, string>} personneId → repère
 */
export function calculerReperesPersonnes(personnes) {
  const triees = [...personnes].sort(
    (a, b) =>
      String(a.nom ?? '').localeCompare(String(b.nom ?? ''), 'fr') ||
      String(a.prenom ?? '').localeCompare(String(b.prenom ?? ''), 'fr') ||
      String(a.id).localeCompare(String(b.id)),
  );

  const reperes = new Map();
  /** Codes déjà attribués ou réservés (initiales Vega). */
  const pris = new Set();
  const sansVega = [];
  for (const p of triees) {
    const vega = normaliserInitialesVega(p.initialesVega);
    if (vega && !pris.has(vega)) {
      reperes.set(p.id, vega);
      pris.add(vega);
    } else {
      sansVega.push(p);
    }
  }

  const niveau1 = (p) => initiale(p.prenom) || initiale(p.nom) || '?';
  const niveau2 = (p) => `${initiale(p.prenom)}${initiale(p.nom)}` || '?';

  const parInitiale = new Map();
  for (const p of sansVega) {
    const cle = niveau1(p);
    if (!parInitiale.has(cle)) parInitiale.set(cle, []);
    parInitiale.get(cle).push(p);
  }

  const attribuer = (id, code) => {
    reperes.set(id, code);
    pris.add(code);
  };

  for (const [cle, groupe] of parInitiale) {
    if (groupe.length === 1 && !pris.has(cle)) {
      attribuer(groupe[0].id, cle);
      continue;
    }
    const parDouble = new Map();
    for (const p of groupe) {
      const c2 = niveau2(p);
      if (!parDouble.has(c2)) parDouble.set(c2, []);
      parDouble.get(c2).push(p);
    }
    for (const [c2, sousGroupe] of parDouble) {
      if (sousGroupe.length === 1 && !pris.has(c2)) {
        attribuer(sousGroupe[0].id, c2);
        continue;
      }
      let n = 1;
      for (const p of sousGroupe) {
        while (pris.has(`${c2}${n}`)) n++;
        attribuer(p.id, `${c2}${n}`);
      }
    }
  }
  return reperes;
}

/**
 * Nombre de mois côte à côte par page, selon la largeur consommée par les
 * colonnes de tournées (1 colonne « Jour » + un segment = une colonne).
 *
 * @param {ColonneTournee[]} colonnes
 * @returns {number} Entre 1 et `MOIS_PAR_PAGE_MAX`.
 */
export function moisParPage(colonnes) {
  const nbSegments = colonnes.reduce((total, c) => total + c.segments.length, 0);
  return Math.max(1, Math.min(MOIS_PAR_PAGE_MAX, Math.floor(BUDGET_COLONNES_PAGE / (1 + nbSegments))));
}

/**
 * Construit la colonne d'affichage d'une tournée.
 * @param {import('./tournees.js').Tournee} tournee
 * @param {boolean} archivee
 * @returns {ColonneTournee}
 */
function creerColonne(tournee, archivee) {
  const coupee = estCoupee(tournee);
  return {
    tourneeId: tournee.id,
    libelle: archivee ? `${tournee.libelle} (archivée)` : tournee.libelle,
    couleur: tournee.couleur,
    coupee,
    horaires: libelleHoraires(tournee),
    segments: tournee.segments.map((segment, index) => ({
      index,
      libelleVacation: coupee ? (index === 0 ? 'Matin' : 'Soir') : '',
      horaires: libelleSegment(segment),
    })),
  };
}

/**
 * Construit le modèle complet du planning papier.
 *
 * @param {Object} params
 * @param {import('./planning.js').Planning} params.planning
 * @param {Array<Object>} params.personnes - Collection **complète** (archivées comprises).
 * @param {Array<import('./tournees.js').Tournee>} params.tournees - Collection **complète** (archivées comprises).
 * @param {number[]} params.joursOuverture - Jours ISO d'ouverture du cabinet.
 * @param {Object} [params.sourcesReperes] - Réservé à 0023, transmis à {@link reperesDuJour}.
 * @returns {Diffusion}
 */
export function construireDiffusion({ planning, personnes, tournees, joursOuverture, sourcesReperes = {} }) {
  const affectations = planning.affectations ?? [];
  const dates = dateUtil.rangeInclusive(planning.dateDebut, planning.dateFin);
  const tourneeParId = new Map(tournees.map((t) => [t.id, t]));
  const personneParId = new Map(personnes.map((p) => [p.id, p]));

  // 1. Colonnes : actives applicables au moins un jour de la période ∪ référencées.
  const idsReferences = new Set(affectations.map((a) => a.tourneeId));
  const tourneesRetenues = tournees.filter(
    (t) => idsReferences.has(t.id) || (!t.archivee && dates.some((d) => tourneeApplicableLe(t, d))),
  );
  const colonnes = tourneesRetenues
    .map((t) => creerColonne(t, !!t.archivee))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  const colonneParId = new Map(colonnes.map((c) => [c.tourneeId, c]));

  // 2. Personnes présentes dans les affectations.
  const idsPersonnes = [...new Set(affectations.map((a) => a.personneId))];
  const connues = idsPersonnes.map((id) => personneParId.get(id)).filter(Boolean);
  const reperes = calculerReperesPersonnes(connues);
  /** @type {Map<string, PersonneDiffusion>} */
  const diffusionPersonnes = new Map();
  for (const id of idsPersonnes) {
    const p = personneParId.get(id);
    if (!p) {
      diffusionPersonnes.set(id, {
        personneId: id,
        repere: '?',
        nomComplet: 'Personne inconnue',
        couleur: '',
        fonce: false,
      });
      continue;
    }
    const nom = `${p.prenom} ${p.nom}`.trim();
    diffusionPersonnes.set(id, {
      personneId: id,
      repere: reperes.get(id) ?? '?',
      nomComplet: p.actif === false ? `${nom} (archivée)` : nom,
      couleur: p.couleur ?? '',
      fonce: estCouleurFoncee(p.couleur),
    });
  }

  // Index des affectations : "date|tourneeId|segmentIndex" → PersonneDiffusion[]
  const parCase = new Map();
  for (const a of affectations) {
    const colonne = colonneParId.get(a.tourneeId);
    const personne = diffusionPersonnes.get(a.personneId);
    if (!colonne || !personne) continue; // tournée introuvable : ignorée
    const dernier = colonne.segments.length - 1;
    const segmentIndex = a.segmentIndex >= 0 && a.segmentIndex <= dernier ? a.segmentIndex : dernier;
    const cle = `${a.date}|${a.tourneeId}|${segmentIndex}`;
    if (!parCase.has(cle)) parCase.set(cle, []);
    const liste = parCase.get(cle);
    if (!liste.includes(personne)) liste.push(personne);
  }

  // 3. Jours, regroupés par mois (clé 'YYYY-MM', aucune manipulation de Date).
  const mois = [];
  const moisParCle = new Map();
  const reperesVus = new Map();
  for (const date of dates) {
    const cases = [];
    let aDesPersonnes = false;
    for (const colonne of colonnes) {
      const tournee = tourneeParId.get(colonne.tourneeId);
      const applicable = tourneeApplicableLe(tournee, date);
      for (const segment of colonne.segments) {
        const personnesCase = [...(parCase.get(`${date}|${colonne.tourneeId}|${segment.index}`) ?? [])].sort(
          (a, b) => a.repere.localeCompare(b.repere, 'fr'),
        );
        if (personnesCase.length > 0) aDesPersonnes = true;
        cases.push({ tourneeId: colonne.tourneeId, segmentIndex: segment.index, applicable, personnes: personnesCase });
      }
    }
    const iso = dateUtil.weekdayISO(date);
    const ferme = !joursOuverture.includes(iso);
    const reperesJour = reperesDuJour(date, sourcesReperes);
    for (const r of reperesJour) if (!reperesVus.has(r.code)) reperesVus.set(r.code, r);

    const cle = date.slice(0, 7);
    if (!moisParCle.has(cle)) {
      const m = { cle, libelle: `${libelleMois(Number(cle.slice(5, 7)))} ${cle.slice(0, 4)}`, jours: [] };
      moisParCle.set(cle, m);
      mois.push(m);
    }
    moisParCle.get(cle).jours.push({
      date,
      numero: Number(date.slice(8, 10)),
      jourCourt: libelleJourCourt(iso),
      ferme,
      ligneFermee: ferme && !aDesPersonnes,
      reperes: reperesJour,
      cases,
    });
  }

  // 6. Pages.
  const parPage = moisParPage(colonnes);
  const pages = [];
  for (let i = 0; i < mois.length; i += parPage) pages.push(mois.slice(i, i + parPage));

  const maj = dateMiseAJour(planning);

  return {
    titre: 'Idelia',
    sousTitre: `Planning du ${dateUtil.formatDateFr(planning.dateDebut)} au ${dateUtil.formatDateFr(planning.dateFin)}`,
    miseAJourIso: maj ? maj.iso : null,
    miseAJourTexte: maj ? maj.texte : '',
    colonnes,
    pages,
    legendePersonnes: [...diffusionPersonnes.values()].sort((a, b) => a.nomComplet.localeCompare(b.nomComplet, 'fr')),
    legendeReperes: [...reperesVus.values()],
    vide: affectations.length === 0,
  };
}

/**
 * Titre du document imprimé, servant de nom de fichier PDF proposé par le
 * navigateur (tirets plutôt que `/`, interdits dans un nom de fichier).
 *
 * @param {import('./planning.js').Planning} planning
 * @returns {string} Ex. `'Idelia - Planning du 13-07-2026 au 30-08-2026'`.
 */
export function titreDocumentDiffusion(planning) {
  const debut = dateUtil.formatDateFr(planning.dateDebut).replaceAll('/', '-');
  const fin = dateUtil.formatDateFr(planning.dateFin).replaceAll('/', '-');
  return `Idelia - Planning du ${debut} au ${fin}`;
}
