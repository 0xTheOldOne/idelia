<template>
  <span
    class="repere-diffusion"
    :class="{ 'repere-diffusion--texte-inverse': personne.fonce }"
    :style="personne.couleur ? { backgroundColor: personne.couleur } : null"
  >
    <span aria-hidden="true">{{ personne.repere }}</span>
    <span class="visually-hidden">{{ personne.nomComplet }}</span>
  </span>
</template>

<script>
/**
 * Pastille d'une personne sur le planning papier (feature 0012) : fond = couleur
 * de la personne, texte = repère (initiale(s)). Le nom complet est porté en
 * texte invisible pour les lecteurs d'écran. Aucune logique : tout vient de
 * `PersonneDiffusion` (voir `@/domain/diffusion.js`).
 */
export default {
  name: 'RepereDiffusion',
  props: {
    /** @type {import('vue').PropType<import('@/domain/diffusion.js').PersonneDiffusion>} */
    personne: { type: Object, required: true },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.repere-diffusion {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6em;
  padding: 0 0.3em;
  border: 1px solid t.$couleur-texte;
  border-radius: t.$rayon-sm;
  font-size: t.$impression-taille-texte;
  font-weight: t.$graisse-gras;
  line-height: 1.5;
  color: t.$couleur-texte;
  background-color: t.$couleur-fond-clair;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;

  &--texte-inverse {
    color: t.$couleur-texte-inverse;
  }
}
</style>
