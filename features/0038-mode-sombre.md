# Feature 0038 — Mode sombre

- **Statut** : Fait
- **Dépend de** : `0014` (palette « Teal & Sable », tokens `_tokens.scss`, pont Bootstrap `_bootstrap.scss`), `0015` (modèle de préférence d'UI persistée hors `SaveDocument` : `ui/menuReplie`, `storageRepository.lirePreferenceMenuReplie`, initialisation dans `main.js` avant le montage), `0003` (écran Paramètres), `0012` (impression, aperçu A4 `FeuilleDiffusion.vue`).
- **ADR liés** : **[0022](../docs/adr/0022-theme-sombre-css-custom-properties.md) (rédigé pour cette feature)**, [0012](../docs/adr/0012-style-scss.md) et [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (tous deux amendés par 0022), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (préférence via `storageRepository`), [0013](../docs/adr/0013-icones-phosphor.md) (icônes).

## 1. Contexte & objectif

Le porteur demande un **mode sombre**, en priorité. Le soir ou dans une pièce peu éclairée, le fond sable et blanc éblouit. Résultat attendu :

- dans **Paramètres**, une section « Apparence » propose trois choix : **Automatique (comme l'ordinateur)**, **Clair**, **Sombre** ;
- le choix par défaut est **Automatique** ;
- le changement est **immédiat**, sans rechargement, et mémorisé **sur ce poste** ;
- les **impressions** restent toujours sur fond blanc ;
- le thème clair actuel **ne change pas d'un pixel**.

Approche KISS ([ADR 0022](../docs/adr/0022-theme-sombre-css-custom-properties.md)) : les tokens couleur deviennent des références à des CSS custom properties, avec deux palettes, pilotées par l'attribut Bootstrap `data-bs-theme` posé sur `<html>`. Les composants gardent leur syntaxe `t.$couleur-…`.

## 2. Écrans concernés

- **`/parametres`** (`ParametresView.vue`) : nouvelle section **« Apparence »**, juste après le formulaire (donc après « Affichage »), avant « Vacances scolaires ».
- **Tous les écrans** : ils passent en sombre quand le thème effectif est sombre (menu, Accueil, Équipe, Tournées, Absences, Souhaits, Planning, Feuille de route, modales, toasts, infobulles).
- **`/planning/:id/diffusion`** (`DiffusionView.vue`) : la zone autour de l'aperçu suit le thème. La **feuille A4 reste blanche**, car c'est un aperçu papier.
- **Impression** (planning diffusé, bilan de la Feuille de route) : **toujours en clair**, quel que soit le thème.

Parcours visé (utilisatrice peu à l'aise avec l'informatique) :

1. Elle ouvre **Paramètres** et voit « Apparence » avec trois grandes vignettes illustrées : soleil et lune, soleil, lune.
2. Elle clique sur « Sombre » : **tout l'écran** passe en sombre instantanément. Aucun bouton « Enregistrer », aucune fenêtre.
3. Elle peut revenir en arrière d'un clic sur « Clair » ou « Automatique ».
4. Le lendemain, Idelia s'ouvre directement dans le thème choisi, sans flash.

## 3. Modèle de données touché

**Aucun changement du `SaveDocument`**, donc pas de `schemaVersion` ni de migration. La préférence est une **préférence d'UI propre au poste**, sur le modèle de `0015` et `0019` :

- clé `localStorage` dédiée **`idelia:prefs-theme`** (règle « un réglage = une clé ») ;
- valeur `'AUTO'`, `'CLAIR'` ou `'SOMBRE'` ;
- jamais exportée ni importée ;
- effacée par « Effacer toutes les données » (`storageRepository.clear()` supprime déjà tout ce qui commence par `idelia:`).

## 4. Store (Vuex)

Module **`ui`** (`src/store/modules/ui.js`, **modifier**), sur le modèle exact de `menuReplie`. L'état est volatil en mémoire, reflété sur un canal `storageRepository` dédié.

- **State** (`etatInitial()`) :
  - `preferenceTheme: 'AUTO'` ;
  - `systemeSombre: false`, reflet volatil de `prefers-color-scheme: dark`.
- **Getters** :
  - `preferenceTheme` ;
  - `themeEffectif: (state) => resoudreTheme(state.preferenceTheme, state.systemeSombre)`, qui vaut `'CLAIR'` ou `'SOMBRE'` (domaine, §5).
- **Mutations** : `SET_PREFERENCE_THEME(state, preference)`, `SET_SYSTEME_SOMBRE(state, booleen)`.
- **`REINITIALISER`** (**modifier**) : conserver `systemeSombre`, qui reflète l'ordinateur et non une préférence. Exemple : `const { systemeSombre } = state; Object.assign(state, etatInitial(), { systemeSombre });`.
- **Actions** :
  - `initialiserTheme({ commit })`, appelée dans `main.js` avant le montage :
    - `commit('SET_SYSTEME_SOMBRE', systemePrefereSombre())` ;
    - `commit('SET_PREFERENCE_THEME', normaliserPreferenceTheme(storageRepository.lirePreferenceTheme()))` ;
    - branche **une seule fois** l'écoute du système (`ecouterThemeSysteme((sombre) => commit('SET_SYSTEME_SOMBRE', sombre))`), avec une garde en variable de module, comme `minuteur`.
  - `choisirTheme({ commit }, preference)` : normalise la valeur, la commite, puis `storageRepository.enregistrerPreferenceTheme(valeurNormalisee)`.
  - `reinitialiserPreferences` (existante) : rien à ajouter. Après `REINITIALISER`, la préférence revient à `'AUTO'` et le watcher de `main.js` réapplique l'attribut.
- Le plugin de persistance ignore déjà toute mutation `ui/*` : **rien à changer** dans `src/store/index.js`.

## 5. Domaine (logique pure) et adaptateur

### 5.1 `src/domain/theme.js` (**créer**, module pur, sur le modèle de `iconesTournee.js`)

```js
/** @typedef {'AUTO'|'CLAIR'|'SOMBRE'} PreferenceTheme */
/** @typedef {'CLAIR'|'SOMBRE'} ThemeEffectif */
export const PREFERENCES_THEME = Object.freeze(['AUTO', 'CLAIR', 'SOMBRE']);
export const PREFERENCE_THEME_DEFAUT = 'AUTO';
/** Options affichées par BlocApparence (libellé + aide), dans cet ordre. */
export const OPTIONS_THEME = Object.freeze([
  { code: 'AUTO', libelle: 'Automatique', aide: 'Comme votre ordinateur' },
  { code: 'CLAIR', libelle: 'Clair', aide: 'Fond clair, texte foncé' },
  { code: 'SOMBRE', libelle: 'Sombre', aide: 'Fond foncé, plus doux pour les yeux le soir' },
]);
/** Valeur inconnue, absente ou illisible → 'AUTO'. */
export function normaliserPreferenceTheme(valeur) {}
/** 'AUTO' → selon systemeSombre ; sinon la préférence elle-même. */
export function resoudreTheme(preference, systemeSombre) {}
```

### 5.2 `src/storage/storageRepository.js` (**modifier**)

- Constante `CLE_PREFS_THEME = 'idelia:prefs-theme'`, documentée comme `CLE_PREFS_UI` : elle est séparée du `SaveDocument` et des autres préférences.
- `lirePreferenceTheme()` : **synchrone** et tolérante, comme `lirePreferenceMenuReplie`. Elle renvoie la chaîne stockée, ou `null` si la clé est absente ou si `localStorage` lève une erreur. La normalisation reste dans le domaine (le repository n'importe pas le domaine).
- `enregistrerPreferenceTheme(valeur)` : **best-effort**, les erreurs sont ignorées.
- Les deux sont ajoutées à l'objet exporté `storageRepository`.

### 5.3 `src/adaptateurs/themeNavigateur.js` (**créer**, I/O navigateur, aucune persistance)

- `systemePrefereSombre()` : renvoie `window.matchMedia?.('(prefers-color-scheme: dark)').matches === true`, ou `false` si l'API est absente.
- `ecouterThemeSysteme(rappel)` : `addEventListener('change', (e) => rappel(e.matches))` sur la même requête. Ne fait rien si l'API est absente.
- `appliquerThemeDocument(theme)` : `document.documentElement.setAttribute('data-bs-theme', theme === 'SOMBRE' ? 'dark' : 'light')`. **Seul endroit** qui connaît les valeurs Bootstrap `light` et `dark`.
- `ecouterImpression({ avant, apres })` : `window.addEventListener('beforeprint', avant)` et `('afterprint', apres)`.

### 5.4 `src/main.js` (**modifier**)

Bloc placé **avant `createApp`**, donc avant le `bootstrap` asynchrone et avant `app.mount` :

```js
// Thème (feature 0038, ADR 0022) : appliqué avant tout rendu, pour éviter un flash.
store.dispatch('ui/initialiserTheme');
store.watch((_etat, getters) => getters['ui/themeEffectif'], appliquerThemeDocument, { immediate: true });
// Impression toujours en clair, puis retour au thème courant.
ecouterImpression({
  avant: () => appliquerThemeDocument('CLAIR'),
  apres: () => appliquerThemeDocument(store.getters['ui/themeEffectif']),
});
```

Pas de script en ligne dans `index.html` (règle d'or n° 8, ADR 0022 §6).

## 6. Styles et composants

### 6.1 Socle SCSS (`src/styles/`)

**`_tokens.scss` (modifier)** :

- Deux maps de **mêmes clés**, avec les valeurs hexadécimales du §6.2 : `$palette-claire` et `$palette-sombre`.
- Un garde-fou : `@if map.keys($palette-claire) != map.keys($palette-sombre) { @error '…'; }`.
- Deux fonctions `clair($nom)` et `sombre($nom)`, qui appellent `map.get` et lèvent `@error` si la clé est inconnue.
- Les tokens thémables deviennent `$couleur-page: var(--idelia-page);` et ainsi de suite.
- Les alias historiques restent des alias : `$couleur-primaire-claire: $couleur-marque`, `$couleur-avertissement-texte`, `$couleur-bordure-repere-vacances: $couleur-primaire`.
- `$couleur-focus` devient `var(--idelia-focus)`.
- `$degrade-menu` reste un `linear-gradient` sur les deux tokens de menu.
- Les tokens d'**impression** prennent des valeurs fixes : `$impression-fond-repere-dimanche: clair('fond-clair')`, `$impression-fond-repere-vacances` inchangé.
- Restent en **hexadécimal ou rgba fixe** (identiques dans les deux thèmes) :
  - `$couleur-texte-inverse` ;
  - `$couleur-accent`, `$couleur-accent-texte` ;
  - `$couleur-menu-texte`, `$couleur-menu-texte-actif`, `$couleur-menu-item-actif-fond`, `$couleur-menu-item-actif-accent` ;
  - `$ombre-legere`.
- Nouveaux tokens **fixes** :
  - `$couleur-aplat-primaire: #0e6e77` (fond plein portant du texte blanc, identique à Bootstrap `$primary`) ;
  - `$couleur-aplat-primaire-survol: #0b565e` ;
  - `$couleur-texte-sur-pastille: #2b2924` (texte foncé sur une couleur claire choisie par l'utilisateur).
- Nouveaux tokens **thémables** (§6.2) : `$couleur-infobulle-fond`, `$couleur-infobulle-texte`, `$couleur-contour-pastille`.

**`_theme.scss` (créer)**, importé dans `main.scss` juste après `bootstrap` :

```scss
@use 'tokens' as t;
@mixin declarer-palette($palette) {
  @each $nom, $valeur in $palette { --idelia-#{$nom}: #{$valeur}; }
}
:root, [data-bs-theme='light'] { color-scheme: light; @include declarer-palette(t.$palette-claire); }
[data-bs-theme='dark']         { color-scheme: dark;  @include declarer-palette(t.$palette-sombre); }
// Filet anti-flash : avant que main.js ait posé l'attribut (mode Automatique, ordinateur en sombre).
@media screen and (prefers-color-scheme: dark) {
  :root:not([data-bs-theme]) { color-scheme: dark; @include declarer-palette(t.$palette-sombre); }
}
// Impression : toujours la palette claire (doublé par la bascule beforeprint de main.js). En DERNIER.
@media print {
  :root, [data-bs-theme] { color-scheme: light; @include declarer-palette(t.$palette-claire); }
}
```

**`_bootstrap.scss` (modifier)** :

- Clair, avec des valeurs hexadécimales lues dans la palette :
  - `$primary: t.clair('primaire')`, `$success: t.clair('succes')`, `$danger`, `$warning`, `$info: t.clair('marque')` ;
  - `$body-color: t.clair('texte')`, `$body-bg: t.clair('page')`, `$body-secondary-bg` et `$body-tertiary-bg: t.clair('fond-clair')`, `$border-color: t.clair('bordure')`.
- `$input-bg` et `$modal-content-bg` restent `t.$couleur-fond`, désormais un `var()`. Bootstrap n'y applique aucune fonction de couleur (vérifié : défaut `var(--bs-body-bg)`). Ils suivent donc le thème.
- Sombre, défini **avant** `@import 'bootstrap/scss/variables'`, qui importe lui-même `variables-dark` avec `!default` :
  - `$body-color-dark: t.sombre('texte')`, `$body-bg-dark: t.sombre('page')` ;
  - `$body-secondary-bg-dark` et `$body-tertiary-bg-dark: t.sombre('fond-clair')` ;
  - `$border-color-dark: t.sombre('bordure')` ;
  - `$link-color-dark: t.sombre('primaire')`, `$link-hover-color-dark: t.sombre('primaire-foncee')` ;
  - `$form-valid-color-dark` et `$form-valid-border-color-dark: t.sombre('succes')` ;
  - `$form-invalid-color-dark` et `$form-invalid-border-color-dark: t.sombre('erreur')`.
- En fin de fichier, les **boutons « outline » en sombre**. Leurs couleurs sont figées à la compilation : sans cette redéclaration, le texte teal ou gris foncé serait illisible sur fond sombre. Ce sont tous les variants utilisés dans `src/` :

```scss
@include color-mode(dark) {
  .btn-outline-primary   { @include button-outline-variant(t.sombre('primaire')); }
  .btn-outline-secondary { @include button-outline-variant(t.sombre('texte-attenue')); }
  .btn-outline-danger    { @include button-outline-variant(t.sombre('erreur')); }
  .btn-outline-dark      { @include button-outline-variant(t.sombre('texte')); }
}
```

- On ne touche pas aux boutons pleins (`.btn-primary` : blanc sur `#0e6e77`, AA 6,0:1, assumé dans ADR 0022). Bootstrap gère nativement le reste via `data-bs-theme` : alertes (`*-bg-subtle-dark`…), champs, flèche des listes, `btn-close`, `form-check`, `form-switch`.

**`_mixins.scss` (modifier)** : nouvelle fonction de translucidité, qui fonctionne sur un `var()` :

```scss
@use 'sass:math';
/// Couleur translucide compatible CSS custom properties (ADR 0022) : remplace `rgba(t.$couleur-x, a)`.
@function translucide($couleur, $opacite) {
  @return color-mix(in srgb, #{$couleur} math.percentage($opacite), transparent);
}
```

**Migration `rgba(t.$…, a)` → `m.translucide(t.$…, a)`** (ajouter `@use '@/styles/mixins' as m;` si absent) :

- `FormulaireTournee.vue`
- `ListePlanningsRecents.vue`
- `PlanningView.vue`
- `CellulePlanning.vue`, y compris les rayures du `repeating-linear-gradient`
- `PanneauConflits.vue`
- `GrillePlanning.vue`
- `ReglagesAffichageGrille.vue`, y compris le `box-shadow`
- `RecapMensuel.vue`
- `MenuLateral.vue`
- `IndicateurSauvegarde.vue`

`$couleur-texte-inverse` reste fixe, mais on convertit tout quand même : la règle à vérifier est simplement « **zéro** `rgba(t.` dans `src/` ».

### 6.2 Palettes (valeurs proposées, ajustables par l'agent `ui-ux`)

Contrastes du thème sombre calculés selon WCAG 2.x. « surface » = `fond`. À recopier en commentaires dans `_tokens.scss`, comme aujourd'hui.

| Clé (`--idelia-…`) | Clair (inchangé) | Sombre | Rôle / contraste sombre |
| --- | --- | --- | --- |
| `page` | `#faf7f1` | `#171513` | fond de page (charbon chaud), texte 14,8:1 |
| `fond` | `#ffffff` | `#211f1c` | surface (cartes, champs, modales), texte 13,3:1 |
| `fond-clair` | `#f3ecdf` | `#2b2824` | surface atténuée, en-têtes de section, texte 11,9:1 |
| `bordure` | `#e7dece` | `#48433b` | bordures et séparateurs (≈ 1,7:1 sur la surface, comparable au clair) |
| `texte` | `#2b2924` | `#ece7de` | texte principal |
| `texte-attenue` | `#6e6656` | `#b3aa9a` | texte secondaire : 7,9:1 (page), 7,2:1 (surface), 6,4:1 (fond-clair) |
| `marque` | `#17868f` | `#3aa6ae` | décoratif, grands éléments |
| `primaire` | `#0e6e77` | `#4fb8c0` | liens, texte et bordures interactifs : 7,0:1 (surface), 6,2:1 (fond-clair) |
| `primaire-foncee` | `#0b565e` | `#7fd0d6` | survol, pressé, emphase (plus **clair** en sombre = plus marqué) : 9,3:1 |
| `focus` | `#0b565e` | `#7fd0d6` | contour de focus clavier, très visible sur fond sombre |
| `accent-foncee` | `#8a5a12` | `#e6b06a` | texte ambre : 8,4:1 (surface) |
| `succes` | `#15803d` | `#4ade80` | 9,4:1 (surface) |
| `erreur` | `#c0392b` | `#f87171` | 5,9:1 (surface), 5,3:1 (fond-clair) |
| `avertissement` | `#b45309` | `#fb923c` | 7,3:1 (surface) |
| `fond-repere-majore` | `#faf1e5` | `#3b3022` | dimanche ou férié (accent à 14 % sur la surface), texte 10,5:1 |
| `menu-fond-haut` | `#147c84` | `#0f5f66` | dégradé du menu, un peu assombri (texte blanc ≥ 7:1) |
| `menu-fond-bas` | `#0b525a` | `#083a40` | idem |
| `infobulle-fond` | `#2b2924` | `#ece7de` | infobulle inversée (les deux thèmes) |
| `infobulle-texte` | `#ffffff` | `#1b1916` | ≈ 14:1 dans les deux thèmes |
| `contour-pastille` | `transparent` | `rgba(255, 255, 255, 0.4)` | liseré des pastilles de couleur utilisateur (sans effet en clair) |

Fixes (hors palettes) : `texte-inverse #ffffff`, `accent #dd9a44`, `accent-texte #3a2b0c`, `aplat-primaire #0e6e77`, `aplat-primaire-survol #0b565e`, `texte-sur-pastille #2b2924`, les couleurs du texte du menu (rgba blanc), et les tokens `impression-*`.

### 6.3 Usages ambigus d'un token, à corriger (tâche 4)

Le **rendu clair reste identique**, car les nouveaux tokens valent, en clair, les anciennes valeurs.

- `src/components/accueil/TuileAction.vue` : fond plein `$couleur-primaire` avec du texte blanc. Passer à `$couleur-aplat-primaire` et, au survol, `$couleur-aplat-primaire-survol`. Sinon : blanc sur `#4fb8c0` en sombre, soit 2,2:1.
- `src/components/communs/PastilleTournee.vue` : sur une couleur **claire** choisie, le texte vaut `$couleur-texte`, qui devient clair en sombre. Ajouter le modificateur `pastille-tournee--claire` (couleur définie et non foncée), avec `color: t.$couleur-texte-sur-pastille`. Ajouter aussi `box-shadow: 0 0 0 1px t.$couleur-contour-pastille`.
- `src/components/communs/InfoBulle.vue`, `src/components/communs/MenuLateral.vue` (`.menu-item__infobulle`), `src/App.vue` (même infobulle en mode étroit) : `background-color: t.$couleur-texte` + `color: t.$couleur-texte-inverse` deviennent `t.$couleur-infobulle-fond` / `t.$couleur-infobulle-texte`.
- `src/components/diffusion/FeuilleDiffusion.vue` : ajouter `data-bs-theme="light"` sur `<article class="feuille-diffusion">`. La feuille déclare déjà `background-color` et `color` à partir des tokens, qui se résolvent alors en clair : l'aperçu papier reste blanc.
- **Pastilles de couleur utilisateur sans bordure** (points de couleur sans texte), où une couleur très foncée se perdrait sur fond sombre : ajouter `box-shadow: 0 0 0 1px t.$couleur-contour-pastille`. À vérifier au minimum :
  - `CellulePlanning.vue` (`.cellule-planning-pastille`) ;
  - `GrillePlanning.vue` (l. 43) ;
  - `SelecteurPersonne.vue` (l. 28) ;
  - les nuanciers de `FormulairePersonne.vue` et `FormulaireTournee.vue` ;
  - `RecapMensuel.vue`, `EquipeView.vue`, `AbsencesView.vue`, `FormulaireAbsence.vue`.

  On ne touche pas aux pastilles qui ont déjà une bordure (mixin `pastille-initiales`).
- On garde les `#fff` de `FormulaireTournee.vue:859` et `FormulairePersonne.vue:972` (coche sur la pastille choisie, déjà doublée d'une ombre), ainsi que `couleurTexteRepere` de `src/domain/personnes.js` (texte sur couleur utilisateur, indépendant du thème).

### 6.4 `src/components/parametres/BlocApparence.vue` (**créer**)

Composant conteneur, sur le modèle de `BlocSauvegardeAutomatique.vue`, sans aucune logique métier :

- Données :
  - `mapGetters('ui', ['preferenceTheme', 'themeEffectif'])` ;
  - `mapActions('ui', ['choisirTheme'])` ;
  - `OPTIONS_THEME` (domaine).
- Gabarit :
  - un paragraphe d'introduction en `$couleur-texte-attenue` : « Choisissez les couleurs d'Idelia sur cet ordinateur. » ;
  - un `<fieldset>` avec `<legend class="visually-hidden">Couleurs de l'application</legend>` ;
  - trois **vignettes radio**, en réutilisant le motif `btn-check` + `<label>` + coche `PhCheck` de `FormulaireTournee.vue` (`.formulaire-icone-option`, l. 241-262 et 865-899) ;
  - icônes Phosphor 28 px : `PhCircleHalf` (Automatique), `PhSun` (Clair), `PhMoon` (Sombre).
- Chaque vignette montre :
  - le **libellé** en gras ;
  - l'**aide** en petit ;
  - pour « Automatique », l'aide complétée **en direct** : « Comme votre ordinateur — actuellement : sombre » (ou « clair »), à partir de `themeEffectif` ;
  - vignettes ≥ 44 px de haut, en ligne, qui passent à la ligne sur mobile ;
  - état coché : bordure `$couleur-primaire`, fond `m.translucide(t.$couleur-primaire, 0.12)` et coche. L'état n'est **jamais signalé par la seule couleur**.
- `@change` : `choisirTheme(code)`. **Pas de toast** : le résultat est visible tout de suite, un message serait du bruit.
- Sous les vignettes, une note en petit : « Ce réglage ne concerne que cet ordinateur ; il n'est pas inclus dans les sauvegardes. Les plannings imprimés restent toujours sur fond blanc. »

`ParametresView.vue` (**modifier**) : nouvelle `<section class="parametres-section"><h2>Apparence</h2><BlocApparence /></section>`, placée juste après `</form>`.

**Pas de bouton de thème dans le menu latéral** (décision §12 n° 2).

## 7. Règles de validation

Aucune saisie libre : c'est une liste fermée de trois valeurs. Pas de Vuelidate. Toute valeur lue (stockage) ou reçue (action) passe par `normaliserPreferenceTheme`, qui renvoie `'AUTO'` par défaut.

## 8. Points d'attention ergonomie

- **Des mots, pas seulement des icônes** : « Automatique / Clair / Sombre », avec une aide d'une ligne. Pour « Automatique », dire ce qui s'applique **maintenant** (« actuellement : sombre »), sinon le choix reste abstrait.
- **Immédiat et réversible** : aucune validation, aucun rechargement. Un clic sur l'autre vignette annule.
- **Contrastes AA** dans les deux thèmes (§6.2) ; **focus clavier** visible sur fond sombre (`focus` = `#7fd0d6`).
- **Jamais la couleur seule** : les repères existants (icônes de conflit, cadenas, pouce baissé, barre d'accent du menu actif) doivent rester visibles en sombre.
- **Couleurs des personnes et des tournées** : on ne les modifie jamais, ce sont des données. Le liseré `contour-pastille` garantit qu'une pastille foncée reste visible sur fond sombre.
- **Teintes translucides** (conflits à 8-10 %, sélection à 12 %) : vérifier qu'elles restent perceptibles sur fond sombre. Sinon, l'agent `ui-ux` relève l'opacité (§12 n° 4).
- **Pas d'animation** de transition des couleurs (bascule instantanée, cohérente avec `prefers-reduced-motion`).
- **Papier** : l'aperçu A4 et l'impression restent blancs. L'utilisatrice imprime ce qu'elle a toujours imprimé.

## 9. Étapes d'implémentation

Quatre tâches, chacune confiée à **un sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)).

- Ordre : **T1 → T2 → T3 → T4**.
- Contexte à transmettre à chaque sous-agent : ADR 0022, règles d'or n° 2, 3, 4, 8 et 10, ce plan.
- **Un seul commit pour la feature** : T1 seule ferait déjà passer en sombre (via le filet `prefers-color-scheme`) un poste réglé en sombre, sans permettre de choisir.

### Tâche 1 — Socle SCSS thémable (palettes, `_theme.scss`, pont Bootstrap, `translucide`)

**Fichiers** :

- `src/styles/_tokens.scss` (**modifier**) : §6.1 et §6.2. Palettes, garde-fou, fonctions `clair` et `sombre`, tokens en `var()`, nouveaux tokens fixes et thémables, impression en fixe.
- `src/styles/_theme.scss` (**créer**) : §6.1.
- `src/styles/main.scss` (**modifier**) : ordre `tokens → bootstrap → theme → mixins → base → impression`, et le commentaire d'en-tête.
- `src/styles/_bootstrap.scss` (**modifier**) : §6.1. Valeurs claires depuis la palette, surcharges `$*-dark`, boutons outline en `color-mode(dark)`.
- `src/styles/_mixins.scss` (**modifier**) : fonction `translucide`.
- Migration `rgba(t.` → `m.translucide(` : `src/components/tournees/FormulaireTournee.vue`, `src/components/accueil/ListePlanningsRecents.vue`, `src/views/PlanningView.vue`, `src/components/planning/CellulePlanning.vue`, `src/components/planning/PanneauConflits.vue`, `src/components/planning/GrillePlanning.vue`, `src/components/planning/ReglagesAffichageGrille.vue`, `src/components/planning/RecapMensuel.vue`, `src/components/communs/MenuLateral.vue`, `src/components/communs/IndicateurSauvegarde.vue`.
- `docs/instructions/style-scss.md` (**modifier**) :
  - réécrire la section « Thème » : deux palettes ; ajouter toute couleur dans les deux ; `t.clair()` / `t.sombre()` réservés au pont Bootstrap ; `data-bs-theme` ; sous-arbre forçable en clair ;
  - nouvelle règle : **aucune fonction de couleur Sass** (`rgba`, `mix`, `lighten`, `darken`, `color.*`) sur un token thémable, utiliser `m.translucide` ;
  - ajouter `_theme.scss` à l'arborescence et à l'ordre d'import.

**Critères de sortie** :

- `npm run build` réussit, sans dépendance ajoutée.
- Une recherche `rgba\(t\.` dans `src/` ne renvoie **rien**. Une recherche `(mix|lighten|darken|tint-color|shade-color)\(t\.` ne renvoie rien non plus.
- **Thème clair inchangé** : captures avant/après identiques à l'œil sur Accueil, Équipe, Planning (grille avec conflits et sélection), Diffusion, Paramètres, modale d'une personne, un toast.
- En console : `document.documentElement.dataset.bsTheme = 'dark'` fait passer toute l'application en sombre (fond, surfaces, textes, champs, alertes, modales, boutons outline lisibles). `= 'light'` revient exactement au clair.
- Renommer une clé dans une seule palette fait échouer la compilation avec un message explicite. Annuler l'essai ensuite.

### Tâche 2 — Préférence et application du thème (domaine, stockage, store, adaptateur, `main.js`)

**Fichiers** :

- `src/domain/theme.js` (**créer**) : §5.1, JSDoc complète.
- `src/storage/storageRepository.js` (**modifier**) : §5.2.
- `src/adaptateurs/themeNavigateur.js` (**créer**) : §5.3.
- `src/store/modules/ui.js` (**modifier**) : §4. Compléter aussi la JSDoc d'en-tête du module (paragraphe `preferenceTheme` / `systemeSombre`, sur le modèle de `menuReplie`).
- `src/main.js` (**modifier**) : §5.4.
- `docs/architecture/06-structure-du-code.md` (**modifier**) :
  - `theme.js   # préférence de thème : options, normalisation, résolution Automatique [0038]` sous `domain/` ;
  - `themeNavigateur.js # prefers-color-scheme, attribut data-bs-theme, bascule à l'impression [0038, ADR 0022]` sous `adaptateurs/` ;
  - `_theme.scss # CSS custom properties des deux palettes [ADR 0022]` sous `styles/`.

**Critères de sortie** :

- `npm run build` réussit.
- Une recherche de `localStorage` dans `src/` ne trouve que `storageRepository.js`. Une recherche de `data-bs-theme` dans `src/**/*.js` ne trouve que `themeNavigateur.js`.
- En console (`npm run dev`) :
  - `store.dispatch('ui/choisirTheme', 'SOMBRE')` : l'app passe en sombre, `localStorage['idelia:prefs-theme'] === 'SOMBRE'`. Après `F5`, elle reste en sombre **sans flash clair visible**.
  - `'CLAIR'` puis `'AUTO'` : en Automatique, basculer le thème de Windows (Paramètres, Personnalisation, Couleurs) ou émuler `prefers-color-scheme` dans DevTools (Rendering) : l'app suit **sans rechargement**.
  - `store.dispatch('ui/choisirTheme', 'n importe quoi')` : la valeur est normalisée en `'AUTO'`.
  - `localStorage['idelia:prefs-theme'] = 'xyz'`, puis `F5` : Automatique, sans erreur.
- En sombre, l'aperçu avant impression (`Ctrl+P`) d'un planning diffusé est **entièrement clair**. En fermant l'aperçu, l'app redevient sombre.

### Tâche 3 — Section « Apparence » dans Paramètres

**Fichiers** :

- `src/components/parametres/BlocApparence.vue` (**créer**) : §6.4.
- `src/views/ParametresView.vue` (**modifier**) : section « Apparence » après `</form>`, import et enregistrement du composant.
- `docs/architecture/06-structure-du-code.md` (**modifier**) : ajouter `BlocApparence.vue [0038]` à la ligne `components/parametres/`.

**Critères de sortie** :

- La section « Apparence » affiche trois vignettes, avec la bonne cochée selon la préférence courante.
- Un clic applique le thème immédiatement. Le texte « actuellement : … » d'Automatique suit l'ordinateur en direct.
- Clavier : `Tab` atteint le groupe, les flèches changent de choix (radios natifs), et le focus est visible dans les deux thèmes.
- Lecteur d'écran : le groupe est annoncé « Couleurs de l'application » et chaque option par son libellé.
- `npm run build` réussit.

### Tâche 4 — Finitions du thème sombre et revue écran par écran

**Fichiers** :

- `src/components/accueil/TuileAction.vue`, `src/components/communs/PastilleTournee.vue`, `src/components/communs/InfoBulle.vue`, `src/components/communs/MenuLateral.vue`, `src/App.vue`, `src/components/diffusion/FeuilleDiffusion.vue` (**modifier**) : §6.3.
- Pastilles sans bordure (**modifier si nécessaire**, après vérification visuelle) : la liste du §6.3.
- Toute autre correction révélée par la revue (couleur qui ne passe pas par un token, contraste insuffisant). **Ajouter un token** dans les deux palettes plutôt qu'une règle `[data-bs-theme='dark']` locale à un composant.

**Critères de sortie** :

- Le parcours §11 est entièrement vert dans les deux thèmes.
- Aucune régression du thème clair (mêmes captures qu'en T1).
- L'agent `ui-ux` relit les écrans en sombre ; ses ajustements de palette se font dans `_tokens.scss` uniquement.

## 10. Critères d'acceptation

- [ ] Paramètres comporte une section « Apparence » avec **Automatique / Clair / Sombre**. Automatique est le choix par défaut sur un poste neuf.
- [ ] Le choix s'applique **instantanément** à toute l'application, sans rechargement ni bouton « Enregistrer ».
- [ ] Le choix est **mémorisé sur le poste** : après un rechargement ou une réouverture du navigateur, Idelia s'ouvre dans le thème choisi, **sans flash** visible en mode Automatique.
- [ ] En **Automatique**, Idelia suit le réglage clair ou sombre de l'ordinateur, y compris quand il change pendant l'utilisation, et l'aide indique le thème actuellement appliqué.
- [ ] Le thème **n'est pas dans le fichier de sauvegarde** : un export ne contient pas `prefs-theme`, et un import ne change pas le thème.
- [ ] « Effacer toutes les données » ramène le thème à **Automatique**.
- [ ] En sombre, **tous les écrans** sont lisibles : menu, Accueil (tuiles, cartes), Équipe, Souhaits, Tournées, Absences, Planning (grille, cellules en conflit, sélection, verrou, pouce baissé, récap mensuel, repères dimanche, férié et vacances), Feuille de route (dépôt, cas, bilan, règles), Paramètres, modales, toasts, infobulles, bandeau de reprise de sauvegarde.
- [ ] En sombre, les boutons **outline** (Modifier, Archiver, Annuler, Exporter…), les champs, les listes déroulantes, les interrupteurs, les cases et la croix de fermeture sont lisibles et ont un focus visible.
- [ ] Les **pastilles de couleur** des personnes et des tournées gardent leur couleur et restent repérables sur fond sombre, et le texte d'une pastille claire reste foncé.
- [ ] L'**aperçu A4** de la diffusion reste blanc en sombre. L'**impression** (planning diffusé, bilan de la Feuille de route) est **entièrement claire** quel que soit le thème, et l'app retrouve son thème après l'impression.
- [ ] Le **thème clair** est identique à avant la feature.
- [ ] Aucun `localStorage` hors `storageRepository`, aucun `rgba(t.` dans `src/`, aucune dépendance ajoutée.

## 11. Vérification

Recette navigateur : Playwright MCP, `npm run dev` sur le port 5199, données `idelia-sermet.json` importées. Pour le mode Automatique : `page.emulateMedia({ colorScheme: 'dark' | 'light' })`.

1. **Poste neuf** : `localStorage.clear()`, `F5`, avec l'ordinateur en clair. Thème clair, « Automatique » coché, aide « actuellement : clair ». Émuler `colorScheme: 'dark'` : l'app passe en sombre et l'aide indique « actuellement : sombre ».
2. **Choix explicite** : cliquer sur « Sombre », puis émuler `colorScheme: 'light'`. L'app **reste** sombre. `F5` : sombre dès l'affichage. Cliquer sur « Clair » : clair, même avec l'ordinateur en sombre.
3. **Tour des écrans en sombre** : parcourir la liste du §10 (7ᵉ critère). Sur le Planning, ouvrir une cellule en conflit, sélectionner une case, faire un glisser-déposer, ouvrir le panneau des conflits et le récap mensuel. Ouvrir une modale (personne, tournée, absence), déclencher un toast, survoler une infobulle (menu replié inclus). Réduire la fenêtre sous 992 px pour l'infobulle du menu en mode étroit (`App.vue`).
4. **Contrastes** : vérifier dans DevTools (sélecteur de couleur, ratio) le texte atténué sur `fond-clair`, l'erreur sur `fond-clair`, les liens et les boutons outline secondary sur la surface. Tous doivent être ≥ 4,5:1.
5. **Clavier** : en sombre, `Tab` à travers le menu, Paramètres et une modale. Le contour de focus est visible partout.
6. **Impression** : en sombre, ouvrir une diffusion. La feuille A4 est blanche à l'écran. `Ctrl+P` (vrai Chrome, car l'émulation print de Playwright ne déclenche pas `beforeprint`) : l'aperçu est entièrement clair, et l'app redevient sombre en fermant. Même chose pour le bilan de la Feuille de route.
7. **Sauvegarde** : exporter une sauvegarde, et vérifier que le JSON ne contient pas `prefs-theme`. En sombre, importer une sauvegarde : le thème ne change pas. « Effacer toutes les données » : retour à Automatique, et la clé `idelia:prefs-theme` est absente.
8. **Robustesse** : `localStorage['idelia:prefs-theme'] = '<b>x'`, puis `F5` : Automatique, aucune erreur, attribut `data-bs-theme` = `light` ou `dark` uniquement.
9. **Non-régression du clair** : captures T1 identiques. `npm run build` réussit.

## 12. Décisions à confirmer / risques

1. **Un seul attribut, `data-bs-theme`, résolu en JavaScript (retenu)**, plutôt qu'un attribut maison `data-theme` couplé à une media query. Il pilote à la fois Bootstrap et nos tokens, et peut forcer un sous-arbre en clair (aperçu A4). Le mode Automatique est résolu en JS (`matchMedia` et son écoute). Le CSS n'a qu'un filet anti-flash pour l'instant avant l'exécution du JS.
2. **Réglage uniquement dans Paramètres (retenu)**, pas de bouton soleil/lune dans le menu latéral. Un bouton à trois états qui défilent est peu compréhensible pour le public cible, et un seul endroit suffit pour un réglage qu'on fait une fois. Si le porteur veut un raccourci, ce sera un ajout léger (même action `choisirTheme`).
3. **Boutons pleins Bootstrap inchangés en sombre (retenu)** : `.btn-primary` reste teal `#0e6e77` avec du texte blanc (AA 6,0:1, bouton à ≈ 3:1 contre la page sombre). Seuls les boutons outline sont redéclarés.
4. **Teintes translucides** : `translucide()` garde la même opacité dans les deux thèmes. Sur fond sombre, les fonds de conflit (8-10 %) peuvent être trop discrets. Ce n'est pas bloquant, car ces repères sont toujours doublés d'icônes. Si besoin, `ui-ux` remplace ces usages par des tokens de palette dédiés, par exemple `fond-conflit-erreur`.
5. **Flash résiduel accepté** : avec un choix explicite contraire au réglage de l'ordinateur (« Sombre » sur un PC en clair), le fond de page vide peut apparaître un instant dans l'autre couleur avant l'exécution de `main.js`. On ne peut l'éviter qu'avec un script en ligne lisant `localStorage`, interdit par la règle d'or n° 8.
6. **Plusieurs onglets** : un changement de thème dans un onglet ne s'applique aux autres qu'à leur rechargement, comme pour le menu replié (0015). On n'écoute pas l'événement `storage` (KISS).
7. **Aperçu A4 forcé en clair (retenu)** : c'est une simulation du papier. Le bilan de la Feuille de route, lui, est un onglet de l'application : il suit le thème à l'écran et s'imprime en clair.
8. **`color-mix()`** exige Chrome/Edge 111+, Firefox 113+ ou Safari 16.2+. Un navigateur plus ancien perdrait seulement les fonds translucides, sans rien casser d'autre. C'est acceptable pour le poste du cabinet (Chrome/Edge).
9. **Palette sombre « charbon chaud »** (§6.2) : elle prolonge l'identité « Teal & Sable ». Les valeurs sont indicatives et ajustables par `ui-ux`, dans `_tokens.scss` uniquement.
10. **Statut de l'ADR 0022** : rédigé « Accepté » par délégation du porteur. Les ADR 0012 et 0015 sont marqués « amendés par 0022 ». À confirmer par le porteur.
11. **Sécurité (pour l'agent `security`)** : aucune donnée personnelle ni réseau. La valeur lue dans `localStorage` est normalisée sur une liste fermée avant usage. L'attribut posé ne prend que `light` ou `dark`, sans injection possible.
