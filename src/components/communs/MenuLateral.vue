<template>
  <aside class="menu-lateral" :class="{ 'menu-lateral--replie': menuReplie }">
    <div class="menu-marque">
      <img :src="cheminLogo" alt="" class="menu-marque__pastille" width="38" height="38" />
      <div class="menu-marque__texte">
        <span class="menu-marque__nom">Idelia</span>
        <small class="menu-marque__sous-titre">Planning infirmier</small>
      </div>
    </div>

    <nav class="menu-nav" aria-label="Navigation principale">
      <div
        v-for="(groupe, index) in groupes"
        :key="groupe.titre"
        class="menu-groupe"
        role="group"
        :aria-labelledby="idTitreGroupe(index)"
      >
        <p :id="idTitreGroupe(index)" class="menu-groupe__titre">{{ groupe.titre }}</p>
        <router-link
          v-for="item in groupe.items"
          :key="item.nom"
          :to="item.chemin"
          class="menu-item"
          :class="{ 'menu-item--actif': estActif(item) }"
          :aria-current="estActif(item) ? 'page' : null"
          :aria-label="item.libelle"
          active-class=""
          exact-active-class=""
        >
          <component :is="item.icone" :size="21" aria-hidden="true" />
          <span class="menu-item__libelle">{{ item.libelle }}</span>
          <span class="menu-item__infobulle">{{ item.libelle }}</span>
        </router-link>
      </div>
    </nav>

    <div class="menu-espaceur"></div>

    <!-- Emplacement réservé pour l'indicateur de sauvegarde (différé, voir feature 0015 §12.5) -->
    <div class="menu-pied-reserve"></div>

    <button
      type="button"
      class="menu-bascule"
      :aria-expanded="!menuReplie"
      :aria-label="libelleBascule"
      @click="basculerMenu"
    >
      <PhCaretDoubleLeft :size="20" aria-hidden="true" class="menu-bascule__icone" />
      <span class="menu-bascule__libelle">{{ libelleBascule }}</span>
    </button>
  </aside>
</template>

<script>
import { mapActions, mapGetters } from 'vuex';
import {
  PhHouse,
  PhUsers,
  PhPath,
  PhCalendarX,
  PhCalendarBlank,
  PhGear,
  PhCaretDoubleLeft,
} from '@phosphor-icons/vue';

/**
 * Menu latéral de navigation — coquille de la barre latérale (feature 0015).
 *
 * Composant transverse, purement présentationnel : aucune logique métier,
 * seule la préférence d'affichage (déplié/replié) vient du store (`ui`,
 * feature 0015). Les destinations (chemins, libellés, icônes) sont de la
 * configuration d'UI statique, pas du domaine.
 *
 * L'état actif d'un item n'utilise pas l'`active-class` native de
 * `vue-router` : les routes étant déclarées à plat (non imbriquées, voir
 * `src/router/index.js`), l'algorithme natif ne considérerait pas « Équipe »
 * comme actif sur `/equipe/:id/souhaits`. `estActif()` reproduit donc la
 * règle « actif = chemin exact ou préfixe » explicitement voulue (feature
 * 0015 §6.4), et pose lui-même `aria-current="page"` sur l'item courant.
 */
