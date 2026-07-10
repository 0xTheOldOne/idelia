# Feature 0017 — Absences v1 : saisie directe sans workflow de validation

- **Statut** : À faire
- **Dépend de** : `0007` (fonctionnalité à simplifier : écran Absences, `FormulaireAbsence`, module store `absences`, `src/domain/absences.js`, libellés). Touche indirectement `0008` (import/export du `SaveDocument` : à ne pas casser) et `0009` (moteur : à vérifier, pas à modifier).
- **ADR liés** : [0014](../docs/adr/0014-pas-authentification-v1.md) (pas d'authentification en v1 — **justification de fond**), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (moteur module pur — non modifié), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière repository), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (import/export JSON — `statut` reste dans le document), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor — état doublé d'un mot), [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Options API + Vuex).

## 1. Contexte & objectif

La feature `0007` a livré un écran Absences complet, calqué sur un **workflow demande → validation** (statuts `DEMANDE` / `VALIDE` / `REFUSE`, boutons « Valider » / « Refuser » / « Remettre en demande », filtre par statut). Ce workflow suppose **deux rôles distincts** : quelqu'un qui *demande* une absence, quelqu'un qui la *valide*.

Or en **v1 il n'y a qu'un seul gestionnaire du planning et aucune authentification** ([ADR 0014](../docs/adr/0014-pas-authentification-v1.md)) : la même personne saisit **et** décide. Il n'existe donc **personne pour « demander »** une absence, et une machine à états demande/validation n'apporte rien — elle ne fait qu'alourdir l'écran pour un public **peu à l'aise avec l'informatique**. Le workflow de validation et les **rôles** (gestionnaire / titulaire / remplaçant) sont **reportés post-v1, avec l'authentification** (hors v1 dans la [roadmap](../features/ROADMAP.md)).

**Objectif de `0017`** : simplifier l'écran Absences en **saisie directe**. Le gestionnaire enregistre une absence, elle est **effective immédiatement** (prise en compte par le moteur). On **retire de l'interface** tout le vocabulaire et tous les gestes de validation. Le modèle, lui, est **préservé** : le champ `statut` reste présent mais **dormant**, toujours à `VALIDE`, pour ne rien casser (moteur, import/export) et pour préparer la réintroduction future du workflow.

**Hors périmètre `0017`** (à ne pas implémenter ici) :

- **Réintroduction** du workflow demande/validation, des **rôles** et des **droits** : reportée **post-v1 avec l'authentification** (voir §12).
- **Modification du moteur** (`src/domain/scheduling/`) : aucune. On se contente de **vérifier** que « tout en `VALIDE` » reste cohérent (§5.3).
- **Modification de l'import/export** (`0008`) : aucune. Le champ `statut` reste dans le `SaveDocument` (§3).
- Toute nouvelle donnée, migration ou changement de `schemaVersion`.

## 2. Écrans concernés

Une seule route, inchangée ([07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md), `name: 'absences'`, path `/absences`) :

| Route | Écran | Changement `0017` |
|---|---|---|
| `/absences` | **Absences & congés** | **Simplifie** l'écran de `0007` : retire le filtre par statut, l'affichage du statut de validation et les boutons Valider / Refuser / Remettre en demande. Conserve : liste, ajout, édition, suppression confirmée. |

**Avant / après (expérience visée)** pour un utilisateur non-technique :

