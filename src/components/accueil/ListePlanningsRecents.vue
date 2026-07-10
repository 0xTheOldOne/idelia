<template>
  <section class="liste-plannings-recents" aria-labelledby="plannings-recents-titre">
    <h2 id="plannings-recents-titre">Plannings récents</h2>

    <div v-if="plannings.length === 0" class="plannings-recents-etat-vide">
      <PhCalendarBlank :size="40" aria-hidden="true" />
      <p class="mb-0">Aucun planning n'a encore été généré.</p>
      <router-link class="btn btn-primary plannings-recents-bouton" :to="{ name: 'planning' }">
        <PhCalendarPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Générer un planning</span>
      </router-link>
    </div>

    <ul v-else class="plannings-recents-liste">
      <li v-for="planning in plannings" :key="planning.id">
        <button
          type="button"
          class="plannings-recents-entree"
          @click="$emit('ouvrir', planning.id)"
        >
          <span class="plannings-recents-semaine">{{ semaineTexte(planning) }}</span>
          <span class="plannings-recents-dates">{{ datesTexte(planning) }}</span>
          <span class="badge-statut" :class="classeStatut(planning.statut)">
            <component :is="iconeStatut(planning.statut)" :size="16" weight="bold" aria-hidden="true" />
            <span>{{ libelleStatutPlanning(planning.statut) }}</span>
          </span>
          <span class="plannings-recents-meta">
            <component :is="metaEntree(planning).icone" :size="16" aria-hidden="true" />
            <span>{{ metaEntree(planning).texte }}</span>
          </span>
          <PhCaretRight :size="16" class="plannings-recents-chevron" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </section>
</template>

<script>
import {
  PhCalendarBlank,
  PhCalendarPlus,
  PhCaretRight,
  PhWarning,
  PhInfo,
  PhPaperPlaneTilt,
  PhPencilSimple,
  PhCheckCircle,
} from '@phosphor-icons/vue';

import { libelleStatutPlanning } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';

/** Icône Phosphor associée à chaque statut de planning (présentation uniquement). */
const ICONES_STATUT = {
  BROUILLON: PhPencilSimple,
  VALIDE: PhCheckCircle,
  PUBLIE: PhPaperPlaneTilt,
};

/**
 * Liste cliquable des « Plannings récents » (feature 0013, tableau de bord).
 *
 * **Présentational** : reçoit une liste déjà triée et plafonnée (choix de
 * présentation fait par l'écran appelant) ainsi qu'une carte de résumés de
 * conflits (`plannings/resumeConflits`, moteur pur appelé côté store — ce
 * composant ne fait qu'afficher les comptes déjà calculés). N'émet qu'un
 * événement `ouvrir(planningId)` : c'est à l'écran appelant de sélectionner
 * le planning (mutation `SELECT`) puis de naviguer vers l'éditeur.
 *
 * Chaque entrée montre la semaine (numéro ISO), les dates, le statut en
 * clair (icône + libellé) et une méta unique choisie par priorité (§6.1 du
 * plan) : points à résoudre > souhaits non tenus > diffusé > modifié le ...
 * Un planning absent de `resumeConflits` (hors périmètre d'évaluation)
 * retombe simplement sur les métas statut/temps, sans jamais générer d'erreur.
 */
