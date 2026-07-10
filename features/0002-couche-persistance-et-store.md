# Feature 0002 — Couche persistance et store

- **Statut** : Fait
- **Dépend de** : `0001` (squelettes UI / store / domaine / stockage déjà en place)
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (sans backend), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS pur + JSDoc), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance LocalStorage derrière repository), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (export/import JSON), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates & jours ISO), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (domaine pur).

## 1. Contexte & objectif

À l'issue de la feature `0001`, l'application **démarre** mais son état est **vide et volatile** : les 6 modules Vuex sont des ossatures sans `state`, `src/domain/schema.js` est un placeholder, et `storageRepository` / `migrations` ne sont pas implémentés.

La feature `0002` rend l'état applicatif **réel, persisté et sérialisable**, **sans écran de saisie** (les CRUD par entité arrivent en `0003`-`0007`). Concrètement, après `0002` :

- L'application possède un **état par défaut** (cabinet par défaut, collections vides) au premier lancement.
- Toute modification de l'état est **persistée automatiquement** dans `localStorage` (via `storageRepository`, écriture **débouncée ~400 ms**), et **rechargée** au démarrage suivant.
- L'état est **sérialisable** vers/depuis le **SaveDocument** JSON canonique ([03](../docs/architecture/03-modele-de-donnees.md)), avec **garde de version**, **migration** (pipeline structuré, vide pour l'instant) et **vérification d'intégrité**.
- Les **briques d'export/import** (round-trip JSON) sont posées côté store (leur **UI** dédiée reste la feature `0008`).

En résumé, `0002` pose **l'ossature persistante** : `schema.js` (défauts + (dé)sérialisation + intégrité), `migrations`, `storageRepository`, le `state`/`REPLACE`/getters de base des modules, le **plugin de persistance** et le **module racine `app`** (`bootstrap`/`REPLACE_ALL`/`importer`/`exporter`/`reinitialiser`). Les **actions CRUD riches** de chaque entité sont **explicitement différées** aux features `0003`-`0007`.

## 2. Écrans concernés

**Aucun.** La feature `0002` ne crée ni ne modifie aucune route ni aucun écran ([07](../docs/architecture/07-navigation-et-ecrans.md)). Les 6 vues placeholder de `0001` (`AccueilView`, `EquipeView`, `TourneesView`, `AbsencesView`, `PlanningView`, `ParametresView`) restent **inchangées**.

L'état, la persistance et le round-trip export/import sont **observables uniquement** via la **console du navigateur** et/ou l'onglet Vuex des **Vue Devtools** (voir §11). Les écrans qui exposent réellement ces données à l'utilisateur non-technique viennent ensuite :

| Concerne | Écran qui l'exposera | Feature |
|---|---|---|
| Paramètres du cabinet | `ParametresView` | `0003` |
| Équipe (personnes) | `EquipeView` | `0004` |
| Tournées | `TourneesView` | `0006` |
| Absences | `AbsencesView` | `0007` |
| Export / import / rappel de sauvegarde | `ParametresView` | `0008` |

## 3. Modèle de données touché

`0002` **matérialise l'intégralité du SaveDocument** décrit dans [03-modele-de-donnees.md](../docs/architecture/03-modele-de-donnees.md), avec les entités de [02-modele-de-domaine.md](../docs/architecture/02-modele-de-domaine.md). Aucune entité n'est *saisie* dans cette feature, mais toutes sont **représentables, sérialisables et vérifiables**.

### 3.1 Structure racine du SaveDocument (rappel)

```jsonc
{
  "schemaVersion": 1,
  "meta": { "app": "Idelia", "appVersion": "1.0.0", "exportedAt": "<ISO UTC>", "generator": "idelia-web" },
  "cabinet":   { /* ParametresCabinet (singleton) */ },
  "personnes": [ /* Personne[] (preferences imbriquées) */ ],
  "tournees":  [ /* Tournee[] */ ],
  "absences":  [ /* Absence[] (à plat, avec personneId) */ ],
  "plannings": [ /* Planning[] (affectations imbriquées) */ ]
}
```

### 3.2 Enums / constantes du domaine (à poser dans `schema.js`)

Codes stables `MAJUSCULES_SNAKE` ([02 §Conventions](../docs/architecture/02-modele-de-domaine.md), [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)). Les **libellés affichés** ne sont **pas** dans le périmètre `0002` (ils viendront avec les écrans) — on n'expose ici que les **codes**.