- **Avant (`0007`)** : chaque ligne affichait un statut « En attente / Validée / Refusée » (icône + mot) ; un filtre « Toutes / En attente / Validées / Refusées » était proposé en haut ; sur chaque ligne, des boutons « Valider » / « Refuser » (ou « Remettre en demande ») demandaient une **décision**. Pour une seule personne qui saisit tout, ces étapes sont un **détour sans utilité**.
- **Après (`0017`)** : le gestionnaire clique « Ajouter une absence », renseigne **qui, quel motif, quand, quel créneau**, enregistre — **c'est tout**. L'absence apparaît dans la liste et **compte immédiatement** dans les plannings à venir. Plus aucun bouton de validation, plus aucun filtre de statut, plus aucun mot « demande » / « validée » / « refusée » à l'écran.
- La liste reste **lisible** : pastille de couleur **doublée du nom**, **motif** en clair (« Congés payés »), **période** lisible (« du 12/08/2026 au 23/08/2026 », ou « le 12/08/2026 »), **créneau** s'il ne s'agit pas de la journée entière (« Matin » / « Après-midi »).
- **Repère factuel (recommandé, remplace le statut retiré)** : plutôt qu'un état vide là où figurait le statut, chaque ligne peut porter un **état temporel factuel** — « À venir » / « En cours » / « Passée » — **déduit des dates** (jamais une approbation). Il aide le gestionnaire à trier d'un coup d'œil, sans introduire de décision. Rendu en **icône + mot** (jamais la seule couleur). Voir §5.2 et §12 (optionnel).
- Tout le reste de l'écran (**état vide** accueillant, cas **« aucune personne dans l'équipe »** avec lien vers l'Équipe, **ajout/édition en modale**, **suppression confirmée** avec bouton rouge, **avertissement de chevauchement** non bloquant, **indicateur de sauvegarde**, encart `ERREUR_CHARGEMENT`) est **conservé tel quel** : l'utilisateur retrouve exactement les mêmes gestes qu'en `0007`, en plus court.

## 3. Modèle de données touché

Entité **`Absence`** ([02 §Absence](../docs/architecture/02-modele-de-domaine.md)). **Aucune structure supprimée, aucun champ retiré, aucune migration, `CURRENT_SCHEMA_VERSION` reste `1`.**

Le seul changement de comportement porte sur la **valeur par défaut** du champ `statut` à la création :

| champ | avant `0007` | après `0017` | rôle |
|---|---|---|---|
| `statut` | `'DEMANDE'` à la création, puis piloté par Valider/Refuser | **`'VALIDE'` à la création**, jamais modifié ensuite via l'UI | **champ dormant conservé** : toujours `VALIDE` pour les absences saisies en v1 |
| `demandeLe` | ISO UTC posé à la création | **inchangé** (posé à la création) | dormant (technique) |
| `decideLe` | `null`, puis posé à la décision | **inchangé** : reste `null` (plus de « décision » explicite en v1) | dormant (technique) |
| tous les autres | | **inchangés** | `id`, `personneId`, `type`, `dateDebut`, `dateFin`, `creneau`, `commentaire`, `createdAt`, `updatedAt` |

**Pourquoi conserver `statut` (et les champs techniques `demandeLe` / `decideLe`) plutôt que les supprimer** :

1. **Ne rien casser** : `toSaveDocument` / `fromSaveDocument` ([schema.js](../src/domain/schema.js)) copient l'entité `Absence` **en bloc** (`absences: rootState.absences.items` ↔ `absences: { items: doc.absences ?? [] }`) ; `verifierIntegrite` ne contrôle que `absence.personneId`. Garder le champ = **import/export strictement inchangé** ([0008](0008-sauvegarde-import-export-json.md), [ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md)).
2. **Moteur inchangé** : `contrainteAbsence.js` **ne bloque que sur `VALIDE`** (§5.3). « Tout en `VALIDE` » ⇒ chaque absence saisie **bloque** l'affectation sur sa période — exactement le comportement attendu en v1.
3. **Préparer le futur** : la réintroduction du workflow post-v1 (avec l'authentification) réutilisera le champ tel quel, sans migration.

> **Données importées héritées** : un `SaveDocument` produit par une version antérieure peut contenir des absences en `DEMANDE` / `REFUSE`. `0017` **ne les réécrit pas** (l'import reste intact) ; le moteur continue de les traiter selon ses règles existantes (`DEMANDE` = avertissement souple, `REFUSE` = ignorée). Cas rare, jugé acceptable (voir §12).

## 4. Store (Vuex)

Module `absences` ([04-gestion-etat-vuex.md](../docs/architecture/04-gestion-etat-vuex.md), [instructions/etat-vuex.md](../docs/instructions/etat-vuex.md)). On **retire uniquement le workflow de décision** ; le CRUD reste.

### 4.1 Getters — inchangés

- `byId`, `parPersonne` : **conservés tels quels** (utilisés par la vue et le moteur).

### 4.2 Mutations — inchangées

- `REPLACE` (hydratation), `ADD`, `UPDATE` (fusion immuable par id), `REMOVE` (suppression physique) : **toutes conservées**. `UPDATE` reste utilisée par l'action `modifier`.

### 4.3 Actions

- `ajouter`, `modifier`, `supprimer` : **conservées** telles quelles (la normalisation reste déléguée au domaine `creerAbsence`, §5.1 ; `updatedAt` posé dans `modifier` via `new Date().toISOString()`).
- **Supprimées** : `valider`, `refuser`, `remettreEnDemande`. Ces actions n'orchestraient qu'un workflow de décision qui **n'a plus de déclencheur UI** ; les laisser serait du **code mort** (KISS, règle d'or #12). Leur logique sera **restaurée post-v1** avec l'authentification (le champ `statut` et les mutations `UPDATE` restant en place, la ré-introduction est triviale). Voir §12.
- Mettre à jour le **commentaire d'en-tête** du module (retirer la mention du workflow demande/validation ; indiquer la **saisie directe v1**, `statut` forcé `VALIDE` par `creerAbsence`).

### 4.4 Persistance — inchangée

Chaque `commit` d'une mutation `absences/*` déclenche le plugin de persistance débouncé de `src/store/index.js`. **Rien à changer**, aucun accès `localStorage` ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).

### 4.5 État lu en lecture seule — inchangé

La vue lit `state.statutSauvegarde` / `state.derniereSauvegarde`, `personnes/actifs`, `personnes/byId`, `absences/items` (comme en `0007`).

## 5. Domaine (logique pure)

Tout dans `src/domain/`, **sans import Vue/Vuex ni `localStorage`** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)).

