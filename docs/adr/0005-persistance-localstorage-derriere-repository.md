# ADR 0005 — Persistance en LocalStorage, isolée derrière un repository

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Sans backend ([ADR 0002](0002-application-frontend-sans-backend.md)), les données doivent vivre dans le navigateur. Deux options principales : **LocalStorage** (simple, synchrone, ~5-10 Mo) et **IndexedDB** (base NoSQL embarquée, plus puissante mais asynchrone et plus verbeuse). Le volume d'un cabinet est petit (bien en-dessous de la limite LocalStorage).

## Décision

Nous utilisons **LocalStorage** en v1, avec une seule clé `"idelia:data"` contenant l'ensemble du document de sauvegarde JSON. **Tout accès au stockage passe par une couche d'abstraction unique `storageRepository`** exposant une **interface asynchrone (Promises)** — `load()`, `save(doc)`, `clear()`, `isAvailable()` — même si l'implémentation LocalStorage est synchrone en dessous.

Aucun autre module (store, composants, domaine) n'accède jamais à `localStorage` directement.

## Conséquences

- **Positives** : mise en œuvre triviale et fiable pour ce volume ; l'interface async dès le v1 rend la **bascule vers IndexedDB indolore** (un seul fichier à réécrire, mêmes signatures) ; testabilité (on peut substituer une implémentation en mémoire).
- **Négatives / compromis** : limite de volume et données liées à un navigateur/poste ; sensibilité à la navigation privée et au quota (géré par `isAvailable()`) ; comportement multi-onglets à surveiller (last-write-wins par défaut).
- **Suivi** : si le volume ou le besoin de requêtes grandit, migrer `storageRepository` vers IndexedDB (nouvel ADR pour acter la migration si nécessaire).

## Alternatives considérées

- **IndexedDB dès le v1** : écartée comme complexité prématurée, mais rendue accessible plus tard grâce à l'abstraction.
- **`vuex-persistedstate`** : écartée car elle écrit dans `localStorage` en direct, ce qui court-circuiterait le repository (voir [ADR 0003](0003-stack-vue-vite-optionsapi-vuex-router.md) et l'architecture Vuex).
