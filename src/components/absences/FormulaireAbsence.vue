<template>
  <ModaleBase
    :visible="visible"
    :titre="titreModale"
    taille="lg"
    @fermeture="$emit('annuler')"
    @affichee="onAffichee"
  >
    <form :id="idFormulaire" novalidate @submit.prevent="soumettre">
      <!-- Personne concernée -->
      <div class="mb-4">
        <label for="absence-personne" class="form-label">Personne concernée</label>
        <select
          id="absence-personne"
          ref="champPersonne"
          v-model="formulaire.personneId"
          class="form-select formulaire-select"
          :class="{ 'is-invalid': v$.formulaire.personneId.$error }"
          :aria-describedby="v$.formulaire.personneId.$error ? 'absence-personne-erreur' : null"
          @change="v$.formulaire.personneId.$touch()"
          @blur="v$.formulaire.personneId.$touch()"
        >
          <option value="" disabled>Choisir une personne…</option>
          <option v-for="personne in personnes" :key="personne.id" :value="personne.id">
            {{ personne.prenom }} {{ personne.nom }}
          </option>
        </select>
        <p v-if="v$.formulaire.personneId.$error" id="absence-personne-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.personneId.$errors[0].$message }}</span>
        </p>

        <div class="formulaire-apercu mt-2">
          <span
            class="formulaire-pastille formulaire-pastille--apercu"
            :style="{ backgroundColor: personneSelectionnee ? personneSelectionnee.couleur : 'transparent' }"
            aria-hidden="true"
          />
          <span>
            {{ personneSelectionnee ? `${personneSelectionnee.prenom} ${personneSelectionnee.nom}` : 'Aucune personne sélectionnée' }}
          </span>
        </div>
      </div>

      <!-- Motif -->
      <div class="mb-4">
        <label for="absence-motif" class="form-label">Motif</label>
        <select
          id="absence-motif"
          v-model="formulaire.type"
          class="form-select formulaire-select"
          :class="{ 'is-invalid': v$.formulaire.type.$error }"
          :aria-describedby="v$.formulaire.type.$error ? 'absence-motif-erreur' : null"
          @change="v$.formulaire.type.$touch()"
        >
          <option v-for="option in TYPES_ABSENCE_OPTIONS" :key="option.code" :value="option.code">
            {{ option.libelle }}
          </option>
        </select>
        <p v-if="v$.formulaire.type.$error" id="absence-motif-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.type.$errors[0].$message }}</span>
        </p>
      </div>

      <!-- Période -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="absence-date-debut" class="form-label">Du</label>
          <input
            id="absence-date-debut"
            v-model="formulaire.dateDebut"
            type="date"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.dateDebut.$error }"
            :aria-describedby="v$.formulaire.dateDebut.$error ? 'absence-date-debut-erreur' : null"
            @blur="v$.formulaire.dateDebut.$touch()"
          >
          <p v-if="v$.formulaire.dateDebut.$error" id="absence-date-debut-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.dateDebut.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="absence-date-fin" class="form-label">Au (inclus)</label>
          <input
            id="absence-date-fin"
            v-model="formulaire.dateFin"
            type="date"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.dateFin.$error }"
            :aria-describedby="v$.formulaire.dateFin.$error ? 'absence-date-fin-erreur' : null"
            @blur="v$.formulaire.dateFin.$touch()"
          >
          <p v-if="v$.formulaire.dateFin.$error" id="absence-date-fin-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.dateFin.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Avertissement de chevauchement (non bloquant) -->
      <div v-if="chevauchements.length" class="alert alert-warning d-flex gap-2" role="status" aria-live="polite">
        <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <p class="mb-0">
          Cette période recoupe une autre absence déjà enregistrée pour cette personne. Vous pouvez
          tout de même l'enregistrer.
        </p>
      </div>

      <!-- Créneau -->
      <div class="mb-4">
        <label for="absence-creneau" class="form-label">Créneau</label>
        <select
          id="absence-creneau"
          v-model="formulaire.creneau"
          class="form-select formulaire-select"
          :class="{ 'is-invalid': v$.formulaire.creneau.$error }"
          :aria-describedby="describedBy('absence-creneau-aide', v$.formulaire.creneau.$error ? 'absence-creneau-erreur' : null)"
          @change="v$.formulaire.creneau.$touch()"
        >
          <option v-for="code in CRENEAUX" :key="code" :value="code">{{ libelleCreneau(code) }}</option>
        </select>
        <div id="absence-creneau-aide" class="form-text">
          Choisissez Matin ou Après-midi pour une absence d'une demi-journée.
        </div>
        <p v-if="v$.formulaire.creneau.$error" id="absence-creneau-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.creneau.$errors[0].$message }}</span>
        </p>
      </div>

      <!-- Commentaire -->
      <div class="mb-2">
        <label for="absence-commentaire" class="form-label">Commentaire (facultatif)</label>
        <textarea
          id="absence-commentaire"
          v-model="formulaire.commentaire"
          class="form-control"
          rows="3"
          maxlength="500"
          placeholder="ex. arrêt transmis le 05/08"
          :class="{ 'is-invalid': v$.formulaire.commentaire.$error }"
          :aria-describedby="v$.formulaire.commentaire.$error ? 'absence-commentaire-erreur' : null"
          @blur="v$.formulaire.commentaire.$touch()"
        />
        <p v-if="v$.formulaire.commentaire.$error" id="absence-commentaire-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.commentaire.$errors[0].$message }}</span>
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
import { required, maxLength, helpers } from '@vuelidate/validators';
import { PhWarning } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import { CRENEAUX } from '@/domain/schema.js';
import { TYPES_ABSENCE_OPTIONS, libelleCreneau } from '@/domain/libelles.js';
import { chevauchementsPour } from '@/domain/absences.js';
import { genId } from '@/domain/utils/id.js';

