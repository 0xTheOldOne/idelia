# Feature 006 — Gestion des tournées

- **Statut** : Fait
- **Dépend de** : `002` (store persisté, module `tournees` squelette avec `state {items:[]}` + getters `byId`/`actives` + mutation `REPLACE`, `schema.js` avec l'entité `Tournee` et ses enums, plugin de persistance débouncé). S'appuie sur des briques déjà livrées en `004` (`ModaleBase`, `DialogueConfirmation`, `IndicateurSauvegarde`, `src/domain/libelles.js`, `dateUtil`, patron Vuelidate + sélecteur de couleur accessible de `FormulairePersonne`). **La tâche optionnelle T4 (réactivation de `PREFERENCE_TOURNEE`)** ajoute une dépendance à `004`/`005` — voir §9 et §12.
- **ADR liés** : [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Options API + Vuex), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière repository), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (domaine = module pur), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7, dates `"YYYY-MM-DD"`, **heures `"HH:mm"`**, horodatages ISO UTC), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + Bootstrap thémé, dont le composant modale), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor).

## 1. Contexte & objectif

Après l'équipe (`004`) et ses souhaits (`005`), le cabinet a besoin de décrire ses **tournées** : les circuits de soins récurrents, chacun avec ses **horaires**, son **créneau** (matin / après-midi / journée), les **jours de la semaine** où il s'applique et le **nombre de personnes requises**. Ces données sont, avec l'équipe et les absences, le troisième pilier de données de référence qui alimentera le **moteur de planification** (`009`) et la **génération** (`010`) : une affectation, c'est une personne sur une **tournée**, à une date, sur un créneau.

À l'issue de `002`, la collection `tournees` existe dans l'état (vide, persistée automatiquement) et son module Vuex expose déjà `byId`/`actives`/`REPLACE`, mais **aucun écran ne permet de la consulter ni de la modifier** : `TourneesView.vue` est un simple placeholder.

La feature `006` rend l'écran **Tournées** opérationnel pour le référent (public **peu à l'aise avec l'informatique**) : **lister, ajouter, modifier, archiver et restaurer** les tournées. Le CRUD est **quasi analogue** à celui des personnes (`004`) : liste de cartes, ajout/édition en modale, archivage réversible confirmé, sélecteur de couleur accessible. Chaque enregistrement valide est **persisté automatiquement** (plugin débouncé de `002`) avec un **retour visuel clair** réutilisant `IndicateurSauvegarde` (`003`/`004`). Les tournées archivées ne sont **jamais supprimées physiquement** (règle d'intégrité [02 §Intégrité](../docs/architecture/02-modele-de-domaine.md)) : elles restent référençables par les plannings historiques (features `010`+).

**Hors périmètre `006`** (à ne pas implémenter ici) :

