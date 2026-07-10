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
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="personne-prenom" class="form-label">Prénom</label>
          <input
            id="personne-prenom"
            ref="champPrenom"
            v-model.trim="formulaire.prenom"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.prenom.$error }"
            :aria-describedby="v$.formulaire.prenom.$error ? 'personne-prenom-erreur' : null"
            @blur="v$.formulaire.prenom.$touch()"
          >
          <p v-if="v$.formulaire.prenom.$error" id="personne-prenom-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.prenom.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="personne-nom" class="form-label">Nom</label>
          <input
            id="personne-nom"
            v-model.trim="formulaire.nom"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.nom.$error }"
            :aria-describedby="v$.formulaire.nom.$error ? 'personne-nom-erreur' : null"
            @blur="v$.formulaire.nom.$touch()"
          >
          <p v-if="v$.formulaire.nom.$error" id="personne-nom-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.nom.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Statut -->
      <div class="mb-4">
        <label for="personne-statut" class="form-label">Statut</label>
        <select id="personne-statut" v-model="formulaire.statut" class="form-select formulaire-select">
          <option v-for="option in STATUTS_PERSONNE_OPTIONS" :key="option.code" :value="option.code">
            {{ option.libelle }}
          </option>
        </select>
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
          <label for="personne-couleur-libre" class="form-label">Autre couleur…</label>
          <input
            id="personne-couleur-libre"
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
          <span>{{ formulaire.prenom || 'Prénom' }} {{ formulaire.nom || 'Nom' }}</span>
        </div>
      </div>

      <!-- Temps de travail -->
      <div class="mb-4">
        <label for="personne-quotite" class="form-label">Temps de travail</label>
        <div class="input-group formulaire-quotite">
          <input
            id="personne-quotite"
            v-model.number="formulaire.quotite"
            type="number"
            min="0"
            max="100"
            step="1"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.quotite.$error }"
            :aria-describedby="
              describedBy('personne-quotite-aide', v$.formulaire.quotite.$error ? 'personne-quotite-erreur' : null)
            "
            @blur="v$.formulaire.quotite.$touch()"
          >
          <span class="input-group-text">%</span>
        </div>
        <div id="personne-quotite-aide" class="form-text">
          Proportion du temps plein travaillé par cette personne.
        </div>
        <p v-if="v$.formulaire.quotite.$error" id="personne-quotite-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.quotite.$errors[0].$message }}</span>
        </p>
      </div>

      <!-- Présence -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="personne-date-entree" class="form-label">Date d'arrivée (si connue)</label>
          <input id="personne-date-entree" v-model="formulaire.dateEntree" type="date" class="form-control">
        </div>

        <div class="col-sm-6">
          <label for="personne-date-sortie" class="form-label">Date de départ (si connue)</label>
          <input
            id="personne-date-sortie"
            v-model="formulaire.dateSortie"
            type="date"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.dateSortie.$error }"
            :aria-describedby="v$.formulaire.dateSortie.$error ? 'personne-date-sortie-erreur' : null"
            @blur="v$.formulaire.dateSortie.$touch()"
          >
          <p v-if="v$.formulaire.dateSortie.$error" id="personne-date-sortie-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.dateSortie.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Coordonnées & notes -->
      <div class="row g-3 mb-3">
        <div class="col-sm-6">
          <label for="personne-email" class="form-label">Adresse e-mail (facultatif)</label>
          <input
            id="personne-email"
            v-model.trim="formulaire.contact.email"
            type="email"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.contact.email.$error }"
            :aria-describedby="v$.formulaire.contact.email.$error ? 'personne-email-erreur' : null"
            @blur="v$.formulaire.contact.email.$touch()"
          >
          <p v-if="v$.formulaire.contact.email.$error" id="personne-email-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.contact.email.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="personne-telephone" class="form-label">Téléphone (facultatif)</label>
          <input
            id="personne-telephone"
            v-model.trim="formulaire.contact.telephone"
            type="tel"
            class="form-control"
            placeholder="06 12 34 56 78"
          >
        </div>
      </div>

      <div class="mb-2">
        <label for="personne-notes" class="form-label">Notes (facultatif)</label>
        <textarea
          id="personne-notes"
          v-model="formulaire.notes"
          class="form-control"
          rows="3"
          maxlength="500"
          :class="{ 'is-invalid': v$.formulaire.notes.$error }"
          :aria-describedby="v$.formulaire.notes.$error ? 'personne-notes-erreur' : null"
          @blur="v$.formulaire.notes.$touch()"
        />
        <p v-if="v$.formulaire.notes.$error" id="personne-notes-erreur" class="formulaire-erreur">
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
import { required, integer, between, email, maxLength, helpers } from '@vuelidate/validators';
import { PhCheck, PhWarning } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import { STATUTS_PERSONNE_OPTIONS } from '@/domain/libelles.js';
import { genId } from '@/domain/utils/id.js';

/**
 * Formulaire présentational d'ajout/édition d'une personne (feature 0004).
 *
 * Bâti au-dessus de `ModaleBase`. N'accède **pas** au store : il reçoit ses
 * données par props (`personne` = `null` en création, objet en édition) et
 * **émet** le résultat normalisé (`enregistrer`) ou une annulation
 * (`annuler`) ; c'est l'écran appelant (`EquipeView`) qui dispatche vers le
 * store. Toute validation se fait avant émission : un formulaire invalide
 * n'émet jamais `enregistrer` et conserve la saisie en cours.
 */
