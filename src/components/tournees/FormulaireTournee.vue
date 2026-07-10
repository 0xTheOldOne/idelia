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
      <div class="mb-4">
        <label for="tournee-libelle" class="form-label">Nom de la tournée</label>
        <input
          id="tournee-libelle"
          ref="champLibelle"
          v-model.trim="formulaire.libelle"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': v$.formulaire.libelle.$error }"
          :aria-describedby="v$.formulaire.libelle.$error ? 'tournee-libelle-erreur' : null"
          @blur="v$.formulaire.libelle.$touch()"
        >
        <p v-if="v$.formulaire.libelle.$error" id="tournee-libelle-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.libelle.$errors[0].$message }}</span>
        </p>
      </div>

      <!-- Horaires (1 ou 2 vacations : le matin, et éventuellement la reprise du soir) -->
      <div class="formulaire-segments-entete mb-2">
        <span class="form-label d-block mb-0">Horaires</span>
        <span v-if="tourneeCoupee" class="formulaire-badge-coupee">
          <PhArrowsSplit :size="16" weight="bold" aria-hidden="true" />
          <span>Tournée coupée</span>
        </span>
      </div>

      <fieldset v-for="(segment, index) in formulaire.segments" :key="index" class="formulaire-segment mb-3">
        <legend class="formulaire-legende formulaire-segment-titre">{{ titreSegment(index) }}</legend>

        <div class="row g-3">
          <div class="col-sm-4">
            <label :for="'tournee-segment-' + index + '-heure-debut'" class="form-label">Heure de début</label>
            <input
              :id="'tournee-segment-' + index + '-heure-debut'"
              v-model="segment.heureDebut"
              type="time"
              class="form-control"
              :class="{ 'is-invalid': v$.formulaire.segments[index].heureDebut.$error }"
              :aria-describedby="
                v$.formulaire.segments[index].heureDebut.$error
                  ? 'tournee-segment-' + index + '-heure-debut-erreur'
                  : null
              "
              @blur="v$.formulaire.segments[index].heureDebut.$touch()"
            >
            <p
              v-if="v$.formulaire.segments[index].heureDebut.$error"
              :id="'tournee-segment-' + index + '-heure-debut-erreur'"
              class="formulaire-erreur"
            >
              <PhWarning :size="14" weight="bold" aria-hidden="true" />
              <span>{{ v$.formulaire.segments[index].heureDebut.$errors[0].$message }}</span>
            </p>
          </div>

          <div class="col-sm-4">
            <label :for="'tournee-segment-' + index + '-heure-fin'" class="form-label">Heure de fin</label>
            <input
              :id="'tournee-segment-' + index + '-heure-fin'"
              v-model="segment.heureFin"
              type="time"
              class="form-control"
              :class="{ 'is-invalid': v$.formulaire.segments[index].heureFin.$error }"
              :aria-describedby="
                v$.formulaire.segments[index].heureFin.$error
                  ? 'tournee-segment-' + index + '-heure-fin-erreur'
                  : null
              "
              @blur="v$.formulaire.segments[index].heureFin.$touch()"
            >
            <p
              v-if="v$.formulaire.segments[index].heureFin.$error"
              :id="'tournee-segment-' + index + '-heure-fin-erreur'"
              class="formulaire-erreur"
            >
              <PhWarning :size="14" weight="bold" aria-hidden="true" />
              <span>{{ v$.formulaire.segments[index].heureFin.$errors[0].$message }}</span>
            </p>
          </div>

          <div class="col-sm-4 formulaire-nombre">
            <label :for="'tournee-segment-' + index + '-effectif'" class="form-label">
              Nombre de personnes requises
            </label>
            <input
              :id="'tournee-segment-' + index + '-effectif'"
              v-model.number="segment.nbPersonnesRequises"
              type="number"
              min="1"
              max="20"
              step="1"
              class="form-control"
              :class="{ 'is-invalid': v$.formulaire.segments[index].nbPersonnesRequises.$error }"
              :aria-describedby="
                describedBy(
                  'tournee-segment-' + index + '-effectif-aide',
                  v$.formulaire.segments[index].nbPersonnesRequises.$error
                    ? 'tournee-segment-' + index + '-effectif-erreur'
                    : null
                )
              "
              @blur="v$.formulaire.segments[index].nbPersonnesRequises.$touch()"
            >
            <div :id="'tournee-segment-' + index + '-effectif-aide'" class="form-text">
              {{ aideEffectif(index) }}
            </div>
            <p
              v-if="v$.formulaire.segments[index].nbPersonnesRequises.$error"
              :id="'tournee-segment-' + index + '-effectif-erreur'"
              class="formulaire-erreur"
            >
              <PhWarning :size="14" weight="bold" aria-hidden="true" />
              <span>{{ v$.formulaire.segments[index].nbPersonnesRequises.$errors[0].$message }}</span>
            </p>
          </div>
        </div>

        <button
          v-if="index === 1"
          type="button"
          class="btn btn-outline-secondary formulaire-bouton-segment"
          @click="retirerReprise"
        >
          <PhMinusCircle :size="18" aria-hidden="true" />
          <span>Retirer la reprise</span>
        </button>
      </fieldset>

      <button
        v-if="formulaire.segments.length === 1"
        ref="boutonAjouterReprise"
        type="button"
        class="btn btn-outline-secondary formulaire-bouton-segment mb-4"
        @click="ajouterReprise"
      >
        <PhPlus :size="18" weight="bold" aria-hidden="true" />
        <span>Ajouter une reprise le soir (journée coupée)</span>
      </button>

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
          <span>{{ formulaire.libelle || 'Nom de la tournée' }}</span>
          <span v-if="apercuHoraires"> · {{ apercuHoraires }}</span>
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
import { PhCheck, PhWarning, PhPlus, PhMinusCircle, PhArrowsSplit } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import { JOURS_SEMAINE } from '@/domain/libelles.js';
import { estCoupee, libelleHoraires } from '@/domain/tournees.js';
import { genId } from '@/domain/utils/id.js';

