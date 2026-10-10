/**
 * Adaptateur de lecture PDF (ADR 0019) : extrait le texte d'un fichier PDF
 * avec `pdfjs-dist`, entièrement dans le navigateur. Rien n'est envoyé ni conservé.
 *
 * Hors domaine (ADR 0008) : lecture de `File`, worker, bibliothèque tierce, asynchrone.
 * La bibliothèque est chargée à la demande (chunk séparé) au premier appel.
 */

/** @typedef {import('../domain/feuilleDeRoute/extraireSeances.js').GlyphePdf} GlyphePdf */

/** Taille maximale acceptée pour un fichier PDF (20 Mo). */
export const TAILLE_MAX_PDF_OCTETS = 20 * 1024 * 1024

/** Nombre maximal de pages lues (au-delà : `PDF_TROP_COMPLEXE`). */
export const NB_PAGES_MAX = 200
/** Nombre maximal de fragments de texte lus au total (au-delà : `PDF_TROP_COMPLEXE`). */
export const NB_FRAGMENTS_MAX = 200000

/**
 * Indique si le fichier est un PDF (type MIME ou extension : Windows fournit parfois un type vide).
 * @param {{type?: string, name?: string}} fichier
 * @returns {boolean}
 */
export function estFichierPdf(fichier) {
  if (!fichier) return false
  if (fichier.type === 'application/pdf') return true
  return /\.pdf$/i.test(fichier.name ?? '')
}

/**
 * Fabrique une erreur portant un code stable (jamais de message technique à l'écran).
 * @param {'LECTEUR_INDISPONIBLE'|'PDF_ILLISIBLE'|'PDF_TROP_COMPLEXE'} code
 * @param {unknown} cause
 * @returns {Error & {code: string}}
 */
function erreurLecture(code, cause) {
  const err = /** @type {Error & {code: string}} */ (new Error(code, { cause }))
  err.code = code
  return err
}

/**
 * Lit un fichier PDF et renvoie ses fragments de texte positionnés.
 * Rejette une `Error` dont `code` vaut `'LECTEUR_INDISPONIBLE'` (chargement de pdf.js
 * impossible) `'PDF_ILLISIBLE'` (fichier abîmé, protégé…) ou `'PDF_TROP_COMPLEXE'` (trop de pages ou de texte).
 * @param {File} fichier
 * @returns {Promise<GlyphePdf[]>}
 */
export async function lireGlyphesPdf(fichier) {
  let pdfjs
  try {
    pdfjs = await import('pdfjs-dist')
    const { default: urlWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = urlWorker
  } catch (err) {
    throw erreurLecture('LECTEUR_INDISPONIBLE', err)
  }

  let tacheLecture = null
  try {
    const donnees = new Uint8Array(await fichier.arrayBuffer())
    // Durci : aucune évaluation de code issu du PDF, pas de XFA, pas de chargement progressif,
    // aucune ressource distante (cMap, polices, wasm).
    tacheLecture = pdfjs.getDocument({
      data: donnees,
      isEvalSupported: false,
      enableXfa: false,
      stopAtErrors: true,
      disableAutoFetch: true,
      disableStream: true,
      cMapUrl: null,
      standardFontDataUrl: null,
      wasmUrl: null
    })
    const document = await tacheLecture.promise
    if (document.numPages > NB_PAGES_MAX) throw erreurLecture('PDF_TROP_COMPLEXE', null)

    /** @type {GlyphePdf[]} */
    const glyphes = []
    for (let page = 1; page <= document.numPages; page++) {
      const contenu = await (await document.getPage(page)).getTextContent()
      for (const item of contenu.items) {
        if (!item.str) continue
        if (glyphes.length >= NB_FRAGMENTS_MAX) throw erreurLecture('PDF_TROP_COMPLEXE', null)
        glyphes.push({
          page,
          x: item.transform[4],
          y: item.transform[5],
          largeur: item.width ?? 0,
          str: item.str
        })
      }
    }
    return glyphes
  } catch (err) {
    if (err?.code === 'PDF_TROP_COMPLEXE') throw err
    throw erreurLecture('PDF_ILLISIBLE', err)
  } finally {
    if (tacheLecture) await tacheLecture.destroy()
  }
}
