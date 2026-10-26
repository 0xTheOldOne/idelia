/**
 * Adaptateur de l'éditeur de texte riche (ADR 0023) : seul fichier qui importe `quill`.
 *
 * Hors domaine (ADR 0008) : bibliothèque tierce, DOM, asynchrone. Quill est chargé à la
 * demande (chunk séparé) au premier appel de `chargerQuill()`. Variante retenue : `quill/core`
 * (sans thèmes ni modules d'interface), avec enregistrement explicite des seuls formats utiles.
 *
 * Le contenu est un Delta JSON (`{ ops }`), jamais du HTML. Les marqueurs sont des embeds
 * `{ marqueur: { cle } }` : seule la clé est stockée, le libellé affiché est résolu à la volée
 * et écrit par `textContent` (jamais `innerHTML`).
 */

import { estCleMarqueurValide } from '@/domain/contrats/catalogueMarqueurs.js';
import { deltaVide, estDeltaModeleValide } from '@/domain/contrats/delta.js';

/** Formats autorisés (liste blanche, collage compris). */
export const FORMATS_AUTORISES = Object.freeze(['bold', 'italic', 'underline', 'header', 'list', 'align', 'marqueur']);

/** Formats portés par une ligne (et non par un morceau de texte). */
const FORMATS_DE_LIGNE = ['header', 'list', 'align'];

/** Promesse mémorisée du chargement de Quill (remise à zéro en cas d'échec). */
let promesseQuill = null;

/** Résolution des libellés de l'instance active (une seule instance éditable à la fois). */
let resoudreLibelleActif = (cle) => cle;

/**
 * Fabrique une erreur portant un code stable (jamais de message technique à l'écran).
 * @param {unknown} cause
 * @returns {Error & {code: string}}
 */
function erreurChargement(cause) {
  const err = /** @type {Error & {code: string}} */ (new Error('EDITEUR_INDISPONIBLE', { cause }));
  err.code = 'EDITEUR_INDISPONIBLE';
  return err;
}

/**
 * Charge Quill une seule fois et enregistre les formats, le blot `marqueur` et le presse-papiers.
 * Rejette une `Error` de `code: 'EDITEUR_INDISPONIBLE'` ; un nouvel appel retente le chargement.
 * @returns {Promise<any>} la classe Quill
 */
export function chargerQuill() {
  if (!promesseQuill) {
    promesseQuill = preparerQuill().catch((err) => {
      promesseQuill = null;
      throw erreurChargement(err);
    });
  }
  return promesseQuill;
}

