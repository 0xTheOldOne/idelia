# ADR 0012 — Style en SCSS

- **Statut** : Accepté — **amendé par l'[ADR 0015](0015-bootstrap-librairie-composants-scss.md)**
- **Date** : 2026-07-07

> **Mise à jour** : la décision d'utiliser **SCSS** reste valable, mais le **rejet de Bootstrap** ci-dessous est **levé**. Bootstrap 5 est désormais utilisé comme librairie de composants, intégrée en SCSS et thémée via nos tokens — voir [ADR 0015](0015-bootstrap-librairie-composants-scss.md).

## Contexte

Il faut un système de style cohérent, maîtrisable et lisible, capable de porter une interface **très ergonomique** (contrôles larges, contrastes soignés, thème homogène) sans framework CSS lourd imposant ses conventions.

## Décision

Nous stylons l'application en **SCSS**. Nous centralisons les **tokens de design** (couleurs, espacements, typographie, rayons, ombres) dans des variables/maps SCSS, avec des **mixins** pour les patterns récurrents, et une organisation de fichiers de type « 7-1 allégée ». Les conventions détaillées sont dans [`docs/instructions/style-scss.md`](../instructions/style-scss.md).

## Conséquences

- **Positives** : contrôle total du rendu ; cohérence via tokens ; pas de dette de framework CSS externe ; adapté aux exigences d'ergonomie/contraste.
- **Négatives / compromis** : plus de CSS à écrire soi-même qu'avec un framework utilitaire ; discipline nécessaire pour éviter la duplication (d'où les tokens/mixins).
- **Suivi** : définir la palette et l'échelle typographique tôt (feature `0001`) pour que tous les écrans s'y conforment.

## Alternatives considérées

- Frameworks CSS utilitaires ou composants (Tailwind, Bootstrap…) : initialement écartés pour rester maître du rendu ergonomique et éviter une dépendance structurante. **Décision révisée pour Bootstrap** par l'[ADR 0015](0015-bootstrap-librairie-composants-scss.md) : Bootstrap étant distribué en SCSS et entièrement thémable, il outille le choix SCSS plutôt qu'il ne le contredit, et accélère la mise en place de composants accessibles.
