<template>
  <div class="planning-view">
    <h1>Planning</h1>

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
          <PhKanban :size="18" aria-hidden="true" />
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
      <!-- En-tête : titre + icône d'information (date de génération), puis
           les actions en boutons icône seule collés à droite (libellé en
           infobulle `title` et en `aria-label`) — retour porteur 2026-10-08. -->
      <div class="planning-resultat-entete">
        <div class="planning-resultat-titre-groupe">
          <h2 ref="titrePlanning" tabindex="-1" class="planning-resultat-titre">
            {{ planningCourant.nom }}
          </h2>
          <button
            v-if="infoGeneration"
            type="button"
            class="planning-bouton-info d-none d-md-inline-flex"
            :title="texteInfoGeneration"
            :aria-label="texteInfoGeneration"
            :aria-expanded="infoGenerationVisible ? 'true' : 'false'"
            aria-controls="planning-info-generation"
            @click="infoGenerationVisible = !infoGenerationVisible"
          >
            <PhInfo :size="20" aria-hidden="true" />
          </button>
          <span v-if="modeEdition" class="planning-badge-edition">
            <PhPencilSimple :size="16" weight="bold" aria-hidden="true" />
            <span>Mode modification — affichage par tournées</span>
          </span>
        </div>

        <div class="planning-entete-actions">
          <div class="planning-barre-actions" role="group" aria-label="Actions du planning">
            <button
              ref="boutonBasculerEdition"
              type="button"
              class="btn btn-sm planning-bouton-icone"
              :class="modeEdition ? 'btn-outline-primary planning-bouton-icone--actif' : 'btn-outline-secondary'"
              :aria-pressed="modeEdition ? 'true' : 'false'"
              :aria-label="modeEdition ? 'Terminer la modification' : 'Modifier le planning'"
              :title="modeEdition ? 'Terminer la modification' : 'Modifier le planning'"
              @click="onBasculerEdition"
            >
              <PhCheck v-if="modeEdition" :size="18" aria-hidden="true" />
              <PhPencilSimple v-else :size="18" aria-hidden="true" />
            </button>

            <button
              type="button"
              class="btn btn-sm btn-outline-secondary planning-bouton-icone"
              :disabled="!peutAnnuler"
              aria-label="Annuler la dernière action"
              :title="peutAnnuler ? 'Annuler la dernière action' : 'Annuler la dernière action (rien à annuler pour l\'instant)'"
              @click="onAnnuler"
            >
              <PhArrowCounterClockwise :size="18" aria-hidden="true" />
            </button>

            <button
              type="button"
              class="btn btn-sm btn-outline-secondary planning-bouton-icone"
              :disabled="chargement"
              :aria-label="regenerationEnCours === 'IDENTIQUE' ? 'Régénération en cours…' : 'Regénérer à l\'identique'"
              :title="regenerationEnCours === 'IDENTIQUE' ? 'Régénération en cours…' : 'Regénérer à l\'identique : repropose la même répartition en conservant les affectations verrouillées.'"
              @click="demanderRegeneration(false)"
            >
              <PhArrowsClockwise :size="18" aria-hidden="true" />
            </button>

            <button
              type="button"
              class="btn btn-sm btn-outline-secondary planning-bouton-icone"
              :disabled="chargement"
              :aria-label="regenerationEnCours === 'VARIANTE' ? 'Régénération en cours…' : 'Essayer une variante'"
              :title="regenerationEnCours === 'VARIANTE' ? 'Régénération en cours…' : 'Essayer une variante : propose une autre répartition en conservant les affectations verrouillées.'"
              @click="demanderRegeneration(true)"
            >
              <PhShuffle :size="18" aria-hidden="true" />
            </button>
          </div>

          <router-link
            class="btn btn-sm btn-primary planning-bouton-icone"
            :to="{ name: 'diffusion', params: { id: planningCourant.id } }"
            aria-label="Imprimer le planning"
            title="Imprimer le planning"
          >
            <PhPrinter :size="18" aria-hidden="true" />
          </router-link>
        </div>
      </div>

      <!-- Date de génération en texte : toujours visible sur mobile (pas
           d'icône d'information, le survol n'y existe pas) ; à partir de `md`,
           affichée seulement au clic sur l'icône d'information. -->
      <p
        v-if="infoGeneration"
        id="planning-info-generation"
        class="planning-info-generation"
        :class="{ 'd-md-none': !infoGenerationVisible }"
      >
        <PhClockCounterClockwise :size="16" aria-hidden="true" class="flex-shrink-0" />
        <span>
          Généré le <time :datetime="infoGeneration.genereLe">{{ infoGeneration.dateTexte }}</time>
          <template v-if="infoGeneration.modifieDepuis">
            · modifié à la main le
            <time :datetime="dateModificationIso">{{ infoGeneration.dateModificationTexte }}</time>
          </template>
        </span>
      </p>

      <p v-if="modeEdition && orientation === 'PERSONNES'" class="alert alert-info planning-message-orientation">
        <PhInfo :size="18" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <span>
          Pour modifier le planning, affichez-le par tournée (bouton
          <PhKanban :size="16" aria-hidden="true" /> en haut à droite de la grille). En affichage
          par personne, le planning reste en lecture seule.
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
      >
        <template #actions>
          <ControlesGrille
            :echelle="echelle"
            :date-reference="dateReference"
            :echelle-contexte="{ dateDebutPlanning: planningCourant.dateDebut }"
            @update:dateReference="dateReference = $event"
          />
          <ReglagesAffichageGrille
            :orientation="orientation"
            :echelle="echelle"
            @update:orientation="orientation = $event"
            @update:echelle="echelle = $event"
          />
        </template>
      </GrillePlanning>

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
      :segment-index="slotSelection?.segmentIndex"
      :horaires="slotSelection?.horaires"
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
  PhKanban,
  PhUsers,
  PhWarningOctagon,
  PhArrowCounterClockwise,
  PhPencilSimple,
  PhCheck,
  PhArrowsClockwise,
  PhShuffle,
  PhClockCounterClockwise,
  PhPrinter,
} from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import FormulaireGeneration from '@/components/planning/FormulaireGeneration.vue';
import ControlesGrille from '@/components/planning/ControlesGrille.vue';
import GrillePlanning from '@/components/planning/GrillePlanning.vue';
import ReglagesAffichageGrille from '@/components/planning/ReglagesAffichageGrille.vue';
import PanneauConflits from '@/components/planning/PanneauConflits.vue';
import SelecteurPersonne from '@/components/planning/SelecteurPersonne.vue';
import { libelleSegment, estCoupee } from '@/domain/tournees.js';
import { infoGeneration } from '@/domain/planning.js';