async function preparerQuill() {
  const [{ default: Quill }, bold, italic, underline, header, liste, align] = await Promise.all([
    import('quill/core'),
    import('quill/formats/bold'),
    import('quill/formats/italic'),
    import('quill/formats/underline'),
    import('quill/formats/header'),
    import('quill/formats/list'),
    import('quill/formats/align'),
    import('quill/dist/quill.core.css'),
  ]);

  const Embed = Quill.import('blots/embed');
  const Clipboard = Quill.import('modules/clipboard');
  const Delta = Quill.import('delta');

  /** Titres limités aux niveaux 1 et 2 (les seuls admis par le contenu d'un modèle). */
  class Titre extends header.default {
    static tagName = ['H1', 'H2'];
  }

  /** Pastille non éditable d'un champ (marqueur) : un seul « caractère » pour Retour arrière. */
  class MarqueurBlot extends Embed {
    static blotName = 'marqueur';
    static tagName = 'span';
    static className = 'ql-marqueur';

    static create(valeur) {
      const noeud = super.create();
      const cle = String(valeur?.cle ?? '');
      noeud.setAttribute('data-cle', cle);
      if (cle.startsWith('saisie.')) noeud.classList.add('ql-marqueur--saisie');
      noeud.textContent = resoudreLibelleActif(cle);
      return noeud;
    }

    static value(noeud) {
      return { cle: noeud.dataset.cle };
    }
  }

  /** Presse-papiers : convertit les `{{cle}}` reconnus du texte collé (fonction injectée). */
  class PressePapiersMarqueurs extends Clipboard {
    onPaste(plage, { text, html }) {
      const formats = this.quill.getFormat(plage.index);
      const converti = this.convert({ html, text }, formats);
      // Un HTML collé peut contenir de fausses pastilles (`span.ql-marqueur[data-cle]`) :
      // seules les clés connues sont gardées, sinon le contenu ne serait plus enregistrable.
      const colle = new Delta(
        converti.ops.filter((op) => !op.insert?.marqueur || estCleMarqueurValide(op.insert.marqueur.cle))
      );
      const { convertirCollage, surMarqueursInconnus } = this.options;
      let apport = colle;
      let inconnus = [];
      if (typeof convertirCollage === 'function') {
        const resultat = convertirCollage({ ops: colle.ops });
        apport = new Delta(resultat.delta.ops);
        inconnus = resultat.inconnus ?? [];
      }
      const delta = new Delta().retain(plage.index).delete(plage.length).concat(apport);
      this.quill.updateContents(delta, Quill.sources.USER);
      this.quill.setSelection(delta.length() - plage.length, Quill.sources.SILENT);
      this.quill.scrollSelectionIntoView();
      if (typeof surMarqueursInconnus === 'function') surMarqueursInconnus(inconnus);
    }
  }

  Quill.register(
    {
      'formats/bold': bold.default,
      'formats/italic': italic.default,
      'formats/underline': underline.default,
      'formats/header': Titre,
      'formats/list': liste.default,
      'formats/align': align.AlignClass,
      'formats/marqueur': MarqueurBlot,
      'modules/clipboard': PressePapiersMarqueurs,
    },
    true
  );
  return Quill;
}

/**
 * Ramène un Delta lu dans Quill à la forme stricte d'un contenu de modèle
 * (listes cochées -> puces, titres > 2 impossibles grâce au blot `Titre`).
 * @param {{ops: object[]}} delta
 * @returns {{ops: object[]}}
 */
function normaliserDelta(delta) {
  const ops = JSON.parse(JSON.stringify(delta.ops)).map((op) => {
    if (op.attributes?.list === 'checked' || op.attributes?.list === 'unchecked') op.attributes.list = 'bullet';
    return op;
  });
  return { ops };
}

/**
 * @typedef {Object} ControleurEditeur
 * @property {() => {ops: object[]}} lireContenu
 * @property {(delta: {ops: object[]}) => void} ecrireContenu
 * @property {(nom: string, valeur: *) => void} basculerFormat
 * @property {() => Object<string, *>} formatsCourants
 * @property {(cle: string) => void} insererMarqueur
 * @property {() => void} annuler
 * @property {() => void} retablir
 * @property {() => void} rafraichirLibelles
 * @property {(rappel: () => void) => void} surChangement
 * @property {(rappel: () => void) => void} surSelection
 * @property {() => void} focus
 * @property {() => void} detruire
 */

/**
 * Crée un éditeur Quill dans `element`.
 * @param {HTMLElement} element
 * @param {Object} options
 * @param {{ops: object[]}} options.contenu
 * @param {(cle: string) => string} options.resoudreLibelle
 * @param {boolean} [options.lectureSeule]
 * @param {string} [options.libelleAccessible]
 * @param {(delta: {ops: object[]}) => {delta: {ops: object[]}, inconnus: string[]}} [options.convertirCollage]
 * @param {(inconnus: string[]) => void} [options.surMarqueursInconnus]
 * @returns {Promise<ControleurEditeur>}
 */
