<template>
  <ModaleBase
    :visible="visible"
    :titre="titreModale"
    taille="lg"
    @fermeture="$emit('annuler')"
    @affichee="onAffichee"
  >
    <form :id="idFormulaire" novalidate @submit.prevent="soumettre">
      <!-- Type de souhait -->
      <div class="mb-4">
        <label for="preference-type" class="form-label">Type de souhait</label>
        <select
          id="preference-type"
          ref="champType"
          v-model="formulaire.type"
          class="form-select formulaire-select"
          aria-describedby="preference-type-aide"
          @change="onChangeType"
        >
          <option v-for="type in TYPES_PREFERENCE_OFFERTS" :key="type" :value="type">
            {{ libelleTypePreference(type) }}
          </option>
        </select>
        <div id="preference-type-aide" class="form-text">{{ metaType.aide }}</div>
      </div>

      <!-- Détails (params) — section dynamique selon le type -->
      <fieldset
        v-if="metaType.champs === 'jours' || metaType.champs === 'jours+creneaux?'"
        class="mb-4"
        role="group"
        :aria-describedby="v$.formulaire.params.joursSemaine.$error ? 'preference-jours-erreur' : null"
      >
        <legend class="formulaire-legende"><span class="form-label d-block">Jours concernés</span></legend>
        <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-3">
          <div v-for="jour in JOURS_SEMAINE" :key="jour.iso" class="col">
            <div class="form-check formulaire-case">
              <input
                :id="'preference-jour-' + jour.iso"
                v-model="formulaire.params.joursSemaine"
                :value="jour.iso"
                type="checkbox"
                class="form-check-input"
                @change="v$.formulaire.params.joursSemaine.$touch()"
              >
              <label class="form-check-label" :for="'preference-jour-' + jour.iso">{{ jour.libelle }}</label>
            </div>
          </div>
        </div>
        <p v-if="v$.formulaire.params.joursSemaine.$error" id="preference-jours-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.params.joursSemaine.$errors[0].$message }}</span>
        </p>

        <fieldset v-if="metaType.champs === 'jours+creneaux?'" class="mt-3">
          <legend class="formulaire-legende">
            <span class="form-label d-block">Seulement certains moments ? (facultatif)</span>
          </legend>
          <div class="d-flex flex-wrap gap-3">
            <div v-for="code in CRENEAUX" :key="code" class="form-check formulaire-case">
              <input
                :id="'preference-creneau-' + code"
                v-model="formulaire.params.creneaux"
                :value="code"
                type="checkbox"
                class="form-check-input"
              >
              <label class="form-check-label" :for="'preference-creneau-' + code">{{ libelleCreneau(code) }}</label>
            </div>
          </div>
          <div class="form-text">Laissez vide pour appliquer à la journée entière.</div>
        </fieldset>
      </fieldset>

      <fieldset
        v-else-if="metaType.champs === 'creneaux+jours?'"
        class="mb-4"
        role="group"
        :aria-describedby="v$.formulaire.params.creneaux.$error ? 'preference-creneaux-erreur' : null"
      >
        <legend class="formulaire-legende"><span class="form-label d-block">Moments concernés</span></legend>
        <div class="d-flex flex-wrap gap-3">
          <div v-for="code in creneauxDemiJournee" :key="code" class="form-check formulaire-case">
            <input
              :id="'preference-creneau-' + code"
              v-model="formulaire.params.creneaux"
              :value="code"
              type="checkbox"
              class="form-check-input"
              @change="v$.formulaire.params.creneaux.$touch()"
            >
            <label class="form-check-label" :for="'preference-creneau-' + code">{{ libelleCreneau(code) }}</label>
          </div>
        </div>
        <p v-if="v$.formulaire.params.creneaux.$error" id="preference-creneaux-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.params.creneaux.$errors[0].$message }}</span>
        </p>

        <fieldset class="mt-3">
          <legend class="formulaire-legende">
            <span class="form-label d-block">Seulement certains jours ? (facultatif)</span>
          </legend>
          <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-3">
            <div v-for="jour in JOURS_SEMAINE" :key="jour.iso" class="col">
              <div class="form-check formulaire-case">
                <input
                  :id="'preference-jour-' + jour.iso"
                  v-model="formulaire.params.joursSemaine"
                  :value="jour.iso"
                  type="checkbox"
                  class="form-check-input"
                >
                <label class="form-check-label" :for="'preference-jour-' + jour.iso">{{ jour.libelle }}</label>
              </div>
            </div>
          </div>
          <div class="form-text">Laissez vide pour appliquer tous les jours.</div>
        </fieldset>
      </fieldset>

      <div v-else-if="metaType.champs === 'nombreMax'" class="mb-4 formulaire-nombre">
        <label for="preference-max" class="form-label">Nombre maximal de jours d'affilée</label>
        <input
          id="preference-max"
          v-model.number="formulaire.params.max"
          type="number"
          min="1"
          max="7"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': v$.formulaire.params.max.$error }"
          :aria-describedby="v$.formulaire.params.max.$error ? 'preference-max-erreur' : null"
          @blur="v$.formulaire.params.max.$touch()"
        >
        <p v-if="v$.formulaire.params.max.$error" id="preference-max-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.params.max.$errors[0].$message }}</span>
        </p>
      </div>

      <div v-else-if="metaType.champs === 'nombreMin'" class="mb-4 formulaire-nombre">
        <label for="preference-min" class="form-label">Nombre minimal de jours d'affilée</label>
        <input
          id="preference-min"
          v-model.number="formulaire.params.min"
          type="number"
          min="1"
          max="7"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': v$.formulaire.params.min.$error }"
          :aria-describedby="v$.formulaire.params.min.$error ? 'preference-min-erreur' : null"
          @blur="v$.formulaire.params.min.$touch()"
        >
        <p v-if="v$.formulaire.params.min.$error" id="preference-min-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.params.min.$errors[0].$message }}</span>
        </p>
      </div>

      <div v-else-if="metaType.champs === 'minMax'" class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="preference-min" class="form-label">Minimum de jours par semaine (facultatif)</label>
          <input
            id="preference-min"
            v-model.number="formulaire.params.min"
            type="number"
            min="0"
            max="7"
            step="1"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.params.min.$error }"
            :aria-describedby="v$.formulaire.params.min.$error ? 'preference-min-erreur' : null"
            @blur="v$.formulaire.params.min.$touch()"
          >
          <p v-if="v$.formulaire.params.min.$error" id="preference-min-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.params.min.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="preference-max" class="form-label">Maximum de jours par semaine (facultatif)</label>
          <input
            id="preference-max"
            v-model.number="formulaire.params.max"
            type="number"
            min="0"
            max="7"
            step="1"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.params.max.$error }"
            :aria-describedby="v$.formulaire.params.max.$error ? 'preference-max-erreur' : null"
            @blur="v$.formulaire.params.max.$touch()"
          >
          <p v-if="v$.formulaire.params.max.$error" id="preference-max-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.params.max.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Nature -->
      <fieldset class="mb-4">
        <legend class="formulaire-legende">
          <span class="form-label d-block">S'agit-il d'une obligation ou d'un souhait ?</span>
        </legend>
        <div class="d-flex flex-column gap-2">
          <div v-for="option in NATURES_PREFERENCE_OPTIONS" :key="option.code" class="form-check formulaire-radio">
            <input
              :id="'preference-nature-' + option.code"
              v-model="formulaire.nature"
              :value="option.code"
              type="radio"
              name="preference-nature"
              class="form-check-input"
              @change="onChangeNature"
            >
            <label class="form-check-label" :for="'preference-nature-' + option.code">
              <span class="formulaire-radio-libelle">{{ option.libelle }}</span>
              <span class="formulaire-radio-aide">{{ option.aide }}</span>
            </label>
          </div>
        </div>
      </fieldset>

      <!-- Importance (seulement pour un souhait souple) -->
      <div v-if="formulaire.nature === 'SOUPLE'" class="mb-4">
        <label for="preference-niveau" class="form-label">Importance</label>
        <select id="preference-niveau" v-model="formulaire.niveau" class="form-select formulaire-select">
          <option v-for="niveau in NIVEAUX_IMPORTANCE" :key="niveau.code" :value="niveau.code">
            {{ niveau.libelle }}
          </option>
        </select>
      </div>

      <!-- Note -->
      <div class="mb-4">
        <label for="preference-libelle" class="form-label">Note (facultatif)</label>
        <input
          id="preference-libelle"
          v-model.trim="formulaire.libelle"
          type="text"
          class="form-control"
          placeholder="ex. à confirmer avec la personne"
          maxlength="120"
          :class="{ 'is-invalid': v$.formulaire.libelle.$error }"
          :aria-describedby="v$.formulaire.libelle.$error ? 'preference-libelle-erreur' : null"
          @blur="v$.formulaire.libelle.$touch()"
        >
        <p v-if="v$.formulaire.libelle.$error" id="preference-libelle-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.libelle.$errors[0].$message }}</span>
        </p>
      </div>

      <!-- Aperçu vivant, pour relire la saisie en clair avant d'enregistrer -->
      <p class="formulaire-apercu" aria-live="polite">
        <strong>Ce souhait signifie :</strong> {{ apercu }}
      </p>

      <p
        v-if="soumissionInvalide"
        class="formulaire-erreur mt-3"
        role="status"
        aria-live="polite"
      >
        <PhWarning :size="14" weight="bold" aria-hidden="true" />
        <span>Certains champs sont à corriger.</span>
      </p>
    </form>

    <template #pied>
      <button type="button" class="btn btn-outline-secondary" @click="$emit('annuler')">Annuler</button>
      <button type="submit" :form="idFormulaire" class="btn btn-primary">Enregistrer</button>
    </template>
  </ModaleBase>
