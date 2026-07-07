# ADR 0008 — Le moteur de planification est un module pur

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Le mode hybride ([ADR 0007](0007-generation-planning-hybride.md)) implique une logique de contraintes non triviale (génération + validation temps réel). Cette logique est le point le plus risqué de l'application et doit rester compréhensible, maintenable et vérifiable indépendamment de l'UI.

## Décision

Le moteur de planification est un **module pur** situé dans `src/domain/scheduling/`, **sans aucune dépendance à Vue/Vuex** : des fonctions déterministes (entrées → sortie), isolables et testables. Il expose une API publique minimale (`genererPlanning`, `validerPlanning`, `validerIncrementale`, `creerContraintes`, `indexer`…).

Point d'architecture central : **un modèle de contraintes unique** (objets `Contrainte` évaluables) sert **à la fois** la génération et la validation → aucune duplication de règle métier. L'aléatoire passe par un **PRNG seedé** (résultats reproductibles).

## Conséquences

- **Positives** : logique métier découplée de l'UI ; cohérence générateur/validateur par construction ; déplaçable dans un Web Worker plus tard sans refonte ; prêt à être testé en isolation quand on ajoutera des tests.
- **Négatives / compromis** : discipline requise pour ne jamais importer Vue dans ce module ; les composants doivent passer par le store/domaine, pas contenir de logique métier.
- **Suivi** : conception détaillée dans `docs/architecture/05-moteur-de-planification.md`. Les tests unitaires de ce module sont différés (hors périmètre v1) mais l'architecture les rend triviaux à ajouter.
