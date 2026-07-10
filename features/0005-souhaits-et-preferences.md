# Feature 0005 — Souhaits & préférences

- **Statut** : Fait
- **Dépend de** : `0004` (module `personnes` avec CRUD, getter `byId`, mutation `UPDATE` par fusion immuable ; briques `ModaleBase`, `DialogueConfirmation`, `IndicateurSauvegarde` ; `src/domain/libelles.js`, `src/domain/personnes.js`, `dateUtil`). S'appuie indirectement sur `0002` (store persisté, `schema.js`, plugin de persistance débouncé).
- **ADR liés** : [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Options API + Vuex), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière repository), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (domaine = module pur), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7 + horodatages ISO UTC), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + Bootstrap thémé, modale), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor), [0016](../docs/adr/0016-router-mode-hash-pour-pages.md) (routeur en mode hash — première **route paramétrée** de l'app).

## 1. Contexte & objectif

La feature `0004` a rendu l'équipe modifiable et **initialise `preferences` à `[]`** sur chaque personne, **sans jamais l'éditer** (renvoyé explicitement à `0005`, route `/equipe/:id/souhaits`). La feature `0005` ouvre cet écran : elle permet au référent (public **peu à l'aise avec l'informatique**) de saisir, pour **une personne donnée**, ses **souhaits et contraintes** de travail — par exemple « ne travaille jamais le mercredi », « souhaite ses repos le week-end », « pas plus de 5 jours d'affilée », « indisponible le mardi matin ».

Chaque souhait est une **`Preference`** attachée à la personne. Deux notions structurent l'expérience :

- **La nature** : une préférence est soit **obligatoire** (contrainte **DURE**, jamais violée par le futur moteur `0009`), soit un **souhait** (préférence **SOUPLE**, satisfait *si possible*, avec une **importance**).
- **Le type** : la forme des informations à saisir dépend du **type** de souhait (un jour, un moment de la journée, un nombre de jours…). C'est un modèle **polymorphe** (`type` + `params`, voir §3).

Ces données sont le carburant du **moteur de planification** (`0009`) et de la **génération** (`0010`) : plus elles sont fidèles, meilleur est le planning proposé. Chaque enregistrement est **persisté automatiquement** (plugin débouncé de `0002`) avec un **retour visuel clair** réutilisant `IndicateurSauvegarde` (`0003`).

**Hors périmètre `0005`** (à ne pas implémenter ici) :

- Le type **`PREFERENCE_TOURNEE`** (préférer/éviter une tournée) : il référence des `tourneeIds`, or **les tournées n'existent pas encore** (feature `0006`, module `tournees` vide, sans CRUD ni libellés). Ce type est **différé à `0006`** — voir §12. Le domaine reste néanmoins **structurellement prêt** (schéma inchangé, extensible), il n'est simplement **pas proposé** dans le sélecteur de type en `0005`.
- **Réordonnancement manuel** des souhaits : non pertinent (ordre d'affichage = ordre de saisie, KISS).
- L'**exploitation** des préférences par le moteur (filtrage dur / optimisation souple) — features `0009`/`0010`.
- Les **absences** datées (congés, arrêts) : ce ne sont **pas** des préférences récurrentes — feature `0007`.

## 2. Écrans concernés

Première **route paramétrée** de l'application, prévue dès [07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md) et annoncée par `0004` :

| Route | Écran | Changement `0005` |
|---|---|---|
| `/equipe/:id/souhaits` | **Souhaits** | **Nouvel écran** : souhaits & préférences d'**une** personne (liste + ajout/édition/suppression). |
| `/equipe` | **Équipe** | **Modifié** : chaque personne **active** gagne un bouton « Souhaits » qui mène à son écran de souhaits. |

**Expérience visée** (utilisateur non-technique) :

- **Depuis l'équipe** : à côté de « Modifier » et « Archiver », un bouton **« Souhaits »** (icône Phosphor `PhSlidersHorizontal`) ouvre l'écran des souhaits de cette personne.
- **Titre personnalisé et rassurant** : « Souhaits et contraintes de {Prénom} {Nom} », avec un **lien de retour** clair vers l'équipe (« ← Retour à l'équipe »), pour ne jamais être dans un cul-de-sac.
- **Explication d'entrée** en langage humain, une fois, en haut : la différence entre **obligatoire** (« toujours respecté ») et **souhait** (« pris en compte si possible »), sans jargon.
- **Action principale dominante** : bouton **« Ajouter un souhait »** (`btn btn-primary`, `PhPlus`), toujours visible.
- **Liste lisible** : chaque souhait est résumé **en une phrase française** (« Ne travaille pas le mercredi », « Souhaite être en repos le samedi et le dimanche — importance : assez important »), avec un **repère de nature non-coloré** (icône + mot « Obligatoire » / « Souhait », jamais la couleur seule) et les actions « Modifier » / « Supprimer ».
- **Ajout / édition en modale** (au-dessus de `ModaleBase`, comme le formulaire de personne en `0004`) : on choisit d'abord le **type de souhait** (liste claire), puis **seuls les champs pertinents** pour ce type apparaissent ; on choisit **Obligatoire** ou **Souhait** (et, pour un souhait, une **importance** en mots) ; « Enregistrer » dominant, « Annuler » toujours disponible ; fermeture au clavier (Échap) et par clic hors fenêtre.
- **Suppression réversible par confirmation** : « Supprimer » ouvre une **demande de confirmation** en langage clair (un souhait supprimé n'est **pas** conservé — geste réfléchi, bouton rouge). En complément, chaque souhait peut être **mis en pause** sans être supprimé (interrupteur « Pris en compte »), pour l'exclure temporairement d'une génération sans perdre sa configuration.
- **État vide accueillant** : « Aucun souhait pour l'instant. Ajoutez-en un pour guider la création des plannings. » + le même gros bouton d'ajout.
- **Personne introuvable** (URL saisie à la main / identifiant inconnu) : encart aimable (« Cette personne est introuvable. ») + retour vers l'équipe, plutôt qu'une page cassée.

## 3. Modèle de données touché

Entité **`Preference`**, **imbriquée dans `Personne`** (collection racine `personnes.items`), déjà décrite dans le modèle de domaine ([02 §Preference](../docs/architecture/02-modele-de-domaine.md)) et dont les enums existent déjà dans `schema.js` (`NATURES_PREFERENCE`, `TYPES_PREFERENCE`, `CRENEAUX`). **Aucune nouvelle structure racine, aucune migration.**

**Structure d'une `Preference`** (source de vérité : [02 §Preference](../docs/architecture/02-modele-de-domaine.md)) — polymorphisme par discriminant `type` + sac `params` :

| champ | type | oblig. | rôle `0005` |
|---|---|---|---|
| `id` | uuid | oui | généré via `genId()` à la création ; **immuable** |
| `type` | enum `TYPES_PREFERENCE` | oui | discriminant ; pilote les champs de `params` (voir table) |
| `nature` | `DURE` \| `SOUPLE` | oui | « Obligatoire » (dure) / « Souhait » (souple) ; édité |
| `poids` | integer 1..10 | non | défaut `5` ; **utilisé seulement si `SOUPLE`** ; saisi via une **importance** (voir §5) |
| `actif` | boolean | oui | défaut `true` ; interrupteur « Pris en compte » (mise en pause) |
| `params` | object | oui | forme **selon `type`** (voir table ci-dessous) ; normalisé au domaine |
| `libelle` | string | non | note libre facultative de l'utilisateur |
| `createdAt` / `updatedAt` | ISO UTC | oui | posés/rafraîchis automatiquement |

**`type` → `params`** (les 8 types du schéma ; le libellé FR est en §5) :

| type | `params` | ce que l'utilisateur saisit | proposé en `0005` ? |
|---|---|---|---|
| `JOUR_OFF_RECURRENT` | `{ joursSemaine: number[1..7] }` | 1..n jours (cases) | oui |
| `JOURS_REPOS_SOUHAITES` | `{ joursSemaine: number[1..7] }` | 1..n jours (cases) | oui |
| `CRENEAU_OFF` | `{ creneaux: Creneau[], joursSemaine?: number[] }` | 1..n créneaux (+ jours facultatifs) | oui |
| `INDISPO_HEBDO` | `{ joursSemaine: number[], creneaux?: Creneau[] }` | 1..n jours (+ créneaux facultatifs) | oui |
| `MAX_JOURS_CONSECUTIFS` | `{ max: integer>=1 }` | un nombre | oui |
| `MIN_JOURS_CONSECUTIFS` | `{ min: integer>=1 }` | un nombre | oui |
| `NB_JOURS_SEMAINE` | `{ min?: integer, max?: integer }` | un mini et/ou un maxi | oui |
| `PREFERENCE_TOURNEE` | `{ tourneeIds: uuid[], sens: "PREFERE"\|"EVITE" }` | tournée(s) + sens | **non** (différé `0006`, §12) |

> **Jours** : ISO 1-7 (Lundi…Dimanche), [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) — réutilise `JOURS_SEMAINE` de `libelles.js`. **Créneaux** : sous-ensemble de `CRENEAUX` (`schema.js`) — réutilise `LIBELLES_CRENEAU`.

**Impact `schemaVersion` / migrations** : **aucun**. `CURRENT_SCHEMA_VERSION` reste `1`. Les préférences sont sérialisées telles quelles dans `personne.preferences` par `toSaveDocument`/`fromSaveDocument` (déjà en place). `verifierIntegrite` ne contrôle pas les `Preference` (objets-valeurs imbriqués, sans référence sortante en `0005` ; le contrôle des `tourneeIds` du type `PREFERENCE_TOURNEE` viendra avec `0006`/`0008`).

## 4. Store (Vuex)

Module `personnes` ([04-gestion-etat-vuex.md](../docs/architecture/04-gestion-etat-vuex.md), [instructions/etat-vuex.md](../docs/instructions/etat-vuex.md)). On **réutilise intégralement** l'infrastructure de `0004` : getter `byId`, **mutation `UPDATE` par fusion immuable** (`{ ...ancien, ...patch }`), persistance débouncée automatique. Les préférences vivant **dans** la personne, éditer une préférence = **mettre à jour la personne** (patch `{ preferences: <nouveau tableau>, updatedAt }`).

### 4.1 Getter (ajout)

- `preferencesDe` (**ajout**) : `(state, getters) => (id) => (getters.byId(id)?.preferences ?? [])` — renvoie le tableau de préférences d'une personne (ou `[]` si personne introuvable). Confort de lecture pour l'écran ; le tri d'affichage n'est **pas** fait ici (présentation, voir §6).

> Getters existants **conservés** : `byId`, `actifs`, `inactifs`. Mutations existantes **conservées** : `REPLACE`, `ADD`, `UPDATE`.

### 4.2 Actions (ajouts)

Les actions **orchestrent** ; la construction/normalisation d'une `Preference` vit dans le **domaine** (§5, `creerPreference`), jamais dans le store (règle d'or #10). Chaque action lit la personne courante via `getters.byId`, recompose son tableau `preferences` **de façon immuable** (spread / `map` / `filter`, jamais de mutation en place), et rafraîchit **`personne.updatedAt`** (ISO UTC, [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)). La mutation `UPDATE` de `0004` fait le reste.

- `ajouterPreference({ commit, getters }, { personneId, ...champs })` :
  - `const personne = getters.byId(personneId)` ; si absente, ne rien faire ;
  - `const preference = creerPreference(champs)` (§5.1) ;
  - `commit('UPDATE', { id: personneId, patch: { preferences: [...personne.preferences, preference], updatedAt: <ISO UTC> } })`.
- `modifierPreference({ commit, getters }, { personneId, preferenceId, ...champs })` :
  - récupère la personne ; recompose `preferences` en **remplaçant** l'élément d'`id === preferenceId` par une version **renormalisée** conservant `id`/`createdAt` : `creerPreference({ ...ancienne, ...champs, id: preferenceId, createdAt: ancienne.createdAt })` (ce qui **renormalise `params` selon le type** et rafraîchit le `updatedAt` **de la préférence**) ;
  - `commit('UPDATE', { id: personneId, patch: { preferences: <tableau recomposé>, updatedAt: <ISO UTC> } })`.
- `supprimerPreference({ commit, getters }, { personneId, preferenceId })` :
  - `preferences.filter((p) => p.id !== preferenceId)` (suppression **physique** — objet-valeur imbriqué, non référencé, §12) ;
  - `commit('UPDATE', { id: personneId, patch: { preferences: <tableau filtré>, updatedAt: <ISO UTC> } })`.
- `basculerPreference({ commit, getters }, { personneId, preferenceId })` :
  - inverse `actif` de la préférence ciblée (`map` immuable, rafraîchit le `updatedAt` de la préférence) ;
  - `commit('UPDATE', { id: personneId, patch: { preferences: <tableau recomposé>, updatedAt: <ISO UTC> } })`.

> **Réutilisation de `creerPreference` en modification** : passer l'ancienne préférence fusionnée avec le patch à travers la fabrique **garantit la cohérence** (`params` toujours normalisé pour le `type` courant, `updatedAt` rafraîchi) sans dupliquer la logique dans le store. `id` et `createdAt` sont explicitement préservés.

### 4.3 Persistance (déjà en place, rien à ajouter)

Chaque `commit('personnes/UPDATE', …)` déclenche le **plugin de persistance débouncé (~400 ms)** de `src/store/index.js` (`toSaveDocument` → `storageRepository.save`). **Aucun accès `localStorage`** dans le module ou les composants ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).

### 4.4 État racine consommé en lecture seule

L'écran **lit** (sans jamais les muter), comme `0003`/`0004` : `state.statutSauvegarde` et `state.derniereSauvegarde` (retour visuel via `IndicateurSauvegarde`, dont l'encart `ERREUR_CHARGEMENT`).

