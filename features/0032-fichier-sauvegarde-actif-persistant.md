# Feature 0032 — Fichier de sauvegarde actif persistant

- **Statut** : Terminé
- **Dépend de** : `0019` (fichier de sauvegarde actif, File System Access API : handle en variable de module `handleFichierSauvegarde`, actions racines `activerSauvegardeFichier` / `ecrireSauvegardeFichier` / `desactiverSauvegardeFichier` / `declencherSauvegardeAutomatique`, reflets `ui.fichierSauvegardeActif` / `nomFichierSauvegarde` / `dernierFichierEnregistreLe`, composant `BlocSauvegardeAutomatique.vue`). Transitivement : `0002` (`storageRepository`, `bootstrap`, plugin de persistance), `0008` (`importer` / `reinitialiser`, `BlocSauvegarde.vue`), `0013` (`CarteSauvegarde.vue`, `AccueilView.vue`), `0015` (`App.vue`, `MenuLateral`), `0018` (toasts `notifications/notifier`).
- **ADR liés** : **[0021](../docs/adr/0021-indexeddb-handle-fichier-sauvegarde.md) (rédigé pour cette feature : IndexedDB limitée au handle)**, [0018](../docs/adr/0018-strategie-sauvegarde-fichier.md) et [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (tous deux amendés par 0021), [0002](../docs/adr/0002-application-frontend-sans-backend.md) (rien ne sort du poste), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (`SaveDocument` inchangé), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (horodatages ISO UTC), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (Bootstrap : alerte, modale).

## 1. Contexte & objectif

Depuis `0019`, sur Chrome/Edge, l'utilisateur peut choisir un **fichier de sauvegarde actif** : Idelia y réécrit sans dialogue, à la demande et automatiquement. Mais le `FileSystemFileHandle` vit seulement en mémoire (`src/store/index.js`, variable de module, hors `state` car non sérialisable). Il est **perdu à chaque rechargement**. L'utilisateur doit rechoisir son fichier à chaque ouverture d'Idelia, et s'il oublie, la sauvegarde automatique se réduit à un rappel. C'est la gêne prévue en suivi par l'ADR 0018.

**Objectif** : se souvenir du fichier **entre les sessions**, en mémorisant le handle dans IndexedDB ([ADR 0021](../docs/adr/0021-indexeddb-handle-fichier-sauvegarde.md)).

- **Reprise silencieuse** quand le navigateur autorise encore l'écriture (en principe après un simple rechargement).
- Sinon, **un seul clic** sur « Reprendre la sauvegarde dans « … » ». Le navigateur exige ce geste : la transparence totale n'est pas garantie, et l'écran le dit honnêtement.
- Si le fichier a été **déplacé, renommé ou supprimé**, une **fenêtre d'avertissement** s'affiche au démarrage : choisir un nouveau fichier (Idelia y sauvegarde tout de suite) ou continuer sans fichier.
- **Chrome/Edge uniquement**. Ailleurs, le repli « rappel » de `0019` reste **inchangé**.

**Hors périmètre** :

- Restaurer **directement** depuis le fichier mémorisé quand les données du navigateur ont disparu. C'est une évolution possible (§12 #6) ; ici on se contente de **ne pas écraser** ce fichier.
- Synchroniser plusieurs onglets entre eux (BroadcastChannel, verrous). On limite seulement les écritures périmées (§4.3).
- Historique des versions (`0028`, V2). La brique IndexedDB est conçue pour être réutilisée (ADR 0021, Suivi).

## 2. Écrans concernés

Aucune nouvelle route ([architecture 07](../docs/architecture/07-navigation-et-ecrans.md)).

| Où | Changement `0032` |
|---|---|
| **Coquille `App.vue`** (tous les écrans) | Nouveau **bandeau de reprise** en haut du contenu, quand le fichier mémorisé attend l'accord du navigateur. Nouvelle **fenêtre d'avertissement** « Fichier de sauvegarde introuvable ». |
| `/parametres`, section « Sauvegarde automatique » (`BlocSauvegardeAutomatique.vue`) | Nouvel état « fichier mémorisé, en attente de votre accord ». Le texte « valable pour cette session » est remplacé par « Idelia s'en souviendra ». « Désactiver » devient « Ne plus utiliser ce fichier ». |
| `/parametres`, section « Sauvegarde » (`BlocSauvegarde.vue`) | Le message de confirmation de « Restaurer une sauvegarde » précise que le fichier actif sera ensuite mis à jour. |
| `/` Accueil (`CarteSauvegarde.vue`) | Le rappel dit la vérité quand un fichier est actif (« Fichier de sauvegarde à jour le … »), et le bouton écrit dans ce fichier au lieu de télécharger. |

**Expérience visée** (personne peu à l'aise avec l'informatique) :

1. **Elle a choisi son fichier une fois** dans Paramètres. Elle ferme Idelia le soir.
2. **Le lendemain**, deux cas :
   - le navigateur autorise encore l'écriture : **rien à faire**, la sauvegarde continue ;
   - sinon, un bandeau discret s'affiche en haut de l'écran : « Idelia peut continuer à enregistrer vos sauvegardes dans votre fichier « idelia-sauvegarde.json ». Votre navigateur demande simplement votre accord. » Un bouton **« Reprendre la sauvegarde dans « idelia-sauvegarde.json » »** ouvre la demande du navigateur, et la personne clique « Autoriser ». C'est fini. Un bouton « Plus tard » masque le bandeau jusqu'à la prochaine ouverture ; la reprise reste possible depuis Paramètres.
3. **Si le fichier a été déplacé ou supprimé**, une fenêtre explique sans jargon que le fichier est introuvable et que **les données ne sont pas perdues** (elles sont dans le navigateur). Deux boutons : « Choisir un nouveau fichier » ou « Continuer sans fichier ».

## 3. Modèle de données touché

**Aucune entité métier, aucun champ du `SaveDocument`, aucune migration** (`schemaVersion` inchangé). Le fichier exporté et importé ne contient jamais le handle.

**Nouvelle donnée persistée hors `SaveDocument`**, dans IndexedDB ([ADR 0021](../docs/adr/0021-indexeddb-handle-fichier-sauvegarde.md)) :

| Base | Version | Magasin | Clé | Valeur |
|---|---|---|---|---|
| `idelia` | 1 | `cles-valeurs` (clés hors ligne, sans index) | `fichier-sauvegarde-actif` | le `FileSystemFileHandle` lui-même (clonage structuré) |

Rien d'autre n'est stocké : le nom s'obtient par `handle.name` ; la date de dernière écriture, par `(await handle.getFile()).lastModified`.

## 4. Store (Vuex)

### 4.1 Module `ui` (`src/store/modules/ui.js`, **modifier**) : nouveaux reflets volatils

Ajouter à `etatInitial()` (donc remis à zéro par `REINITIALISER` lors de « Effacer toutes les données ») :

| État | Type | Rôle |
|---|---|---|
| `fichierSauvegardeMemorise` | `boolean` (défaut `false`) | `true` si le fichier actif a bien été mémorisé dans IndexedDB : pilote le texte honnête « Idelia s'en souviendra » (§6.4). |
| `fichierEnAttenteAccord` | `string \| null` | Nom du fichier mémorisé dont la permission est `'prompt'`/`'denied'` : pilote le bandeau et l'état « en attente » de Paramètres. |
| `bandeauRepriseMasque` | `boolean` (défaut `false`) | « Plus tard » cliqué ou demande du navigateur refusée : le bandeau se masque pour la session. |
| `fichierSauvegardeIntrouvable` | `string \| null` | Nom du fichier introuvable : pilote la fenêtre d'avertissement. |

Mutations : `SET_FICHIER_SAUVEGARDE_MEMORISE(bool)`, `SET_FICHIER_EN_ATTENTE_ACCORD(nom|null)`, `SET_BANDEAU_REPRISE_MASQUE(bool)`, `SET_FICHIER_SAUVEGARDE_INTROUVABLE(nom|null)`.

Actions (appelées par les composants, jamais de `commit` dans un composant) :

- `masquerBandeauReprise()` → `SET_BANDEAU_REPRISE_MASQUE(true)` ;
- `acquitterFichierIntrouvable()` → `SET_FICHIER_SAUVEGARDE_INTROUVABLE(null)`.

Mettre à jour le JSDoc d'en-tête du module : le paragraphe « volatils, jamais persistés… le handle ne survit pas à la session » devient « le handle est mémorisé dans IndexedDB par `storageRepository` (ADR 0021) ; ces reflets restent volatils ».

Ces mutations `ui/*` sont déjà ignorées par le plugin de persistance (aucune boucle).

### 4.2 Actions racines (`src/store/index.js`, **modifier**)

**Variables de module** (à côté de `timer` et `handleFichierSauvegarde`, jamais dans `state`) :

```js
/** Handle mémorisé dont la permission n'est pas (encore) accordée : attend le clic « Reprendre… ». */
let handleEnAttenteAccord = null;

/**
 * `true` si des données ont changé dans CET onglet depuis la dernière écriture
 * réussie du fichier actif. Le minuteur automatique n'écrit que dans ce cas
 * (protection multi-onglets, §4.3). Le bouton manuel écrit toujours.
 */
let modifieDepuisEcritureFichier = false;
```

**Fonctions internes** (non exposées comme actions) :

- `libererFichierEnMemoire(commit)` : `handleFichierSauvegarde = null`, `handleEnAttenteAccord = null`, puis `ui/SET_FICHIER_SAUVEGARDE_ACTIF({ actif: false, nom: null })`, `ui/SET_FICHIER_SAUVEGARDE_MEMORISE(false)` et `ui/SET_FICHIER_EN_ATTENTE_ACCORD(null)`. Elle n'agit pas sur IndexedDB.
- `brancherFichierMemorise(commit, handle)` : vérifie l'existence avec `const fichier = await handle.getFile()`.
  - Succès : `handleFichierSauvegarde = handle`, `handleEnAttenteAccord = null` ; `modifieDepuisEcritureFichier` n'est **pas** forcé (audit sécurité M1 : un fichier plus récent, synchronisé depuis un autre poste, n'est réécrit qu'après une vraie modification locale). Commits : `SET_FICHIER_EN_ATTENTE_ACCORD(null)`, `SET_FICHIER_SAUVEGARDE_ACTIF({ actif: true, nom: handle.name })`, `SET_FICHIER_SAUVEGARDE_MEMORISE(true)`, `SET_DERNIER_FICHIER_ENREGISTRE(new Date(fichier.lastModified).toISOString())` (date réelle du fichier sur le disque, honnête). Renvoie `{ ok: true }`.
  - Échec, **quelle que soit l'exception** (`NotFoundError` si le fichier est déplacé, renommé ou supprimé, `NotAllowedError`…) : `console.error`, puis `await signalerFichierIntrouvable(commit, handle.name)`. Renvoie `{ ok: false, introuvable: true }`.
- `signalerFichierIntrouvable(commit, nom)` : `libererFichierEnMemoire(commit)`, `await storageRepository.oublierHandleFichierSauvegarde()`, puis `ui/SET_FICHIER_SAUVEGARDE_INTROUVABLE(nom)`. La fenêtre d'avertissement s'ouvre alors (§6.2). Le handle mort est oublié dès la détection : la fenêtre ne réapparaîtra pas aux ouvertures suivantes.

**`bootstrap`** (**modifier**) : renvoie désormais le résultat du chargement, un `ResultatChargement` à documenter en `@typedef` : `'DONNEES' | 'VIDE' | 'ERREUR'`.

- `'VIDE'` : `load()` a renvoyé `null` ;
- `'DONNEES'` : document chargé et valide ;
- `'ERREUR'` : la branche `catch` existante.

Aucun autre changement de comportement.

**`reprendreSauvegardeFichier({ commit, dispatch }, { chargement })`** (**nouvelle**, appelée au démarrage par `main.js`, sans geste utilisateur, ne rejette jamais) :

```js
if (!('showSaveFilePicker' in window)) return;           // Firefox/Safari : on n'ouvre même pas IndexedDB
const handle = await storageRepository.lireHandleFichierSauvegarde();
if (!handle) return;
if (chargement !== 'DONNEES') {
  // Garde-fou ADR 0021 §5 : ne jamais écraser une bonne sauvegarde par un état vide.
  await storageRepository.oublierHandleFichierSauvegarde();
  dispatch('notifications/notifier', { type: 'avertissement', duree: 0, message: MESSAGE_DONNEES_ABSENTES(handle.name) }, { root: true });
  return;
}
let permission;
try { permission = await handle.queryPermission({ mode: 'readwrite' }); } catch { permission = 'prompt'; }
if (permission === 'granted') { await brancherFichierMemorise(commit, handle); return; }
handleEnAttenteAccord = handle;                         // 'prompt' ou 'denied' : un clic sera nécessaire
commit('ui/SET_FICHIER_EN_ATTENTE_ACCORD', handle.name, { root: true });
```

Message `MESSAGE_DONNEES_ABSENTES` (toast persistant, fermeture manuelle) : « Vos données n'ont pas été retrouvées dans ce navigateur. Par prudence, Idelia n'écrira plus dans votre fichier de sauvegarde « {nom} », qui reste intact : pour récupérer vos données, utilisez « Restaurer une sauvegarde » dans Paramètres. »

**`confirmerRepriseSauvegardeFichier({ commit, dispatch })`** (**nouvelle**, appelée **uniquement depuis un clic** : bandeau ou Paramètres). Elle émet elle-même ses toasts, pour ne pas dupliquer les messages dans deux composants (pattern « émission centralisée » de `0018`).

```js
const handle = handleEnAttenteAccord;
if (!handle) return { ok: false };
let permission;
try { permission = await handle.requestPermission({ mode: 'readwrite' }); } catch (e) { console.error(e); permission = 'denied'; }
if (permission !== 'granted') {
  commit('ui/SET_BANDEAU_REPRISE_MASQUE', true, { root: true });
  dispatch('notifications/notifier', { type: 'info', message: `La sauvegarde dans « ${handle.name} » n'a pas été reprise. Vous pourrez la reprendre plus tard depuis Paramètres, rubrique « Sauvegarde automatique ».` }, { root: true });
  return { ok: false, refuse: true };
}
const resultat = await brancherFichierMemorise(commit, handle);
if (resultat.ok) dispatch('notifications/notifier', { type: 'succes', message: `La sauvegarde reprend dans « ${handle.name} ».` }, { root: true });
return resultat;   // introuvable : la fenêtre d'avertissement s'ouvre d'elle-même, pas de toast
```

Le handle reste mémorisé en cas de refus : le bandeau reviendra à la prochaine ouverture, et « Ne plus utiliser ce fichier » permet de l'oublier pour de bon.

**`activerSauvegardeFichier`** (**modifier**) : au début du `try`, après `showSaveFilePicker`, poser `handleEnAttenteAccord = null` et commiter `ui/SET_FICHIER_EN_ATTENTE_ACCORD(null)` : choisir un autre fichier remplace l'attente. Puis, **si la première écriture réussit** :

```js
const memorise = await storageRepository.enregistrerHandleFichierSauvegarde(handle);
commit('ui/SET_FICHIER_SAUVEGARDE_MEMORISE', memorise, { root: true });
```

Si la mémorisation échoue, le comportement de session de `0019` s'applique, et le texte le dit (§6.4).

**`ecrireSauvegardeFichier`** (**modifier**) :

- succès : `modifieDepuisEcritureFichier = false` ;
- échec : remplacer la remise à zéro manuelle par `libererFichierEnMemoire(commit)` + `await storageRepository.oublierHandleFichierSauvegarde()`, puisque le handle n'est plus fiable. Toast inchangé (géré par les appelants).

**`desactiverSauvegardeFichier`** (**modifier**, devient `async`) : `libererFichierEnMemoire(commit)` + `await storageRepository.oublierHandleFichierSauvegarde()`.

**`declencherSauvegardeAutomatique`** (**modifier**) : dans la branche `if (handleFichierSauvegarde)`, ajouter en tête `if (!modifieDepuisEcritureFichier) return;` (rien de nouveau dans cet onglet : pas d'écriture, pas de toast). La branche « rappel » est inchangée.

**Plugin de persistance** (**modifier** `persistancePlugin`) : juste avant `planifier(store)`, poser `modifieDepuisEcritureFichier = true`. Les mutations `ui/*`, `notifications/*`, `REPLACE_ALL` et de statut restent filtrées : elles ne marquent rien.

**`importer`** (**modifier**) : après le `REPLACE_ALL` réussi, poser `modifieDepuisEcritureFichier = true` (`REPLACE_ALL` est filtrée par le plugin, mais les données ont bien changé). Le fichier actif est **conservé** et sera mis à jour au prochain enregistrement (§12 #5).

**`reinitialiser`** (**modifier**) : remplacer `desactiverSauvegardeFichier({ commit })` par `libererFichierEnMemoire(commit)` et `modifieDepuisEcritureFichier = false`. La base IndexedDB est supprimée par `storageRepository.clear()`, déjà appelé (§5.2). Les nouveaux reflets `ui` sont remis à zéro par `ui/reinitialiserPreferences` (`REINITIALISER`).

Exposer les deux nouvelles actions dans `actions: { … }`, à côté des actions de `0019`. Mettre à jour le JSDoc de `handleFichierSauvegarde` : il est mémorisé dans IndexedDB via `storageRepository` (ADR 0021), et sa reprise passe par `reprendreSauvegardeFichier`.

### 4.3 Pourquoi `modifieDepuisEcritureFichier` (plusieurs onglets)

Avec la reprise automatique, chaque onglet ouvert reprend le même fichier. Un vieil onglet oublié, dont l'état n'a pas été rechargé, réécrirait toutes les N minutes un **état périmé**, par-dessus les modifications faites dans un autre onglet. Avec ce drapeau, un onglet n'écrit automatiquement que **ses propres modifications**. Un onglet inactif ne touche plus au fichier après sa première écriture. Coût : une variable et trois affectations. Le cas résiduel, deux onglets modifiés en parallèle, reste en « le dernier qui écrit gagne », comme `localStorage` (ADR 0005).

### 4.4 `src/main.js` (**modifier**)

```js
async function demarrer() {
  let chargement = 'ERREUR';
  try {
    chargement = await store.dispatch('bootstrap');
  } catch (e) {
    console.error('Idelia — échec du démarrage :', e);
  } finally {
    app.mount('#app');
  }
  // Après le montage, sans bloquer l'affichage : bandeau ou fenêtre apparaissent de façon réactive.
  store.dispatch('reprendreSauvegardeFichier', { chargement });
}
```

## 5. Domaine (logique pure) et stockage

### 5.1 Domaine

**Aucun ajout dans `src/domain/`**. Comme pour `0019`, il s'agit d'orchestration d'entrées/sorties (fichier, permission, stockage), pas de règle métier.

### 5.2 Stockage (`src/storage/`)

**`src/storage/indexedDb.js`** (**créer**) : seul fichier de l'application qui touche à `indexedDB` (ADR 0021). Il est minimal, générique (clé/valeur) et en API native, sans dépendance. Il est importé **uniquement** par `storageRepository.js`.

```js
const NOM_BASE = 'idelia';
const VERSION_BASE = 1;
const MAGASIN = 'cles-valeurs';

/** @returns {Promise<IDBDatabase>} — crée le magasin dans onupgradeneeded s'il n'existe pas ;
 *  db.onversionchange = () => db.close() (laisse passer une future montée de version, cf. 0028). */
