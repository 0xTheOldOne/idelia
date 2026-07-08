<template>
  <div class="bloc-sauvegarde">
    <div class="bloc-sauvegarde__pedagogie">
      <PhShieldCheck :size="24" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Vos données sont enregistrées uniquement dans ce navigateur, sur cet ordinateur : elles ne
        sont envoyées nulle part. Pour ne pas les perdre (changement d'ordinateur, panne,
        nettoyage du navigateur) ou pour les transférer sur un autre poste, enregistrez
        régulièrement une sauvegarde&nbsp;: c'est un fichier que vous conservez et que vous pouvez
        restaurer plus tard.
      </p>
    </div>

    <p class="bloc-sauvegarde__rappel" role="status" aria-live="polite">
      <PhWarning v-if="!dernierExportLe" :size="20" weight="fill" aria-hidden="true" />
      <PhCheckCircle v-else :size="20" weight="fill" aria-hidden="true" />
      <span>{{ texteRappel }}</span>
    </p>

    <div class="bloc-sauvegarde__actions">
      <!-- Enregistrer : aucun risque, action principale, pas de confirmation -->
      <div class="bloc-sauvegarde__action">
        <button
          type="button"
          class="btn btn-primary bloc-sauvegarde__bouton"
          :disabled="traitementEnCours"
          @click="onEnregistrer"
        >
          <PhFloppyDisk :size="20" aria-hidden="true" />
          <span>Enregistrer une sauvegarde</span>
        </button>
        <p class="bloc-sauvegarde__aide">
          Télécharge un fichier de sauvegarde que vous rangez où vous voulez. Aucun risque : vos
          données actuelles ne sont pas modifiées.
        </p>
      </div>

      <!-- Restaurer : sélection d'un fichier, confirmation d'écrasement, puis import -->
      <div class="bloc-sauvegarde__action">
        <button
          ref="boutonRestaurer"
          type="button"
          class="btn btn-outline-secondary bloc-sauvegarde__bouton"
          :disabled="traitementEnCours"
          @click="onDeclencherRestauration"
        >
          <PhUploadSimple :size="20" aria-hidden="true" />
          <span>{{ importEnCours ? 'Restauration en cours…' : 'Restaurer une sauvegarde' }}</span>
        </button>
        <input
          ref="inputFichier"
          type="file"
          accept="application/json,.json"
          class="d-none"
          @change="onFichierChoisi"
        >
        <p class="bloc-sauvegarde__aide">
          Remplace toutes les données actuelles par celles d'un fichier de sauvegarde.
        </p>

        <div
          v-if="resultatImport"
          class="alert d-flex gap-2 mt-2 mb-0"
          :class="resultatImport.ok ? 'alert-success' : 'alert-danger'"
          role="status"
          aria-live="polite"
        >
          <PhCheckCircle
            v-if="resultatImport.ok"
            :size="20"
            weight="fill"
            class="flex-shrink-0"
            aria-hidden="true"
          />
          <PhWarning v-else :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
          <div>
            <p class="mb-0">
              <template v-if="resultatImport.ok">
                Sauvegarde restaurée. Vos données ont été remplacées.
              </template>
              <template v-else>{{ resultatImport.message }}</template>
            </p>
            <ul v-if="resultatImport.erreurs?.length" class="mb-0">
              <li v-for="(erreur, index) in resultatImport.erreurs" :key="index">{{ erreur }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Effacer : geste dangereux, isolé, confirmation forte -->
      <div class="bloc-sauvegarde__action bloc-sauvegarde__effacer">
        <button
          type="button"
          class="btn btn-outline-danger bloc-sauvegarde__bouton"
          :disabled="traitementEnCours"
          @click="onDemanderEffacement"
        >
          <PhTrash :size="20" aria-hidden="true" />
          <span>{{ effacementEnCours ? 'Effacement en cours…' : 'Effacer toutes les données' }}</span>
        </button>
        <p class="bloc-sauvegarde__aide">
          Supprime définitivement toutes les données de ce navigateur et repart de zéro.
        </p>

        <div
          v-if="effacementReussi"
          class="alert alert-success d-flex gap-2 mt-2 mb-0"
          role="status"
          aria-live="polite"
        >
          <PhCheckCircle :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
          <p class="mb-0">
            Toutes les données ont été effacées. L'écran affiche maintenant les valeurs par défaut.
          </p>
        </div>
      </div>
    </div>

    <DialogueConfirmation
      :visible="confirmationImportVisible"
      titre="Restaurer une sauvegarde ?"
      :message="messageConfirmationImport"
      libelle-confirmer="Restaurer"
      variante-confirmer="danger"
      @confirmer="onConfirmerImport"
      @annuler="onAnnulerImport"
    />

    <DialogueConfirmation
      :visible="confirmationResetVisible"
      titre="Tout effacer ?"
      message="Cette action supprime définitivement toutes vos données (réglages, équipe, tournées, absences, plannings) de ce navigateur. Elle ne peut pas être annulée. Pour en garder une copie, enregistrez d'abord une sauvegarde. Voulez-vous vraiment tout effacer ?"
      libelle-confirmer="Tout effacer"
      variante-confirmer="danger"
      @confirmer="onConfirmerReset"
      @annuler="onAnnulerReset"
    />
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import {
  PhShieldCheck,
  PhFloppyDisk,
  PhUploadSimple,
  PhTrash,
  PhCheckCircle,
  PhWarning,
} from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Bloc « Sauvegarde » de l'écran Paramètres (feature 008) : enregistrer un
 * fichier de sauvegarde, en restaurer un, ou tout effacer.
 *
 * Composant **conteneur** : il dispatche les actions racines déjà en place
 * (`exporter`/`importer`/`reinitialiser`, feature 002) et l'action volatile
 * `ui/enregistrerExport`, puis affiche leurs résultats. Aucune
 * (dé)sérialisation, migration ou validation ici — tout vit dans le store/
 * domaine/storage ; ce composant se contente d'orchestrer l'UI.
 *
 * Émet `donnees-remplacees` après une restauration ou un effacement réussis,
 * pour que `ParametresView` réhydrate son brouillon de réglages.
 */
export default {
  name: 'BlocSauvegarde',
  components: {
    PhShieldCheck,
    PhFloppyDisk,
    PhUploadSimple,
    PhTrash,
    PhCheckCircle,
    PhWarning,
    DialogueConfirmation,
  },
  emits: ['donnees-remplacees'],
  data() {
    return {
      /** @type {File|null} Fichier choisi, en attente de confirmation. */
      fichierEnAttente: null,
      confirmationImportVisible: false,
      confirmationResetVisible: false,
      /** `true` pendant l'`await` de l'import (désactive les boutons). */
      importEnCours: false,
      /** `true` pendant l'`await` de l'effacement (désactive les boutons). */
      effacementEnCours: false,
      /** @type {{ ok: boolean, message: string, erreurs?: string[] }|null} */
      resultatImport: null,
      /** `true` après un effacement réussi (encart de confirmation local). */
      effacementReussi: false,
    };
  },
  computed: {
    ...mapState('ui', ['dernierExportLe']),

    /** Un traitement (import ou effacement) est en cours : boutons neutralisés. */
    traitementEnCours() {
      return this.importEnCours || this.effacementEnCours;
    },

    texteRappel() {
      if (!this.dernierExportLe) {
        return "Aucune sauvegarde enregistrée depuis l'ouverture de l'application. Pensez à en enregistrer une régulièrement.";
      }
      return `Dernière sauvegarde enregistrée le ${dateUtil.formatHorodatageFr(this.dernierExportLe)}.`;
    },

    messageConfirmationImport() {
      const nom = this.fichierEnAttente ? this.fichierEnAttente.name : 'ce fichier';
      return (
        'Cette action remplacera toutes les données actuelles (réglages, équipe, tournées, '
        + `absences, plannings) par celles du fichier « ${nom} ». Les données actuelles seront `
        + 'perdues si vous ne les avez pas déjà enregistrées. Voulez-vous continuer ?'
      );
    },
  },
  methods: {
    ...mapActions(['exporter', 'importer', 'reinitialiser']),
    ...mapActions('ui', ['enregistrerExport']),

    /** Télécharge le fichier de sauvegarde, puis met à jour le rappel. */
    onEnregistrer() {
      this.exporter();
      this.enregistrerExport();
    },

    onDeclencherRestauration() {
      this.$refs.inputFichier.click();
    },

    /** @param {Event} event */
    onFichierChoisi(event) {
      const fichier = event.target.files[0];
      // Réinitialise l'input pour permettre de re-choisir le même fichier
      // (sinon, un second choix identique ne redéclencherait pas `change`).
      event.target.value = '';
      if (!fichier) return; // annulation du sélecteur de fichier par l'OS
      this.fichierEnAttente = fichier;
      this.resultatImport = null;
      this.effacementReussi = false;
      // L'input fichier est masqué (`d-none`, donc non focusable) : on ramène le
      // focus sur le bouton visible « Restaurer » AVANT d'ouvrir la modale, pour
      // que `ModaleBase` mémorise un ouvrant valide et puisse y rendre le focus
      // à la fermeture (sinon le focus retomberait sur `<body>`).
      this.$refs.boutonRestaurer.focus();
      this.confirmationImportVisible = true;
    },

    async onConfirmerImport() {
      this.confirmationImportVisible = false;
      this.importEnCours = true;
      const resultat = await this.importer(this.fichierEnAttente);
      this.resultatImport = resultat;
      this.importEnCours = false;
      this.fichierEnAttente = null;
      if (resultat.ok) {
        this.$emit('donnees-remplacees');
      }
    },

    onAnnulerImport() {
      this.confirmationImportVisible = false;
      this.fichierEnAttente = null;
    },

    onDemanderEffacement() {
      this.confirmationResetVisible = true;
    },

    async onConfirmerReset() {
      this.confirmationResetVisible = false;
      this.effacementEnCours = true;
      await this.reinitialiser();
      this.effacementEnCours = false;
      this.resultatImport = null;
      this.effacementReussi = true;
      this.$emit('donnees-remplacees');
    },

    onAnnulerReset() {
      this.confirmationResetVisible = false;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.bloc-sauvegarde__pedagogie {
  display: flex;
  gap: t.$espace-2;
  margin-bottom: t.$espace-4;
  color: t.$couleur-texte-attenue;
}

.bloc-sauvegarde__rappel {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin: 0 0 t.$espace-4;
  font-weight: t.$graisse-gras;
}

.bloc-sauvegarde__actions {
  display: flex;
  flex-direction: column;
  gap: t.$espace-4;
}

.bloc-sauvegarde__bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.bloc-sauvegarde__aide {
  margin: t.$espace-2 0 0;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

// Geste dangereux : à l'écart des deux autres actions (séparateur visuel).
.bloc-sauvegarde__effacer {
  padding-top: t.$espace-4;
  border-top: 1px solid t.$couleur-bordure;
}
</style>
