# Roadmap — v1

Backlog priorisé, **ordonné par dépendances**. Les plans détaillés (`NNNN-*.md`) seront rédigés par l'agent [`architecte`](../.claude/agents/architecte.md) au fur et à mesure, puis implémentés par [`developpeur-vue`](../.claude/agents/developpeur-vue.md).

Légende statut : ⬜ à faire · 🟡 en cours · ✅ fait.

## Socle technique

| N°  | Feature                    | Résumé                                                                                                                                                                                                                                                                                                                                                                                                   | Dépend de | Statut |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 0001 | Bootstrap projet Vite      | Initialiser (via **npm**) Vite + Vue 3 (Options API) + Vuex + vue-router ; structure `src/` ([archi 06](../docs/architecture/06-structure-du-code.md)) ; SCSS + tokens + **intégration Bootstrap 5** thémé par les tokens ([ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md), [style](../docs/instructions/style-scss.md)) ; Phosphor ; layout & navigation de base ; app qui démarre. | —         | ✅     |
| 0002 | Couche persistance + store | `storageRepository` (LocalStorage, async) + `migrations` ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)) ; modules Vuex + plugin de persistance débouncé + `bootstrap`/`REPLACE_ALL` ([archi 04](../docs/architecture/04-gestion-etat-vuex.md)) ; `schema.js` (défauts, (dé)sérialisation, intégrité).                                                                    | 0001       | ✅     |

## Données de référence

| N°  | Feature                | Résumé                                                                                       | Dépend de | Statut |
| --- | ---------------------- | -------------------------------------------------------------------------------------------- | --------- | ------ |
| 0003 | Paramètres cabinet     | Écran de réglages (jours d'ouverture, créneaux actifs, repos hebdo, max jours consécutifs…). | 0002       | ✅     |
| 0004 | Gestion de l'équipe    | CRUD des personnes (statut, couleur, quotité, dates), soft-delete.                           | 0002       | ✅     |
| 0005 | Souhaits & préférences | Édition des préférences par personne (types dur/souple, poids).                              | 0004       | ✅     |
| 0006 | Gestion des tournées   | CRUD des tournées (horaires, créneau, jours d'application, effectif requis), archivage.      | 0002       | ✅     |
| 0007 | Absences & congés      | Saisie et validation des absences (types, période, créneau, statut).                         | 0004       | ✅     |

## Sauvegarde & moteur

| N°  | Feature                       | Résumé                                                                                                                                                                                               | Dépend de | Statut |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 0008 | Sauvegarde import/export JSON | Export du `SaveDocument`, import avec migration + validation d'intégrité + remplacement atomique ([ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md)) ; rappel de sauvegarde. | 0002       | ✅     |
| 0009 | Moteur de planification       | Module pur `src/domain/scheduling/` : contraintes, génération (glouton + recherche locale), validation ([archi 05](../docs/architecture/05-moteur-de-planification.md)).                             | 0002       | ✅     |

## Planning (cœur)

| N°  | Feature                      | Résumé                                                                                                                                     | Dépend de          | Statut |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------ |
| 0010 | Génération de planning (UI)  | Choix de période, lancement de la génération, affichage de la proposition + conflits résiduels.                                            | 0005, 0006, 0007, 0009 | ✅     |
| 0011 | Éditeur de planning          | Grille, **glisser-déposer**, validation **temps réel** des conflits, verrouillage d'affectations, regénération (reproductible / variante). | 0010                | ✅     |
| 0012 | Diffusion / impression / PDF | Vue lecture imprimable/exportable pour l'équipe ([ADR 0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md)), `@media print`.     | 0011                | ⬜     |

## Finition

| N°  | Feature                   | Résumé                                                                            | Dépend de          | Statut |
| --- | ------------------------- | --------------------------------------------------------------------------------- | ------------------ | ------ |
| 0013 | Tableau de bord (accueil) | Vue d'ensemble, actions rapides, état de sauvegarde, accès aux plannings récents. | 0004, 0006, 0007, 0011 | ⬜     |

## Identité & ergonomie visuelle

Décidées en cours de route (maquette validée) : re-thème global puis refonte du shell de navigation. Touchent des fichiers **globaux** (`_tokens.scss`, `App.vue`) → à séquencer avec les features en cours.

| N°  | Feature                       | Résumé                                                                                                                                                             | Dépend de | Statut |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| 0014 | Refonte identité visuelle     | Palette « Teal & Sable » + police **Manrope** (`@fontsource`), thémé par les tokens ([ADR 0012](../docs/adr/0012-style-scss.md), [ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md)). Re-thème global, sans toucher au layout. | 0001       | ⬜     |
| 0015 | Layout : menu latéral repliable | `App.vue` en grille `sidebar + contenu` + composant `MenuLateral` (déplié / replié avec infobulles, état persisté, accessibilité). Icônes Phosphor.               | 0014       | ⬜     |

## Modèle & ajustements v1 (post-maquette)

Refactors décidés pendant la revue de maquette. **0016 est transverse et à haut risque de conflit** (moteur + éditeur) → à séquencer après l'atterrissage de 0011.

| N°  | Feature                                | Résumé                                                                                                                                                                                    | Dépend de              | Statut |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------ |
| 0016 | Refonte modèle Tournée & tournées coupées | Implémente [ADR 0017](../docs/adr/0017-modelisation-tournees-coupees-segments.md) : `Tournee.segments[]` (complète/coupée), libellé libre, effectif par segment ; moteur (recouvrement horaire, continuité intra-journée), migration. | 0006, 0009, 0010, 0011     | ⬜     |
| 0017 | Absences v1 (saisie directe)           | Retire le workflow demande/validation (v1 mono-gestionnaire, [ADR 0014](../docs/adr/0014-pas-authentification-v1.md)) ; `statut` dormant = `VALIDE`. Réactivé avec l'auth (post-v1).       | 0007                    | ⬜     |

---

**Hors v1 (idées à acter par ADR si retenues)** : IndexedDB si le volume grandit ; Web Worker pour la génération ; tests unitaires du moteur ; mode sombre ; authentification / multi-postes ; gestion multi-cabinets.
