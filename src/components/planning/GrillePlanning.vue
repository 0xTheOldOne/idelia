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
            >
              <slot name="cellule" v-bind="cellule">
                <CellulePlanning
                  :elements="cellule.elements"
                  :sous-couverture="cellule.sousCouverture"
                  :concernee="cellule.concernee"
                  :ferme="cellule.ferme"
                  :hors-periode="cellule.horsPeriode"
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
import { libelleJour, libelleCreneau } from '@/domain/libelles.js';

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
 */

/**
 * Composant central, en **lecture seule**, de visualisation d'un planning
 * (feature 010). Rend **toujours** une matrice lignes × jours (§6.1 du
 * plan) : l'échelle (`JOUR`/`SEMAINE`/`MOIS`) ne change que l'ensemble des
 * colonnes-jours, l'orientation (`TOURNEES`/`PERSONNES`) ne change que ce
 * que sont les lignes et le contenu d'une cellule.
 *
 * Ne fait **aucune dérivation métier** : la sous-couverture vient
 * directement de la prop `tourneesNonCouvertes` (jamais des violations), le
 * surlignage est un mapping purement présentational de `Violation.cible`
 * vers une cellule/un en-tête de ligne (§6.2). Aucun import de
 * `@/domain/scheduling` ici.
 *
 * Expose un **slot scopé `cellule`** (point de greffe `011`), dont le
 * contenu par défaut est `CellulePlanning`. **N'émet aucun événement
 * d'édition.**
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
  },
  computed: {
    ...mapGetters('tournees', { tourneesActives: 'actives', tourneeParId: 'byId' }),
    ...mapGetters('personnes', { personnesActives: 'actifs', personneParId: 'byId' }),
    ...mapGetters('cabinet', ['parametres']),

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
        nom: t.nom,
        couleur: t.couleur,
        archivee: false,
      }));
      const idsActifs = new Set(this.tourneesActives.map((t) => t.id));
      const idsReferences = new Set(this.planning.affectations.map((a) => a.tourneeId));
      const archivees = [...idsReferences]
        .filter((id) => !idsActifs.has(id))
        .map((id) => this.tourneeParId(id))
        .filter(Boolean)
        .map((t) => ({ id: t.id, nom: t.nom, couleur: t.couleur, archivee: true }));
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
     * Résout une `Affectation` en élément d'affichage (pastille + nom, +
     * créneau en orientation Personnes, masqué si `JOURNEE`).
     * @param {object} affectation
     * @returns {ElementCellule}
     */
    construireElement(affectation) {
      if (this.orientation === 'TOURNEES') {
        const personne = this.personneParId(affectation.personneId);
        if (!personne) {
          return { id: affectation.id, couleur: 'transparent', libellePrincipal: 'Personne inconnue' };
        }
        return {
          id: affectation.id,
          couleur: personne.couleur,
          libellePrincipal: `${personne.prenom} ${personne.nom}${personne.actif ? '' : ' (archivée)'}`,
        };
      }
      const tournee = this.tourneeParId(affectation.tourneeId);
      if (!tournee) {
        return { id: affectation.id, couleur: 'transparent', libellePrincipal: 'Tournée inconnue' };
      }
      return {
        id: affectation.id,
        couleur: tournee.couleur,
        libellePrincipal: `${tournee.nom}${tournee.archivee ? ' (archivée)' : ''}`,
        libelleSecondaire: affectation.creneau === 'JOURNEE' ? '' : libelleCreneau(affectation.creneau),
      };
    },

    /**
     * Sous-couverture d'une cellule, lue **directement** dans
     * `tourneesNonCouvertes` (jamais dérivée des violations). Uniquement en
     * orientation Tournées (§6.1).
     * @param {LigneGrille} ligne
     * @param {string} date
     * @returns {?{manque: number}}
     */
    sousCouvertureCellule(ligne, date) {
      if (this.orientation !== 'TOURNEES') return null;
      const entree = this.tourneesNonCouvertes.find((nc) => nc.tourneeId === ligne.id && nc.date === date);
      return entree ? { manque: entree.manque } : null;
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
     * slot scopé `cellule` (§6.3). Les jours fermés n'ont « aucune cellule
     * active » : éléments et sous-couverture y sont vidés.
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
        sousCouverture: colonne.ferme ? null : this.sousCouvertureCellule(ligne, colonne.date),
        concernee: colonne.ferme ? false : this.concerneeCellule(ligne, colonne.date),
        ferme: colonne.ferme,
        horsPeriode: colonne.horsPeriode,
      };
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
</style>
