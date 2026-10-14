<template>
  <section class="legende-diffusion" aria-label="Légende">
    <div v-if="personnes.length > 0" class="legende-diffusion-bloc">
      <h3 class="legende-diffusion-titre">Personnes</h3>
      <ul class="legende-diffusion-liste">
        <li v-for="personne in personnes" :key="personne.personneId" class="legende-diffusion-item">
          <RepereDiffusion :personne="personne" />
          <span>{{ personne.nomComplet }}</span>
        </li>
      </ul>
    </div>

    <div v-if="colonnes.length > 0" class="legende-diffusion-bloc">
      <h3 class="legende-diffusion-titre">Tournées</h3>
      <ul class="legende-diffusion-liste">
        <li v-for="colonne in colonnes" :key="colonne.tourneeId" class="legende-diffusion-item">
          <PastilleTournee :couleur="colonne.couleur" :icone="colonne.icone" taille="impression" />
          <span>
            <strong>{{ colonne.libelle }}</strong>
            <template v-if="colonne.coupee">
              (coupée :
              <template v-for="(segment, i) in colonne.segments" :key="segment.index">
                <template v-if="i > 0">, </template>{{ segment.libelleVacation.toLowerCase() }}
                {{ segment.horaires }}</template>)
            </template>
            <template v-else> ({{ colonne.horaires }})</template>
          </span>
        </li>
      </ul>
    </div>

    <div class="legende-diffusion-bloc">
      <h3 class="legende-diffusion-titre">Repères</h3>
      <ul class="legende-diffusion-liste">
        <li
          v-for="repere in reperes"
          :key="repere.code"
          class="legende-diffusion-item"
        >
          <span
            class="legende-diffusion-echantillon"
            :class="'legende-diffusion-echantillon--' + repere.code.toLowerCase().replaceAll('_', '-')"
            aria-hidden="true"
          >{{ repere.court }}</span>
          <span>{{ repere.libelle }}</span>
        </li>
        <li class="legende-diffusion-item">
          <span class="legende-diffusion-echantillon" aria-hidden="true">—</span>
          <span>Pas de tournée ce jour</span>
        </li>
        <li v-if="aJourFerme" class="legende-diffusion-item">
          <span class="legende-diffusion-echantillon" aria-hidden="true">Fermé</span>
          <span>Cabinet fermé</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script>
import PastilleTournee from '@/components/communs/PastilleTournee.vue';
import RepereDiffusion from '@/components/diffusion/RepereDiffusion.vue';

/**
 * Légende du planning papier (feature 0012), reprise sur chaque page :
 * personnes (repère + couleur + nom complet), tournées (libellé complet +
 * horaires) et repères calendaires. Aucune logique métier.
 */
export default {
  name: 'LegendeDiffusion',
  components: { PastilleTournee, RepereDiffusion },
  props: {
    /** @type {import('vue').PropType<import('@/domain/diffusion.js').PersonneDiffusion[]>} */
    personnes: { type: Array, required: true },
    /** @type {import('vue').PropType<import('@/domain/diffusion.js').ColonneTournee[]>} */
    colonnes: { type: Array, required: true },
    /** @type {import('vue').PropType<import('@/domain/diffusion.js').RepereJour[]>} */
    reperes: { type: Array, required: true },
    /** Au moins une ligne « Fermé » sur cette page : ajoute l'entrée de légende. */
    aJourFerme: { type: Boolean, default: false },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.legende-diffusion {
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
  margin-top: t.$espace-3;
  padding-top: t.$espace-2;
  border-top: 1px solid t.$couleur-bordure;
  font-size: t.$impression-taille-texte-petite;
  color: t.$couleur-texte;
  break-inside: avoid;
}

.legende-diffusion-titre {
  margin: 0 0 2px;
  font-size: t.$impression-taille-texte;
  font-weight: t.$graisse-gras;
}

.legende-diffusion-liste {
  display: flex;
  flex-wrap: wrap;
  gap: 2px t.$espace-3;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legende-diffusion-item {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
}

.legende-diffusion-echantillon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.6em;
  padding: 0 0.3em;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-sm;
  color: t.$couleur-texte-attenue;

  &--dimanche {
    font-weight: t.$graisse-gras;
    color: t.$couleur-texte;
    background-color: t.$impression-fond-repere-dimanche;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
