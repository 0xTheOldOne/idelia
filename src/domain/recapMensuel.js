/**
 * Récapitulatif mensuel des affectations (feature 0024).
 *
 * Module pur (ADR 0008) : aucun import Vue/Vuex, aucun accès stockage, rien du
 * moteur de planification. Calcul dérivé, jamais persisté. Dates en chaînes
 * `"YYYY-MM-DD"`, jours ISO 1-7 (ADR 0010), toujours via `dateUtil`.
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { estCoupee } from '@/domain/tournees.js';
import {
  normaliserRythmeMensuel,
  estRythmeMensuelValide,
  joursAttendusSurPeriode,
} from '@/domain/rythmeMensuel.js';
import { reperePersonne, couleurTexteRepere, libelleRythme } from '@/domain/personnes.js';
import { libelleMois, libelleStatutPersonne } from '@/domain/libelles.js';

/**
 * @typedef {'SANS_RYTHME'|'DANS_LE_RYTHME'|'DEPASSE'} EtatRythme
 *
 * @typedef {Object} LigneRecap
 * @property {string} personneId
 * @property {string} nomComplet        // « Prénom Nom » (+ « (archivée) »), « Personne inconnue » si introuvable
 * @property {string} statutTexte       // libelleStatutPersonne(statut), '' si inconnue
 * @property {string} repere            // reperePersonne(personne), '?' si inconnue
 * @property {string} couleur           // hex, '' si inconnue
 * @property {string} couleurTexte      // couleurTexteRepere(couleur)
 * @property {number} grandes           // tournées coupées faites matin ET soir
 * @property {number} petites           // tournées d'un segment + moitiés de tournée coupée
 * @property {number} moitiesDeGrande   // part de `petites` = un seul segment d'une tournée coupée
 * @property {number} joursTravailles   // dates distinctes
 * @property {(number|null)} rythme     // joursTravaillesParMois valide, sinon null
 * @property {(number|null)} seuil      // nb de jours au-delà duquel on signale ; null si pas de rythme
 * @property {(number|null)} attenduPartie // mois incomplet : jours attendus (arrondis) sur la partie couverte ; null sinon
 * @property {number} depassement       // max(0, joursTravailles − seuil) ; 0 sans rythme
 * @property {EtatRythme} etat
 * @property {string} texteRythme       // « 20 jours par mois (15 prévus sur ce mois) », « 3 jours par mois (environ 1 prévu sur ces jours) », « Pas de rythme fixé »
 * @property {string} texteEtat         // « Dépasse son rythme de 1 jour » / « … de 2 jours », « Dans son rythme », '' si SANS_RYTHME
 *
 * @typedef {Object} MoisRecap
 * @property {string} cle               // 'YYYY-MM'
 * @property {string} libelle           // 'Octobre 2026'
 * @property {string} debut             // borne couverte = max(1er du mois, planning.dateDebut)
 * @property {string} fin               // borne couverte = min(fin du mois, planning.dateFin)
 * @property {boolean} complet          // tous les jours OUVERTS du mois sont dans le planning
 * @property {string} texteCouverture   // 'mois complet' | 'du 1er au 8 novembre (mois incomplet)'
 * @property {LigneRecap[]} lignes
 * @property {number} nbDepassements    // nb de lignes à l'état DEPASSE
 * @property {string} texteResume       // 'Tout le monde est dans son rythme' | '1 personne dépasse son rythme' | '2 personnes dépassent leur rythme'
 */

const ORDRE_STATUT = { TITULAIRE: 0, REMPLACANT: 1 };

/** Plafond de mois traités : borne le coût d'un planning aux dates aberrantes. */
const MAX_MOIS = 36;

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {*} d
 * @returns {boolean} `true` si `d` est une date `"YYYY-MM-DD"` existante au calendrier.
 */
function estDateValide(d) {
  return typeof d === 'string' && FORMAT_DATE.test(d) && dateUtil.format(dateUtil.parse(d)) === d;
}

/** @param {*} x */
function estObjet(x) {
  return x !== null && typeof x === 'object';
}

/** Jour sans zéro initial, « 1er » pour le premier du mois. */
function jourLisible(date) {
  const jour = Number(date.slice(8, 10));
  return jour === 1 ? '1er' : String(jour);
}

/** « Novembre 2026 » -> « novembre » (mois en toutes lettres, minuscules). */
function moisLisible(date) {
  return libelleMois(Number(date.slice(5, 7))).toLowerCase();
}

/**
 * Couverture d'un mois incomplet : « du 1er au 8 novembre (mois incomplet) ».
 * Les bornes sont dans le même mois (le récap est découpé par mois) ; si ce
 * n'était pas le cas, le mois de la 1re borne est précisé.
 */
