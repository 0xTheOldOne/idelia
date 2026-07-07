# ADR 0016 — Router en mode hash (createWebHashHistory) pour l'hébergement statique

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Idelia est une SPA hébergée en **site statique** sur GitHub/GitLab Pages ([ADR 0002](0002-application-frontend-sans-backend.md)). vue-router propose deux modes d'historique :
- `createWebHistory` — URLs propres (`/idelia/planning`), mais un **rafraîchissement** sur une route profonde renvoie une **404** côté hébergeur statique (aucun serveur pour renvoyer `index.html`). Nécessite un contournement (`404.html` de repli).
- `createWebHashHistory` — URLs avec fragment (`/idelia/#/planning`) ; le serveur ne voit que `index.html`, donc **le rafraîchissement fonctionne toujours**, sans configuration.

## Décision

Nous utilisons **`createWebHashHistory(import.meta.env.BASE_URL)`**. Le mode hash fonctionne d'emblée sur Pages, sans fichier de repli ni configuration serveur — cohérent avec **KISS** et avec le public non-technique (aucune 404 déroutante en cas de rafraîchissement ou de partage de lien).

## Conséquences

- **Positives** : robustesse totale sur hébergement statique ; rafraîchissement et liens directs fiables ; aucun `404.html` ni règle serveur à maintenir ; déploiement Pages trivial.
- **Négatives / compromis** : présence du `#` dans les URLs (esthétique) — sans impact pour les utilisateurs cibles ; ancres de page (`#section`) à gérer via l'API du routeur plutôt que par le fragment natif.
- **Suivi** : si un hébergement avec fallback SPA était adopté un jour (autre que Pages), on pourrait reconsidérer `createWebHistory` (nouvel ADR).

## Liens

[ADR 0002](0002-application-frontend-sans-backend.md) (sans backend / statique) · [ADR 0003](0003-stack-vue-vite-optionsapi-vuex-router.md) (vue-router).
