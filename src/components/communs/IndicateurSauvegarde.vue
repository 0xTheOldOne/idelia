<template>
  <p class="indicateur-sauvegarde" :class="classeStatut" aria-live="polite">
    <template v-if="statut === 'EN_COURS'">
      <PhFloppyDisk :size="20" aria-hidden="true" />
      <span>Enregistrement…</span>
    </template>
    <template v-else-if="statut === 'ENREGISTRE' && apresEdition">
      <PhCheckCircle :size="20" weight="fill" aria-hidden="true" />
      <span>Modifications enregistrées<template v-if="texteDate"> {{ texteDate }}</template></span>
    </template>
    <template v-else-if="statut === 'ENREGISTRE'">
      <PhCheckCircle :size="20" aria-hidden="true" />
      <span>Vos réglages sont enregistrés<template v-if="texteDate"> {{ texteDate }}</template></span>
    </template>
    <template v-else-if="statut === 'ERREUR'">
      <PhWarning :size="20" weight="fill" aria-hidden="true" />
      <span>
        L'enregistrement a échoué. Vos données restent affichées à l'écran ; réessayez de modifier
        un réglage.
      </span>
    </template>
  </p>
</template>

<script>
import { PhCheckCircle, PhFloppyDisk, PhWarning } from '@phosphor-icons/vue';

import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Indicateur de sauvegarde — composant présentational réutilisable.
 *
 * N'accède jamais au store : reçoit son état via des props, alimentées par
 * l'écran appelant (`mapState` racine sur `statutSauvegarde`/`derniereSauvegarde`).
 *
 * La prop `apresEdition` distingue une sauvegarde consécutive à une **vraie
 * action utilisateur** (« Modifications enregistrées ») d'un état
 * `ENREGISTRE` simplement hérité du chargement de l'écran (« Vos réglages
 * sont enregistrés ») — évite de sous-entendre une action que l'utilisateur
 * n'a pas faite.
 *
 * Accessibilité : la zone est en `aria-live="polite"` pour annoncer le
 * changement de statut ; l'icône est `aria-hidden` car toujours doublée
 * d'un libellé texte (aucune information portée par la seule couleur).
 */
export default {
  name: 'IndicateurSauvegarde',
  components: { PhCheckCircle, PhFloppyDisk, PhWarning },
  props: {
    /** Statut courant : `INACTIF|EN_COURS|ENREGISTRE|ERREUR|ERREUR_CHARGEMENT`. */
    statut: { type: String, required: true },
    /** Horodatage ISO UTC de la dernière écriture réussie, ou `null`. */
    derniereSauvegarde: { type: String, default: null },
    /**
     * `true` si le statut `ENREGISTRE` courant fait suite à une modification
     * réellement saisie par l'utilisateur (et non à l'hydratation initiale
     * de l'écran).
     */
    apresEdition: { type: Boolean, default: false },
  },
  computed: {
    classeStatut() {
      if (this.statut === 'ENREGISTRE' && this.apresEdition) return 'indicateur-sauvegarde--succes';
      if (this.statut === 'ERREUR') return 'indicateur-sauvegarde--erreur';
      return 'indicateur-sauvegarde--neutre';
    },
    texteDate() {
      const texte = dateUtil.formatHorodatageFr(this.derniereSauvegarde);
      return texte ? `le ${texte}` : '';
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.indicateur-sauvegarde {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$espace-5;
  margin: 0 0 t.$espace-3;
  font-size: t.$taille-texte-petite;

  &--succes {
    color: t.$couleur-succes;
  }

  &--erreur {
    color: t.$couleur-erreur;
    font-weight: t.$graisse-gras;
  }

  &--neutre {
    color: t.$couleur-texte-attenue;
  }
}
</style>
