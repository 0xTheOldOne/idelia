<template>
  <div class="controles-grille">
    <div class="controles-grille-groupe" role="group" aria-label="Choisir l'affichage de la grille">
      <span class="controles-grille-etiquette">Afficher par</span>
      <button
        v-for="option in optionsOrientation"
        :key="option.code"
        type="button"
        class="btn btn-sm controles-grille-bouton"
        :class="orientation === option.code ? 'btn-outline-primary' : 'btn-outline-secondary'"
        :aria-pressed="orientation === option.code ? 'true' : 'false'"
        @click="$emit('update:orientation', option.code)"
      >
        <PhCheck v-if="orientation === option.code" :size="14" weight="bold" aria-hidden="true" />
        <component :is="option.icone" :size="18" aria-hidden="true" />
        <span>{{ option.libelle }}</span>
      </button>
    </div>

    <div class="controles-grille-groupe" role="group" aria-label="Choisir l'échelle de temps">
      <span class="controles-grille-etiquette">Échelle</span>
      <button
        v-for="option in optionsEchelle"
        :key="option.code"
        type="button"
        class="btn btn-sm controles-grille-bouton"
        :class="echelle === option.code ? 'btn-outline-primary' : 'btn-outline-secondary'"
        :aria-pressed="echelle === option.code ? 'true' : 'false'"
        @click="$emit('update:echelle', option.code)"
      >
        <PhCheck v-if="echelle === option.code" :size="14" weight="bold" aria-hidden="true" />
        <span>{{ option.libelle }}</span>
      </button>
    </div>

    <div class="controles-grille-groupe" role="group" aria-label="Naviguer dans le temps">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary controles-grille-bouton"
        @click="naviguer(-1)"
      >
        <PhCaretLeft :size="18" aria-hidden="true" />
        <span>{{ libellePrecedent }}</span>
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary controles-grille-bouton"
        @click="naviguer(1)"
      >
        <span>{{ libelleSuivant }}</span>
        <PhCaretRight :size="18" aria-hidden="true" />
      </button>
      <button
        v-if="dateDebutPlanning"
        type="button"
        class="btn btn-sm btn-outline-secondary controles-grille-bouton"
        @click="allerALaPeriodeDuPlanning"
      >
        <PhCalendarCheck :size="18" aria-hidden="true" />
        <span>Aller à la période du planning</span>
      </button>
    </div>
  </div>
</template>

<script>
import { PhCheck, PhPath, PhUsers, PhCaretLeft, PhCaretRight, PhCalendarCheck } from '@phosphor-icons/vue';

import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Barre de réglages d'affichage de `GrillePlanning` (feature 010), **sans
 * état propre** : bascule orientation (Tournées / Personnes), bascule
 * échelle (Jour / Semaine / Mois), navigation dans le temps
 * (précédent / suivant + retour à la période du planning). Boutons
 * secondaires discrets (`btn-outline-*`), jamais l'action principale de
 * l'écran.
 *
 * Ne modifie **jamais** les données : émet uniquement des mises à jour de
 * réglages d'affichage (`update:orientation`, `update:echelle`,
 * `update:dateReference`), calculées via `dateUtil` (aucun objet `Date`
 * manipulé ici). Réutilisable par `011`/`012`.
 */
export default {
  name: 'ControlesGrille',
  components: { PhCheck, PhPath, PhUsers, PhCaretLeft, PhCaretRight, PhCalendarCheck },
  props: {
    /** Orientation courante : `'TOURNEES'` ou `'PERSONNES'`. */
    orientation: { type: String, required: true },
    /** Échelle courante : `'JOUR'`, `'SEMAINE'` ou `'MOIS'`. */
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
  emits: ['update:orientation', 'update:echelle', 'update:dateReference'],
  data() {
    return {
      optionsOrientation: [
        { code: 'TOURNEES', libelle: 'Tournées', icone: 'PhPath' },
        { code: 'PERSONNES', libelle: 'Personnes', icone: 'PhUsers' },
      ],
      optionsEchelle: [
        { code: 'JOUR', libelle: 'Jour' },
        { code: 'SEMAINE', libelle: 'Semaine' },
        { code: 'MOIS', libelle: 'Mois' },
      ],
    };
  },
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

.controles-grille {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-4;
  margin-bottom: t.$espace-3;
}

.controles-grille-groupe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: t.$espace-2;
}

.controles-grille-etiquette {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.controles-grille-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
  min-height: t.$cible-cliquable-min;
}
</style>
