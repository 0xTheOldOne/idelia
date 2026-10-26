<template>
  <div class="modeles-view">
    <div class="modeles-entete">
      <h1>Modèles de contrats</h1>
      <button ref="boutonAjout" type="button" class="btn btn-primary modeles-bouton-ajout" @click="ouvrirCreation">
        <PhPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Nouveau modèle</span>
      </button>
    </div>

    <p class="modeles-introduction">
      Un modèle est un texte type. Les champs en couleur seront remplis automatiquement pour chaque
      personne lors de la création d'un document.
    </p>

    <section class="modeles-section">
      <h2 class="modeles-titre-section">Modèles actifs</h2>

      <ul v-if="modelesActifs.length" class="modeles-liste">
        <li v-for="modele in modelesActifs" :key="modele.id" class="modeles-ligne">
          <PhFileText :size="28" class="modeles-icone" aria-hidden="true" />
          <div class="modeles-identite">
            <span class="modeles-nom">{{ modele.titre }}</span>
            <span class="modeles-details">Modifié le {{ dateModification(modele) }}</span>
          </div>
          <span class="modeles-badge">{{ libelleTypeModeleContrat(modele.type) }}</span>
          <div class="modeles-actions">
            <router-link
              class="btn btn-outline-secondary modeles-bouton-icone"
              title="Modifier"
              :aria-label="`Modifier le modèle ${modele.titre}`"
              :to="{ name: 'modele-contrat', params: { id: modele.id } }"
            >
              <PhPencilSimple :size="18" aria-hidden="true" />
              <span class="d-md-none" aria-hidden="true">Modifier</span>
            </router-link>
            <button
              type="button"
              class="btn btn-outline-secondary modeles-bouton-icone"
              title="Dupliquer"
              :aria-label="`Dupliquer le modèle ${modele.titre}`"
              @click="dupliquer(modele)"
            >
              <PhCopy :size="18" aria-hidden="true" />
              <span class="d-md-none" aria-hidden="true">Dupliquer</span>
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary modeles-bouton-icone"
              title="Renommer"
              :aria-label="`Renommer le modèle ${modele.titre}`"
              @click="ouvrirRenommage(modele)"
            >
              <PhTextAa :size="18" aria-hidden="true" />
              <span class="d-md-none" aria-hidden="true">Renommer</span>
            </button>
            <button
              type="button"
              class="btn btn-outline-danger modeles-bouton-icone modeles-bouton-archiver"
              title="Archiver"
              :aria-label="`Archiver le modèle ${modele.titre}`"
              @click="demanderArchivage(modele)"
            >
              <PhArchive :size="18" aria-hidden="true" />
              <span class="d-md-none" aria-hidden="true">Archiver</span>
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="modeles-texte-explication">Aucun modèle actif pour le moment.</p>
    </section>

    <section v-if="modelesArchives.length" class="modeles-section">
      <h2 class="modeles-titre-section">
        <button
          type="button"
          class="btn btn-link modeles-bascule"
          :aria-expanded="archivesOuvertes ? 'true' : 'false'"
          aria-controls="modeles-liste-archives"
          @click="archivesOuvertes = !archivesOuvertes"
        >
          <PhCaretRight
            :size="18"
            weight="bold"
            class="modeles-bascule-icone"
            :class="{ 'modeles-bascule-icone--ouvert': archivesOuvertes }"
            aria-hidden="true"
          />
          <span>Modèles archivés ({{ modelesArchives.length }})</span>
        </button>
      </h2>

      <div v-show="archivesOuvertes" id="modeles-liste-archives">
        <p class="modeles-texte-explication">
          Les modèles archivés sont conservés : vous pouvez les restaurer à tout moment.
        </p>
        <ul class="modeles-liste modeles-liste--archivee">
          <li v-for="modele in modelesArchives" :key="modele.id" class="modeles-ligne">
            <PhFileText :size="28" class="modeles-icone" aria-hidden="true" />
            <div class="modeles-identite">
              <span class="modeles-nom">{{ modele.titre }}</span>
              <span class="modeles-details">Modifié le {{ dateModification(modele) }}</span>
            </div>
            <span class="modeles-badge">{{ libelleTypeModeleContrat(modele.type) }}</span>
            <div class="modeles-actions">
              <button
                type="button"
                class="btn btn-outline-secondary modeles-bouton-icone"
                title="Restaurer"
                :aria-label="`Restaurer le modèle ${modele.titre}`"
                @click="onRestaurer(modele)"
              >
                <PhArrowCounterClockwise :size="18" aria-hidden="true" />
                <span class="d-md-none" aria-hidden="true">Restaurer</span>
              </button>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <ModaleModeleContrat
      :visible="modaleVisible"
      :modele="modeleEnCours"
      :titres-existants="titresAutresModeles"
      @valider="onValider"
      @annuler="fermerModale"
    />

    <DialogueConfirmation
      :visible="confirmationVisible"
      :titre="titreConfirmationArchivage"
      :message="messageConfirmationArchivage"
      libelle-confirmer="Archiver"
      variante-confirmer="primary"
      @confirmer="onConfirmerArchivage"
      @annuler="onAnnulerArchivage"
    />
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import {
  PhPlus,
  PhFileText,
  PhPencilSimple,
  PhCopy,
  PhTextAa,
  PhArchive,
  PhArrowCounterClockwise,
  PhCaretRight,
} from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import ModaleModeleContrat from '@/components/contrats/ModaleModeleContrat.vue';
import { libelleTypeModeleContrat } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Écran « Modèles de contrats » (feature 0041) : liste les modèles et
 * **orchestre** leur cycle de vie (créer, dupliquer, renommer, archiver,
 * restaurer) via le store `contrats`. Aucune logique métier ici : la
 * construction des modèles est dans le domaine (`src/domain/contrats/`).
 * Structure calquée sur `TourneesView` / `EquipeView`.
 */