export default {
  name: 'FormulairePersonne',
  components: { ModaleBase, PhCheck, PhWarning },
  props: {
    /** Affiche (`true`) ou masque (`false`) la modale ; piloté par le parent. */
    visible: { type: Boolean, required: true },
    /** `null` = mode création ; objet `Personne` = mode édition. */
    personne: { type: Object, default: null },
    /** Palette de couleurs suggérées (`cabinet/parametres.couleursParDefaut`). */
    couleursSuggerees: { type: Array, default: () => [] },
  },
  emits: ['enregistrer', 'annuler'],
  setup() {
    // Seul usage de la Composition API : pont requis par Vuelidate 2 en
    // Options API (ADR 0011), comme dans ParametresView.
    return { v$: useVuelidate() };
  },
  data() {
    return {
      STATUTS_PERSONNE_OPTIONS,
      // Identifiant unique du `<form>`, pour relier le bouton « Enregistrer »
      // du pied de modale (hors du `<form>`) via l'attribut HTML `form`.
      idFormulaire: `formulaire-personne-${genId()}`,
      formulaire: this.construireFormulaire(),
      // `true` après une tentative de soumission bloquée par la validation :
      // affiche un court récapitulatif près du pied de modale.
      soumissionInvalide: false,
    };
  },
  computed: {
    titreModale() {
      return this.personne ? 'Modifier la personne' : 'Ajouter une personne';
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
        prenom: {
          required: helpers.withMessage('Indiquez le prénom de la personne.', required),
        },
        nom: {
          required: helpers.withMessage('Indiquez le nom de la personne.', required),
        },
        couleur: {
          required: helpers.withMessage('Choisissez une couleur de repère.', required),
        },
        quotite: {
          required: helpers.withMessage(
            'Indiquez un temps de travail entre 0 et 100 %.',
            required
          ),
          integer: helpers.withMessage(
            'Indiquez un temps de travail en pourcentage entier (sans virgule).',
            integer
          ),
          between: helpers.withMessage(
            'Indiquez un temps de travail entre 0 et 100 %.',
            between(0, 100)
          ),
        },
        dateSortie: {
          coherence: helpers.withMessage(
            "La date de départ doit être identique ou postérieure à la date d'arrivée.",
            (valeur, parent) => !parent.dateEntree || !valeur || valeur >= parent.dateEntree
          ),
        },
        contact: {
          email: {
            email: helpers.withMessage(
              'Saisissez une adresse e-mail valide (ex. nom@exemple.fr).',
              email
            ),
          },
        },
        notes: {
          maxLength: helpers.withMessage(
            'La note ne doit pas dépasser 500 caractères.',
            maxLength(500)
          ),
        },
      },
    };
  },
  methods: {
    /**
     * Construit le brouillon local à partir de `personne` (édition) ou des
     * valeurs par défaut (création). Ne mute jamais la prop `personne` : les
     * objets imbriqués (`contact`) sont toujours recopiés.
     * @returns {Object} Brouillon prêt à être édité localement.
     */
    construireFormulaire() {
      if (this.personne) {
        return {
          prenom: this.personne.prenom,
          nom: this.personne.nom,
          statut: this.personne.statut,
          couleur: this.personne.couleur,
          quotite: this.personne.quotite,
          dateEntree: this.personne.dateEntree ?? '',
          dateSortie: this.personne.dateSortie ?? '',
          contact: {
            email: this.personne.contact?.email ?? '',
            telephone: this.personne.contact?.telephone ?? '',
          },
          notes: this.personne.notes ?? '',
        };
      }

      return {
        prenom: '',
        nom: '',
        statut: 'TITULAIRE',
        couleur: this.couleursSuggerees[0] ?? '#2E86AB',
        quotite: 100,
        dateEntree: '',
        dateSortie: '',
        contact: { email: '', telephone: '' },
        notes: '',
      };
    },

    /**
     * Réinitialise le brouillon et l'état de validation à chaque ouverture
     * de la modale (création vierge ou édition pré-remplie selon `personne`).
     * Le focus, lui, est posé séparément (voir `onAffichee`) une fois la
     * transition d'ouverture de la modale réellement terminée.
     */
    reinitialiser() {
      this.formulaire = this.construireFormulaire();
      this.v$.$reset();
      this.soumissionInvalide = false;
    },

    /**
     * Place le focus sur le champ prénom une fois que `ModaleBase` a fini
     * d'afficher la modale (événement `affichee`, relayé depuis
     * `shown.bs.modal` de Bootstrap). Le focus est ainsi déterministe : posé
     * après la fin réelle de la transition, il ne se fait pas reprendre par
     * le piège à focus de la modale (contrairement à un délai arbitraire).
     */
    onAffichee() {
      this.$refs.champPrenom?.focus();
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
        { validation: this.v$.formulaire.prenom, id: 'personne-prenom' },
        { validation: this.v$.formulaire.nom, id: 'personne-nom' },
        { validation: this.v$.formulaire.couleur, id: 'personne-couleur-libre' },
        { validation: this.v$.formulaire.quotite, id: 'personne-quotite' },
        { validation: this.v$.formulaire.dateSortie, id: 'personne-date-sortie' },
        { validation: this.v$.formulaire.contact.email, id: 'personne-email' },
        { validation: this.v$.formulaire.notes, id: 'personne-notes' },
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
        prenom: this.formulaire.prenom.trim(),
        nom: this.formulaire.nom.trim(),
        statut: this.formulaire.statut,
        couleur: this.formulaire.couleur,
        quotite: this.formulaire.quotite,
        dateEntree: this.formulaire.dateEntree || null,
        dateSortie: this.formulaire.dateSortie || null,
        contact: {
          email: this.formulaire.contact.email || null,
          telephone: this.formulaire.contact.telephone || null,
        },
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

// Cible cliquable confortable, cohérente avec le reste de l'application.
.form-control,
.form-select {
  min-height: t.$cible-cliquable-min;
}

.formulaire-quotite {
  max-width: 12rem;
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

// Présentation des messages d'erreur, cohérente avec ParametresView.
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
