# Feature 001 — Bootstrap projet Vite

- **Statut** : Fait
- **Dépend de** : — (première feature, aucune dépendance)
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (sans backend), [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (stack), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS pur), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates/jours ISO), [0012](../docs/adr/0012-style-scss.md) (SCSS), [0013](../docs/adr/0013-icones-phosphor.md) (Phosphor), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (Bootstrap), [0016](../docs/adr/0016-router-mode-hash-pour-pages.md) (router en mode hash). Préparent le terrain pour [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) et [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md), utilisés dès la feature 002+.

## 1. Contexte & objectif

C'est la **toute première** feature du projet : elle ne livre **aucune fonctionnalité métier**. Son but est de poser la **coquille applicative runnable** et les **squelettes** de chaque couche (UI / état / domaine / stockage) conformément à l'architecture cible ([06](../docs/architecture/06-structure-du-code.md)).

À l'issue de 001, l'application **démarre** (`npm run dev`) et **se construit** (`npm run build`) ; on peut **naviguer** entre des écrans placeholder via une barre de navigation permanente ; le **thème SCSS + Bootstrap** (tokens de design) et les **icônes Phosphor** sont opérationnels. La logique métier, la persistance et les données réelles sont explicitement **hors périmètre** (features 002 et suivantes).

## 2. Écrans concernés