| Constante | Valeurs |
|---|---|
| `CRENEAUX` | `MATIN`, `APRES_MIDI`, `JOURNEE` |
| `STATUTS_PERSONNE` | `TITULAIRE`, `REMPLACANT` |
| `NATURES_PREFERENCE` | `DURE`, `SOUPLE` |
| `TYPES_PREFERENCE` | `JOUR_OFF_RECURRENT`, `CRENEAU_OFF`, `MAX_JOURS_CONSECUTIFS`, `MIN_JOURS_CONSECUTIFS`, `JOURS_REPOS_SOUHAITES`, `NB_JOURS_SEMAINE`, `PREFERENCE_TOURNEE`, `INDISPO_HEBDO` |
| `TYPES_ABSENCE` | `CONGE_PAYE`, `RTT`, `ARRET_MALADIE`, `MATERNITE`, `PATERNITE`, `NAISSANCE`, `FORMATION`, `AUTRE` |
| `STATUTS_ABSENCE` | `DEMANDE`, `VALIDE`, `REFUSE` |
| `ORIGINES_AFFECTATION` | `AUTO`, `MANUEL` |
| `STATUTS_PLANNING` | `BROUILLON`, `VALIDE`, `PUBLIE` |
| `COULEURS_PAR_DEFAUT` | palette de suggestion, ex. `["#2E86AB", "#E4572E", "#5B8C5A", "#B5179E"]` |

> Ces enums sont posés **maintenant** parce qu'ils constituent le vocabulaire partagé de la (dé)sérialisation et de la vérification d'intégrité ; les features `0003`-`0007` s'y réfèreront sans les redéfinir.

### 3.3 Cabinet par défaut (`etatParDefaut()`)

Valeurs par défaut du singleton `ParametresCabinet` ([02](../docs/architecture/02-modele-de-domaine.md)) :

| champ | valeur par défaut |
|---|---|
| `nomCabinet` | `""` |
| `joursOuverture` | `[1, 2, 3, 4, 5, 6]` |
| `creneauxActifs` | `["MATIN", "APRES_MIDI"]` |
| `reposHebdoMin` | `2` |
| `maxJoursConsecutifs` | `6` |
| `premierJourSemaine` | `1` |
| `couleursParDefaut` | `COULEURS_PAR_DEFAUT` |
| `updatedAt` | horodatage ISO UTC courant |

Collections `personnes` / `tournees` / `absences` / `plannings` : **vides** (`[]`).

### 3.4 Version de schéma & migrations

- `schemaVersion` = **1** ; `CURRENT_SCHEMA_VERSION = 1` (**source unique** dans `src/storage/migrations.js`, [03 §Versionnement](../docs/architecture/03-modele-de-donnees.md)).
- **Aucune migration réelle** en `0002` (`MIGRATIONS = {}`), mais le pipeline `migrate(doc)` est **structuré** pour l'avenir (application séquentielle) et intègre la **garde de version future**.
- ⚠️ Le placeholder `0001` a laissé un **doublon** `CURRENT_SCHEMA_VERSION` dans `src/domain/schema.js` : il doit être **supprimé** (voir §12, tâche 1) pour éviter toute dérive de valeur.

## 4. Store (Vuex)

Voir [04-gestion-etat-vuex.md](../docs/architecture/04-gestion-etat-vuex.md) et [instructions/etat-vuex.md](../docs/instructions/etat-vuex.md).

### 4.1 Répartition périmètre `0002` vs features CRUD (`0003`-`0007`)

| Élément | `0002` (cette feature) | Différé (feature) |
|---|---|---|
| `state` réel de chaque module | ✅ | — |
| mutation `REPLACE` par module **persisté** | ✅ | — |
| getters **fondamentaux** (`byId`, `actifs`/`actives`, `parametres`, `parPersonne`, `courant`) | ✅ | — |
| mutation racine `REPLACE_ALL` + actions `app` (`bootstrap`/`importer`/`exporter`/`reinitialiser`) | ✅ | — |
| plugin de persistance débouncé | ✅ | — |
| **actions CRUD riches** (`ajouter`/`modifier`/`desactiver`/`archiver`, CRUD préférences/affectations, `changerStatut`, `generer`…) | ❌ | `0003`-`0007`, `0009`-`0011` |
| getters métier avancés (`applicablesLe`, `validesSur`, `enConflit`, `besoinsNonCouverts`, `conflits`, `parStatut`) | ❌ | `0006`, `0007`, `0009`-`0011` |

> **Règle de découpe** : `0002` pose **l'ossature + `REPLACE` + les getters de lecture de base** indispensables tôt. Tout ce qui *écrit* de la donnée métier (au-delà de l'hydratation `REPLACE`/`REPLACE_ALL`) appartient aux features dédiées.

