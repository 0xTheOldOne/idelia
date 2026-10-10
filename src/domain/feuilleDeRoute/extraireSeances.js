/**
 * Extraction des séances d'une « Liste des séances sur une période » exportée de Vega
 * (feature 0033). Transforme des fragments de texte positionnés (issus du PDF) en séances.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 * Aucun objet `Date` : simple découpage de chaînes (ADR 0010).
 */

/**
 * @typedef {Object} GlyphePdf
 * @property {number} page     // n° de page, à partir de 1
 * @property {number} x        // abscisse de début (transform[4]), en points PDF
 * @property {number} y        // ordonnée (transform[5]) — origine en bas de page
 * @property {number} largeur  // largeur du fragment (item.width), 0 si inconnue
 * @property {string} str      // texte du fragment (mot ou cellule entière), jamais vide
 *
 * @typedef {Object} Seance
 * @property {string} date           // "YYYY-MM-DD" (ligne de jour précédente)
 * @property {string} ps             // code de l'infirmière dans Vega (FC, LR, CB, EMM…)
 * @property {string} heure          // "HH:mm"
 * @property {string} patient        // colonne « Bénéficiaire », espaces normalisés
 * @property {string} cotation       // colonne « Cotation », telle qu'imprimée
 * @property {(number|null)} montantCentimes // colonne « Montant » en centimes (20,95 → 2095), null si illisible
 * @property {(string|null)} fin     // "YYYY-MM-DD" (Fin dd/mm/yy → 20yy-mm-dd), null si absente/illisible
 *
 * @typedef {Object} ResultatExtraction
 * @property {({debut: string, fin: string}|null)} periode  // 1re et dernière date de jour lues
 * @property {Seance[]} seances
 */

/** Un fragment appartient à la dernière colonne dont le début − tolérance ≤ x (en points). */
export const TOLERANCE_COLONNE = 2;
/** Deux fragments dont les `y` diffèrent de moins que cette valeur sont sur la même ligne (en points). */
export const TOLERANCE_LIGNE = 1.5;

const REGEX_JOUR =
  /^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s+(\d{2})\/(\d{2})\/(\d{4})$/;
/** Colonnes connues du tableau (liste blanche : le texte du PDF ne crée jamais de colonne). */
const COLONNES_CONNUES = [
  'ps', 'heure', 'beneficiaire', 'cotation', 'montant', 'actes', 'nuit', 'dim',
  'if', 'km', 'ik', 'de', 'facture', 'fin',
];
/** Colonnes obligatoires pour reconnaître la ligne d'en-tête. */
const MOTS_ENTETE = ['ps', 'heure', 'beneficiaire', 'cotation', 'montant', 'fin'];

/**
 * Normalise un texte : espaces multiples réduits, bords retirés.
 * @param {string} texte
 * @returns {string}
 */
function normaliser(texte) {
  return texte.replace(/\s+/g, ' ').trim();
}

/**
 * Minuscules sans accents, pour reconnaître l'en-tête.
 * @param {string} texte
 * @returns {string}
 */
