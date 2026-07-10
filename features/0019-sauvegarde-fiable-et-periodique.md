# Feature 0019 — Sauvegarde fiable & périodique

- **Statut** : À faire
- **Dépend de** : `0002` (`storageRepository`, plugin de persistance débouncé, état racine `statutSauvegarde`/`derniereSauvegarde`), `0006`/`0008` (actions racines `exporter`/`importer`/`reinitialiser`, composant `BlocSauvegarde.vue`, écran Paramètres), `0013` (`CarteSauvegarde.vue`, écran Accueil, module `ui.dernierExportLe`), `0015` (précédent direct suivi ici : préférence d'UI persistée hors `SaveDocument`, via une clé `storageRepository` dédiée — voir §4.2), `0018` (module `notifications`/`PileNotifications` — requis pour le feedback des échecs de sauvegarde automatique, voir §8).
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (rappel : aucune donnée n'est jamais envoyée sur le réseau, tout reste local), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière `storageRepository` — le nouveau réglage suit ce pattern ; **point de tension identifié avec la File System Access API**, voir §12.1), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (sauvegarde/partage par fichier JSON — cœur modifié par cette feature), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (horodatages ISO UTC), [0012](../docs/adr/0012-style-scss.md)/[0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS/Bootstrap), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor).

> **ADR à créer, hors périmètre de ce plan** : l'arbitrage central de cette feature (§1, §12.1) est une décision architecturante qui mérite sa **propre ADR** — proposition : `docs/adr/0018-strategie-sauvegarde-fichier.md` (prochain numéro d'ADR libre ; **numériquement identique, par coïncidence**, à la feature [0018](0018-systeme-notifications-toasts.md) — les deux numérotations, `docs/adr/` et `features/`, sont indépendantes). Conformément au rôle de l'architecte, **cette ADR n'est pas rédigée ici** : elle doit être écrite (par une session dédiée, ou par le porteur) une fois l'arbitrage tranché, avant que la Tâche 2 (§9) ne démarre.

## 1. Contexte & objectif

Trois problèmes remontés par le porteur, tous liés à la fiabilité et à la clarté de la sauvegarde **fichier** (à ne pas confondre avec la persistance automatique en `localStorage`, déjà fiable et toujours active — [ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md), inchangée par cette feature) :

- **(G11) Bug** : cliquer « Enregistrer une sauvegarde » (`BlocSauvegarde.vue`, action racine `exporter`) met à jour la date de dernière sauvegarde **même si l'utilisateur annule** la boîte de dialogue d'enregistrement du fichier proposée par le navigateur. Le mécanisme actuel (`onEnregistrer()` appelle `this.exporter()` **puis**, sans condition, `this.enregistrerExport()`) ne peut techniquement **pas** faire autrement : un lien `<a download>` ne renvoie aucune information sur ce que l'utilisateur a fait ensuite (pas de promesse, pas d'événement d'annulation — voir l'analyse technique ci-dessous).
- **(G13) Sauvegarde périodique** : le porteur souhaite pouvoir **paramétrer** une sauvegarde automatique toutes les N minutes, plutôt que de devoir se souvenir d'aller dans Paramètres.
- **(G14) Clarté fichier vs mémoire** : l'utilisateur peut croire que ses données sont « sauvegardées » alors qu'elles ne vivent que dans le `localStorage` de ce navigateur (persistance automatique, silencieuse) — sans qu'aucun **fichier** n'ait jamais été réellement écrit sur son ordinateur. Il faut distinguer sans ambiguïté ces deux notions à l'écran.

### L'arbitrage technique central (à trancher par le porteur — §12.1)

Un frontend sans backend ([ADR 0002](../docs/adr/0002-application-frontend-sans-backend.md)) ne peut pas, par défaut, écrire un fichier sur le disque **automatiquement** : un lien `<a download>` (mécanisme actuel de `exporter`) déclenche un téléchargement **fire-and-forget** — aucune Promise, aucun événement ne renseigne le code JS sur ce que l'utilisateur a fait ensuite (choix d'un dossier, ou clic sur « Annuler » dans la boîte de dialogue du navigateur/système, si celle-ci est affichée — certains réglages de navigateur enregistrent silencieusement dans le dossier « Téléchargements » sans jamais rien demander). **Conséquence : avec `<a download>`, il est structurellement impossible de savoir si un fichier a réellement été écrit.** G11 ne peut donc être **complètement** corrigé avec ce mécanisme seul.

La **File System Access API** (`window.showSaveFilePicker()` puis `FileSystemFileHandle.createWritable()`/`.write()`/`.close()`) change la donne :

- **(a) Détection fiable de l'annulation** : si l'utilisateur annule le sélecteur de fichier, la promesse de `showSaveFilePicker()` est **rejetée** avec une `DOMException` nommée `AbortError`, que le code peut intercepter explicitement — **jamais** la date n'est alors mise à jour. Fix **réel** de G11.
- **(b) Réécriture silencieuse dans le même fichier** : une fois un `FileSystemFileHandle` obtenu (geste utilisateur requis **une fois**), on peut y **réécrire** ensuite (`createWritable()`/`write()`/`close()`) **sans redemander de dialogue**, y compris depuis un minuteur périodique — exactement ce que demande G13 (sauvegarde automatique **réelle**, dans le fichier choisi par l'utilisateur, sans multiplier les fichiers téléchargés).

Mais cette API a des **limites significatives**, toutes à assumer explicitement :

- **Disponible uniquement sur Chromium (Chrome, Edge, Opera…) — absente de Firefox et Safari.** Une part potentiellement significative des postes du cabinet peut ne pas en bénéficier.
- **Exige un geste utilisateur explicite** pour le premier choix de fichier (`showSaveFilePicker` ne peut pas être appelé depuis un minuteur ou au chargement de la page — seulement depuis un gestionnaire de clic).
- **Le `FileSystemFileHandle` n'est pas sérialisable** : il ne peut pas être stocké dans `localStorage` (chaînes uniquement) ni dans le `SaveDocument`. Le conserver **entre deux sessions** (fermeture/réouverture du navigateur) exigerait une base **IndexedDB** dédiée (le seul mécanisme du navigateur capable de stocker un tel objet) **et** une **ré-autorisation** probable à chaque réouverture (les navigateurs ne garantissent pas la persistance de la permission d'écriture indéfiniment). Introduire IndexedDB serait un **écart** par rapport à [ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (« LocalStorage en v1 ») — écart mineur (IndexedDB y est déjà annoncée comme évolution possible), mais structurant, à acter explicitement dans la future ADR.

**Recommandation de l'architecte (à confirmer par le porteur, §12.1)** : adopter la File System Access API en **amélioration progressive**, avec le `FileSystemFileHandle` conservé **en mémoire pour la durée de la session (l'onglet ouvert) uniquement — sans IndexedDB** :