export default {
  name: 'ListePlanningsRecents',
  components: {
    PhCalendarBlank,
    PhCalendarPlus,
    PhCaretRight,
    PhWarning,
    PhInfo,
    PhPaperPlaneTilt,
    PhPencilSimple,
    PhCheckCircle,
  },
  props: {
    /** Plannings récents, déjà triés/plafonnés par l'écran appelant. */
    plannings: { type: Array, default: () => [] },
    /**
     * Résumés de conflits par identifiant de planning, produits par l'action
     * `plannings/resumeConflits` : `{ [id]: { nbErreurs, nbAvertissements,
     * nbNonCouvertes, aResoudre } }`. Peut être incomplète (un planning
     * affiché peut ne pas y figurer).
     */
    resumeConflits: { type: Object, default: () => ({}) },
  },
  emits: ['ouvrir'],
  methods: {
    libelleStatutPlanning,

    /** @param {{statut: string}} planning @returns {object} Composant icône Phosphor. */
    iconeStatut(statut) {
      return ICONES_STATUT[statut] ?? PhCalendarBlank;
    },

    /** @param {string} statut @returns {string} Classe de modificateur BEM (`badge-statut--brouillon`, …). */
    classeStatut(statut) {
      return `badge-statut--${statut.toLowerCase()}`;
    },

    /** @param {{dateDebut: string}} planning @returns {string} `"Sem. N"`. */
    semaineTexte(planning) {
      return `Sem. ${dateUtil.numeroSemaineIso(planning.dateDebut)}`;
    },

    /** @param {{dateDebut: string, dateFin: string}} planning @returns {string} `"Du JJ/MM/AAAA au JJ/MM/AAAA"`. */
    datesTexte(planning) {
      return `Du ${dateUtil.formatDateFr(planning.dateDebut)} au ${dateUtil.formatDateFr(planning.dateFin)}`;
    },

    /**
     * Choisit la méta unique d'une entrée, du plus actionnable au plus
     * informatif (§6.1) : points à résoudre, sinon souhaits non tenus, sinon
     * diffusé, sinon modifié. `updatedAt`/`publieLe` sont des horodatages ISO
     * UTC (pas des dates calendaires) : formatés via `formatHorodatageFr`
     * (et non `formatDateFr`, réservé aux dates `"YYYY-MM-DD"`).
     * @param {object} planning
     * @returns {{icone: object, texte: string}}
     */
    metaEntree(planning) {
      const resume = this.resumeConflits[planning.id];

      if (resume && resume.aResoudre > 0) {
        return {
          icone: PhWarning,
          texte: `${resume.aResoudre} point${resume.aResoudre > 1 ? 's' : ''} à résoudre`,
        };
      }
      if (resume && resume.nbAvertissements > 0) {
        const n = resume.nbAvertissements;
        return {
          icone: PhInfo,
          texte: `${n} souhait${n > 1 ? 's' : ''} non tenu${n > 1 ? 's' : ''}`,
        };
      }
      if (planning.statut === 'PUBLIE') {
        const date = dateUtil.formatHorodatageFr(planning.publieLe);
        return {
          icone: PhPaperPlaneTilt,
          texte: date ? `Envoyé à l'équipe le ${date}` : "Envoyé à l'équipe",
        };
      }
      const modifie = dateUtil.formatHorodatageFr(planning.updatedAt);
      return {
        icone: PhPencilSimple,
        texte: modifie ? `Modifié le ${modifie}` : 'Modifié récemment',
      };
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.liste-plannings-recents {
  padding: t.$espace-4;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-lg;
}

.plannings-recents-etat-vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: t.$espace-3;
  padding: t.$espace-6 t.$espace-4;
  margin-top: t.$espace-3;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.plannings-recents-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.plannings-recents-liste {
  list-style: none;
  padding: 0;
  margin: t.$espace-3 0 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.plannings-recents-entree {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: t.$espace-2 t.$espace-3;
  width: 100%;
  min-height: t.$cible-cliquable-min;
  padding: t.$espace-3;
  background-color: t.$couleur-fond-clair;
  border: none;
  border-radius: t.$rayon-md;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: pointer;

  &:hover {
    background-color: t.$couleur-bordure;
  }
}

.plannings-recents-semaine {
  font-weight: t.$graisse-gras;
  flex-shrink: 0;
}

.plannings-recents-dates {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.plannings-recents-meta {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  margin-left: auto;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
  text-align: right;
}

.plannings-recents-chevron {
  flex-shrink: 0;
  color: t.$couleur-texte-attenue;
}

.badge-statut {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
  padding: t.$espace-1 t.$espace-2;
  border-radius: t.$rayon-sm;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  white-space: nowrap;

  &--brouillon {
    color: t.$couleur-texte-attenue;
    background-color: t.$couleur-fond;
    border: 1px solid t.$couleur-bordure;
  }

  &--valide {
    color: t.$couleur-succes;
    background-color: rgba(t.$couleur-succes, 0.1);
    border: 1px solid rgba(t.$couleur-succes, 0.3);
  }

  &--publie {
    color: t.$couleur-primaire;
    background-color: rgba(t.$couleur-primaire, 0.1);
    border: 1px solid rgba(t.$couleur-primaire, 0.3);
  }
}
</style>
