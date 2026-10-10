<template>
  <div class="reglages-grille">
    <div class="reglages-grille-groupe" role="group" aria-label="Afficher par">
      <button
        v-for="option in optionsOrientation"
        :key="option.code"
        type="button"
        class="btn btn-sm reglages-grille-bouton"
        :class="orientation === option.code ? 'btn-outline-primary reglages-grille-bouton--actif' : 'btn-outline-secondary'"
        :aria-pressed="orientation === option.code ? 'true' : 'false'"
        :aria-label="option.libelle"
        :title="option.libelle"
        @click="$emit('update:orientation', option.code)"
      >
        <component :is="option.icone" :size="18" aria-hidden="true" />
      </button>
    </div>

    <div ref="menuEchelle" class="reglages-grille-menu" @keydown.esc="fermerMenu(true)">
      <button
        ref="boutonEchelle"
        type="button"
        class="btn btn-sm btn-outline-secondary reglages-grille-bouton"
        aria-haspopup="menu"
        :aria-expanded="menuOuvert ? 'true' : 'false'"
        aria-controls="reglages-grille-menu-echelle"
        :aria-label="libelleBoutonEchelle"
        :title="libelleBoutonEchelle"
        @click="basculerMenu"
      >
        <PhCalendarBlank :size="18" aria-hidden="true" />
        <PhCaretDown :size="12" weight="bold" aria-hidden="true" />
      </button>

      <ul
        v-show="menuOuvert"
        id="reglages-grille-menu-echelle"
        class="reglages-grille-liste"
        role="menu"
        aria-label="Période affichée"
        @keydown.down.prevent="deplacerFocus(1)"
        @keydown.up.prevent="deplacerFocus(-1)"
      >
        <li v-for="option in optionsEchelle" :key="option.code" role="none">
          <button
            ref="optionsMenu"
            type="button"
            class="reglages-grille-option"
            role="menuitemradio"
            :aria-checked="echelle === option.code ? 'true' : 'false'"
            @click="choisirEchelle(option.code)"
          >
            <PhCheck
              :size="14"
              weight="bold"
              aria-hidden="true"
              :class="{ invisible: echelle !== option.code }"
            />
            <span>{{ option.libelle }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { PhCalendarBlank, PhCaretDown, PhCheck, PhKanban, PhUsers } from '@phosphor-icons/vue';

/**
 * Réglages d'affichage compacts de `GrillePlanning`, placés dans son bandeau
 * (retour porteur 2026-10-07) : bascule Tournées / Personnes en boutons
 * **icône seule** (libellé en infobulle `title` et en `aria-label`), et menu
 * déroulant pour l'échelle Jour / Semaine / Mois.
 *
 * Sans état métier : émet seulement `update:orientation` / `update:echelle`.
 * Le menu est fait main (Bootstrap est importé sans son JavaScript) : il se
 * ferme sur Échap (focus rendu au bouton), sur clic à l'extérieur et après
 * un choix ; flèches haut/bas pour passer d'une option à l'autre.
 */
export default {
  name: 'ReglagesAffichageGrille',
  components: { PhCalendarBlank, PhCaretDown, PhCheck, PhKanban, PhUsers },
  props: {
    /** Orientation courante : `'TOURNEES'` ou `'PERSONNES'`. */
    orientation: { type: String, required: true },
    /** Échelle courante : `'JOUR'`, `'SEMAINE'` ou `'MOIS'`. */
    echelle: { type: String, required: true },
  },
  emits: ['update:orientation', 'update:echelle'],
  data() {
    return {
      menuOuvert: false,
      optionsOrientation: [
        { code: 'TOURNEES', libelle: 'Afficher par tournée', icone: 'PhKanban' },
        { code: 'PERSONNES', libelle: 'Afficher par personne', icone: 'PhUsers' },
      ],
      optionsEchelle: [
        { code: 'JOUR', libelle: 'Jour' },
        { code: 'SEMAINE', libelle: 'Semaine' },
        { code: 'MOIS', libelle: 'Mois' },
      ],
    };
  },
  computed: {
    /** Libellé du bouton de menu, avec l'échelle courante (ex. « Période affichée : Semaine »). */
    libelleBoutonEchelle() {
      const option = this.optionsEchelle.find((o) => o.code === this.echelle);
      return `Période affichée : ${option ? option.libelle : ''}`;
    },
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onClicDocument);
  },
  methods: {
    basculerMenu() {
      if (this.menuOuvert) {
        this.fermerMenu(false);
        return;
      }
      this.menuOuvert = true;
      document.addEventListener('click', this.onClicDocument);
      // Focus sur l'option courante, une fois le menu rendu.
      this.$nextTick(() => {
        const index = this.optionsEchelle.findIndex((o) => o.code === this.echelle);
        this.$refs.optionsMenu?.[Math.max(index, 0)]?.focus();
      });
    },
    /**
     * @param {boolean} rendreFocus - `true` pour redonner le focus au bouton (Échap).
     */
    fermerMenu(rendreFocus) {
      if (!this.menuOuvert) return;
      this.menuOuvert = false;
      document.removeEventListener('click', this.onClicDocument);
      if (rendreFocus) this.$refs.boutonEchelle?.focus();
    },
    /** @param {MouseEvent} event */
    onClicDocument(event) {
      if (!this.$refs.menuEchelle?.contains(event.target)) this.fermerMenu(false);
    },
    /** @param {string} code */
    choisirEchelle(code) {
      this.$emit('update:echelle', code);
      this.fermerMenu(true);
    },
    /** @param {number} pas - `1` (option suivante) ou `-1` (précédente), en boucle. */
    deplacerFocus(pas) {
      const options = this.$refs.optionsMenu ?? [];
      const courant = options.indexOf(document.activeElement);
      const suivant = (courant + pas + options.length) % options.length;
      options[suivant]?.focus();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

// Petit espace entre groupes, resserré sur mobile pour tenir sur une ligne.
.reglages-grille {
  display: flex;
  align-items: center;
  gap: t.$espace-2;

  @include m.a-partir-de('sm') {
    gap: t.$espace-3;
  }
}

.reglages-grille-groupe {
  display: flex;
  gap: t.$espace-1;
}

.reglages-grille-bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;

  // Bouton actif : fond léger en plus de la couleur (jamais la seule différence,
  // `aria-pressed` porte l'état pour les lecteurs d'écran).
  &--actif {
    background-color: rgba(t.$couleur-primaire, 0.12);
  }
}

.reglages-grille-menu {
  position: relative;
}

// Sous `lg` : les groupes s'étirent au prorata de leur nombre de boutons
// (Tournées/Personnes = 2, menu de période = 1), boutons de même largeur.
.reglages-grille-groupe {
  flex: 2 1 0;

  .reglages-grille-bouton {
    flex: 1 1 0;
  }
}

.reglages-grille-menu {
  display: flex;
  flex: 1 1 0;

  .reglages-grille-bouton {
    flex: 1 1 0;
  }
}

@include m.a-partir-de('lg') {
  .reglages-grille-groupe,
  .reglages-grille-menu,
  .reglages-grille-groupe .reglages-grille-bouton,
  .reglages-grille-menu .reglages-grille-bouton {
    flex: 0 0 auto;
  }
}

.reglages-grille-liste {
  position: absolute;
  right: 0;
  top: calc(100% + #{t.$espace-1});
  z-index: 10;
  min-width: 10rem;
  margin: 0;
  padding: t.$espace-1 0;
  list-style: none;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
  box-shadow: 0 4px 12px rgba(t.$couleur-texte, 0.12);
}

.reglages-grille-option {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  width: 100%;
  min-height: t.$cible-cliquable-min;
  padding: 0 t.$espace-3;
  border: 0;
  background: none;
  color: t.$couleur-texte;
  font: inherit;
  text-align: left;

  &:hover {
    background-color: t.$couleur-fond-clair;
  }

  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: -#{t.$epaisseur-focus};
  }
}
</style>
