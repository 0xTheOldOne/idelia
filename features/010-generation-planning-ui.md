# Feature 010 — Génération de planning (UI) + visualisation en lecture seule

- **Statut** : À faire
- **Dépend de** : `005` (souhaits/préférences, lus par le moteur), `006` (tournées, `tournees/actives`, `creerTournee` pour la forme `Tournee`), `007` (absences, `absences.items`), `009` (moteur pur `src/domain/scheduling/` : `genererPlanning`, `validerPlanning`, `calculerScore`, `calculerNonCouvertures` (exporté par `contraintes/contrainteCouverture.js`), typedefs `Entree`/`Resultat`/`Violation`/`NonCouverture`). **`010` amende la surface publique de `009`** en y ajoutant `diagnostiquer(affectations, entree)` (§5.3, arbitrage du porteur — voir la note d'amendement en §9 T1). S'appuie aussi sur `002` (`src/domain/schema.js` : entité `Planning`/`Affectation`, `STATUTS_PLANNING`, `etatParDefaut`, `REPLACE_ALL`/`bootstrap` du store racine), `003` (`cabinet/parametres` : `joursOuverture`, `premierJourSemaine`, `reposHebdoMin`, `maxJoursConsecutifs`), `004` (`personnes/actifs`), et l'existant transverse (`IndicateurSauvegarde`, `dateUtil`, `libelles.js`).
- **ADR liés** : [0007](../docs/adr/0007-generation-planning-hybride.md) (mode hybride : `origine`/`verrouillee` sont un **input** du moteur ; en `010` le verrouillage n'a **pas encore d'UI** mais le tuyau le préserve déjà), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (le moteur reste pur : l'appel passe **par une action du store**, jamais depuis un composant), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7, dates `"YYYY-MM-DD"`, aucun objet `Date` hors `dateUtil`), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS + JSDoc), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance via le mécanisme store + plugin, jamais `localStorage` direct), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate pour le formulaire de période), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) / [0012](../docs/adr/0012-style-scss.md) (Bootstrap 5 thémé par tokens, SCSS), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor), [0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md) (diffusion/impression : différée à `012`).

## 1. Contexte & objectif

Le moteur (`009`) sait générer et valider un planning, mais **rien à l'écran** ne le déclenche ni ne l'affiche : l'écran `/planning` est un placeholder vide. La feature `010` livre **« générer & voir »** : choisir une période, lancer la génération d'un coup de bouton, **voir la proposition** dans une grille claire, et **comprendre les conflits résiduels** en langage humain. C'est le premier écran où toutes les données de référence (équipe, souhaits, tournées, absences, réglages) convergent en une proposition concrète et lisible.

`010` s'arrête volontairement à la **lecture** : aucune modification manuelle du planning (glisser-déposer, clic-pour-affecter, verrouillage, boutons « regénérer ») — c'est `011` — et aucune diffusion/impression — c'est `012`. Le composant central `GrillePlanning` est toutefois **conçu dès maintenant pour être réutilisé** par `011` (couche d'édition) et `012` (diffusion) : `010` en pose la version lecture seule, avec les points d'extension (slots/props/événements) déjà pensés.

**Hors périmètre `010`** (voir §12 pour le détail) :

- **Toute interactivité d'édition** (glisser-déposer, clic-pour-affecter, ajout/suppression/déplacement manuel d'affectation, verrouillage d'affectation, boutons « regénérer à l'identique / essayer une variante », revalidation en temps réel **pendant** l'édition) → `011`.
- **Diffusion / impression / export PDF** (`/planning/:id/diffusion`, styles `@media print`, snapshot d'affichage figé à la publication, passage en statut `VALIDE`/`PUBLIE`) → `012`.
- **Gestion d'un catalogue de plannings** (liste complète, renommage, suppression assistée, choix du référent) → `011`/`013`. `010` génère et affiche **le planning courant** ; il n'offre pas de gestionnaire multi-plannings.

## 2. Écrans concernés

Un seul écran, la route existante **`/planning`** → `PlanningView.vue` ([architecture 07](../docs/architecture/07-navigation-et-ecrans.md), § Écran Planning). La route `/planning/:id/diffusion` reste réservée à `012` (non créée ici). Aucune nouvelle route.

**Usage de `/planning` décidé pour `010`** : une **entrée unique** qui présente d'abord le **choix de période + le bouton « Générer le planning »**, puis, dès qu'un planning **courant** existe (fraîchement généré, ou retrouvé au rechargement), affiche **sous le formulaire** la **grille en lecture seule** et le **panneau de conflits**. Le formulaire reste toujours visible au-dessus (générer une nouvelle période est l'action première de l'écran).

Expérience visée pour un utilisateur non-technique :

- **À l'ouverture, une seule chose à faire** : deux dates pré-remplies (semaine prochaine) et un gros bouton « Générer le planning ». Aucun réglage moteur exposé.
- **Retour immédiat** : un court indicateur « Génération en cours… », puis la grille apparaît remplie de noms et de couleurs, avec, s'il y a lieu, un encart « Ce planning a des points d'attention » qui explique chaque conflit en français (« Claire Martin est en congé le mercredi 12/08 »).
- **États vides guidants** : sans personne active, sans tournée active, l'écran n'affiche pas un bouton inerte mais explique quoi faire et propose un lien vers l'écran concerné (Équipe / Tournées).
- **Voir autrement sans rien casser** : boutons pour basculer l'affichage (tournées ↔ personnes) et l'échelle (jour / semaine / mois), et naviguer dans le temps (précédent / suivant). Ces réglages ne changent **jamais** les données, seulement la vue.

## 3. Modèle de données touché

Aucun **nouveau** champ, aucun impact sur `schemaVersion` (reste `1`). `010` **produit et persiste** des entités déjà définies ([02](../docs/architecture/02-modele-de-domaine.md) §Planning/§Affectation) :

- **`Planning`** (nouvellement créé à l'exécution) : `id`, `nom`, `dateDebut`, `dateFin`, `statut: 'BROUILLON'`, `affectations`, `parametresGeneration` (= `Resultat.meta` du moteur, pour la reproductibilité), `referentId: null`, `publieLe: null`, `createdAt`/`updatedAt`. Aucune fabrique n'existe encore : `010` crée `src/domain/planning.js` avec `creerPlanning(...)` (§5), sur le modèle exact de `creerTournee`/`creerAbsence`.
- **`Affectation`** : produites **par le moteur** (`resultat.affectations`, déjà conformes à 02 §Affectation via `creerAffectationAuto`) et **déposées telles quelles** dans `planning.affectations`, sans transformation. `010` ne crée **aucune** affectation lui-même (la création manuelle est `011`).

**Jamais persisté** (02 : « les diagnostics ne sont jamais stockés ») : `Resultat.violations`, `Resultat.tourneesNonCouvertes`, `Resultat.score`. Ces diagnostics sont **volatils**, tenus dans l'état local du composant après une génération, et **recalculés à la demande** (au rechargement) par la fonction moteur `diagnostiquer(affectations, entree)` via l'action `evaluerCourant` (§4.3) — **jamais dérivés/reconstruits en UI**, le moteur restant l'unique source de vérité. `plannings.selectionId` reste lui aussi volatil (non sérialisé, remis à `null` par `fromSaveDocument`) — voir la décision d'auto-sélection au rechargement (§4.4, §12).

## 4. Store (Vuex)

Toutes les modifications sont dans **`src/store/modules/plannings.js`** (aujourd'hui : `state {items, selectionId}`, getters `byId`/`courant`, mutation `REPLACE` seule, `actions: {}`). Le module est **déjà persisté** par le plugin du store racine : **aucun accès `localStorage`** ici. La mutation `REPLACE` **reste inchangée** (hydratation `app/bootstrap` / `REPLACE_ALL` — voir `src/store/index.js`).

### 4.1 Mutations à ajouter (fines, sans logique métier ni horodatage)

Calquées sur `tournees.js`/`personnes.js` :

- **`ADD(state, planning)`** : `state.items.push(planning)` — reçoit un `Planning` déjà complet (issu de `creerPlanning`).
- **`SELECT(state, id)`** : `state.selectionId = id` — pointe le planning courant (volatil, non persisté).
- **`REMOVE(state, id)`** : retire le planning d'`id`, et si c'était la sélection, remet `selectionId = null`. Fournie pour la complétude / le futur ; **pas d'UI de suppression en `010`** (voir §12).

### 4.2 Action `genererPropose` — le tuyau moteur → écran

Concrétise le contrat indicatif de [009 §4.1](009-moteur-planification.md). Action **namespacée** `plannings/genererPropose`, signature `genererPropose(context, { dateDebut, dateFin, seed = 0, variante = 0 })` :

1. **Assemble une `Entree`** (typedef 009 §5.2) à partir des sources existantes, sans logique métier (simple collecte) :
   ```
   entree = {
     periode:       { debut: dateDebut, fin: dateFin },
     personnes:     rootGetters['personnes/actifs'],   // le moteur filtre le reste
     tournees:      rootGetters['tournees/actives'],    // filtrage jours/validité fait par le moteur (009 §5.4)
     absences:      rootState.absences.items,           // toutes ; le moteur filtre par statut (009 §7)
     reglesCabinet: rootGetters['cabinet/parametres'],  // tel quel
   }
   ```
   > On **ne crée pas** de getter `tournees/applicablesSur(periode)` (évoqué en 009 §4.1) : le moteur filtre déjà par `joursApplication` et bornes de validité (`expanserDemandes`, 009 §5.4). KISS.
2. **Appelle le moteur** : `const resultat = genererPlanning(entree, { seed, variante })` (import depuis `@/domain/scheduling`).
3. **Construit un `Planning`** : `creerPlanning({ nom, dateDebut, dateFin, affectations: resultat.affectations, parametresGeneration: resultat.meta })` — `statut` reste `'BROUILLON'` (défaut de la fabrique). `nom` = libellé lisible construit dans l'action via `dateUtil.formatDateFr` (ex. « Planning du 13/07/2026 au 19/07/2026 »), pour que l'entité persistée soit auto-descriptive (utile à `012`).
4. **Persiste + sélectionne** : `commit('ADD', planning)` puis `commit('SELECT', planning.id)`. La persistance débouncée se déclenche via le plugin (aucun `localStorage` direct).
5. **Retourne le `Resultat` complet** (`{ affectations, violations, score, tourneesNonCouvertes, meta }`) au composant appelant, pour l'affichage **immédiat** des conflits. **Seul le `Planning` est persisté** ; le `Resultat` (diagnostics) ne l'est jamais.

> **Chaque appel = un nouveau `Planning` `BROUILLON` sélectionné.** La régénération « en place » (remplacer le brouillon courant, essayer une variante) est `011` ; `010` se contente d'ajouter une proposition et de la sélectionner (voir §12, point sur l'accumulation de brouillons).

### 4.3 Action `evaluerCourant` — diagnostics recalculés à la volée

Action `plannings/evaluerCourant(context)` (lecture seule, **aucun `commit`**), pour retrouver les diagnostics d'un planning **déjà persisté** sans jamais les stocker (02 : recalcul à la demande) :

1. `const planning = getters.courant` ; si absent → retourne `{ violations: [], tourneesNonCouvertes: [], score: 0 }`.
2. Assemble la **même `Entree`** qu'en §4.2, mais avec `periode: { debut: planning.dateDebut, fin: planning.dateFin }` (un helper interne privé `assemblerEntree(rootGetters, rootState, periode)` factorise le §4.2/§4.3, non exporté).
3. `const diagnostic = diagnostiquer(planning.affectations, entree)` (import `@/domain/scheduling`, §5.3).
4. Retourne `diagnostic` = `{ violations, tourneesNonCouvertes, score }`.

`evaluerCourant` sert **au rechargement** de la page (le `Resultat` volatil a disparu) et prépare `011` (revalidation après édition). Sa forme de retour est **identique** à la partie diagnostics du `Resultat` de `genererPropose` (`{ violations, tourneesNonCouvertes, score }`) : la vue consomme exactement la même structure, qu'elle vienne d'une génération fraîche ou d'un rechargement — **aucune dérivation en UI**, le moteur reste l'unique source de vérité (§5.3, amendement à `009`).

### 4.4 Sélection au montage (comportement attendu, piloté par la vue)

`selectionId` n'étant **pas persisté**, `getters.courant` est `null` après un rechargement même si `items` contient des plannings. `PlanningView` (§6), à son montage, si `!courant && items.length > 0`, `commit`/`dispatch` une **auto-sélection du planning le plus récent** (`items` trié par `createdAt` décroissant) via `SELECT`, puis appelle `evaluerCourant` pour peupler les diagnostics (`{ violations, tourneesNonCouvertes, score }`). Décision assumée (§12).

**Persisté vs volatile** : persisté = `plannings.items` (donc les `Planning` et leurs `affectations`) ; volatile = `plannings.selectionId`, l'état local des diagnostics de la vue (`{ violations, tourneesNonCouvertes, score }`, issu de `genererPropose` ou `evaluerCourant`), et tous les réglages d'affichage (orientation/échelle/date de référence).

## 5. Domaine (logique pure)

Aucune logique métier dans les composants ni dans le store (le store ne fait qu'orchestrer). Trois ajouts purs, sans import Vue/Vuex ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)) : une fabrique (§5.1), des helpers de dates (§5.2), et une **extension de l'API publique du moteur `009`** (§5.3).

### 5.1 `src/domain/planning.js` (nouveau) — fabrique `creerPlanning`

Sur le modèle **exact** de `creerTournee`/`creerAbsence` (seules concessions techniques tolérées : `genId()` et `new Date().toISOString()`). Expose le `@typedef Planning` (aligné sur 02 §Planning) et :

```js
/**
 * @param {Object} [champs]
 * @returns {Planning}
 */
export function creerPlanning(champs = {}) {
  const maintenant = new Date().toISOString();
  return {
    id:                   champs.id ?? genId(),
    nom:                  String(champs.nom ?? '').trim(),
    dateDebut:            champs.dateDebut ?? '',
    dateFin:              champs.dateFin ?? '',
    statut:               champs.statut ?? STATUTS_PLANNING[0], // 'BROUILLON'
    affectations:         Array.isArray(champs.affectations) ? champs.affectations : [],
    parametresGeneration: champs.parametresGeneration ?? null,
    referentId:           champs.referentId ?? null,
    publieLe:             champs.publieLe ?? null,
    createdAt:            champs.createdAt ?? maintenant,
    updatedAt:            maintenant,
  };
}
```

`creerPlanning` **ne recalcule ni ne valide** les affectations (elles arrivent déjà conformes du moteur) : elle ne garantit que la **forme structurelle** (cohérence des dates portée par le formulaire, Vuelidate §7). Import `STATUTS_PLANNING` et `genId` uniquement.

### 5.2 `src/domain/utils/dates.js` (modifier) — helpers de fenêtre calendaire

`dateUtil` est le **seul** endroit autorisé à toucher `Date` ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)). La grille (§6) a besoin de calculer des fenêtres semaine/mois : on **ajoute** à `dateUtil` (construits au-dessus de `weekdayISO`/`addDays`/`rangeInclusive` et de simple arithmétique de chaînes, **sans nouvel objet `Date` exposé**) :

- **`debutSemaine(dateStr, premierJourIso)`** → `"YYYY-MM-DD"` : premier jour de la semaine contenant `dateStr`, aligné sur `premierJourIso` (1-7). `delta = (weekdayISO(dateStr) - premierJourIso + 7) % 7 ; return addDays(dateStr, -delta)`.
- **`debutMois(dateStr)`** → `"YYYY-MM-DD"` : `dateStr.slice(0, 8) + '01'` (arithmétique de chaîne pure).
- **`moisSuivant(dateStr)`** / **`moisPrecedent(dateStr)`** → `"YYYY-MM-DD"` : premier jour du mois adjacent (incrément/décrément de `YYYY-MM` par arithmétique de chaîne, report décembre↔janvier géré).
- **`finMois(dateStr)`** → `"YYYY-MM-DD"` : `addDays(moisSuivant(debutMois(dateStr)), -1)`.

Ces helpers restent **purs et déterministes** (jamais `Date.now()`), et servent aussi bien la grille de `010` que celles de `011`/`012`.

### 5.3 `src/domain/scheduling/` (amendement à `009`) — `diagnostiquer(affectations, entree)`

> **Extension de la surface publique de `009`** (feature déjà committée), décidée par le porteur du produit : le moteur reste **l'unique source de vérité** des diagnostics, **zéro dérivation/reconstruction en UI**. `010` ajoute la fonction pure `diagnostiquer(affectations, entree)` → `{ violations, tourneesNonCouvertes, score }`, exposée par `src/domain/scheduling/index.js`. Elle **factorise la queue déjà présente dans `genererPlanning`** (009 §5.14 : `validerPlanning` + `calculerNonCouvertures` (exporté par `contraintes/contrainteCouverture.js`) + `calculerScore`), et `genererPlanning` **la réutilise** désormais pour construire sa propre partie diagnostics — **aucune duplication** de logique, aucune règle métier nouvelle.

Contrat :

- `diagnostiquer(affectations, entree)` construit le contexte comme `validerPlanning` (`indexer(affectations)`, `expanserDemandes(entree)`, `joursPeriode(entree)`) et renvoie :
  - `violations` : **strictement** ce que renvoie `validerPlanning(affectations, entree)` (triées, FR, prêtes à afficher) ;
  - `tourneesNonCouvertes` : `NonCouverture[]` via `calculerNonCouvertures(expanserDemandes(entree), indexer(affectations))` ;
  - `score` : `calculerScore(violations)`.
- **Invariant de cohérence** (critère de sortie §9 T1) : pour toute `entree`, avec `resultat = genererPlanning(entree, options)`, l'appel `diagnostiquer(resultat.affectations, entree)` renvoie exactement les mêmes `violations` / `tourneesNonCouvertes` / `score` que ceux portés par `resultat`.
- Fonction **pure et déterministe** : aucun import Vue/Vuex, aucun `Math.random`/`Date.now`, aucun accès `localStorage` — comme tout le module `scheduling/` ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)).

