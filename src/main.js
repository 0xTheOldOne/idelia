import { createApp } from 'vue';
import vueDebounce from 'vue-debounce';

import App from './App.vue';
import router from './router';
import store from './store';
import '@/styles/main.scss';

// Pas de JS Bootstrap importé ici : aucun composant interactif Bootstrap
// n'est câblé en feature 001.
const app = createApp(App).use(router).use(store);

// Directive globale de débounce des saisies (ADR 0011), utilisée notamment
// par le champ « Nom du cabinet » (feature 003). `lock: true` empêche la
// touche Entrée de déclencher la fonction avant la fin du délai.
app.directive('debounce', vueDebounce({ lock: true }));

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
