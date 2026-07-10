<template>
  <section class="carte-sauvegarde" aria-labelledby="carte-sauvegarde-titre">
    <h2 id="carte-sauvegarde-titre">Sauvegarde</h2>

    <IndicateurSauvegarde
      :statut="statut"
      :derniere-sauvegarde="derniereSauvegarde"
      :apres-edition="false"
    />

    <p
      class="carte-sauvegarde-rappel"
      :class="{ 'carte-sauvegarde-rappel--succes': dernierExportLe }"
      role="status"
      aria-live="polite"
    >
      <PhCheckCircle v-if="dernierExportLe" :size="18" weight="fill" aria-hidden="true" />
      <span>{{ texteRappel }}</span>
    </p>

    <button
      type="button"
      class="btn btn-primary carte-sauvegarde-bouton"
      @click="$emit('exporter')"
    >
      <PhFloppyDisk :size="20" aria-hidden="true" />
      <span>Exporter une sauvegarde</span>
    </button>
  </section>
</template>

<script>
import { PhFloppyDisk, PhCheckCircle } from '@phosphor-icons/vue';

import IndicateurSauvegarde from '@/components/communs/IndicateurSauvegarde.vue';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Carte « Sauvegarde » (feature 0013, tableau de bord) : rappelle l'état de
 * sauvegarde ([ADR 0009], workflow référent) et propose l'export.
 *
 * **Présentational** : réutilise `IndicateurSauvegarde` telle quelle pour la
 * ligne d'état (`apresEdition = false`, cet écran ne modifie jamais aucune
 * donnée) et n'émet que `exporter` — c'est l'écran appelant qui
 * `dispatch('exporter')` (action racine existante, [ADR 0006]
 * (../../../docs/adr/0006-sauvegarde-partage-par-export-import-json.md),
 * téléchargement JSON, aucun envoi réseau). Ce composant ne dispatche rien
 * lui-même.
 *
 * `dernierExportLe` (fourni par l'écran appelant, état volatil `ui/dernierExportLe`)
 * alimente une ligne de confirmation datée, en `aria-live="polite"` : même
 * pattern que `BlocSauvegarde` (Paramètres), pour un retour immédiat après
 * « Exporter une sauvegarde ».
 */
export default {
  name: 'CarteSauvegarde',
  components: { IndicateurSauvegarde, PhFloppyDisk, PhCheckCircle },
  props: {
    /** Statut courant : `INACTIF|EN_COURS|ENREGISTRE|ERREUR|ERREUR_CHARGEMENT`. */
    statut: { type: String, required: true },
    /** Horodatage ISO UTC de la dernière écriture réussie, ou `null`. */
    derniereSauvegarde: { type: String, default: null },
    /** Horodatage ISO UTC du dernier export lancé durant la session (`ui/dernierExportLe`), ou `null`. */
    dernierExportLe: { type: String, default: null },
  },
  emits: ['exporter'],
  computed: {
    texteRappel() {
      if (!this.dernierExportLe) {
        return "Aucun fichier téléchargé depuis l'ouverture de l'application. Pensez à en télécharger un régulièrement.";
      }
      return `Dernier téléchargement lancé le ${dateUtil.formatHorodatageFr(this.dernierExportLe)}.`;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.carte-sauvegarde {
  padding: t.$espace-4;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-lg;
}

.carte-sauvegarde-rappel {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin: 0 0 t.$espace-3;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;

  &--succes {
    color: t.$couleur-succes;
  }
}

.carte-sauvegarde-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}
</style>
