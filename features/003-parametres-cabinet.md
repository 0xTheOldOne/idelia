# Feature 003 — Paramètres cabinet

- **Statut** : Fait
- **Dépend de** : `001` (bootstrap, layout, tokens/Bootstrap, Phosphor), `002` (store persisté, module `cabinet`, `schema.js`, plugin de persistance débouncé)
- **ADR liés** : [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Options API + Vuex), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière repository), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7 + dates/heures), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate + vue-debounce), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + Bootstrap thémé par tokens), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor).

## 1. Contexte & objectif

C'est le **premier écran réel** de l'application. À l'issue de `002`, l'état du cabinet existe (valeurs par défaut, persistance automatique) mais **aucun écran ne le montre ni ne le laisse modifier** : `ParametresView.vue` est un simple placeholder.

La feature `003` rend l'écran **Paramètres** opérationnel pour le référent (public **peu à l'aise avec l'informatique**) : **consulter et modifier** les réglages globaux du cabinet — nom, jours d'ouverture, créneaux de travail, repos hebdomadaire minimum, jours consécutifs maximum, premier jour de la semaine. Chaque modification valide est **enregistrée automatiquement** (persistance débouncée déjà en place), avec un **retour visuel clair** (« Modifications enregistrées »). Ces réglages serviront de socle aux features suivantes (équipe, tournées, absences, moteur de planification).

**Hors périmètre `003`** (à ne pas implémenter ici) :

- `couleursParDefaut` (palette de suggestion) — **différé** : sans écran qui l'exploite (personnes/tournées, features `004`/`006`), l'éditer maintenant n'apporte rien. Le champ est **préservé** tel quel par la mise à jour (voir §4).
- **Export / import / réinitialisation** de la sauvegarde — c'est la feature `008` (même écran, mais bloc séparé).
- La saisie de personnes, tournées, absences — features `004`-`007`.

## 2. Écrans concernés

Une seule route, déjà déclarée en `001` ([07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md)) :

| Route | Écran | Changement `003` |
|---|---|---|
| `/parametres` | **Paramètres** | Remplace le placeholder par le **formulaire de réglages du cabinet**. |

**Expérience visée** (utilisateur non-technique) :

