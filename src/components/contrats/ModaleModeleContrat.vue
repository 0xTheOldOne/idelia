<template>
  <ModaleBase :visible="visible" :titre="titreModale" @fermeture="$emit('annuler')" @affichee="onAffichee">
    <form :id="idFormulaire" novalidate @submit.prevent="soumettre">
      <div class="mb-4">
        <label :for="idTitre" class="form-label">Titre du modèle</label>
        <input
          :id="idTitre"
          ref="champTitre"
          v-model="formulaire.titre"
          v-debounce:300ms="verifierDoublon"
          type="text"
          class="form-control"
          maxlength="130"
          :class="{ 'is-invalid': v$.formulaire.titre.$error }"
          :aria-describedby="v$.formulaire.titre.$error ? `${idTitre}-erreur` : doublon ? `${idTitre}-note` : null"
          @blur="v$.formulaire.titre.$touch()"
        >
        <p v-if="v$.formulaire.titre.$error" :id="`${idTitre}-erreur`" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.titre.$errors[0].$message }}</span>
        </p>
        <p v-else-if="doublon" :id="`${idTitre}-note`" class="form-text mb-0" role="status">
          Un autre modèle porte déjà ce titre.
        </p>
      </div>

      <fieldset class="mb-2">
        <legend class="form-label">Type de modèle</legend>
        <div v-for="option in TYPES_MODELE_CONTRAT_OPTIONS" :key="option.code" class="form-check">
          <input
            :id="`${idTitre}-type-${option.code}`"
            v-model="formulaire.type"
            class="form-check-input"
            type="radio"
            name="type-modele-contrat"
            :value="option.code"
            :aria-describedby="`${idTitre}-aide-${option.code}`"
            @change="v$.formulaire.type.$touch()"
          >
          <label class="form-check-label fw-semibold" :for="`${idTitre}-type-${option.code}`">
            {{ option.libelle }}
          </label>
          <div :id="`${idTitre}-aide-${option.code}`" class="form-text mt-0">
            {{ AIDES_TYPE[option.code] }}
          </div>
        </div>
        <p v-if="v$.formulaire.type.$error" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.type.$errors[0].$message }}</span>
        </p>
      </fieldset>

      <p v-if="soumissionInvalide" class="formulaire-erreur mt-3" role="status" aria-live="polite">
        <PhWarning :size="14" weight="bold" aria-hidden="true" />
        <span>Certains champs sont à corriger.</span>
      </p>
    </form>

    <template #pied>
      <button type="button" class="btn btn-outline-secondary" @click="$emit('annuler')">Annuler</button>
      <button type="submit" :form="idFormulaire" class="btn btn-primary">{{ libelleValider }}</button>
    </template>
  </ModaleBase>
</template>

<script>
import { useVuelidate } from '@vuelidate/core';
import { required, maxLength, helpers } from '@vuelidate/validators';
import { PhWarning } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import { TYPES_MODELE_CONTRAT } from '@/domain/schema.js';
import { TYPES_MODELE_CONTRAT_OPTIONS } from '@/domain/libelles.js';
import { genId } from '@/domain/utils/id.js';

/** Aide d'une ligne sous chaque type de modèle. */
const AIDES_TYPE = {
  CONTRAT: 'Un contrat de remplacement entre la titulaire et un(e) remplaçant(e).',
  AVENANT: 'Une modification d’un contrat déjà signé, par exemple le taux de rétrocession.',
};

/**
 * Petite fenêtre de création (« Nouveau modèle ») ou de renommage d'un modèle
 * de contrat (feature 0041, §6.4) : titre + type. Présentationnelle : ni store
 * ni routeur. Un titre déjà porté par un autre modèle est signalé sans bloquer.
 *
 * Props : `visible`, `modele` (`null` = création, objet `ModeleContrat` =
 * renommage), `titresExistants` (titres des autres modèles).
 * Événements : `valider({ titre, type })`, `annuler`.
 */
export default {
  name: 'ModaleModeleContrat',
  components: { ModaleBase, PhWarning },
  props: {
    visible: { type: Boolean, required: true },
    modele: { type: Object, default: null },
    titresExistants: { type: Array, default: () => [] },
  },
  emits: ['valider', 'annuler'],
  setup() {
    // Pont requis par Vuelidate 2 en Options API (ADR 0011).
    return { v$: useVuelidate() };
  },
  data() {
    return {
      TYPES_MODELE_CONTRAT_OPTIONS,
      AIDES_TYPE,
      idFormulaire: `formulaire-modele-contrat-${genId()}`,
      idTitre: `modele-contrat-titre-${genId()}`,
      formulaire: this.construireFormulaire(),
      soumissionInvalide: false,
      // Titre « vérifié » (débounce 300 ms) pour la note de doublon.
      titreVerifie: '',
    };
  },
  computed: {
    titreModale() {
      return this.modele ? 'Renommer le modèle' : 'Nouveau modèle';
    },
    libelleValider() {
      return this.modele ? 'Enregistrer' : 'Créer et ouvrir';
    },
    doublon() {
      const cherche = this.normaliser(this.titreVerifie);
      return cherche !== '' && this.titresExistants.some((t) => this.normaliser(t) === cherche);
    },
  },
  watch: {
    visible(estVisible) {
      if (estVisible) this.reinitialiser();
    },
  },
  mounted() {
    if (this.visible) this.reinitialiser();
  },
  validations() {
    return {
      formulaire: {
        titre: {
          required: helpers.withMessage('Donnez un titre au modèle.', required),
          maxLength: helpers.withMessage('120 caractères au maximum.', maxLength(120)),
        },
        type: {
          required: helpers.withMessage('Choisissez Contrat ou Avenant.', required),
          valide: helpers.withMessage('Choisissez Contrat ou Avenant.', (v) => !v || TYPES_MODELE_CONTRAT.includes(v)),
        },
      },
    };
  },
  methods: {
    construireFormulaire() {
      return {
        titre: this.modele ? this.modele.titre : '',
        type: this.modele ? this.modele.type : 'CONTRAT',
      };
    },
    /** Titre comparé sans casse ni espaces superflus. */
    normaliser(texte) {
      return String(texte ?? '').trim().toLocaleLowerCase('fr');
    },
    reinitialiser() {
      this.formulaire = this.construireFormulaire();
      this.titreVerifie = this.formulaire.titre;
      this.v$.$reset();
      this.soumissionInvalide = false;
    },
    /** Appelée après 300 ms sans frappe (`v-debounce`). */
    verifierDoublon(valeur) {
      this.titreVerifie = typeof valeur === 'string' ? valeur : this.formulaire.titre;
    },
    onAffichee() {
      this.$refs.champTitre?.focus();
    },
    async soumettre() {
      this.formulaire.titre = this.formulaire.titre.trim();
      const valide = await this.v$.$validate();
      if (!valide) {
        this.soumissionInvalide = true;
        return;
      }
      this.$emit('valider', { titre: this.formulaire.titre, type: this.formulaire.type });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.formulaire-erreur {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-1;
  margin: t.$espace-2 0 0;
  color: t.$couleur-erreur;
  font-size: t.$taille-texte-petite;

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
  }
}

.form-check {
  margin-bottom: t.$espace-2;
}

.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
