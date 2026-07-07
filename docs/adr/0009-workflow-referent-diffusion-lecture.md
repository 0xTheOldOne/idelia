# ADR 0009 — Workflow « référent » : une source de vérité, diffusion en lecture

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Sans backend ([ADR 0002](0002-application-frontend-sans-backend.md)) et avec des données locales au navigateur ([ADR 0005](0005-persistance-localstorage-derriere-repository.md)), il n'y a **pas de vue partagée en temps réel**. Il faut néanmoins que l'équipe accède au planning.

## Décision

Nous adoptons un **workflow référent** : une personne (le référent) tient le planning sur son poste — c'est la **source de vérité unique** — puis le **diffuse à l'équipe en lecture** via impression, export PDF, ou partage du fichier JSON/export. Idelia est conçue autour de ce rôle : édition centralisée, diffusion à sens unique.

## Conséquences

- **Positives** : modèle simple, sans conflit de synchronisation ; cohérent avec l'absence de backend ; l'équipe reçoit un support clair (papier/PDF).
- **Négatives / compromis** : dépendance à une personne ; pas d'édition concurrente ; le transfert entre postes est manuel (fichier). Assumé pour la v1.
- **Suivi** : soigner les fonctions de **diffusion** (impression/PDF lisibles) — voir la feature `012` de la [roadmap](../../features/ROADMAP.md) ; rappeler clairement l'importance de la sauvegarde/export (ergonomie).
