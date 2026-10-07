<template>
  <article class="feuille-diffusion">
    <header class="feuille-diffusion-entete">
      <div class="feuille-diffusion-textes">
        <p class="feuille-diffusion-titre">{{ diffusion.titre }}</p>
        <p class="feuille-diffusion-sous-titre">{{ diffusion.sousTitre }}</p>
        <p v-if="diffusion.miseAJourTexte" class="feuille-diffusion-maj">
          Mise à jour du
          <time :datetime="diffusion.miseAJourIso">{{ diffusion.miseAJourTexte }}</time>
        </p>
        <p v-if="nbPages > 1" class="feuille-diffusion-page">Page {{ numeroPage }} / {{ nbPages }}</p>
      </div>
      <img class="feuille-diffusion-logo" :src="urlLogo" alt="">
    </header>

    <div class="feuille-diffusion-mois">
      <MoisDiffusion
        v-for="moisCourant in mois"
        :key="moisCourant.cle"
        :mois="moisCourant"
        :colonnes="diffusion.colonnes"
      />
    </div>

    <LegendeDiffusion
      :personnes="diffusion.legendePersonnes"
      :colonnes="diffusion.colonnes"
      :reperes="diffusion.legendeReperes"
      :a-jour-ferme="aJourFerme"
    />
  </article>
</template>

<script>
import MoisDiffusion from '@/components/diffusion/MoisDiffusion.vue';
import LegendeDiffusion from '@/components/diffusion/LegendeDiffusion.vue';

/**
 * Une page (feuille A4) du planning papier (feature 0012) : en-tête (titre,
 * sous-titre, mise à jour, pagination, logo à droite), mois côte à côte, puis
 * légende. Aucune logique métier ; saut de page après chaque feuille sauf la
 * dernière.
 */
export default {
  name: 'FeuilleDiffusion',
  components: { MoisDiffusion, LegendeDiffusion },
  props: {
    /** @type {import('vue').PropType<import('@/domain/diffusion.js').Diffusion>} */
    diffusion: { type: Object, required: true },
    /** @type {import('vue').PropType<import('@/domain/diffusion.js').MoisDiffusion[]>} */
    mois: { type: Array, required: true },
    numeroPage: { type: Number, default: 1 },
    nbPages: { type: Number, default: 1 },
  },
  computed: {
    urlLogo() {
      return `${import.meta.env.BASE_URL}logo.png`;
    },
    /** Au moins une ligne « Fermé » sur cette feuille (pour la légende). */
    aJourFerme() {
      return this.mois.some((m) => m.jours.some((j) => j.ligneFermee));
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.feuille-diffusion {
  box-sizing: border-box;
  width: t.$impression-largeur-feuille;
  max-width: none;
  margin: 0 auto t.$espace-4;
  padding: t.$impression-marge-page;
  background-color: t.$couleur-fond;
  box-shadow: t.$ombre-legere;
  color: t.$couleur-texte;
  font-size: t.$impression-taille-texte;
}

.feuille-diffusion-entete {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-3;

  p {
    margin: 0;
  }
}

.feuille-diffusion-titre {
  font-size: t.$impression-taille-titre;
  font-weight: t.$graisse-extra-gras;
  line-height: 1.2;
}

.feuille-diffusion-sous-titre {
  font-size: t.$impression-taille-sous-titre;
  font-weight: t.$graisse-moyenne;
}

.feuille-diffusion-maj,
.feuille-diffusion-page {
  font-size: t.$impression-taille-texte;
  color: t.$couleur-texte-attenue;
}

.feuille-diffusion-logo {
  flex-shrink: 0;
  margin-left: auto;
  height: t.$impression-hauteur-logo;
  width: auto;
}

.feuille-diffusion-mois {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-2;
}

@media print {
  .feuille-diffusion {
    width: auto;
    margin: 0;
    padding: 0;
    box-shadow: none;
    break-after: page;

    &:last-child {
      break-after: auto;
    }
  }
}
</style>
