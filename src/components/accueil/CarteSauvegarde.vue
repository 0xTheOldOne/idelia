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
      :class="{ 'carte-sauvegarde-rappel--succes': rappelAJour }"
      role="status"
      aria-live="polite"
    >
      <PhCheckCircle v-if="rappelAJour" :size="18" weight="fill" aria-hidden="true" />
      <span>{{ texteRappel }}</span>
    </p>

    <button
      type="button"
      class="btn btn-primary carte-sauvegarde-bouton"
      @click="$emit('exporter')"
    >
      <PhFloppyDisk :size="20" aria-hidden="true" />
      <span>Enregistrer une sauvegarde</span>
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
 *
 * Feature 0032 : quand un fichier de sauvegarde est actif, le rappel et le libellé
 * du bouton reflètent ce fichier (même logique que `BlocSauvegarde`) ; l'événement
 * émis reste `exporter`, l'écran appelant choisit entre écriture et téléchargement.
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
    /** `true` si un fichier de sauvegarde actif existe (`ui/fichierSauvegardeActif`). */
    fichierSauvegardeActif: { type: Boolean, default: false },
    /** Nom du fichier actif, ou `null`. */
    nomFichierSauvegarde: { type: String, default: null },
    /** Horodatage ISO UTC de la dernière écriture dans le fichier actif, ou `null`. */
    dernierFichierEnregistreLe: { type: String, default: null },
  },
  emits: ['exporter'],
  computed: {
    /** `true` si le rappel est à jour (même critère que `BlocSauvegarde.rappelAJour`). */
    rappelAJour() {
      if (this.fichierSauvegardeActif) return !!this.dernierFichierEnregistreLe;
      return !!this.dernierExportLe;
    },

    texteRappel() {
      if (this.fichierSauvegardeActif) {
        if (!this.dernierFichierEnregistreLe) {
          return 'Fichier de sauvegarde actif, pas encore écrit.';
        }
        return `Fichier de sauvegarde à jour le ${dateUtil.formatHorodatageFr(this.dernierFichierEnregistreLe)}.`;
      }
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
