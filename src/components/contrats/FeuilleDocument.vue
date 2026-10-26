<template>
  <div class="feuille-document-conteneur">
    <article class="feuille-document" data-bs-theme="light">
      <EnTeteCabinet :entete="entete" :lien-cabinet="modifiable" />
      <EditeurRiche
        ref="editeur"
        :contenu="document.contenu"
        :champs-libres="[]"
        :lecture-seule="!modifiable"
        :avec-insertion-champs="false"
        :libelle-accessible="libelleAccessible"
        @modifie="$emit('modifie')"
        @pret="$emit('pret')"
        @erreur-chargement="(err) => $emit('erreur-chargement', err)"
      />
    </article>
  </div>
</template>

<script>
import EditeurRiche from '@/components/contrats/EditeurRiche.vue';
import EnTeteCabinet from '@/components/contrats/EnTeteCabinet.vue';

/**
 * Feuille A4 d'un document contractuel : en-tête du cabinet puis texte (éditable en brouillon,
 * lecture seule sinon). Toujours claire ; ce qui est affiché est ce qui s'imprime.
 * Aucun HTML injecté : le texte passe uniquement par Quill (via `EditeurRiche`).
 */
export default {
  name: 'FeuilleDocument',
  components: { EditeurRiche, EnTeteCabinet },
  props: {
    /** @type {import('@/domain/contrats/documents.js').DocumentContrat} */
    document: { type: Object, required: true },
    /** @type {import('@/domain/contrats/documents.js').EnteteAffichee} */
    entete: { type: Object, required: true },
    modifiable: { type: Boolean, default: false },
  },
  emits: ['modifie', 'pret', 'erreur-chargement'],
  computed: {
    libelleAccessible() {
      return `Texte du document « ${this.document.titre} »${this.modifiable ? '' : ', lecture seule'}`;
    },
  },
  methods: {
    /** @returns {{ops: object[]}} contenu courant du texte (Delta JSON). */
    lireContenu() {
      return this.$refs.editeur.lireContenu();
    },
    focus() {
      this.$refs.editeur?.focus();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.feuille-document-conteneur {
  overflow-x: auto;
}

.feuille-document {
  box-sizing: border-box;
  width: t.$impression-largeur-feuille;
  max-width: 100%;
  min-height: 297mm;
  margin: 0 auto;
  padding: 20mm;
  background-color: t.$couleur-fond;
  color: t.$couleur-texte;
  box-shadow: t.$ombre-legere;

  :deep(.ql-container) {
    font-size: t.$impression-taille-texte-document;
  }

  :deep(.ql-editor) {
    min-height: auto;
    max-width: none;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    font-size: t.$impression-taille-texte-document;
    line-height: 1.5;

    p {
      orphans: 3;
      widows: 3;
    }
  }

  :deep(.editeur-riche__zone) {
    margin-top: 0;
  }
}

@media print {
  .feuille-document-conteneur {
    overflow: visible;
  }

  .feuille-document {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: t.$impression-marge-interieure-document;
    box-shadow: none;

    :deep(.ql-editor) {
      height: auto;
      overflow: visible;
    }
  }
}
</style>
