# Instructions — Workflow d'implémentation (orchestration)

Règle d'exécution des features en phase de développement. S'adresse à **l'agent orchestrateur** (celui qui pilote la session), pas au sous-agent lui-même.

## Règle : une tâche = un sous-agent

**Chaque tâche d'une feature est implémentée dans un nouveau sous-agent**, lancé via l'outil **Agent** en `subagent_type: dev-front`.

> Le **modèle et l'effort** (`sonnet` / `medium`) sont définis dans le frontmatter de [`dev-front`](../../.claude/agents/dev-front.md) et s'appliquent automatiquement — inutile (et impossible) de passer l'effort à l'appel de l'outil Agent.

## Ce qu'on passe à chaque sous-agent

Le prompt du sous-agent doit contenir **au minimum** :

1. **Le chemin du fichier de feature** (`features/NNNN-*.md`).
2. **Le numéro et le titre de la tâche** à réaliser.
3. **La liste des fichiers à créer ou modifier** pour cette tâche.
4. **Le contexte d'architecture pertinent, déjà chargé** : les extraits utiles des ADR / docs d'architecture / instructions (règles d'or applicables, conventions, structures de données concernées), afin que le sous-agent n'ait pas à tout relire.

## Découpage en tâches

- Une « tâche » est une **unité cohérente et vérifiable** de la feature — typiquement une étape (ou un petit groupe d'étapes fortement couplées) de la section « Étapes d'implémentation » du plan.
- Regrouper les étapes **indissociables** (ex. qui partagent le même état npm / doivent s'exécuter à la suite) dans une **même** tâche pour éviter des sous-agents fragmentés.
- **Vérifier** le résultat d'une tâche avant d'enchaîner la suivante (voir la section « Vérification » du plan de feature).

## Rappels

- Le sous-agent respecte `dev-front.md`, les [instructions](README.md), et les [ADR](../adr/).
- Après implémentation, la relecture ergonomie est faite par [`ui-ux`](../../.claude/agents/ui-ux.md), puis l'audit sécurité par [`security`](../../.claude/agents/security.md).
- Commits : jamais de co-auteur, identité locale du dépôt (voir [`../../CLAUDE.md`](../../CLAUDE.md)).
