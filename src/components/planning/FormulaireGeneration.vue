<template>
  <form class="formulaire-generation" novalidate @submit.prevent="soumettre">
    <div class="row g-3 mb-2">
      <div class="col-sm-6">
        <label for="generation-date-debut" class="form-label">Du</label>
        <input
          id="generation-date-debut"
          v-model="formulaire.dateDebut"
          type="date"
          class="form-control"
          :class="{ 'is-invalid': v$.formulaire.dateDebut.$error }"
          :aria-describedby="v$.formulaire.dateDebut.$error ? 'generation-date-debut-erreur' : null"
          @blur="v$.formulaire.dateDebut.$touch()"
        >
        <p
          v-if="v$.formulaire.dateDebut.$error"
          id="generation-date-debut-erreur"
          class="formulaire-erreur"
        >
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.dateDebut.$errors[0].$message }}</span>
        </p>
      </div>

      <div class="col-sm-6">
        <label for="generation-date-fin" class="form-label">Au (inclus)</label>
        <input
          id="generation-date-fin"
          v-model="formulaire.dateFin"
          type="date"
          class="form-control"
          :class="{ 'is-invalid': v$.formulaire.dateFin.$error }"
          :aria-describedby="ariaDescribedbyDateFin"
          @blur="v$.formulaire.dateFin.$touch()"
        >
        <p
          v-if="v$.formulaire.dateFin.$error"
          id="generation-date-fin-erreur"
          class="formulaire-erreur"
        >
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.dateFin.$errors[0].$message }}</span>
        </p>
      </div>
    </div>

    <div v-if="periodeTresLongue" id="generation-periode-aide" class="form-text mb-3">
      La grille sera très large ; l'affichage Mois reste conseillé.
    </div>

    <p
      v-if="soumissionInvalide && v$.$invalid"
      class="formulaire-erreur mb-3"
      role="status"
      aria-live="polite"
    >
      <PhWarning :size="14" weight="bold" aria-hidden="true" />
      <span>Certains champs sont à corriger.</span>
    </p>

    <button
      type="submit"
      class="btn btn-primary btn-lg formulaire-generation-bouton"
      :disabled="chargement"
    >
      <PhMagicWand :size="22" weight="bold" aria-hidden="true" />
      <span>{{ chargement ? 'Génération en cours…' : 'Générer le planning' }}</span>
    </button>
  </form>
</template>

<script>
import { useVuelidate } from '@vuelidate/core';
import { required, helpers } from '@vuelidate/validators';
import { PhWarning, PhMagicWand } from '@phosphor-icons/vue';

import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Formulaire présentational du choix de période, pour lancer une génération
 * de planning (feature 010).
 *
 * N'accède **pas** au store : reçoit `chargement` en prop et **émet**
 * `generer({ dateDebut, dateFin })` à la soumission, si valide. C'est l'écran
 * appelant (`PlanningView`) qui dispatche vers le store (`plannings/genererPropose`).
 *
 * Calqué sur `FormulaireAbsence` pour la structure Vuelidate (messages FR
 * affichés après interaction, recalage automatique de `dateFin`).
 */
export default {
  name: 'FormulaireGeneration',
  components: { PhWarning, PhMagicWand },
  props: {
    /** `true` pendant l'appel au moteur : désactive le bouton, change son libellé. */
    chargement: { type: Boolean, default: false },
  },
  emits: ['generer'],
  setup() {
    // Seul usage de la Composition API : pont requis par Vuelidate 2 en
    // Options API (ADR 0011), comme dans FormulaireAbsence/FormulaireTournee.
    return { v$: useVuelidate() };
  },
  data() {
    return {
      formulaire: this.construireFormulaireParDefaut(),
      // `true` après une tentative de soumission bloquée par la validation.
      soumissionInvalide: false,
    };
  },
  computed: {
    /**
     * Garde souple, non bloquante (§7) : au-delà d'~3 mois, la grille sera
     * très large. Simple avertissement, ne bloque jamais la génération.
     */
    periodeTresLongue() {
      const { dateDebut, dateFin } = this.formulaire;
      if (!dateDebut || !dateFin || dateFin < dateDebut) return false;
      return dateUtil.diffDays(dateDebut, dateFin) > 92;
    },
    /**
     * `aria-describedby` du champ `dateFin` : combine l'id du message
     * d'erreur (si présent) et celui de l'aide « période très longue » (si
     * visible), sans jamais en perdre un des deux.
     * @returns {?string}
     */
    ariaDescribedbyDateFin() {
      const ids = [];
      if (this.v$.formulaire.dateFin.$error) ids.push('generation-date-fin-erreur');
      if (this.periodeTresLongue) ids.push('generation-periode-aide');
      return ids.length ? ids.join(' ') : null;
    },
  },
  watch: {
    /**
     * Nicety (comme `FormulaireAbsence`) : si la date de fin devient
     * vide/antérieure après édition de la date de début, on la recale.
     */
    'formulaire.dateDebut'(nouvelleValeur) {
      if (!nouvelleValeur) return;
      if (!this.formulaire.dateFin || this.formulaire.dateFin < nouvelleValeur) {
        this.formulaire.dateFin = nouvelleValeur;
      }
    },
  },
  validations() {
    return {
      formulaire: {
        dateDebut: {
          required: helpers.withMessage('Indiquez la date de début.', required),
        },
        dateFin: {
          required: helpers.withMessage('Indiquez la date de fin.', required),
          coherence: helpers.withMessage(
            'La date de fin doit être identique ou postérieure à la date de début.',
            (valeur, parent) => !parent.dateDebut || !valeur || valeur >= parent.dateDebut
          ),
        },
      },
    };
  },
  methods: {
    /**
     * Valeurs par défaut du formulaire : lundi de la semaine prochaine →
     * dimanche suivant (semaine complète), calculées via `dateUtil` (§7).
     * @returns {{ dateDebut: string, dateFin: string }}
     */
    construireFormulaireParDefaut() {
      const aujourdhui = dateUtil.format(new Date());
      const dateDebut = dateUtil.addDays(
        aujourdhui,
        ((8 - dateUtil.weekdayISO(aujourdhui)) % 7) || 7
      );
      const dateFin = dateUtil.addDays(dateDebut, 6);
      return { dateDebut, dateFin };
    },

    soumettre() {
      this.v$.$touch();
      if (this.v$.$invalid) {
        this.soumissionInvalide = true;
        return;
      }
      this.soumissionInvalide = false;

      this.$emit('generer', {
        dateDebut: this.formulaire.dateDebut,
        dateFin: this.formulaire.dateFin,
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

// Cible cliquable confortable, cohérente avec le reste de l'application.
.form-control {
  min-height: t.$cible-cliquable-min;
}

.formulaire-generation-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.formulaire-erreur {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-1;
  margin: t.$espace-2 0 0;
  color: t.$couleur-erreur;
  font-size: t.$taille-texte-petite;

  svg {
    flex-shrink: 0;
    margin-top: 0.15em;
  }
}
</style>
