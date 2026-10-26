<template>
  <ModaleBase :visible="visible" :titre="titreModale" @fermeture="$emit('annuler')" @affichee="onAffichee">
    <form :id="idFormulaire" novalidate @submit.prevent="soumettre">
      <div class="mb-4">
        <label :for="idLibelle" class="form-label">Nom du champ</label>
        <input
          :id="idLibelle"
          ref="champLibelle"
          v-model="formulaire.libelle"
          type="text"
          class="form-control"
          maxlength="90"
          :class="{ 'is-invalid': v$.formulaire.libelle.$error }"
          :aria-describedby="`${idLibelle}-aide${v$.formulaire.libelle.$error ? ` ${idLibelle}-erreur` : ''}`"
          @blur="v$.formulaire.libelle.$touch()"
        >
        <div :id="`${idLibelle}-aide`" class="form-text">
          Ce texte sera affiché dans le modèle et demandé lors de la création du document, par ex. « Date d'effet ».
        </div>
        <p v-if="v$.formulaire.libelle.$error" :id="`${idLibelle}-erreur`" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.libelle.$errors[0].$message }}</span>
        </p>
      </div>

      <fieldset class="mb-2">
        <legend class="form-label">Réponse attendue</legend>
        <div v-for="option in TYPES_CHAMP_LIBRE_OPTIONS" :key="option.code" class="form-check">
          <input
            :id="`${idLibelle}-type-${option.code}`"
            v-model="formulaire.type"
            class="form-check-input"
            type="radio"
            name="type-champ-libre"
            :value="option.code"
            :disabled="typeIndisponible(option.code)"
            :aria-describedby="`${idLibelle}-aide-${option.code}`"
            @change="v$.formulaire.type.$touch()"
          >
          <label class="form-check-label fw-semibold" :for="`${idLibelle}-type-${option.code}`">
            {{ option.libelle }}
          </label>
          <div :id="`${idLibelle}-aide-${option.code}`" class="form-text mt-0">
            {{ typeIndisponible(option.code) ? MESSAGE_TAUX_DEJA_PRESENT : AIDES_TYPE_CHAMP_LIBRE[option.code] }}
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
import { TYPES_CHAMP_LIBRE } from '@/domain/schema.js';
import { TYPES_CHAMP_LIBRE_OPTIONS, AIDES_TYPE_CHAMP_LIBRE } from '@/domain/libelles.js';
import { LONGUEUR_MAX_LIBELLE_CHAMP, peutAjouterTauxRetrocession } from '@/domain/contrats/modeles.js';
import { genId } from '@/domain/utils/id.js';

const MESSAGE_TAUX_DEJA_PRESENT = 'Ce modèle demande déjà un taux de rétrocession.';

/**
 * Fenêtre de création ou de modification d'un champ à compléter (feature 0041, §6.5).
 * Présentationnelle : ni store ni routeur.
 *
 * Props : `visible`, `champ` (`null` = création, sinon `{ cle, libelle, type }`),
 * `champsLibres` (tous les champs du modèle, pour l'unicité et le taux unique).
 * Événements : `valider({ libelle, type })`, `annuler`.
 */
export default {
  name: 'ModaleChampLibre',
  components: { ModaleBase, PhWarning },
  props: {
    visible: { type: Boolean, required: true },
    champ: { type: Object, default: null },
    champsLibres: { type: Array, default: () => [] },
  },
  emits: ['valider', 'annuler'],
  setup() {
    // Pont requis par Vuelidate 2 en Options API (ADR 0011).
    return { v$: useVuelidate() };
  },
  data() {
    return {
      TYPES_CHAMP_LIBRE_OPTIONS,
      AIDES_TYPE_CHAMP_LIBRE,
      MESSAGE_TAUX_DEJA_PRESENT,
      idFormulaire: `formulaire-champ-libre-${genId()}`,
      idLibelle: `champ-libre-libelle-${genId()}`,
      formulaire: this.construireFormulaire(),
      soumissionInvalide: false,
    };
  },
  computed: {
    titreModale() {
      return this.champ ? 'Modifier le champ' : 'Nouveau champ à compléter';
    },
    libelleValider() {
      return this.champ ? 'Enregistrer' : 'Ajouter le champ';
    },
    cleEnCours() {
      return this.champ ? this.champ.cle : null;
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
        libelle: {
          required: helpers.withMessage('Donnez un nom à ce champ.', (v) => String(v ?? '').trim() !== ''),
          maxLength: helpers.withMessage(
            `${LONGUEUR_MAX_LIBELLE_CHAMP} caractères au maximum.`,
            (v) => String(v ?? '').trim().length <= LONGUEUR_MAX_LIBELLE_CHAMP,
          ),
          unique: helpers.withMessage('Ce modèle a déjà un champ portant ce nom.', (v) => this.libelleUnique(v)),
        },
        type: {
          required: helpers.withMessage('Choisissez le type de réponse attendue.', required),
          valide: helpers.withMessage(
            'Choisissez le type de réponse attendue.',
            (v) => !v || TYPES_CHAMP_LIBRE.includes(v),
          ),
          tauxUnique: helpers.withMessage(MESSAGE_TAUX_DEJA_PRESENT, (v) => this.typeAutorise(v)),
        },
      },
    };
  },
  methods: {
    construireFormulaire() {
      return {
        libelle: this.champ ? this.champ.libelle : '',
        type: this.champ ? this.champ.type : 'TEXTE',
      };
    },
    normaliser(texte) {
      return String(texte ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
    },
    /** Libellé jamais porté par un AUTRE champ du modèle. */
    libelleUnique(valeur) {
      const cherche = this.normaliser(valeur);
      if (cherche === '') return true;
      return !this.champsLibres.some((c) => c.cle !== this.cleEnCours && this.normaliser(c.libelle) === cherche);
    },
    typeAutorise(type) {
      return type !== 'TAUX_RETROCESSION' || peutAjouterTauxRetrocession(this.champsLibres, this.cleEnCours);
    },
    typeIndisponible(type) {
      return !this.typeAutorise(type);
    },
    reinitialiser() {
      this.formulaire = this.construireFormulaire();
      this.v$.$reset();
      this.soumissionInvalide = false;
    },
    onAffichee() {
      this.$refs.champLibelle?.focus();
    },
    async soumettre() {
      this.formulaire.libelle = this.formulaire.libelle.trim();
      const valide = await this.v$.$validate();
      if (!valide) {
        this.soumissionInvalide = true;
        return;
      }
      this.$emit('valider', { libelle: this.formulaire.libelle, type: this.formulaire.type });
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