## 5. Domaine (logique pure)

Tout dans `src/domain/`, **sans import Vue/Vuex ni `localStorage`** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)). Réutilisable par le moteur (`0009`) et les écrans planning (`0010`+).

### 5.1 `src/domain/preferences.js` (**nouveau**) — fabrique, métadonnées & description d'une Preference

**Décision (§12) : un module dédié**, distinct de `personnes.js`. Justification : le polymorphisme (fabrique + normalisation de `params` par type + métadonnées par type + description en langage humain + échelle d'importance) est **cohésif et volumineux**, sans rapport avec la fabrique `Personne`. On isole cette complexité, exactement comme `0003` a isolé `cabinet.js` pour la cohérence des paramètres. `personnes.js` reste focalisé sur la `Personne`.

Exports :

- **`creerPreference(champs)`** → `Preference` : construit une préférence **complète et normalisée** à partir d'un objet partiel. Fonction **pure** (hors `genId()` / `new Date().toISOString()`, tolérés comme dans `schema.js`/`personnes.js`).
  - `id` : `champs.id ?? genId()` ; `type` : `champs.type` (∈ `TYPES_PREFERENCE`, garanti par le formulaire) ;
  - `nature` : `champs.nature ?? natureParDefaut(type)` (∈ `NATURES_PREFERENCE`) ;
  - `poids` : `champs.poids ?? 5` (entier 1..10) ;
  - `actif` : `champs.actif ?? true` ;
  - `params` : **`normaliserParams(type, champs.params)`** — ne conserve **que** les clés pertinentes pour le `type`, coerce les jours en entiers ISO **triés/dédupliqués**, les créneaux en sous-ensemble de `CRENEAUX`, les nombres en entiers (ou `null` pour les bornes optionnelles de `NB_JOURS_SEMAINE`) ; ignore silencieusement les clés étrangères ;
  - `libelle` : `String(champs.libelle ?? '').trim()` ;
  - `createdAt` : `champs.createdAt ?? <ISO UTC>` ; `updatedAt` : `<ISO UTC>`.
  - JSDoc : `@typedef {Object} Preference` (aligné sur [02 §Preference](../docs/architecture/02-modele-de-domaine.md)).
- **`META_TYPES_PREFERENCE`** (objet gelé, indexé par code de type) : la **description métier** de chaque type, qui pilote le rendu dynamique du formulaire et l'aide contextuelle. Pour chaque type : `{ champs: <'jours' | 'creneaux+jours?' | 'jours+creneaux?' | 'nombreMax' | 'nombreMin' | 'minMax'>, natureParDefaut: 'DURE'|'SOUPLE', aide: <string FR> }`. Défauts de nature suggérés (l'utilisateur peut toujours changer) : `INDISPO_HEBDO`, `CRENEAU_OFF`, `MAX_JOURS_CONSECUTIFS` → `DURE` ; les autres → `SOUPLE`.
- **`TYPES_PREFERENCE_OFFERTS`** : `TYPES_PREFERENCE` **privé de** `'PREFERENCE_TOURNEE'` (différé `0006`). C'est la liste consommée par le sélecteur de type du formulaire.
- **`natureParDefaut(type)`** → `'DURE'|'SOUPLE'` : lit `META_TYPES_PREFERENCE`.
- **Échelle d'importance (poids)** — traduit le `poids` (entier 1..10, jargon) en **3 niveaux humains** :
  - `NIVEAUX_IMPORTANCE` : `[{ code:'FAIBLE', libelle:'Peu important', poids:3 }, { code:'MOYENNE', libelle:'Assez important', poids:5 }, { code:'FORTE', libelle:'Très important', poids:8 }]` ;
  - `niveauVersPoids(code)` → entier (ex. `'FORTE' → 8`) ;
  - `poidsVersNiveau(poids)` → code du niveau **le plus proche** (robuste à toute valeur 1..10 importée). Ce mapping vit **ici** (et non dans `libelles.js`) car il encode une **règle de domaine** — le rapprochement d'un scalaire `poids` vers un palier — indissociable de ses valeurs numériques (§12).
