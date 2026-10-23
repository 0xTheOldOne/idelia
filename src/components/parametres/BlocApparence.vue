<template>
  <div class="bloc-apparence">
    <p id="apparence-intro" class="bloc-apparence__intro">
      Choisissez les couleurs d'Idelia sur cet ordinateur.
    </p>

    <fieldset aria-describedby="apparence-intro">
      <legend class="visually-hidden">Couleurs de l'application</legend>

      <div class="bloc-apparence__options">
        <div v-for="option in OPTIONS_THEME" :key="option.code">
          <input
            :id="'apparence-' + option.code"
            type="radio"
            class="btn-check"
            name="apparence-theme"
            :value="option.code"
            :checked="preferenceTheme === option.code"
            @change="choisirTheme(option.code)"
          >
          <label class="btn bloc-apparence__option" :for="'apparence-' + option.code">
            <PhCheck
              v-if="preferenceTheme === option.code"
              :size="16"
              weight="bold"
              class="bloc-apparence__coche"
              aria-hidden="true"
            />
            <component :is="ICONES[option.code]" :size="28" aria-hidden="true" />
            <span class="bloc-apparence__libelle">{{ option.libelle }}</span>
            <span class="bloc-apparence__aide">{{ aide(option) }}</span>
          </label>
        </div>
      </div>
    </fieldset>

    <p class="bloc-apparence__note">
      Ce réglage ne concerne que cet ordinateur&nbsp;; il n'est pas inclus dans les sauvegardes.
      Les plannings imprimés restent toujours sur fond blanc.
    </p>
  </div>
</template>

<script>
import { mapActions, mapGetters } from 'vuex';
import { PhCheck, PhCircleHalf, PhSun, PhMoon } from '@phosphor-icons/vue';

import { OPTIONS_THEME } from '@/domain/theme.js';

/**
 * Bloc « Apparence » de l'écran Paramètres (feature 0038, ADR 0022) :
 * trois vignettes radio (Automatique / Clair / Sombre). Le choix s'applique
 * immédiatement (pas de bouton « Enregistrer », pas de toast : le résultat est
 * visible tout de suite).
 *
 * Composant **conteneur**, sans logique métier : lit les getters et dispatche
 * `ui/choisirTheme`.
 */
export default {
  name: 'BlocApparence',
  components: { PhCheck, PhCircleHalf, PhSun, PhMoon },
  data() {
    return {
      OPTIONS_THEME,
      ICONES: { AUTO: 'PhCircleHalf', CLAIR: 'PhSun', SOMBRE: 'PhMoon' },
    };
  },
  computed: {
    ...mapGetters('ui', ['preferenceTheme', 'themeEffectif']),
  },
  methods: {
    ...mapActions('ui', ['choisirTheme']),

    /**
     * Texte d'aide d'une option. Pour « Automatique », indique en direct le
     * thème actuellement appliqué.
     * @param {{code: string, aide: string}} option
     * @returns {string}
     */
    aide(option) {
      if (option.code !== 'AUTO') return option.aide;
      const actuel = this.themeEffectif === 'SOMBRE' ? 'sombre' : 'clair';
      return `${option.aide} — actuellement : ${actuel}`;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.bloc-apparence__intro {
  margin: 0 0 t.$espace-3;
  color: t.$couleur-texte-attenue;
}

.bloc-apparence__options {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: t.$espace-3;
}

// Vignette radio (bouton natif `.btn-check` + libellé), même motif que le
// sélecteur d'icône de FormulaireTournee.
.bloc-apparence__option {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: t.$espace-1;
  width: 11rem;
  min-height: t.$cible-cliquable-min;
  padding: t.$espace-3 t.$espace-2;
  color: t.$couleur-texte;
  text-align: center;
  background-color: t.$couleur-fond;
  border: 2px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

.btn-check:checked + .bloc-apparence__option {
  color: t.$couleur-texte;
  background-color: m.translucide(t.$couleur-primaire, 0.12);
  border-color: t.$couleur-primaire;
}

.btn-check:focus-visible + .bloc-apparence__option {
  @include m.focus-visible;
}

.bloc-apparence__coche {
  position: absolute;
  top: t.$espace-1;
  right: t.$espace-1;
  color: t.$couleur-primaire;
}

.bloc-apparence__libelle {
  font-weight: t.$graisse-gras;
}

.bloc-apparence__aide {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.bloc-apparence__note {
  margin: t.$espace-3 0 0;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}
</style>
