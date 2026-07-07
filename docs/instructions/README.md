# Instructions de développement — Idelia

Guidelines **opérationnelles par domaine**, destinées à l'agent `developpeur-vue` et à toute personne qui code sur Idelia. Elles complètent le **pourquoi** ([`../adr/`](../adr/)) et le **comment** global ([`../architecture/`](../architecture/)) par le **comment concret, au quotidien**.

## Sommaire

- [`composants-vue.md`](composants-vue.md) — structure et conventions des composants Vue (Options API).
- [`style-scss.md`](style-scss.md) — organisation SCSS, tokens, thème.
- [`formulaires-validation.md`](formulaires-validation.md) — Vuelidate + vue-debounce.
- [`etat-vuex.md`](etat-vuex.md) — écrire un module de store, où placer la logique.
- [`nommage-et-conventions.md`](nommage-et-conventions.md) — nommage, dates/jours, commits.
- [`accessibilite-ergonomie.md`](accessibilite-ergonomie.md) — checklist a11y & ergonomie.

## Rappel des règles d'or

Voir [`../../CLAUDE.md`](../../CLAUDE.md). En résumé : pas de backend, JS pur (pas de TS), Options API, Vuex, SCSS, Phosphor, jours ISO 1-7, persistance via `storageRepository` uniquement, logique métier dans `src/domain/`, ergonomie prioritaire.
