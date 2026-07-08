# Feature 008 — Sauvegarde import/export JSON

- **Statut** : À faire
- **Dépend de** : `002` (couche de persistance + store : le **backend** de cette feature — actions `exporter` / `importer` / `reinitialiser`, mutation `REPLACE_ALL`, `toSaveDocument`/`fromSaveDocument`/`verifierIntegrite`, `migrate` — est **déjà implémenté et fonctionnel**), `003` (écran **Paramètres du cabinet** : `ParametresView.vue`, ses sections `.parametres-section` et `IndicateurSauvegarde` déjà en place ; le plan `003` §16 a **explicitement différé « Export / import / réinitialisation » à la `008`, sur le même écran, en bloc séparé**). S'appuie sur les briques `DialogueConfirmation` / `IndicateurSauvegarde` (existant `004`), `dateUtil` et `src/domain/libelles.js`.
- **ADR liés** : [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (**cœur de la feature** : sauvegarde/partage par fichier JSON, remplacement atomique, migration + intégrité, rappel de sauvegarde), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière `storageRepository`, données locales à un seul navigateur), [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Options API + Vuex), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (horodatages ISO UTC, affichage FR via `dateUtil`), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + Bootstrap thémé, `alert`/`buttons`/`modal` déjà importés), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor).

## 1. Contexte & objectif

Les données d'Idelia (réglages du cabinet, équipe, tournées, absences, plannings) vivent **uniquement dans le navigateur** de l'utilisateur, derrière `storageRepository` ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)). Il n'y a **ni backend, ni compte, ni synchronisation** (règles d'or #1 et #11). Conséquence directe : sans action de l'utilisateur, un changement d'ordinateur, un nettoyage du navigateur ou une panne fait **tout perdre**. [ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) répond à ce risque : Idelia permet d'**exporter** l'intégralité des données dans un **fichier JSON** (filet de sécurité + transfert vers un autre poste + partage) et de le **réimporter** (migration éventuelle + validation d'intégrité + **remplacement total atomique**).

À l'issue de `002`, tout le **moteur** de cette feature existe déjà et est fonctionnel dans `src/store/index.js` : l'action `exporter` (téléchargement d'un fichier `idelia-sauvegarde-<date>.json`), l'action `importer` (lit un `File` **ou** une chaîne, `JSON.parse` protégé → `migrate` → `verifierIntegrite` → `REPLACE_ALL` + flush de persistance ; **ne lève jamais**, renvoie `{ ok, message, erreurs? }` avec des messages FR prêts à afficher ; **rien n'est modifié en cas d'échec**), et l'action `reinitialiser` (retour à l'état par défaut + `storageRepository.clear()`, la confirmation étant explicitement laissée à l'appelant). **Aucun écran ne les expose encore.**

La feature `008` livre donc **l'interface** de ces capacités, et rien d'autre : une **section « Sauvegarde »** ajoutée à l'écran Paramètres du cabinet, permettant à un utilisateur **peu à l'aise avec l'informatique** de (1) **enregistrer une sauvegarde** (bouton → téléchargement du fichier), (2) **restaurer une sauvegarde** (choix d'un fichier → **confirmation d'écrasement** → import → affichage clair du **résultat**, succès **ou** liste d'erreurs lisibles), (3) **effacer toutes les données** (retour à zéro, sous **confirmation forte**), et un **rappel de sauvegarde** ergonomique. Un court texte pédagogique rappelle que les données sont locales à ce navigateur et qu'une sauvegarde exportée est le **seul** moyen de les protéger et de les transférer.

**Hors périmètre `008`** (à ne pas implémenter ici) :

- **Toute (dé)sérialisation, migration, validation d'intégrité, persistance** : **déjà faites** dans le store/domaine/storage (`002`). L'UI **appelle** les actions et **affiche** leurs résultats — jamais de logique métier dans les composants (règle d'or #10), jamais d'accès `localStorage` hors `storageRepository` ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).
- **Fusion de deux sauvegardes** (merge) : `import = remplacement total`, jamais de fusion ([ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md)).
- **Migrations réelles** : `CURRENT_SCHEMA_VERSION = 1`, `MIGRATIONS = {}` (vide). Le pipeline existe ; aucune migration à écrire ici.
- **Sauvegarde automatique dans le cloud / planifiée**, **historique de sauvegardes**, **restauration partielle** (par module) : hors v1.
- **Persistance de la date de dernier export au-delà de la session** : le rappel s'appuie sur un état **volatil** (voir §4.2 et §12) ; on ne stocke pas de métadonnées d'export dans le `SaveDocument`.

## 2. Écrans concernés

Une seule route, déjà créée en `003` et confirmée par [07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md) (`name: 'parametres'`, path `/parametres`) :

| Route | Écran | Changement `008` |
|---|---|---|
| `/parametres` | **Paramètres du cabinet** | Ajout d'une **nouvelle section « Sauvegarde »** (dernier bloc de l'écran), rendue par un composant dédié `BlocSauvegarde`. Aucune modification des sections existantes (Identité, Jours d'ouverture, Créneaux, Rythme, Affichage). |

> Aucune route n'est ajoutée ni modifiée (`router` inchangé). Le choix de placer le bloc dans **Paramètres** (plutôt qu'un écran dédié) applique le renvoi explicite du plan `003` §16 : c'est un réglage/outil transverse du cabinet, peu fréquent, sa place est aux côtés des autres réglages.

**Expérience visée** (utilisateur non-technique) :

