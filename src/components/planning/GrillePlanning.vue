<template>
  <div class="grille-planning">
    <div
      class="grille-planning-scroll"
      tabindex="0"
      role="region"
      :aria-label="ariaLabelDefilement"
    >
      <table class="grille-planning-table">
        <caption class="grille-planning-legende">{{ captionTexte }}</caption>
        <thead>
          <tr>
            <th scope="col" class="grille-planning-coin grille-planning-colonne-figee">
              {{ orientation === 'TOURNEES' ? 'Tournée' : 'Personne' }}
            </th>
            <th
              v-for="colonne in colonnes"
              :key="colonne.date"
              scope="col"
              class="grille-planning-entete-jour"
              :class="{
                'grille-planning-entete-jour--fermee': colonne.ferme,
                'grille-planning-entete-jour--hors-periode': colonne.horsPeriode,
              }"
            >
              <span class="grille-planning-jour-nom">{{ libelleJour(colonne.jourIso) }}</span>
              <span class="grille-planning-jour-date">{{ dateCourte(colonne.date) }}</span>
              <span v-if="colonne.ferme" class="grille-planning-jour-statut">
                <PhLock :size="12" aria-hidden="true" />
                <span>Fermé</span>
              </span>
              <span v-else-if="colonne.horsPeriode" class="grille-planning-jour-statut grille-planning-jour-statut--attenue">
                Hors période
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ligne in matrice" :key="ligne.donnees.id">
            <th
              scope="row"
              class="grille-planning-entete-ligne grille-planning-colonne-figee"
              :class="{
                'grille-planning-entete-ligne--concernee-erreur': ligne.concerneeEnTete === 'erreur',
                'grille-planning-entete-ligne--concernee-avertissement': ligne.concerneeEnTete === 'avertissement',
              }"
            >
              <div class="grille-planning-entete-ligne-contenu">
                <span
                  class="grille-planning-pastille"
                  :style="{ backgroundColor: ligne.donnees.couleur }"
                  aria-hidden="true"
                />
                <span class="grille-planning-nom-ligne">
                  {{ ligne.donnees.nom }}<template v-if="ligne.donnees.archivee"> (archivée)</template>
                </span>
                <template v-if="ligne.concerneeEnTete">
                  <PhWarningOctagon
                    v-if="ligne.concerneeEnTete === 'erreur'"
                    :size="16"
                    weight="bold"
                    aria-hidden="true"
                  />
                  <PhWarning v-else :size="16" weight="bold" aria-hidden="true" />
                  <span class="grille-planning-texte-invisible">
                    {{
                      ligne.concerneeEnTete === 'erreur'
                        ? 'Conflit signalé sur cette ligne'
                        : 'Point d’attention signalé sur cette ligne'
                    }}
                  </span>
                </template>
              </div>
            </th>
            <td
              v-for="cellule in ligne.cellules"
              :key="cellule.date"
              class="grille-planning-cellule"
              :class="{ 'grille-planning-cellule--cible-depot': estCibleDepot(cellule) }"
              @dragover="onSurvolCellule(cellule, $event)"
            >
              <slot name="cellule" v-bind="cellule">
                <CellulePlanning
                  :elements="cellule.elements"
                  :segments="cellule.segments"
                  :concernee="cellule.concernee"
                  :ferme="cellule.ferme"
                  :hors-periode="cellule.horsPeriode"
                  :editable="cellule.editable"
                  :ajoutable="cellule.ajoutable"
                  @ajouter-ici="onAjouterIci(cellule, $event)"
                  @deposer-ici="onDeposer(cellule, $event)"
                  @retirer="$emit('retirer', $event)"
                  @verrouiller="$emit('verrouiller', $event)"
                  @debut-glisser="onDebutGlisser($event)"
                  @fin-glisser="onFinGlisser"
                />
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import { PhLock, PhWarning, PhWarningOctagon } from '@phosphor-icons/vue';

