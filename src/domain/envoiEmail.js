/**
 * Envoi du planning par e-mail (feature 0027).
 *
 * Prépare, sans aucun envoi réel (ADR 0002), les éléments d'un message à
 * l'équipe : destinataires (personnes actives), personnes à compléter, objet,
 * corps et lien `mailto:` à ouvrir dans la messagerie de l'utilisatrice.
 * Rien n'est persisté (ADR 0005).
 *
 * Module pur : aucun import Vue/Vuex, aucun import de `@/domain/scheduling`
 * (ADR 0008), aucun accès navigateur ; dates uniquement via `dateUtil`
 * (ADR 0010). Ne lève jamais, même face à des entrées incohérentes.
 */

import { dateUtil } from '@/domain/utils/dates.js';
import { dateMiseAJour } from '@/domain/planning.js';
import { titreDocumentDiffusion } from '@/domain/diffusion.js';

/** Longueur maximale d'une URL `mailto:` jugée sûre (limites des messageries / de Windows ≈ 2 000 caractères). */
export const LONGUEUR_MAX_MAILTO = 2000;
/** Séparateur des adresses dans l'URL `mailto:` (RFC 6068). Voir plan 0027 §12 n° 5 (Outlook). */
export const SEPARATEUR_ADRESSES_MAILTO = ',';
/** Séparateur des adresses copiées dans le presse-papiers (accepté par Outlook, Gmail, Orange…). */
export const SEPARATEUR_ADRESSES_COPIE = '; ';

/** Nom affiché quand une personne n'a ni prénom ni nom. */
const NOM_PAR_DEFAUT = 'Personne sans nom';

/**
 * Motif d'adresse volontairement simple : une seule `@`, un point dans le
 * domaine, extension d'au moins 2 caractères ; aucun espace ni retour à la
 * ligne, aucune virgule ni point-virgule (séparateurs d'adresses).
 */