</template>

<script>
import { useVuelidate } from '@vuelidate/core';
import { required, integer, between, maxLength, helpers } from '@vuelidate/validators';
import { PhWarning } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import {
  TYPES_PREFERENCE_OFFERTS,
  META_TYPES_PREFERENCE,
  natureParDefaut,
  NIVEAUX_IMPORTANCE,
  niveauVersPoids,
  poidsVersNiveau,
  decrirePreference,
} from '@/domain/preferences.js';
import { libelleTypePreference, NATURES_PREFERENCE_OPTIONS, JOURS_SEMAINE, libelleCreneau } from '@/domain/libelles.js';
import { CRENEAUX } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';

/**
 * Vrai si une valeur de champ numérique facultatif est vide (non saisie),
 * qu'elle vaille `''` (champ vidé par l'utilisateur), `null` ou `undefined`.
 * @param {*} valeur
 * @returns {boolean}
 */
function estVide(valeur) {
  return valeur === '' || valeur === null || valeur === undefined;
}

/**
 * Formulaire présentational d'ajout/édition d'une préférence (feature 005).
 *
 * Bâti au-dessus de `ModaleBase`, sur le même patron que `FormulairePersonne`.
 * N'accède **pas** au store : il reçoit ses données par props (`preference` =
 * `null` en création, objet en édition) et **émet** le résultat normalisé
 * (`enregistrer`) ou une annulation (`annuler`) ; c'est l'écran appelant
 * (`SouhaitsView`) qui dispatche vers le store. La section « Détails » est
 * **dynamique** : elle dépend du `type` choisi (`META_TYPES_PREFERENCE`), et
 * la validation (Vuelidate) l'est tout autant.
 */