- Un titre d'écran explicite (« Paramètres du cabinet ») ; l'utilisateur sait où il est.
- Les réglages sont **regroupés en sections courtes et nommées** (« Identité », « Jours d'ouverture », « Créneaux de travail », « Rythme de travail », « Affichage »), avec **peu de champs visibles à la fois**.
- **Gros contrôles** : cases à cocher pour les jours et les créneaux, libellés **en toutes lettres** en français.
- **Aucun bouton « Enregistrer » n'est nécessaire** : dès qu'un réglage valide change, il est sauvegardé et un **indicateur discret** confirme « Modifications enregistrées ». (Choix assumé, cohérent avec la persistance automatique du store — voir §12.)
- Une **erreur de saisie** est signalée sous le champ concerné, en langage clair, en disant **quoi corriger** ; la saisie n'est jamais perdue et le dernier réglage **valide** reste enregistré.

## 3. Modèle de données touché

Entité **`ParametresCabinet`** (singleton), déjà entièrement définie et présente dans l'état par défaut ([02-modele-de-domaine.md §ParametresCabinet](../docs/architecture/02-modele-de-domaine.md)). **Aucune nouvelle structure, aucun nouveau champ.**

Champs **édités** par `003` :

| champ | type | contrainte affichée / validée | libellé UI (FR) |
|---|---|---|---|
| `nomCabinet` | string | optionnel, longueur raisonnable | « Nom du cabinet » |
| `joursOuverture` | number[1..7] (ISO) | au moins 1 jour | « Jours d'ouverture » |
| `creneauxActifs` | Creneau[] | au moins 1 créneau | « Créneaux de travail » |
| `reposHebdoMin` | integer | 0 à 7 | « Jours de repos par semaine (minimum) » |
| `maxJoursConsecutifs` | integer | 1 à 7 | « Jours de travail consécutifs (maximum) » |
| `premierJourSemaine` | number 1..7 | une valeur 1..7 | « Premier jour de la semaine (affichage) » |

Champs **préservés, non édités** : `couleursParDefaut` (hors périmètre), `updatedAt` (mis à jour automatiquement à chaque modification — voir §4).

**Impact `schemaVersion` / migrations** : **aucun**. La structure est inchangée, `CURRENT_SCHEMA_VERSION` reste `1`, aucune migration n'est ajoutée.

## 4. Store (Vuex)

Module `cabinet` ([04-gestion-etat-vuex.md](../docs/architecture/04-gestion-etat-vuex.md), [instructions/etat-vuex.md](../docs/instructions/etat-vuex.md)). Après `002` il expose : `state {parametres:null}` (hydraté au `bootstrap`), getter `parametres`, mutation `REPLACE`. Il **n'a pas encore d'action de modification**.

### 4.1 Ajout : action `majParametres`

`003` ajoute **une seule action** au module `cabinet`, sans nouvelle mutation (on réutilise `REPLACE`) :

- **`majParametres({ commit, getters }, patch)`** :
  - construit les nouveaux paramètres par **fusion immuable** du patch sur les paramètres courants : `{ ...getters.parametres, ...patch, updatedAt: <ISO UTC courant> }` ;
  - **met à jour `updatedAt`** via `new Date().toISOString()` ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) : horodatage technique ISO UTC) ;
  - `commit('REPLACE', nouveauxParametres)`.
  - `patch` est un objet **partiel** (ex. `{ joursOuverture: [1,2,3,4,5] }`, `{ nomCabinet: 'Cabinet des Tilleuls' }`), ce qui permet de sauvegarder **champ par champ** depuis l'écran et **préserve** automatiquement les champs non touchés (dont `couleursParDefaut`).

> L'action reste **fine** : la seule « logique » est la fusion + l'horodatage. Toute règle métier (cohérence des réglages) vit dans le **domaine** (§5.2), jamais dans le store ni le composant (règle d'or #10).

### 4.2 Persistance (déjà en place, rien à ajouter)

La sauvegarde est **automatique** : chaque `commit('cabinet/REPLACE', …)` déclenche le **plugin de persistance débouncé (~400 ms)** de `src/store/index.js`, qui sérialise via `toSaveDocument` et écrit via `storageRepository.save`. **Ne rien réimplémenter** ici, **aucun accès `localStorage`** dans le module ou le composant ([ADR 0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md)).

### 4.3 État racine consommé en lecture seule

L'écran **lit** (sans jamais les muter) l'état racine de sauvegarde posé en `002` pour le retour visuel :

- `state.statutSauvegarde` (`INACTIF | EN_COURS | ENREGISTRE | ERREUR | ERREUR_CHARGEMENT`) ;
- `state.derniereSauvegarde` (ISO UTC de la dernière écriture réussie, ou `null`).

## 5. Domaine (logique pure)

Tout dans `src/domain/`, **sans import Vue/Vuex ni `localStorage`** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)). Ces modules sont **réutilisables** par les features suivantes (équipe, tournées, absences, planning) qui afficheront elles aussi jours et créneaux.

### 5.1 `src/domain/libelles.js` (**nouveau**) — tables de correspondance code → libellé FR

Conforme à la règle « les libellés affichés passent par une table de correspondance, prête pour l'i18n » ([02 §Conventions](../docs/architecture/02-modele-de-domaine.md), [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)). Les **codes** (`CRENEAUX`, jours ISO) restent définis dans `schema.js` / `dateUtil` ; ce module ne porte **que l'affichage**.

