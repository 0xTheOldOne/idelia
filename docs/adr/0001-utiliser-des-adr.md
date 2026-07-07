# ADR 0001 — Utiliser des ADR pour tracer les décisions

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Le projet démarre et prendra des décisions structurantes (persistance, moteur de planning, stack…). Sur un projet destiné à durer et à être repris en plusieurs sessions, on perd vite la mémoire du **pourquoi** d'un choix. On veut une trace légère, versionnée avec le code.

## Décision

Nous consignons chaque décision d'architecture significative dans un **Architecture Decision Record** au format Michael Nygard (Contexte / Décision / Conséquences), dans `docs/adr/`, numéroté séquentiellement et immuable une fois accepté (on ne réécrit pas l'histoire : on ajoute un nouvel ADR qui remplace ou déprécie l'ancien).

## Conséquences

- **Positives** : le « pourquoi » est traçable ; onboarding et reprise de session facilités ; les débats tranchés ne sont pas re-litigés.
- **Négatives / compromis** : léger coût d'écriture à chaque décision ; discipline à tenir.
- **Suivi** : garder les ADR courts ; ne créer un ADR que pour une décision qui a des conséquences réelles.
