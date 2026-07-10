# 07 — Navigation et écrans

Idelia s'organise autour d'un petit nombre d'écrans clairs, accessibles depuis un **menu latéral permanent, repliable** (à gauche ; [feature 0015](../../features/0015-layout-menu-lateral-repliable.md)). Le vocabulaire est celui de l'utilisateur (pas de jargon).

## Carte des écrans

| Route | Écran | Rôle | Feature |
|---|---|---|---|
| `/` | **Accueil** | Vue d'ensemble, actions rapides, état de la sauvegarde | `0013` |
| `/equipe` | **Équipe** | Gérer les personnes du cabinet (ajout/édition/désactivation) | `0004` |
| `/equipe/:id/souhaits` | **Souhaits** | Souhaits & préférences d'une personne | `0005` |
| `/tournees` | **Tournées** | Gérer les tournées et leurs horaires | `0006` |
| `/absences` | **Absences & congés** | Saisir les absences (saisie directe, sans validation en v1) | `0007`, `0017` |
| `/planning` | **Planning** | Générer, éditer (drag & drop), voir les conflits | `0010`, `0011` |
| `/planning/:id/diffusion` | **Diffusion** | Impression / export PDF pour l'équipe | `0012` |
| `/parametres` | **Paramètres** | Réglages cabinet + sauvegarde / import / export | `0003`, `0008` |

## Principes de navigation

- **Menu latéral toujours visible** (déplié : icônes Phosphor + libellés, groupés « Pilotage » / « Planning » ; replié : rail d'icônes seules avec infobulles au survol/focus). Repli **réversible** et **mémorisé** d'une session à l'autre ; sous ~992 px, repli automatique en rail. Icônes Phosphor ([ADR 0013](../adr/0013-icones-phosphor.md)) ; l'écran courant est mis en évidence par **fond + barre d'accent + graisse** (`aria-current`), jamais par la seule couleur.
- **Une action principale par écran**, visuellement dominante (ex. « Générer le planning »).
- **Fil d'Ariane** ou titre d'écran explicite en permanence : l'utilisateur sait toujours où il est.
- **Actions destructrices** protégées par confirmation ; retour/annulation possibles.
- **Rappel de sauvegarde** accessible depuis partout (état « dernière sauvegarde le… », bouton d'export) — cohérent avec le workflow référent ([ADR 0009](../adr/0009-workflow-referent-diffusion-lecture.md)).

## Écran Planning (le plus riche)

C'est l'écran central. Il enchaîne :
1. **Choix de la période** et lancement de la **génération** (le moteur propose).
2. **Grille d'édition** (personnes × jours, ou tournées × jours) avec **glisser-déposer** ; une tournée **coupée** présente ses deux vacations (matin / reprise du soir) distinctement dans la case, éditables séparément ([feature 0016](../../features/0016-tournees-coupees-modele.md)).
3. **Panneau de conflits** mis à jour en **temps réel** (erreurs dures en évidence, avertissements souples distincts), avec surlignage des cellules concernées.
4. **Verrouillage** d'affectations (préservées lors d'une régénération) et actions « regénérer » (reproductible / variante).

Les principes d'ergonomie détaillés sont dans [`08-principes-ux-ergonomie.md`](08-principes-ux-ergonomie.md).
