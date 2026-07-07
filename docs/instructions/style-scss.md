# Instructions — Style SCSS

Référence : [ADR 0012](../adr/0012-style-scss.md). Objectif : un rendu **cohérent et très lisible**, au service de l'ergonomie ([architecture 08](../architecture/08-principes-ux-ergonomie.md)).

## Organisation (7-1 allégée)

```
src/styles/
  _tokens.scss     # variables : couleurs, espacements, typographie, rayons, ombres, points de rupture
  _mixins.scss     # mixins réutilisables (media queries, focus, carte, bouton…)
  _base.scss       # reset léger + styles d'éléments de base (body, titres, liens)
  main.scss        # point d'entrée : @use des partiels + styles globaux
```

`main.scss` est importé une fois dans `src/main.js`. Les composants stylent en `<style scoped lang="scss">` et importent les tokens/mixins nécessaires via `@use '@/styles/tokens' as *;`.

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
