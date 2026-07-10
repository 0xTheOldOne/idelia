# Feature 0009 — Moteur de planification

- **Statut** : À faire
- **Dépend de** : `0002` (schema.js : entités `Personne`, `Preference` (imbriquée), `Tournee`, `Absence`, `Affectation`, `Planning`, `ParametresCabinet`, enums `CRENEAUX`/`TYPES_PREFERENCE`/`TYPES_ABSENCE`/`STATUTS_ABSENCE` ; conventions ISO ; `src/domain/utils/dates.js` (`dateUtil`), `src/domain/utils/id.js` (`genId`)). S'appuie aussi, **en lecture de contrat de données uniquement** (aucun import de store, aucune dépendance vers l'UI), sur les modules domaine déjà livrés : `0004` (forme de `Personne`, `src/domain/personnes.js`), `0005` (`src/domain/preferences.js` — `META_TYPES_PREFERENCE`, normalisation de `params`, `decrirePreference`), `0006` (`src/domain/tournees.js` — forme de `Tournee`, `joursApplication`), `0007` (`src/domain/absences.js` — **réutilise directement** `creneauxSeChevauchent`, `periodesSeChevauchent`), `src/domain/libelles.js` (libellés FR pour les messages). Le moteur **ignore tout** de `0010`/`0011` (aucune dépendance vers le store ou les composants — [ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)).
- **ADR liés** : [0008](../docs/adr/0008-moteur-planification-module-pur.md) (**décision fondatrice de cette feature** : le moteur est un module pur, sans Vue/Vuex, déterministe, testable en isolation), [0007](../docs/adr/0007-generation-planning-hybride.md) (mode hybride : `origine` AUTO/MANUEL et `verrouillee` sont un **input** du moteur — une régénération doit préserver ce que l'utilisateur a verrouillé), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7, dates `"YYYY-MM-DD"`, aucun objet `Date` dans les données manipulées), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS + JSDoc — cette feature **type intégralement** ses contrats via `@typedef`, sans TypeScript).

## 1. Contexte & objectif

L'équipe (`0004`), ses souhaits (`0005`), les tournées (`0006`) et les absences (`0007`) fournissent toutes les données de référence nécessaires à un planning, mais **aucun algorithme** n'existe encore pour les transformer en une proposition de planning. La feature `0009` livre ce **cœur algorithmique** : un module pur `src/domain/scheduling/` qui sait (1) **générer** une proposition de planning respectant au mieux les règles du cabinet et les souhaits de l'équipe, et (2) **valider** un planning existant (généré ou modifié à la main) en listant ses conflits **en langage clair**, prêts à être affichés tels quels par une future UI.

Point d'architecture central, hérité de [05-moteur-de-planification](../docs/architecture/05-moteur-de-planification.md) et de l'[ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md) : **un seul modèle de contraintes** (objets `Contrainte` évaluables) sert **à la fois** la génération et la validation — c'est la **source de vérité unique** de chaque règle métier, jamais dupliquée. La génération est **déterministe** (PRNG seedé) : même graine + mêmes données ⇒ même résultat, ce qui permettra plus tard à `0011` de proposer un geste rassurant (« Regénérer à l'identique » / « Essayer une variante »). Le moteur **ne plante jamais** : une situation impossible à satisfaire (trop peu de personnel, trop d'absences) se traduit par des violations résiduelles honnêtement remontées, jamais par une exception ni un blocage — c'est précisément ce qui permet le mode **hybride** ([ADR 0007](../docs/adr/0007-generation-planning-hybride.md)) : le moteur propose au mieux, l'humain ajuste.

**Cette feature ne comporte strictement aucun écran.** Elle livre des **fonctions pures**, consommées par `0010` (génération, choix de période + bouton « Générer » + affichage de la proposition et des conflits résiduels) puis `0011` (éditeur avec glisser-déposer et validation en temps réel). `0010`/`0011` porteront seuls l'expérience utilisateur ; `0009` se contente de fournir des résultats **déjà en français, déjà actionnables**, pour que ce travail d'UI soit simple.

**Hors périmètre `0009`** (à ne pas implémenter ici) :

- **Tout écran, toute route, toute modification du store Vuex** — différés à `0010`/`0011` (voir §4.1 pour le contrat d'intégration indicatif).
- **Validation incrémentale** (`validerIncrementale`, recalcul partiel au drag & drop) — v1 s'appuie sur une **validation complète** (`validerPlanning`), jugée suffisamment rapide aux volumes visés (voir §12, décision KISS assumée).
- **Recuit simulé** — glouton + recherche locale (hill-climbing + redémarrages) suffisent en v1 ; le recuit était mentionné « derrière un flag » dans `05`, explicitement écarté ici (KISS).
- **Report du repos légal au-delà des bornes de la période** (`planningPrecedent` n'est utilisé que pour l'heuristique de continuité, pas pour prolonger un décompte de repos/jours consécutifs au-delà de `periode.debut`) — voir §12.
- **Web Worker** — hors v1 par la [ROADMAP](../features/ROADMAP.md) ; le module étant pur, il s'y déplacera trivialement le jour où la génération dépasserait les volumes visés.
- **Tests automatisés** — hors périmètre v1 ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)), mais l'architecture pure les rend triviaux à ajouter plus tard ; les critères de sortie de `0009` (§9) sont formulés comme des cas entrée → sortie directement transposables en tests.

## 2. Écrans concernés

**Aucun écran.** `0009` est un module de `src/domain/`, sans composant Vue, sans route, sans dépendance au store. Il sera **consommé** par `0010` (génération, écran à créer) puis `0011` (éditeur, écran à créer), qui porteront l'expérience utilisateur (choix de période, lancement, affichage de la proposition, glisser-déposer, panneau de conflits). Cette section du gabarit est donc sans objet pour `0009` ; voir §6 pour l'organisation des fichiers du moteur, qui remplace ici la description habituelle des composants/écrans.

## 3. Modèle de données touché

**Aucune entité persistée nouvelle, aucun champ ajouté, aucun impact sur `schemaVersion`** (reste `1`). Le moteur **lit** les entités déjà définies ([02](../docs/architecture/02-modele-de-domaine.md)/[03](../docs/architecture/03-modele-de-donnees.md)) — `Personne`, `Preference` (imbriquée), `Tournee`, `Absence`, `ParametresCabinet` — et **produit** des objets `Affectation` déjà conformes à leur forme canonique (02 §Affectation) : `id`, `personneId`, `tourneeId`, `date`, `creneau`, `origine: 'AUTO'`, `verrouillee: false`, `commentaire: ''`, `createdAt`/`updatedAt`. Ces `Affectation` sont **prêtes à être déposées telles quelles** dans `planning.affectations` par `0010`, sans aucune transformation.

Le moteur introduit en revanche des structures **purement techniques**, qui **n'existent que dans `src/domain/scheduling/`** et ne sont **jamais sérialisées** (absentes du `SaveDocument`, jamais écrites en `localStorage`) : `Entree`, `Options`, `Resultat`, `Contrainte`, `Violation`, `NonCouverture`, `Demande`, `PlanningIndexe`. Elles sont définies en JSDoc dans `src/domain/scheduling/modele/types.js` (§6.1).

> **Note prospective** (aucune action requise ici) : le champ existant `Planning.parametresGeneration` (02 §Planning, « snapshot des réglages moteur, reproductibilité ») est le candidat naturel où `0010` stockera `Resultat.meta` (seed, variante…) pour permettre une régénération à l'identique. Ce câblage est laissé à `0010` — voir §4.1.

## 4. Store (Vuex)

**Aucune modification du store dans cette feature.** `src/store/modules/plannings.js` reste inchangé (`state: { items: [], selectionId: null }`, getters `byId`/`courant`, mutation `REPLACE`, `actions: {}`). Le moteur **n'importe ni ne dépend de Vuex** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)) : aucun fichier de `src/domain/scheduling/` ne référence `src/store/`.

### 4.1 Comment `0010`/`0011` brancheront le moteur (indicatif, non implémenté ici)

Ce paragraphe **documente le contrat d'intégration** pour que `0010` n'ait pas à redécouvrir les décisions de conception ; **rien ci-dessous n'est implémenté par `0009`**.

