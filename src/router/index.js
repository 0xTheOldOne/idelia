import { createRouter, createWebHashHistory } from 'vue-router';

import AccueilView from '@/views/AccueilView.vue';
import EquipeView from '@/views/EquipeView.vue';
import TourneesView from '@/views/TourneesView.vue';
import AbsencesView from '@/views/AbsencesView.vue';
import PlanningView from '@/views/PlanningView.vue';
import ParametresView from '@/views/ParametresView.vue';

/**
 * Routes de l'application (feature 001 : écrans placeholder uniquement).
 * Les routes paramétrées (souhaits, diffusion) seront ajoutées par les
 * features 005 et 012.
 */
const routes = [
  { path: '/', name: 'accueil', component: AccueilView },
  { path: '/equipe', name: 'equipe', component: EquipeView },
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
