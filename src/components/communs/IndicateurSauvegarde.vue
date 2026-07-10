<template>
  <p
    class="indicateur-sauvegarde"
    :class="compact ? classeCompact : classeStatut"
    :aria-label="compact ? libelleCompactComplet : null"
    :title="compact ? libelleCompactComplet : null"
    aria-live="polite"
  >
    <template v-if="compact">
      <PhWarning
        v-if="categorieCompact === 'erreur'"
        :size="16"
        weight="fill"
        aria-hidden="true"
        class="indicateur-sauvegarde__icone-erreur"
      />
      <span class="indicateur-sauvegarde__pastille" aria-hidden="true"></span>
      <span class="indicateur-sauvegarde__texte">{{ libelleCompact }}</span>
    </template>
    <template v-else-if="statut === 'EN_COURS'">
      <PhFloppyDisk :size="20" aria-hidden="true" />
      <span>Enregistrement…</span>
    </template>
    <template v-else-if="statut === 'ENREGISTRE' && apresEdition">
      <PhCheckCircle :size="20" weight="fill" aria-hidden="true" />
      <span>Modifications enregistrées dans ce navigateur<template v-if="texteDate">{{ texteDate }}</template></span>
    </template>
    <template v-else-if="statut === 'ENREGISTRE'">
      <PhCheckCircle :size="20" aria-hidden="true" />
      <span>Vos réglages sont enregistrés dans ce navigateur<template v-if="texteDate">{{ texteDate }}</template></span>
    </template>
    <template v-else-if="statut === 'ERREUR'">
      <PhWarning :size="20" weight="fill" aria-hidden="true" />
      <span>
        L'enregistrement a échoué. Vos données restent affichées à l'écran ; réessayez de modifier
        un réglage.
      </span>
    </template>
    <template v-else-if="statut === 'INACTIF'">
      <span>Aucune modification enregistrée pour l'instant.</span>
    </template>
    <template v-else-if="statut === 'ERREUR_CHARGEMENT'">
      <PhWarning :size="20" weight="fill" aria-hidden="true" />
      <span>
        Vos données n'ont pas pu être relues ; rechargez la page ou réimportez une sauvegarde.
      </span>
    </template>
  </p>
</template>

<script>
import { PhCheckCircle, PhFloppyDisk, PhWarning } from '@phosphor-icons/vue';

