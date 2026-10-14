<template>
  <div class="bloc-vacances">
    <div class="bloc-vacances__entete">
      <h2>Vacances scolaires</h2>
      <button
        v-if="zoneCourante"
        id="vacances-mettre-a-jour"
        type="button"
        class="btn btn-outline-secondary bloc-vacances__bouton"
        title="Redemander les dates au site de l'Éducation nationale"
        :disabled="enCours"
        :aria-busy="enCours ? 'true' : null"
        @click="onMettreAJour"
      >
        <span v-if="enCours" class="spinner-border spinner-border-sm" aria-hidden="true" />
        <PhArrowsClockwise v-else :size="20" aria-hidden="true" />
        <span>{{ enCours ? 'Mise à jour…' : 'Mettre à jour' }}</span>
      </button>
    </div>

    <label for="vacances-zone" class="form-label">Zone de vacances scolaires</label>
    <select
      id="vacances-zone"
      class="form-select bloc-vacances__select"
      aria-describedby="vacances-aide"
      :value="zoneCourante || ''"
      :disabled="enCours"
      @change="onZoneChange"
    >
      <option value="">Aucune — ne pas afficher les vacances scolaires</option>
      <option v-for="zone in ZONES_SCOLAIRES" :key="zone.code" :value="zone.code">
        {{ zone.libelle }}
      </option>
    </select>

    <div id="vacances-aide" class="bloc-vacances__aide">
      <p>
        Idelia affiche les vacances de votre zone sur le planning et sur les tirages papier. Les
        dimanches et les jours fériés sont toujours indiqués.
      </p>
      <p>
        Les dates viennent du site de l'Éducation nationale. Seule votre zone est envoyée, aucune
        information sur le cabinet ni sur les patients. Une fois récupérées, les dates restent
        disponibles sans internet.
      </p>
    </div>

    <div id="vacances-etat" role="status" aria-live="polite">
      <p v-if="zoneCourante" class="bloc-vacances__cache">
        {{ texteCache }}
      </p>
      <div
        v-if="resultat"
        class="alert d-flex gap-2 mt-3 mb-0"
        :class="resultat.ok ? 'alert-success' : 'alert-warning'"
      >
        <PhCheckCircle v-if="resultat.ok" :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <PhWarning v-else :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <p class="mb-0">{{ resultat.message }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters } from 'vuex';
import { PhArrowsClockwise, PhCheckCircle, PhWarning } from '@phosphor-icons/vue';

import { ZONES_SCOLAIRES } from '@/domain/calendrier/vacancesScolaires.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Bloc « Vacances scolaires » de l'écran Paramètres (feature 0023, ADR 0020).
 *
 * Composant conteneur : choix de la zone, bouton de mise à jour, état du
 * cache. Aucune logique métier : tout passe par le module Vuex
 * `vacancesScolaires` (qui ne rejette jamais ses actions).
 */
export default {
  name: 'BlocVacancesScolaires',
  components: { PhArrowsClockwise, PhCheckCircle, PhWarning },
  data() {
    return {
      ZONES_SCOLAIRES,
      /** `true` pendant une requête (désactive bouton et liste : pas de double clic). */
      enCours: false,
      /** @type {({ ok: boolean, message: string }|null)} Dernier résultat à annoncer. */
      resultat: null,
    };
  },
  computed: {
    ...mapGetters('vacancesScolaires', ['zoneCourante', 'entreesZoneCourante']),

    texteCache() {
      const entrees = this.entreesZoneCourante;
      if (entrees.length === 0) return 'Aucune date enregistrée pour l\'instant.';
      const liste = entrees
        .map((e) => `${e.anneeScolaire} (${e.recupereLe ? 'récupérée le ' + dateUtil.formatHorodatageDateFr(e.recupereLe) : 'date de récupération inconnue'})`)
        .join(', ');
      return `Dates enregistrées : année scolaire ${liste}.`;
    },
  },
  methods: {
    ...mapActions('vacancesScolaires', ['mettreAJour', 'changerZone']),

    /** @param {() => Promise<{ ok: boolean, etat: string, message: string }>} action */
    async lancer(action) {
      if (this.enCours) return;
      this.enCours = true;
      this.resultat = null;
      try {
        const r = await action();
        this.resultat = r.message ? { ok: r.ok, message: r.message } : null;
      } finally {
        this.enCours = false;
      }
    },

    onMettreAJour() {
      return this.lancer(() => this.mettreAJour());
    },

    onZoneChange(event) {
      const code = event.target.value || null;
      return this.lancer(() => this.changerZone(code));
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.bloc-vacances__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: t.$espace-2;
  margin-bottom: t.$espace-3;

  h2 {
    margin-bottom: 0;
  }
}

.bloc-vacances__bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.bloc-vacances__select {
  max-width: 40rem;
  min-height: t.$cible-cliquable-min;
}

.bloc-vacances__aide {
  margin: t.$espace-2 0 0;

  p {
    margin: 0 0 t.$espace-1;
  }

  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.bloc-vacances__cache {
  margin: t.$espace-3 0 0;
}
</style>
