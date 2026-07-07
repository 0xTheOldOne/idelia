# Instructions — Nommage & conventions

## Langue

- **Domaine en français** : entités, champs métier, actions, variables et fonctions métier suivent le glossaire ([architecture 02](../architecture/02-modele-de-domaine.md)) — `personnes`, `tournees`, `affectations`, `genererPlanning`, `validerPlanning`…
- **Documentation, libellés UI, messages** : français.
- Les mots-clés techniques restent dans leur forme usuelle (`state`, `getters`, `props`, `computed`…).

## Nommage des fichiers

| Type | Convention | Exemple |
|---|---|---|
| Composant Vue | `PascalCase.vue` | `GrillePlanning.vue` |
| Écran routé | `…View.vue` | `EquipeView.vue` |
| Module JS | `camelCase.js` | `storageRepository.js` |
| Partiel SCSS | `_kebab.scss` | `_tokens.scss` |
| ADR | `NNNN-kebab.md` | `0005-persistance-...md` |
| Feature | `NNN-KebabOuNom.md` | `004-gestion-equipe.md` |

## Nommage dans le code

- **Variables/fonctions** : `camelCase`.
- **Composants** : `PascalCase` avec `name` renseigné.
- **Enums** : codes `MAJUSCULES_SNAKE` (`TITULAIRE`, `APRES_MIDI`, `CONGE_PAYE`) ; libellés affichés via table de correspondance.
- **Événements Vue** : `kebab-case` (`affectation-modifiee`).

## Dates & jours (rappel [ADR 0010](../adr/0010-conventions-dates-et-jours-iso.md))

- **Jours de semaine : ISO 8601, `1`=Lundi … `7`=Dimanche.** Jamais `0-6` sans conversion.
- **Dates** : `"YYYY-MM-DD"`. **Heures** : `"HH:mm"`. **Horodatages** : ISO UTC (`toISOString()`).
- **Interdit** : `Date` dans le state persistant, `new Date("YYYY-MM-DD")`. Toujours passer par `src/domain/utils/dates.js`.

## Commits (Windows / PowerShell)

- Messages en français, à l'impératif présent, préfixés par un type léger : `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `chore:`.
  - Exemple : `feat: ajouter la gestion de l'équipe (CRUD personnes)`.
- Référencer la feature quand pertinent : `feat(004): …`.
- Rappel : shell **PowerShell** — syntaxe PowerShell pour toute commande.

## Général

- **KISS** avant tout ; pas de dépendance ajoutée sans justification (à noter dans un ADR si structurante).
- **Réutiliser** l'existant avant de créer.
- **Séparation domaine/UI** : logique métier dans `src/domain/`, jamais dans les composants.
