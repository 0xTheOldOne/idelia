# ADR 0018 — Stratégie de sauvegarde dans un fichier (File System Access API en amélioration progressive)

- **Statut** : Accepté
- **Date** : 2026-07-10
- **Décideurs** : Porteur du produit (revue), mise en œuvre feature [0019](../../features/0019-sauvegarde-fiable-et-periodique.md)

## Contexte

Idelia est une application **100 % frontend, sans backend** ([ADR 0002](0002-application-frontend-sans-backend.md)). Les données sont persistées automatiquement en `localStorage` derrière `storageRepository` ([ADR 0005](0005-persistance-localstorage-derriere-repository.md)) et partagées par **export/import de fichier JSON** ([ADR 0006](0006-sauvegarde-partage-par-export-import-json.md)). Trois besoins remontés en revue ont mis en lumière une limite structurelle :

- **Fiabilité (bug)** : l'export actuel via un lien `<a download>` met à jour la date de « dernière sauvegarde » **même si l'utilisateur annule** la boîte de dialogue du navigateur. Un lien `<a download>` est **fire-and-forget** : aucune Promise, aucun événement ne renseigne le code sur ce que l'utilisateur a fait (ni sur le fait qu'un fichier ait réellement été écrit).
- **Sauvegarde périodique** : pouvoir écrire une sauvegarde automatiquement toutes les N minutes.
- **Clarté fichier vs mémoire** : l'utilisateur peut croire ses données « sauvegardées » alors qu'elles ne vivent que dans le `localStorage` du navigateur, sans qu'aucun **fichier** n'ait jamais été écrit sur son poste.

Techniquement, seul un mécanisme permet à un frontend d'écrire un fichier **automatiquement** et de **détecter une annulation** : la **File System Access API** (`showSaveFilePicker` + `FileSystemFileHandle.createWritable`). Elle n'est disponible que sur **Chromium (Chrome/Edge)**, exige un **geste utilisateur** pour le premier choix de fichier, et son `FileSystemFileHandle` n'est **pas sérialisable** (ni `localStorage`, ni le `SaveDocument`) : le conserver entre deux sessions imposerait **IndexedDB** + une ré-autorisation non garantie.

## Décision

Nous adoptons la **File System Access API en amélioration progressive**, avec le `FileSystemFileHandle` conservé **en mémoire pour la durée de la session (l'onglet ouvert) uniquement — sans IndexedDB** :

- **Sur Chrome/Edge** : l'utilisateur choisit une fois un « fichier de sauvegarde actif » (un clic) ; Idelia y **réécrit silencieusement** à la demande et automatiquement toutes les N minutes, avec **détection fiable de l'annulation/échec** (`AbortError` → aucun état modifié). Après un rechargement de page, le fichier actif est **oublié** ; l'utilisateur le re-choisit en un clic.
- **Sur les autres navigateurs** (Firefox/Safari) ou tant qu'aucun fichier actif n'est choisi : Idelia se limite à un **rappel périodique** (toast, [feature 0018](../../features/0018-systeme-notifications-toasts.md)) invitant à télécharger une sauvegarde ; le téléchargement automatique **n'est pas** silencieusement répété (il remplirait le dossier « Téléchargements » sans résoudre la fiabilité).
- **Dans tous les cas**, les libellés à l'écran distinguent sans ambiguïté « données enregistrées **dans ce navigateur** » (toujours vrai), « **téléchargement lancé** le … » (voie classique, incertaine) et « **fichier de sauvegarde à jour** le … » (écriture réellement confirmée). Jamais un texte n'affirme plus de certitude que ce que l'application sait.

Le réglage d'activation/fréquence est une **préférence d'UI** persistée via `storageRepository` sur une clé dédiée (`idelia:prefs-sauvegarde-auto`), **hors du `SaveDocument`** (jamais exportée/importée), sur le modèle de la préférence « menu replié » ([feature 0015](../../features/0015-layout-menu-lateral-repliable.md)). Aucune donnée n'est jamais envoyée sur le réseau ([ADR 0002](0002-application-frontend-sans-backend.md)).

## Conséquences

- **Positives** : correction **réelle** du bug d'annulation et sauvegarde automatique **réelle** dans un fichier sur Chrome/Edge (poste type d'un cabinet) ; clarté honnête sur l'état de sauvegarde (fichier vs navigateur) ; aucune nouvelle brique de stockage (pas d'IndexedDB) donc **aucun écart** à [ADR 0005](0005-persistance-localstorage-derriere-repository.md) ; repli gracieux et non trompeur sur les autres navigateurs.
- **Négatives / compromis** : sur Chrome/Edge, le fichier actif **ne survit pas** à un rechargement de page (à re-choisir par session) — compromis KISS assumé, annoncé clairement à l'utilisateur ; l'écriture **automatique** dans un fichier reste **indisponible** sur Firefox/Safari (rappel seulement) ; dépendance à une API récente, gérée par *feature-detection* (`'showSaveFilePicker' in window`) et masquage propre du bloc concerné là où elle manque.
- **Suivi** : si la re-sélection par session s'avère pénible à l'usage, envisager la **persistance du handle via IndexedDB** (nouvel ADR, écart à [ADR 0005](0005-persistance-localstorage-derriere-repository.md) à acter). Ajouter un renvoi de suivi depuis [ADR 0006](0006-sauvegarde-partage-par-export-import-json.md) vers le présent ADR.

## Alternatives considérées

- **File System Access API + persistance du handle via IndexedDB** : conserverait le fichier actif entre sessions, mais introduit une nouvelle brique de stockage (écart à [ADR 0005](0005-persistance-localstorage-derriere-repository.md)) et une ré-autorisation non garantie silencieuse — complexité disproportionnée pour un gain incertain. Écartée par défaut ; réévaluable en suivi.
- **Téléchargement classique (`<a download>`) uniquement** : le plus simple et universel, mais **ne peut pas** corriger le bug d'annulation (aucune détection possible) ni réaliser une sauvegarde périodique réelle (seulement un rappel). Insuffisant au regard des besoins exprimés.

## Liens

[ADR 0002](0002-application-frontend-sans-backend.md) (sans backend / local) · [ADR 0005](0005-persistance-localstorage-derriere-repository.md) (persistance derrière `storageRepository`) · [ADR 0006](0006-sauvegarde-partage-par-export-import-json.md) (export/import JSON) · [feature 0019](../../features/0019-sauvegarde-fiable-et-periodique.md) (mise en œuvre) · [feature 0018](../../features/0018-systeme-notifications-toasts.md) (toasts, feedback des échecs).
