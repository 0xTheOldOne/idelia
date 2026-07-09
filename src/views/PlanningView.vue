<template>
  <div class="planning-view">
    <h1>Planning</h1>

    <IndicateurSauvegarde
      :statut="statutSauvegarde"
      :derniere-sauvegarde="derniereSauvegarde"
      :apres-edition="aEdite"
    />

    <div v-if="personnesActives.length === 0" class="alert alert-info planning-etat-vide">
      <PhInfo :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <div>
        <p v-if="totalPersonnes === 0" class="mb-2">
          Ajoutez d'abord des personnes à votre équipe pour pouvoir générer un planning.
        </p>
        <p v-else class="mb-2">
          Aucune personne active : réactivez une personne depuis l'Équipe (ou ajoutez-en une) pour
          pouvoir générer un planning.
        </p>
        <router-link class="btn btn-primary planning-lien-etat-vide" :to="{ name: 'equipe' }">
          <PhUsers :size="18" aria-hidden="true" />
          <span>Aller à l'équipe</span>
        </router-link>
      </div>
    </div>

    <div v-if="tourneesActives.length === 0" class="alert alert-info planning-etat-vide">
      <PhInfo :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <div>
        <p v-if="totalTournees === 0" class="mb-2">
          Créez d'abord au moins une tournée pour pouvoir générer un planning.
        </p>
        <p v-else class="mb-2">
          Aucune tournée active : réactivez une tournée depuis les Tournées (ou créez-en une) pour
          pouvoir générer un planning.
        </p>
        <router-link class="btn btn-primary planning-lien-etat-vide" :to="{ name: 'tournees' }">
          <PhPath :size="18" aria-hidden="true" />
          <span>Aller aux tournées</span>
        </router-link>
      </div>
    </div>

    <template v-if="peutGenerer">
      <FormulaireGeneration :chargement="chargement" @generer="onGenerer" />

      <div v-if="erreurGeneration" class="alert alert-danger planning-erreur-generation" role="alert">
        <PhWarningOctagon :size="20" weight="bold" class="flex-shrink-0" aria-hidden="true" />
        <span>{{ erreurGeneration }}</span>
      </div>

      <p v-if="!planningCourant" class="planning-zone-resultat-attente">
        La proposition s'affichera ici après avoir cliqué sur « Générer le planning ».
      </p>
    </template>

    <p class="planning-annonce-invisible" role="status" aria-live="polite">{{ messageAnnonce }}</p>

    <div v-if="planningCourant" class="planning-resultat">
      <div class="planning-resultat-entete">
        <h2 ref="titrePlanning" tabindex="-1" class="planning-resultat-titre">
          {{ planningCourant.nom }}
        </h2>
        <span v-if="modeEdition" class="planning-badge-edition">
          <PhPencilSimple :size="16" weight="bold" aria-hidden="true" />
          <span>Mode modification — affichage par tournées</span>
        </span>
      </div>

      <div class="planning-barre-actions" role="group" aria-label="Actions du planning">
        <button
          ref="boutonBasculerEdition"
          type="button"
          class="btn btn-outline-primary"
          :aria-pressed="modeEdition ? 'true' : 'false'"
          @click="onBasculerEdition"
        >
          <PhCheck v-if="modeEdition" :size="18" aria-hidden="true" />
          <PhPencilSimple v-else :size="18" aria-hidden="true" />
          <span>{{ modeEdition ? 'Terminer la modification' : 'Modifier le planning' }}</span>
        </button>

        <button
          type="button"
          class="btn btn-outline-secondary"
          :disabled="!peutAnnuler"
          :title="!peutAnnuler ? 'Aucune action à annuler pour l\'instant.' : null"
          @click="onAnnuler"
        >
          <PhArrowCounterClockwise :size="18" aria-hidden="true" />
          <span>Annuler la dernière action</span>
        </button>

        <button
          type="button"
          class="btn btn-outline-secondary"
          :disabled="chargement"
          title="Repropose la même répartition en conservant les affectations verrouillées."
          @click="demanderRegeneration(false)"
        >
          <PhArrowsClockwise :size="18" aria-hidden="true" />
          <span>{{ regenerationEnCours === 'IDENTIQUE' ? 'Régénération en cours…' : "Regénérer à l'identique" }}</span>
        </button>

        <button
          type="button"
          class="btn btn-outline-secondary"
          :disabled="chargement"
          title="Propose une autre répartition en conservant les affectations verrouillées."
          @click="demanderRegeneration(true)"
        >
          <PhShuffle :size="18" aria-hidden="true" />
          <span>{{ regenerationEnCours === 'VARIANTE' ? 'Régénération en cours…' : 'Essayer une variante' }}</span>
        </button>
      </div>

      <ControlesGrille
        :orientation="orientation"
        :echelle="echelle"
        :date-reference="dateReference"
        :echelle-contexte="{ dateDebutPlanning: planningCourant.dateDebut }"
        @update:orientation="orientation = $event"
        @update:echelle="echelle = $event"
        @update:dateReference="dateReference = $event"
      />

      <p v-if="modeEdition && orientation === 'PERSONNES'" class="alert alert-info planning-message-orientation">
        <PhInfo :size="18" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <span>
          Pour modifier le planning, affichez-le par « Tournées ». En affichage « Personnes », le
          planning reste en lecture seule.
        </span>
      </p>

      <GrillePlanning
        :planning="planningCourant"
        :orientation="orientation"
        :echelle="echelle"
        :date-reference="dateReference"
        :violations="diagnostics.violations"
        :tournees-non-couvertes="diagnostics.tourneesNonCouvertes"
        :editable="modeEdition"
        @ajouter="onAjouter"
        @retirer="onRetirer"
        @verrouiller="onVerrouiller"
        @deplacer="onDeplacer"
      />

      <PanneauConflits
        :violations="diagnostics.violations"
        :tournees-non-couvertes="diagnostics.tourneesNonCouvertes"
      />
    </div>

    <SelecteurPersonne
      v-if="planningCourant"
      :visible="selecteurVisible"
      :tournee-id="slotSelection?.tourneeId"
      :tournee-nom="slotSelection?.tourneeNom"
      :date="slotSelection?.date"
      :creneau="slotSelection?.creneau"
      :affectations="planningCourant.affectations"
      @choisir="onChoisirPersonne"
      @annuler="onFermerSelecteur"
    />

    <DialogueConfirmation
      :visible="confirmationRegenerationVisible"
      titre="Regénérer le planning ?"
      message="Cela remplacera les affectations actuelles. Les affectations verrouillées seront conservées. Vous pourrez annuler cette action."
      libelle-confirmer="Regénérer"
      variante-confirmer="primary"
      @confirmer="onConfirmerRegeneration"
      @annuler="onAnnulerRegeneration"
    />
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions, mapMutations } from 'vuex';
import {
  PhInfo,
  PhUsers,
  PhPath,
  PhWarningOctagon,
  PhArrowCounterClockwise,
  PhPencilSimple,
  PhCheck,
  PhArrowsClockwise,
  PhShuffle,
} from '@phosphor-icons/vue';

