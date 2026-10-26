<template>
  <div class="document-contrat-view">
    <template v-if="document">
      <div class="d-print-none">
        <router-link class="document-retour" :to="{ name: 'contrats-personne', params: { id: personne.id } }">
          <PhArrowLeft :size="18" aria-hidden="true" />
          <span>Retour aux documents de {{ nomPersonne }}</span>
        </router-link>

        <div class="document-entete">
          <h1 class="document-titre">{{ document.titre }}</h1>
          <div class="document-actions">
            <button
              v-if="modifiable"
              type="button"
              class="btn btn-primary document-bouton"
              :disabled="!modifie || !editeurPret || !titreValide"
              @click="enregistrer"
            >
              <PhFloppyDisk :size="20" weight="bold" aria-hidden="true" />
              <span>Enregistrer</span>
            </button>
            <button
              v-if="modifiable"
              type="button"
              class="btn btn-outline-secondary document-bouton-icone"
              title="Marquer comme signé"
              aria-label="Marquer comme signé"
              :disabled="!editeurPret || !titreValide"
              @click="ouvrirSignature"
            >
              <PhSignature :size="20" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary document-bouton-icone"
              :title="AIDE_IMPRESSION"
              aria-label="Imprimer ou enregistrer en PDF"
              @click="imprimer"
            >
              <PhPrinter :size="20" aria-hidden="true" />
            </button>
            <button
              v-if="supprimable"
              type="button"
              class="btn btn-outline-danger document-bouton-icone document-groupe-sortie"
              title="Supprimer le brouillon"
              aria-label="Supprimer le brouillon"
              @click="dialogueSuppression = true"
            >
              <PhTrash :size="20" aria-hidden="true" />
            </button>
            <button
              v-if="archivable && !document.archive"
              type="button"
              class="btn btn-outline-danger document-bouton-icone document-groupe-sortie"
              title="Archiver"
              aria-label="Archiver ce document"
              @click="archiver"
            >
              <PhArchive :size="20" aria-hidden="true" />
            </button>
            <button
              v-if="archivable && document.archive"
              type="button"
              class="btn btn-outline-secondary document-bouton-icone document-groupe-sortie"
              title="Restaurer"
              aria-label="Restaurer ce document"
              @click="restaurer"
            >
              <PhArrowCounterClockwise :size="20" aria-hidden="true" />
            </button>
          </div>
        </div>

        <p class="document-meta">
          <BadgeStatutDocument :document="document" />
          <span>Créé le {{ dateCreation }}<template v-if="titreModele"> à partir du modèle « {{ titreModele }} »</template></span>
        </p>

        <p v-if="modifiable" class="alert alert-info document-encadre" role="status">
          <PhPencilSimple :size="20" aria-hidden="true" />
          <span>Brouillon : vous pouvez encore modifier ce document.</span>
        </p>
        <p v-else class="alert alert-secondary document-encadre" role="status">
          <PhLockSimple :size="20" aria-hidden="true" />
          <span>
            Signé le {{ dateSignatureFr }} : ce document ne peut plus être modifié.<template v-if="document.archive"> Il est archivé.</template>
          </span>
        </p>

        <p v-if="ecartTaux" class="alert alert-warning document-encadre" role="status">
          <PhWarning :size="20" aria-hidden="true" />
          <span>
            Le taux de rétrocession de ce document ({{ formaterTaux(ecartTaux.valeurSaisie) }}) ne correspond pas à celui de la fiche de {{ nomPersonne }}
            ({{ ecartTaux.valeurFiche === null ? 'non renseigné' : formaterTaux(ecartTaux.valeurFiche) }}).
            La fiche n'a pas été modifiée.
            <router-link :to="lienFiche">Ouvrir la fiche</router-link>
          </span>
        </p>

        <p v-if="modifiable" class="document-etat" :class="{ 'document-etat--attente': modifie }" role="status">
          <template v-if="modifie">
            <PhWarningCircle :size="20" weight="bold" aria-hidden="true" />
            <span>Modifications non enregistrées</span>
          </template>
          <template v-else>
            <PhCheckCircle :size="20" weight="bold" aria-hidden="true" />
            <span>Toutes les modifications sont enregistrées</span>
          </template>
        </p>

        <div v-if="modifiable" class="document-champ-titre">
          <label for="document-titre-saisie" class="form-label">Titre du document</label>
          <input
            id="document-titre-saisie"
            v-model="titreSaisi"
            type="text"
            class="form-control"
            maxlength="200"
            :class="{ 'is-invalid': !titreValide }"
            :aria-describedby="titreValide ? null : 'document-titre-erreur'"
            @input="modifie = true"
          />
          <p v-if="!titreValide" id="document-titre-erreur" class="invalid-feedback d-block">
            Le titre du document est obligatoire.
          </p>
        </div>
      </div>

      <FeuilleDocument
        :key="`${document.id}-${document.statut}`"
        ref="feuille"
        :document="document"
        :entete="entete"
        :modifiable="modifiable"
        @modifie="onModifie"
        @pret="editeurPret = true"
      />
    </template>

    <template v-else>
      <h1>Ce document est introuvable.</h1>
      <router-link :to="lienRetourIntrouvable">Revenir aux documents</router-link>
    </template>

    <DialogueConfirmation
      :visible="dialogueSignature"
      titre="Marquer ce document comme signé ?"
      :message="messageSignature"
      libelle-confirmer="Marquer comme signé"
      @confirmer="signer"
      @annuler="dialogueSignature = false"
    >
      <label for="document-date-signature" class="form-label">Date de signature</label>
      <input
        id="document-date-signature"
        v-model="v$.dateSignature.$model"
        type="date"
        class="form-control"
        :max="aujourdhui"
        :class="{ 'is-invalid': v$.dateSignature.$error }"
        :aria-describedby="v$.dateSignature.$error ? 'document-date-signature-erreur' : null"
      />
      <p v-if="v$.dateSignature.$error" id="document-date-signature-erreur" class="invalid-feedback d-block">
        {{ v$.dateSignature.$errors[0].$message }}
      </p>
    </DialogueConfirmation>

    <DialogueConfirmation
      :visible="dialogueSuppression"
      titre="Supprimer ce brouillon ?"
      :message="`Le brouillon « ${document?.titre ?? ''} » sera supprimé définitivement. Cette action est irréversible.`"
      libelle-confirmer="Supprimer le brouillon"
      variante-confirmer="danger"
      @confirmer="supprimer"
      @annuler="dialogueSuppression = false"
    />

    <DialogueConfirmation
      :visible="dialogueQuitter"
      titre="Quitter sans enregistrer ?"
      message="Vos dernières modifications seront perdues."
      libelle-annuler="Rester sur la page"
      libelle-confirmer="Quitter sans enregistrer"
      variante-confirmer="danger"
      @confirmer="repondreQuitter(true)"
      @annuler="repondreQuitter(false)"
    />
  </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex';
