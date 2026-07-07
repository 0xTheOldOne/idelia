import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import store from './store';
import '@/styles/main.scss';

// Pas de JS Bootstrap importé ici : aucun composant interactif Bootstrap
// n'est câblé en feature 001.
const app = createApp(App).use(router).use(store);

async function demarrer() {
  try {
    await store.dispatch('bootstrap');
  } catch (e) {
    // bootstrap ne devrait jamais rejeter, mais on monte l'app dans tous les cas
    console.error('Idelia — échec du démarrage :', e);
  } finally {
    app.mount('#app');
  }
}

demarrer();

if (import.meta.env.DEV) {
  // Outil de debug de développement, jetable : permet de dispatcher des
  // actions depuis la console (vérification manuelle feature 002).
  // Inactif en build de production.
  window.store = store;
}