| Export | Forme | Rôle |
|---|---|---|
| `JOURS_SEMAINE` | `[{ iso: 1, libelle: 'Lundi' }, … { iso: 7, libelle: 'Dimanche' }]` | Liste ordonnée ISO, prête à itérer pour les cases à cocher. |
| `libelleJour(iso)` | `(number) → string` | `1 → 'Lundi'`, `7 → 'Dimanche'`. |
| `LIBELLES_CRENEAU` | `{ MATIN: 'Matin', APRES_MIDI: 'Après-midi', JOURNEE: 'Journée entière' }` | Table code → libellé. |
| `libelleCreneau(code)` | `(string) → string` | `'APRES_MIDI' → 'Après-midi'`. |

> **Jours en ISO 1-7 uniquement** ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)) : la table associe **directement** l'entier ISO à son nom ; **aucun** appel à `Date.getDay()`. « Journée entière » (plutôt que « Journée ») clarifie la distinction avec Matin/Après-midi pour un public non-technique.

### 5.2 `src/domain/cabinet.js` (**nouveau**) — cohérence des paramètres (pure)

- **`coherenceParametres(parametres)`** → `{ avertissements: string[] }` : renvoie des **avertissements non bloquants** en français, prêts à afficher. Règle KISS retenue : si `reposHebdoMin + maxJoursConsecutifs > 7`, signaler l'incohérence, ex. :
  > « Avec au moins {reposHebdoMin} jour(s) de repos par semaine, on ne peut pas enchaîner plus de {7 − reposHebdoMin} jour(s) de travail. Or vous autorisez {maxJoursConsecutifs} jour(s) consécutifs. »
  Fonction **pure et testable** ; extensible plus tard (autres cohérences) sans toucher au composant. **Ne bloque jamais** l'enregistrement (c'est un conseil, pas une erreur de saisie).

### 5.3 `src/domain/utils/dates.js` (modif **optionnelle**) — horodatage lisible

