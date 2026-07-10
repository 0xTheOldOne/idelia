# 06 — Structure du code

Arborescence cible de l'application Vue (créée à la feature `0001`, voir [ROADMAP](../../features/ROADMAP.md)). Elle matérialise la séparation **UI / état / domaine / stockage** ([01](01-vue-ensemble.md)).

```
Idelia/
├── index.html
├── package.json
├── vite.config.js
├── public/
└── src/
    ├── main.js                 # création de l'app, plugins (router, store), montage
    ├── App.vue                 # layout racine (barre de navigation, <router-view/>)
    │
    ├── router/
    │   └── index.js            # définition des routes (voir 07-navigation-et-ecrans)
    │
    ├── store/
    │   ├── index.js            # assemblage des modules + plugin de persistance + REPLACE_ALL
    │   └── modules/
    │       ├── cabinet.js
    │       ├── personnes.js
    │       ├── tournees.js
    │       ├── absences.js
    │       ├── plannings.js
    │       └── ui.js           # non persisté
    │
    ├── domain/                 # LOGIQUE MÉTIER PURE (aucun import Vue/Vuex)
    │   ├── schema.js           # enums, valeurs par défaut, toSaveDocument/fromSaveDocument, verifierIntegrite
    │   ├── scheduling/         # moteur de planification (voir 05)
    │   └── utils/
    │       ├── dates.js        # dateUtil : parse/format/addDays/diffDays/weekdayISO/rangeInclusive
    │       └── id.js           # genId() (crypto.randomUUID + secours)
    │
    ├── storage/
    │   ├── storageRepository.js  # abstraction load/save/clear/isAvailable (async) [ADR 0005]
    │   └── migrations.js         # CURRENT_SCHEMA_VERSION + pipeline de migration
    │
    ├── views/                  # écrans (un par route)
    │   ├── AccueilView.vue
    │   ├── EquipeView.vue
    │   ├── TourneesView.vue
    │   ├── AbsencesView.vue
    │   ├── PlanningView.vue
    │   └── ParametresView.vue
    │
    ├── components/             # composants réutilisables
    │   ├── communs/            # boutons, champs, modale, confirmation, icône…
    │   ├── equipe/
    │   ├── tournees/
    │   ├── absences/
    │   └── planning/           # grille, cellule, panneau de conflits, drag & drop
    │
    ├── composables-ou-mixins/  # si logique UI transverse (rester minimal en Options API)
    │
    └── styles/                 # SCSS (voir instructions/style-scss.md)
        ├── _tokens.scss        # couleurs, espacements, typographie, rayons…
        ├── _bootstrap.scss     # surcharge des variables Bootstrap via les tokens + import ciblé [ADR 0015]
        ├── _mixins.scss
        ├── _base.scss
        └── main.scss           # point d'entrée importé dans main.js
```

## Conventions de nommage

- **Domaine en français** : entités, champs, actions, variables métier utilisent le vocabulaire du glossaire ([02](02-modele-de-domaine.md)) — `personnes`, `tournees`, `affectations`, `genererPlanning`…
- **Composants** : `PascalCase` (`GrillePlanning.vue`, `ChampTexte.vue`). Les vues d'écran se terminent par `View` (`EquipeView.vue`).
- **Fichiers JS** : `camelCase` (`storageRepository.js`, `dateUtil` exporté depuis `dates.js`).
- **Enums** : codes `MAJUSCULES_SNAKE` ; libellés affichés via une table de correspondance.
- **Modules du domaine** : ne jamais importer Vue/Vuex ; exposer des fonctions pures.

Les conventions détaillées (structure de composant, style, validation, Vuex) sont dans [`../instructions/`](../instructions/).