### 4.2 State shape par module

| module | `state` initial (feature `0002`) | persisté ? |
|---|---|---|
| `cabinet` | `{ parametres: null }` (hydraté au `bootstrap`) | oui |
| `personnes` | `{ items: [] }` | oui |
| `tournees` | `{ items: [] }` | oui |
| `absences` | `{ items: [] }` | oui |
| `plannings` | `{ items: [], selectionId: null }` | oui (**`items` seulement**, voir §12) |
| `ui` | minimal (`{}` — enrichi par les features consommatrices) | **non** |

### 4.3 Mutations / getters de base par module

- **`cabinet`** — mutation `REPLACE(state, parametres)` → `state.parametres = parametres`. Getter `parametres: (state) => state.parametres`.
- **`personnes`** — mutation `REPLACE(state, items)` → `state.items = items`. Getters `byId: (state) => (id) => state.items.find(p => p.id === id)` ; `actifs: (state) => state.items.filter(p => p.actif)`.
- **`tournees`** — mutation `REPLACE(state, items)`. Getters `byId` ; `actives: (state) => state.items.filter(t => !t.archivee)`.
- **`absences`** — mutation `REPLACE(state, items)`. Getters `byId` ; `parPersonne: (state) => (personneId) => state.items.filter(a => a.personneId === personneId)`.
- **`plannings`** — mutation `REPLACE(state, { items, selectionId })` (ou `REPLACE(state, items)` avec `selectionId` remis à `null`). Getters `byId` ; `courant: (state, getters) => getters.byId(state.selectionId)`.
- **`ui`** — **aucune** mutation `REPLACE`, **non persisté**.

> Ne **jamais** accéder à `localStorage` depuis un module ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)). Les IDs se génèrent via `genId()` (les CRUD des features suivantes).

### 4.4 Module racine `app` (dans `src/store/index.js`)

**State racine** (statut de sauvegarde — sert au futur rappel « dernière sauvegarde le… » de [ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md)) :

```jsonc
{
  "derniereSauvegarde": null,          // ISO UTC de la dernière écriture réussie
  "statutSauvegarde": "INACTIF"        // INACTIF | EN_COURS | ENREGISTRE | ERREUR | ERREUR_CHARGEMENT
}
```

**Mutations racine** :

- `REPLACE_ALL(state, etatRacine)` — **hydratation atomique** : réaffecte en un seul commit les tranches des modules persistés (`state.cabinet.parametres`, `state.personnes.items`, `state.tournees.items`, `state.absences.items`, `state.plannings.items`, `state.plannings.selectionId`) à partir de la forme produite par `fromSaveDocument(doc)` ou `etatParDefaut()`. **N'inclut jamais `ui`.**
- `SET_STATUT_SAUVEGARDE(state, statut)` et `SET_DERNIERE_SAUVEGARDE(state, iso)` — mises à jour du statut ; **ignorées par le plugin de persistance** (voir §4.5) pour éviter toute boucle d'écriture.

> Choix : `REPLACE_ALL` est une **mutation racine** (atomicité : un commit ⇒ une seule notification `store.subscribe` ⇒ une seule écriture débouncée). Les mutations `REPLACE` par module restent définies ([04](../docs/architecture/04-gestion-etat-vuex.md), [instructions/etat-vuex.md](../docs/instructions/etat-vuex.md)) pour l'hydratation ciblée et les tests. Écart de formulation avec le doc 04 signalé en §12.

**Actions racine** (orchestration uniquement — la logique pure vit dans `schema.js`/`migrations.js`) :