function texteCouvertureIncomplete(debut, fin) {
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7);
  const debutTexte = memeMois ? jourLisible(debut) : `${jourLisible(debut)} ${moisLisible(debut)}`;
  return `du ${debutTexte} au ${jourLisible(fin)} ${moisLisible(fin)} (mois incomplet)`;
}

/**
 * Classe un groupe d'affectations (même personne, même date, même tournée).
 * Seule fonction à changer si la notion de « grande tournée » évolue.
 *
 * @param {(Object|undefined)} tournee - Tournée résolue (ou `undefined`).
 * @param {Set<number>} indices - Indices de segments faits.
 * @returns {'GRANDE'|'MOITIE'|'PETITE'}
 */
function classerGroupe(tournee, indices) {
  // `segments` non tableau : donnée corrompue, traitée comme petite tournée.
  if (!tournee || !Array.isArray(tournee.segments) || !estCoupee(tournee)) return 'PETITE';
  const complet = tournee.segments.every((_, i) => indices.has(i));
  return complet ? 'GRANDE' : 'MOITIE';
}

/** @param {number} n */
function pluriel(n, singulier, plurielTexte) {
  return n > 1 ? plurielTexte : singulier;
}

/**
 * Construit le récap d'un mois (lignes triées, textes prêts à afficher).
 */
function construireMois(planning, moisDebut, ctx) {
  const { personnes, tournees, absences, joursOuverture, ouverts } = ctx;
  const finDuMois = dateUtil.finMois(moisDebut);
  const debut = moisDebut > planning.dateDebut ? moisDebut : planning.dateDebut;
  const fin = finDuMois < planning.dateFin ? finDuMois : planning.dateFin;

  const joursOuvertsMois = dateUtil
    .rangeInclusive(moisDebut, finDuMois)
    .filter((d) => ouverts.has(dateUtil.weekdayISO(d)));
  const complet =
    joursOuvertsMois.length > 0 &&
    joursOuvertsMois.every((d) => d >= planning.dateDebut && d <= planning.dateFin);

  // Comptage : personneId -> { groupes: Map(date|tourneeId -> Set), dates: Set }
  const parPersonne = new Map();
  const affectations = Array.isArray(planning.affectations) ? planning.affectations : [];
  for (const a of affectations) {
    if (!estObjet(a) || !estDateValide(a.date) || a.date < debut || a.date > fin) continue;
    let p = parPersonne.get(a.personneId);
    if (!p) {
      p = { groupes: new Map(), dates: new Set() };
      parPersonne.set(a.personneId, p);
    }
    p.dates.add(a.date);
    const cleGroupe = `${a.date}|${a.tourneeId}`;
    let indices = p.groupes.get(cleGroupe);
    if (!indices) {
      indices = { tourneeId: a.tourneeId, set: new Set() };
      p.groupes.set(cleGroupe, indices);
    }
    indices.set.add(a.segmentIndex);
  }

  const personnesParId = new Map(personnes.map((p) => [p.id, p]));
  const tourneesParId = new Map(tournees.map((t) => [t.id, t]));

  const idsLignes = new Set(personnes.filter((p) => p.actif !== false).map((p) => p.id));
  for (const id of parPersonne.keys()) idsLignes.add(id);

  const lignes = [...idsLignes].map((id) => {
    const personne = personnesParId.get(id);
    const donnees = parPersonne.get(id);
    let grandes = 0;
    let petites = 0;
    let moitiesDeGrande = 0;
    if (donnees) {
      for (const g of donnees.groupes.values()) {
        const classe = classerGroupe(tourneesParId.get(g.tourneeId), g.set);
        if (classe === 'GRANDE') grandes += 1;
        else {
          petites += 1;
          if (classe === 'MOITIE') moitiesDeGrande += 1;
        }
      }
    }
    const joursTravailles = donnees ? donnees.dates.size : 0;

    let rythme = personne ? normaliserRythmeMensuel(personne.joursTravaillesParMois) : null;
    if (rythme !== null && !estRythmeMensuelValide(rythme)) rythme = null;

    let seuil = null;
    let attenduPartie = null;
    let depassement = 0;
    let etat = 'SANS_RYTHME';
    let texteRythme = 'Pas de rythme fixé';
    let texteEtat = '';

    if (rythme !== null) {
      const contexte = { joursOuverture, absences };
      if (complet) {
        seuil = joursAttendusSurPeriode(personne, { debut: moisDebut, fin: finDuMois }, contexte).attenduArrondi;
        texteRythme = `${libelleRythme(personne)} (${seuil} ${pluriel(seuil, 'prévu', 'prévus')} sur ce mois)`;
      } else {
        seuil = rythme;
        attenduPartie = joursAttendusSurPeriode(personne, { debut, fin }, contexte).attenduArrondi;
        texteRythme = `${libelleRythme(personne)} (environ ${attenduPartie} ${pluriel(attenduPartie, 'prévu', 'prévus')} sur ces jours)`;
      }
      depassement = Math.max(0, joursTravailles - seuil);
      etat = depassement > 0 ? 'DEPASSE' : 'DANS_LE_RYTHME';
      texteEtat =
        depassement > 0
          ? `Dépasse son rythme de ${depassement} ${pluriel(depassement, 'jour', 'jours')}`
          : 'Dans son rythme';
    }

    const couleur = personne?.couleur ?? '';
    const nom = personne ? `${personne.prenom ?? ''} ${personne.nom ?? ''}`.trim() : '';
    let nomComplet = personne ? nom : 'Personne inconnue';
    if (personne && personne.actif === false) nomComplet += ' (archivée)';

    return {
      personneId: id,
      nomComplet,
      statutTexte: personne ? libelleStatutPersonne(personne.statut) : '',
      repere: personne ? reperePersonne(personne) || '?' : '?',
      couleur,
      couleurTexte: couleurTexteRepere(couleur),
      grandes,
      petites,
      moitiesDeGrande,
      joursTravailles,
      rythme,
      seuil,
      attenduPartie,
      depassement,
      etat,
      texteRythme,
      texteEtat,
    };
  });

  const rang = (id) => ORDRE_STATUT[personnesParId.get(id)?.statut] ?? 2;
  lignes.sort((a, b) => {
    const pa = personnesParId.get(a.personneId);
    const pb = personnesParId.get(b.personneId);
    return (
      rang(a.personneId) - rang(b.personneId) ||
      String(pa?.nom ?? '').localeCompare(String(pb?.nom ?? ''), 'fr') ||
      String(pa?.prenom ?? '').localeCompare(String(pb?.prenom ?? ''), 'fr') ||
      String(a.personneId).localeCompare(String(b.personneId))
    );
  });

  const nbDepassements = lignes.filter((l) => l.etat === 'DEPASSE').length;
  let texteResume = 'Tout le monde est dans son rythme';
  if (nbDepassements === 1) texteResume = '1 personne dépasse son rythme';
  else if (nbDepassements > 1) texteResume = `${nbDepassements} personnes dépassent leur rythme`;

  return {
    cle: moisDebut.slice(0, 7),
    libelle: `${libelleMois(Number(moisDebut.slice(5, 7)))} ${moisDebut.slice(0, 4)}`,
    debut,
    fin,
    complet,
    texteCouverture: complet
      ? 'mois complet'
      : texteCouvertureIncomplete(debut, fin),
    lignes,
    nbDepassements,
    texteResume,
  };
}