- `0010` ajoutera vraisemblablement une action `plannings/genererPropose({ dateDebut, dateFin, seed, variante })` qui : (1) rassemble une `Entree` (§6.1) à partir des getters déjà existants — `personnes/actifs`, `tournees/actives` (éventuellement affinées par un futur getter `tournees/applicablesSur(periode)`, à créer par `0010`), `absences/items` (le moteur filtre **lui-même** par statut, §7), `cabinet/parametres` (passé tel quel comme `reglesCabinet`) ; (2) appelle `genererPlanning(entree, options)` (import `@/domain/scheduling`) ; (3) construit un nouveau `Planning` via une fabrique `creerPlanning` **à créer par `0010`** (nouveau `src/domain/planning.js`, sur le modèle de `creerTournee`/`creerAbsence`) avec `affectations: resultat.affectations` et `parametresGeneration: resultat.meta` ; (4) `commit` l'ajout du planning (mutation à créer par `0010`, ex. `plannings/ADD`).
- `0011` appellera `validerPlanning(planning.affectations, entree)` **après chaque modification manuelle** (glisser-déposer, verrouillage) pour rafraîchir la liste de conflits affichée. Conformément à 02 (« les diagnostics ne sont jamais stockés »), le résultat de `validerPlanning` n'est **jamais persisté** : il est recalculé à la demande.
- Une **régénération** (`0011`, « essayer une variante » ou « regénérer ») passera les affectations `verrouillee: true` courantes de l'écran dans `entree.affectationsVerrouillees` (§6.1) pour que le moteur les **préserve à l'identique** — c'est le mécanisme qui matérialise le mode hybride ([ADR 0007](../docs/adr/0007-generation-planning-hybride.md)).

## 5. Domaine (logique pure)

Tout vit dans `src/domain/scheduling/`, module pur ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)) : **aucun import Vue/Vuex, aucun accès `localStorage`, aucune dépendance vers `src/store/`**. Organisation en sous-dossiers, adaptée de la conception de référence ([05](../docs/architecture/05-moteur-de-planification.md)) avec quelques simplifications KISS assumées (voir encadré ci-dessous et §12) :

```
src/domain/scheduling/
  index.js                    // API PUBLIQUE (seul point d'entrée pour 0010/0011)
  genererPlanning.js          // orchestrateur de génération
  validerPlanning.js          // validation complète (dures + souples)
  contraintes/
    index.js                  // creerContraintes(entree) : fabrique + registre + enum TYPES_CONTRAINTE
    contrainteAbsence.js          // absence VALIDE (dure) + absence DEMANDE (souple)
    contrainteChevauchement.js    // 1 personne <= 1 tournée par (date, créneau)
    contrainteCouverture.js       // effectif requis par tournée/jour/créneau
    contrainteReposLegal.js       // reposHebdoMin + maxJoursConsecutifs (cabinet)
    contrainteJourOuverture.js    // sécurité : affectation hors jour ouvert / créneau actif
    contraintePreference.js       // les 8 TYPES_PREFERENCE, dure OU souple selon preference.nature
    contrainteEquite.js           // écart de charge entre personnes (souple, globale)
    contrainteContinuite.js       // continuité personne/tournée d'un jour à l'autre (souple, globale)
  modele/
    types.js                  // TOUS les typedefs JSDoc (Entree, Options, Resultat, Contrainte, Violation…)
    affectation.js             // creerAffectationAuto(...) : fabrique interne d'Affectation
    planning.js                // indexer(affectations), appliquerChangement(affectations, changement)
    demande.js                 // expanserDemandes(entree) : expansion en unités de demande
    messages.js                // code -> message FR (réutilise domain/libelles.js et decrirePreference)
  heuristiques/
    scoring.js                 // calculerScore(violations), agrégation des pénalités souples
    glouton.js                 // constructionGloutonne(...) + tri MRV
    rechercheLocale.js         // ameliorerLocalement(...) : hill-climbing + redémarrages seedés
  utils/
    rng.js                     // creerRng(seed) : PRNG pur seedé (mulberry32 ou équivalent)
    dates.js                   // helpers d'expansion de période spécifiques au moteur (au-dessus de dateUtil)
```

> **Écarts volontaires (KISS) par rapport à `05` §7** : (1) un **seul** fichier `contraintePreference.js` couvre les **8** `TYPES_PREFERENCE` (une fonction d'évaluation interne par type), plutôt qu'un fichier par type — chaque `case` reste petit et isolé, et la **dureté** (`DURE`/`SOUPLE`) est de toute façon **portée par la donnée** (`preference.nature`, éditable par le référent en `0005`), jamais par un fichier figé : un fichier par type n'apporterait ici aucune clarté supplémentaire. (2) Ajout de `contrainteJourOuverture.js`, absent du catalogue `05` : sécurité pour qu'une affectation **manuelle** (posée en `0011`, hors du contrôle du glouton) tombant un jour fermé/un créneau inactif soit **signalée**. (3) `validerIncrementale` n'est **pas** livré en `0009` (§12).

### 5.1 Principe directeur (rappel opérationnel)

Une **contrainte** = un objet `Contrainte` évaluable, instancié par `creerContraintes(entree)` (§5.9), qui expose au minimum `evaluer(ctx)` (§5.10 le décrit précisément). C'est la **seule** source de vérité de la règle qu'elle représente : `genererPlanning` s'en sert pour filtrer/pondérer les candidats **pendant** la construction, `validerPlanning` s'en sert pour produire les violations **après coup**. On ne réécrit jamais deux fois la même règle métier.

### 5.2 `modele/types.js` — tous les contrats (JSDoc)

Fichier qui centralise l'intégralité des `@typedef` du moteur (aucune exécution, uniquement de la documentation de types — [ADR 0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md)). Les noms `Entree`/`Options`/`Resultat` reprennent le contrat de [05 §2](../docs/architecture/05-moteur-de-planification.md#2-entrée--sortie), avec `Input` renommé en `Entree` par cohérence avec la convention « domaine en français » ([nommage-et-conventions](../docs/instructions/nommage-et-conventions.md)) — même forme, aucun changement de fond.

```js
/**
 * @typedef {Object} Entree
 * @property {{debut: string, fin: string}} periode          // "YYYY-MM-DD" inclusifs
 * @property {Personne[]} personnes                          // déjà filtrées "actives" par l'appelant
 * @property {Tournee[]}  tournees                           // déjà filtrées "non archivées" par l'appelant
 * @property {Absence[]}  absences                           // toutes ; le moteur filtre lui-même par statut
 * @property {ParametresCabinet} reglesCabinet                // cabinet.parametres tel quel
 * @property {Object} [poids]                                 // surcharge partielle des poids souples par défaut (§7.5)
 * @property {Planning} [planningPrecedent]                   // pour l'heuristique de continuité uniquement (§7.9)
 * @property {Affectation[]} [affectationsVerrouillees]       // préservées telles quelles (mode hybride, ADR 0007)
 *
 * @typedef {Object} Options
 * @property {number} [seed=0]
 * @property {number} [variante=0]
 * @property {number} [budgetMs=200]                          // budget de la recherche locale (anytime)
 *
 * @typedef {'erreur'|'avertissement'} Severite
 * @typedef {Object} Violation
 * @property {string}   contrainteId
 * @property {Severite} severite
 * @property {Object}   cible        // { personneId?, tourneeId?, date?, creneau? }
 * @property {string}   code         // stable, ex. 'ABSENCE_VALIDEE' (voir modele/messages.js)
 * @property {string}   message      // FR, prêt à afficher tel quel
 * @property {number}   penalite     // souples : poids * amplitude ; dures : 0
 * @property {Object}   [params]     // données brutes (debug / reconstruction du message)
 *
 * @typedef {Object} NonCouverture
 * @property {string} date
 * @property {string} creneau
 * @property {string} tourneeId
 * @property {number} requis
 * @property {number} affectes
 * @property {number} manque
 *
 * @typedef {Object} Resultat
 * @property {Affectation[]}   affectations          // liste PLATE, JSON-sérialisable (inclut les verrouillées, inchangées)
 * @property {Violation[]}     violations            // triées : erreurs d'abord, puis avertissements par pénalité décroissante
 * @property {number}          score                 // somme pondérée des pénalités souples (bas = mieux)
 * @property {NonCouverture[]} tourneesNonCouvertes
 * @property {Object}          meta                  // { seed, variante, dureeMs, faisable, nbErreursDures }
 *
 * @typedef {'dure'|'souple'} Durete
 * @typedef {'cellule'|'creneau'|'personne-periode'|'global'} Granularite
 * @typedef {Object} Contrainte
 * @property {string}       id            // stable : ex. 'chevauchement', 'pref-<preferenceId>'
 * @property {string}       type          // catégorie métier, voir TYPES_CONTRAINTE (contraintes/index.js)
 * @property {Durete}       durete
 * @property {number}       [poids]       // souples uniquement
 * @property {Granularite}  granularite   // portée d'impact (prépare une future validation incrémentale)
 * @property {(ctx: ContexteEvaluation) => Violation[]} evaluer              // SOURCE DE VÉRITÉ
 * @property {(personneId: string, demande: Demande, ctx: ContexteEvaluation) => boolean} [autoriseAffectation] // dures
 * @property {(personneId: string, demande: Demande, ctx: ContexteEvaluation) => number}  [coutMarginal]        // souples
 *
 * @typedef {Object} Demande            // unité de demande : UN slot à pourvoir
 * @property {string} id                // ex. `${tourneeId}|${date}|${creneau}|${index}`
 * @property {string} date
 * @property {number} jourIso           // 1..7 (ADR 0010)
 * @property {string} creneau
 * @property {string} tourneeId
 * @property {number} index             // 0..nbPersonnesRequises-1
 *
 * @typedef {Object} PlanningIndexe
 * @property {Affectation[]} affectations
 * @property {Map<string, Affectation[]>} parCreneau              // clé `${date}|${creneau}`
 * @property {Map<string, Affectation[]>} parPersonne              // clé personneId
 * @property {Map<string, Affectation[]>} parTournee               // clé tourneeId
 * @property {Map<string, Set<string>>}   joursTravaillesParPersonne // clé personneId -> Set de dates
 *
 * @typedef {Object} ContexteEvaluation
 * @property {Entree}        entree
 * @property {PlanningIndexe} index
 * @property {Demande[]}     demandes
 * @property {string[]}      joursPeriode   // dates "YYYY-MM-DD" des jours OUVERTS de la période, triées
 *
 * @typedef {Object} Changement
 * @property {'AJOUTER'|'RETIRER'|'DEPLACER'} type
 * @property {Affectation} [affectation]     // AJOUTER/DEPLACER : affectation à sa nouvelle position
 * @property {string}      [affectationId]   // RETIRER/DEPLACER : id de l'affectation d'origine
 */
```

> **Jours** : dans tout le moteur, les jours de semaine sont en **ISO 1-7** ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)) ; toute date manipulée est une chaîne `"YYYY-MM-DD"`, jamais un objet `Date` (celui-ci ne peut apparaître que **dans** `src/domain/utils/dates.js`, jamais ici — le moteur **appelle** `dateUtil`, il ne réimplémente rien).

