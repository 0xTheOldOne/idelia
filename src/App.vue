<template>
  <div class="app-layout">
    <nav class="navbar navbar-expand navbar-idelia" aria-label="Navigation principale">
      <div class="container-fluid">
        <span class="navbar-brand mb-0 h1">Idelia</span>
        <ul class="nav">
          <li v-for="item in navigation" :key="item.nom" class="nav-item">
            <router-link :to="item.chemin" class="nav-link app-lien-nav">
              <component :is="item.icone" :size="20" aria-hidden="true" />
              <span>{{ item.libelle }}</span>
            </router-link>
          </li>
        </ul>
      </div>
    </nav>

    <main class="container-fluid app-contenu">
      <router-view />
    </main>
  </div>
</template>

<script>
import { PhHouse, PhUsers, PhPath, PhCalendarX, PhCalendarBlank, PhGear } from '@phosphor-icons/vue';

export default {
  name: 'App',
  components: { PhHouse, PhUsers, PhPath, PhCalendarX, PhCalendarBlank, PhGear },
  data() {
    return {
      // Barre de navigation permanente (feature 001) : chaque icône est
      // toujours doublée d'un libellé texte (accessibilité).
      navigation: [
        { nom: 'accueil', chemin: '/', libelle: 'Accueil', icone: 'PhHouse' },
        { nom: 'equipe', chemin: '/equipe', libelle: 'Équipe', icone: 'PhUsers' },
        { nom: 'tournees', chemin: '/tournees', libelle: 'Tournées', icone: 'PhPath' },
        { nom: 'absences', chemin: '/absences', libelle: 'Absences & congés', icone: 'PhCalendarX' },
        { nom: 'planning', chemin: '/planning', libelle: 'Planning', icone: 'PhCalendarBlank' },
        { nom: 'parametres', chemin: '/parametres', libelle: 'Paramètres', icone: 'PhGear' },
      ],
    };
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.navbar-idelia {
  background-color: t.$couleur-primaire;
}

.navbar-brand {
  color: #fff;
}

.app-lien-nav {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  min-height: t.$cible-cliquable-min;
  padding: 0 t.$espace-3;
  color: rgba(255, 255, 255, 0.85);

  &:hover {
    color: #fff;
  }

  // État actif : couleur ET repère non-coloré (gras + soulignement) —
  // l'information ne repose jamais sur la seule couleur.
  &.active {
    color: #fff;
    font-weight: t.$graisse-gras;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
}

.app-contenu {
  padding-top: t.$espace-4;
  padding-bottom: t.$espace-4;
}
</style>
