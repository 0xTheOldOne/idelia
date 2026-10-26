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
    │       ├── vacancesScolaires.js # cache des vacances par zone et année scolaire, via l'adaptateur [0023]
    │       └── ui.js           # non persisté
    │
    ├── domain/                 # LOGIQUE MÉTIER PURE (aucun import Vue/Vuex)
    │   ├── schema.js           # enums, valeurs par défaut, toSaveDocument/fromSaveDocument, verifierIntegrite
    │   ├── adresse.js          # adresse postale générique : forme, normalisation, code postal, affichage (cabinet 0039, personnes 0040)
    │   ├── coordonnees.js      # date de naissance et rubriques « Adresse et naissance » d'une personne (adresse : voir adresse.js) [0040]
    │   ├── scheduling/         # moteur de planification (voir 05)
    │   ├── remplacement.js     # identification des remplaçantes (estRemplacante) [0021]
    │   ├── initialesVega.js    # règles du champ Personne.initialesVega [0034]
    │   ├── identifiantsPro.js  # identifiants professionnels d'une personne (normalisation, formats) [0030]
    │   ├── iconesTournee.js    # codes et libellés des icônes de repère des tournées [0029]
    │   ├── theme.js            # préférence de thème : options, normalisation, résolution Automatique [0038]
    │   ├── rythmeMensuel.js    # jours attendus d'une personne sur une période selon son rythme mensuel [0020, réutilisé par 0024]
    │   ├── recapMensuel.js     # récap par mois et par personne : grandes/petites tournées, jours travaillés, dépassement du rythme [0024]
    │   ├── souhaitsNonRespectes.js # localise les souhaits non respectés (violations PREFERENCE_*) sur les affectations, textes de l'indicateur [0025]
    │   ├── trameWeekend.js     # weekends travaillés / de repos d'une trame « un weekend sur X » [0022]
    │   ├── contrats/           # modèles de contrats : catalogue des marqueurs, Delta, remplacement [0041]
    │   ├── calendrier/         # repères calendaires, logique pure, aucun fetch [0023]
    │   │   ├── joursFeries.js  # 11 fériés nationaux, Pâques par algorithme
    │   │   ├── vacancesScolaires.js # zones, années scolaires, normalisation de la réponse API et du cache, messages
    │   │   └── reperes.js      # reperesDuJour / construireSourcesReperes (grille et diffusion)
    │   ├── diffusion.js        # modèle du planning papier (construireDiffusion, titreDocumentDiffusion) [0012]
    │   ├── envoiEmail.js       # destinataires, objet, corps et lien mailto: de l'envoi du planning par e-mail [0027]
    │   ├── feuilleDeRoute/     # lecture des séances Vega, détection des relais, répartition, reversements et bilan [0033, 0034, 0035]
    │   │   ├── extraireSeances.js
    │   │   ├── detecterRelais.js
    │   │   ├── bilanReversements.js  # cumul de la période et virements à faire [0035]
    │   │   ├── relierInfirmieres.js  # code PS Vega → personne de l'équipe (initialesVega), → compte de la titulaire [0034, 0036]
    │   │   └── fluxComptes.js  # comptes des titulaires, virements et rétrocessions [0036]
    │   └── utils/
    │       ├── dates.js        # dateUtil : parse/format/addDays/diffDays/weekdayISO/rangeInclusive
    │       ├── couleurs.js     # estCouleurFoncee (contraste du texte sur une pastille)
    │       └── id.js           # genId() (crypto.randomUUID + secours)
    │
    ├── storage/
    │   ├── storageRepository.js  # abstraction load/save/clear/isAvailable (async) [ADR 0005]
    │   ├── indexedDb.js          # accès IndexedDB minimal, importé par storageRepository seul [ADR 0021]
    │   └── migrations.js         # CURRENT_SCHEMA_VERSION + pipeline de migration
    │
    ├── adaptateurs/            # I/O navigateur + bibliothèques tierces (jamais de persistance : c'est le rôle de storage/)
    │   ├── lireGlyphesPdf.js   # lecture PDF via pdfjs-dist, chargé à la demande [ADR 0019, 0033]
    │   ├── imageLogo.js        # préparation du logo du cabinet : décodage, réduction ≤ 400 px, réencodage PNG/JPEG via canvas [0039]
    │   ├── editeurRiche.js     # éditeur Quill chargé à la demande, blot marqueur [ADR 0023, 0041]
    │   ├── calendrierScolaire.js # lecture GET de l'API du calendrier scolaire, seul accès réseau [ADR 0020, 0023]
    │   ├── themeNavigateur.js  # prefers-color-scheme, attribut data-bs-theme, bascule à l'impression [0038, ADR 0022]
    │   └── pressePapiers.js    # copie de texte (API Clipboard) [0027]
    │
    ├── views/                  # écrans (un par route)
    │   ├── AccueilView.vue
    │   ├── CabinetView.vue     # identité du cabinet et règles d'organisation [0039]
    │   ├── EquipeView.vue
    │   ├── TourneesView.vue
    │   ├── AbsencesView.vue
    │   ├── PlanningView.vue
    │   ├── DiffusionView.vue   # aperçu imprimable /planning/:id/diffusion [0012]
    │   ├── FeuilleDeRouteView.vue  # relais matin/après-midi depuis un PDF Vega [0033]
    │   └── ParametresView.vue
    │
    ├── components/             # composants réutilisables
    │   ├── communs/            # boutons, champs, modale, confirmation, icône, pastille de tournée [0029]…
    │   ├── contrats/           # modèles de contrats : liste, éditeur riche, barre d'outils, marqueurs [0041]
    │   ├── cabinet/            # blocs de la page Cabinet : identité, logo, jours d'ouverture, créneaux, rythme [0039]
    │   ├── parametres/         # blocs de Paramètres : sauvegarde, sauvegarde automatique, BlocVacancesScolaires.vue [0023], BlocApparence.vue [0038]
    │   ├── equipe/
    │   ├── tournees/
    │   ├── absences/
    │   ├── planning/           # grille, cellule, panneau de conflits, récap mensuel [0024], drag & drop
    │   ├── diffusion/          # feuille A4, tableau de mois, légende, pastille de personne [0012], modale d'envoi par e-mail [0027]
    │   └── feuilleDeRoute/     # zone de dépôt, résumé, cartes de relais [0033], bilan [0035, 0036]
    │
    ├── composables-ou-mixins/  # si logique UI transverse (rester minimal en Options API)
    │
    └── styles/                 # SCSS (voir instructions/style-scss.md)
        ├── _tokens.scss        # couleurs, espacements, typographie, rayons…
        ├── _bootstrap.scss     # surcharge des variables Bootstrap via les tokens + import ciblé [ADR 0015]
        ├── _theme.scss         # CSS custom properties des deux palettes [ADR 0022]
        ├── _mixins.scss
        ├── _base.scss
        ├── _editeur-riche.scss # habillage de Quill (thème core) par les tokens [ADR 0023, 0041]
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
