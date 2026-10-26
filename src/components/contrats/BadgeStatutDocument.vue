<template>
  <span class="badge-statut-document">
    <span class="badge-statut-document__etiquette" :class="`badge-statut-document__etiquette--${signe ? 'signe' : 'brouillon'}`">
      <PhSealCheck v-if="signe" :size="16" weight="fill" aria-hidden="true" />
      <PhPencilSimpleLine v-else :size="16" aria-hidden="true" />
      <span>{{ texteStatut }}</span>
    </span>
    <span v-if="document.archive" class="badge-statut-document__etiquette badge-statut-document__etiquette--archive">
      <PhArchive :size="16" aria-hidden="true" />
      <span>Archivé</span>
    </span>
  </span>
</template>

<script>
import { PhPencilSimpleLine, PhSealCheck, PhArchive } from '@phosphor-icons/vue';

import { libelleStatutDocument } from '@/domain/contrats/documents.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Badge de statut d'un document (0042) : texte + icône, jamais la couleur seule.
 * « Brouillon » / « Signé le JJ/MM/AAAA », et « Archivé » en plus si `archive`.
 */
export default {
  name: 'BadgeStatutDocument',
  components: { PhPencilSimpleLine, PhSealCheck, PhArchive },
  props: {
    /** @type {import('vue').PropType<import('@/domain/contrats/documents.js').DocumentContrat>} */
    document: { type: Object, required: true },
  },
  computed: {
    signe() {
      return this.document.statut === 'SIGNE';
    },
    texteStatut() {
      const libelle = libelleStatutDocument(this.document.statut);
      const date = this.signe ? dateUtil.formatDateFr(this.document.signeLe) : '';
      return date ? `${libelle} le ${date}` : libelle;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.badge-statut-document {
  display: inline-flex;
  flex-wrap: wrap;
  gap: t.$espace-1;
}

.badge-statut-document__etiquette {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
  padding: 0.1rem t.$espace-2;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  background-color: t.$couleur-fond-clair;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
  color: t.$couleur-texte-attenue;

  &--brouillon {
    border-color: t.$couleur-avertissement;
    color: t.$couleur-avertissement-texte;
  }

  &--signe {
    border-color: t.$couleur-succes;
    color: t.$couleur-succes;
  }
}
</style>
