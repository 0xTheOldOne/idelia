<template>
  <div class="accueil-view">
    <div
      v-if="statutSauvegarde === 'ERREUR_CHARGEMENT'"
      class="alert alert-warning d-flex gap-2"
      role="alert"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Certaines de vos données n'ont pas pu être relues ; les informations affichées peuvent
        être incomplètes. Une copie de sauvegarde a été conservée. Rechargez la page pour
        réessayer ; si le problème persiste, réimportez une sauvegarde depuis Paramètres.
      </p>
    </div>

    <nav class="accueil-fil-ariane" aria-label="Fil d'Ariane">
      <span v-if="nomCabinet">{{ nomCabinet }}</span>
      <router-link v-else class="accueil-lien-nommer" :to="{ name: 'parametres' }">
        <PhPencilSimple :size="16" aria-hidden="true" />
        <span>Nommer votre cabinet</span>
      </router-link>
    </nav>

    <div class="accueil-entete">
      <h1>Tableau de bord</h1>
      <router-link class="btn btn-primary accueil-action-principale" :to="{ name: 'planning' }">
        <PhMagicWand :size="20" weight="bold" aria-hidden="true" />
        <span>Générer un planning</span>
      </router-link>
    </div>

    <section class="row g-3 accueil-indicateurs" aria-labelledby="accueil-titre-indicateurs">
      <h2 id="accueil-titre-indicateurs" class="col-12 accueil-titre-section">Vue d'ensemble</h2>
      <div class="col-6 col-md-3">
        <IndicateurCle
          :valeur="equipeActiveValeur"
          libelle="Équipe active"
          :icone="iconeEquipe"
          :to="{ name: 'equipe' }"
        />
      </div>
      <div class="col-6 col-md-3">
        <IndicateurCle
          :valeur="tourneesValeur"
          libelle="Tournées"
          :icone="iconeTournees"
          :to="{ name: 'tournees' }"
        />
      </div>
      <div class="col-6 col-md-3">
        <IndicateurCle
          :valeur="absencesAVenirValeur"
          libelle="Absences à venir"
          :icone="iconeAbsences"
          :to="{ name: 'absences' }"
        />
      </div>
      <div class="col-6 col-md-3">
        <IndicateurCle
          :valeur="prochainPlanningValeur"
          libelle="Prochain planning"
          :icone="iconePlanning"
          :to="{ name: 'planning' }"
        />
      </div>
    </section>

    <section class="row g-3 accueil-actions-rapides" aria-labelledby="accueil-titre-actions">
      <h2 id="accueil-titre-actions" class="col-12 accueil-titre-section">Actions rapides</h2>
      <div class="col-12 col-md-4">
        <TuileAction
          titre="Ouvrir le planning en cours"
          description="Reprenez le planning en cours ou à venir."
          :icone="iconePlanning"
          accent
          @activer="ouvrirPlanningPertinent"
        />
      </div>
      <div class="col-12 col-md-4">
        <TuileAction
          titre="Ajouter une personne"
          description="Complétez votre équipe."
          :icone="iconeAjouterPersonne"
          :to="{ name: 'equipe' }"
        />
      </div>
      <div class="col-12 col-md-4">
        <TuileAction
          titre="Saisir une absence"
          description="Enregistrez un congé ou un arrêt."
          :icone="iconeSaisirAbsence"
          :to="{ name: 'absences' }"
        />
      </div>
    </section>

    <div class="row g-3 accueil-colonnes">
      <div class="col-12 col-lg-7">
        <ListePlanningsRecents
          :plannings="recents"
          :resume-conflits="resumeConflits"
          @ouvrir="ouvrirPlanning"
        />
      </div>
      <div class="col-12 col-lg-5 accueil-colonne-secondaire">
        <CarteATraiter
          :planning="prochain"
          :resume="resumeDuProchain"
          @ouvrir="ouvrirPlanning"
        />
        <CarteSauvegarde
          :statut="statutSauvegarde"
          :derniere-sauvegarde="derniereSauvegarde"
          :dernier-export-le="dernierExportLe"
          @exporter="onExporter"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions, mapMutations } from 'vuex';