Si l'on affiche l'horodatage de dernière sauvegarde (§6), ajouter un helper **dans `dateUtil`** (seul endroit autorisé à toucher l'objet `Date`, [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)) :

- **`formatHorodatageFr(iso)`** → `(string) → string` : convertit un horodatage **ISO UTC complet** (ex. `derniereSauvegarde`) en texte FR lisible (ex. « 7 juillet 2026 à 14:32 ») via `toLocaleString('fr-FR', …)`. À défaut de ce helper, se contenter du texte « Modifications enregistrées » sans date (voir §12).

> Rappel : le composant **n'appelle jamais** `Date` directement ; il passe par ce helper.

## 6. Composants

### 6.1 `src/views/ParametresView.vue` (**réécriture** complète du placeholder)

Écran routé (Options API, [instructions/composants-vue.md](../docs/instructions/composants-vue.md)). Responsabilités :

- **Titre** `<h1>` « Paramètres du cabinet » (structure de titres cohérente).
- **Brouillon local** (`data().brouillon`) initialisé au montage depuis le getter `cabinet/parametres` (`created()`/`mounted()` — le `bootstrap` est terminé avant le montage, cf. `main.js`). Le brouillon est la **source de saisie** ; il n'écrit dans le store que **si le champ est valide** (voir §7).
- **Sections** (Bootstrap : `card`/`fieldset`, grille, `form-*`, utilitaires d'espacement — [ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md)) :
  1. **Identité** — `nomCabinet` : `<input type="text">` avec `label`, placeholder d'exemple (ex. « Cabinet des Tilleuls »), **débouncé** (vue-debounce, §7) pour ne pas dispatcher à chaque frappe.
  2. **Jours d'ouverture** — 7 **cases à cocher** (`JOURS_SEMAINE`, ordre ISO Lundi→Dimanche), `v-model` sur `brouillon.joursOuverture` (valeurs = entiers ISO), libellés **en toutes lettres**.
  3. **Créneaux de travail** — cases à cocher `MATIN` / `APRES_MIDI` / `JOURNEE` via `LIBELLES_CRENEAU`, `v-model` sur `brouillon.creneauxActifs`.
  4. **Rythme de travail** — `reposHebdoMin` et `maxJoursConsecutifs` : `<input type="number" min max step="1">` avec `label` + texte d'aide, plus l'**avertissement de cohérence** (`coherenceParametres`, non bloquant, `alert alert-warning` doublé d'une icône).
  5. **Affichage** — `premierJourSemaine` : `form-select` (ou groupe de boutons radio) listant les 7 jours (`JOURS_SEMAINE`), avec texte d'aide « utilisé pour l'affichage du calendrier ».
- **Enregistrement automatique** : à chaque changement **valide** d'un champ, `dispatch('cabinet/majParametres', patchDuChamp)`. Si le champ devient invalide (ex. 0 jour coché), **ne pas dispatcher** : afficher l'erreur, garder le brouillon (dernier réglage **valide** conservé dans le store — zéro perte).
- **Indicateur de sauvegarde** : instance de `IndicateurSauvegarde` (§6.2) alimentée par `statutSauvegarde` / `derniereSauvegarde` (root state via `mapState`).
- **Accès store** : `mapGetters('cabinet', ['parametres'])`, `mapActions('cabinet', ['majParametres'])`, `mapState` racine pour le statut. **Aucune logique métier** dans le composant : les libellés viennent de `libelles.js`, la cohérence de `cabinet.js`.

### 6.2 `src/components/communs/IndicateurSauvegarde.vue` (**nouveau**, réutilisable)

Petit composant **présentational** (props, aucun accès store) — réutilisable ensuite sur l'Accueil (`013`) et les autres écrans :

- **Props** : `statut` (String), `derniereSauvegarde` (String|null).
- **Rendu** selon `statut` :
  - `ENREGISTRE` → icône Phosphor `PhCheckCircle` + « Modifications enregistrées » (+ « le {date} à {heure} » si `derniereSauvegarde` et helper dispo).
  - `ERREUR` → icône `PhWarning` + « L'enregistrement a échoué. Vos données restent dans cette fenêtre ; réessayez ou exportez une sauvegarde. »
  - autres (`INACTIF` / `EN_COURS` / `ERREUR_CHARGEMENT`) → état neutre discret (ex. « Enregistrement… » ou rien).
- **Accessibilité** : information **jamais portée par la seule couleur** (icône **+** libellé texte systématiques) ; zone en `aria-live="polite"` pour annoncer le changement de statut ; icône `aria-hidden` car doublée du texte.

### 6.3 `src/main.js` (modif) — directive de débounce

Enregistrer **globalement** la directive `vue-debounce` ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md)) si elle ne l'est pas encore, afin d'en disposer sur le champ `nomCabinet` (`v-debounce`). Ne rien changer d'autre au démarrage.

> Réutilisation : `App.vue` (barre de nav), tokens SCSS et intégration Bootstrap sont déjà en place (`001`) ; icônes Phosphor déjà utilisées dans `App.vue`. Le SCSS `scoped` de la vue ne sert qu'au **spécifique** (espacement des sections, mise en forme des groupes de cases) — utiliser les classes Bootstrap pour tout le reste.

## 7. Règles de validation

Vuelidate ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md), [instructions/formulaires-validation.md](../docs/instructions/formulaires-validation.md)). Règles déclaratives, **messages FR orientés correction**, affichés **après interaction** sur le champ (pas sur un formulaire vierge) :

| Champ | Règle | Message FR (exemple) |
|---|---|---|
| `nomCabinet` | optionnel ; `maxLength` (ex. 80) | « Le nom du cabinet ne doit pas dépasser 80 caractères. » |
| `joursOuverture` | tableau, **≥ 1** élément | « Cochez au moins un jour d'ouverture. » |
| `creneauxActifs` | tableau, **≥ 1** élément | « Cochez au moins un créneau de travail. » |
| `reposHebdoMin` | entier, `between(0, 7)` | « Indiquez un nombre de jours de repos entre 0 et 7. » |
| `maxJoursConsecutifs` | entier, `between(1, 7)` | « Indiquez un maximum de jours consécutifs entre 1 et 7. » |
| `premierJourSemaine` | valeur ∈ 1..7 | (contrainte structurelle : liste fermée, pas de saisie libre) |

