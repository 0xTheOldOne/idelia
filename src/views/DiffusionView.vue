<template>
  <div class="diffusion-view">
    <template v-if="!planning">
      <div class="diffusion-introuvable">
        <PhCalendarX :size="48" aria-hidden="true" />
        <p class="mb-0">Ce planning est introuvable.</p>
        <router-link class="btn btn-outline-secondary" :to="{ name: 'planning' }">
          <PhArrowLeft :size="18" aria-hidden="true" />
          <span>Retour au planning</span>
        </router-link>
      </div>
    </template>

    <template v-else>
      <div class="diffusion-outils d-print-none">
        <a href="#" class="diffusion-retour" @click.prevent="retourPlanning">
          <PhArrowLeft :size="16" aria-hidden="true" />
          <span>Retour au planning</span>
        </a>

        <h1>Imprimer le planning</h1>
        <p class="diffusion-explication">
          Voici le planning tel qu'il sera imprimé. Pour obtenir un fichier PDF (par exemple pour
          l'envoyer par e-mail), choisissez « Enregistrer au format PDF » dans la fenêtre qui
          s'ouvre.
        </p>

        <div v-if="resume && resume.aResoudre > 0" class="alert alert-warning diffusion-bandeau" role="status">
          <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
          <div>
            <p class="mb-2">
              Ce planning a encore {{ resume.aResoudre }}
              {{ resume.aResoudre > 1 ? 'points' : 'point' }} à résoudre (conflits ou créneaux non
              pourvus). Vous pouvez l'imprimer tel quel, ou revenir le corriger.
            </p>
            <a href="#" class="diffusion-lien-bandeau" @click.prevent="retourPlanning">
              Revenir au planning
            </a>
          </div>
        </div>

        <p v-if="diffusion.vide" class="diffusion-vide">
          <PhInfo :size="18" aria-hidden="true" class="flex-shrink-0" />
          <span>Ce planning ne contient encore aucune affectation.</span>
        </p>

        <button type="button" class="btn btn-primary btn-lg diffusion-bouton" @click="imprimer">
          <PhPrinter :size="22" aria-hidden="true" />
          <span>Imprimer</span>
        </button>
      </div>

      <div class="diffusion-apercu">
        <div class="diffusion-feuilles">
          <FeuilleDiffusion
            v-for="(mois, index) in diffusion.pages"
            :key="index"
            :diffusion="diffusion"
            :mois="mois"
            :numero-page="index + 1"
            :nb-pages="diffusion.pages.length"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState, mapMutations, mapActions } from 'vuex';
import { PhArrowLeft, PhPrinter, PhCalendarX, PhWarning, PhInfo } from '@phosphor-icons/vue';

import FeuilleDiffusion from '@/components/diffusion/FeuilleDiffusion.vue';
import { construireDiffusion, titreDocumentDiffusion } from '@/domain/diffusion.js';

/**
 * Écran de diffusion (feature 0012) : aperçu fidèle au tirage du planning
 * `$route.params.id` (une feuille A4 par page) et bouton « Imprimer » qui ouvre
 * la fenêtre d'impression du navigateur (impression ou « Enregistrer au format
 * PDF »). Lecture seule : aucune donnée modifiée. Aucune logique métier : le
 * modèle vient de `construireDiffusion` (domaine). La barre d'outils est
 * masquée à l'impression (`d-print-none`).
 *
 * Finitions : bandeau non bloquant si le planning a encore des points à
 * résoudre (`plannings/resumeConflits`, lecture seule, état volatil) ; le titre
 * du document (`document.title`) nomme le PDF proposé par le navigateur et est
 * restauré en quittant la vue.
 */
export default {
  name: 'DiffusionView',
  components: { FeuilleDiffusion, PhArrowLeft, PhPrinter, PhCalendarX, PhWarning, PhInfo },
  data() {
    return {
      // Résumé des conflits du planning (`{ aResoudre, … }`) ; `null` tant que non calculé. Volatil.
      resume: null,
      // Titre du document avant l'entrée dans la vue, restauré au démontage.
      titreInitial: '',
    };
  },
  computed: {
    ...mapGetters('plannings', ['byId']),
    ...mapGetters('cabinet', ['parametres']),
    ...mapState('personnes', { personnes: 'items' }),
    ...mapState('tournees', { tournees: 'items' }),
    /** Planning à diffuser, ou `undefined` si l'identifiant est inconnu. */
    planning() {
      return this.byId(this.$route.params.id);
    },
    /** Modèle « planning papier » prêt à afficher. */
    diffusion() {
      return construireDiffusion({
        planning: this.planning,
        personnes: this.personnes,
        tournees: this.tournees,
        joursOuverture: this.parametres?.joursOuverture ?? [],
      });
    },
  },
  watch: {
    planning() {
      this.majTitre();
      this.chargerResume();
    },
  },
  created() {
    this.titreInitial = document.title;
  },
  mounted() {
    this.majTitre();
    this.chargerResume();
  },
  beforeUnmount() {
    document.title = this.titreInitial;
  },
  methods: {
    ...mapMutations('plannings', ['SELECT']),
    ...mapActions('plannings', { resumeConflitsAction: 'resumeConflits' }),
    /** Pose le titre du document (nom de fichier PDF proposé) si le planning existe. */
    majTitre() {
      if (this.planning) document.title = titreDocumentDiffusion(this.planning);
    },
    /** Calcule le résumé des points à résoudre ; échec silencieux (jamais bloquant). */
    async chargerResume() {
      this.resume = null;
      if (!this.planning) return;
      const id = this.planning.id;
      try {
        const resume = await this.resumeConflitsAction({ plannings: [this.planning] });
        if (this.planning?.id === id) this.resume = resume[id] ?? null;
      } catch (e) {
        console.error(e);
      }
    },
    /** Rouvre l'éditeur sur ce planning. */
    retourPlanning() {
      this.SELECT(this.planning.id);
      this.$router.push({ name: 'planning' });
    },
    /** Ouvre la fenêtre d'impression du navigateur. */
    imprimer() {
      window.print();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.diffusion-introuvable {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: t.$espace-3;
  padding: t.$espace-6 t.$espace-4;
  margin-top: t.$espace-4;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.diffusion-retour {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
  margin-bottom: t.$espace-3;
  color: t.$couleur-primaire;
  text-decoration: underline;

  &:hover,
  &:focus-visible {
    color: t.$couleur-primaire-foncee;
  }
}

.diffusion-explication {
  max-width: 60ch;
  color: t.$couleur-texte-attenue;
}

.diffusion-bandeau {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-3;
  max-width: 60ch;
}

.diffusion-lien-bandeau {
  color: t.$couleur-primaire;
  text-decoration: underline;

  &:hover,
  &:focus-visible {
    color: t.$couleur-primaire-foncee;
  }
}

.diffusion-vide {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  color: t.$couleur-texte-attenue;
}

.diffusion-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
  margin-bottom: t.$espace-4;
}

// Aperçu : défilement horizontal si l'écran est plus étroit qu'une feuille A4.
.diffusion-apercu {
  overflow-x: auto;
  padding-bottom: t.$espace-3;
}

.diffusion-feuilles {
  width: max-content;
  min-width: 100%;
}

@media print {
  .diffusion-apercu {
    overflow: visible;
    padding: 0;
  }

  .diffusion-feuilles {
    width: auto;
  }
}
</style>
