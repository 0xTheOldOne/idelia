# ADR 0012 — Style en SCSS

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Il faut un système de style cohérent, maîtrisable et lisible, capable de porter une interface **très ergonomique** (contrôles larges, contrastes soignés, thème homogène) sans framework CSS lourd imposant ses conventions.

## Décision

Nous stylons l'application en **SCSS**. Nous centralisons les **tokens de design** (couleurs, espacements, typographie, rayons, ombres) dans des variables/maps SCSS, avec des **mixins** pour les patterns récurrents, et une organisation de fichiers de type « 7-1 allégée ». Les conventions détaillées sont dans [`docs/instructions/style-scss.md`](../instructions/style-scss.md).

## Conséquences

- **Positives** : contrôle total du rendu ; cohérence via tokens ; pas de dette de framework CSS externe ; adapté aux exigences d'ergonomie/contraste.
- **Négatives / compromis** : plus de CSS à écrire soi-même qu'avec un framework utilitaire ; discipline nécessaire pour éviter la duplication (d'où les tokens/mixins).
- **Suivi** : définir la palette et l'échelle typographique tôt (feature `001`) pour que tous les écrans s'y conforment.

## Alternatives considérées

- Frameworks CSS utilitaires ou composants (Tailwind, Bootstrap…) : écartés pour rester maître du rendu ergonomique et éviter une dépendance structurante.