- **Réordonnancement manuel** (`ordreAffichage`) par glisser-déposer — différé (le champ est initialisé mais non édité ; le tri d'affichage est alphabétique, voir §6). Même choix qu'en `004`.
- **Suppression définitive** d'une tournée — **interdite** par principe (soft-delete only via `archivee`, [02](../docs/architecture/02-modele-de-domaine.md)). Seul l'archivage (réversible) est proposé.
- **Affectations, planning, besoins calculés** (effectif requis vs affectations réelles) — features `009`/`010`+.
- Le type de souhait **`PREFERENCE_TOURNEE`** (préférer/éviter une tournée), différé par `005` faute de tournées : sa réactivation est **possible maintenant** mais **isolée dans une tâche optionnelle T4** clairement séparée du cœur du CRUD — voir §9 et la décision tranchée en §12.

## 2. Écrans concernés

Une seule route, déjà déclarée en `001` et confirmée par [07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md) (`name: 'tournees'`, path `/tournees`) :

| Route | Écran | Changement `006` |
|---|---|---|
| `/tournees` | **Tournées** | Remplace le placeholder par la **liste des tournées + le CRUD** (ajout/édition en modale, archivage/restauration). |

> Aucune route paramétrée n'est ajoutée ici. Aucune modification du `router` n'est nécessaire (la route existe déjà).

**Expérience visée** (utilisateur non-technique) :

- Un titre d'écran explicite (« Tournées ») et **une action principale dominante** : le bouton « Ajouter une tournée » (`btn btn-primary`, icône Phosphor), toujours visible en haut de l'écran.
- La **liste** est lisible : chaque tournée affiche une **pastille de couleur doublée du nom** (jamais la couleur seule), éventuellement son **code court**, son **créneau en clair** (« Matin »), ses **horaires** (« 08:00 – 12:00 »), ses **jours d'application en toutes lettres** (« Lundi, Mardi et Jeudi »), son **effectif requis** (« 2 personnes requises »), et — si renseignés — son **secteur** et sa **période de validité**.
- **État vide accueillant** : au premier lancement, un message chaleureux (« Aucune tournée pour l'instant. Ajoutez la première pour organiser les circuits de soins. ») avec le même gros bouton d'ajout.
- **Ajout / édition dans une modale** : une fenêtre claire s'ouvre par-dessus la liste (le contexte reste visible), avec les champs groupés logiquement, des **saisies natives** pour les horaires (`<input type="time">`) et les dates (`<input type="date">`), un **sélecteur de couleur ergonomique** (palette de suggestion du cabinet + choix libre), un bouton **« Enregistrer »** dominant et **« Annuler »** toujours disponible. Fermeture au clavier (Échap) et par clic hors de la fenêtre.
- **Archivage réversible et confirmé** : « Archiver » ouvre une **demande de confirmation** en langage clair expliquant que la tournée est **conservée** et **restaurable**. Une section repliée « Tournées archivées » permet de les revoir et de les **restaurer** en un clic (action sûre, sans confirmation).
- **Feedback permanent** : après chaque enregistrement/archivage/restauration, l'indicateur « Modifications enregistrées » confirme la persistance ; les erreurs de saisie s'affichent **sous le champ concerné**, en disant **quoi corriger**, sans jamais perdre la saisie.

## 3. Modèle de données touché

Entité **`Tournee`**, déjà décrite dans le modèle de domaine ([02 §Tournee](../docs/architecture/02-modele-de-domaine.md)) et présente en tant que collection racine `tournees.items` (vide) depuis `002`. **Aucune nouvelle structure, aucun nouveau champ, aucune migration.**

Champs de `Tournee` **manipulés** par `006` :

| champ | type | oblig. | rôle `006` |
|---|---|---|---|
| `id` | uuid | oui | généré à la création via `genId()` ; **immuable** |
| `nom` | string | oui | édité (requis) |
| `code` | string | non | édité (facultatif ; code court d'affichage) |
| `secteur` | string | non | édité (facultatif ; zone géographique, texte libre) |
| `creneau` | enum `CRENEAUX` (`MATIN`/`APRES_MIDI`/`JOURNEE`) | oui | édité (défaut `MATIN`) |
| `heureDebut` | `"HH:mm"` | oui | édité (requis) ; via `<input type="time">` |
| `heureFin` | `"HH:mm"` | oui | édité (requis) ; **> `heureDebut`** (comparaison lexicographique de chaînes) |
| `joursApplication` | number[1..7] | oui | édité (requis, **≥ 1 jour**) ; cases ISO, normalisé trié/dédupliqué |
| `nbPersonnesRequises` | integer ≥ 1 | oui | édité (défaut `1`) |
| `couleur` | string hex `#RRGGBB` | non | édité (défaut = 1re couleur de `couleursParDefaut`) |
| `archivee` | boolean | oui | **soft-delete** : `true` = archivée (défaut `false`) |
| `dateDebutValidite` | `"YYYY-MM-DD"` \| null | non | édité (facultatif ; tournée saisonnière) |
| `dateFinValidite` | `"YYYY-MM-DD"` \| null | non | édité (facultatif ; ≥ `dateDebutValidite`) |
| `ordreAffichage` | integer | non | initialisé, **non édité** (réordonnancement différé) |
| `notes` | string | non | édité (facultatif) |
| `createdAt` / `updatedAt` | ISO UTC | oui | posés/rafraîchis automatiquement (`new Date().toISOString()`) |

> **Convention de soft-delete confirmée** dans `schema.js` et [02 §Tournee](../docs/architecture/02-modele-de-domaine.md) : c'est le booléen **`Tournee.archivee`** (`true` = archivée), **différent** du `Personne.actif` (`false` = archivée). Le getter d'actives est donc `!archivee` ; le getter d'archivées `archivee === true` ; les actions sont nommées `archiver`/`restaurer` (alignées sur le champ), l'UI emploie « Archiver » / « Restaurer » / « Tournées archivées » (voir §4 et §8).

**Impact `schemaVersion` / migrations** : **aucun**. `CURRENT_SCHEMA_VERSION` reste `1`. La collection `tournees` et l'entité sont déjà couvertes par `toSaveDocument`/`fromSaveDocument`/`verifierIntegrite`.

## 4. Store (Vuex)

Module `tournees` ([04-gestion-etat-vuex.md](../docs/architecture/04-gestion-etat-vuex.md), [instructions/etat-vuex.md](../docs/instructions/etat-vuex.md)). Après `002` il expose : `state {items: []}`, getters `byId` et `actives`, mutation `REPLACE`. Il **n'a pas encore d'action CRUD** (elles étaient explicitement différées à `006`). On calque **exactement** le module `personnes` de `004`.

### 4.1 Getters

- `actives` (**existant**) : `state.items.filter((t) => !t.archivee)`.
- `byId` (**existant**) : `(id) => state.items.find((t) => t.id === id)`.
- `archivees` (**ajout**) : `state.items.filter((t) => t.archivee === true)` — alimente la section « Tournées archivées ».

> Le **tri d'affichage** (alphabétique) est un choix de présentation : il est fait dans le composant (§6), pas dans le getter (KISS, cohérent avec `004`).

### 4.2 Mutations

Deux mutations **ajoutées** (la mutation `REPLACE` d'hydratation reste inchangée), volontairement **fines** — mêmes patrons que `personnes` (`004`) : elles n'appliquent qu'une modification de state, sans logique métier ni horodatage (posés en amont par l'action/domaine).

- `ADD(state, tournee)` : ajoute une tournée complète à la collection (`state.items.push(tournee)`).
- `UPDATE(state, { id, patch })` : **fusion immuable par id** — remplace l'élément d'`id` donné par `{ ...ancien, ...patch }` (via `findIndex` + `splice`). Ne fait rien si l'id est introuvable.

### 4.3 Actions

Les actions **orchestrent** ; la construction/normalisation d'une tournée vit dans le **domaine** (§5), jamais dans le store (règle d'or #10). Les horodatages techniques (`updatedAt`) sont posés dans l'action via `new Date().toISOString()` (même convention que `personnes` en `004`). Import de `creerTournee` depuis `@/domain/tournees.js`.

- `ajouter({ commit }, champs)` : construit une tournée complète via `creerTournee(champs)` (§5.1) puis `commit('ADD', tournee)`.
- `modifier({ commit }, { id, ...champs })` : `commit('UPDATE', { id, patch: { ...champs, updatedAt: <ISO UTC> } })`. Ne touche jamais `id`, `createdAt`.
- `archiver({ commit }, id)` : archivage (soft-delete) — `commit('UPDATE', { id, patch: { archivee: true, updatedAt: <ISO UTC> } })`.
- `restaurer({ commit }, id)` : restauration — `commit('UPDATE', { id, patch: { archivee: false, updatedAt: <ISO UTC> } })`.

> **Vocabulaire** : côté **données/store**, on reste aligné sur le champ `archivee` (`archiver`/`restaurer`, getter `archivees`) ; côté **UI**, on emploie les libellés « Archiver » / « Restaurer » / « Tournées archivées ». Contrairement à `personnes` (où le champ `actif` obligeait à un décalage `desactiver`/`reactiver` ↔ « Archiver »/« Restaurer »), ici le vocabulaire données et UI **coïncident** (le champ s'appelle déjà `archivee`).

### 4.4 Persistance (déjà en place, rien à ajouter)

Chaque `commit` d'une mutation `tournees/*` (hors `REPLACE` d'hydratation, qui passe aussi par le plugin sans dommage) déclenche le **plugin de persistance débouncé (~400 ms)** de `src/store/index.js`, qui sérialise via `toSaveDocument` et écrit via `storageRepository.save`. **Ne rien réimplémenter**, **aucun accès `localStorage`** dans le module ou les composants ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).

### 4.5 État racine consommé en lecture seule

L'écran **lit** (sans jamais les muter) l'état racine de sauvegarde posé en `002` pour le retour visuel, exactement comme `003`/`004` :

- `state.statutSauvegarde` (`INACTIF | EN_COURS | ENREGISTRE | ERREUR | ERREUR_CHARGEMENT`) ;
- `state.derniereSauvegarde` (ISO UTC de la dernière écriture réussie, ou `null`).

Il lit aussi le getter `cabinet/parametres` pour récupérer `couleursParDefaut` (palette de suggestion du sélecteur de couleur).

## 5. Domaine (logique pure)

Tout dans `src/domain/`, **sans import Vue/Vuex ni `localStorage`** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)). Réutilisable par le moteur (`009`) et les écrans planning (`010`+).

### 5.1 `src/domain/tournees.js` (**nouveau**) — fabrique & normalisation d'une Tournee

Calque strict de `src/domain/personnes.js` (`004`).

- **`creerTournee(champs)`** → `Tournee` : construit une tournée **complète et normalisée** à partir d'un objet partiel (les champs saisis dans le formulaire), en appliquant les **valeurs par défaut** et en générant les champs techniques. Fonction **pure** (hors `genId()` et `new Date().toISOString()`, tolérés car techniques — même usage que `schema.js`/`personnes.js`).
  - `id` : `champs.id ?? genId()` (import de `src/domain/utils/id.js`).
  - `nom` : `String(champs.nom ?? '').trim()`.
  - `code` : `String(champs.code ?? '').trim()` (chaîne vide si absent).
  - `secteur` : `String(champs.secteur ?? '').trim()`.
  - `creneau` : `champs.creneau ?? CRENEAUX[0]` (import de `CRENEAUX` depuis `schema.js` ; défaut `'MATIN'`, validé ∈ `CRENEAUX` par le formulaire).
  - `heureDebut` : `champs.heureDebut ?? ''` ; `heureFin` : `champs.heureFin ?? ''` (chaînes `"HH:mm"` ; le formulaire garantit des valeurs valides et `heureFin > heureDebut`).
  - `joursApplication` : `normaliserJours(champs.joursApplication)` — helper interne (comme `normaliserJours` de `preferences.js`) : garde les entiers ISO `1..7`, **triés et dédupliqués** ; `[]` si absent (le formulaire garantit ≥ 1).
  - `nbPersonnesRequises` : `champs.nbPersonnesRequises ?? 1`.
  - `couleur` : `champs.couleur ?? COULEURS_PAR_DEFAUT[0]` (import depuis `schema.js`).
  - `archivee` : `champs.archivee ?? false`.
  - `dateDebutValidite` : `champs.dateDebutValidite ?? null` ; `dateFinValidite` : `champs.dateFinValidite ?? null`.
  - `ordreAffichage` : `champs.ordreAffichage ?? null`.
  - `notes` : `champs.notes ?? ''`.
  - `createdAt` : `champs.createdAt ?? <ISO UTC courant>` ; `updatedAt` : `<ISO UTC courant>`.
  - JSDoc : `@typedef {Object} Tournee` (aligné sur [02 §Tournee](../docs/architecture/02-modele-de-domaine.md)) + `@param`/`@returns`.
