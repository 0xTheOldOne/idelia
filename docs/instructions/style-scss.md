# Instructions — Style SCSS

Références : [ADR 0012](../adr/0012-style-scss.md) (SCSS) et [ADR 0015](../adr/0015-bootstrap-librairie-composants-scss.md) (Bootstrap). Objectif : un rendu **cohérent et très lisible**, au service de l'ergonomie ([architecture 08](../architecture/08-principes-ux-ergonomie.md)).

## Organisation (7-1 allégée)

```
src/styles/
  _tokens.scss     # variables : couleurs, espacements, typographie, rayons, ombres, points de rupture
  _bootstrap.scss  # surcharge des variables Bootstrap (via nos tokens) + import ciblé de Bootstrap
  _mixins.scss     # mixins réutilisables (media queries, focus, carte, bouton…)
  _base.scss       # reset léger + styles d'éléments de base (body, titres, liens)
  main.scss        # point d'entrée : @use des partiels + styles globaux
```

`main.scss` est importé une fois dans `src/main.js`. Les composants stylent en `<style scoped lang="scss">` et importent les tokens/mixins nécessaires via `@use '@/styles/tokens' as *;`.

## Intégration de Bootstrap ([ADR 0015](../adr/0015-bootstrap-librairie-composants-scss.md))

Bootstrap 5 est la base de composants/utilitaires, **intégré par son source SCSS** et **thémé par nos tokens** (une seule source de vérité). Installation : `npm install bootstrap` (+ `@popperjs/core` pour les composants JS interactifs).

**Ordre d'import** (dans `_bootstrap.scss`) — surcharger les variables Bootstrap **avant** de l'importer :

```scss
@use 'tokens' as t;

// 1) fonctions Bootstrap (nécessaires aux maps)
@import 'bootstrap/scss/functions';

// 2) NOS surcharges de variables Bootstrap, à partir de nos tokens
$primary:        t.$couleur-primaire;
$font-family-base: t.$police-base;
$border-radius:  t.$rayon-md;
// … mapper ici les variables utiles ($spacer, $success, $danger, $warning…)

// 3) variables + maps + mixins Bootstrap
@import 'bootstrap/scss/variables';
@import 'bootstrap/scss/maps';
@import 'bootstrap/scss/mixins';
@import 'bootstrap/scss/root';

// 4) UNIQUEMENT les modules utilisés (éviter d'importer tout Bootstrap)
@import 'bootstrap/scss/reboot';
@import 'bootstrap/scss/grid';
@import 'bootstrap/scss/buttons';
@import 'bootstrap/scss/forms';
@import 'bootstrap/scss/modal';
// … ajouter au besoin ; puis 'bootstrap/scss/utilities/api' pour les classes utilitaires
```

**Règles d'usage** :

- **Thémer par les tokens**, jamais en surchargeant Bootstrap avec des valeurs en dur. `_tokens.scss` reste la source de vérité ; `_bootstrap.scss` fait le pont tokens → variables Bootstrap.
- **Utiliser les classes/composants Bootstrap** dans les templates pour ce qu'il couvre (grille, boutons, formulaires, alertes, modales, navigation, utilitaires d'espacement). **Ne pas réécrire** en SCSS maison ce que Bootstrap fournit déjà.
- Le **SCSS maison** (`components/`, `_base.scss`) sert au **spécifique** non couvert par Bootstrap.
- **Composants interactifs** (modale, dropdown, offcanvas, collapse, tooltip) : importer la **JS par composant** (`import Modal from 'bootstrap/js/dist/modal'`) **ou** gérer la bascule en **Vue simple** — préférer Vue pour les cas triviaux ([ADR 0015](../adr/0015-bootstrap-librairie-composants-scss.md)).
- **Icônes** : toujours Phosphor ([ADR 0013](../adr/0013-icones-phosphor.md)), **pas** Bootstrap Icons.
- **Poids** : n'importer que les modules SCSS réellement utilisés (voir liste ciblée ci-dessus).

## Tokens de design (à définir tôt, feature 001)

Centraliser **toutes** les valeurs de design dans `_tokens.scss` — aucune valeur « magique » dispersée :

- **Couleurs** : palette de marque, couleurs sémantiques (`$couleur-succes`, `$couleur-erreur`, `$couleur-avertissement`), neutres (fonds, textes, bordures). Contraste conforme (AA).
- **Espacements** : échelle cohérente (ex. `$espace-1: 4px … $espace-6: 32px`).
- **Typographie** : familles, tailles (échelle lisible — texte confortable pour un public non-technique), graisses, hauteurs de ligne.
- **Rayons, ombres, points de rupture**.

## Conventions

- **Classes en `kebab-case`**, orientées composant/rôle. Un style de composant reste `scoped`.
- **Éviter la duplication** : factoriser via mixins/tokens plutôt que copier des valeurs.
- **Cibles cliquables larges** (min. confortable, ~44px de hauteur) et bien espacées.
- **Focus visible** obligatoire (ne jamais supprimer l'outline sans alternative claire) — voir [accessibilité](accessibilite-ergonomie.md).
- **Jamais l'information par la seule couleur** : doubler d'une icône/libellé/motif.
- **Styles d'impression** : prévoir `@media print` pour les vues de diffusion ([ADR 0009](../adr/0009-workflow-referent-diffusion-lecture.md)) — lisibles en noir & blanc.

## Thème

Un seul thème clair suffit en v1. Si un mode sombre est envisagé plus tard, l'usage systématique des tokens (variables) rend la bascule simple. Ne pas coder de couleurs en dur dans les composants.
