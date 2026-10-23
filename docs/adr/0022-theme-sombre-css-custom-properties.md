# ADR 0022 — Mode sombre : tokens couleur en CSS custom properties, pilotés par `data-bs-theme`

- **Statut** : Accepté (à confirmer par le porteur) — **amende** l'[ADR 0012](0012-style-scss.md) et l'[ADR 0015](0015-bootstrap-librairie-composants-scss.md)
- **Date** : 2026-10-23
- **Décideurs** : agent architecte, par délégation du porteur (demande « mode sombre, en priorité », feature [0038](../../features/0038-mode-sombre.md))

## Contexte

Le porteur demande un **mode sombre**. Aujourd'hui, toutes les couleurs sont des **variables SCSS figées à la compilation** (`$couleur-*` dans `src/styles/_tokens.scss`, [ADR 0012](0012-style-scss.md)). Elles ne peuvent donc pas changer dans le navigateur. Bootstrap 5.3 ([ADR 0015](0015-bootstrap-librairie-composants-scss.md)) sait déjà basculer ses propres variables CSS avec l'attribut `data-bs-theme="dark"`. Ses fonctions de calcul (`tint-color`, `shade-color`, `to-rgb`…) exigent cependant de **vraies couleurs** à la compilation.

Contraintes :

- KISS, sans dépendance ajoutée ;
- une seule source de vérité pour les couleurs ;
- le thème clair actuel ne doit pas bouger d'un pixel ;
- l'impression reste en clair ([feature 0012](../../features/0012-diffusion-impression-pdf.md)) ;
- la préférence passe par `storageRepository` (règle d'or n° 8, [ADR 0005](0005-persistance-localstorage-derriere-repository.md)) ;
- pas de flash de couleur au chargement.

## Décision

1. **Deux palettes, un seul fichier.** `_tokens.scss` déclare deux maps SCSS de mêmes clés, `$palette-claire` et `$palette-sombre`, avec les valeurs hexadécimales. Si leurs clés diffèrent, la compilation échoue (`@error`).
2. **Les tokens couleur thémables deviennent des références à des CSS custom properties.** Exemple : `$couleur-fond: var(--idelia-fond)`. Les composants continuent d'écrire `t.$couleur-fond` : aucun changement de syntaxe pour eux. Restent en hexadécimal fixe les couleurs **identiques dans les deux thèmes** : texte sur aplat (`$couleur-texte-inverse`), texte sur pastille claire, aplat primaire, couleurs d'impression.
3. **Les propriétés sont émises par un partiel unique `_theme.scss`.** La palette claire va sur `:root, [data-bs-theme='light']`, la palette sombre sur `[data-bs-theme='dark']`. C'est **le même attribut que Bootstrap** : un seul interrupteur pour tout, et l'attribut peut être posé sur un sous-arbre (exemple : la feuille A4 de l'aperçu reste claire).
4. **Bootstrap reste compilé avec des valeurs hexadécimales**, lues dans les palettes (`t.clair('…')`, `t.sombre('…')`) : `$primary`, `$body-bg`, `$body-color`, `$border-color`… pour le clair, et leurs équivalents `$*-dark` (`$body-bg-dark`, `$border-color-dark`, `$link-color-dark`…) pour le sombre. Ses boutons « outline », figés à la compilation, sont redéclarés pour le sombre avec le mixin Bootstrap `button-outline-variant`, dans `color-mode(dark)`.
5. **Pas de fonction de couleur Sass sur un token thémable.** `rgba(t.$couleur-x, a)`, `mix()`, `lighten()`… sont interdits : sur un `var(--…)`, ils produisent du CSS invalide, ignoré sans erreur par le navigateur. On utilise la fonction `m.translucide($couleur, $opacite)` de `_mixins.scss`, qui produit `color-mix(in srgb, <couleur> <n>%, transparent)` (Chrome/Edge 111+, Firefox 113+, Safari 16.2+).
6. **L'attribut `data-bs-theme` est posé par JavaScript sur `<html>`**, toujours avec une valeur résolue (`light` ou `dark`). La préférence (« Automatique » par défaut, « Clair » ou « Sombre ») est lue via `storageRepository`. Le mode « Automatique » suit `matchMedia('(prefers-color-scheme: dark)')` et réagit à ses changements. L'attribut est posé dans `src/main.js`, **avant** le chargement asynchrone et le montage de Vue, comme la préférence du menu replié (0015). On n'ajoute **aucun script en ligne** dans `index.html` : il lirait `localStorage` en direct, ce qui violerait la règle n° 8.
7. **Filet anti-flash.** Tant qu'aucun attribut n'est posé, `@media (prefers-color-scheme: dark) { :root:not([data-bs-theme]) { … } }` applique la palette sombre. Le cas par défaut (« Automatique ») n'a donc aucun flash. Seul un choix explicite contraire au système peut laisser voir, un instant, le fond de page vide dans l'autre couleur.
8. **Impression toujours en clair.** Sur `beforeprint`, l'attribut passe à `light`, puis il est restauré sur `afterprint`. En plus, `@media print` redéclare la palette claire sur `:root, [data-bs-theme]`.

## Conséquences

- **Positives** : la bascule est instantanée, sans rechargement ni recompilation. La source de vérité reste unique (`_tokens.scss`). Les composants n'ont presque rien à changer : on remplace seulement `rgba()` par `translucide()`, plus quelques usages ambigus d'un token. Bootstrap gère nativement ses champs, alertes, modales, la flèche des listes, la croix de fermeture et `color-scheme`. Une zone peut être forcée en clair (aperçu papier).
- **Négatives / compromis** :
  - deux palettes à maintenir ensemble (le contrôle des clés à la compilation limite le risque) ;
  - les valeurs ne sont plus lisibles « en dur » dans le CSS compilé (on lit `var(--idelia-…)`) ;
  - les boutons pleins Bootstrap (`.btn-primary`…) gardent leur teinte claire dans le thème sombre : choix assumé, le texte blanc sur teal reste AA ;
  - `color-mix()` exige un navigateur de 2023 ou plus récent (sans conséquence pour Chrome/Edge, visés par le cabinet) ;
  - un nouvel onglet reprend le dernier choix enregistré ; un onglet déjà ouvert ne suit pas un changement fait ailleurs avant d'être rechargé.
- **Suivi** :
  - toute nouvelle couleur s'ajoute **dans les deux palettes** ;
  - toute nouvelle couleur Bootstrap figée à la compilation (nouveau variant `btn-outline-*`, `table`…) doit être vérifiée en sombre ;
  - les conventions sont décrites dans [instructions style-scss](../instructions/style-scss.md).

## Alternatives considérées

- **Recompiler deux feuilles CSS (clair / sombre) et basculer de `<link>`** : écartée. Elle double le CSS, bascule plus lentement (chargement), et Vite gère mal deux points d'entrée de style pour un seul bundle.
- **Attribut maison `data-theme` + media query pour le mode auto, indépendant de Bootstrap** : écartée. Il faudrait synchroniser deux attributs et dupliquer la logique « auto » en CSS et en JS. Poser le seul `data-bs-theme`, déjà résolu en JS, est plus simple.
- **Script en ligne dans `index.html` lisant `localStorage`** (anti-flash total) : écartée, car contraire à la règle d'or n° 8. Le filet `prefers-color-scheme` couvre le cas par défaut.
- **`filter: invert()` global** : écartée. Le rendu est faux (couleurs des personnes et des tournées inversées, images) et non maîtrisé.

## Liens

- [ADR 0012](0012-style-scss.md), [ADR 0015](0015-bootstrap-librairie-composants-scss.md), [ADR 0005](0005-persistance-localstorage-derriere-repository.md)
- [Feature 0038 — Mode sombre](../../features/0038-mode-sombre.md), [feature 0015](../../features/0015-layout-menu-lateral-repliable.md) (modèle de préférence d'UI), [feature 0012](../../features/0012-diffusion-impression-pdf.md) (impression)
