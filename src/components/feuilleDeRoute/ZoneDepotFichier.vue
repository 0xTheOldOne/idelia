<template>
  <div
    class="zone-depot"
    :class="{ 'zone-depot--survolee': survolee, 'zone-depot--desactivee': desactivee }"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <PhFilePdf :size="56" weight="duotone" class="zone-depot__icone" aria-hidden="true" />
    <p v-if="survolee" class="zone-depot__texte">Relâchez pour lancer la lecture</p>
    <template v-else>
      <p class="zone-depot__texte">Glissez le fichier PDF ici</p>
      <p class="zone-depot__ou">ou</p>
    </template>
    <button
      ref="bouton"
      type="button"
      class="btn btn-primary zone-depot__bouton"
      :disabled="desactivee"
      @click="onDeclencher"
    >
      <PhFolderOpen :size="20" aria-hidden="true" />
      <span>{{ libelleBouton }}</span>
    </button>
    <input
      ref="input"
      type="file"
      :accept="accept"
      class="d-none"
      tabindex="-1"
      @change="onFichierChoisi"
    >
  </div>
</template>

<script>
import { PhFilePdf, PhFolderOpen } from '@phosphor-icons/vue';

/**
 * Zone de dépôt de fichier (feature 0033) : glisser-déposer ou bouton
 * « Choisir un fichier ». Composant présentationnel et générique : il émet
 * `fichiers-choisis` avec un tableau de `File` et ne lit rien lui-même.
 * Le bouton est le seul arrêt clavier ; l'input fichier reste caché.
 */
export default {
  name: 'ZoneDepotFichier',
  components: { PhFilePdf, PhFolderOpen },
  props: {
    desactivee: { type: Boolean, default: false },
    accept: { type: String, default: '.pdf,application/pdf' },
    libelleBouton: { type: String, default: 'Choisir un fichier PDF' },
  },
  emits: ['fichiers-choisis'],
  data() {
    return {
      survolee: false,
      // Compteur d'entrées/sorties : évite le clignotement quand le curseur
      // passe sur un élément enfant (dragleave se déclenche alors aussi).
      profondeurSurvol: 0,
    };
  },
  methods: {
    /** Donne le focus au bouton (après « Analyser un autre fichier »). */
    focaliser() {
      this.$refs.bouton?.focus();
    },
    onDeclencher() {
      this.$refs.input.click();
    },
    /** @param {Event} event */
    onFichierChoisi(event) {
      const fichiers = Array.from(event.target.files ?? []);
      // Permet de re-choisir le même fichier (sinon `change` ne se redéclenche pas).
      event.target.value = '';
      if (fichiers.length === 0) return; // annulation du sélecteur
      this.$emit('fichiers-choisis', fichiers);
    },
    onDragEnter() {
      if (this.desactivee) return;
      this.profondeurSurvol += 1;
      this.survolee = true;
    },
    onDragLeave() {
      if (this.desactivee) return;
      this.profondeurSurvol = Math.max(0, this.profondeurSurvol - 1);
      if (this.profondeurSurvol === 0) this.survolee = false;
    },
    /** @param {DragEvent} event */
    onDrop(event) {
      this.profondeurSurvol = 0;
      this.survolee = false;
      if (this.desactivee) return;
      const fichiers = Array.from(event.dataTransfer?.files ?? []);
      if (fichiers.length > 0) this.$emit('fichiers-choisis', fichiers);
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.zone-depot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: t.$espace-2;
  padding: t.$espace-6 t.$espace-4;
  text-align: center;
  background-color: t.$couleur-fond;
  border: 3px dashed t.$couleur-bordure;
  border-radius: t.$rayon-lg;
  transition: background-color 0.15s, border-color 0.15s;
}

.zone-depot__icone {
  color: t.$couleur-primaire;
}

.zone-depot__texte {
  margin: 0;
  font-size: t.$taille-texte-grande;
  font-weight: t.$graisse-gras;
}

.zone-depot__ou {
  margin: 0;
  color: t.$couleur-texte-attenue;
}

.zone-depot__bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

// Survol : bordure pleine + fond + texte changé (jamais la couleur seule).
.zone-depot--survolee {
  border-style: solid;
  border-color: t.$couleur-primaire;
  background-color: t.$couleur-fond-clair;
}

.zone-depot--desactivee {
  opacity: 0.6;
}
</style>