import {
  PhPencilSimple,
  PhMagicWand,
  PhCalendarPlus,
  PhCalendarCheck,
  PhCalendarX,
  PhUsers,
  PhUserPlus,
  PhPath,
  PhWarning,
} from '@phosphor-icons/vue';

import TuileAction from '@/components/accueil/TuileAction.vue';
import IndicateurCle from '@/components/accueil/IndicateurCle.vue';
import ListePlanningsRecents from '@/components/accueil/ListePlanningsRecents.vue';
import CarteATraiter from '@/components/accueil/CarteATraiter.vue';
import CarteSauvegarde from '@/components/accueil/CarteSauvegarde.vue';

import { absencesAVenir } from '@/domain/absences.js';
import { prochainPlanning } from '@/domain/planning.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Écran « Accueil » (feature 0013) : **orchestrateur** du tableau de bord.
 * Agrège ce que le store et le domaine exposent déjà — aucune logique
 * métier ici (comptages via les getters `personnes/actifs`/`tournees/actives`,
 * sélections via les fonctions pures du domaine `absencesAVenir`/
 * `prochainPlanning`). L'unique appel moteur (`diagnostiquer`) passe par
 * l'action `plannings/resumeConflits` (ADR 0008) : jamais d'import de
 * `@/domain/scheduling` ici.
 *
 * Détient l'état volatil `resumeConflits` (map `{ [planningId]: résumé }`),
 * peuplé au montage pour les plannings **affichés** (récents plafonnés +
 * planning pertinent, dédupliqués) : jamais persisté, jamais bloquant (le
 * chargement échoue silencieusement en console plutôt que de casser l'écran).
 *
 * Navigation : `ouvrirPlanning(id)` pose la sélection (`plannings/SELECT`,
 * mutation existante) puis navigue vers `/planning`, qui respecte une
 * sélection déjà posée (0011). `ouvrirPlanningPertinent` ouvre le planning
 * « pertinent maintenant » (`prochainPlanning`), ou navigue simplement vers
 * `/planning` si aucun n'existe (l'utilisateur y génère son premier
 * planning). L'export réutilise l'action racine `exporter` (0008), suivie de
 * `ui/enregistrerExport` pour dater la confirmation affichée par `CarteSauvegarde`.
 */