- La section porte un titre clair **« Sauvegarde »** (`<h2>`, cohérent avec les autres sections de l'écran) et s'ouvre sur **un court texte pédagogique** expliquant, en langage humain, que **les données sont enregistrées uniquement dans ce navigateur** et qu'**une sauvegarde est le seul moyen de les protéger ou de les transférer** (cœur de l'[ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md)).
- Un **rappel de sauvegarde** visible : tant qu'aucune sauvegarde n'a été enregistrée depuis l'ouverture de l'application, un message incite à le faire (« Pensez à enregistrer une sauvegarde régulièrement… ») ; après un enregistrement, il indique **quand** (« Dernière sauvegarde enregistrée le … »).
- **Trois actions clairement séparées**, chacune avec un libellé humain, une icône et une courte phrase d'explication :
  - **« Enregistrer une sauvegarde »** (action principale, `btn btn-primary`) → télécharge un fichier `.json` que l'utilisateur range où il veut. Aucun risque, aucun écrasement.
  - **« Restaurer une sauvegarde »** (`btn btn-outline-secondary`) → ouvre le sélecteur de fichier, puis **demande confirmation** avant de **remplacer toutes les données actuelles**, puis affiche un **résultat explicite** : succès (« Sauvegarde restaurée… ») ou **erreurs listées en clair** (« Fichier illisible… », « La sauvegarde contient des incohérences » + détail), **sans jamais planter** et **sans rien modifier** en cas d'échec.
  - **« Effacer toutes les données »** (`btn btn-outline-danger`, geste dangereux, à l'écart des deux autres) → **confirmation forte** (bouton rouge) rappelant que l'action est **définitive** et invitant à sauvegarder d'abord.
- **Feedback permanent** : après une restauration ou un effacement réussis, l'`IndicateurSauvegarde` de l'écran confirme l'enregistrement, et un **encart de résultat** dédié (icône + texte) confirme l'issue de l'import. Après une restauration ou un effacement, **le formulaire de réglages affiché se met à jour tout seul** (pas de valeurs périmées, pas besoin de recharger la page — voir §6.4).

## 3. Modèle de données touché

**Aucune entité métier, aucun champ, aucune migration.** La feature n'introduit **aucune** structure de données persistée : elle **consomme** le `SaveDocument` déjà défini ([03-modele-de-donnees](../docs/architecture/03-modele-de-donnees.md), `src/domain/schema.js`) via les actions existantes. `CURRENT_SCHEMA_VERSION` reste `1`.

Seul ajout d'état, **volatil et non persisté** (module `ui`, jamais inclus dans `REPLACE_ALL` ni dans le `SaveDocument`, ignoré par le plugin de persistance) : un horodatage `dernierExportLe` servant **uniquement** au rappel de sauvegarde (§4.2). Il ne fait partie **d'aucun** fichier exporté/importé.

## 4. Store (Vuex)

### 4.1 Actions/mutations racines — DÉJÀ EN PLACE, NE RIEN RÉIMPLÉMENTER

Tout le socle vit **déjà** dans `src/store/index.js` (`002`) et est **réutilisé tel quel** ([04-gestion-etat-vuex](../docs/architecture/04-gestion-etat-vuex.md)). Rappel des contrats consommés par l'UI :

- **`exporter({ state })`** (synchrone) : `toSaveDocument(state)` → `JSON.stringify(doc, null, 2)` → `Blob` `application/json` → `<a download="idelia-sauvegarde-<AAAA-MM-JJ>.json">` cliqué → `URL.revokeObjectURL`. **Ne renvoie rien** ; côté client uniquement, aucune webapi. L'UI la `dispatch` sans argument.
- **`importer({ commit, state }, fichierOuTexte)`** (async) → **`Promise<{ ok: boolean, message: string, erreurs?: string[] }>`** : accepte un **`File`** (via `.text()`) **ou** une **chaîne JSON**. `JSON.parse` protégé → `migrate(doc)` (peut renvoyer `{ ok:false, message }` si version **trop récente**) → `verifierIntegrite(doc)` (renvoie `erreurs[]` FR si incohérences) → si tout est bon : `commit('REPLACE_ALL', fromSaveDocument(doc))` + flush **immédiat** de la persistance + statut `ENREGISTRE`. **Ne lève jamais.** En cas d'échec (fichier illisible, JSON invalide, version future, incohérences) : renvoie `{ ok:false, ... }` et **rien n'est modifié**. L'UI **doit `await`** le résultat et l'afficher tel quel (messages déjà en français).
- **`reinitialiser({ commit })`** (async) : `commit('REPLACE_ALL', etatParDefaut())` + `storageRepository.clear()`. **La confirmation utilisateur est explicitement laissée à l'appelant** (l'UI, §6.2). L'UI la `dispatch` sans argument.
- **`REPLACE_ALL(state, etatRacine)`** : hydratation atomique de tous les modules persistés (jamais `ui`).
- État racine **lu** (jamais muté par l'UI) : `state.statutSauvegarde` (`INACTIF|EN_COURS|ENREGISTRE|ERREUR|ERREUR_CHARGEMENT`) et `state.derniereSauvegarde` (ISO UTC) — pour `IndicateurSauvegarde`, via `mapState(['statutSauvegarde','derniereSauvegarde'])`.

> Ces actions sont **racines** (module non namespacé) : l'UI les appelle via `...mapActions(['exporter', 'importer', 'reinitialiser'])`.

### 4.2 Module `ui` — SEULE modification store de la feature (suivi d'export volatil)

Pour alimenter le **rappel de sauvegarde** ([ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) : « nécessite un rappel ergonomique fort — “dernière sauvegarde le…” »), on enrichit le module **volatil** `src/store/modules/ui.js` (namespaced, jamais persisté, jamais hydraté, ignoré par le plugin de persistance — voir son en-tête). Ajout **minimal** :

- **state** : `dernierExportLe: null` — horodatage ISO UTC du dernier **export** (« Enregistrer une sauvegarde ») lancé **durant la session courante**. `null` au démarrage et après chaque rechargement (volatil, assumé — §12).
- **mutation** `SET_DERNIER_EXPORT(state, iso)` : `state.dernierExportLe = iso`.
- **action** `enregistrerExport({ commit })` : `commit('SET_DERNIER_EXPORT', new Date().toISOString())` — pose l'horodatage (convention identique à `SET_DERNIERE_SAUVEGARDE` du store racine ; `new Date().toISOString()` dans l'action, jamais dans le composant).

