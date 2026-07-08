import { createRouter, createWebHashHistory } from 'vue-router';

import AccueilView from '@/views/AccueilView.vue';
import EquipeView from '@/views/EquipeView.vue';
import SouhaitsView from '@/views/SouhaitsView.vue';
import TourneesView from '@/views/TourneesView.vue';
import AbsencesView from '@/views/AbsencesView.vue';
import PlanningView from '@/views/PlanningView.vue';
import ParametresView from '@/views/ParametresView.vue';

/**
 * Routes de l'application. `souhaits` (feature 005) est la première route
 * paramétrée : le rafraîchissement direct sur `/#/equipe/<id>/souhaits`
 * fonctionne car le `bootstrap` du store hydrate l'état avant le montage. La
 * route paramétrée de diffusion (feature 012) sera ajoutée plus tard.
 */
const routes = [
  { path: '/', name: 'accueil', component: AccueilView },
  { path: '/equipe', name: 'equipe', component: EquipeView },
  { path: '/equipe/:id/souhaits', name: 'souhaits', component: SouhaitsView },
  { path: '/tournees', name: 'tournees', component: TourneesView },
  { path: '/absences', name: 'absences', component: AbsencesView },
  { path: '/planning', name: 'planning', component: PlanningView },
  { path: '/parametres', name: 'parametres', component: ParametresView },
];

/**
 * Mode hash imposé (ADR 0016) : hébergement statique GitHub Pages fiable
 * (rafraîchissement et liens directs sans configuration serveur).
 */
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  linkActiveClass: 'active',
  linkExactActiveClass: 'active',
});

export default router;