- `bootstrap({ commit })` :
  1. `doc = await storageRepository.load()`.
  2. Si `doc` : `doc = migrate(doc)` (garde de version + pipeline) → `{ ok, erreurs } = verifierIntegrite(doc)` → si `ok`, `commit('REPLACE_ALL', fromSaveDocument(doc))`, sinon **repli** état par défaut + `statutSauvegarde = ERREUR_CHARGEMENT` + `console.error(erreurs)`.
  3. Si `doc === null` (premier lancement) : `commit('REPLACE_ALL', etatParDefaut())`.
  4. Toute exception (JSON corrompu, version future, quota) est **capturée** : log + repli `etatParDefaut()` + `statutSauvegarde = ERREUR_CHARGEMENT`. `bootstrap` **ne rejette jamais** (l'app doit toujours démarrer).
- `importer({ commit }, fichierOuTexte)` :
  1. Lire le texte (`File.text()` si `File`, sinon la chaîne telle quelle) → `JSON.parse`.
  2. `migrate(doc)` (⇒ **refuse** un `schemaVersion` supérieur à `CURRENT_SCHEMA_VERSION` avec un message FR clair).
  3. `verifierIntegrite(doc)` → si `!ok`, **rejeter** avec la liste d'erreurs (pas de `REPLACE_ALL`).
  4. `commit('REPLACE_ALL', fromSaveDocument(doc))` puis **flush immédiat** de la persistance (écriture directe, hors debounce) + `SET_DERNIERE_SAUVEGARDE`.
  5. Renvoie un résultat exploitable par la future UI `0008` (succès / message d'erreur FR).
- `exporter({ state })` : `doc = toSaveDocument(state, { schemaVersion: CURRENT_SCHEMA_VERSION })` → `JSON.stringify(doc, null, 2)` → `Blob` (`application/json`) → téléchargement via un `<a download>` (nom `idelia-sauvegarde-YYYY-MM-DD.json`, date via `dateUtil.format(new Date())`) → révoquer l'URL objet.
- `reinitialiser({ commit })` : `commit('REPLACE_ALL', etatParDefaut())` puis `await storageRepository.clear()`. **La confirmation utilisateur est une responsabilité UI** (feature `0003`/`0008`) : ne **pas** mettre de `window.confirm` dans le store (voir §12).

### 4.5 Plugin de persistance (dans `src/store/index.js`)

- Branché via `store.subscribe((mutation, state) => …)` **une seule fois**.
- **Filtrage** : ignore toute mutation dont le `type` commence par `ui/` **et** les mutations de statut (`SET_STATUT_SAUVEGARDE`, `SET_DERNIERE_SAUVEGARDE`) — sinon boucle d'écriture infinie.
- Pour toute autre mutation : planifie une écriture **débouncée ~400 ms** : `storageRepository.save(toSaveDocument(state, { schemaVersion: CURRENT_SCHEMA_VERSION }))`. Sur succès → `commit('SET_DERNIERE_SAUVEGARDE', <ISO>)` + `SET_STATUT_SAUVEGARDE('ENREGISTRE')` ; sur échec → `SET_STATUT_SAUVEGARDE('ERREUR')` + `console.error`.
- **Débounce maison** (petit `setTimeout`/`clearTimeout`, aucune dépendance ; cohérent avec `vue-debounce` côté formulaires). Le contrôleur de débounce est un `const` de module partagé entre le plugin et l'action `importer` (qui appelle un **flush immédiat**).
- **Interdit** : `vuex-persistedstate` ; tout accès direct à `localStorage` ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)). L'écriture passe **exclusivement** par `storageRepository.save`.

## 5. Domaine (logique pure)

Tout est dans `src/domain/` — **aucun import Vue/Vuex** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)).

### 5.1 `src/domain/schema.js` (cœur de la feature)

Fonctions **pures** (frontière unique de (dé)sérialisation — [03 §Sérialisation](../docs/architecture/03-modele-de-donnees.md)) :