export default {
  name: 'AccueilView',
  components: {
    PhPencilSimple,
    PhMagicWand,
    PhWarning,
    TuileAction,
    IndicateurCle,
    ListePlanningsRecents,
    CarteATraiter,
    CarteSauvegarde,
  },
  data() {
    return {
      // Résumés de conflits par id de planning, peuplés au montage
      // (`plannings/resumeConflits`) : volatil, jamais persisté.
      resumeConflits: {},
    };
  },
  computed: {
    ...mapState(['statutSauvegarde', 'derniereSauvegarde']),
    ...mapState('ui', ['dernierExportLe']),
    ...mapState('absences', { absences: 'items' }),
    ...mapState('plannings', { plannings: 'items' }),
    ...mapGetters('personnes', { personnesActives: 'actifs' }),
    ...mapGetters('tournees', { tourneesActives: 'actives' }),
    ...mapGetters('cabinet', ['parametres']),
    nomCabinet() {
      return this.parametres?.nomCabinet ?? '';
    },
    // Icônes Phosphor passées en props aux composants réutilisables
    // (composants, pas simples chaînes : voir `TuileAction`/`IndicateurCle`).
    // Exposées via des computed (plutôt que `data()`) pour rester de simples
    // références vers les imports du module, sans les faire suivre par la
    // réactivité de Vue.
    iconeEquipe() {
      return PhUsers;
    },
    iconeTournees() {
      return PhPath;
    },
    iconeAbsences() {
      return PhCalendarX;
    },
    /** Réutilisée par l'indicateur « Prochain planning » et la tuile « Ouvrir le planning en cours ». */
    iconePlanning() {
      return PhCalendarCheck;
    },
    iconeAjouterPersonne() {
      return PhUserPlus;
    },
    iconeSaisirAbsence() {
      return PhCalendarPlus;
    },
    /**
     * Date du jour `"YYYY-MM-DD"`, seul point d'accès à `Date` de cet écran
     * (ADR 0010), injectée aux sélecteurs purs du domaine.
     */
    aujourdhui() {
      return dateUtil.format(new Date());
    },
    equipeActiveValeur() {
      return this.personnesActives.length;
    },
    tourneesValeur() {
      return this.tourneesActives.length;
    },
    absencesAVenirValeur() {
      return absencesAVenir(this.absences, this.aujourdhui).length;
    },
    /** Le planning « pertinent maintenant » (domaine pur), ou `null` si aucun. */
    prochain() {
      return prochainPlanning(this.plannings, this.aujourdhui);
    },
    prochainPlanningValeur() {
      return this.prochain ? `Sem. ${dateUtil.numeroSemaineIso(this.prochain.dateDebut)}` : '—';
    },
    /**
     * Plannings récents : tri de présentation (`updatedAt` décroissant),
     * plafonné à 6 (choix de présentation, pas du domaine — comme
     * `AbsencesView`). Travaille sur une copie : ne mute jamais `plannings`.
     */
    recents() {
      return [...this.plannings]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6);
    },
    /** Résumé de conflits du planning pertinent, ou `null` tant qu'il n'a pas encore été calculé. */
    resumeDuProchain() {
      return this.prochain ? (this.resumeConflits[this.prochain.id] ?? null) : null;
    },
  },
  methods: {
    ...mapActions('plannings', { resumeConflitsAction: 'resumeConflits' }),
    ...mapActions(['exporter']),
    ...mapActions('ui', ['enregistrerExport']),
    ...mapMutations('plannings', ['SELECT']),

    /** Sélectionne le planning `id` puis ouvre l'éditeur (§6.3). */
    ouvrirPlanning(id) {
      this.SELECT(id);
      this.$router.push({ name: 'planning' });
    },
    /** Ouvre le planning pertinent, ou l'écran Planning (pour en générer un) si aucun n'existe. */
    ouvrirPlanningPertinent() {
      if (this.prochain) {
        this.ouvrirPlanning(this.prochain.id);
      } else {
        this.$router.push({ name: 'planning' });
      }
    },
    /**
     * « Exporter une sauvegarde » (`CarteSauvegarde`) : réutilise l'action racine 0008, puis
     * enregistre l'horodatage d'export (`ui/enregistrerExport`, feature 0008) pour que
     * `CarteSauvegarde` affiche une confirmation datée (comme `BlocSauvegarde`).
     */
    onExporter() {
      this.exporter();
      this.enregistrerExport();
    },
  },
  /**
   * Peuple `resumeConflits` pour les plannings affichés (récents plafonnés +
   * planning pertinent, dédupliqués par id) : une seule évaluation moteur par
   * planning, via l'action `plannings/resumeConflits` (§4.3). Robuste si
   * `plannings` est vide (map vide, aucun appel superflu) ; enrobé dans un
   * `try/catch` pour ne jamais bloquer l'écran en cas d'échec inattendu.
   */
  async mounted() {
    const evalues = new Map(this.recents.map((pl) => [pl.id, pl]));
    if (this.prochain) evalues.set(this.prochain.id, this.prochain);
    if (evalues.size === 0) return;

    try {
      this.resumeConflits = await this.resumeConflitsAction({ plannings: [...evalues.values()] });
    } catch (e) {
      console.error(e);
    }
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.accueil-fil-ariane {
  margin-bottom: t.$espace-2;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.accueil-lien-nommer {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
  color: t.$couleur-primaire;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.accueil-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
}

.accueil-action-principale {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.accueil-titre-section {
  margin-bottom: t.$espace-1;
}

.accueil-indicateurs {
  margin-bottom: t.$espace-4;
}

.accueil-actions-rapides {
  margin-bottom: t.$espace-5;
}

.accueil-colonnes {
  margin-bottom: t.$espace-4;
}

.accueil-colonne-secondaire {
  display: flex;
  flex-direction: column;
  gap: t.$espace-3;
}
</style>
