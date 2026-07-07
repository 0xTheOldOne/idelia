# Idelia

**Idelia** aide un cabinet infirmier à établir ses plannings, en tenant compte des personnes, de leurs souhaits, des tournées et de leurs horaires, et des absences (congés, arrêts, maternité/paternité/naissance…).

L'application est pensée pour des personnes **peu à l'aise avec l'informatique** : l'ergonomie est une exigence de premier plan.

## En bref

- Application **100 % frontend** (Vue.js), **sans backend**, hébergeable en site statique (GitHub/GitLab Pages).
- Les données vivent dans le navigateur (LocalStorage) ; la **sauvegarde et le partage** se font par **export/import d'un fichier JSON**.
- Le planning est construit en mode **hybride** : un moteur propose une répartition, puis l'utilisateur ajuste par glisser-déposer, avec détection des conflits en temps réel.
- Un **référent** tient le planning (source de vérité) et le diffuse à l'équipe en lecture (impression / PDF / export).

## Statut

Projet en amorçage. Cette première étape met en place le **harness** (documentation d'architecture, décisions, guidelines, agents et roadmap). Le code applicatif n'existe pas encore : son initialisation est la première feature (`001`).

## Carte du dépôt

| Dossier | Rôle |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Guide d'amorçage pour les assistants : règles d'or et liens. |
| [`docs/adr/`](docs/adr/) | **Le pourquoi** — décisions d'architecture (ADR). |
| [`docs/architecture/`](docs/architecture/) | **Le comment** — vue d'ensemble et conception. |
| [`docs/instructions/`](docs/instructions/) | Guidelines de développement par domaine. |
| [`features/`](features/) | Plans de features (`NNN-NomDeLaFeature.md`) et [roadmap](features/ROADMAP.md). |

## Stack technique

Vite · Vue 3 (Options API) · Vuex · vue-router · SCSS + **Bootstrap 5** · Vuelidate · vue-debounce · @phosphor-icons/vue · **JavaScript pur (pas de TypeScript)**.

## Démarrage (à venir)

Les commandes (`npm install`, `npm run dev`, …) seront disponibles une fois la feature `001-bootstrap-projet-vite` réalisée. Voir [`features/ROADMAP.md`](features/ROADMAP.md).
