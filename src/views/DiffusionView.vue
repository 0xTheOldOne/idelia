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

        <!-- Titre + bouton à droite (même gabarit que Équipe / Tournées). -->
        <div class="diffusion-entete">
          <h1>Imprimer ou envoyer le planning</h1>
          <div class="diffusion-entete-actions">
            <button
              type="button"
              class="btn btn-outline-primary diffusion-bouton-icone diffusion-envoi"
              aria-label="Envoyer le planning par e-mail"
              :title="titreEnvoi"
              @click="modaleEnvoiVisible = true"
            >
              <PhEnvelopeSimple :size="20" aria-hidden="true" />
            </button>
            <button type="button" class="btn btn-primary diffusion-bouton" @click="imprimer">
              <PhPrinter :size="20" aria-hidden="true" />
              <span>Imprimer</span>
            </button>
          </div>
        </div>
        <p class="diffusion-explication">
          Voici le planning tel qu'il sera imprimé. Pour obtenir un fichier PDF, cliquez sur
          « Imprimer » puis choisissez « Enregistrer au format PDF ». Pour l'envoyer à l'équipe,
          cliquez ensuite sur le bouton enveloppe (« Envoyer le planning par e-mail »), à gauche
          d'« Imprimer » : votre messagerie s'ouvre avec les adresses de l'équipe.
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

        <div
          v-if="vacancesManquantes"
          class="alert alert-warning diffusion-bandeau diffusion-alerte-vacances d-print-none"
          role="status"
        >
          <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
          <div>
            <p class="mb-2">
              Les vacances scolaires n'ont pas pu être récupérées : elles n'apparaîtront pas sur ce
              tirage.
            </p>
            <button
              type="button"
              class="btn btn-outline-secondary diffusion-reessayer"
              :disabled="reessaiEnCours"
              :aria-busy="reessaiEnCours ? 'true' : 'false'"
              @click="reessayerVacances"
            >
              <span
                v-if="reessaiEnCours"
                class="spinner-border spinner-border-sm"
                aria-hidden="true"
              ></span>
              <PhArrowsClockwise v-else :size="18" aria-hidden="true" />
              <span>Réessayer</span>
            </button>
          </div>
        </div>

        <p v-if="diffusion.vide" class="diffusion-vide">
          <PhInfo :size="18" aria-hidden="true" class="flex-shrink-0" />
          <span>Ce planning ne contient encore aucune affectation.</span>
        </p>
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

      <ModaleEnvoiEmail
        :visible="modaleEnvoiVisible"
        :envoi="envoi"
        @fermeture="onFermetureModaleEnvoi"
        @completer-fiche="onCompleterFiche"
        @aller-equipe="onAllerEquipe"
      />
    </template>
  </div>
</template>

<script>
import { mapGetters, mapState, mapMutations, mapActions } from 'vuex';
import {
  PhArrowLeft,
  PhEnvelopeSimple,
  PhPrinter,
  PhCalendarX,
  PhWarning,
  PhInfo,
  PhArrowsClockwise,
} from '@phosphor-icons/vue';

import FeuilleDiffusion from '@/components/diffusion/FeuilleDiffusion.vue';
import ModaleEnvoiEmail from '@/components/diffusion/ModaleEnvoiEmail.vue';
import { preparerEnvoiEmail } from '@/domain/envoiEmail.js';
import { construireSourcesReperes } from '@/domain/calendrier/reperes.js';
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
 *
 * Envoi par e-mail (0027) : l'enveloppe ouvre `ModaleEnvoiEmail` (message préparé
 * dans la messagerie de l'utilisatrice, rien n'est persisté). Pour compléter une
 * fiche, la navigation vers l'Équipe a lieu **après** l'événement de fermeture de
 * la modale (sinon le fond grisé Bootstrap resterait) ; `?envoi=1` la rouvre au
 * retour de l'Équipe.
 */
