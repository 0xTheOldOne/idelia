# Feature 007 — Absences & congés

- **Statut** : Fait
- **Dépend de** : `004` (module `personnes` avec CRUD, getters `actifs`/`byId` — indispensables au sélecteur de personne et à l'affichage ; briques `ModaleBase`, `DialogueConfirmation`, `IndicateurSauvegarde` ; `src/domain/libelles.js`, `dateUtil`, patron Vuelidate + formulaire en modale de `FormulairePersonne`/`FormulaireTournee`). S'appuie indirectement sur `002` (store persisté, `schema.js` avec l'entité `Absence` et ses enums, module `absences` squelette `{ items:[] }` + getters `byId`/`parPersonne` + mutation `REPLACE`, plugin de persistance débouncé).
- **ADR liés** : [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Options API + Vuex), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière repository), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (domaine = module pur), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, horodatages ISO UTC), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + Bootstrap thémé, dont le composant modale), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor).

## 1. Contexte & objectif

Après l'équipe (`004`), ses souhaits (`005`) et les tournées (`006`), le cabinet a besoin d'enregistrer les **absences et congés** de ses membres : congés payés, RTT, arrêts maladie, maternité/paternité, formation… Chaque absence est **datée** (une période, éventuellement une demi-journée) et porte un **statut de validation** (`Demande` → `Validée` / `Refusée`). Ces données sont, avec l'équipe, les souhaits et les tournées, le dernier pilier de données de référence qui alimentera le **moteur de planification** (`009`) et la **génération** (`010`) : une absence **validée** empêchera d'affecter la personne sur cette période, une simple **demande** produira seulement un avertissement.

À l'issue de `002`, la collection `absences` existe dans l'état (vide, persistée automatiquement) et son module Vuex expose déjà `byId`/`parPersonne`/`REPLACE`, mais **aucun écran ne permet de la consulter ni de la modifier** : `AbsencesView.vue` est un simple placeholder. Les **actions CRUD étaient explicitement différées à `007`**.

La feature `007` rend l'écran **Absences & congés** opérationnel pour le référent (public **peu à l'aise avec l'informatique**) : **lister, ajouter, modifier, supprimer** les absences de toute l'équipe, et **traiter les demandes** (valider / refuser / remettre en demande). Le CRUD reprend le patron éprouvé de `004`/`006` : liste de cartes, ajout/édition en modale, confirmation avant suppression. Chaque enregistrement valide est **persisté automatiquement** (plugin débouncé de `002`) avec un **retour visuel clair** réutilisant `IndicateurSauvegarde`.

**Hors périmètre `007`** (à ne pas implémenter ici) :

