<template>
  <div class="contrats-view">
    <div class="contrats-entete">
      <h1>{{ titrePage }}</h1>
      <button
        v-if="peutCreer"
        ref="boutonAjout"
        type="button"
        class="btn btn-primary contrats-bouton-ajout"
        @click="ouvrirCreation"
      >
        <PhFilePlus :size="20" weight="bold" aria-hidden="true" />
        <span>Nouveau document</span>
      </button>
    </div>

    <template v-if="idPersonne && !personne">
      <div class="contrats-introuvable">
        <PhUserMinus :size="48" aria-hidden="true" />
        <p class="mb-0">Cette personne est introuvable.</p>
        <router-link class="btn btn-outline-secondary" :to="{ name: 'equipe' }">
          <PhArrowLeft :size="18" aria-hidden="true" />
          <span>Retour à l'équipe</span>
        </router-link>
      </div>
    </template>

    <template v-else>
      <div class="contrats-selecteur">
        <label for="contrats-personne" class="form-label">Personne</label>
        <select
          id="contrats-personne"
          ref="selecteur"
          class="form-select contrats-select"
          :value="idPersonne ?? ''"
          @change="onChoisirPersonne($event.target.value)"
        >
          <option value="">Choisir une personne…</option>
          <option v-for="p in actifsTries" :key="p.id" :value="p.id">{{ libelleOption(p) }}</option>
          <optgroup v-if="archiveesVisibles && inactifsTries.length" label="Personnes archivées">
            <option v-for="p in inactifsTries" :key="p.id" :value="p.id">{{ libelleOption(p) }}</option>
          </optgroup>
        </select>
        <div class="form-check contrats-case">
          <input
            id="contrats-archivees"
            class="form-check-input"
            type="checkbox"
            :checked="archiveesVisibles"
            :disabled="personneArchivee"
            @change="afficherArchivees = $event.target.checked"
          />
          <label class="form-check-label" for="contrats-archivees">
            Afficher aussi les personnes archivées
          </label>
        </div>
      </div>

      <p v-if="!personne" class="contrats-etat-vide">
        <PhSignature :size="48" aria-hidden="true" />
        <span>Choisissez une personne pour voir ses contrats et avenants.</span>
      </p>

      <template v-else>
        <p v-if="personneArchivee" class="contrats-texte-explication">
          Restaurez {{ personne.prenom }} dans Équipe pour lui créer un nouveau document.
        </p>

        <section class="contrats-section">
          <h2 class="contrats-titre-section">Documents</h2>
          <ListeDocumentsPersonne
            v-if="documentsActifs.length"
            :documents="documentsActifs"
            @supprimer="demanderSuppression"
            @archiver="onArchiver"
          />
          <p v-else class="contrats-texte-explication">
            Aucun document pour {{ personne.prenom }} {{ personne.nom }} pour le moment.
          </p>
        </section>

        <section v-if="documentsArchives.length" class="contrats-section">
          <h2 class="contrats-titre-section">
            <button
              type="button"
              class="btn btn-link contrats-bascule"
              :aria-expanded="archivesOuvertes ? 'true' : 'false'"
              aria-controls="contrats-liste-archives"
              @click="archivesOuvertes = !archivesOuvertes"
            >
              <PhCaretRight
                :size="18"
                weight="bold"
                class="contrats-bascule-icone"
                :class="{ 'contrats-bascule-icone--ouvert': archivesOuvertes }"
                aria-hidden="true"
              />
              <span>Documents archivés ({{ documentsArchives.length }})</span>
            </button>
          </h2>
          <div v-show="archivesOuvertes" id="contrats-liste-archives">
            <p class="contrats-texte-explication">
              Les documents archivés sont conservés : vous pouvez les restaurer à tout moment.
            </p>
            <ListeDocumentsPersonne :documents="documentsArchives" archives @restaurer="onRestaurer" />
          </div>
        </section>
      </template>
    </template>

    <ModaleNouveauDocument
      v-if="personne"
      :visible="modaleCreationVisible"
      :personne="personne"
      :personnes="toutesPersonnes"
      :cabinet="parametresCabinet"
      :modeles="modelesActifs"
      @creer="onCreer"
      @annuler="fermerCreation"
    />

    <DialogueConfirmation
      :visible="confirmationVisible"
      :titre="titreConfirmationSuppression"
      :message="messageConfirmationSuppression"
      libelle-confirmer="Supprimer le brouillon"
      variante-confirmer="danger"
      @confirmer="onConfirmerSuppression"
      @annuler="onAnnulerSuppression"
    />
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import { PhFilePlus, PhUserMinus, PhArrowLeft, PhSignature, PhCaretRight } from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import ListeDocumentsPersonne from '@/components/contrats/ListeDocumentsPersonne.vue';
import ModaleNouveauDocument from '@/components/contrats/ModaleNouveauDocument.vue';

/**
 * Écran « Documents » (feature 0042) : choix d'une personne puis liste de ses
 * contrats et avenants. Deux routes pour un même composant : `/contrats` et
 * `/contrats/:id`. Orchestration seulement (store `contrats`) : aucune logique
 * métier. La fenêtre de création est branchée en tâche 4 sur
 * `ouvrirCreation()` / `modaleCreationVisible`.
 */