- **`decrirePreference(preference)`** → `string` : **résumé en une phrase française**, pur, construit à partir de `type` + `params` en réutilisant `libelleJour`/`libelleCreneau` de `libelles.js` (import domaine → domaine, autorisé). Exemples attendus :
  - `JOUR_OFF_RECURRENT {joursSemaine:[3]}` → « Ne travaille pas le mercredi » ;
  - `JOURS_REPOS_SOUHAITES {joursSemaine:[6,7]}` → « Souhaite être en repos le samedi et le dimanche » ;
  - `CRENEAU_OFF {creneaux:['APRES_MIDI']}` → « Ne travaille pas l'après-midi » ;
  - `INDISPO_HEBDO {joursSemaine:[2], creneaux:['MATIN']}` → « Indisponible le mardi matin » ;
  - `MAX_JOURS_CONSECUTIFS {max:5}` → « Pas plus de 5 jours d'affilée » ;
  - `MIN_JOURS_CONSECUTIFS {min:2}` → « Au moins 2 jours d'affilée » ;
  - `NB_JOURS_SEMAINE {min:3,max:4}` → « Entre 3 et 4 jours par semaine » (gère aussi « Au moins 3… » / « Au plus 4… » si une seule borne).
  - Helper interne de **jonction FR** (« a, b et c ») pour les listes de jours/créneaux.

> Le module **n'est pas responsable de la validation de saisie** (au bon moment, messages inline) : cela reste au formulaire via Vuelidate (§7), cohérent avec `0004` où la cohérence `dateSortie ≥ dateEntree` vivait dans le formulaire. Le domaine garantit en revanche la **normalisation structurelle** (`normaliserParams`) et la **description** — le moteur `0009` réutilisera `creerPreference`/`META_TYPES_PREFERENCE`.

### 5.2 `src/domain/libelles.js` (**modifier**) — libellés de nature & de type

Ajouts, dans l'esprit exact de `LIBELLES_STATUT_PERSONNE`/`STATUTS_PERSONNE_OPTIONS` déjà présents (codes = source de vérité dans `schema.js` ; ce module ne porte que l'affichage) :

| Export | Forme | Rôle |
|---|---|---|
| `LIBELLES_NATURE_PREFERENCE` | `{ DURE: 'Obligatoire', SOUPLE: 'Souhait' }` | code → libellé FR |
| `libelleNaturePreference(code)` | `(string) → string` | `'SOUPLE' → 'Souhait'` ; `''` si inconnu |
| `NATURES_PREFERENCE_OPTIONS` | `[{ code:'DURE', libelle:'Obligatoire', aide:'Toujours respecté par le planning.' }, { code:'SOUPLE', libelle:'Souhait', aide:'Pris en compte si possible.' }]` | groupe de boutons radio du formulaire (dérivé de `NATURES_PREFERENCE`) |
| `LIBELLES_TYPE_PREFERENCE` | table des 8 types → libellé FR court | affichage |
| `libelleTypePreference(code)` | `(string) → string` | `''` si inconnu |
| `TYPES_PREFERENCE_OPTIONS` | `[{ code, libelle }]` dérivée de `TYPES_PREFERENCE` + `LIBELLES_TYPE_PREFERENCE` | référence complète |

