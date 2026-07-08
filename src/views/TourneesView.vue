<template>
  <div class="tournees-view">
    <h1>Tournées</h1>

    <div
      v-if="statutSauvegarde === 'ERREUR_CHARGEMENT'"
      class="alert alert-warning d-flex gap-2"
      role="alert"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Les tournées enregistrées n'ont pas pu être relues ; la liste affichée peut être
        incomplète. Une copie de sauvegarde a été conservée. Rechargez la page pour réessayer ; si
        le problème persiste, réimportez une sauvegarde.
      </p>
    </div>

    <IndicateurSauvegarde
      :statut="statutSauvegarde"
      :derniere-sauvegarde="derniereSauvegarde"
      :apres-edition="aEdite"
    />

    <div class="tournees-entete">
      <button
        ref="boutonAjout"
        type="button"
        class="btn btn-primary tournees-bouton-ajout"
        @click="ouvrirAjout"
      >
        <PhPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une tournée</span>
      </button>
    </div>

    <div v-if="aucuneTournee" class="tournees-etat-vide">
      <PhMapTrifold :size="48" aria-hidden="true" />
      <p class="mb-0">
        Aucune tournée pour l'instant. Ajoutez la première pour organiser les circuits de soins.
      </p>
      <button type="button" class="btn btn-primary tournees-bouton-ajout" @click="ouvrirAjout">
        <PhPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une tournée</span>
      </button>
    </div>

    <template v-else>
      <section class="tournees-section">
        <h2 class="tournees-titre-section">Tournées actives</h2>

        <ul v-if="activesTries.length" class="tournees-liste">
          <li v-for="tournee in activesTries" :key="tournee.id" class="tournees-ligne">
            <span
              class="tournees-pastille"
              :style="{ backgroundColor: tournee.couleur }"
              aria-hidden="true"
            />
            <div class="tournees-identite">
              <span class="tournees-nom">
                {{ tournee.nom }}<template v-if="tournee.code"> ({{ tournee.code }})</template>
              </span>
              <span class="tournees-details">
                {{ creneauHoraireTexte(tournee) }} · {{ libelleJours(tournee.joursApplication) }}
              </span>
              <span class="tournees-details">
                {{ effectifTexte(tournee.nbPersonnesRequises) }}
                <template v-if="tournee.secteur"> · {{ tournee.secteur }}</template>
                <template v-if="periodeTexte(tournee)"> · {{ periodeTexte(tournee) }}</template>
              </span>
            </div>
            <div class="tournees-actions">
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="ouvrirEdition(tournee)"
              >
                <PhPencilSimple :size="18" aria-hidden="true" />
                <span>Modifier</span>
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary"
                @click="demanderArchivage(tournee)"
              >
                <PhArchive :size="18" aria-hidden="true" />
                <span>Archiver</span>
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="tournees-texte-explication">Aucune tournée active pour le moment.</p>
      </section>

      <section v-if="archivees.length" class="tournees-section">
        <h2 class="tournees-titre-section">
          <button
            type="button"
            class="btn btn-link tournees-bascule"
            :aria-expanded="archivesOuvertes ? 'true' : 'false'"
            aria-controls="tournees-liste-archivees"
            @click="archivesOuvertes = !archivesOuvertes"
          >
            <PhCaretRight
              :size="18"
              weight="bold"
              class="tournees-bascule-icone"
              :class="{ 'tournees-bascule-icone--ouvert': archivesOuvertes }"
              aria-hidden="true"
            />
            <span>Tournées archivées ({{ archivees.length }})</span>
          </button>
        </h2>

        <div v-show="archivesOuvertes" id="tournees-liste-archivees">
          <p class="tournees-texte-explication">
            Les tournées archivées sont conservées pour l'historique des plannings.
          </p>

          <ul class="tournees-liste tournees-liste--archivee">
            <li v-for="tournee in archiveesTries" :key="tournee.id" class="tournees-ligne">
              <span
                class="tournees-pastille"
                :style="{ backgroundColor: tournee.couleur }"
                aria-hidden="true"
              />
              <div class="tournees-identite">
                <span class="tournees-nom">
                  {{ tournee.nom }}<template v-if="tournee.code"> ({{ tournee.code }})</template>
                </span>
                <span class="tournees-details">
                  {{ creneauHoraireTexte(tournee) }} · {{ libelleJours(tournee.joursApplication) }}
                </span>
              </div>
              <div class="tournees-actions">
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="onRestaurer(tournee)"
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

    <FormulaireTournee
      :visible="formulaireVisible"
      :tournee="tourneeEnCours"
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
  PhPlus,
  PhMapTrifold,
  PhPencilSimple,
  PhArchive,
  PhArrowCounterClockwise,
  PhCaretRight,
} from '@phosphor-icons/vue';