export default {
  name: 'FormulairePreference',
  components: { ModaleBase, PhWarning },
  props: {
    /** Affiche (`true`) ou masque (`false`) la modale ; piloté par le parent. */
    visible: { type: Boolean, required: true },
    /** `null` = mode création ; objet `Preference` = mode édition. */
    preference: { type: Object, default: null },
  },
  emits: ['enregistrer', 'annuler'],
  setup() {
    // Seul usage de la Composition API : pont requis par Vuelidate 2 en
    // Options API (ADR 0011), comme dans FormulairePersonne/ParametresView.
    return { v$: useVuelidate() };
  },
  data() {
    return {
      TYPES_PREFERENCE_OFFERTS,
      NATURES_PREFERENCE_OPTIONS,
      NIVEAUX_IMPORTANCE,
      JOURS_SEMAINE,
      CRENEAUX,
      // Identifiant unique du `<form>`, pour relier le bouton « Enregistrer »
      // du pied de modale (hors du `<form>`) via l'attribut HTML `form`.
      idFormulaire: `formulaire-preference-${genId()}`,
      formulaire: this.construireFormulaire(),
      // `true` dès que l'utilisateur a choisi la nature à la main : la
      // nature par défaut du type n'est alors plus reproposée automatiquement
      // lors d'un changement de type ultérieur.
      natureModifieeManuellement: false,
      // `true` après une tentative de soumission bloquée par la validation :
      // affiche un court récapitulatif près du pied de modale.
      soumissionInvalide: false,
    };
  },
  computed: {
    titreModale() {
      return this.preference ? 'Modifier le souhait' : 'Ajouter un souhait';
    },
    /** Métadonnées du type courant (`champs`, `aide`…), voir `domain/preferences.js`. */
    metaType() {
      return META_TYPES_PREFERENCE[this.formulaire.type] ?? {};
    },
    /**
     * Créneaux proposés pour `CRENEAU_OFF` (« Demi-journée non travaillée ») :
     * seulement matin/après-midi, sans « Journée entière » qui contredirait le
     * nom du type et recouperait « Jour non travaillé ». N'affecte pas
     * `INDISPO_HEBDO`, où les créneaux (facultatifs) restent les 3 valeurs de
     * `CRENEAUX` (voir gabarit `jours+creneaux?` ci-dessus).
     */
    creneauxDemiJournee() {
      return CRENEAUX.filter((code) => code !== 'JOURNEE');
    },
    /** Phrase FR décrivant en direct le brouillon courant, pour relecture avant enregistrement. */
    apercu() {
      return decrirePreference({
        type: this.formulaire.type,
        params: this.formulaire.params,
        nature: this.formulaire.nature,
        poids:
          this.formulaire.nature === 'SOUPLE'
            ? niveauVersPoids(this.formulaire.niveau)
            : (this.preference?.poids ?? 5),
      });
    },
  },
  watch: {
    visible(estVisible) {
      if (estVisible) {
        this.reinitialiser();
      }
    },
  },
  mounted() {
    if (this.visible) {
      this.reinitialiser();
    }
  },
  validations() {
    const champs = this.metaType.champs;
    const paramsRules = {};

    if (champs === 'jours' || champs === 'jours+creneaux?') {
      paramsRules.joursSemaine = {
        required: helpers.withMessage('Choisissez au moins un jour de la semaine.', required),
      };
      // Créneaux facultatifs pour `INDISPO_HEBDO` (vide = journée entière) : aucune règle.
      if (champs === 'jours+creneaux?') {
        paramsRules.creneaux = {};
      }
    } else if (champs === 'creneaux+jours?') {
      paramsRules.creneaux = {
        required: helpers.withMessage(
          'Choisissez au moins un moment de la journée (matin ou après-midi).',
          required
        ),
      };
      // Jours facultatifs pour `CRENEAU_OFF` (vide = tous les jours) : aucune règle.
      paramsRules.joursSemaine = {};
    } else if (champs === 'nombreMax') {
      paramsRules.max = {
        required: helpers.withMessage('Indiquez un nombre de jours entre 1 et 7.', required),
        integer: helpers.withMessage('Indiquez un nombre entier de jours (sans virgule).', integer),
        between: helpers.withMessage('Indiquez un nombre de jours entre 1 et 7.', between(1, 7)),
      };
    } else if (champs === 'nombreMin') {
      paramsRules.min = {
        required: helpers.withMessage('Indiquez un nombre de jours entre 1 et 7.', required),
        integer: helpers.withMessage('Indiquez un nombre entier de jours (sans virgule).', integer),
        between: helpers.withMessage('Indiquez un nombre de jours entre 1 et 7.', between(1, 7)),
      };
    } else if (champs === 'minMax') {
      paramsRules.min = {
        integer: helpers.withMessage('Indiquez un nombre entier de jours (sans virgule).', integer),
        between: helpers.withMessage('Indiquez un nombre de jours entre 0 et 7.', between(0, 7)),
        auMoinsUne: helpers.withMessage(
          'Indiquez au moins un nombre (minimum ou maximum).',
          (valeur, parent) => !estVide(valeur) || !estVide(parent.max)
        ),
      };
      paramsRules.max = {
        integer: helpers.withMessage('Indiquez un nombre entier de jours (sans virgule).', integer),
        between: helpers.withMessage('Indiquez un nombre de jours entre 0 et 7.', between(0, 7)),
        minInferieurMax: helpers.withMessage(
          'Le minimum ne peut pas dépasser le maximum.',
          (valeur, parent) => estVide(parent.min) || estVide(valeur) || Number(parent.min) <= Number(valeur)
        ),
      };
    }

    return {
      formulaire: {
        params: paramsRules,
        libelle: {
          maxLength: helpers.withMessage('La note ne doit pas dépasser 120 caractères.', maxLength(120)),
        },
      },
    };
  },
  methods: {
    libelleTypePreference,
    libelleCreneau,

    /**
     * Construit le brouillon local à partir de `preference` (édition) ou des
     * valeurs par défaut (création). Ne mute jamais la prop `preference` :
     * `params` et ses tableaux sont toujours recopiés.
     * @returns {Object} Brouillon prêt à être édité localement.
     */
    construireFormulaire() {
      if (this.preference) {
        return {
          type: this.preference.type,
          nature: this.preference.nature,
          niveau: poidsVersNiveau(this.preference.poids),
          params: this.recopierParams(this.preference.type, this.preference.params),
          libelle: this.preference.libelle ?? '',
        };
      }

      const type = TYPES_PREFERENCE_OFFERTS[0];
      return {
        type,
        nature: natureParDefaut(type),
        niveau: 'MOYENNE',
        params: this.recopierParams(type, {}),
        libelle: '',
      };
    },

    /**
     * Recopie (sans jamais réutiliser la référence) les `params` pertinents
     * pour un type donné : ne conserve que les clés attendues par ce type et
     * clone les tableaux. Utilisé aussi bien pour préremplir depuis une
     * préférence existante que pour rebâtir un `params` vide (création, ou
     * changement de type).
     * @param {string} type - Discriminant, ∈ `TYPES_PREFERENCE_OFFERTS`.
     * @param {Object} params - `params` d'origine (potentiellement partiel).
     * @returns {Object} `params` recopié, prêt pour le brouillon local.
     */
    recopierParams(type, params) {
      const p = params ?? {};
      switch (META_TYPES_PREFERENCE[type]?.champs) {
        case 'jours':
          return { joursSemaine: [...(p.joursSemaine ?? [])] };
        case 'creneaux+jours?':
          return { creneaux: [...(p.creneaux ?? [])], joursSemaine: [...(p.joursSemaine ?? [])] };
        case 'jours+creneaux?':
          return { joursSemaine: [...(p.joursSemaine ?? [])], creneaux: [...(p.creneaux ?? [])] };
        case 'nombreMax':
          return { max: p.max ?? null };
        case 'nombreMin':
          return { min: p.min ?? null };
        case 'minMax':
          return { min: p.min ?? null, max: p.max ?? null };
        default:
          return {};
      }
    },

    /**
     * Réinitialise le brouillon, la nature « modifiée manuellement » et
     * l'état de validation à chaque ouverture de la modale (création vierge
     * ou édition pré-remplie selon `preference`). Le focus, lui, est posé
     * séparément (voir `onAffichee`) une fois la transition d'ouverture de la
     * modale réellement terminée.
     */
    reinitialiser() {
      this.formulaire = this.construireFormulaire();
      this.natureModifieeManuellement = false;
      this.soumissionInvalide = false;
      this.v$.$reset();
    },

    /**
     * Place le focus sur le sélecteur de type une fois que `ModaleBase` a
     * fini d'afficher la modale (événement `affichee`).
     */
    onAffichee() {
      this.$refs.champType?.focus();
    },

    /**
     * Au changement de type : rebâtit un `params` vide adapté au nouveau
     * type (pour ne pas laisser trainer des clés d'un ancien type dans le
     * brouillon) et propose sa nature par défaut, tant que l'utilisateur n'a
     * pas choisi la nature manuellement. Réinitialise aussi l'état de
     * validation, devenu obsolète pour la nouvelle forme de `params`.
     */
    onChangeType() {
      this.formulaire.params = this.recopierParams(this.formulaire.type, {});
      if (!this.natureModifieeManuellement) {
        this.formulaire.nature = natureParDefaut(this.formulaire.type);
      }
      this.v$.$reset();
    },

    onChangeNature() {
      this.natureModifieeManuellement = true;
    },

    /**
     * Ordre visuel des champs pertinents pour le type courant, utilisé pour
     * focaliser le premier champ en erreur après une tentative de soumission
     * invalide (`soumettre`).
     * @returns {Array<{ validation: Object, id: string }>}
     */
    champsEnOrdre() {
      const champs = this.metaType.champs;
      const ordre = [];

      if (champs === 'jours' || champs === 'jours+creneaux?') {
        ordre.push({
          validation: this.v$.formulaire.params.joursSemaine,
          id: `preference-jour-${JOURS_SEMAINE[0].iso}`,
        });
      } else if (champs === 'creneaux+jours?') {
        ordre.push({
          validation: this.v$.formulaire.params.creneaux,
          id: `preference-creneau-${CRENEAUX[0]}`,
        });
      } else if (champs === 'nombreMax') {
        ordre.push({ validation: this.v$.formulaire.params.max, id: 'preference-max' });
      } else if (champs === 'nombreMin') {
        ordre.push({ validation: this.v$.formulaire.params.min, id: 'preference-min' });
      } else if (champs === 'minMax') {
        ordre.push({ validation: this.v$.formulaire.params.min, id: 'preference-min' });
        ordre.push({ validation: this.v$.formulaire.params.max, id: 'preference-max' });
      }

      ordre.push({ validation: this.v$.formulaire.libelle, id: 'preference-libelle' });
      return ordre;
    },

    /**
     * Place le focus sur le premier champ en erreur (ordre visuel du
     * formulaire) après une tentative de soumission invalide.
     */
    focusPremierChampErrone() {
      const premierEnErreur = this.champsEnOrdre().find((champ) => champ.validation.$error);
      if (!premierEnErreur) return;
      this.$el.querySelector(`#${premierEnErreur.id}`)?.focus();
    },

    soumettre() {
      this.v$.$touch();
      if (this.v$.$invalid) {
        this.soumissionInvalide = true;
        this.focusPremierChampErrone();
        return;
      }
      this.soumissionInvalide = false;

      const poids =
        this.formulaire.nature === 'SOUPLE'
          ? niveauVersPoids(this.formulaire.niveau)
          : (this.preference?.poids ?? 5);

      this.$emit('enregistrer', {
        type: this.formulaire.type,
        nature: this.formulaire.nature,
        poids,
        params: { ...this.formulaire.params },
        libelle: this.formulaire.libelle.trim(),
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.formulaire-select {
  max-width: 24rem;
}

.formulaire-nombre {
  max-width: 12rem;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.form-control,
.form-select {
  min-height: t.$cible-cliquable-min;
}

// Une case + son libellé forment une cible cliquable confortable (~44px),
// libellé entier cliquable (accessibilité, public non-technique).
.formulaire-case {
  display: flex;
  align-items: center;
  min-height: t.$cible-cliquable-min;
  padding-left: 0;

  .form-check-input {
    float: none;
    width: 1.25rem;
    height: 1.25rem;
    margin-top: 0;
    margin-left: 0;
    margin-right: t.$espace-2;
    flex-shrink: 0;

    &:focus-visible {
      @include m.focus-visible;
    }
  }

  .form-check-label {
    cursor: pointer;
  }
}

.formulaire-radio {
  display: flex;
  align-items: flex-start;
  min-height: t.$cible-cliquable-min;
  padding-left: 0;

  .form-check-input {
    float: none;
    width: 1.25rem;
    height: 1.25rem;
    margin-top: 0.2rem;
    margin-left: 0;
    margin-right: t.$espace-2;
    flex-shrink: 0;

    &:focus-visible {
      @include m.focus-visible;
    }
  }

  .form-check-label {
    display: flex;
    flex-direction: column;
    cursor: pointer;
  }
}

.formulaire-radio-libelle {
  font-weight: t.$graisse-gras;
}

.formulaire-radio-aide {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

// Le `<legend>` porte un vrai libellé de champ tout en gardant le groupement
// sémantique `fieldset`/`legend` pour les lecteurs d'écran ; on neutralise le
// style par défaut du navigateur (cohérent avec ParametresView).
.formulaire-legende {
  display: block;
  width: 100%;
  padding: 0;
  margin-bottom: t.$espace-2;
  border: 0;
}

.formulaire-apercu {
  padding: t.$espace-3;
  margin: t.$espace-2 0 0;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-md;

  strong {
    font-weight: t.$graisse-gras;
  }
}

// Présentation des messages d'erreur, cohérente avec FormulairePersonne/ParametresView.
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
