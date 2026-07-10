<template>
  <a href="#contenu-principal" class="lien-evitement">Aller au contenu</a>

  <div class="app-layout" :class="{ 'app-layout--menu-replie': menuReplie }">
    <MenuLateral />

    <main id="contenu-principal" class="app-contenu" tabindex="-1">
      <router-view />
    </main>
  </div>

  <PileNotifications />
</template>

<script>
import { mapGetters } from 'vuex';
import MenuLateral from '@/components/communs/MenuLateral.vue';
import PileNotifications from '@/components/communs/PileNotifications.vue';

/**
 * Shell racine de l'application (feature 0015) : une grille CSS
 * « sidebar + contenu ». Ne porte aucune logique métier ni aucune
 * configuration de navigation (déportées dans `MenuLateral`, colonne 1) ;
 * se contente de monter le menu et le contenu routé (colonne 2, défilant
 * indépendamment).
 *
 * La largeur de la colonne 1 suit la même préférence (`ui/menuReplie`) que
 * `MenuLateral` : source unique, pas de prop drilling ni de duplication
 * d'état.
 */
export default {
  name: 'App',
  components: { MenuLateral, PileNotifications },
  computed: {
    ...mapGetters('ui', ['menuReplie']),
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

// Lien d'évitement : visuellement masqué au repos (hors écran, en haut),
// révélé au focus clavier pour permettre de sauter directement au contenu
// sans traverser tout le menu latéral (accessibilité).
.lien-evitement {
  position: fixed;
  top: -3rem;
  left: t.$espace-2;
  z-index: 2000;
  padding: t.$espace-2 t.$espace-3;
  border-radius: t.$rayon-sm;
  background-color: t.$couleur-fond;
  color: t.$couleur-primaire;
  font-weight: t.$graisse-gras;
  text-decoration: none;
  transition: top 0.2s ease;

  &:focus-visible {
    top: t.$espace-2;
    @include m.focus-visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lien-evitement {
    transition: none;
  }
}

// Largeurs de colonne alignées sur celles de `MenuLateral.vue` (voir son
// commentaire) : le shell doit rester synchronisé avec le composant, qui
// dimensionne lui-même sa propre largeur selon la même préférence.
$menu-largeur-deplie: 260px;
$menu-largeur-repliee: 76px;

.app-layout {
  display: grid;
  grid-template-columns: $menu-largeur-deplie 1fr;
  transition: grid-template-columns 0.2s ease;

  &--menu-replie {
    grid-template-columns: $menu-largeur-repliee 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-layout {
    transition: none;
  }
}

.app-contenu {
  min-width: 0; // évite qu'un contenu large ne fasse déborder la colonne
  height: 100vh;
  overflow-y: auto;
  padding: t.$espace-4;
}

// ---------------------------------------------------------------------------
// Responsive (feature 0015 §6.3) : sous $rupture-lg, rail forcé en CSS pur
// (pas de JS, pas d'overlay), indépendamment de la préférence utilisateur —
// bouton de repli masqué (sans effet à cette taille). `MenuLateral` ne
// réagit qu'à sa propre classe `menu-lateral--replie` (pilotée par le
// store) : pour forcer son apparence rail sans dépendre du JS, on
// duplique ici ciblément ses règles « repliées » via `:deep()`, avec
// `!important` pour garantir la priorité sur les styles scoped du
// composant (exception assumée : coordination inter-composants purement
// CSS, cf. plan §6.3).
// ---------------------------------------------------------------------------
@media (max-width: #{t.$rupture-lg - 1px}) {
  .app-layout {
    grid-template-columns: $menu-largeur-repliee 1fr;
  }

  :deep(.menu-lateral) {
    width: $menu-largeur-repliee !important;
  }

  :deep(.menu-marque) {
    justify-content: center !important;
    padding-inline: 0 !important;
  }

  :deep(.menu-marque__texte) {
    display: none !important;
  }

  :deep(.menu-groupe__titre) {
    display: none !important;
  }

  :deep(.menu-item) {
    justify-content: center !important;
    padding-inline: 0 !important;
  }

  :deep(.menu-item__libelle) {
    display: none !important;
  }

  :deep(.menu-item:hover .menu-item__infobulle),
  :deep(.menu-item:focus-visible .menu-item__infobulle),
  :deep(.menu-item:focus-within .menu-item__infobulle) {
    display: block !important;
  }

  :deep(.menu-item__infobulle) {
    position: absolute !important;
    left: 100% !important;
    top: 50% !important;
    z-index: 10 !important;
    margin-left: t.$espace-2 !important;
    padding: t.$espace-1 t.$espace-2 !important;
    border-radius: t.$rayon-sm !important;
    background-color: t.$couleur-texte !important;
    color: t.$couleur-texte-inverse !important;
    font-size: t.$taille-texte-petite !important;
    font-weight: t.$graisse-moyenne !important;
    white-space: nowrap !important;
    box-shadow: t.$ombre-legere !important;
    pointer-events: none !important;
    transform: translateY(-50%) !important;
  }

  // Le bouton de repli n'a aucun effet à cette taille : le masquer plutôt
  // que de laisser une commande sans conséquence visible.
  :deep(.menu-bascule) {
    display: none !important;
  }
}

// ---------------------------------------------------------------------------
// Impression : le menu (bandeau teal, navigation) n'a pas sa place sur
// papier — masqué, la grille neutralisée pour laisser le contenu s'imprimer
// pleine largeur.
// ---------------------------------------------------------------------------
@media print {
  .lien-evitement {
    display: none;
  }

  :deep(.menu-lateral) {
    display: none;
  }

  .app-layout {
    display: block;
  }

  .app-contenu {
    height: auto;
    overflow: visible;
  }
}
</style>
