# Feature 0004 — Gestion de l'équipe

- **Statut** : Fait
- **Dépend de** : `0002` (store persisté, module `personnes`, `schema.js`, plugin de persistance débouncé). S'appuie aussi sur `0003` (composant `IndicateurSauvegarde`, module `src/domain/libelles.js`, action `cabinet/majParametres` non requise mais mêmes patterns).
- **ADR liés** : [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Options API + Vuex), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière repository), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (domaine = module pur), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"` + horodatages ISO UTC), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + Bootstrap thémé par tokens, dont le composant **modale**), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor).

## 1. Contexte & objectif

C'est le **deuxième écran réel** de l'application et le **premier vrai CRUD de liste**. À l'issue de `0002`, la collection `personnes` existe dans l'état (vide, persistée automatiquement) mais **aucun écran ne permet de la consulter ni de la modifier** : `EquipeView.vue` est un simple placeholder.

La feature `0004` rend l'écran **Équipe** opérationnel pour le référent (public **peu à l'aise avec l'informatique**) : **lister, ajouter, modifier, archiver et restaurer** les personnes du cabinet. Chaque personne porte les informations qui serviront de socle aux features suivantes : identité (prénom, nom), **statut** (titulaire / remplaçant), **couleur** de repère pour le planning, **quotité** (temps de travail), **dates** d'arrivée/départ, et un **indicateur d'activité** (`actif`) qui matérialise le **soft-delete**.

