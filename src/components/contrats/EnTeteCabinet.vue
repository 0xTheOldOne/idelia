<template>
  <header class="entete-cabinet" :class="{ 'entete-cabinet--rempli': !vide }">
    <template v-if="!vide">
      <img v-if="logo" class="entete-cabinet__logo" :src="logo" alt="" />
      <div class="entete-cabinet__texte">
        <p v-if="entete.nomCabinet" class="entete-cabinet__nom">{{ entete.nomCabinet }}</p>
        <p v-for="ligne in lignes" :key="ligne" class="entete-cabinet__ligne">{{ ligne }}</p>
      </div>
    </template>
    <p v-else-if="lienCabinet" class="entete-cabinet__aide d-print-none">
      L'en-tête est vide : renseignez le nom, l'adresse et le logo dans la page
      <router-link :to="{ name: 'cabinet' }">Cabinet</router-link>.
    </p>
  </header>
</template>

<script>
import { lignesAdresse } from '@/domain/adresse.js';
import { normaliserLogo } from '@/domain/cabinet.js';
import { enteteEstVide } from '@/domain/contrats/documents.js';

/**
 * En-tête de cabinet d'un document imprimable : logo, nom en gras, adresse ligne par ligne.
 * Les éléments vides ne sont pas affichés ; rien à l'impression si tout est vide.
 * Le logo est re-contrôlé (`normaliserLogo`) avant d'être posé dans `src` (jamais de HTML injecté).
 */
export default {
  name: 'EnTeteCabinet',
  props: {
    /** @type {import('@/domain/contrats/documents.js').EnteteAffichee} */
    entete: { type: Object, required: true },
    /** Propose le lien vers la page Cabinet à l'écran quand l'en-tête est vide. */
    lienCabinet: { type: Boolean, default: false },
  },
  computed: {
    logo() {
      return normaliserLogo(this.entete.logo);
    },
    lignes() {
      return lignesAdresse(this.entete.adresseCabinet);
    },
    vide() {
      return enteteEstVide({ ...this.entete, logo: this.logo });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.entete-cabinet {
  display: flex;
  align-items: center;
  gap: t.$espace-3;
  break-inside: avoid;

  &--rempli {
    margin-bottom: t.$espace-4;
    padding-bottom: t.$espace-3;
    border-bottom: 1px solid t.$couleur-bordure;
  }
}

.entete-cabinet__logo {
  max-height: t.$impression-hauteur-logo-document;
  max-width: 40mm;
  object-fit: contain;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.entete-cabinet__texte {
  p {
    margin: 0;
  }
}

.entete-cabinet__nom {
  font-weight: t.$graisse-gras;
}

.entete-cabinet__aide {
  margin: 0;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}
</style>
