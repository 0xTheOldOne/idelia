<template>
  <div class="absences-view">
    <h1>Absences & congés</h1>

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

    <IndicateurSauvegarde
      :statut="statutSauvegarde"
      :derniere-sauvegarde="derniereSauvegarde"
      :apres-edition="aEdite"
    />

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

    <div v-if="personnesActives.length > 0" class="absences-entete">
      <button
        ref="boutonAjout"
        type="button"
        class="btn btn-primary absences-bouton-ajout"
        @click="ouvrirAjout"
      >
        <PhCalendarPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une absence</span>
      </button>
    </div>

    <div
      v-if="!aucuneAbsence"
      ref="groupeFiltre"
      class="absences-filtre"
      role="group"
      aria-label="Filtrer les absences par statut"
      tabindex="-1"
    >
      <button
        v-for="filtre in filtresStatut"
        :key="filtre.code"
        type="button"
        class="btn absences-bouton-filtre"
        :class="filtreStatut === filtre.code ? 'btn-primary' : 'btn-outline-secondary'"
        :aria-pressed="filtreStatut === filtre.code ? 'true' : 'false'"
        @click="filtreStatut = filtre.code"
      >
        {{ filtre.libelle }}
      </button>
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
      <p v-if="absencesAffichees.length === 0" class="absences-texte-explication">
        Aucune absence ne correspond à ce filtre.
      </p>

      <ul v-else class="absences-liste">
        <li v-for="absence in absencesAffichees" :key="absence.id" class="absences-ligne">
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
            <span class="absences-statut">
              <PhClock v-if="absence.statut === 'DEMANDE'" :size="16" aria-hidden="true" />
              <PhCheckCircle
                v-else-if="absence.statut === 'VALIDE'"
                :size="16"
                aria-hidden="true"
              />
              <PhXCircle v-else-if="absence.statut === 'REFUSE'" :size="16" aria-hidden="true" />
              <span>{{ libelleStatutAbsence(absence.statut) }}</span>
            </span>
          </div>
          <div class="absences-actions">
            <button
              type="button"
              class="btn btn-outline-secondary"
              :ref="(el) => setRefModifier(absence.id, el)"
              @click="ouvrirEdition(absence)"
            >
              <PhPencilSimple :size="18" aria-hidden="true" />
              <span>Modifier</span>
            </button>
            <template v-if="absence.statut === 'DEMANDE'">
              <button type="button" class="btn btn-outline-success" @click="onValider(absence)">
                <PhCheck :size="18" aria-hidden="true" />
                <span>Valider</span>
              </button>
              <button type="button" class="btn btn-outline-secondary" @click="onRefuser(absence)">
                <PhX :size="18" aria-hidden="true" />
                <span>Refuser</span>
              </button>
            </template>
            <button
              v-else
              type="button"
              class="btn btn-outline-secondary"
              @click="onRemettreEnDemande(absence)"
            >
              <PhArrowCounterClockwise :size="18" aria-hidden="true" />
              <span>Remettre en demande</span>
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
  PhClock,
  PhCheckCircle,
  PhXCircle,
  PhCheck,
  PhX,
  PhPencilSimple,
  PhArrowCounterClockwise,
  PhTrash,
} from '@phosphor-icons/vue';

import IndicateurSauvegarde from '@/components/communs/IndicateurSauvegarde.vue';
import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import FormulaireAbsence from '@/components/absences/FormulaireAbsence.vue';
import { libelleTypeAbsence, libelleStatutAbsence, libelleCreneau } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Écran « Absences & congés » (feature 0007) : liste **toutes** les absences
 * de l'équipe et **orchestre** leur cycle de vie (ajout, édition, décision,
 * suppression) via le store `absences`. Ne contient **aucune logique
 * métier** : la construction/normalisation d'une absence est déléguée au
 * domaine (`creerAbsence`, appelé par l'action `absences/ajouter`), les
 * libellés à `libelles.js`, les dates à `dateUtil` ; le tri et le filtre par
 * statut ne sont que des choix de présentation locaux à l'écran (calqué sur
 * `TourneesView`, feature 0006).
 */
