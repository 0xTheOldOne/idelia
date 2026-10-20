# ADR 0021 — IndexedDB, limitée au fichier de sauvegarde actif (mémorisation entre les sessions)

- **Statut** : Accepté
- **Date** : 2026-10-21
- **Décideurs** : porteur du produit (demande 0032 de la feuille de route, qui prescrit cet écart) ; rédaction : architecte, mise en œuvre feature [0032](../../features/0032-fichier-sauvegarde-actif-persistant.md)
- **Amende** : [ADR 0005](0005-persistance-localstorage-derriere-repository.md) (seconde brique de stockage) et [ADR 0018](0018-strategie-sauvegarde-fichier.md) (le fichier actif n'est plus limité à la session), sans les remplacer

## Contexte

L'[ADR 0018](0018-strategie-sauvegarde-fichier.md) a introduit le « fichier de sauvegarde actif » (File System Access API, Chrome/Edge) : Idelia réécrit sans dialogue dans un fichier choisi une fois par l'utilisateur. Le `FileSystemFileHandle` obtenu vit en **variable de module** (`src/store/index.js`), hors du `state` Vuex. Il est donc **oublié à chaque rechargement** : l'utilisateur doit choisir à nouveau son fichier à chaque ouverture d'Idelia. L'ADR 0018 avait accepté ce compromis et prévu un suivi : « si la re-sélection par session s'avère pénible, envisager la persistance du handle via IndexedDB (nouvel ADR) ». La demande 0032 de la feuille de route active ce suivi.

Contraintes techniques :

- Un `FileSystemFileHandle` **n'est pas sérialisable en JSON**. Il ne peut aller ni dans `localStorage` (chaînes uniquement), ni dans le `SaveDocument`, ni dans le `state` Vuex persisté. Le seul stockage du navigateur qui l'accepte est **IndexedDB** (clonage structuré).
- La mémorisation du handle **ne garantit pas** la permission d'écrire. Au retour, `handle.queryPermission({ mode: 'readwrite' })` renvoie `'granted'` (reprise silencieuse possible), `'prompt'` ou `'denied'`. Dans les deux derniers cas, seul `handle.requestPermission(...)` appelé **pendant un geste utilisateur** (un clic) peut rétablir l'accès. En pratique sur Chrome, la permission tient tant qu'un onglet du site reste ouvert ; après une fermeture complète du navigateur, elle redevient `'prompt'` sauf si l'utilisateur a choisi « Autoriser à chaque visite » quand le navigateur le propose (selon la version et les réglages).
- Le fichier peut avoir été **déplacé, renommé ou supprimé** entre deux sessions : `getFile()` et `createWritable()` échouent alors (`NotFoundError`).
- L'[ADR 0005](0005-persistance-localstorage-derriere-repository.md) a retenu `localStorage` comme **seule** brique de stockage, derrière `storageRepository`, et a écarté IndexedDB en v1 comme complexité prématurée.
- Règle d'or n° 12 (KISS) : aucune dépendance sans justification.

## Décision

Nous utilisons **IndexedDB comme seconde brique de stockage**, **strictement limitée à la mémorisation du handle du fichier de sauvegarde actif**. Rien d'autre n'y est stocké.

1. **Périmètre** : une base `idelia` (version 1), un magasin clé/valeur `cles-valeurs`, une seule clé `fichier-sauvegarde-actif`, dont la valeur est le `FileSystemFileHandle`. Le `SaveDocument` reste dans `localStorage` (`idelia:data`), inchangé. Le handle n'est **jamais** dans le `state` Vuex (seuls des reflets sérialisables y figurent : nom du fichier, booléens, horodatage), **jamais** exporté ni importé, **jamais** envoyé sur le réseau.
2. **Un seul point d'accès** : un module bas niveau **`src/storage/indexedDb.js`**, minimal (ouvrir, lire, écrire, supprimer une clé, supprimer la base), écrit avec l'API native. Il est importé **uniquement** par `src/storage/storageRepository.js`. Ce dernier expose trois méthodes dédiées (lire, mémoriser, oublier le handle) qui **ne rejettent jamais**. Le store, les composants et le domaine n'accèdent **jamais** à IndexedDB. La règle d'or n° 8 reste vraie telle quelle : toute persistance passe par `storageRepository`.
3. **Aucune dépendance ajoutée** (pas d'`idb-keyval` ni d'`idb`) : trois opérations sur une clé tiennent en quelques dizaines de lignes d'API native. Une bibliothèque ne se justifierait que si l'usage d'IndexedDB s'élargissait (voir Suivi).
4. **La permission n'est jamais supposée** :
   - au démarrage, `queryPermission` ; si `'granted'`, on vérifie que le fichier existe (`getFile()`) puis on reprend **sans rien demander** ;
   - sinon (`'prompt'` ou `'denied'`), l'utilisateur voit **un seul bouton** « Reprendre la sauvegarde dans « … » », qui appelle `requestPermission` ;
   - si le fichier est introuvable, une **fenêtre d'avertissement** le dit en clair et propose d'en choisir un nouveau ou de continuer sans fichier. Le handle devenu inutile est oublié.
5. **Garde-fou contre l'écrasement d'une bonne sauvegarde** : si, au démarrage, les données du navigateur sont **absentes ou illisibles**, Idelia **ne reprend pas** le fichier mémorisé, l'oublie et l'annonce. Le fichier reste intact sur le disque et l'utilisateur peut le restaurer. Sans ce garde-fou, une sauvegarde automatique remplacerait la seule copie saine par un état vide.
6. **Effacement** : « Effacer toutes les données » (`storageRepository.clear()`) supprime aussi la base IndexedDB `idelia`. Rien ne subsiste.
7. **Amélioration progressive inchangée** : sans File System Access API (Firefox, Safari), Idelia n'ouvre pas IndexedDB au démarrage, et le repli « rappel » de l'ADR 0018 s'applique sans changement.

## Conséquences

- **Positives** :
  - Sur Chrome/Edge, le fichier de sauvegarde actif **survit** au rechargement et à la fermeture du navigateur. Après un rechargement, la reprise est en principe silencieuse. Après une fermeture complète, elle demande au plus **un clic**.
  - Le code IndexedDB reste confiné dans un seul fichier, derrière l'interface existante.
  - Le `SaveDocument`, ses migrations et l'export/import ([ADR 0006](0006-sauvegarde-partage-par-export-import-json.md)) ne changent pas.
- **Négatives / compromis** :
  - **Deux briques de stockage** au lieu d'une. Tout effacement doit traiter les deux, ce qui est centralisé dans `storageRepository.clear()`.
  - **Reprise 100 % transparente non garantie** : le navigateur décide de la durée de la permission. Le texte à l'écran le dit honnêtement.
  - **Plusieurs onglets** peuvent écrire dans le même fichier. On limite le risque d'écraser le fichier avec un état périmé : la sauvegarde automatique n'écrit que si des données ont changé **dans cet onglet** depuis sa dernière écriture (détail dans la feature 0032). Le comportement multi-onglets reste « le dernier qui écrit gagne », comme pour `localStorage` (ADR 0005).
  - **Fichier sur un disque amovible ou réseau non connecté au démarrage** : il est vu comme introuvable, puis oublié une fois l'avertissement acquitté. L'utilisateur le choisit à nouveau en un clic.
  - Effacer les données du site depuis les réglages du navigateur supprime aussi la mémorisation, comme attendu.
- **Suivi** :
  - **Mutualisation avec la feature 0028** (historique des versions, reportée en V2), qui envisage IndexedDB pour la volumétrie. Elle **réutilisera** `src/storage/indexedDb.js` et la base `idelia` : un nouveau magasin, créé par montée de version (`onupgradeneeded`). Cela exigera un **nouvel ADR**, qui pourra aussi trancher le passage du `SaveDocument` lui-même vers IndexedDB et l'éventuel recours à une petite bibliothèque.
  - Si Firefox ou Safari implémentent `showSaveFilePicker` et les permissions sur les handles, la détection de capacité activera la fonctionnalité sans autre changement.
  - La règle d'or n° 8 de `CLAUDE.md` pourrait citer IndexedDB à côté de `localStorage` (« jamais d'accès direct à `localStorage` ni à IndexedDB ailleurs »). C'est à la main du porteur.

