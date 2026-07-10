<template>
  <div class="absences-view">
    <div
      v-if="statutSauvegarde === 'ERREUR_CHARGEMENT'"
      class="alert alert-warning d-flex gap-2"
      role="alert"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Les absences enregistrées n'ont pas pu être relues ; la liste affichée peut être
        incomplète. Une copie de sauvegarde a été conservée. Rechargez la page pour réessayer ; si
        le problème persiste, réimportez une sauvegarde.
      </p>
    </div>

    <div class="absences-entete">
      <h1>Absences & congés</h1>
      <button
        v-if="personnesActives.length > 0"
        ref="boutonAjout"
        type="button"
        class="btn btn-primary absences-bouton-ajout"
        @click="ouvrirAjout"
      >
        <PhCalendarPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une absence</span>
      </button>
    </div>

    <div v-if="personnesActives.length === 0" class="alert alert-info absences-aucune-personne">
      <PhInfo :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <div>
        <p v-if="totalPersonnes === 0" class="mb-2">
          Ajoutez d'abord des personnes à votre équipe pour enregistrer leurs absences.
        </p>
        <p v-else class="mb-2">
          Aucune personne active : réactivez une personne depuis l'Équipe (ou ajoutez-en une)
          pour enregistrer ses absences.
        </p>
        <router-link class="btn btn-primary absences-lien-equipe" :to="{ name: 'equipe' }">
          <PhUsers :size="18" aria-hidden="true" />
          <span>Aller à l'équipe</span>
        </router-link>
      </div>
    </div>

    <div v-if="aucuneAbsence && personnesActives.length > 0" class="absences-etat-vide">
      <PhCalendarBlank :size="48" aria-hidden="true" />
      <p class="mb-0">
        Aucune absence enregistrée. Ajoutez la première pour tenir compte des congés et arrêts
        dans les plannings.
      </p>
      <button type="button" class="btn btn-primary absences-bouton-ajout" @click="ouvrirAjout">
        <PhCalendarPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une absence</span>
      </button>
    </div>

    <template v-else-if="!aucuneAbsence">
      <ul class="absences-liste">
        <li v-for="absence in absencesTriees" :key="absence.id" class="absences-ligne">
          <span
            class="absences-pastille"
            :style="{ backgroundColor: personneAffichage(absence).couleur }"
            aria-hidden="true"
          />
          <div class="absences-identite">
            <span class="absences-nom">
              {{ personneAffichage(absence).nom
              }}<template v-if="personneAffichage(absence).archivee"> (archivée)</template>
            </span>
            <span class="absences-details">
              {{ libelleTypeAbsence(absence.type) }} · {{ periodeTexte(absence)
              }}<template v-if="creneauTexte(absence)"> · {{ creneauTexte(absence) }}</template>
            </span>
            <span class="absences-etat">
              <PhClock
                v-if="etatTemporelAbsence(absence, aujourdhui) === 'A_VENIR'"
                :size="16"
                aria-hidden="true"
              />
              <PhCalendarCheck
                v-else-if="etatTemporelAbsence(absence, aujourdhui) === 'EN_COURS'"
                :size="16"
                aria-hidden="true"
              />
              <PhClockCounterClockwise v-else :size="16" aria-hidden="true" />
              <span>{{ libelleEtatTemporelAbsence(etatTemporelAbsence(absence, aujourdhui)) }}</span>
            </span>
          </div>
          <div class="absences-actions">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="ouvrirEdition(absence)"
            >
              <PhPencilSimple :size="18" aria-hidden="true" />
              <span>Modifier</span>
            </button>
            <button
              type="button"
              class="btn btn-outline-danger"
              @click="demanderSuppression(absence)"
            >
              <PhTrash :size="18" aria-hidden="true" />
              <span>Supprimer</span>
            </button>
          </div>
        </li>
      </ul>
    </template>

    <FormulaireAbsence
      :visible="formulaireVisible"
      :absence="absenceEnCours"
      :personnes="personnesSelectionnables"
      :absences-existantes="items"
      @enregistrer="onEnregistrer"
      @annuler="onAnnulerFormulaire"
    />

    <DialogueConfirmation
      :visible="confirmationVisible"
      titre="Supprimer cette absence ?"
      :message="messageConfirmationSuppression"
      libelle-confirmer="Supprimer"
      variante-confirmer="danger"
      @confirmer="onConfirmerSuppression"
      @annuler="onAnnulerSuppression"
    />
  </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex';
