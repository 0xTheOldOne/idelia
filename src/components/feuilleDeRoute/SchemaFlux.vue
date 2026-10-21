<template>
  <figure v-if="definition !== null" class="schema-flux">
    <p v-if="etat === 'chargement'" class="schema-flux__message" role="status">
      Préparation du schéma…
    </p>
    <p v-else-if="etat === 'erreur'" class="schema-flux__message schema-flux__message--erreur" role="status">
      Le schéma n'a pas pu être affiché. Les mêmes informations sont écrites juste en dessous.
    </p>
    <!-- Le SVG de mermaid.render est inséré ici par le DOM, styles réappliqués par CSSOM (ADR 0022). -->
    <div
      v-show="etat === 'pret'"
      ref="dessin"
      class="schema-flux__dessin"
      role="img"
      :aria-labelledby="idLegende"
    />
    <figcaption :id="idLegende" class="schema-flux__legende">{{ legende }}</figcaption>
  </figure>
</template>

<script>
import { dessinerSchemaMermaid } from '../../adaptateurs/dessinerSchemaMermaid.js';
import { insererSvg, preparerSvg, retirerFeuilles } from '../../adaptateurs/insererSvgSecurise.js';
import { genId } from '../../domain/utils/id.js';

/**
 * Schéma du chemin de l'argent (feature 0036, ADR 0022) : dessine une définition Mermaid
 * produite par le domaine. Composant présentationnel : aucun calcul. Le SVG renvoyé par
 * l'adaptateur est analysé, débarrassé de ses styles inline, inséré par le DOM (pas d'innerHTML)
 * puis stylé par CSSOM, pour respecter la CSP.
 */
export default {
  name: 'SchemaFlux',
  props: {
    /** Texte Mermaid (`definitionSchemaFlux`) ; null = rien à afficher. */
    definition: { type: String, default: null },
    /** Légende lue par les lecteurs d'écran et affichée sous le schéma. */
    legende: { type: String, required: true },
  },
  data() {
    return {
      /** @type {'chargement'|'pret'|'erreur'} */
      etat: 'chargement',
      idLegende: `legende-schema-${genId()}`,
      // Compteur de rendu : ignore les réponses périmées ou arrivées après le démontage.
      numeroRendu: 0,
    };
  },
  watch: {
    definition: {
      immediate: true,
      handler(definition) {
        this.dessiner(definition);
      },
    },
  },
  created() {
    // Feuilles constructibles ajoutées au document (non réactif).
    this.feuilles = [];
  },
  beforeUnmount() {
    this.numeroRendu += 1;
    retirerFeuilles(this.feuilles);
    this.feuilles = [];
  },
  methods: {
    async dessiner(definition) {
      const numero = ++this.numeroRendu;
      if (definition === null) return;
      this.etat = 'chargement';
      try {
        const svg = await dessinerSchemaMermaid(definition);
        if (numero !== this.numeroRendu) return;
        // Le conteneur existe toujours (v-show) tant que la définition n'est pas nulle.
        await this.$nextTick();
        if (numero !== this.numeroRendu || !this.$refs.dessin) return;
        // Styles extraits puis réappliqués par CSSOM (CSP inchangée, ADR 0022).
        const prepare = preparerSvg(svg);
        retirerFeuilles(this.feuilles);
        this.feuilles = insererSvg(this.$refs.dessin, prepare);
        this.etat = 'pret';
      } catch {
        if (numero === this.numeroRendu) this.etat = 'erreur';
      }
    },
  },
};
</script>

<style scoped lang="scss">
.schema-flux {
  margin: 0 0 1rem;

  &__message {
    // Hauteur réservée : évite le saut de page quand le schéma apparaît.
    min-height: 8rem;
    margin: 0 0 0.5rem;
    color: var(--bs-secondary-color, #6c757d);

    &--erreur {
      min-height: 0;
      color: var(--bs-danger-text-emphasis, #842029);
    }
  }

  &__dessin {
    // Petit écran : le schéma garde une largeur lisible et défile horizontalement.
    overflow-x: auto;

    :deep(svg) {
      min-width: 480px;
      max-width: none !important;
      height: auto;
    }
  }

  &__legende {
    margin-top: 0.5rem;
  }

  @media print {
    break-inside: avoid;
  }
}
</style>
