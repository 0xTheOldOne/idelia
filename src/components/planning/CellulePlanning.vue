<template>
  <div
    class="cellule-planning"
    :class="{
      'cellule-planning--fermee': ferme,
      'cellule-planning--hors-periode': !ferme && horsPeriode,
      'cellule-planning--concernee-erreur': !ferme && concernee === 'erreur',
      'cellule-planning--concernee-avertissement': !ferme && concernee === 'avertissement',
    }"
  >
    <span v-if="ferme" class="cellule-planning-fermee">Fermé</span>

    <template v-else>
      <p
        v-if="concernee"
        class="cellule-planning-alerte"
        :class="`cellule-planning-alerte--${concernee}`"
      >
        <PhWarningOctagon v-if="concernee === 'erreur'" :size="14" weight="bold" aria-hidden="true" />
        <PhWarning v-else :size="14" weight="bold" aria-hidden="true" />
        <span>{{ concernee === 'erreur' ? 'Conflit' : 'Point d’attention' }}</span>
      </p>

      <div
        v-for="groupe in groupesAffiches"
        :key="groupe.index ?? 'unique'"
        class="cellule-planning-groupe"
        :class="{ 'cellule-planning-groupe--cible-depot': groupeSurvoleIndex === groupe.index }"
        @dragover="onSurvolGroupe(groupe, $event)"
        @dragleave="onQuitterGroupe(groupe, $event)"
        @drop="onDeposerGroupe(groupe, $event)"
      >
        <p v-if="groupe.libelleVacation" class="cellule-planning-groupe-titre">
          {{ groupe.libelleVacation }} {{ groupe.horaires }}
        </p>

        <ul v-if="groupe.elements.length" class="cellule-planning-elements">
          <li
            v-for="element in groupe.elements"
            :key="element.id"
            class="cellule-planning-element"
            :draggable="editable ? true : null"
            @dragstart="onDebutGlisser(element, $event)"
            @dragend="$emit('fin-glisser')"
          >
            <span
              class="cellule-planning-pastille"
              :style="{ backgroundColor: element.couleur }"
              aria-hidden="true"
            />
            <span class="cellule-planning-libelles">
              <span class="cellule-planning-libelle-principal">{{ element.libellePrincipal }}</span>
              <span v-if="element.libelleSecondaire" class="cellule-planning-libelle-secondaire">
                {{ element.libelleSecondaire }}
              </span>
              <span v-if="element.verrouillee" class="cellule-planning-repere-verrou">
                <PhLockSimple :size="12" weight="bold" aria-hidden="true" />
                <span>Verrouillée</span>
              </span>
            </span>
            <span v-if="editable" class="cellule-planning-actions-element">
              <button
                type="button"
                class="btn btn-outline-secondary cellule-planning-bouton-verrouiller"
                :aria-label="element.verrouillee ? 'Déverrouiller cette affectation' : 'Verrouiller cette affectation'"
                :title="element.verrouillee ? 'Déverrouiller cette affectation' : 'Verrouiller cette affectation'"
                @click="$emit('verrouiller', { affectationId: element.id })"
              >
                <PhLockSimple v-if="element.verrouillee" :size="14" weight="bold" aria-hidden="true" />
                <PhLockSimpleOpen v-else :size="14" weight="bold" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="btn btn-outline-danger cellule-planning-bouton-retirer"
                :aria-label="`Retirer ${element.libellePrincipal} de cette case`"
                :title="`Retirer ${element.libellePrincipal} de cette case`"
                @click="onRetirer(element)"
              >
                <PhX :size="14" weight="bold" aria-hidden="true" />
              </button>
            </span>
          </li>
        </ul>

        <p v-if="groupe.sousCouverture" class="cellule-planning-sous-couverture">
          <PhWarningCircle :size="16" weight="fill" aria-hidden="true" />
          <span>
            Il manque {{ groupe.sousCouverture.manque }}
            personne{{ groupe.sousCouverture.manque > 1 ? 's' : '' }}
          </span>
        </p>

        <button
          v-if="ajoutable"
          ref="boutonAjouter"
          type="button"
          class="btn btn-outline-primary btn-sm cellule-planning-bouton-ajouter"
          :aria-label="groupe.libelleVacation ? `Ajouter une personne — ${groupe.libelleVacation} ${groupe.horaires}` : 'Ajouter une personne'"
          @click="$emit('ajouter-ici', { segmentIndex: groupe.index })"
        >
          <PhUserPlus :size="16" aria-hidden="true" />
          <span>Ajouter une personne</span>
        </button>
      </div>

      <span v-if="horsPeriode" class="cellule-planning-hors-periode-texte">Hors période</span>
    </template>
  </div>