### 5.1 `src/domain/absences.js` (**modifier**) — défaut `statut: 'VALIDE'`

- **`creerAbsence(champs)`** : seul changement, la valeur par défaut du statut passe de `STATUTS_ABSENCE[0]` (= `'DEMANDE'`) à **`'VALIDE'`** :
  - `statut: champs.statut ?? 'VALIDE'` (chaîne littérale documentée, dans le même esprit que `creneau: champs.creneau ?? 'JOURNEE'` déjà présent). Un `champs.statut` explicite reste respecté (utile pour ne pas réécrire une donnée importée).
  - L'import `STATUTS_ABSENCE` devient inutile dans ce module s'il ne servait qu'à ce défaut : **le retirer** (garder `TYPES_ABSENCE`, toujours utilisé). `STATUTS_ABSENCE` **reste exporté par `schema.js`** (enum dormant).
  - `demandeLe` (= horodatage courant à la création) et `decideLe` (= `null`) : **inchangés** (champs dormants, préservent l'import/export ; voir §12 pour l'alternative écartée).
  - Mettre à jour la JSDoc de `creerAbsence` pour refléter la saisie directe (« absence effective immédiatement, `statut` = `VALIDE` en v1 »).
- **Helpers de chevauchement** (`creneauxSeChevauchent`, `periodesSeChevauchent`, `absencesSeChevauchent`, `chevauchementsPour`) : **conservés tels quels** — utilisés par l'avertissement non bloquant du formulaire **et** par le moteur (`0009`). Ne pas y toucher.

### 5.2 `src/domain/absences.js` (**ajouter — optionnel/recommandé**) — état temporel factuel

Pour remplacer l'affichage de statut retiré par un repère **purement factuel** (§2), ajouter un helper **pur** (comparaison lexicographique de chaînes `"YYYY-MM-DD"`, [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md), **aucun objet `Date`**) :

```text
etatTemporelAbsence(absence, aujourdhui) → 'PASSEE' | 'EN_COURS' | 'A_VENIR'
  si absence.dateFin  < aujourdhui → 'PASSEE'
  si absence.dateDebut > aujourdhui → 'A_VENIR'
  sinon                              → 'EN_COURS'
```