- **Exploitation** des absences par le moteur (blocage d'affectation sur absence `VALIDE`, avertissement sur `DEMANDE`) — features `009`/`010`. La règle métier ([02 §Absence](../docs/architecture/02-modele-de-domaine.md)) est **reflétée dans le vocabulaire UI** (« Validée » = bloquante ; « Demande » = à titre indicatif) mais son **application** est différée.
- **Détection des conflits absence ↔ affectation** (chevauchement avec le planning) — feature `009`. `007` ne connaît pas encore les affectations.
- **Import de jours fériés / calendrier**, **récurrence** d'absences, **décompte de soldes** (compteurs de congés restants) — hors v1.
- **Notifications / workflow multi-utilisateurs** : pas d'authentification en v1 (règle d'or #11), le référent est seul à saisir **et** à décider.

## 2. Écrans concernés

Une seule route, déjà déclarée en `001` et confirmée par [07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md) (`name: 'absences'`, path `/absences`) :

| Route | Écran | Changement `007` |
|---|---|---|
| `/absences` | **Absences & congés** | Remplace le placeholder par la **liste globale des absences + le CRUD** (ajout/édition en modale, suppression confirmée, transitions de statut). |

> Aucune route paramétrée n'est ajoutée ici (l'écran liste **toutes** les personnes, il n'est pas rattaché à une personne comme `005`). Aucune modification du `router` n'est nécessaire (la route existe déjà).

**Expérience visée** (utilisateur non-technique) :

- Un titre d'écran explicite (« Absences & congés ») et **une action principale dominante** : le bouton « Ajouter une absence » (`btn btn-primary`, icône Phosphor), toujours visible en haut de l'écran.
- Un **filtre simple par statut** (« Toutes / Demandes / Validées / Refusées ») pour retrouver d'un coup d'œil **les demandes à traiter**, sans surcharger l'écran.
- La **liste** est lisible : chaque absence affiche la **personne concernée** (pastille de couleur doublée du nom), le **motif en clair** (« Congés payés »), la **période lisible** (« du 12/08/2026 au 23/08/2026 », ou « le 12/08/2026 » pour un seul jour), le **créneau** s'il ne s'agit pas de la journée entière (« Matin » / « Après-midi »), et le **statut** matérialisé par une **icône doublée d'un mot** (« En attente » / « Validée » / « Refusée », jamais la seule couleur).
- **État vide accueillant** : au premier lancement, un message chaleureux (« Aucune absence enregistrée. Ajoutez la première pour tenir compte des congés et arrêts dans les plannings. ») avec le même gros bouton d'ajout.
- **Cas « aucune personne dans l'équipe »** : plutôt qu'un formulaire avec un sélecteur vide, un message explicatif (« Ajoutez d'abord des personnes à votre équipe pour enregistrer leurs absences. ») **avec un lien clair vers l'écran Équipe** ; le bouton d'ajout est neutralisé tant qu'aucune personne n'est disponible.
- **Ajout / édition dans une modale** : une fenêtre claire s'ouvre par-dessus la liste (le contexte reste visible), avec les champs groupés logiquement, un **sélecteur de personne** (avec aperçu pastille + nom), des **saisies natives** de dates (`<input type="date">`), un choix de **créneau**, un **commentaire** facultatif, un bouton **« Enregistrer »** dominant et **« Annuler »** toujours disponible. Fermeture au clavier (Échap) et par clic hors de la fenêtre.
- **Traitement des demandes en un clic** : sur une demande, deux boutons clairs **« Valider »** / **« Refuser »** ; sur une absence déjà décidée, **« Remettre en demande »** pour revenir en arrière. Ces changements de statut sont **réversibles** (donc **sans confirmation**), avec retour visuel immédiat.
- **Suppression réfléchie et confirmée** : « Supprimer » ouvre une **demande de confirmation** en langage clair (le bouton de confirmation est **rouge** — geste **définitif**, l'absence n'est pas conservée).
- **Feedback permanent** : après chaque enregistrement/décision/suppression, l'indicateur « Modifications enregistrées » confirme la persistance ; les erreurs de saisie s'affichent **sous le champ concerné**, en disant **quoi corriger**, sans jamais perdre la saisie.

## 3. Modèle de données touché

Entité **`Absence`**, déjà décrite dans le modèle de domaine ([02 §Absence](../docs/architecture/02-modele-de-domaine.md)) et présente en tant que collection racine `absences.items` (vide) depuis `002`. Ses enums (`TYPES_ABSENCE`, `STATUTS_ABSENCE`, `CRENEAUX`) existent **déjà** dans `schema.js`. **Aucune nouvelle structure, aucun nouveau champ, aucune migration.**

Champs d'`Absence` **manipulés** par `007` :

| champ | type | oblig. | rôle `007` |
|---|---|---|---|
| `id` | uuid | oui | généré à la création via `genId()` ; **immuable** |
| `personneId` | uuid → Personne | oui | édité (requis) ; sélecteur de personne ; intégrité **déjà** contrôlée par `verifierIntegrite` |
| `type` | enum `TYPES_ABSENCE` (8 valeurs) | oui | édité (défaut `CONGE_PAYE` = `TYPES_ABSENCE[0]`) |
| `dateDebut` | `"YYYY-MM-DD"` | oui | édité (requis) ; via `<input type="date">` |
| `dateFin` | `"YYYY-MM-DD"` | oui | édité (requis) ; **inclusive**, **≥ `dateDebut`** (comparaison lexicographique de chaînes) |
| `creneau` | enum `CRENEAUX` (`MATIN`/`APRES_MIDI`/`JOURNEE`) | oui | édité (défaut `JOURNEE`) ; gère les demi-journées |
| `statut` | enum `STATUTS_ABSENCE` (`DEMANDE`/`VALIDE`/`REFUSE`) | oui | **non édité au formulaire** (défaut `DEMANDE`) ; piloté par les **actions de liste** (valider/refuser/remettre en demande) |
| `commentaire` | string | non | édité (facultatif) |
| `demandeLe` | ISO UTC | non | posé automatiquement à la **création** (`new Date().toISOString()`) |
| `decideLe` | ISO UTC \| null | non | posé automatiquement à la **décision** (valider/refuser) ; remis à `null` si retour en demande |
| `createdAt` / `updatedAt` | ISO UTC | oui | posés/rafraîchis automatiquement |

> **Pas de soft-delete au modèle** : `Absence` ne porte **ni** `actif` **ni** `archivee` (contrairement à `Personne`/`Tournee`). Une absence n'est **référencée par aucune autre entité** (les `Affectation` référencent `personneId`/`tourneeId`, jamais une absence) : sa **suppression physique** est donc légitime, protégée par une **confirmation** (même raisonnement que la `Preference` de `005`, objet non référencé). Voir §12.

**Impact `schemaVersion` / migrations** : **aucun**. `CURRENT_SCHEMA_VERSION` reste `1`. La collection `absences` et l'entité sont déjà couvertes par `toSaveDocument`/`fromSaveDocument`, et `verifierIntegrite` contrôle déjà `absence.personneId`.

## 4. Store (Vuex)

Module `absences` ([04-gestion-etat-vuex.md](../docs/architecture/04-gestion-etat-vuex.md), [instructions/etat-vuex.md](../docs/instructions/etat-vuex.md)). Après `002` il expose : `state {items: []}`, getters `byId` et `parPersonne`, mutation `REPLACE`, `actions: {}`. On calque le module `tournees` de `006`, en ajoutant une **suppression physique** et des **transitions de statut**.

### 4.1 Getters

- `byId` (**existant, conservé**) : `(id) => state.items.find((a) => a.id === id)`.
- `parPersonne` (**existant, conservé**) : `(personneId) => state.items.filter((a) => a.personneId === personneId)` — utile au moteur `009` et à d'éventuels regroupements.

> **Aucun getter de tri/filtre ajouté** : le tri (par date décroissante) et le filtre par statut sont des **choix de présentation**, faits dans la vue (§6), pas dans le store (KISS, cohérent avec `004`/`006`).

### 4.2 Mutations

Trois mutations (la mutation `REPLACE` d'hydratation reste inchangée), volontairement **fines** — mêmes patrons que `tournees` (`006`) : elles n'appliquent qu'une modification de state, sans logique métier ni horodatage (posés en amont par l'action/domaine).

- `ADD(state, absence)` : ajoute une absence complète à la collection (`state.items.push(absence)`).
- `UPDATE(state, { id, patch })` : **fusion immuable par id** — remplace l'élément d'`id` donné par `{ ...ancien, ...patch }` (via `findIndex` + `splice`). Ne fait rien si l'id est introuvable.
- `REMOVE(state, id)` : **suppression physique** — retire l'élément d'`id` donné (`state.items = state.items.filter((a) => a.id !== id)`, réaffectation immuable). Nouveauté par rapport à `personnes`/`tournees` (soft-delete only) : justifiée par l'absence de référence entrante (§3).

### 4.3 Actions

Les actions **orchestrent** ; la construction/normalisation d'une absence vit dans le **domaine** (§5), jamais dans le store (règle d'or #10). Les horodatages techniques (`updatedAt`, `decideLe`) sont posés dans l'action via `new Date().toISOString()` (même convention que `personnes`/`tournees`). Import de `creerAbsence` depuis `@/domain/absences.js`.

- `ajouter({ commit }, champs)` : construit une absence complète via `creerAbsence(champs)` (§5.1, qui pose `statut:'DEMANDE'`, `demandeLe`, `decideLe:null`) puis `commit('ADD', absence)`.
- `modifier({ commit }, { id, ...champs })` : `commit('UPDATE', { id, patch: { ...champs, updatedAt: <ISO UTC> } })`. `champs` ne contient **que** les champs factuels du formulaire (`personneId`, `type`, `dateDebut`, `dateFin`, `creneau`, `commentaire`) ; `statut`, `demandeLe`, `decideLe`, `id`, `createdAt` sont **préservés** par la fusion immuable.
- `supprimer({ commit }, id)` : `commit('REMOVE', id)` — suppression physique (protégée par confirmation côté UI, §6).
- `valider({ commit }, id)` : `commit('UPDATE', { id, patch: { statut: 'VALIDE', decideLe: <ISO UTC>, updatedAt: <ISO UTC> } })`.
- `refuser({ commit }, id)` : `commit('UPDATE', { id, patch: { statut: 'REFUSE', decideLe: <ISO UTC>, updatedAt: <ISO UTC> } })`.
- `remettreEnDemande({ commit }, id)` : `commit('UPDATE', { id, patch: { statut: 'DEMANDE', decideLe: null, updatedAt: <ISO UTC> } })` — annule une décision.

> **Vocabulaire** : côté **données/store** on garde les codes du schéma (`VALIDE`/`REFUSE`/`DEMANDE`) et des noms d'action alignés (`valider`/`refuser`/`remettreEnDemande`) ; côté **UI** on emploie « Valider » / « Refuser » / « Remettre en demande », et l'on affiche « En attente » / « Validée » / « Refusée » (§8). Les trois codes du schéma sont la source de vérité.

### 4.4 Persistance (déjà en place, rien à ajouter)

Chaque `commit` d'une mutation `absences/*` (hors `REPLACE` d'hydratation, qui passe aussi par le plugin sans dommage) déclenche le **plugin de persistance débouncé (~400 ms)** de `src/store/index.js`, qui sérialise via `toSaveDocument` et écrit via `storageRepository.save`. **Ne rien réimplémenter**, **aucun accès `localStorage`** dans le module ou les composants ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).

### 4.5 État racine & modules externes consommés en lecture seule

L'écran **lit** (sans jamais les muter) :

- `state.statutSauvegarde` (`INACTIF | EN_COURS | ENREGISTRE | ERREUR | ERREUR_CHARGEMENT`) et `state.derniereSauvegarde` (ISO UTC) — retour visuel via `IndicateurSauvegarde`, exactement comme `003`/`004`/`006`.
- le getter `personnes/actifs` (personnes sélectionnables dans le formulaire) et `personnes/byId` (résolution de la personne d'une absence pour l'affichage de la liste, y compris une personne archivée — voir §6).

## 5. Domaine (logique pure)

Tout dans `src/domain/`, **sans import Vue/Vuex ni `localStorage`** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)). Réutilisable par le moteur (`009`) et les écrans planning (`010`+).

### 5.1 `src/domain/absences.js` (**nouveau**) — fabrique, normalisation & chevauchements

Calque strict de `src/domain/tournees.js` (`006`) pour la fabrique, complété par des **helpers purs de chevauchement** (réutilisables par le moteur `009`).