/**
 * Récap par mois civil et par personne : grandes / petites tournées, jours
 * travaillés, dépassement du rythme mensuel. Ne lève pas sur des données
 * mal formées : dates invalides -> `[]`, éléments non objets ignorés, tournée
 * sans `segments` = petite tournée, affectation sans date valide ignorée.
 * Au plus 36 mois sont traités.
 *
 * @param {(Object|null|undefined)} planning - `{ dateDebut, dateFin, affectations[] }`.
 * @param {Object} [contexte]
 * @param {Object[]} [contexte.personnes] - Actives et archivées.
 * @param {Object[]} [contexte.tournees] - Actives et archivées.
 * @param {Object[]} [contexte.absences]
 * @param {number[]} [contexte.joursOuverture] - Jours ISO 1-7.
 * @returns {MoisRecap[]} Un élément par mois civil touché, ordre chronologique.
 */
export function construireRecapMensuel(planning, { personnes, tournees, absences, joursOuverture } = {}) {
  if (!estObjet(planning)) return [];
  if (!estDateValide(planning.dateDebut) || !estDateValide(planning.dateFin)) return [];
  if (planning.dateDebut > planning.dateFin) return [];
  const objets = (l) => (Array.isArray(l) ? l.filter(estObjet) : []);
  const ctx = {
    personnes: objets(personnes),
    tournees: objets(tournees),
    absences: objets(absences),
    joursOuverture: Array.isArray(joursOuverture) ? joursOuverture : [],
  };
  ctx.ouverts = new Set(ctx.joursOuverture);

  const mois = [];
  // Plafond : un planning aux dates aberrantes (ex. 9999-12-31) ne doit pas
  // figer le navigateur ; on ne traite que les MAX_MOIS premiers mois.
  for (
    let m = dateUtil.debutMois(planning.dateDebut);
    m <= planning.dateFin && mois.length < MAX_MOIS;
    m = dateUtil.moisSuivant(m)
  ) {
    mois.push(construireMois(planning, m, ctx));
  }
  return mois;
}
