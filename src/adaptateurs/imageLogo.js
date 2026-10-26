/**
 * Adaptateur de préparation du logo du cabinet (0039) : décode l'image choisie,
 * la réduit (jamais d'agrandissement) et la réencode en PNG ou JPEG via un canvas.
 * Tout se passe dans le navigateur ; rien n'est envoyé ni persisté ici.
 *
 * Le réencodage supprime les métadonnées d'origine (EXIF, position GPS) et tout
 * contenu non image : seuls les pixels sont conservés.
 *
 * Hors domaine (ADR 0008) : API navigateur, asynchrone. Aucun import Vue/Vuex/storage.
 */

import { LOGO_COTE_MAX_PX, estLogoValide } from '@/domain/cabinet.js'

/** Taille maximale du fichier source (octets) : 10 Mo. */
export const TAILLE_MAX_IMAGE_SOURCE_OCTETS = 10 * 1024 * 1024

/** Nombre maximal de pixels de l'image source décodée : 40 mégapixels. */
export const PIXELS_MAX_SOURCE = 40 * 1000 * 1000

/** Valeur de l'attribut `accept` du sélecteur de fichier. */
export const ACCEPT_LOGO = 'image/png,image/jpeg,.png,.jpg,.jpeg'

/**
 * Fabrique une erreur portant un code stable (jamais de message technique à l'écran).
 * @param {'FORMAT_NON_ACCEPTE'|'FICHIER_TROP_LOURD'|'IMAGE_ILLISIBLE'|'IMAGE_TROP_GRANDE'|'LOGO_TROP_LOURD'} code
 * @param {unknown} [cause]
 * @returns {Error & {code: string}}
 */
function erreurPreparation(code, cause) {
  const err = /** @type {Error & {code: string}} */ (new Error(code, { cause }))
  err.code = code
  return err
}

/**
 * PNG ou JPEG d'après le type MIME, sinon d'après l'extension si le type est vide (Windows).
 * Un type renseigné autre que PNG/JPEG est refusé même avec une extension valide. SVG toujours refusé.
 * @param {{type?: string, name?: string}} fichier
 * @returns {boolean}
 */
export function estFichierImageAcceptee(fichier) {
  if (!fichier) return false
  if (fichier.type) return fichier.type === 'image/png' || fichier.type === 'image/jpeg'
  return /\.(png|jpe?g)$/i.test(fichier.name ?? '')
}

/**
 * Dessine le bitmap réduit dans un canvas et l'exporte en data URL.
 * @param {ImageBitmap} bitmap
 * @param {number} cote - côté maximal (px)
 * @param {'image/png'|'image/jpeg'} type
 * @param {number} [qualite] - qualité JPEG (0-1)
 * @returns {string}
 */
function encoder(bitmap, cote, type, qualite) {
  const echelle = Math.min(1, cote / Math.max(bitmap.width, bitmap.height))
  const largeur = Math.max(1, Math.round(bitmap.width * echelle))
  const hauteur = Math.max(1, Math.round(bitmap.height * echelle))
  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const ctx = canvas.getContext('2d')
  if (type === 'image/jpeg') {
    // La transparence deviendrait noire en JPEG : fond blanc (le papier est blanc).
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, largeur, hauteur)
  }
  ctx.drawImage(bitmap, 0, 0, largeur, hauteur)
  return canvas.toDataURL(type, qualite)
}

/**
 * Prépare un logo : décode, réduit (jamais d'agrandissement), réencode en PNG ou JPEG.
 * @param {File} fichier
 * @returns {Promise<string>} data URL conforme à `estLogoValide`
 * @throws {Error & {code: 'FORMAT_NON_ACCEPTE'|'FICHIER_TROP_LOURD'|'IMAGE_ILLISIBLE'|'IMAGE_TROP_GRANDE'|'LOGO_TROP_LOURD'}}
 */
export async function preparerLogo(fichier) {
  if (!estFichierImageAcceptee(fichier)) throw erreurPreparation('FORMAT_NON_ACCEPTE')
  if (fichier.size > TAILLE_MAX_IMAGE_SOURCE_OCTETS) throw erreurPreparation('FICHIER_TROP_LOURD')

  /** @type {ImageBitmap} */
  let bitmap
  try {
    // Format reconnu d'après le contenu ; orientation EXIF appliquée par défaut.
    bitmap = await createImageBitmap(fichier)
  } catch (cause) {
    throw erreurPreparation('IMAGE_ILLISIBLE', cause)
  }

  try {
    if (bitmap.width * bitmap.height > PIXELS_MAX_SOURCE) throw erreurPreparation('IMAGE_TROP_GRANDE')

    const sourcePng = fichier.type
      ? fichier.type === 'image/png'
      : /\.png$/i.test(fichier.name ?? '')
    /** Tentatives successives, de la plus fidèle à la plus légère. */
    const tentatives = [
      sourcePng
        ? [LOGO_COTE_MAX_PX, 'image/png', undefined]
        : [LOGO_COTE_MAX_PX, 'image/jpeg', 0.88],
      [LOGO_COTE_MAX_PX, 'image/jpeg', 0.8],
      [300, 'image/jpeg', 0.8],
      [200, 'image/jpeg', 0.75],
    ]
    for (const [cote, type, qualite] of tentatives) {
      const dataUrl = encoder(bitmap, cote, type, qualite)
      if (estLogoValide(dataUrl)) return dataUrl
    }
    throw erreurPreparation('LOGO_TROP_LOURD')
  } finally {
    bitmap.close()
  }
}