/**
 * Écran « Planning » (feature 0010) : orchestre le choix d'une période, le
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
 * Barre d'actions du planning (feature 0011) : porte le bouton « Annuler la
 * dernière action » (tâche 2, undo 1-niveau, sans redo), désactivé quand
 * `plannings/peutAnnuler` est `false`, et la bascule « Modifier le
 * planning »/« Terminer la modification » (tâche 3) qui pilote `modeEdition`.
 *
 * Impression (feature 0012) : le bouton « Imprimer le planning » de la barre
 * d'actions ouvre l'écran de diffusion (`/planning/:id/diffusion`) du planning
 * courant, y compris en mode modification.
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
    PhKanban,
    PhUsers,
    PhWarningOctagon,
    PhArrowCounterClockwise,
    PhPencilSimple,
    PhCheck,
    PhArrowsClockwise,
    PhShuffle,
    PhClockCounterClockwise,
    PhPrinter,
    DialogueConfirmation,
    FormulaireGeneration,
    ControlesGrille,
    GrillePlanning,
    ReglagesAffichageGrille,
    PanneauConflits,
    SelecteurPersonne,
  },
  data() {
    return {
      // `true` pendant l'appel au moteur (bascule le libellé du bouton).
      chargement: false,
      // Détail « Généré le … » affiché sous le titre (clic sur l'icône d'information).
      infoGenerationVisible: false,
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
      // Message d'erreur affiché (alerte) si la génération échoue ; vide sinon.
      // Remis à vide au début de chaque nouvelle tentative.
      erreurGeneration: '',
      // Texte annoncé par la région `aria-live` après une génération
      // (succès ou échec), pour les technologies d'assistance.
      messageAnnonce: '',
      // Bascule lecture/édition (feature 0011, tâche 3) : purement volatil,
      // jamais persisté (§4.7).
      modeEdition: false,
      // Visibilité du sélecteur de personne (modale).
      selecteurVisible: false,
      // Slot mémorisé (case cliquée) en attente d'un choix dans le
      // sélecteur : `{ tourneeId, tourneeNom, date, segmentIndex, horaires } | null`
      // (feature 0016, ADR 0017 : `segmentIndex` remplace l'ancien `creneau`).
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
      // sur le bon bouton (correctif ergonomie MIN-3/MIN-4, feature 0011).
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
    /** Le formulaire de génération n'est utile que si les deux ingrédients indispensables existent. */
    peutGenerer() {
      return this.personnesActives.length > 0 && this.tourneesActives.length > 0;
    },
    /**
     * Informations de génération du planning courant (`null` si absentes :
     * rien n'est alors affiché, feature 0026).
     * @returns {{ genereLe: string, dateTexte: string, modifieDepuis: boolean, dateModificationTexte: string } | null}
     */
    infoGeneration() {
      return this.planningCourant ? infoGeneration(this.planningCourant) : null;
    },
    /** Texte de l'infobulle de l'icône d'information (date de génération). */
    texteInfoGeneration() {
      const info = this.infoGeneration;
      if (!info) return '';
      const modification = info.modifieDepuis ? ` · modifié à la main le ${info.dateModificationTexte}` : '';
      return `Généré le ${info.dateTexte}${modification}`;
    },
    /** Horodatage ISO de la dernière modification, pour l'attribut `datetime`. */
    dateModificationIso() {
      return this.planningCourant?.updatedAt ?? '';
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
     * feature 0011) : le repère visuel persistant est le badge « Mode
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
     * Réagit au clic sur « Ajouter une personne » d'une vacation (événement
     * sémantique `ajouter` de `GrillePlanning`, enrichi du `segmentIndex`
     * ciblé — feature 0016, ADR 0017) : mémorise le slot ciblé (horaires du
     * segment résolus via `libelleSegment`, pour le titre du sélecteur) et
     * ouvre le sélecteur de personne. No-op si la tournée est introuvable
     * (garde-fou, ne devrait pas se produire : `GrillePlanning` résout déjà
     * la tournée pour construire l'événement).
     * @param {{ tourneeId: string, date: string, segmentIndex: number }} payload
     */
    onAjouter({ tourneeId, date, segmentIndex }) {
      const tournee = this.tourneeParId(tourneeId);
      if (!tournee) return;
      const segment = tournee.segments[segmentIndex];
      const horaires = segment ? libelleSegment(segment) : '';
      this.slotSelection = {
        tourneeId,
        tourneeNom: tournee.libelle,
        date,
        segmentIndex,
        horaires: this.horairesQualifies(tournee, segmentIndex, horaires),
      };
      this.selecteurVisible = true;
    },

    /**
     * Horaires du segment ciblé, préfixés d'un qualificatif « le matin » /
     * « la reprise du soir » pour une tournée **coupée** (correctif
     * ergonomie post-relecture — le titre du sélecteur de personne ne
     * montrait que les horaires bruts, ambigus sans le contexte matin/soir).
     * Horaires seuls pour une tournée **complète** (rien à distinguer).
     * @param {object} tournee
     * @param {number} segmentIndex
     * @param {string} horaires - Horaires déjà formatés (`libelleSegment`).
     * @returns {string}
     */
    horairesQualifies(tournee, segmentIndex, horaires) {
      if (!estCoupee(tournee)) return horaires;
      const qualificatif = segmentIndex === 0 ? 'le matin' : 'la reprise du soir';
      return horaires ? `${qualificatif}, ${horaires}` : qualificatif;
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
     * sémantique `deplacer` de `GrillePlanning`, feature 0011 tâche 5 :
     * glisser-déposer natif, **surcouche** de confort au clic — jamais
     * l'unique moyen). Dispatche `deplacerAffectation`, qui préserve
     * l'identité (`id`) et le verrou de l'affectation (§4.4) ; rafraîchit
     * ensuite les diagnostics et annonce le résultat.
     * @param {{ affectationId: string, versTourneeId: string, versDate: string, versSegmentIndex: number }} payload
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
     * (correctif ergonomie MAJ-2, feature 0011).
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
     * ergonomie MIN-3/MIN-4, feature 0011).
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
// Titre (+ icône d'information + badge) à gauche, actions icône seule
// collées à droite ; elles passent dessous si la place manque.
.planning-resultat-entete {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-2;
  margin-bottom: t.$espace-3;
}

.planning-resultat-titre-groupe {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-2;
  flex: 1 1 auto;
  min-width: 0;
}

// Icône d'information (date de génération) : infobulle au survol, détail
// affiché/masqué au clic. Cible cliquable de taille standard.
.planning-bouton-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;
  padding: 0;
  border: 0;
  border-radius: t.$rayon-md;
  background: none;
  color: t.$couleur-texte-attenue;

  &:hover {
    color: t.$couleur-primaire-foncee;
  }

  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: 2px;
  }
}

.planning-resultat-titre {
  margin-bottom: 0;

  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: 2px;
  }
}

// Repère visible du mode modification (correctif ergonomie MIN-1,
// feature 0011) : icône + libellé (jamais la seule couleur), affiché
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

// Ligne discrète « Généré le … » sous le titre (feature 0026) : icône
// décorative + texte, taille de texte standard pour rester lisible.
.planning-info-generation {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin: 0 0 t.$espace-3;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

// Actions collées à droite de l'en-tête, toutes en icône seule : les 4
// boutons d'édition, un petit espace, puis « Imprimer le planning » (bouton
// plein, action principale) — même gabarit que le bandeau de la grille.
.planning-entete-actions {
  display: flex;
  align-items: center;
  gap: t.$espace-3;
  margin-left: auto;
}

// Modifier/Terminer, Annuler, Regénérer, Variante.
.planning-barre-actions {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
}

.planning-bouton-icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;

  // Bouton actif (mode modification) : fond léger en plus de la couleur,
  // `aria-pressed` porte l'état pour les lecteurs d'écran.
  &--actif {
    background-color: rgba(t.$couleur-primaire, 0.12);
  }
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