function ouvrir() { … }

/** Promesse résolue à la fin d'une requête IDB (rejet sur onerror). */
function requeteEnPromesse(requete) { … }

/** Ouvre, exécute une transaction sur MAGASIN, attend `oncomplete`, REFERME toujours la base. */
async function avecMagasin(mode, operation) { … }

export const indexedDb = {
  /** @returns {Promise<*>} valeur ou `undefined` */
  lire: (cle) => …,
  /** @returns {Promise<void>} */
  ecrire: (cle, valeur) => …,
  /** @returns {Promise<void>} */
  supprimer: (cle) => …,
  /** Supprime toute la base (sans effet si elle n'existe pas). Résout aussi sur `onblocked`
   *  (la suppression aboutira à la fermeture des autres connexions) : ne fait jamais attendre l'UI. */
  supprimerBase: () => …,
};
```

Règles :

- **Ouvrir puis refermer à chaque opération.** Les opérations sont rares (démarrage, choix et oubli d'un fichier) ; aucune connexion ne reste ouverte, donc aucun blocage d'une suppression ou d'une montée de version.
- Ces fonctions **peuvent rejeter**. Les protections sont dans `storageRepository`.
- Si `typeof indexedDB === 'undefined'`, toutes les fonctions rejettent avec une erreur claire (« IndexedDB indisponible »), absorbée par `storageRepository`.

**`src/storage/storageRepository.js`** (**modifier**) : trois méthodes dédiées, **qui ne rejettent jamais**, plus l'extension de `clear()`.

```js
const CLE_HANDLE_FICHIER_SAUVEGARDE = 'fichier-sauvegarde-actif';