### 5.3 `modele/affectation.js`

`creerAffectationAuto(personneId, tourneeId, date, creneau)` → `Affectation` : fabrique interne, pure hors `genId()`/`new Date().toISOString()` (concession technique déjà tolérée dans tout le domaine — `schema.js`/`personnes.js`/`tournees.js`/`absences.js`). Pose `origine: 'AUTO'`, `verrouillee: false`, `commentaire: ''`. C'est la **seule** façon dont le glouton/la recherche locale créent une `Affectation` — garantit que toute sortie du moteur est déjà conforme à 02 §Affectation, sans transformation ultérieure nécessaire côté `0010`.

### 5.4 `modele/demande.js`

`expanserDemandes(entree)` → `Demande[]` : construit la liste **plate** des unités de demande sur la période. Pour chaque jour de `entree.periode` qui est un **jour d'ouverture** du cabinet (`entree.reglesCabinet.joursOuverture`, via `dateUtil.weekdayISO`), pour chaque `Tournee` de `entree.tournees` **applicable ce jour** (`jourIso ∈ tournee.joursApplication`, et `date` comprise dans `[tournee.dateDebutValidite, tournee.dateFinValidite]` quand ces bornes sont renseignées), crée `tournee.nbPersonnesRequises` unités `Demande` (`index` de `0` à `nbPersonnesRequises - 1`), une par personne requise — c'est ce découpage **par slot** qui garantit structurellement que le moteur **n'affecte jamais plus que le requis** (05 §Couverture). Exporte aussi `joursPeriode(entree)` → `string[]` (jours ouverts de la période, triés), réutilisé pour construire `ContexteEvaluation.joursPeriode`.

> `entree.reglesCabinet.creneauxActifs` **n'est pas utilisé** comme filtre ici (voir §12, décision) : chaque `Tournee` porte déjà son propre `creneau` valide, posé à sa création (`0006`).

### 5.5 `modele/planning.js`

- **`indexer(affectations)`** → `PlanningIndexe` : construit les `Map`/`Set` d'index à partir du tableau plat `affectations` (jamais l'inverse — les index ne sont **jamais stockés**, toujours recalculés, cf. 05 §7). `joursTravaillesParPersonne` sert à l'équité et au repos légal.
- **`appliquerChangement(affectations, changement)`** → `Affectation[]` : renvoie un **nouveau** tableau (immuable) reflétant un `AJOUTER`/`RETIRER`/`DEPLACER`. En v1, implémentation volontairement simple (KISS, §12) : reconstruit le tableau plutôt que de maintenir les `Map` en delta — l'appelant ré-indexe (`indexer`) puis revalide (`validerPlanning`) au besoin. Fait partie de l'API publique dès `0009` pour que `0011` n'ait pas à la réinventer, même si son usage réel commence en `0011`.

### 5.6 `modele/messages.js`

Table `code → gabarit` et fonction **`messagePour(code, params)`** → `string` FR, séparant `code` (stable, utilisé par `Violation.code`) et `message` (texte affiché) — prêt pour une future i18n, cf. 05 §Violation. Réutilise `src/domain/libelles.js` (`libelleTypeAbsence`, `libelleCreneau`, `libelleJour`) et **`decrirePreference`** de `src/domain/preferences.js` pour bâtir les messages des violations de préférence (§7.6) sans dupliquer de phrasé — un souhait « Ne travaille pas le mercredi » (`decrirePreference`) devient par exemple : « Claire Martin — Ne travaille pas le mercredi — mais est affectée le mercredi 12/08/2026 (Matin). ». Chaque contrainte (§7) précise le(s) `code`(s) qu'elle produit ; `messages.js` en tient le catalogue complet.

### 5.7 `utils/rng.js`

**`creerRng(seed)`** → fonction `() => number` renvoyant un flottant déterministe dans `[0, 1)` à chaque appel (algorithme type **mulberry32**, pur, sans dépendance externe). **Jamais** `Math.random`/`Date.now` dans tout le moteur ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md), 05 §6) : tout aléa (départage MRV, ordre de parcours, redémarrages de la recherche locale) passe par cette unique fonction, appelée dans un ordre **stable** (jamais d'itération non triée d'objet/`Map`/`Set` avant consommation du RNG).

### 5.8 `utils/dates.js` (spécifique au moteur — distinct de `src/domain/utils/dates.js`)

Petites fonctions qui **combinent** `dateUtil` (jamais ne le réimplémentent) pour les besoins de l'expansion : `estJourOuvert(date, joursOuverture)` (via `dateUtil.weekdayISO`), `estDansPlage(date, debut, fin)` (bornes optionnelles, comparaison de chaînes `"YYYY-MM-DD"` comme dans `absences.js`), `semaineIsoDe(date)` (regroupement en semaines calendaires ISO Lundi→Dimanche, pour `contrainteReposLegal.js` et `contraintePreference.js` cas `NB_JOURS_SEMAINE`). Aucun objet `Date` ne doit apparaître dans ce fichier hors des appels à `dateUtil`.

### 5.9 `contraintes/index.js` — fabrique `creerContraintes(entree)`

`creerContraintes(entree)` → `Contrainte[]` : instancie, dans cet ordre, (1) les contraintes **fixes** du cabinet (une instance chacune : `absence-validee`, `absence-demandee`, `chevauchement`, `couverture`, `repos-legal`, `jour-ouverture`, `equite`, `continuite`), puis (2) **une contrainte par préférence active** (`preference.actif === true`) de **chaque personne active** de `entree.personnes` (`id: 'pref-' + preference.id`, `durete: preference.nature`, `poids: preference.nature === 'SOUPLE' ? preference.poids : undefined`). Exporte aussi l'enum **`TYPES_CONTRAINTE`** (les valeurs possibles de `Contrainte.type`, un par fichier + un par `TYPES_PREFERENCE`). **Cette liste est strictement identique** que l'appelant soit `genererPlanning` ou `validerPlanning` — jamais deux listes distinctes (05 §Principe directeur).

### 5.10 `validerPlanning.js`

