<template>
  <span
    class="pastille-tournee"
    :class="[`pastille-tournee--${taille}`, { 'pastille-tournee--inverse': fonce }]"
    :style="couleur ? { backgroundColor: couleur } : null"
    aria-hidden="true"
  >
    <component :is="composantIcone" v-if="composantIcone" :size="tailleIcone" weight="bold" />
  </span>
</template>

<script>
import {
  PhBandaids,
  PhBicycle,
  PhCar,
  PhDrop,
  PhFirstAidKit,
  PhHouseLine,
  PhMoon,
  PhPersonSimpleWalk,
  PhPill,
  PhStethoscope,
  PhSun,
  PhSyringe,
} from '@phosphor-icons/vue';
import { estCouleurFoncee } from '@/domain/utils/couleurs.js';

/**
 * Correspondance code d'icône (`ICONES_TOURNEE`, `@/domain/iconesTournee.js`) -> composant
 * Phosphor. Table fermée de module (hors `data` : pas de réactivité sur des composants).
 * Ajouter une icône = une entrée ici + une ligne dans `ICONES_TOURNEE`.
 */
const COMPOSANTS_ICONE = Object.freeze({
  SERINGUE: PhSyringe,
  STETHOSCOPE: PhStethoscope,
  PANSEMENT: PhBandaids,
  MEDICAMENTS: PhPill,
  GOUTTE: PhDrop,
  TROUSSE: PhFirstAidKit,
  DOMICILE: PhHouseLine,
  VOITURE: PhCar,
  A_PIED: PhPersonSimpleWalk,
  VELO: PhBicycle,
  SOLEIL: PhSun,
  LUNE: PhMoon,
});

/** Taille de l'icône selon la taille de la pastille. */
const TAILLES_ICONE = Object.freeze({ petite: 12, grande: 20, impression: 13 });

/**
 * Pastille de tournée (feature 0029) : disque de la couleur de la tournée, avec une
 * icône de repère facultative. Purement décorative (`aria-hidden`) : le libellé de la
 * tournée est toujours écrit à côté par le parent. Code d'icône inconnu ou `null` :
 * pastille unie, sans erreur.
 */
export default {
  name: 'PastilleTournee',
  props: {
    /** Couleur de la tournée (`#RRGGBB`) ; vide = fond neutre. */
    couleur: { type: String, default: '' },
    /** Code d'icône (`ICONES_TOURNEE`) ou `null`. */
    icone: { type: String, default: null },
    /** `petite` (20 px), `grande` (32 px) ou `impression` (18 px). */
    taille: {
      type: String,
      default: 'petite',
      validator: (valeur) => ['petite', 'grande', 'impression'].includes(valeur),
    },
  },
  computed: {
    /** @returns {(object|null)} Composant Phosphor, ou `null` si aucune icône valide. */
    composantIcone() {
      return typeof this.icone === 'string' && Object.hasOwn(COMPOSANTS_ICONE, this.icone)
        ? COMPOSANTS_ICONE[this.icone]
        : null;
    },
    /** @returns {(number|string)} */
    tailleIcone() {
      return TAILLES_ICONE[this.taille];
    },
    /** @returns {boolean} Vrai si le fond est foncé (icône claire). */
    fonce() {
      return this.couleur ? estCouleurFoncee(this.couleur) : false;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.pastille-tournee {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
  background-color: t.$couleur-fond-clair;
  color: t.$couleur-texte;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;

  &--petite {
    width: t.$espace-3 + t.$espace-1;
    height: t.$espace-3 + t.$espace-1;
  }

  &--grande {
    width: t.$espace-5;
    height: t.$espace-5;
  }

  // Taille fixe : en `em`, l'icône tombait à ~9 px sur la petite police du
  // tirage et devenait illisible (relecture ui-ux).
  &--impression {
    width: 18px;
    height: 18px;
    // Contour noir à l'impression (lisible en noir et blanc)
    border-color: t.$couleur-texte;
  }

  &--inverse {
    color: t.$couleur-texte-inverse;
  }
}

@media print {
  .pastille-tournee {
    border-color: t.$couleur-texte;
  }
}
</style>