| Fonction | Signature | Rôle |
|---|---|---|
| `etatParDefaut()` | `() → EtatRacine` | Retourne la forme racine (`{ cabinet: { parametres }, personnes: { items: [] }, … }`) avec **cabinet par défaut** (§3.3) et collections vides. `updatedAt` via horodatage ISO UTC. |
| `toSaveDocument(rootState, options)` | `(rootState, { schemaVersion, exportedAt? }) → SaveDocument` | Assemble le document canonique : `schemaVersion` (fourni par l'appelant), `meta` (`app`, `appVersion`, `exportedAt` = `options.exportedAt` ?? ISO UTC courant, `generator`), puis `cabinet` = `rootState.cabinet.parametres`, `personnes` = `rootState.personnes.items`, etc. **Ne sérialise pas** `ui` ni `plannings.selectionId`. |
| `fromSaveDocument(doc)` | `(doc) → EtatRacine` | Reconstruit la forme racine attendue par `REPLACE_ALL` à partir d'un doc **déjà migré et vérifié** : `{ cabinet: { parametres: doc.cabinet }, personnes: { items: doc.personnes ?? [] }, …, plannings: { items: doc.plannings ?? [], selectionId: null } }`. |
| `verifierIntegrite(doc)` | `(doc) → { ok: boolean, erreurs: string[] }` | Contrôle **structure** (types racine, tableaux présents) + **intégrité référentielle** : chaque `absence.personneId`, `affectation.personneId`, `affectation.tourneeId`, `planning.referentId` (si non nul) résout vers une entité existante. Messages **FR** explicites. Ne lève pas ; renvoie le verdict. |

**Injection de la version** : `toSaveDocument` **ne connaît pas** `CURRENT_SCHEMA_VERSION` (qui vit dans la couche `storage/`) → l'appelant (plugin/actions) la passe en paramètre. Cela garde `schema.js` **sans dépendance à `storage/`** et **pur/testable** (voir §12).

**Réutilisation** : horodatages via l'objet `Date` **uniquement** au travers de `new Date().toISOString()` pour les champs techniques ISO UTC (autorisé par [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)) ; les dates calendaires restent des chaînes. `dateUtil` (`src/domain/utils/dates.js`, fait en `0001`) est réutilisé pour tout calcul de date ; `genId()` (`src/domain/utils/id.js`) servira aux CRUD ultérieurs.

### 5.2 `src/storage/migrations.js` (couche stockage, pas domaine, mais logique pure)

- `CURRENT_SCHEMA_VERSION = 1` — **source unique** de la version.
- `MIGRATIONS = {}` — table `{ n: (doc) → doc }` (vide en `0002`, prête à recevoir `1: v1→v2`…).
- `migrate(doc)` :
  1. **Garde de version future** : si `doc.schemaVersion > CURRENT_SCHEMA_VERSION` → **throw** message FR (« sauvegarde créée par une version plus récente d'Idelia… »).
  2. Applique **séquentiellement** `MIGRATIONS[v]` de `doc.schemaVersion` jusqu'à `CURRENT_SCHEMA_VERSION` (aucune itération en `0002`).
  3. Retourne le doc avec `schemaVersion = CURRENT_SCHEMA_VERSION`.
- Appelée **à la fois** par `storageRepository.load()` (via l'action `bootstrap`) et par l'action `importer` ([03 §Règles d'import](../docs/architecture/03-modele-de-donnees.md)).

### 5.3 `src/storage/storageRepository.js` (implémentation réelle LocalStorage)

Interface **asynchrone** conservée ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)), clé unique **`"idelia:data"`**. Aucun autre accès `localStorage` dans l'app.

| Méthode | Comportement |
|---|---|
| `load()` | Lit `localStorage.getItem("idelia:data")` → `null` si absent → `JSON.parse` sinon. Sur JSON **corrompu** : sauvegarde défensive du brut sous `"idelia:data.corrompu"` (une fois) puis **throw** (capté par `bootstrap`). |
| `save(doc)` | `localStorage.setItem("idelia:data", JSON.stringify(doc))`. Capture les erreurs de **quota** → throw message explicite. |
| `clear()` | `localStorage.removeItem("idelia:data")`. |
| `isAvailable()` | Test réel écriture/lecture/suppression d'une clé sonde, `try/catch` (gère navigation privée / quota 0). |

## 6. Composants

**Aucun composant Vue** créé ou modifié en `0002`. La feature est purement **infrastructure** (état / domaine / stockage).

> Le seul « point d'entrée » utile aux tests manuels (§11) est l'exposition **temporaire et jetable** de `store` sur `window` en mode dev — ce n'est **pas** un composant et ne doit **pas** être livré (voir §11 et §12).

## 7. Règles de validation

Pas de **formulaire** ni de **Vuelidate** en `0002` (les règles de saisie — prénom requis, `heureFin > heureDebut`, `dateFin ≥ dateDebut`, quotité 0-100… — arrivent avec les écrans, features `0003`-`0007`, cf. [instructions/formulaires-validation.md](../docs/instructions/formulaires-validation.md)).

En revanche, `0002` introduit deux niveaux de **contrôle de données** (logique pure, pas de la validation de formulaire) :

1. **Garde de version** (`migrate`) : refus d'un `schemaVersion` supérieur à `CURRENT_SCHEMA_VERSION` avec message FR.
2. **Intégrité** (`verifierIntegrite`) — vérifie et signale en FR :
   - structure racine : `schemaVersion` entier, `cabinet` objet, `personnes`/`tournees`/`absences`/`plannings` tableaux ;
   - intégrité référentielle : `absence.personneId`, `affectation.personneId`, `affectation.tourneeId`, `planning.referentId` (non nul) doivent **résoudre** ; sinon on signale l'orphelin et l'import **bloque** ([02 §Intégrité](../docs/architecture/02-modele-de-domaine.md), [03 §Intégrité référentielle](../docs/architecture/03-modele-de-donnees.md)).

## 8. Points d'attention ergonomie

Peu d'UI directe, mais des **fondations ergonomiques** ([08](../docs/architecture/08-principes-ux-ergonomie.md)) posées pour les features suivantes :

- **Filet de sécurité** : `derniereSauvegarde` / `statutSauvegarde` alimentent le futur rappel « **dernière sauvegarde le…** » ([ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md)) — nommage et sémantique à choisir dès maintenant pour ne pas casser `0008`.
- **Zéro perte de données** : hydratation **atomique** (`REPLACE_ALL`), repli sur l'état par défaut plutôt que crash, **sauvegarde défensive** du contenu corrompu (`idelia:data.corrompu`) avant tout écrasement.
- **Messages en français, orientés action** dès la couche domaine (garde de version, erreurs d'intégrité, erreur de quota) : ils seront **affichés tels quels** par l'UI d'import de `0008`. Éviter le jargon technique.
- **Valeurs par défaut raisonnables** du cabinet (jours d'ouverture, créneaux, repos) → l'utilisateur démarre sur une base cohérente sans rien saisir.

## 9. Étapes d'implémentation

Découpage en **5 tâches**, chacune destinée à **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre de dépendances : **T1 & T2 en parallèle**, puis **T3**, puis **T4**, puis **T5**. Chaque tâche liste ses fichiers et ses critères de sortie.

### Tâche 1 — Domaine : `schema.js` (défauts, (dé)sérialisation, intégrité)
**Fichiers** : `src/domain/schema.js` (modifier — remplacer le placeholder).
**Contenu** :
- Enums/constantes (§3.2) exportés.
- `etatParDefaut()` (§3.3), `toSaveDocument(rootState, options)`, `fromSaveDocument(doc)`, `verifierIntegrite(doc)` (§5.1) — **purs**, JSDoc `@param`/`@returns`.
- **Supprimer** la déclaration `CURRENT_SCHEMA_VERSION` du placeholder (la source unique passe en `migrations.js`).
**Sortie vérifiable** : `fromSaveDocument(toSaveDocument(etatParDefaut(), { schemaVersion: 1 }))` restitue une forme racine équivalente (round-trip) ; `verifierIntegrite` détecte un `personneId` orphelin.

### Tâche 2 — Stockage : `migrations.js` + `storageRepository.js`
**Fichiers** : `src/storage/migrations.js` (modifier), `src/storage/storageRepository.js` (modifier).
**Contenu** :
- `migrations.js` : `CURRENT_SCHEMA_VERSION` (source unique), `MIGRATIONS = {}`, `migrate(doc)` avec **garde de version future** + pipeline séquentiel (§5.2).
- `storageRepository.js` : implémentation **réelle LocalStorage** (clé `"idelia:data"`) de `load`/`save`/`clear`/`isAvailable`, gestion corruption + quota (§5.3). Interface async conservée.
**Sortie vérifiable** : `save` puis `load` restituent le même objet ; `migrate({ schemaVersion: 999 })` lève ; `load` sur JSON corrompu range le brut sous `idelia:data.corrompu` et lève.

### Tâche 3 — Modules Vuex : state, `REPLACE`, getters de base
**Fichiers** : `src/store/modules/{cabinet,personnes,tournees,absences,plannings,ui}.js` (modifier les 6).
**Contenu** : state shape (§4.2), mutation `REPLACE` par module **persisté**, getters de base (§4.3). `ui` : state minimal, **pas** de `REPLACE`, non persisté. Aucune action CRUD (différée).
**Sortie vérifiable** : `store.commit('personnes/REPLACE', [ … ])` remplit `state.personnes.items` ; `store.getters['personnes/actifs']` filtre bien.

### Tâche 4 — Store racine : module `app` + plugin de persistance
**Fichiers** : `src/store/index.js` (modifier).
**Contenu** :
- State racine (`derniereSauvegarde`, `statutSauvegarde`), mutations `REPLACE_ALL` / `SET_STATUT_SAUVEGARDE` / `SET_DERNIERE_SAUVEGARDE` (§4.4).
- Actions `bootstrap` / `importer` / `exporter` / `reinitialiser` (§4.4), orchestration uniquement (import de `schema.js`, `migrations.js`, `storageRepository`).
- Plugin de persistance débouncé (~400 ms) branché sur `store.subscribe`, filtrage `ui/*` + mutations de statut, flush immédiat partagé avec `importer` (§4.5). **Pas** de `vuex-persistedstate`.
**Sortie vérifiable** : une mutation persistée déclenche **une** écriture après ~400 ms ; `dispatch('exporter')` télécharge un JSON valide ; `dispatch('importer', texte)` remplace l'état et flush.

### Tâche 5 — Démarrage : `main.js` (`bootstrap`) + vérification manuelle
**Fichiers** : `src/main.js` (modifier).
**Contenu** :
- Déclencher `store.dispatch('bootstrap')` **avant le montage** (séquence `async` : `await bootstrap` puis `.mount('#app')`, avec `try/catch` montant quand même sur échec).
- Ne **pas** importer le JS Bootstrap ni `vuex-persistedstate`.
- (Optionnel, dev-only, **jetable**) exposer `window.store = store` sous garde `import.meta.env.DEV` pour la vérification console (§11) — **à retirer** avant fin de feature ou à laisser uniquement derrière la garde DEV selon la décision §12.
**Sortie vérifiable** : au chargement, `store.state.cabinet.parametres` contient le cabinet par défaut au premier lancement, ou les données persistées ensuite.

## 10. Critères d'acceptation

- [ ] `src/domain/schema.js` exporte les **enums/constantes** (§3.2), `etatParDefaut()`, `toSaveDocument()`, `fromSaveDocument()`, `verifierIntegrite()` ; ces fonctions sont **pures** (aucun import Vue/Vuex, aucun accès `localStorage`).
- [ ] `CURRENT_SCHEMA_VERSION` n'est déclaré **qu'une seule fois**, dans `src/storage/migrations.js` (plus de doublon dans `schema.js`).
- [ ] `migrate(doc)` **refuse** (throw, message FR) un `schemaVersion` supérieur à `CURRENT_SCHEMA_VERSION` et retourne le doc inchangé sinon (pipeline vide).
- [ ] `storageRepository` lit/écrit **uniquement** la clé `"idelia:data"` ; **aucun** autre accès direct à `localStorage` dans tout `src/`.
- [ ] Les 6 modules ont leur **state shape** (§4.2) ; chaque module **persisté** expose `REPLACE` ; `ui` n'a pas de `REPLACE` et n'est pas persisté.
- [ ] Le store racine expose `REPLACE_ALL` et les actions `bootstrap` / `importer` / `exporter` / `reinitialiser`.
- [ ] Le **plugin de persistance** écrit via `storageRepository.save` **débouncé ~400 ms**, **ne persiste pas** les mutations `ui/*` ni les mutations de statut, et **n'utilise pas** `vuex-persistedstate`.
- [ ] Au **premier lancement** (localStorage vide), l'app démarre sur l'**état par défaut** (cabinet par défaut, collections vides).
- [ ] Après une modification d'état, **recharger la page** restitue l'état (persistance effective).
- [ ] Un **round-trip export → import** restitue un état équivalent ; l'import d'un fichier au `schemaVersion` **trop récent** est **refusé** avec message FR ; l'import d'un doc **incohérent** (orphelin) est **bloqué** par `verifierIntegrite`.
- [ ] `npm run build` **réussit** sans erreur.

## 11. Vérification

Sans écran de saisie, la vérification se fait **à la console** (et/ou Vue Devtools → onglet Vuex). Pour dispatcher des actions depuis la console, exposer **temporairement** le store : ajouter sous garde dev `window.store = store` dans `main.js` (**jetable**, cf. §5/T5), ou utiliser les Vue Devtools.

1. **Premier lancement (état par défaut)**
   - Console : `localStorage.clear()` puis **recharger**.
   - `store.state.cabinet.parametres` → cabinet par défaut (`joursOuverture` = `[1,2,3,4,5,6]`, `creneauxActifs` = `["MATIN","APRES_MIDI"]`, `reposHebdoMin` 2, `maxJoursConsecutifs` 6). Collections vides.
   - `localStorage.getItem('idelia:data')` → présent (le `bootstrap` a persisté l'état par défaut).

2. **Persistance d'une modification (cabinet)**
   - `store.commit('cabinet/REPLACE', { ...store.state.cabinet.parametres, nomCabinet: 'Cabinet des Tilleuls' })`.
   - Attendre ~0,5 s → `JSON.parse(localStorage.getItem('idelia:data')).cabinet.nomCabinet` = `"Cabinet des Tilleuls"`.
   - `store.state.statutSauvegarde` = `"ENREGISTRE"` ; `store.state.derniereSauvegarde` renseigné.
   - **Recharger** la page → `store.state.cabinet.parametres.nomCabinet` = `"Cabinet des Tilleuls"` (rechargé depuis le stockage).

3. **Persistance d'une collection (personne factice via `REPLACE`)**
   - `store.commit('personnes/REPLACE', [{ id: 'p-test', prenom: 'Test', nom: 'Démo', statut: 'TITULAIRE', actif: true, couleur: '#2E86AB', quotite: 100, preferences: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }])`.
   - `store.getters['personnes/byId']('p-test')` et `store.getters['personnes/actifs']` renvoient la personne.
   - Recharger → la personne est toujours là.

4. **Round-trip export → import**
   - `store.dispatch('exporter')` → un fichier `idelia-sauvegarde-YYYY-MM-DD.json` se télécharge ; l'ouvrir et vérifier la structure racine (`schemaVersion`, `meta`, `cabinet`, `personnes`…).
   - Modifier l'état (ex. changer `nomCabinet`), puis `await store.dispatch('importer', <texte du fichier exporté>)` → l'état revient à celui du fichier ; le stockage est **flushé** immédiatement.

5. **Garde de version future**
   - `await store.dispatch('importer', JSON.stringify({ schemaVersion: 999, meta:{}, cabinet:{}, personnes:[], tournees:[], absences:[], plannings:[] }))` → **rejet** avec message FR ; l'état courant **inchangé**.

6. **Intégrité (orphelin)**
   - Importer un doc avec une `absence` dont `personneId` n'existe pas → `verifierIntegrite` signale l'orphelin, l'import est **bloqué** (pas de `REPLACE_ALL`), l'état reste inchangé.

7. **Repli sur corruption**
   - `localStorage.setItem('idelia:data', '{ ceci n'est pas du JSON')` puis recharger → l'app démarre sur l'**état par défaut**, `statutSauvegarde` = `ERREUR_CHARGEMENT`, et `localStorage.getItem('idelia:data.corrompu')` contient le brut sauvegardé.

8. **Build** : `npm run build` réussit ; retirer l'exposition `window.store` si elle n'est pas gardée par `import.meta.env.DEV`.

> Ne créer **aucun** écran de test permanent (KISS). Tout point d'entrée console est **jetable** et retiré (ou gardé dev-only) en fin de feature.

## 12. Décisions à confirmer / risques

1. **`REPLACE_ALL` mutation vs action** — Choisi : **mutation racine** (atomicité, une seule écriture débouncée). Le doc [04](../docs/architecture/04-gestion-etat-vuex.md) écrit « `REPLACE_ALL` appelle le `REPLACE` de chaque module » (formulation qui suggère une action). Les mutations `REPLACE` par module restent définies conformément au doc, mais `REPLACE_ALL` réaffecte directement les tranches d'état (une mutation ne peut pas `commit`). **À confirmer** : accepter cette précision ou aligner le doc 04.
2. **`CURRENT_SCHEMA_VERSION` — source unique dans `migrations.js`** (conforme doc 03 & à la demande). Conséquence : `toSaveDocument` **reçoit** `schemaVersion` en paramètre (injection par l'appelant) pour éviter une dépendance `domain → storage` et rester pur. **À confirmer** : cette injection plutôt qu'un import direct de la constante dans `schema.js`.
3. **`plannings.selectionId` non persisté** — traité comme une **sélection volatile** : `toSaveDocument` ne sérialise que `plannings.items` (conforme au SaveDocument du doc 03), et `fromSaveDocument` remet `selectionId` à `null`. **À confirmer** si l'on souhaite persister la sélection courante.
4. **Boucle d'écriture du plugin** — risque réel : le plugin commit `SET_DERNIERE_SAUVEGARDE`/`SET_STATUT_SAUVEGARDE` après chaque save ; ces mutations **doivent** être exclues du filtrage sous peine de boucle infinie. Vérifier le filtrage (`ui/*` + statuts) avec soin.
5. **Écrasement de données corrompues au repli** — après un `bootstrap` en repli (`etatParDefaut`), le plugin pourrait persister par-dessus des données récupérables. Mitigation retenue : **sauvegarde défensive** du brut sous `idelia:data.corrompu` avant tout écrasement. **À confirmer** : suffisant, ou faut-il aussi suspendre la persistance après un repli tant qu'aucune action utilisateur n'a eu lieu ?
6. **Confirmation de `reinitialiser`** — laissée à l'**UI** (features `0003`/`0008`) pour garder le store sans dépendance UI (`window.confirm`). **À confirmer**.
7. **Multi-onglets** — `localStorage` en *last-write-wins* ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)) : hors périmètre `0002`, risque assumé.
8. **`window.store` de test** — jetable ; décider s'il reste **derrière `import.meta.env.DEV`** (confort de debug) ou est **entièrement retiré** en fin de feature.
