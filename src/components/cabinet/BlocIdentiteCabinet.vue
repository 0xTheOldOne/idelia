<template>
  <form novalidate @submit.prevent>
    <div class="row g-3">
      <div class="col-12">
        <label for="cabinet-nom" class="form-label">Nom du cabinet</label>
        <input
          id="cabinet-nom"
          v-model="brouillon.nomCabinet"
          v-debounce:600ms.fireonempty="enregistrerNom"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': v$.brouillon.nomCabinet.$error }"
          :aria-describedby="v$.brouillon.nomCabinet.$error ? 'cabinet-nom-erreur' : null"
          autocomplete="organization"
          placeholder="ex. Cabinet infirmier des Tilleuls"
          @change="enregistrerNom"
        >
        <p v-if="v$.brouillon.nomCabinet.$error" id="cabinet-nom-erreur" class="bloc-identite__erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.brouillon.nomCabinet.$errors[0].$message }}</span>
        </p>
      </div>

      <div class="col-12">
        <label for="cabinet-adresse-ligne1" class="form-label">Adresse</label>
        <input
          id="cabinet-adresse-ligne1"
          v-model="brouillon.adresse.ligne1"
          v-debounce:600ms.fireonempty="enregistrerAdresse"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': v$.brouillon.adresse.ligne1.$error }"
          :aria-describedby="v$.brouillon.adresse.ligne1.$error ? 'cabinet-adresse-ligne1-erreur' : null"
          autocomplete="address-line1"
          placeholder="ex. 12 rue des Lilas"
          @change="enregistrerAdresse"
        >
        <p
          v-if="v$.brouillon.adresse.ligne1.$error"
          id="cabinet-adresse-ligne1-erreur"
          class="bloc-identite__erreur"
        >
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.brouillon.adresse.ligne1.$errors[0].$message }}</span>
        </p>
      </div>

      <div class="col-12">
        <label for="cabinet-adresse-ligne2" class="form-label">Complément d'adresse (facultatif)</label>
        <input
          id="cabinet-adresse-ligne2"
          v-model="brouillon.adresse.ligne2"
          v-debounce:600ms.fireonempty="enregistrerAdresse"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': v$.brouillon.adresse.ligne2.$error }"
          :aria-describedby="v$.brouillon.adresse.ligne2.$error ? 'cabinet-adresse-ligne2-erreur' : null"
          autocomplete="address-line2"
          placeholder="ex. Bâtiment B, 1er étage"
          @change="enregistrerAdresse"
        >
        <p
          v-if="v$.brouillon.adresse.ligne2.$error"
          id="cabinet-adresse-ligne2-erreur"
          class="bloc-identite__erreur"
        >
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.brouillon.adresse.ligne2.$errors[0].$message }}</span>
        </p>
      </div>

      <div class="col-sm-4">
        <label for="cabinet-code-postal" class="form-label">Code postal</label>
        <input
          id="cabinet-code-postal"
          v-model="brouillon.adresse.codePostal"
          v-debounce:600ms.fireonempty="enregistrerAdresse"
          type="text"
          inputmode="numeric"
          :maxlength="LONGUEURS_MAX_ADRESSE.codePostal"
          class="form-control"
          :class="{ 'is-invalid': v$.brouillon.adresse.codePostal.$error }"
          :aria-describedby="v$.brouillon.adresse.codePostal.$error ? 'cabinet-code-postal-erreur' : null"
          autocomplete="postal-code"
          @change="enregistrerAdresse"
        >
        <p
          v-if="v$.brouillon.adresse.codePostal.$error"
          id="cabinet-code-postal-erreur"
          class="bloc-identite__erreur"
        >
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.brouillon.adresse.codePostal.$errors[0].$message }}</span>
        </p>
      </div>

      <div class="col-sm-8">
        <label for="cabinet-ville" class="form-label">Ville</label>
        <input
          id="cabinet-ville"
          v-model="brouillon.adresse.ville"
          v-debounce:600ms.fireonempty="enregistrerAdresse"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': v$.brouillon.adresse.ville.$error }"
          :aria-describedby="v$.brouillon.adresse.ville.$error ? 'cabinet-ville-erreur' : null"
          autocomplete="address-level2"
          @change="enregistrerAdresse"
        >
        <p v-if="v$.brouillon.adresse.ville.$error" id="cabinet-ville-erreur" class="bloc-identite__erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.brouillon.adresse.ville.$errors[0].$message }}</span>
        </p>
      </div>
    </div>
  </form>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import { useVuelidate } from '@vuelidate/core';