**Impact documentaire** : cet ajout amende `009` (surface publique de `009 §5.15`/§10, qui listait 7 exports) — voir la note d'amendement en §9 T1. Après `010`, `src/domain/scheduling/index.js` expose **8** entrées : les 7 de `009` (`genererPlanning`, `validerPlanning`, `creerContraintes`, `TYPES_CONTRAINTE`, `calculerScore`, `indexer`, `appliquerChangement`) **plus** `diagnostiquer`. La règle « `010`/`011` n'importent que depuis `@/domain/scheduling` » (009 §5.15) reste inchangée.

## 6. Composants

`views/` orchestre, `components/planning/` présente. Aucune logique métier dans les composants ; les libellés viennent de `libelles.js`, les dates de `dateUtil`, l'appel moteur **toujours** via une action du store.

| Fichier | Type | Responsabilité |
|---|---|---|
| `src/views/PlanningView.vue` | **modifier** | **Orchestrateur** de l'écran. Détient l'état d'affichage (`orientation`, `echelle`, `dateReference`) et l'état volatil des diagnostics `{ violations, tourneesNonCouvertes, score }` (issu de `genererPropose` ou `evaluerCourant`). Gère les états vides, le montage (auto-sélection + `evaluerCourant`), le lancement de génération, le passage des props aux composants. Réutilise `IndicateurSauvegarde` (`@/components/communs`). |
| `src/components/planning/FormulaireGeneration.vue` | **créer** | Formulaire présentational du choix de période (2 champs date) + action principale « Générer le planning ». Validation Vuelidate (§7). N'accède **pas** au store : reçoit ses valeurs par défaut/props, **émet** `generer({ dateDebut, dateFin })`. Affiche l'état `chargement` (prop) sur le bouton. |
| `src/components/planning/ControlesGrille.vue` | **créer** | Barre de réglages d'affichage : bascule orientation (Tournées / Personnes), bascule échelle (Jour / Semaine / Mois), navigation période (précédent / suivant + « Aller à la période du planning »). N'a aucun état propre : reçoit `orientation`/`echelle`/`dateReference`/`echelleContexte` en props, émet `update:orientation`, `update:echelle`, `update:dateReference` (calcule la nouvelle date via `dateUtil` selon l'échelle). Réutilisable par `011`/`012`. |
| `src/components/planning/GrillePlanning.vue` | **créer** | **Le composant central, en lecture seule.** Rend la matrice **lignes × jours** (voir §6.1), pour les 2 orientations et les 3 échelles, avec le **mois défilable à première colonne figée**. Résout noms/couleurs, **marque la sous-couverture à partir de la prop `tourneesNonCouvertes`** (`NonCouverture[]` du moteur), **surligne les cellules concernées à partir de la prop `violations`** (`Violation[]` du moteur, via `Violation.cible`). Ne fait aucune dérivation métier : il consomme les diagnostics tels que le moteur les fournit. Expose un **slot scopé `cellule`** (point de greffe `011`) dont le contenu **par défaut** est la cellule lecture seule. **N'émet aucun événement d'édition en `010`.** |
| `src/components/planning/CellulePlanning.vue` | **créer** | Rendu d'**une** cellule : liste de « pastille couleur + nom (+ créneau) », icône + libellé de sous-couverture, état « concernée par un conflit ». Purement présentational (reçoit des `elements` déjà résolus + des drapeaux). Unité que `011` enrichira (poignées de glisser-déposer). |
| `src/components/planning/PanneauConflits.vue` | **créer** | Affiche les `Violation` **telles quelles** (message FR du moteur, **jamais reformulé**), groupées **erreurs (dures)** vs **avertissements (souples)**, distinguées par icône + libellé (jamais par la seule couleur). Résumé des tournées non couvertes. État « Aucun conflit » rassurant. Réutilisable par `011`. |

### 6.1 Modèle de matrice unique (les 3 échelles, les 2 orientations)

**Invariant** : la grille est **toujours** une matrice **lignes × jours**. L'échelle ne change que **l'ensemble des colonnes-jours** ; l'orientation ne change que **ce que sont les lignes** et **ce que contient une cellule**. Le créneau n'est **pas** un axe : il est agrégé **dans** la cellule (décision KISS, §12).

- **Colonnes (jours)**, selon `echelle` et `dateReference` (via `dateUtil`) :
  - `JOUR` : une seule colonne, la date `dateReference`.
  - `SEMAINE` : 7 colonnes, de `debutSemaine(dateReference, premierJourSemaine)` à +6 jours.
  - `MOIS` : toutes les dates de `debutMois(dateReference)` à `finMois(dateReference)` (28–31 colonnes) → **tableau large, défilement horizontal, première colonne figée**.
  - Chaque colonne connaît son `jourIso` (`weekdayISO`) : les jours **hors** `joursOuverture` du cabinet sont rendus **fermés** (colonne grisée, marquée « Fermé », sans cellule active) ; les jours **hors** `[planning.dateDebut, planning.dateFin]` sont discrètement marqués « hors période ». Les jours restent affichés (jamais masqués) pour que le calendrier reste lisible.
- **Lignes**, selon `orientation` :
  - `TOURNEES` : une ligne par tournée = `tournees/actives` **plus** toute tournée **référencée par une affectation** mais archivée (résolue via `tournees/byId`, suffixe « (archivée) ») — même robustesse que `AbsencesView` pour les personnes archivées.
  - `PERSONNES` : une ligne par personne = `personnes/actifs` **plus** toute personne référencée par une affectation mais désactivée (suffixe « (archivée) »).
- **Contenu d'une cellule** `(ligne, date)` :
  - `TOURNEES` : les affectations de **cette tournée à cette date** → « pastille de la personne + Prénom Nom ». Si la tournée est **sous-couverte** ce jour (une entrée de la prop `tourneesNonCouvertes` cible ce `tourneeId`+`date`), afficher une icône (`PhWarningCircle`) + « Il manque N personne(s) » (`NonCouverture.manque`, toujours renseigné par le moteur). Le composant lit directement `tourneesNonCouvertes` — **aucune dérivation depuis les violations `SOUS_COUVERTURE`**.
  - `PERSONNES` : les affectations de **cette personne à cette date** → « pastille de la tournée + Nom de la tournée + créneau » (`libelleCreneau`, masqué si `JOURNEE`). La sous-couverture ne s'affiche pas au niveau des cellules-personnes (elle concerne les tournées) : elle reste visible en orientation Tournées et dans le panneau.
  - Cellule vide → aspect « rien de prévu » discret (pas d'alerte).

### 6.2 Surlignage des cellules par `Violation.cible`

GrillePlanning reçoit `violations` (`Violation[]`) et fait un **mapping purement présentational** (aucune règle métier) `cible → cellule` :

- Orientation `TOURNEES` : une cellule `(tourneeId, date)` est **concernée** si une violation a `cible.tourneeId === tourneeId && cible.date === date` (créneau confondu, la tournée portant un créneau unique).
- Orientation `PERSONNES` : une cellule `(personneId, date)` est **concernée** si `cible.personneId === personneId && cible.date === date`.
- Violations sans cible de cellule mappable dans l'orientation courante (ex. `EQUITE_DESEQUILIBREE`, `cible: { personneId }` sans date) : surligner l'**en-tête de ligne** de la personne concernée en orientation Personnes ; en orientation Tournées, ne rien surligner au niveau cellule (la violation reste listée dans le panneau).

Le surlignage combine **plusieurs canaux** (bordure marquée + fond léger + petite icône `PhWarning`), **jamais la seule couleur** ([08](../docs/architecture/08-principes-ux-ergonomie.md), point 8). Erreurs et avertissements se distinguent par l'icône/le motif, pas uniquement par la teinte.

### 6.3 Extension pour `011` (préparée, non activée)

- **Slot scopé `cellule`** exposant `{ ligne, ligneType, date, jourIso, elements, sousCouverture, concernee, ferme, horsPeriode }`. En `010`, le **contenu par défaut** du slot est `CellulePlanning` en lecture seule (donc pas de code mort). `011` fournira son propre contenu de slot pour greffer poignées/zones de dépôt.
- **Aucun événement d'édition émis en `010`.** La surface d'extension (`@deposer`, `@selectionner-cellule`, `@verrouiller`, boutons « regénérer »/« variante », revalidation à la volée) est **documentée pour `011`** mais **non implémentée** ici (pas de dépendance drag&drop, KISS).

## 7. Règles de validation

Un seul formulaire : la **période** (`FormulaireGeneration.vue`), via Vuelidate ([instructions](../docs/instructions/formulaires-validation.md), calqué sur `FormulaireAbsence`). Messages **FR orientés correction**, affichés **après interaction** (pas sur formulaire vierge).

| Champ | Règle | Message FR |
|---|---|---|
| `dateDebut` | `required` | « Indiquez la date de début. » |
| `dateFin` | `required` | « Indiquez la date de fin. » |
| `dateFin` | cohérence `dateFin >= dateDebut` (comparaison de chaînes, comme `FormulaireAbsence`) | « La date de fin doit être identique ou postérieure à la date de début. » |

- **Valeurs par défaut raisonnables** : `dateDebut` = **lundi de la semaine prochaine**, `dateFin` = **dimanche suivant** (semaine complète lundi→dimanche). Calcul dans le composant via `dateUtil` à partir de la date du jour : `dateDebut = addDays(aujourdhui, ((8 - weekdayISO(aujourdhui)) % 7) || 7)`, `dateFin = addDays(dateDebut, 6)`.
- **Nicety** (comme `FormulaireAbsence`) : si `dateFin` devient vide/antérieure à `dateDebut` après édition de `dateDebut`, la recaler automatiquement.
- **Garde souple, non bloquante** : si la période dépasse ~3 mois (`diffDays > 92`), afficher un `form-text` d'avertissement (« La grille sera très large ; l'affichage Mois reste conseillé. ») sans empêcher la génération. Pas de plafond dur.
- **Génération jamais bloquée pour cause de données** : les cas « aucune personne / aucune tournée » sont gérés **en amont** par des états vides (§8), pas par la validation du formulaire.

## 8. Points d'attention ergonomie

Public non-technique ([08](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Une action principale évidente** : « Générer le planning », dominante (`btn btn-primary`, large, icône Phosphor). Les bascules d'affichage sont secondaires (boutons discrets, `btn-outline-*`).
- **États vides guidants** (jamais de cul-de-sac), calqués sur `AbsencesView` :
  - Aucune personne active → « Ajoutez d'abord des personnes à votre équipe… » + lien « Aller à l'équipe » (`{ name: 'equipe' }`).
  - Aucune tournée active → « Créez d'abord au moins une tournée… » + lien « Aller aux tournées » (`{ name: 'tournees' }`).
  - Bouton « Générer » **désactivé** (avec explication) tant qu'il manque l'un des deux.
- **Feedback de chargement** : la génération est quasi instantanée (009 : < 300 ms), mais on affiche tout de même un état « Génération en cours… » sur le bouton. Le moteur étant **synchrone**, laisser l'UI peindre l'indicateur (basculer l'état de chargement, `await this.$nextTick()`, puis `dispatch`) pour qu'il soit visible.
- **Jamais l'information par la seule couleur** : chaque affectation = pastille **+ nom** ; sous-couverture = icône **+ libellé** ; conflit = icône/motif **+ libellé**, erreurs (dures) visuellement **distinctes** des avertissements (souples). Cohérent avec Équipe/Absences (pastille + nom).
- **Vocabulaire du glossaire** partout (personne, tournée, créneau, absence, planning) ; **messages de conflit affichés tels quels** (le moteur les fournit déjà en FR actionnable, 009 §8) — **ne jamais reformuler**.
- **Réversibilité des réglages d'affichage** : changer orientation/échelle/période ne modifie **jamais** les données ; un bouton « Aller à la période du planning » ramène toujours la vue sur la proposition.
- **Accessibilité de la grille** : `<table>` sémantique (`<th scope="col">` pour les jours, `<th scope="row">` pour la ligne), en-têtes de date lisibles (jour + date courte), icônes accompagnées d'`aria-label`/texte, focus visible, cibles cliquables ≥ `$cible-cliquable-min`. Le défilement horizontal du Mois reste utilisable au clavier ; la première colonne figée ne masque jamais l'en-tête de ligne.

## 9. Étapes d'implémentation

**5 tâches**, chacune pour **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé par les dépendances : **T1 → T2 → T3 → T4 → T5**. Pas de suite de tests : chaque critère est vérifiable **à la main** (console pendant `npm run dev`, ou parcours écran).

### Tâche 1 — Domaine : `creerPlanning` + helpers de dates + `diagnostiquer()` (amendement moteur `009`)

**Fichiers** :
- `src/domain/planning.js` (**créer**) — `@typedef Planning` + `creerPlanning(champs)` (§5.1).
- `src/domain/utils/dates.js` (**modifier**) — ajouter `debutSemaine`, `debutMois`, `moisSuivant`, `moisPrecedent`, `finMois` à `dateUtil` (§5.2).
- `src/domain/scheduling/diagnostiquer.js` (**créer**) — `diagnostiquer(affectations, entree)` → `{ violations, tourneesNonCouvertes, score }` (§5.3).
- `src/domain/scheduling/index.js` (**modifier**) — exporter `diagnostiquer` (8ᵉ entrée de l'API publique).
- `src/domain/scheduling/genererPlanning.js` (**modifier**) — réagencer la **queue** (009 §5.14) pour qu'elle **appelle `diagnostiquer`** au lieu de recomposer à la main `validerPlanning` + `calculerNonCouvertures` + `calculerScore` (factorisation, **zéro duplication** ; comportement observable de `genererPlanning` inchangé).

> **Note d'amendement à `009`** (feature déjà committée) : cette tâche **étend la surface publique de `009`** (arbitrage du porteur du produit — §12 décision #3). Le moteur reste l'unique source de vérité des diagnostics ; `010`/`011` obtiennent tout diagnostic recalculé via `diagnostiquer`, jamais par dérivation en UI. Les modifications de `genererPlanning.js`/`index.js` restent **purement internes/additives** (pas de changement de contrat de `genererPlanning`).

**Dépend de** : briques internes de `009` (`validerPlanning`, `calculerNonCouvertures` exporté par `contraintes/contrainteCouverture.js`, `calculerScore`, `indexer`, `expanserDemandes`).

**Critères de sortie** :
- `creerPlanning()` (sans argument) renvoie un objet avec **tous** les champs de 02 §Planning : `statut === 'BROUILLON'`, `affectations` `[]`, `parametresGeneration` `null`, `referentId` `null`, `publieLe` `null`, `id` non vide, `createdAt`/`updatedAt` ISO.
- `creerPlanning({ affectations: [a1, a2], parametresGeneration: { seed: 3 }, dateDebut: '2026-07-13', dateFin: '2026-07-19' })` conserve `affectations` **à l'identique** (mêmes objets, aucune transformation), `parametresGeneration.seed === 3`, et les dates telles quelles.
- `dateUtil.debutSemaine('2026-07-15', 1)` (mardi, premier jour = lundi) → `'2026-07-13'` ; avec `premierJourIso = 7` (dimanche) → `'2026-07-12'`.
- `dateUtil.debutMois('2026-07-15')` → `'2026-07-01'` ; `dateUtil.finMois('2026-07-15')` → `'2026-07-31'` ; `dateUtil.finMois('2026-02-15')` → `'2026-02-28'`.
- `dateUtil.moisSuivant('2026-12-10')` → `'2027-01-01'` ; `dateUtil.moisPrecedent('2026-01-10')` → `'2025-12-01'`.
- `diagnostiquer(affectations, entree)` renvoie `{ violations, tourneesNonCouvertes, score }` ; `violations` est **strictement égal** (mêmes `code`/`cible`/`message`, même ordre) à `validerPlanning(affectations, entree)` ; `score === calculerScore(violations)`.
- **Invariant de cohérence** : avec `resultat = genererPlanning(entree, { seed: 1 })`, l'appel `diagnostiquer(resultat.affectations, entree)` renvoie exactement les mêmes `violations` / `tourneesNonCouvertes` / `score` que ceux portés par `resultat` (comparaison manuelle ou `JSON.stringify`).
- Après le réagencement, `genererPlanning(entree, { seed: 1 })` renvoie toujours un `Resultat` conforme au contrat `009 §5.2` (aucune régression : `affectations`/`violations`/`score`/`tourneesNonCouvertes`/`meta` présents, déterminisme préservé).
- `import('/src/domain/scheduling/index.js')` (console, `npm run dev`) expose `diagnostiquer` **en plus** des 7 exports de `009` (8 entrées au total).
- Aucun import Vue/Vuex ; aucun `Math.random`/`Date.now` décisionnel dans `diagnostiquer` ; aucun accès `localStorage` ; aucun `new Date("YYYY-MM-DD")` ni `Date.getDay()` hors des helpers existants de `dateUtil` ; `npm run build` réussit.

### Tâche 2 — Store `plannings` : mutations + `genererPropose` + `evaluerCourant`

**Fichiers** :
- `src/store/modules/plannings.js` (**modifier**) — mutations `ADD`/`SELECT`/`REMOVE` (§4.1), actions `genererPropose`/`evaluerCourant` + helper interne `assemblerEntree` (§4.2/§4.3). `REPLACE` **inchangée**.

**Dépend de** : T1 (`creerPlanning`, `diagnostiquer`), `009` (`genererPlanning`, importés depuis `@/domain/scheduling`).

**Critères de sortie** (vérifiables depuis la console, `npm run dev`, après avoir saisi au moins 2 personnes actives + 1 tournée active + réglages cabinet) :
- `store.dispatch('plannings/genererPropose', { dateDebut: '2026-07-13', dateFin: '2026-07-19' })` **retourne** un `Resultat` avec `affectations`/`violations`/`score`/`tourneesNonCouvertes`/`meta`, **sans exception**.
- Après cet appel : `store.state.plannings.items` contient **un** nouveau `Planning` `statut === 'BROUILLON'`, dont `affectations === resultat.affectations` (même contenu) et `parametresGeneration === resultat.meta` ; `store.state.plannings.selectionId` pointe ce planning ; `store.getters['plannings/courant']` le renvoie.
- La persistance se déclenche (l'`IndicateurSauvegarde` passe « Enregistré » ; au rechargement, le planning est toujours dans `items`). **Aucun** accès `localStorage` dans le module.
- `store.dispatch('plannings/evaluerCourant')` renvoie `{ violations, tourneesNonCouvertes, score }` **cohérent** avec le `Resultat` du même planning (mêmes `violations` — `code`/`cible`/ordre —, mêmes `tourneesNonCouvertes`, même `score`) ; sans planning courant → `{ violations: [], tourneesNonCouvertes: [], score: 0 }`.
- Un **second** `genererPropose` (période différente) ajoute un **second** planning et re-sélectionne : `items.length === 2`, `selectionId` = le second.
- `REMOVE` retire un planning et remet `selectionId` à `null` s'il était sélectionné. `REPLACE` reste compatible avec `REPLACE_ALL`/`bootstrap` (recharger la page hydrate `items` sans erreur).
- Aucun import Vue depuis le domaine ; l'appel moteur passe **uniquement** par ces actions ; `npm run build` réussit.

### Tâche 3 — Écran de génération : `FormulaireGeneration` + états vides + squelette `PlanningView`

**Fichiers** :
- `src/components/planning/FormulaireGeneration.vue` (**créer**) — période (défauts semaine prochaine), Vuelidate (§7), bouton « Générer le planning » avec état `chargement`, émission `generer`.
- `src/views/PlanningView.vue` (**modifier**) — remplace le placeholder : titre, `IndicateurSauvegarde`, états vides (aucune personne / aucune tournée) avec liens, montage du formulaire, gestion de `genererPropose` (stocke le `Resultat` en état local, gère l'indicateur de chargement). La grille et le panneau arrivent en T4/T5 (zone réservée, message « La proposition s'affichera ici » acceptable en fin de T3).

**Dépend de** : T2 (`genererPropose`), existant (`IndicateurSauvegarde`, `libelles`, `dateUtil`, patterns `AbsencesView`).

**Critères de sortie** :
- Sans aucune personne active : l'écran affiche le message + lien « Aller à l'équipe » ; **pas** de bouton « Générer » actif. Idem sans tournée active (lien « Aller aux tournées »).
- Avec ≥ 1 personne active **et** ≥ 1 tournée active : le formulaire affiche `dateDebut`/`dateFin` **pré-remplies** au lundi→dimanche de la semaine prochaine.
- Soumettre avec `dateFin < dateDebut` affiche « La date de fin doit être identique ou postérieure à la date de début. » et **ne génère pas** ; corriger puis soumettre déclenche la génération.
- Pendant la génération, le bouton passe en « Génération en cours… » (désactivé) puis revient ; après succès, un `Planning` est présent dans le store (vérifiable via l'`IndicateurSauvegarde` / rechargement).
- Champs vides → messages FR après tentative de soumission (pas sur formulaire vierge). Aucune saisie perdue.
- `npm run build` réussit ; aucun appel moteur direct depuis le composant (uniquement `dispatch`).

### Tâche 4 — `GrillePlanning` (lecture seule) + `CellulePlanning` + `ControlesGrille`

**Fichiers** :
- `src/components/planning/CellulePlanning.vue` (**créer**) — rendu d'une cellule (pastilles + libellés, sous-couverture, drapeau « concernée »).
- `src/components/planning/ControlesGrille.vue` (**créer**) — bascules orientation/échelle + navigation (§6).
- `src/components/planning/GrillePlanning.vue` (**créer**) — matrice lignes × jours, 2 orientations × 3 échelles, mois défilable à 1re colonne figée, slot scopé `cellule` (défaut = `CellulePlanning`), marquage de sous-couverture depuis la prop `tourneesNonCouvertes` et surlignage depuis la prop `violations` (`Violation.cible`) (§6.1/§6.2/§6.3).

**Dépend de** : T1 (helpers `dateUtil`, `@typedef Planning`), `009` (typedefs `Violation`/`NonCouverture`). Peut être développé avec des **props factices** (jeux d'affectations / `violations` / `tourneesNonCouvertes` construits à la main) avant l'intégration T5.

**Critères de sortie** (avec un jeu de props réaliste, plusieurs personnes/tournées/affectations sur une semaine) :
- Basculer **orientation** Tournées ↔ Personnes échange les lignes (tournées ↔ personnes) sans changer les colonnes-jours ; une affectation apparaît dans la cellule correspondante des **deux** orientations.
- Basculer **échelle** : `JOUR` → 1 colonne (la date de référence) ; `SEMAINE` → 7 colonnes (aligné sur `premierJourSemaine`) ; `MOIS` → toutes les dates du mois, en **tableau défilant horizontalement** avec **première colonne (tournée/personne) figée** visible pendant le défilement.
- Navigation **précédent/suivant** décale la fenêtre de 1 jour / 7 jours / 1 mois selon l'échelle ; « Aller à la période du planning » ramène `dateReference` sur `planning.dateDebut`.
- Chaque affectation s'affiche avec **pastille couleur + nom** (personne en orientation Tournées ; tournée + créneau en orientation Personnes) ; le créneau `JOURNEE` n'affiche pas de libellé de créneau redondant. Une personne/tournée archivée référencée s'affiche avec « (archivée) ».
- Une cellule dont la tournée est **sous-couverte** (une entrée de la prop `tourneesNonCouvertes` cible `tourneeId`+`date`) affiche **icône + libellé** « Il manque N personne(s) » (`NonCouverture.manque`, pas la seule couleur), en orientation Tournées — lu depuis `tourneesNonCouvertes`, sans dérivation depuis les violations.
- Une cellule ciblée par une `Violation` est **surlignée** (bordure + fond + icône), erreurs et avertissements distingués autrement que par la seule teinte. Une violation à `cible: { personneId }` seule surligne l'**en-tête** de la personne en orientation Personnes.
- Les jours **fermés** (hors `joursOuverture`) sont grisés/marqués « Fermé » ; les jours **hors** `[dateDebut, dateFin]` discrètement marqués.
- Le slot scopé `cellule` a bien pour **défaut** la cellule lecture seule ; **aucun** événement d'édition n'est émis. `<table>` sémantique, focus clavier visible.
- `npm run build` réussit.

### Tâche 5 — `PanneauConflits` + intégration finale dans `PlanningView`

**Fichiers** :
- `src/components/planning/PanneauConflits.vue` (**créer**) — violations groupées erreurs/avertissements (messages **verbatim**), résumé tournées non couvertes, état « Aucun conflit » (§6).
- `src/views/PlanningView.vue` (**modifier**) — câble `ControlesGrille` + `GrillePlanning` + `PanneauConflits` sous le formulaire ; détient `orientation`/`echelle`/`dateReference` et l'état volatil des diagnostics `{ violations, tourneesNonCouvertes, score }` ; au **montage**, auto-sélectionne le planning le plus récent si aucune sélection (§4.4) puis `evaluerCourant` pour peupler ces diagnostics ; après une génération, alimente la vue avec la partie diagnostics du `Resultat` retourné (`violations` + `tourneesNonCouvertes` + `score`). Passe `violations` **et** `tourneesNonCouvertes` en props à `GrillePlanning` et à `PanneauConflits`.

**Dépend de** : T2 (`evaluerCourant`), T3 (formulaire + squelette), T4 (grille + contrôles).

**Critères de sortie** (parcours écran complet, `npm run dev`) :
- Depuis un état sans planning : générer une période affiche **la grille remplie** + le **panneau de conflits** (ou « Aucun conflit »). Les compteurs (« X points d'attention », « Y créneaux non pourvus ») sont cohérents avec la grille.
- Le panneau distingue **erreurs** (dures) et **avertissements** (souples) par icône + libellé ; chaque message est celui du moteur, **non reformulé** ; l'ordre respecte celui du `Resultat` (erreurs d'abord).
- **Synchronisation panneau ↔ grille** : les cellules surlignées correspondent aux cibles des `violations` listées ; les cellules marquées « sous-couverte » correspondent aux entrées de `tourneesNonCouvertes` ; changer d'orientation conserve la cohérence (les mêmes diagnostics `{ violations, tourneesNonCouvertes }` — issus du `Resultat` de génération ou de `evaluerCourant` — sont passés tels quels à la grille et au panneau, sans dérivation).
- **Rechargement de la page** (F5) avec un planning existant : la grille réapparaît (auto-sélection du plus récent) et les conflits sont **recalculés** (`evaluerCourant`) — identiques à ceux d'avant rechargement pour les mêmes données, jamais lus depuis un stockage.
- Générer une **seconde** période bascule l'affichage sur la nouvelle proposition (grille + conflits mis à jour).
- Cas **infaisable** (retirer/désactiver assez de personnel) : pas de plantage, le panneau explique en clair les erreurs dures et la sous-couverture, la grille montre les cellules concernées.
- `npm run build` réussit ; aucun `localStorage` direct ; aucun appel moteur hors action de store.

## 10. Critères d'acceptation

- [ ] Depuis `/planning`, choisir une période et cliquer « Générer le planning » produit une proposition affichée dans la grille, en quelques centaines de millisecondes au plus, sans erreur JS.
- [ ] La proposition est **persistée** immédiatement comme `Planning` de statut `BROUILLON` (présente au rechargement) ; **aucun diagnostic** (violations/tournées non couvertes/score) n'est persisté.
- [ ] `parametresGeneration` du planning contient `Resultat.meta` (seed/variante), sans qu'aucune UI de seed/variante n'existe encore en `010`.
- [ ] La grille propose **2 orientations** (tournées × jours, personnes × jours) et **3 échelles** (jour / semaine / mois), toutes rendues comme la **même matrice lignes × jours** ; le **mois** est un tableau large **défilant horizontalement** avec **première colonne figée**.
- [ ] La navigation précédent/suivant décale la fenêtre selon l'échelle ; un retour à la période du planning est toujours possible.
- [ ] Chaque affectation est identifiée par **nom + pastille couleur** (jamais la couleur seule) ; la sous-couverture est signalée par **icône + libellé** ; les cellules concernées par une `Violation` sont **surlignées** via `Violation.cible` (bordure/fond/icône, pas la seule teinte).
- [ ] Le panneau de conflits affiche les `Violation` **telles quelles** (messages FR du moteur, non reformulés), en distinguant **erreurs (dures)** et **avertissements (souples)**, et résume les **tournées non couvertes**.
- [ ] Les états vides (aucune personne / aucune tournée active) guident vers l'écran concerné ; le bouton « Générer » est désactivé tant qu'il manque une donnée indispensable.
- [ ] Le formulaire de période valide `dateFin >= dateDebut` (Vuelidate, message FR orienté correction), avec défauts lundi→dimanche de la semaine prochaine ; aucune saisie perdue.
- [ ] L'appel au moteur passe **toujours** par une action du store (`plannings/genererPropose` / `plannings/evaluerCourant`) ; aucun import de `@/domain/scheduling` dans un composant ; aucun accès `localStorage` direct ; aucun objet `Date` hors `dateUtil`.
- [ ] `GrillePlanning` est en **lecture seule** : aucune interactivité d'édition, mais un slot scopé `cellule` (défaut = cellule lecture seule) prépare la greffe de `011`.
- [ ] `npm run build` réussit après chacune des 5 tâches.

## 11. Vérification

Parcours de bout en bout (`npm run dev`) :

1. **Pré-requis** : saisir dans Équipe (`004`) ≥ 2 personnes actives, dans Tournées (`006`) ≥ 1 tournée active applicable sur la période, régler le cabinet (`003`). Optionnel : quelques souhaits (`005`) et absences validées (`007`) pour observer des conflits.
2. **États vides** : désactiver toutes les personnes → `/planning` guide vers l'Équipe ; réactiver → le formulaire réapparaît. Idem en archivant toutes les tournées.
3. **Génération** : sur `/planning`, vérifier les dates pré-remplies (semaine prochaine, lundi→dimanche), cliquer « Générer le planning » ; observer l'indicateur de chargement puis la grille remplie et le panneau de conflits.
4. **Orientations & échelles** : basculer Tournées ↔ Personnes (mêmes affectations, présentation différente) ; basculer Jour/Semaine/Mois ; en Mois, faire défiler horizontalement et vérifier que la **première colonne reste figée**.
5. **Navigation** : précédent/suivant selon l'échelle ; « Aller à la période du planning » recentre la vue.
6. **Conflits** : provoquer une absence `VALIDE` recoupant une affectation et une sous-couverture (tournée `nbPersonnesRequises` > personnel disponible) ; vérifier que le panneau explique en clair (erreurs vs avertissements) et que les cellules concernées sont surlignées, cohérentes avec la grille.
7. **Persistance & rechargement** : recharger la page ; la dernière proposition réapparaît (auto-sélection) et les conflits sont **recalculés** (identiques). Vérifier via l'export JSON (`008`) que le `Planning` est bien présent **sans** diagnostics.
8. **Infaisabilité** : désactiver assez de personnel pour rendre la couverture impossible ; vérifier l'absence de plantage et un diagnostic clair.
9. **Build** : `npm run build` réussit après chaque tâche.

## 12. Décisions à confirmer / risques

1. **Usage de `/planning` en `010` = formulaire + grille lecture seule sur le même écran (retenu)** — Entrée unique : le formulaire de période reste en tête, la grille + le panneau s'affichent dessous dès qu'un planning courant existe. `011` enrichira ce même écran (édition) ; `012` ajoutera `/planning/:id/diffusion`. **À confirmer.**
2. **Auto-sélection du planning le plus récent au montage (retenu)** — `plannings.selectionId` n'étant pas persisté (`fromSaveDocument` le remet à `null`), au rechargement `getters.courant` est `null` malgré des `items` présents. `PlanningView` auto-sélectionne le planning au `createdAt` le plus récent. **À confirmer** ; alternative : un vrai sélecteur de planning (plutôt `011`/`013`).
3. **`tourneesNonCouvertes` recalculés via `diagnostiquer()` du moteur — RÉSOLU (arbitrage du porteur du produit)** — Décision tranchée : on **ajoute `diagnostiquer(affectations, entree)` → `{ violations, tourneesNonCouvertes, score }` à l'API publique de `009`** (§5.3, implémenté en §9 T1), et **non** une reconstruction des tournées non couvertes en UI à partir des violations `SOUS_COUVERTURE`. Le moteur reste **l'unique source de vérité** des diagnostics (zéro dérivation en UI) ; `genererPlanning` réutilise `diagnostiquer` (aucune duplication) ; `evaluerCourant` (§4.3) l'appelle au rechargement pour renvoyer la même structure que la partie diagnostics d'un `Resultat`. L'amendement de la surface publique de `009` (feature committée) est assumé et documenté (note d'amendement §9 T1). **Résolu.**
4. **Chaque « Générer » crée un nouveau `Planning` `BROUILLON` (retenu)** — Pas de régénération « en place » en `010` (c'est `011`). Risque mineur d'accumulation de brouillons si l'utilisateur génère plusieurs fois. Acceptable en v1 ; `011` introduira la régénération en place et, au besoin, un nettoyage. La mutation `REMOVE` est déjà prête. **À confirmer.**
5. **Le créneau est agrégé dans la cellule, l'axe temps = jours uniquement (retenu, KISS)** — Une matrice lignes × **jours** (pas jours × créneaux) pour les 3 échelles ; une cellule liste les affectations du jour (avec leur créneau en orientation Personnes). Simple, cohérent, réutilisable. L'échelle `JOUR` = une seule colonne. **À confirmer.**
6. **Jours fermés affichés (grisés) plutôt que masqués (retenu)** — La grille montre **tous** les jours calendaires de la fenêtre, les jours hors `joursOuverture` étant grisés/marqués « Fermé », pour un calendrier lisible et sans « trous » déroutants. **À confirmer** ; alternative : masquer les jours fermés (grille plus compacte mais moins repérable).
7. **Défaut de période lundi→dimanche vs `premierJourSemaine` cabinet (retenu tel que spécifié)** — Le défaut du formulaire est lundi→dimanche (semaine prochaine), conforme à la consigne produit ; le **regroupement** de la vue Semaine, lui, s'aligne sur `cabinet.premierJourSemaine` (défaut `1` = lundi, donc cohérent par défaut). **À confirmer** si l'on veut aligner aussi le défaut du formulaire sur `premierJourSemaine`.
8. **Nom du planning « Planning du JJ/MM/AAAA au JJ/MM/AAAA » (retenu, KISS)** — Évite un calcul de numéro de semaine ISO (absent de `dateUtil`) tout en gardant une entité auto-descriptive pour l'export/`012`. **À confirmer** ; l'exemple `02` (« Semaine 28 - 2026 ») nécessiterait un helper de numéro de semaine.
9. **Indicateur de chargement sur un moteur synchrone (retenu)** — La génération étant synchrone (< 300 ms), on bascule l'état « chargement » puis `await this.$nextTick()` avant `dispatch`, pour que l'indicateur soit peint. Suffisant en v1 ; un Web Worker reste hors v1 ([ROADMAP](ROADMAP.md)). **À confirmer.**
10. **`GrillePlanning` conçu pour `011` via slot scopé, sans événement d'édition en `010` (retenu)** — Le point de greffe est le slot `cellule` (contenu par défaut = cellule lecture seule, donc pas de code mort) ; les événements d'édition (`@deposer`, verrouillage, etc.) sont documentés mais **non émis** ici, pour éviter toute dépendance drag&drop prématurée. **À confirmer** avec `011` le moment venu.
