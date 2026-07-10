<template>
  <div class="parametres-view">
    <h1>Paramètres du cabinet</h1>

    <div
      v-if="statutSauvegarde === 'ERREUR_CHARGEMENT'"
      class="alert alert-warning d-flex gap-2"
      role="alert"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Vos réglages enregistrés n'ont pas pu être relus ; les valeurs par défaut sont affichées.
        Une copie de sauvegarde a été conservée. Rechargez la page pour réessayer ; si le problème
        persiste, réimportez une sauvegarde.
      </p>
    </div>

    <form novalidate @submit.prevent>
      <!-- Jours d'ouverture -->
      <section class="parametres-section">
        <fieldset
          role="group"
          :aria-describedby="v$.brouillon.joursOuverture.$error ? 'jours-ouverture-erreur' : null"
        >
          <legend class="parametres-legende">
            <h2>Jours d'ouverture</h2>
          </legend>

          <div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-3">
            <div v-for="jour in JOURS_SEMAINE" :key="jour.iso" class="col">
              <div class="form-check parametres-case">
                <input
                  :id="'jour-' + jour.iso"
                  v-model="brouillon.joursOuverture"
                  :value="jour.iso"
                  type="checkbox"
                  class="form-check-input"
                  @change="onJoursOuvertureChange"
                >
                <label class="form-check-label" :for="'jour-' + jour.iso">{{ jour.libelle }}</label>
              </div>
            </div>
          </div>

          <p v-if="v$.brouillon.joursOuverture.$error" id="jours-ouverture-erreur" class="parametres-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.brouillon.joursOuverture.$errors[0].$message }}</span>
          </p>
        </fieldset>
      </section>

      <!-- Créneaux de travail -->
      <section class="parametres-section">
        <fieldset
          role="group"
          :aria-describedby="v$.brouillon.creneauxActifs.$error ? 'creneaux-erreur' : null"
        >
          <legend class="parametres-legende">
            <h2>Créneaux de travail</h2>
          </legend>

          <div class="d-flex flex-wrap gap-3">
            <div v-for="code in CRENEAUX" :key="code" class="form-check parametres-case">
              <input
                :id="'creneau-' + code"
                v-model="brouillon.creneauxActifs"
                :value="code"
                type="checkbox"
                class="form-check-input"
                @change="onCreneauxActifsChange"
              >
              <label class="form-check-label" :for="'creneau-' + code">{{ libelleCreneau(code) }}</label>
            </div>
          </div>

          <p v-if="v$.brouillon.creneauxActifs.$error" id="creneaux-erreur" class="parametres-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.brouillon.creneauxActifs.$errors[0].$message }}</span>
          </p>
        </fieldset>
      </section>

      <!-- Rythme de travail -->
      <section class="parametres-section">
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
            <p v-if="v$.brouillon.reposHebdoMin.$error" id="repos-hebdo-min-erreur" class="parametres-erreur">
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
              class="parametres-erreur"
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
      </section>

      <!-- Affichage -->
      <section class="parametres-section">
        <h2>Affichage</h2>

        <label for="premier-jour-semaine" class="form-label">Premier jour de la semaine (affichage)</label>
        <select
          id="premier-jour-semaine"
          v-model.number="brouillon.premierJourSemaine"
          class="form-select parametres-select"
          @change="onPremierJourSemaineChange"
        >
          <option v-for="jour in JOURS_SEMAINE" :key="jour.iso" :value="jour.iso">
            {{ jour.libelle }}
          </option>
        </select>
        <div class="form-text">Utilisé pour l'affichage du calendrier.</div>
      </section>
    </form>

    <!-- Sauvegarde (hors formulaire : ce n'est pas un réglage saisi mais une action) -->
    <section class="parametres-section">
      <h2>Sauvegarde</h2>
      <BlocSauvegarde @donnees-remplacees="onDonneesRemplacees" />
    </section>
  </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex';
import { useVuelidate } from '@vuelidate/core';
import { required, between, integer, helpers } from '@vuelidate/validators';
import { PhWarning } from '@phosphor-icons/vue';

import BlocSauvegarde from '@/components/parametres/BlocSauvegarde.vue';
import { JOURS_SEMAINE, libelleCreneau } from '@/domain/libelles.js';
import { coherenceParametres } from '@/domain/cabinet.js';
import { CRENEAUX } from '@/domain/schema.js';

/**
 * Écran « Paramètres du cabinet » (feature 0003).
 *
 * Fonctionne sur un **brouillon local** (`data().brouillon`), copie des
 * paramètres courants du store : chaque champ n'est renvoyé au store
 * (`cabinet/majParametres`, persistance automatique) que s'il est **valide**
 * (Vuelidate). Un champ invalide affiche son message sous le champ et
 * conserve la saisie, sans jamais toucher au dernier réglage valide déjà
 * enregistré (aucune perte de données).
 */
export default {
  name: 'ParametresView',
  components: { BlocSauvegarde, PhWarning },
  setup() {
    // Seul usage de la Composition API : pont requis par Vuelidate 2 en
    // Options API (ADR 0011). Le reste du composant reste en Options API.
    return { v$: useVuelidate() };
  },
  data() {
    return {
      JOURS_SEMAINE,
      CRENEAUX,
      brouillon: {
        joursOuverture: [],
        creneauxActifs: [],
        reposHebdoMin: 2,
        maxJoursConsecutifs: 6,
        premierJourSemaine: 1,
      },
    };
  },
  computed: {
    ...mapGetters('cabinet', ['parametres']),
    ...mapState(['statutSauvegarde']),
    avertissementsCoherence() {
      return coherenceParametres(this.brouillon).avertissements;
    },
  },
  created() {
    // Le bootstrap (voir `main.js`) est terminé avant le montage : le
    // getter contient déjà les paramètres (par défaut ou persistés).
    this.brouillon = { ...this.parametres };
  },
  validations() {
    return {
      brouillon: {
        joursOuverture: {
          required: helpers.withMessage("Cochez au moins un jour d'ouverture.", required),
        },
        creneauxActifs: {
          required: helpers.withMessage('Cochez au moins un créneau de travail.', required),
        },
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
    libelleCreneau,

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

    onJoursOuvertureChange() {
      this.v$.brouillon.joursOuverture.$touch();
      if (!this.v$.brouillon.joursOuverture.$invalid) {
        this.majParametres({ joursOuverture: [...this.brouillon.joursOuverture] });
      }
    },
    onCreneauxActifsChange() {
      this.v$.brouillon.creneauxActifs.$touch();
      if (!this.v$.brouillon.creneauxActifs.$invalid) {
        this.majParametres({ creneauxActifs: [...this.brouillon.creneauxActifs] });
      }
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
    onPremierJourSemaineChange() {
      // Liste fermée (7 jours ISO) : aucune saisie libre, donc pas de
      // règle Vuelidate à vérifier avant l'enregistrement.
      this.majParametres({ premierJourSemaine: this.brouillon.premierJourSemaine });
    },

    /**
     * Après une restauration ou un effacement réussis (`BlocSauvegarde`),
     * le `brouillon` local (copié depuis `this.parametres` en `created`) est
     * périmé : on le réhydrate depuis le store pour que le formulaire
     * reflète immédiatement les nouvelles valeurs, sans rechargement de
     * page. On réinitialise aussi la validation (les anciennes erreurs ne
     * correspondent plus aux nouvelles valeurs).
     */
    onDonneesRemplacees() {
      this.brouillon = { ...this.parametres };
      this.v$.$reset();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.parametres-section {
  margin-bottom: t.$espace-5;
  padding-bottom: t.$espace-4;
  border-bottom: 1px solid t.$couleur-bordure;

  &:last-child {
    border-bottom: none;
  }
}

// La section « Sauvegarde » vit hors du `<form>` : sans ceci, la dernière
// section du formulaire (« Affichage ») serait `:last-child` de son parent et
// perdrait son trait de séparation avant « Sauvegarde ». On le lui rend.
form .parametres-section:last-child {
  border-bottom: 1px solid t.$couleur-bordure;
}

// Une case + son libellé forment une cible cliquable confortable (~44px),
// libellé entier cliquable (accessibilité, public non-technique).
.parametres-case {
  display: flex;
  align-items: center;
  min-height: t.$cible-cliquable-min;
  padding-left: 0;

  // Bootstrap positionne la case via `float` + marge négative (technique
  // pensée pour un `padding-left` sur le parent) ; on neutralise cette
  // technique au profit d'un simple flexbox, plus lisible ici.
  .form-check-input {
    float: none;
    width: 1.25rem;
    height: 1.25rem;
    margin-top: 0;
    margin-left: 0;
    margin-right: t.$espace-2;
    flex-shrink: 0;
  }

  .form-check-label {
    cursor: pointer;
  }
}

// Le `<legend>` porte un vrai titre `<h2>` (structure de titres cohérente)
// tout en gardant le groupement sémantique `fieldset`/`legend` pour les
// lecteurs d'écran. On neutralise le style par défaut du navigateur.
.parametres-legende {
  display: block;
  width: 100%;
  padding: 0;
  margin-bottom: t.$espace-3;
  border: 0;

  h2 {
    margin-bottom: 0;
  }
}

.parametres-select {
  max-width: 20rem;
}

// Cible cliquable confortable, cohérente avec les cases à cocher
// (`.parametres-case`) — public peu à l'aise avec l'informatique.
.form-control,
.form-select {
  min-height: t.$cible-cliquable-min;
}

// Présentation unique des messages d'erreur, pour les champs texte/nombre
// comme pour les groupes de cases (jours, créneaux) — cohérence demandée en
// relecture ergonomie (au lieu de deux styles différents).
.parametres-erreur {
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
