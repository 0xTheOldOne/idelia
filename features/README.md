# Features — Plans de développement

Ce dossier contient les **plans de features** d'Idelia. Chaque plan trace **ce qu'on construit et comment**, de façon suffisamment détaillée pour reprendre le développement dans une session ultérieure.

## Convention de nommage

`NNN-NomDeLaFeature.md` :
- `NNN` = numéro à 3 chiffres, séquentiel, cohérent avec la [ROADMAP](ROADMAP.md).
- `NomDeLaFeature` = nom explicite (`kebab-case` recommandé, ex. `004-gestion-equipe.md`).

## Cycle de vie d'une feature

1. **Rédaction** — l'agent [`architecte`](../.claude/agents/architecte.md) écrit le plan `NNN-*.md` à partir du [gabarit](000-modele-feature.md), en s'appuyant sur les [ADR](../docs/adr/), l'[architecture](../docs/architecture/) et les [instructions](../docs/instructions/).
2. **Implémentation** — l'agent [`developpeur-vue`](../.claude/agents/developpeur-vue.md) réalise le plan, **une tâche par sous-agent** (`model: sonnet`, effort `medium`) selon [`docs/instructions/workflow-implementation.md`](../docs/instructions/workflow-implementation.md).
3. **Relecture ergonomie** — l'agent [`relecteur-ergonomie`](../.claude/agents/relecteur-ergonomie.md) vérifie les écrans.
4. **Trace** — le plan reste dans ce dossier comme mémoire du projet.

## Fichiers

- [`000-modele-feature.md`](000-modele-feature.md) — le gabarit à copier pour chaque nouvelle feature.
- [`ROADMAP.md`](ROADMAP.md) — le backlog priorisé (v1), ordonné par dépendances.

> Les plans `001-*` à `013-*` **ne sont pas encore écrits** : ils seront rédigés par l'agent `architecte` (phase 2), un par un, avant le développement.
