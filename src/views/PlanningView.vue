<template>
  <div class="planning-view">
    <h1>Planning</h1>

    <IndicateurSauvegarde
      :statut="statutSauvegarde"
      :derniere-sauvegarde="derniereSauvegarde"
      :apres-edition="aEdite"
    />

    <div v-if="personnesActives.length === 0" class="alert alert-info planning-etat-vide">
      <PhInfo :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <div>
        <p v-if="totalPersonnes === 0" class="mb-2">
          Ajoutez d'abord des personnes à votre équipe pour pouvoir générer un planning.
        </p>
        <p v-else class="mb-2">
          Aucune personne active : réactivez une personne depuis l'Équipe (ou ajoutez-en une) pour
          pouvoir générer un planning.
        </p>
        <router-link class="btn btn-primary planning-lien-etat-vide" :to="{ name: 'equipe' }">
          <PhUsers :size="18" aria-hidden="true" />
          <span>Aller à l'équipe</span>
        </router-link>
      </div>
    </div>

    <div v-if="tourneesActives.length === 0" class="alert alert-info planning-etat-vide">
      <PhInfo :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <div>
        <p v-if="totalTournees === 0" class="mb-2">
          Créez d'abord au moins une tournée pour pouvoir générer un planning.
        </p>
        <p v-else class="mb-2">
          Aucune tournée active : réactivez une tournée depuis les Tournées (ou créez-en une) pour
          pouvoir générer un planning.
        </p>
        <router-link class="btn btn-primary planning-lien-etat-vide" :to="{ name: 'tournees' }">
          <PhPath :size="18" aria-hidden="true" />
          <span>Aller aux tournées</span>
        </router-link>
      </div>
    </div>

    <template v-if="peutGenerer">
      <FormulaireGeneration :chargement="chargement" @generer="onGenerer" />

      <div v-if="erreurGeneration" class="alert alert-danger planning-erreur-generation" role="alert">
        <PhWarningOctagon :size="20" weight="bold" class="flex-shrink-0" aria-hidden="true" />
        <span>{{ erreurGeneration }}</span>
      </div>

      <p v-if="!planningCourant" class="planning-zone-resultat-attente">
        La proposition s'affichera ici après avoir cliqué sur « Générer le planning ».
      </p>
    </template>

    <p class="planning-annonce-invisible" role="status" aria-live="polite">{{ messageAnnonce }}</p>

    <div v-if="planningCourant" class="planning-resultat">
      <h2 ref="titrePlanning" tabindex="-1" class="planning-resultat-titre">
        {{ planningCourant.nom }}
      </h2>

      <ControlesGrille
        :orientation="orientation"
        :echelle="echelle"
        :date-reference="dateReference"
        :echelle-contexte="{ dateDebutPlanning: planningCourant.dateDebut }"
        @update:orientation="orientation = $event"
        @update:echelle="echelle = $event"
        @update:dateReference="dateReference = $event"
      />

      <GrillePlanning
        :planning="planningCourant"
        :orientation="orientation"
        :echelle="echelle"
        :date-reference="dateReference"
        :violations="diagnostics.violations"
        :tournees-non-couvertes="diagnostics.tourneesNonCouvertes"
      />

      <PanneauConflits
        :violations="diagnostics.violations"
        :tournees-non-couvertes="diagnostics.tourneesNonCouvertes"
      />
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions, mapMutations } from 'vuex';
import { PhInfo, PhUsers, PhPath, PhWarningOctagon } from '@phosphor-icons/vue';

import IndicateurSauvegarde from '@/components/communs/IndicateurSauvegarde.vue';
import FormulaireGeneration from '@/components/planning/FormulaireGeneration.vue';
import ControlesGrille from '@/components/planning/ControlesGrille.vue';
import GrillePlanning from '@/components/planning/GrillePlanning.vue';
import PanneauConflits from '@/components/planning/PanneauConflits.vue';

