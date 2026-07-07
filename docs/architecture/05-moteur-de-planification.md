# 05 — Moteur de planification

Le moteur est le **cœur technique** d'Idelia. Il vit dans `src/domain/scheduling/`, c'est un **module pur** : aucun import de Vue/Vuex, des fonctions déterministes testables en isolation ([ADR 0008](../adr/0008-moteur-planification-module-pur.md)). Il sert le mode **hybride** ([ADR 0007](../adr/0007-generation-planning-hybride.md)).

## Principe directeur

Un **modèle de contraintes unique** alimente **à la fois** la génération (filtrer les contraintes dures, scorer les souples) et la validation temps réel (produire des violations lisibles). Une contrainte = un objet évaluable = **source de vérité unique**. On ne duplique jamais la règle métier.

## 1. Modèle de contraintes

```js
/**
 * @typedef {'dure'|'souple'} Durete
 * @typedef {'cellule'|'creneau'|'personne-periode'|'global'} Granularite
 *
 * @typedef {Object} Contrainte
 * @property {string}       id
 * @property {string}       type          // catégorie métier
 * @property {Durete}       durete
 * @property {number}       poids         // souples ; ignoré si dure
 * @property {Granularite}  granularite   // portée d'impact -> validation incrémentale
 * @property {(ctx) => Violation[]}         evaluer               // SOURCE DE VÉRITÉ
 * @property {(cand, cell, ctx) => boolean} [autoriseAffectation] // pré-filtre rapide (dures)
 * @property {(cand, cell, ctx) => number}  [coutMarginal]        // optionnel (perf, souples)
 */
```

- `evaluer(ctx)` : parcourt le planning, renvoie les violations — **seule** source de vérité.
- `autoriseAffectation(...)` : pré-filtre rapide pour la génération (dures uniquement), sans reconstruire tout le planning. Sa cohérence avec `evaluer` est un invariant à préserver.
- `coutMarginal(...)` : optionnel ; à défaut, la génération dérive le coût en ré-évaluant **seulement la portée touchée** via `evaluer` (zéro duplication).

### La `granularite` (clé de la performance incrémentale)

| granularité | dépend de… | contraintes |
|---|---|---|
| `cellule` | une affectation | absence, jour off récurrent, créneau off |
| `creneau` | toutes les affectations d'un (jour,créneau) | non-chevauchement, couverture |
| `personne-periode` | la timeline d'une personne | repos légal, min/max jours consécutifs, jour de repos souhaité |
| `global` | tout le planning | équité, continuité |

### Objet `Violation`

```js
/**
 * @typedef {Object} Violation
 * @property {string}  contrainteId
 * @property {'erreur'|'avertissement'} severite  // dure->erreur ; souple->avertissement
 * @property {Object}  cible        // { personneId?, tourneeId?, jour?, creneau? } pour surligner l'UI
 * @property {string}  code         // stable (i18n, tests), ex 'ABSENCE_AFFECTEE'
 * @property {string}  message      // FR lisible pour l'UI
 * @property {number}  penalite     // souples : poids * amplitude
 * @property {Object}  [params]     // données brutes (debug / reconstruction message)
 */
```

On sépare `code` (stable) de `message` (FR affiché) → prêt pour l'i18n, tests non fragiles.

### Catalogue

**Dures** (`severite: 'erreur'`) : `absence` (personne absente non affectable), `chevauchement` (1 personne ≤ 1 tournée par créneau), `couverture` (effectif requis), `reposLegal` (≤ `maxJoursConsecutifs`, repos mini).

**Souples** (`severite: 'avertissement'`, poids configurable) : `jourOffRecurrent`, `creneauOff`, `joursConsecutifsSouhaites`, `jourReposSouhaite`, `equite` (écart de charge entre personnes), `continuite` (garder la même personne sur une tournée).

### Couverture & infaisabilité

