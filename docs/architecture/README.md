# Architecture d'Idelia — Le « comment »

Ce dossier décrit **comment** Idelia est construite. Le **pourquoi** des choix se trouve dans [`../adr/`](../adr/) ; les **conventions de code** dans [`../instructions/`](../instructions/).

## Ordre de lecture conseillé

1. [`01-vue-ensemble.md`](01-vue-ensemble.md) — la vue d'ensemble et les flux de données.
2. [`02-modele-de-domaine.md`](02-modele-de-domaine.md) — les concepts métier et les entités.
3. [`03-modele-de-donnees.md`](03-modele-de-donnees.md) — le format JSON persisté/échangé.
4. [`04-gestion-etat-vuex.md`](04-gestion-etat-vuex.md) — l'organisation du store et la persistance.
5. [`05-moteur-de-planification.md`](05-moteur-de-planification.md) — le cœur technique (génération + validation).
6. [`06-structure-du-code.md`](06-structure-du-code.md) — l'arborescence `src/` et les conventions.
7. [`07-navigation-et-ecrans.md`](07-navigation-et-ecrans.md) — les routes et les écrans.
8. [`08-principes-ux-ergonomie.md`](08-principes-ux-ergonomie.md) — les principes d'ergonomie.

## Principes directeurs (rappel)

- **Frontend seul, sans backend** ([ADR 0002](../adr/0002-application-frontend-sans-backend.md)).
- **Séparation stricte domaine / UI** : la logique métier vit dans `src/domain/` ; les composants orchestrent l'affichage ([ADR 0008](../adr/0008-moteur-planification-module-pur.md)).
- **Persistance derrière un repository unique** ([ADR 0005](../adr/0005-persistance-localstorage-derriere-repository.md)).
- **Conventions de dates/jours ISO** ([ADR 0010](../adr/0010-conventions-dates-et-jours-iso.md)).
- **Ergonomie d'abord** pour un public non-informaticien.