import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Indicateur de sauvegarde — composant présentational réutilisable.
 *
 * N'accède jamais au store : reçoit son état via des props, alimentées par
 * l'écran appelant (`mapState` racine sur `statutSauvegarde`/`derniereSauvegarde`).
 *
 * La prop `apresEdition` distingue une sauvegarde consécutive à une **vraie
 * action utilisateur** (« Modifications enregistrées ») d'un état
 * `ENREGISTRE` simplement hérité du chargement de l'écran (« Vos réglages
 * sont enregistrés ») — évite de sous-entendre une action que l'utilisateur
 * n'a pas faite.
 *
 * Accessibilité : la zone est en `aria-live="polite"` pour annoncer le
 * changement de statut ; l'icône est `aria-hidden` car toujours doublée
 * d'un libellé texte (aucune information portée par la seule couleur).
 *
 * La prop `compact` bascule vers une variante réduite (pastille colorée +
 * libellé court), destinée au pied du menu latéral (feature 0015) : replié,
 * seule la pastille reste visible (le texte est masqué par le composant
 * appelant via CSS, comme les libellés d'items) ; `aria-label`/`title` sur la
 * racine portent alors le libellé complet, et — en cas d'erreur — une icône
 * `PhWarning` se substitue à la pastille pour ne jamais reposer sur la seule
 * couleur, même repliée. Cette bascule pastille/icône selon l'état
 * replié/déplié est pilotée par CSS (classes `.indicateur-sauvegarde__*`),
 * le composant restant présentational et ignorant tout du menu.
 */
export default {
  name: 'IndicateurSauvegarde',
  components: { PhCheckCircle, PhFloppyDisk, PhWarning },
  props: {
    /** Statut courant : `INACTIF|EN_COURS|ENREGISTRE|ERREUR|ERREUR_CHARGEMENT`. */
    statut: { type: String, required: true },
    /** Horodatage ISO UTC de la dernière écriture réussie, ou `null`. */
    derniereSauvegarde: { type: String, default: null },
    /**
     * `true` si le statut `ENREGISTRE` courant fait suite à une modification
     * réellement saisie par l'utilisateur (et non à l'hydratation initiale
     * de l'écran).
     */
    apresEdition: { type: Boolean, default: false },
    /** `true` pour la variante compacte (pastille + libellé court). */
    compact: { type: Boolean, default: false },
  },
  computed: {
    classeStatut() {
      if (this.statut === 'ENREGISTRE' && this.apresEdition) return 'indicateur-sauvegarde--succes';
      if (this.statut === 'ERREUR' || this.statut === 'ERREUR_CHARGEMENT') {
        return 'indicateur-sauvegarde--erreur';
      }
      return 'indicateur-sauvegarde--neutre';
    },
    texteDate() {
      const texte = dateUtil.formatHorodatageFr(this.derniereSauvegarde);
      return texte ? ` le ${texte}` : '';
    },
    /**
     * Catégorie sémantique à 3 valeurs de l'état, pour la variante compacte
     * (contrairement à `classeStatut`, indépendante de `apresEdition` : la
     * variante compacte ne distingue pas « suite à une modification » de
     * « hérité du chargement »).
     * @returns {'succes'|'attention'|'erreur'}
     */
    categorieCompact() {
      if (this.statut === 'EN_COURS') return 'attention';
      if (this.statut === 'ERREUR' || this.statut === 'ERREUR_CHARGEMENT') return 'erreur';
      return 'succes';
    },
    classeCompact() {
      return `indicateur-sauvegarde--compact indicateur-sauvegarde--compact-${this.categorieCompact}`;
    },
    /** Heure courte `"HH:mm"` de la dernière sauvegarde, ou chaîne vide. */
    heureCompacte() {
      return dateUtil.formatHeureFr(this.derniereSauvegarde);
    },
    /** Libellé court affiché en variante compacte déplié. */
    libelleCompact() {
      if (this.statut === 'EN_COURS') return 'Enregistrement…';
      if (this.statut === 'ERREUR' || this.statut === 'ERREUR_CHARGEMENT') {
        return 'Échec de sauvegarde';
      }
      return this.heureCompacte ? `Sauvegardé · ${this.heureCompacte}` : 'Non enregistré';
    },
    /**
     * Libellé complet (aria-label/title) de la variante compacte — porte à
     * lui seul l'information quand replié ne laisse voir que la pastille.
     */
    libelleCompactComplet() {
      if (this.statut === 'EN_COURS') return 'Enregistrement en cours';
      if (this.statut === 'ERREUR' || this.statut === 'ERREUR_CHARGEMENT') {
        return 'Échec de sauvegarde';
      }
      return this.heureCompacte
        ? `Sauvegardé dans ce navigateur à ${this.heureCompacte}`
        : 'Non enregistré';
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.indicateur-sauvegarde {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$espace-5;
  margin: 0 0 t.$espace-3;
  font-size: t.$taille-texte-petite;

  &--succes {
    color: t.$couleur-succes;
  }

  &--erreur {
    color: t.$couleur-erreur;
    font-weight: t.$graisse-gras;
  }

  &--neutre {
    color: t.$couleur-texte-attenue;
  }

  // -------------------------------------------------------------------
  // Variante compacte (pied du menu latéral, feature 0015) : pastille +
  // libellé court, sur le dégradé teal du menu. La bascule « replié » (ne
  // garder que la pastille, ou l'icône d'alerte en cas d'erreur) est
  // pilotée par le composant appelant (`MenuLateral`) via les classes
  // `.indicateur-sauvegarde__*` ci-dessous — ce composant reste
  // présentational et ignore tout du menu.
  &--compact {
    min-height: auto;
    margin: 0;
    color: t.$couleur-menu-texte;
    font-weight: t.$graisse-moyenne;
  }
}

.indicateur-sauvegarde__pastille {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  // Liseré clair pour détacher la pastille du dégradé, quelle que soit sa
  // teinte sémantique (même technique que `.menu-marque__pastille` du menu).
  box-shadow: 0 0 0 2px rgba(t.$couleur-texte-inverse, 0.35);
}

.indicateur-sauvegarde--compact-succes .indicateur-sauvegarde__pastille {
  background-color: t.$couleur-succes;
}

.indicateur-sauvegarde--compact-attention .indicateur-sauvegarde__pastille {
  background-color: t.$couleur-avertissement;
}

.indicateur-sauvegarde--compact-erreur .indicateur-sauvegarde__pastille {
  background-color: t.$couleur-erreur;
}

// Masquée par défaut : en compact déplié, le libellé texte porte déjà
// l'information d'échec (pas la seule couleur). Le menu la révèle
// (à la place de la pastille) uniquement replié.
.indicateur-sauvegarde__icone-erreur {
  display: none;
  flex-shrink: 0;
  color: t.$couleur-texte-inverse;
}

.indicateur-sauvegarde__texte {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
