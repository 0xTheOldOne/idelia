<template>
  <div class="controles-grille" role="group" aria-label="Naviguer dans le temps">
    <!-- Boutons icône seule (retour porteur 2026-10-08) : libellé en
         infobulle `title` et en `aria-label`. -->
    <div class="controles-grille-paire">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary controles-grille-bouton"
        :aria-label="libellePrecedent"
        :title="libellePrecedent"
        @click="naviguer(-1)"
      >
        <PhCaretLeft :size="18" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary controles-grille-bouton"
        :aria-label="libelleSuivant"
        :title="libelleSuivant"
        @click="naviguer(1)"
      >
        <PhCaretRight :size="18" aria-hidden="true" />
      </button>
    </div>
    <button
      v-if="dateDebutPlanning"
      type="button"
      class="btn btn-sm btn-outline-secondary controles-grille-bouton"
      aria-label="Aller à la période du planning"
      title="Aller à la période du planning"
      @click="allerALaPeriodeDuPlanning"
    >
      <PhCalendarCheck :size="18" aria-hidden="true" />
    </button>
  </div>
</template>

<script>
import { PhCaretLeft, PhCaretRight, PhCalendarCheck } from '@phosphor-icons/vue';

import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Barre de navigation dans le temps de `GrillePlanning` (feature 0010),
 * **sans état propre** : précédent / suivant (pas = échelle courante) +
 * retour à la période du planning. Boutons secondaires discrets
 * (`btn-outline-*`), jamais l'action principale de l'écran. L'orientation et
 * l'échelle se règlent dans le bandeau de la grille
 * (`ReglagesAffichageGrille`, retour porteur 2026-10-07).
 *
 * Ne modifie **jamais** les données : émet uniquement `update:dateReference`,
 * calculée via `dateUtil` (aucun objet `Date` manipulé ici).
 */
export default {
  name: 'ControlesGrille',
  components: { PhCaretLeft, PhCaretRight, PhCalendarCheck },
  props: {
    /** Échelle courante : `'JOUR'`, `'SEMAINE'` ou `'MOIS'` (pas de la navigation). */
    echelle: { type: String, required: true },
    /** Date de référence courante `"YYYY-MM-DD"`, base du calcul des colonnes. */
    dateReference: { type: String, required: true },
    /**
     * Contexte facultatif pour « Aller à la période du planning » :
     * `{ dateDebutPlanning?: string }` — `planning.dateDebut` du planning
     * affiché. Le bouton est masqué si absent.
     */
    echelleContexte: { type: Object, default: () => ({}) },
  },
  emits: ['update:dateReference'],
  computed: {
    dateDebutPlanning() {
      return this.echelleContexte?.dateDebutPlanning ?? '';
    },
    /** Libellé du bouton « précédent », contextualisé par le pas de l'échelle courante. */
    libellePrecedent() {
      if (this.echelle === 'JOUR') return 'Jour précédent';
      if (this.echelle === 'SEMAINE') return 'Semaine précédente';
      return 'Mois précédent';
    },
    /** Libellé du bouton « suivant », contextualisé par le pas de l'échelle courante. */
    libelleSuivant() {
      if (this.echelle === 'JOUR') return 'Jour suivant';
      if (this.echelle === 'SEMAINE') return 'Semaine suivante';
      return 'Mois suivant';
    },
  },
  methods: {
    /**
     * Décale `dateReference` d'un pas selon l'échelle courante (±1 jour,
     * ±7 jours, ou mois adjacent), et émet la nouvelle date.
     * @param {number} sens - `-1` (précédent) ou `1` (suivant).
     */
    naviguer(sens) {
      let nouvelleDate;
      if (this.echelle === 'JOUR') {
        nouvelleDate = dateUtil.addDays(this.dateReference, sens);
      } else if (this.echelle === 'SEMAINE') {
        nouvelleDate = dateUtil.addDays(this.dateReference, sens * 7);
      } else {
        nouvelleDate =
          sens < 0
            ? dateUtil.moisPrecedent(this.dateReference)
            : dateUtil.moisSuivant(this.dateReference);
      }
      this.$emit('update:dateReference', nouvelleDate);
    },
    allerALaPeriodeDuPlanning() {
      if (!this.dateDebutPlanning) return;
      this.$emit('update:dateReference', this.dateDebutPlanning);
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

// Même gabarit que `ReglagesAffichageGrille` (bandeau de la grille) : petit
// espace entre groupes (resserré sur mobile pour tenir sur une ligne).
.controles-grille {
  display: flex;
  gap: t.$espace-2;

  @include m.a-partir-de('sm') {
    gap: t.$espace-3;
  }
}

.controles-grille-paire {
  display: flex;
  gap: t.$espace-1;
}

// Sous `lg` : les groupes s'étirent au prorata de leur nombre de boutons
// (paire = 2, bouton seul = 1), chaque bouton prenant la même largeur.
.controles-grille-paire {
  flex: 2 1 0;
}

.controles-grille-bouton {
  flex: 1 1 0;
}

@include m.a-partir-de('lg') {
  .controles-grille-paire,
  .controles-grille-bouton {
    flex: 0 0 auto;
  }
}

.controles-grille-bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;
}
</style>
