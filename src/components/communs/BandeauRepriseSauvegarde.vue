<template>
  <div
    v-if="visible"
    class="alert alert-info bandeau-reprise d-flex d-print-none"
    role="region"
    aria-label="Reprise de la sauvegarde"
  >
    <PhClockCounterClockwise :size="24" class="flex-shrink-0" aria-hidden="true" />
    <div class="bandeau-reprise__corps">
      <p class="mb-1">
        Idelia peut continuer à enregistrer vos sauvegardes dans votre fichier
        « {{ fichierEnAttenteAccord }} ». Votre navigateur demande simplement votre accord.
      </p>
      <p class="bandeau-reprise__aide mb-2">
        Si votre navigateur le propose, choisissez « Autoriser à chaque visite ».
      </p>
      <div class="bandeau-reprise__actions">
        <button
          type="button"
          class="btn btn-primary bandeau-reprise__bouton"
          :disabled="repriseEnCours"
          @click="onReprendre"
        >
          <PhFloppyDisk :size="20" aria-hidden="true" />
          <span>Reprendre la sauvegarde</span>
        </button>
        <button
          type="button"
          class="btn btn-outline-dark bandeau-reprise__bouton"
          @click="masquerBandeauReprise"
        >
          Plus tard
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import { PhClockCounterClockwise, PhFloppyDisk } from '@phosphor-icons/vue';

/**
 * Bandeau de reprise de la sauvegarde (feature 0032, ADR 0021) : affiché sur
 * tous les écrans quand un fichier de sauvegarde mémorisé attend l'accord de
 * l'utilisateur (le navigateur exige un clic pour réautoriser l'écriture).
 * Composant conteneur : lit le store, dispatche les actions. Les toasts de
 * résultat sont émis par l'action `confirmerRepriseSauvegardeFichier`.
 */
export default {
  name: 'BandeauRepriseSauvegarde',
  components: { PhClockCounterClockwise, PhFloppyDisk },
  data() {
    return {
      /** `true` pendant l'`await` de la reprise (désactive le bouton). */
      repriseEnCours: false,
    };
  },
  computed: {
    ...mapState('ui', ['fichierEnAttenteAccord', 'bandeauRepriseMasque']),

    visible() {
      return !!this.fichierEnAttenteAccord && !this.bandeauRepriseMasque;
    },
  },
  methods: {
    ...mapActions('ui', ['masquerBandeauReprise']),
    ...mapActions(['confirmerRepriseSauvegardeFichier']),

    async onReprendre() {
      this.repriseEnCours = true;
      try {
        await this.confirmerRepriseSauvegardeFichier();
      } finally {
        this.repriseEnCours = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.bandeau-reprise {
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
  align-items: flex-start;
}

.bandeau-reprise__aide {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.bandeau-reprise__actions {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-2;
}

.bandeau-reprise__bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}
</style>
