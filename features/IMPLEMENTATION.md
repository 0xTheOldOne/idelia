# Note de démarrage — implémentation « identité + écrans » (post-maquette)

> Feuille de route pour une session qui implémente la refonte décidée lors de la revue de maquette (juillet 2026). À lire avant de commencer. Ceci n'est pas un plan de feature : les plans détaillés sont les `features/NNNN-*.md` cités.

## Référence visuelle

Maquette interactive validée (hors dépôt, sur claude.ai) : **https://claude.ai/code/artifact/8eed6b8b-040f-4e95-8aab-78a69a8bb5fc**
Elle couvre : palette **Teal & Sable**, police **Manrope**, **menu latéral repliable**, et les 6 écrans (Accueil, Équipe, Tournées, Absences, Planning, Paramètres). Les **valeurs exactes** (couleurs, graisses) sont déjà dans le plan 0014 ; la maquette sert de repère de mise en page.

## Ce qui est décidé et où

- **Plans prêts** : [0014 identité](0014-refonte-identite-visuelle.md), [0015 layout](0015-layout-menu-lateral-repliable.md), [0013 tableau de bord](0013-tableau-de-bord-accueil.md), [0016 tournées coupées](0016-tournees-coupees-modele.md), [0017 absences v1](0017-absences-v1-sans-validation.md).
- **ADR** : [0017 — tournées coupées / segments](../docs/adr/0017-modelisation-tournees-coupees-segments.md).
- **Décisions produit** (dans la mémoire projet) : palette « Teal & Sable » + Manrope + logo `public/favicon.png` ; tournée = libellé + type (complète/coupée) + horaires + jours + effectif **par vacation**, sans secteur ni statut actif/archivé ; absences v1 sans validation ; rôles/droits + envoi automatisé = **post-v1** (nécessitent un backend/auth, hors périmètre — règle d'or #1).

## Ordre d'implémentation conseillé (dépendances)

1. **0014 — Identité** (tokens + Manrope). Aucune dépendance. Rendu propre en standalone.
2. **0015 — Layout** (menu latéral). Dépend de 0014.
3. **0017 — Absences v1**. Petit, indépendant (dépend de 0007, déjà fait). Peut s'insérer à tout moment.
4. **0013 — Tableau de bord**. Dépend de 0004/0006/0007/0011 ; meilleur rendu après 0014/0015 mais buildable seul.
5. **0016 — Tournées coupées**. **Gros refactor transverse** (modèle + migration + moteur + formulaire + grille/éditeur). **À faire en dernier, sur une branche dédiée, APRÈS l'atterrissage de 0011.**
6. **Passes visuelles par écran** (Équipe, Planning, Paramètres) pour aligner l'agencement sur la maquette — après 0014/0015, au fil de l'eau, avec relecture `relecteur-ergonomie`.

## Coordination ⚠️

- Une autre session code la **feature 0011 (éditeur de planning)**. **0014/0015** touchent des fichiers globaux (`_tokens.scss`, `App.vue`) et **0016** touche le cœur (moteur + éditeur) → **fort risque de conflit**.
- **Toujours repartir de `main`**, laisser 0011 atterrir avant 0016, et séquencer plutôt que paralléliser sur les fichiers globaux.

## Workflow (rappel CLAUDE.md)

- Implémentation par l'agent **`developpeur-vue`**, **une tâche = un sous-agent** (`model: sonnet`, effort `medium`), à qui l'on passe : chemin du plan, n° + titre de tâche, fichiers à créer/modifier, contexte d'archi.
- Après chaque écran : relecture par **`relecteur-ergonomie`**.
- Commits en français, sans trailer de co-auteur ; identité locale `0xTheOldOne`.

## Décisions encore ouvertes à trancher (signalées par les plans)

- **0016 — `archivee` (soft-delete des tournées)** : ✅ **tranché — on garde le soft-delete**. Le champ `archivee` reste (retirer une tournée obsolète sans casser les plannings passés) ; le store garde `actives`/`archivees`/`archiver`/`restaurer` ; l'UI garde l'action Archiver/Restaurer + un accès aux archivées. Seul le **badge « Active »** sur la liste principale est retiré (bruit).
- **0016 — granularité des absences** : garder des créneaux « buckets » avec un pivot midi (proposé `"13:00"`, à confirmer) **ou** passer aux heures réelles. Le plan recommande les buckets (KISS).
- **0016 — équité** : conservée en comptage par affectation (une coupée = 2 → pèse plus). OK par défaut.
- **0013 — points mineurs** : définition de « prochain planning », numéro de semaine ISO vs dates, filtres/plafonds des listes (défauts raisonnables proposés dans le plan).
- **0017 — état factuel** (« En cours / À venir / Passée ») : à inclure ou non ; sort des statuts hérités à l'import.
