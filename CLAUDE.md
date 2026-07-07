# CLAUDE.md — Guide d'amorçage Idelia

> Lu par toute session Claude sur ce projet. À garder court : les détails vivent dans `docs/`.

## Le projet en 3 lignes

Idelia aide un **cabinet infirmier** à établir ses **plannings** (personnes, souhaits, tournées, absences). Application **100 % frontend Vue.js, sans backend**, hébergée en site statique. Public cible : personnes **peu à l'aise avec l'informatique** → **l'ergonomie prime sur tout le reste**.

## Règles d'or (non négociables)

1. **Aucun backend, aucune webapi.** Tout se passe dans le navigateur. Hébergement statique (Pages).
2. **JavaScript pur — PAS de TypeScript.** Le typage se documente en **JSDoc** (`@typedef`, `@param`, `@returns`).
3. **Vue 3 en Options API** (pas de Composition API), **Vuex** (pas de Pinia), **vue-router**, **Vite**.
4. **Style en SCSS.** Icônes exclusivement depuis **`@phosphor-icons/vue`**.
5. **Validation des formulaires** avec **Vuelidate** ; débounce des saisies avec **vue-debounce**.
6. **Jours de la semaine en ISO 8601 : `1`=Lundi … `7`=Dimanche.** Ne **jamais** utiliser le `0`=dimanche de `Date.getDay()` sans conversion. Voir [ADR 0010](docs/adr/0010-conventions-dates-et-jours-iso.md).
7. **Dates calendaires** = chaînes `"YYYY-MM-DD"` ; **heures** = `"HH:mm"` ; **horodatages techniques** = ISO UTC (`toISOString()`). Jamais d'objet `Date` dans le state persistant.
8. **Toute persistance passe par `storageRepository`** — jamais d'accès direct à `localStorage` ailleurs. Voir [ADR 0005](docs/adr/0005-persistance-localstorage-derriere-repository.md).
9. **Le moteur de planification est un module pur** (`src/domain/scheduling/`) : aucun import de Vue/Vuex, testable en isolation. Voir [ADR 0008](docs/adr/0008-moteur-planification-module-pur.md).
10. **La logique métier vit dans `src/domain/`, pas dans les composants.** Les composants orchestrent l'UI et appellent le store / le domaine.
11. **Pas d'authentification** en v1.
12. **KISS** : préférer la solution la plus simple qui répond au besoin. Pas de dépendance ajoutée sans justification.

## Où trouver quoi

- **Pourquoi on fait les choses** → [`docs/adr/`](docs/adr/)
- **Comment c'est architecturé** → [`docs/architecture/`](docs/architecture/) (commencer par [`01-vue-ensemble.md`](docs/architecture/01-vue-ensemble.md))
- **Comment coder ici (par domaine)** → [`docs/instructions/`](docs/instructions/)
- **Quoi construire, dans quel ordre** → [`features/ROADMAP.md`](features/ROADMAP.md)
- **Plans de features** → [`features/`](features/) au format `NNN-NomDeLaFeature.md`

## Flux de travail

1. L'agent **`architecte`** transforme une demande en plan `features/NNN-*.md` (gabarit : [`features/000-modele-feature.md`](features/000-modele-feature.md)).
2. L'agent **`developpeur-vue`** implémente une feature à partir de son plan, en respectant instructions + ADR.
3. L'agent **`relecteur-ergonomie`** relit les écrans sous l'angle utilisateurs non-informaticiens.

## Environnement

Poste **Windows / PowerShell**. Utiliser la syntaxe PowerShell (`Get-ChildItem`, `Remove-Item -Recurse -Force`, `$env:VAR`, `$null`…), jamais les commandes Linux.