/** @returns {Promise<FileSystemFileHandle|null>} — `null` si absent, illisible, ou si la valeur
 *  n'a pas la forme d'un handle de fichier (valeur?.kind === 'file', getFile et queryPermission
 *  sont des fonctions) ; dans ce dernier cas, la clé est supprimée (best-effort). */
async function lireHandleFichierSauvegarde() { … }

/** @returns {Promise<boolean>} `true` si mémorisé, `false` sinon (best-effort, `console.warn`). */
async function enregistrerHandleFichierSauvegarde(handle) { … }

/** @returns {Promise<void>} best-effort. */
async function oublierHandleFichierSauvegarde() { … }
```

`clear()` : après la purge des clés `idelia:` existante, ajouter `try { await indexedDb.supprimerBase(); } catch { /* best-effort */ }`. Mettre à jour son JSDoc : « … et la base IndexedDB (handle du fichier de sauvegarde, ADR 0021) ». Mettre à jour aussi l'en-tête du module : `localStorage` pour les données et préférences, IndexedDB pour le seul handle.

## 6. Composants

### 6.1 `src/components/communs/BandeauRepriseSauvegarde.vue` (**créer**)

Composant conteneur, branché sur le store. Il est monté une fois dans `App.vue`.

- Visible si `fichierEnAttenteAccord && !bandeauRepriseMasque` (`mapState('ui', …)`).
- Rendu : alerte Bootstrap `alert alert-info`, `d-flex`, classe `d-print-none`, `role="region"` et `aria-label="Reprise de la sauvegarde"`. Icône `PhClockCounterClockwise` (`aria-hidden`).
  - Texte : « Idelia peut continuer à enregistrer vos sauvegardes dans votre fichier « {nom} ». Votre navigateur demande simplement votre accord. »
  - Aide (petit texte atténué) : « Si votre navigateur propose « Autoriser à chaque visite », choisissez-le : vous n'aurez plus à cliquer ici. »
  - Bouton principal (`btn btn-primary`, cible ≥ `$cible-cliquable-min`, icône `PhArrowsClockwise` + texte) : **« Reprendre la sauvegarde dans « {nom} » »** → `confirmerRepriseSauvegardeFichier()`. Bouton désactivé pendant l'`await` (`repriseEnCours`).
  - Bouton secondaire (`btn btn-outline-secondary`) : **« Plus tard »** → `ui/masquerBandeauReprise()`.
- Le nom du fichier est affiché uniquement par interpolation `{{ }}`, **jamais** `v-html` (nom choisi par l'utilisateur).
- Styles scoped, tokens uniquement (marge basse `t.$espace-4`, `gap: t.$espace-2/3`, boutons en `flex-wrap`).

### 6.2 `src/components/communs/ModaleFichierSauvegardeIntrouvable.vue` (**créer**)

Composant conteneur, monté une fois dans `App.vue`. Il **réutilise `DialogueConfirmation`** (focus piégé, Échap, retour du focus, déjà fournis par `ModaleBase`).

- `:visible="!!fichierSauvegardeIntrouvable"`, `titre="Fichier de sauvegarde introuvable"`.
- `message` : « Idelia ne trouve plus votre fichier de sauvegarde « {nom} » : il a peut-être été déplacé, renommé ou supprimé. Vos données ne sont pas perdues, elles sont toujours enregistrées dans ce navigateur. Choisissez un nouveau fichier pour que la sauvegarde continue. »
- `libelle-confirmer="Choisir un nouveau fichier"`, `variante-confirmer="primary"`, **`libelle-annuler="Continuer sans fichier"`** (nouvelle prop, §6.3).
- `@confirmer` : `acquitterFichierIntrouvable()`, puis `activerSauvegardeFichier()`, appelée **dans le même gestionnaire de clic** pour conserver le geste utilisateur exigé par `showSaveFilePicker`. Résultats, avec les mêmes messages que `BlocSauvegardeAutomatique.onChoisirFichier` :
  - annulation : rien ;
  - succès : toast « Fichier de sauvegarde actif : « {nom} ». » ;
  - échec : toast d'avertissement avec `resultat.message`.
- `@annuler` (bouton, croix, Échap, clic hors de la fenêtre) : `acquitterFichierIntrouvable()`. Le handle a déjà été oublié (§4.2) : continuer sans fichier ne demande rien de plus.

### 6.3 `src/components/communs/DialogueConfirmation.vue` (**modifier**)

Ajouter la prop `libelleAnnuler: { type: String, default: 'Annuler' }` et l'utiliser pour le bouton secondaire. Les appelants existants ne changent pas (valeur par défaut identique).

### 6.4 `src/components/parametres/BlocSauvegardeAutomatique.vue` (**modifier**)

- `mapState('ui', …)` : ajouter `fichierSauvegardeMemorise` et `fichierEnAttenteAccord`. `mapActions` racines : ajouter `confirmerRepriseSauvegardeFichier`.
- **Bloc 2, trois états** (toujours `v-if="compatible"`) :
  1. **En attente d'accord** (`fichierEnAttenteAccord` non nul, prioritaire) :
     - statut : « Fichier mémorisé : « {nom} ». Votre accord est nécessaire pour reprendre la sauvegarde. » ;
     - boutons : **« Reprendre la sauvegarde dans « {nom} » »** (→ `confirmerRepriseSauvegardeFichier`), « Choisir un autre fichier » (→ `onChoisirFichier`), « Ne plus utiliser ce fichier » (→ `onDesactiverFichier`).
  2. **Inactif** : inchangé. L'aide devient : « Idelia écrira directement dans le fichier choisi, à chaque enregistrement et lors des sauvegardes automatiques, sans redemander à chaque fois. Idelia s'en souviendra aux prochaines ouvertures. »
  3. **Actif** : statut inchangé. Le bouton « Désactiver » devient **« Ne plus utiliser ce fichier »** (même libellé dans les deux états). Le texte `rappel-session` devient conditionnel :
     - si `fichierSauvegardeMemorise` : « Idelia se souviendra de ce fichier la prochaine fois. Si votre navigateur le demande, il suffira d'un clic pour reprendre la sauvegarde. » ;
     - sinon : le texte de `0019`, inchangé (« Ce choix est valable pour cette session… »), qui reste vrai quand la mémorisation a échoué.
- `onDesactiverFichier` : `await this.desactiverSauvegardeFichier()`, puis toast info « Idelia n'utilisera plus le fichier « {nom} ». Le fichier lui-même n'a pas été supprimé. » (nom capturé **avant** la désactivation).
- `texteExplicatif` :
  - actif : « Toutes les {N} minutes, Idelia enregistre vos dernières modifications dans votre fichier « {nom} », sans rien vous demander. » ;
  - en attente : « Reprenez la sauvegarde dans votre fichier « {nom} » ci-dessous ; en attendant, un rappel s'affichera. » ;
  - autres cas : inchangés.
- Mettre à jour le JSDoc d'en-tête (`0032`, ADR 0021).

### 6.5 `src/components/parametres/BlocSauvegarde.vue` (**modifier**)

`messageConfirmationImport` : si `fichierSauvegardeActif`, ajouter avant la question finale : « Votre fichier de sauvegarde « {nomFichierSauvegarde} » sera ensuite mis à jour avec ces données. » Aucun autre changement.

### 6.6 `src/components/accueil/CarteSauvegarde.vue` + `src/views/AccueilView.vue` (**modifier**)

Aujourd'hui, la carte ignore le fichier actif. Avec la reprise automatique, l'Accueil (premier écran affiché) dirait « Aucun fichier téléchargé… Pensez à en télécharger un » alors qu'un fichier est actif et à jour. C'est contraire à l'honnêteté voulue par `0019`/G14.

- `CarteSauvegarde` (reste **présentationnel**) : nouvelles props `fichierSauvegardeActif` (Boolean), `nomFichierSauvegarde` (String|null) et `dernierFichierEnregistreLe` (String|null).
  - `texteRappel` reprend **à l'identique** la logique de `BlocSauvegarde.texteRappel` : « Fichier de sauvegarde à jour le … » ou « Fichier de sauvegarde actif, pas encore écrit. » quand un fichier est actif ; sinon, le texte actuel.
  - Icône et classe de succès selon le même critère que `BlocSauvegarde.rappelAJour`.
  - Libellé du bouton : « Enregistrer une sauvegarde » si un fichier est actif, sinon « Exporter une sauvegarde » (inchangé). L'événement émis reste `exporter`.
- `AccueilView` : passe les trois props (`mapState('ui', …)`). `onExporter()` devient `async` : si `fichierSauvegardeActif`, il fait `ecrireSauvegardeFichier()` puis émet un toast succès ou avertissement (mêmes messages que `BlocSauvegarde.onEnregistrer`) ; sinon, le comportement est inchangé (`exporter` + `enregistrerExport`).

### 6.7 `src/App.vue` (**modifier**)

- Dans `<main>`, juste avant `<router-view />` : `<BandeauRepriseSauvegarde />`.
- Après `<PileNotifications />` : `<ModaleFichierSauvegardeIntrouvable />`.

Imports et `components`. `App.vue` reste une coquille sans logique : les deux composants lisent le store eux-mêmes.

## 7. Règles de validation

Sans objet : aucune saisie. Le nom du fichier vient du sélecteur natif et n'est affiché que par interpolation échappée.

## 8. Points d'attention ergonomie

- **Honnêteté avant tout** (fil rouge de `0019`) :
  - ne jamais promettre une reprise sans clic ; le texte dit « si votre navigateur le demande, il suffira d'un clic » ;
  - « Idelia s'en souviendra » n'apparaît **que** si la mémorisation a réussi ;
  - la date « Dernière écriture le … » après reprise est la vraie date du fichier sur le disque.
- **Zéro jargon** : jamais « permission », « handle », « IndexedDB », « NotFoundError » à l'écran. On écrit « votre accord », « fichier introuvable », « déplacé, renommé ou supprimé ».
- **Rassurer d'abord** : la fenêtre « introuvable » commence par l'essentiel pour une personne inquiète, à savoir que **les données ne sont pas perdues**.
- **Un seul geste, au bon endroit** : le bandeau est visible quel que soit l'écran d'arrivée, et son action principale est explicite (verbe + nom du fichier). « Plus tard » est discret mais présent : pas d'impasse, et la reprise reste possible depuis Paramètres.
- **Pas de blocage au démarrage** : la reprise se fait **après** l'affichage. L'application est utilisable immédiatement ; seule la fenêtre « introuvable » interrompt, et une seule fois.
- **Pas de bruit** : la reprise silencieuse ne produit **aucun** toast. Le minuteur n'écrit et ne notifie que s'il y a du nouveau.
- **Réversibilité** : « Ne plus utiliser ce fichier » n'efface rien sur le disque, et le toast le précise.
- **Accessibilité** :
  - le bandeau est une région nommée, et ses boutons sont de vrais `<button>` avec texte ;
  - la fenêtre réutilise `DialogueConfirmation`/`ModaleBase` (focus piégé, Échap, retour du focus) ;
  - les icônes sont `aria-hidden`, toujours doublées d'un texte ;
  - pas d'information par la seule couleur.
- **Impression** : le bandeau est masqué (`d-print-none`).

## 9. Étapes d'implémentation

Quatre tâches, chacune confiée à **un sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre imposé : **T1 → T2 → T3 → T4**. Contexte à transmettre à chaque sous-agent : ADR 0021 (décision §1 à §7), règles d'or n° 2, 3, 8 et 10, ce plan.

### Tâche 1 — Brique IndexedDB derrière `storageRepository` (+ docs d'architecture)

**Fichiers** :

- `src/storage/indexedDb.js` (**créer**) : §5.2.
- `src/storage/storageRepository.js` (**modifier**) : `lireHandleFichierSauvegarde`, `enregistrerHandleFichierSauvegarde`, `oublierHandleFichierSauvegarde`, exportées dans l'objet `storageRepository` ; `clear()` supprime aussi la base ; JSDoc d'en-tête (§5.2).
- `docs/architecture/01-vue-ensemble.md` (**modifier**) : schéma et règle de dépendances : `storageRepository → LocalStorage (données) + IndexedDB (handle du fichier de sauvegarde seul) [ADR 0005, 0021]`.
- `docs/architecture/04-gestion-etat-vuex.md` (**modifier**) : section « Persistance », une phrase sur le handle (IndexedDB via `storageRepository`, reflets volatils dans `ui`).
- `docs/architecture/06-structure-du-code.md` (**modifier**) : ligne `indexedDb.js # accès IndexedDB minimal, importé par storageRepository seul [ADR 0021]` sous `storage/`.
- `docs/instructions/etat-vuex.md` (**modifier**) : « Interdiction absolue d'accéder à `localStorage` **ou à IndexedDB** depuis un module ».