`aujourdhui` est une **chaîne `"YYYY-MM-DD"` injectée** par l'appelant (le domaine reste pur, ne lit pas l'horloge). La vue la calcule via `dateUtil.format(new Date())` (seul point d'accès autorisé à `Date`, [dates.js](../src/domain/utils/dates.js)).

### 5.3 `src/domain/scheduling/contraintes/contrainteAbsence.js` — **vérification, aucune modification**

À **relire sans modifier** pour confirmer la cohérence de « tout en `VALIDE` » :

- `creerContrainteAbsenceValidee` (dure, bloquante) filtre `absence.statut === 'VALIDE'` ⇒ **chaque absence saisie en v1 bloque** l'affectation sur sa période/créneau. C'est le comportement attendu (« une absence saisie est immédiatement prise en compte par le moteur »).
- `creerContrainteAbsenceDemandee` (souple, avertissement) filtre `absence.statut === 'DEMANDE'` ⇒ ne se déclenche **jamais** pour une donnée v1 (aucune `DEMANDE`). Sans effet, cohérent, **rien ne casse**.
- `REFUSE` reste ignorée.

**Conclusion** : le moteur fonctionne à l'identique, en mode « toutes les absences bloquent ». Aucune ligne à changer.

### 5.4 `src/domain/libelles.js` (**modifier légèrement**)

- `LIBELLES_TYPE_ABSENCE`, `libelleTypeAbsence`, `TYPES_ABSENCE_OPTIONS` : **conservés** (utilisés par le formulaire et la liste).
- `LIBELLES_STATUT_ABSENCE`, `libelleStatutAbsence`, `STATUTS_ABSENCE_OPTIONS` : **conservés dormants** (plus utilisés par l'UI après `0017`, mais sans dépendance Vue, prêts pour la réactivation post-v1). Ajouter un court commentaire « dormant en v1 — voir feature 0017 ». *(Alternative — les supprimer — écartée pour éviter de les réécrire plus tard ; voir §12.)*
- **Ajouter (si §5.2 retenu)** les libellés d'état temporel :
  - `LIBELLES_ETAT_TEMPOREL_ABSENCE = { PASSEE: 'Passée', EN_COURS: 'En cours', A_VENIR: 'À venir' }` ;
  - `libelleEtatTemporelAbsence(code)` → `''` si inconnu (même patron que `libelleStatutAbsence`).

## 6. Composants

### 6.1 `src/components/absences/FormulaireAbsence.vue` — **aucun changement**

Le formulaire de `0007` **ne saisit déjà pas** le statut (il n'émet que les faits : `personneId`, `type`, `dateDebut`, `dateFin`, `creneau`, `commentaire`). Le statut est forcé `VALIDE` **côté fabrique** (`creerAbsence`, §5.1). L'exigence « retirer le choix de statut / le figer `VALIDE` » est donc **déjà satisfaite** : il n'y a **rien à retirer** dans ce composant. À vérifier qu'aucun import résiduel (`STATUTS_ABSENCE`, `libelleStatutAbsence`) n'y traîne — ce n'est pas le cas dans `0007`.

> L'avertissement de chevauchement non bloquant (`chevauchementsPour`) et toute la validation Vuelidate restent **inchangés**.

### 6.2 `src/views/AbsencesView.vue` (**modifier** — retirer le workflow de validation)

Écran routé (Options API). On **retire** l'UI de validation et on **conserve** le CRUD.

**À retirer** :

1. **Filtre par statut** : bloc `<div class="absences-filtre">` (groupe de boutons « Toutes / En attente / Validées / Refusées »), le `data` `filtresStatut`, le `data` `filtreStatut`, la `ref` `groupeFiltre`, le computed `absencesAffichees` (le `v-for` de la liste itère alors directement `absencesTriees`), et le SCSS associé (`.absences-filtre`, `.absences-bouton-filtre`). Le message « Aucune absence ne correspond à ce filtre. » disparaît (plus de filtre).
2. **Affichage du statut de validation** : le bloc `<span class="absences-statut">` (icônes `PhClock` / `PhCheckCircle` / `PhXCircle` + `libelleStatutAbsence`) et le SCSS `.absences-statut`.
3. **Boutons de transition** et leurs handlers : « Valider » (`PhCheck`), « Refuser » (`PhX`), « Remettre en demande » (`PhArrowCounterClockwise`) ; méthodes `onValider`, `onRefuser`, `onRemettreEnDemande`.
4. **Machinerie de focus liée aux transitions** : `refsModifier`, `setRefModifier`, `focaliserApresDecision`, et le `:ref` posé sur le bouton « Modifier ». (Elle n'existait que pour enchaîner les décisions ; sans transitions, le focus après suppression retombe sur `boutonAjout` — logique déjà présente et conservée.)
5. Dans `mapActions('absences', …)` : retirer `valider`, `refuser`, `remettreEnDemande` (garder `ajouter`, `modifier`, `supprimer`).
6. **Imports Phosphor** devenus inutiles : `PhClock`, `PhCheckCircle`, `PhXCircle`, `PhCheck`, `PhX`, `PhArrowCounterClockwise` (sauf ré-emploi pour l'état factuel, §6.3). Import `libelleStatutAbsence` retiré.

**À conserver (inchangé)** :

- `<h1>` « Absences & congés » ; encart `ERREUR_CHARGEMENT` ; `IndicateurSauvegarde` (`aEdite`) ; cas **« aucune personne active »** (message + `router-link` vers `{ name: 'equipe' }`, bouton d'ajout neutralisé) ; **état vide** accueillant ; bouton **« Ajouter une absence »** (`boutonAjout`).
- **Liste** : pastille + « Prénom Nom » (via `personnes/byId`, `(archivée)` discret le cas échéant), motif (`libelleTypeAbsence`), période (`periodeTexte`), créneau si ≠ `JOURNEE` (`creneauTexte`).
- **Actions par ligne réduites à** : « Modifier » (`PhPencilSimple`) et « Supprimer » (`PhTrash` + `DialogueConfirmation` variante `danger`).
- Tri `absencesTriees` (par `dateDebut` décroissant, puis `createdAt`) ; `personnesSelectionnables` ; `messageConfirmationSuppression` ; handlers `ouvrirAjout` / `ouvrirEdition` / `onEnregistrer` / `onAnnulerFormulaire` / `demanderSuppression` / `onConfirmerSuppression` / `onAnnulerSuppression` ; `FormulaireAbsence` et `DialogueConfirmation`.

**À ajouter (si §5.2 retenu — état factuel)** :

- Un computed `aujourdhui()` = `dateUtil.format(new Date())`.
- Un `<span class="absences-etat">` par ligne : **icône Phosphor + mot** via `etatTemporelAbsence(absence, aujourdhui)` puis `libelleEtatTemporelAbsence(...)` (ex. `A_VENIR` → `PhClock` / « À venir » ; `EN_COURS` → `PhCalendarCheck` / « En cours » ; `PASSEE` → `PhCheckCircle` / « Passée » — icônes au choix du développeur, **toujours doublées du mot**, [ADR 0013](../docs/adr/0013-icones-phosphor.md)). Réutiliser le SCSS `.absences-statut` renommé `.absences-etat` (mise en forme identique). Une couleur d'accent peut compléter, **jamais** remplacer le mot.

> **Aucune logique métier dans le composant** (règle d'or #10) : libellés via `libelles.js`, période via le helper de présentation local existant, état factuel via le helper pur `etatTemporelAbsence`, dates via `dateUtil`.

## 7. Règles de validation

**Inchangées.** Le formulaire (`FormulaireAbsence`) conserve exactement les règles Vuelidate de `0007` ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md), [instructions/formulaires-validation.md](../docs/instructions/formulaires-validation.md)) : `personneId` requis, `type` requis, `dateDebut` requise, `dateFin` requise **et `≥ dateDebut`**, `creneau` requis, `commentaire ≤ 500`. Le statut n'a jamais été un champ de formulaire : rien à ajouter ni retirer. L'avertissement de chevauchement reste **non bloquant**.

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie.md](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Moins, c'est mieux** : la disparition du filtre, du statut de validation et des boutons Valider/Refuser **allège** un écran destiné à une seule personne. Le geste se résume à « Ajouter → renseigner → Enregistrer ».
- **Zéro vocabulaire de validation** à l'écran : plus de « En attente », « Validée », « Refusée », « Valider », « Refuser », « Remettre en demande ». On ne laisse pas croire à un circuit d'approbation qui n'existe pas en v1.
- **Effet immédiat, mental model clair** : une absence saisie **compte tout de suite** dans les plannings — pas d'étape intermédiaire à ne pas oublier.
- **Repère factuel, jamais une décision** (si §5.2 retenu) : « À venir / En cours / Passée » informe sans rien demander ; c'est **déduit des dates**, présenté en **icône + mot** (jamais la seule couleur, [ADR 0013](../docs/adr/0013-icones-phosphor.md)).
- **Continuité des gestes** : l'ajout/édition en modale, la suppression confirmée (bouton rouge), l'indicateur de sauvegarde, l'avertissement de chevauchement, le cas « aucune personne » + lien Équipe, l'état vide accueillant — **tout est conservé** : l'utilisateur ne réapprend rien.
- **Réversibilité maintenue** : une saisie erronée se **corrige** (Modifier) ou se **supprime** (avec confirmation) ; aucune perte de saisie en cas d'erreur de validation.
- **Ergonomie physique inchangée** : cibles ~44 px, `label` par champ, focus clavier visible, structure de titres, modale accessible (focus piégé, `Échap`, retour du focus à l'ouvrant).

## 9. Étapes d'implémentation

Découpage en **petites tâches** (c'est une simplification). Ordre : **T1 → T2**, puis **T3 optionnel**. Chaque tâche = un sous-agent `developpeur-vue` (`model: sonnet`, effort `medium`).

### Tâche 1 — Domaine & store : `statut` forcé `VALIDE`, retrait du workflow de décision

**Fichiers** :
- `src/domain/absences.js` (**modifier**) — `creerAbsence` : `statut: champs.statut ?? 'VALIDE'` ; retirer l'import `STATUTS_ABSENCE` s'il devient inutile ; MAJ JSDoc (saisie directe, absence effective immédiatement). Ne pas toucher aux helpers de chevauchement.
- `src/store/modules/absences.js` (**modifier**) — supprimer les actions `valider`, `refuser`, `remettreEnDemande` ; conserver `ajouter`, `modifier`, `supprimer`, les mutations (`REPLACE`/`ADD`/`UPDATE`/`REMOVE`) et les getters ; MAJ du commentaire d'en-tête (saisie directe v1).
- `src/domain/libelles.js` (**modifier**) — annoter `LIBELLES_STATUT_ABSENCE` / `libelleStatutAbsence` / `STATUTS_ABSENCE_OPTIONS` comme **dormants v1** (les conserver).

**Critères de sortie** :
- `creerAbsence({ personneId:'p1', dateDebut:'2026-08-12', dateFin:'2026-08-23' }).statut === 'VALIDE'` ; les autres défauts inchangés (`type` = `'CONGE_PAYE'`, `creneau` = `'JOURNEE'`, `commentaire` = `''`, `demandeLe` ISO UTC, `decideLe === null`, `createdAt`/`updatedAt` ISO UTC).
- Un `champs.statut` explicite reste respecté (`creerAbsence({ statut:'DEMANDE', … }).statut === 'DEMANDE'`).
- `dispatch('absences/ajouter', {…})` ⇒ l'absence est dans `items` avec `statut === 'VALIDE'` ; `modifier` / `supprimer` fonctionnent comme avant ; **`valider` / `refuser` / `remettreEnDemande` n'existent plus** (leur `dispatch` échoue).
- Aucun import Vue/Vuex ni `localStorage` dans `absences.js` / `libelles.js` ; aucun objet `Date` hors concessions techniques déjà tolérées.
- `npm run build` réussit.

### Tâche 2 — `AbsencesView` : retirer l'UI de validation (filtre, statut, transitions)

**Fichiers** :
- `src/views/AbsencesView.vue` (**modifier**) — retirer le filtre par statut, l'affichage du statut, les boutons Valider/Refuser/Remettre en demande + handlers, la machinerie de focus liée aux transitions (`refsModifier`/`setRefModifier`/`focaliserApresDecision`/`:ref` sur « Modifier »), les actions store correspondantes dans `mapActions`, les imports Phosphor et `libelleStatutAbsence` devenus inutiles, et le SCSS associé (§6.2). Conserver Modifier + Supprimer confirmée et tout le reste.

**Dépend de** : T1.

**Critères de sortie** :
- **Aucun** bouton « Valider » / « Refuser » / « Remettre en demande » à l'écran ; **aucun** filtre par statut ; **aucun** mot « En attente / Validée / Refusée » affiché.
- Ajouter une absence l'enregistre en `VALIDE` et l'affiche immédiatement (pastille + nom, motif, période, créneau si demi-journée) ; indicateur « Modifications enregistrées » ; **recharger** conserve l'absence.
- Modifier fonctionne ; Supprimer ouvre la confirmation (rouge) et retire l'absence.
- Après suppression, le focus revient sur le bouton d'ajout (parade existante conservée).
- Aucun import inutilisé ne subsiste ; aucun accès `localStorage` ; aucune logique métier dans le composant ; `npm run build` réussit (ni erreur, ni variable/imports inutilisés).

### Tâche 3 — (Optionnel/recommandé) État temporel factuel dans la liste

**Fichiers** :
- `src/domain/absences.js` (**modifier**) — ajouter `etatTemporelAbsence(absence, aujourdhui)` pur (§5.2).
- `src/domain/libelles.js` (**modifier**) — ajouter `LIBELLES_ETAT_TEMPOREL_ABSENCE` + `libelleEtatTemporelAbsence`.
- `src/views/AbsencesView.vue` (**modifier**) — computed `aujourdhui`, affichage « icône + mot » par ligne (§6.3).

**Dépend de** : T1, T2.

**Critères de sortie** :
- Chaque ligne affiche « À venir » / « En cours » / « Passée » **cohérent avec les dates** et la date du jour, en **icône + mot** (jamais la seule couleur).
- `etatTemporelAbsence` est **pur** (comparaison de chaînes, `aujourdhui` injecté, aucun `Date` interne) ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] La route `/absences` conserve son titre « Absences & congés » et son bouton « Ajouter une absence ».
- [ ] **Aucun bouton Valider / Refuser / Remettre en demande** n'est présent à l'écran.
- [ ] **Aucun filtre par statut** (« Toutes / En attente / Validées / Refusées ») n'est présent.
- [ ] **Aucun libellé de validation** (« En attente », « Validée », « Refusée ») n'est affiché.
- [ ] Une absence saisie a **`statut === 'VALIDE'`** par défaut (vérifiable dans `localStorage` : `JSON.parse(localStorage.getItem('idelia:data')).absences[…].statut === 'VALIDE'`).
- [ ] Une absence saisie est **immédiatement prise en compte par le moteur** : générer un planning sur une période couverte par une absence n'affecte pas la personne sur cette période (contrainte dure « absence validée »).
- [ ] Ajouter / Modifier / Supprimer (avec confirmation, bouton rouge) fonctionnent comme en `0007` ; la persistance et l'indicateur de sauvegarde fonctionnent ; recharger la page conserve les données.
- [ ] La validation du formulaire est **inchangée** (personne/motif/dates/créneau requis, `dateFin ≥ dateDebut`, commentaire ≤ 500, avertissement de chevauchement non bloquant).
- [ ] **Import/export inchangé** : un export réalisé après `0017` contient toujours le champ `statut` pour chaque absence ; un fichier exporté avant `0017` se réimporte sans erreur (l'intégrité ne dépend pas du statut).
- [ ] Le champ `statut` **n'a pas été supprimé** du modèle ni du `SaveDocument` ; `schemaVersion` inchangé (`1`), aucune migration.
- [ ] `src/domain/scheduling/contraintes/contrainteAbsence.js` **n'est pas modifié** ; « tout en `VALIDE` » est cohérent (chaque absence bloque, la contrainte souple `DEMANDE` reste sans effet).
- [ ] *(Si §5.2 retenu)* Chaque ligne affiche un **état factuel** « À venir / En cours / Passée » déduit des dates, en icône + mot, **jamais** une approbation.
- [ ] Aucun accès direct à `localStorage` ; aucun objet `Date` hors `dateUtil` ; aucune logique métier dans les composants ; aucun import inutilisé.
- [ ] `npm run build` réussit.

## 11. Vérification

Parcours manuel (`npm run dev`, ouvrir `/absences`), en supposant ≥ 2 personnes actives (via `/equipe`) :

1. **Écran allégé** — L'écran ne montre **ni** filtre de statut, **ni** mention « En attente / Validée / Refusée », **ni** boutons Valider/Refuser/Remettre en demande. Seules actions par ligne : « Modifier » et « Supprimer ».
2. **Ajout direct** — « Ajouter une absence », renseigner personne + motif « Congés payés » + période + créneau, Enregistrer : la modale se ferme, l'absence apparaît immédiatement (pastille + nom, motif, période, créneau si demi-journée) ; indicateur « Modifications enregistrées ». Dans `localStorage`, l'absence a `statut: 'VALIDE'`, `decideLe: null`.
3. **Effet moteur** — Aller sur `/planning` (feature 0010), générer un planning sur une période couverte par l'absence : la personne **n'est pas affectée** sur cette période (contrainte dure). Recharger conserve l'absence.
4. **Édition / suppression** — « Modifier » pré-remplit et enregistre ; « Supprimer » ouvre la confirmation rouge puis retire l'absence ; le focus revient au bouton d'ajout.
5. **Validation inchangée** — Date de fin antérieure à la date de début ⇒ message « La date de fin doit être identique ou postérieure à la date de début. » ; chevauchement même personne ⇒ avertissement **non bloquant**.
6. **Import/export** — Exporter (feature 0008) : le JSON contient `statut: 'VALIDE'` pour chaque absence. Vider le stockage, réimporter le fichier : les absences reviennent à l'identique, sans erreur d'intégrité.
7. **Compatibilité héritée** — Importer un fichier antérieur contenant une absence `DEMANDE` : l'import réussit ; l'écran l'affiche normalement (état factuel selon ses dates) ; le moteur la traite comme avertissement souple (comportement existant, non régressé).
8. **État factuel** *(si §5.2 retenu)* — Une absence entièrement passée affiche « Passée » ; une future « À venir » ; une couvrant aujourd'hui « En cours » ; toujours icône + mot.
9. **Accessibilité / clavier** — Modale : `Tab` piégé, `Échap` referme, focus rendu à l'ouvrant ; boutons actionnables au clavier ; focus visible ; labels présents.
10. **Build** — `npm run build` réussit sans erreur ni import inutilisé.

## 12. Décisions à confirmer / risques

1. **Suppression des actions store `valider` / `refuser` / `remettreEnDemande` (retenu)** — Retenu plutôt que de les laisser dormantes : sans déclencheur UI, ce serait du **code mort** (KISS). Le champ `statut` et la mutation `UPDATE` restant en place, la **réintroduction post-v1** (avec l'authentification) est triviale. **Alternative** : les conserver dormantes pour éviter tout futur re-ajout. **À confirmer**.
2. **`statut` conservé et forcé `VALIDE` (imposé par la demande)** — Le champ **n'est pas supprimé** : il reste dans le modèle et le `SaveDocument`, toujours `VALIDE` pour les absences v1. C'est le socle de la non-régression (moteur, import/export) et de la réactivation future.
3. **`demandeLe` / `decideLe` laissés tels quels (retenu, minimal)** — `demandeLe` reste posé à la création, `decideLe` reste `null`. **Alternative écartée** : poser `decideLe = <création>` pour qu'une absence `VALIDE` porte une « date de décision » cohérente. Écartée pour rester **minimal** (champs dormants, non affichés). **À confirmer**.
4. **Libellés de statut (`LIBELLES_STATUT_ABSENCE`, etc.) conservés dormants (retenu)** — Conservés (sans dépendance Vue, prêts pour la réactivation) plutôt que supprimés. **Alternative** : les retirer pour un module plus net. **À confirmer**.
5. **État temporel factuel : optionnel/recommandé (§5.2 / T3)** — Proposé pour combler le repère laissé par le statut retiré et aider le tri visuel, **sans** réintroduire de notion d'approbation. **À confirmer** : l'inclure en v1 ou laisser la liste sans repère d'état (motif + période suffisent).
6. **Données importées héritées (`DEMANDE` / `REFUSE`)** — `0017` **ne réécrit pas** les statuts importés (l'import de `0008` reste intact). Conséquence : une absence héritée `DEMANDE` sera traitée par le moteur comme **avertissement** (souple) et non comme blocage, et `REFUSE` sera ignorée — sans repère à l'écran indiquant cette différence. Cas rare (peu d'historiques v0). **Alternative** (hors périmètre, toucherait `0008`) : normaliser à l'import `DEMANDE → VALIDE`. **À confirmer** : accepter le comportement actuel.
7. **Réactivation post-v1 (note, hors périmètre)** — Le **workflow demande → validation** et les **rôles / droits** (gestionnaire / titulaire / remplaçant) seront réintroduits **avec l'authentification**, hors v1 ([ADR 0014](../docs/adr/0014-pas-authentification-v1.md), [roadmap](../features/ROADMAP.md) « Hors v1 »). `0017` est conçue pour que cette réactivation soit un **ajout** (restaurer les 3 actions store, ré-afficher statut + transitions + filtre) sans migration de données.
