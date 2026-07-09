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
        <li v-for="element in elements" :key="element.id" class="cellule-planning-element">
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

      <span v-if="horsPeriode" class="cellule-planning-hors-periode-texte">Hors période</span>
    </template>
  </div>
</template>

<script>
import { PhWarning, PhWarningCircle, PhWarningOctagon } from '@phosphor-icons/vue';

/**
 * Rendu **présentational** d'une cellule de `GrillePlanning` (feature 010) :
 * liste d'éléments déjà résolus (pastille couleur + nom, avec libellé
 * secondaire optionnel comme le créneau), marqueur de sous-couverture et
 * drapeau « concernée par un conflit ». Ne calcule rien : `GrillePlanning`
 * lui fournit des données déjà prêtes à afficher (aucune règle métier ici).
 *
 * **Lecture seule** en 010 : n'émet aucun événement. `011` enrichira cette
 * unité (poignées de glisser-déposer) sans changer sa responsabilité
 * d'affichage.
 */
export default {
  name: 'CellulePlanning',
  components: { PhWarning, PhWarningCircle, PhWarningOctagon },
  props: {
    /**
     * Éléments déjà résolus à afficher (une affectation par élément).
     * `{ id: string, couleur: string, libellePrincipal: string, libelleSecondaire?: string }`.
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
</style>