import {
  PhWarning,
  PhInfo,
  PhUsers,
  PhCalendarPlus,
  PhCalendarBlank,
  PhPencilSimple,
  PhTrash,
  PhClock,
  PhCalendarCheck,
  PhClockCounterClockwise,
} from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import FormulaireAbsence from '@/components/absences/FormulaireAbsence.vue';
import { libelleTypeAbsence, libelleCreneau, libelleEtatTemporelAbsence } from '@/domain/libelles.js';
import { etatTemporelAbsence } from '@/domain/absences.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Écran « Absences & congés » (feature 0007, simplifié en 0017) : liste
 * **toutes** les absences de l'équipe et **orchestre** leur cycle de vie
 * (ajout, édition, suppression) via le store `absences`. Saisie directe sans
 * workflow de validation ([ADR 0014], feature 0017) : une absence enregistrée
 * est effective immédiatement. Ne contient **aucune logique métier** : la
 * construction/normalisation d'une absence est déléguée au domaine
 * (`creerAbsence`, appelé par l'action `absences/ajouter`), les libellés à
 * `libelles.js`, les dates à `dateUtil` ; le tri est un choix de présentation
 * local à l'écran (calqué sur `TourneesView`, feature 0006).
 */
export default {
  name: 'AbsencesView',
  components: {
    PhWarning,
    PhInfo,
    PhUsers,
    PhCalendarPlus,
    PhCalendarBlank,
    PhPencilSimple,
    PhTrash,
    PhClock,
    PhCalendarCheck,
    PhClockCounterClockwise,
    DialogueConfirmation,
    FormulaireAbsence,
  },
  data() {
    return {
      // Pilotage de la modale d'ajout/édition (`absenceEnCours = null` en
      // création, objet `Absence` en édition).
      formulaireVisible: false,
      absenceEnCours: null,
      // Pilotage de la confirmation de suppression.
      confirmationVisible: false,
      absenceASupprimer: null,
    };
  },
  computed: {
    ...mapState('absences', ['items']),
    ...mapGetters('personnes', { personnesActives: 'actifs', personneById: 'byId' }),
    // Nombre total de personnes (actives + archivées), pour distinguer
    // « équipe vide » d'« équipe entièrement archivée » dans le message
    // d'absence de personne active (aucun getter dédié n'existe côté store,
    // lecture seule directe de `items`, jamais de mutation).
    ...mapState('personnes', { totalPersonnes: (state) => state.items.length }),
    ...mapState(['statutSauvegarde']),
    aucuneAbsence() {
      return this.items.length === 0;
    },
    /**
     * Date du jour `"YYYY-MM-DD"`, seul point d'accès à `Date` de cet écran
     * (ADR 0010), injectée au helper pur `etatTemporelAbsence` pour situer
     * chaque absence dans le temps (« À venir » / « En cours » / « Passée »).
     */
    aujourdhui() {
      return dateUtil.format(new Date());
    },
    /**
     * Tri de présentation : date de début décroissante (les absences les
     * plus récentes/à venir en tête), départagé par date de création
     * décroissante. Comparaison de chaînes uniquement (aucun objet `Date`).
     * Travaille sur une copie : ne mute jamais `items`.
     */
    absencesTriees() {
      return [...this.items].sort(
        (a, b) => b.dateDebut.localeCompare(a.dateDebut) || b.createdAt.localeCompare(a.createdAt)
      );
    },
    /**
     * Personnes proposées au sélecteur du formulaire : les personnes
     * actives, complétées — en édition seulement — par la personne de
     * l'absence en cours si elle a depuis été archivée (pour ne pas casser
     * la modification d'une absence rattachée à une personne archivée).
     */
    personnesSelectionnables() {
      const actives = this.personnesActives;
      if (!this.absenceEnCours) return actives;
      const personne = this.personneById(this.absenceEnCours.personneId);
      const dejaPresente = personne && actives.some((p) => p.id === personne.id);
      return personne && !dejaPresente ? [...actives, personne] : actives;
    },
    messageConfirmationSuppression() {
      const absence = this.absenceASupprimer;
      if (!absence) {
        return 'Cette absence sera définitivement supprimée et ne sera pas conservée.';
      }
      const info = this.personneAffichage(absence);
      return (
        `L'absence de ${info.nom} (${this.libelleTypeAbsence(absence.type)}, ` +
        `${this.periodeTexte(absence)}) sera définitivement supprimée et ne sera pas conservée.`
      );
    },
  },
  methods: {
    ...mapActions('absences', ['ajouter', 'modifier', 'supprimer']),
    libelleTypeAbsence,
    libelleEtatTemporelAbsence,
    etatTemporelAbsence,

    /**
     * Créneau en clair, masqué s'il s'agit de la journée entière (§6.3) :
     * une absence « Journée entière » n'affiche pas de créneau.
     * @param {{ creneau: string }} absence
     * @returns {string}
     */
    creneauTexte(absence) {
      return absence.creneau !== 'JOURNEE' ? libelleCreneau(absence.creneau) : '';
    },

    /**
     * Période lisible : « du {début} au {fin} », ou « le {date} » si la
     * date de début et de fin sont identiques (absence d'un seul jour).
     * Aucun objet `Date` manipulé : formatage via `dateUtil.formatDateFr`.
     * @param {{ dateDebut: string, dateFin: string }} absence
     * @returns {string}
     */
    periodeTexte(absence) {
      const debut = dateUtil.formatDateFr(absence.dateDebut);
      const fin = dateUtil.formatDateFr(absence.dateFin);
      if (absence.dateDebut === absence.dateFin) return `le ${debut}`;
      return `du ${debut} au ${fin}`;
    },

    /**
     * Résout la personne d'une absence pour l'affichage (pastille + nom),
     * y compris une personne depuis archivée (`personnes/byId` cherche dans
     * toute la collection, actives et archivées confondues). Si la personne
     * est introuvable (ne devrait pas arriver, intégrité garantie), affiche
     * « Personne inconnue » plutôt que de faire échouer le rendu.
     * @param {{ personneId: string }} absence
     * @returns {{ nom: string, couleur: string, archivee: boolean }}
     */
    personneAffichage(absence) {
      const personne = this.personneById(absence.personneId);
      if (!personne) {
        return { nom: 'Personne inconnue', couleur: 'transparent', archivee: false };
      }
      return {
        nom: `${personne.prenom} ${personne.nom}`,
        couleur: personne.couleur,
        archivee: !personne.actif,
      };
    },

    ouvrirAjout() {
      this.absenceEnCours = null;
      this.formulaireVisible = true;
    },
    ouvrirEdition(absence) {
      this.absenceEnCours = absence;
      this.formulaireVisible = true;
    },
    onEnregistrer(champs) {
      const estCreation = !this.absenceEnCours;
      if (this.absenceEnCours) {
        this.modifier({ id: this.absenceEnCours.id, ...champs });
      } else {
        this.ajouter(champs);
      }
      this.formulaireVisible = false;
      this.absenceEnCours = null;
      if (estCreation) {
        // Depuis l'état vide, le bouton « Ajouter une absence » qui a ouvert
        // la modale peut disparaître du DOM en même temps que l'état vide
        // (la liste n'est plus vide) : `ModaleBase` ne peut alors pas lui
        // restaurer le focus, qui retomberait sur `<body>`. On le replace
        // donc nous-mêmes sur le bouton d'en-tête (toujours présent).
        this.$nextTick(() => this.$refs.boutonAjout?.focus());
      }
    },
    onAnnulerFormulaire() {
      this.formulaireVisible = false;
      this.absenceEnCours = null;
    },

    demanderSuppression(absence) {
      this.absenceASupprimer = absence;
      this.confirmationVisible = true;
    },
    onConfirmerSuppression() {
      this.supprimer(this.absenceASupprimer.id);
      this.confirmationVisible = false;
      this.absenceASupprimer = null;
      // Le bouton « Supprimer » déclencheur disparaît du DOM (la ligne
      // quitte la liste) : on replace le focus sur un point stable plutôt
      // que de le laisser retomber sur `<body>`.
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
    onAnnulerSuppression() {
      this.confirmationVisible = false;
      this.absenceASupprimer = null;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.absences-aucune-personne {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-3;
}

.absences-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
}

.absences-bouton-ajout,
.absences-lien-equipe {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.absences-etat-vide {
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

.absences-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.absences-ligne {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-3;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

.absences-pastille {
  flex-shrink: 0;
  width: t.$espace-5;
  height: t.$espace-5;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
}

.absences-identite {
  display: flex;
  flex-direction: column;
  flex: 1 1 16rem;
  min-width: 0;
  gap: t.$espace-1;
}

.absences-nom {
  font-weight: t.$graisse-gras;
}

.absences-details {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.absences-etat {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
}

.absences-actions {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-2;
  margin-left: auto;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
