# Roadmap — v1

Backlog priorisé, **ordonné par dépendances**. Les plans détaillés (`NNN-*.md`) seront rédigés par l'agent [`architecte`](../.claude/agents/architecte.md) au fur et à mesure, puis implémentés par [`developpeur-vue`](../.claude/agents/developpeur-vue.md).

Légende statut : ⬜ à faire · 🟡 en cours · ✅ fait.

## Socle technique

| N°  | Feature                    | Résumé                                                                                                                                                                                                                                                                                                                                                                                                   | Dépend de | Statut |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 001 | Bootstrap projet Vite      | Initialiser (via **npm**) Vite + Vue 3 (Options API) + Vuex + vue-router ; structure `src/` ([archi 06](../docs/architecture/06-structure-du-code.md)) ; SCSS + tokens + **intégration Bootstrap 5** thémé par les tokens ([ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md), [style](../docs/instructions/style-scss.md)) ; Phosphor ; layout & navigation de base ; app qui démarre. | —         | ✅     |
| 002 | Couche persistance + store | `storageRepository` (LocalStorage, async) + `migrations` ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)) ; modules Vuex + plugin de persistance débouncé + `bootstrap`/`REPLACE_ALL` ([archi 04](../docs/architecture/04-gestion-etat-vuex.md)) ; `schema.js` (défauts, (dé)sérialisation, intégrité).                                                                    | 001       | ✅     |

## Données de référence

| N°  | Feature                | Résumé                                                                                       | Dépend de | Statut |
| --- | ---------------------- | -------------------------------------------------------------------------------------------- | --------- | ------ |
| 003 | Paramètres cabinet     | Écran de réglages (jours d'ouverture, créneaux actifs, repos hebdo, max jours consécutifs…). | 002       | ✅     |
| 004 | Gestion de l'équipe    | CRUD des personnes (statut, couleur, quotité, dates), soft-delete.                           | 002       | ✅     |
| 005 | Souhaits & préférences | Édition des préférences par personne (types dur/souple, poids).                              | 004       | ✅     |
| 006 | Gestion des tournées   | CRUD des tournées (horaires, créneau, jours d'application, effectif requis), archivage.      | 002       | ⬜     |
| 007 | Absences & congés      | Saisie et validation des absences (types, période, créneau, statut).                         | 004       | ⬜     |

## Sauvegarde & moteur

| N°  | Feature                       | Résumé                                                                                                                                                                                               | Dépend de | Statut |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 008 | Sauvegarde import/export JSON | Export du `SaveDocument`, import avec migration + validation d'intégrité + remplacement atomique ([ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md)) ; rappel de sauvegarde. | 002       | ⬜     |
| 009 | Moteur de planification       | Module pur `src/domain/scheduling/` : contraintes, génération (glouton + recherche locale), validation ([archi 05](../docs/architecture/05-moteur-de-planification.md)).                             | 002       | ⬜     |

## Planning (cœur)

| N°  | Feature                      | Résumé                                                                                                                                     | Dépend de          | Statut |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------ |
| 010 | Génération de planning (UI)  | Choix de période, lancement de la génération, affichage de la proposition + conflits résiduels.                                            | 005, 006, 007, 009 | ⬜     |
| 011 | Éditeur de planning          | Grille, **glisser-déposer**, validation **temps réel** des conflits, verrouillage d'affectations, regénération (reproductible / variante). | 010                | ⬜     |
| 012 | Diffusion / impression / PDF | Vue lecture imprimable/exportable pour l'équipe ([ADR 0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md)), `@media print`.     | 011                | ⬜     |

## Finition

| N°  | Feature                   | Résumé                                                                            | Dépend de          | Statut |
| --- | ------------------------- | --------------------------------------------------------------------------------- | ------------------ | ------ |
| 013 | Tableau de bord (accueil) | Vue d'ensemble, actions rapides, état de sauvegarde, accès aux plannings récents. | 004, 006, 007, 011 | ⬜     |

---

**Hors v1 (idées à acter par ADR si retenues)** : IndexedDB si le volume grandit ; Web Worker pour la génération ; tests unitaires du moteur ; mode sombre ; authentification / multi-postes ; gestion multi-cabinets.