function sansAccents(texte) {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Regroupe les fragments en lignes : par page, de haut en bas, fragments triés par `x`.
 * Les fragments uniquement blancs (séparateurs de colonnes) sont écartés.
 * @param {GlyphePdf[]} glyphes
 * @returns {Array<{page: number, y: number, fragments: GlyphePdf[]}>}
 */
function regrouperEnLignes(glyphes) {
  const tries = glyphes
    .filter((g) => g.str.trim() !== '')
    .sort((a, b) => a.page - b.page || b.y - a.y);
  const lignes = [];
  let courante = null;
  for (const g of tries) {
    if (courante && courante.page === g.page && Math.abs(courante.y - g.y) <= TOLERANCE_LIGNE) {
      courante.fragments.push(g);
    } else {
      courante = { page: g.page, y: g.y, fragments: [g] };
      lignes.push(courante);
    }
  }
  for (const ligne of lignes) ligne.fragments.sort((a, b) => a.x - b.x);
  return lignes;
}

/**
 * Texte complet d'une ligne (fragments joints par un espace, espaces normalisés).
 * @param {{fragments: GlyphePdf[]}} ligne
 * @returns {string}
 */
function texteLigne(ligne) {
  return normaliser(ligne.fragments.map((f) => f.str).join(' '));
}

/**
 * Indique si la ligne est l'en-tête du tableau (PS, Heure, Bénéficiaire, Cotation, Fin).
 * @param {{fragments: GlyphePdf[]}} ligne
 * @returns {boolean}
 */
function estEntete(ligne) {
  const mots = sansAccents(texteLigne(ligne)).split(' ');
  return MOTS_ENTETE.every((m) => mots.includes(m));
}

/**
 * Déduit les colonnes de l'en-tête : un début (`x`) par fragment, nommé par son texte normalisé.
 * @param {{fragments: GlyphePdf[]}} ligne
 * @returns {Array<{nom: string, x: number}>}
 */
function colonnesDepuisEntete(ligne) {
  return ligne.fragments
    .map((f) => ({ nom: sansAccents(normaliser(f.str)), x: f.x }))
    .filter((c) => COLONNES_CONNUES.includes(c.nom));
}

/**
 * Répartit les fragments d'une ligne dans les colonnes (par abscisse de début) et
 * renvoie le texte de chaque cellule, indexé par nom de colonne.
 * @param {{fragments: GlyphePdf[]}} ligne
 * @param {Array<{nom: string, x: number}>} colonnes
 * @returns {Map<string, string>}
 */
function cellulesDeLigne(ligne, colonnes) {
  /** @type {Map<string, string[]>} */
  const parties = new Map();
  for (const f of ligne.fragments) {
    let colonne = null;
    for (const c of colonnes) {
      if (c.x - TOLERANCE_COLONNE <= f.x) colonne = c;
    }
    if (!colonne) continue;
    if (!parties.has(colonne.nom)) parties.set(colonne.nom, []);
    parties.get(colonne.nom).push(f.str);
  }
  /** @type {Map<string, string>} */
  const cellules = new Map();
  for (const [nom, morceaux] of parties) {
    cellules.set(nom, normaliser(morceaux.join(' ')));
  }
  return cellules;
}

/**
 * Convertit « dd/mm/yy » en « 20yy-mm-dd » ; `null` si vide ou non conforme.
 * @param {string|undefined} texte
 * @returns {(string|null)}
 */
function convertirFin(texte) {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(texte ?? '');
  if (!m) return null;
  const iso = `20${m[3]}-${m[2]}-${m[1]}`;
  return estDateReelle(iso) ? iso : null;
}

/**
 * Convertit « 20,95 » en 2095 (centimes) ; `null` si non conforme.
 * @param {string|undefined} texte
 * @returns {(number|null)}
 */
function convertirMontant(texte) {
  const m = /^(\d{1,6}),(\d{2})$/.exec((texte ?? '').replace(/\s+/g, ''));
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
}

/**
 * Vérifie qu'une date "YYYY-MM-DD" existe au calendrier (aller-retour UTC, sans fuseau).
 * Le `Date` ne sert qu'à valider : rien n'est conservé (ADR 0010).
 * @param {string} iso
 * @returns {boolean}
 */
function estDateReelle(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

/**
 * Extrait les séances et la période à partir des fragments du PDF.
 * @param {GlyphePdf[]} glyphes
 * @returns {ResultatExtraction}
 */
export function extraireSeances(glyphes) {
  /** @type {Seance[]} */
  const seances = [];
  let colonnes = null;
  let dateCourante = null;
  let debut = null;
  let fin = null;

  for (const ligne of regrouperEnLignes(glyphes)) {
    if (estEntete(ligne)) {
      colonnes = colonnesDepuisEntete(ligne);
      continue;
    }
    const texte = texteLigne(ligne);
    if (
      texte.startsWith('Vega5') ||
      texte.includes('Imprimé le') ||
      /séances pour un total de/i.test(texte)
    ) {
      continue;
    }

    const jour = REGEX_JOUR.exec(texte);
    if (jour) {
      const iso = `${jour[4]}-${jour[3]}-${jour[2]}`;
      if (!estDateReelle(iso)) {
        dateCourante = null; // jour invalide : ses séances sont ignorées
        continue;
      }
      dateCourante = iso;
      if (debut === null || dateCourante < debut) debut = dateCourante;
      if (fin === null || dateCourante > fin) fin = dateCourante;
      continue;
    }

    if (!colonnes || !dateCourante) continue;
    const c = cellulesDeLigne(ligne, colonnes);
    const ps = c.get('ps') ?? '';
    const heure = c.get('heure') ?? '';
    if (!/^[A-Z0-9]{2,4}$/.test(ps) || !/^\d{1,2}:\d{2}$/.test(heure)) continue;
    seances.push({
      date: dateCourante,
      ps,
      heure: heure.padStart(5, '0'),
      patient: c.get('beneficiaire') ?? '',
      cotation: c.get('cotation') ?? '',
      montantCentimes: convertirMontant(c.get('montant')),
      fin: convertirFin(c.get('fin')),
    });
  }

  return { periode: debut === null ? null : { debut, fin }, seances };
}