import { useVuelidate } from '@vuelidate/core';
import { helpers } from '@vuelidate/validators';
import {
  PhArrowLeft,
  PhFloppyDisk,
  PhPrinter,
  PhWarningCircle,
  PhCheckCircle,
  PhSignature,
  PhTrash,
  PhArchive,
  PhArrowCounterClockwise,
  PhPencilSimple,
  PhLockSimple,
  PhWarning,
} from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import BadgeStatutDocument from '@/components/contrats/BadgeStatutDocument.vue';
import FeuilleDocument from '@/components/contrats/FeuilleDocument.vue';
import { copieJson } from '@/domain/utils/json.js';
import { dateUtil } from '@/domain/utils/dates.js';
import {
  ecartTauxRetrocession,
  enteteAffichee,
  estArchivable,
  estDateSignatureValide,
  estModifiable,
  estSupprimable,
  titreFichierDocument,
} from '@/domain/contrats/documents.js';

/**
 * Page d'un document contractuel (feature 0042, tâches 5 et 6) : feuille A4, édition du brouillon,
 * enregistrement explicite (bouton + Ctrl+S + garde de sortie, motif `ModeleContratView`),
 * impression, signature (date, en-tête figé), suppression du brouillon, archivage et rappel de taux.
 * Un document signé s'ouvre en lecture seule.
 */