**Cohérence (non bloquante)** : l'avertissement de `coherenceParametres` (§5.2) est **distinct** d'une erreur de validation — c'est un conseil (`alert-warning` + icône), il **n'empêche pas** l'enregistrement.

**Comportement d'enregistrement lié à la validation** : un champ n'est **poussé dans le store que s'il est valide**. Un champ invalide affiche son message, conserve la saisie dans le brouillon, et **laisse intact** le dernier réglage valide persisté (tolérance à l'erreur, zéro perte — [08](../docs/architecture/08-principes-ux-ergonomie.md)).

**Débounce** : `nomCabinet` utilise `vue-debounce` (~500 ms) avant de dispatcher, en synergie avec la persistance débouncée du store (~400 ms) — on n'écrit pas à chaque frappe.

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie.md](../docs/architecture/08-principes-ux-ergonomie.md), [checklist accessibilité](../docs/instructions/accessibilite-ergonomie.md)) :

- **Langage humain, zéro jargon** : « Jours d'ouverture », « Créneaux de travail », « Jours de repos par semaine (minimum) ». Pas de « enum », « champ invalide », « commit ».
- **Jours en toutes lettres** (Lundi…Dimanche) ; **créneaux** explicites (Matin / Après-midi / Journée entière).
- **Gros contrôles** cliquables (~44 px, cases + libellé cliquable) et **bien espacés** ; le `label` entier est cliquable.
- **Retour immédiat** : indicateur « Modifications enregistrées » ; erreurs sous le champ disant **quoi corriger**.
- **Tolérance à l'erreur** : jamais de perte de saisie ; le dernier réglage valide reste enregistré même si un champ est momentanément invalide.
- **Jamais l'information par la seule couleur** : succès/erreur/avertissement toujours **doublés d'une icône Phosphor + libellé** ([ADR 0013](../docs/adr/0013-icones-phosphor.md)).
- **Focus clavier visible**, navigation au clavier possible, `label` associé à chaque champ, structure de titres `h1 → h2` par section.
- **Cohérence** : mêmes patterns que le reste de l'app (icône = action, libellés stables) ; l'indicateur de sauvegarde est un composant réutilisable pour rester identique partout.
- **Valeurs par défaut raisonnables** déjà en place (jours 1-6, Matin + Après-midi, repos 2, max 6) : l'écran est immédiatement cohérent sans rien saisir.

## 9. Étapes d'implémentation

Découpage en **2 tâches**, chacune destinée à **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre : **T1 puis T2** (T2 consomme les modules de T1).

### Tâche 1 — Domaine (libellés + cohérence) & action store `cabinet/majParametres`

**Fichiers** :
- `src/domain/libelles.js` (**créer**) — `JOURS_SEMAINE`, `libelleJour`, `LIBELLES_CRENEAU`, `libelleCreneau` (§5.1). Purs, JSDoc.
- `src/domain/cabinet.js` (**créer**) — `coherenceParametres(parametres)` (§5.2). Pur, JSDoc.
- `src/domain/utils/dates.js` (**modifier**, optionnel) — `formatHorodatageFr(iso)` dans `dateUtil` (§5.3).
- `src/store/modules/cabinet.js` (**modifier**) — action `majParametres` (§4.1), sans nouvelle mutation.

**Critères de sortie** :
- `libelleJour(1) === 'Lundi'`, `libelleJour(7) === 'Dimanche'` ; `libelleCreneau('APRES_MIDI') === 'Après-midi'` ; `JOURS_SEMAINE` a 7 entrées en ordre ISO.
- `coherenceParametres({ reposHebdoMin: 3, maxJoursConsecutifs: 6, … })` renvoie **au moins un avertissement** ; `{ reposHebdoMin: 2, maxJoursConsecutifs: 5 }` en renvoie **zéro**.
- `store.dispatch('cabinet/majParametres', { nomCabinet: 'X' })` → `getters['cabinet/parametres']` a `nomCabinet: 'X'`, un `updatedAt` **rafraîchi** (ISO UTC), et **tous les autres champs préservés** (dont `couleursParDefaut`).
- Aucun import Vue/Vuex dans `libelles.js` / `cabinet.js` ; aucun accès `localStorage` ; aucun `Date.getDay()` ni `new Date("YYYY-MM-DD")`.

