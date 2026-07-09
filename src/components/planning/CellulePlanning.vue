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

      <ul v-if="elements.length" class="cellule-planning-elements">
        <li
          v-for="element in elements"
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

      <p v-if="sousCouverture" class="cellule-planning-sous-couverture">
        <PhWarningCircle :size="16" weight="fill" aria-hidden="true" />
        <span>
          Il manque {{ sousCouverture.manque }}
          personne{{ sousCouverture.manque > 1 ? 's' : '' }}
        </span>
      </p>

      <button
        v-if="ajoutable"
        ref="boutonAjouter"
        type="button"
        class="btn btn-outline-primary btn-sm cellule-planning-bouton-ajouter"
        @click="$emit('ajouter-ici')"
      >
        <PhUserPlus :size="16" aria-hidden="true" />
        <span>Ajouter une personne</span>
      </button>

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
 * Rendu **présentational** d'une cellule de `GrillePlanning` (feature 010) :
 * liste d'éléments déjà résolus (pastille couleur + nom, avec libellé
 * secondaire optionnel comme le créneau), marqueur de sous-couverture et
 * drapeau « concernée par un conflit ». Ne calcule rien : `GrillePlanning`
 * lui fournit des données déjà prêtes à afficher (aucune règle métier ici).
 *
 * **Lecture seule par défaut** (`editable`/`ajoutable` à `false`, valeurs par
 * défaut) : rendu **strictement identique** à `010`, aucun bouton, aucune
 * émission — invariant de non-régression de la feature `011`. Quand
 * `editable` (feature 011, tâche 3), chaque élément affiche un bouton
 * « Retirer » (icône + `aria-label`, aucun appel store ici : l'émission
 * `retirer` remonte jusqu'à `PlanningView` via `GrillePlanning`, seule à
 * dispatcher). Quand `ajoutable`, un bouton « Ajouter une personne » clôt la
 * case (icône + libellé visible).
 *
 * Verrouillage (feature 011, tâche 4) : un élément `verrouillee` affiche un
 * repère **permanent** cadenas (`PhLockSimple`) + libellé « Verrouillée »
 * (jamais la seule couleur) — visible **que la case soit éditable ou non**
 * (utile au référent même en lecture). Quand `editable`, chaque élément
 * porte en plus un **bouton de bascule** (`PhLockSimpleOpen` déverrouillée →
 * cliquer pour verrouiller ; `PhLockSimple` verrouillée → cliquer pour
 * déverrouiller), `aria-label` explicite, qui émet `verrouiller`. Aucun
 * bouton de bascule hors édition.
 *
 * Glisser-déposer natif (feature 011, tâche 5, **surcouche** de confort au
 * clic — API HTML5 native, aucune dépendance) : quand `editable`, chaque
 * élément devient `draggable`. `dragstart` émet `debut-glisser` (identifie
 * l'affectation glissée) ; `dragend` émet `fin-glisser` (glisse terminée,
 * déposée ou abandonnée). `GrillePlanning` tient l'état de glisse et les
 * zones de dépôt ; ce composant ne connaît que sa propre case. Hors édition,
 * aucun élément n'est `draggable` : rendu strictement identique à `010`.
 *
 * Correctifs ergonomie (relecture post-011) : les boutons verrouiller/
 * retirer portent un `title` (en plus de l'`aria-label`), pour l'infobulle
 * au survol (MAJ-3). Le clic sur « Retirer » (clic/clavier, pas le
 * glisser-déposer) replace ensuite le focus sur le bouton « Ajouter une
 * personne » de la même case, quand il existe (MAJ-2).
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
     * `{ id: string, couleur: string, libellePrincipal: string, libelleSecondaire?: string, verrouillee?: boolean }`.
     * `verrouillee` pilote le repère cadenas + libellé « Verrouillée »
     * (feature 011, tâche 4), affiché que la case soit éditable ou non.
     */
    elements: { type: Array, default: () => [] },
    /**
     * Sous-couverture de la tournée ce jour (orientation Tournées
     * uniquement), ou `null` si la couverture est suffisante.
     * `{ manque: number }` — `NonCouverture.manque`, toujours ≥ 1 ici.
     */
    sousCouverture: { type: Object, default: null },
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
     * `true` en mode édition (feature 011). Affiche un bouton « Retirer »
     * par élément. Par défaut `false` : rendu `010` inchangé.
     */
    editable: { type: Boolean, default: false },
    /**
     * `true` si cette case accepte l'ajout d'une personne (édition, orientation
     * Tournées, case ni fermée ni hors période — calculé par `GrillePlanning`).
     * Affiche le bouton « Ajouter une personne ». Par défaut `false`.
     */
    ajoutable: { type: Boolean, default: false },
  },
  emits: ['ajouter-ici', 'retirer', 'verrouiller', 'debut-glisser', 'fin-glisser'],
  methods: {
    /**
     * Démarre le glisser-déposer d'un élément (feature 011, tâche 5) :
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
     * Retire un élément de la case (bouton « Retirer », clic/clavier
     * uniquement — ne concerne pas le glisser-déposer) : émet `retirer`,
     * puis replace le focus clavier sur le bouton « Ajouter une personne »
     * de la même case une fois le DOM mis à jour, quand celui-ci existe
     * (case éditable et ajoutable). Évite que l'utilisateur clavier ne
     * reparte de `<body>` après la disparition du bouton cliqué (correctif
     * ergonomie MAJ-2, feature 011).
     * @param {{ id: string }} element
     */
    onRetirer(element) {
      this.$emit('retirer', { affectationId: element.id });
      this.$nextTick(() => {
        this.$refs.boutonAjouter?.focus();
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
