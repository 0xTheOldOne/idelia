<template>
  <div class="parametres-view">
    <h1>Paramètres</h1>

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

    <form novalidate @submit.prevent>
      <!-- Affichage -->
      <section class="parametres-section">
        <h2>Affichage</h2>

        <label for="premier-jour-semaine" class="form-label">Premier jour de la semaine (affichage)</label>
        <select
          id="premier-jour-semaine"
          v-model.number="brouillon.premierJourSemaine"
          class="form-select parametres-select"
          @change="onPremierJourSemaineChange"
        >
          <option v-for="jour in JOURS_SEMAINE" :key="jour.iso" :value="jour.iso">
            {{ jour.libelle }}
          </option>
        </select>
        <div class="form-text">Utilisé pour l'affichage du calendrier.</div>
      </section>
    </form>

    <!-- Apparence (feature 0038) : préférence d'UI appliquée tout de suite, hors Vuelidate -->
    <section class="parametres-section">
      <h2>Apparence</h2>
      <BlocApparence />
    </section>

    <!-- Vacances scolaires (feature 0023) : zone enregistrée tout de suite, hors Vuelidate -->
    <section class="parametres-section">
      <BlocVacancesScolaires />
    </section>

    <!-- Sauvegarde (hors formulaire : ce n'est pas un réglage saisi mais une action) -->
    <section class="parametres-section">
      <h2>Sauvegarde</h2>
      <BlocSauvegarde @donnees-remplacees="onDonneesRemplacees" />
    </section>

    <!-- Sauvegarde automatique (feature 0019) : préférence d'UI, hors formulaire/Vuelidate -->
    <section class="parametres-section">
      <h2>Sauvegarde automatique</h2>
      <BlocSauvegardeAutomatique />
    </section>
  </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex';
import { PhWarning } from '@phosphor-icons/vue';

import BlocApparence from '@/components/parametres/BlocApparence.vue';
import BlocSauvegarde from '@/components/parametres/BlocSauvegarde.vue';
import BlocSauvegardeAutomatique from '@/components/parametres/BlocSauvegardeAutomatique.vue';
import BlocVacancesScolaires from '@/components/parametres/BlocVacancesScolaires.vue';
import { JOURS_SEMAINE } from '@/domain/libelles.js';

/**
 * Écran « Paramètres » (features 0003, 0039) : réglages de l'application
 * (affichage, apparence, vacances scolaires, sauvegardes). Les rubriques qui
 * décrivent le cabinet (jours d'ouverture, créneaux, rythme de travail)
 * vivent désormais dans `CabinetView` (feature 0039).
 *
 * Le premier jour de la semaine est une liste fermée : aucune saisie libre,
 * donc pas de Vuelidate. Le `brouillon` local copie le réglage du store et
 * est réhydraté après une restauration de sauvegarde.
 */
export default {
  name: 'ParametresView',
  components: { BlocApparence, BlocSauvegarde, BlocSauvegardeAutomatique, BlocVacancesScolaires, PhWarning },
  data() {
    return {
      JOURS_SEMAINE,
      brouillon: {
        premierJourSemaine: 1,
      },
    };
  },
  computed: {
    ...mapGetters('cabinet', ['parametres']),
    ...mapState(['statutSauvegarde']),
  },
  created() {
    // Le bootstrap (voir `main.js`) est terminé avant le montage : le
    // getter contient déjà les paramètres (par défaut ou persistés).
    this.brouillon.premierJourSemaine = this.parametres.premierJourSemaine;
  },
  methods: {
    ...mapActions('cabinet', ['majParametres']),

    onPremierJourSemaineChange() {
      // Liste fermée (7 jours ISO) : aucune saisie libre, donc pas de
      // règle de validation à vérifier avant l'enregistrement.
      this.majParametres({ premierJourSemaine: this.brouillon.premierJourSemaine });
    },

    /**
     * Après une restauration ou un effacement réussis (`BlocSauvegarde`),
     * le `brouillon` local (copié depuis `this.parametres` en `created`) est
     * périmé : on le réhydrate depuis le store pour que le formulaire
     * reflète immédiatement les nouvelles valeurs, sans rechargement de page.
     */
    onDonneesRemplacees() {
      this.brouillon.premierJourSemaine = this.parametres.premierJourSemaine;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.parametres-section {
  margin-bottom: t.$espace-5;
  padding-bottom: t.$espace-4;
  border-bottom: 1px solid t.$couleur-bordure;

  &:last-child {
    border-bottom: none;
  }
}

// La section « Sauvegarde » vit hors du `<form>` : sans ceci, la dernière
// section du formulaire (« Affichage ») serait `:last-child` de son parent et
// perdrait son trait de séparation avant « Apparence ». On le lui rend.
form .parametres-section:last-child {
  border-bottom: 1px solid t.$couleur-bordure;
}

.parametres-select {
  max-width: 20rem;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.form-select {
  min-height: t.$cible-cliquable-min;
}
</style>
