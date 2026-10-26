<template>
  <div ref="racine" class="menu-champ">
    <button
      ref="declencheur"
      type="button"
      class="btn btn-outline-primary menu-champ__declencheur"
      aria-haspopup="menu"
      :aria-expanded="ouvert ? 'true' : 'false'"
      :disabled="desactive"
      @mousedown.prevent
      @click="basculer"
      @keydown.down.prevent="ouvrir"
    >
      <PhBracketsCurly :size="22" aria-hidden="true" />
      Insérer un champ
    </button>

    <div v-if="ouvert" class="menu-champ__panneau" role="menu" aria-label="Champs à insérer" @keydown="surTouche">
      <template v-for="groupe in groupes" :key="groupe.code">
        <p class="menu-champ__groupe" role="presentation">{{ groupe.libelle }}</p>
        <button
          v-for="champ in groupe.marqueurs"
          :key="champ.cle"
          type="button"
          role="menuitem"
          class="menu-champ__item"
          :aria-label="nomAccessible(champ)"
          @mousedown.prevent
          @click="choisir(champ.cle)"
        >
          <span class="menu-champ__libelle">{{ champ.libelle }}</span>
          <span v-if="champ.code" class="menu-champ__code">{{ champ.code }}</span>
          <span v-else class="menu-champ__code">à insérer depuis ce menu</span>
        </button>
      </template>

      <button type="button" role="menuitem" class="menu-champ__item menu-champ__item--nouveau" @mousedown.prevent @click="nouveau">
        <PhPlus :size="18" aria-hidden="true" />
        Nouveau champ à compléter…
      </button>
    </div>
  </div>
</template>

<script>
import { PhBracketsCurly, PhPlus } from '@phosphor-icons/vue';
import { GROUPES_MARQUEURS } from '@/domain/contrats/catalogueMarqueurs.js';
import { syntaxeMarqueur } from '@/domain/contrats/collage.js';

/**
 * Menu « Insérer un champ » : champs du catalogue (avec leur code `{{…}}`, documentation
 * visible de la syntaxe de collage), puis champs à compléter du modèle, puis création d'un
 * nouveau champ. Bascule Vue simple, clavier complet (flèches, Entrée, Échap).
 */
export default {
  name: 'MenuInsererChamp',
  components: { PhBracketsCurly, PhPlus },
  props: {
    /** Champs à compléter du modèle (`{ cle, libelle, type }`). */
    champsLibres: { type: Array, default: () => [] },
    desactive: { type: Boolean, default: false },
  },
  emits: ['choisir', 'nouveau-champ'],
  data() {
    return { ouvert: false };
  },
  computed: {
    groupes() {
      const catalogue = GROUPES_MARQUEURS.map((g) => ({
        code: g.code,
        libelle: g.libelle,
        marqueurs: g.marqueurs.map((m) => ({ cle: m.cle, libelle: m.libelle, code: syntaxeMarqueur(m.cle) })),
      }));
      if (!this.champsLibres.length) return catalogue;
      return [
        ...catalogue,
        {
          code: 'SAISIE',
          libelle: 'Champs à compléter',
          marqueurs: this.champsLibres.map((c) => ({ cle: c.cle, libelle: c.libelle, code: '' })),
        },
      ];
    },
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.surClicExterieur);
  },
  methods: {
    nomAccessible(champ) {
      return champ.code ? `${champ.libelle}, code ${champ.code}` : `${champ.libelle}, champ à compléter`;
    },
    basculer() {
      if (this.ouvert) this.fermer(false);
      else this.ouvrir();
    },
    ouvrir() {
      if (this.ouvert || this.desactive) return;
      this.ouvert = true;
      document.addEventListener('mousedown', this.surClicExterieur);
      this.$nextTick(() => this.items()[0]?.focus());
    },
    fermer(rendreFocus = true) {
      this.ouvert = false;
      document.removeEventListener('mousedown', this.surClicExterieur);
      if (rendreFocus) this.$refs.declencheur?.focus();
    },
    surClicExterieur(evt) {
      if (this.$refs.racine && !this.$refs.racine.contains(evt.target)) this.fermer(false);
    },
    items() {
      return Array.from(this.$refs.racine?.querySelectorAll('[role="menuitem"]') ?? []);
    },
    surTouche(evt) {
      const items = this.items();
      const i = items.indexOf(document.activeElement);
      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        items[(i + 1) % items.length]?.focus();
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        items[(i - 1 + items.length) % items.length]?.focus();
      } else if (evt.key === 'Escape') {
        evt.preventDefault();
        this.fermer();
      }
    },
    choisir(cle) {
      this.fermer(false);
      this.$emit('choisir', cle);
    },
    nouveau() {
      this.fermer(false);
      this.$emit('nouveau-champ');
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.menu-champ {
  position: relative;
}

.menu-champ__declencheur {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.menu-champ__panneau {
  position: absolute;
  z-index: 20;
  top: 100%;
  left: 0;
  width: min(26rem, 90vw);
  max-height: 60vh;
  margin-top: t.$espace-1;
  padding: t.$espace-2;
  overflow-y: auto;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
  background: t.$couleur-fond;
  box-shadow: t.$ombre-legere;
}

.menu-champ__groupe {
  margin: t.$espace-2 t.$espace-2 t.$espace-1;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  text-transform: uppercase;
}

.menu-champ__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  min-height: t.$cible-cliquable-min;
  padding: t.$espace-1 t.$espace-2;
  border: 0;
  border-radius: t.$rayon-sm;
  background: transparent;
  color: t.$couleur-texte;
  text-align: left;

  &:hover {
    background: m.translucide(t.$couleur-primaire, 0.1);
  }

  &:focus-visible {
    @include m.focus-visible;
  }
}

.menu-champ__item--nouveau {
  flex-direction: row;
  align-items: center;
  gap: t.$espace-2;
  margin-top: t.$espace-2;
  border-top: 1px solid t.$couleur-bordure;
  border-radius: 0 0 t.$rayon-sm t.$rayon-sm;
  color: t.$couleur-primaire;
  font-weight: t.$graisse-moyenne;
}

.menu-champ__code {
  color: t.$couleur-texte-attenue;
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 0.75rem;
}
</style>
