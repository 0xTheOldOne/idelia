<template>
  <div class="cabinet-view">
    <h1>Cabinet</h1>
    <p class="cabinet-intro">
      Les informations de votre cabinet. Elles servent à préparer le planning ; le nom, l'adresse
      et le logo figureront en en-tête des contrats et des avenants. Tout est enregistré
      automatiquement.
    </p>

    <div
      v-if="statutSauvegarde === 'ERREUR_CHARGEMENT'"
      class="alert alert-warning d-flex gap-2"
      role="alert"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Vos réglages enregistrés n'ont pas pu être relus ; les valeurs par défaut sont affichées.
        Une copie de sauvegarde a été conservée. Rechargez la page pour réessayer ; si le problème
        persiste, réimportez une sauvegarde.
      </p>
    </div>

    <section class="cabinet-section">
      <h2>Identité du cabinet</h2>
      <BlocIdentiteCabinet />
    </section>

    <section class="cabinet-section">
      <BlocLogoCabinet />
    </section>

    <section class="cabinet-section">
      <BlocJoursOuverture />
    </section>

    <section class="cabinet-section">
      <BlocCreneauxTravail />
    </section>

    <section class="cabinet-section">
      <BlocRythmeTravail />
    </section>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import { PhWarning } from '@phosphor-icons/vue';

import BlocIdentiteCabinet from '@/components/cabinet/BlocIdentiteCabinet.vue';
import BlocLogoCabinet from '@/components/cabinet/BlocLogoCabinet.vue';
import BlocJoursOuverture from '@/components/cabinet/BlocJoursOuverture.vue';
import BlocCreneauxTravail from '@/components/cabinet/BlocCreneauxTravail.vue';
import BlocRythmeTravail from '@/components/cabinet/BlocRythmeTravail.vue';

/**
 * Écran « Cabinet » (feature 0039) : identité du cabinet et règles
 * d'organisation (jours d'ouverture, créneaux, rythme de travail, déplacés
 * depuis Paramètres). Vue conteneur légère : chaque bloc gère son brouillon
 * et sa validation, et enregistre tout seul via `cabinet/majParametres`.
 */
export default {
  name: 'CabinetView',
  components: {
    BlocIdentiteCabinet,
    BlocLogoCabinet,
    BlocJoursOuverture,
    BlocCreneauxTravail,
    BlocRythmeTravail,
    PhWarning,
  },
  computed: {
    ...mapState(['statutSauvegarde']),
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.cabinet-intro {
  color: t.$couleur-texte-attenue;
}

.cabinet-section {
  margin-bottom: t.$espace-5;
  padding-bottom: t.$espace-4;
  border-bottom: 1px solid t.$couleur-bordure;

  &:last-child {
    border-bottom: none;
  }
}
</style>