import { maxLength, helpers } from '@vuelidate/validators';
import { PhWarning } from '@phosphor-icons/vue';

import { LONGUEUR_MAX_NOM_CABINET } from '@/domain/cabinet.js';
import {
  LONGUEURS_MAX_ADRESSE,
  estCodePostalValide,
  normaliserAdresse,
  normaliserCodePostal,
} from '@/domain/adresse.js';

const MESSAGE_LIGNE = "Cette ligne d'adresse ne doit pas dépasser " + LONGUEURS_MAX_ADRESSE.ligne1 + ' caractères.';

/**
 * Bloc « Identité du cabinet » (nom et adresse) de la page Cabinet (0039).
 * Brouillon local ; enregistrement pendant la frappe (débounce 600 ms) et à la
 * perte de focus, via `cabinet/majParametres`, seulement si le champ est valide.
 * Le brouillon n'est jamais réécrit depuis le store pendant la saisie.
 */
export default {
  name: 'BlocIdentiteCabinet',
  components: { PhWarning },
  setup() {
    // Pont requis par Vuelidate 2 en Options API (ADR 0011).
    return { v$: useVuelidate() };
  },
  data() {
    return {
      LONGUEURS_MAX_ADRESSE,
      brouillon: { nomCabinet: '', adresse: normaliserAdresse(null) },
    };
  },
  computed: {
    ...mapGetters('cabinet', ['parametres']),
  },
  created() {
    this.brouillon = {
      nomCabinet: this.parametres.nomCabinet ?? '',
      adresse: normaliserAdresse(this.parametres.adresseCabinet),
    };
  },
  validations() {
    return {
      brouillon: {
        nomCabinet: {
          maxLength: helpers.withMessage(
            `Le nom du cabinet ne doit pas dépasser ${LONGUEUR_MAX_NOM_CABINET} caractères.`,
            maxLength(LONGUEUR_MAX_NOM_CABINET)
          ),
        },
        adresse: {
          ligne1: {
            maxLength: helpers.withMessage(MESSAGE_LIGNE, maxLength(LONGUEURS_MAX_ADRESSE.ligne1)),
          },
          ligne2: {
            maxLength: helpers.withMessage(MESSAGE_LIGNE, maxLength(LONGUEURS_MAX_ADRESSE.ligne2)),
          },
          codePostal: {
            format: helpers.withMessage(
              'Indiquez un code postal à 5 chiffres (ex. 69003).',
              (v) => estCodePostalValide(normaliserCodePostal(v))
            ),
          },
          ville: {
            maxLength: helpers.withMessage(
              `Le nom de la ville ne doit pas dépasser ${LONGUEURS_MAX_ADRESSE.ville} caractères.`,
              maxLength(LONGUEURS_MAX_ADRESSE.ville)
            ),
          },
        },
      },
    };
  },
  methods: {
    ...mapActions('cabinet', ['majParametres']),

    /** Enregistre le nom s'il est valide (idempotent : débounce et perte de focus). */
    enregistrerNom() {
      const champ = this.v$.brouillon.nomCabinet;
      champ.$touch();
      if (!champ.$invalid) {
        this.majParametres({ nomCabinet: this.brouillon.nomCabinet.trim() });
      }
    },

    /** Enregistre l'adresse en bloc si tous ses champs sont valides (idempotent). */
    enregistrerAdresse() {
      const adresse = this.v$.brouillon.adresse;
      adresse.$touch();
      if (!adresse.$invalid) {
        this.majParametres({ adresseCabinet: normaliserAdresse(this.brouillon.adresse) });
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.form-control {
  min-height: t.$cible-cliquable-min;
}

.bloc-identite__erreur {
  @include m.message-erreur-champ;
}
</style>