import IndicateurSauvegarde from '@/components/communs/IndicateurSauvegarde.vue';
import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import FormulaireGeneration from '@/components/planning/FormulaireGeneration.vue';
import ControlesGrille from '@/components/planning/ControlesGrille.vue';
import GrillePlanning from '@/components/planning/GrillePlanning.vue';
import PanneauConflits from '@/components/planning/PanneauConflits.vue';
import SelecteurPersonne from '@/components/planning/SelecteurPersonne.vue';

/**
 * Écran « Planning » (feature 010) : orchestre le choix d'une période, le
 * déclenchement d'une génération et l'affichage du planning courant (grille
 * + panneau de conflits), via le store `plannings`. Ne contient **aucune
 * logique métier** : l'appel au moteur pur passe exclusivement par les
 * actions du store (ADR 0008).
 *
 * Détient l'état d'affichage (`orientation`, `echelle`, `dateReference`) et
 * l'état volatil des diagnostics (`{ violations, tourneesNonCouvertes,
 * score }`) : ni l'un ni l'autre n'est jamais persisté (02 : « les
 * diagnostics ne sont jamais stockés »). Au montage, `selectionId` n'étant
 * pas persisté, la vue auto-sélectionne le planning le plus récent si
 * aucune sélection n'existe (§4.4) puis recalcule les diagnostics via
 * `evaluerCourant` (le `Resultat` volatil d'une éventuelle génération
 * précédente a disparu au rechargement).
 *
 * Barre d'actions du planning (feature 011) : porte le bouton « Annuler la
 * dernière action » (tâche 2, undo 1-niveau, sans redo), désactivé quand
 * `plannings/peutAnnuler` est `false`, et la bascule « Modifier le
 * planning »/« Terminer la modification » (tâche 3) qui pilote `modeEdition`.
 *
 * Édition (tâche 3) : entrer en mode édition **force l'orientation
 * `TOURNEES`** (§6.1 — seule orientation où une case a un créneau propre).
 * `GrillePlanning` reste en lecture seule si l'utilisateur bascule ensuite
 * sur « Personnes » ; un message discret l'invite alors à revenir sur
 * « Tournées » pour continuer à modifier. Sur `@ajouter` (case cliquée),
 * la vue mémorise le slot ciblé (`slotSelection`) et ouvre `SelecteurPersonne` ;
 * sur `choisir`, elle dispatche `plannings/ajouterAffectation` ; sur
 * `@retirer`, elle dispatche `plannings/retirerAffectation` ; sur
 * `@verrouiller` (bouton cadenas d'un élément, tâche 4), elle dispatche
 * `plannings/basculerVerrouillage`. Sur `@deplacer` (glisser-déposer natif,
 * tâche 5 — surcouche de confort, jamais l'unique moyen), dispatche
 * `plannings/deplacerAffectation`. Chaque geste rafraîchit ensuite les
 * diagnostics (`rafraichirDiagnostics`) et annonce le résultat (région
 * `aria-live`).
 *
 * Régénération en place (tâche 6) : « Regénérer à l'identique » et « Essayer
 * une variante » dispatchent `plannings/regenerer` (même `id` de planning,
 * jamais un nouveau `Planning`), précédé d'une confirmation
 * (`DialogueConfirmation`) **uniquement** s'il existe un ajustement manuel
 * non verrouillé qui serait perdu (`aAjustementNonVerrouillePerdu`) ; sinon
 * la régénération est directe. Alimente les diagnostics volatils depuis le
 * `Resultat` retourné (pas de second passage moteur), avec le même pattern de
 * chargement que `onGenerer` (bascule + `$nextTick`, `chargement` toujours
 * remis à `false` en `finally`).
 */