</template>

<script>
import {
  PhWarning,
  PhWarningCircle,
  PhWarningOctagon,
  PhX,
  PhUserPlus,
  PhLockSimple,
  PhLockSimpleOpen,
} from '@phosphor-icons/vue';

/**
 * Rendu **présentational** d'une cellule de `GrillePlanning` (feature 0010) :
 * liste d'éléments déjà résolus (pastille couleur + nom, avec libellé
 * secondaire optionnel comme les horaires) regroupés **par vacation**
 * (feature 0016, ADR 0017 — voir prop `segments`), marqueur de
 * sous-couverture et drapeau « concernée par un conflit ». Ne calcule rien :
 * `GrillePlanning` lui fournit des données déjà prêtes à afficher (aucune
 * règle métier ici).
 *
 * Regroupement par vacation (feature 0016) : `groupesAffiches` répartit
 * `elements` (via leur `segmentIndex`) selon les `segments` fournis par
 * `GrillePlanning` (un par segment de la tournée, en orientation Tournées
 * uniquement). **Une tournée complète n'a qu'un seul segment** : le groupe
 * résultant est **implicite** (aucun intitulé affiché), rendu **strictement
 * identique** à `0010`/`0011` (non-régression). **Une tournée coupée** en a
 * deux : chacun affiche un intitulé discret (« Matin 07:00–13:30 » / « Soir
 * 17:00–20:00 »), sa propre sous-couverture et son propre bouton « Ajouter
 * une personne ». En orientation Personnes (`segments` vide), un unique
 * groupe implicite regroupe tous les éléments (identique à `0010`).
 *
 * **Lecture seule par défaut** (`editable`/`ajoutable` à `false`, valeurs par
 * défaut) : rendu **strictement identique** à `0010`, aucun bouton, aucune
 * émission — invariant de non-régression de la feature `0011`. Quand
 * `editable` (feature 0011, tâche 3), chaque élément affiche un bouton
 * « Retirer » (icône + `aria-label`, aucun appel store ici : l'émission
 * `retirer` remonte jusqu'à `PlanningView` via `GrillePlanning`, seule à
 * dispatcher). Quand `ajoutable`, chaque groupe affiche un bouton « Ajouter
 * une personne » (`ajouter-ici`, enrichi du `segmentIndex` du groupe cliqué).
 *
 * Verrouillage (feature 0011, tâche 4) : un élément `verrouillee` affiche un
 * repère **permanent** cadenas (`PhLockSimple`) + libellé « Verrouillée »
 * (jamais la seule couleur) — visible **que la case soit éditable ou non**
 * (utile au référent même en lecture). Quand `editable`, chaque élément
 * porte en plus un **bouton de bascule** (`PhLockSimpleOpen` déverrouillée →
 * cliquer pour verrouiller ; `PhLockSimple` verrouillée → cliquer pour
 * déverrouiller), `aria-label` explicite, qui émet `verrouiller`. Aucun
 * bouton de bascule hors édition.
 *
 * Glisser-déposer natif (feature 0011, tâche 5, **surcouche** de confort au
 * clic — API HTML5 native, aucune dépendance) : quand `editable`, chaque
 * élément devient `draggable`. `dragstart` émet `debut-glisser` (identifie
 * l'affectation glissée) ; `dragend` émet `fin-glisser` (glisse terminée,
 * déposée ou abandonnée). Le **dépôt** (feature 0016) se produit au grain
 * **groupe/vacation** : chaque groupe capte son propre `drop` et remonte
 * `deposer-ici` avec le `segmentIndex` ciblé (`stopPropagation` pour éviter
 * un double traitement si plusieurs groupes sont imbriqués dans la même
 * case). `GrillePlanning` tient l'état de glisse et le repère visuel de la
 * case cible (grain cellule, §6.3 de `0011`) ; ce composant ne connaît que
 * sa propre case. Hors édition, aucun élément n'est `draggable` : rendu
 * strictement identique à `0010`.
 *
 * Surlignage local du groupe survolé (correctif ergonomie post-relecture,
 * feature 0016) : pendant un glisser-déposer, `dragover`/`dragleave` sur
 * chaque `.cellule-planning-groupe` posent/retirent un état local
 * (`groupeSurvoleIndex`), en plus du repère de cellule tenu par
 * `GrillePlanning` — désambiguïse la vacation ciblée dans une case coupée.
 * Pour une tournée complète (groupe implicite unique), le rendu reste
 * équivalent à aujourd'hui.
 *
 * Correctifs ergonomie (relecture post-0011) : les boutons verrouiller/
 * retirer portent un `title` (en plus de l'`aria-label`), pour l'infobulle
 * au survol (MAJ-3). Le clic sur « Retirer » (clic/clavier, pas le
 * glisser-déposer) replace ensuite le focus sur le bouton « Ajouter une
 * personne » du même groupe (même vacation), quand il existe (MAJ-2).
 */