**Critères de sortie** :

- `npm run build` réussit ; aucune dépendance ajoutée dans `package.json`.
- Une recherche de `indexedDB` dans `src/` ne trouve que `src/storage/indexedDb.js`.
- En console (Chrome, `npm run dev`) :
  ```js
  const { storageRepository } = await import('/idelia/src/storage/storageRepository.js');
  const racine = await navigator.storage.getDirectory();
  const h = await racine.getFileHandle('essai.json', { create: true });
  await storageRepository.enregistrerHandleFichierSauvegarde(h);           // true
  (await storageRepository.lireHandleFichierSauvegarde()).name;            // 'essai.json'
  await storageRepository.oublierHandleFichierSauvegarde();
  await storageRepository.lireHandleFichierSauvegarde();                   // null
  ```
- DevTools, onglet Application, IndexedDB : la base `idelia` contient `cles-valeurs` ; après `await storageRepository.clear()`, la base n'existe plus.

### Tâche 2 — Store : mémoriser, reprendre, oublier, et garde multi-onglets

**Fichiers** :

- `src/store/modules/ui.js` (**modifier**) : 4 états, 4 mutations, 2 actions, JSDoc (§4.1).
- `src/store/index.js` (**modifier**) : variables de module, fonctions internes, `bootstrap` (résultat), `reprendreSauvegardeFichier`, `confirmerRepriseSauvegardeFichier`, modifications de `activerSauvegardeFichier` / `ecrireSauvegardeFichier` / `desactiverSauvegardeFichier` / `declencherSauvegardeAutomatique` / `importer` / `reinitialiser` / `persistancePlugin` (§4.2).
- `src/main.js` (**modifier**) : `demarrer()` (§4.4).

