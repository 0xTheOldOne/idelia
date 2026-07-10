<template>
  <div class="pile-notifications" role="status" aria-live="polite" aria-label="Notifications">
    <transition-group name="toast" tag="div" class="pile-notifications__liste">
      <div
        v-for="toast in items"
        :key="toast.id"
        class="alert d-flex align-items-start gap-2 pile-notifications__toast"
        :class="classeAlerte(toast.type)"
      >
        <component
          :is="icone(toast.type)"
          :size="20"
          weight="fill"
          aria-hidden="true"
          class="flex-shrink-0"
        />
        <p class="mb-0 pile-notifications__message">{{ toast.message }}</p>
        <button
          type="button"
          class="btn-close pile-notifications__fermer"
          aria-label="Fermer cette notification"
          @click="retirer(toast.id)"
        />
      </div>
    </transition-group>
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import { PhCheckCircle, PhInfo, PhWarningCircle, PhXCircle } from '@phosphor-icons/vue';

/**
 * Pile de notifications (« toasts ») — composant transverse (feature 0018),
 * comme `IndicateurSauvegarde`/`MenuLateral`, monté **une fois** dans
 * `App.vue`. Présentational : lit `state.notifications.items` (module
 * volatile, jamais persisté — voir `src/store/modules/notifications.js`) et
 * dispatche `notifications/retirer` au clic sur la croix de fermeture.
 *
 * Réutilise les classes Bootstrap déjà importées (`alert`, `btn-close`)
 * plutôt que de réinventer un style — même choix que `ModaleBase.vue` pour
 * sa croix de fermeture. Chaque toast porte systématiquement une icône
 * Phosphor **et** un texte complet : jamais la seule couleur ne porte le
 * sens (§8 du plan).
 */
export default {
  name: 'PileNotifications',
  components: { PhCheckCircle, PhInfo, PhWarningCircle, PhXCircle },
  computed: {
    ...mapState('notifications', ['items']),
  },
  methods: {
    ...mapActions('notifications', ['retirer']),
    /**
     * Classe Bootstrap sémantique associée au type de toast.
     * @param {string} type
     * @returns {string}
     */
    classeAlerte(type) {
      return (
        {
          succes: 'alert-success',
          info: 'alert-info',
          avertissement: 'alert-warning',
          erreur: 'alert-danger',
        }[type] ?? 'alert-info'
      );
    },
    /**
     * Composant icône Phosphor associé au type de toast.
     * @param {string} type
     * @returns {object}
     */
    icone(type) {
      return (
        {
          succes: PhCheckCircle,
          info: PhInfo,
          avertissement: PhWarningCircle,
          erreur: PhXCircle,
        }[type] ?? PhInfo
      );
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

// Au-dessus de tout, y compris les modales Bootstrap (z-index 1055) : un
// toast doit rester visible même si une boîte de dialogue est ouverte.
$z-index-notifications: 2000;

.pile-notifications {
  position: fixed;
  top: t.$espace-3;
  right: t.$espace-3;
  z-index: $z-index-notifications;
  width: min(24rem, calc(100vw - #{t.$espace-3} * 2));
  pointer-events: none;
}

.pile-notifications__liste {
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.pile-notifications__toast {
  pointer-events: auto;
  box-shadow: t.$ombre-legere;
}

.pile-notifications__message {
  overflow-wrap: anywhere;
}

// Cible cliquable de la croix agrandie à `$cible-cliquable-min` (~44px),
// même technique de padding compensé que `.modal-header .btn-close`
// (`ModaleBase.vue`) : la croix reste visuellement à la même place.
.pile-notifications__fermer {
  flex-shrink: 0;
  padding: calc((#{t.$cible-cliquable-min} - 1em) / 2) !important;
  margin: calc((1em - #{t.$cible-cliquable-min}) / 2)
    calc((1em - #{t.$cible-cliquable-min}) / 2)
    calc((1em - #{t.$cible-cliquable-min}) / 2)
    auto !important;
}

// Transition d'apparition/disparition : fondu + léger déplacement.
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }

  .toast-enter-from,
  .toast-leave-to {
    opacity: 1;
    transform: none;
  }
}

@media print {
  .pile-notifications {
    display: none;
  }
}
</style>