export default {
  name: 'CellulePlanning',
  components: {
    PhWarning,
    PhWarningCircle,
    PhWarningOctagon,
    PhX,
    PhUserPlus,
    PhLockSimple,
    PhLockSimpleOpen,
  },
  props: {
    /**
     * Éléments déjà résolus à afficher (une affectation par élément).
     * `{ id: string, couleur: string, libellePrincipal: string, libelleSecondaire?: string, segmentIndex?: number, verrouillee?: boolean }`.
     * `segmentIndex` (feature 0016) sert au regroupement par vacation (voir
     * prop `segments`). `verrouillee` pilote le repère cadenas + libellé
     * « Verrouillée » (feature 0011, tâche 4), affiché que la case soit
     * éditable ou non.
     */
    elements: { type: Array, default: () => [] },
    /**
     * Descripteurs de vacation de la case (feature 0016, ADR 0017), un par
     * segment de la tournée (orientation Tournées uniquement) :
     * `{ index: number, libelleVacation: string, horaires: string, sousCouverture: ?{manque: number} }`.
     * Tableau **vide** en orientation Personnes ou case fermée : `elements`
     * forme alors un unique groupe implicite (rendu `0010` inchangé).
     */
    segments: { type: Array, default: () => [] },
    /**
     * Drapeau de surlignage : `false` (non concernée), `'erreur'` ou
     * `'avertissement'` selon la sévérité de la `Violation` la plus grave
     * ciblant cette cellule.
     */
    concernee: { type: [Boolean, String], default: false },
    /** `true` si la colonne (jour) est hors `joursOuverture` du cabinet. */
    ferme: { type: Boolean, default: false },
    /** `true` si la colonne (jour) est hors `[planning.dateDebut, planning.dateFin]`. */
    horsPeriode: { type: Boolean, default: false },
    /**
     * `true` en mode édition (feature 0011). Affiche un bouton « Retirer »
     * par élément. Par défaut `false` : rendu `0010` inchangé.
     */
    editable: { type: Boolean, default: false },
    /**
     * `true` si cette case accepte l'ajout d'une personne (édition, orientation
     * Tournées, case ni fermée ni hors période — calculé par `GrillePlanning`).
     * Affiche un bouton « Ajouter une personne » par groupe/vacation. Par
     * défaut `false`.
     */
    ajoutable: { type: Boolean, default: false },
  },
  emits: ['ajouter-ici', 'deposer-ici', 'retirer', 'verrouiller', 'debut-glisser', 'fin-glisser'],
  data() {
    return {
      /**
       * Indice du groupe/vacation actuellement survolé pendant un
       * glisser-déposer (correctif ergonomie post-relecture) : surlignage
       * local, plus fin que le repère de cellule (grain cellule) tenu par
       * `GrillePlanning`. `undefined` hors survol ; peut valoir `null` pour
       * le groupe implicite d'une tournée complète (`groupe.index` vaut
       * alors `null`), d'où l'usage d'`undefined` — et non `null` — comme
       * valeur « aucun survol », pour ne jamais les confondre.
       * @type {number|null|undefined}
       */
      groupeSurvoleIndex: undefined,
    };
  },
  computed: {
    /**
     * Groupes affichés : un par vacation (`segments`), chacun filtré sur ses
     * propres `elements` (par `segmentIndex`). Quand `segments` est vide
     * (orientation Personnes, ou case fermée), un unique groupe **implicite**
     * (sans intitulé) regroupe tous les `elements` — rendu identique à
     * `0010` (aucun changement visible pour une tournée complète ni pour
     * l'orientation Personnes).
     * @returns {Array<{index: (number|null), libelleVacation: string, horaires: string, sousCouverture: ?{manque: number}, elements: object[]}>}
     */
    groupesAffiches() {
      if (this.segments.length === 0) {
        return [{ index: null, libelleVacation: '', horaires: '', sousCouverture: null, elements: this.elements }];
      }
      return this.segments.map((segment) => ({
        ...segment,
        elements: this.elements.filter((element) => element.segmentIndex === segment.index),
      }));
    },
  },
  methods: {
    /**
     * Démarre le glisser-déposer d'un élément (feature 0011, tâche 5) :
     * émet `debut-glisser` avec l'identifiant de l'affectation glissée.
     * `dataTransfer` reçoit l'id en texte brut (robustesse inter-navigateurs
     * pour l'initiation du glisser), même si `GrillePlanning` s'appuie sur
     * l'événement Vue (pas sur `dataTransfer`) pour retrouver l'affectation.
     * @param {{ id: string }} element
     * @param {DragEvent} event
     */
    onDebutGlisser(element, event) {
      event.dataTransfer?.setData('text/plain', element.id);
      this.$emit('debut-glisser', { affectationId: element.id });
    },

    /**
     * Survol d'un groupe/vacation pendant un glisser-déposer (correctif
     * ergonomie post-relecture) : autorise le dépôt et pose un surlignage
     * **local à ce groupe**, plus fin que le repère de cellule (grain
     * cellule) déjà tenu par `GrillePlanning`. **No-op si `!ajoutable`** :
     * ne pas appeler `preventDefault`/`stopPropagation` laisse alors
     * l'événement remonter jusqu'à `GrillePlanning`, qui refuse le dépôt
     * comme avant (case fermée, hors période, ou hors édition) — le grain
     * fin ne doit jamais élargir les cases où un dépôt est possible.
     * `stopPropagation` (cas autorisé) : ce `dragover` ne doit pas être
     * retraité par un groupe englobant.
     * @param {{ index: (number|null) }} groupe
     * @param {DragEvent} event
     */
    onSurvolGroupe(groupe, event) {
      if (!this.ajoutable) return;
      event.preventDefault();
      event.stopPropagation();
      this.groupeSurvoleIndex = groupe.index;
    },

    /**
     * Sortie du survol d'un groupe : efface le surlignage local, sauf si la
     * sortie se fait vers un **descendant** du groupe (`dragleave` se
     * déclenche aussi en entrant dans un enfant) — évite un clignotement du
     * repère pendant que le pointeur reste dans le même groupe.
     * @param {{ index: (number|null) }} groupe
     * @param {DragEvent} event
     */
    onQuitterGroupe(groupe, event) {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      if (this.groupeSurvoleIndex === groupe.index) {
        this.groupeSurvoleIndex = undefined;
      }
    },

    /**
     * Dépôt d'une affectation glissée sur ce groupe/vacation (feature 0016) :
     * autorise le dépôt et empêche sa propagation (un seul groupe doit le
     * traiter), efface le surlignage local, puis émet `deposer-ici` avec le
     * `segmentIndex` du groupe ciblé — `GrillePlanning` traduit en événement
     * sémantique `deplacer`. **No-op si `!ajoutable`** (garde-fou, en pratique
     * le navigateur ne déclenche déjà pas `drop` ici dans ce cas, faute de
     * `preventDefault` posé par `onSurvolGroupe`).
     * @param {{ index: (number|null) }} groupe
     * @param {DragEvent} event
     */
    onDeposerGroupe(groupe, event) {
      if (!this.ajoutable) return;
      event.preventDefault();
      event.stopPropagation();
      this.groupeSurvoleIndex = undefined;
      this.$emit('deposer-ici', { segmentIndex: groupe.index });
    },

    /**
     * Retire un élément de la case (bouton « Retirer », clic/clavier
     * uniquement — ne concerne pas le glisser-déposer) : émet `retirer`,
     * puis replace le focus clavier sur le bouton « Ajouter une personne »
     * du même groupe (même vacation) une fois le DOM mis à jour, quand
     * celui-ci existe (case éditable et ajoutable). Évite que l'utilisateur
     * clavier ne reparte de `<body>` après la disparition du bouton cliqué
     * (correctif ergonomie MAJ-2, feature 0011).
     * @param {{ id: string, segmentIndex?: number }} element
     */
    onRetirer(element) {
      this.$emit('retirer', { affectationId: element.id });
      this.$nextTick(() => {
        const boutons = this.$refs.boutonAjouter;
        if (!boutons) return;
        const liste = Array.isArray(boutons) ? boutons : [boutons];
        const indexGroupe = this.groupesAffiches.findIndex((g) => g.index === element.segmentIndex);
        const cible = liste[indexGroupe] ?? liste[0];
        cible?.focus();
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.cellule-planning {
  display: flex;
  flex-direction: column;
  gap: t.$espace-1;
  min-height: t.$cible-cliquable-min;
  padding: t.$espace-1;
  border-radius: t.$rayon-sm;

  &--fermee {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &--hors-periode {
    opacity: 0.7;
  }

  // Surlignage multi-canal (bordure + fond + icône, jamais la seule couleur) :
  // erreurs (dures) et avertissements (souples) distingués par teinte ET icône.
  &--concernee-erreur {
    background-color: rgba(t.$couleur-erreur, 0.08);
    border: 2px solid t.$couleur-erreur;
  }

  &--concernee-avertissement {
    background-color: rgba(t.$couleur-avertissement, 0.1);
    border: 2px dashed t.$couleur-avertissement;
  }
}

.cellule-planning-fermee {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
  font-style: italic;
}

.cellule-planning-alerte {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  margin: 0;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;

  &--erreur {
    color: t.$couleur-erreur;
  }

  &--avertissement {
    color: t.$couleur-avertissement-texte;
  }
}

// Regroupe une vacation entière (intitulé + éléments + sous-couverture +
// bouton ajouter). Une tournée complète n'a qu'un seul groupe, sans bordure
// ni intitulé visible (implicite) : espacement identique à `0010`.
.cellule-planning-groupe {
  display: flex;
  flex-direction: column;
  gap: t.$espace-1;
  border-radius: t.$rayon-sm;

  & + .cellule-planning-groupe {
    padding-top: t.$espace-2;
    margin-top: t.$espace-1;
    border-top: 1px dashed t.$couleur-bordure;
  }
}

// Surlignage local du groupe/vacation survolé pendant un glisser-déposer
// (correctif ergonomie post-relecture) : plus fin que le repère de cellule
// (grain cellule, `grille-planning-cellule--cible-depot`) tenu par
// `GrillePlanning` — réutilise la même teinte. Pour une tournée complète
// (groupe implicite unique, occupant toute la case), le rendu reste
// équivalent au repère de cellule existant.
.cellule-planning-groupe--cible-depot {
  background-color: rgba(t.$couleur-primaire, 0.12);
  outline: 2px dashed t.$couleur-primaire-foncee;
  outline-offset: 2px;
}

// Intitulé discret d'une vacation (« Matin 07:00–13:30 »), jamais la seule
// couleur pour distinguer matin/soir (texte explicite systématique).
.cellule-planning-groupe-titre {
  margin: 0;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  font-style: italic;
}

.cellule-planning-elements {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-1;
}

.cellule-planning-element {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-1;
}

.cellule-planning-pastille {
  flex-shrink: 0;
  width: t.$espace-3;
  height: t.$espace-3;
  margin-top: 0.2em;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
}

.cellule-planning-libelles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cellule-planning-libelle-principal {
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  word-break: break-word;
}

.cellule-planning-libelle-secondaire {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

// Repère **permanent** d'une affectation verrouillée : cadenas + libellé
// (jamais la seule couleur), visible que la case soit éditable ou non.
.cellule-planning-repere-verrou {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  margin-top: t.$espace-1;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
  font-style: italic;
}

// Regroupe les boutons d'action par élément (verrouiller, retirer).
.cellule-planning-actions-element {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  margin-left: auto;
}

// Boutons d'action par élément : icône seule (accompagnée d'un
// `aria-label`, jamais réduite à une icône « nue » au sens accessibilité),
// cible cliquable confortable malgré la densité de la liste.
.cellule-planning-bouton-retirer,
.cellule-planning-bouton-verrouiller {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;
  padding: 0;
}

.cellule-planning-sous-couverture {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  margin: 0;
  color: t.$couleur-avertissement-texte;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
}

.cellule-planning-hors-periode-texte {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
  font-style: italic;
}

// Bouton « Ajouter une personne » : toujours visible (jamais réservé au
// survol, inutilisable au tactile/clavier sinon), icône + libellé en clair.
.cellule-planning-bouton-ajouter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: t.$espace-1;
  min-height: t.$cible-cliquable-min;
  width: 100%;
}
</style>