**Dépend de** : T1.

**Critères de sortie** (Chrome, `npm run dev`, sélecteur remplacé en console par un fichier OPFS, voir §11 « Bouchons ») :

- Choisir un fichier : `ui.fichierSauvegardeMemorise === true`, et la clé est présente dans IndexedDB.
- `F5` : sans aucun clic, `ui.fichierSauvegardeActif === true`, et `ui.dernierFichierEnregistreLe` vaut la date du fichier.
- `queryPermission` forcée à `'prompt'` puis `F5` : `ui.fichierEnAttenteAccord === 'essai-idelia.json'`, fichier inactif. `store.dispatch('confirmerRepriseSauvegardeFichier')` avec `requestPermission` forcée à `'granted'` : actif + toast succès ; forcée à `'denied'` : toast info, `bandeauRepriseMasque === true`, clé toujours présente.
- Fichier OPFS supprimé puis `F5` : `ui.fichierSauvegardeIntrouvable === 'essai-idelia.json'` et clé IndexedDB supprimée.
- `localStorage.removeItem('idelia:data')` puis `F5` : aucune reprise, toast d'avertissement persistant, clé IndexedDB supprimée, fichier OPFS **non modifié**.
- Sauvegarde automatique à 5 min (ou minuteur raccourci temporairement en console) : sans modification, le fichier n'est **pas** réécrit après la première écriture ; après une modification, il l'est.
- `store.dispatch('desactiverSauvegardeFichier')` : la clé disparaît. `store.dispatch('reinitialiser')` : la base `idelia` disparaît et tous les reflets `ui` reviennent à leurs valeurs initiales.
- `npm run build` réussit.

