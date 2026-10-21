<template>
  <span class="info-bulle" :class="`info-bulle--${alignement}`">
    <button type="button" class="info-bulle__bouton" :aria-label="libelle" :aria-describedby="idBulle">
      <PhInfo :size="taille" aria-hidden="true" />
    </button>
    <span :id="idBulle" role="tooltip" class="info-bulle__texte">
      <slot />
    </span>
  </span>
</template>

<script>
import { PhInfo } from '@phosphor-icons/vue';

import { genId } from '@/domain/utils/id.js';

/**
 * Icône d'information avec infobulle (contenu en slot) : affichée au survol,
 * au focus clavier ou à l'appui sur mobile, jamais au clic. Le survol porte sur
 * le conteneur, pour que l'infobulle reste affichée quand la souris passe dessus.
 */
export default {
  name: 'InfoBulle',
  components: { PhInfo },
  props: {
    /** Nom accessible du bouton. */
    libelle: { type: String, default: "Plus d'informations" },
    /** Bord de l'icône sur lequel l'infobulle s'aligne : `'debut'` ou `'fin'` (colonne à droite). */
    alignement: {
      type: String,
      default: 'debut',
      validator: (valeur) => ['debut', 'fin'].includes(valeur),
    },
    /** Taille de l'icône (px). */
    taille: { type: Number, default: 20 },
  },
  data() {
    return { idBulle: `info-bulle-${genId()}` };
  },
};
</script>

<style lang="scss" scoped>
@use '@/styles/tokens' as t;

.info-bulle {
  position: relative;
  display: inline-flex;
  vertical-align: middle;

  &:hover .info-bulle__texte,
  &:focus-within .info-bulle__texte {
    display: block;
  }
}

// Cible cliquable de taille standard.
.info-bulle__bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;
  padding: 0;
  border: 0;
  border-radius: t.$rayon-md;
  background: none;
  color: t.$couleur-texte-attenue;

  &:hover {
    color: t.$couleur-primaire-foncee;
  }

  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: 2px;
  }
}

.info-bulle__texte {
  display: none;
  position: absolute;
  top: 100%;
  z-index: 20;
  width: max-content;
  max-width: 20rem;
  padding: t.$espace-1 t.$espace-2;
  border-radius: t.$rayon-sm;
  background-color: t.$couleur-texte;
  color: t.$couleur-texte-inverse;
  box-shadow: t.$ombre-legere;
  font-size: t.$taille-texte-petite;
  font-weight: normal;
  text-align: left;
  white-space: normal;
}

.info-bulle--debut .info-bulle__texte {
  left: 0;
}

.info-bulle--fin .info-bulle__texte {
  right: 0;
}

@media print {
  .info-bulle {
    display: none;
  }
}
</style>