const MOTIF_EMAIL = /^[^\s@,;<>()[\]\\"]+@[^\s@,;<>()[\]\\"]+\.[^\s@,;<>()[\]\\".]{2,}$/;

/**
 * @typedef {Object} DestinataireEmail
 * @property {string} personneId
 * @property {string} nomComplet - « Prénom Nom ».
 * @property {string} email - Adresse nettoyée (espaces retirés).
 */

/**
 * @typedef {Object} PersonneSansEmail
 * @property {string} personneId
 * @property {string} nomComplet
 * @property {'ABSENTE'|'INVALIDE'} raison
 * @property {string} emailSaisi - Valeur actuelle nettoyée ('' si absente), affichée pour « adresse à corriger ».
 */

/**
 * @typedef {Object} EnvoiEmail
 * @property {'PRET'|'BLOQUE'|'AUCUNE_PERSONNE'} etat
 * @property {DestinataireEmail[]} destinataires - Personnes actives à adresse valide, triées nom puis prénom.
 * @property {PersonneSansEmail[]} sansEmail - Personnes actives bloquantes, même tri.
 * @property {string[]} adresses - Adresses dédupliquées (insensible à la casse), ordre des destinataires.
 * @property {string} adressesTexte - `adresses.join(SEPARATEUR_ADRESSES_COPIE)`.
 * @property {string} objet
 * @property {string} corps - Lignes séparées par "\r\n".
 * @property {string} url - `mailto:` complet (Cci + objet + corps) ; '' si `etat !== 'PRET'`.
 * @property {string} urlSansAdresses - `mailto:` objet + corps seulement (repli si trop long) ; '' si pas de planning.
 * @property {boolean} tropLong - `url.length > LONGUEUR_MAX_MAILTO`.
 * @property {string} nomFichierPdf - `titreDocumentDiffusion(planning) + '.pdf'`.
 */

/**
 * Indique si une valeur est une adresse e-mail acceptable pour l'envoi.
 * Contrôle simple et explicite (un peu plus strict que Vuelidate sur les cas
 * exotiques : adresses entre guillemets, IP littérales).
 *
 * @param {*} valeur
 * @returns {boolean}
 */
export function estEmailValide(valeur) {
  if (typeof valeur !== 'string') return false;
  const email = valeur.trim();
  if (email.length < 3 || email.length > 254) return false;
  return MOTIF_EMAIL.test(email);
}

/**
 * Nom d'affichage « Prénom Nom » d'une personne.
 * @param {Object} personne
 * @returns {string}
 */
function nomComplet(personne) {
  const texte = `${personne.prenom ?? ''} ${personne.nom ?? ''}`.trim();
  return texte || NOM_PAR_DEFAUT;
}

/**
 * Comparateur nom, puis prénom, puis id (ordre français).
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
function comparerPersonnes(a, b) {
  return (
    String(a.nom ?? '').localeCompare(String(b.nom ?? ''), 'fr') ||
    String(a.prenom ?? '').localeCompare(String(b.prenom ?? ''), 'fr') ||
    String(a.id ?? '').localeCompare(String(b.id ?? ''))
  );
}

/**
 * Sépare les personnes actives en destinataires (adresse valide) et en
 * personnes à compléter (adresse absente ou invalide). Les archivées
 * (`actif === false`) sont ignorées.
 *
 * @param {Array<Object>|null|undefined} personnes
 * @returns {{ destinataires: DestinataireEmail[], sansEmail: PersonneSansEmail[] }}
 */
export function analyserDestinataires(personnes) {
  /** @type {DestinataireEmail[]} */
  const destinataires = [];
  /** @type {PersonneSansEmail[]} */
  const sansEmail = [];
  if (!Array.isArray(personnes)) return { destinataires, sansEmail };

  const actives = personnes
    .filter((p) => p !== null && typeof p === 'object' && p.actif !== false)
    .sort(comparerPersonnes);

  for (const p of actives) {
    const email = String(p.contact?.email ?? '').trim();
    const base = { personneId: p.id, nomComplet: nomComplet(p) };
    if (email === '') {
      sansEmail.push({ ...base, raison: 'ABSENTE', emailSaisi: '' });
    } else if (!estEmailValide(email)) {
      sansEmail.push({ ...base, raison: 'INVALIDE', emailSaisi: email });
    } else {
      destinataires.push({ ...base, email });
    }
  }
  return { destinataires, sansEmail };
}

/**
 * Période du planning « du JJ/MM/AAAA au JJ/MM/AAAA ».
 * @param {Object} planning
 * @returns {string}
 */
function periodeTexte(planning) {
  return `du ${dateUtil.formatDateFr(planning.dateDebut)} au ${dateUtil.formatDateFr(planning.dateFin)}`;
}

/**
 * Objet du message : « Planning du 13/07/2026 au 30/08/2026 (mise à jour du
 * 07/10/2026 à 14:32) ». La parenthèse n'apparaît que si une date de mise à
 * jour existe.
 *
 * @param {Object|null|undefined} planning
 * @returns {string} '' si pas de planning.
 */
export function objetEmail(planning) {
  if (!planning) return '';
  const maj = dateMiseAJour(planning);
  return `Planning ${periodeTexte(planning)}${maj ? ` (mise à jour du ${maj.texte})` : ''}`;
}

/**
 * Corps du message, destiné à l'équipe (aucune instruction pour l'expéditrice,
 * aucune donnée de santé ni nominative : période et date de mise à jour seulement).
 *
 * @param {Object|null|undefined} planning
 * @returns {string} Lignes séparées par "\r\n" ; '' si pas de planning.
 */
export function corpsEmail(planning) {
  if (!planning) return '';
  const maj = dateMiseAJour(planning);
  return [
    'Bonjour,',
    '',
    `Vous trouverez en pièce jointe le planning ${periodeTexte(planning)}${maj ? ` (mise à jour du ${maj.texte})` : ''}.`,
    '',
    'Bonne journée,',
  ].join('\r\n');
}

/**
 * Construit une URL `mailto:` avec adresses en copie cachée (bcc). Chaque
 * valeur est encodée par `encodeURIComponent` : une adresse ne peut pas
 * injecter de paramètre (`?`, `&`, `=`, `#`, `%`).
 *
 * @param {{ adresses?: string[], objet?: string, corps?: string }} [params]
 * @returns {string}
 */
export function construireUrlMailto({ adresses = [], objet = '', corps = '' } = {}) {
  const parametres = [];
  const liste = Array.isArray(adresses) ? adresses : [];
  if (liste.length > 0) {
    const bcc = liste
      .map((a) => encodeURIComponent(String(a)).replace(/%40/g, '@'))
      .join(SEPARATEUR_ADRESSES_MAILTO);
    parametres.push(`bcc=${bcc}`);
  }
  if (objet) parametres.push(`subject=${encodeURIComponent(objet)}`);
  if (corps) parametres.push(`body=${encodeURIComponent(corps)}`);
  return `mailto:?${parametres.join('&')}`;
}

/**
 * Prépare tout l'envoi par e-mail d'un planning à l'équipe active.
 * Ne lève jamais (planning absent → objet, corps, URLs et nom de fichier vides).
 *
 * @param {{ planning?: Object|null, personnes?: Array<Object>|null }} [params]
 * @returns {EnvoiEmail}
 */
export function preparerEnvoiEmail({ planning, personnes } = {}) {
  const { destinataires, sansEmail } = analyserDestinataires(personnes);

  /** @type {'PRET'|'BLOQUE'|'AUCUNE_PERSONNE'} */
  let etat = 'PRET';
  if (destinataires.length + sansEmail.length === 0) etat = 'AUCUNE_PERSONNE';
  else if (sansEmail.length > 0) etat = 'BLOQUE';

  const vues = new Set();
  const adresses = [];
  for (const d of destinataires) {
    const cle = d.email.toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    adresses.push(d.email);
  }

  const objet = objetEmail(planning);
  const corps = corpsEmail(planning);
  const url = etat === 'PRET' && planning ? construireUrlMailto({ adresses, objet, corps }) : '';

  return {
    etat,
    destinataires,
    sansEmail,
    adresses,
    adressesTexte: adresses.join(SEPARATEUR_ADRESSES_COPIE),
    objet,
    corps,
    url,
    urlSansAdresses: planning ? construireUrlMailto({ objet, corps }) : '',
    tropLong: url.length > LONGUEUR_MAX_MAILTO,
    nomFichierPdf: planning ? `${titreDocumentDiffusion(planning)}.pdf` : '',
  };
}
