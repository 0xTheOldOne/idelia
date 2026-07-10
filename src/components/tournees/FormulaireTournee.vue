<template>
  <ModaleBase
    :visible="visible"
    :titre="titreModale"
    taille="lg"
    @fermeture="$emit('annuler')"
    @affichee="onAffichee"
  >
    <form :id="idFormulaire" novalidate @submit.prevent="soumettre">
      <!-- Identité -->
      <div class="mb-3">
        <label for="tournee-nom" class="form-label">Nom de la tournée</label>
        <input
          id="tournee-nom"
          ref="champNom"
          v-model.trim="formulaire.nom"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': v$.formulaire.nom.$error }"
          :aria-describedby="v$.formulaire.nom.$error ? 'tournee-nom-erreur' : null"
          @blur="v$.formulaire.nom.$touch()"
        >
        <p v-if="v$.formulaire.nom.$error" id="tournee-nom-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.nom.$errors[0].$message }}</span>
        </p>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="tournee-code" class="form-label">Code court (facultatif)</label>
          <input
            id="tournee-code"
            v-model.trim="formulaire.code"
            type="text"
            class="form-control"
            placeholder="ex. N ou T1"
            maxlength="10"
            :class="{ 'is-invalid': v$.formulaire.code.$error }"
            :aria-describedby="v$.formulaire.code.$error ? 'tournee-code-erreur' : null"
            @blur="v$.formulaire.code.$touch()"
          >
          <p v-if="v$.formulaire.code.$error" id="tournee-code-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.code.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="tournee-secteur" class="form-label">Secteur (facultatif)</label>
          <input
            id="tournee-secteur"
            v-model.trim="formulaire.secteur"
            type="text"
            class="form-control"
            placeholder="ex. Centre-ville"
            maxlength="60"
            :class="{ 'is-invalid': v$.formulaire.secteur.$error }"
            :aria-describedby="v$.formulaire.secteur.$error ? 'tournee-secteur-erreur' : null"
            @blur="v$.formulaire.secteur.$touch()"
          >
          <p v-if="v$.formulaire.secteur.$error" id="tournee-secteur-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.secteur.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Créneau -->
      <div class="mb-4">
        <label for="tournee-creneau" class="form-label">Créneau</label>
        <select
          id="tournee-creneau"
          v-model="formulaire.creneau"
          class="form-select formulaire-select"
          @change="v$.formulaire.creneau.$touch()"
        >
          <option v-for="code in CRENEAUX" :key="code" :value="code">{{ libelleCreneau(code) }}</option>
        </select>
      </div>

      <!-- Horaires -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="tournee-heure-debut" class="form-label">Heure de début</label>
          <input
            id="tournee-heure-debut"
            v-model="formulaire.heureDebut"
            type="time"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.heureDebut.$error }"
            :aria-describedby="v$.formulaire.heureDebut.$error ? 'tournee-heure-debut-erreur' : null"
            @blur="v$.formulaire.heureDebut.$touch()"
          >
          <p v-if="v$.formulaire.heureDebut.$error" id="tournee-heure-debut-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.heureDebut.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="tournee-heure-fin" class="form-label">Heure de fin</label>
          <input
            id="tournee-heure-fin"
            v-model="formulaire.heureFin"
            type="time"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.heureFin.$error }"
            :aria-describedby="v$.formulaire.heureFin.$error ? 'tournee-heure-fin-erreur' : null"
            @blur="v$.formulaire.heureFin.$touch()"
          >
          <p v-if="v$.formulaire.heureFin.$error" id="tournee-heure-fin-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.heureFin.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Jours d'application -->
      <fieldset
        class="mb-4"
        role="group"
        :aria-describedby="
          describedBy('tournee-jours-aide', v$.formulaire.joursApplication.$error ? 'tournee-jours-erreur' : null)
        "
      >
        <legend class="formulaire-legende"><span class="form-label d-block">Jours d'application</span></legend>
        <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-3">
          <div v-for="jour in JOURS_SEMAINE" :key="jour.iso" class="col">
            <div class="form-check formulaire-case">
              <input
                :id="'tournee-jour-' + jour.iso"
                v-model="formulaire.joursApplication"
                :value="jour.iso"
                type="checkbox"
                class="form-check-input"
                @change="v$.formulaire.joursApplication.$touch()"
              >
              <label class="form-check-label" :for="'tournee-jour-' + jour.iso">{{ jour.libelle }}</label>
            </div>
          </div>
        </div>
        <div id="tournee-jours-aide" class="form-text">Les jours de la semaine où cette tournée a lieu.</div>
        <p v-if="v$.formulaire.joursApplication.$error" id="tournee-jours-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.joursApplication.$errors[0].$message }}</span>
        </p>
      </fieldset>

      <!-- Effectif requis -->
      <div class="mb-4 formulaire-nombre">
        <label for="tournee-effectif" class="form-label">Nombre de personnes requises</label>
        <input
          id="tournee-effectif"
          v-model.number="formulaire.nbPersonnesRequises"
          type="number"
          min="1"
          max="20"
          step="1"
          class="form-control"
          :class="{ 'is-invalid': v$.formulaire.nbPersonnesRequises.$error }"
          :aria-describedby="
            describedBy(
              'tournee-effectif-aide',
              v$.formulaire.nbPersonnesRequises.$error ? 'tournee-effectif-erreur' : null
            )
          "
          @blur="v$.formulaire.nbPersonnesRequises.$touch()"
        >
        <div id="tournee-effectif-aide" class="form-text">
          Nombre de personnes nécessaires pour assurer cette tournée.
        </div>
        <p v-if="v$.formulaire.nbPersonnesRequises.$error" id="tournee-effectif-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.nbPersonnesRequises.$errors[0].$message }}</span>
        </p>
      </div>

      <!-- Couleur de repère -->
      <div class="mb-4">
        <span class="form-label d-block">Couleur de repère</span>

        <div
          class="d-flex flex-wrap gap-2 formulaire-palette"
          role="radiogroup"
          aria-label="Couleur de repère dans le planning"
        >
          <button
            v-for="(couleur, index) in couleursSuggerees"
            :key="couleur"
            type="button"
            role="radio"
            class="formulaire-pastille"
            :style="{ backgroundColor: couleur }"
            :aria-checked="formulaire.couleur === couleur"
            :aria-label="'Couleur ' + (index + 1)"
            :tabindex="tabIndexPastille(couleur)"
            :data-couleur="couleur"
            @click="choisirCouleur(couleur)"
            @keydown="onKeydownPastille($event, couleur)"
          >
            <PhCheck
              v-if="formulaire.couleur === couleur"
              :size="20"
              weight="bold"
              class="formulaire-pastille-coche"
              aria-hidden="true"
            />
          </button>
        </div>

        <div class="mt-3">
          <label for="tournee-couleur-libre" class="form-label">Autre couleur…</label>
          <input
            id="tournee-couleur-libre"
            v-model="formulaire.couleur"
            type="color"
            class="form-control form-control-color"
            @blur="v$.formulaire.couleur.$touch()"
          >
        </div>

        <p v-if="v$.formulaire.couleur.$error" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.couleur.$errors[0].$message }}</span>
        </p>

        <div class="formulaire-apercu mt-3">
          <span
            class="formulaire-pastille formulaire-pastille--apercu"
            :style="{ backgroundColor: formulaire.couleur }"
            aria-hidden="true"
          />
          <span>{{ formulaire.nom || 'Nom de la tournée' }}</span>
        </div>
      </div>

      <!-- Période de validité -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="tournee-date-debut" class="form-label">Valable à partir du (facultatif)</label>
          <input id="tournee-date-debut" v-model="formulaire.dateDebutValidite" type="date" class="form-control">
        </div>

        <div class="col-sm-6">
          <label for="tournee-date-fin" class="form-label">Valable jusqu'au (facultatif)</label>
          <input
            id="tournee-date-fin"
            v-model="formulaire.dateFinValidite"
            type="date"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.dateFinValidite.$error }"
            :aria-describedby="v$.formulaire.dateFinValidite.$error ? 'tournee-date-fin-erreur' : null"
            @blur="v$.formulaire.dateFinValidite.$touch()"
          >
          <p v-if="v$.formulaire.dateFinValidite.$error" id="tournee-date-fin-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.dateFinValidite.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-12">
          <div class="form-text">
            Pour une tournée saisonnière ou temporaire. Laissez vide si elle s'applique toute l'année.
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div class="mb-2">
        <label for="tournee-notes" class="form-label">Notes (facultatif)</label>
        <textarea
          id="tournee-notes"
          v-model="formulaire.notes"
          class="form-control"
          rows="3"
          maxlength="500"
          :class="{ 'is-invalid': v$.formulaire.notes.$error }"
          :aria-describedby="v$.formulaire.notes.$error ? 'tournee-notes-erreur' : null"
          @blur="v$.formulaire.notes.$touch()"
        />
        <p v-if="v$.formulaire.notes.$error" id="tournee-notes-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.notes.$errors[0].$message }}</span>
        </p>
      </div>

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
import { PhCheck, PhWarning } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import { JOURS_SEMAINE, libelleCreneau } from '@/domain/libelles.js';
import { CRENEAUX } from '@/domain/schema.js';
import { genId } from '@/domain/utils/id.js';