- **`normaliserJours(valeur)`** (interne, non exporté nécessairement) : coerce en `number[]` ISO 1..7, triés et dédupliqués (même logique que le helper homonyme de `preferences.js`). Garantit un stockage propre et stable de `joursApplication`.

> **Cohérence des heures / dates : au formulaire, pas au domaine.** Conformément au choix de `004` (où la cohérence `dateSortie ≥ dateEntree` vivait dans le formulaire via Vuelidate), les contrôles `heureFin > heureDebut` et `dateFinValidite ≥ dateDebutValidite` sont portés par **Vuelidate** dans `FormulaireTournee` (§7), **pas** par un helper de domaine. Le domaine garantit la **normalisation structurelle** (`joursApplication` trié/dédupliqué, champs tous initialisés). Un éventuel `validerTournee` de domaine (partagé avec le moteur `009`) reste **différé** (§12), pour ne pas dupliquer la validation de saisie.

### 5.2 `src/domain/libelles.js` (**modifier**) — libellé de liste de jours

`LIBELLES_CRENEAU`/`libelleCreneau` (créneau en clair) et `JOURS_SEMAINE`/`libelleJour` (jours ISO) existent **déjà** (utilisés par `003`/`005`) et sont réutilisés tels quels. Ajout d'un seul helper d'affichage, pour présenter `joursApplication` en toutes lettres sans logique dans le composant :

| Export | Forme | Rôle |
|---|---|---|
| `libelleJours(joursIso)` | `(number[]) → string` | Énumération FR naturelle des jours (« Lundi », « Lundi et Mardi », « Lundi, Mardi et Jeudi »). Ordonne par ISO croissant ; `''` si liste vide. |

> Ce helper **ne fait que de l'affichage** (comme le reste de `libelles.js`, prêt pour i18n). Il reproduit l'esprit du helper de jonction FR interne de `preferences.js` (`décrire une liste de jours`), mais en **public et réutilisable** pour `006` (liste des tournées), `007` (absences) et `010` (planning). Alternative KISS possible (si l'on veut éviter tout ajout à `libelles.js`) : joindre `joursApplication.map(libelleJour)` directement dans la vue — **retenu : le helper**, pour garder la vue sans logique et mutualiser l'énumération « … et … ».

### 5.3 Dates, heures & horodatages

Aucune manipulation `Date` custom :

- **Heures** (`heureDebut`/`heureFin`) : chaînes `"HH:mm"` ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)). `<input type="time">` **produit et consomme nativement** ce format. La comparaison `heureFin > heureDebut` se fait par **comparaison lexicographique de chaînes** `"HH:mm"` (l'ordre lexicographique coïncide avec l'ordre chronologique sur une même journée, `"08:00"` étant zéro-paddé) — **aucun objet `Date`**. L'affichage réutilise directement les chaînes (« 08:00 – 12:00 »).
- **Dates de validité** (`dateDebutValidite`/`dateFinValidite`) : chaînes `"YYYY-MM-DD"` via `<input type="date">`. Comparaison `dateFinValidite ≥ dateDebutValidite` par **comparaison lexicographique de chaînes** (identique à `004`). Affichage lisible via `dateUtil.formatDateFr` (déjà utilisé par `EquipeView`).
- **Jours** : entiers ISO 1..7, **aucun** `Date.getDay()`.
- **Horodatages** : `createdAt`/`updatedAt` posés via `new Date().toISOString()` dans `creerTournee` et dans les actions — jamais dans les composants.

## 6. Composants

Séparation conforme à [06-structure-du-code.md](../docs/architecture/06-structure-du-code.md) : les composants transverses (modale, confirmation, indicateur) sont **déjà** dans `components/communs/` (`004`) ; le formulaire spécifique va dans `components/tournees/` ; l'écran routé dans `views/`.

### 6.1 Réutilisation directe (aucune modification)

- `src/components/communs/ModaleBase.vue` — coquille de modale accessible (focus piégé, `Échap`, **retour du focus à l'ouvrant** à la fermeture, ARIA). Props `visible`/`titre`/`taille` ; slots `default`/`pied` ; événements `fermeture` et `affichee`. Réutilisée telle quelle.
- `src/components/communs/DialogueConfirmation.vue` — confirmation générique au-dessus de `ModaleBase` (props `visible`/`titre`/`message`/`libelleConfirmer`/`varianteConfirmer` ; événements `confirmer`/`annuler` ; fermeture = `annuler`). Réutilisée pour l'archivage.
- `src/components/communs/IndicateurSauvegarde.vue` — retour visuel de persistance (statut + dernière sauvegarde + `apres-edition`), avec l'encart `ERREUR_CHARGEMENT`. Réutilisé.
- `src/styles/_bootstrap.scss` — **aucun ajout requis** : `close`, `modal`, `forms` (dont `form-control-color` pour le sélecteur de couleur et les `<input type="time">`/`type="date">`), `alert` sont **déjà** importés (`004`). KISS confirmé.

### 6.2 `src/components/tournees/FormulaireTournee.vue` (**nouveau**)

Formulaire **présentational** d'ajout/édition, bâti au-dessus de `ModaleBase`, calqué sur `FormulairePersonne` (`004`). **N'accède pas au store** : il reçoit ses données par props et **émet** le résultat ; l'écran (`TourneesView`) dispatche.

- **Props** :
  - `visible` (Boolean, requis) ;
  - `tournee` (Object|null) — `null` = mode **création**, objet = mode **édition** ;
  - `couleursSuggerees` (String[]) — palette issue de `cabinet/parametres.couleursParDefaut`.
- **Événements** : `enregistrer` (payload = champs normalisés du formulaire) ; `annuler`.
- **État local** (`data().formulaire`) : copie de travail réinitialisée **à chaque ouverture** (`watch: visible`, + `mounted` si déjà visible), via `construireFormulaire()` — depuis `tournee` (édition, en **recopiant** `joursApplication` pour ne jamais muter la prop) ou depuis les **valeurs par défaut** (création : `creneau='MATIN'`, `heureDebut='08:00'`, `heureFin='12:00'`, `joursApplication=[]`, `nbPersonnesRequises=1`, `couleur=couleursSuggerees[0]`, dates vides, code/secteur/notes vides). Ne jamais muter la prop `tournee`.
- **Focus** : `autofocus` déterministe sur le champ **nom** via l'événement `affichee` de `ModaleBase` (méthode `onAffichee`, identique à `FormulairePersonne`).
- **Titre de la modale** : « Ajouter une tournée » (création) / « Modifier la tournée » (édition).
- **Champs & regroupement** (peu de champs à la fois, [08](../docs/architecture/08-principes-ux-ergonomie.md)) :
  1. **Identité** — `nom` : `<input type="text">` requis (autofocus). `code` : `<input type="text">` facultatif (« Code court (facultatif) », placeholder ex. « N » ou « T1 »). `secteur` : `<input type="text">` facultatif (« Secteur (facultatif) », placeholder ex. « Centre-ville »).
  2. **Créneau** — `form-select` (ou groupe de boutons radio) alimenté par `CRENEAUX` → `libelleCreneau` (libellés FR « Matin » / « Après-midi » / « Journée entière »). Requis.
  3. **Horaires** — `heureDebut` et `heureFin` : `<input type="time">` (produisent `"HH:mm"`), libellés « Heure de début » / « Heure de fin ». Requis ; message de cohérence si `heureFin ≤ heureDebut`.
  4. **Jours d'application** — cases à cocher sur `JOURS_SEMAINE` (ordre ISO, libellés en toutes lettres, cible ~44 px), **≥ 1** requis. **Réutilise le patron de cases** de `FormulairePreference` (`fieldset`/`legend`, `.formulaire-case`, `v-model` sur un tableau d'entiers ISO). Texte d'aide « Les jours de la semaine où cette tournée a lieu. ».
  5. **Effectif requis** — `nbPersonnesRequises` : `<input type="number" min="1" max="20" step="1">` (`v-model.number`) + texte d'aide « Nombre de personnes nécessaires pour assurer cette tournée. ». Requis, entier ≥ 1.
  6. **Couleur de repère** — **sélecteur ergonomique réutilisé de `FormulairePersonne`** : `role="radiogroup"` (`aria-label="Couleur de repère dans le planning"`) de pastilles cliquables (~44 px) issues de `couleursSuggerees` ; la pastille sélectionnée porte une **icône `PhCheck`** superposée (repère **non-coloré**) + `aria-checked` ; navigation clavier flèches (méthodes `tabIndexPastille`/`choisirCouleur`/`onKeydownPastille`, identiques à `FormulairePersonne`) ; `<input type="color">` complémentaire (« Autre couleur… »). Un aperçu « pastille + Nom de la tournée » montre le rendu.
  7. **Période de validité** (facultatif, section discrète) — `dateDebutValidite` et `dateFinValidite` : `<input type="date">` (produisent `"YYYY-MM-DD"`), libellés « Valable à partir du (facultatif) » / « Valable jusqu'au (facultatif) », aide « Pour une tournée saisonnière ou temporaire. Laissez vide si elle s'applique toute l'année. ».
  8. **Notes** (facultatif) — `notes` : `<textarea maxlength="500">`.
