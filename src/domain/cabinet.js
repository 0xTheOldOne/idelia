/**
 * Règles métier pures relatives aux `ParametresCabinet`
 * (voir `docs/architecture/02-modele-de-domaine.md`).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

/**
 * Identité du cabinet (0039) : `adresseCabinet` est une
 * `import('@/domain/adresse.js').AdressePostale` (normalisée via `adresse.js`,
 * jamais redéfinie ici) ; `logo` est une data URL PNG/JPEG ou `null`.
 */

/** Longueur maximale du nom du cabinet (saisie Vuelidate). */
export const LONGUEUR_MAX_NOM_CABINET = 100;

/** Côté maximal du logo enregistré (px). */
export const LOGO_COTE_MAX_PX = 400;

/** Longueur maximale de la data URL du logo (caractères) : ≈ 146 Ko d'image. */
export const LOGO_LONGUEUR_MAX = 200000;

/** Seules formes acceptées : PNG ou JPEG en base64, rien d'autre (ni SVG, ni URL externe, ni javascript:). */
const RE_LOGO = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * `true` si `valeur` est une data URL de logo conforme (type, forme, longueur).
 * La longueur est contrôlée avant l'expression régulière.
 * @param {*} valeur
 * @returns {boolean}
 */
export function estLogoValide(valeur) {
  return typeof valeur === 'string' && valeur.length <= LOGO_LONGUEUR_MAX && RE_LOGO.test(valeur);
}

/**
 * Logo conforme → lui-même ; tout le reste (préfixe, type JS, taille) → null.
 * Assainissement à la désérialisation et à l'affichage.
 * @param {*} valeur
 * @returns {(string|null)}
 */
export function normaliserLogo(valeur) {
  return estLogoValide(valeur) ? valeur : null;
}

/**
 * `true` si un logo est présent (ni null ni undefined) mais non conforme : il sera écarté à l'import.
 * @param {*} valeur
 * @returns {boolean}
 */
export function logoNonConforme(valeur) {
  return valeur !== null && valeur !== undefined && !estLogoValide(valeur);
}

/** Avertissement affiché quand un logo importé est écarté (décision du porteur). */
export const MESSAGE_LOGO_NON_REPRIS =
  "Le logo du cabinet n'a pas été repris : réimportez-le dans la page Cabinet.";

/** Messages FR des échecs de préparation du logo, par code stable de l'adaptateur. */
const MESSAGES_ERREUR_LOGO = {
  FORMAT_NON_ACCEPTE:
    "Ce type de fichier n'est pas accepté. Choisissez une image PNG ou JPEG (fichier .png, .jpg ou .jpeg).",
  FICHIER_TROP_LOURD: 'Cette image est trop lourde (plus de 10 Mo). Choisissez une image plus légère.',
  IMAGE_ILLISIBLE:
    "Cette image n'a pas pu être lue. Elle est peut-être abîmée : essayez avec une autre image.",
  IMAGE_TROP_GRANDE: 'Cette image est trop grande pour être préparée. Choisissez une image plus petite.',
  LOGO_TROP_LOURD:
    "Même réduite, cette image reste trop lourde pour être enregistrée. Essayez une image plus simple (moins de détails, fond uni).",
};

/**
 * Message FR d'un échec de préparation du logo. Code inconnu → `IMAGE_ILLISIBLE`.
 * @param {string} code
 * @returns {string}
 */
export function messageErreurLogo(code) {
  return MESSAGES_ERREUR_LOGO[code] ?? MESSAGES_ERREUR_LOGO.IMAGE_ILLISIBLE;
}

/**
 * @typedef {object} ResultatCoherence
 * @property {string[]} avertissements - Messages FR non bloquants (peut être vide).
 */

/**
 * Contrôle la cohérence du rythme de travail des `ParametresCabinet` et
 * renvoie des **avertissements non bloquants**, prêts à afficher.
 *
 * Règle KISS retenue : si `reposHebdoMin + maxJoursConsecutifs > 7`, le
 * nombre de jours consécutifs autorisés dépasse ce que le repos minimum
 * hebdomadaire permet réellement (7 jours par semaine) ; c'est signalé,
 * mais **jamais bloquant** (c'est un conseil, pas une erreur de saisie).
 *
 * Tolérant aux valeurs manquantes ou non numériques : dans ce cas, aucun
 * avertissement n'est levé (on ne peut pas conclure).
 *
 * @param {{ reposHebdoMin?: number, maxJoursConsecutifs?: number }} parametres - Paramètres du cabinet (ou sous-ensemble).
 * @returns {ResultatCoherence} Liste d'avertissements FR (vide si tout va bien).
 */
export function coherenceParametres(parametres) {
  const avertissements = [];
  const { reposHebdoMin, maxJoursConsecutifs } = parametres ?? {};

  const reposValide = Number.isFinite(reposHebdoMin);
  const maxJoursValide = Number.isFinite(maxJoursConsecutifs);

  if (reposValide && maxJoursValide && reposHebdoMin + maxJoursConsecutifs > 7) {
    const joursTravailMax = 7 - reposHebdoMin;
    avertissements.push(
      `Avec au moins ${reposHebdoMin} jour(s) de repos par semaine, on ne peut pas enchaîner ` +
        `plus de ${joursTravailMax} jour(s) de travail. Or vous autorisez ${maxJoursConsecutifs} jour(s) consécutifs.`
    );
  }

  return { avertissements };
}
