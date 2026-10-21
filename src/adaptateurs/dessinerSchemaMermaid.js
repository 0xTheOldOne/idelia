/**
 * Adaptateur de dessin de schéma (ADR 0022) : transforme une définition Mermaid en SVG
 * avec la librairie `mermaid`, entièrement dans le navigateur.
 *
 * Hors domaine (ADR 0008) : bibliothèque tierce, asynchrone, DOM.
 * La bibliothèque est chargée à la demande (chunks séparés) au premier appel, puis réutilisée.
 */

import { genId } from '../domain/utils/id.js'

/** @type {Promise<any>|null} */
let promesseMermaid = null

/**
 * Charge et initialise mermaid une seule fois (configuration durcie, ADR 0022).
 * En cas d'échec de chargement, l'essai suivant repart de zéro.
 * @returns {Promise<any>}
 */
function chargerMermaid() {
  if (!promesseMermaid) {
    promesseMermaid = import('mermaid')
      .then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          htmlLabels: false,
          suppressErrorRendering: true,
          theme: 'neutral',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          flowchart: { htmlLabels: false, useMaxWidth: true }
        })
        return mermaid
      })
      .catch((err) => {
        promesseMermaid = null
        throw err
      })
  }
  return promesseMermaid
}

/**
 * Dessine une définition Mermaid en SVG (texte). Charge mermaid à la demande (une seule fois)
 * et l'initialise avec la configuration durcie de l'ADR 0022 (thème 'neutral').
 * @param {string} definition   // produite par definitionSchemaFlux
 * @returns {Promise<string>}   // SVG
 * @throws {Error}              // chargement ou rendu impossible
 */
export async function dessinerSchemaMermaid(definition) {
  const mermaid = await chargerMermaid()
  const { svg } = await mermaid.render(`schema-flux-${genId()}`, definition)
  return svg
}