export default {
  name: 'ModelesContratsView',
  components: {
    PhPlus,
    PhFileText,
    PhPencilSimple,
    PhCopy,
    PhTextAa,
    PhArchive,
    PhArrowCounterClockwise,
    PhCaretRight,
    DialogueConfirmation,
    ModaleModeleContrat,
  },
  data() {
    return {
      // Modale titre + type : `modeleEnCours = null` en création, objet en renommage.
      modaleVisible: false,
      modeleEnCours: null,
      confirmationVisible: false,
      modeleAArchiver: null,
      archivesOuvertes: false,
    };
  },
  computed: {
    ...mapGetters('contrats', ['modelesActifs', 'modelesArchives']),
    /** Titres des autres modèles (pour la note de doublon, non bloquante). */
    titresAutresModeles() {
      return [...this.modelesActifs, ...this.modelesArchives]
        .filter((m) => !this.modeleEnCours || m.id !== this.modeleEnCours.id)
        .map((m) => m.titre);
    },
    titreConfirmationArchivage() {
      const modele = this.modeleAArchiver;
      return modele ? `Archiver « ${modele.titre} » ?` : 'Archiver ce modèle ?';
    },
    messageConfirmationArchivage() {
      const nom = this.modeleAArchiver ? `« ${this.modeleAArchiver.titre} »` : 'Ce modèle';
      return (
        `${nom} sera retiré de la liste des modèles actifs, mais restera conservé : ` +
        'vous pourrez le restaurer à tout moment depuis « Modèles archivés ». ' +
        "Aucune donnée n'est supprimée."
      );
    },
  },
  created() {
    // Premier accès : prépare les deux modèles de départ (une seule fois).
    this.assurerModelesDeDepart();
  },
  methods: {
    ...mapActions('contrats', [
      'assurerModelesDeDepart',
      'creerModele',
      'renommerModele',
      'dupliquerModele',
      'archiverModele',
      'restaurerModele',
    ]),
    libelleTypeModeleContrat,
    dateModification(modele) {
      return dateUtil.formatHorodatageDateFr(modele.updatedAt);
    },

    ouvrirCreation() {
      this.modeleEnCours = null;
      this.modaleVisible = true;
    },
    ouvrirRenommage(modele) {
      this.modeleEnCours = modele;
      this.modaleVisible = true;
    },
    fermerModale() {
      this.modaleVisible = false;
      this.modeleEnCours = null;
    },
    /** Création (puis ouverture de l'éditeur) ou renommage selon le mode de la modale. */
    async onValider({ titre, type }) {
      if (this.modeleEnCours) {
        await this.renommerModele({ id: this.modeleEnCours.id, titre, type });
        this.fermerModale();
        return;
      }
      const id = await this.creerModele({ titre, type });
      this.fermerModale();
      this.$router.push({ name: 'modele-contrat', params: { id } });
    },
    /** Duplique puis ouvre directement la copie. */
    async dupliquer(modele) {
      const id = await this.dupliquerModele(modele.id);
      if (id) this.$router.push({ name: 'modele-contrat', params: { id } });
    },

    demanderArchivage(modele) {
      this.modeleAArchiver = modele;
      this.confirmationVisible = true;
    },
    onConfirmerArchivage() {
      this.archiverModele(this.modeleAArchiver.id);
      this.confirmationVisible = false;
      this.modeleAArchiver = null;
      // Le bouton déclencheur disparaît de la liste : focus sur un point stable.
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
    onAnnulerArchivage() {
      this.confirmationVisible = false;
      this.modeleAArchiver = null;
    },
    /** Restauration : action sûre, jamais confirmée. */
    onRestaurer(modele) {
      this.restaurerModele(modele.id);
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.modeles-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-3;
}

.modeles-bouton-ajout {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.modeles-introduction {
  max-width: 48rem;
  margin-bottom: t.$espace-4;
  color: t.$couleur-texte-attenue;
}

.modeles-section {
  margin-bottom: t.$espace-5;
}

.modeles-titre-section {
  margin-bottom: t.$espace-3;
}

.modeles-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.modeles-ligne {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-3;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

.modeles-liste--archivee .modeles-ligne {
  background-color: t.$couleur-fond-clair;
  color: t.$couleur-texte-attenue;
}

.modeles-icone {
  flex-shrink: 0;
  color: t.$couleur-primaire;
}

.modeles-identite {
  display: flex;
  flex-direction: column;
  flex: 1 1 14rem;
  min-width: 0;
}

.modeles-nom {
  font-weight: t.$graisse-gras;
}

.modeles-details {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

// Type en texte (jamais la seule couleur).
.modeles-badge {
  padding: 0.1rem t.$espace-2;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

.modeles-actions {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-1;
  margin-left: auto;
}

.modeles-bouton-icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: t.$espace-1;
  min-width: t.$cible-cliquable-min;
  line-height: 1;
}

// « Archiver » retire le modèle de la liste active : écarté des autres actions.
.modeles-bouton-archiver {
  margin-left: t.$espace-3;
}

.modeles-bascule {
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

.modeles-bascule-icone {
  transition: transform 0.15s ease-in-out;

  &--ouvert {
    transform: rotate(90deg);
  }
}

.modeles-texte-explication {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