/**
 * Formulaire présentational d'ajout/édition d'une tournée (feature 0006).
 *
 * Bâti au-dessus de `ModaleBase`, sur le même patron que `FormulairePersonne`
 * (identité, sélecteur de couleur accessible) et `FormulairePreference`
 * (cases à cocher des jours). N'accède **pas** au store : il reçoit ses
 * données par props (`tournee` = `null` en création, objet en édition) et
 * **émet** le résultat normalisé (`enregistrer`) ou une annulation
 * (`annuler`) ; c'est l'écran appelant (`TourneesView`) qui dispatche vers le
 * store. Toute validation se fait avant émission : un formulaire invalide
 * n'émet jamais `enregistrer` et conserve la saisie en cours.
 */
export default {
  name: 'FormulaireTournee',
  components: { ModaleBase, PhCheck, PhWarning },
  props: {
    /** Affiche (`true`) ou masque (`false`) la modale ; piloté par le parent. */
    visible: { type: Boolean, required: true },
    /** `null` = mode création ; objet `Tournee` = mode édition. */
    tournee: { type: Object, default: null },
    /** Palette de couleurs suggérées (`cabinet/parametres.couleursParDefaut`). */
    couleursSuggerees: { type: Array, default: () => [] },
  },
  emits: ['enregistrer', 'annuler'],
  setup() {
    // Seul usage de la Composition API : pont requis par Vuelidate 2 en
    // Options API (ADR 0011), comme dans FormulairePersonne/FormulairePreference.
    return { v$: useVuelidate() };
  },
  data() {
    return {
      JOURS_SEMAINE,
      CRENEAUX,
      // Identifiant unique du `<form>`, pour relier le bouton « Enregistrer »
      // du pied de modale (hors du `<form>`) via l'attribut HTML `form`.
      idFormulaire: `formulaire-tournee-${genId()}`,
      formulaire: this.construireFormulaire(),
      // `true` après une tentative de soumission bloquée par la validation :
      // affiche un court récapitulatif près du pied de modale.
      soumissionInvalide: false,
    };
  },
  computed: {
    titreModale() {
      return this.tournee ? 'Modifier la tournée' : 'Ajouter une tournée';
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
    return {
      formulaire: {
        nom: {
          required: helpers.withMessage('Indiquez le nom de la tournée.', required),
        },
        code: {
          maxLength: helpers.withMessage(
            'Le code doit rester court (10 caractères maximum).',
            maxLength(10)
          ),
        },
        secteur: {
          maxLength: helpers.withMessage(
            'Le secteur ne doit pas dépasser 60 caractères.',
            maxLength(60)
          ),
        },
        creneau: {
          required,
        },
        heureDebut: {
          required: helpers.withMessage("Indiquez l'heure de début.", required),
        },
        heureFin: {
          required: helpers.withMessage("Indiquez l'heure de fin.", required),
          coherence: helpers.withMessage(
            "L'heure de fin doit être après l'heure de début.",
            (valeur, parent) => !parent.heureDebut || !valeur || valeur > parent.heureDebut
          ),
        },
        joursApplication: {
          required: helpers.withMessage("Choisissez au moins un jour d'application.", required),
        },
        nbPersonnesRequises: {
          required: helpers.withMessage(
            'Indiquez le nombre de personnes requises.',
            required
          ),
          integer: helpers.withMessage(
            'Indiquez un nombre entier de personnes (sans virgule).',
            integer
          ),
          between: helpers.withMessage(
            'Indiquez un nombre de personnes entre 1 et 20.',
            between(1, 20)
          ),
        },
        couleur: {
          required: helpers.withMessage('Choisissez une couleur de repère.', required),
        },
        dateFinValidite: {
          coherence: helpers.withMessage(
            'La date de fin doit être identique ou postérieure à la date de début.',
            (valeur, parent) => !parent.dateDebutValidite || !valeur || valeur >= parent.dateDebutValidite
          ),
        },
        notes: {
          maxLength: helpers.withMessage('La note ne doit pas dépasser 500 caractères.', maxLength(500)),
        },
      },
    };
  },
  methods: {
    libelleCreneau,

    /**
     * Construit le brouillon local à partir de `tournee` (édition) ou des
     * valeurs par défaut (création). Ne mute jamais la prop `tournee` :
     * `joursApplication` est toujours recopié dans un nouveau tableau.
     * @returns {Object} Brouillon prêt à être édité localement.
     */
    construireFormulaire() {
      if (this.tournee) {
        return {
          nom: this.tournee.nom,
          code: this.tournee.code ?? '',
          secteur: this.tournee.secteur ?? '',
          creneau: this.tournee.creneau,
          heureDebut: this.tournee.heureDebut ?? '',
          heureFin: this.tournee.heureFin ?? '',
          joursApplication: [...(this.tournee.joursApplication ?? [])],
          nbPersonnesRequises: this.tournee.nbPersonnesRequises,
          couleur: this.tournee.couleur,
          dateDebutValidite: this.tournee.dateDebutValidite ?? '',
          dateFinValidite: this.tournee.dateFinValidite ?? '',
          notes: this.tournee.notes ?? '',
        };
      }

      return {
        nom: '',
        code: '',
        secteur: '',
        creneau: 'MATIN',
        heureDebut: '08:00',
        heureFin: '12:00',
        joursApplication: [],
        nbPersonnesRequises: 1,
        couleur: this.couleursSuggerees[0] ?? '#2E86AB',
        dateDebutValidite: '',
        dateFinValidite: '',
        notes: '',
      };
    },

    /**
     * Réinitialise le brouillon et l'état de validation à chaque ouverture
     * de la modale (création vierge ou édition pré-remplie selon `tournee`).
     * Le focus, lui, est posé séparément (voir `onAffichee`) une fois la
     * transition d'ouverture de la modale réellement terminée.
     */
    reinitialiser() {
      this.formulaire = this.construireFormulaire();
      this.v$.$reset();
      this.soumissionInvalide = false;
    },

    /**
     * Place le focus sur le champ nom une fois que `ModaleBase` a fini
     * d'afficher la modale (événement `affichee`, relayé depuis
     * `shown.bs.modal` de Bootstrap). Le focus est ainsi déterministe : posé
     * après la fin réelle de la transition, il ne se fait pas reprendre par
     * le piège à focus de la modale (contrairement à un délai arbitraire).
     */
    onAffichee() {
      this.$refs.champNom?.focus();
    },

    /**
     * Construit une valeur `aria-describedby` à partir d'identifiants
     * optionnels (aide, erreur…), en ignorant ceux qui valent `null`/`''`.
     * @param {...(string|null)} ids
     * @returns {string|null}
     */
    describedBy(...ids) {
      const valides = ids.filter(Boolean);
      return valides.length ? valides.join(' ') : null;
    },

    /** Index de tabulation d'une pastille (tabulation « roving » du groupe de radios). */
    tabIndexPastille(couleur) {
      if (this.formulaire.couleur === couleur) return 0;
      const uneSuggestionEstSelectionnee = this.couleursSuggerees.includes(this.formulaire.couleur);
      return !uneSuggestionEstSelectionnee && couleur === this.couleursSuggerees[0] ? 0 : -1;
    },

    choisirCouleur(couleur) {
      this.formulaire.couleur = couleur;
      this.v$.formulaire.couleur.$touch();
    },

    /**
     * Navigation clavier du groupe de pastilles de couleur (pattern ARIA
     * « radiogroup ») : `Entrée`/`Espace` sélectionnent la pastille sous le
     * focus ; les flèches (`←`/`↑` = précédente, `→`/`↓` = suivante)
     * déplacent la sélection **et** le focus vers la pastille voisine, avec
     * bouclage sur la première/dernière pastille du groupe.
     * @param {KeyboardEvent} event
     * @param {string} couleur Couleur portée par la pastille qui reçoit l'événement.
     */
    onKeydownPastille(event, couleur) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.choisirCouleur(couleur);
        return;
      }

      const versSuivante = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const versPrecedente = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      if (!versSuivante && !versPrecedente) return;

      event.preventDefault();
      const bouton = event.currentTarget;
      const groupe = bouton.parentElement;
      const cible = versSuivante
        ? bouton.nextElementSibling ?? groupe.firstElementChild
        : bouton.previousElementSibling ?? groupe.lastElementChild;
      if (!cible) return;

      this.choisirCouleur(cible.dataset.couleur);
      cible.focus();
    },

    /**
     * Ordre visuel des champs du formulaire, utilisé pour focaliser le
     * premier champ en erreur après une tentative de soumission invalide
     * (`soumettre`). Chaque entrée relie une validation Vuelidate à
     * l'identifiant DOM du champ correspondant.
     * @returns {Array<{ validation: Object, id: string }>}
     */
    champsEnOrdre() {
      return [
        { validation: this.v$.formulaire.nom, id: 'tournee-nom' },
        { validation: this.v$.formulaire.creneau, id: 'tournee-creneau' },
        { validation: this.v$.formulaire.heureDebut, id: 'tournee-heure-debut' },
        { validation: this.v$.formulaire.heureFin, id: 'tournee-heure-fin' },
        { validation: this.v$.formulaire.joursApplication, id: `tournee-jour-${JOURS_SEMAINE[0].iso}` },
        { validation: this.v$.formulaire.nbPersonnesRequises, id: 'tournee-effectif' },
        { validation: this.v$.formulaire.couleur, id: 'tournee-couleur-libre' },
        { validation: this.v$.formulaire.dateFinValidite, id: 'tournee-date-fin' },
      ];
    },

    /**
     * Place le focus sur le premier champ en erreur (ordre visuel du
     * formulaire) après une tentative de soumission invalide : le fait
     * défiler dans la vue et guide la correction, plutôt que de laisser
     * l'utilisateur chercher le message d'erreur dans une longue modale.
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

      this.$emit('enregistrer', {
        nom: this.formulaire.nom.trim(),
        code: this.formulaire.code.trim(),
        secteur: this.formulaire.secteur.trim(),
        creneau: this.formulaire.creneau,
        heureDebut: this.formulaire.heureDebut,
        heureFin: this.formulaire.heureFin,
        joursApplication: [...this.formulaire.joursApplication],
        nbPersonnesRequises: this.formulaire.nbPersonnesRequises,
        couleur: this.formulaire.couleur,
        dateDebutValidite: this.formulaire.dateDebutValidite || null,
        dateFinValidite: this.formulaire.dateFinValidite || null,
        notes: this.formulaire.notes,
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.formulaire-select {
  max-width: 20rem;
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

// Le `<legend>` porte un vrai libellé de champ tout en gardant le groupement
// sémantique `fieldset`/`legend` pour les lecteurs d'écran ; on neutralise le
// style par défaut du navigateur (cohérent avec FormulairePreference).
.formulaire-legende {
  display: block;
  width: 100%;
  padding: 0;
  margin-bottom: t.$espace-2;
  border: 0;
}

.formulaire-pastille {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: t.$cible-cliquable-min;
  height: t.$cible-cliquable-min;
  padding: 0;
  border: 2px solid t.$couleur-bordure;
  border-radius: 50%;
  cursor: pointer;

  &:focus-visible {
    @include m.focus-visible;
  }
}

.formulaire-pastille-coche {
  color: #fff;
  // Assure la lisibilité de la coche sur une couleur claire comme sur une
  // couleur foncée (repère non-coloré, cf. accessibilité).
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.7));
}

.formulaire-pastille--apercu {
  width: t.$espace-5;
  height: t.$espace-5;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
}

.formulaire-apercu {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  font-weight: t.$graisse-gras;
}

// Présentation des messages d'erreur, cohérente avec FormulairePersonne/FormulairePreference.
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