- **`creerAbsence(champs)`** → `Absence` : construit une absence **complète et normalisée** à partir d'un objet partiel (les champs saisis dans le formulaire), en appliquant les **valeurs par défaut** et en générant les champs techniques. Fonction **pure** (hors `genId()` et `new Date().toISOString()`, tolérés car techniques — même usage que `schema.js`/`personnes.js`/`tournees.js`).
  - `id` : `champs.id ?? genId()` (import de `src/domain/utils/id.js`).
  - `personneId` : `champs.personneId ?? null` (le formulaire garantit une valeur ; `null` = garde-fou).
  - `type` : `champs.type ?? TYPES_ABSENCE[0]` (import `TYPES_ABSENCE` depuis `schema.js` ; défaut `'CONGE_PAYE'`, validé ∈ `TYPES_ABSENCE` par le formulaire).
  - `dateDebut` : `champs.dateDebut ?? ''` ; `dateFin` : `champs.dateFin ?? ''` (chaînes `"YYYY-MM-DD"` ; le formulaire garantit des valeurs valides et `dateFin ≥ dateDebut`).
  - `creneau` : `champs.creneau ?? 'JOURNEE'` (validé ∈ `CRENEAUX` par le formulaire).
  - `statut` : `champs.statut ?? STATUTS_ABSENCE[0]` (défaut `'DEMANDE'`).
  - `commentaire` : `String(champs.commentaire ?? '').trim()`.
  - `demandeLe` : `champs.demandeLe ?? <ISO UTC courant>` — pose l'horodatage de la demande à la création.
  - `decideLe` : `champs.decideLe ?? null` — resté `null` tant qu'aucune décision n'est prise.
  - `createdAt` : `champs.createdAt ?? <ISO UTC courant>` ; `updatedAt` : `<ISO UTC courant>`.
  - JSDoc : `@typedef {Object} Absence` (aligné sur [02 §Absence](../docs/architecture/02-modele-de-domaine.md)) + `@param`/`@returns`.
- **Helpers de chevauchement** (purs, exportés — utilisés par un **avertissement non bloquant** à la saisie en `007`, réutilisables par le moteur `009`) :
  - **`creneauxSeChevauchent(a, b)`** → `boolean` : `true` si l'un des créneaux est `'JOURNEE'` ou s'ils sont égaux (une demi-journée `MATIN` ne chevauche pas `APRES_MIDI`, mais chacune chevauche `JOURNEE`).
  - **`periodesSeChevauchent(debutA, finA, debutB, finB)`** → `boolean` : intersection de deux intervalles de dates **inclusifs**, par **comparaison lexicographique de chaînes** `"YYYY-MM-DD"` (`debutA <= finB && debutB <= finA`) — **aucun objet `Date`**.
  - **`absencesSeChevauchent(a, b)`** → `boolean` : `true` si `a` et `b` concernent la **même personne** (`personneId` égaux), ont des **périodes** qui se recoupent **et** des **créneaux** compatibles, en **excluant l'identité** (`a.id !== b.id`, pour ne pas se comparer à soi-même en édition).
  - **`chevauchementsPour(absenceCible, absences)`** → `Absence[]` : liste des absences de `absences` qui **chevauchent** `absenceCible` (via `absencesSeChevauchent`). Renvoie `[]` si aucune. Utilisé par le formulaire pour un **avertissement non bloquant** (§6/§7).

> **Cohérence des dates : au formulaire, pas au domaine.** Conformément au choix de `004`/`006`, le contrôle **bloquant** `dateFin ≥ dateDebut` est porté par **Vuelidate** dans `FormulaireAbsence` (§7). Le **chevauchement**, lui, est un **avertissement non bloquant** (comme la cohérence des paramètres en `003`) : le domaine fournit la fonction pure, le formulaire l'affiche à titre indicatif sans jamais empêcher l'enregistrement (une personne peut légitimement cumuler p. ex. une formation le matin et un congé l'après-midi, ou l'utilisateur peut vouloir corriger sciemment). Le domaine garantit la **normalisation structurelle** (champs tous initialisés, commentaire trimé).

### 5.2 `src/domain/libelles.js` (**modifier**) — libellés de type & de statut d'absence

Ajouts, dans l'esprit exact de `LIBELLES_STATUT_PERSONNE`/`STATUTS_PERSONNE_OPTIONS` et `LIBELLES_TYPE_PREFERENCE` déjà présents (les **codes** restent la source de vérité dans `schema.js` ; ce module ne porte que l'affichage, prêt pour i18n). `libelleCreneau`/`LIBELLES_CRENEAU` (créneau en clair) sont **réutilisés tels quels**.

| Export | Forme | Rôle |
|---|---|---|
| `LIBELLES_TYPE_ABSENCE` | table des 8 codes `TYPES_ABSENCE` → libellé FR | affichage du motif |
| `libelleTypeAbsence(code)` | `(string) → string` | `''` si inconnu |
| `TYPES_ABSENCE_OPTIONS` | `[{ code, libelle }]` dérivée de `TYPES_ABSENCE` + `LIBELLES_TYPE_ABSENCE` | liste prête à itérer pour le `form-select` du formulaire |
| `LIBELLES_STATUT_ABSENCE` | `{ DEMANDE:'…', VALIDE:'Validée', REFUSE:'Refusée' }` | code → libellé FR |
| `libelleStatutAbsence(code)` | `(string) → string` | `''` si inconnu |
| `STATUTS_ABSENCE_OPTIONS` | `[{ code, libelle }]` dérivée de `STATUTS_ABSENCE` + `LIBELLES_STATUT_ABSENCE` | référence (filtre de liste) |

Libellés FR proposés pour `LIBELLES_TYPE_ABSENCE` (à ajuster à l'implémentation) :

| code | libellé FR |
|---|---|
| `CONGE_PAYE` | « Congés payés » |
| `RTT` | « RTT » |
| `ARRET_MALADIE` | « Arrêt maladie » |
| `MATERNITE` | « Congé maternité » |
| `PATERNITE` | « Congé paternité » |
| `NAISSANCE` | « Congé naissance » |
| `FORMATION` | « Formation » |
| `AUTRE` | « Autre » |

Libellés FR proposés pour `LIBELLES_STATUT_ABSENCE` : `{ DEMANDE: 'En attente', VALIDE: 'Validée', REFUSE: 'Refusée' }`.

> Choix de « **En attente** » pour `DEMANDE` (plutôt que « Demande ») : plus parlant comme **état** affiché sur une carte et dans le filtre (« un congé en attente de validation »). Les **actions** conservent le verbe « Valider » / « Refuser » / « Remettre en demande » (§6). L'icône associée à chaque statut est choisie **dans la vue** (Phosphor, pas dans `libelles.js` qui reste sans dépendance Vue).

### 5.3 Dates, créneaux & horodatages

Aucune manipulation `Date` custom :

- **Dates** (`dateDebut`/`dateFin`) : chaînes `"YYYY-MM-DD"` via `<input type="date">`, qui **produit et consomme nativement** ce format ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)). Comparaisons (`dateFin ≥ dateDebut`, chevauchement de périodes) par **comparaison lexicographique de chaînes** (l'ordre lexicographique coïncide avec l'ordre chronologique) — **aucun objet `Date`**. Affichage lisible via **`dateUtil.formatDateFr`** (déjà utilisé par `EquipeView`/`TourneesView`).
- **Créneau** : code `CRENEAUX` (`schema.js`), affiché via `libelleCreneau`.
- **Horodatages** : `createdAt`/`updatedAt`/`demandeLe`/`decideLe` posés via `new Date().toISOString()` dans `creerAbsence` (création) et dans les actions du store (décisions) — jamais dans les composants.

## 6. Composants

Séparation conforme à [06-structure-du-code.md](../docs/architecture/06-structure-du-code.md) : les briques transverses (modale, confirmation, indicateur) sont **déjà** dans `components/communs/` (`004`) ; le formulaire spécifique va dans `components/absences/` ; l'écran routé dans `views/`.

### 6.1 Réutilisation directe (aucune modification)