> **Pourquoi le module `ui` et pas la persistance ?** Le `derniereSauvegarde` racine reflète la **dernière écriture locale** (automatique, débouncée), **pas** le dernier **export fichier** : les confondre tromperait l'utilisateur (« sauvegardé » alors qu'aucun fichier n'a été téléchargé). Un état **volatil** dédié est le plus simple (KISS) et **honnête** : à chaque nouvelle session, le rappel repart sur « pensez à enregistrer une sauvegarde », ce qui est précisément le **nudge** voulu par l'ADR 0006. Persister cette date (via `storageRepository` ou le `SaveDocument`) alourdirait la couche de persistance pour un gain marginal — **écarté** (§12).

### 4.3 Persistance (déjà en place, rien à ajouter)

- `importer` **flush immédiatement** la persistance (pas de débounce) après `REPLACE_ALL`.
- `reinitialiser` appelle `storageRepository.clear()` ; le `commit('REPLACE_ALL', ...)` déclenche par ailleurs le plugin débouncé (réécriture de l'état par défaut) — comportement bénin (état par défaut), noté en §12.
- La mutation `ui/SET_DERNIER_EXPORT` est **ignorée** par le plugin (`mutation.type.startsWith('ui/')`) : aucun effet de persistance, aucun risque de boucle. **Aucun accès `localStorage`** ajouté nulle part.

## 5. Domaine (logique pure)

**Aucune fonction de domaine à créer ni à modifier.** Toute la logique pure requise existe déjà et est **réutilisée** :

- `src/domain/schema.js` : `toSaveDocument`, `fromSaveDocument`, `verifierIntegrite` (via les actions du store — l'UI ne les appelle **pas** directement).
- `src/storage/migrations.js` : `migrate`, `CURRENT_SCHEMA_VERSION` (via `importer`).
- `src/storage/storageRepository.js` : `save` / `clear` (via les actions).
- `src/domain/utils/dates.js` : **`dateUtil.formatHorodatageFr(iso)`** (« 8 juillet 2026 à 14:32 ») pour afficher la date du dernier export dans le rappel de sauvegarde. **Seul point d'accès autorisé à `Date`** côté affichage.

Il n'y a **aucun calcul métier** propre à cette feature : la seule « logique » de l'UI est l'enchaînement *ouvrir sélecteur → confirmer → dispatch → afficher résultat*, qui est de l'**orchestration d'UI**, pas de la logique de domaine.

## 6. Composants

Séparation conforme à [06-structure-du-code](../docs/architecture/06-structure-du-code.md) : les briques transverses sont **déjà** dans `components/communs/` ; le bloc spécifique va dans un nouveau dossier `components/parametres/` ; l'écran routé (`ParametresView`) l'orchestre.

### 6.1 Réutilisation directe (aucune modification)

- `src/components/communs/DialogueConfirmation.vue` — confirmation générique au-dessus de `ModaleBase` (props `visible`/`titre`/`message`/`libelleConfirmer`/`varianteConfirmer` ; événements `confirmer`/`annuler` ; **toute fermeture non explicite = `annuler`**, jamais une confirmation implicite). Réutilisé **deux fois** : avant **restauration** (écrasement) et avant **effacement** (variante `danger` dans les deux cas ; libellés « Restaurer » / « Tout effacer »).
- `src/components/communs/IndicateurSauvegarde.vue` — retour visuel de persistance (déjà présent dans `ParametresView`). Réutilisé tel quel ; l'écran met `aEdite = true` après une restauration/effacement réussis pour que l'indicateur annonce l'enregistrement (§6.4).
- `src/components/communs/ModaleBase.vue` — utilisé **indirectement** via `DialogueConfirmation` (aucun usage direct ici).
- `src/styles/_bootstrap.scss` — **aucun ajout requis** : `alert`, `buttons`, `modal`, `close`, `forms` sont **déjà** importés (`003`/`004`). Le résultat d'import est rendu en **icône + texte** dans un `alert alert-success` / `alert alert-danger` (pas seulement une couleur) ; les boutons en `btn`/`btn-primary`/`btn-outline-secondary`/`btn-outline-danger`. KISS confirmé.
- `src/domain/utils/dates.js` (`dateUtil.formatHorodatageFr`), `@phosphor-icons/vue` (icônes).

### 6.2 `src/components/parametres/BlocSauvegarde.vue` (**nouveau**)

Bloc autonome rendant la section « Sauvegarde ». Composant **conteneur** (fragment de vue) : il **dispatche** les actions racines existantes et **affiche** leurs résultats — **aucune logique métier** (la (dé)sérialisation/migration/intégrité/persistance vit dans le store/domaine/storage). Émet un unique événement vers son parent pour lui signaler un remplacement de données.

- **Props** : aucune (lit le store).
- **Événements** : **`donnees-remplacees`** — émis après une **restauration réussie** ou un **effacement réussi**, pour que `ParametresView` réhydrate son brouillon de réglages (§6.4). Aucun payload nécessaire.
- **Accès store** :
  - `...mapState(['statutSauvegarde', 'derniereSauvegarde'])` (pour `IndicateurSauvegarde` — **ou** on laisse l'indicateur au parent, voir §6.4 ; recommandé : l'indicateur reste **dans `ParametresView`**, le bloc n'a pas besoin de le dupliquer).
  - `...mapState('ui', ['dernierExportLe'])` (rappel de sauvegarde).
  - `...mapActions(['exporter', 'importer', 'reinitialiser'])` (actions racines) et `...mapActions('ui', ['enregistrerExport'])`.
- **État local** (`data`) :
  - `fichierEnAttente` (File|null) — fichier choisi, en attente de confirmation d'écrasement.
  - `confirmationImportVisible` (Boolean) et `confirmationResetVisible` (Boolean) — visibilité des deux confirmations (deux `DialogueConfirmation`, ou une seule paramétrée — recommandé : **deux**, plus simple à lire).
  - `importEnCours` (Boolean) — désactive les boutons + affiche « Restauration en cours… » pendant l'`await`.
  - `resultatImport` ({ ok, message, erreurs? }|null) — dernier résultat d'import à afficher (remis à `null` quand on relance une restauration).
- **Refs** : `inputFichier` (l'`<input type="file">` masqué).
- **Structure & comportements** :
  1. **Texte pédagogique** (en tête) : court paragraphe « Vos données sont enregistrées uniquement dans ce navigateur, sur cet ordinateur — elles ne sont envoyées nulle part. Pour ne pas les perdre (changement d'ordinateur, panne, nettoyage du navigateur) ou pour les transférer sur un autre poste, enregistrez régulièrement une sauvegarde : c'est un fichier que vous conservez et que vous pouvez restaurer plus tard. » (icône `PhInfo`/`PhShieldCheck`, doublée du texte).
  2. **Rappel de sauvegarde** (`role="status"`, `aria-live="polite"`) : si `dernierExportLe` est `null` → « Aucune sauvegarde enregistrée depuis l'ouverture de l'application. Pensez à en enregistrer une régulièrement. » ; sinon → « Dernière sauvegarde enregistrée le {{ dateUtil.formatHorodatageFr(dernierExportLe) }}. » Icône + texte (jamais la seule couleur).
  3. **Enregistrer une sauvegarde** : bouton **principal** `btn btn-primary` (icône `PhFloppyDisk` ou `PhDownloadSimple` — le développeur confirme dans `@phosphor-icons/vue`) + phrase d'aide (« Télécharge un fichier de sauvegarde que vous rangez où vous voulez. »). Au clic (`onEnregistrer`) : `this.exporter()` puis `this.enregistrerExport()` (met à jour le rappel). Aucun risque → **pas de confirmation**.
  4. **Restaurer une sauvegarde** : bouton `btn btn-outline-secondary` (icône `PhUploadSimple`) + phrase d'aide (« Remplace toutes les données actuelles par celles d'un fichier de sauvegarde. »). Un **`<input type="file" accept="application/json,.json">` masqué** (`ref="inputFichier"`, `class="visually-hidden"` ou `d-none`, déclenché par le bouton). Enchaînement :
     - Au clic sur le bouton → `this.$refs.inputFichier.click()`.
     - `@change` (`onFichierChoisi(event)`) : récupérer `event.target.files[0]` ; si absent (annulation OS) → ne rien faire ; sinon stocker dans `fichierEnAttente`, **réinitialiser l'input** (`event.target.value = ''`, pour permettre de re-choisir le **même** fichier ensuite), remettre `resultatImport = null`, puis ouvrir `confirmationImportVisible = true`.
     - **Confirmation** (`DialogueConfirmation`, `varianteConfirmer="danger"`, `libelleConfirmer="Restaurer"`) : titre « Restaurer une sauvegarde ? », message « Cette action **remplacera toutes les données actuelles** (réglages, équipe, tournées, absences, plannings) par celles du fichier « {{ fichierEnAttente?.name }} ». Les données actuelles seront perdues si vous ne les avez pas déjà enregistrées. Voulez-vous continuer ? ».
     - `onConfirmerImport` : `confirmationImportVisible = false`, `importEnCours = true` ; `const resultat = await this.importer(this.fichierEnAttente)` ; `this.resultatImport = resultat` ; `importEnCours = false` ; `fichierEnAttente = null` ; **si `resultat.ok`** → `this.$emit('donnees-remplacees')`.
     - `onAnnulerImport` : `confirmationImportVisible = false`, `fichierEnAttente = null` (aucune modification).
     - **Affichage du résultat** (`resultatImport`) sous les boutons : si `ok` → `alert alert-success` (icône `PhCheckCircle`) « Sauvegarde restaurée. Vos données ont été remplacées. » ; sinon → `alert alert-danger` (icône `PhWarning`) avec `resultatImport.message` et, si `resultatImport.erreurs?.length`, une `<ul>` listant chaque erreur **en clair**. Zone `role="status"` / `aria-live="polite"` (l'issue est annoncée aux lecteurs d'écran).
  5. **Effacer toutes les données** : présenté **à l'écart** (séparateur, ou en bas), bouton `btn btn-outline-danger` (icône `PhTrash`) + phrase d'aide (« Supprime définitivement toutes les données de ce navigateur et repart de zéro. »). Au clic → `confirmationResetVisible = true`. **Confirmation forte** (`DialogueConfirmation`, `varianteConfirmer="danger"`, `libelleConfirmer="Tout effacer"`) : titre « Tout effacer ? », message « Cette action **supprime définitivement** toutes vos données (réglages, équipe, tournées, absences, plannings) de ce navigateur. Elle **ne peut pas être annulée**. Pour en garder une copie, enregistrez d'abord une sauvegarde. Voulez-vous vraiment tout effacer ? ». `onConfirmerReset` : `confirmationResetVisible = false` ; `await this.reinitialiser()` ; `resultatImport = null` ; `this.$emit('donnees-remplacees')`. `onAnnulerReset` : ferme sans agir.
- **Désactivation** : pendant `importEnCours`, désactiver les trois boutons et afficher un libellé « Restauration en cours… » (feedback ; l'import est rapide mais l'`await` couvre la lecture du fichier).
- **Icônes** : `PhInfo`/`PhShieldCheck` (pédagogie), `PhFloppyDisk`/`PhDownloadSimple` (enregistrer), `PhUploadSimple` (restaurer), `PhTrash` (effacer), `PhCheckCircle` (succès), `PhWarning` (erreur/rappel). Toutes **doublées d'un libellé** (jamais d'icône seule porteuse de sens).
- **SCSS `scoped`** : minimal — espacement des trois blocs d'action, séparation visuelle du bloc « Effacer » (danger), boutons/inputs à `min-height: t.$cible-cliquable-min`. Tokens/mixins uniquement, cibles ~44 px, focus visible.

> **Pas de Vuelidate ici** : le seul « champ » est un `<input type="file">`. La **validation** du contenu est **entièrement** assurée par l'action `importer` (parse + `migrate` + `verifierIntegrite`) et **surfacée telle quelle** (`message` + `erreurs[]`). Aucune règle déclarative à écrire (§7).

### 6.3 `src/views/ParametresView.vue` (**modification légère**)

Ajout d'une **dernière** `<section class="parametres-section">` intitulée `<h2>Sauvegarde</h2>` **hors du `<form>`** existant (la sauvegarde n'est pas un réglage saisi mais une action ; la placer hors `<form novalidate>` évite toute interaction avec la soumission). Elle monte `<BlocSauvegarde @donnees-remplacees="onDonneesRemplacees" />`.

- **Import & enregistrement** : ajouter `BlocSauvegarde` aux `components`.
- **Handler `onDonneesRemplacees()`** : après une restauration/effacement, le `brouillon` local (copié depuis `this.parametres` en `created`) est **périmé** ; le réhydrater : `this.brouillon = { ...this.parametres }`, réinitialiser la validation (`this.v$.$reset()`), et `this.aEdite = true` (pour que l'`IndicateurSauvegarde` annonce l'enregistrement). Ainsi le formulaire de réglages **reflète immédiatement** les nouvelles données (réglages restaurés, ou valeurs par défaut après effacement) **sans rechargement de page**.
- **Aucune autre modification** des sections/validations existantes.

### 6.4 Où vit l'indicateur de sauvegarde

`IndicateurSauvegarde` **reste dans `ParametresView`** (déjà en place, en haut de l'écran) : inutile de le dupliquer dans `BlocSauvegarde`. Après une restauration/effacement, `onDonneesRemplacees` met `aEdite = true` → l'indicateur passe à « Modifications enregistrées le … ». L'**issue précise de l'import** (succès **ou** erreurs) est portée par l'**encart de résultat** propre à `BlocSauvegarde` (plus explicite que l'indicateur générique).

## 7. Règles de validation

**Aucune règle Vuelidate.** La seule entrée est un fichier ; sa validité (lisibilité, JSON valide, version de schéma supportée, intégrité référentielle) est **intégralement** vérifiée par l'action `importer` (`002`) et **restituée** à l'utilisateur via `{ message, erreurs? }`. L'UI se contente de :

- Filtrer les types côté sélecteur (`accept="application/json,.json"`) — confort, non bloquant : l'utilisateur peut toujours forcer un autre fichier, et `importer` le gère proprement.
- **Afficher** le message et la liste d'erreurs **tels quels** (déjà en français, orientés utilisateur), sans les reformuler ni les tronquer.

Messages FR **fournis par le backend** (rappel, pour vérification) : « Impossible de lire le fichier fourni. » · « Fichier illisible : ce n'est pas un JSON valide. » · (message de `migrate` si version trop récente) · « La sauvegarde contient des incohérences. » (+ `erreurs[]`) · « Import réussi. »

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Langage humain, zéro jargon** : « Sauvegarde », « Enregistrer une sauvegarde », « Restaurer une sauvegarde », « Effacer toutes les données ». **Éviter** « Exporter » / « Importer » / « Réinitialiser » / « JSON » dans les **libellés de boutons** (le mot « fichier » et « .json » peuvent apparaître dans les textes d'aide, à titre informatif). Décision et justification en §12.
- **Pédagogie d'entrée de section** : expliquer **pourquoi** sauvegarder (données locales à ce navigateur, seul filet de sécurité) — beaucoup d'utilisateurs ignorent que « tout est dans le navigateur ». C'est l'exigence centrale de l'[ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md).
- **Rappel de sauvegarde visible** : nudge tant qu'aucune sauvegarde n'a été enregistrée dans la session ; date lisible ensuite (`formatHorodatageFr`). Jamais anxiogène, toujours actionnable.
- **Hiérarchie d'actions claire** : « Enregistrer une sauvegarde » **dominante** (primary) car sans risque ; « Restaurer » secondaire ; « Effacer » **isolée** et en style danger (outline) pour éviter le clic accidentel.
- **Confirmation avant tout écrasement/perte** : la **restauration** (remplacement total) **et** l'**effacement** passent par une `DialogueConfirmation` en langage clair, bouton **rouge**, rappelant la perte de données et invitant à sauvegarder d'abord. Aucune perte silencieuse.
- **Résultat toujours explicite, jamais un plantage** : succès (message + icône `PhCheckCircle`) ou **erreurs listées en clair** (message + `<ul>` + icône `PhWarning`). En cas d'échec, **rien n'est modifié** — le message le dit implicitement (« La sauvegarde contient des incohérences » → les données actuelles restent).
- **Statut/erreurs jamais par la seule couleur** : chaque encart est **icône + texte** ; la couleur (succès/danger) ne fait que **compléter** (daltoniens, impression — [ADR 0013](../docs/adr/0013-icones-phosphor.md)).
- **Réversibilité de l'intention** : toute confirmation est annulable (Annuler, `Échap`, croix, clic hors fenêtre = **Annuler**, jamais une validation implicite — comportement natif de `DialogueConfirmation`).
- **Ré-sélection du même fichier possible** : l'`<input type="file">` est réinitialisé après chaque choix (sinon, re-choisir le même fichier après une annulation ne déclencherait pas `change`).
- **Feedback d'attente** : boutons désactivés + « Restauration en cours… » pendant l'`await` (même bref).
- **Pas de valeurs périmées** : après restauration/effacement, l'écran Paramètres se met à jour tout seul (réhydratation du brouillon) — l'utilisateur **voit** le changement sans recharger.
- **Accessibilité** : `label`/texte associé à chaque bouton, `<input type="file">` masqué mais déclenché par un vrai bouton étiqueté, zones de résultat/rappel en `aria-live="polite"`, modales de confirmation à focus piégé et retour du focus à l'ouvrant (fournis par `ModaleBase`), cibles ~44 px, focus clavier visible.
- **Cohérence** : mêmes patterns que `003`/`004`/`006`/`007` (confirmation destructive rouge, indicateur de sauvegarde, icône + texte) — l'utilisateur retrouve des gestes connus.

## 9. Étapes d'implémentation

Découpage en **2 tâches**, chacune destinée à **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé : **T1 → T2** (le bloc et son suivi d'export d'abord ; puis son intégration dans l'écran).

### Tâche 1 — Suivi d'export volatil (module `ui`) + composant `BlocSauvegarde.vue`

**Fichiers** :
- `src/store/modules/ui.js` (**modifier**) — ajouter `state.dernierExportLe: null`, mutation `SET_DERNIER_EXPORT(state, iso)`, action `enregistrerExport({ commit })` posant `new Date().toISOString()` (§4.2). Conserver le reste (module namespaced, volatil).
- `src/components/parametres/BlocSauvegarde.vue` (**créer**) — texte pédagogique + rappel de sauvegarde + trois actions (Enregistrer / Restaurer / Effacer) + deux `DialogueConfirmation` + encart de résultat d'import, dispatchant `exporter` / `importer` / `reinitialiser` / `ui/enregistrerExport`, émettant `donnees-remplacees` (§6.2). Aucune logique métier ; aucun accès `localStorage` ; dates via `dateUtil.formatHorodatageFr`.

**Dépend de** : actions racines + module `ui` (`002`), briques `DialogueConfirmation` (`004`), `dateUtil` (`002`).

**Critères de sortie** :
- **Store `ui`** : `dispatch('ui/enregistrerExport')` renseigne `state.ui.dernierExportLe` avec un ISO UTC non vide ; la mutation `SET_DERNIER_EXPORT` **ne déclenche aucune écriture de persistance** (mutation `ui/*` ignorée par le plugin) ; `dernierExportLe` **n'apparaît pas** dans le fichier exporté (non persisté, hors `toSaveDocument`).
- **Enregistrer** : le bouton « Enregistrer une sauvegarde » `dispatch('exporter')` (téléchargement d'un `idelia-sauvegarde-<date>.json`) puis `dispatch('ui/enregistrerExport')` ; le rappel passe de « Pensez à enregistrer… » à « Dernière sauvegarde enregistrée le … » (date FR lisible).
- **Restaurer** : choisir un fichier **valide** → **confirmation** (bouton rouge, nom du fichier affiché) → à la confirmation, `await importer(file)` → encart **succès** vert (icône + texte) et événement `donnees-remplacees` émis. Choisir un fichier **invalide** (JSON cassé, incohérent, version future) → encart **erreur** rouge affichant le `message` et, le cas échéant, la **liste `erreurs`** ; **`donnees-remplacees` non émis** ; aucun plantage. **Annuler** la confirmation → rien ne change, `fichierEnAttente` remis à `null`. Après un choix, re-choisir **le même fichier** relance bien le flux (input réinitialisé).
- **Effacer** : « Effacer toutes les données » → **confirmation forte** (rouge, texte définitif) → à la confirmation, `await reinitialiser()` puis `donnees-remplacees` émis. Annuler → rien.
- **Ergonomie** : trois boutons distincts (primary / outline-secondary / outline-danger) ; icônes doublées d'un libellé ; encarts résultat/rappel en `aria-live` ; input fichier masqué mais déclenché par un bouton étiqueté ; boutons désactivés pendant l'import.
- Aucun accès `localStorage` ; aucun objet `Date` hors `dateUtil` (sauf `new Date().toISOString()` dans l'action `ui`) ; aucune logique métier dans le composant ; `npm run build` réussit.

### Tâche 2 — Intégration de la section « Sauvegarde » dans `ParametresView.vue`

**Fichiers** :
- `src/views/ParametresView.vue` (**modifier**) — ajouter la `<section class="parametres-section"><h2>Sauvegarde</h2><BlocSauvegarde @donnees-remplacees="onDonneesRemplacees" /></section>` **hors** du `<form>` ; enregistrer le composant ; ajouter le handler `onDonneesRemplacees()` (réhydrate `brouillon` depuis `this.parametres`, `v$.$reset()`, `aEdite = true`) (§6.3). Ne pas toucher aux sections/validations existantes.

**Dépend de** : T1 (`BlocSauvegarde`).

**Critères de sortie** :
- La section « Sauvegarde » apparaît en **bas** de l'écran Paramètres, après « Affichage », avec le bloc complet fonctionnel.
- Après une **restauration réussie** d'une sauvegarde dont les réglages diffèrent de l'affichage courant, **les champs du formulaire (nom, jours, créneaux, rythme, premier jour) se mettent à jour tout seuls** (brouillon réhydraté), sans erreur de validation résiduelle, sans rechargement ; l'`IndicateurSauvegarde` annonce l'enregistrement.
- Après un **effacement**, le formulaire affiche les **valeurs par défaut** (réglages réinitialisés).
- Les sections existantes restent inchangées et fonctionnelles ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] L'écran **Paramètres du cabinet** (`/parametres`) présente une **section « Sauvegarde »** avec un **texte pédagogique** (données locales à ce navigateur, sauvegarde = seul filet de sécurité) et un **rappel de sauvegarde**.
- [ ] **Enregistrer une sauvegarde** télécharge un fichier `idelia-sauvegarde-<date>.json` contenant l'intégralité des données ; le **rappel** passe alors à « Dernière sauvegarde enregistrée le … » (date FR).
- [ ] **Restaurer une sauvegarde** : le choix d'un fichier ouvre une **confirmation** (bouton rouge) rappelant le **remplacement total** ; à la confirmation, les données sont remplacées et un **encart de succès** (icône + texte) s'affiche.
- [ ] Un fichier **illisible / JSON invalide / de version trop récente / incohérent** produit un **encart d'erreur** clair (message + liste d'erreurs le cas échéant), **sans planter**, et **sans modifier** les données actuelles.
- [ ] Après restauration/effacement, **le formulaire de réglages reflète immédiatement** les nouvelles valeurs (pas de valeurs périmées, pas besoin de recharger).
- [ ] **Effacer toutes les données** exige une **confirmation forte** (bouton rouge, texte définitif) invitant à sauvegarder d'abord ; à la confirmation, les données sont effacées et l'écran repart des **valeurs par défaut**.
- [ ] **Recharger la page** après une restauration restitue les données restaurées ; après un effacement, restitue l'état par défaut (persistance/clear effectifs).
- [ ] Ré-sélectionner **le même fichier** après une annulation relance bien la confirmation (input réinitialisé).
- [ ] Vocabulaire **humain** dans les libellés (« Enregistrer / Restaurer une sauvegarde », « Effacer toutes les données ») ; statut/résultat **jamais par la seule couleur** (icône + texte) ; confirmations annulables (Annuler / `Échap` / clic hors fenêtre) sans validation implicite.
- [ ] Modales de confirmation à focus piégé et retour du focus à l'ouvrant ; boutons ~44 px ; focus clavier visible ; zones de résultat/rappel en `aria-live`.
- [ ] Le suivi d'export vit dans le module **`ui` volatil** (`dernierExportLe`), **jamais persisté**, **absent du fichier exporté**.
- [ ] Aucun accès direct à `localStorage` ; aucune (dé)sérialisation/migration/intégrité dans les composants (tout via les actions du store) ; aucun objet `Date` manipulé hors `dateUtil`/`toISOString`.
- [ ] `npm run build` réussit.

## 11. Vérification

Parcours manuel (`npm run dev`, ouvrir `/parametres`) :

1. **Pré-requis** — Avoir quelques données (créer 1-2 personnes via `/equipe`, une tournée via `/tournees`, une absence via `/absences`, et régler quelques paramètres).
2. **Section & pédagogie** — Sur `/parametres`, faire défiler jusqu'à « Sauvegarde » : vérifier le texte pédagogique et le **rappel** initial (« Aucune sauvegarde enregistrée depuis l'ouverture… », car `dernierExportLe` est `null` en début de session).
3. **Enregistrer** — Cliquer « Enregistrer une sauvegarde » : un fichier `idelia-sauvegarde-AAAA-MM-JJ.json` se télécharge. Le rappel passe à « Dernière sauvegarde enregistrée le … » (date/heure FR). Ouvrir le fichier : c'est du JSON lisible avec `schemaVersion`, `cabinet`, `personnes`, `tournees`, `absences`, `plannings` ; **aucun** champ `dernierExportLe`.
4. **Modifier puis restaurer** — Changer un réglage (ex. nom du cabinet) et supprimer une personne. Cliquer « Restaurer une sauvegarde », choisir le fichier téléchargé à l'étape 3 : la **confirmation** apparaît (bouton rouge, nom du fichier). Confirmer → encart **succès** ; le nom du cabinet et la personne supprimée **réapparaissent** dans les écrans, et **le formulaire Paramètres affiche à nouveau** les valeurs sauvegardées **sans rechargement**.
5. **Annulation de restauration** — Relancer « Restaurer », choisir un fichier, puis **Annuler** la confirmation → rien ne change. Re-cliquer « Restaurer » et re-choisir **le même fichier** → la confirmation réapparaît (input bien réinitialisé).
6. **Fichier invalide** — Créer un `.txt` renommé `.json` contenant `ceci n'est pas du json`, tenter de le restaurer et confirmer → encart **erreur** « Fichier illisible : ce n'est pas un JSON valide. », **aucune** donnée modifiée. Essayer un JSON valide mais incohérent (ex. une absence pointant un `personneId` inexistant) → « La sauvegarde contient des incohérences. » + liste d'erreurs. Essayer un JSON avec `schemaVersion` supérieur (ex. `999`) → message de version trop récente. Dans les trois cas, les données actuelles **restent intactes**.
7. **Effacer** — Cliquer « Effacer toutes les données » → confirmation forte (rouge). Annuler → rien. Confirmer → toutes les données disparaissent, le formulaire Paramètres repasse aux **valeurs par défaut**, les écrans Équipe/Tournées/Absences sont vides.
8. **Persistance** — Après restauration puis rechargement (`F5`) : les données restaurées sont toujours là (`JSON.parse(localStorage.getItem('idelia:data'))` cohérent). Après effacement puis rechargement : état par défaut (storage effacé, `bootstrap` → défauts).
9. **Accessibilité / clavier** — Naviguer au clavier jusqu'aux trois boutons (focus visible) ; ouvrir une confirmation, `Tab` (focus piégé), `Échap` (annule, focus rendu à l'ouvrant) ; vérifier que les encarts de résultat/rappel sont annoncés (`aria-live`).
10. **Build** — `npm run build` réussit sans erreur.

## 12. Décisions à confirmer / risques

1. **Emplacement UI : section « Sauvegarde » dans `ParametresView` via un composant dédié `BlocSauvegarde` (retenu)** — **Retenu** plutôt qu'un écran/route dédié : applique le renvoi explicite du plan `003` §16 (« même écran, bloc séparé »), garde les réglages/outils du cabinet au même endroit, et évite d'ajouter une route pour un usage peu fréquent. **Composant dédié** (`components/parametres/BlocSauvegarde.vue`) plutôt qu'un gros bloc inline dans la vue : encapsule l'état local (fichier en attente, confirmations, résultat d'import), reste **testable/relisible** et n'alourdit pas `ParametresView`. **À confirmer.**
2. **Vocabulaire « Enregistrer / Restaurer une sauvegarde » + « Effacer toutes les données » (retenu)** — **Retenu** plutôt que « Exporter / Importer / Réinitialiser » : le public cible est **non-technique**, et « sauvegarde / restaurer » décrit l'**intention** (protéger, remettre en état) sans jargon de fichier ; « effacer toutes les données » est plus parlant et plus prudent que « réinitialiser ». Les mots « fichier » / « .json » restent dans les **textes d'aide** (informatif). **À confirmer.**
3. **Rappel de sauvegarde via un état `ui` volatil `dernierExportLe` (option a, retenu)** — **Retenu** : le `derniereSauvegarde` racine = dernière **écriture locale**, **pas** le dernier **export fichier** ; les confondre serait trompeur. Un état **volatil** dans `ui` (réinitialisé à chaque session) est le plus simple (KISS) et **honnête** : à chaque ouverture, le nudge « pensez à enregistrer une sauvegarde » revient — précisément ce que demande l'[ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md). **Alternative écartée** : persister la date d'export (via `storageRepository` ou le `SaveDocument`), qui alourdirait la persistance pour un gain marginal et polluerait le format d'échange. **Nuance à assumer** : l'export ne confirme pas que l'utilisateur a bien **conservé** le fichier (le navigateur le place dans « Téléchargements ») ; le libellé « Dernière sauvegarde enregistrée le … » reste acceptable car le téléchargement est effectif. **À confirmer.**
4. **Réhydratation du brouillon Paramètres après remplacement, plutôt qu'un rechargement de page (retenu)** — **Retenu** : `BlocSauvegarde` émet `donnees-remplacees`, `ParametresView` recopie `this.brouillon = { ...this.parametres }` + `v$.$reset()`. C'est la **seule** vue montée (SPA mono-route), donc c'est suffisant et propre ; évite un `window.location.reload()` brutal qui effacerait aussi l'encart de succès. **Point de vigilance** : ne pas oublier ce ré-sync — sans lui, le formulaire afficherait des **valeurs périmées** après import/effacement (bug UX). **À confirmer** (alternative : `window.location.reload()` après restauration, plus simple mais moins agréable).
5. **Réinitialisation de l'`<input type="file">` (point de vigilance)** — Après chaque choix, remettre `input.value = ''`, sinon re-sélectionner **le même fichier** après une annulation ne redéclenche pas l'événement `change` (comportement natif du navigateur). Vérifié en §11 étape 5.
6. **`reinitialiser` : `clear()` + réécriture débouncée de l'état par défaut (comportement observé)** — `reinitialiser` fait `storageRepository.clear()` **et** `commit('REPLACE_ALL', etatParDefaut())` ; ce commit déclenche par ailleurs le plugin débouncé qui **réécrit** l'état par défaut ~400 ms plus tard. Résultat net : le storage contient l'état par défaut (équivalent à « vide »). **Bénin**, mais à connaître si l'on teste l'état de `localStorage` juste après l'effacement (il peut passer transitoirement par « effacé » puis « état par défaut sérialisé »). **Backend existant — hors périmètre `008`** ; noté pour information, à remonter si un comportement « storage réellement absent » était souhaité.
7. **Aucune migration réelle à écrire** — `MIGRATIONS = {}` et `CURRENT_SCHEMA_VERSION = 1` : le pipeline `migrate` est testé « à blanc » (import d'un fichier `schemaVersion: 1`). Le cas « version future » (refus) reste vérifiable en falsifiant `schemaVersion` à `999` (§11 étape 6). **RAS.**
8. **Une ou deux `DialogueConfirmation` (choix mineur laissé au dev)** — Recommandé : **deux** instances (import / effacement) avec leurs propres `visible`, plus lisibles ; une seule instance paramétrée par un `data` décrivant l'action en attente est acceptable si le dev préfère. **À confirmer** (sans enjeu).