Libellés FR proposés pour `LIBELLES_TYPE_PREFERENCE` (à ajuster à l'implémentation) :

| code | libellé FR |
|---|---|
| `JOUR_OFF_RECURRENT` | « Jour non travaillé (chaque semaine) » |
| `JOURS_REPOS_SOUHAITES` | « Jours de repos souhaités » |
| `CRENEAU_OFF` | « Demi-journée non travaillée » |
| `INDISPO_HEBDO` | « Indisponibilité chaque semaine » |
| `MAX_JOURS_CONSECUTIFS` | « Maximum de jours d'affilée » |
| `MIN_JOURS_CONSECUTIFS` | « Minimum de jours d'affilée » |
| `NB_JOURS_SEMAINE` | « Nombre de jours par semaine » |
| `PREFERENCE_TOURNEE` | « Tournée préférée ou évitée » |

> Le **sélecteur** de type du formulaire n'itère **pas** sur `TYPES_PREFERENCE_OPTIONS` mais sur `TYPES_PREFERENCE_OFFERTS` (§5.1) mappé vers ses libellés, pour **exclure `PREFERENCE_TOURNEE`** en `0005`. `LIBELLES_TYPE_PREFERENCE` couvre **tous** les types (y compris `PREFERENCE_TOURNEE`) afin que `decrirePreference` sache décrire une éventuelle donnée importée de ce type sans plantage.

### 5.3 Jours, créneaux & horodatages

- **Jours** : réutilisation de `JOURS_SEMAINE`/`libelleJour` (ISO 1-7). Les `params.joursSemaine` sont des **entiers ISO** ; **aucun** `Date.getDay()`.
- **Créneaux** : réutilisation de `CRENEAUX` (`schema.js`) et `LIBELLES_CRENEAU`.
- **Horodatages** : `createdAt`/`updatedAt` posés via `new Date().toISOString()` dans `creerPreference` (préférence) et dans les actions (personne) — jamais dans les composants.

## 6. Composants

Séparation conforme à [06-structure-du-code.md](../docs/architecture/06-structure-du-code.md) : l'écran routé dans `views/` ; le formulaire spécifique dans `components/equipe/` ; réutilisation des briques transverses de `communs/`.

### 6.1 `src/views/SouhaitsView.vue` (**nouveau**)

Écran routé (Options API). **Orchestre** liste + modales, sans logique métier (délègue au store/domaine).

- **Paramètre de route** : `id` (lu via `this.$route.params.id`).
- **Personne courante** (computed) : `byId(id)`. Si `undefined` → **état « personne introuvable »** : encart aimable (icône `PhUserMinus`) + lien « Retour à l'équipe » (`router-link` vers `{ name: 'equipe' }`). Le reste de l'écran n'est pas rendu.
- **En-tête** : lien de retour « ← Retour à l'équipe » (`router-link`), `<h1>` « Souhaits et contraintes de {prenom} {nom} », et un rappel « Titulaire · 80 % » (réutilise `libelleStatutPersonne`) pour situer la personne.
- **Texte d'explication** (une fois) : encart discret expliquant **Obligatoire** vs **Souhait** en langage clair.
- **Indicateur de sauvegarde** : `IndicateurSauvegarde` alimenté par `statutSauvegarde`/`derniereSauvegarde` + `apres-edition="aEdite"` (passe à `true` après le 1er ajout/édition/suppression/bascule) ; encart `ERREUR_CHARGEMENT` comme `0004`.
- **Action principale** : bouton **« Ajouter un souhait »** (`PhPlus`) ⇒ ouvre `FormulairePreference` en création (`preference = null`).
- **État vide** : si `preferences` est vide → encart accueillant (icône `PhSlidersHorizontal`) + bouton d'ajout.
- **Liste des souhaits** (`preferences`, dans l'ordre de saisie) : une **liste de cartes/lignes** (pas un tableau). Chaque ligne affiche :
  - le **résumé** en une phrase (`decrirePreference(preference)`) en évidence ;
  - un **repère de nature non-coloré** : icône (`PhLock` pour Obligatoire / `PhStar` pour Souhait) **+** mot « Obligatoire » / « Souhait » (jamais la couleur seule) ; pour un souhait, l'**importance** en mots (« Assez important ») via `poidsVersNiveau` + `NIVEAUX_IMPORTANCE` ;
  - le **libellé** libre s'il existe (note de l'utilisateur) ;
  - un **interrupteur « Pris en compte »** (`form-check form-switch` Bootstrap, `label` associé) ⇒ `basculerPreference` ; une ligne « en pause » est **atténuée** (présentation), doublée du texte « En pause » (jamais la seule couleur) ;
  - **actions** : « Modifier » (`PhPencilSimple`) ⇒ `FormulairePreference` en édition ; « Supprimer » (`PhTrash`) ⇒ `DialogueConfirmation` (variante `danger`). Boutons avec **libellé texte**.
- **Modales** : `FormulairePreference` (création/édition, pilotée par `formulaireVisible` + `preferenceEnCours`) et `DialogueConfirmation` (suppression, pilotée par `confirmationVisible` + `preferenceASupprimer`, `variante-confirmer="danger"`, `libelle-confirmer="Supprimer"`). Handlers :
  - `onEnregistrer(champs)` : si `preferenceEnCours` ⇒ `modifierPreference({ personneId: id, preferenceId: preferenceEnCours.id, ...champs })` ; sinon ⇒ `ajouterPreference({ personneId: id, ...champs })`. Puis `aEdite = true`, ferme la modale, `personneEnCours = null`.
  - `onConfirmerSuppression()` : `supprimerPreference({ personneId: id, preferenceId: preferenceASupprimer.id })`, `aEdite = true`, ferme, **replace le focus** sur un point stable (bouton « Ajouter un souhait ») via `$nextTick` (le bouton déclencheur disparaît du DOM — même précaution qu'`EquipeView`).
- **Accès store** : `mapGetters('personnes', ['byId'])`, `mapActions('personnes', ['ajouterPreference', 'modifierPreference', 'supprimerPreference', 'basculerPreference'])`, `mapState(['statutSauvegarde', 'derniereSauvegarde'])`. **Aucune logique métier** : résumés via `decrirePreference`, libellés via `libelles.js`, importance via `poidsVersNiveau`.

### 6.2 `src/components/equipe/FormulairePreference.vue` (**nouveau**)

Formulaire **présentational** d'ajout/édition d'**une** préférence, bâti au-dessus de `ModaleBase` (même patron que `FormulairePersonne`). **N'accède pas au store** : reçoit ses données par props, **émet** le résultat normalisé ; `SouhaitsView` dispatche.

- **Props** : `visible` (Boolean, requis) ; `preference` (Object|null — `null` = création, objet = édition).
- **Événements** : `enregistrer` (payload = champs normalisés : `{ type, nature, poids, params, libelle }`) ; `annuler`.
- **État local** (`data().formulaire`) : brouillon réinitialisé **à chaque ouverture** (`watch: visible`, + `mounted` si déjà visible) depuis `preference` (édition) ou depuis les défauts (création : `type = TYPES_PREFERENCE_OFFERTS[0]`, `nature = natureParDefaut(type)`, `niveau = 'MOYENNE'`, `params` vides selon le type, `libelle = ''`). Ne jamais muter la prop `preference` (recopier `params` et ses tableaux).
- **Titre de la modale** : « Ajouter un souhait » (création) / « Modifier le souhait » (édition).
- **Champs & regroupement** ([08](../docs/architecture/08-principes-ux-ergonomie.md), peu de champs à la fois) :
  1. **Type de souhait** — `form-select` alimenté par `TYPES_PREFERENCE_OFFERTS` → libellés `libelleTypePreference`. `autofocus` à l'ouverture (création). Un **texte d'aide** (`META_TYPES_PREFERENCE[type].aide`) explique le type choisi. Au **changement de type**, réinitialiser proprement `params` (et proposer `natureParDefaut(type)` tant que l'utilisateur n'a pas changé la nature manuellement).
  2. **Détails (params)** — **section dynamique** rendue **selon le type** (v-if), réutilisant deux patrons de saisie déjà éprouvés dans `ParametresView` (0003) :
     - jours → **cases à cocher** `JOURS_SEMAINE` (ordre ISO, libellés en toutes lettres, cible ~44 px) ⇒ `params.joursSemaine` ;
     - créneaux → **cases à cocher** `CRENEAUX`/`LIBELLES_CRENEAU` ⇒ `params.creneaux` ;
     - nombres → `<input type="number" min="1" max="7" step="1">` (`v-model.number`) ⇒ `params.max` / `params.min` / bornes de `NB_JOURS_SEMAINE`.
     Correspondance type → éditeurs : `JOUR_OFF_RECURRENT`/`JOURS_REPOS_SOUHAITES` = jours ; `CRENEAU_OFF` = créneaux (+ jours facultatifs, section « Seulement certains jours ? ») ; `INDISPO_HEBDO` = jours (+ créneaux facultatifs, sinon journée entière) ; `MAX_JOURS_CONSECUTIFS` = un maxi ; `MIN_JOURS_CONSECUTIFS` = un mini ; `NB_JOURS_SEMAINE` = un mini **et/ou** un maxi.
  3. **Nature** — groupe de **boutons radio** (`NATURES_PREFERENCE_OPTIONS`) : « Obligatoire » / « Souhait », chacun avec son aide (« Toujours respecté. » / « Pris en compte si possible. »).
  4. **Importance** — visible **seulement si `nature === 'SOUPLE'`** : `form-select` (ou radios) sur `NIVEAUX_IMPORTANCE` (« Peu important » / « Assez important » / « Très important »), défaut « Assez important ». Masqué (et ignoré) si Obligatoire.
  5. **Note (facultatif)** — `<input type="text">` ⇒ `libelle`, placeholder d'exemple (« ex. à confirmer avec l'intéressée »).
- **Aperçu** (ergonomie) : une phrase vivante « Ce souhait signifie : {decrirePreference(brouillon)} » se met à jour en direct, pour **relire en clair** avant d'enregistrer.
- **Pied de modale** : « Annuler » (`btn btn-outline-secondary`) et **« Enregistrer »** (`btn btn-primary`). À la soumission : `v$.$touch()` ; si `!$invalid`, `$emit('enregistrer', { type, nature, poids: nature==='SOUPLE' ? niveauVersPoids(niveau) : (preference?.poids ?? 5), params, libelle })` ; sinon messages sous les champs + focus au 1er champ erroné, **aucune émission**, saisie conservée.
- **Vuelidate** : voir §7. Pont `setup(){ return { v$: useVuelidate() } }` = seul usage de Composition API (identique à `FormulairePersonne`).
- **Icônes** : `PhWarning` (erreurs, présentation identique à `FormulairePersonne`).

> **Réutilisation des patrons de cases (jours/créneaux)** : gardés **en ligne** dans ce formulaire (KISS), comme `ParametresView` le fait pour le cabinet. L'extraction éventuelle d'un petit composant `ChoixJoursSemaine` réutilisable (0003/0005/0006) est notée en §12 mais **non requise** ici.

### 6.3 `src/views/EquipeView.vue` (**modifier**) — point d'entrée « Souhaits »

Ajouter, sur chaque **personne active** (bloc `equipe-actions` de la liste des actifs uniquement), un bouton **« Souhaits »** en `router-link` stylé bouton :

```
<router-link
  class="btn btn-outline-secondary"
  :to="{ name: 'souhaits', params: { id: personne.id } }"
>
  <PhSlidersHorizontal :size="18" aria-hidden="true" />
  <span>Souhaits</span>
</router-link>
```

- Importer `PhSlidersHorizontal` (Phosphor) et l'enregistrer dans `components`.
- **Uniquement** sur les personnes actives (les archivées n'ont pas ce bouton ; l'écran reste toutefois atteignable par URL directe et gère l'affichage).
- Aucune autre modification (le reste d'`EquipeView` de `0004` est conservé).

### 6.4 `src/router/index.js` (**modifier**) — route paramétrée

Ajouter la route (importer `SouhaitsView`) :

```
{ path: '/equipe/:id/souhaits', name: 'souhaits', component: SouhaitsView },
```

- Placée juste après la route `equipe`. Mode hash conservé ([ADR 0016](../docs/adr/0016-router-mode-hash-pour-pages.md)) : le rafraîchissement direct sur `/#/equipe/<id>/souhaits` fonctionne (le `bootstrap` du store hydrate l'état **avant** le montage, donc `byId(id)` résout après un rechargement).

### 6.5 Réutilisation & style

- `ModaleBase`, `DialogueConfirmation`, `IndicateurSauvegarde`, `libelles.js`, `dateUtil`, tokens/mixins SCSS, intégration Bootstrap, icônes Phosphor : **déjà en place** (`0003`/`0004`), réutilisés tels quels.
- **`_bootstrap.scss` : aucun ajout requis.** Les modules `modal`/`close` (modales) et `forms` (dont `form-check`/`form-switch` pour l'interrupteur « Pris en compte ») sont **déjà importés**. Le repère de nature est en **icône + texte** (pas de `badge`), donc aucun module supplémentaire (KISS).
- Le SCSS `scoped` ne sert qu'au **spécifique** (lignes de souhait, repère de nature, présentation atténuée « en pause », aperçu). Cibles ~44 px (`$cible-cliquable-min`), focus visible, tokens uniquement.
- La directive `v-debounce` n'est **pas** nécessaire (validation explicite au bouton, pas d'auto-persistance à la frappe).

## 7. Règles de validation

Vuelidate ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md), [instructions/formulaires-validation.md](../docs/instructions/formulaires-validation.md)) dans `FormulairePreference`. Règles **dynamiques selon le type** (fonction `validations()` référençant `this.formulaire.type`, comme `FormulairePersonne`). Messages FR **orientés correction**, affichés **après interaction / à la soumission**, jamais sur formulaire vierge.

| Champ / condition | Règle | Message FR (exemple) |
|---|---|---|
| `type` | `required`, ∈ `TYPES_PREFERENCE_OFFERTS` (liste fermée) | (liste fermée : pas de saisie libre) |
| `nature` | `required`, ∈ `NATURES_PREFERENCE` (liste fermée) | (liste fermée) |
| `niveau` (si `nature === 'SOUPLE'`) | ∈ `NIVEAUX_IMPORTANCE` (liste fermée) | (liste fermée) |
| `params.joursSemaine` (types à jours **obligatoires** : `JOUR_OFF_RECURRENT`, `JOURS_REPOS_SOUHAITES`, `INDISPO_HEBDO`) | tableau, **≥ 1** | « Choisissez au moins un jour de la semaine. » |
| `params.creneaux` (type `CRENEAU_OFF`) | tableau, **≥ 1** | « Choisissez au moins un moment de la journée (matin, après-midi ou journée entière). » |
| `params.max` (`MAX_JOURS_CONSECUTIFS`) | `required`, `integer`, `between(1,7)` | « Indiquez un nombre de jours entre 1 et 7. » |
| `params.min` (`MIN_JOURS_CONSECUTIFS`) | `required`, `integer`, `between(1,7)` | « Indiquez un nombre de jours entre 1 et 7. » |
| `params.min` / `params.max` (`NB_JOURS_SEMAINE`) | chacune facultative (`integer`, `between(0,7)`) ; **au moins une** renseignée ; si les deux, `min ≤ max` | « Indiquez au moins un nombre (minimum ou maximum). » ; « Le minimum ne peut pas dépasser le maximum. » |
| `libelle` | facultatif ; `maxLength` (ex. 120) | « La note ne doit pas dépasser 120 caractères. » |

- **Jours/créneaux facultatifs** (`CRENEAU_OFF.joursSemaine`, `INDISPO_HEBDO.creneaux`) : **aucune** règle (vide = « tous les jours » / « journée entière »), expliqué par un texte d'aide.
- **Comportement d'enregistrement** : validation **globale** au clic sur « Enregistrer » ; si invalide, enregistrement **bloqué**, messages sous les champs, **saisie conservée** (zéro perte). « Annuler » / Échap / clic hors fenêtre ferment sans enregistrer.

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie.md](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Langage humain, zéro jargon** : « Souhaits et contraintes », « Ajouter un souhait », « Obligatoire » / « Souhait », « Peu / Assez / Très important », « Pris en compte » / « En pause ». Jamais « préférence dure/souple », « polymorphe », « poids », « params », « type enum ».
- **Dur vs souple expliqué** : encart d'introduction + aides sous les boutons de nature (« Toujours respecté. » / « Pris en compte si possible. »).
- **Poids traduit en mots** : importance à 3 niveaux (« Peu / Assez / Très important »), pas de nombre 1..10 exposé (§12).
- **Aperçu en clair** : la phrase « Ce souhait signifie : … » (via `decrirePreference`) permet de **relire** sa saisie avant d'enregistrer, et de comprendre chaque ligne de la liste sans décoder des codes.
- **Formulaire progressif** : on choisit le **type** d'abord, puis **seuls les champs utiles** s'affichent — jamais tout à la fois.
- **Réversibilité & confirmation** : suppression (destructive, non conservée) précédée d'une **confirmation en langage clair** (bouton rouge `danger`) ; **mise en pause** (`actif`) offerte comme alternative **non destructive** pour exclure temporairement un souhait d'une génération.
- **Jamais l'information par la seule couleur** : nature (icône + mot), état « en pause » (texte + atténuation), erreurs (icône `PhWarning` + libellé).
- **Feedback immédiat** : « Modifications enregistrées » après chaque opération ; erreurs sous le champ, disant **quoi corriger**.
- **Pas de cul-de-sac** : lien de retour vers l'équipe permanent ; état « personne introuvable » avec issue claire.
- **Modale accessible** : focus piégé, fermeture clavier (Échap), retour du focus à l'ouvrant, `autofocus` sur le 1er champ (fournis par `ModaleBase`).
- **Ergonomie physique** : cibles ~44 px (boutons, cases, interrupteur), `label` associé à chaque champ, focus clavier visible, structure `h1 → h2`.
- **Cohérence** : mêmes patrons que `0003`/`0004` (indicateur de sauvegarde, présentation des erreurs, ajout/édition en modale, confirmation destructive).

## 9. Étapes d'implémentation

Découpage en **3 tâches**, chacune destinée à **un sous-agent** (`dev-front`, `model: sonnet`, effort `medium`). Ordre imposé par les dépendances : **T1 → T2 → T3** (domaine + store d'abord ; formulaire ensuite ; écran + route + entrée équipe en dernier).

### Tâche 1 — Domaine (`preferences.js`) + libellés (nature/type) + store (actions préférences)

**Fichiers** :
- `src/domain/preferences.js` (**créer**) — `creerPreference` (+ `normaliserParams` interne), `META_TYPES_PREFERENCE`, `TYPES_PREFERENCE_OFFERTS`, `natureParDefaut`, `NIVEAUX_IMPORTANCE`, `niveauVersPoids`, `poidsVersNiveau`, `decrirePreference` ; JSDoc `@typedef Preference` (§5.1).
- `src/domain/libelles.js` (**modifier**) — `LIBELLES_NATURE_PREFERENCE`, `libelleNaturePreference`, `NATURES_PREFERENCE_OPTIONS`, `LIBELLES_TYPE_PREFERENCE`, `libelleTypePreference`, `TYPES_PREFERENCE_OPTIONS` (§5.2). Conserver l'existant.
- `src/store/modules/personnes.js` (**modifier**) — getter `preferencesDe` ; actions `ajouterPreference`, `modifierPreference`, `supprimerPreference`, `basculerPreference` (§4). Conserver getters/mutations/actions de `0004`.

**Critères de sortie** :
- `creerPreference({ type:'JOUR_OFF_RECURRENT', params:{ joursSemaine:[3] } })` renvoie une préférence **complète** : `id` non vide, `nature === 'SOUPLE'` (défaut du type), `poids === 5`, `actif === true`, `params === { joursSemaine:[3] }`, `libelle === ''`, `createdAt`/`updatedAt` ISO UTC.
- `normaliserParams` **ne garde que** les clés du type : ex. `creerPreference({ type:'MAX_JOURS_CONSECUTIFS', params:{ max:5, joursSemaine:[1] } }).params` vaut `{ max:5 }` (la clé étrangère est ignorée) ; jours triés/dédupliqués/entiers.
- `poidsVersNiveau(8) === 'FORTE'` ; `niveauVersPoids('FAIBLE') === 3` ; `poidsVersNiveau(6)` renvoie le palier le plus proche (`'MOYENNE'`).
- `TYPES_PREFERENCE_OFFERTS` **ne contient pas** `'PREFERENCE_TOURNEE'` et contient les **7** autres.
- `decrirePreference` produit les phrases attendues (§5.1) pour chaque type, y compris `PREFERENCE_TOURNEE` sans planter (donnée importée).
- `libelleNaturePreference('DURE') === 'Obligatoire'` ; `NATURES_PREFERENCE_OPTIONS` a 2 entrées ; `libelleTypePreference('CRENEAU_OFF')` non vide.
- Store : `dispatch('personnes/ajouterPreference', { personneId, type:'JOUR_OFF_RECURRENT', params:{ joursSemaine:[3] } })` ⇒ la personne a 1 préférence et son `updatedAt` est **rafraîchi** ; `modifierPreference` renormalise `params`, préserve `id`/`createdAt` de la préférence, rafraîchit les deux `updatedAt` ; `supprimerPreference` retire la préférence ; `basculerPreference` inverse `actif`. Toutes les recompositions sont **immuables**.
- Aucun import Vue/Vuex dans `preferences.js`/`libelles.js` ; aucun accès `localStorage` ; aucun `Date.getDay()` ni `new Date("YYYY-MM-DD")`.

### Tâche 2 — `FormulairePreference` (formulaire dynamique + validation)

**Fichiers** :
- `src/components/equipe/FormulairePreference.vue` (**créer**) — formulaire présentational au-dessus de `ModaleBase`, props `visible`/`preference`, événements `enregistrer`/`annuler`, section `params` dynamique par type, nature/importance, aperçu `decrirePreference`, Vuelidate (§6.2, §7).

**Dépend de** : T1 (`preferences.js`, `libelles.js`) et `ModaleBase` (existant `0004`).

**Critères de sortie** :
- Mode **création** (`preference=null`) : type par défaut sélectionné, nature = défaut du type, importance « Assez important » (si souple), `params` vides ; `autofocus` sur le type.
- Mode **édition** : tous les champs pré-remplis depuis `preference` (dont `params` recopiés, jamais mutés) ; l'importance reflète `poidsVersNiveau(preference.poids)` ; réouverture réinitialise proprement.
- **Section dynamique** : changer le type bascule les champs affichés (jours / créneaux / nombres) et réinitialise `params` ; l'aide du type s'affiche.
- **Nature** : choisir « Obligatoire » **masque** l'importance ; « Souhait » l'affiche.
- **Validation** : ≥ 1 jour (types à jours obligatoires), ≥ 1 créneau (`CRENEAU_OFF`), nombre 1–7 (max/min consécutifs), au moins une borne + `min ≤ max` (`NB_JOURS_SEMAINE`), note ≤ 120 car. — messages FR sous les champs, affichés après interaction/à la soumission ; enregistrement **bloqué** si invalide, **saisie conservée**.
- **Aperçu** : la phrase « Ce souhait signifie : … » se met à jour en direct et correspond à `decrirePreference` du brouillon.
- Soumission valide ⇒ `enregistrer` avec `{ type, nature, poids, params, libelle }` normalisés (poids = `niveauVersPoids(niveau)` si souple) ; « Annuler »/Échap ⇒ `annuler`, aucune émission.
- Icônes doublées d'un libellé/`aria-label` ; aucune info par la seule couleur ; `label` associé à chaque champ ; `npm run build` réussit.

### Tâche 3 — Écran `SouhaitsView` + route + entrée depuis `EquipeView`

**Fichiers** :
- `src/views/SouhaitsView.vue` (**créer**) — personne courante via `byId(route.id)`, en-tête + retour, explication dur/souple, liste des souhaits (résumé, nature, importance, interrupteur « Pris en compte », Modifier/Supprimer), état vide, état « personne introuvable », orchestration des modales, `IndicateurSauvegarde` (§6.1, §8).
- `src/router/index.js` (**modifier**) — route paramétrée `{ path:'/equipe/:id/souhaits', name:'souhaits', component: SouhaitsView }` (§6.4).
- `src/views/EquipeView.vue` (**modifier**) — bouton « Souhaits » (`router-link`, `PhSlidersHorizontal`) sur chaque personne **active** (§6.3).

**Dépend de** : T1 (store/getters/domaine), T2 (`FormulairePreference`), briques `DialogueConfirmation`/`IndicateurSauvegarde` (existant `0004`).

**Critères de sortie** :
- Depuis `/equipe`, « Souhaits » sur une personne active ouvre `/#/equipe/<id>/souhaits` (titre « Souhaits et contraintes de {Prénom} {Nom} »).
- **État vide** accueillant tant qu'aucun souhait ; **URL inconnue** ⇒ état « personne introuvable » + retour équipe.
- **Ajouter** un souhait de chaque type le crée et l'affiche **résumé en clair** ; l'indicateur passe à « Modifications enregistrées » ; **recharger la page** conserve le souhait.
- **Modifier** met à jour le souhait (y compris changement de type) et rafraîchit les `updatedAt` (préférence + personne).
- **Supprimer** ouvre la **confirmation** (bouton rouge) ; après confirmation le souhait disparaît et n'est **pas** conservé.
- **Pris en compte** : l'interrupteur bascule `actif` ; la ligne « en pause » est atténuée **et** marquée par un texte.
- Repère de nature (icône + mot), importance en mots, aucune info par la seule couleur ; focus visible ; modale fermable au clavier ; navigation clavier possible.
- Aucun accès `localStorage`, aucun objet `Date` hors `dateUtil`, aucune logique métier dans les composants ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] Depuis `/equipe`, chaque personne **active** a un bouton **« Souhaits »** qui ouvre `/equipe/:id/souhaits`.
- [ ] L'écran est titré « Souhaits et contraintes de {Prénom} {Nom} », avec un **retour** vers l'équipe et une **explication** dur/souple.
- [ ] **État vide** accueillant tant qu'aucun souhait ; **URL avec identifiant inconnu** ⇒ état « personne introuvable » avec issue.
- [ ] **Ajouter** un souhait (les **7 types offerts**) l'enregistre et l'affiche **résumé en français** ; l'indicateur montre « Modifications enregistrées ».
- [ ] Le formulaire affiche **seulement les champs pertinents** au type choisi ; l'aperçu « Ce souhait signifie… » reflète la saisie.
- [ ] **Obligatoire / Souhait** est choisissable ; l'**importance** (Peu / Assez / Très important) n'apparaît **que** pour un Souhait ; aucun nombre de poids brut n'est exposé.
- [ ] **Recharger la page** (y compris directement sur l'URL des souhaits) restitue les souhaits (persistance + hydratation).
- [ ] **Modifier** met à jour le souhait (dont le type) et rafraîchit `updatedAt` de la préférence **et** de la personne ; `id`/`createdAt` de la préférence préservés.
- [ ] **Supprimer** (après confirmation, bouton rouge) retire définitivement le souhait ; **mettre en pause** (interrupteur) bascule `actif` sans supprimer.
- [ ] Validation : ≥ 1 jour / ≥ 1 créneau selon le type ; nombres 1–7 ; `NB_JOURS_SEMAINE` = au moins une borne et `min ≤ max` ; note ≤ 120. Messages FR de correction, saisie jamais perdue.
- [ ] Aucune information par la **seule couleur** (nature, « en pause », erreurs doublées d'icône + texte) ; `label` sur chaque champ ; **modale** fermable au clavier, focus piégé et rendu à l'ouvrant ; focus visible.
- [ ] Aucun accès direct à `localStorage` ; aucun objet `Date` hors `dateUtil` ; aucune logique métier dans les composants.
- [ ] `npm run build` réussit.

## 11. Vérification

Parcours manuel (`npm run dev`) :

1. **Pré-requis** — Avoir au moins une personne active (sinon en créer une via `/equipe`, feature `0004`).
2. **Accès** — Sur `/equipe`, cliquer « Souhaits » d'une personne : l'écran s'ouvre, titré à son nom, avec l'explication dur/souple et l'état vide accueillant.
3. **Ajout — jour off** — « Ajouter un souhait », type « Jour non travaillé (chaque semaine) », cocher « Mercredi », nature « Obligatoire », enregistrer : la ligne affiche « Ne travaille pas le mercredi » + repère « Obligatoire ». Indicateur « Modifications enregistrées ». **Recharger** (URL directe) → conservé.
4. **Ajout — repos souhaités** — Type « Jours de repos souhaités », cocher Samedi + Dimanche, nature « Souhait », importance « Très important » : ligne « Souhaite être en repos le samedi et le dimanche » + « Souhait · Très important ».
5. **Ajout — créneau off / indispo** — Type « Demi-journée non travaillée » : cocher « Après-midi » → « Ne travaille pas l'après-midi ». Type « Indisponibilité chaque semaine » : Mardi + « Matin » → « Indisponible le mardi matin ».
6. **Ajout — nombres** — « Maximum de jours d'affilée » = 5 → « Pas plus de 5 jours d'affilée ». « Nombre de jours par semaine » min 3 / max 4 → « Entre 3 et 4 jours par semaine ». Tenter `min > max` → message « Le minimum ne peut pas dépasser le maximum. », enregistrement bloqué, saisie conservée. Laisser les deux vides → « Indiquez au moins un nombre… ».
7. **Validation jours/créneaux** — Type à jours sans cocher de jour, ou `CRENEAU_OFF` sans créneau, puis « Enregistrer » → message de correction, rien n'est ajouté.
8. **Modification** — « Modifier » un souhait : formulaire pré-rempli (dont importance calculée), changer le type → les champs changent et `params` se réinitialise ; enregistrer → le résumé se met à jour ; recharger → conservé.
9. **Mise en pause / suppression** — Basculer « Pris en compte » : la ligne s'atténue et affiche « En pause ». « Supprimer » : la confirmation (rouge) explique que le souhait ne sera pas conservé ; confirmer → il disparaît ; `localStorage` : `personnes[i].preferences` ne le contient plus.
10. **Personne introuvable** — Ouvrir `/#/equipe/xxxx-inconnu/souhaits` → encart « personne introuvable » + retour équipe.
11. **Accessibilité / clavier** — Ouvrir la modale, `Tab` (focus piégé), Échap (retour focus au bouton d'ouverture). Cases/interrupteur actionnables au clavier ; libellés présents ; focus visible.
12. **Persistance croisée** — `JSON.parse(localStorage.getItem('idelia:data')).personnes[i].preferences` contient les objets attendus (`type`, `nature`, `poids`, `actif`, `params` normalisé, `libelle`, horodatages) ; la personne a un `updatedAt` cohérent.
13. **Build** — `npm run build` réussit sans erreur.

## 12. Décisions à confirmer / risques

1. **Route dédiée (retenu) + formulaire en modale** — **Retenu** : une **vue routée** `/equipe/:id/souhaits` (conforme à [07](../docs/architecture/07-navigation-et-ecrans.md) et à l'annonce de `0004`), car les souhaits sont un **contexte par personne** atteint par navigation (trop riche pour une simple modale sur `/equipe`) ; le **formulaire d'un souhait**, lui, reste **en modale** (réutilise `ModaleBase`, cohérent avec `FormulairePersonne`). C'est la **première route paramétrée** : point de vigilance = rechargement direct sur l'URL (OK car `bootstrap` hydrate avant montage) et identifiant inconnu (géré par l'état « personne introuvable »). **À confirmer**.
2. **Structure polymorphe de `Preference`** — **Confirmée** dans `schema.js` (`NATURES_PREFERENCE=['DURE','SOUPLE']`, `TYPES_PREFERENCE`=8 codes, `CRENEAUX`) et [02 §Preference](../docs/architecture/02-modele-de-domaine.md) : `{ id, type, nature, poids(1..10, défaut 5, souple only), actif(défaut true), params(selon type), libelle?, createdAt, updatedAt }`. `params` par type : jours (`JOUR_OFF_RECURRENT`, `JOURS_REPOS_SOUHAITES`), créneaux+jours? (`CRENEAU_OFF`), jours+créneaux? (`INDISPO_HEBDO`), `max` (`MAX_JOURS_CONSECUTIFS`), `min` (`MIN_JOURS_CONSECUTIFS`), `min?`/`max?` (`NB_JOURS_SEMAINE`), `tourneeIds`/`sens` (`PREFERENCE_TOURNEE`). **Aucune migration** (aucun nouveau champ). **À confirmer** : les libellés FR proposés (§5.2) et les phrases de `decrirePreference` (§5.1).
3. **`PREFERENCE_TOURNEE` différé à `0006`** — `0005` ne dépend que de `0004` ; les tournées (module `tournees`, getters/CRUD/libellés) arrivent en `0006`. Ce type **référence des `tourneeIds`** : le proposer sans tournées serait vide et source d'incohérence référentielle. **Retenu** : l'**exclure du sélecteur** en `0005` (`TYPES_PREFERENCE_OFFERTS`), tout en gardant le domaine **structurellement prêt** (schéma inchangé, `decrirePreference`/`creerPreference` gèrent le type). `0006` l'ajoutera (option de type + sélecteur de tournées + contrôle d'intégrité des `tourneeIds` à l'import). **À confirmer**.
4. **Emplacement du domaine : `src/domain/preferences.js` (nouveau)** — **Retenu** plutôt que d'alourdir `personnes.js` : la logique polymorphe (fabrique + normalisation par type + métadonnées + description + échelle d'importance) est cohésive et distincte de la `Personne` ; même esprit que `cabinet.js` en `0003`. `personnes.js` reste inchangé. **À confirmer**.
5. **Poids : 3 niveaux humains (retenu) vs échelle brute 1..10** — **Retenu** : exposer « Peu / Assez / Très important » mappés sur `poids` 3 / 5 / 8 ; le schéma reste `integer 1..10` (donc compatible). `poidsVersNiveau` rapproche toute valeur importée du palier le plus proche. Perd la granularité fine 1..10, jugée inutile et jargonneuse pour le public cible et suffisante pour le moteur (`0009`). **À confirmer** : accepter 3 paliers (sinon prévoir un curseur 1..10 avec libellés).
6. **Mise en pause (`actif`) — interrupteur inclus** — Le champ `actif` existe et doit être initialisé ; un interrupteur « Pris en compte » offre une alternative **non destructive** à la suppression (exclure un souhait d'une génération sans le perdre), à coût quasi nul (réutilise `UPDATE` + `form-switch`). **À confirmer** : garder cet interrupteur ou différer (souhait toujours `actif`).
7. **Suppression physique (retenu) vs soft-delete** — Contrairement à `Personne`/`Tournee` (protégées par soft-delete car **référencées** par l'historique), une `Preference` est un **objet-valeur imbriqué non référencé** (« suppression en cascade », [02 §Agrégats](../docs/architecture/02-modele-de-domaine.md)) : la **suppression physique** est légitime, protégée par une **confirmation** (geste irréversible). **À confirmer**.
8. **Validation des `params` au formulaire (Vuelidate) vs domaine** — **Retenu** : règles de saisie (≥ 1 jour, `min ≤ max`, bornes 1–7) dans le **formulaire** (Vuelidate, dérivées de `META_TYPES_PREFERENCE`), comme la cohérence de dates de `0004` ; le **domaine** garantit la **normalisation structurelle** (`normaliserParams`) et la **description**. Évite la duplication d'un `validerPreference`. **À confirmer** : suffisant pour `0005` (le moteur `0009` ajoutera l'évaluation métier).
9. **Éditeurs jours/créneaux en ligne (retenu) vs composant extrait** — Les cases « jours » (4 types) et « créneaux » (2 types) sont gardées **en ligne** dans le formulaire (KISS, comme `ParametresView`). Extraction possible d'un `ChoixJoursSemaine` réutilisable (0003/0005/0006) si la duplication devient gênante — **différée**, à acter avec le mainteneur.
10. **Point de vigilance — réinitialisation de `params` au changement de type** : bien vider/rebâtir `params` (et proposer `natureParDefaut`) quand l'utilisateur change de type en cours d'édition, sinon des clés d'un ancien type pourraient subsister dans le brouillon (le domaine les filtre à l'enregistrement via `normaliserParams`, mais l'aperçu et la validation doivent rester cohérents à l'écran).
