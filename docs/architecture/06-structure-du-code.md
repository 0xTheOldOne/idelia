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
    │   ├── initialesVega.js    # règles du champ Personne.initialesVega [0034]
    │   ├── diffusion.js        # modèle du planning papier (construireDiffusion, titreDocumentDiffusion) [0012]
    │   ├── feuilleDeRoute/     # lecture des séances Vega, détection des relais, répartition et reversements [0033, 0034]
    │   │   ├── extraireSeances.js
    │   │   ├── detecterRelais.js
    │   │   └── relierInfirmieres.js  # code PS Vega → personne de l'équipe (initialesVega) [0034]
    │   └── utils/
    │       ├── dates.js        # dateUtil : parse/format/addDays/diffDays/weekdayISO/rangeInclusive
    │       ├── couleurs.js     # estCouleurFoncee (contraste du texte sur une pastille)
    │       └── id.js           # genId() (crypto.randomUUID + secours)
    │
    ├── storage/
    │   ├── storageRepository.js  # abstraction load/save/clear/isAvailable (async) [ADR 0005]
    │   └── migrations.js         # CURRENT_SCHEMA_VERSION + pipeline de migration
    │
    ├── adaptateurs/            # I/O navigateur + bibliothèques tierces (jamais de persistance : c'est le rôle de storage/)
    │   └── lireGlyphesPdf.js   # lecture PDF via pdfjs-dist, chargé à la demande [ADR 0019, 0033]
    │
    ├── views/                  # écrans (un par route)
    │   ├── AccueilView.vue
    │   ├── EquipeView.vue
    │   ├── TourneesView.vue
    │   ├── AbsencesView.vue
    │   ├── PlanningView.vue
    │   ├── DiffusionView.vue   # aperçu imprimable /planning/:id/diffusion [0012]
    │   ├── FeuilleDeRouteView.vue  # relais matin/après-midi depuis un PDF Vega [0033]
    │   └── ParametresView.vue
    │
    ├── components/             # composants réutilisables
    │   ├── communs/            # boutons, champs, modale, confirmation, icône…
    │   ├── equipe/
    │   ├── tournees/
    │   ├── absences/
    │   ├── planning/           # grille, cellule, panneau de conflits, drag & drop
    │   ├── diffusion/          # feuille A4, tableau de mois, légende, pastille de personne [0012]
    │   └── feuilleDeRoute/     # zone de dépôt, résumé, cartes de relais [0033]
    │
    ├── composables-ou-mixins/  # si logique UI transverse (rester minimal en Options API)
    │
    └── styles/                 # SCSS (voir instructions/style-scss.md)
        ├── _tokens.scss        # couleurs, espacements, typographie, rayons…
        ├── _bootstrap.scss     # surcharge des variables Bootstrap via les tokens + import ciblé [ADR 0015]
        ├── _mixins.scss
        ├── _base.scss
        ├── _impression.scss    # @page A4 portrait, fond blanc à l'impression [0012]
        └── main.scss           # point d'entrée importé dans main.js
```

## Conventions de nommage

- **Domaine en français** : entités, champs, actions, variables métier utilisent le vocabulaire du glossaire ([02](02-modele-de-domaine.md)) — `personnes`, `tournees`, `affectations`, `genererPlanning`…
- **Composants** : `PascalCase` (`GrillePlanning.vue`, `ChampTexte.vue`). Les vues d'écran se terminent par `View` (`EquipeView.vue`).
- **Fichiers JS** : `camelCase` (`storageRepository.js`, `dateUtil` exporté depuis `dates.js`).
- **Enums** : codes `MAJUSCULES_SNAKE` ; libellés affichés via une table de correspondance.
- **Modules du domaine** : ne jamais importer Vue/Vuex ; exposer des fonctions pures.

Les conventions détaillées (structure de composant, style, validation, Vuex) sont dans [`../instructions/`](../instructions/).