Chaque enregistrement valide est **persisté automatiquement** (plugin de persistance débouncé de `0002`), avec un **retour visuel clair** réutilisant `IndicateurSauvegarde` (`0003`). Les personnes archivées ne sont **jamais supprimées physiquement** (règle d'intégrité [02 §Intégrité](../docs/architecture/02-modele-de-domaine.md)) : elles restent référençables par les plannings historiques (features `0010`+).

**Hors périmètre `0004`** (à ne pas implémenter ici) :

- **Souhaits & préférences** d'une personne (`preferences[]`) — c'est la feature `0005` (route `/equipe/:id/souhaits`). La feature `0004` initialise `preferences` à `[]` et ne l'édite pas.
- **Réordonnancement manuel** (`ordreAffichage`) par glisser-déposer — différé (le champ est initialisé mais non édité ; le tri d'affichage est alphabétique, voir §6).
- **Suppression définitive** d'une personne — **interdite** par principe (soft-delete only, [02](../docs/architecture/02-modele-de-domaine.md)). Seul l'archivage (réversible) est proposé.
- Absences, tournées, planning — features `0006`/`0007`/`0010`+.

## 2. Écrans concernés

Une seule route, déjà déclarée en `0001` ([07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md)) :

| Route | Écran | Changement `0004` |
|---|---|---|
| `/equipe` | **Équipe** | Remplace le placeholder par la **liste des personnes + le CRUD** (ajout/édition en modale, archivage/restauration). |

> Aucune route paramétrée n'est ajoutée ici. `/equipe/:id/souhaits` reste à la feature `0005`.

**Expérience visée** (utilisateur non-technique) :

- Un titre d'écran explicite (« Équipe ») et **une action principale dominante** : le bouton « Ajouter une personne » (`btn btn-primary`, icône Phosphor `PhUserPlus`), toujours visible en haut de l'écran.
- La **liste** est lisible : chaque personne affiche une **pastille de couleur doublée du nom** (jamais la couleur seule), son **statut en toutes lettres** (« Titulaire » / « Remplaçant »), sa **quotité** (« 80 % »), et sa **période de présence** si renseignée.
- **État vide accueillant** : au premier lancement, un message chaleureux (« Aucune personne pour l'instant. Ajoutez la première pour composer votre équipe. ») avec le même gros bouton d'ajout.
- **Ajout / édition dans une modale** : une fenêtre claire s'ouvre par-dessus la liste (le contexte reste visible), avec peu de champs groupés, un **sélecteur de couleur ergonomique** (palette de suggestion du cabinet + choix libre), un bouton **« Enregistrer »** dominant et **« Annuler »** toujours disponible. Fermeture au clavier (Échap) et par clic hors de la fenêtre.
- **Archivage réversible et confirmé** : « Archiver » ouvre une **demande de confirmation** en langage clair expliquant que la personne est **conservée** et **restaurable**. Une section repliée « Personnes archivées » permet de les revoir et de les **restaurer** en un clic (action sûre, sans confirmation).
- **Feedback permanent** : après chaque enregistrement/archivage/restauration, l'indicateur « Modifications enregistrées » confirme la persistance ; les erreurs de saisie s'affichent **sous le champ concerné**, en disant **quoi corriger**, sans jamais perdre la saisie.

## 3. Modèle de données touché

Entité **`Personne`**, déjà décrite dans le modèle de domaine ([02 §Personne](../docs/architecture/02-modele-de-domaine.md)) et présente en tant que collection racine `personnes.items` (vide) depuis `0002`. **Aucune nouvelle structure, aucun nouveau champ, aucune migration.**

Champs de `Personne` **manipulés** par `0004` :

| champ | type | oblig. | rôle `0004` |
|---|---|---|---|
| `id` | uuid | oui | généré à la création via `genId()` ; **immuable** |
| `prenom` | string | oui | édité (requis) |
| `nom` | string | oui | édité (requis) |
| `statut` | enum (`TITULAIRE`/`REMPLACANT`) | oui | édité (défaut `TITULAIRE`) |
| `actif` | boolean | oui | **soft-delete** : `true` = active, `false` = archivée (défaut `true`) |
| `couleur` | string hex `#RRGGBB` | oui | édité (défaut = 1re couleur de `couleursParDefaut`) |
| `quotite` | number 0..100 | oui | édité (défaut `100`) |
| `dateEntree` | `"YYYY-MM-DD"` \| null | non | édité (facultatif) |
| `dateSortie` | `"YYYY-MM-DD"` \| null | non | édité (facultatif ; ≥ `dateEntree`) |
| `contact` | `{ email?, telephone? }` | non | édité (facultatif) |
| `notes` | string | non | édité (facultatif) |
| `ordreAffichage` | integer | non | initialisé, **non édité** (réordonnancement différé) |
| `preferences` | Preference[] | oui | initialisé à `[]`, **non édité** (feature `0005`) |
| `createdAt` / `updatedAt` | ISO UTC | oui | posés/rafraîchis automatiquement (`new Date().toISOString()`) |

> **Convention de soft-delete confirmée** dans `schema.js` et [02](../docs/architecture/02-modele-de-domaine.md) : c'est le booléen **`actif`** (`false` = archivée), **pas** un `archivedAt`. (Le champ `archivee` existe, lui, pour `Tournee`, feature `0006`.)

**Impact `schemaVersion` / migrations** : **aucun**. `CURRENT_SCHEMA_VERSION` reste `1`. La collection `personnes` et l'entité sont déjà couvertes par `toSaveDocument`/`fromSaveDocument`/`verifierIntegrite`.

## 4. Store (Vuex)

Module `personnes` ([04-gestion-etat-vuex.md](../docs/architecture/04-gestion-etat-vuex.md), [instructions/etat-vuex.md](../docs/instructions/etat-vuex.md)). Après `0002` il expose : `state {items: []}`, getters `byId` et `actifs`, mutation `REPLACE`. Il **n'a pas encore d'action CRUD** (elles étaient explicitement différées à `0004`).

### 4.1 Getters

- `actifs` (**existant**) : `state.items.filter((p) => p.actif)`.
- `byId` (**existant**) : `(id) => state.items.find((p) => p.id === id)`.
- `inactifs` (**ajout**) : `state.items.filter((p) => p.actif === false)` — alimente la section « Personnes archivées ».

> Le **tri d'affichage** (alphabétique) est un choix de présentation : il est fait dans le composant (§6), pas dans le getter (KISS, cohérent avec « la logique métier au domaine, l'affichage à l'UI »).

### 4.2 Mutations

Deux mutations **ajoutées** (la mutation `REPLACE` d'hydratation reste inchangée), volontairement **fines** : elles n'appliquent qu'une modification de state, sans logique métier ni horodatage (posés en amont par l'action/domaine).

- `ADD(state, personne)` : ajoute une personne complète à la collection (`state.items.push(personne)`).
- `UPDATE(state, { id, patch })` : **fusion immuable par id** — remplace l'élément d'`id` donné par `{ ...ancien, ...patch }` (via `findIndex` + `splice`, ou reconstruction du tableau). Ne fait rien si l'id est introuvable.

### 4.3 Actions

Les actions **orchestrent** ; la construction/normalisation d'une personne vit dans le **domaine** (§5), jamais dans le store (règle d'or #10). Les horodatages techniques (`updatedAt`) sont posés dans l'action via `new Date().toISOString()` (même convention que `cabinet/majParametres` en `0003`).

- `ajouter({ commit }, champs)` : construit une personne complète via `creerPersonne(champs)` (§5.1) puis `commit('ADD', personne)`.
- `modifier({ commit }, { id, ...champs })` : `commit('UPDATE', { id, patch: { ...champs, updatedAt: <ISO UTC> } })`. Ne touche jamais `id`, `createdAt`, `preferences` (non présents dans `champs`).
- `desactiver({ commit }, id)` : archivage (soft-delete) — `commit('UPDATE', { id, patch: { actif: false, updatedAt: <ISO UTC> } })`.
- `reactiver({ commit }, id)` : restauration — `commit('UPDATE', { id, patch: { actif: true, updatedAt: <ISO UTC> } })`.

> **Vocabulaire** : côté **données/store** on reste aligné sur le champ `actif` (`desactiver`/`reactiver`, getter `inactifs`) ; côté **UI** on emploie les libellés plus chaleureux « Archiver » / « Restaurer » / « Personnes archivées » (voir §8 et §12). Correspondance : « Archiver » → `desactiver`, « Restaurer » → `reactiver`.

### 4.4 Persistance (déjà en place, rien à ajouter)

Chaque `commit` d'une mutation `personnes/*` (hors `REPLACE` d'hydratation, qui passe aussi par le plugin sans dommage) déclenche le **plugin de persistance débouncé (~400 ms)** de `src/store/index.js`, qui sérialise via `toSaveDocument` et écrit via `storageRepository.save`. **Ne rien réimplémenter**, **aucun accès `localStorage`** dans le module ou les composants ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).

### 4.5 État racine consommé en lecture seule

L'écran **lit** (sans jamais les muter) l'état racine de sauvegarde posé en `0002` pour le retour visuel, exactement comme `0003` :

- `state.statutSauvegarde` (`INACTIF | EN_COURS | ENREGISTRE | ERREUR | ERREUR_CHARGEMENT`) ;
- `state.derniereSauvegarde` (ISO UTC de la dernière écriture réussie, ou `null`).

Il lit aussi le getter `cabinet/parametres` pour récupérer `couleursParDefaut` (palette de suggestion du sélecteur de couleur).

## 5. Domaine (logique pure)

Tout dans `src/domain/`, **sans import Vue/Vuex ni `localStorage`** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)). Réutilisable par les features suivantes (souhaits, absences, planning).

### 5.1 `src/domain/personnes.js` (**nouveau**) — fabrique & normalisation d'une Personne

