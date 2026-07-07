# ADR 0014 — Pas d'authentification en v1

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Sans backend ([ADR 0002](0002-application-frontend-sans-backend.md)), une authentification côté frontend seule n'offre pas de réelle sécurité (elle serait contournable et ne protège pas les données locales). L'usage cible est un poste de référent, souvent personnel. Le mot d'ordre est KISS.

## Décision

**Aucune authentification** n'est implémentée en v1. L'application s'ouvre directement sur ses écrans. La protection des données repose sur le contexte d'usage (poste du référent) et sur la responsabilité de l'utilisateur (verrouillage de session du poste, gestion du fichier d'export).

## Conséquences

- **Positives** : simplicité maximale ; pas de fausse impression de sécurité ; accès immédiat pour un public non-technique.
- **Négatives / compromis** : aucune séparation d'accès ni de rôles ; quiconque a accès au navigateur voit les données. Le fichier d'export n'est pas chiffré. Acceptable pour la v1 au vu de l'usage.
- **Suivi** : si un besoin de confidentialité/rôles émerge (multi-postes, données sensibles), il faudra un mécanisme dédié (et probablement un backend) → nouvel ADR. Rester prudent sur les **données personnelles** (RGPD) dès la conception des exports.