/**
 * Écran « Planning » (feature 010) : orchestre le choix d'une période, le
 * déclenchement d'une génération et l'affichage du planning courant (grille
 * + panneau de conflits), via le store `plannings`. Ne contient **aucune
 * logique métier** : l'appel au moteur pur passe exclusivement par les
 * actions `plannings/genererPropose`/`plannings/evaluerCourant` (ADR 0008).
 *
 * Détient l'état d'affichage (`orientation`, `echelle`, `dateReference`) et
 * l'état volatil des diagnostics (`{ violations, tourneesNonCouvertes,
 * score }`) : ni l'un ni l'autre n'est jamais persisté (02 : « les
 * diagnostics ne sont jamais stockés »). Au montage, `selectionId` n'étant
 * pas persisté, la vue auto-sélectionne le planning le plus récent si
 * aucune sélection n'existe (§4.4) puis recalcule les diagnostics via
 * `evaluerCourant` (le `Resultat` volatil d'une éventuelle génération
 * précédente a disparu au rechargement).
 */
export default {
  name: 'PlanningView',
  components: {
    PhInfo,
    PhUsers,
    PhPath,
    PhWarningOctagon,
    IndicateurSauvegarde,
    FormulaireGeneration,
    ControlesGrille,
    GrillePlanning,
    PanneauConflits,
  },
  data() {
    return {
      // `true` pendant l'appel au moteur (bascule le libellé du bouton).
      chargement: false,
      // Diagnostics volatils du planning courant (`{ violations,
      // tourneesNonCouvertes, score }`), issus soit du `Resultat` d'une
      // génération fraîche, soit de `evaluerCourant` (montage/rechargement).
      // Jamais persisté (02 : « les diagnostics ne sont jamais stockés »).
      diagnostics: { violations: [], tourneesNonCouvertes: [], score: 0 },
      // Réglages d'affichage de la grille : ne modifient jamais les données,
      // purement volatils (§4.4).
      orientation: 'TOURNEES',
      echelle: 'SEMAINE',
      dateReference: '',
      // Distingue une sauvegarde issue d'une vraie action utilisateur d'une
      // sauvegarde héritée de l'hydratation initiale (même logique
      // qu'AbsencesView/TourneesView) : passé à `IndicateurSauvegarde`.
      aEdite: false,
      // Message d'erreur affiché (alerte) si la génération échoue ; vide sinon.
      // Remis à vide au début de chaque nouvelle tentative.
      erreurGeneration: '',
      // Texte annoncé par la région `aria-live` après une génération
      // (succès ou échec), pour les technologies d'assistance.
      messageAnnonce: '',
    };
  },
  computed: {
    ...mapGetters('personnes', { personnesActives: 'actifs' }),
    ...mapGetters('tournees', { tourneesActives: 'actives' }),
    ...mapGetters('plannings', { planningCourant: 'courant' }),
    // Nombre total de personnes/tournées (actives + archivées), pour
    // distinguer « aucune donnée du tout » d'« entièrement archivée » dans
    // le message d'état vide (calqué sur AbsencesView).
    ...mapState('personnes', { totalPersonnes: (state) => state.items.length }),
    ...mapState('tournees', { totalTournees: (state) => state.items.length }),
    ...mapState('plannings', { planningsExistants: (state) => state.items }),
    ...mapState(['statutSauvegarde', 'derniereSauvegarde']),
    /** Le formulaire de génération n'est utile que si les deux ingrédients indispensables existent. */
    peutGenerer() {
      return this.personnesActives.length > 0 && this.tourneesActives.length > 0;
    },
  },
  methods: {
    ...mapActions('plannings', ['genererPropose', 'evaluerCourant']),
    ...mapMutations('plannings', ['SELECT']),

    /**
     * Recalcule les diagnostics du planning courant (lecture seule, aucun
     * `commit` côté store) et les remplace en état local.
     */
    async rafraichirDiagnostics() {
      this.diagnostics = await this.evaluerCourant();
    },

    /**
     * Lance une génération pour la période choisie. Le moteur étant
     * synchrone (< 300 ms), on bascule d'abord l'état `chargement` et on
     * attend le prochain tick pour laisser l'UI peindre l'indicateur avant
     * d'appeler l'action (§8, ADR 0008 : appel moteur toujours via le store).
     * Alimente ensuite la vue avec la partie diagnostics du `Resultat`
     * retourné et recale `dateReference` sur la période fraîchement générée.
     *
     * En cas d'échec (`try`/`catch`), affiche un message d'erreur clair et
     * actionnable et l'annonce via la région `aria-live` ; le bouton n'est
     * **jamais** laissé bloqué sur « Génération en cours… » (`finally`).
     * @param {{ dateDebut: string, dateFin: string }} payload
     */
    async onGenerer(payload) {
      this.chargement = true;
      this.erreurGeneration = '';
      this.messageAnnonce = '';
      try {
        await this.$nextTick();
        const resultat = await this.genererPropose(payload);
        this.diagnostics = {
          violations: resultat.violations,
          tourneesNonCouvertes: resultat.tourneesNonCouvertes,
          score: resultat.score,
        };
        this.dateReference = this.planningCourant.dateDebut;
        this.aEdite = true;
        this.messageAnnonce = this.construireAnnonceSucces();
        await this.$nextTick();
        this.$refs.titrePlanning?.focus();
      } catch {
        this.erreurGeneration =
          "La génération n'a pas pu aboutir. Réessayez, ou vérifiez votre équipe et vos tournées.";
        this.messageAnnonce = this.erreurGeneration;
      } finally {
        this.chargement = false;
      }
    },

    /**
     * Texte annoncé après une génération réussie, cohérent avec les
     * compteurs de `PanneauConflits` (mêmes longueurs de `violations`/
     * `tourneesNonCouvertes`, aucune dérivation supplémentaire).
     * @returns {string}
     */
    construireAnnonceSucces() {
      const nbPoints = this.diagnostics.violations.length;
      const nbNonPourvus = this.diagnostics.tourneesNonCouvertes.length;
      if (nbPoints === 0 && nbNonPourvus === 0) {
        return 'Planning généré, aucun conflit.';
      }
      return (
        `Planning généré : ${nbPoints} point${nbPoints > 1 ? 's' : ''} d'attention, ` +
        `${nbNonPourvus} créneau${nbNonPourvus > 1 ? 'x' : ''} non pourvu${nbNonPourvus > 1 ? 's' : ''}.`
      );
    },
  },
  /**
   * `selectionId` (state `plannings`) n'est pas persisté : au rechargement,
   * `getters['plannings/courant']` est `null` même si des plannings
   * existent. On auto-sélectionne alors le plus récent (`createdAt`
   * décroissant) et on recalcule ses diagnostics via `evaluerCourant` (§4.4),
   * jamais lus depuis un stockage.
   */
  async mounted() {
    if (!this.planningCourant && this.planningsExistants.length > 0) {
      const plusRecent = [...this.planningsExistants].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      )[0];
      this.SELECT(plusRecent.id);
    }
    if (this.planningCourant) {
      this.dateReference = this.planningCourant.dateDebut;
      await this.rafraichirDiagnostics();
    }
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.planning-etat-vide {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
}

.planning-lien-etat-vide {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.planning-zone-resultat-attente {
  margin-top: t.$espace-4;
  padding: t.$espace-6 t.$espace-4;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.planning-erreur-generation {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-3;
  margin-top: t.$espace-3;
}

// Région d'annonce (aria-live) : présente dans le DOM et réellement
// annoncée par les lecteurs d'écran, sans occuper d'espace visuel.
.planning-annonce-invisible {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.planning-resultat {
  margin-top: t.$espace-4;
}

.planning-resultat-titre {
  margin-bottom: t.$espace-3;

  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: 2px;
  }
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