export default {
  name: 'PlanningView',
  components: {
    PhInfo,
    PhUsers,
    PhPath,
    PhWarningOctagon,
    PhArrowCounterClockwise,
    PhPencilSimple,
    PhCheck,
    PhArrowsClockwise,
    PhShuffle,
    IndicateurSauvegarde,
    DialogueConfirmation,
    FormulaireGeneration,
    ControlesGrille,
    GrillePlanning,
    PanneauConflits,
    SelecteurPersonne,
  },
  data() {
    return {
      // `true` pendant l'appel au moteur (bascule le libellé du bouton).
      chargement: false,
      // Diagnostics volatils du planning courant (`{ violations,
      // tourneesNonCouvertes, score }`), issus soit du `Resultat` d'une
      // génération fraîche, soit de `evaluerCourant` (montage/rechargement).
      // Jamais persisté (02 : « les diagnostics ne sont jamais stockés »).
      diagnostics: { violations: [], tourneesNonCouvertes: [], score: 0 },
      // Réglages d'affichage de la grille : ne modifient jamais les données,
      // purement volatils (§4.4).
      orientation: 'TOURNEES',
      echelle: 'SEMAINE',
      dateReference: '',
      // Distingue une sauvegarde issue d'une vraie action utilisateur d'une
      // sauvegarde héritée de l'hydratation initiale (même logique
      // qu'AbsencesView/TourneesView) : passé à `IndicateurSauvegarde`.
      aEdite: false,
      // Message d'erreur affiché (alerte) si la génération échoue ; vide sinon.
      // Remis à vide au début de chaque nouvelle tentative.
      erreurGeneration: '',
      // Texte annoncé par la région `aria-live` après une génération
      // (succès ou échec), pour les technologies d'assistance.
      messageAnnonce: '',
      // Bascule lecture/édition (feature 011, tâche 3) : purement volatil,
      // jamais persisté (§4.7).
      modeEdition: false,
      // Visibilité du sélecteur de personne (modale).
      selecteurVisible: false,
      // Slot mémorisé (case cliquée) en attente d'un choix dans le
      // sélecteur : `{ tourneeId, tourneeNom, date, creneau } | null`.
      slotSelection: null,
      // Visibilité de la confirmation de régénération (tâche 6),
      // demandée uniquement quand un ajustement manuel non verrouillé
      // serait perdu (§8).
      confirmationRegenerationVisible: false,
      // Mémorise le mode de régénération (`true` = variante) en attente
      // d'une confirmation explicite, pour l'appliquer une fois confirmé.
      varianteEnAttente: false,
      // `null` hors régénération ; `'IDENTIQUE'` ou `'VARIANTE'` pendant
      // l'exécution de `executerRegeneration`, pour afficher un libellé actif
      // sur le bon bouton (correctif ergonomie MIN-3/MIN-4, feature 011).
      regenerationEnCours: null,
    };
  },
  computed: {
    ...mapGetters('personnes', { personnesActives: 'actifs' }),
    ...mapGetters('tournees', { tourneesActives: 'actives', tourneeParId: 'byId' }),
    ...mapGetters('plannings', { planningCourant: 'courant', peutAnnuler: 'peutAnnuler' }),
    // Nombre total de personnes/tournées (actives + archivées), pour
    // distinguer « aucune donnée du tout » d'« entièrement archivée » dans
    // le message d'état vide (calqué sur AbsencesView).
    ...mapState('personnes', { totalPersonnes: (state) => state.items.length }),
    ...mapState('tournees', { totalTournees: (state) => state.items.length }),
    ...mapState('plannings', { planningsExistants: (state) => state.items }),
    ...mapState(['statutSauvegarde', 'derniereSauvegarde']),
    /** Le formulaire de génération n'est utile que si les deux ingrédients indispensables existent. */
    peutGenerer() {
      return this.personnesActives.length > 0 && this.tourneesActives.length > 0;
    },
    /**
     * `true` s'il existe au moins un ajustement manuel non verrouillé
     * (`origine: 'MANUEL' && !verrouillee`) sur le planning courant : une
     * régénération le remplacerait, d'où la confirmation (§8). Un planning
     * encore « brut » (aucun ajustement de ce type) se régénère sans
     * friction.
     * @returns {boolean}
     */
    aAjustementNonVerrouillePerdu() {
      if (!this.planningCourant) return false;
      return this.planningCourant.affectations.some((a) => a.origine === 'MANUEL' && !a.verrouillee);
    },
  },
  methods: {
    ...mapActions('plannings', [
      'genererPropose',
      'evaluerCourant',
      'annulerDerniereEdition',
      'ajouterAffectation',
      'retirerAffectation',
      'basculerVerrouillage',
      'deplacerAffectation',
      'regenerer',
    ]),
    ...mapMutations('plannings', ['SELECT']),

    /**
     * Bascule le mode édition. En entrant en édition, force l'orientation
     * `TOURNEES` (§6.1 : seule orientation où une case a un créneau propre,
     * modèle mental unique pour le sélecteur de personne). Annonce l'entrée/
     * sortie du mode via la région `aria-live` (correctif ergonomie MAJ-1,
     * feature 011) : le repère visuel persistant est le badge « Mode
     * modification » (MIN-1), affiché près du titre du planning.
     */
    onBasculerEdition() {
      this.modeEdition = !this.modeEdition;
      if (this.modeEdition) {
        this.orientation = 'TOURNEES';
        this.messageAnnonce = 'Mode modification activé, affichage par tournées.';
      } else {
        this.messageAnnonce = 'Mode modification terminé.';
      }
    },

    /**
     * Réagit au clic sur « Ajouter une personne » d'une case (événement
     * sémantique `ajouter` de `GrillePlanning`) : mémorise le slot ciblé et
     * ouvre le sélecteur de personne. No-op si la tournée est introuvable
     * (garde-fou, ne devrait pas se produire : `GrillePlanning` résout déjà
     * la tournée pour construire l'événement).
     * @param {{ tourneeId: string, date: string, creneau: string }} payload
     */
    onAjouter({ tourneeId, date, creneau }) {
      const tournee = this.tourneeParId(tourneeId);
      if (!tournee) return;
      this.slotSelection = { tourneeId, tourneeNom: tournee.nom, date, creneau };
      this.selecteurVisible = true;
    },

    /** Ferme le sélecteur de personne sans affecter personne (Échap, croix, « Annuler »). */
    onFermerSelecteur() {
      this.selecteurVisible = false;
    },

    /**
     * Une personne a été choisie dans le sélecteur : ferme la modale,
     * dispatche `ajouterAffectation` sur le slot mémorisé, puis rafraîchit
     * les diagnostics et annonce le résultat.
     * @param {string} personneId
     */
    async onChoisirPersonne(personneId) {
      this.selecteurVisible = false;
      if (!this.slotSelection) return;
      await this.ajouterAffectation({ ...this.slotSelection, personneId });
      await this.rafraichirDiagnostics();
      this.messageAnnonce = this.construireAnnonceEdition('Personne ajoutée.');
    },

    /**
     * Retire une affectation (bouton « Retirer » d'un élément de case), puis
     * rafraîchit les diagnostics et annonce le résultat.
     * @param {{ affectationId: string }} payload
     */
    async onRetirer({ affectationId }) {
      await this.retirerAffectation({ affectationId });
      await this.rafraichirDiagnostics();
      this.messageAnnonce = this.construireAnnonceEdition('Personne retirée.');
    },

    /**
     * Bascule le verrouillage d'une affectation (bouton cadenas d'un
     * élément de case, événement sémantique `verrouiller`), puis rafraîchit
     * les diagnostics et annonce le **nouvel état** (§8) : l'annonce est
     * déterminée en relisant l'affectation dans `planningCourant` (déjà à
     * jour après le `dispatch`), pas en devinant l'état précédent.
     * @param {{ affectationId: string }} payload
     */
    async onVerrouiller({ affectationId }) {
      await this.basculerVerrouillage({ affectationId });
      await this.rafraichirDiagnostics();
      const affectation = this.planningCourant?.affectations.find((a) => a.id === affectationId);
      this.messageAnnonce = affectation?.verrouillee
        ? 'Affectation verrouillée.'
        : 'Affectation déverrouillée.';
    },

    /**
     * Déplace une affectation glissée vers une autre case (événement
     * sémantique `deplacer` de `GrillePlanning`, feature 011 tâche 5 :
     * glisser-déposer natif, **surcouche** de confort au clic — jamais
     * l'unique moyen). Dispatche `deplacerAffectation`, qui préserve
     * l'identité (`id`) et le verrou de l'affectation (§4.4) ; rafraîchit
     * ensuite les diagnostics et annonce le résultat.
     * @param {{ affectationId: string, versTourneeId: string, versDate: string, versCreneau: string }} payload
     */
    async onDeplacer(payload) {
      await this.deplacerAffectation(payload);
      await this.rafraichirDiagnostics();
      this.messageAnnonce = this.construireAnnonceEdition('Affectation déplacée.');
    },

    /**
     * Recalcule les diagnostics du planning courant (lecture seule, aucun
     * `commit` côté store) et les remplace en état local. Réutilisé par
     * chaque geste d'édition (ajout/retrait/déplacement/verrouillage/undo)
     * pour rester à jour immédiatement après une modification (§6.3, §8).
     * La régénération, elle, alimente `diagnostics` directement depuis le
     * `Resultat` retourné par l'action (pas de second passage moteur).
     */
    async rafraichirDiagnostics() {
      this.diagnostics = await this.evaluerCourant();
    },

    /**
     * Annule le dernier geste d'édition ou la dernière régénération
     * (undo 1-niveau, sans redo). No-op côté store si rien n'est
     * annulable ; rafraîchit les diagnostics et annonce le résultat. Le
     * bouton « Annuler » devenant `disabled` (undo 1-niveau) perd le focus :
     * on le replace explicitement sur la bascule « Modifier le planning »/
     * « Terminer la modification », élément stable de la barre d'actions
     * (correctif ergonomie MAJ-2, feature 011).
     */
    async onAnnuler() {
      await this.annulerDerniereEdition();
      await this.rafraichirDiagnostics();
      this.messageAnnonce = 'Dernière action annulée.';
      await this.$nextTick();
      this.$refs.boutonBasculerEdition?.focus();
    },

    /**
     * Déclenche une régénération (« Regénérer à l'identique » si
     * `variante` est `false`, « Essayer une variante » sinon). Demande une
     * confirmation (`DialogueConfirmation`) **uniquement** s'il existe un
     * ajustement manuel non verrouillé qui serait perdu (§8) ; sinon la
     * régénération est directe, sans friction (exploration de variantes sur
     * un planning encore « brut »).
     * @param {boolean} variante
     */
    demanderRegeneration(variante) {
      if (this.aAjustementNonVerrouillePerdu) {
        this.varianteEnAttente = variante;
        this.confirmationRegenerationVisible = true;
      } else {
        this.executerRegeneration(variante);
      }
    },

    /** Confirmation de régénération acceptée : ferme la modale et régénère. */
    onConfirmerRegeneration() {
      this.confirmationRegenerationVisible = false;
      this.executerRegeneration(this.varianteEnAttente);
    },

    /** Confirmation de régénération refusée : ferme la modale sans rien changer. */
    onAnnulerRegeneration() {
      this.confirmationRegenerationVisible = false;
    },

    /**
     * Exécute la régénération **en place** du planning courant (§4.5) :
     * même pattern de chargement que `onGenerer` (bascule + `$nextTick`
     * pour laisser l'UI peindre l'indicateur avant l'appel), `chargement`
     * toujours remis à `false` en `finally` (robustesse). Alimente les
     * diagnostics volatils directement depuis le `Resultat` retourné par
     * l'action (pas de second passage moteur) et annonce le résultat, en
     * rappelant que les affectations verrouillées ont été conservées.
     * Renseigne `regenerationEnCours` (`'IDENTIQUE'`/`'VARIANTE'`) pour que
     * le bouton déclenché affiche « Régénération en cours… » (correctifs
     * ergonomie MIN-3/MIN-4, feature 011).
     * @param {boolean} variante
     */
    async executerRegeneration(variante) {
      this.chargement = true;
      this.erreurGeneration = '';
      this.regenerationEnCours = variante ? 'VARIANTE' : 'IDENTIQUE';
      try {
        await this.$nextTick();
        const resultat = await this.regenerer({ variante });
        if (!resultat) return;
        this.diagnostics = {
          violations: resultat.violations,
          tourneesNonCouvertes: resultat.tourneesNonCouvertes,
          score: resultat.score,
        };
        this.messageAnnonce = this.construireAnnonceEdition(
          variante
            ? 'Variante générée. Les affectations verrouillées ont été conservées.'
            : 'Planning regénéré. Les affectations verrouillées ont été conservées.'
        );
      } catch {
        this.erreurGeneration =
          "La régénération n'a pas pu aboutir. Réessayez, ou vérifiez votre équipe et vos tournées.";
        this.messageAnnonce = this.erreurGeneration;
      } finally {
        this.chargement = false;
        this.regenerationEnCours = null;
      }
    },

    /**
     * Lance une génération pour la période choisie. Le moteur étant
     * synchrone (< 300 ms), on bascule d'abord l'état `chargement` et on
     * attend le prochain tick pour laisser l'UI peindre l'indicateur avant
     * d'appeler l'action (§8, ADR 0008 : appel moteur toujours via le store).
     * Alimente ensuite la vue avec la partie diagnostics du `Resultat`
     * retourné et recale `dateReference` sur la période fraîchement générée.
     *
     * En cas d'échec (`try`/`catch`), affiche un message d'erreur clair et
     * actionnable et l'annonce via la région `aria-live` ; le bouton n'est
     * **jamais** laissé bloqué sur « Génération en cours… » (`finally`).
     * @param {{ dateDebut: string, dateFin: string }} payload
     */
    async onGenerer(payload) {
      this.chargement = true;
      this.erreurGeneration = '';
      this.messageAnnonce = '';
      try {
        await this.$nextTick();
        const resultat = await this.genererPropose(payload);
        this.diagnostics = {
          violations: resultat.violations,
          tourneesNonCouvertes: resultat.tourneesNonCouvertes,
          score: resultat.score,
        };
        this.dateReference = this.planningCourant.dateDebut;
        this.aEdite = true;
        this.messageAnnonce = this.construireAnnonceSucces();
        await this.$nextTick();
        this.$refs.titrePlanning?.focus();
      } catch {
        this.erreurGeneration =
          "La génération n'a pas pu aboutir. Réessayez, ou vérifiez votre équipe et vos tournées.";
        this.messageAnnonce = this.erreurGeneration;
      } finally {
        this.chargement = false;
      }
    },

    /**
     * Texte annoncé après une génération réussie, cohérent avec les
     * compteurs de `PanneauConflits` (mêmes longueurs de `violations`/
     * `tourneesNonCouvertes`, aucune dérivation supplémentaire).
     * @returns {string}
     */
    construireAnnonceSucces() {
      const nbPoints = this.diagnostics.violations.length;
      const nbNonPourvus = this.diagnostics.tourneesNonCouvertes.length;
      if (nbPoints === 0 && nbNonPourvus === 0) {
        return 'Planning généré, aucun conflit.';
      }
      return (
        `Planning généré : ${nbPoints} point${nbPoints > 1 ? 's' : ''} d'attention, ` +
        `${nbNonPourvus} créneau${nbNonPourvus > 1 ? 'x' : ''} non pourvu${nbNonPourvus > 1 ? 's' : ''}.`
      );
    },

    /**
     * Texte annoncé après un geste d'édition manuelle (ajout, retrait…),
     * cohérent avec les compteurs de `PanneauConflits` déjà à jour dans
     * `diagnostics` au moment de l'appel (§8 : « Personne ajoutée. 1 point
     * d'attention. »).
     * @param {string} action - Amorce en français, ex. `'Personne ajoutée.'`.
     * @returns {string}
     */
    construireAnnonceEdition(action) {
      const nbPoints = this.diagnostics.violations.length;
      const nbNonPourvus = this.diagnostics.tourneesNonCouvertes.length;
      if (nbPoints === 0 && nbNonPourvus === 0) {
        return `${action} Aucun point d'attention.`;
      }
      return (
        `${action} ${nbPoints} point${nbPoints > 1 ? 's' : ''} d'attention, ` +
        `${nbNonPourvus} créneau${nbNonPourvus > 1 ? 'x' : ''} non pourvu${nbNonPourvus > 1 ? 's' : ''}.`
      );
    },
  },
  /**
   * `selectionId` (state `plannings`) n'est pas persisté : au rechargement,
   * `getters['plannings/courant']` est `null` même si des plannings
   * existent. On auto-sélectionne alors le plus récent (`createdAt`
   * décroissant) et on recalcule ses diagnostics via `evaluerCourant` (§4.4),
   * jamais lus depuis un stockage.
   */
  async mounted() {
    if (!this.planningCourant && this.planningsExistants.length > 0) {
      const plusRecent = [...this.planningsExistants].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      )[0];
      this.SELECT(plusRecent.id);
    }
    if (this.planningCourant) {
      this.dateReference = this.planningCourant.dateDebut;
      await this.rafraichirDiagnostics();
    }
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.planning-etat-vide {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
}

.planning-lien-etat-vide {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.planning-zone-resultat-attente {
  margin-top: t.$espace-4;
  padding: t.$espace-6 t.$espace-4;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.planning-erreur-generation {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-3;
  margin-top: t.$espace-3;
}

// Région d'annonce (aria-live) : présente dans le DOM et réellement
// annoncée par les lecteurs d'écran, sans occuper d'espace visuel.
.planning-annonce-invisible {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.planning-resultat {
  margin-top: t.$espace-4;
}

// Regroupe le titre du planning et le badge « Mode modification » (MIN-1) :
// le titre garde sa marge basse propre le temps de porter le focus après
// génération, l'espacement avant la barre d'actions vit ici.
.planning-resultat-entete {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-2;
  margin-bottom: t.$espace-3;
}

.planning-resultat-titre {
  margin-bottom: 0;

  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: 2px;
  }
}

// Repère visible du mode modification (correctif ergonomie MIN-1,
// feature 011) : icône + libellé (jamais la seule couleur), affiché
// uniquement quand `modeEdition` est actif.
.planning-badge-edition {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
  padding: t.$espace-1 t.$espace-2;
  color: t.$couleur-primaire-foncee;
  background-color: rgba(t.$couleur-primaire, 0.12);
  border: 1px solid t.$couleur-primaire;
  border-radius: t.$rayon-lg;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
}

// Regroupe les actions du planning (Modifier/Terminer, Annuler,
// Regénérer/Variante) : conteneur unique, extensible.
.planning-barre-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: t.$espace-2;
  margin-bottom: t.$espace-3;
}

// Message discret invitant à revenir sur « Tournées » pour modifier
// (édition ancrée sur cette orientation, §6.1) : icône + texte, jamais la
// seule couleur.
.planning-message-orientation {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-2;
  margin-top: t.$espace-3;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