La couverture est *dure par intention* mais peut être **physiquement impossible**. Règle : **on ne crashe jamais**. Une sous-couverture est reportée dans `tourneesNonCouvertes` **et** comme `Violation` (`avertissement` si l'infaisabilité est prouvée, `erreur` sinon). On n'affecte jamais **plus** que le requis.

### Fabrique

`creerContraintes(input)` : fonction pure qui instancie la liste des contraintes (une par règle cabinet + une par préférence, closurant leurs données). **Cette liste est partagée** par génération et validation.

## 2. Entrée / sortie

```js
/**
 * @typedef {Object} Input
 * @property {{debut:string, fin:string}} periode   // 'YYYY-MM-DD' inclusifs
 * @property {Personne[]}    personnes
 * @property {Tournee[]}     tournees
 * @property {Absence[]}     absences               // seules les VALIDE bloquent
 * @property {Preference[]}  preferences
 * @property {ReglesCabinet} reglesCabinet          // { maxJoursConsecutifs, reposHebdoMin, ... }
 * @property {Poids}         poids                   // pondération des souples
 * @property {Planning}     [planningPrecedent]     // continuité inter-période
 *
 * @typedef {Object} Options { seed?, budgetIterations?, budgetMs?, variante? }
 *
 * @typedef {Object} Resultat
 * @property {Affectation[]}   affectations           // liste PLATE, JSON-sérialisable
 * @property {Violation[]}     violations             // résiduelles (erreurs + avertissements)
 * @property {number}          score                  // somme pondérée des pénalités souples (bas = mieux)
 * @property {NonCouverture[]} tourneesNonCouvertes   // { jour, creneau, tourneeId, requis, affectes, manque }
 * @property {Object}          meta                   // { seed, iterations, dureeMs, faisable, nbErreursDures }
 */
```

> **Jours** : dans le moteur comme partout, les jours de semaine sont en **ISO 1-7** ([ADR 0010](../adr/0010-conventions-dates-et-jours-iso.md)).

## 3. Génération

**Approche : construction gloutonne guidée par heuristiques (MRV + moindre coût), puis amélioration locale (hill-climbing avec redémarrages ; recuit simulé léger optionnel).**

Justification : un solveur CSP/ILP externe est lourd, opaque et contraire à KISS. Le glouton donne vite un planning **dur-faisable** ; la recherche locale optimise les souples de façon **anytime** (arrêt à volonté) et **déterministe** (RNG seedé).

```
genererPlanning(input, options):
  rng         = creerRng((options.seed ?? 0) + (options.variante ?? 0))
  contraintes = creerContraintes(input)
  ctx         = preparer(input, contraintes)      // expansion période, matrice de dispo
  planning    = constructionGloutonne(ctx, rng)   // dur-faisable "au mieux"
  planning    = rechercheLocale(planning, ctx, rng, budget)
  violations  = validerPlanning(planning, input)  // MÊME validateur que l'UI
  return assembler(planning, violations, ctx)
```

**Préparation** : expansion de la période en jours (date + jour ISO) ; unités de **demande** `D` (un slot par personne requise, par jour/tournée/créneau) ; matrice `dispo[personne][jour][creneau]` (absences) ; compteurs d'équité ; index de continuité (planning précédent + jours voisins).

**Construction gloutonne (MRV)** — traiter d'abord les demandes ayant le moins de candidats légaux :
```
pour chaque demande d = (jour, creneau, tournee), triée par nb de candidats croissant:
    candidats = personnes P dont TOUTES les dures autorisent (P,d):
        dispo[P][jour][creneau]              (absence)
        P pas déjà sur (jour,creneau)        (chevauchement)
        ajout ne dépasse pas maxJoursConsecutifs (reposLegal)
    si candidats vide: marquer d NON COUVERTE (warning) ; continuer   // jamais de crash
    cout[P] = coût marginal souple de (P,d)
    meilleur = argmin(cout) ; départage seedé par id via rng
    affecter(meilleur, d) ; majCompteurs
```
Les dures dépendant du temps (repos, consécutifs) sont **re-vérifiées dynamiquement** au fil des affectations posées. Le départage passe **toujours** par le RNG seedé (jamais `Math.random`).

**Amélioration locale** — optimise les souples sans jamais casser une dure. Voisinage : `REASSIGNER` (changer la personne), `ECHANGER` (permuter deux affectations), `DEPLACER` (vers un slot non couvert légal). Budget **anytime** (`budgetMs` ~150-300 ms). Hill-climbing + redémarrages seedés ; recuit derrière un flag (KISS d'abord).

## 4. Validation temps réel

`Planning` runtime **indexé** (dérivé de `affectations[]`) pour des lookups O(1) : `parCreneau`, `parTournee`, `parPersonne`, `joursTravailles`. Les `Map`/`Set` d'index **ne sont jamais stockés** — recalculés via `indexer(affectations)`. La liste `affectations[]` reste plate et JSON-sérialisable.

- `validerPlanning(planning, input)` : évalue **toutes** les contraintes → violations triées (erreurs d'abord, puis avertissements par pénalité décroissante). Pure et déterministe ; directement consommable par l'UI (surlignage via `cible`, `message` FR).
- `validerIncrementale(planning, input, changement, cache)` : au **drag & drop**, ne recalcule que la portée touchée selon la `granularite` (cellules, créneaux, personnes concernées) ; l'équité se met à jour via les compteurs `joursTravailles` maintenus (−1/+1). Objectif : **< 1 ms** par interaction.

**Invariant** : `validerIncrementale` ≡ `validerPlanning` après le même changement. Le résultat de `genererPlanning` ne contient aucune **erreur dure évitable**.

## 5. Performance (ordres de grandeur)

Cible : 20 personnes × 30 jours × ~3 créneaux × ~10 tournées → `|D|` ≈ 300–900 slots.
- Validation complète : `O(contraintes × affectations)` → quelques ms.
- Validation incrémentale : quasi O(1) + O(personnes) pour l'équité → < 1 ms.
- Génération : glouton + recherche locale bornée → cible < 300 ms.

**Fluidité** : index runtime (jamais de scan linéaire) ; validation incrémentale au drag ; compteurs maintenus pour les contraintes globales ; budget anytime. **Web Worker : optionnel et différé** — le module étant pur, il se déplace trivialement dans un worker (`postMessage(input)` → `postMessage(resultat)`) si la génération dépasse ~150 ms.

## 6. Déterminisme

PRNG **seedé** injecté (ex. `mulberry32`, pur). **Jamais** `Math.random`/`Date.now`, ni itération non triée d'objet/Map/Set. Même `seed` + même `input` ⇒ même `Resultat`. « Regénérer » : *reproductible* (même seed) ou *variante* (seed/variante incrémenté) ; le seed utilisé est renvoyé dans `meta.seed`.

## 7. Organisation du code

```
src/domain/scheduling/
  index.js                    // API PUBLIQUE (seul point d'entrée)
  genererPlanning.js          // orchestrateur de génération
  validerPlanning.js          // validation complète + incrémentale
  contraintes/
    index.js                  // creerContraintes(input) : fabrique + registre + enum TypeContrainte
    contrainteAbsence.js  contrainteChevauchement.js  contrainteCouverture.js
    contrainteReposLegal.js  contrainteJourOffRecurrent.js  contrainteCreneauOff.js
    contrainteJoursConsecutifs.js  contrainteJourReposSouhaite.js
    contrainteEquite.js  contrainteContinuite.js
  modele/
    types.js                  // typedefs JSDoc (Input, Planning, Contrainte, Violation…)
    planning.js               // indexer(), appliquerChangement(), helpers
    demande.js                // expansion en unités de demande
    messages.js               // libellés FR (code -> message), i18n-ready
  heuristiques/
    glouton.js                // constructionGloutonne + tri MRV
    rechercheLocale.js        // hill-climbing / recuit + moves
    scoring.js                // score(), coutMarginalSouple(), deltaScoreSouple()
  utils/
    rng.js                    // creerRng(seed) seedé pur
    dates.js                  // expansion période, jour de semaine ISO, comparaisons
```

**API publique (`index.js`)** — surface minimale et stable :
```js
export { genererPlanning } from './genererPlanning.js';
export { validerPlanning, validerIncrementale } from './validerPlanning.js';
export { creerContraintes } from './contraintes/index.js';
export { calculerScore } from './heuristiques/scoring.js';
export { indexer, appliquerChangement } from './modele/planning.js';
```

Le store **appelle** ces fonctions et stocke `affectations` + (recalcule) `violations` ; aucune logique métier dans les composants.

## 8. Points de vigilance

1. **Jamais de crash sur l'infaisabilité** : sous-couverture = warning + `tourneesNonCouvertes`.
2. **Dures temporelles** (repos, consécutifs) : vérification **dynamique** pendant le glouton, pas seulement en pré-filtre statique.
3. **Déterminisme fragile** : bannir `Math.random`/`Date.now` ; trier avant toute itération ; départages stables par `id`.
4. **Duplication générateur/validateur** = risque majeur → un seul modèle de contraintes, coût dérivé de `evaluer`, invariants testés (quand les tests seront ajoutés).
5. **Équité incrémentale** : décrémenter/incrémenter symétriquement les compteurs.
6. **Continuité sans planning précédent** (1re période) : se rabattre sur les jours voisins.
7. **Sérialisation** : `affectations[]` reste plate ; les index (`Map`/`Set`) sont recalculés, jamais stockés.

> **Tests** : hors périmètre v1 ([ADR 0008](../adr/0008-moteur-planification-module-pur.md)), mais l'architecture pure rend triviaux : respect des dures, souhaits respectés quand une alternative existe, infaisabilité gérée sans crash, déterminisme, équivalence complète ↔ incrémentale.
