# ADR 0011 — Validation des formulaires avec Vuelidate et vue-debounce

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

L'application comporte de nombreux formulaires (personnes, tournées, absences, paramètres). Pour des utilisateurs non-informaticiens, la validation doit être **claire, immédiate et non frustrante**. Il faut aussi éviter les recalculs/écritures excessifs pendant la frappe.

## Décision

Nous validons les formulaires avec **Vuelidate** (règles déclaratives, messages d'erreur en français) et nous débounçons les saisies coûteuses avec **vue-debounce**. Les patterns précis (déclaration de règles, affichage des erreurs orienté ergonomie, moment de déclenchement) sont documentés dans [`docs/instructions/formulaires-validation.md`](../instructions/formulaires-validation.md).

## Conséquences

- **Positives** : validation cohérente et déclarative ; messages maîtrisés ; moins de bruit UI pendant la frappe ; synergie avec la persistance débouncée du store.
- **Négatives / compromis** : deux dépendances de plus ; convention à respecter pour rester homogène.
- **Suivi** : centraliser les messages FR récurrents ; veiller à ce que les erreurs indiquent **comment corriger**, pas seulement ce qui est faux.