import CellulePlanning from '@/components/planning/CellulePlanning.vue';
import { dateUtil } from '@/domain/utils/dates.js';
import { libelleJour } from '@/domain/libelles.js';
import { estCoupee, libelleSegment } from '@/domain/tournees.js';

/**
 * @typedef {Object} LigneGrille
 * @property {string} id
 * @property {string} nom
 * @property {string} couleur
 * @property {boolean} archivee
 */

/**
 * @typedef {Object} ElementCellule
 * @property {string} id
 * @property {string} couleur
 * @property {string} libellePrincipal
 * @property {string} [libelleSecondaire]
 * @property {number} [segmentIndex] - Indice du segment couvert (orientation TOURNEES uniquement), pour le regroupement par vacation (feature 0016).
 * @property {boolean} verrouillee
 */

/**
 * @typedef {Object} SegmentCellule - Descripteur d'une vacation d'une case,
 *   en orientation TOURNEES (feature 0016, ADR 0017). Une tournée complète
 *   n'a qu'un seul `SegmentCellule` (groupe implicite, `libelleVacation`
 *   vide) ; une tournée coupée en a deux (« Matin »/« Soir »).
 * @property {number} index - Indice (0-based) du segment dans `tournee.segments`.
 * @property {string} libelleVacation - `'Matin'`/`'Soir'` (tournée coupée) ou `''` (tournée complète, aucun intitulé affiché).
 * @property {string} horaires - Horaires du segment en clair (`libelleSegment`).
 * @property {?{manque: number}} sousCouverture - Sous-couverture de ce segment, ou `null`.
 */

/**
 * Composant central de visualisation d'un planning (feature 0010),
 * **éditable au clic** en mode édition (feature 0011, prop `editable`, par
 * défaut `false`). Rend **toujours** une matrice lignes × jours (§6.1 du
 * plan `0010`) : l'échelle (`JOUR`/`SEMAINE`/`MOIS`) ne change que l'ensemble
 * des colonnes-jours, l'orientation (`TOURNEES`/`PERSONNES`) ne change que
 * ce que sont les lignes et le contenu d'une cellule.
 *
 * Ne fait **aucune dérivation métier** : la sous-couverture vient
 * directement de la prop `tourneesNonCouvertes` (jamais des violations), le
 * surlignage est un mapping purement présentational de `Violation.cible`
 * vers une cellule/un en-tête de ligne (§6.2 de `0010`). Aucun import de
 * `@/domain/scheduling` ici.
 *
 * Édition (`0011` §6.1) : ancrée sur l'orientation `TOURNEES` — quand
 * `editable` est `true` mais que l'orientation est `PERSONNES`, la grille
 * reste **strictement en lecture seule** (aucun bouton, aucune émission),
 * `PlanningView` affichant alors un message invitant à repasser sur
 * « Tournées ». Reste **présentational** : n'appelle ni store ni moteur ;
 * **traduit** l'événement élémentaire `ajouter-ici` de `CellulePlanning` en
 * événement **sémantique** `ajouter` enrichi du contexte, et **réémet tel
 * quel** `retirer`/`verrouiller` (feature 0011, tâche 4 : la bascule de
 * verrouillage ne nécessite aucun contexte supplémentaire, `element.id`
 * porte déjà l'`affectationId`), vers `PlanningView` (seule à dispatcher,
 * ADR 0008).
 *
 * Glisser-déposer natif (feature 0011, tâche 5, **surcouche** de confort au
 * clic, API HTML5 native, aucune dépendance ajoutée) : tient l'état volatil
 * `affectationEnGlissement` (mis à jour via `debut-glisser`/`fin-glisser`
 * remontés de `CellulePlanning`) et `celluleCible` (case survolée comme
 * cible de dépôt valide, pour le repère visuel §6.3, au grain **cellule**).
 * Sur les `<td>` éditables (orientation Tournées, case ni fermée ni hors
 * période — même condition que `ajoutable`), `dragover` autorise le dépôt
 * (le repère visuel reste à la maille cellule) et met à jour le repère. Le
 * **dépôt effectif** se produit plus finement, au grain **vacation**
 * (feature 0016, ADR 0017 — une case coupée porte deux zones de dépôt
 * distinctes) : `CellulePlanning` capte le `drop` sur le sous-groupe ciblé
 * et remonte `deposer-ici` avec le `segmentIndex` du segment survolé ;
 * `onDeposer` traduit cet événement élémentaire en événement **sémantique**
 * `deplacer`, ignoré sur le slot source exact, une case non éligible, ou
 * hors glisse. Reste **présentational** : n'appelle ni store ni moteur.
 *
 * Expose un **slot scopé `cellule`** (point de greffe `0011`), dont le
 * contenu par défaut est `CellulePlanning`.
 */