### Tâche 3 — Bandeau de reprise et fenêtre « fichier introuvable »

**Fichiers** :

- `src/components/communs/DialogueConfirmation.vue` (**modifier**) : prop `libelleAnnuler` (§6.3).
- `src/components/communs/BandeauRepriseSauvegarde.vue` (**créer**) : §6.1.
- `src/components/communs/ModaleFichierSauvegardeIntrouvable.vue` (**créer**) : §6.2.
- `src/App.vue` (**modifier**) : montage des deux composants (§6.7).

**Dépend de** : T2.

**Critères de sortie** : parcours §11, étapes 3, 4, 5 et 6. Les autres `DialogueConfirmation` (Équipe, Tournées, Absences, Planning, Souhaits, Sauvegarde) affichent toujours « Annuler ». `npm run build` réussit.

### Tâche 4 — Paramètres et Accueil : textes et états du fichier mémorisé

**Fichiers** :

- `src/components/parametres/BlocSauvegardeAutomatique.vue` (**modifier**) : §6.4.
- `src/components/parametres/BlocSauvegarde.vue` (**modifier**) : §6.5.
- `src/components/accueil/CarteSauvegarde.vue` (**modifier**) : §6.6.
- `src/views/AccueilView.vue` (**modifier**) : §6.6.