export default {
  name: 'DiffusionView',
  components: {
    FeuilleDiffusion,
    ModaleEnvoiEmail,
    PhArrowLeft,
    PhEnvelopeSimple,
    PhPrinter,
    PhCalendarX,
    PhWarning,
    PhInfo,
    PhArrowsClockwise,
  },
  data() {
    return {
      // Résumé des conflits du planning (`{ aResoudre, … }`) ; `null` tant que non calculé. Volatil.
      resume: null,
      // Titre du document avant l'entrée dans la vue, restauré au démontage.
      titreInitial: '',
      // Visibilité de la modale d'envoi par e-mail, et navigation à faire une fois fermée.
      modaleEnvoiVisible: false,
      navigationEnAttente: null,
      // Dernier résultat de `vacancesScolaires/assurerCouverture` (0023) ; `null` tant que non connu. Volatil.
      resultatVacances: null,
      reessaiEnCours: false,
    };
  },
  computed: {
    ...mapGetters('plannings', ['byId']),
    ...mapGetters('cabinet', ['parametres']),
    ...mapGetters('vacancesScolaires', ['zoneCourante', 'periodesZoneCourante']),
    ...mapState('personnes', { personnes: 'items' }),
    ...mapState('tournees', { tournees: 'items' }),
    /** Planning à diffuser, ou `undefined` si l'identifiant est inconnu. */
    planning() {
      return this.byId(this.$route.params.id);
    },
    /** Repères calendaires (fériés, vacances) de la période du planning (0023). */
    sourcesReperes() {
      if (!this.planning) return {};
      return construireSourcesReperes({
        dateDebut: this.planning.dateDebut,
        dateFin: this.planning.dateFin,
        periodesVacances: this.periodesZoneCourante,
        zone: this.zoneCourante,
      });
    },
    /** Une zone est choisie mais les vacances de la période n'ont pas pu être récupérées. */
    vacancesManquantes() {
      const r = this.resultatVacances;
      return !!this.zoneCourante && !!r && !r.ok && r.etat !== 'SANS_ZONE';
    },
    /** Modèle « planning papier » prêt à afficher. */
    diffusion() {
      return construireDiffusion({
        planning: this.planning,
        personnes: this.personnes,
        tournees: this.tournees,
        joursOuverture: this.parametres?.joursOuverture ?? [],
        sourcesReperes: this.sourcesReperes,
      });
    },
    /** Préparation de l'envoi par e-mail (domaine, pur). */
    envoi() {
      return preparerEnvoiEmail({ planning: this.planning, personnes: this.personnes });
    },
    /** Infobulle de l'enveloppe. */
    titreEnvoi() {
      return this.envoi.etat === 'BLOQUE'
        ? 'Envoyer le planning par e-mail (adresses à compléter)'
        : 'Envoyer le planning par e-mail';
    },
  },
  watch: {
    planning() {
      this.majTitre();
      this.chargerResume();
      this.chargerVacances();
    },
  },
  created() {
    this.titreInitial = document.title;
  },
  mounted() {
    this.majTitre();
    this.chargerResume();
    this.chargerVacances();
    if (this.$route.query.envoi === '1' && this.planning) {
      this.modaleEnvoiVisible = true;
      this.$router.replace({ query: {} });
    }
  },
  beforeUnmount() {
    document.title = this.titreInitial;
  },
  methods: {
    ...mapMutations('plannings', ['SELECT']),
    ...mapActions('plannings', { resumeConflitsAction: 'resumeConflits' }),
    ...mapActions('vacancesScolaires', { assurerCouverture: 'assurerCouverture' }),
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
    /**
     * Vérifie que les vacances de la période sont en cache (0023), sans toast :
     * l'alerte de l'écran suffit. Ne rejette jamais.
     * @param {boolean} [forcer] - Réessai explicite (ignore les échecs de session).
     */
    async chargerVacances(forcer = false) {
      this.resultatVacances = null;
      if (!this.planning) return;
      const id = this.planning.id;
      const resultat = await this.assurerCouverture({
        dateDebut: this.planning.dateDebut,
        dateFin: this.planning.dateFin,
        silencieux: true,
        forcer,
      });
      if (this.planning?.id === id) this.resultatVacances = resultat ?? null;
    },
    /** Bouton « Réessayer » de l'alerte. */
    async reessayerVacances() {
      this.reessaiEnCours = true;
      try {
        await this.chargerVacances(true);
      } finally {
        this.reessaiEnCours = false;
      }
    },
    /** Rouvre l'éditeur sur ce planning. */
    retourPlanning() {
      this.SELECT(this.planning.id);
      this.$router.push({ name: 'planning' });
    },
    /** Ferme la modale, puis navigue vers l'Équipe pour compléter la fiche. */
    onCompleterFiche(personneId) {
      this.navigationEnAttente = {
        name: 'equipe',
        query: { modifier: personneId, retour: this.planning.id },
      };
      this.modaleEnvoiVisible = false;
    },
    /** Ferme la modale, puis ouvre l'Équipe. */
    onAllerEquipe() {
      this.navigationEnAttente = { name: 'equipe' };
      this.modaleEnvoiVisible = false;
    },
    /** Modale fermée : on peut changer de route sans laisser de fond grisé. */
    onFermetureModaleEnvoi() {
      this.modaleEnvoiVisible = false;
      const cible = this.navigationEnAttente;
      this.navigationEnAttente = null;
      if (cible) this.$router.push(cible);
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

.diffusion-reessayer {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.diffusion-vide {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  color: t.$couleur-texte-attenue;
}

// Espace avant l'aperçu (porté autrefois par le bouton « Imprimer »).
.diffusion-outils {
  margin-bottom: t.$espace-3;
}

.diffusion-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-3;

  h1 {
    margin-bottom: 0;
  }
}

.diffusion-entete-actions {
  display: flex;
  align-items: center;
  gap: t.$espace-3;
}

.diffusion-bouton-icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;
}

.diffusion-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
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