export default {
  name: 'AbsencesView',
  components: {
    PhWarning,
    PhInfo,
    PhUsers,
    PhCalendarPlus,
    PhCalendarBlank,
    PhClock,
    PhCheckCircle,
    PhXCircle,
    PhCheck,
    PhX,
    PhPencilSimple,
    PhArrowCounterClockwise,
    PhTrash,
    IndicateurSauvegarde,
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
      // Filtre de présentation par statut (« En attente » aide à retrouver
      // les demandes à traiter) : purement local à l'écran, aucun getter.
      filtreStatut: 'TOUS',
      // Distingue une sauvegarde issue d'une vraie action utilisateur d'une
      // sauvegarde héritée de l'hydratation initiale (même logique
      // qu'EquipeView/TourneesView) : passé à `IndicateurSauvegarde`.
      aEdite: false,
      // Réfs des boutons « Modifier » de chaque ligne, keyées par id
      // d'absence : permet de retrouver l'élément DOM d'une ligne précise
      // après une transition de statut pour y replacer le focus (voir
      // `setRefModifier`/`focaliserApresDecision`), alors que `v-for` ne
      // permet pas de réf nommée classique. Objet simple (pas besoin de
      // réactivité, ce sont des éléments DOM).
      refsModifier: {},
      // Options du filtre par statut : codées en dur (libellés au pluriel
      // pour les statuts décidés, cohérents avec le workflow de filtrage)
      // plutôt que dérivées de `STATUTS_ABSENCE_OPTIONS` (singulier, prévu
      // pour l'affichage d'une absence isolée).
      filtresStatut: [
        { code: 'TOUS', libelle: 'Toutes' },
        { code: 'DEMANDE', libelle: 'En attente' },
        { code: 'VALIDE', libelle: 'Validées' },
        { code: 'REFUSE', libelle: 'Refusées' },
      ],
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
    ...mapState(['statutSauvegarde', 'derniereSauvegarde']),
    aucuneAbsence() {
      return this.items.length === 0;
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
    /** Absences triées puis restreintes au statut sélectionné par le filtre. */
    absencesAffichees() {
      if (this.filtreStatut === 'TOUS') return this.absencesTriees;
      return this.absencesTriees.filter((absence) => absence.statut === this.filtreStatut);
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
    ...mapActions('absences', ['ajouter', 'modifier', 'supprimer', 'valider', 'refuser', 'remettreEnDemande']),
    libelleTypeAbsence,
    libelleStatutAbsence,

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

    /**
     * Ref-fonction du bouton « Modifier » d'une ligne, keyée par id
     * d'absence (voir `refsModifier` en `data`). Appelée par Vue avec
     * `el = null` au démontage de la ligne (suppression, changement de
     * filtre) : on retire alors l'entrée pour ne jamais retenir une
     * référence DOM obsolète.
     * @param {string} id
     * @param {HTMLElement|null} el
     */
    setRefModifier(id, el) {
      if (el) {
        this.refsModifier[id] = el;
      } else {
        delete this.refsModifier[id];
      }
    },

    /**
     * Replace le focus après une transition de statut (Valider / Refuser /
     * Remettre en demande) : sur le bouton « Modifier » de la ligne
     * actionnée si elle est toujours visible sous le filtre courant (le
     * traitement des demandes à la chaîne reste fluide), sinon replie sur le
     * bouton d'ajout d'en-tête s'il est affiché, à défaut sur le groupe de
     * filtres (toujours présent dès qu'une absence existe). Attend le
     * prochain tick pour laisser le DOM se mettre à jour (filtre, ligne
     * potentiellement sortie de la vue).
     * @param {string} id - Identifiant de l'absence actionnée.
     */
    focaliserApresDecision(id) {
      this.$nextTick(() => {
        const toujoursVisible = this.absencesAffichees.some((a) => a.id === id);
        if (toujoursVisible && this.refsModifier[id]) {
          this.refsModifier[id].focus();
          return;
        }
        if (this.$refs.boutonAjout) {
          this.$refs.boutonAjout.focus();
          return;
        }
        this.$refs.groupeFiltre?.focus();
      });
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
      this.aEdite = true;
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

    /**
     * Transitions de statut : directes, sans confirmation (réversibles via
     * « Remettre en demande »). Les boutons de la ligne changent après
     * l'action : le focus est replacé sur le bouton « Modifier » de la même
     * ligne si elle reste visible sous le filtre courant (traitement des
     * demandes à la chaîne), sinon sur un point stable (voir
     * `focaliserApresDecision`).
     */
    onValider(absence) {
      this.valider(absence.id);
      this.aEdite = true;
      this.focaliserApresDecision(absence.id);
    },
    onRefuser(absence) {
      this.refuser(absence.id);
      this.aEdite = true;
      this.focaliserApresDecision(absence.id);
    },
    onRemettreEnDemande(absence) {
      this.remettreEnDemande(absence.id);
      this.aEdite = true;
      this.focaliserApresDecision(absence.id);
    },

    demanderSuppression(absence) {
      this.absenceASupprimer = absence;
      this.confirmationVisible = true;
    },
    onConfirmerSuppression() {
      this.supprimer(this.absenceASupprimer.id);
      this.aEdite = true;
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
  margin-top: t.$espace-4;
  margin-bottom: t.$espace-4;
}

.absences-bouton-ajout,
.absences-lien-equipe {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.absences-filtre {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-2;
  margin-bottom: t.$espace-4;
}

.absences-bouton-filtre {
  min-width: 6rem;
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

.absences-texte-explication {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
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

.absences-statut {
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