- `src/components/communs/ModaleBase.vue` — coquille de modale accessible (focus piégé, `Échap`, **retour du focus à l'ouvrant** à la fermeture, ARIA). Props `visible`/`titre`/`taille` ; slots `default`/`pied` ; événements `fermeture` et `affichee`. Réutilisée telle quelle.
- `src/components/communs/DialogueConfirmation.vue` — confirmation générique au-dessus de `ModaleBase` (props `visible`/`titre`/`message`/`libelleConfirmer`/`varianteConfirmer` ; événements `confirmer`/`annuler` ; fermeture = `annuler`). Réutilisée pour la **suppression** (`variante-confirmer="danger"`, `libelle-confirmer="Supprimer"`).
- `src/components/communs/IndicateurSauvegarde.vue` — retour visuel de persistance (statut + dernière sauvegarde + `apres-edition`), avec l'encart `ERREUR_CHARGEMENT`. Réutilisé.
- `src/styles/_bootstrap.scss` — **aucun ajout requis** : `close`, `modal`, `forms` (dont `form-select`/`<input type="date">`), `alert` sont **déjà** importés (`004`). Le statut est rendu en **icône + texte** (pas de `badge`) ; le filtre en **groupe de boutons** (`btn`/`btn-outline-*` déjà présents). KISS confirmé.

### 6.2 `src/components/absences/FormulaireAbsence.vue` (**nouveau**)

Formulaire **présentational** d'ajout/édition d'**une** absence, bâti au-dessus de `ModaleBase`, calqué sur `FormulaireTournee` (`006`). **N'accède pas au store** : il reçoit ses données par props et **émet** le résultat ; l'écran (`AbsencesView`) dispatche.

- **Props** :
  - `visible` (Boolean, requis) ;
  - `absence` (Object|null) — `null` = mode **création**, objet = mode **édition** ;
  - `personnes` (Array) — personnes **sélectionnables** (actives, éventuellement + la personne référencée si on édite l'absence d'une personne archivée, voir §6.3) ; chaque entrée porte au moins `{ id, prenom, nom, couleur }` ;
  - `absencesExistantes` (Array, défaut `[]`) — toutes les autres absences (pour l'**avertissement de chevauchement**, calculé côté formulaire).
- **Événements** : `enregistrer` (payload = champs normalisés) ; `annuler`.
- **État local** (`data().formulaire`) : brouillon réinitialisé **à chaque ouverture** (`watch: visible`, + `mounted` si déjà visible) via `construireFormulaire()` — depuis `absence` (édition) ou depuis les **valeurs par défaut** (création : `personneId=''` ou 1ʳᵉ personne si liste courte, `type='CONGE_PAYE'`, `dateDebut=''`, `dateFin=''`, `creneau='JOURNEE'`, `commentaire=''`). Ne jamais muter la prop `absence`.
- **Focus** : `autofocus` déterministe sur le **sélecteur de personne** via l'événement `affichee` de `ModaleBase` (méthode `onAffichee`, identique à `FormulaireTournee`).
- **Titre de la modale** : « Ajouter une absence » (création) / « Modifier l'absence » (édition).
- **Champs & regroupement** (peu de champs à la fois, [08](../docs/architecture/08-principes-ux-ergonomie.md)) :
  1. **Personne concernée** — `form-select` (`personnes` → « Prénom Nom »), requis. Un **aperçu** « pastille + Prénom Nom » (même patron que l'aperçu couleur de `FormulaireTournee`) confirme visuellement le choix (couleur **toujours doublée du nom**). Le `<select>` natif reste le plus accessible et le plus simple (KISS) ; l'aperçu apporte la pastille.
  2. **Motif** — `form-select` alimenté par `TYPES_ABSENCE_OPTIONS` → libellés FR (« Congés payés », « Arrêt maladie »…). Requis, défaut « Congés payés ».
  3. **Période** — `dateDebut` et `dateFin` : `<input type="date">` (produisent `"YYYY-MM-DD"`), libellés « Du » / « Au (inclus) ». Requis ; message de cohérence si `dateFin < dateDebut`. **Nicety d'ergonomie** : au changement de `dateDebut`, si `dateFin` est vide **ou** antérieure, la caler automatiquement sur `dateDebut` (une absence d'un seul jour ne demande alors qu'une saisie).
  4. **Créneau** — `form-select` (`CRENEAUX` → `libelleCreneau` : « Journée entière » / « Matin » / « Après-midi »). Requis, défaut « Journée entière ». Texte d'aide « Choisissez Matin ou Après-midi pour une absence d'une demi-journée. ».
  5. **Commentaire** (facultatif) — `<textarea maxlength="500">`, libellé « Commentaire (facultatif) », placeholder d'exemple (« ex. arrêt transmis le 05/08 »).
- **Avertissement de chevauchement (non bloquant)** : un computed calcule `chevauchementsPour({ id: absence?.id, personneId, dateDebut, dateFin, creneau }, absencesExistantes)` (le domaine, §5.1) **dès que** personne + les deux dates sont renseignées ; s'il est non vide, afficher un encart discret `alert alert-warning` (icône `PhWarning`) : « Cette période recoupe une autre absence déjà enregistrée pour cette personne. Vous pouvez tout de même l'enregistrer. » — **jamais** un blocage.
- **Pied de modale** : « Annuler » (`btn btn-outline-secondary`) et **« Enregistrer »** (`btn btn-primary`, action dominante). À la soumission : `v$.$touch()` ; si `!$invalid`, `$emit('enregistrer', <champs normalisés>)` (dates `"YYYY-MM-DD"`, `creneau`/`type` codes, `commentaire` trimé) ; sinon afficher les messages sous les champs, **focaliser le premier champ erroné** (méthode `focusPremierChampErrone`, comme `FormulaireTournee`) et **ne rien émettre** (aucune perte de saisie).
- **Vuelidate** : voir §7. Pont `setup(){ return { v$: useVuelidate() } }` = seul usage de Composition API (identique à `FormulairePersonne`/`FormulaireTournee`).
- **Icônes** : `PhWarning` (messages d'erreur et avertissement de chevauchement, même présentation que `FormulaireTournee`).
- **SCSS `scoped`** : reprend les blocs de `FormulaireTournee` pour l'aperçu (`.formulaire-apercu`, pastille) et les erreurs (`.formulaire-erreur`) ; `.form-control`/`.form-select` à `min-height: $cible-cliquable-min`. Tokens/mixins uniquement, cibles ~44 px, focus visible.

> **Statut absent du formulaire (décision §12)** : le formulaire ne saisit **que les faits** (qui, quel motif, quand, quel créneau, commentaire). Le **statut** est piloté depuis la liste par des actions dédiées : toute nouvelle absence naît « En attente », puis le référent « Valide » / « Refuse ». Cela garde le formulaire minimal, rend la décision explicite et traçable (`decideLe`), et évite un `form-select` de statut qui mélangerait saisie et décision.

### 6.3 `src/views/AbsencesView.vue` (**réécriture** complète du placeholder)

Écran routé (Options API), calqué sur `TourneesView` (`006`). **Orchestre** : liste + filtre + modales, sans logique métier (délègue au store/domaine).

- **Titre** `<h1>` « Absences & congés ».
- **Encart `ERREUR_CHARGEMENT`** : même patron que `TourneesView` (`alert alert-warning`, `PhWarning`), message adapté aux absences.
- **Indicateur de sauvegarde** : `IndicateurSauvegarde` alimenté par `statutSauvegarde`/`derniereSauvegarde` (root state via `mapState`) et `apres-edition="aEdite"` (passe à `true` après le 1ᵉʳ ajout/édition/décision/suppression — même logique que `TourneesView`).
- **Cas « aucune personne sélectionnable »** (`personnesActives.length === 0`) : afficher un encart explicatif (`alert alert-info` ou état neutre) « Ajoutez d'abord des personnes à votre équipe pour enregistrer leurs absences. » **+ un `router-link` bouton vers `{ name: 'equipe' }`** (« Aller à l'équipe »). Le bouton « Ajouter une absence » est **désactivé** (ou remplacé par ce message) tant qu'aucune personne n'est disponible. Les absences déjà enregistrées (le cas échéant, p. ex. personnes ensuite archivées) restent **affichées** en dessous.
- **En-tête d'action** : bouton principal **« Ajouter une absence »** (`btn btn-primary`, icône Phosphor `PhCalendarPlus` — le développeur confirme l'existence dans `@phosphor-icons/vue`, sinon `PhPlus`) ⇒ ouvre `FormulaireAbsence` en création (`absence = null`). Une `ref` (`boutonAjout`) sert de **point de repli du focus** après suppression/décision (comme `TourneesView`).
- **Filtre par statut** : un petit groupe de boutons (« Toutes » / « En attente » / « Validées » / « Refusées »), piloté par un `data` `filtreStatut` (`'TOUS'` par défaut). État `aria-pressed`/actif clair, cibles ~44 px. Purement présentation (aucun getter store).
- **État vide** : si **aucune** absence n'existe → encart accueillant (icône Phosphor évocatrice, ex. `PhCalendarBlank`, doublée du texte) « Aucune absence enregistrée. Ajoutez la première pour tenir compte des congés et arrêts dans les plannings. » + bouton d'ajout (si au moins une personne).
- **Liste des absences** (`absencesTriees` **puis** filtrées) : une **liste de cartes/lignes** (pas un tableau dense, cohérent avec `004`/`006`). Chaque ligne affiche :
  - **pastille de couleur** (rond, `aria-hidden`) **+ « Prénom Nom »** de la personne, résolus via `personnes/byId` (fonctionne même si la personne a été archivée ; si introuvable — ne devrait pas arriver, intégrité garantie — afficher « Personne inconnue »). Une personne archivée peut être signalée discrètement (« (archivée) ») sans que ce soit l'unique repère ;
  - **motif** en clair (`libelleTypeAbsence`) ;
  - **période** lisible (`periodeTexte` : « du {formatDateFr} au {formatDateFr} », ou « le {formatDateFr} » si `dateDebut === dateFin`) ;
  - **créneau** en clair **uniquement si ≠ `JOURNEE`** (`libelleCreneau`, ex. « Matin ») ;
  - **statut** : **icône + mot** (jamais la seule couleur) — `PhClock` / « En attente » (DEMANDE), `PhCheckCircle` / « Validée » (VALIDE), `PhXCircle` / « Refusée » (REFUSE) ;
  - **actions** :
    - « Modifier » (`PhPencilSimple`) ⇒ `FormulaireAbsence` en édition ;
    - **transitions de statut** (directes, **sans confirmation** car réversibles) :
      - si `DEMANDE` : « Valider » (`PhCheck`) et « Refuser » (`PhX`) ;
      - si `VALIDE` ou `REFUSE` : « Remettre en demande » (`PhArrowCounterClockwise`) ;
    - « Supprimer » (`PhTrash`) ⇒ `DialogueConfirmation` (variante `danger`).
    Boutons avec **libellé texte** (pas d'icône seule).
- **Tri d'affichage** (computed `absencesTriees`) : par `dateDebut` **décroissant** (les absences les plus récentes/à venir en haut), départage par `createdAt` décroissant ; via comparaison de chaînes (`b.dateDebut.localeCompare(a.dateDebut)`). Puis **filtrage** par `filtreStatut` (computed `absencesAffichees`). Présentation uniquement.
- **Personnes sélectionnables** (computed `personnesSelectionnables`) transmis à `FormulaireAbsence` : les `personnes/actifs` ; **en édition**, si la personne de l'absence en cours n'est pas active, l'ajouter à la liste (via `byId`) pour ne pas casser la modification d'une absence rattachée à une personne archivée.
- **Modales** : `FormulaireAbsence` (création/édition, pilotée par `formulaireVisible` + `absenceEnCours`, avec `:personnes` et `:absences-existantes`) et `DialogueConfirmation` (suppression, pilotée par `confirmationVisible` + `absenceASupprimer`). Handlers (calqués sur `TourneesView`) :
  - `onEnregistrer(champs)` : si `absenceEnCours` ⇒ `modifier({ id: absenceEnCours.id, ...champs })` ; sinon ⇒ `ajouter(champs)`. Puis `aEdite = true`, ferme la modale, `absenceEnCours = null` ; repli du focus sur `boutonAjout` en création (`$nextTick`, comme `TourneesView`, car l'état vide/le bouton d'origine peut disparaître).
  - transitions : `onValider(a)` / `onRefuser(a)` / `onRemettreEnDemande(a)` ⇒ action correspondante + `aEdite = true` (pas de fermeture de modale, actions de liste directes). Repli du focus sur `boutonAjout` (les boutons de transition changent après l'action).
  - `onConfirmerSuppression()` : `supprimer(absenceASupprimer.id)`, `aEdite = true`, ferme la confirmation, `absenceASupprimer = null`, repli du focus sur `boutonAjout` (`$nextTick`).
- **Accès store** : `mapGetters('personnes', { personnesActives: 'actifs', personneById: 'byId' })`, `mapGetters('absences', ...)` si besoin (sinon lecture directe du state), `mapState('absences', ['items'])` **ou** un getter dédié, `mapGetters('cabinet', ['parametres'])` (non requis ici — pas de sélecteur de couleur), `mapActions('absences', ['ajouter', 'modifier', 'supprimer', 'valider', 'refuser', 'remettreEnDemande'])`, `mapState(['statutSauvegarde', 'derniereSauvegarde'])`. **Aucune logique métier** : libellés via `libelles.js`, période via un helper de présentation local, résolution de personne via `byId`, construction de l'absence via l'action `ajouter` (qui appelle `creerAbsence`).

> Pour lire la collection d'absences, préférer un **getter** simple (ex. exposer `items` via `mapState('absences', ['items'])`) plutôt qu'un accès direct au state hors module ; le tri/filtre reste dans la vue.

### 6.4 Réutilisation & style

- `ModaleBase`, `DialogueConfirmation`, `IndicateurSauvegarde`, `libelles.js`, `dateUtil`, tokens/mixins SCSS, intégration Bootstrap, icônes Phosphor : **déjà en place** (`003`/`004`/`006`), réutilisés tels quels.
- La directive `v-debounce` **n'est pas nécessaire** (formulaire à validation explicite, pas de saisie auto-persistée en continu — comme `004`/`005`/`006`).
- Le SCSS `scoped` de chaque composant ne sert qu'au **spécifique** (lignes de liste, pastille personne, repère de statut, groupe de filtre) ; tout le reste via classes Bootstrap. Cibles ~44 px (`$cible-cliquable-min`), focus visible, tokens uniquement (aucune valeur « magique »).

## 7. Règles de validation

Vuelidate ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md), [instructions/formulaires-validation.md](../docs/instructions/formulaires-validation.md)) dans `FormulaireAbsence`. Règles déclaratives, **messages FR orientés correction**, affichés **après interaction** (blur / change) ou **à la tentative d'enregistrement** — jamais sur un formulaire vierge. Couvre explicitement l'exigence de l'instruction [formulaires-validation §Absence](../docs/instructions/formulaires-validation.md) (« `dateFin ≥ dateDebut` »).

| Champ | Règle | Message FR (exemple) |
|---|---|---|
| `personneId` | `required` (liste fermée) | « Choisissez la personne concernée. » |
| `type` | `required`, ∈ `TYPES_ABSENCE` (liste fermée) | « Choisissez le motif de l'absence. » |
| `dateDebut` | `required` | « Indiquez la date de début. » |
| `dateFin` | `required` ; **`dateFin ≥ dateDebut`** (comparaison de chaînes `"YYYY-MM-DD"`) | « La date de fin doit être identique ou postérieure à la date de début. » |
| `creneau` | `required`, ∈ `CRENEAUX` (liste fermée) | (liste fermée : pas de saisie libre) |
| `commentaire` | facultatif ; `maxLength` (ex. 500) | « Le commentaire ne doit pas dépasser 500 caractères. » |

**Comportement d'enregistrement** : l'**ensemble** du formulaire est validé au clic sur « Enregistrer » ; si un champ est invalide, l'enregistrement est **bloqué**, les messages s'affichent sous les champs concernés, le **premier champ erroné reçoit le focus**, et la **saisie est conservée** (tolérance à l'erreur, zéro perte — [08](../docs/architecture/08-principes-ux-ergonomie.md)). « Annuler » / `Échap` / clic hors fenêtre ferment sans enregistrer.

> **Chevauchement = avertissement, pas validation.** Le recoupement avec une autre absence de la personne n'est **jamais** une règle Vuelidate bloquante : c'est un **encart informatif** non bloquant (§6.2), cohérent avec la règle métier « une `DEMANDE` avertit, seule une `VALIDE` bloque » (côté moteur, `009`).

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie.md](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Langage humain, zéro jargon** : « Absences & congés », « Ajouter une absence », « Personne concernée », « Motif », « Du … Au (inclus) », « Créneau », « En attente / Validée / Refusée », « Valider / Refuser / Remettre en demande », « Supprimer ». Jamais « CRUD », « enum », « statut DEMANDE », « personneId », « champ invalide ».
- **Une action principale par écran** : « Ajouter une absence », visuellement dominante.
- **Motif, période et créneau en clair** : motif via `libelleTypeAbsence`, période lisible (`dateUtil.formatDateFr`, « du … au … » / « le … »), créneau via `libelleCreneau` (masqué s'il s'agit de la journée entière) — jamais de codes bruts ni de dates ISO affichées.
- **Statut jamais par la seule couleur** : chaque statut est un **couple icône + mot** (`PhClock`/« En attente », `PhCheckCircle`/« Validée », `PhXCircle`/« Refusée ») ; une couleur d'accent peut **compléter** mais jamais remplacer le mot (daltoniens, impression, [ADR 0013](../docs/adr/0013-icones-phosphor.md)).
- **Personne toujours doublée du nom** : pastille de couleur **+** « Prénom Nom » (liste et aperçu du formulaire).
- **Saisies natives et guidées** : `<input type="date">` pour les dates ; auto-calage de la date de fin sur la date de début pour une absence d'un jour ; `form-select` clairs pour personne / motif / créneau. **Valeurs par défaut raisonnables** (motif « Congés payés », créneau « Journée entière », statut « En attente ») pour réduire l'effort (cf. [formulaires-validation](../docs/instructions/formulaires-validation.md), qui cite justement « statut `DEMANDE` » comme défaut).
- **Décision explicite et réversible** : les transitions de statut sont **directes** (un clic, sans confirmation) car **réversibles** via « Remettre en demande » ; le feedback (indicateur + changement de l'icône/mot) est immédiat.
- **Réversibilité & confirmation** : la **suppression** (physique, non conservée) est précédée d'une **confirmation en langage clair** avec un bouton **rouge** ; le message rappelle que l'absence ne sera **pas** conservée.
- **Cas limite accueillant** : « aucune personne dans l'équipe » explique **quoi faire** (aller à l'Équipe) au lieu d'un sélecteur vide déroutant ; « aucune absence » invite à démarrer.
- **Filtre lisible** : un groupe de boutons « Toutes / En attente / Validées / Refusées » aide à retrouver les demandes à traiter, sans surcharge (une seule dimension de filtre).
- **Feedback immédiat** : indicateur « Modifications enregistrées » après chaque opération ; erreurs sous le champ, disant **quoi corriger** ; avertissement de chevauchement clairement **non bloquant**.
- **Tolérance à l'erreur** : la saisie n'est jamais perdue si la validation échoue ; focus porté sur le premier champ à corriger.
- **Modale accessible** : focus piégé, **fermeture au clavier (`Échap`)**, **retour du focus à l'ouvrant**, `autofocus` sur le 1ᵉʳ champ (fournis par `ModaleBase`).
- **Ergonomie physique** : cibles ~44 px (boutons, filtres), bon espacement, `label` associé à chaque champ, **focus clavier visible**, structure de titres `h1 → h2`.
- **Cohérence** : mêmes patterns que `003`/`004`/`005`/`006` (indicateur de sauvegarde, présentation des erreurs, ajout/édition en modale, confirmation destructive) — l'utilisateur retrouve exactement les mêmes gestes que sur les écrans Équipe et Tournées.

## 9. Étapes d'implémentation

Découpage en **3 tâches**, chacune destinée à **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé par les dépendances : **T1 → T2 → T3** (domaine + store d'abord ; formulaire ; écran).

### Tâche 1 — Domaine (fabrique Absence + chevauchements) + libellés (type/statut) & store `absences` (CRUD + transitions)

**Fichiers** :
- `src/domain/absences.js` (**créer**) — `creerAbsence(champs)` (§5.1), pur, JSDoc `@typedef Absence` ; helpers `creneauxSeChevauchent`, `periodesSeChevauchent`, `absencesSeChevauchent`, `chevauchementsPour`.
- `src/domain/libelles.js` (**modifier**) — `LIBELLES_TYPE_ABSENCE`, `libelleTypeAbsence`, `TYPES_ABSENCE_OPTIONS`, `LIBELLES_STATUT_ABSENCE`, `libelleStatutAbsence`, `STATUTS_ABSENCE_OPTIONS` (§5.2). Conserver l'existant.
- `src/store/modules/absences.js` (**modifier**) — mutations `ADD`, `UPDATE` (fusion immuable par id), `REMOVE` ; actions `ajouter`, `modifier`, `supprimer`, `valider`, `refuser`, `remettreEnDemande` (§4). Conserver `byId`, `parPersonne`, `REPLACE`. Importer `creerAbsence`.

**Critères de sortie** :
- `creerAbsence({ personneId:'p1', dateDebut:'2026-08-12', dateFin:'2026-08-23' })` renvoie une absence **complète** : `id` non vide, `type === 'CONGE_PAYE'`, `creneau === 'JOURNEE'`, `statut === 'DEMANDE'`, `commentaire === ''`, `demandeLe` ISO UTC non vide, `decideLe === null`, `createdAt`/`updatedAt` ISO UTC.
- `creerAbsence` respecte les valeurs fournies (ex. `type:'RTT'`, `creneau:'MATIN'`, `commentaire:'  test  '` → `'test'`).
- Chevauchements (comparaison de chaînes, aucun objet `Date`) :
  - `creneauxSeChevauchent('MATIN','APRES_MIDI') === false` ; `('MATIN','JOURNEE') === true` ; `('MATIN','MATIN') === true`.
  - `periodesSeChevauchent('2026-08-10','2026-08-15','2026-08-14','2026-08-20') === true` ; `(...,'2026-08-16','2026-08-20') === false`.
  - `absencesSeChevauchent` : `true` pour deux absences de la **même** personne aux périodes/créneaux compatibles, `false` si personnes différentes, créneaux disjoints (matin vs après-midi), périodes disjointes, ou `id` identiques.
  - `chevauchementsPour(cible, liste)` renvoie **exactement** les absences en conflit (et `[]` sinon).
- Store : `dispatch('absences/ajouter', { personneId, type:'CONGE_PAYE', dateDebut:'2026-08-12', dateFin:'2026-08-23', creneau:'JOURNEE' })` ⇒ la collection contient l'absence (`statut 'DEMANDE'`, `decideLe null`) ; `dispatch('absences/valider', id)` ⇒ `statut 'VALIDE'`, `decideLe` **posé**, `updatedAt` rafraîchi ; `refuser` ⇒ `'REFUSE'` + `decideLe` ; `remettreEnDemande` ⇒ `'DEMANDE'` + `decideLe null` ; `modifier({ id, commentaire:'x' })` ⇒ commentaire modifié, `id`/`createdAt`/`statut`/`demandeLe`/`decideLe` **inchangés** ; `supprimer(id)` ⇒ l'absence n'est plus dans `items`.
- `libelleTypeAbsence('ARRET_MALADIE')` non vide ; `TYPES_ABSENCE_OPTIONS` a **8** entrées ; `libelleStatutAbsence('VALIDE') === 'Validée'` ; `STATUTS_ABSENCE_OPTIONS` a **3** entrées cohérentes avec `STATUTS_ABSENCE`.
- Aucun import Vue/Vuex dans `absences.js`/`libelles.js` ; aucun accès `localStorage` ; aucun `Date.getDay()` ni `new Date("YYYY-MM-DD")`.

### Tâche 2 — `FormulaireAbsence` (formulaire ajout/édition + validation + avertissement de chevauchement)

**Fichiers** :
- `src/components/absences/FormulaireAbsence.vue` (**créer**) — formulaire présentational au-dessus de `ModaleBase`, props `visible`/`absence`/`personnes`/`absencesExistantes`, événements `enregistrer`/`annuler`, Vuelidate (§6.2, §7). Réutilise l'aperçu (pastille + nom) et la présentation d'erreurs de `FormulaireTournee`.

**Dépend de** : T1 (`libelles.js`, `absences.js` pour `chevauchementsPour`) et briques existantes (`ModaleBase`).

**Critères de sortie** :
- Mode **création** (`absence=null`) : champs par défaut (motif « Congés payés », créneau « Journée entière », dates vides, commentaire vide) ; `autofocus` sur le sélecteur de personne.
- Mode **édition** : tous les champs pré-remplis depuis `absence` ; la prop n'est jamais mutée ; réouverture réinitialise proprement le brouillon.
- Validation : personne requise ; motif requis ; dates requises + `dateFin ≥ dateDebut` (comparaison de chaînes) ; créneau requis ; commentaire ≤ 500 caractères — messages FR sous les champs, affichés après interaction / à la soumission ; enregistrement **bloqué** si invalide, **saisie conservée**, focus au 1ᵉʳ champ erroné.
- Auto-calage : renseigner `dateDebut` remplit `dateFin` si elle était vide/antérieure.
- Avertissement de chevauchement : quand la période recoupe une autre absence de la **même** personne, un encart **non bloquant** s'affiche ; l'enregistrement reste **possible**.
- Aperçu « pastille + Prénom Nom » reflétant la personne sélectionnée.
- Soumission valide ⇒ `enregistrer` avec les champs normalisés (`personneId`, `type`, `dateDebut`/`dateFin` `"YYYY-MM-DD"`, `creneau`, `commentaire`) ; « Annuler »/`Échap` ⇒ `annuler`, aucune émission.
- Icônes Phosphor doublées d'un libellé/`aria-label` ; couleur toujours doublée du nom ; `label` associé à chaque champ ; `npm run build` réussit.

### Tâche 3 — Écran `AbsencesView` (liste globale, filtre, état vide, cas « aucune personne », orchestration)

**Fichiers** :
- `src/views/AbsencesView.vue` (**réécrire**) — liste globale triée + filtre par statut, état vide, cas « aucune personne » (lien vers Équipe), bouton d'ajout, transitions de statut, suppression confirmée, orchestration des modales, `IndicateurSauvegarde`, encart `ERREUR_CHARGEMENT` (§6.3, §8).

**Dépend de** : T1 (store/getters/libellés), T2 (`FormulaireAbsence`), briques `DialogueConfirmation`/`IndicateurSauvegarde` (existant `004`), getters `personnes/actifs`/`byId` (existant `004`).

**Critères de sortie** :
- **Aucune personne active** : l'écran explique qu'il faut d'abord ajouter des personnes, avec un **lien vers l'Équipe** ; le bouton d'ajout est neutralisé ; les absences existantes (le cas échéant) restent affichées.
- Au premier lancement (au moins une personne, aucune absence) : **état vide** accueillant + bouton « Ajouter une absence ».
- Ajout : le formulaire s'ouvre, une absence valide est créée en « En attente » et apparaît immédiatement dans la liste (personne + motif + période + créneau si demi-journée + statut) ; l'indicateur passe à « Modifications enregistrées » ; **recharger la page** conserve l'absence.
- Édition : « Modifier » ouvre le formulaire pré-rempli ; les changements sont enregistrés et reflétés ; `statut`/`demandeLe`/`decideLe` inchangés.
- Décisions : « Valider »/« Refuser » sur une demande changent le statut (icône + mot mis à jour) et posent `decideLe` ; « Remettre en demande » revient à « En attente » et remet `decideLe` à `null` — **sans confirmation**, avec feedback.
- Suppression : « Supprimer » ouvre la **confirmation** (bouton rouge) ; après confirmation l'absence disparaît et n'est **pas** conservée ; recharger → toujours absente.
- Filtre : « Toutes / En attente / Validées / Refusées » restreint la liste ; tri par date de début décroissante cohérent.
- Personne toujours doublée du nom ; motif/période/créneau en clair ; statut jamais par la seule couleur ; icônes doublées d'un libellé ; focus visible ; navigation clavier possible (ouvrir/fermer la modale, valider) ; focus replacé sur le bouton d'ajout après une action qui retire le déclencheur.
- Aucun accès `localStorage`, aucun objet `Date` hors `dateUtil`, aucune logique métier dans le composant ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] La route `/absences` affiche la **liste globale des absences** titrée « Absences & congés » (fini le placeholder), avec un bouton principal « Ajouter une absence » et un filtre par statut.
- [ ] **Cas « aucune personne »** : message explicatif + **lien vers l'Équipe** ; on ne peut pas ouvrir un formulaire avec un sélecteur vide.
- [ ] **État vide** accueillant tant qu'aucune absence n'existe (dès qu'au moins une personne existe).
- [ ] **Ajouter** une absence (personne, motif, période, créneau, commentaire optionnel) l'enregistre en **« En attente »** et l'affiche dans la liste ; l'indicateur montre « Modifications enregistrées ».
- [ ] **Recharger la page** restitue les absences (persistance effective via `bootstrap`).
- [ ] **Modifier** une absence met à jour ses informations et rafraîchit `updatedAt` ; `id`, `createdAt`, `statut`, `demandeLe`, `decideLe` sont préservés.
- [ ] **Valider / Refuser** une demande change son statut et pose `decideLe` ; **Remettre en demande** revient à « En attente » et remet `decideLe` à `null`. Ces transitions sont directes (sans confirmation), réversibles, avec feedback.
- [ ] **Supprimer** une absence, **après confirmation** (bouton rouge), la retire **physiquement** du document persisté (pas de soft-delete).
- [ ] Validation : personne, motif, dates et créneau **requis** ; `dateFin ≥ dateDebut` ; commentaire ≤ 500 caractères. Messages FR de correction, saisie jamais perdue.
- [ ] **Avertissement de chevauchement** non bloquant lorsque la période recoupe une autre absence de la même personne (l'enregistrement reste possible).
- [ ] Affichage : personne **toujours doublée du nom** (pastille + « Prénom Nom ») ; motif, période et créneau **en clair** ; créneau masqué s'il s'agit de la journée entière ; **statut = icône + mot** (jamais la seule couleur).
- [ ] La **modale** est fermable au clavier (`Échap`), le focus y est piégé et rendu à l'ouvrant ; chaque champ a un `label` ; le focus clavier est visible.
- [ ] Aucun accès direct à `localStorage` ; aucun objet `Date` manipulé hors `dateUtil` ; aucune logique métier dans les composants.
- [ ] `npm run build` réussit.

## 11. Vérification

Parcours manuel (`npm run dev`, ouvrir `/absences`) :

1. **Cas « aucune personne »** — Sur un stockage vide (`localStorage.clear()` + recharger) sans personne : l'écran explique qu'il faut d'abord ajouter des personnes et propose un **lien vers l'Équipe**. Le bouton d'ajout est neutralisé.
2. **Pré-requis** — Créer au moins deux personnes actives via `/equipe` (feature `004`), avec des couleurs distinctes.
3. **État vide** — Revenir sur `/absences` : état vide accueillant + bouton « Ajouter une absence ».
4. **Ajout — période** — « Ajouter une absence », choisir une personne, motif « Congés payés », `Du` 12/08/2026 (la date `Au` se cale automatiquement), porter `Au` au 23/08/2026, créneau « Journée entière », enregistrer : la modale se ferme, l'absence apparaît (pastille + « Prénom Nom » + « Congés payés » + « du 12/08/2026 au 23/08/2026 » + statut « En attente »). Indicateur « Modifications enregistrées ». **Recharger** → conservée.
5. **Ajout — demi-journée** — Ajouter une absence « Formation » sur un seul jour (`Du` = `Au`), créneau « Matin » → la carte affiche « le … » **et** « Matin ».
6. **Validation** — Laisser une date vide et « Enregistrer » : message de correction, enregistrement bloqué, saisie conservée. Mettre `Au` **antérieure** à `Du` → message « La date de fin doit être identique ou postérieure à la date de début. ».
7. **Chevauchement** — Ajouter une seconde absence à la **même** personne recoupant la première (mêmes dates, « Journée entière ») → l'encart d'avertissement s'affiche, mais l'enregistrement reste **possible**. Créer plutôt « Matin » vs « Après-midi » sur le même jour → **pas** d'avertissement.
8. **Transitions** — Sur une demande, « Valider » → statut « Validée » (icône + mot), `decideLe` posé (visible dans `localStorage`). « Remettre en demande » → « En attente », `decideLe` à `null`. « Refuser » → « Refusée ».
9. **Filtre** — Basculer « En attente » / « Validées » / « Refusées » / « Toutes » : la liste se restreint en conséquence ; le tri par date de début décroissante reste cohérent.
10. **Édition** — « Modifier » une absence : formulaire pré-rempli, changer le commentaire et enregistrer → reflété ; le statut n'est **pas** réinitialisé.
11. **Suppression** — « Supprimer » : la confirmation (rouge) explique que l'absence ne sera pas conservée ; confirmer → elle disparaît ; `localStorage` : `absences` ne la contient plus.
12. **Accessibilité / clavier** — Ouvrir la modale, `Tab` (focus piégé), `Échap` (retour du focus au bouton d'ouverture). Filtres et boutons d'action actionnables au clavier ; labels présents ; focus visible.
13. **Persistance croisée** — `JSON.parse(localStorage.getItem('idelia:data')).absences` contient les absences attendues (`personneId`, `type`, `dateDebut`/`dateFin`, `creneau`, `statut`, `commentaire`, `demandeLe`, `decideLe`, horodatages) ; les `personneId` résolvent vers des personnes existantes.
14. **Build** — `npm run build` réussit sans erreur.

## 12. Décisions à confirmer / risques

1. **Présentation de la liste : liste plate triée par date décroissante + filtre par statut (retenu)** — **Retenu** plutôt qu'un **regroupement par personne**. Justification : la personne est déjà affichée sur chaque carte (pastille + nom) ; le volume attendu pour un petit cabinet reste modeste ; une **liste unique triée par `dateDebut` décroissant** (récent/à venir en tête) est la plus simple (KISS) et lisible. Un **unique filtre par statut** (« Toutes / En attente / Validées / Refusées ») est ajouté car il sert directement le **workflow** (retrouver les demandes à traiter) à coût quasi nul (un `data` + un computed). **Filtre par personne** différé (person déjà visible ; volume faible). **À confirmer** : ce choix vs regroupement par personne, et l'ajout du filtre statut.
2. **Statut hors formulaire, piloté par actions de liste (retenu)** — **Retenu** : le formulaire ne saisit que les **faits** ; toute absence naît **« En attente »**, puis « Valider » / « Refuser » / « Remettre en demande » depuis la liste. Justification : sépare la **saisie** de la **décision** (mental model clair : on enregistre une demande, puis on la traite) ; garde le formulaire minimal ; rend la décision explicite et **traçable** (`decideLe` posé au bon moment) ; évite un `form-select` de statut mélangeant les concepts. **Alternative** : choisir le statut dès le formulaire (utile car le référent est seul à saisir **et** décider) — écartée pour la clarté du workflow et la propreté des horodatages ; réintroductible facilement si le mainteneur préfère. **À confirmer**.
3. **Suppression physique + confirmation (retenu)** — **Confirmée** : `Absence` ne porte **ni** `actif` **ni** `archivee` dans `schema.js`/[02](../docs/architecture/02-modele-de-domaine.md), et n'est **référencée par aucune autre entité** (les `Affectation` référencent `personneId`/`tourneeId`). La **suppression physique** (`REMOVE`) est donc légitime, protégée par une **confirmation** (bouton rouge, geste définitif), exactement comme la `Preference` de `005`. **À confirmer**.
4. **Détection de chevauchement : incluse comme avertissement non bloquant (retenu)** — **Retenu** : helpers **purs** dans `domain/absences.js` (`absencesSeChevauchent`/`chevauchementsPour`), surfacés par un **encart non bloquant** dans le formulaire (comme la cohérence des paramètres en `003`). Justification : prévient les doubles saisies évidentes pour la **même personne** à coût faible, et les helpers seront **réutilisés par le moteur `009`**. Ce n'est **pas** une règle Vuelidate bloquante (un cumul légitime existe : matin/après-midi, correction volontaire). Le conflit **absence ↔ affectation** reste, lui, du ressort de `009`. **À confirmer** : inclure maintenant vs tout différer à `009`.
5. **Horodatages `demandeLe`/`decideLe` : automatiques et minimaux (retenu)** — **Retenu** : `demandeLe` posé à la **création** (dans `creerAbsence`) ; `decideLe` posé à la **décision** (`valider`/`refuser`) et remis à `null` par `remettreEnDemande`. Aucune saisie manuelle de ces champs (KISS). Justification : renseigne les champs prévus au schéma sans surcharge d'UI, utile à l'affichage futur (« demandé le X », « décidé le Y ») et au moteur. **À confirmer** : ce niveau d'automatisme (alternative : ignorer ces champs en v1).
6. **Cas « aucune personne active » : message + lien vers Équipe (retenu)** — **Retenu** : plutôt qu'un sélecteur de personne vide, un encart explicatif avec un **`router-link` vers `{ name: 'equipe' }`** ; bouton d'ajout neutralisé. Les absences déjà enregistrées (personnes ensuite archivées) restent affichées, et l'**édition** d'une absence d'une personne archivée reste possible (la personne référencée est réinjectée dans le sélecteur — §6.3). **À confirmer**.
7. **Sélecteur de personne = `form-select` + aperçu pastille (retenu)** — **Retenu** : un `<select>` natif (nom seul dans la liste déroulante, la plus accessible et la plus simple) **complété d'un aperçu** « pastille + Prénom Nom » (couleur doublée du nom). **Alternative** : un groupe de cartes-radio avec pastilles (plus riche, plus lourd) — différée. **À confirmer**.
8. **Libellés FR (type/statut)** — Proposés en §5.2 (« Congés payés », « Arrêt maladie », « En attente / Validée / Refusée »…). « En attente » retenu pour `DEMANDE` (état affiché) tout en gardant le verbe « Remettre en demande » (action). **À confirmer** : ces libellés.
9. **Point de vigilance — repli du focus** : après une **suppression**, une **décision** de statut, ou un **ajout depuis l'état vide**, le bouton déclencheur peut disparaître/être remplacé dans le DOM (`ModaleBase` ne peut alors restaurer le focus, qui retomberait sur `<body>`). Reproduire la parade de `TourneesView`/`EquipeView` : replacer le focus sur `boutonAjout` via `$nextTick` après ces actions.
10. **Point de vigilance — lecture de la collection d'absences dans la vue** : exposer les absences via un accès propre au module (`mapState('absences', ['items'])` ou un getter dédié), et garder **tri + filtre** dans la vue (présentation), conformément au choix de `004`/`006`. Ne pas introduire de logique métier dans le composant.
