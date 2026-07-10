# 07 — Navigation et écrans

Idelia s'organise autour d'un petit nombre d'écrans clairs, accessibles depuis une **barre de navigation permanente**. Le vocabulaire est celui de l'utilisateur (pas de jargon).

## Carte des écrans

| Route | Écran | Rôle | Feature |
|---|---|---|---|
| `/` | **Accueil** | Vue d'ensemble, actions rapides, état de la sauvegarde | `0013` |
| `/equipe` | **Équipe** | Gérer les personnes du cabinet (ajout/édition/désactivation) | `0004` |
| `/equipe/:id/souhaits` | **Souhaits** | Souhaits & préférences d'une personne | `0005` |
| `/tournees` | **Tournées** | Gérer les tournées et leurs horaires | `0006` |
| `/absences` | **Absences & congés** | Saisir et valider les absences | `0007` |
| `/planning` | **Planning** | Générer, éditer (drag & drop), voir les conflits | `0010`, `0011` |
| `/planning/:id/diffusion` | **Diffusion** | Impression / export PDF pour l'équipe | `0012` |
| `/parametres` | **Paramètres** | Réglages cabinet + sauvegarde / import / export | `0003`, `0008` |

## Principes de navigation

- **Barre de navigation toujours visible** avec libellés + icônes Phosphor ([ADR 0013](../adr/0013-icones-phosphor.md)), l'écran courant clairement mis en évidence.
- **Une action principale par écran**, visuellement dominante (ex. « Générer le planning »).
- **Fil d'Ariane** ou titre d'écran explicite en permanence : l'utilisateur sait toujours où il est.
- **Actions destructrices** protégées par confirmation ; retour/annulation possibles.
- **Rappel de sauvegarde** accessible depuis partout (état « dernière sauvegarde le… », bouton d'export) — cohérent avec le workflow référent ([ADR 0009](../adr/0009-workflow-referent-diffusion-lecture.md)).

## Écran Planning (le plus riche)

C'est l'écran central. Il enchaîne :
1. **Choix de la période** et lancement de la **génération** (le moteur propose).
2. **Grille d'édition** (personnes × jours/créneaux, ou tournées × jours) avec **glisser-déposer**.
3. **Panneau de conflits** mis à jour en **temps réel** (erreurs dures en évidence, avertissements souples distincts), avec surlignage des cellules concernées.
4. **Verrouillage** d'affectations (préservées lors d'une régénération) et actions « regénérer » (reproductible / variante).

Les principes d'ergonomie détaillés sont dans [`08-principes-ux-ergonomie.md`](08-principes-ux-ergonomie.md).