/**
 * Formulaire présentational d'ajout/édition d'une absence (feature 0007).
 *
 * Bâti au-dessus de `ModaleBase`, calqué sur `FormulaireTournee` (0006).
 * N'accède **pas** au store : il reçoit ses données par props (`absence` =
 * `null` en création, objet en édition) et **émet** le résultat normalisé
 * (`enregistrer`) ou une annulation (`annuler`) ; c'est l'écran appelant
 * (`AbsencesView`) qui dispatche vers le store. Le **statut** n'est jamais
 * saisi ici : `creerAbsence` le force à `VALIDE` (saisie directe v1, feature
 * 0017) ; il n'existe plus de décision de validation.
 */
export default {
  name: 'FormulaireAbsence',
  components: { ModaleBase, PhWarning },
  props: {
    /** Affiche (`true`) ou masque (`false`) la modale ; piloté par le parent. */
    visible: { type: Boolean, required: true },
    /** `null` = mode création ; objet `Absence` = mode édition. */
    absence: { type: Object, default: null },
    /** Personnes sélectionnables (`{ id, prenom, nom, couleur }`). */
    personnes: { type: Array, default: () => [] },
    /** Toutes les autres absences, pour l'avertissement de chevauchement. */
    absencesExistantes: { type: Array, default: () => [] },
  },
  emits: ['enregistrer', 'annuler'],
  setup() {
    // Seul usage de la Composition API : pont requis par Vuelidate 2 en
    // Options API (ADR 0011), comme dans FormulaireTournee/FormulairePersonne.
    return { v$: useVuelidate() };
  },
  data() {
    return {
      CRENEAUX,
      TYPES_ABSENCE_OPTIONS,
      // Identifiant unique du `<form>`, pour relier le bouton « Enregistrer »
      // du pied de modale (hors du `<form>`) via l'attribut HTML `form`.
      idFormulaire: `formulaire-absence-${genId()}`,
      formulaire: this.construireFormulaire(),
      // `true` après une tentative de soumission bloquée par la validation :
      // affiche un court récapitulatif près du pied de modale.
      soumissionInvalide: false,
    };
  },
  computed: {
    titreModale() {
      return this.absence ? "Modifier l'absence" : 'Ajouter une absence';
    },
    /** Personne choisie, pour l'aperçu « pastille + Prénom Nom ». */
    personneSelectionnee() {
      return this.personnes.find((personne) => personne.id === this.formulaire.personneId) ?? null;
    },
    /**
     * Absences en conflit avec la période/créneau saisis, pour un
     * avertissement **non bloquant** (§6.2/§7 de la feature 0007) : calculé
     * dès que personne + les deux dates sont renseignées.
     * @returns {Array} Absences en conflit, `[]` si aucune ou saisie incomplète.
     */
    chevauchements() {
      const { personneId, dateDebut, dateFin, creneau } = this.formulaire;
      if (!personneId || !dateDebut || !dateFin) return [];
      return chevauchementsPour(
        { id: this.absence?.id ?? null, personneId, dateDebut, dateFin, creneau },
        this.absencesExistantes
      );
    },
  },
  watch: {
    visible(estVisible) {
      if (estVisible) {
        this.reinitialiser();
      }
    },
    /**
     * Nicety d'ergonomie : au changement de la date de début, si la date de
     * fin est vide ou antérieure, on la cale automatiquement dessus (une
     * absence d'un seul jour ne demande alors qu'une saisie).
     */
    'formulaire.dateDebut'(nouvelleValeur) {
      if (!nouvelleValeur) return;
      if (!this.formulaire.dateFin || this.formulaire.dateFin < nouvelleValeur) {
        this.formulaire.dateFin = nouvelleValeur;
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
        personneId: {
          required: helpers.withMessage('Choisissez la personne concernée.', required),
        },
        type: {
          required: helpers.withMessage("Choisissez le motif de l'absence.", required),
        },
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
        creneau: {
          required: helpers.withMessage('Choisissez un créneau.', required),
        },
        commentaire: {
          maxLength: helpers.withMessage(
            'Le commentaire ne doit pas dépasser 500 caractères.',
            maxLength(500)
          ),
        },
      },
    };
  },
  methods: {
    libelleCreneau,

    /**
     * Construit le brouillon local à partir de `absence` (édition) ou des
     * valeurs par défaut (création). Ne mute jamais la prop `absence`.
     * @returns {Object} Brouillon prêt à être édité localement.
     */
    construireFormulaire() {
      if (this.absence) {
        return {
          personneId: this.absence.personneId ?? '',
          type: this.absence.type,
          dateDebut: this.absence.dateDebut ?? '',
          dateFin: this.absence.dateFin ?? '',
          creneau: this.absence.creneau,
          commentaire: this.absence.commentaire ?? '',
        };
      }

      return {
        personneId: '',
        type: 'CONGE_PAYE',
        dateDebut: '',
        dateFin: '',
        creneau: 'JOURNEE',
        commentaire: '',
      };
    },

    /**
     * Réinitialise le brouillon et l'état de validation à chaque ouverture
     * de la modale (création vierge ou édition pré-remplie selon `absence`).
     * Le focus, lui, est posé séparément (voir `onAffichee`) une fois la
     * transition d'ouverture de la modale réellement terminée.
     */
    reinitialiser() {
      this.formulaire = this.construireFormulaire();
      this.v$.$reset();
      this.soumissionInvalide = false;
    },

    /**
     * Place le focus sur le sélecteur de personne une fois que `ModaleBase`
     * a fini d'afficher la modale (événement `affichee`, relayé depuis
     * `shown.bs.modal` de Bootstrap). Le focus est ainsi déterministe : posé
     * après la fin réelle de la transition, il ne se fait pas reprendre par
     * le piège à focus de la modale (contrairement à un délai arbitraire).
     */
    onAffichee() {
      this.$refs.champPersonne?.focus();
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

    /**
     * Ordre visuel des champs du formulaire, utilisé pour focaliser le
     * premier champ en erreur après une tentative de soumission invalide
     * (`soumettre`). Chaque entrée relie une validation Vuelidate à
     * l'identifiant DOM du champ correspondant.
     * @returns {Array<{ validation: Object, id: string }>}
     */
    champsEnOrdre() {
      return [
        { validation: this.v$.formulaire.personneId, id: 'absence-personne' },
        { validation: this.v$.formulaire.type, id: 'absence-motif' },
        { validation: this.v$.formulaire.dateDebut, id: 'absence-date-debut' },
        { validation: this.v$.formulaire.dateFin, id: 'absence-date-fin' },
        { validation: this.v$.formulaire.creneau, id: 'absence-creneau' },
        { validation: this.v$.formulaire.commentaire, id: 'absence-commentaire' },
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
        personneId: this.formulaire.personneId,
        type: this.formulaire.type,
        dateDebut: this.formulaire.dateDebut,
        dateFin: this.formulaire.dateFin,
        creneau: this.formulaire.creneau,
        commentaire: this.formulaire.commentaire.trim(),
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.formulaire-select {
  max-width: 20rem;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.form-control,
.form-select {
  min-height: t.$cible-cliquable-min;
}

.formulaire-pastille--apercu {
  width: t.$espace-5;
  height: t.$espace-5;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
  flex-shrink: 0;
}

.formulaire-apercu {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  font-weight: t.$graisse-gras;
}

// Présentation des messages d'erreur, cohérente avec FormulaireTournee/FormulairePersonne.
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
