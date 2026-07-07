# 01 — Vue d'ensemble

## Nature de l'application

Idelia est une **Single Page Application (SPA) Vue.js**, entièrement exécutée dans le navigateur, **sans backend** ([ADR 0002](../adr/0002-application-frontend-sans-backend.md)). Elle est déployable comme un simple site statique (GitHub/GitLab Pages).

## Les grandes couches

```
┌───────────────────────────────────────────────────────────────┐
│  UI (Vue 3, Options API)                                        │
│  - vues/écrans (routing vue-router)                             │
│  - composants réutilisables                                     │
│  - formulaires (Vuelidate + vue-debounce)                       │
└───────────────▲───────────────────────────┬───────────────────┘
                │ getters / dispatch         │ appels de fonctions pures
┌───────────────┴───────────────┐   ┌────────▼───────────────────┐
│  État (Vuex)                   │   │  Domaine (src/domain/)      │
│  - modules namespaced          │   │  - scheduling/ (moteur pur) │
│  - plugin de persistance       │   │  - schema (entités, défauts)│
│    (débouncé)                  │   │  - utils (dates, id…)       │
└───────────────┬───────────────┘   └─────────────────────────────┘
                │ load() / save() (async)
┌───────────────▼───────────────────────────────────────────────┐
│  storageRepository  →  LocalStorage (v1)  [ADR 0005]           │
│  + export/import JSON (fichier)           [ADR 0006]           │
└───────────────────────────────────────────────────────────────┘
```

## Règle de dépendances

- Les **composants** ne contiennent **pas** de logique métier : ils lisent l'état via des getters, déclenchent des actions, et appellent au besoin des fonctions pures du **domaine**.
- Le **domaine** (`src/domain/`) ne connaît **ni** Vue **ni** Vuex. Il est constitué de fonctions pures et de données ([ADR 0008](../adr/0008-moteur-planification-module-pur.md)).
- Seul le **repository** touche au stockage. Ni le store ni les composants n'accèdent à `localStorage` directement ([ADR 0005](../adr/0005-persistance-localstorage-derriere-repository.md)).

## Flux de données typiques

**Au démarrage** : `app/bootstrap` → `storageRepository.load()` → migration + validation → hydratation atomique du store (`REPLACE_ALL`). Si rien n'est stocké : état par défaut (cabinet par défaut).

**Édition courante** (ex. ajouter une personne) : composant → `dispatch('personnes/ajouter', …)` → mutation → le **plugin de persistance** (débouncé ~400 ms) sérialise l'état et appelle `storageRepository.save(doc)`.

**Génération d'un planning** : l'écran collecte les entrées depuis le store → appelle `genererPlanning(input)` (domaine pur) → stocke le résultat (affectations) dans le module `plannings` → l'éditeur affiche la grille et recalcule les conflits via `validerPlanning` / `validerIncrementale`.

**Sauvegarde/partage** : `app/exporter` → `toSaveDocument(state)` → téléchargement d'un fichier JSON. `app/importer(fichier)` → migration + validation → `REPLACE_ALL` → flush de persistance ([ADR 0006](../adr/0006-sauvegarde-partage-par-export-import-json.md)).

**Diffusion** : le référent imprime / exporte en PDF une vue lecture du planning pour l'équipe ([ADR 0009](../adr/0009-workflow-referent-diffusion-lecture.md)).
