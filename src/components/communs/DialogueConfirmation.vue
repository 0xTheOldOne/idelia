<template>
  <ModaleBase :visible="visible" :titre="titre" @fermeture="$emit('annuler')">
    <p class="mb-0">{{ message }}</p>

    <template #pied>
      <button type="button" class="btn btn-outline-secondary" @click="$emit('annuler')">
        Annuler
      </button>
      <button type="button" :class="['btn', 'btn-' + varianteConfirmer]" @click="$emit('confirmer')">
        {{ libelleConfirmer }}
      </button>
    </template>
  </ModaleBase>
</template>

<script>
import ModaleBase from '@/components/communs/ModaleBase.vue';

/**
 * Demande de confirmation générique, bâtie au-dessus de `ModaleBase`.
 * Réutilisable partout où une action a besoin d'un accord explicite avant
 * d'être exécutée (archivage ici, plus tard réinitialisation/import,
 * suppression de tournée…).
 *
 * La fermeture initiée par Bootstrap (`@fermeture` — croix, Échap, clic hors
 * fenêtre) équivaut toujours à **Annuler** : c'est un choix non destructif,
 * jamais une confirmation implicite.
 */
export default {
  name: 'DialogueConfirmation',
  components: { ModaleBase },
  props: {
    /** Affiche (`true`) ou masque (`false`) la boîte de dialogue. */
    visible: { type: Boolean, required: true },
    /** Titre de la boîte de dialogue. */
    titre: { type: String, required: true },
    /** Message expliquant, en langage clair, l'action à confirmer. */
    message: { type: String, required: true },
    /** Libellé du bouton de confirmation. */
    libelleConfirmer: { type: String, default: 'Confirmer' },
    /** Variante Bootstrap du bouton de confirmation (`primary`, `danger`…). */
    varianteConfirmer: { type: String, default: 'primary' },
  },
  emits: ['confirmer', 'annuler'],
};
</script>