Création de **6 écrans placeholder** (un titre + un court texte d'attente chacun), rattachés aux routes de la [carte des écrans](../docs/architecture/07-navigation-et-ecrans.md). Les routes paramétrées (`/equipe/:id/souhaits`, `/planning/:id/diffusion`) sont **hors périmètre** (features 005 / 012).

| Route | Écran (vue) | Feature cible du contenu réel |
|---|---|---|
| `/` | `AccueilView.vue` | 013 |
| `/equipe` | `EquipeView.vue` | 004 |
| `/tournees` | `TourneesView.vue` | 006 |
| `/absences` | `AbsencesView.vue` | 007 |
| `/planning` | `PlanningView.vue` | 010 / 011 |
| `/parametres` | `ParametresView.vue` | 003 / 008 |

**Expérience visée (utilisateur non-technique)** : une **barre de navigation toujours visible** (libellés en français courant + icône Phosphor), l'écran courant **clairement mis en évidence**, et sur chaque écran un **titre explicite** indiquant où l'on se trouve. Le contenu de chaque écran se limite pour l'instant à son titre et à une phrase « Cet écran arrivera prochainement. » — pas de cul-de-sac, la navigation reste toujours accessible.

**Layout (`App.vue`)** : barre de navigation permanente + zone `<router-view/>`. La navigation utilise les **classes Bootstrap** (`navbar`, `nav`, utilitaires d'espacement) thémées par nos tokens.

## 3. Modèle de données touché

**Aucun.** 001 ne définit ni entité ni champ métier et ne persiste rien.

- `src/domain/schema.js` est créé en **placeholder** (fichier présent, sans logique de (dé)sérialisation ni `verifierIntegrite`) pour matérialiser l'emplacement ; son remplissage relève de la feature **002**.
- La notion de `schemaVersion` / `CURRENT_SCHEMA_VERSION` et les migrations sont **posées en squelette** (voir §5) mais **non implémentées** : c'est la feature **002** qui les activera ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).

## 4. Store (Vuex)

Mise en place de l'**ossature Vuex** uniquement, sans état métier ni persistance.

- `src/store/index.js` : assemble les modules via `createStore` et les expose en `modules`. **Pas** de plugin de persistance ni de mutation `REPLACE_ALL` à ce stade (feature **002**, [ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) / [archi 04](../docs/architecture/04-gestion-etat-vuex.md)).
- `src/store/modules/` : **6 modules namespacés VIDES**, chacun exportant un objet `{ namespaced: true, state: () => ({}), getters: {}, mutations: {}, actions: {} }` :
  - `cabinet.js`, `personnes.js`, `tournees.js`, `absences.js`, `plannings.js` (destinés à être persistés plus tard),
  - `ui.js` (**non persisté**, état volatile d'interface).
- **Persisté vs volatile** : non applicable en 001 (aucun state). La distinction est documentée ici pour guider la feature 002.

## 5. Domaine (logique pure)

Création des **squelettes** de `src/domain/` (aucun import de Vue/Vuex — [ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)) :

- `src/domain/utils/dates.js` — **squelette minimal** exportant un objet `dateUtil` avec les fonctions documentées ([06](../docs/architecture/06-structure-du-code.md)) : `parse`, `format`, `addDays`, `diffDays`, `weekdayISO`, `rangeInclusive`. Chaque fonction porte sa **JSDoc** (`@param`/`@returns`). La conversion `Date.getDay()` (0=dimanche) → **ISO 1-7** (1=lundi…7=dimanche) est faite **ici et une seule fois** dans `weekdayISO`, conformément à l'[ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md). Implémentation minimale mais correcte (pas de dépendance externe type `dayjs` en 001, KISS).
- `src/domain/utils/id.js` — **squelette minimal** exportant `genId()` : `crypto.randomUUID()` avec un secours (fallback) simple si indisponible.
- `src/domain/schema.js` — **placeholder** (voir §3), à remplir en 002.
- `src/domain/scheduling/` — **placeholder** : dossier créé avec un fichier d'amorçage (ex. `index.js` exportant un objet vide et documenté « moteur — feature 009 »). Aucune logique de génération ([archi 05](../docs/architecture/05-moteur-de-planification.md), feature **009**).

> Règle : ces modules restent **purs**. Interdiction d'importer Vue/Vuex ; interdiction de manipuler `Date` ailleurs qu'à travers `dateUtil` ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)).

## 6. Composants

- `src/App.vue` — **layout racine** : barre de navigation permanente + `<router-view/>`. Enregistre localement les composants d'icônes Phosphor de la navigation. Aucune logique métier.
- `src/views/` — **6 écrans placeholder** (voir §2) : chacun affiche un `<h1>` (titre d'écran) et une phrase d'attente. `name` en `PascalCase`, suffixe `View`.
- `src/components/communs/` — dossier créé, **vide ou avec un composant d'amorçage minimal réutilisable** si utile à la navigation (ex. un petit composant d'item de navigation), sinon laissé pour les features suivantes (KISS : ne rien créer d'inutile).
- **Icônes** : exclusivement `@phosphor-icons/vue` ([ADR 0013](../docs/adr/0013-icones-phosphor.md)), **jamais** Bootstrap Icons. Import **ciblé par icône** (poids maîtrisé) : `import { PhHouse } from '@phosphor-icons/vue'`. Chaque icône de navigation est **doublée d'un libellé texte** (accessibilité — [archi 08](../docs/architecture/08-principes-ux-ergonomie.md)).

**Table de référence « écran → icône » proposée** (à ajuster au catalogue Phosphor si besoin) :

| Écran | Icône Phosphor |
|---|---|
| Accueil | `PhHouse` |
| Équipe | `PhUsers` |
| Tournées | `PhPath` |
| Absences & congés | `PhCalendarX` |
| Planning | `PhCalendarBlank` |
| Paramètres | `PhGear` |

## 7. Règles de validation

**Aucune** en 001 : pas de formulaire. Les dépendances `@vuelidate/core`, `@vuelidate/validators` et `vue-debounce` sont **installées** (pour être disponibles) mais **non câblées** ; leur usage est cadré par l'[ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) et les [instructions formulaires](../docs/instructions/formulaires-validation.md), à partir de la feature **003+**.

## 8. Points d'attention ergonomie

- **Langage humain, zéro jargon** ([archi 08](../docs/architecture/08-principes-ux-ergonomie.md)) : libellés de navigation en français courant du métier (« Accueil », « Équipe », « Tournées », « Absences & congés », « Planning », « Paramètres »).
- **Toujours savoir où l'on est** : écran courant mis en évidence dans la barre (classe active de `router-link` / Bootstrap `.active`) + titre d'écran explicite.
- **Icône jamais seule** : chaque icône de navigation est accompagnée de son libellé (ou `aria-label` au minimum).
- **Focus clavier visible** et navigation au clavier possibles dès le socle (ne pas supprimer l'`outline`).
- **Cibles cliquables larges** (~44px) et bien espacées, via les tokens d'espacement.
- **Ne jamais transmettre l'information par la seule couleur** : l'état actif combine couleur **et** un repère non coloré (soulignement/gras/icône pleine).
- **Contraste AA** dès la définition des tokens de couleur.
- Ces principes sont vérifiés par la [checklist accessibilité](../docs/instructions/accessibilite-ergonomie.md).

## 9. Étapes d'implémentation

> Environnement **Windows / PowerShell**. Toutes les commandes sont en syntaxe PowerShell, exécutées **à la racine du dépôt** `Idelia/` (qui contient déjà `docs/`, `features/`, `.claude/`). Le dépôt n'étant pas encore un projet npm, on **scaffolde Vite en place** sans écraser la documentation existante.

### Étape 1 — Scaffolder Vite + Vue 3 (JS pur, Options API) via npm

Le dossier racine n'est pas vide (docs/features présents). Pour éviter tout écrasement, on génère dans un **dossier temporaire** puis on remonte les fichiers utiles.

```powershell
# 1. Générer le squelette Vite Vue (JavaScript, PAS de TypeScript) dans un dossier temporaire
npm create vite@latest .vite-scaffold -- --template vue

# 2. Remonter à la racine les fichiers de configuration et le dossier public
Move-Item -Path ".vite-scaffold/index.html", ".vite-scaffold/vite.config.js", ".vite-scaffold/package.json", ".vite-scaffold/.gitignore", ".vite-scaffold/public" -Destination . -Force

# (jsconfig.json est parfois généré ; le remonter s'il existe)
if (Test-Path ".vite-scaffold/jsconfig.json") { Move-Item -Path ".vite-scaffold/jsconfig.json" -Destination . -Force }

# 3. Supprimer le reste du scaffold (src/ par défaut, README, etc. : on recrée src/ selon l'archi)
Remove-Item -Recurse -Force .vite-scaffold
```

> **Choix du template** : `--template vue` = Vue 3 + **JavaScript** (surtout **pas** `vue-ts`). L'Options API est un choix de rédaction des composants, pas une option de scaffold ([ADR 0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md), [ADR 0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md)).
>
> **Alternative interactive** (si l'on préfère) : `npm create vite@latest .` puis choisir **« Ignore files and continue »** pour préserver `docs/`, `features/`, `.claude/`.

### Étape 2 — Installer les dépendances

```powershell
# Dépendances de base générées par Vite
npm install

# Dépendances applicatives (runtime)
npm install vuex@4 vue-router@4 bootstrap @popperjs/core @vuelidate/core @vuelidate/validators vue-debounce @phosphor-icons/vue

# Outillage de style (dev)
npm install -D sass
```

- `vuex@4` et `vue-router@4` : versions compatibles **Vue 3** ([ADR 0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md)).
- `bootstrap` + `@popperjs/core` : base de composants, intégrée en **SCSS** ([ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md)). Popper est requis par les composants JS interactifs (dropdown, tooltip…), installé maintenant même s'il n'est pas encore câblé.
- `@vuelidate/core`, `@vuelidate/validators`, `vue-debounce` : installés pour les features de formulaires ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md)), non câblés en 001.
- `@phosphor-icons/vue` : icônes ([ADR 0013](../docs/adr/0013-icones-phosphor.md)).
- `sass` : compilateur SCSS (dev) — [ADR 0012](../docs/adr/0012-style-scss.md).
- **KISS** : ne **rien** ajouter d'autre sans justification en ADR.

### Étape 3 — Configurer `vite.config.js` (alias `@`, base GitHub Pages)

Dans `vite.config.js` :
- Conserver le plugin `@vitejs/plugin-vue`.
- Ajouter l'alias `@` → `/src` (utilisé par les imports SCSS `@use '@/styles/tokens' as *;` et JS).
- Définir **`base: '/idelia/'`** (le dépôt cible s'appelle `idelia` → GitHub Pages servira sous `/idelia/`). Documenté ici, **sans publication** dans cette feature.

Valeurs exactes attendues (extrait de configuration, non-code applicatif) :

```
base: '/idelia/'
resolve.alias: { '@': <chemin absolu vers ./src> }
```

> Créer/mettre à jour `jsconfig.json` avec `compilerOptions.paths` `{ "@/*": ["./src/*"] }` pour l'autocomplétion de l'éditeur (confort, non bloquant).

### Étape 4 — Créer l'arborescence `src/` (voir §Arborescence)

Créer les dossiers/fichiers de la structure cible ([06](../docs/architecture/06-structure-du-code.md)) : `router/`, `store/` (+ `modules/`), `domain/` (+ `utils/`, `scheduling/`), `storage/`, `views/`, `components/communs/`, `styles/`, plus `main.js` et `App.vue`.

### Étape 5 — Styles SCSS (tokens → Bootstrap → base)

Créer `src/styles/` selon les [instructions style-scss](../docs/instructions/style-scss.md) :

1. `_tokens.scss` — **source de vérité** du design : couleurs (marque + sémantiques `succès`/`erreur`/`avertissement` + neutres), échelle d'**espacements** (`$espace-1`…`$espace-6`), **typographie** (`$police-base`, tailles, graisses, hauteurs de ligne), **rayons** (`$rayon-md`…), ombres, points de rupture. Contraste **AA**. Doit **au minimum** exposer les variables consommées par `_bootstrap.scss` (`$couleur-primaire`, `$police-base`, `$rayon-md`, et les couleurs sémantiques).
2. `_bootstrap.scss` — **pont tokens → Bootstrap**, en respectant **l'ordre d'import de l'[ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md)** :
   1. `@use 'tokens' as t;`
   2. `@import 'bootstrap/scss/functions';`
   3. **surcharge des variables Bootstrap** à partir des tokens (`$primary: t.$couleur-primaire;`, `$font-family-base: t.$police-base;`, `$border-radius: t.$rayon-md;`, plus `$success`/`$danger`/`$warning`, `$spacer`…) — **avant** l'import des variables Bootstrap ;
   4. `@import 'bootstrap/scss/variables';` puis `maps`, `mixins`, `root` ;
   5. **uniquement les modules utilisés** : `reboot`, `grid`, `buttons`, `forms`, `nav`, `navbar`, puis `utilities` + `utilities/api` pour les classes utilitaires. (Ajouter `modal`, `alert`… au fil des features, pas maintenant.)
3. `_mixins.scss` — mixins réutilisables (focus visible, media queries, carte…). Minimal en 001.
4. `_base.scss` — reset léger + styles d'éléments de base (`body`, titres, liens) construits sur les tokens.
5. `main.scss` — point d'entrée : `@use` des partiels dans l'ordre `tokens` → `bootstrap` → `mixins` → `base`, + styles globaux éventuels.

> **Thémer par les tokens uniquement**, jamais de valeur en dur surchargeant Bootstrap. N'importer que les modules SCSS réellement utilisés (poids).

### Étape 6 — `main.js` (montage de l'app)

`src/main.js` : `createApp(App)`, `.use(router)`, `.use(store)`, `import '@/styles/main.scss'`, puis `.mount('#app')`. **Ne pas** importer le JS global de Bootstrap ni de plugin de persistance en 001 (aucun composant interactif ni store persistant à ce stade).

### Étape 7 — Router (routes placeholder)

`src/router/index.js` : `createRouter` avec **`createWebHashHistory(import.meta.env.BASE_URL)`** ([ADR 0016](../docs/adr/0016-router-mode-hash-pour-pages.md) — mode hash pour un hébergement statique fiable, prend en compte `base: '/idelia/'`) et les 6 routes du §2, chacune pointant sur sa vue (import direct ou lazy `() => import(...)`). Définir la classe active (`linkActiveClass`/`linkExactActiveClass`) pour la mise en évidence de l'écran courant.

### Étape 8 — Store (ossature vide)

`src/store/index.js` : `createStore({ modules: { cabinet, personnes, tournees, absences, plannings, ui } })`. Créer les 6 modules **vides namespacés** (§4).

### Étape 9 — Domaine & stockage (squelettes)

Créer `src/domain/utils/dates.js` et `id.js` (squelettes minimaux, §5), `src/domain/schema.js` et `src/domain/scheduling/index.js` (placeholders), `src/storage/storageRepository.js` et `src/storage/migrations.js` (squelettes avec **signatures async** documentées `load`/`save`/`clear`/`isAvailable` et `CURRENT_SCHEMA_VERSION` + pipeline vide — **non implémentés**, feature 002, [ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).

### Étape 10 — `App.vue` (layout + navigation)

Layout avec **barre de navigation permanente** (libellés + icônes Phosphor de la table §6, `router-link` vers les 6 routes, état actif visible) et zone `<router-view/>`. Style via classes Bootstrap (`navbar`, `nav`…) + SCSS `scoped` pour le spécifique.

### Étape 11 — Écrans placeholder

Créer les 6 vues du §2, chacune avec un titre et une courte phrase d'attente.

### Étape 12 — Vérifier le démarrage et le build

```powershell
npm run dev      # démarre le serveur de dev (ouvrir l'URL affichée)
npm run build    # build de production (doit passer sans erreur)
npm run preview  # sert le build (vérifie le rendu sous la base /idelia/)
```

## 10. Critères d'acceptation

- [ ] Le projet est un **projet Vite + Vue 3 en JavaScript** (aucun fichier `.ts`, aucune config TypeScript) et `package.json` liste exactement les dépendances de l'étape 2.
- [ ] `npm run dev` **démarre** l'application sans erreur ; la page se charge avec la **barre de navigation permanente** et la page d'**Accueil**.
- [ ] La **navigation** fonctionne entre les 6 écrans placeholder (`/`, `/equipe`, `/tournees`, `/absences`, `/planning`, `/parametres`) ; l'écran courant est **clairement mis en évidence** et son **titre** est affiché.
- [ ] Le **thème Bootstrap** est actif et **piloté par les tokens** : un élément Bootstrap (ex. `.btn-primary`) utilise la **couleur primaire définie dans `_tokens.scss`** (et non le bleu Bootstrap par défaut).
- [ ] Au moins une **icône Phosphor** s'affiche (les icônes de la barre de navigation), chacune **accompagnée d'un libellé**.
- [ ] **Aucune** icône Bootstrap Icons, **aucun** wrapper Vue de Bootstrap, **aucun** accès direct à `localStorage`.
- [ ] La structure `src/` **correspond** à l'arborescence cible ([06](../docs/architecture/06-structure-du-code.md)) : `router/`, `store/modules/` (6 modules vides), `domain/utils/` + `scheduling/` + `schema.js`, `storage/`, `views/`, `components/communs/`, `styles/`.
- [ ] `weekdayISO()` (dans `dates.js`) renvoie **1 pour lundi … 7 pour dimanche** ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)).
- [ ] `npm run build` **réussit** ; `npm run preview` sert l'app et la navigation fonctionne.
- [ ] `vite.config.js` définit **`base: '/idelia/'`** (déploiement GitHub Pages préparé, non publié).
- [ ] Le focus clavier est **visible** et la barre de navigation est utilisable **au clavier**.

## 11. Vérification

1. **Démarrage** : `npm run dev`, ouvrir l'URL. Vérifier l'absence d'erreur console et l'affichage de la barre de navigation + Accueil.
2. **Navigation** : cliquer chaque lien ; vérifier le changement d'écran, le titre, et la mise en évidence de l'item actif. Refaire au **clavier** (Tab + Entrée) ; vérifier le focus visible.
3. **Thème** : inspecter un `.btn-primary` (ou une classe utilitaire de couleur) → sa couleur doit correspondre à `$couleur-primaire` de `_tokens.scss`. Modifier temporairement le token et confirmer que le rendu Bootstrap change (preuve du pont tokens → Bootstrap).
4. **Icônes** : confirmer le rendu net des icônes Phosphor de la navigation ; vérifier qu'un libellé/`aria-label` accompagne chaque icône.
5. **Domaine** : dans la console, vérifier rapidement `dateUtil.weekdayISO` sur un dimanche connu (ex. `2026-07-05` est un dimanche → doit renvoyer `7`) et un lundi (→ `1`).
6. **Build** : `npm run build` puis `npm run preview` ; re-tester la navigation sous la base `/idelia/`.
7. **Cas limites** : rafraîchir la page sur une route profonde (ex. `/#/planning`) en `preview` — en mode hash ([ADR 0016](../docs/adr/0016-router-mode-hash-pour-pages.md)), la page doit **se recharger sans 404** ; vérifier que la console reste sans erreur.

## 12. Décisions à confirmer / risques

- **Historique du router vs GitHub Pages** : ✅ **Décidé** — `createWebHashHistory(import.meta.env.BASE_URL)` ([ADR 0016](../docs/adr/0016-router-mode-hash-pour-pages.md)). Le mode hash fonctionne d'emblée sur un hébergement statique (rafraîchissement et liens directs fiables, aucun `404.html` à maintenir). Compromis assumé : présence du `#` dans les URLs, sans impact pour les utilisateurs cibles.
- **Sass + Bootstrap 5.3 (`@import`)** : Bootstrap 5.3 utilise encore `@import` et des fonctions globales, ce qui déclenche des **avertissements de dépréciation** avec les versions récentes de Dart Sass (et casserait avec Sass 2.0). **Mitigation** : suivre exactement l'ordre d'import de l'ADR 0015 ; en cas de bruit, épingler une version de `sass` compatible et/ou fixer le mode d'API Sass de Vite. Migration attendue vers `@use` sur les versions ultérieures de Bootstrap.
- **Répertoire racine non vide au scaffold** : le dépôt contient déjà `docs/`, `features/`, `.claude/`. La procédure « scaffold dans un dossier temporaire puis remontée » (étape 1) évite tout écrasement ; **vérifier** après coup que ces dossiers sont intacts et que `docs/`/`features/` ne se retrouvent pas dans `dist`.
- **`@popperjs/core` non utilisé en 001** : installé pour anticiper les composants interactifs (dropdown, tooltip, modale), mais **non importé** tant qu'aucun composant JS Bootstrap n'est câblé — normal, pas un oubli.
- **Vuelidate 2 en Options API** : `@vuelidate/core` (v2) est pensé d'abord pour la Composition API. Son usage en **Options API** (imposé par l'[ADR 0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md)) demande un petit pont (`setup()` renvoyant `v$: useVuelidate()` + option `validations()`). **Sans impact en 001** (non câblé), mais à cadrer dans la feature de formulaires (003+) et éventuellement à préciser dans l'[ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md).
- **`components/communs/` vide** : par KISS, ne créer un composant d'amorçage que s'il sert réellement la navigation ; sinon laisser le dossier prêt pour les features suivantes.