**Dépend de** : T2 (actions et reflets), T3 (libellés harmonisés).

**Critères de sortie** : parcours §11, étapes 2, 7, 8, 9 et 10. `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] Sur Chrome/Edge, après avoir choisi un fichier de sauvegarde, un **rechargement de page** reprend la sauvegarde dans ce fichier **sans aucun clic** (si le navigateur a conservé l'autorisation).
- [ ] Si le navigateur demande à nouveau l'autorisation (par exemple après sa fermeture complète), un bandeau propose **« Reprendre la sauvegarde dans « … » »**. **Un clic** suivi de l'accord du navigateur réactive la sauvegarde dans le même fichier, sans le rechoisir.
- [ ] « Plus tard » masque le bandeau pour la session ; la reprise reste possible depuis Paramètres, section « Sauvegarde automatique ».
- [ ] Si l'utilisateur refuse dans la demande du navigateur, un message explique que la sauvegarde n'a pas été reprise et comment la reprendre ; aucune erreur.
- [ ] Fichier **déplacé, renommé ou supprimé** : une fenêtre « Fichier de sauvegarde introuvable » s'affiche (au démarrage, ou juste après le clic « Reprendre ») et rassure sur les données. « Choisir un nouveau fichier » ouvre le sélecteur et y écrit aussitôt ; « Continuer sans fichier » ferme. La fenêtre **ne réapparaît pas** à l'ouverture suivante.
- [ ] Si les données du navigateur sont absentes ou illisibles au démarrage, le fichier mémorisé n'est **ni repris ni modifié**, et un message persistant l'explique.
- [ ] « Ne plus utiliser ce fichier » : Idelia l'oublie (pas de reprise à l'ouverture suivante), et le fichier sur le disque n'est pas supprimé.
- [ ] « Effacer toutes les données » oublie aussi le fichier : plus de base IndexedDB `idelia`, plus de reprise, plus de bandeau.
- [ ] « Restaurer une sauvegarde » avec un fichier actif : le message de confirmation prévient que le fichier actif sera mis à jour ; le fichier reste actif.
- [ ] La sauvegarde automatique ne réécrit le fichier que si des données ont changé dans l'onglet depuis la dernière écriture. Le bouton « Enregistrer une sauvegarde » écrit toujours.
- [ ] Deux onglets ouverts : un onglet laissé sans modification n'écrase pas le fichier avec un état ancien.
- [ ] L'Accueil affiche « Fichier de sauvegarde à jour le … » quand un fichier est actif, et son bouton écrit dans ce fichier.
- [ ] Le texte « valable pour cette session » n'apparaît que si la mémorisation a échoué ; sinon, « Idelia se souviendra de ce fichier… ».
- [ ] Firefox/Safari (ou `showSaveFilePicker` absent) : comportement **identique** à `0019`, aucune base IndexedDB créée au démarrage, aucune erreur en console.
- [ ] Le fichier exporté (`SaveDocument`) ne contient rien de nouveau ; aucune requête réseau ; aucune dépendance npm ajoutée.
- [ ] `npm run build` réussit.

## 11. Vérification

### Bouchons de recette (automatisable, Playwright ou console)

Le sélecteur de fichier natif et la demande d'autorisation de Chrome ne se pilotent pas par automate. On les remplace par un fichier de l'**OPFS**, stockage privé du site, dont les handles sont mémorisables dans IndexedDB comme un vrai fichier. Ces scripts sont injectés **avant** le chargement de la page (Playwright `page.addInitScript`, ou script lancé depuis le bloc-notes de session si le serveur MCP n'est pas exposé ; voir la mémoire de recette). Serveur : `npx vite --port 5199 --strictPort`, URL `http://localhost:5199/idelia/#/parametres`.

```js
// 1. Sélecteur remplacé : renvoie toujours le même fichier OPFS.
window.showSaveFilePicker = async () =>
  (await navigator.storage.getDirectory()).getFileHandle('essai-idelia.json', { create: true });

// 2. (scénarios « accord nécessaire ») : forcer l'état d'autorisation.
FileSystemHandle.prototype.queryPermission = async () => 'prompt';
FileSystemHandle.prototype.requestPermission = async () => 'granted'; // ou 'denied'

// Lire le fichier écrit :
await (await (await navigator.storage.getDirectory()).getFileHandle('essai-idelia.json')).getFile().then((f) => f.text());
// Simuler un fichier supprimé :
await (await navigator.storage.getDirectory()).removeEntry('essai-idelia.json');
```

Données de test : restaurer `files/idelia-sermet.json` (Paramètres, « Restaurer une sauvegarde »), ou injecter un jeu fabriqué dans le bloc-notes de session. Ne jamais publier ces données.

### Parcours (Chrome, avec bouchons puis avec un vrai fichier)