- **`creerPersonne(champs)`** → `Personne` : construit une personne **complète et normalisée** à partir d'un objet partiel (les champs saisis dans le formulaire), en appliquant les **valeurs par défaut** et en générant les champs techniques. Fonction **pure** (hors `genId()` et `new Date().toISOString()`, tolérés car techniques — même usage que `schema.js`).
  - `id` : `champs.id ?? genId()` (import de `src/domain/utils/id.js`).
  - `prenom` / `nom` : `String(champs.prenom ?? '').trim()` / idem `nom`.
  - `statut` : `champs.statut ?? 'TITULAIRE'` (validé ∈ `STATUTS_PERSONNE` de `schema.js`).
  - `actif` : `champs.actif ?? true`.
  - `couleur` : `champs.couleur ?? COULEURS_PAR_DEFAUT[0]` (import de `COULEURS_PAR_DEFAUT` depuis `schema.js`).
  - `quotite` : `champs.quotite ?? 100`.
  - `dateEntree` : `champs.dateEntree ?? null` ; `dateSortie` : `champs.dateSortie ?? null`.
  - `contact` : `{ email: champs.contact?.email ?? null, telephone: champs.contact?.telephone ?? null }`.
  - `notes` : `champs.notes ?? ''`.
  - `ordreAffichage` : `champs.ordreAffichage ?? null`.
  - `preferences` : `champs.preferences ?? []` (jamais éditées en `0004`).
  - `createdAt` : `champs.createdAt ?? <ISO UTC courant>` ; `updatedAt` : `<ISO UTC courant>`.
  - JSDoc : `@typedef {Object} Personne` (aligné sur [02 §Personne](../docs/architecture/02-modele-de-domaine.md)) + `@param`/`@returns`.

> La fabrique ne connaît **pas** `couleursParDefaut` du cabinet : la couleur choisie est fournie par le composant (prop `couleursSuggerees`). Le fallback `COULEURS_PAR_DEFAUT[0]` de `schema.js` n'est qu'un garde-fou si aucune couleur n'est transmise.

### 5.2 `src/domain/libelles.js` (**modifier**) — libellés de statut

Ajouts (dans le même esprit que `JOURS_SEMAINE`/`LIBELLES_CRENEAU` déjà présents) :

| Export | Forme | Rôle |
|---|---|---|
| `LIBELLES_STATUT_PERSONNE` | `{ TITULAIRE: 'Titulaire', REMPLACANT: 'Remplaçant' }` | Table code → libellé FR. |
| `libelleStatutPersonne(code)` | `(string) → string` | `'TITULAIRE' → 'Titulaire'` ; `''` si inconnu. |
| `STATUTS_PERSONNE_OPTIONS` | `[{ code: 'TITULAIRE', libelle: 'Titulaire' }, { code: 'REMPLACANT', libelle: 'Remplaçant' }]` | Liste prête à itérer pour le `form-select` / groupe de boutons radio du formulaire. |

> Les **codes** restent la source de vérité dans `schema.js` (`STATUTS_PERSONNE`) ; ce module ne porte que l'affichage. `STATUTS_PERSONNE_OPTIONS` est dérivée de `STATUTS_PERSONNE` + `LIBELLES_STATUT_PERSONNE` pour garantir la cohérence.

### 5.3 Dates & horodatages

Aucune manipulation `Date` custom : les champs `dateEntree`/`dateSortie` sont saisis via `<input type="date">`, qui **produit et consomme nativement** le format `"YYYY-MM-DD"` ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)). La comparaison `dateSortie ≥ dateEntree` se fait par **comparaison lexicographique de chaînes** `"YYYY-MM-DD"` (l'ordre lexicographique coïncide avec l'ordre chronologique) — **aucun objet `Date`**, aucun appel hors `dateUtil`. L'affichage éventuel d'une période lisible réutilise `dateUtil.formatHorodatageFr` seulement si nécessaire ; sinon, afficher directement les chaînes `"YYYY-MM-DD"` (KISS).

## 6. Composants

Séparation conforme à [06-structure-du-code.md](../docs/architecture/06-structure-du-code.md) : les composants transverses (modale, confirmation) vont dans `components/communs/` ; le formulaire spécifique dans `components/equipe/` ; l'écran routé dans `views/`.

### 6.1 `src/components/communs/ModaleBase.vue` (**nouveau**, réutilisable)

Coquille de **modale accessible**, seul endroit qui pilote le composant **Modal de Bootstrap** ([ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md)). On s'appuie sur Bootstrap (et non sur une modale « maison ») **précisément pour l'accessibilité fournie clé en main** : piégeage du focus, fermeture par `Échap`, retour du focus à l'élément déclencheur, gestion ARIA (`role="dialog"`, `aria-modal`, `aria-labelledby`).