/**
 * Formulaire présentational d'ajout/édition d'une tournée (feature 0016, ADR
 * 0017 — modèle à segments horaires).
 *
 * Bâti au-dessus de `ModaleBase`, sur le même patron que `FormulairePersonne`
 * (identité, sélecteur de couleur accessible) et `FormulairePreference`
 * (cases à cocher des jours). N'accède **pas** au store : il reçoit ses
 * données par props (`tournee` = `null` en création, objet en édition) et
 * **émet** le résultat normalisé (`enregistrer`) ou une annulation
 * (`annuler`) ; c'est l'écran appelant (`TourneesView`) qui dispatche vers le
 * store. Toute validation se fait avant émission : un formulaire invalide
 * n'émet jamais `enregistrer` et conserve la saisie en cours.
 *
 * Une tournée porte **1 ou 2 segments horaires** (le matin, et
 * éventuellement une reprise le soir) : le premier segment est toujours
 * présent, le second s'ajoute/se retire via un bouton explicite. Le mot
 * « segment » ne doit **jamais** apparaître à l'écran (réservé au code) :
 * l'UI parle de « le matin » / « la reprise du soir ».
 */
export default {
  name: 'FormulaireTournee',
  components: { ModaleBase, PhCheck, PhWarning, PhPlus, PhMinusCircle, PhArrowsSplit },
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
    /** `true` si le brouillon porte 2 segments (journée coupée), dérivé (jamais stocké). */
    tourneeCoupee() {
      return estCoupee({ segments: this.formulaire.segments });
    },
    /** Horaires en clair du brouillon courant, pour l'aperçu (« 07:00 – 13:30 puis 17:00 – 20:00 »). */
    apercuHoraires() {
      return libelleHoraires({ segments: this.formulaire.segments });
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
        libelle: {
          required: helpers.withMessage('Indiquez le nom de la tournée.', required),
        },
        segments: this.formulaire.segments.map((_, index) => this.reglesSegment(index)),
        joursApplication: {
          required: helpers.withMessage("Choisissez au moins un jour d'application.", required),
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
    /**
     * Règles Vuelidate d'un segment, par indice (0 = le matin, 1 = la
     * reprise du soir). Le segment d'indice `1` porte une règle
     * supplémentaire sur `heureDebut` : la reprise doit commencer après la
     * fin du premier segment (comparaison directe via `this.formulaire`,
     * plutôt que via l'état « parent » de Vuelidate qui ne porte que le
     * segment courant).
     * @param {number} index
     * @returns {Object} Règles Vuelidate du segment.
     */
    reglesSegment(index) {
      const regles = {
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
        nbPersonnesRequises: {
          required: helpers.withMessage('Indiquez le nombre de personnes requises.', required),
          integer: helpers.withMessage('Indiquez un nombre entier de personnes (sans virgule).', integer),
          between: helpers.withMessage('Indiquez un nombre de personnes entre 1 et 20.', between(1, 20)),
        },
      };

      if (index === 1) {
        regles.heureDebut.repriseApresMatin = helpers.withMessage(
          'La reprise du soir doit commencer après la fin du matin.',
          (valeur) => {
            const finDuMatin = this.formulaire.segments[0]?.heureFin;
            return !valeur || !finDuMatin || valeur >= finDuMatin;
          }
        );
      }

      return regles;
    },

    /**
     * Construit le brouillon local à partir de `tournee` (édition) ou des
     * valeurs par défaut (création). Ne mute jamais la prop `tournee` :
     * `segments` et `joursApplication` sont toujours recopiés dans de
     * nouveaux tableaux (chaque segment est lui-même recopié dans un nouvel
     * objet).
     * @returns {Object} Brouillon prêt à être édité localement.
     */
    construireFormulaire() {
      if (this.tournee) {
        return {
          libelle: this.tournee.libelle,
          segments: this.tournee.segments.map((segment) => ({ ...segment })),
          joursApplication: [...(this.tournee.joursApplication ?? [])],
          couleur: this.tournee.couleur,
          dateDebutValidite: this.tournee.dateDebutValidite ?? '',
          dateFinValidite: this.tournee.dateFinValidite ?? '',
          notes: this.tournee.notes ?? '',
        };
      }

      return {
        libelle: '',
        segments: [{ heureDebut: '08:00', heureFin: '12:00', nbPersonnesRequises: 1 }],
        joursApplication: [],
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
     * Place le focus sur le champ libellé une fois que `ModaleBase` a fini
     * d'afficher la modale (événement `affichee`, relayé depuis
     * `shown.bs.modal` de Bootstrap). Le focus est ainsi déterministe : posé
     * après la fin réelle de la transition, il ne se fait pas reprendre par
     * le piège à focus de la modale (contrairement à un délai arbitraire).
     */
    onAffichee() {
      this.$refs.champLibelle?.focus();
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
     * Intitulé d'un segment, adapté au nombre de segments courant : neutre
     * (« Horaires ») pour une tournée complète, explicite (« Le matin » /
     * « La reprise du soir ») pour une tournée coupée. Jamais le mot
     * « segment » à l'écran.
     * @param {number} index
     * @returns {string}
     */
    titreSegment(index) {
      if (this.formulaire.segments.length === 1) return 'Horaires';
      return index === 0 ? 'Le matin' : 'La reprise du soir';
    },

    /**
     * Phrase d'aide de l'effectif requis, adaptée au nombre de segments
     * courant (jamais le mot « segment »/« vacation » à l'écran).
     * @param {number} index
     * @returns {string}
     */
    aideEffectif(index) {
      if (this.formulaire.segments.length === 1) {
        return 'Nombre de personnes nécessaires pour assurer cette tournée.';
      }
      return index === 0
        ? 'Nombre de personnes nécessaires le matin.'
        : 'Nombre de personnes nécessaires pour la reprise du soir.';
    },

    /**
     * Ajoute un second segment (« Ajouter une reprise le soir ») : la
     * tournée devient coupée. Horaires par défaut raisonnables (`17:00 –
     * 20:00`), effectif `1`, modifiables aussitôt. Place le focus sur la
     * nouvelle heure de début (feedback immédiat).
     */
    ajouterReprise() {
      this.formulaire.segments.push({ heureDebut: '17:00', heureFin: '20:00', nbPersonnesRequises: 1 });
      this.$nextTick(() => {
        this.$el.querySelector('#tournee-segment-1-heure-debut')?.focus();
      });
    },

    /**
     * Retire le second segment (« Retirer la reprise ») : la tournée
     * redevient complète. Action réversible et non destructrice (on est
     * dans un brouillon, rien n'est encore enregistré) : aucune confirmation
     * demandée. Replace le focus sur le bouton d'ajout, qui réapparaît.
     */
    retirerReprise() {
      this.formulaire.segments.splice(1, 1);
      this.$nextTick(() => {
        this.$refs.boutonAjouterReprise?.focus();
      });
    },

    /**
     * Ordre visuel des champs du formulaire, utilisé pour focaliser le
     * premier champ en erreur après une tentative de soumission invalide
     * (`soumettre`). Chaque entrée relie une validation Vuelidate à
     * l'identifiant DOM du champ correspondant. Étend l'ordre à chaque
     * segment présent (1 ou 2).
     * @returns {Array<{ validation: Object, id: string }>}
     */
    champsEnOrdre() {
      const ordre = [{ validation: this.v$.formulaire.libelle, id: 'tournee-libelle' }];

      this.formulaire.segments.forEach((_, index) => {
        ordre.push({
          validation: this.v$.formulaire.segments[index].heureDebut,
          id: `tournee-segment-${index}-heure-debut`,
        });
        ordre.push({
          validation: this.v$.formulaire.segments[index].heureFin,
          id: `tournee-segment-${index}-heure-fin`,
        });
        ordre.push({
          validation: this.v$.formulaire.segments[index].nbPersonnesRequises,
          id: `tournee-segment-${index}-effectif`,
        });
      });

      ordre.push({ validation: this.v$.formulaire.joursApplication, id: `tournee-jour-${JOURS_SEMAINE[0].iso}` });
      ordre.push({ validation: this.v$.formulaire.couleur, id: 'tournee-couleur-libre' });
      ordre.push({ validation: this.v$.formulaire.dateFinValidite, id: 'tournee-date-fin' });
      return ordre;
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
        libelle: this.formulaire.libelle.trim(),
        segments: this.formulaire.segments.map((segment) => ({
          heureDebut: segment.heureDebut,
          heureFin: segment.heureFin,
          nbPersonnesRequises: segment.nbPersonnesRequises,
        })),
        joursApplication: [...this.formulaire.joursApplication],
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

.formulaire-nombre {
  max-width: 16rem;
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

.formulaire-segments-entete {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-2;
}

// Repère « Tournée coupée » : toujours icône + texte (jamais la seule
// couleur), volontairement discret (fond neutre, pas d'alerte).
.formulaire-badge-coupee {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
  padding: 0.2rem t.$espace-2;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-md;
}

// Bloc de vacation, devenu un <fieldset> (accessibilité, correctif
// ergonomie post-relecture) : neutralise le style par défaut du navigateur
// (bordure/marge) pour conserver le rendu visuel de `0016` à l'identique.
.formulaire-segment {
  padding: t.$espace-3;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-md;
  border: 0;
  margin: 0;
  min-width: 0;
}

.formulaire-segment + .formulaire-segment {
  margin-top: t.$espace-3;
}

.formulaire-segment-titre {
  margin-bottom: t.$espace-2;
  font-weight: t.$graisse-gras;
}

// Cible cliquable identique pour les deux gestes réciproques (« Ajouter une
// reprise le soir » / « Retirer la reprise »), correctif ergonomie
// post-relecture.
.formulaire-bouton-segment {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  margin-top: t.$espace-2;
  min-height: t.$cible-cliquable-min;
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
