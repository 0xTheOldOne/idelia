import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Politique de sécurité du contenu (GitHub Pages ne permet pas d'en-têtes HTTP).
// Injectée au build uniquement : le serveur de dev (HMR) a besoin de styles/scripts inline.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://data.education.gouv.fr",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const cspPlugin = {
  name: 'idelia-csp',
  apply: 'build',
  transformIndexHtml() {
    return [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
        injectTo: 'head-prepend',
      },
    ]
  },
}

// https://vite.dev/config/
export default defineConfig({
  // Déploiement futur sur GitHub Pages sous https://<user>.github.io/idelia/
  base: '/idelia/',
  plugins: [vue(), cspPlugin],
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