- **Sur Chrome/Edge**, une fois que l'utilisateur a choisi un « fichier de sauvegarde actif » (un clic), Idelia peut y réécrire silencieusement à la demande **et** automatiquement toutes les N minutes, avec détection fiable d'un échec/annulation (G11 **réellement corrigé**, G13 **réellement réalisé** — sauvegarde **automatique**, pas un simple rappel). Après un rechargement de page, le fichier actif est **oublié** (comportement assumé et **annoncé clairement** à l'utilisateur — voir G14) : l'utilisateur re-choisit son fichier en un clic pour réactiver la sauvegarde silencieuse. Ce compromis évite d'introduire IndexedDB (aucun écart à [ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)) et reste **KISS** : un cabinet sur poste fixe, qui garde généralement l'onglet ouvert pendant une session de travail, tire l'essentiel du bénéfice sans complexité de stockage supplémentaire.
- **Sur les autres navigateurs** (ou tant que le mode « fichier actif » n'est pas activé), Idelia propose un **rappel périodique** (toast, via `0018`) invitant à télécharger une sauvegarde manuellement — ce n'est **pas** une sauvegarde automatique réelle, et le texte le dit explicitement (aucune tromperie, cohérent avec G14). On **n'automatise pas** le téléchargement lui-même sur cette voie : un téléchargement silencieux répété toutes les N minutes remplirait le dossier « Téléchargements » de fichiers dupliqués (pire UX qu'utile), sans même résoudre G11 (toujours aucune détection d'annulation possible avec `<a download>`).
- **Dans les deux cas**, reformuler l'affichage pour ne jamais laisser croire à une certitude qu'on n'a pas : « Téléchargement lancé le … » (voie classique, incertaine) vs « Fichier de sauvegarde à jour le … » (voie File System Access API, certaine — seule mise à jour **garantie** consécutive à une écriture confirmée).

Cette recommandation est **détaillée branche par branche** dans les sections suivantes, pour que l'implémentation puisse démarrer dès que le porteur valide (ou ajuste) l'arbitrage. **Une partie de cette feature (Tâche 1, §9) ne dépend pas de cet arbitrage** et peut démarrer immédiatement.

## 2. Écrans concernés

Aucune nouvelle route. Un seul écran modifié :

| Route | Écran | Changement `0019` |
|---|---|---|
| `/parametres` | **Paramètres du cabinet** | La section « Sauvegarde » existante (`BlocSauvegarde.vue`, `0008`) voit son texte de rappel reformulé (G14) ; une **nouvelle section « Sauvegarde automatique »** (nouveau composant `BlocSauvegardeAutomatique.vue`) est ajoutée, avec un réglage d'intervalle et, sur Chrome/Edge, la gestion du « fichier de sauvegarde actif ». |

`AccueilView.vue`/`CarteSauvegarde.vue` (`0013`) ne voient qu'un **ajustement de texte** (reformulation G14), sans nouvelle fonctionnalité (la configuration reste centralisée dans Paramètres).

**Expérience visée** (utilisateur non-technique) :

- Le rappel existant (« Dernière sauvegarde enregistrée le … ») devient **honnête** sur ce qu'il sait réellement : « Dernier téléchargement lancé le … » sur la voie classique, ou « Fichier de sauvegarde à jour le … » quand un fichier actif existe et a été réellement réécrit.
- Une nouvelle section explique simplement : « Idelia peut vous sauvegarder tout seul, régulièrement. » Un interrupteur active/désactive ; un menu déroulant choisit la fréquence (5/10/15/30/60 minutes).
- Sur Chrome/Edge, un bloc supplémentaire propose de **choisir un fichier** dans lequel Idelia réécrira silencieusement à chaque sauvegarde (manuelle ou automatique) — avec un rappel honnête que ce choix ne dure que le temps de la session en cours.
- Sur les autres navigateurs, un texte explique simplement que ce navigateur ne permet pas l'écriture automatique, et qu'un **rappel** régulier sera affiché à la place.

## 3. Modèle de données touché

**Aucune entité métier, aucun champ, aucune migration** (`schemaVersion` inchangé). Comme pour la préférence « menu replié » (`0015`), les réglages introduits ici sont des **préférences d'interface**, hors du `SaveDocument` (jamais exportées/importées) :

- **Intervalle et activation** de la sauvegarde automatique : persistée via une **clé `localStorage` dédiée**, séparée du `SaveDocument` **et** de `idelia:prefs-ui` (`0015`) — voir §4.2.
- **« Fichier de sauvegarde actif »** (`FileSystemFileHandle`) : **jamais persisté** (ni `localStorage`, ni IndexedDB en v1 — voir arbitrage §1/§12.1) : vit uniquement en mémoire, pour la session en cours.

## 4. Store (Vuex)

### 4.1 Rappel de l'existant (inchangé dans son mécanisme, réutilisé)

- `exporter`/`importer`/`reinitialiser` (racine, `src/store/index.js`, `0002`/`0008`) : **inchangés en tant que mécanisme** de téléchargement classique/import/effacement. `exporter` reste la voie de repli quand aucun fichier actif n'est en place.
- `ui.dernierExportLe` / action `ui/enregistrerExport` (`0008`) : **inchangés dans le store** (aucun renommage, pour limiter les risques de régression) — seule leur **restitution textuelle** change dans les composants (§6, wording honnête).
- État racine `derniereSauvegarde`/`statutSauvegarde` (persistance automatique `localStorage`, `0002`) : **inchangé**, reste le seul indicateur de « données enregistrées dans ce navigateur ».

### 4.2 Nouvelles préférences persistées — `storageRepository` (clé dédiée, hors `SaveDocument`)

Sur le **modèle exact** de la préférence « menu replié » (`0015` §4.2) : étendre `src/storage/storageRepository.js` de deux méthodes dédiées, sur une **nouvelle clé** `idelia:prefs-sauvegarde-auto` (séparée de `idelia:data` **et** de `idelia:prefs-ui`, pour ne rien risquer sur `0015`) :

```js
const CLE_PREFS_SAUVEGARDE_AUTO = 'idelia:prefs-sauvegarde-auto';

/**
 * Lit la préférence de sauvegarde automatique (feature 0019). Lecture
 * synchrone et tolérante : valeurs par défaut (désactivée, 15 min) si la
 * clé est absente ou illisible.
 * @returns {{ active: boolean, intervalleMinutes: number }}
 */
function lirePreferenceSauvegardeAuto() {
  try {
    const brut = localStorage.getItem(CLE_PREFS_SAUVEGARDE_AUTO);
    if (!brut) return { active: false, intervalleMinutes: 15 };
    const valeur = JSON.parse(brut);
    return {
      active: valeur.active === true,
      intervalleMinutes: Number.isInteger(valeur.intervalleMinutes) ? valeur.intervalleMinutes : 15,
    };
  } catch {
    return { active: false, intervalleMinutes: 15 };
  }
}

/** Écriture best-effort, comme le reste du repository. */
function enregistrerPreferenceSauvegardeAuto({ active, intervalleMinutes }) {
  try {
    localStorage.setItem(CLE_PREFS_SAUVEGARDE_AUTO, JSON.stringify({ active, intervalleMinutes }));
  } catch {
    // Best-effort : une préférence non mémorisée n'est pas bloquante.
  }
}
```

- **Aucun impact** sur `idelia:data` (SaveDocument) ni `idelia:prefs-ui` (`0015`) : clé strictement séparée, un réglage = une clé (cohérent avec le principe déjà établi).
- Respecte la règle d'or #8 : tout accès `localStorage` reste **centralisé** dans `storageRepository`.

### 4.3 Module `ui` (`src/store/modules/ui.js`, **modifier**) — préférence miroir + minuteur de rappel/écriture

Sur le modèle de `menuReplie`/`basculerMenu`/`initialiserMenu` (`0015`) :

- **State** ajouté : `sauvegardeAutoActive: false`, `sauvegardeAutoIntervalleMinutes: 15`, `fichierSauvegardeActif: false`, `nomFichierSauvegarde: null`, `dernierFichierEnregistreLe: null` (ISO UTC ou `null`).
- **Mutations** : `SET_SAUVEGARDE_AUTO(state, { active, intervalleMinutes })`, `SET_FICHIER_SAUVEGARDE_ACTIF(state, { actif, nom })`, `SET_DERNIER_FICHIER_ENREGISTRE(state, iso)`.
- **Action `initialiserSauvegardeAuto({ commit, dispatch })`** (appelée depuis `main.js`, comme `ui/initialiserMenu`) : lit `storageRepository.lirePreferenceSauvegardeAuto()`, `commit('SET_SAUVEGARDE_AUTO', ...)`, et **arme le minuteur** si `active` (voir ci-dessous).
- **Action `configurerSauvegardeAuto({ commit, dispatch }, { active, intervalleMinutes })`** (appelée par `BlocSauvegardeAutomatique.vue` à chaque changement de réglage) : `commit('SET_SAUVEGARDE_AUTO', ...)`, `storageRepository.enregistrerPreferenceSauvegardeAuto(...)`, puis **réarme ou désarme** le minuteur.
- **Minuteur** : une variable **de module** (comme le `timer` de `src/store/index.js`, en dehors de `state` — un `setInterval` n'est pas une donnée sérialisable) :

```js
let minuteur = null;

function armerMinuteur({ commit, dispatch }, intervalleMinutes) {
  clearInterval(minuteur);
  minuteur = setInterval(() => {
    dispatch('declencherSauvegardeAutomatique', null, { root: true });
  }, intervalleMinutes * 60000);
}
```

  Le tick périodique **dispatche une action racine** (§4.4) — le module `ui` ne décide pas lui-même s'il faut écrire un fichier ou se contenter d'un rappel : cette logique de branchement vit au même endroit que `exporter` (root), pour rester cohérente avec le mécanisme de fichier actif (§4.4).

### 4.4 Nouvelles actions **racines** (`src/store/index.js`, **modifier**) — orchestration fichier (branche File System Access API)

Sur le modèle de `exporter` (déjà un appel direct à des API navigateur — `Blob`, `URL.createObjectURL`, `document.createElement('a')` — **directement dans une action racine**, précédent déjà établi dans ce fichier). Ajouter une variable de module `let handleFichierSauvegarde = null;` (à côté de `timer`, même principe : état non sérialisable, jamais dans `state`) et quatre actions. Le pseudocode ci-dessous illustre le **corps** de chaque action (à intégrer dans l'objet `actions: { ... }` existant, chacune recevant le contexte Vuex standard `{ commit, state, dispatch }`, exactement comme `exporter({ state })` aujourd'hui) :

```js
/**
 * Active le « fichier de sauvegarde » (File System Access API, Chrome/Edge
 * uniquement). Exige un geste utilisateur (appelée depuis un clic). Détecte
 * fiablement une annulation (`AbortError`) : dans ce cas, aucun état n'est
 * modifié (fix réel de G11, sur cette branche).
 */
async function activerSauvegardeFichier({ commit, state }) {
  if (!('showSaveFilePicker' in window)) {
    return { ok: false, message: "Votre navigateur ne permet pas cette fonctionnalité (essayez Chrome ou Edge)." };
  }
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'idelia-sauvegarde.json',
      types: [{ description: 'Sauvegarde Idelia', accept: { 'application/json': ['.json'] } }],
    });
    handleFichierSauvegarde = handle;
    commit('ui/SET_FICHIER_SAUVEGARDE_ACTIF', { actif: true, nom: handle.name }, { root: true });
    // Première écriture immédiate : confirme que tout fonctionne de bout en bout.
    return await ecrireSauvegardeFichier({ commit, state });
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, annule: true };
    return { ok: false, message: "Impossible d'activer le fichier de sauvegarde." };
  }
}

/** Réécrit dans le fichier actif. Utilisée par le bouton manuel ET le minuteur. */
async function ecrireSauvegardeFichier({ commit, state }) {
  if (!handleFichierSauvegarde) return { ok: false, message: 'Aucun fichier de sauvegarde actif.' };
  try {
    const doc = toSaveDocument(state, { schemaVersion: CURRENT_SCHEMA_VERSION });
    const writable = await handleFichierSauvegarde.createWritable();
    await writable.write(JSON.stringify(doc, null, 2));
    await writable.close();
    commit('ui/SET_DERNIER_FICHIER_ENREGISTRE', new Date().toISOString(), { root: true });
    return { ok: true };
  } catch {
    // Handle révoqué/fichier introuvable : on désactive proprement plutôt
    // que de laisser un état « actif » qui ne fonctionne plus silencieusement.
    handleFichierSauvegarde = null;
    commit('ui/SET_FICHIER_SAUVEGARDE_ACTIF', { actif: false, nom: null }, { root: true });
    return { ok: false, message: "L'écriture dans le fichier de sauvegarde a échoué." };
  }
}

function desactiverSauvegardeFichier({ commit }) {
  handleFichierSauvegarde = null;
  commit('ui/SET_FICHIER_SAUVEGARDE_ACTIF', { actif: false, nom: null }, { root: true });
}

/**
 * Point d'entrée du minuteur périodique (`ui.js`) : écrit silencieusement si
 * un fichier est actif, sinon se contente d'un rappel (toast, feature 0018).
 */
async function declencherSauvegardeAutomatique({ state, commit, dispatch }) {
  if (handleFichierSauvegarde) {
    const resultat = await ecrireSauvegardeFichier({ commit, state });
    if (!resultat.ok) {
      dispatch('notifications/notifier', {
        type: 'avertissement',
        message: 'La sauvegarde automatique du fichier a été interrompue : ' + resultat.message,
      }, { root: true });
    }
    // Succès : silencieux, l'indicateur du bloc suffit (pas de toast à chaque tick).
  } else {
    dispatch('notifications/notifier', {
      type: 'avertissement',
      message: "Pensez à enregistrer une sauvegarde : vos données n'ont pas été copiées dans un fichier récemment.",
    }, { root: true });
  }
}
```

- **Aucune requête réseau** ([ADR 0002](../docs/adr/0002-application-frontend-sans-backend.md)) : uniquement des API du navigateur local.
- **`handleFichierSauvegarde` ne survit jamais à un rechargement** (choix assumé, §1/§12.1) : après `F5`, `ui.fichierSauvegardeActif` redevient `false` (état volatil, non hydraté), l'utilisateur réactive en un clic s'il le souhaite.
- Ces actions sont **dispatchées uniquement** par `BlocSauvegardeAutomatique.vue` (bouton « Choisir un fichier »/« Désactiver ») et le minuteur du module `ui` — jamais depuis `src/domain/` (ce ne sont pas des règles métier, mais de l'orchestration I/O, au même titre que `exporter`).

### 4.5 `src/main.js` (**modifier**)

Ajouter `store.dispatch('ui/initialiserSauvegardeAuto')`, au même endroit que `store.dispatch('ui/initialiserMenu')` (avant `app.mount(...)`).

## 5. Domaine (logique pure)

**Aucun ajout dans `src/domain/`.** Comme pour `0015`/`0018`, cette feature est de l'**orchestration I/O** (fichiers, minuteur) et de la **préférence d'UI**, pas de règle métier : `toSaveDocument`/`CURRENT_SCHEMA_VERSION` existants sont **réutilisés tels quels** (aucune évolution du schéma).

## 6. Composants

### 6.1 `src/components/parametres/BlocSauvegarde.vue` (**modifier**) — wording honnête (G11 universel + G14)

- **`texteRappel`** (computed) reformulé : « Aucun fichier téléchargé depuis l'ouverture de l'application. Pensez à en télécharger un régulièrement. » (état initial) / « Dernier téléchargement lancé le {date}. » (au lieu de « Dernière sauvegarde enregistrée le … », qui affirmait une certitude que l'application n'a jamais eue — voir §1).
- **`onEnregistrer()`** : si `this.fichierSauvegardeActif` (nouveau, `mapState('ui', ['fichierSauvegardeActif'])`) est `true`, dispatcher `ecrireSauvegardeFichier` (racine) **à la place** du couple `exporter`/`enregistrerExport` ; sinon, comportement **inchangé** (téléchargement classique). Résultat affiché via un toast (`0018`) : succès (« Sauvegarde enregistrée dans « {nom} ». ») ou avertissement en cas d'échec — en plus (pas à la place) du texte de rappel mis à jour.
- **Aucun autre changement** de comportement (restaurer/effacer inchangés).

### 6.2 `src/components/accueil/CarteSauvegarde.vue` (**modifier**) — même reformulation

- `texteRappel` reformulé à l'identique de `BlocSauvegarde.vue` (« Aucun fichier téléchargé… » / « Dernier téléchargement lancé le … »). Le bouton « Exporter une sauvegarde » de l'Accueil reste un raccourci **simple** (téléchargement classique uniquement) — la gestion du fichier actif et de l'automatisation reste **centralisée dans Paramètres** (cohérent avec `0013 §12.9`, qui renvoyait déjà la gestion complète à Paramètres).

### 6.3 `src/components/communs/IndicateurSauvegarde.vue` (**modifier**) — clarifier « dans ce navigateur » (G14)

Reformuler les textes de l'état `ENREGISTRE` pour lever toute ambiguïté avec un fichier :
- « Vos réglages sont enregistrés dans ce navigateur{{ texteDate }} » (au lieu de « Vos réglages sont enregistrés{{ texteDate }} »).
- « Modifications enregistrées dans ce navigateur{{ texteDate }} » (au lieu de « Modifications enregistrées{{ texteDate }} »).

La variante `compact` (pied du menu latéral, `0015`) reste inchangée dans son libellé court (« Sauvegardé · 14:32 ») — l'espace y est trop réduit pour la précision complète ; le libellé long (`title`/`aria-label`) peut recevoir le même ajustement (« Sauvegardé dans ce navigateur à … »).

### 6.4 `src/components/parametres/BlocSauvegardeAutomatique.vue` (**nouveau**)

Nouvelle section « Sauvegarde automatique » (`ParametresView.vue`, après la section « Sauvegarde » existante). Composant conteneur, sur le modèle de `BlocSauvegarde.vue` : dispatche les actions, affiche leur résultat, aucune logique métier.

- **Détection de compatibilité** : `data() { return { compatible: 'showSaveFilePicker' in window }; }` (vérification de capacité navigateur, pas une règle métier — direct dans le composant, comme le fait déjà `BlocSauvegarde` pour son `<input type="file">`).
- **Accès store** : `mapState('ui', ['sauvegardeAutoActive', 'sauvegardeAutoIntervalleMinutes', 'fichierSauvegardeActif', 'nomFichierSauvegarde', 'dernierFichierEnregistreLe'])`, `mapActions('ui', ['configurerSauvegardeAuto'])`, `mapActions(['activerSauvegardeFichier', 'desactiverSauvegardeFichier'])` (racines).
- **Bloc 1 — Fréquence** (toujours affiché, sur tous les navigateurs) :
  - Interrupteur (`form-check form-switch`, comme le « Pris en compte » de `SouhaitsView`) : « Activer les rappels/sauvegardes automatiques ».
  - `<select>` fermé (comme `premierJourSemaine` dans `ParametresView` — pas de Vuelidate nécessaire, liste fermée) : « Toutes les … minutes » → options 5/10/15/30/60.
  - Au changement de l'un ou l'autre : `configurerSauvegardeAuto({ active, intervalleMinutes })`.
  - **Texte explicatif dynamique** (§1) : si `compatible && fichierSauvegardeActif` → « Toutes les {N} minutes, Idelia réécrit automatiquement votre fichier « {nomFichierSauvegarde} », sans rien vous demander. » ; si `compatible && !fichierSauvegardeActif` → « Activez un fichier de sauvegarde ci-dessous pour une sauvegarde silencieuse ; en attendant, un rappel s'affichera. » ; si `!compatible` → « Ce navigateur ne permet pas d'écrire un fichier automatiquement : un rappel s'affichera pour vous inviter à enregistrer vous-même une sauvegarde. »
- **Bloc 2 — Fichier de sauvegarde actif** (`v-if="compatible"`, **masqué sur Firefox/Safari**) :
  - Inactif : bouton « Choisir un fichier de sauvegarde » → `activerSauvegardeFichier()` ; texte d'aide « Idelia écrira directement dans le fichier choisi, à chaque enregistrement et lors des sauvegardes automatiques, sans redemander à chaque fois. »
  - Actif : « Fichier actif : « {nomFichierSauvegarde} » — Dernière écriture le {dateUtil.formatHorodatageFr(dernierFichierEnregistreLe)} » (ou « jamais encore » si `null`) + boutons « Changer de fichier » (relance `activerSauvegardeFichier`) et « Désactiver » (`desactiverSauvegardeFichier`, sans confirmation — n'efface aucune donnée, juste un lien pratique).
  - **Rappel honnête, systématique** (petit texte atténué) : « Ce choix est valable pour cette session : après avoir rechargé la page, choisissez à nouveau votre fichier pour continuer à l'utiliser. » (assume explicitement la limite du choix « session-only », §1/§12.1 — pierre angulaire de G14).
- **Résultat des actions** (`activerSauvegardeFichier`) : annulation (`resultat.annule`) → aucun message (l'utilisateur a juste changé d'avis, comportement neutre, pas d'erreur) ; échec → toast avertissement (`0018`) ; succès → toast succès + mise à jour de l'affichage (réactif via le store, aucun état local à synchroniser).

## 7. Règles de validation

**Aucune** Vuelidate : l'intervalle est une liste fermée (`<select>`, comme `premierJourSemaine`), l'interrupteur est un booléen. Cohérent avec `0008`/`0003` (pas de règle déclarative pour des choix fermés).

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Honnêteté avant tout (cœur de G11/G14)** : ne **jamais** afficher un texte qui affirme plus de certitude que ce que l'application sait réellement. « Téléchargement lancé » ≠ « Fichier enregistré » ≠ « Fichier à jour, écriture confirmée » — trois affirmations différentes, trois libellés différents, jamais interchangés.
- **Zéro jargon technique** : jamais « File System Access API », « handle », « AbortError » à l'écran — uniquement « fichier de sauvegarde actif », « choisir un fichier », « cela n'a pas fonctionné ».
- **Réversibilité et clarté du périmètre de session** : le bloc « fichier actif » dit **explicitement** qu'il faut re-choisir après un rechargement — évite toute fausse impression de continuité entre deux sessions.
- **Jamais l'information par la seule couleur** : les toasts de succès/échec de sauvegarde automatique (`0018`) portent icône + texte.
- **Pas d'alerte à chaque tick réussi** : une sauvegarde automatique silencieuse qui **réussit** ne génère **pas** de toast à chaque exécution (éviterait la lassitude/le bruit d'un toast toutes les 5-15 minutes) — seul un **échec** ou l'absence de fichier actif déclenche un rappel visible. L'indicateur du bloc (« Dernière écriture le … ») suffit à qui veut vérifier.
- **Feature-detection propre** : sur Firefox/Safari, le bloc « Fichier de sauvegarde actif » est **masqué**, pas grisé/inactif — évite la frustration d'un bouton qui ne peut jamais fonctionner sur ce navigateur.
- **Aucune donnée envoyée sur le réseau** ([ADR 0002](../docs/adr/0002-application-frontend-sans-backend.md)) : la sauvegarde automatique écrit uniquement sur le poste de l'utilisateur (fichier local ou `localStorage`), jamais vers un serveur.
- **Cohérence** : mêmes patterns de bouton/texte d'aide que `BlocSauvegarde.vue` existant.

## 9. Étapes d'implémentation

Découpage en **2 tâches**, chacune pour **un sous-agent** (`dev-front`, `model: sonnet`, effort `medium`). **La Tâche 1 est indépendante de l'arbitrage §1/§12.1 et peut démarrer immédiatement.** **La Tâche 2 dépend de la confirmation du porteur sur l'arbitrage** (et, idéalement, de la rédaction préalable de l'ADR — voir l'encart en tête de ce document).

### Tâche 1 — Wording honnête (G11 universel + G14) + préférence « sauvegarde automatique » en mode rappel (G13, universel)

**Fichiers** :
- `src/components/parametres/BlocSauvegarde.vue` (**modifier**) — reformuler `texteRappel` (§6.1, partie wording uniquement — **pas** encore la branche `fichierSauvegardeActif`, qui arrive en Tâche 2).
- `src/components/accueil/CarteSauvegarde.vue` (**modifier**) — même reformulation (§6.2).
- `src/components/communs/IndicateurSauvegarde.vue` (**modifier**) — préciser « dans ce navigateur » (§6.3).
- `src/storage/storageRepository.js` (**modifier**) — `lirePreferenceSauvegardeAuto()`/`enregistrerPreferenceSauvegardeAuto(valeur)`, clé dédiée `idelia:prefs-sauvegarde-auto` (§4.2).
- `src/store/modules/ui.js` (**modifier**) — state `sauvegardeAutoActive`/`sauvegardeAutoIntervalleMinutes` (**pas encore** `fichierSauvegardeActif`/`nomFichierSauvegarde`/`dernierFichierEnregistreLe`, qui arrivent en Tâche 2), mutation, actions `initialiserSauvegardeAuto`/`configurerSauvegardeAuto` avec un minuteur qui, **pour cette tâche**, dispatche **uniquement** un rappel (`notifications/notifier` type `avertissement`) — pas encore de branche fichier (§4.3, en retirant temporairement la vérification `handleFichierSauvegarde` puisqu'elle n'existe pas encore).
- `src/main.js` (**modifier**) — `store.dispatch('ui/initialiserSauvegardeAuto')`.
- `src/components/parametres/BlocSauvegardeAutomatique.vue` (**créer**) — **uniquement le Bloc 1** (interrupteur + fréquence + texte explicatif simplifié, sans le Bloc 2 « fichier actif » — celui-ci arrive en Tâche 2). Si `!compatible`, le texte explicatif dit déjà que ce navigateur ne permet pas l'écriture automatique (§6.4).
- `src/views/ParametresView.vue` (**modifier**) — ajouter la section « Sauvegarde automatique » avec `<BlocSauvegardeAutomatique />`.

**Dépend de** : `0018` (module `notifications`, pour le rappel périodique).

**Critères de sortie** :
- Le rappel de `BlocSauvegarde`/`CarteSauvegarde` affiche « Aucun fichier téléchargé… » / « Dernier téléchargement lancé le … » (jamais « sauvegarde enregistrée »).
- `IndicateurSauvegarde` affiche « … enregistrés/enregistrées dans ce navigateur… ».
- Activer « Sauvegarde automatique » à 5 minutes (pour tester rapidement, ou modifier temporairement l'intervalle en console) puis attendre : un **toast d'avertissement** de rappel apparaît (« Pensez à enregistrer une sauvegarde… »).
- Recharger la page : la préférence (`active`/`intervalleMinutes`) est **restituée** (persistée sur `idelia:prefs-sauvegarde-auto`, distincte de `idelia:data` et `idelia:prefs-ui`).
- Exporter/importer une sauvegarde (`0008`) : le fichier JSON **n'inclut pas** ce réglage.
- `npm run build` réussit.

### Tâche 2 — File System Access API : fichier de sauvegarde actif (G11 réel + G13 réel, Chrome/Edge)

**Préalable** : arbitrage §1/§12.1 confirmé par le porteur (et, idéalement, ADR rédigée — voir encart en tête).

**Fichiers** :
- `src/store/index.js` (**modifier**) — variable de module `handleFichierSauvegarde`, actions racines `activerSauvegardeFichier`, `ecrireSauvegardeFichier` (exposée pour être appelée en interne ET dispatchable), `desactiverSauvegardeFichier`, `declencherSauvegardeAutomatique` (§4.4).
- `src/store/modules/ui.js` (**modifier**) — compléter le state (`fichierSauvegardeActif`, `nomFichierSauvegarde`, `dernierFichierEnregistreLe`) et les mutations associées (§4.3) ; le minuteur dispatche désormais `declencherSauvegardeAutomatique` (root) au lieu du rappel direct de la Tâche 1.
- `src/components/parametres/BlocSauvegarde.vue` (**modifier**) — brancher `onEnregistrer()` sur `fichierSauvegardeActif` (§6.1).
- `src/components/parametres/BlocSauvegardeAutomatique.vue` (**modifier**) — ajouter le **Bloc 2** « Fichier de sauvegarde actif » (§6.4), masqué si `!compatible`.

**Dépend de** : Tâche 1 (state `ui` de base, composant `BlocSauvegardeAutomatique`), `0018` (toasts de résultat).

**Critères de sortie** (sur Chrome ou Edge, `npm run dev`) :
- « Choisir un fichier de sauvegarde » ouvre le sélecteur natif. **Annuler** → aucun état modifié, aucune date mise à jour (fix G11 vérifiable). **Choisir un emplacement** → le fichier est créé/écrit immédiatement, « Fichier actif : « … » » s'affiche, toast de succès.
- Cliquer « Enregistrer une sauvegarde » (bouton existant de `BlocSauvegarde`) alors qu'un fichier est actif : **aucun** téléchargement classique ne se déclenche, le fichier actif est réécrit silencieusement (vérifiable en ouvrant le fichier sur disque : contenu à jour), toast de succès nommant le fichier.
- Activer la sauvegarde automatique (ex. 5 min) avec un fichier actif : après le délai, le fichier sur disque est **réécrit automatiquement**, sans aucun dialogue, sans toast de succès (silencieux) ; « Dernière écriture le … » se met à jour dans le bloc.
- Supprimer manuellement le fichier actif dans l'explorateur de fichiers puis attendre le prochain tick automatique (ou cliquer « Enregistrer ») : l'écriture échoue proprement, le mode « fichier actif » se désactive tout seul, un toast d'avertissement l'explique.
- Recharger la page : le fichier actif redevient **inactif** (comportement assumé, texte de rappel visible avant rechargement).
- **Sur Firefox** (ou en désactivant temporairement `window.showSaveFilePicker` via la console) : le Bloc 2 est **masqué**, seul le Bloc 1 (rappel périodique, Tâche 1) reste actif ; aucune erreur JS.
- `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] **(G11)** Le texte de rappel ne parle plus jamais de « sauvegarde enregistrée » pour un simple téléchargement classique — reformulé en « téléchargement lancé » partout où c'est incertain.
- [ ] **(G11, Chrome/Edge)** Une fois un « fichier de sauvegarde actif » choisi, **annuler** le sélecteur de fichier (ou toute écriture qui échoue) ne met **jamais** à jour la date de dernière écriture confirmée.
- [ ] **(G13)** Un réglage « Sauvegarde automatique » (activer/désactiver + fréquence en minutes, liste fermée) est disponible dans Paramètres, sur **tous** les navigateurs.
- [ ] **(G13, tous navigateurs)** Sauvegarde automatique activée sans fichier actif : un **rappel** (toast) apparaît à intervalle régulier, sans jamais télécharger silencieusement de fichier.
- [ ] **(G13, Chrome/Edge)** Sauvegarde automatique activée avec un fichier actif : le fichier choisi est **réellement réécrit** à intervalle régulier, sans dialogue, sans toast de succès à chaque fois (silencieux), avec un indicateur « Dernière écriture le … » à jour.
- [ ] **(G14)** L'écran distingue clairement « données enregistrées dans ce navigateur » (toujours vrai, `IndicateurSauvegarde` reformulé) de « fichier de sauvegarde à jour le … » (uniquement si une écriture réelle a été confirmée).
- [ ] **(G14)** Le bloc « Fichier de sauvegarde actif » explicite que le choix ne survit pas à un rechargement de page.
- [ ] Le réglage de fréquence/activation est persisté sur une **clé dédiée** (`idelia:prefs-sauvegarde-auto`), **absente** du fichier exporté/importé (`SaveDocument` inchangé).
- [ ] Sur un navigateur sans File System Access API (Firefox/Safari, ou détection simulée), le bloc « Fichier de sauvegarde actif » est **masqué** ; aucune erreur JS ; le rappel périodique (G13 en mode dégradé) fonctionne normalement.
- [ ] **Aucune donnée envoyée sur le réseau** ([ADR 0002](../docs/adr/0002-application-frontend-sans-backend.md)) : toute l'écriture reste locale (fichier ou `localStorage`).
- [ ] Aucune régression sur `exporter`/`importer`/`reinitialiser`/`BlocSauvegarde` existants (téléchargement, restauration, effacement inchangés dans leur mécanisme).
- [ ] `npm run build` réussit après chaque tâche.

## 11. Vérification

Parcours manuel (`npm run dev`) :

1. **Wording (tous navigateurs)** — `/parametres`, section Sauvegarde : observer « Aucun fichier téléchargé depuis l'ouverture… ». Cliquer « Enregistrer une sauvegarde » → « Dernier téléchargement lancé le … ». `IndicateurSauvegarde` (haut de l'écran) affiche « … enregistrés dans ce navigateur… ».
2. **Rappel périodique (tous navigateurs)** — Activer « Sauvegarde automatique », intervalle 5 min (ou ajuster temporairement en console pour un test rapide) ; attendre : un toast d'avertissement de rappel apparaît. Recharger la page : le réglage est conservé.
3. **Fichier actif (Chrome/Edge)** — Section « Fichier de sauvegarde actif » : cliquer « Choisir un fichier de sauvegarde », **annuler** → rien ne change. Recommencer et choisir un emplacement → « Fichier actif : … » s'affiche, toast de succès, le fichier existe sur disque avec le contenu attendu.
4. **Écriture manuelle sur fichier actif** — Modifier une donnée (ex. ajouter une personne), cliquer « Enregistrer une sauvegarde » : **aucun** téléchargement ne se déclenche, le fichier sur disque est mis à jour (rouvrir le fichier, vérifier le contenu), toast de succès.
5. **Écriture automatique silencieuse** — Avec un fichier actif et la sauvegarde automatique activée à une fréquence courte, attendre un cycle : le fichier sur disque se met à jour **sans aucun dialogue ni toast**, seule la date « Dernière écriture le … » du bloc change.
6. **Échec propre** — Supprimer le fichier actif dans l'explorateur, forcer une écriture (bouton ou attendre le tick) : un toast d'avertissement explique l'échec, le mode « fichier actif » se désactive proprement (le bloc repropose « Choisir un fichier »).
7. **Session** — Recharger la page : le fichier actif est redevenu inactif (comportement assumé et annoncé). Réactiver en un clic.
8. **Firefox/Safari (ou simulation)** — Le bloc « Fichier de sauvegarde actif » est absent ; le réglage de fréquence/rappel fonctionne normalement ; aucune erreur console.
9. **Non-régression** — Restaurer une sauvegarde, effacer toutes les données (`BlocSauvegarde` existant) : comportement inchangé.
10. **Réseau** — Onglet Réseau des DevTools ouvert pendant toutes les étapes ci-dessus : aucune requête sortante.
11. **Build** — `npm run build` réussit.

## 12. Décisions à confirmer / risques

1. **Arbitrage central — File System Access API en amélioration progressive, handle en mémoire pour la session (recommandé), vs téléchargement classique + rappels seuls.** C'est la décision la plus structurante de cette feature (détaillée §1). Options :
   - **(a) Recommandée** : File System Access API sur Chrome/Edge (fichier actif, réécriture silencieuse, détection d'annulation), repli rappel-seul ailleurs ; handle **non persisté** entre sessions (pas d'IndexedDB).
   - **(b) File System Access API + persistance du handle via IndexedDB** : conserverait le fichier actif d'une session à l'autre, mais introduit une **nouvelle brique de stockage** (écart à [ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md), à acter explicitement) et une re-demande de permission pas garantie silencieuse au retour — complexité significativement plus élevée pour un gain incertain (l'utilisateur doit de toute façon parfois re-confirmer). **Non retenue par l'architecte**, mais reste une option si le porteur juge la re-sélection par session trop pénible à l'usage.
   - **(c) Téléchargement classique uniquement (aucune File System Access API)** : le plus simple et universel, mais **ne peut pas** corriger G11 (aucune détection d'annulation possible) et ne peut réaliser G13 que sous forme de rappel (pas de sauvegarde automatique réelle sans multiplier les fichiers dans le dossier Téléchargements). **Non retenue par l'architecte** si une correction réelle de G11 est un objectif explicite du porteur.
   - **Cette décision doit être confirmée par le porteur avant la Tâche 2.** La Tâche 1 (wording + rappel universel) est indépendante et peut être livrée quel que soit ce choix.
2. **Une ADR dédiée est nécessaire** (`docs/adr/0018-strategie-sauvegarde-fichier.md`, numéro à confirmer selon l'état de `docs/adr/` au moment de la rédaction) — non rédigée par ce plan (l'architecte ne modifie pas les ADR sans mandat explicite). À produire une fois l'arbitrage tranché.
3. **Mise à jour de [ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (suivi).** Cette ADR ne mentionne pas aujourd'hui l'automatisation ni la File System Access API ; un court paragraphe de suivi y renvoyant vers la nouvelle ADR serait cohérent — hors périmètre de ce plan, à signaler au porteur.
4. **Fréquences proposées (5/10/15/30/60 min) — à confirmer.** Liste fermée choisie par commodité (`<select>`, pas de saisie libre) ; ajustable sans impact structurel.
5. **Pas de toast de succès à chaque écriture automatique silencieuse (retenu, à confirmer).** Pour éviter la lassitude d'un toast toutes les 5-15 minutes ; seul un échec est notifié. Alternative : un toast succès discret et très bref à chaque écriture — écarté par défaut (bruit), mais réversible si le porteur préfère plus de visibilité.
6. **`desactiverSauvegardeFichier` sans confirmation (retenu, mineur).** N'efface aucune donnée (juste un lien pratique vers un fichier) : jugé non destructeur, donc pas de `DialogueConfirmation`. À confirmer si le porteur préfère par prudence une confirmation légère.
7. **Première écriture immédiate lors de l'activation du fichier (retenu).** `activerSauvegardeFichier` écrit tout de suite après le choix du fichier (cohérent avec l'intention explicite de l'utilisateur qui vient de choisir un emplacement de sauvegarde) — pas de confirmation supplémentaire nécessaire.
8. **Pas de suivi de « données modifiées depuis la dernière écriture » (retenu, KISS).** La sauvegarde automatique réécrit systématiquement le document complet à chaque tick, qu'il y ait eu des changements ou non (document petit, coût négligeable) — pas de logique de « dirty tracking » à maintenir.
