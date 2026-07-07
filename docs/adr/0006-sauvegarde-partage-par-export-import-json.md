# ADR 0006 — Sauvegarde et partage par export/import d'un fichier JSON

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Les données vivent dans un seul navigateur ([ADR 0005](0005-persistance-localstorage-derriere-repository.md)). Il faut pouvoir **sauvegarder** (filet de sécurité), **transférer** vers un autre poste, et **partager** l'information, sans backend.

## Décision

Idelia permet d'**exporter** l'intégralité des données dans un **fichier JSON** et de le **réimporter**. Ce document est la représentation canonique de l'état applicatif. Il porte un champ **`schemaVersion`** en tête pour permettre les migrations futures.

Règles d'import :
1. Refuser un `schemaVersion` **supérieur** à celui supporté par l'application (protection contre la corruption par un build ancien).
2. **Migrer** si la version est antérieure (pipeline de migration séquentiel).
3. **Valider structure + intégrité référentielle avant** de remplacer l'état.
4. L'import est un **remplacement total atomique** de l'état.

## Conséquences

- **Positives** : sauvegarde et portabilité simples et universelles ; format lisible et durable ; base d'un versionnement de schéma propre ; compatible avec le workflow référent (diffusion du fichier).
- **Négatives / compromis** : la sauvegarde repose sur une action manuelle de l'utilisateur → nécessite un rappel ergonomique fort (« dernière sauvegarde le… ») ; pas de fusion de deux fichiers (remplacement, pas merge).
- **Suivi** : documenter le schéma dans `docs/architecture/03-modele-de-donnees.md` ; maintenir les migrations à chaque évolution de forme.