export default {
  name: 'GrillePlanning',
  components: { PhLock, PhWarning, PhWarningOctagon, CellulePlanning },
  props: {
    /** Le `Planning` affiché (`dateDebut`, `dateFin`, `affectations`). */
    planning: { type: Object, required: true },
    /** `'TOURNEES'` ou `'PERSONNES'`. */
    orientation: { type: String, required: true },
    /** `'JOUR'`, `'SEMAINE'` ou `'MOIS'`. */
    echelle: { type: String, required: true },
    /** Date de référence `"YYYY-MM-DD"`, base du calcul des colonnes-jours. */
    dateReference: { type: String, required: true },
    /** `Violation[]` du moteur (§6.2) — surlignage présentational uniquement. */
    violations: { type: Array, default: () => [] },
    /** `NonCouverture[]` du moteur — source unique de la sous-couverture affichée. */
    tourneesNonCouvertes: { type: Array, default: () => [] },
    /**
     * `true` en mode édition (feature 0011), piloté par `PlanningView`
     * (`:editable="modeEdition"`). Par défaut `false` : comportement `0010`
     * strictement inchangé (aucun bouton, aucune émission).
     */
    editable: { type: Boolean, default: false },
  },
  emits: ['ajouter', 'retirer', 'verrouiller', 'deplacer'],
  data() {
    return {
      /**
       * Identifiant de l'affectation en cours de glisser-déposer (feature
       * 0011, tâche 5), mis à jour via `debut-glisser`/`fin-glisser` remontés
       * de `CellulePlanning`. `null` hors glisse.
       */
      affectationEnGlissement: null,
      /**
       * Coordonnées `{ tourneeId, date }` de la case actuellement survolée
       * comme cible de dépôt valide, pour le repère visuel (§6.3). `null`
       * hors glisse ou hors case éligible. Effacé à `fin-glisser` et après
       * chaque dépôt.
       */
      celluleCible: null,
    };
  },
  computed: {
    ...mapGetters('tournees', { tourneesActives: 'actives', tourneeParId: 'byId' }),
    ...mapGetters('personnes', { personnesActives: 'actifs', personneParId: 'byId' }),
    ...mapGetters('cabinet', ['parametres']),

    /**
     * Édition réellement active : `editable` **et** orientation `TOURNEES`
     * (§6.1 — l'édition reste ancrée sur les cases-tournée, qui seules ont
     * un créneau propre). En orientation `PERSONNES`, l'édition reste
     * désactivée même si `editable` est `true` (la grille y est
     * strictement en lecture seule ; `PlanningView` affiche alors un
     * message invitant à revenir sur « Tournées »).
     * @returns {boolean}
     */
    editableEffectif() {
      return this.editable && this.orientation === 'TOURNEES';
    },

    /**
     * Fenêtre de dates `"YYYY-MM-DD"` couverte par la grille, selon
     * `echelle`/`dateReference` (§6.1). Construite exclusivement via
     * `dateUtil` : aucun objet `Date` manipulé ici.
     * @returns {string[]}
     */
    datesFenetre() {
      if (this.echelle === 'JOUR') return [this.dateReference];
      if (this.echelle === 'SEMAINE') {
        const debut = dateUtil.debutSemaine(this.dateReference, this.parametres.premierJourSemaine);
        return dateUtil.rangeInclusive(debut, dateUtil.addDays(debut, 6));
      }
      // MOIS
      const debut = dateUtil.debutMois(this.dateReference);
      return dateUtil.rangeInclusive(debut, dateUtil.finMois(this.dateReference));
    },

    /**
     * Colonnes-jours enrichies (`jourIso`, `ferme`, `horsPeriode`). Les
     * jours restent **toujours** affichés (jamais masqués) — seul leur état
     * change.
     * @returns {Array<{date: string, jourIso: number, ferme: boolean, horsPeriode: boolean}>}
     */
    colonnes() {
      return this.datesFenetre.map((date) => {
        const jourIso = dateUtil.weekdayISO(date);
        return {
          date,
          jourIso,
          ferme: !this.parametres.joursOuverture.includes(jourIso),
          horsPeriode: date < this.planning.dateDebut || date > this.planning.dateFin,
        };
      });
    },

    /**
     * Lignes de la grille selon l'orientation : tournées/personnes actives
     * plus toute entité archivée référencée par une affectation (suffixe
     * « (archivée) »), triées par nom.
     * @returns {LigneGrille[]}
     */
    lignes() {
      return this.orientation === 'TOURNEES' ? this.lignesTournees : this.lignesPersonnes;
    },

    lignesTournees() {
      const actives = this.tourneesActives.map((t) => ({
        id: t.id,
        nom: t.libelle,
        couleur: t.couleur,
        archivee: false,
      }));
      const idsActifs = new Set(this.tourneesActives.map((t) => t.id));
      const idsReferences = new Set(this.planning.affectations.map((a) => a.tourneeId));
      const archivees = [...idsReferences]
        .filter((id) => !idsActifs.has(id))
        .map((id) => this.tourneeParId(id))
        .filter(Boolean)
        .map((t) => ({ id: t.id, nom: t.libelle, couleur: t.couleur, archivee: true }));
      return [...actives, ...archivees].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    },

    lignesPersonnes() {
      const actives = this.personnesActives.map((p) => ({
        id: p.id,
        nom: `${p.prenom} ${p.nom}`,
        couleur: p.couleur,
        archivee: false,
      }));
      const idsActifs = new Set(this.personnesActives.map((p) => p.id));
      const idsReferences = new Set(this.planning.affectations.map((a) => a.personneId));
      const archivees = [...idsReferences]
        .filter((id) => !idsActifs.has(id))
        .map((id) => this.personneParId(id))
        .filter(Boolean)
        .map((p) => ({ id: p.id, nom: `${p.prenom} ${p.nom}`, couleur: p.couleur, archivee: true }));
      return [...actives, ...archivees].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    },

    /**
     * Matrice complète lignes × colonnes, chaque cellule déjà résolue au
     * format du slot scopé `cellule`. Calculée une seule fois par rendu
     * (computed), plutôt que rappelée en boucle dans le template.
     * @returns {Array<{donnees: LigneGrille, concerneeEnTete: (false|'erreur'|'avertissement'), cellules: object[]}>}
     */
    matrice() {
      return this.lignes.map((ligne) => ({
        donnees: ligne,
        concerneeEnTete: this.ligneConcernee(ligne),
        cellules: this.colonnes.map((colonne) => this.celluleDescripteur(ligne, colonne)),
      }));
    },

    /** Légende visible au-dessus de la grille (contexte : orientation + fenêtre affichée). */
    captionTexte() {
      const sujet = this.orientation === 'TOURNEES' ? 'Planning par tournée' : 'Planning par personne';
      const premiere = this.colonnes[0]?.date;
      const derniere = this.colonnes[this.colonnes.length - 1]?.date;
      if (!premiere) return sujet;
      if (premiere === derniere) {
        return `${sujet} — ${dateUtil.formatDateFr(premiere)}`;
      }
      return `${sujet} — du ${dateUtil.formatDateFr(premiere)} au ${dateUtil.formatDateFr(derniere)}`;
    },

    ariaLabelDefilement() {
      return `Grille du planning, défilement horizontal possible. ${this.captionTexte}.`;
    },
  },
  methods: {
    libelleJour,

    /**
     * Date courte lisible `"JJ/MM/AAAA"` pour un en-tête de colonne.
     * @param {string} date
     * @returns {string}
     */
    dateCourte(date) {
      return dateUtil.formatDateFr(date);
    },

    /**
     * Affectations de `planning.affectations` pour une ligne et une date
     * données, selon l'orientation courante.
     * @param {LigneGrille} ligne
     * @param {string} date
     * @returns {object[]} `Affectation[]`.
     */
    affectationsCellule(ligne, date) {
      const champ = this.orientation === 'TOURNEES' ? 'tourneeId' : 'personneId';
      return this.planning.affectations.filter((a) => a[champ] === ligne.id && a.date === date);
    },

    /**
     * Résout une `Affectation` en élément d'affichage (pastille + nom).
     * Enrichi de `verrouillee` (feature 0011, tâche 3), rendu par
     * `CellulePlanning` (cadenas + libellé « Verrouillée », tâche 4), et de
     * `segmentIndex` (feature 0016, ADR 0017 — permet à `CellulePlanning` de
     * regrouper les éléments par vacation).
     *
     * `libelleSecondaire` (horaires du segment, `libelleSegment`) : affiché
     * **uniquement** en orientation Personnes (remplace l'ancien libellé de
     * créneau ; cette orientation n'a pas de titre de groupe horaire). En
     * orientation Tournées, toujours vide : les horaires d'une vacation
     * sont déjà portés par le titre du groupe (`CellulePlanning`, §6.4) —
     * les répéter sous chaque nom serait redondant (correctif ergonomie
     * post-relecture).
     * @param {object} affectation
     * @returns {ElementCellule}
     */
    construireElement(affectation) {
      if (this.orientation === 'TOURNEES') {
        const personne = this.personneParId(affectation.personneId);
        if (!personne) {
          return {
            id: affectation.id,
            couleur: 'transparent',
            libellePrincipal: 'Personne inconnue',
            libelleSecondaire: '',
            segmentIndex: affectation.segmentIndex,
            verrouillee: affectation.verrouillee,
          };
        }
        return {
          id: affectation.id,
          couleur: personne.couleur,
          libellePrincipal: `${personne.prenom} ${personne.nom}${personne.actif ? '' : ' (archivée)'}`,
          libelleSecondaire: '',
          segmentIndex: affectation.segmentIndex,
          verrouillee: affectation.verrouillee,
        };
      }
      const tournee = this.tourneeParId(affectation.tourneeId);
      if (!tournee) {
        return {
          id: affectation.id,
          couleur: 'transparent',
          libellePrincipal: 'Tournée inconnue',
          segmentIndex: affectation.segmentIndex,
          verrouillee: affectation.verrouillee,
        };
      }
      const segment = tournee.segments[affectation.segmentIndex];
      return {
        id: affectation.id,
        couleur: tournee.couleur,
        libellePrincipal: `${tournee.libelle}${tournee.archivee ? ' (archivée)' : ''}`,
        libelleSecondaire: segment ? libelleSegment(segment) : '',
        segmentIndex: affectation.segmentIndex,
        verrouillee: affectation.verrouillee,
      };
    },

    /**
     * Sous-couverture d'un segment de cellule (tournée, date, segment), lue
     * **directement** dans `tourneesNonCouvertes` (jamais dérivée des
     * violations). Uniquement en orientation Tournées (§6.1) — appariement
     * par `(tourneeId, date, segmentIndex)` (feature 0016, ADR 0017).
     * @param {string} tourneeId
     * @param {string} date
     * @param {number} segmentIndex
     * @returns {?{manque: number}}
     */
    sousCouvertureSegment(tourneeId, date, segmentIndex) {
      const entree = this.tourneesNonCouvertes.find(
        (nc) => nc.tourneeId === tourneeId && nc.date === date && nc.segmentIndex === segmentIndex
      );
      return entree ? { manque: entree.manque } : null;
    },

    /**
     * Descripteurs de vacation d'une case (orientation Tournées uniquement,
     * feature 0016, ADR 0017) : une entrée par segment de la tournée
     * (`tournee.segments`), avec son intitulé (« Matin »/« Soir » pour une
     * tournée coupée, vide pour une complète — groupe implicite), ses
     * horaires et sa sous-couverture propre. `CellulePlanning` s'appuie sur
     * cette liste pour regrouper `elements` par `segmentIndex`.
     * @param {LigneGrille} ligne
     * @param {string} date
     * @returns {SegmentCellule[]}
     */
    segmentsCellule(ligne, date) {
      if (this.orientation !== 'TOURNEES') return [];
      const tournee = this.tourneeParId(ligne.id);
      if (!tournee) return [];
      const coupee = estCoupee(tournee);
      return tournee.segments.map((segment, index) => ({
        index,
        libelleVacation: coupee ? (index === 0 ? 'Matin' : 'Soir') : '',
        horaires: libelleSegment(segment),
        sousCouverture: this.sousCouvertureSegment(ligne.id, date, index),
      }));
    },

    /**
     * Mapping présentational `Violation.cible → cellule` (§6.2) : une
     * cellule est concernée si une violation cible `(tourneeId|personneId,
     * date)` selon l'orientation. Renvoie la sévérité la plus grave
     * (`'erreur'` prime sur `'avertissement'`), ou `false`.
     * @param {LigneGrille} ligne
     * @param {string} date
     * @returns {false|'erreur'|'avertissement'}
     */
    concerneeCellule(ligne, date) {
      const champ = this.orientation === 'TOURNEES' ? 'tourneeId' : 'personneId';
      const correspondantes = this.violations.filter(
        (v) => v.cible?.[champ] === ligne.id && v.cible?.date === date
      );
      if (correspondantes.length === 0) return false;
      return correspondantes.some((v) => v.severite === 'erreur') ? 'erreur' : 'avertissement';
    },

    /**
     * Mapping présentational pour l'en-tête de ligne (§6.2) : une violation
     * `cible: { personneId }` sans `date` surligne l'en-tête de la personne
     * concernée, **uniquement en orientation Personnes**.
     * @param {LigneGrille} ligne
     * @returns {false|'erreur'|'avertissement'}
     */
    ligneConcernee(ligne) {
      if (this.orientation !== 'PERSONNES') return false;
      const correspondantes = this.violations.filter(
        (v) => v.cible?.personneId === ligne.id && !v.cible?.date
      );
      if (correspondantes.length === 0) return false;
      return correspondantes.some((v) => v.severite === 'erreur') ? 'erreur' : 'avertissement';
    },

    /**
     * Construit le descripteur complet d'une cellule, exposé tel quel par le
     * slot scopé `cellule` (§6.3 de `0010`). Les jours fermés n'ont « aucune
     * cellule active » : éléments et sous-couverture y sont vidés.
     *
     * `editable`/`ajoutable` (feature 0011, tâche 3) : `editable` reflète
     * `editableEffectif` (retirer un élément reste possible même sur une
     * case hors période, pour corriger une affectation existante) ;
     * `ajoutable` restreint en plus le bouton « Ajouter une personne » aux
     * cases ni fermées ni hors période (§7 — on ne crée pas d'affectation
     * qui serait immédiatement signalée).
     * @param {LigneGrille} ligne
     * @param {{date: string, jourIso: number, ferme: boolean, horsPeriode: boolean}} colonne
     * @returns {object}
     */
    celluleDescripteur(ligne, colonne) {
      const elements = colonne.ferme
        ? []
        : this.affectationsCellule(ligne, colonne.date).map((a) => this.construireElement(a));
      return {
        ligne,
        ligneType: this.orientation,
        date: colonne.date,
        jourIso: colonne.jourIso,
        elements,
        segments: colonne.ferme ? [] : this.segmentsCellule(ligne, colonne.date),
        concernee: colonne.ferme ? false : this.concerneeCellule(ligne, colonne.date),
        ferme: colonne.ferme,
        horsPeriode: colonne.horsPeriode,
        editable: this.editableEffectif,
        ajoutable: this.editableEffectif && !colonne.ferme && !colonne.horsPeriode,
      };
    },

    /**
     * Traduit l'événement élémentaire `ajouter-ici` de `CellulePlanning` (qui
     * ne connaît que sa propre case) en événement **sémantique** `ajouter`,
     * enrichi du contexte de la case (tournée/date/segment) — §6.1/§6.4. Le
     * `segmentIndex` ciblé est celui du sous-groupe (vacation) sur lequel le
     * bouton a été cliqué, remonté par `CellulePlanning` — jamais saisi par
     * l'utilisateur. No-op si la tournée est introuvable.
     * @param {object} cellule - Descripteur de cellule (voir `celluleDescripteur`).
     * @param {{ segmentIndex: number }} payload
     */
    onAjouterIci(cellule, { segmentIndex }) {
      const tournee = this.tourneeParId(cellule.ligne.id);
      if (!tournee) return;
      this.$emit('ajouter', { tourneeId: cellule.ligne.id, date: cellule.date, segmentIndex });
    },

    /**
     * Démarrage d'un glisser (feature 0011, tâche 5) : mémorise l'affectation
     * en cours de glisse, remontée par `debut-glisser` de `CellulePlanning`.
     * @param {{ affectationId: string }} payload
     */
    onDebutGlisser({ affectationId }) {
      this.affectationEnGlissement = affectationId;
    },

    /**
     * Fin d'un glisser (déposé ou abandonné) : efface l'état de glisse et le
     * repère de cible.
     */
    onFinGlisser() {
      this.affectationEnGlissement = null;
      this.celluleCible = null;
    },

    /**
     * `true` si `cellule` est la case actuellement survolée comme cible de
     * dépôt valide (repère visuel §6.3, bordure + fond léger, jamais la
     * seule couleur).
     * @param {object} cellule - Descripteur de cellule (voir `celluleDescripteur`).
     * @returns {boolean}
     */
    estCibleDepot(cellule) {
      return (
        !!this.celluleCible &&
        this.celluleCible.tourneeId === cellule.ligne.id &&
        this.celluleCible.date === cellule.date
      );
    },

    /**
     * Survol d'une case pendant un glisser-déposer : autorise le dépôt
     * (`preventDefault`) et met à jour le repère de cible, **uniquement**
     * si la case est éditable (orientation Tournées, ni fermée ni hors
     * période — même condition que `cellule.ajoutable`). Les cases non
     * éligibles restent refusées par le comportement HTML5 par défaut
     * (curseur « interdit »), sans qu'il soit nécessaire de le vérifier
     * ailleurs.
     * @param {object} cellule
     * @param {DragEvent} event
     */
    onSurvolCellule(cellule, event) {
      if (!cellule.ajoutable) return;
      event.preventDefault();
      this.celluleCible = { tourneeId: cellule.ligne.id, date: cellule.date };
    },

    /**
     * Dépôt d'une affectation glissée sur une vacation d'une case (événement
     * `deposer-ici` remonté par `CellulePlanning`, feature 0016 : la case
     * elle-même ne suffit plus à cibler une position, il faut le segment du
     * sous-groupe sur lequel le dépôt a eu lieu) : traduit l'événement
     * élémentaire en événement **sémantique** `deplacer`. Ignore le dépôt :
     * hors glisse, sur une case non éligible (`!cellule.ajoutable` — fermée,
     * hors période, ou hors mode édition), ou sur le **même** slot exact
     * (tournée + date + segment) que l'affectation glissée.
     * @param {object} cellule - Descripteur de cellule (voir `celluleDescripteur`).
     * @param {{ segmentIndex: number }} payload
     */
    onDeposer(cellule, { segmentIndex }) {
      this.celluleCible = null;

      const affectationId = this.affectationEnGlissement;
      if (!affectationId || !cellule.ajoutable) return;

      const source = this.planning.affectations.find((a) => a.id === affectationId);
      if (
        source &&
        source.tourneeId === cellule.ligne.id &&
        source.date === cellule.date &&
        source.segmentIndex === segmentIndex
      ) {
        return;
      }

      const tournee = this.tourneeParId(cellule.ligne.id);
      if (!tournee) return;

      this.$emit('deplacer', {
        affectationId,
        versTourneeId: cellule.ligne.id,
        versDate: cellule.date,
        versSegmentIndex: segmentIndex,
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.grille-planning-scroll {
  overflow-x: auto;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;

  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: 2px;
  }
}

.grille-planning-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.grille-planning-legende {
  caption-side: top;
  padding: t.$espace-2 t.$espace-3;
  text-align: left;
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

// Colonne figée (première colonne, en-tête de ligne compris) : reste visible
// pendant le défilement horizontal, notamment en échelle Mois. Fond opaque
// obligatoire pour ne pas laisser transparaître le contenu qui défile dessous.
.grille-planning-colonne-figee {
  position: sticky;
  left: 0;
  z-index: 1;
  background-color: t.$couleur-fond-clair;
}

.grille-planning-coin,
.grille-planning-entete-jour {
  padding: t.$espace-2;
  border-bottom: 1px solid t.$couleur-bordure;
  background-color: t.$couleur-fond-clair;
  text-align: left;
  vertical-align: bottom;
  white-space: nowrap;
}

.grille-planning-entete-jour {
  min-width: 140px;

  &--fermee {
    background-color: t.$couleur-bordure;
    color: t.$couleur-texte-attenue;
  }

  &--hors-periode {
    color: t.$couleur-texte-attenue;
  }
}

.grille-planning-jour-nom {
  display: block;
  font-weight: t.$graisse-gras;
}

.grille-planning-jour-date {
  display: block;
  font-size: t.$taille-texte-petite;
}

.grille-planning-jour-statut {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  margin-top: t.$espace-1;
  font-size: t.$taille-texte-petite;

  &--attenue {
    font-style: italic;
  }
}

// `display: table-cell` explicite : ce `<th scope="row">` doit rester un
// vrai cellule de tableau (sémantique Safari/VoiceOver) — la mise en page
// pastille + nom + icône est déplacée sur `.grille-planning-entete-ligne-contenu`.
.grille-planning-entete-ligne {
  display: table-cell;
  padding: t.$espace-2;
  min-width: 160px;
  max-width: 240px;
  border-bottom: 1px solid t.$couleur-bordure;
  border-right: 1px solid t.$couleur-bordure;
  font-weight: t.$graisse-gras;
  text-align: left;

  &--concernee-erreur {
    background-color: rgba(t.$couleur-erreur, 0.08);
    border-left: 3px solid t.$couleur-erreur;
  }

  &--concernee-avertissement {
    background-color: rgba(t.$couleur-avertissement, 0.1);
    border-left: 3px dashed t.$couleur-avertissement;
  }
}

.grille-planning-entete-ligne-contenu {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
}

.grille-planning-pastille {
  flex-shrink: 0;
  width: t.$espace-3;
  height: t.$espace-3;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
}

.grille-planning-nom-ligne {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: break-word;
}

// Texte réservé aux lecteurs d'écran (icône de conflit déjà `aria-hidden`,
// accompagnée d'un libellé explicite pour les technologies d'assistance).
.grille-planning-texte-invisible {
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

.grille-planning-cellule {
  padding: 0;
  min-width: 140px;
  vertical-align: top;
  border-bottom: 1px solid t.$couleur-bordure;
  border-right: 1px solid t.$couleur-bordure;
}

// Repère visuel de la case survolée comme cible de dépôt pendant un
// glisser-déposer (feature 0011, tâche 5) : bordure marquée + fond léger
// (jamais la seule couleur), retiré à la fin de la glisse. `outline` (plutôt
// que `border`) pour ne pas perturber la géométrie de la grille.
.grille-planning-cellule--cible-depot {
  background-color: rgba(t.$couleur-primaire, 0.12);
  outline: 3px dashed t.$couleur-primaire-foncee;
  outline-offset: -3px;
}
</style>
