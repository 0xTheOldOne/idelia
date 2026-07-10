<template>
  <div class="equipe-view">
    <div
      v-if="statutSauvegarde === 'ERREUR_CHARGEMENT'"
      class="alert alert-warning d-flex gap-2"
      role="alert"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Les personnes enregistrées n'ont pas pu être relues ; la liste affichée peut être
        incomplète. Une copie de sauvegarde a été conservée. Rechargez la page pour réessayer ; si
        le problème persiste, réimportez une sauvegarde.
      </p>
    </div>

    <div class="equipe-entete">
      <h1>Équipe</h1>
      <button
        ref="boutonAjout"
        type="button"
        class="btn btn-primary equipe-bouton-ajout"
        @click="ouvrirAjout"
      >
        <PhUserPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une personne</span>
      </button>
    </div>

    <div v-if="aucunePersonne" class="equipe-etat-vide">
      <PhUsers :size="48" aria-hidden="true" />
      <p class="mb-0">
        Aucune personne pour l'instant. Ajoutez la première pour composer votre équipe.
      </p>
      <button type="button" class="btn btn-primary equipe-bouton-ajout" @click="ouvrirAjout">
        <PhUserPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une personne</span>
      </button>
    </div>

    <template v-else>
      <section class="equipe-section">
        <h2 class="equipe-titre-section">Personnes de l'équipe</h2>

        <ul v-if="actifsTries.length" class="equipe-liste">
          <li v-for="personne in actifsTries" :key="personne.id" class="equipe-ligne">
            <span
              class="equipe-pastille"
              :style="{ backgroundColor: personne.couleur }"
              aria-hidden="true"
            />
            <div class="equipe-identite">
              <span class="equipe-nom">{{ personne.prenom }} {{ personne.nom }}</span>
              <span class="equipe-details">
                {{ libelleStatutPersonne(personne.statut) }} · {{ personne.quotite }} %
                <template v-if="periodeTexte(personne)"> · {{ periodeTexte(personne) }}</template>
              </span>
            </div>
            <div class="equipe-actions">
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="ouvrirEdition(personne)"
              >
                <PhPencilSimple :size="18" aria-hidden="true" />
                <span>Modifier</span>
              </button>
              <router-link
                class="btn btn-outline-secondary equipe-bouton-souhaits"
                :to="{ name: 'souhaits', params: { id: personne.id } }"
              >
                <PhShootingStar :size="18" aria-hidden="true" />
                <span>Souhaits</span>
              </router-link>
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="demanderArchivage(personne)"
              >
                <PhArchive :size="18" aria-hidden="true" />
                <span>Archiver</span>
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="equipe-texte-explication">Aucune personne active pour le moment.</p>
      </section>

      <section v-if="inactifs.length" class="equipe-section">
        <h2 class="equipe-titre-section">
          <button
            type="button"
            class="btn btn-link equipe-bascule"
            :aria-expanded="archivesOuvertes ? 'true' : 'false'"
            aria-controls="equipe-liste-archivees"
            @click="archivesOuvertes = !archivesOuvertes"
          >
            <PhCaretRight
              :size="18"
              weight="bold"
              class="equipe-bascule-icone"
              :class="{ 'equipe-bascule-icone--ouvert': archivesOuvertes }"
              aria-hidden="true"
            />
            <span>Personnes archivées ({{ inactifs.length }})</span>
          </button>
        </h2>

        <div v-show="archivesOuvertes" id="equipe-liste-archivees">
          <p class="equipe-texte-explication">
            Les personnes archivées sont conservées pour l'historique des plannings.
          </p>

          <ul class="equipe-liste equipe-liste--archivee">
            <li v-for="personne in inactifsTries" :key="personne.id" class="equipe-ligne">
              <span
                class="equipe-pastille"
                :style="{ backgroundColor: personne.couleur }"
                aria-hidden="true"
              />
              <div class="equipe-identite">
                <span class="equipe-nom">{{ personne.prenom }} {{ personne.nom }}</span>
                <span class="equipe-details">
                  {{ libelleStatutPersonne(personne.statut) }} · {{ personne.quotite }} %
                </span>
              </div>
              <div class="equipe-actions">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="restaurer(personne)"
                >
                  <PhArrowCounterClockwise :size="18" aria-hidden="true" />
                  <span>Restaurer</span>
                </button>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </template>

    <FormulairePersonne
      :visible="formulaireVisible"
      :personne="personneEnCours"
      :couleurs-suggerees="parametres.couleursParDefaut"
      @enregistrer="onEnregistrer"
      @annuler="onAnnulerFormulaire"
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
import { mapGetters, mapActions, mapState } from 'vuex';
import {
  PhWarning,
  PhUserPlus,
  PhUsers,
  PhPencilSimple,
  PhArchive,
  PhArrowCounterClockwise,
  PhCaretRight,
  PhShootingStar,
} from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import FormulairePersonne from '@/components/equipe/FormulairePersonne.vue';
import { libelleStatutPersonne } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Écran « Équipe » (feature 0004) : liste les personnes du cabinet et
 * **orchestre** leur cycle de vie (ajout, édition, archivage, restauration)
 * via le store `personnes`. Ne contient **aucune logique métier** : la
 * construction/normalisation d'une personne est déléguée au domaine
 * (`creerPersonne`, appelé par l'action `personnes/ajouter`) ; le tri
 * alphabétique n'est qu'un choix de présentation local à l'écran.
 */
export default {
  name: 'EquipeView',
  components: {
    PhWarning,
    PhUserPlus,
    PhUsers,
    PhPencilSimple,
    PhArchive,
    PhArrowCounterClockwise,
    PhCaretRight,
    PhShootingStar,
    DialogueConfirmation,
    FormulairePersonne,
  },
  data() {
    return {
      // Pilotage de la modale d'ajout/édition (`personneEnCours = null` en
      // création, objet `Personne` en édition).
      formulaireVisible: false,
      personneEnCours: null,
      // Pilotage de la confirmation d'archivage.
      confirmationVisible: false,
      personneAArchiver: null,
      // Section « Personnes archivées » repliée par défaut (bascule Vue
      // simple, sans JS `collapse` de Bootstrap).
      archivesOuvertes: false,
    };
  },
  computed: {
    ...mapGetters('personnes', ['actifs', 'inactifs']),
    ...mapGetters('cabinet', ['parametres']),
    ...mapState(['statutSauvegarde']),
    aucunePersonne() {
      return this.actifs.length === 0 && this.inactifs.length === 0;
    },
    actifsTries() {
      return [...this.actifs].sort(this.comparerPersonnes);
    },
    inactifsTries() {
      return [...this.inactifs].sort(this.comparerPersonnes);
    },
    titreConfirmationArchivage() {
      const personne = this.personneAArchiver;
      return personne ? `Archiver ${personne.prenom} ${personne.nom} ?` : 'Archiver cette personne ?';
    },
    messageConfirmationArchivage() {
      const personne = this.personneAArchiver;
      const nom = personne ? `${personne.prenom} ${personne.nom}` : 'Cette personne';
      return (
        `${nom} sera retirée de la liste des personnes actives, mais restera conservée : ` +
        'vous pourrez la restaurer à tout moment depuis « Personnes archivées ». ' +
        'Aucune donnée n\'est supprimée.'
      );
    },
  },
  methods: {
    ...mapActions('personnes', ['ajouter', 'modifier', 'desactiver', 'reactiver']),
    libelleStatutPersonne,

    /**
     * Ordre d'affichage (présentation uniquement, `ordreAffichage` n'est pas
     * utilisé en 0004) : nom puis prénom, comparaison locale française.
     * @param {object} a
     * @param {object} b
     * @returns {number}
     */
    comparerPersonnes(a, b) {
      return a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr');
    },

    /**
     * Période de présence lisible, au format FR `JJ/MM/AAAA` (via
     * `dateUtil.formatDateFr`, aucun objet `Date` manipulé ici, KISS).
     * @param {{ dateEntree: ?string, dateSortie: ?string }} personne
     * @returns {string} Texte de période, ou chaîne vide si aucune date renseignée.
     */
    periodeTexte(personne) {
      const { dateEntree, dateSortie } = personne;
      const entree = dateUtil.formatDateFr(dateEntree);
      const sortie = dateUtil.formatDateFr(dateSortie);
      if (entree && sortie) return `du ${entree} au ${sortie}`;
      if (entree) return `depuis le ${entree}`;
      if (sortie) return `jusqu'au ${sortie}`;
      return '';
    },

    ouvrirAjout() {
      this.personneEnCours = null;
      this.formulaireVisible = true;
    },
    ouvrirEdition(personne) {
      this.personneEnCours = personne;
      this.formulaireVisible = true;
    },
    onEnregistrer(champs) {
      const estCreation = !this.personneEnCours;
      if (this.personneEnCours) {
        this.modifier({ id: this.personneEnCours.id, ...champs });
      } else {
        this.ajouter(champs);
      }
      this.formulaireVisible = false;
      this.personneEnCours = null;
      if (estCreation) {
        // Depuis l'état vide, le bouton « Ajouter une personne » qui a ouvert
        // la modale disparaît du DOM en même temps que l'état vide (la liste
        // n'est plus vide) : `ModaleBase` ne peut alors pas lui restaurer le
        // focus à la fermeture, qui retombe sur `<body>`. On le replace donc
        // nous-mêmes sur le bouton d'en-tête. Sans effet en édition : le
        // bouton « Modifier » déclencheur reste dans le DOM et `ModaleBase`
        // lui restaure normalement le focus (après le nôtre, donc prioritaire).
        this.$nextTick(() => this.$refs.boutonAjout?.focus());
      }
    },
    onAnnulerFormulaire() {
      this.formulaireVisible = false;
      this.personneEnCours = null;
    },

    demanderArchivage(personne) {
      this.personneAArchiver = personne;
      this.confirmationVisible = true;
    },
    onConfirmerArchivage() {
      this.desactiver(this.personneAArchiver.id);
      this.confirmationVisible = false;
      this.personneAArchiver = null;
      // Le bouton « Archiver » déclencheur disparaît du DOM (la personne
      // quitte la liste des actifs) : on replace le focus sur un point
      // stable plutôt que de le laisser retomber sur `<body>`.
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
    onAnnulerArchivage() {
      this.confirmationVisible = false;
      this.personneAArchiver = null;
    },

    restaurer(personne) {
      this.reactiver(personne.id);
      // Idem : si c'était la dernière personne archivée, toute la section
      // disparaît (`v-if="inactifs.length"`) et le bouton « Restaurer »
      // déclencheur avec elle.
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.equipe-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
}

.equipe-bouton-ajout {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

// Correctif ergonomie : icône + libellé mal centrés verticalement dans le
// bouton « Souhaits » (routeur-link, sans le `display: inline-flex` des
// boutons `<button>` classiques de cette liste).
.equipe-bouton-souhaits {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  line-height: 1;
}

.equipe-etat-vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: t.$espace-3;
  padding: t.$espace-6 t.$espace-4;
  margin-top: t.$espace-4;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.equipe-section {
  margin-bottom: t.$espace-5;
}

.equipe-titre-section {
  margin-bottom: t.$espace-3;
}

.equipe-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.equipe-ligne {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-3;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

// Présentation atténuée des personnes archivées (en plus du libellé et de la
// section dédiée, jamais la seule différence pour comprendre le statut).
.equipe-liste--archivee .equipe-ligne {
  background-color: t.$couleur-fond-clair;
  color: t.$couleur-texte-attenue;
}

.equipe-pastille {
  flex-shrink: 0;
  width: t.$espace-5;
  height: t.$espace-5;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
}

.equipe-identite {
  display: flex;
  flex-direction: column;
  flex: 1 1 12rem;
  min-width: 0;
}

.equipe-nom {
  font-weight: t.$graisse-gras;
}

.equipe-details {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.equipe-actions {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-2;
  margin-left: auto;
}

.equipe-bascule {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  padding: t.$espace-1 t.$espace-2;
  margin-left: -#{t.$espace-2};
  text-decoration: none;
  border-radius: t.$rayon-md;
  transition: background-color 0.15s ease-in-out;

  // Indice de cliquabilité renforcé (public peu à l'aise avec l'informatique) :
  // léger fond + soulignement au survol/focus, en plus du focus clavier
  // global (`:focus-visible`, voir `_base.scss`) et du chevron qui pivote.
  &:hover,
  &:focus-visible {
    text-decoration: underline;
    background-color: t.$couleur-fond-clair;
  }
}

.equipe-bascule-icone {
  transition: transform 0.15s ease-in-out;

  &--ouvert {
    transform: rotate(90deg);
  }
}

.equipe-texte-explication {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