export default {
  name: 'DocumentContratView',
  components: {
    PhArrowLeft,
    PhFloppyDisk,
    PhPrinter,
    PhWarningCircle,
    PhCheckCircle,
    PhSignature,
    PhTrash,
    PhArchive,
    PhArrowCounterClockwise,
    PhPencilSimple,
    PhLockSimple,
    PhWarning,
    BadgeStatutDocument,
    DialogueConfirmation,
    FeuilleDocument,
  },
  setup() {
    // Pont requis par Vuelidate 2 en Options API (ADR 0011).
    return { v$: useVuelidate() };
  },
  data() {
    return {
      AIDE_IMPRESSION: "Imprimer / Enregistrer en PDF : dans la fenêtre qui s'ouvre, choisissez « Enregistrer au format PDF ».",
      dialogueSignature: false,
      dialogueSuppression: false,
      dateSignature: '',
      aujourdhui: dateUtil.format(new Date()),
      modifie: false,
      editeurPret: false,
      // Copie de travail du titre : le store n'est touché qu'à l'enregistrement.
      titreSaisi: '',
      titreInitialOnglet: '',
      dialogueQuitter: false,
      resoudreQuitter: null,
    };
  },
  validations() {
    return {
      dateSignature: {
        valide: helpers.withMessage(
          'Choisissez une date de signature valide, qui ne soit pas dans le futur.',
          (v) => estDateSignatureValide(v, this.aujourdhui),
        ),
      },
    };
  },
  computed: {
    ...mapGetters('contrats', ['documentById', 'modeleById']),
    ...mapGetters('cabinet', ['parametres']),
    ...mapState('personnes', { personnes: 'items' }),
    document() {
      const doc = this.documentById(this.$route.params.documentId);
      return doc && doc.personneId === this.$route.params.id ? doc : null;
    },
    personne() {
      return this.personnes.find((p) => p.id === this.$route.params.id) ?? null;
    },
    nomPersonne() {
      return `${this.personne?.prenom ?? ''} ${this.personne?.nom ?? ''}`.trim();
    },
    modifiable() {
      return estModifiable(this.document);
    },
    supprimable() {
      return estSupprimable(this.document);
    },
    archivable() {
      return estArchivable(this.document);
    },
    dateSignatureFr() {
      return this.document?.signeLe ? dateUtil.formatDateFr(this.document.signeLe) : '';
    },
    messageSignature() {
      const base = "Un document signé ne peut plus être modifié ni supprimé : vous pourrez seulement l'archiver.";
      return this.modifie ? `${base} Vos modifications non enregistrées seront incluses dans le document signé.` : base;
    },
    /** Écart entre le taux saisi à la création et la fiche (rappel non bloquant). */
    ecartTaux() {
      if (!this.document || this.document.archive) return null;
      return ecartTauxRetrocession({ valeursSaisies: this.document.valeursSaisies, personne: this.personne });
    },
    lienFiche() {
      return { name: 'equipe', query: { modifier: this.personne?.id, champ: 'remplacement' } };
    },
    titreValide() {
      return this.titreSaisi.trim().length > 0;
    },
    titreModele() {
      return this.modeleById(this.document?.modeleId)?.titre ?? '';
    },
    dateCreation() {
      return dateUtil.formatDateFr(String(this.document.createdAt).slice(0, 10));
    },
    entete() {
      return enteteAffichee(this.document, this.parametres);
    },
    lienRetourIntrouvable() {
      return this.personne
        ? { name: 'contrats-personne', params: { id: this.personne.id } }
        : { name: 'contrats' };
    },
    /** Nom de fichier proposé par le navigateur pour le PDF (titre de l'onglet). */
    titreOnglet() {
      if (!this.document) return this.titreInitialOnglet;
      const doc = this.modifiable ? { ...this.document, titre: this.titreSaisi } : this.document;
      return titreFichierDocument(doc, this.personne) || this.titreInitialOnglet;
    },
  },
  watch: {
    // Passage d'un document à un autre (la garde a déjà été franchie) : on repart de zéro.
    '$route.params.documentId'() {
      this.charger();
    },
    titreOnglet(titre) {
      document.title = titre;
    },
  },
  created() {
    this.charger();
  },
  mounted() {
    this.titreInitialOnglet = document.title;
    document.title = this.titreOnglet;
    window.addEventListener('beforeunload', this.surFermetureOnglet);
    window.addEventListener('keydown', this.surToucheClavier);
  },
  beforeUnmount() {
    document.title = this.titreInitialOnglet;
    window.removeEventListener('beforeunload', this.surFermetureOnglet);
    window.removeEventListener('keydown', this.surToucheClavier);
  },
  beforeRouteLeave() {
    return this.confirmerSortie();
  },
  beforeRouteUpdate() {
    return this.confirmerSortie();
  },
  methods: {
    ...mapActions('contrats', [
      'enregistrerBrouillon',
      'marquerSigne',
      'supprimerBrouillon',
      'archiverDocument',
      'restaurerDocument',
    ]),

    /** Prépare la copie de travail depuis le document courant. */
    charger() {
      this.modifie = false;
      this.editeurPret = false;
      this.titreSaisi = this.document?.titre ?? '';
    },
    onModifie() {
      if (!this.modifiable) return;
      this.modifie = true;
    },

    async enregistrer() {
      if (!this.document || !this.modifiable || !this.modifie || !this.editeurPret || !this.titreValide) return;
      const enregistre = await this.enregistrerBrouillon({
        id: this.document.id,
        titre: this.titreSaisi,
        contenu: copieJson(this.$refs.feuille.lireContenu()),
      });
      if (enregistre) this.modifie = false;
    },
    imprimer() {
      window.print();
    },
    formaterTaux(taux) {
      return `${String(taux).replace('.', ',')} %`;
    },

    // ---- Cycle de vie ----
    ouvrirSignature() {
      this.dateSignature = this.aujourdhui;
      this.v$.$reset();
      this.dialogueSignature = true;
    },
    /** Signe le document en intégrant les modifications non enregistrées ; la page passe en lecture seule. */
    async signer() {
      this.v$.$touch();
      if (this.v$.$invalid || !this.modifiable || !this.titreValide) return;
      const charge = { id: this.document.id, signeLe: this.dateSignature };
      if (this.modifie) {
        charge.titre = this.titreSaisi;
        charge.contenu = copieJson(this.$refs.feuille.lireContenu());
      }
      const signe = await this.marquerSigne(charge);
      this.dialogueSignature = false;
      // Plus de garde de sortie : le texte est désormais celui du document signé.
      if (signe) this.modifie = false;
    },
    async supprimer() {
      this.dialogueSuppression = false;
      const retour = { name: 'contrats-personne', params: { id: this.personne?.id ?? this.$route.params.id } };
      if (!(await this.supprimerBrouillon(this.document.id))) return;
      // Sortie volontaire : aucune garde sur un brouillon supprimé.
      this.modifie = false;
      this.$router.push(retour);
    },
    archiver() {
      this.archiverDocument(this.document.id);
    },
    restaurer() {
      this.restaurerDocument(this.document.id);
    },

    // ---- Garde de sortie ----
    /** @returns {(boolean|Promise<boolean>)} `true` si la navigation peut continuer. */
    confirmerSortie() {
      if (!this.modifie) return true;
      return new Promise((resolve) => {
        this.resoudreQuitter = resolve;
        this.dialogueQuitter = true;
      });
    },
    repondreQuitter(quitter) {
      this.dialogueQuitter = false;
      const resoudre = this.resoudreQuitter;
      this.resoudreQuitter = null;
      if (resoudre) resoudre(quitter);
    },
    surFermetureOnglet(evenement) {
      if (!this.modifie) return;
      evenement.preventDefault();
      // Requis par certains navigateurs pour afficher l'alerte native.
      evenement.returnValue = '';
    },
    surToucheClavier(evenement) {
      if (!this.modifiable) return;
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 's') {
        evenement.preventDefault();
        this.enregistrer();
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.document-retour {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.document-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
}

.document-titre {
  flex: 1 1 20rem;
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.document-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: t.$espace-2;
}

.document-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.document-bouton-icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;
}

.document-encadre {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-2;
  margin-bottom: t.$espace-3;

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
  }
}

// Supprimer / Archiver / Restaurer : groupe à part, écarté des actions courantes.
.document-groupe-sortie {
  margin-left: t.$espace-3;
}

.document-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: t.$espace-3;
  margin-bottom: t.$espace-2;
  color: t.$couleur-texte-attenue;
}

.document-etat {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin-bottom: t.$espace-3;
  color: t.$couleur-texte-attenue;

  &--attente {
    color: t.$couleur-texte;
    font-weight: t.$graisse-gras;
  }
}

.document-champ-titre {
  max-width: 40rem;
  margin-bottom: t.$espace-3;
}

@media print {
  .document-contrat-view {
    margin: 0;
    padding: 0;
  }
}
</style>