- **Pied de modale** : « Annuler » (`btn btn-outline-secondary`) et **« Enregistrer »** (`btn btn-primary`, action dominante). À la soumission : `v$.$touch()` ; si `!$invalid`, `$emit('enregistrer', <champs normalisés>)` (dates `"YYYY-MM-DD"` ou `null`, heures `"HH:mm"`, `joursApplication` tableau d'entiers, `nbPersonnesRequises` nombre) ; sinon afficher les messages sous les champs, **focaliser le premier champ erroné** (méthode `focusPremierChampErrone`, comme `FormulairePersonne`) et **ne rien émettre** (aucune perte de saisie).
- **Vuelidate** : voir §7. Pont `setup(){ return { v$: useVuelidate() } }` = seul usage de Composition API (identique à `FormulairePersonne`/`FormulairePreference`).
- **Icônes** : `PhCheck` (couleur sélectionnée), `PhWarning` (messages d'erreur, même présentation que `FormulairePersonne`).
- **SCSS `scoped`** : reprend les blocs de `FormulairePersonne` pour le sélecteur de couleur (`.formulaire-pastille`, `.formulaire-pastille-coche`, `.formulaire-apercu`…) et de `FormulairePreference` pour les cases (`.formulaire-case`, `.formulaire-legende`) et les erreurs (`.formulaire-erreur`) — tokens/mixins uniquement, cibles ~44 px, focus visible.

### 6.3 `src/views/TourneesView.vue` (**réécriture** complète du placeholder)

Écran routé (Options API), calqué sur `EquipeView` (`004`). **Orchestre** : liste + modales, sans logique métier (délègue au store/domaine).

- **Titre** `<h1>` « Tournées ».
- **Encart `ERREUR_CHARGEMENT`** : même patron qu'`EquipeView` (`alert alert-warning`, `PhWarning`), message adapté aux tournées.
- **Indicateur de sauvegarde** : `IndicateurSauvegarde` alimenté par `statutSauvegarde`/`derniereSauvegarde` (root state via `mapState`) et `apres-edition="aEdite"` (passe à `true` après le 1er ajout/édition/archivage/restauration — même logique qu'`EquipeView`).
- **En-tête d'action** : bouton principal **« Ajouter une tournée »** (`btn btn-primary`, icône Phosphor `PhPlus`) ⇒ ouvre `FormulaireTournee` en création (`tournee = null`). Une `ref` (ex. `boutonAjout`) sert de **point de repli du focus** après archivage/restauration (comme `EquipeView`).
- **État vide** : si `actives` **et** `archivees` sont vides → encart accueillant (icône Phosphor évocatrice de circuit, ex. `PhMapTrifold` ou `PhPath` — le développeur confirme l'existence dans `@phosphor-icons/vue`, doublée du texte), « Aucune tournée pour l'instant. Ajoutez la première pour organiser les circuits de soins. » + bouton d'ajout.
- **Liste des tournées actives** (`actives`, triées) : une **liste de cartes/lignes** (pas un tableau dense, plus lisible et responsive, comme `004`). Chaque ligne affiche :
  - **pastille de couleur** (rond `couleur`, `aria-hidden`) **+ nom** (couleur toujours doublée du nom) ; le **code** entre parenthèses s'il existe (« Tournée Nord (N) ») ;
  - **créneau** en clair (`libelleCreneau`) **+ horaires** (« Matin · 08:00 – 12:00 ») ;
  - **jours d'application** en toutes lettres (`libelleJours(joursApplication)`) ;
  - **effectif** « {nbPersonnesRequises} personne(s) requise(s) » (accord singulier/pluriel) ;
  - **secteur** s'il est renseigné ; **période de validité** si `dateDebutValidite`/`dateFinValidite` renseignées (via `dateUtil.formatDateFr`, ex. « à partir du 01/06/2026 », « jusqu'au … », « du … au … ») ;
  - **actions** : « Modifier » (`PhPencilSimple`) ⇒ `FormulaireTournee` en édition ; « Archiver » (`PhArchive`) ⇒ `DialogueConfirmation`. Boutons avec **libellé texte** (pas d'icône seule).
- **Section « Tournées archivées »** (`archivees`) : **repliée par défaut** via une bascule **Vue simple** (booléen `data`, chevron `PhCaretRight` qui pivote — patron exact d'`EquipeView`, pas de JS Bootstrap `collapse`), titrée « Tournées archivées ({{ archivees.length }}) » ; masquée si `archivees` est vide. Chaque ligne (présentation atténuée) propose « Restaurer » (`PhArrowCounterClockwise`) ⇒ `restaurer(id)` **directement** (action sûre, non destructive, sans confirmation) + feedback via l'indicateur, avec repli du focus sur `boutonAjout` (`$nextTick`, comme `EquipeView`). Une phrase explique « Les tournées archivées sont conservées pour l'historique des plannings. ».
- **Tri d'affichage** (computed) : actives et archivées triées par `nom` via `localeCompare('fr')` (présentation ; `ordreAffichage` non utilisé en `006`, comme `004`).
- **Modales** : instances de `FormulaireTournee` (création/édition, pilotée par `formulaireVisible` + `tourneeEnCours`) et `DialogueConfirmation` (archivage, pilotée par `confirmationVisible` + `tourneeAArchiver`, `libelle-confirmer="Archiver"`, `variante-confirmer="primary"`). Handlers (calqués sur `EquipeView`) :
  - `onEnregistrer(champs)` : si `tourneeEnCours` ⇒ `modifier({ id: tourneeEnCours.id, ...champs })` ; sinon ⇒ `ajouter(champs)`. Puis `aEdite = true`, ferme la modale, `tourneeEnCours = null`.
  - `onConfirmerArchivage()` : `archiver(tourneeAArchiver.id)`, `aEdite = true`, ferme la confirmation, repli du focus sur `boutonAjout` (`$nextTick`).
- **Accès store** : `mapGetters('tournees', ['actives', 'archivees'])`, `mapGetters('cabinet', ['parametres'])`, `mapActions('tournees', ['ajouter', 'modifier', 'archiver', 'restaurer'])`, `mapState(['statutSauvegarde', 'derniereSauvegarde'])`. **Aucune logique métier** : libellés via `libelles.js`, construction de la tournée via l'action `ajouter` (qui appelle `creerTournee`) ; le résumé « effectif », « période » et « jours » sont de simples helpers de présentation (ou expressions template).

### 6.4 Réutilisation & style

- `ModaleBase`, `DialogueConfirmation`, `IndicateurSauvegarde`, `libelles.js`, `dateUtil`, tokens/mixins SCSS, intégration Bootstrap, icônes Phosphor : **déjà en place** (`003`/`004`), réutilisés tels quels.
- La directive `v-debounce` **n'est pas nécessaire** (formulaire à validation explicite, pas de saisie auto-persistée en continu — comme `004`/`005`).
- Le SCSS `scoped` de chaque composant ne sert qu'au **spécifique** (lignes de liste, pastilles, présentation atténuée des archivées) ; tout le reste via classes Bootstrap. Cibles ~44 px (`$cible-cliquable-min`), focus visible, aucune valeur « magique » (tokens uniquement).

## 7. Règles de validation

Vuelidate ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md), [instructions/formulaires-validation.md](../docs/instructions/formulaires-validation.md)) dans `FormulaireTournee`. Règles déclaratives, **messages FR orientés correction**, affichés **après interaction** (blur / change) ou **à la tentative d'enregistrement** — jamais sur un formulaire vierge. Ces règles couvrent explicitement les exigences de l'instruction [formulaires-validation §Tournée](../docs/instructions/formulaires-validation.md) (« `heureFin` > `heureDebut`, au moins un jour d'application, `nbPersonnesRequises` ≥ 1 »).

| Champ | Règle | Message FR (exemple) |
|---|---|---|
| `nom` | `required` | « Indiquez le nom de la tournée. » |
| `code` | facultatif ; `maxLength` (ex. 10) | « Le code doit rester court (10 caractères maximum). » |
| `secteur` | facultatif ; `maxLength` (ex. 60) | « Le secteur ne doit pas dépasser 60 caractères. » |
| `creneau` | `required`, ∈ `CRENEAUX` (liste fermée) | (liste fermée : pas de saisie libre) |
| `heureDebut` | `required` | « Indiquez l'heure de début. » |
| `heureFin` | `required` ; **`heureFin > heureDebut`** (comparaison de chaînes `"HH:mm"`) | « L'heure de fin doit être après l'heure de début. » |
| `joursApplication` | tableau, **≥ 1** | « Choisissez au moins un jour d'application. » |
| `nbPersonnesRequises` | `required`, `integer`, `between(1, 20)` | « Indiquez le nombre de personnes requises (au moins 1). » |
| `couleur` | requise, format hex `#RRGGBB` | « Choisissez une couleur de repère. » |
| `dateDebutValidite` | facultative | (aucune, sauf cohérence ci-dessous) |
| `dateFinValidite` | facultative ; si `dateDebutValidite` **et** `dateFinValidite` renseignées ⇒ `dateFinValidite ≥ dateDebutValidite` (comparaison de chaînes `"YYYY-MM-DD"`) | « La date de fin doit être identique ou postérieure à la date de début. » |
| `notes` | facultatif ; `maxLength` (ex. 500) | « La note ne doit pas dépasser 500 caractères. » |

**Comportement d'enregistrement** : l'**ensemble** du formulaire est validé au clic sur « Enregistrer » ; si un champ est invalide, l'enregistrement est **bloqué**, les messages s'affichent sous les champs concernés, le **premier champ erroné reçoit le focus**, et la **saisie est conservée** (tolérance à l'erreur, zéro perte — [08](../docs/architecture/08-principes-ux-ergonomie.md)). « Annuler » / `Échap` / clic hors fenêtre ferment sans enregistrer.

> Borne haute `nbPersonnesRequises = 20` : garde-fou raisonnable contre les saisies aberrantes, ajustable (§12).

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie.md](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Langage humain, zéro jargon** : « Ajouter une tournée », « Créneau », « Heure de début / de fin », « Jours d'application », « Personnes requises », « Couleur de repère », « Valable à partir du… », « Archiver », « Tournées archivées ». Jamais « CRUD », « soft-delete », « enum », « champ invalide ».
- **Une action principale par écran** : « Ajouter une tournée », visuellement dominante.
- **Créneau, horaires et jours en clair** : créneau via `libelleCreneau` (« Matin »), horaires lisibles (« 08:00 – 12:00 »), **jours d'application en toutes lettres** (« Lundi, Mardi et Jeudi ») — jamais de codes ISO bruts ni d'anglais.
- **Couleur toujours doublée du nom** (liste et aperçu du formulaire) ; sélecteur de couleur avec **repère non-coloré** (icône `PhCheck` + `aria-checked`) — jamais l'information par la seule couleur (daltoniens, impression, [ADR 0013](../docs/adr/0013-icones-phosphor.md)). La présentation atténuée des archivées est **doublée** du regroupement dans la section dédiée et du libellé « Tournées archivées ».
- **Saisies natives et guidées** : `<input type="time">` pour les horaires (pas de saisie libre ambiguë) ; `<input type="date">` pour la validité ; cases à cocher pour les jours (cibles ~44 px).
- **Valeurs par défaut raisonnables** pour réduire l'effort : créneau « Matin », horaires 08:00–12:00, effectif 1, 1re couleur suggérée — l'utilisateur ajuste.
- **État vide accueillant** plutôt qu'une page blanche ; invite claire à démarrer.
- **Réversibilité & confirmation** : archivage (réversible) précédé d'une **confirmation en langage clair** rappelant que la tournée est **conservée** et **restaurable** ; **jamais de suppression définitive** (soft-delete). La restauration, sûre, se fait sans confirmation.
- **Feedback immédiat** : indicateur « Modifications enregistrées » après chaque opération ; erreurs sous le champ, disant **quoi corriger** (ex. « L'heure de fin doit être après l'heure de début. »).
- **Tolérance à l'erreur** : la saisie n'est jamais perdue si la validation échoue ; focus porté sur le premier champ à corriger.
- **Modale accessible** : focus piégé, **fermeture au clavier (`Échap`)**, **retour du focus à l'ouvrant**, `autofocus` sur le 1er champ (fournis par `ModaleBase`).
- **Ergonomie physique** : cibles ~44 px (boutons, pastilles, cases), bon espacement, `label` associé à chaque champ, **focus clavier visible**, structure de titres `h1 → h2`.
- **Cohérence** : mêmes patterns que `003`/`004`/`005` (indicateur de sauvegarde, présentation des erreurs, ajout/édition en modale, confirmation destructive, sélecteur de couleur) — l'utilisateur retrouve exactement les mêmes gestes que sur l'écran Équipe.

## 9. Étapes d'implémentation

Découpage en **3 tâches cœur** + **1 tâche optionnelle**, chacune destinée à **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé par les dépendances : **T1 → T2 → T3** (domaine + store d'abord ; formulaire ; écran). **T4 optionnelle** (réactivation `PREFERENCE_TOURNEE`) se place **après** validation du cœur — voir la décision §12.

### Tâche 1 — Domaine (fabrique Tournee + helper de libellé de jours) & store `tournees` (CRUD)

**Fichiers** :
- `src/domain/tournees.js` (**créer**) — `creerTournee(champs)` (§5.1), pur, JSDoc `@typedef Tournee` ; helper interne `normaliserJours`.
- `src/domain/libelles.js` (**modifier**) — `libelleJours(joursIso)` (§5.2). Conserver l'existant.
- `src/store/modules/tournees.js` (**modifier**) — getter `archivees` ; mutations `ADD`, `UPDATE` (fusion immuable par id) ; actions `ajouter`, `modifier`, `archiver`, `restaurer` (§4). Conserver `actives`, `byId`, `REPLACE`. Importer `creerTournee`.

**Critères de sortie** :
- `creerTournee({ nom: 'Nord' })` renvoie une tournée **complète** : `id` non vide, `code === ''`, `secteur === ''`, `creneau === 'MATIN'`, `heureDebut === ''`, `heureFin === ''`, `joursApplication === []`, `nbPersonnesRequises === 1`, `couleur === COULEURS_PAR_DEFAUT[0]`, `archivee === false`, `dateDebutValidite === null`, `dateFinValidite === null`, `notes === ''`, `createdAt`/`updatedAt` ISO UTC.
- `creerTournee` respecte les valeurs fournies (ex. `creneau:'JOURNEE'`, `heureDebut:'08:00'`, `heureFin:'18:00'`, `nbPersonnesRequises:3`, `couleur:'#123456'`) et **normalise** `joursApplication` : `creerTournee({ joursApplication:[3,1,3,7] }).joursApplication` vaut `[1,3,7]` (trié, dédupliqué, entiers ISO valides seulement).
- `libelleJours([1,2,4]) === 'Lundi, Mardi et Jeudi'` ; `libelleJours([1]) === 'Lundi'` ; `libelleJours([]) === ''` ; l'ordre de sortie est ISO croissant quel que soit l'ordre d'entrée.
- Store : `dispatch('tournees/ajouter', { nom:'Nord', creneau:'MATIN', heureDebut:'08:00', heureFin:'12:00', joursApplication:[1,2,3], nbPersonnesRequises:2 })` ⇒ `getters['tournees/actives']` contient la tournée ; `dispatch('tournees/modifier', { id, nbPersonnesRequises:3 })` ⇒ effectif à 3 et `updatedAt` **rafraîchi**, `id`/`createdAt` inchangés ; `dispatch('tournees/archiver', id)` ⇒ la tournée quitte `actives`, apparaît dans `archivees` (`archivee === true`) ; `restaurer` inverse.
- Aucun import Vue/Vuex dans `tournees.js`/`libelles.js` ; aucun accès `localStorage` ; aucun `Date.getDay()` ni `new Date("YYYY-MM-DD")`.

### Tâche 2 — `FormulaireTournee` (formulaire ajout/édition + validation + sélecteur de couleur + cases jours)

**Fichiers** :
- `src/components/tournees/FormulaireTournee.vue` (**créer**) — formulaire présentational au-dessus de `ModaleBase`, props `visible`/`tournee`/`couleursSuggerees`, événements `enregistrer`/`annuler`, Vuelidate (§6.2, §7). Réutilise le sélecteur de couleur accessible de `FormulairePersonne` et le patron de cases jours de `FormulairePreference`.

**Dépend de** : T1 (`libelles.js`) et briques existantes (`ModaleBase`).

**Critères de sortie** :
- Mode **création** (`tournee=null`) : champs par défaut (créneau « Matin », horaires 08:00/12:00, aucun jour coché, effectif 1, 1re couleur suggérée pré-sélectionnée, dates vides) ; `autofocus` sur le nom.
- Mode **édition** : tous les champs pré-remplis depuis `tournee` (`joursApplication` recopié, jamais muté) ; réouverture réinitialise proprement le brouillon.
- Validation : nom requis ; créneau requis ; heures requises + `heureFin > heureDebut` (comparaison de chaînes) ; ≥ 1 jour d'application ; `nbPersonnesRequises` entier 1–20 ; `dateFinValidite ≥ dateDebutValidite` si les deux renseignées — messages FR sous les champs, affichés après interaction / à la soumission ; enregistrement **bloqué** si invalide, **saisie conservée**, focus au 1er champ erroné.
- Sélecteur de couleur : palette cliquable (~44 px) depuis `couleursSuggerees`, pastille sélectionnée marquée par `PhCheck` + `aria-checked` + navigation flèches ; choix libre via `<input type="color">` ; aperçu « pastille + Nom de la tournée ».
- Cases jours : `JOURS_SEMAINE` en toutes lettres, cibles ~44 px, `v-model` sur un tableau d'entiers ISO.
- Soumission valide ⇒ `enregistrer` avec les champs normalisés (heures `"HH:mm"`, dates `"YYYY-MM-DD"` ou `null`, `joursApplication` tableau d'entiers, `nbPersonnesRequises` nombre) ; « Annuler »/`Échap` ⇒ `annuler`, aucun enregistrement.
- Icônes Phosphor doublées d'un libellé/`aria-label` ; aucune info par la seule couleur ; `label` associé à chaque champ ; `npm run build` réussit.

### Tâche 3 — Écran `TourneesView` (liste, état vide, archivées, orchestration)

**Fichiers** :
- `src/views/TourneesView.vue` (**réécrire**) — liste des actives, état vide, section repliable des archivées, bouton d'ajout, orchestration des modales, `IndicateurSauvegarde`, encart `ERREUR_CHARGEMENT` (§6.3, §8).

**Dépend de** : T1 (store/getters/libellés), T2 (`FormulaireTournee`), briques `DialogueConfirmation`/`IndicateurSauvegarde` (existant `004`).

**Critères de sortie** :
- Au premier lancement (aucune tournée) : **état vide** accueillant + bouton « Ajouter une tournée ».
- Ajout : le formulaire s'ouvre, une tournée valide est créée et apparaît immédiatement dans la liste (pastille + nom + créneau/horaires + jours + effectif) ; l'indicateur passe à « Modifications enregistrées » ; **recharger la page** conserve la tournée.
- Édition : « Modifier » ouvre le formulaire pré-rempli ; les changements sont enregistrés et reflétés dans la liste.
- Archivage : « Archiver » ouvre la **confirmation** ; après confirmation la tournée quitte la liste active et apparaît dans « Tournées archivées (N) » (repliée par défaut). Restauration : « Restaurer » la ramène dans les actives, sans confirmation ; focus repli sur le bouton d'ajout dans les deux cas.
- Tri alphabétique cohérent ; couleur toujours doublée du nom ; jours/créneau/horaires en clair ; icônes doublées d'un libellé ; focus visible ; navigation clavier possible (ouvrir/fermer la modale, valider).
- Aucun accès `localStorage`, aucun objet `Date` hors `dateUtil`, aucune logique métier dans le composant ; `npm run build` réussit.

### Tâche 4 (OPTIONNELLE) — Réactivation du type de souhait `PREFERENCE_TOURNEE` (complète la dette de `005`)

> **Optionnelle et séparable.** Elle ne fait **pas** partie du cœur « CRUD des tournées » de la ROADMAP `006` et **modifie des fichiers de `005`**. À implémenter **seulement** après validation de T1–T3, et **uniquement** si le mainteneur décide de solder la dette `005` maintenant (voir §12, décision tranchée : **retenue mais isolée**). Si écartée, la laisser documentée comme dette dans `005 §12.3`.

**Dépend de** : `004`/`005` (module `personnes`, `FormulairePreference`, `SouhaitsView`, `src/domain/preferences.js`) **en plus** de T1 (tournées existantes).

**Fichiers** :
- `src/domain/preferences.js` (**modifier**) — (a) `META_TYPES_PREFERENCE.PREFERENCE_TOURNEE` : remplacer le placeholder `champs:'minMax'` par une forme dédiée `champs:'tournees'`, `natureParDefaut:'SOUPLE'`, `aide` claire (« Choisissez une ou plusieurs tournées, puis indiquez si la personne les préfère ou souhaite les éviter. ») ; (b) `TYPES_PREFERENCE_OFFERTS` : **inclure** `PREFERENCE_TOURNEE` (la liste redevient les 8 types) — le **filtrage « pas de tournée disponible »** se fait côté formulaire ; (c) `decrirePreference` : enrichir la branche `PREFERENCE_TOURNEE` avec un **second paramètre optionnel** `options` porteur d'un résolveur `nomTournee(id) => string` — sans résolveur, phrase générique selon `sens` (« Préfère certaines tournées » / « Souhaite éviter certaines tournées ») ; avec résolveur, nommer les tournées (« Préfère la tournée Nord et la tournée Sud »). **Rester rétrocompatible** (les appels existants sans `options` continuent de fonctionner). `normaliserParams` gère **déjà** `{ tourneeIds, sens }` : aucun changement.
- `src/domain/libelles.js` (**modifier**) — `LIBELLES_SENS_PREFERENCE = { PREFERE:'Préfère', EVITE:'Souhaite éviter' }`, `libelleSensPreference(code)`, `SENS_PREFERENCE_OPTIONS` (pour le groupe de boutons radio du sens).
- `src/components/equipe/FormulairePreference.vue` (**modifier**) — nouvelle prop `tourneesActives` (Array, défaut `[]`) ; **filtrer** `PREFERENCE_TOURNEE` du sélecteur de type si `tourneesActives.length === 0` (avec, le cas échéant, un texte d'aide « Ajoutez d'abord une tournée pour utiliser ce souhait. ») ; gestion de `champs:'tournees'` dans `construireFormulaire`/`recopierParams`/`onChangeType` (`params = { tourneeIds:[], sens:'PREFERE' }`) ; section dynamique : cases à cocher des tournées (nom + créneau/horaires pour lever l'ambiguïté) ⇒ `params.tourneeIds`, groupe de radios sens ⇒ `params.sens` ; Vuelidate (`tourneeIds` ≥ 1, `sens` requis) ; `champsEnOrdre` inclut le champ tournées ; aperçu via `decrirePreference` avec résolveur bâti sur `tourneesActives`.
- `src/views/SouhaitsView.vue` (**modifier**) — `mapGetters('tournees', ['actives'])` ; passer `:tournees-actives="…"` à `FormulairePreference` ; passer un **résolveur** `nomTournee` (bâti sur `tournees/byId` ou la liste des actives) à `decrirePreference` pour l'affichage des lignes `PREFERENCE_TOURNEE` dans la liste des souhaits.
- `src/domain/schema.js` (**modifier**) — `verifierIntegrite` : contrôler l'**intégrité référentielle** des `tourneeIds` des préférences de type `PREFERENCE_TOURNEE` (chaque `tourneeId` doit résoudre vers une tournée existante), sur le modèle des contrôles existants (`absence.personneId`, `affectation.tourneeId`). Messages FR explicites, prêts à afficher (utile à l'import `008`).

**Critères de sortie** :
- Avec au moins une tournée active : `FormulairePreference` propose « Tournée préférée ou évitée » ; la section affiche les tournées cochables + le choix « Préfère » / « Souhaite éviter » ; l'aperçu et la liste des souhaits nomment les tournées choisies.
- Sans aucune tournée active : le type `PREFERENCE_TOURNEE` **n'est pas proposé** (ou est désactivé avec explication), les 7 autres types fonctionnent comme avant.
- Un souhait `PREFERENCE_TOURNEE` créé/édité est persisté (`params.tourneeIds` normalisé, `params.sens` ∈ `{PREFERE,EVITE}`), rechargé, et **décrit en clair**.
- `verifierIntegrite` signale un `tourneeId` inconnu référencé par une préférence importée.
- `decrirePreference` **sans** résolveur reste fonctionnelle (aucune régression `005`) ; `npm run build` réussit ; aucun accès `localStorage` ni objet `Date` hors `dateUtil` dans les composants.

## 10. Critères d'acceptation

- [ ] La route `/tournees` affiche la **liste des tournées** titrée « Tournées » (fini le placeholder), avec un bouton principal « Ajouter une tournée ».
- [ ] **État vide** accueillant tant qu'aucune tournée n'existe.
- [ ] **Ajouter** une tournée (nom, créneau, horaires, jours d'application, effectif ; code/secteur/couleur/validité/notes facultatifs) l'enregistre et l'affiche dans la liste ; l'indicateur montre « Modifications enregistrées ».
- [ ] **Recharger la page** restitue les tournées (persistance effective via `bootstrap`).
- [ ] **Modifier** une tournée met à jour ses informations et rafraîchit `updatedAt` ; `id` et `createdAt` sont préservés.
- [ ] **Archiver** (soft-delete) passe `archivee` à `true` **après confirmation** ; la tournée quitte la liste active et rejoint « Tournées archivées ». Elle n'est **jamais** supprimée physiquement du document persisté.
- [ ] **Restaurer** repasse `archivee` à `false` et ramène la tournée dans les actives (sans confirmation).
- [ ] Validation : nom **requis** ; créneau **requis** ; heures **requises** avec `heureFin > heureDebut` ; **≥ 1 jour** d'application ; `nbPersonnesRequises` entier **≥ 1** ; `dateFinValidite ≥ dateDebutValidite`. Messages FR de correction, saisie jamais perdue.
- [ ] Le **sélecteur de couleur** propose la palette du cabinet + un choix libre ; la sélection est marquée par un repère **non-coloré** ; la couleur est **toujours doublée du nom** dans la liste.
- [ ] Les **jours d'application** s'affichent en **toutes lettres**, le **créneau** en clair, les **horaires** lisiblement (« 08:00 – 12:00 »).
- [ ] La **modale** est fermable au clavier (`Échap`), le focus y est piégé et **rendu à l'ouvrant** ; chaque champ a un `label` ; le focus clavier est visible.
- [ ] Aucun accès direct à `localStorage` ; aucun objet `Date` manipulé hors `dateUtil` ; aucune logique métier dans les composants.
- [ ] `npm run build` réussit.
- [ ] *(si T4 retenue)* Le souhait « Tournée préférée ou évitée » est proposé dès qu'une tournée existe, saisi (tournées + sens), persisté, décrit en clair, et son intégrité référentielle est contrôlée à l'import.

## 11. Vérification

Parcours manuel (`npm run dev`, ouvrir `/#/tournees`) :

1. **État initial** — Sur un stockage vide (`localStorage.clear()` + recharger) : l'écran montre l'état vide accueillant et le bouton « Ajouter une tournée ».
2. **Ajout** — Cliquer « Ajouter une tournée » : la modale s'ouvre, focus sur le nom. Saisir « Tournée Nord », code « N », créneau « Matin », heure de début 08:00, heure de fin 12:00, cocher Lundi/Mardi/Jeudi, effectif 2, choisir une couleur. « Enregistrer » : la modale se ferme, « Tournée Nord (N) » apparaît (pastille + nom + « Matin · 08:00 – 12:00 » + « Lundi, Mardi et Jeudi » + « 2 personnes requises »). L'indicateur affiche « Modifications enregistrées ». **Recharger** → la tournée est toujours là.
3. **Validation** — Rouvrir l'ajout, laisser le nom vide et « Enregistrer » : message « Indiquez le nom de la tournée. », enregistrement bloqué, saisie conservée. Mettre heure de fin **avant** l'heure de début → « L'heure de fin doit être après l'heure de début. ». Ne cocher aucun jour → « Choisissez au moins un jour d'application. ». Effectif 0 → message ≥ 1. `dateFinValidite` antérieure à `dateDebutValidite` → message de cohérence.
4. **Édition** — « Modifier » sur la tournée : formulaire pré-rempli. Passer l'effectif à 3 et enregistrer → « 3 personnes requises » dans la liste ; recharger → conservé.
5. **Archivage** — « Archiver » : la confirmation explique la conservation/restauration. Confirmer → la tournée quitte les actives et apparaît sous « Tournées archivées (1) » (dépliée à la demande). `localStorage` : la tournée existe toujours avec `archivee: true` (jamais supprimée).
6. **Restauration** — Déplier « Tournées archivées », « Restaurer » → elle revient dans les actives, sans confirmation.
7. **Sélecteur de couleur** — À l'édition, vérifier que la pastille sélectionnée porte l'icône de coche, que la navigation flèches fonctionne, qu'un choix libre via `<input type="color">` fonctionne, et que la liste montre bien pastille **+** nom.
8. **Accessibilité / clavier** — Ouvrir la modale, naviguer au `Tab` (focus piégé), fermer avec `Échap` (retour du focus au bouton d'ouverture). Focus visible partout ; labels présents ; cases jours actionnables au clavier.
9. **Persistance croisée** — Après plusieurs opérations, `JSON.parse(localStorage.getItem('idelia:data')).tournees` contient les tournées attendues avec `archivee`, `heureDebut`/`heureFin` (`"HH:mm"`), `joursApplication` (entiers ISO triés) cohérents ; `cabinet.couleursParDefaut` inchangé.
10. *(si T4 retenue)* **Souhait de tournée** — Depuis `/equipe`, « Souhaits » d'une personne : le type « Tournée préférée ou évitée » est proposé (une tournée existant), cocher « Tournée Nord », sens « Préfère » → ligne « Préfère la tournée Nord » ; recharger → conservé.
11. **Build** — `npm run build` réussit sans erreur.

## 12. Décisions à confirmer / risques

1. **Convention de soft-delete — `archivee` (confirmée)** — Le modèle `Tournee` (`schema.js` + [02 §Tournee](../docs/architecture/02-modele-de-domaine.md)) définit le soft-delete par le booléen **`archivee`** (`true` = archivée), **distinct** du `Personne.actif` (`false` = archivée). Conséquences retenues : getter `archivees` (`archivee === true`), actions `archiver`/`restaurer` (alignées sur le champ), UI « Archiver »/« Restaurer »/« Tournées archivées ». **Avantage** vs `004` : vocabulaire données et UI **coïncident** (pas de décalage `desactiver` ↔ « Archiver »). **Confirmé, aucune ambiguïté.**
2. **Saisie des heures en `"HH:mm"` via `<input type="time">` (retenu)** — Conforme à [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) : l'input `time` produit/consomme nativement `"HH:mm"`, aucun objet `Date`, aucune dépendance ajoutée. La règle `heureFin > heureDebut` est une **comparaison lexicographique de chaînes** (valide car zéro-paddées, sur une même journée). **Limite assumée** : une tournée « à cheval sur minuit » (fin < début) n'est pas modélisable — hors périmètre d'un cabinet infirmier de jour (aucune tournée de nuit prévue en v1). Si un tel besoin émerge, il fera l'objet d'un ADR. **À confirmer.**
3. **Cohérence heures/dates au formulaire, pas au domaine (retenu)** — Comme `004` (cohérence `dateSortie ≥ dateEntree` dans le formulaire), les contrôles `heureFin > heureDebut` et `dateFin ≥ dateDebut` vivent dans `FormulaireTournee` (Vuelidate). Le domaine (`creerTournee`) garantit la **normalisation structurelle** (jours triés/dédupliqués, champs initialisés). Un `validerTournee` de domaine partagé avec le moteur `009` est **différé** (évite la duplication prématurée). **À confirmer.**
4. **Formulaire en modale (retenu) vs vue dédiée** — **Retenu : modale** (`ModaleBase`), strictement comme `004` : contexte de la liste visible, **une seule route** `/tournees` (cohérent [07](../docs/architecture/07-navigation-et-ecrans.md)), modale accessible clé en main, pattern déjà éprouvé. **À confirmer.**
5. **Champs inclus** — La ROADMAP cite « horaires, créneau, jours d'application, effectif requis, archivage ». J'inclus **en plus** `code`, `secteur`, `couleur`, `dateDebutValidite`/`dateFinValidite`, `notes`, **tous facultatifs** (sauf `couleur`, requise avec défaut) car prévus au schéma et utiles à l'affichage planning (`010`+) ; coût quasi nul (la fabrique doit de toute façon initialiser tous les champs). **À confirmer** : les garder ou différer certains (ex. validité).
6. **Borne `nbPersonnesRequises` — `between(1, 20)`** — Retenu : entier ≥ 1, plafond 20 comme garde-fou contre les saisies aberrantes. `0` interdit (une tournée sans effectif n'a pas de sens). **À confirmer** le plafond.
7. **Tri & `ordreAffichage`** — Tri **alphabétique** (`nom`, `localeCompare('fr')`) en `006` ; `ordreAffichage` initialisé mais **non édité** (réordonnancement par glisser-déposer différé, comme `004`). **À confirmer.**
8. **Helper `libelleJours` dans `libelles.js` (retenu)** — Retenu plutôt qu'un `map(libelleJour).join(', ')` en ligne dans la vue : garde la vue sans logique et mutualise l'énumération FR (« … et … ») pour `007`/`010`. **Alternative KISS** (inline dans la vue) possible si l'on veut zéro ajout au domaine. **À confirmer.**
9. **Extractions de composants réutilisables — différées** — Le **sélecteur de couleur accessible** (dupliqué de `FormulairePersonne` vers `FormulaireTournee`) et les **cases jours ISO** (dupliquées de `FormulairePreference`) restent **en ligne** (KISS, cohérent avec le choix `005 §12.9` de ne pas extraire `ChoixJoursSemaine`). L'extraction de composants partagés `SelecteurCouleur` et `ChoixJoursSemaine` (réutilisés par `004`/`005`/`006`/`007`) devient **pertinente à 3 usages** : à **acter par le mainteneur** comme refactoring transverse — **noté comme dette**, non requis ici.
10. **`PREFERENCE_TOURNEE` — DÉCISION : réactivation retenue, mais isolée en tâche optionnelle T4** — `005` avait **différé** ce type faute de tournées ; elles existent désormais et le domaine (`preferences.js`) est **structurellement prêt** (`normaliserParams`/`decrirePreference`/`LIBELLES_TYPE_PREFERENCE` couvrent déjà le type ; seul `META_TYPES_PREFERENCE` porte un placeholder `champs:'minMax'`). **Coût/bénéfice** : bénéfice réel (solde la dette `005`, enrichit les données du futur moteur `009`, continuité annoncée par `005 §12.3`) ; coût non nul (touche des fichiers de `005` — `FormulairePreference`, `SouhaitsView`, `preferences.js` — ajoute un cas « aucune tournée disponible », impose un **résolveur** injecté dans `decrirePreference` pour nommer les tournées sans casser sa pureté, et un contrôle d'intégrité `tourneeIds` dans `verifierIntegrite`). **Choix** : la **retenir** pour ne pas laisser traîner la dette, **mais l'isoler dans la tâche optionnelle T4** (après T1–T3) afin de **ne pas alourdir le cœur du CRUD** — qui reste l'objet strict de la ROADMAP `006`. **Repli assumé** : si le mainteneur préfère un `006` minimal, **écarter T4** et la conserver comme dette explicite dans `005 §12.3` (à traiter avec `009`/`010`, qui consommeront réellement ce type). **À trancher par le mainteneur** : implémenter T4 maintenant, ou la différer.
11. **Point de vigilance technique — modale Bootstrap** — Réutilisation de `ModaleBase` : ne jamais `v-if` l'élément `.modal`, piloter via `visible`, poser le focus sur `affichee` (pas de `setTimeout`), replacer le focus sur un point stable après archivage/restauration (le bouton déclencheur disparaît du DOM). Tout est déjà encapsulé dans `ModaleBase`/le patron `EquipeView` : **suivre ces patrons à l'identique**.
