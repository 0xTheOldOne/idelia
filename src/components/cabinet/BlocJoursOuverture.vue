<template>
  <form novalidate @submit.prevent>
    <fieldset
      role="group"
      :aria-describedby="v$.brouillon.joursOuverture.$error ? 'jours-ouverture-erreur' : null"
    >
      <legend class="bloc-jours__legende">
        <h2>Jours d'ouverture</h2>
      </legend>

      <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-3">
        <div v-for="jour in JOURS_SEMAINE" :key="jour.iso" class="col">
          <div class="form-check bloc-jours__case">
            <input
              :id="'jour-' + jour.iso"
              v-model="brouillon.joursOuverture"
              :value="jour.iso"
              type="checkbox"
              class="form-check-input"
              @change="onJoursOuvertureChange"
            >
            <label class="form-check-label" :for="'jour-' + jour.iso">{{ jour.libelle }}</label>
          </div>
        </div>
      </div>

      <p v-if="v$.brouillon.joursOuverture.$error" id="jours-ouverture-erreur" class="bloc-jours__erreur">
        <PhWarning :size="14" weight="bold" aria-hidden="true" />
        <span>{{ v$.brouillon.joursOuverture.$errors[0].$message }}</span>
      </p>
    </fieldset>
  </form>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { PhWarning } from '@phosphor-icons/vue';

import { JOURS_SEMAINE } from '@/domain/libelles.js';

/**
 * Bloc « Jours d'ouverture » de la page Cabinet (déplacé depuis Paramètres,
 * features 0003 puis 0039). Brouillon local, enregistré via
 * `cabinet/majParametres` seulement s'il est valide (Vuelidate).
 */
export default {
  name: 'BlocJoursOuverture',
  components: { PhWarning },
  setup() {
    // Seul usage de la Composition API : pont requis par Vuelidate 2 en
    // Options API (ADR 0011). Le reste du composant reste en Options API.
    return { v$: useVuelidate() };
  },
  data() {
    return {
      JOURS_SEMAINE,
      brouillon: { joursOuverture: [] },
    };
  },
  computed: {
    ...mapGetters('cabinet', ['parametres']),
  },
  created() {
    this.brouillon = { joursOuverture: [...this.parametres.joursOuverture] };
  },
  validations() {
    return {
      brouillon: {
        joursOuverture: {
          required: helpers.withMessage("Cochez au moins un jour d'ouverture.", required),
        },
      },
    };
  },
  methods: {
    ...mapActions('cabinet', ['majParametres']),

    onJoursOuvertureChange() {
      this.v$.brouillon.joursOuverture.$touch();
      if (!this.v$.brouillon.joursOuverture.$invalid) {
        this.majParametres({ joursOuverture: [...this.brouillon.joursOuverture] });
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as m;

.bloc-jours__case {
  @include m.case-confortable;
}

.bloc-jours__legende {
  @include m.legende-titre;
}

.bloc-jours__erreur {
  @include m.message-erreur-champ;
}
</style>