## Alternatives considérées

- **Statu quo (handle limité à la session, ADR 0018)** : simple, mais l'utilisateur doit choisir son fichier à chaque ouverture. C'est précisément la gêne qui déclenche ce suivi. Rejeté.
- **Bibliothèque `idb-keyval` (ou `idb`)** : API agréable et petite, mais c'est une dépendance pour trois opérations sur une seule clé. Contraire à la règle KISS n° 12 sans gain réel. Rejeté pour l'instant, réévaluable avec 0028.
- **Mémoriser le chemin du fichier** : impossible. Un site web n'a jamais accès au chemin d'un fichier sur le disque.
- **Origin Private File System (OPFS)** : stockage privé du navigateur, invisible pour l'utilisateur. Il ne répond pas au besoin d'un fichier rangé où l'utilisateur le souhaite (dossier, clé USB). Rejeté.
- **Migrer tout `storageRepository` vers IndexedDB** : disproportionné pour ce besoin, le volume actuel tenant largement dans `localStorage`. Laissé à un futur ADR (voir Suivi, 0028).

## Liens

[ADR 0002](0002-application-frontend-sans-backend.md) (tout reste local) · [ADR 0005](0005-persistance-localstorage-derriere-repository.md) (amendé) · [ADR 0006](0006-sauvegarde-partage-par-export-import-json.md) (export/import inchangés) · [ADR 0018](0018-strategie-sauvegarde-fichier.md) (amendé) · feature [0019](../../features/0019-sauvegarde-fiable-et-periodique.md) (fichier actif, session seule) · feature [0032](../../features/0032-fichier-sauvegarde-actif-persistant.md) (mise en œuvre) · feature 0028 (historique des versions, V2 : mutualisation prévue).
