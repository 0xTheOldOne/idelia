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
 * Traits de barrage d'une page : Vega barre une séance en dessinant, sur chaque cellule, un
 * rectangle plein très fin (≈ 0,4 pt de haut) au milieu du texte. Les bordures du tableau,
 * elles, sont des lignes d'épaisseur nulle dans leur boîte englobante : elles sont écartées.
 * @param {{fnArray: number[], argsArray: any[]}} operateurs - `page.getOperatorList()`
 * @param {Record<string, number>} OPS - `pdfjs.OPS`
 * @returns {Array<{x0: number, x1: number, y: number}>}
 */
function traitsDeBarrage(operateurs, OPS) {
  const traits = []
  operateurs.fnArray.forEach((fn, i) => {
    if (fn !== OPS.constructPath) return
    const boite = operateurs.argsArray[i]?.[2]
    if (!boite) return
    const largeur = boite[2] - boite[0]
    const hauteur = boite[3] - boite[1]
    if (hauteur > 0.05 && hauteur < 1.5 && largeur > 2 && largeur < 450) {
      traits.push({ x0: boite[0], x1: boite[2], y: (boite[1] + boite[3]) / 2 })
    }
  })
  return traits
}

/**
 * Un fragment est barré si un trait commence à son début (à 1,5 pt près) et passe
 * entre son pied et 5 pt au-dessus (le trait de Vega est à ≈ 2,3 pt, police de 8 pt).
 * @param {number} x
 * @param {number} y
 * @param {Array<{x0: number, x1: number, y: number}>} traits
 * @returns {boolean}
 */
function estBarre(x, y, traits) {
  return traits.some((t) => Math.abs(t.x0 - x) <= 1.5 && t.x1 > x && t.y > y && t.y < y + 5)
}

/**
 * Lit un fichier PDF et renvoie ses fragments de texte positionnés (avec l'indication
 * « barré » de chaque fragment).
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
      const pagePdf = await document.getPage(page)
      const contenu = await pagePdf.getTextContent()
      const traits = traitsDeBarrage(await pagePdf.getOperatorList(), pdfjs.OPS)
      for (const item of contenu.items) {
        if (!item.str) continue
        if (glyphes.length >= NB_FRAGMENTS_MAX) throw erreurLecture('PDF_TROP_COMPLEXE', null)
        const x = item.transform[4]
        const y = item.transform[5]
        glyphes.push({
          page,
          x,
          y,
          largeur: item.width ?? 0,
          str: item.str,
          barre: estBarre(x, y, traits)
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
