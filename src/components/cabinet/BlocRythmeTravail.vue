<template>
  <form novalidate @submit.prevent>
    <h2>Rythme de travail</h2>

    <div class="row g-3">
      <div class="col-sm-6">
        <label for="repos-hebdo-min" class="form-label">Jours de repos par semaine (minimum)</label>
        <input
          id="repos-hebdo-min"
          v-model.number="brouillon.reposHebdoMin"
          type="number"
          min="0"
          max="7"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': v$.brouillon.reposHebdoMin.$error }"
          :aria-describedby="
            describedBy('repos-hebdo-min-aide', v$.brouillon.reposHebdoMin.$error ? 'repos-hebdo-min-erreur' : null)
          "
          @change="onReposHebdoMinChange"
          @blur="v$.brouillon.reposHebdoMin.$touch()"
        >
        <div id="repos-hebdo-min-aide" class="form-text">
          Nombre minimum de jours de repos à respecter chaque semaine.
        </div>
        <p v-if="v$.brouillon.reposHebdoMin.$error" id="repos-hebdo-min-erreur" class="bloc-rythme__erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.brouillon.reposHebdoMin.$errors[0].$message }}</span>
        </p>
      </div>

      <div class="col-sm-6">
        <label for="max-jours-consecutifs" class="form-label">
          Jours de travail consécutifs (maximum)
        </label>
        <input
          id="max-jours-consecutifs"
          v-model.number="brouillon.maxJoursConsecutifs"
          type="number"
          min="1"
          max="7"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': v$.brouillon.maxJoursConsecutifs.$error }"
          :aria-describedby="
            describedBy(
              'max-jours-consecutifs-aide',
              v$.brouillon.maxJoursConsecutifs.$error ? 'max-jours-consecutifs-erreur' : null
            )
          "
          @change="onMaxJoursConsecutifsChange"
          @blur="v$.brouillon.maxJoursConsecutifs.$touch()"
        >
        <div id="max-jours-consecutifs-aide" class="form-text">
          Nombre maximum de jours travaillés d'affilée.
        </div>
        <p
          v-if="v$.brouillon.maxJoursConsecutifs.$error"
          id="max-jours-consecutifs-erreur"
          class="bloc-rythme__erreur"
        >
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.brouillon.maxJoursConsecutifs.$errors[0].$message }}</span>
        </p>
      </div>
    </div>

    <div
      v-if="avertissementsCoherence.length"
      class="alert alert-warning d-flex gap-2 mt-3 mb-0"
      role="status"
      aria-live="polite"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <div>
        <p v-for="(message, index) in avertissementsCoherence" :key="index" class="mb-0">
          {{ message }}
        </p>
      </div>
    </div>
  </form>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import { useVuelidate } from '@vuelidate/core';
import { required, between, integer, helpers } from '@vuelidate/validators';
import { PhWarning } from '@phosphor-icons/vue';

import { coherenceParametres } from '@/domain/cabinet.js';

/**
 * Bloc « Rythme de travail » de la page Cabinet (déplacé depuis Paramètres,
 * features 0003 puis 0039). Brouillon local, enregistré via
 * `cabinet/majParametres` seulement s'il est valide (Vuelidate). Un
 * avertissement de cohérence (jamais bloquant) accompagne la saisie.
 */
export default {
  name: 'BlocRythmeTravail',
  components: { PhWarning },
  setup() {
    // Pont requis par Vuelidate 2 en Options API (ADR 0011).
    return { v$: useVuelidate() };
  },
  data() {
    return {
      brouillon: { reposHebdoMin: 2, maxJoursConsecutifs: 6 },
    };
  },
  computed: {
    ...mapGetters('cabinet', ['parametres']),
    avertissementsCoherence() {
      return coherenceParametres(this.brouillon).avertissements;
    },
  },
  created() {
    const { reposHebdoMin, maxJoursConsecutifs } = this.parametres;
    this.brouillon = { reposHebdoMin, maxJoursConsecutifs };
  },
  validations() {
    return {
      brouillon: {
        reposHebdoMin: {
          required: helpers.withMessage(
            'Indiquez un nombre de jours de repos entre 0 et 7.',
            required
          ),
          integer: helpers.withMessage(
            'Indiquez un nombre entier de jours (sans virgule).',
            integer
          ),
          between: helpers.withMessage(
            'Indiquez un nombre de jours de repos entre 0 et 7.',
            between(0, 7)
          ),
        },
        maxJoursConsecutifs: {
          required: helpers.withMessage(
            'Indiquez un maximum de jours consécutifs entre 1 et 7.',
            required
          ),
          integer: helpers.withMessage(
            'Indiquez un nombre entier de jours consécutifs (sans virgule).',
            integer
          ),
          between: helpers.withMessage(
            'Indiquez un maximum de jours consécutifs entre 1 et 7.',
            between(1, 7)
          ),
        },
      },
    };
  },
  methods: {
    ...mapActions('cabinet', ['majParametres']),

    /**
     * Construit une valeur `aria-describedby` à partir d'identifiants
     * optionnels (aide, erreur…), en ignorant ceux qui valent `null`/`''`.
     * Renvoie `null` (attribut retiré du DOM) si aucun id n'est fourni.
     * @param {...(string|null)} ids
     * @returns {string|null}
     */
    describedBy(...ids) {
      const valides = ids.filter(Boolean);
      return valides.length ? valides.join(' ') : null;
    },

    onReposHebdoMinChange() {
      this.v$.brouillon.reposHebdoMin.$touch();
      if (!this.v$.brouillon.reposHebdoMin.$invalid) {
        this.majParametres({ reposHebdoMin: this.brouillon.reposHebdoMin });
      }
    },
    onMaxJoursConsecutifsChange() {
      this.v$.brouillon.maxJoursConsecutifs.$touch();
      if (!this.v$.brouillon.maxJoursConsecutifs.$invalid) {
        this.majParametres({ maxJoursConsecutifs: this.brouillon.maxJoursConsecutifs });
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

// Cible cliquable confortable, cohérente avec les cases à cocher.
.form-control {
  min-height: t.$cible-cliquable-min;
}

.bloc-rythme__erreur {
  @include m.message-erreur-champ;
}
</style>