### Tâche 2 — Écran `ParametresView.vue` + `IndicateurSauvegarde.vue` + directive debounce

**Fichiers** :
- `src/components/communs/IndicateurSauvegarde.vue` (**créer**) — présentational, props `statut`/`derniereSauvegarde` (§6.2).
- `src/views/ParametresView.vue` (**réécrire**) — formulaire, sections, Vuelidate, débounce, enregistrement auto par champ valide, avertissement de cohérence, indicateur (§6.1, §7, §8).
- `src/main.js` (**modifier**) — enregistrement global de la directive `vue-debounce` (§6.3).

**Critères de sortie** :
- L'écran affiche toutes les sections avec libellés FR ; jours en toutes lettres ; créneaux FR ; contrôles ~44 px, `label` cliquable, focus visible.
- Modifier un champ **valide** enregistre automatiquement ; l'indicateur passe à « Modifications enregistrées » ; **recharger la page conserve** la valeur.
- Décocher tous les jours (ou tous les créneaux), ou saisir un nombre hors bornes → **message FR de correction** sous le champ ; **rien n'est persisté** (le dernier réglage valide subsiste).
- L'avertissement de cohérence apparaît/disparaît selon `reposHebdoMin`/`maxJoursConsecutifs`, **sans bloquer** la saisie.
- Icônes toujours accompagnées d'un libellé/`aria-label` ; aucune info par la seule couleur.
- `npm run build` **réussit** sans erreur.

## 10. Critères d'acceptation

- [ ] La route `/parametres` affiche un formulaire titré « Paramètres du cabinet » (fini le placeholder).
- [ ] Les 6 réglages (`nomCabinet`, `joursOuverture`, `creneauxActifs`, `reposHebdoMin`, `maxJoursConsecutifs`, `premierJourSemaine`) sont affichés avec leurs **valeurs courantes** (par défaut au premier lancement) et **libellés FR** ; jours en toutes lettres.
- [ ] Modifier un champ **valide** déclenche `cabinet/majParametres` → `updatedAt` rafraîchi → **persistance automatique** ; l'indicateur affiche « Modifications enregistrées ».
- [ ] **Recharger la page** restitue les réglages modifiés (persistance effective, via `bootstrap`).
- [ ] `joursOuverture` vide et `creneauxActifs` vide sont **refusés** (message FR) et **non persistés** ; `reposHebdoMin` hors 0..7 et `maxJoursConsecutifs` hors 1..7 sont **refusés** (message FR).
- [ ] Un couple `reposHebdoMin`/`maxJoursConsecutifs` incohérent affiche un **avertissement non bloquant** (l'enregistrement reste possible).
- [ ] `couleursParDefaut` est **préservé** après plusieurs modifications (jamais écrasé/supprimé).
- [ ] Aucune information n'est portée par la **seule couleur** ; chaque icône a un libellé ou `aria-label` ; le **focus clavier** est visible ; les champs ont un `label` associé.
- [ ] Aucun accès direct à `localStorage`, aucun objet `Date` manipulé hors `dateUtil`, aucun `Date.getDay()` (jours en ISO 1-7).
- [ ] `npm run build` réussit.

## 11. Vérification

Parcours manuel (`npm run dev`, ouvrir `/parametres`) :

1. **Affichage initial** — Au premier lancement (`localStorage` vide, sinon `localStorage.clear()` + recharger) : les jours **Lundi→Samedi** sont cochés, **Matin** et **Après-midi** cochés, repos **2**, max **6**, premier jour **Lundi**, nom vide. L'indicateur montre rapidement « Modifications enregistrées » (le `bootstrap` a persisté l'état par défaut).
2. **Nom du cabinet** — Taper « Cabinet des Tilleuls » : aucun enregistrement pendant la frappe, puis ~0,5 s après l'arrêt de frappe, l'indicateur repasse à « Modifications enregistrées ». **Recharger** → le nom est conservé.
3. **Jours d'ouverture** — Décocher « Samedi », cocher « Dimanche » : enregistrement immédiat. Décocher **tous** les jours → message « Cochez au moins un jour d'ouverture. », **rien n'est persisté**. Recocher un jour → le message disparaît et l'enregistrement reprend.
4. **Créneaux** — Cocher « Journée entière », décocher « Matin » et « Après-midi » puis tenter de tout décocher → message « Cochez au moins un créneau de travail. » ; l'état valide précédent reste enregistré.
5. **Rythme** — Mettre `reposHebdoMin = 3` et `maxJoursConsecutifs = 6` → un **avertissement** apparaît (incohérence), mais les valeurs sont **enregistrées**. Saisir `maxJoursConsecutifs = 9` → message « … entre 1 et 7. » et non persisté.
6. **Premier jour de la semaine** — Choisir « Dimanche » → enregistré ; recharger → conservé.
7. **Persistance croisée** — Après plusieurs modifications, `JSON.parse(localStorage.getItem('idelia:data')).cabinet` contient les nouvelles valeurs **et** `couleursParDefaut` intact.
8. **Clavier / accessibilité** — Naviguer au `Tab` : focus visible partout ; cases cochables à l'espace ; libellés cliquables.
9. **Build** — `npm run build` réussit sans erreur.

