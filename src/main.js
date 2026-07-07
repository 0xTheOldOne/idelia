import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import store from './store';
import '@/styles/main.scss';

// Pas de JS Bootstrap importé ici : aucun composant interactif Bootstrap
// n'est câblé en feature 001.
createApp(App).use(router).use(store).mount('#app');