export async function creerEditeur(
  element,
  { contenu, resoudreLibelle, lectureSeule = false, libelleAccessible = '', convertirCollage, surMarqueursInconnus }
) {
  const Quill = await chargerQuill();
  resoudreLibelleActif = resoudreLibelle;

  const quill = new Quill(element, {
    readOnly: lectureSeule,
    formats: [...FORMATS_AUTORISES],
    placeholder: 'Commencez à écrire votre modèle ici…',
    modules: {
      toolbar: false,
      history: { userOnly: true },
      clipboard: { convertirCollage, surMarqueursInconnus },
    },
  });
  quill.setContents(estDeltaModeleValide(contenu) ? contenu : deltaVide(), 'api');
  quill.history.clear();

  const zone = quill.root;
  zone.setAttribute('role', 'textbox');
  zone.setAttribute('aria-multiline', 'true');
  if (libelleAccessible) zone.setAttribute('aria-label', libelleAccessible);

  let derniereSelection = null;
  let rappelChangement = null;
  let rappelSelection = null;

  const surTexte = (delta, ancien, source) => {
    if (source === 'user' && rappelChangement) rappelChangement();
  };
  const surSel = (plage) => {
    if (plage) derniereSelection = plage;
    if (rappelSelection) rappelSelection();
  };
  quill.on('text-change', surTexte);
  quill.on('selection-change', surSel);

  /** Plage utilisable : sélection courante, sinon la dernière connue, sinon la fin du texte. */
  const plageUtilisable = () => {
    const longueur = quill.getLength();
    const plage = quill.getSelection() ?? derniereSelection ?? { index: longueur - 1, length: 0 };
    const index = Math.min(plage.index, longueur - 1);
    return { index, length: Math.min(plage.length, longueur - 1 - index) };
  };

  return {
    lireContenu: () => normaliserDelta(quill.getContents()),
    ecrireContenu(delta) {
      quill.setContents(delta, 'api');
      derniereSelection = null;
    },
    basculerFormat(nom, valeur) {
      const plage = plageUtilisable();
      quill.setSelection(plage.index, plage.length, 'silent');
      const courant = quill.getFormat(plage)[nom];
      const cible = courant === valeur ? false : valeur;
      if (FORMATS_DE_LIGNE.includes(nom)) quill.formatLine(plage.index, plage.length, nom, cible, 'user');
      else quill.formatText(plage.index, plage.length, nom, cible, 'user');
      if (plage.length === 0 && !FORMATS_DE_LIGNE.includes(nom)) quill.format(nom, cible, 'user');
      derniereSelection = quill.getSelection() ?? plage;
    },
    formatsCourants() {
      const plage = quill.getSelection() ?? derniereSelection;
      if (!plage || plage.index > quill.getLength() - 1) return {};
      return quill.getFormat(plage);
    },
    insererMarqueur(cle) {
      const plage = plageUtilisable();
      if (plage.length > 0) quill.deleteText(plage.index, plage.length, 'user');
      quill.insertEmbed(plage.index, 'marqueur', { cle }, 'user');
      quill.insertText(plage.index + 1, ' ', 'user');
      quill.setSelection(plage.index + 2, 0, 'user');
    },
    annuler: () => quill.history.undo(),
    retablir: () => quill.history.redo(),
    rafraichirLibelles() {
      resoudreLibelleActif = resoudreLibelle;
      zone.querySelectorAll('.ql-marqueur').forEach((noeud) => {
        const interieur = noeud.querySelector('[contenteditable="false"]');
        if (interieur) interieur.textContent = resoudreLibelle(noeud.dataset.cle);
      });
    },
    surChangement(rappel) {
      rappelChangement = rappel;
    },
    surSelection(rappel) {
      rappelSelection = rappel;
    },
    focus: () => quill.focus(),
    detruire() {
      quill.off('text-change', surTexte);
      quill.off('selection-change', surSel);
      rappelChangement = null;
      rappelSelection = null;
      element.innerHTML = '';
    },
  };
}

/**
 * Affiche un contenu en lecture seule (sans HTML injecté). Prévu pour la feature 0042.
 * @param {HTMLElement} element
 * @param {{ops: object[]}} delta
 * @param {(cle: string) => string} resoudreLibelle
 * @returns {Promise<ControleurEditeur>}
 */
export function afficherEnLecture(element, delta, resoudreLibelle) {
  return creerEditeur(element, { contenu: delta, resoudreLibelle, lectureSeule: true });
}
