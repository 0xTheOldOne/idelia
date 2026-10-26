<template>
  <form novalidate @submit.prevent>
    <fieldset
      role="group"
      :aria-describedby="v$.brouillon.creneauxActifs.$error ? 'creneaux-erreur' : null"
    >
      <legend class="bloc-creneaux__legende">
        <h2>Créneaux de travail</h2>
      </legend>

      <div class="d-flex flex-wrap gap-3">
        <div v-for="code in CRENEAUX" :key="code" class="form-check bloc-creneaux__case">
          <input
            :id="'creneau-' + code"
            v-model="brouillon.creneauxActifs"
            :value="code"
            type="checkbox"
            class="form-check-input"
            @change="onCreneauxActifsChange"
          >
          <label class="form-check-label" :for="'creneau-' + code">{{ libelleCreneau(code) }}</label>
        </div>
      </div>

      <p v-if="v$.brouillon.creneauxActifs.$error" id="creneaux-erreur" class="bloc-creneaux__erreur">
        <PhWarning :size="14" weight="bold" aria-hidden="true" />
        <span>{{ v$.brouillon.creneauxActifs.$errors[0].$message }}</span>
      </p>
    </fieldset>
  </form>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { PhWarning } from '@phosphor-icons/vue';

import { libelleCreneau } from '@/domain/libelles.js';
import { CRENEAUX } from '@/domain/schema.js';

/**
 * Bloc « Créneaux de travail » de la page Cabinet (déplacé depuis
 * Paramètres, features 0003 puis 0039). Brouillon local, enregistré via
 * `cabinet/majParametres` seulement s'il est valide (Vuelidate).
 */
export default {
  name: 'BlocCreneauxTravail',
  components: { PhWarning },
  setup() {
    // Pont requis par Vuelidate 2 en Options API (ADR 0011).
    return { v$: useVuelidate() };
  },
  data() {
    return {
      CRENEAUX,
      brouillon: { creneauxActifs: [] },
    };
  },
  computed: {
    ...mapGetters('cabinet', ['parametres']),
  },
  created() {
    this.brouillon = { creneauxActifs: [...this.parametres.creneauxActifs] };
  },
  validations() {
    return {
      brouillon: {
        creneauxActifs: {
          required: helpers.withMessage('Cochez au moins un créneau de travail.', required),
        },
      },
    };
  },
  methods: {
    ...mapActions('cabinet', ['majParametres']),
    libelleCreneau,

    onCreneauxActifsChange() {
      this.v$.brouillon.creneauxActifs.$touch();
      if (!this.v$.brouillon.creneauxActifs.$invalid) {
        this.majParametres({ creneauxActifs: [...this.brouillon.creneauxActifs] });
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/mixins' as m;

.bloc-creneaux__case {
  @include m.case-confortable;
}

.bloc-creneaux__legende {
  @include m.legende-titre;
}

.bloc-creneaux__erreur {
  @include m.message-erreur-champ;
}
</style>