import IndicateurSauvegarde from '@/components/communs/IndicateurSauvegarde.vue';
import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import FormulaireTournee from '@/components/tournees/FormulaireTournee.vue';
import { libelleCreneau, libelleJours } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Écran « Tournées » (feature 006) : liste les tournées du cabinet et
 * **orchestre** leur cycle de vie (ajout, édition, archivage, restauration)
 * via le store `tournees`. Ne contient **aucune logique métier** : la
 * construction/normalisation d'une tournée est déléguée au domaine
 * (`creerTournee`, appelé par l'action `tournees/ajouter`) ; le tri
 * alphabétique et les textes de présentation ne sont que des choix
 * d'affichage locaux à l'écran (calqué sur `EquipeView`, feature 004).
 */
export default {
  name: 'TourneesView',
  components: {
    PhWarning,
    PhPlus,
    PhMapTrifold,
    PhPencilSimple,
    PhArchive,
    PhArrowCounterClockwise,
    PhCaretRight,
    IndicateurSauvegarde,
    DialogueConfirmation,
    FormulaireTournee,
  },
  data() {
    return {
      // Pilotage de la modale d'ajout/édition (`tourneeEnCours = null` en
      // création, objet `Tournee` en édition).
      formulaireVisible: false,
      tourneeEnCours: null,
      // Pilotage de la confirmation d'archivage.
      confirmationVisible: false,
      tourneeAArchiver: null,
      // Section « Tournées archivées » repliée par défaut (bascule Vue
      // simple, sans JS `collapse` de Bootstrap).
      archivesOuvertes: false,
      // Distingue une sauvegarde issue d'une vraie action utilisateur d'une
      // sauvegarde héritée de l'hydratation initiale (même logique
      // qu'EquipeView/ParametresView) : passé à `IndicateurSauvegarde`.
      aEdite: false,
    };
  },
  computed: {
    ...mapGetters('tournees', ['actives', 'archivees']),
    ...mapGetters('cabinet', ['parametres']),
    ...mapState(['statutSauvegarde', 'derniereSauvegarde']),
    aucuneTournee() {
      return this.actives.length === 0 && this.archivees.length === 0;
    },
    activesTries() {
      return [...this.actives].sort(this.comparerTournees);
    },
    archiveesTries() {
      return [...this.archivees].sort(this.comparerTournees);
    },
    titreConfirmationArchivage() {
      const tournee = this.tourneeAArchiver;
      return tournee ? `Archiver ${tournee.nom} ?` : 'Archiver cette tournée ?';
    },
    messageConfirmationArchivage() {
      const tournee = this.tourneeAArchiver;
      const nom = tournee ? tournee.nom : 'Cette tournée';
      return (
        `${nom} sera retirée de la liste des tournées actives, mais restera conservée : ` +
        'vous pourrez la restaurer à tout moment depuis « Tournées archivées ». ' +
        "Aucune donnée n'est supprimée."
      );
    },
  },
  methods: {
    ...mapActions('tournees', ['ajouter', 'modifier', 'archiver', 'restaurer']),
    libelleJours,

    /**
     * Ordre d'affichage (présentation uniquement, `ordreAffichage` n'est pas
     * utilisé en 006) : tri alphabétique du nom, comparaison locale française.
     * @param {object} a
     * @param {object} b
     * @returns {number}
     */
    comparerTournees(a, b) {
      return a.nom.localeCompare(b.nom, 'fr');
    },

    /**
     * Créneau et horaires en clair (« Matin · 08:00 – 12:00 »), sans
     * manipulation d'objet `Date` : les heures sont déjà des chaînes `"HH:mm"`.
     * @param {{ creneau: string, heureDebut: string, heureFin: string }} tournee
     * @returns {string}
     */
    creneauHoraireTexte(tournee) {
      return `${libelleCreneau(tournee.creneau)} · ${tournee.heureDebut} – ${tournee.heureFin}`;
    },

    /**
     * Effectif requis en toutes lettres, avec accord singulier/pluriel
     * (« 1 personne requise » / « 2 personnes requises »).
     * @param {number} nbPersonnesRequises
     * @returns {string}
     */
    effectifTexte(nbPersonnesRequises) {
      const pluriel = nbPersonnesRequises > 1 ? 's' : '';
      return `${nbPersonnesRequises} personne${pluriel} requise${pluriel}`;
    },

    /**
     * Période de validité lisible, au format FR `JJ/MM/AAAA` (via
     * `dateUtil.formatDateFr`, aucun objet `Date` manipulé ici, KISS).
     * @param {{ dateDebutValidite: ?string, dateFinValidite: ?string }} tournee
     * @returns {string} Texte de période, ou chaîne vide si aucune date renseignée.
     */
    periodeTexte(tournee) {
      const { dateDebutValidite, dateFinValidite } = tournee;
      const debut = dateUtil.formatDateFr(dateDebutValidite);
      const fin = dateUtil.formatDateFr(dateFinValidite);
      if (debut && fin) return `du ${debut} au ${fin}`;
      if (debut) return `à partir du ${debut}`;
      if (fin) return `jusqu'au ${fin}`;
      return '';
    },

    ouvrirAjout() {
      this.tourneeEnCours = null;
      this.formulaireVisible = true;
    },
    ouvrirEdition(tournee) {
      this.tourneeEnCours = tournee;
      this.formulaireVisible = true;
    },
    onEnregistrer(champs) {
      const estCreation = !this.tourneeEnCours;
      if (this.tourneeEnCours) {
        this.modifier({ id: this.tourneeEnCours.id, ...champs });
      } else {
        this.ajouter(champs);
      }
      this.aEdite = true;
      this.formulaireVisible = false;
      this.tourneeEnCours = null;
      if (estCreation) {
        // Depuis l'état vide, le bouton « Ajouter une tournée » qui a ouvert
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
      this.tourneeEnCours = null;
    },

    demanderArchivage(tournee) {
      this.tourneeAArchiver = tournee;
      this.confirmationVisible = true;
    },
    onConfirmerArchivage() {
      this.archiver(this.tourneeAArchiver.id);
      this.aEdite = true;
      this.confirmationVisible = false;
      this.tourneeAArchiver = null;
      // Le bouton « Archiver » déclencheur disparaît du DOM (la tournée
      // quitte la liste des actives) : on replace le focus sur un point
      // stable plutôt que de le laisser retomber sur `<body>`.
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
    onAnnulerArchivage() {
      this.confirmationVisible = false;
      this.tourneeAArchiver = null;
    },

    /**
     * Restaure une tournée archivée : action sûre, non destructive, jamais
     * confirmée (contrairement à l'archivage). Nommée `onRestaurer` (et non
     * `restaurer`) pour ne pas entrer en conflit avec l'action Vuex du même
     * nom (`tournees/restaurer`) importée ci-dessus via `mapActions`.
     * @param {{ id: string }} tournee
     */
    onRestaurer(tournee) {
      this.restaurer(tournee.id);
      this.aEdite = true;
      // Idem qu'à l'archivage : si c'était la dernière tournée archivée,
      // toute la section disparaît (`v-if="archivees.length"`) et le bouton
      // « Restaurer » déclencheur avec elle.
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.tournees-entete {
  margin-bottom: t.$espace-4;
}

.tournees-bouton-ajout {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.tournees-etat-vide {
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

.tournees-section {
  margin-bottom: t.$espace-5;
}

.tournees-titre-section {
  margin-bottom: t.$espace-3;
}

.tournees-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.tournees-ligne {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-3;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

// Présentation atténuée des tournées archivées (en plus du libellé et de la
// section dédiée, jamais la seule différence pour comprendre le statut).
.tournees-liste--archivee .tournees-ligne {
  background-color: t.$couleur-fond-clair;
  color: t.$couleur-texte-attenue;
}

.tournees-pastille {
  flex-shrink: 0;
  width: t.$espace-5;
  height: t.$espace-5;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
}

.tournees-identite {
  display: flex;
  flex-direction: column;
  flex: 1 1 16rem;
  min-width: 0;
}

.tournees-nom {
  font-weight: t.$graisse-gras;
}

.tournees-details {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.tournees-actions {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-2;
  margin-left: auto;
}

.tournees-bascule {
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

.tournees-bascule-icone {
  transition: transform 0.15s ease-in-out;

  &--ouvert {
    transform: rotate(90deg);
  }
}

.tournees-texte-explication {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