- **Props** : `visible` (Boolean, requis), `titre` (String, requis), `taille` (String, optionnel : `''`/`'lg'`).
- **Slots** : `default` (corps), `pied` (boutons d'action).
- **Événement** : `fermeture` — émis quand Bootstrap masque la modale (clic sur la croix, `Échap`, clic hors fenêtre), pour que le parent repositionne `visible` à `false` (source de vérité côté parent).
- **Intégration Bootstrap JS** (documentée pour dérisquer) :
  - `import Modal from 'bootstrap/js/dist/modal'` (import **par composant**, autorisé par [style-scss](../docs/instructions/style-scss.md)) ;
  - `mounted()` : instancier `this.instance = new Modal(this.$refs.modale)` et écouter `hidden.bs.modal` → `this.$emit('fermeture')` ;
  - `watch: { visible }` : `visible ? this.instance.show() : this.instance.hide()` ;
  - `beforeUnmount()` : retirer l'écouteur et `this.instance?.dispose()`.
  - **Ne jamais** `v-if` l'élément racine `.modal` (Bootstrap doit conserver la référence DOM) : c'est `visible` qui pilote `show()/hide()`.
- **Markup** : structure Bootstrap standard (`.modal > .modal-dialog > .modal-content > .modal-header/.modal-body/.modal-footer`), croix de fermeture `btn-close` avec `aria-label="Fermer"`, titre en `h2` (id relié par `aria-labelledby`).

### 6.2 `src/components/communs/DialogueConfirmation.vue` (**nouveau**, réutilisable)

Demande de confirmation générique, bâtie **au-dessus de `ModaleBase`** (réutilisable pour l'archivage ici, et plus tard réinitialisation/import `0008`, suppression tournée `0006`…).

- **Props** : `visible` (Boolean), `titre` (String), `message` (String), `libelleConfirmer` (String, défaut `'Confirmer'`), `varianteConfirmer` (String, défaut `'primary'` — `'danger'` pour les actions vraiment destructrices).
- **Événements** : `confirmer`, `annuler`.
- **Rendu** : message dans le corps ; pied avec « Annuler » (`btn btn-outline-secondary` → `annuler`) et le bouton de confirmation (`btn btn-{variante}` → `confirmer`). `@fermeture` de `ModaleBase` ⇒ `annuler` (fermeture au clavier/backdrop = annulation, choix non destructif).

### 6.3 `src/components/equipe/FormulairePersonne.vue` (**nouveau**)

Formulaire **présentational** d'ajout/édition, bâti au-dessus de `ModaleBase`. **N'accède pas au store** : il reçoit ses données par props et **émet** le résultat ; l'écran (`EquipeView`) dispatche.

- **Props** :
  - `visible` (Boolean) ;
  - `personne` (Object|null) — `null` = mode **création**, objet = mode **édition** ;
  - `couleursSuggerees` (String[]) — palette issue de `cabinet/parametres.couleursParDefaut`.
- **Événements** : `enregistrer` (payload = champs normalisés du formulaire) ; `annuler`.
- **État local** (`data().formulaire`) : copie de travail réinitialisée **à chaque ouverture** (`watch: visible`) — depuis `personne` (édition) ou depuis les **valeurs par défaut** (création : `statut = 'TITULAIRE'`, `quotite = 100`, `couleur = couleursSuggerees[0]`, dates vides, `actif = true`). Ne jamais muter la prop `personne`.
- **Titre de la modale** : « Ajouter une personne » (création) / « Modifier la personne » (édition).
- **Champs & regroupement** (peu de champs à la fois, [08](../docs/architecture/08-principes-ux-ergonomie.md)) :
  1. **Identité** — `prenom`, `nom` : `<input type="text">` requis, `autofocus` sur le prénom à l'ouverture.
  2. **Statut** — `form-select` (ou groupe de boutons radio) alimenté par `STATUTS_PERSONNE_OPTIONS` (libellés FR).
  3. **Couleur de repère** — **sélecteur ergonomique** : un `role="radiogroup"` (`aria-label="Couleur de repère dans le planning"`) de pastilles cliquables (~44 px) issues de `couleursSuggerees` ; la pastille sélectionnée porte une **icône `PhCheck`** superposée (repère **non-coloré**, jamais l'info par la seule couleur) + `aria-checked`. Un `<input type="color">` complémentaire (« Autre couleur… ») autorise un choix libre (le schéma accepte n'importe quel hex). Un aperçu « pastille + Prénom Nom » montre le rendu final.
  4. **Temps de travail** — `quotite` : `<input type="number" min="0" max="100" step="1">` (`v-model.number`) + suffixe « % » et texte d'aide.
  5. **Présence** (facultatif) — `dateEntree` et `dateSortie` : `<input type="date">` (produisent du `"YYYY-MM-DD"`), libellés « Date d'arrivée » / « Date de départ (si connue) ».
  6. **Coordonnées & notes** (facultatif, section discrète) — `contact.email` (`type="email"`), `contact.telephone` (`type="tel"`, placeholder `06 12 34 56 78`), `notes` (`textarea`).
- **Pied de modale** : « Annuler » (`btn btn-outline-secondary`) et **« Enregistrer »** (`btn btn-primary`, action dominante). À la soumission : `v$.$touch()` ; si `!$invalid`, `$emit('enregistrer', <champs>)` ; sinon afficher les messages sous les champs et **ne rien émettre** (aucune perte de saisie).
- **Vuelidate** : voir §7. Le pont `setup(){ return { v$: useVuelidate() } }` est le **seul** usage de Composition API (identique à `ParametresView`).
- **Icônes** : `PhCheck` (couleur sélectionnée), `PhWarning` (messages d'erreur, même présentation que `ParametresView`).

### 6.4 `src/views/EquipeView.vue` (**réécriture** complète du placeholder)

Écran routé (Options API). **Orchestre** : liste + modales, sans logique métier (délègue au store/domaine).

- **Titre** `<h1>` « Équipe ».
- **En-tête d'action** : bouton principal **« Ajouter une personne »** (`PhUserPlus`) ⇒ ouvre `FormulairePersonne` en création (`personne = null`).
- **Indicateur de sauvegarde** : `IndicateurSauvegarde` (`0003`) alimenté par `statutSauvegarde`/`derniereSauvegarde` (root state via `mapState`) et `apres-edition="aEdite"` (passe à `true` après le 1er ajout/édition/archivage/restauration — même logique que `ParametresView`). Reprend aussi l'encart `ERREUR_CHARGEMENT` de `0003`.
- **État vide** : si `actifs` **et** `inactifs` sont vides → encart accueillant (icône `PhUsers`, « Aucune personne pour l'instant. Ajoutez la première pour composer votre équipe. ») + bouton d'ajout.
- **Liste des personnes actives** (`actifs`, triées) : une **liste de cartes/lignes** (pas un tableau dense — plus lisible pour le public cible et responsive). Chaque ligne affiche :
  - **pastille de couleur** (carré/rond `couleur`) **+ « Prénom Nom »** (couleur toujours doublée du nom) ;
  - **statut** en toutes lettres (`libelleStatutPersonne`) ;
  - **quotité** « {quotite} % » ;
  - **période** si `dateEntree`/`dateSortie` renseignées (ex. « depuis le 01/09/2019 », « jusqu'au … ») ;
  - **actions** : « Modifier » (`PhPencilSimple`) ⇒ ouvre `FormulairePersonne` en édition ; « Archiver » (`PhArchive`) ⇒ ouvre `DialogueConfirmation`. Boutons avec **libellé texte** (pas d'icône seule).
- **Section « Personnes archivées »** (`inactifs`) : **repliée par défaut** via une bascule **Vue simple** (booléen `data`, pas de JS Bootstrap `collapse`) titrée « Personnes archivées ({{ inactifs.length }}) » ; masquée si `inactifs` est vide. Chaque ligne (présentation atténuée) propose « Restaurer » (`PhArrowCounterClockwise`) ⇒ `reactiver(id)` **directement** (action sûre, non destructive, sans confirmation) + feedback via l'indicateur. Une phrase explique « Les personnes archivées sont conservées pour l'historique des plannings. »
- **Tri d'affichage** (computed) : actives et archivées triées par `nom` puis `prenom` via `localeCompare('fr')` (présentation ; `ordreAffichage` non utilisé en `0004`).
- **Modales** : instances de `FormulairePersonne` (création/édition, pilotée par `formulaireVisible` + `personneEnCours`) et `DialogueConfirmation` (archivage, pilotée par `confirmationVisible` + `personneAArchiver`). Handlers :
  - `onEnregistrer(champs)` : si `personneEnCours` ⇒ `modifier({ id: personneEnCours.id, ...champs })` ; sinon ⇒ `ajouter(champs)`. Puis `aEdite = true`, ferme la modale.
  - `onConfirmerArchivage()` : `desactiver(personneAArchiver.id)`, `aEdite = true`, ferme la confirmation.
- **Accès store** : `mapGetters('personnes', ['actifs', 'inactifs'])`, `mapGetters('cabinet', ['parametres'])`, `mapActions('personnes', ['ajouter', 'modifier', 'desactiver', 'reactiver'])`, `mapState(['statutSauvegarde', 'derniereSauvegarde'])`. **Aucune logique métier** : libellés via `libelles.js`, construction de la personne via l'action `ajouter` (qui appelle `creerPersonne`).

### 6.5 `src/styles/_bootstrap.scss` (**modifier**) — importer le module `modal`

Le module SCSS `modal` **n'est pas encore importé** (seuls `reboot`, `grid`, `containers`, `buttons`, `forms`, `nav`, `navbar`, `alert`, `utilities` le sont). Ajouter, dans la section « modules réellement utilisés » et **avant** `utilities` :

```scss
@import 'bootstrap/scss/close';   // bouton de fermeture (btn-close) des modales
@import 'bootstrap/scss/modal';   // composant modale (feature 0004)
```

> `close` est requis pour la croix `btn-close`. Aucun autre module n'est nécessaire (le statut et les pastilles sont stylés en SCSS `scoped`, pas via `badge`, pour limiter le poids importé — KISS).

### 6.6 Réutilisation & style

- `IndicateurSauvegarde` (`components/communs/`), `libelles.js`, `dateUtil`, tokens SCSS, intégration Bootstrap, icônes Phosphor : **déjà en place**, réutilisés tels quels.
- La directive `v-debounce` (enregistrée globalement en `0003`) **n'est pas nécessaire** ici (formulaire à validation explicite, pas de saisie auto-persistée en continu).
- Le SCSS `scoped` de chaque composant ne sert qu'au **spécifique** (pastilles de couleur, sélecteur de couleur, lignes de liste, présentation atténuée des archivées) — tout le reste via classes Bootstrap (`btn`, `form-*`, `modal-*`, grille, utilitaires d'espacement). Cibles ~44 px (`$cible-cliquable-min`), focus visible, aucune valeur « magique » (tokens uniquement).

## 7. Règles de validation

Vuelidate ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md), [instructions/formulaires-validation.md](../docs/instructions/formulaires-validation.md)) dans `FormulairePersonne`. Règles déclaratives, **messages FR orientés correction**, affichés **après interaction** (blur) ou **à la tentative d'enregistrement** — jamais sur un formulaire vierge.

| Champ | Règle | Message FR (exemple) |
|---|---|---|
| `prenom` | `required` | « Indiquez le prénom de la personne. » |
| `nom` | `required` | « Indiquez le nom de la personne. » |
| `statut` | ∈ `STATUTS_PERSONNE` | (liste fermée : pas de saisie libre) |
| `couleur` | requise, format hex `#RRGGBB` | « Choisissez une couleur de repère. » |
| `quotite` | `required`, `integer`, `between(0, 100)` | « Indiquez un temps de travail entre 0 et 100 %. » |
| `dateEntree` | facultative | (aucune, sauf cohérence ci-dessous) |
| `dateSortie` | facultative ; si `dateEntree` **et** `dateSortie` renseignées ⇒ `dateSortie ≥ dateEntree` (comparaison de chaînes `"YYYY-MM-DD"`) | « La date de départ doit être identique ou postérieure à la date d'arrivée. » |
| `contact.email` | facultatif ; si rempli, format `email` | « Saisissez une adresse e-mail valide (ex. nom@exemple.fr). » |
| `contact.telephone` | facultatif, texte libre | (aucune) |
| `notes` | facultatif ; `maxLength` (ex. 500) | « La note ne doit pas dépasser 500 caractères. » |

**Comportement d'enregistrement** : l'**ensemble** du formulaire est validé au clic sur « Enregistrer » ; si un champ est invalide, l'enregistrement est **bloqué**, les messages s'affichent sous les champs concernés, et la **saisie est conservée** (tolérance à l'erreur, zéro perte — [08](../docs/architecture/08-principes-ux-ergonomie.md)). « Annuler » / `Échap` / clic hors fenêtre ferment sans enregistrer.

> Contrairement à `0003` (auto-save par champ d'un singleton), un CRUD de liste en modale utilise une **validation + enregistrement explicite** (bouton « Enregistrer ») : c'est le modèle attendu par l'utilisateur pour créer/éditer une fiche.

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie.md](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Langage humain, zéro jargon** : « Ajouter une personne », « Titulaire / Remplaçant », « Temps de travail », « Date d'arrivée », « Archiver », « Personnes archivées ». Jamais « instance », « CRUD », « soft-delete », « champ invalide ».
- **Une action principale par écran** : « Ajouter une personne », visuellement dominante.
- **Couleur toujours doublée du nom** (liste et aperçu du formulaire) ; sélecteur de couleur avec **repère non-coloré** (icône `PhCheck` + état `aria-checked`) — jamais l'information par la seule couleur (daltoniens, impression, [ADR 0013](../docs/adr/0013-icones-phosphor.md)).
- **État vide accueillant** plutôt qu'une page blanche ; invite claire à démarrer.
- **Réversibilité & confirmation** : archivage (réversible) précédé d'une **confirmation en langage clair** rappelant que la personne est **conservée** et **restaurable** ; **jamais de suppression définitive** (soft-delete, [08 §6](../docs/architecture/08-principes-ux-ergonomie.md)). La restauration, sûre, se fait sans confirmation.
- **Feedback immédiat** : indicateur « Modifications enregistrées » après chaque opération ; erreurs sous le champ, disant **quoi corriger**.
- **Tolérance à l'erreur** : la saisie n'est jamais perdue si la validation échoue ; valeurs par défaut raisonnables (statut Titulaire, quotité 100 %, 1re couleur suggérée) pour réduire l'effort.
- **Modale accessible** : focus piégé, **fermeture au clavier (`Échap`)**, retour du focus à l'ouvrant, `autofocus` sur le 1er champ (fournis par le composant Modal de Bootstrap via `ModaleBase`).
- **Ergonomie physique** : cibles ~44 px (boutons, pastilles, cases), bon espacement, `label` associé à chaque champ, **focus clavier visible**, structure de titres `h1 → h2`.
- **Cohérence** : mêmes patterns que `0003` (indicateur de sauvegarde, présentation des erreurs) ; « Ajouter » se comportera pareil sur les futurs écrans (`0006`/`0007`).

## 9. Étapes d'implémentation

Découpage en **4 tâches**, chacune destinée à **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé par les dépendances : **T1 → T2 → T3 → T4** (domaine + store d'abord ; socle modale ; formulaire ; écran).

### Tâche 1 — Domaine (fabrique Personne + libellés de statut) & store `personnes` (CRUD)

**Fichiers** :
- `src/domain/personnes.js` (**créer**) — `creerPersonne(champs)` (§5.1), pur, JSDoc `@typedef Personne`.
- `src/domain/libelles.js` (**modifier**) — `LIBELLES_STATUT_PERSONNE`, `libelleStatutPersonne`, `STATUTS_PERSONNE_OPTIONS` (§5.2).
- `src/store/modules/personnes.js` (**modifier**) — getter `inactifs` ; mutations `ADD`, `UPDATE` (fusion immuable par id) ; actions `ajouter`, `modifier`, `desactiver`, `reactiver` (§4). Conserver `actifs`, `byId`, `REPLACE`.

**Critères de sortie** :
- `creerPersonne({ prenom: 'Claire', nom: 'Martin' })` renvoie une personne **complète** : `id` non vide, `statut === 'TITULAIRE'`, `actif === true`, `quotite === 100`, `couleur` = `COULEURS_PAR_DEFAUT[0]`, `preferences === []`, `contact === { email: null, telephone: null }`, `createdAt`/`updatedAt` ISO UTC.
- `creerPersonne` respecte les valeurs fournies quand elles existent (ex. `statut: 'REMPLACANT'`, `couleur: '#123456'`, `quotite: 80`).
- `libelleStatutPersonne('REMPLACANT') === 'Remplaçant'` ; `STATUTS_PERSONNE_OPTIONS` a 2 entrées cohérentes avec `STATUTS_PERSONNE`.
- `dispatch('personnes/ajouter', { prenom, nom })` ⇒ `getters['personnes/actifs']` contient la personne ; `dispatch('personnes/modifier', { id, quotite: 50 })` ⇒ quotité à 50 et `updatedAt` **rafraîchi**, `id`/`createdAt`/`preferences` inchangés ; `dispatch('personnes/desactiver', id)` ⇒ personne quitte `actifs`, apparaît dans `inactifs` ; `reactiver` inverse.
- Aucun import Vue/Vuex dans `personnes.js`/`libelles.js` ; aucun accès `localStorage` ; aucun `Date.getDay()` ni `new Date("YYYY-MM-DD")`.

### Tâche 2 — Socle modale réutilisable (`ModaleBase` + `DialogueConfirmation`) + SCSS Bootstrap

**Fichiers** :
- `src/styles/_bootstrap.scss` (**modifier**) — importer `bootstrap/scss/close` puis `bootstrap/scss/modal` (§6.5).
- `src/components/communs/ModaleBase.vue` (**créer**) — coquille pilotant le Modal de Bootstrap via prop `visible`, slots `default`/`pied`, événement `fermeture` (§6.1).
- `src/components/communs/DialogueConfirmation.vue` (**créer**) — au-dessus de `ModaleBase`, props (`visible`, `titre`, `message`, `libelleConfirmer`, `varianteConfirmer`), événements `confirmer`/`annuler` (§6.2).

**Critères de sortie** :
- Une page de démonstration minimale (ou l'usage direct dans T4) montre : `visible=true` ouvre la modale, `visible=false` la ferme ; `Échap` et le clic hors fenêtre émettent `fermeture` ; le focus est piégé dans la modale et rendu à l'ouvrant à la fermeture.
- `DialogueConfirmation` affiche titre/message, émet `confirmer` sur le bouton principal et `annuler` sur « Annuler » / fermeture ; la variante du bouton de confirmation est pilotable.
- L'instance Bootstrap est bien libérée en `beforeUnmount` (`dispose`) ; l'élément `.modal` n'est jamais `v-if`.
- `npm run build` réussit (le module SCSS `modal` est résolu).

### Tâche 3 — `FormulairePersonne` (formulaire ajout/édition + validation + sélecteur de couleur)

**Fichiers** :
- `src/components/equipe/FormulairePersonne.vue` (**créer**) — formulaire présentational au-dessus de `ModaleBase`, props `visible`/`personne`/`couleursSuggerees`, événements `enregistrer`/`annuler`, Vuelidate (§6.3, §7).

**Dépend de** : T1 (`libelles.js`) et T2 (`ModaleBase`).

**Critères de sortie** :
- Mode **création** (`personne=null`) : champs vides sauf défauts (statut Titulaire, quotité 100, 1re couleur suggérée pré-sélectionnée) ; `autofocus` sur le prénom.
- Mode **édition** : tous les champs pré-remplis depuis `personne` ; la prop n'est jamais mutée ; réouverture réinitialise proprement le brouillon.
- Validation : prénom/nom requis, quotité 0–100 entière, e-mail (si saisi) valide, `dateSortie ≥ dateEntree` (comparaison de chaînes) — messages FR sous les champs, affichés après interaction/à la soumission ; enregistrement **bloqué** si invalide, **saisie conservée**.
- Sélecteur de couleur : palette cliquable (~44 px) depuis `couleursSuggerees`, pastille sélectionnée marquée par `PhCheck` + `aria-checked` ; choix libre via `<input type="color">` ; aperçu « pastille + Prénom Nom ».
- Soumission valide ⇒ `enregistrer` avec les champs normalisés (dates au format `"YYYY-MM-DD"` ou `null`) ; « Annuler »/`Échap` ⇒ `annuler`, aucun enregistrement.
- Icônes Phosphor doublées d'un libellé/`aria-label` ; aucune info par la seule couleur ; `label` associé à chaque champ ; `npm run build` réussit.

### Tâche 4 — Écran `EquipeView` (liste, état vide, archivées, orchestration)

**Fichiers** :
- `src/views/EquipeView.vue` (**réécrire**) — liste des actives, état vide, section repliable des archivées, bouton d'ajout, orchestration des modales, `IndicateurSauvegarde` (§6.4, §8).

**Dépend de** : T1 (store/getters/libellés), T2 (`DialogueConfirmation`), T3 (`FormulairePersonne`).

**Critères de sortie** :
- Au premier lancement (aucune personne) : **état vide** accueillant + bouton « Ajouter une personne ».
- Ajout : le formulaire s'ouvre, une personne valide est créée et apparaît immédiatement dans la liste (pastille + nom + statut + quotité) ; l'indicateur passe à « Modifications enregistrées » ; **recharger la page** conserve la personne.
- Édition : « Modifier » ouvre le formulaire pré-rempli ; les changements sont enregistrés et reflétés dans la liste.
- Archivage : « Archiver » ouvre la **confirmation** ; après confirmation la personne quitte la liste active et apparaît dans « Personnes archivées (N) » (repliée par défaut). Restauration : « Restaurer » la ramène dans les actives, sans confirmation.
- Tri alphabétique cohérent ; couleur toujours doublée du nom ; icônes doublées d'un libellé ; focus visible ; navigation clavier possible (ouvrir/fermer la modale, valider).
- Aucun accès `localStorage`, aucun objet `Date` hors `dateUtil`, aucune logique métier dans le composant ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] La route `/equipe` affiche la **liste des personnes** titrée « Équipe » (fini le placeholder), avec un bouton principal « Ajouter une personne ».
- [ ] **État vide** accueillant tant qu'aucune personne n'existe.
- [ ] **Ajouter** une personne (prénom, nom, statut, couleur, quotité, dates optionnelles) l'enregistre et l'affiche dans la liste ; l'indicateur montre « Modifications enregistrées ».
- [ ] **Recharger la page** restitue les personnes (persistance effective via `bootstrap`).
- [ ] **Modifier** une personne met à jour ses informations et rafraîchit `updatedAt` ; `id`, `createdAt` et `preferences` sont préservés.
- [ ] **Archiver** (soft-delete) passe `actif` à `false` **après confirmation** ; la personne quitte la liste active et rejoint « Personnes archivées ». Elle n'est **jamais** supprimée physiquement du document persisté.
- [ ] **Restaurer** repasse `actif` à `true` et ramène la personne dans les actives (sans confirmation).
- [ ] Validation : prénom et nom **requis** ; quotité **0–100** entière ; e-mail (si saisi) au bon format ; `dateSortie ≥ dateEntree`. Messages FR de correction, saisie jamais perdue.
- [ ] Le **sélecteur de couleur** propose la palette du cabinet + un choix libre ; la sélection est marquée par un repère **non-coloré** ; la couleur est **toujours doublée du nom** dans la liste.
- [ ] La **modale** est fermable au clavier (`Échap`), le focus y est piégé et rendu à l'ouvrant ; chaque champ a un `label` ; le focus clavier est visible.
- [ ] Aucun accès direct à `localStorage` ; aucun objet `Date` manipulé hors `dateUtil` ; aucune logique métier dans les composants.
- [ ] `npm run build` réussit.

## 11. Vérification

Parcours manuel (`npm run dev`, ouvrir `/equipe`) :

1. **État initial** — Sur un stockage vide (`localStorage.clear()` + recharger) : l'écran montre l'état vide accueillant et le bouton « Ajouter une personne ».
2. **Ajout** — Cliquer « Ajouter une personne » : la modale s'ouvre, focus sur le prénom. Saisir « Claire » / « Martin », statut « Titulaire », choisir une couleur, quotité 100. « Enregistrer » : la modale se ferme, Claire apparaît dans la liste (pastille + « Claire Martin » + « Titulaire » + « 100 % »). L'indicateur affiche « Modifications enregistrées ». **Recharger** → Claire est toujours là.
3. **Validation** — Rouvrir l'ajout, laisser le prénom vide et « Enregistrer » : message « Indiquez le prénom de la personne. », enregistrement bloqué, saisie conservée. Saisir une quotité `120` → « … entre 0 et 100 % ». Saisir `dateSortie` antérieure à `dateEntree` → message de cohérence.
4. **Édition** — « Modifier » sur Claire : formulaire pré-rempli. Passer la quotité à 80 et enregistrer → « 80 % » dans la liste ; recharger → conservé.
5. **Archivage** — « Archiver » sur Claire : la confirmation explique la conservation/restauration. Confirmer → Claire quitte les actives et apparaît sous « Personnes archivées (1) » (dépliée à la demande). `localStorage` : la personne existe toujours avec `actif: false` (jamais supprimée).
6. **Restauration** — Déplier « Personnes archivées », « Restaurer » Claire → elle revient dans les actives, sans confirmation.
7. **Sélecteur de couleur** — À l'édition, vérifier que la pastille sélectionnée porte l'icône de coche, qu'un choix libre via le sélecteur de couleur fonctionne, et que la liste montre bien pastille **+** nom.
8. **Accessibilité / clavier** — Ouvrir la modale, naviguer au `Tab` (focus piégé), fermer avec `Échap` (retour du focus au bouton d'ouverture). Focus visible partout ; labels présents.
9. **Persistance croisée** — Après plusieurs opérations, `JSON.parse(localStorage.getItem('idelia:data')).personnes` contient les personnes attendues avec `actif` cohérent ; `cabinet.couleursParDefaut` inchangé.
10. **Build** — `npm run build` réussit sans erreur.

## 12. Décisions à confirmer / risques

1. **Formulaire en modale (retenu) vs vue dédiée** — **Retenu : modale** (`ModaleBase` au-dessus du composant Modal de Bootstrap). Justification : le contexte de la liste reste visible ; **une seule route** `/equipe` (cohérent avec [07](../docs/architecture/07-navigation-et-ecrans.md), qui ne prévoit pas `/equipe/nouveau`) ; Bootstrap fournit une modale **accessible clé en main** (focus piégé, `Échap`, retour focus, ARIA) — exactement l'exigence de la [checklist](../docs/instructions/accessibilite-ergonomie.md) ; **pattern réutilisable** pour les CRUD `0006`/`0007`/`0008`. Alternative écartée : une **vue dédiée** ajouterait des routes non planifiées et sortirait l'utilisateur de la liste. **Repli** possible si l'intégration Modal JS s'avère fragile : un **panneau inline** sur la même page (à la manière du formulaire de `0003`), sans modale ; à acter avec le mainteneur.
2. **Convention de soft-delete** — **Confirmée dans `schema.js` / [02](../docs/architecture/02-modele-de-domaine.md)** : c'est le booléen **`Personne.actif`** (`false` = archivée), **pas** un `archivedAt`. Getter d'archivées nommé `inactifs`, actions `desactiver`/`reactiver` (alignés sur le champ), UI « Archiver »/« Restaurer » (plus chaleureux). **À confirmer** : accepter ce décalage volontaire vocabulaire données ↔ UI.
3. **Composants modale dans `components/communs/`** — `ModaleBase` + `DialogueConfirmation` créés comme **briques réutilisables** (la structure [06](../docs/architecture/06-structure-du-code.md) prévoit explicitement « modale, confirmation » dans `communs/`). Nécessite d'importer les modules SCSS `close` + `modal` de Bootstrap (non importés jusqu'ici) et le **JS Modal par composant** (autorisé par [style-scss](../docs/instructions/style-scss.md)). **À confirmer** : cet ajout d'imports Bootstrap.
4. **Champs inclus** — La ROADMAP cite « statut, couleur, quotité, dates ». J'inclus **en plus** `contact` (e-mail/téléphone) et `notes`, **facultatifs**, car naturels pour « gestion de l'équipe » et déjà prévus au schéma (coût quasi nul, la fabrique doit de toute façon initialiser tous les champs). **À confirmer** : les garder dans le formulaire ou les différer.
5. **Bornes de quotité** — Retenu : `between(0, 100)` entier (aligné sur le schéma et [formulaires-validation](../docs/instructions/formulaires-validation.md) « quotité 0–100 »). `0 %` reste techniquement saisissable ; si jugé illogique pour un membre actif, resserrer à `1..100`. **À confirmer**.
6. **Confirmation d'archivage, pas de restauration** — Archivage (retrait de la liste active) = **confirmé** ; restauration (sûre, additive) = **directe**. **À confirmer** : ce niveau d'effort.
7. **Tri & `ordreAffichage`** — Tri **alphabétique** (nom puis prénom) en `0004` ; `ordreAffichage` initialisé mais **non édité** (réordonnancement par glisser-déposer différé). **À confirmer**.
8. **Intégration Vue ↔ Bootstrap Modal** — Point de vigilance technique : ne pas `v-if` l'élément `.modal`, piloter via `show()/hide()`, écouter `hidden.bs.modal` pour synchroniser `visible`, `dispose()` en `beforeUnmount`. Risque de fuite/état incohérent si mal câblé — d'où l'encapsulation dans **`ModaleBase`** (un seul endroit à maîtriser).