## 12. Décisions à confirmer / risques

1. **Enregistrement automatique vs bouton « Enregistrer »** — Choisi : **auto-save par champ valide** (cohérent avec la persistance débouncée de `002` et le retour « Modifications enregistrées » demandé). Conséquence assumée : un champ momentanément invalide n'est pas poussé, le dernier réglage valide reste persisté. **À confirmer** : accepter ce modèle plutôt qu'un bouton explicite.
2. **Emplacement des libellés (`src/domain/libelles.js`)** — Placé dans le **domaine** (données pures, sans Vue), à côté de `schema.js` qui porte les codes, et **réutilisable** par `004`-`012`. Alternative : un util UI. **À confirmer** : ce placement.
3. **Cohérence en domaine (`src/domain/cabinet.js`)** — Le contrôle de cohérence est une (petite) règle métier → placée dans le domaine (règle d'or #10), pas dans le composant. **À confirmer** : garder ce module dédié plutôt que de l'ajouter à `schema.js`.
4. **Affichage de l'horodatage de sauvegarde** — Optionnel. S'il est affiché, il **doit** passer par un helper `dateUtil.formatHorodatageFr` (respect [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) : `Date` uniquement dans `dateUtil`). Sinon, se limiter à « Modifications enregistrées » sans date. **À trancher** par le développeur (KISS).
5. **Contrôle des entiers : `input[type=number]` vs `form-select`** — Retenu : `input[type=number]` + Vuelidate (pour démontrer la validation demandée). Un `form-select` des valeurs autorisées supprimerait les états invalides mais masquerait la validation. **À confirmer**.
6. **Enregistrement de la directive `vue-debounce`** — `003` l'enregistre dans `main.js`. Vérifier l'API exacte de la version installée (`vue-debounce@^5`, enregistrement de la directive globale) au moment de l'implémentation.
7. **Ordre d'affichage des jours** — Les cases sont affichées en **ordre ISO fixe** (Lundi→Dimanche), indépendamment de `premierJourSemaine` (qui ne concerne que l'affichage **calendrier** des features ultérieures). **À confirmer** : ne pas réordonner ici (KISS).
8. **`couleursParDefaut` différé** — Hors périmètre `003` ; préservé par la fusion de `majParametres`. Son édition viendra avec un écran qui l'exploite (ou une feature dédiée).