**`validerPlanning(affectations, entree)`** → `Violation[]` : construit `ctx` (`{ entree, index: indexer(affectations), demandes: expanserDemandes(entree), joursPeriode: joursPeriode(entree) }`), appelle `evaluer(ctx)` de **chaque** contrainte de `creerContraintes(entree)`, concatène et **trie** le résultat (erreurs d'abord, puis avertissements par `penalite` décroissante). Fonction **pure et déterministe**, directement consommable par une future UI (`cible` permet de surligner une cellule, `message` est prêt à afficher).

> Nuance de nommage volontaire par rapport à `05` (qui nommait ce premier paramètre `planning`) : `validerPlanning` prend directement **`affectations`** (`Affectation[]`), pas une entité `Planning` complète. Cela permet à `0011` de valider un tableau d'affectations **en cours de modification** (avant tout `commit`), utile pour un aperçu en temps réel — voir §12.

### 5.11 `heuristiques/scoring.js`

- **`calculerScore(violations)`** → `number` : somme des `penalite` des violations `avertissement` (les `erreur` ont `penalite: 0`, elles ne participent pas au score mais comptent dans `meta.nbErreursDures`). Bas = mieux.
- Fonctions internes utilisées par le glouton/la recherche locale : agrégation du **coût marginal** d'assigner une `personneId` à une `Demande` = somme des `coutMarginal(personneId, demande, ctx)` de toutes les contraintes **souples légales** pour ce candidat (celles dont `autoriseAffectation` — si elle existe — a déjà validé le candidat en amont).

### 5.12 `heuristiques/glouton.js`

**`constructionGloutonne(demandes, contraintes, ctx, rng)`** → `Affectation[]` (inclut d'emblée `entree.affectationsVerrouillees`). Algorithme **MRV** (Minimum Remaining Values), fidèle à [05 §3](../docs/architecture/05-moteur-de-planification.md#3-génération) :

1. Retirer de `demandes` celles déjà couvertes par une affectation verrouillée (même tournée/date/créneau).
2. Trier les demandes restantes par **nombre de candidats légaux croissant** (ties départagées par le RNG seedé — jamais par l'ordre naturel du tableau).
3. Pour chaque demande, dans cet ordre : calculer les candidats légaux = personnes pour lesquelles **toutes** les contraintes dures dont `autoriseAffectation` existe renvoient `true` (absence validée, chevauchement, repos légal **dynamique** — recalculé au fil des affectations déjà posées —, préférences `DURE`). Si aucun candidat : marquer la demande **non couverte** (aucune exception) et continuer. Sinon, choisir le candidat au **coût marginal souple minimal** (`heuristiques/scoring.js`), départage par RNG seedé si égalité ; poser l'affectation (`creerAffectationAuto`) ; mettre à jour les compteurs (jours travaillés, historique de continuité).

> **Point de vigilance repris de `05`** : les contraintes dures **temporelles** (repos, jours consécutifs) doivent être **re-vérifiées dynamiquement** à chaque affectation posée, pas seulement pré-filtrées une fois en début de génération.

### 5.13 `heuristiques/rechercheLocale.js`

**`ameliorerLocalement(affectations, contraintes, ctx, rng, budgetMs)`** → `Affectation[]` : améliore le résultat du glouton **sans jamais casser une contrainte dure**, ni jamais déplacer/retirer une affectation `verrouillee: true`. Voisinage à 3 mouvements (05 §3) : **`REASSIGNER`** (changer la personne d'une affectation existante), **`ECHANGER`** (permuter les personnes de deux affectations), **`DEPLACER`** (déplacer une personne vers un slot légal non couvert). Boucle **anytime** : hill-climbing (n'accepte un mouvement que s'il baisse le score ou couvre un slot vide sans casser de dure) avec **redémarrages seedés** tant que `budgetMs` (défaut `200`) n'est pas écoulé ; conserve le **meilleur** résultat rencontré. Pas de recuit simulé en v1 (§12).

### 5.14 `genererPlanning.js`

**`genererPlanning(entree, options = {})`** → `Resultat`. Orchestrateur, fidèle au pseudocode de [05 §3](../docs/architecture/05-moteur-de-planification.md#3-génération) :

```
genererPlanning(entree, options):
  debut       = horodatage de départ (pour meta.dureeMs)
  rng         = creerRng((options.seed ?? 0) + (options.variante ?? 0))
  contraintes = creerContraintes(entree)
  demandes    = expanserDemandes(entree)
  affectations = constructionGloutonne(demandes, contraintes, ctx0, rng)   // inclut les verrouillées
  affectations = ameliorerLocalement(affectations, contraintes, ctx0, rng, options.budgetMs ?? 200)
  violations   = validerPlanning(affectations, entree)                     // MÊME validateur que 5.10
  nonCouvertes = calculerNonCouvertures(demandes, indexer(affectations))   // exporté par contrainteCouverture.js, réutilisé ici
  return {
    affectations, violations,
    score: calculerScore(violations),
    tourneesNonCouvertes: nonCouvertes,
    meta: { seed: (options.seed ?? 0) + (options.variante ?? 0), variante: options.variante ?? 0,
            dureeMs: horodatage - debut, faisable: violations.every(v => v.severite !== 'erreur'),
            nbErreursDures: violations.filter(v => v.severite === 'erreur').length },
  }
```

> **`meta.dureeMs`** se mesure via `performance.now()`/`Date.now()` — seule concession technique tolérée pour du **chronométrage** (comme `genId()`/`toISOString()` ailleurs), sans impact sur le déterminisme du **résultat** (le chronométrage n'influence jamais une décision d'affectation). **`meta.seed`** est la graine **effective** utilisée par `creerRng` : la repasser telle quelle en `options.seed` (avec `variante: 0`) reproduit exactement le même résultat.

### 5.15 `index.js` — API publique (surface minimale et stable)

```js
export { genererPlanning } from './genererPlanning.js';
export { validerPlanning } from './validerPlanning.js';
export { creerContraintes, TYPES_CONTRAINTE } from './contraintes/index.js';
export { calculerScore } from './heuristiques/scoring.js';
export { indexer, appliquerChangement } from './modele/planning.js';
```

`0010`/`0011` **n'importent que depuis `@/domain/scheduling'`** (jamais un sous-fichier interne directement) — surface stable, réorganisation interne possible sans casser les appelants.

## 6. Composants

**Aucun composant Vue.** Conformément à la consigne, cette section décrit les **modules/fichiers** du moteur plutôt que des composants — le détail complet (responsabilité de chaque fichier, signatures) est en §5 ; le tableau ci-dessous n'en est qu'un résumé de navigation.

| Dossier | Rôle |
|---|---|
| `scheduling/` (racine) | API publique + orchestrateurs (`genererPlanning`, `validerPlanning`) |
| `scheduling/contraintes/` | Le modèle de contraintes — catalogue détaillé en §7 |
| `scheduling/modele/` | Types, fabrique d'`Affectation`, indexation, expansion de la demande, messages FR |
| `scheduling/heuristiques/` | Algorithmes (glouton, recherche locale, scoring) |
| `scheduling/utils/` | RNG seedé, helpers de dates spécifiques au moteur |

## 7. Règles de validation

Ici, « règles de validation » = le **catalogue des contraintes** évaluées par le moteur (pas de Vuelidate : aucun formulaire dans cette feature). Chaque ligne = une **source de vérité unique**, partagée génération/validation (§5.1).

### 7.1 Contraintes dures (fixes, niveau cabinet)

| Contrainte (`id`) | Fichier | Granularité | Règle | Code(s) `Violation` |
|---|---|---|---|---|
| `absence-validee` | `contrainteAbsence.js` | `cellule` | Une `Absence` au statut `VALIDE` de la personne, dont la période/le créneau chevauchent la demande (réutilise `periodesSeChevauchent`/`creneauxSeChevauchent` de `domain/absences.js`), **interdit** l'affectation. | `ABSENCE_VALIDEE` |
| `chevauchement` | `contrainteChevauchement.js` | `creneau` | Une personne ne peut être affectée qu'à **une seule** tournée par (date, créneau) — deux créneaux se chevauchent selon la même règle que `creneauxSeChevauchent` (`JOURNEE` chevauche tout). | `CHEVAUCHEMENT` |
| `couverture` | `contrainteCouverture.js` | `creneau` | L'effectif requis (`nbPersonnesRequises`) doit être atteint par tournée/jour/créneau. **Jamais de crash** : une sous-couverture est reportée en `tourneesNonCouvertes` **et** en `Violation` (`erreur`) ; on n'affecte **jamais plus** que le requis (garanti structurellement par l'expansion en unités de demande, §5.4). | `SOUS_COUVERTURE` |
| `repos-legal` | `contrainteReposLegal.js` | `personne-periode` | `reglesCabinet.reposHebdoMin` (jours de repos par semaine ISO, sur l'intersection avec la période) et `reglesCabinet.maxJoursConsecutifs` (jours de travail d'affilée, toutes tournées confondues) — vérifiés **dynamiquement** pendant la génération, et intégralement en validation. | `REPOS_HEBDO_INSUFFISANT`, `TROP_JOURS_CONSECUTIFS` |
| `jour-ouverture` | `contrainteJourOuverture.js` | `cellule` | Sécurité : toute affectation (y compris `MANUEL`, posée par `0011`) doit tomber un jour de `reglesCabinet.joursOuverture`. La génération ne produit jamais un tel cas (filtré en amont par `expanserDemandes`) ; cette contrainte protège la **validation** d'un planning modifié à la main. | `JOUR_FERME` |

### 7.2 Contrainte dure/souple générique : les préférences (`preference.nature`)

**Contrainte-clé de la personnalisation** : conformément à `0005` (une `Preference` a un `nature` **choisi par le référent**, `DURE` ou `SOUPLE`, quel que soit son `type`), le moteur instancie **une contrainte par préférence active**, dont la **dureté est celle de la donnée**, pas d'un catalogue figé. `contraintePreference.js` route sur `preference.type` :

| `type` (`TYPES_PREFERENCE`) | Règle évaluée | Code |
|---|---|---|
| `JOUR_OFF_RECURRENT` | Jamais affecté un jour ISO ∈ `params.joursSemaine`. | `PREFERENCE_JOUR_OFF_RECURRENT` |
| `CRENEAU_OFF` | Jamais affecté sur un créneau ∈ `params.creneaux` (les jours de `params.joursSemaine` si précisés, sinon tous les jours). | `PREFERENCE_CRENEAU_OFF` |
| `INDISPO_HEBDO` | Jamais affecté les jours ∈ `params.joursSemaine`, sur les créneaux ∈ `params.creneaux` (tous les créneaux si non précisé). | `PREFERENCE_INDISPO_HEBDO` |
| `MAX_JOURS_CONSECUTIFS` | Surcharge **personnelle** du maximum de jours d'affilée (`params.max`), en plus du `reglesCabinet.maxJoursConsecutifs` cabinet — la plus stricte des deux s'applique. | `PREFERENCE_MAX_JOURS_CONSECUTIFS` |
| `MIN_JOURS_CONSECUTIFS` | Une séquence de jours travaillés strictement inférieure à `params.min`, **suivie d'un jour non travaillé dans la période**, est signalée (limite documentée §12 : les séquences en bord de période ne sont pas évaluées, faute de visibilité au-delà). | `PREFERENCE_MIN_JOURS_CONSECUTIFS` |
| `JOURS_REPOS_SOUHAITES` | Affecté un jour ∈ `params.joursSemaine` (souhait de repos non tenu). | `PREFERENCE_JOURS_REPOS_SOUHAITES` |
| `NB_JOURS_SEMAINE` | Nombre de jours distincts travaillés, par semaine calendaire ISO intersectant la période, hors bornes `[params.min, params.max]` (bornes optionnelles indépendamment). | `PREFERENCE_NB_JOURS_SEMAINE` |
| `PREFERENCE_TOURNEE` | `sens: 'PREFERE'` : affecté à une tournée ∉ `params.tourneeIds`. `sens: 'EVITE'` : affecté à une tournée ∈ `params.tourneeIds`. | `PREFERENCE_TOURNEE` |

> Chaque message réutilise **`decrirePreference(preference)`** (`0005`, `src/domain/preferences.js`) pour rester cohérent avec le phrasé déjà utilisé dans l'écran Souhaits, complété du contexte de la violation (personne, date, créneau) — voir §5.6.

### 7.3 Contraintes souples globales (fixes, niveau cabinet)

| Contrainte (`id`) | Fichier | Règle | Poids par défaut | Code |
|---|---|---|---|---|
| `absence-demandee` | `contrainteAbsence.js` | Une `Absence` au statut `DEMANDE` (jamais `REFUSE`, totalement ignorée) chevauchant une affectation produit un **avertissement**, jamais un blocage. | `5` (fixe, non pondérable par le référent — donnée du domaine, pas une préférence) | `ABSENCE_DEMANDEE` |
| `equite` | `contrainteEquite.js` | Écart de charge (nombre de créneaux affectés, pondéré par `personne.quotite / 100`) entre personnes actives comparables ; une `Violation` par personne dont l'écart à la moyenne de l'équipe dépasse un seuil raisonnable (`cible: { personneId }`, actionnable par `0011`). | `4` | `EQUITE_DESEQUILIBREE` |
| `continuite` | `contrainteContinuite.js` | Favorise de garder la **même personne** sur une tournée d'un jour ouvré au suivant (utilise `entree.planningPrecedent` pour le premier jour de la période, sinon les jours déjà posés dans la génération courante, 05 point 6). Impact principalement sur le **coût marginal** pendant la génération ; les violations produites en validation restent de faible pénalité. | `2` | `CONTINUITE_ROMPUE` |

**Poids par défaut** exportés par `contraintes/index.js` (`POIDS_SOUPLES_PAR_DEFAUT = { absenceDemandee: 5, equite: 4, continuite: 2 }`), **surchargeables partiellement** par `entree.poids` (fusion superficielle). Les poids des préférences `SOUPLE` (§7.2) viennent, eux, **toujours** de `preference.poids` (1..10, choisi par le référent en `0005`) — jamais d'un défaut global.

### 7.4 Invariant transversal — jamais de crash, même sur une dure

Généralisation du principe « couverture & infaisabilité » de `05` à **toute** contrainte dure : dans un scénario limite (effectif structurellement insuffisant, chevauchement d'absences inévitable), le moteur **ne bloque jamais** la génération pour préserver une dure — il fait au mieux et **remonte honnêtement** la ou les violations dures résiduelles dans `Resultat.violations` (comptées dans `meta.nbErreursDures`, `meta.faisable = false`), à charge pour l'utilisateur d'ajuster manuellement (mode hybride, [ADR 0007](../docs/adr/0007-generation-planning-hybride.md)). Ce comportement doit être **explicitement vérifié** (§9, critères de sortie).

## 8. Points d'attention ergonomie

Aucun écran ici : l'ergonomie de `0009` est **indirecte**, mais conditionne directement la qualité de l'expérience que `0010`/`0011` pourront offrir à un public peu à l'aise avec l'informatique ([08-principes-ux-ergonomie](../docs/architecture/08-principes-ux-ergonomie.md)) :

- **Messages déjà en français, déjà actionnables** : chaque `Violation.message` doit pouvoir être affiché **tel quel** par `0010`/`0011`, sans reformulation — aucun jargon technique (« contrainte dure violée »), toujours le vocabulaire du glossaire (personne, tournée, créneau, absence) et le contexte utile (qui, quand, quoi).
- **Jamais de plantage visible** : le principe « jamais de crash » (§7.4) est ce qui évite à l'utilisateur final un écran blanc ou une erreur JS incompréhensible face à une situation réellement impossible à satisfaire — le moteur transforme toujours l'impossible en un **diagnostic clair** à ajuster à la main.
- **Réactivité perçue** : `budgetMs` (200 ms par défaut) et la cible globale « génération < 300 ms » (05 §5) sont ce qui permettra à `0010` d'afficher un résultat quasi instantané, sans indicateur de chargement anxiogène.
- **Déterminisme = confiance** : pouvoir « Regénérer à l'identique » (même seed) ou « Essayer une variante » (seed incrémenté) est un geste **rassurant** pour un utilisateur non-technique (« je peux revenir à la proposition précédente ») — rendu possible uniquement parce que le moteur est rigoureusement déterministe (§5.7).
- **Cohérence des messages avec l'existant** : réutiliser `decrirePreference`/`libelleTypeAbsence`/`libelleCreneau`/`libelleJour` (§5.6) garantit que le vocabulaire d'un conflit de planning (`0010`/`0011`) est **identique** à celui déjà vu par l'utilisateur dans les écrans Souhaits/Absences/Tournées.

## 9. Étapes d'implémentation

Découpage en **5 tâches**, chacune destinée à **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre **strictement imposé** par les dépendances : **T1 → T2 → T3 → T4 → T5**. Le projet n'ayant pas de suite de tests automatisés en v1, chaque critère de sortie est formulé comme un **cas entrée → sortie concret**, vérifiable en import dynamique depuis la console du navigateur pendant `npm run dev` (voir §11) ou par raisonnement d'invariant sur le code relu.

### Tâche 1 — Fondations : types, fabrique d'Affectation, indexation, expansion de la demande, RNG

**Fichiers** (tous **créer**) :
- `src/domain/scheduling/modele/types.js` — tous les `@typedef` du §5.2 (aucun export exécutable requis à part, éventuellement, des constantes de forme si utile).
- `src/domain/scheduling/modele/affectation.js` — `creerAffectationAuto(personneId, tourneeId, date, creneau)`.
- `src/domain/scheduling/modele/planning.js` — `indexer(affectations)`, `appliquerChangement(affectations, changement)`.
- `src/domain/scheduling/modele/demande.js` — `expanserDemandes(entree)`, `joursPeriode(entree)`.
- `src/domain/scheduling/utils/rng.js` — `creerRng(seed)`.
- `src/domain/scheduling/utils/dates.js` — `estJourOuvert`, `estDansPlage`, `semaineIsoDe` (§5.8).

**Critères de sortie** :
- `creerRng(42)` renvoie une **fonction** ; appelée 5 fois de suite elle produit 5 flottants dans `[0, 1)` ; `creerRng(42)` rappelée depuis zéro reproduit **exactement** la même séquence ; `creerRng(1)` produit une séquence **différente** de `creerRng(42)`.
- `expanserDemandes(entree)` avec une période d'une semaine, un cabinet ouvert du lundi au samedi (`joursOuverture: [1,2,3,4,5,6]`), une tournée `joursApplication: [1,3,5]` et `nbPersonnesRequises: 2` produit exactement **6** `Demande` (3 jours × 2 slots), avec des `id` uniques et `jourIso` cohérent avec `dateUtil.weekdayISO` ; **aucune** `Demande` un dimanche (jour fermé) ni un jour hors `joursApplication`.
- Une tournée avec `dateDebutValidite`/`dateFinValidite` ne génère de `Demande` que dans cette plage.
- `indexer(affectations)` avec 2 affectations de la même personne à des dates différentes renvoie un `PlanningIndexe` dont `parPersonne.get(personneId)` contient les 2, et `joursTravaillesParPersonne.get(personneId)` est un `Set` de taille 2.
- `appliquerChangement(affectations, { type: 'AJOUTER', affectation })` renvoie un **nouveau** tableau contenant l'affectation ajoutée, **sans muter** `affectations` d'origine ; `RETIRER`/`DEPLACER` se comportent symétriquement.
- `creerAffectationAuto(...)` renvoie un objet avec **tous** les champs de 02 §Affectation (`id`, `personneId`, `tourneeId`, `date`, `creneau`, `origine: 'AUTO'`, `verrouillee: false`, `commentaire: ''`, `createdAt`, `updatedAt`).
- Aucun import Vue/Vuex ; aucun accès `localStorage` ; aucun `new Date("YYYY-MM-DD")` ni `Date.getDay()` non converti ; `npm run build` réussit.

### Tâche 2 — Contraintes cabinet (dures fixes) : absence, chevauchement, couverture, repos légal, jour d'ouverture

**Fichiers** (tous **créer**) :
- `src/domain/scheduling/contraintes/contrainteAbsence.js` — `creerContrainteAbsenceValidee()` (dure) et `creerContrainteAbsenceDemandee()` (souple, poids fixe `5`).
- `src/domain/scheduling/contraintes/contrainteChevauchement.js` — `creerContrainteChevauchement()`.
- `src/domain/scheduling/contraintes/contrainteCouverture.js` — `creerContrainteCouverture()`, et **exporte** `calculerNonCouvertures(demandes, planningIndexe)` (réutilisée par `genererPlanning.js` en T5).
- `src/domain/scheduling/contraintes/contrainteReposLegal.js` — `creerContrainteReposLegal()`.
- `src/domain/scheduling/contraintes/contrainteJourOuverture.js` — `creerContrainteJourOuverture()`.
- `src/domain/scheduling/modele/messages.js` — `messagePour(code, params)` couvrant au moins les codes de ces 5 contraintes (§7.1).

**Dépend de** : T1 (types, `indexer`, `expanserDemandes`, `dates.js`).

**Critères de sortie** (chaque contrainte instanciée puis `evaluer(ctx)` appelée sur un `ctx` construit à la main avec `indexer`/`expanserDemandes`) :
- `absence-validee` : une personne avec une `Absence` `statut: 'VALIDE'` couvrant `2026-08-12` (créneau `JOURNEE`) → `autoriseAffectation(personneId, demande du 12/08 MATIN, ctx)` renvoie `false` ; une `Absence` `statut: 'REFUSE'` sur la même période **n'influence rien** (candidat toujours autorisé).
- `absence-demandee` : une `Absence` `statut: 'DEMANDE'` chevauchant une affectation existante ⇒ `evaluer(ctx)` renvoie une `Violation` `severite: 'avertissement'`, `penalite > 0`, `code: 'ABSENCE_DEMANDEE'` ; **aucun blocage** (`autoriseAffectation` absent ou toujours `true` pour cette contrainte).
- `chevauchement` : deux affectations de la **même** personne le même jour, créneaux `MATIN`/`JOURNEE` (chevauchants) ⇒ 1 `Violation erreur` ; créneaux `MATIN`/`APRES_MIDI` (non chevauchants) ⇒ aucune violation.
- `couverture` : une tournée `nbPersonnesRequises: 2` avec seulement 1 affectation posée un jour applicable ⇒ `evaluer` renvoie 1 `Violation erreur` `code: 'SOUS_COUVERTURE'`, et `calculerNonCouvertures(...)` renvoie une entrée `{ requis: 2, affectes: 1, manque: 1 }` pour ce (date, créneau, tournée) ; effectif atteint ⇒ aucune violation, aucune entrée.
- `repos-legal` : une personne affectée 7 jours calendaires consécutifs alors que `reglesCabinet.maxJoursConsecutifs = 6` ⇒ au moins 1 `Violation erreur` `code: 'TROP_JOURS_CONSECUTIFS'` ; une personne sans aucun jour de repos sur une semaine ISO complète alors que `reposHebdoMin = 2` ⇒ 1 `Violation erreur` `code: 'REPOS_HEBDO_INSUFFISANT'`.
- `jour-ouverture` : une affectation `MANUEL` (simulée à la main dans le tableau `affectations`) tombant un dimanche alors que `joursOuverture` ne contient pas `7` ⇒ 1 `Violation erreur` `code: 'JOUR_FERME'`.
- `messagePour('ABSENCE_VALIDEE', { nomPersonne: 'Claire Martin', ... })` renvoie une chaîne non vide, en français, sans code brut visible.
- Aucun import Vue/Vuex ; aucun accès `localStorage` ; `npm run build` réussit.

### Tâche 3 — Contraintes préférences (générique dure/souple) + globales souples (équité, continuité) + fabrique complète

**Fichiers** :
- `src/domain/scheduling/contraintes/contraintePreference.js` (**créer**) — une fonction d'évaluation interne par `type` ∈ `TYPES_PREFERENCE` (§7.2), routée par `creerContraintePreference(preference, personne)` qui pose `durete: preference.nature`, `poids: preference.nature === 'SOUPLE' ? preference.poids : undefined`.
- `src/domain/scheduling/contraintes/contrainteEquite.js` (**créer**) — `creerContrainteEquite()`.
- `src/domain/scheduling/contraintes/contrainteContinuite.js` (**créer**) — `creerContrainteContinuite()`.
- `src/domain/scheduling/contraintes/index.js` (**créer**) — `creerContraintes(entree)` (assemble T2 + T3), `TYPES_CONTRAINTE`, `POIDS_SOUPLES_PAR_DEFAUT`.
- `src/domain/scheduling/modele/messages.js` (**modifier**) — ajouter les codes de §7.2/§7.3 (réutiliser `decrirePreference` de `@/domain/preferences.js`).

**Dépend de** : T1, T2 (même patron de `Contrainte`).

**Critères de sortie** :
- `creerContraintePreference({ type: 'JOUR_OFF_RECURRENT', nature: 'DURE', params: { joursSemaine: [3] } }, personne)` : `autoriseAffectation(personne.id, demande du mercredi, ctx)` renvoie `false` ; demande un autre jour ⇒ `true`.
- La **même** préférence avec `nature: 'SOUPLE', poids: 8` : plus d'`autoriseAffectation` bloquant (ou toujours `true`) ; `coutMarginal(personne.id, demande du mercredi, ctx)` renvoie une valeur **strictement positive** ; `evaluer(ctx)` sur un planning où la personne travaille le mercredi renvoie 1 `Violation avertissement` avec `penalite` cohérente avec `poids`.
- `PREFERENCE_TOURNEE` `{ sens: 'EVITE', tourneeIds: ['t1'] }` : `coutMarginal` (ou `autoriseAffectation` si `DURE`) pénalise/bloque une affectation sur `t1`, mais pas sur une autre tournée.
- `creerContraintes(entree)` avec 2 personnes actives ayant respectivement 1 et 2 préférences `actif: true` (+ 1 préférence `actif: false` à ignorer) renvoie une liste contenant les **8 contraintes fixes** (§7.1/§7.3 : `absence-validee`, `absence-demandee`, `chevauchement`, `couverture`, `repos-legal`, `jour-ouverture`, `equite`, `continuite`) **plus exactement 3** contraintes `pref-*` (la préférence inactive est exclue) ; chaque `id` de contrainte préférence vaut `'pref-' + preference.id`.
- `contrainteEquite` : deux personnes de même `quotite`, l'une avec 8 affectations sur la période, l'autre avec 2 ⇒ `evaluer` renvoie au moins 1 `Violation avertissement` `code: 'EQUITE_DESEQUILIBREE'` ciblant la personne en écart ; deux personnes avec une charge quasi égale (pondérée par `quotite`) ⇒ aucune violation significative.
- `contrainteContinuite` : une personne affectée à la même tournée deux jours ouvrés consécutifs ⇒ `coutMarginal` pour la reconduire le jour suivant est **inférieur** à celui d'une autre personne jamais vue sur cette tournée.
- Aucun import Vue/Vuex ; aucun accès `localStorage` ; `npm run build` réussit.

### Tâche 4 — Validation complète (`validerPlanning`) + API publique partielle

**Fichiers** :
- `src/domain/scheduling/validerPlanning.js` (**créer**) — `validerPlanning(affectations, entree)` (§5.10).
- `src/domain/scheduling/index.js` (**créer**) — exports initiaux : `validerPlanning`, `creerContraintes`, `TYPES_CONTRAINTE`, `indexer`, `appliquerChangement` (§5.15, sans `genererPlanning`/`calculerScore` — ajoutés en T5).

**Dépend de** : T1, T2, T3 (`creerContraintes` complet).

**Critères de sortie** :
- Sur un jeu de données simple (2 personnes, 1 tournée `nbPersonnesRequises: 1`, période d'une semaine, aucune absence, aucune préférence) et un tableau `affectations` **entièrement couvert et légal**, `validerPlanning(affectations, entree)` renvoie un tableau **vide**.
- En introduisant volontairement une double affectation le même jour/créneau pour une même personne, `validerPlanning` renvoie une `Violation` `code: 'CHEVAUCHEMENT'`, `severite: 'erreur'`.
- Le tableau renvoyé est **trié** : toutes les `erreur` précèdent toutes les `avertissement` ; au sein des `avertissement`, `penalite` décroissante.
- Appeler `validerPlanning` deux fois avec les **mêmes** arguments renvoie un résultat **strictement identique** (même longueur, mêmes `code`/`cible`/`message` dans le même ordre) — déterminisme de la validation (aucun aléa n'intervient ici, mais **aucune** dépendance à un ordre d'itération non trié).
- `import('/src/domain/scheduling/index.js')` (depuis la console du navigateur, `npm run dev`) expose bien `validerPlanning`, `creerContraintes`, `indexer`, `appliquerChangement` comme fonctions.
- Aucun import Vue/Vuex ; aucun accès `localStorage` ; `npm run build` réussit.

### Tâche 5 — Génération (glouton + recherche locale + scoring) + finalisation de l'API publique

**Fichiers** :
- `src/domain/scheduling/heuristiques/scoring.js` (**créer**) — `calculerScore(violations)` + helpers de coût marginal agrégé.
- `src/domain/scheduling/heuristiques/glouton.js` (**créer**) — `constructionGloutonne(demandes, contraintes, ctx, rng)` (§5.12).
- `src/domain/scheduling/heuristiques/rechercheLocale.js` (**créer**) — `ameliorerLocalement(affectations, contraintes, ctx, rng, budgetMs)` (§5.13).
- `src/domain/scheduling/genererPlanning.js` (**créer**) — `genererPlanning(entree, options)` (§5.14), important `calculerNonCouvertures` depuis `contraintes/contrainteCouverture.js` (T2).
- `src/domain/scheduling/index.js` (**modifier**) — ajouter les exports `genererPlanning`, `calculerScore` (§5.15 complet).

**Dépend de** : T1 à T4 (toutes les briques du moteur).

**Critères de sortie** :
- **Cas nominal faisable** : 3 personnes actives sans absence ni préférence `DURE` bloquante, 1 tournée `nbPersonnesRequises: 1` sur une semaine ouverte 6 jours ⇒ `genererPlanning(entree, { seed: 1 })` renvoie un `Resultat` avec `affectations.length` égal au nombre de jours applicables (couverture à 100 %), `violations` ne contenant **aucune `erreur`**, `meta.faisable === true`, `meta.nbErreursDures === 0`, `tourneesNonCouvertes` **vide**.
- **Déterminisme** : deux appels `genererPlanning(entree, { seed: 7 })` sur la **même** `entree` produisent des `affectations` avec la **même** séquence de `(personneId, tourneeId, date, creneau)` (les `id`/horodatages techniques peuvent différer, §12) et le **même** `score`/`violations`.
- **Variante** : `genererPlanning(entree, { seed: 7, variante: 1 })` peut produire une répartition **différente** de `{ seed: 7, variante: 0 }` (au moins un candidat différent sur un cas comportant plusieurs candidats légaux équivalents) tout en respectant les mêmes dures.
- **Infaisabilité sans crash** : 1 seule personne active, 2 tournées simultanées le même jour/créneau chacune `nbPersonnesRequises: 1` ⇒ `genererPlanning` **ne lève aucune exception**, renvoie un `Resultat` avec `tourneesNonCouvertes` non vide, au moins 1 `Violation erreur` `code: 'SOUS_COUVERTURE'`, `meta.faisable === false`.
- **Jamais plus que le requis** : sur un cas avec 5 personnes disponibles et une tournée `nbPersonnesRequises: 1`, jamais plus d'**une** affectation n'est posée pour cette tournée/ce jour/ce créneau.
- **Respect des dures** : sur un jeu de données comportant une préférence `JOUR_OFF_RECURRENT` `nature: 'DURE'` pour une personne, `genererPlanning` ne l'affecte **jamais** le jour concerné, même si cela dégrade la couverture (qui sera alors signalée en `tourneesNonCouvertes`/`violations`, pas contournée).
- **Verrouillage préservé** : en passant `entree.affectationsVerrouillees` avec une affectation `verrouillee: true`, elle se retrouve **inchangée** (mêmes `id`, `personneId`, `tourneeId`, `date`, `creneau`) dans `resultat.affectations`, et aucun autre candidat n'est affecté sur ce même slot.
- **`validerPlanning(resultat.affectations, entree)` appelé après `genererPlanning`** ne renvoie **aucune** violation dure « évitable » (invariant 05 §4 : le résultat de la génération ne contient pas d'erreur dure qu'un meilleur choix aurait pu éviter, sur les cas de test simples ci-dessus).
- `meta.dureeMs` est un nombre positif ; sur les jeux d'exemple ci-dessus (échelle très réduite), la génération complète s'exécute en **quelques dizaines de millisecondes** au grand maximum.
- `import('/src/domain/scheduling/index.js')` expose désormais **les 6** fonctions de l'API publique (§5.15).
- Aucun `Math.random`/`Date.now` utilisé pour une **décision** d'affectation (seul un chronométrage non décisionnel de `meta.dureeMs` peut utiliser `Date.now()`/`performance.now()`) ; aucun import Vue/Vuex ; aucun accès `localStorage` ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] `src/domain/scheduling/` existe, organisé selon §5 (aucun fichier n'importe `vue`, `vuex`, ni `@/store/**`).
- [ ] `genererPlanning(entree, options)` renvoie toujours un `Resultat` conforme au contrat §5.2 (`affectations`, `violations`, `score`, `tourneesNonCouvertes`, `meta`) — **jamais** d'exception, même sur un jeu de données irréaliste (aucune personne, aucune tournée, période vide).
- [ ] Le moteur **n'affecte jamais** une personne en absence `VALIDE`, ni deux fois la même personne sur un créneau qui se chevauche, ni plus que l'effectif requis d'une tournée.
- [ ] Une préférence `nature: 'DURE'` est **toujours** respectée par la génération, quel que soit son `type` ; une préférence `nature: 'SOUPLE'` influence le choix (coût marginal) sans jamais bloquer.
- [ ] Une absence `DEMANDE` ne bloque jamais une affectation, mais produit un avertissement si affectée malgré tout.
- [ ] Une sous-couverture (effectif insuffisant) ne provoque **jamais** de crash : elle est décrite en clair dans `tourneesNonCouvertes` et dans `violations`.
- [ ] `genererPlanning` est **déterministe** : même `entree` + même `seed` (et `variante`) ⇒ même répartition, même score, mêmes violations. Faire varier `variante` peut produire une répartition différente.
- [ ] `entree.affectationsVerrouillees` est **toujours** préservée telle quelle dans le résultat (mode hybride, [ADR 0007](../docs/adr/0007-generation-planning-hybride.md)).
- [ ] `validerPlanning(affectations, entree)` réutilise **exactement** le même catalogue de contraintes que `genererPlanning` (aucune règle dupliquée entre les deux) et renvoie des violations triées (erreurs puis avertissements par pénalité décroissante), en français, prêtes à afficher.
- [ ] Tous les messages de violation (`Violation.message`) sont en **français**, sans jargon ni code brut visible, et nomment la personne/tournée/date/créneau concernés.
- [ ] L'API publique (`src/domain/scheduling/index.js`) n'expose que `genererPlanning`, `validerPlanning`, `creerContraintes`, `TYPES_CONTRAINTE`, `calculerScore`, `indexer`, `appliquerChangement`.
- [ ] Aucun accès `localStorage` ; aucun objet `Date` manipulé hors `src/domain/utils/dates.js` (`dateUtil`) et `src/domain/scheduling/utils/dates.js` (qui ne fait que l'appeler) ; aucun `Math.random`/`Date.now` utilisé pour une décision d'affectation.
- [ ] `npm run build` réussit après chacune des 5 tâches.

## 11. Vérification

Le moteur n'a **aucune UI** : la vérification se fait par **appel direct des fonctions**, en s'appuyant sur le serveur de développement Vite (qui résout l'alias `@/`) plutôt qu'un exécuteur de tests (absent en v1).

1. **Lancer** `npm run dev` et ouvrir l'application dans un navigateur (n'importe quelle page).
2. **Ouvrir la console du navigateur** (outils de développement) et importer dynamiquement le module servi par Vite, ex. : `const m = await import('/src/domain/scheduling/index.js')`.
3. **Construire un petit jeu de données à la main** dans la console (2-3 `Personne`, 1-2 `Tournee`, quelques `Absence`, un `ParametresCabinet` minimal) conforme aux formes de 02/03, et appeler `m.genererPlanning({ periode: { debut: '2026-08-10', fin: '2026-08-16' }, personnes, tournees, absences, reglesCabinet }, { seed: 1 })` : inspecter `resultat.affectations`/`violations`/`tourneesNonCouvertes`/`meta` dans la console.
4. **Rejouer** avec le même `seed` : vérifier l'égalité stricte du résultat (comparaison manuelle ou `JSON.stringify` des deux résultats en excluant `id`/`createdAt`/`updatedAt`/`meta.dureeMs`).
5. **Forcer l'infaisabilité** (retirer toutes les personnes, ou multiplier les absences `VALIDE`) : vérifier l'**absence de plantage**, `meta.faisable === false`, `tourneesNonCouvertes` renseignée.
6. **Appeler `m.validerPlanning(resultat.affectations, entree)`** sur le résultat de l'étape 3 : vérifier la cohérence avec `resultat.violations` (mêmes violations résiduelles, `validerPlanning` étant la même fonction que celle utilisée en interne par `genererPlanning`).
7. **Verrouillage** : reprendre l'étape 3 en ajoutant `affectationsVerrouillees: [uneAffectationExistante]` ; vérifier qu'elle réapparaît **inchangée** dans `resultat.affectations`.
8. **Build** : `npm run build` réussit sans erreur après chaque tâche du §9.

> Cette procédure manuelle **remplace** une suite de tests automatisés (hors v1, [ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)) ; les critères de sortie du §9 sont rédigés pour être directement rejouables ainsi, et transposables en tests unitaires le jour où `vitest`/équivalent sera introduit.

## 12. Décisions à confirmer / risques

1. **Dureté des préférences pilotée par la donnée (`preference.nature`), pas par un catalogue figé (retenu)** — Le catalogue « dures/souples » de `05 §1` (qui rangeait par exemple `jourOffRecurrent`/`creneauOff` parmi les souples) est **indicatif** ; le modèle de domaine réel (`0005`, `Preference.nature` choisi par le référent) permet à **n'importe quel** `TYPES_PREFERENCE` d'être `DURE` ou `SOUPLE`. `0009` respecte donc la donnée réelle plutôt que le tableau d'exemple. **À confirmer** (aucun changement d'architecture, juste une clarification d'application).
2. **Pas de `validerIncrementale` en v1 (retenu, simplification KISS)** — `05` prévoit une validation incrémentale par `granularite` pour un budget `< 1 ms` au drag & drop. Aux volumes visés (20 personnes × 30 jours × ~10 tournées ⇒ quelques centaines d'affectations), une **validation complète** (`validerPlanning`) s'exécute déjà en quelques millisecondes (05 §5) : suffisant pour un retour « temps réel » perceptible par l'utilisateur en `0011`. Le champ `granularite` est **conservé** dans `Contrainte` (types.js) pour ne pas fermer la porte à une optimisation incrémentale future si un besoin de performance apparaît réellement. **À confirmer** ; alternative : livrer `validerIncrementale` dès `0009` si le développeur juge le surcoût raisonnable.
3. **`coutMarginal` obligatoire pour les contraintes souples, pas dérivé automatiquement de `evaluer` (retenu, simplification KISS)** — `05` propose que `coutMarginal` soit optionnel, la génération dérivant sinon le coût par ré-évaluation de la portée touchée. Plus simple et plus prévisible pour un premier jet : chaque contrainte souple **fournit** son `coutMarginal`, dont la cohérence avec `evaluer` reste un **invariant à préserver** par le développeur (comme `autoriseAffectation` vs `evaluer` pour les dures). **À confirmer.**
4. **Un seul fichier `contraintePreference.js` pour les 8 types (retenu)** — Voir encadré §5 : simplification KISS assumée par rapport à `05 §7` (un fichier par type). **À confirmer.**
5. **Déterminisme des `id`/horodatages non garanti au sens strict (retenu, assumé)** — Le déterminisme (§5.6, ADR 0008) porte sur la **structure** du résultat (qui/quoi/quand/score/violations), pas sur les chaînes `id`/`createdAt`/`updatedAt` des `Affectation` générées : `genId()`/`toISOString()` restent des concessions techniques « toujours fraîches », cohérentes avec `creerTournee`/`creerAbsence`/`creerPersonne` déjà en place. Deux générations « identiques » (même seed) produisent donc des `Affectation` **structurellement identiques** mais avec des `id` différents — un identifiant n'a de toute façon aucun sens métier à être reproductible. **À confirmer** (les critères de sortie du §9 excluent explicitement `id`/horodatages de la comparaison de déterminisme).
6. **`reglesCabinet.creneauxActifs` non utilisé comme filtre par le moteur (retenu)** — Chaque `Tournee` porte déjà un `creneau` valide posé à sa création (`0006`) ; `creneauxActifs` semble davantage un réglage d'aide à la saisie (`0003`) qu'une contrainte de génération. Le moteur ne le consulte donc pas. **À confirmer** ; si un usage fonctionnel de `creneauxActifs` apparaît nécessaire (ex. désactiver temporairement un créneau pour tout le cabinet sans toucher aux tournées), ce sera à ajouter alors, potentiellement via une contrainte dédiée.
7. **Pas de report du repos légal au-delà des bornes de la période (retenu, limite assumée)** — `reposHebdoMin`/`maxJoursConsecutifs` sont évalués **uniquement** sur l'intersection avec `entree.periode` (les compteurs repartent à zéro à `periode.debut`) ; `entree.planningPrecedent` n'est utilisé que par `contrainteContinuite` (§7.3). Une séquence de jours travaillés commencée **juste avant** le début de la période n'est donc pas prolongée dans le calcul. **Limite documentée**, acceptable pour une v1 (générations enchaînées semaine par semaine, cas limite rare) ; à revoir si `0011` constate des faux-négatifs fréquents en début de période.
8. **`PREFERENCE_MIN_JOURS_CONSECUTIFS` non évaluée en bord de période (retenu, limite assumée)** — Une séquence de jours travaillés qui se termine exactement à `periode.fin` (donc dont on ne sait pas si elle continue au-delà) n'est **pas** signalée comme trop courte, pour éviter les faux positifs. **Limite documentée**, cohérente avec le point 7.
9. **`entree.affectationsVerrouillees` plutôt qu'un `planningEnCours` complet (retenu)** — Pour une régénération (`0011`), seules les affectations **verrouillées** sont transmises au moteur (les `AUTO` non verrouillées sont régénérées à neuf) : plus simple que de transmettre tout un `Planning` et de distinguer en interne ce qui doit bouger. **À confirmer** avec `0011` le moment venu.
10. **Nommage `validerPlanning(affectations, entree)` plutôt que `validerPlanning(planning, entree)` (retenu)** — Voir §5.10 : accepter directement un tableau d'`Affectation` (plutôt que l'entité `Planning`) permet à `0011` de valider un état **en cours d'édition**, avant tout `commit` dans le store. Écart mineur de nommage par rapport à `05`, sans changement de fond. **À confirmer.**
