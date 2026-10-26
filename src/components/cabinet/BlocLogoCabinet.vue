<template>
  <div class="bloc-logo">
    <div class="bloc-logo__entete">
      <h2 class="bloc-logo__titre">Logo</h2>
      <div class="bloc-logo__actions">
        <button
          ref="boutonChoisir"
          type="button"
          class="btn btn-outline-primary d-inline-flex align-items-center gap-2"
          :disabled="enCours"
          @click="ouvrirSelecteur"
        >
          <PhImage :size="20" aria-hidden="true" />
          {{ logoAffichable ? 'Remplacer le logo' : 'Choisir une image' }}
        </button>
        <button
          v-if="logoAffichable"
          type="button"
          class="btn btn-outline-danger bloc-logo__retirer"
          title="Retirer le logo"
          aria-label="Retirer le logo"
          :disabled="enCours"
          @click="confirmationVisible = true"
        >
          <PhTrash :size="20" aria-hidden="true" />
        </button>
      </div>
    </div>

    <input
      ref="champFichier"
      type="file"
      class="d-none"
      tabindex="-1"
      :accept="ACCEPT_LOGO"
      @change="onFichierChoisi"
    >

    <div class="bloc-logo__cadre" data-bs-theme="light" :class="{ 'bloc-logo__cadre--vide': !logoAffichable && !enCours }" :aria-busy="enCours">
      <template v-if="enCours">
        <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
        <span class="bloc-logo__texte">Préparation de l'image…</span>
      </template>
      <img v-else-if="logoAffichable" :src="logoAffichable" alt="Logo du cabinet" class="bloc-logo__image">
      <template v-else>
        <PhImage :size="40" aria-hidden="true" class="bloc-logo__icone-vide" />
        <span class="bloc-logo__texte bloc-logo__texte--attenue">Aucun logo pour l'instant</span>
      </template>
    </div>

    <div class="form-text">
      Image PNG ou JPEG. Elle est réduite automatiquement (400 pixels au plus) pour rester légère.
      Le logo est inclus dans vos sauvegardes.
    </div>

    <div role="status" aria-live="polite">
      <div v-if="message" class="alert mt-3 mb-0" :class="'alert-' + message.type">
        {{ message.texte }}
      </div>
    </div>

    <DialogueConfirmation
      :visible="confirmationVisible"
      titre="Retirer le logo ?"
      message="Le logo ne figurera plus sur les documents. Vous pourrez en choisir un autre à tout moment."
      libelle-confirmer="Retirer"
      variante-confirmer="danger"
      @confirmer="onConfirmerRetrait"
      @annuler="confirmationVisible = false"
    />
  </div>
</template>

<script>
import { nextTick } from 'vue';
import { mapGetters, mapActions } from 'vuex';
import { PhImage, PhTrash } from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import { normaliserLogo, messageErreurLogo } from '@/domain/cabinet.js';
import { preparerLogo, ACCEPT_LOGO } from '@/adaptateurs/imageLogo.js';

/**
 * Bloc « Logo » de la page Cabinet (0039). Choix d'une image PNG/JPEG,
 * préparée (réduite, réencodée) par l'adaptateur puis enregistrée via
 * `cabinet/majParametres`. En cas d'échec, l'ancien logo reste en place.
 * Aperçu sur fond blanc, même en mode sombre. Retrait confirmé.
 */
export default {
  name: 'BlocLogoCabinet',
  components: { PhImage, PhTrash, DialogueConfirmation },
  data() {
    return {
      ACCEPT_LOGO,
      /** `true` pendant la préparation de l'image (garde anti double déclenchement). */
      enCours: false,
      confirmationVisible: false,
      /** @type {{type: 'success'|'warning', texte: string}|null} */
      message: null,
    };
  },
  computed: {
    ...mapGetters('cabinet', ['parametres']),
    /** Jamais de valeur non validée dans `src`. */
    logoAffichable() {
      return normaliserLogo(this.parametres.logo);
    },
  },
  methods: {
    ...mapActions('cabinet', ['majParametres']),

    ouvrirSelecteur() {
      if (!this.enCours) this.$refs.champFichier.click();
    },

    async onFichierChoisi(event) {
      const champ = event.target;
      const fichier = champ.files?.[0];
      // Remise à zéro : permet de rechoisir le même fichier.
      champ.value = '';
      if (!fichier || this.enCours) return;

      this.message = null;
      this.enCours = true;
      try {
        const dataUrl = await preparerLogo(fichier);
        this.majParametres({ logo: dataUrl });
        this.message = { type: 'success', texte: 'Logo enregistré.' };
      } catch (err) {
        this.message = { type: 'warning', texte: messageErreurLogo(err?.code) };
      } finally {
        this.enCours = false;
      }
    },

    async onConfirmerRetrait() {
      this.confirmationVisible = false;
      this.message = null;
      this.majParametres({ logo: null });
      await nextTick();
      this.$refs.boutonChoisir?.focus();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.bloc-logo {
  margin-top: t.$espace-4;
}

.bloc-logo__entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-2;
  margin-bottom: t.$espace-2;
}

.bloc-logo__titre {
  margin: 0;
}

.bloc-logo__actions {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
}

.bloc-logo__actions .btn {
  min-height: t.$cible-cliquable-min;
}

.bloc-logo__retirer {
  min-width: t.$cible-cliquable-min;
}

// Aperçu fidèle au papier : blanc et texte sombre en dur, volontairement hors tokens
// (les tokens suivent le mode sombre, le papier reste blanc — ADR 0022 §8).
.bloc-logo__cadre {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: t.$espace-2;
  height: 160px;
  background: #fff;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
  color: #212529;
}

.bloc-logo__cadre--vide {
  background: t.$couleur-fond-clair;
  color: t.$couleur-texte-attenue;
}

.bloc-logo__image {
  max-width: 100%;
  max-height: 140px;
  object-fit: contain;
}

.bloc-logo__icone-vide {
  color: t.$couleur-texte-attenue;
}
</style>
