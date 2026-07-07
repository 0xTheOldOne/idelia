# ADR 0002 — Application frontend, sans backend

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Idelia s'adresse à de petites structures (cabinets infirmiers). On veut un déploiement simple, sans coût ni maintenance de serveur, hébergeable sur GitHub/GitLab Pages. Le mot d'ordre est **KISS**. Le volume de données est modeste (quelques dizaines de personnes, tournées, plannings mensuels).

## Décision

Idelia est une **application 100 % frontend** (SPA Vue.js), **sans aucun backend ni webapi**. Toute la logique (y compris la génération de planning) s'exécute dans le navigateur. Les données sont stockées côté client (voir [ADR 0005](0005-persistance-localstorage-derriere-repository.md)) et échangées par fichier (voir [ADR 0006](0006-sauvegarde-partage-par-export-import-json.md)).

## Conséquences

- **Positives** : hébergement statique gratuit et trivial ; aucune infra à opérer ; pas de surface d'attaque serveur ; fonctionne hors-ligne.
- **Négatives / compromis** : **pas de synchronisation multi-utilisateur en temps réel** ; les données sont liées à un navigateur/poste ; la sauvegarde repose sur l'utilisateur. Ces limites sont assumées et adressées par le **workflow référent** (voir [ADR 0009](0009-workflow-referent-diffusion-lecture.md)).
- **Suivi** : si un besoin de partage temps réel émerge, ce sera une évolution majeure (introduction d'un backend/service de sync) à acter par un nouvel ADR.
