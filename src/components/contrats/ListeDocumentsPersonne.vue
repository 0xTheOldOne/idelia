<template>
  <ul class="documents-liste" :class="{ 'documents-liste--archivee': archives }">
    <li v-for="doc in documents" :key="doc.id" class="documents-ligne">
      <PhFileText :size="28" class="documents-icone" aria-hidden="true" />
      <div class="documents-identite">
        <router-link class="documents-titre" :to="lien(doc)">{{ doc.titre }}</router-link>
        <span class="documents-details">
          {{ libelleTypeModeleContrat(doc.type) }} · Créé le {{ dateCreation(doc) }} à partir de « {{ titreModele(doc) }} »
        </span>
      </div>
      <BadgeStatutDocument :document="doc" />
      <div class="documents-actions">
        <router-link
          class="btn btn-outline-secondary documents-bouton-icone"
          title="Ouvrir"
          :aria-label="`Ouvrir le document ${doc.titre}`"
          :to="lien(doc)"
        >
          <PhEye :size="18" aria-hidden="true" />
          <span class="d-md-none" aria-hidden="true">Ouvrir</span>
        </router-link>
        <button
          v-if="archives"
          type="button"
          class="btn btn-outline-secondary documents-bouton-icone"
          title="Restaurer"
          :aria-label="`Restaurer le document ${doc.titre}`"
          @click="$emit('restaurer', doc)"
        >
          <PhArrowCounterClockwise :size="18" aria-hidden="true" />
          <span class="d-md-none" aria-hidden="true">Restaurer</span>
        </button>
        <button
          v-else-if="doc.statut === 'BROUILLON'"
          type="button"
          class="btn btn-outline-danger documents-bouton-icone documents-bouton-ecarte"
          title="Supprimer le brouillon"
          :aria-label="`Supprimer le brouillon ${doc.titre}`"
          @click="$emit('supprimer', doc)"
        >
          <PhTrash :size="18" aria-hidden="true" />
          <span class="d-md-none" aria-hidden="true">Supprimer</span>
        </button>
        <button
          v-else
          type="button"
          class="btn btn-outline-danger documents-bouton-icone documents-bouton-ecarte"
          title="Archiver"
          :aria-label="`Archiver le document ${doc.titre}`"
          @click="$emit('archiver', doc)"
        >
          <PhArchive :size="18" aria-hidden="true" />
          <span class="d-md-none" aria-hidden="true">Archiver</span>
        </button>
      </div>
    </li>
  </ul>
</template>

<script>
import { mapGetters } from 'vuex';
import { PhFileText, PhEye, PhTrash, PhArchive, PhArrowCounterClockwise } from '@phosphor-icons/vue';

import BadgeStatutDocument from '@/components/contrats/BadgeStatutDocument.vue';
import { libelleTypeModeleContrat } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Liste des documents d'une personne (0042). Présentationnelle : émet
 * `supprimer`, `archiver` et `restaurer` (avec le document) ; la vue orchestre.
 */
export default {
  name: 'ListeDocumentsPersonne',
  components: { PhFileText, PhEye, PhTrash, PhArchive, PhArrowCounterClockwise, BadgeStatutDocument },
  props: {
    /** @type {import('vue').PropType<object[]>} */
    documents: { type: Array, required: true },
    /** `true` : section « Documents archivés » (action « Restaurer »). */
    archives: { type: Boolean, default: false },
  },
  emits: ['supprimer', 'archiver', 'restaurer'],
  computed: {
    ...mapGetters('contrats', ['modeleById']),
  },
  methods: {
    libelleTypeModeleContrat,
    lien(doc) {
      return { name: 'document-contrat', params: { id: doc.personneId, documentId: doc.id } };
    },
    dateCreation(doc) {
      return dateUtil.formatHorodatageDateFr(doc.createdAt);
    },
    /** Titre du modèle d'origine (archivé compris). */
    titreModele(doc) {
      return this.modeleById(doc.modeleId)?.titre ?? 'modèle supprimé';
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.documents-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.documents-ligne {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-3;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

.documents-liste--archivee .documents-ligne {
  background-color: t.$couleur-fond-clair;
  color: t.$couleur-texte-attenue;
}

.documents-icone {
  flex-shrink: 0;
  color: t.$couleur-primaire;
}

.documents-identite {
  display: flex;
  flex-direction: column;
  flex: 1 1 14rem;
  min-width: 0;
}

.documents-titre {
  font-weight: t.$graisse-gras;
}

.documents-details {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.documents-actions {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-1;
  margin-left: auto;
}

.documents-bouton-icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: t.$espace-1;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;
  line-height: 1;
}

// « Supprimer » / « Archiver » écartés des autres actions.
.documents-bouton-ecarte {
  margin-left: t.$espace-3;
}
</style>