1. **Choix initial** : `/parametres`, « Choisir un fichier de sauvegarde ». Le fichier est écrit, le toast succès s'affiche, le texte dit « Idelia se souviendra de ce fichier la prochaine fois… ». DevTools, Application, IndexedDB : `idelia` / `cles-valeurs` / `fichier-sauvegarde-actif`.
2. **Reprise silencieuse** : `F5`. Pas de bandeau ; la section indique « Fichier actif : « … » — Dernière écriture le <date du fichier> » ; l'Accueil affiche « Fichier de sauvegarde à jour le … » ; aucun toast.
3. **Reprise en un clic** : bouchon `queryPermission → 'prompt'`, `F5`. Le bandeau s'affiche sur l'Accueil ; il est aussi visible en naviguant vers Équipe. « Reprendre la sauvegarde dans « essai-idelia.json » » : le bandeau disparaît et le toast « La sauvegarde reprend… » s'affiche. Vérifier le focus clavier (Tab atteint les deux boutons) et que le bandeau est absent de l'aperçu avant impression.
4. **Refus** : bouchon `requestPermission → 'denied'`, `F5`, clic sur « Reprendre ». Toast info, bandeau masqué. Paramètres affiche l'état « en attente » avec ses trois boutons. `F5` : le bandeau revient.
5. **Plus tard** : « Plus tard » masque le bandeau ; Paramètres propose toujours « Reprendre… ».
6. **Fichier introuvable** : supprimer le fichier OPFS (ou, en vrai, renommer le fichier dans l'Explorateur Windows), puis `F5`. La fenêtre « Fichier de sauvegarde introuvable » s'affiche. Tester Échap (équivaut à « Continuer sans fichier »), puis, au parcours suivant, « Choisir un nouveau fichier » : écriture immédiate et toast succès. `F5` après « Continuer sans fichier » : plus de fenêtre. En variante « accord nécessaire » + fichier supprimé, la fenêtre apparaît juste après le clic « Reprendre ».
7. **Données du navigateur absentes** : fichier actif, puis en console `localStorage.removeItem('idelia:data')`, puis `F5`. Toast d'avertissement persistant, pas de reprise, contenu du fichier OPFS **identique** à avant (le lire).
8. **Sauvegarde automatique et onglets** : activer la sauvegarde automatique (5 min ; pour aller vite, raccourcir temporairement l'intervalle dans le code local, sans le committer). Sans modification après la première écriture, le contenu du fichier ne change plus. Modifier une donnée : il change au passage suivant. Ouvrir un 2ᵉ onglet, modifier dans l'onglet B et laisser l'onglet A inactif : après plusieurs passages, le fichier contient les modifications de B.
9. **Restauration avec fichier actif** : « Restaurer une sauvegarde » : la confirmation mentionne la mise à jour du fichier actif ; après import, « Enregistrer une sauvegarde » écrit les données importées dans le fichier actif.
10. **Ne plus utiliser / Effacer tout** : « Ne plus utiliser ce fichier » affiche le toast « …n'a pas été supprimé » ; `F5` : aucune reprise. Choisir à nouveau un fichier, puis « Effacer toutes les données » : la base IndexedDB `idelia` est absente (DevTools) ; `F5` : rien.
11. **Vrai fichier, vraie fermeture** (manuel, sans bouchon, Chrome ou Edge) : choisir un fichier dans « Documents » ; fermer **complètement** le navigateur puis le rouvrir sur Idelia. Selon la version et les réglages, soit reprise silencieuse, soit bandeau, puis clic et demande native de Chrome. Si Chrome propose « Autoriser à chaque visite », le choisir, puis refermer et rouvrir : la reprise doit être silencieuse. **Noter le comportement constaté** dans le compte rendu de recette (§12 #1).
12. **Firefox** (ou `delete window.showSaveFilePicker` en script injecté) : section « Fichier de sauvegarde actif » absente, aucune base `idelia` créée au démarrage, aucune erreur en console.
13. **Non-régression** : export classique sans fichier actif ; toutes les `DialogueConfirmation` existantes (« Annuler ») ; onglet Réseau sans requête nouvelle ; `npm run build`.

## 12. Décisions à confirmer / risques

1. **Transparence non garantie (assumé, annoncé).** La durée de l'autorisation dépend du navigateur (en principe conservée tant qu'un onglet d'Idelia reste ouvert, redemandée après fermeture complète sauf « Autoriser à chaque visite »). Le plan ne promet qu'« un clic au plus ». **À constater en recette** (§11 étape 11) ; l'astuce « Autoriser à chaque visite » du bandeau est à retirer si Chrome ne la propose pas sur le poste du cabinet.
2. **Handle oublié dès qu'il est jugé introuvable (retenu).** C'est le plus simple, et la fenêtre ne revient pas à chaque ouverture. Revers : un fichier sur une clé USB ou un lecteur réseau **momentanément** absent est oublié ; il faudra le rechoisir (un clic). Alternative : garder le handle et proposer « Réessayer », plus complexe ; à envisager seulement si le cabinet sauvegarde sur un lecteur réseau.
3. **Le minuteur n'écrit que s'il y a du nouveau dans l'onglet (retenu, change le comportement de `0019`).** Il protège d'un vieil onglet qui écraserait le fichier, et évite des écritures inutiles. Après une reprise, le drapeau n'est pas forcé : le fichier n'est réécrit qu'après une modification dans l'onglet (audit sécurité M1). Effet visible : sans modification, « Dernière écriture le … » ne bouge plus, d'où le texte « enregistre vos dernières modifications ». Le bouton manuel écrit toujours.
4. **Garde-fou « données absentes » : on oublie le fichier plutôt que de le reprendre (retenu).** Sans lui, une sauvegarde automatique remplacerait la seule copie saine par un état vide. Le message, persistant, oriente vers « Restaurer une sauvegarde ».
5. **Restauration avec un fichier actif : le fichier reste actif (retenu)** et recevra les données restaurées au prochain enregistrement. C'est cohérent avec « le fichier reflète ce qui est dans Idelia », et la confirmation le dit. Alternative : désactiver le fichier à chaque restauration, ce qui est plus prudent mais oblige à le rechoisir.
6. **Évolution possible, hors périmètre** : quand les données du navigateur ont disparu, proposer « Restaurer depuis « … » » en un clic (lecture du fichier mémorisé, puis `importer`). C'est un vrai plus pour le public cible ; c'est peu coûteux mais ce serait un nouveau parcours, à décider par le porteur.
7. **Accueil modifié (§6.6, retenu).** Il faut éviter que le premier écran contredise l'état réel du fichier. Le bouton y garde le libellé « Exporter une sauvegarde » quand aucun fichier n'est actif.
8. **« Désactiver » renommé en « Ne plus utiliser ce fichier » (retenu).** L'effet est désormais durable (l'oubli survit à la session) : le libellé doit le dire. Pas de confirmation, car rien n'est effacé sur le disque (cohérent avec `0019` §12 #6).
9. **Plusieurs onglets, cas résiduels (accepté).** Deux onglets modifiés en parallèle : « le dernier qui écrit gagne » (comme `localStorage`, ADR 0005). Un onglet qui choisit un autre fichier ne réoriente pas les autres onglets déjà ouverts ; seule la dernière mémorisation compte à la prochaine ouverture.
10. **Règle d'or n° 8 de `CLAUDE.md`** : elle reste vraie telle quelle (toute persistance passe par `storageRepository`). Le porteur peut y ajouter « ni à IndexedDB » (ADR 0021, Suivi) ; ce plan ne modifie pas `CLAUDE.md`.
11. **Statut de l'ADR 0021** : rédigé « Accepté » sur la base de la demande 0032 de la feuille de route, qui prescrit l'écart ; ADR 0005 et 0018 marqués « amendés ». À confirmer par le porteur.
12. **Sécurité (pour l'agent `security`)** :
    - le nom de fichier, choisi par l'utilisateur, n'est jamais rendu en `v-html` ;
    - la valeur lue dans IndexedDB est vérifiée (forme d'un handle de fichier) avant usage ;
    - rien ne quitte le poste ;
    - la CSP existante n'est pas concernée (IndexedDB et File System Access ne sont pas des requêtes réseau).