export default {
  name: 'ContratsView',
  components: {
    PhFilePlus,
    PhUserMinus,
    PhArrowLeft,
    PhSignature,
    PhCaretRight,
    DialogueConfirmation,
    ListeDocumentsPersonne,
    ModaleNouveauDocument,
  },
  data() {
    return {
      afficherArchivees: false,
      archivesOuvertes: false,
      // Fenêtre « Nouveau document » (branchée en T4).
      modaleCreationVisible: false,
      confirmationVisible: false,
      documentASupprimer: null,
    };
  },
  computed: {
    ...mapGetters('personnes', { personneParId: 'byId', actifs: 'actifs', inactifs: 'inactifs' }),
    /** Toutes les personnes (la titulaire d'un remplaçant peut être archivée). */
    toutesPersonnes() {
      return [...this.actifs, ...this.inactifs];
    },
    ...mapGetters('contrats', ['documentsDe', 'nbDocumentsDe', 'modelesActifs']),
    ...mapGetters('cabinet', { parametresCabinet: 'parametres' }),
    /** Id de la personne dans l'URL (undefined sur `/contrats`). */
    idPersonne() {
      return this.$route.params.id;
    },
    personne() {
      return this.idPersonne ? this.personneParId(this.idPersonne) : undefined;
    },
    personneArchivee() {
      return this.personne?.actif === false;
    },
    /** Cochée d'office si la personne choisie est archivée. */
    archiveesVisibles() {
      return this.afficherArchivees || this.personneArchivee;
    },
    peutCreer() {
      return Boolean(this.personne) && !this.personneArchivee;
    },
    titrePage() {
      return this.personne ? `Contrats et avenants de ${this.personne.prenom} ${this.personne.nom}` : 'Documents';
    },
    actifsTries() {
      return [...this.actifs].sort(this.comparerPersonnes);
    },
    inactifsTries() {
      return [...this.inactifs].sort(this.comparerPersonnes);
    },
    documentsPersonne() {
      return this.personne ? this.documentsDe(this.personne.id) : [];
    },
    documentsActifs() {
      return this.documentsPersonne.filter((d) => !d.archive);
    },
    documentsArchives() {
      return this.documentsPersonne.filter((d) => d.archive);
    },
    titreConfirmationSuppression() {
      return this.documentASupprimer ? `Supprimer « ${this.documentASupprimer.titre} » ?` : 'Supprimer ce brouillon ?';
    },
    messageConfirmationSuppression() {
      const titre = this.documentASupprimer ? `« ${this.documentASupprimer.titre} »` : 'Ce brouillon';
      return `Le brouillon ${titre} sera définitivement supprimé. Cette action ne peut pas être annulée.`;
    },
  },
  methods: {
    ...mapActions('contrats', ['genererDocument', 'supprimerBrouillon', 'archiverDocument', 'restaurerDocument']),
    /** Tri de présentation : nom puis prénom, locale française. */
    comparerPersonnes(a, b) {
      return a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr');
    },
    libelleOption(p) {
      const n = this.nbDocumentsDe(p.id);
      const nom = `${p.prenom} ${p.nom}`;
      return n > 0 ? `${nom} — ${n} document${n > 1 ? 's' : ''}` : nom;
    },
    onChoisirPersonne(id) {
      if (id) this.$router.push({ name: 'contrats-personne', params: { id } });
      else this.$router.push({ name: 'contrats' });
    },

    ouvrirCreation() {
      this.modaleCreationVisible = true;
    },
    fermerCreation() {
      this.modaleCreationVisible = false;
      this.replacerFocus();
    },
    /** Crée le brouillon puis ouvre sa page ; en cas de refus, la fenêtre reste ouverte. */
    async onCreer({ modeleId, titre, valeursSaisies }) {
      const resultat = await this.genererDocument({ personneId: this.personne.id, modeleId, titre, valeursSaisies });
      if (!resultat.ok) return;
      this.modaleCreationVisible = false;
      this.$router.push({
        name: 'document-contrat',
        params: { id: this.personne.id, documentId: resultat.id },
      });
    },

    demanderSuppression(doc) {
      this.documentASupprimer = doc;
      this.confirmationVisible = true;
    },
    onConfirmerSuppression() {
      this.supprimerBrouillon(this.documentASupprimer.id);
      this.onAnnulerSuppression();
      this.replacerFocus();
    },
    onAnnulerSuppression() {
      this.confirmationVisible = false;
      this.documentASupprimer = null;
    },
    /** Archivage réversible : sans confirmation (toast du store). */
    onArchiver(doc) {
      this.archiverDocument(doc.id);
      this.replacerFocus();
    },
    onRestaurer(doc) {
      this.restaurerDocument(doc.id);
      this.replacerFocus();
    },
    /** Le bouton déclencheur disparaît de la liste : focus sur un point stable. */
    replacerFocus() {
      this.$nextTick(() => (this.$refs.boutonAjout ?? this.$refs.selecteur)?.focus());
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.contrats-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
}

.contrats-bouton-ajout {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.contrats-selecteur {
  max-width: 32rem;
  margin-bottom: t.$espace-4;
}

.contrats-case {
  margin-top: t.$espace-2;
}

.contrats-introuvable,
.contrats-etat-vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: t.$espace-3;
  padding: t.$espace-6 t.$espace-4;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.contrats-section {
  margin-bottom: t.$espace-5;
}

.contrats-titre-section {
  margin-bottom: t.$espace-3;
}

.contrats-bascule {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  padding: t.$espace-1 t.$espace-2;
  margin-left: -#{t.$espace-2};
  text-decoration: none;
  border-radius: t.$rayon-md;
  transition: background-color 0.15s ease-in-out;

  &:hover,
  &:focus-visible {
    text-decoration: underline;
    background-color: t.$couleur-fond-clair;
  }
}

.contrats-bascule-icone {
  transition: transform 0.15s ease-in-out;

  &--ouvert {
    transform: rotate(90deg);
  }
}

.contrats-texte-explication {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