export default {
  name: 'MenuLateral',
  components: {
    PhHouse,
    PhUsers,
    PhPath,
    PhCalendarX,
    PhCalendarBlank,
    PhGear,
    PhCaretDoubleLeft,
  },
  data() {
    return {
      groupes: [
        {
          titre: 'Pilotage',
          items: [
            { nom: 'accueil', chemin: '/', libelle: 'Accueil', icone: 'PhHouse' },
            { nom: 'equipe', chemin: '/equipe', libelle: 'Équipe', icone: 'PhUsers' },
            { nom: 'tournees', chemin: '/tournees', libelle: 'Tournées', icone: 'PhPath' },
            {
              nom: 'absences',
              chemin: '/absences',
              libelle: 'Absences & congés',
              icone: 'PhCalendarX',
            },
          ],
        },
        {
          titre: 'Planning',
          items: [
            {
              nom: 'planning',
              chemin: '/planning',
              libelle: 'Planning',
              icone: 'PhCalendarBlank',
            },
            { nom: 'parametres', chemin: '/parametres', libelle: 'Paramètres', icone: 'PhGear' },
          ],
        },
      ],
    };
  },
  computed: {
    ...mapGetters('ui', ['menuReplie']),
    /** Chemin du logo de marque, résolu via la base Vite (compatible sous-répertoire GitHub Pages). */
    cheminLogo() {
      return `${import.meta.env.BASE_URL}favicon.png`;
    },
    libelleBascule() {
      return this.menuReplie ? 'Déplier le menu' : 'Réduire le menu';
    },
  },
  methods: {
    ...mapActions('ui', ['basculerMenu']),
    /**
     * Un item est actif sur son chemin exact, ou — sauf pour l'accueil (`/`)
     * — sur toute route dont le chemin commence par ce préfixe (ex.
     * `/equipe/:id/souhaits` garde « Équipe » actif).
     * @param {{ chemin: string }} item
     * @returns {boolean}
     */
    estActif(item) {
      if (item.chemin === '/') {
        return this.$route.path === '/';
      }
      return (
        this.$route.path === item.chemin || this.$route.path.startsWith(`${item.chemin}/`)
      );
    },
    /**
     * Identifiant stable du titre d'un groupe de navigation (« Pilotage »,
     * « Planning »…), pour l'associer au conteneur `role="group"` via
     * `aria-labelledby` (regroupement exposé aux lecteurs d'écran). Basé sur
     * l'index : la liste des groupes est une configuration statique, jamais
     * réordonnée à l'exécution.
     * @param {number} index
     * @returns {string}
     */
    idTitreGroupe(index) {
      return `menu-groupe-titre-${index}`;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

// Focus clavier (`.menu-item`, `.menu-bascule`) : contour dédié ci-dessous,
// pas le mixin global `focus-visible` (`_mixins.scss`), pensé pour un fond
// clair — insuffisant sur le dégradé teal foncé du menu.

// Largeurs propres au menu (détail de présentation, pas des tokens globaux).
// Le shell (`App.vue`, feature 0015 tâche 3) reprend ces mêmes valeurs pour
// dimensionner sa colonne de grille.
$menu-largeur-deplie: 260px;
$menu-largeur-repliee: 76px;

.menu-lateral {
  display: flex;
  flex-direction: column;
  width: $menu-largeur-deplie;
  min-height: 100vh;
  padding: t.$espace-3 0;
  background: t.$degrade-menu;
  color: t.$couleur-menu-texte;
  transition: width 0.2s ease;

  &--replie {
    width: $menu-largeur-repliee;
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-lateral {
    transition: none;
  }
}

// -----------------------------------------------------------------------
// En-tête de marque
// -----------------------------------------------------------------------
.menu-marque {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  padding: 0 t.$espace-3 t.$espace-4;
}

.menu-marque__pastille {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  // Liseré clair pour détacher la pastille du dégradé : dérivé du token
  // `$couleur-texte-inverse` (blanc), pas une couleur en dur.
  box-shadow: 0 0 0 2px rgba(t.$couleur-texte-inverse, 0.35);
}

.menu-marque__texte {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.menu-marque__nom {
  font-size: t.$taille-texte-grande;
  font-weight: t.$graisse-extra-gras;
  color: t.$couleur-menu-texte-actif;
}

.menu-marque__sous-titre {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-menu-texte;
}

.menu-lateral--replie {
  .menu-marque {
    justify-content: center;
    padding-inline: 0;
  }

  .menu-marque__texte {
    display: none;
  }
}

// -----------------------------------------------------------------------
// Groupes & items de navigation
// -----------------------------------------------------------------------
.menu-nav {
  display: flex;
  flex-direction: column;
  gap: t.$espace-4;
  padding: 0 t.$espace-2;
}

.menu-groupe {
  display: flex;
  flex-direction: column;
  gap: t.$espace-1;
}

.menu-groupe__titre {
  margin: 0 0 t.$espace-1;
  padding: 0 t.$espace-2;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: t.$couleur-menu-texte;
}

.menu-lateral--replie .menu-groupe__titre {
  display: none;
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
  padding: 0 t.$espace-3;
  border-radius: t.$rayon-md;
  color: t.$couleur-menu-texte;
  font-weight: t.$graisse-moyenne;
  text-decoration: none;

  // Survol : fond discret seulement — le texte reste dans sa teinte normale
  // et ne prend pas le blanc plein, pour réserver le traitement fort (fond +
  // barre d'accent + graisse renforcée + texte blanc) au seul item actif.
  &:hover {
    background-color: rgba(t.$couleur-texte-inverse, 0.08);
  }

  // Le mixin global `focus-visible` (`_mixins.scss`) cible `$couleur-focus`,
  // pensé pour un fond clair : sur le dégradé teal foncé du menu, son
  // contraste est insuffisant. On pose ici un contour dédié, en
  // `$couleur-texte-inverse` (blanc), visible sur le dégradé.
  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-texte-inverse;
    outline-offset: 2px;
  }
}

// État actif : jamais la seule couleur — fond teinté + barre d'accent + graisse renforcée.
.menu-item--actif {
  color: t.$couleur-menu-texte-actif;
  background-color: t.$couleur-menu-item-actif-fond;
  font-weight: t.$graisse-gras;

  &::before {
    content: '';
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 0;
    width: 4px;
    border-radius: t.$rayon-sm;
    background-color: t.$couleur-menu-item-actif-accent;
  }
}

.menu-item__libelle {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.menu-item__infobulle {
  display: none;
}

.menu-lateral--replie {
  .menu-item {
    justify-content: center;
    padding-inline: 0;
  }

  .menu-item__libelle {
    display: none;
  }

  .menu-item:hover .menu-item__infobulle,
  .menu-item:focus-visible .menu-item__infobulle,
  .menu-item:focus-within .menu-item__infobulle {
    display: block;
  }

  .menu-item__infobulle {
    position: absolute;
    left: 100%;
    top: 50%;
    z-index: 10;
    margin-left: t.$espace-2;
    padding: t.$espace-1 t.$espace-2;
    border-radius: t.$rayon-sm;
    background-color: t.$couleur-texte;
    color: t.$couleur-texte-inverse;
    font-size: t.$taille-texte-petite;
    font-weight: t.$graisse-moyenne;
    white-space: nowrap;
    box-shadow: t.$ombre-legere;
    pointer-events: none;
    transform: translateY(-50%);
  }
}

// -----------------------------------------------------------------------
// Pied : espaceur + emplacement réservé + bouton de repli
// -----------------------------------------------------------------------
.menu-espaceur {
  flex: 1 1 auto;
}

.menu-bascule {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  width: 100%;
  min-height: t.$cible-cliquable-min;
  margin-top: t.$espace-2;
  padding: 0 t.$espace-3;
  border: none;
  background: transparent;
  color: t.$couleur-menu-texte;
  font: inherit;
  font-weight: t.$graisse-moyenne;
  cursor: pointer;

  &:hover {
    background-color: rgba(t.$couleur-texte-inverse, 0.08);
  }

  // Voir `.menu-item:focus-visible` ci-dessus : contour dédié, visible sur
  // le dégradé teal du menu (le mixin global est pensé pour un fond clair).
  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-texte-inverse;
    outline-offset: 2px;
  }
}

.menu-bascule__icone {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .menu-bascule__icone {
    transition: none;
  }
}

.menu-lateral--replie {
  .menu-bascule {
    justify-content: center;
    padding-inline: 0;
  }

  .menu-bascule__libelle {
    display: none;
  }

  .menu-bascule__icone {
    transform: rotate(180deg);
  }
}
</style>
