import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // Déploiement futur sur GitHub Pages sous https://<user>.github.io/idelia/
  base: '/idelia/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Bootstrap 5.3 utilise encore `@import` et des fonctions globales
        // Sass, ce qui déclenche de nombreux avertissements de dépréciation
        // avec Dart Sass récent. On les tait pour les dépendances tierces
        // (notre propre SCSS reste écrit avec `@use`).
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
      },
    },
  },
})
