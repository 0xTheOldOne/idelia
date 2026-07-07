# ADR 0013 — Icônes depuis @phosphor-icons/vue

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Une interface ergonomique pour non-informaticiens s'appuie beaucoup sur des **icônes claires et cohérentes** pour guider l'utilisateur. Il faut une source unique, complète et bien intégrée à Vue.

## Décision

Toutes les icônes proviennent de **`@phosphor-icons/vue`**. On n'utilise pas d'autres jeux d'icônes ni d'images ad hoc pour les actions courantes, afin de garder une identité visuelle homogène.

## Conséquences

- **Positives** : cohérence visuelle ; large catalogue ; intégration Vue native (import de composants d'icônes) ; poids maîtrisé (import ciblé).
- **Négatives / compromis** : dépendance unique pour les icônes ; convention à faire respecter.
- **Suivi** : établir une petite table « action → icône » de référence pour l'homogénéité (dans les instructions composants ou SCSS) ; toujours associer un libellé texte à une icône d'action (accessibilité).
