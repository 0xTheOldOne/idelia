# Feature 011 — Éditeur de planning

- **Statut** : En cours
- **Dépend de** : `010` (génération + visualisation en lecture seule : écran `/planning` → `PlanningView`, composants `GrillePlanning`/`CellulePlanning`/`ControlesGrille`/`PanneauConflits`, store `plannings` avec `genererPropose`/`evaluerCourant`/`assemblerEntree`, fabrique `creerPlanning`). Transitivement : `002` (`schema.js`, store racine + plugin de persistance), `005`/`006`/`007` (données de référence lues par le moteur), `009` (moteur pur `@/domain/scheduling` : `genererPlanning`, `diagnostiquer`, `appliquerChangement`, `indexer` ; typedef `Changement`, fabrique `creerAffectationAuto`). `011` **n'amende pas** le moteur `009` : il réutilise sa surface publique telle quelle.
- **ADR liés** : [0007](../docs/adr/0007-generation-planning-hybride.md) (**décision fondatrice** : l'humain ajuste la proposition du moteur ; `origine` `AUTO`/`MANUEL` et `verrouillee` matérialisent le mode hybride — une régénération **préserve à l'identique** ce qui est verrouillé), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (le moteur reste pur : **toute** mutation d'affectation passe par une **action du store** qui appelle le domaine/moteur, **jamais** un appel moteur depuis un composant), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7, dates `"YYYY-MM-DD"`, aucun objet `Date` hors `dateUtil`), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS + JSDoc), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance via le store + plugin, jamais `localStorage` direct ; les affectations sont persistées, les diagnostics et l'historique d'annulation jamais), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) / [0012](../docs/adr/0012-style-scss.md) (Bootstrap 5 thémé par tokens, SCSS), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor exclusivement), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate/vue-debounce — **aucun nouveau formulaire validé** n'est introduit ici : le sélecteur de personne est une liste de choix, pas un formulaire ; voir §7), [0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md) (diffusion/impression : différée à `012`).

## 1. Contexte & objectif

`010` sait **générer et montrer** une proposition de planning, mais la grille est en **lecture seule** : le référent subit la proposition du moteur sans pouvoir la corriger. `011` livre le cœur du mode hybride ([ADR 0007](../docs/adr/0007-generation-planning-hybride.md)) : **rendre la grille de `010` éditable**, sur le **même écran `/planning`**, pour qu'un utilisateur non-informaticien puisse ajuster la proposition à la main — ajouter, retirer, déplacer une personne sur une tournée — **verrouiller** ce qui lui convient, voir **immédiatement** l'effet sur les conflits, et **regénérer** (à l'identique ou en variante) en conservant ses choix verrouillés. Un filet de sécurité simple — **« Annuler la dernière action »** — protège chaque geste.

`011` **ne réécrit pas** la grille : il **greffe une couche d'édition** sur les composants existants (`GrillePlanning`, `CellulePlanning`, `ControlesGrille`, `PanneauConflits`), dont la surface d'extension a été pensée dès `010` (§6.3 de `010` : slot scopé `cellule`, événements `@ajouter`/`@retirer`/`@deplacer`/`@verrouiller` documentés, non émis). Le geste **principal est le clic** (fiable, tactile, entièrement réalisable au clavier) ; le **glisser-déposer** est une **surcouche de confort** (API HTML5 native, **aucune dépendance ajoutée**), jamais l'unique moyen d'agir.

**Hors périmètre `011`** (voir §12 pour le détail) :

- **Diffusion / impression / export PDF**, passage en statut `VALIDE`/`PUBLIE`, snapshot d'affichage figé, styles `@media print` → `012`.
- **Tableau de bord d'accueil**, gestion avancée d'un catalogue de plannings (renommage, choix du référent) → `013`.
- **Validation incrémentale** (recalcul partiel après un geste) → hors v1 : `011` recalcule **complètement** les diagnostics après chaque modification (décision KISS de `009`/`010`, volumes faibles → quelques ms).
- **Annulation multi-niveaux et rétablissement (redo)** → hors v1 : `011` implémente un **undo à un seul niveau**, sans redo (§7, décision arrêtée).
- **Toute bibliothèque de glisser-déposer tierce** (`vuedraggable`, `SortableJS`…) → exclue : le DnD passe par l'API HTML5 native (KISS).

## 2. Écrans concernés

Un seul écran, la route existante **`/planning`** → `PlanningView.vue` ([architecture 07](../docs/architecture/07-navigation-et-ecrans.md), § Écran Planning, points 2-3-4). **Aucune nouvelle route.** `011` enrichit `PlanningView` d'un **mode édition** et de deux modales légères (sélecteur de personne, confirmation de régénération).

Expérience visée pour un utilisateur non-technique :

- **La lecture d'abord, l'édition sur demande.** À l'ouverture, le planning s'affiche comme en `010` (propre, non modifiable). Un bouton clair **« Modifier le planning »** bascule en mode édition ; **« Terminer la modification »** en ressort. Ce mode explicite évite les modifications accidentelles et garde des affordances d'édition **toujours visibles** (jamais cachées derrière un survol, inutilisable au tactile).
- **Un seul geste à comprendre : cliquer une case.** En mode édition, chaque case de tournée montre un bouton **« Ajouter une personne »**. Un clic ouvre une petite fenêtre listant l'équipe ; on choisit un nom, c'est affecté. Chaque personne déjà présente porte deux petits boutons explicites : **retirer** (croix) et **verrouiller** (cadenas). Tout est atteignable et actionnable **au clavier**.
- **Le déplacement en bonus.** Qui le souhaite peut **faire glisser** une personne d'une case à une autre (souris). Ceux qui préfèrent — ou sont au tactile / au clavier — obtiennent le même résultat en retirant puis rajoutant, ou via le sélecteur. Le glisser-déposer n'est **jamais** requis.
- **Retour immédiat et honnête.** Après **chaque** geste, la grille se re-surligne et le panneau de conflits se met à jour instantanément (« Claire Martin est en congé le mercredi 12/08 »). Erreurs dures et avertissements souples restent distingués par icône + libellé, jamais par la seule couleur.
- **Rien n'est jamais perdu.** Un bouton **« Annuler la dernière action »** ramène l'état d'avant le dernier geste (édition manuelle **ou** régénération). Une régénération, qui remplace les affectations en bloc, est précédée d'une **confirmation** dès qu'elle risque d'effacer un ajustement manuel non verrouillé.
- **Regénérer sans peur.** Deux boutons rassurants : **« Regénérer à l'identique »** (même proposition) et **« Essayer une variante »** (une autre répartition) — tous deux **conservent** les affectations verrouillées.

## 3. Modèle de données touché

**Aucun nouveau champ, aucun impact sur `schemaVersion`** (reste `1`). `011` **écrit** des champs déjà définis ([02](../docs/architecture/02-modele-de-domaine.md) §Affectation/§Planning) :

- **`Affectation.origine`** : une affectation posée à la main porte **`'MANUEL'`** (vs `'AUTO'` pour le moteur). `011` introduit la fabrique domaine `creerAffectationManuelle` (§5.1).
- **`Affectation.verrouillee`** : basculé `true`/`false` par le verrouillage (§4.3). Une affectation `verrouillee: true` est **préservée à l'identique** lors d'une régénération (passée en `entree.affectationsVerrouillees` au moteur — [ADR 0007](../docs/adr/0007-generation-planning-hybride.md), 009 §5.2/§5.12).
- **`Affectation.updatedAt`** : re-horodaté lorsqu'une affectation change (verrouillage, déplacement).
- **`Planning.affectations`** : remplacé **immuablement** à chaque geste (jamais muté en place).
- **`Planning.parametresGeneration`** : mis à jour (nouveau `Resultat.meta` : `seed`/`variante`) lors d'une **régénération en place**.
- **`Planning.updatedAt`** : re-horodaté à chaque modification du planning.

**Jamais persisté** (02 : « les diagnostics ne sont jamais stockés ») : les diagnostics (`violations`, `tourneesNonCouvertes`, `score`), recalculés à la demande via `diagnostiquer`/`evaluerCourant` (inchangé depuis `010`). **Volatil de session, jamais sérialisé** : le **snapshot d'annulation** (§4.4) — un unique instantané des affectations pris avant chaque geste. Il vit dans l'état du module `plannings` mais **n'entre pas** dans le `SaveDocument` (`toSaveDocument` ne sérialise que `plannings.items`, voir `src/domain/schema.js`) ; au rechargement, l'undo repart donc de zéro. Volatils aussi (état de la vue) : le **mode édition**, les réglages d'affichage (orientation/échelle/date de référence), l'état des deux modales.

## 4. Store (Vuex)

Toutes les modifications sont dans **`src/store/modules/plannings.js`** (déjà porteur de `items`/`selectionId`, getters `byId`/`courant`, mutations `REPLACE`/`ADD`/`SELECT`/`REMOVE`, actions `genererPropose`/`evaluerCourant`, helper `assemblerEntree`). Module **déjà persisté** par le plugin racine — **aucun accès `localStorage`** ici. **Toute** création/modification d'affectation passe par ces actions, qui délèguent au domaine/moteur ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)) ; **aucun composant n'importe `@/domain/scheduling`**.

### 4.1 État volatil ajouté

```js
state: () => ({ items: [], selectionId: null, snapshotEdition: null })
```

- **`snapshotEdition`** : `{ planningId: string, affectations: Affectation[] } | null` — **unique** instantané des affectations du planning courant, pris **juste avant** chaque geste modifiant (§4.4). **Non sérialisé** (`toSaveDocument` ne renvoie que `plannings.items`), remis à `null` au rechargement (`fromSaveDocument` ne le mentionne pas). Support de l'undo 1-niveau, **sans redo**.

### 4.2 Getter ajouté

- **`peutAnnuler(state, getters)`** → `boolean` : `true` **uniquement si** un snapshot existe **et** cible le planning courant :
  ```js
  peutAnnuler: (state, getters) =>
    !!state.snapshotEdition && !!getters.courant && state.snapshotEdition.planningId === getters.courant.id
  ```
  La comparaison `planningId === courant.id` invalide **automatiquement** un snapshot devenu obsolète (nouvelle génération `010` qui sélectionne un autre planning, import `008` qui remplace tout) : le bouton « Annuler » se désactive de lui-même, sans code de nettoyage transverse. Après une génération **en place** (§4.5, même `id`), le snapshot reste valide (undo d'une régénération possible).

### 4.3 Mutations ajoutées (fines, immuables, `updatedAt` posé ici)

- **`UPDATE_AFFECTATIONS(state, { id, affectations, parametresGeneration })`** : remplace **immuablement** les affectations du planning `id` (jamais de mutation en place), bump `updatedAt`, et met à jour `parametresGeneration` **si fourni** (uniquement passé par la régénération, §4.5) :
  ```js
  state.items = state.items.map((pl) =>
    pl.id === id
      ? { ...pl, affectations, updatedAt: new Date().toISOString(),
          ...(parametresGeneration !== undefined ? { parametresGeneration } : {}) }
      : pl
  );
  ```
- **`CAPTURER_SNAPSHOT(state, { planningId, affectations })`** : `state.snapshotEdition = { planningId, affectations: [...affectations] }` (copie du tableau ; les objets `Affectation` sont traités en lecture seule — jamais mutés en place, `UPDATE_AFFECTATIONS` remplace toujours par un nouveau tableau).
- **`RESTAURER_SNAPSHOT(state)`** : réapplique le snapshot au planning ciblé, bump `updatedAt`, puis **efface** le snapshot (undo 1-niveau : après annulation, plus rien à annuler) :
  ```js
  const snap = state.snapshotEdition;
  if (!snap) return;
  state.items = state.items.map((pl) =>
    pl.id === snap.planningId ? { ...pl, affectations: snap.affectations, updatedAt: new Date().toISOString() } : pl
  );
  state.snapshotEdition = null;
  ```

> `CAPTURER_SNAPSHOT`/`RESTAURER_SNAPSHOT` n'ajoutent jamais de contenu persisté parasite : `CAPTURER_SNAPSHOT` ne touche pas `items` (et précède de toute façon un vrai geste qui, lui, persiste), `RESTAURER_SNAPSHOT` modifie légitimement `items` (retour à l'état antérieur).

### 4.4 Actions d'édition manuelle (appliquent `appliquerChangement`, ne recalculent pas les diagnostics)

Toutes suivent le **même protocole** : (1) lire `getters.courant`, no-op si absent ; (2) `commit('CAPTURER_SNAPSHOT', …)` avec les affectations **actuelles** ; (3) construire la nouvelle liste d'affectations ; (4) `commit('UPDATE_AFFECTATIONS', …)`. Elles **ne recalculent pas** les diagnostics (la vue rafraîchit ensuite via `evaluerCourant`, cohérent `010` §4.3) et n'appellent **jamais** `localStorage`.

- **`ajouterAffectation({ commit, getters }, { tourneeId, personneId, date, creneau })`** : crée une affectation `MANUEL` via `creerAffectationManuelle(personneId, tourneeId, date, creneau)` (domaine, §5.1), puis `appliquerChangement(courant.affectations, { type: 'AJOUTER', affectation })`.
- **`retirerAffectation({ commit, getters }, { affectationId })`** : `appliquerChangement(courant.affectations, { type: 'RETIRER', affectationId })`.
- **`deplacerAffectation({ commit, getters }, { affectationId, versTourneeId, versDate, versCreneau })`** : retrouve l'affectation **source** et **préserve son identité** — elle ne fabrique **pas** d'affectation neuve (pas de `creerAffectationManuelle` ici). L'affectation de destination est construite **par spread de la source**, en ne modifiant que la position et l'origine, et en **conservant `id`, `verrouillee` et `commentaire`** :
  ```js
  const source = courant.affectations.find((a) => a.id === affectationId);
  const destination = {
    ...source,
    tourneeId: versTourneeId,
    date: versDate,
    creneau: versCreneau,        // créneau dénormalisé depuis la tournée cible
    origine: 'MANUEL',           // placement fait à la main
    updatedAt: new Date().toISOString(),
    // id, verrouillee, commentaire, personneId, createdAt : PRÉSERVÉS
  };
  const affectations = appliquerChangement(courant.affectations, { type: 'DEPLACER', affectationId, affectation: destination });
  ```
  L'`affectation` passée à `appliquerChangement` porte donc le **même `id`** que `affectationId` : `appliquerChangement` retire l'ancienne entrée puis réinsère l'affectation reconstruite (nouveau tableau, immuable — jamais de mutation en place). Le **verrou suit l'affectation** à destination (§12 #7, arbitrage du porteur). Aucune duplication : l'affectation d'origine disparaît de la case de départ.
- **`basculerVerrouillage({ commit, getters }, { affectationId })`** : bascule `verrouillee` sur l'affectation ciblée, **sans** passer par `appliquerChangement` (ce n'est pas un changement de position mais de champ) :
  ```js
  const affectations = courant.affectations.map((a) =>
    a.id === affectationId ? { ...a, verrouillee: !a.verrouillee, updatedAt: new Date().toISOString() } : a
  );
  ```
  Comme les autres gestes, capture un snapshot au préalable (le verrouillage est annulable).

### 4.5 Action `regenerer` — régénération EN PLACE (complément de `010`)

`010` créait un **nouveau** `Planning` à chaque génération (`ADD` + `SELECT`). `011` ajoute la régénération **en place**, qui **remplace les affectations du planning courant** (mutation `UPDATE_AFFECTATIONS`, **pas** un nouveau `Planning`) tout en **préservant les affectations verrouillées**.

`regenerer({ commit, getters, rootGetters, rootState }, { variante = false } = {})` :

1. `const planning = getters.courant` ; no-op si absent.
2. `commit('CAPTURER_SNAPSHOT', { planningId: planning.id, affectations: planning.affectations })` (une régénération est annulable).
3. **Calculer les options de seed/variante** à partir de `planning.parametresGeneration` (= `Resultat.meta` de `009` : `meta.seed` = graine **effective** = `base + variante`, `meta.variante` = variante). On reconstruit la graine de base et on choisit la variante :
   ```js
   const pg = planning.parametresGeneration ?? { seed: 0, variante: 0 };
   const base = (pg.seed ?? 0) - (pg.variante ?? 0);
   const options = variante
     ? { seed: base, variante: (pg.variante ?? 0) + 1 }   // « Essayer une variante » : répartition différente
     : { seed: base, variante: pg.variante ?? 0 };         // « Regénérer à l'identique » : même graine effective
   ```
   Le déterminisme du moteur (009 §6) garantit qu'« à l'identique » reproduit la même répartition (données + verrouillées inchangées), et qu'une « variante » est reproductible et progressive.
4. **Assembler l'`Entree`** sur la **période du planning**, en y injectant les **affectations verrouillées courantes** :
   ```js
   const entree = assemblerEntree(rootGetters, rootState, { debut: planning.dateDebut, fin: planning.dateFin });
   entree.affectationsVerrouillees = planning.affectations.filter((a) => a.verrouillee);
   ```
5. `const resultat = genererPlanning(entree, options)`.
6. `commit('UPDATE_AFFECTATIONS', { id: planning.id, affectations: resultat.affectations, parametresGeneration: resultat.meta })`.
7. **Retourne le `Resultat` complet** (comme `genererPropose`) pour que la vue alimente ses diagnostics volatils sans second passage moteur.

### 4.6 Action `annulerDerniereEdition`

`annulerDerniereEdition({ commit, getters })` : `if (!getters.peutAnnuler) return;` puis `commit('RESTAURER_SNAPSHOT')`. Lecture seule vis-à-vis du moteur (aucun appel). La vue re-persiste (via le plugin) et rafraîchit ses diagnostics ensuite.

### 4.7 Persisté vs volatil (récapitulatif)

- **Persisté** : `plannings.items` (les `Planning`, dont `affectations`, `origine`, `verrouillee`, `parametresGeneration`, `updatedAt`).
- **Volatil (jamais sérialisé)** : `plannings.selectionId` (déjà `010`), `plannings.snapshotEdition` (undo), l'état de `PlanningView` (mode édition, diagnostics `{ violations, tourneesNonCouvertes, score }`, orientation/échelle/date de référence, modales).

## 5. Domaine (logique pure)

Aucune logique métier dans les composants ni dans le store (le store orchestre). Un seul ajout pur ; tout le reste réutilise l'existant `009`/`010`.

### 5.1 `src/domain/planning.js` (modifier) — fabrique `creerAffectationManuelle`

Une affectation posée à la main doit porter `origine: 'MANUEL'` (02 §Affectation). La création manuelle est de la **logique domaine légitime**, mais **hors du moteur pur** (le moteur ne dépend pas de l'UI et ne pose que de l'`AUTO` via `creerAffectationAuto`) : on la place donc dans `src/domain/planning.js`, à côté de `creerPlanning`, **sur le modèle exact de `creerAffectationAuto`** (`src/domain/scheduling/modele/affectation.js`), à ceci près qu'elle pose `origine: 'MANUEL'`.

```js
/**
 * Construit une Affectation posée manuellement (origine 'MANUEL',
 * verrouillee false, commentaire ''). Mêmes concessions techniques tolérées
 * que creerAffectationAuto : genId() + new Date().toISOString().
 * @param {string} personneId
 * @param {string} tourneeId
 * @param {string} date       "YYYY-MM-DD"
 * @param {string} creneau
 * @returns {import('./scheduling/modele/affectation.js').Affectation}
 */
export function creerAffectationManuelle(personneId, tourneeId, date, creneau) { … }
```

Réutilise le `@typedef Affectation` déjà défini dans `scheduling/modele/affectation.js` (aucune duplication). Aucun import Vue/Vuex.

### 5.2 Réutilisation stricte de `009`/`010` (aucun nouvel ajout)

- **`appliquerChangement(affectations, changement)`** (`scheduling/modele/planning.js`, exporté par `@/domain/scheduling`) : déjà livré `009`, immuable, gère `AJOUTER`/`RETIRER`/`DEPLACER` (typedef `Changement`). `011` en est le **premier consommateur réel**.
- **`genererPlanning(entree, options)`** : réutilisé tel quel pour la régénération, avec `entree.affectationsVerrouillees` (préservation hybride, déjà géré par le glouton 009 §5.12).
- **`diagnostiquer` / action `evaluerCourant`** : réutilisés tels quels pour le recalcul temps réel après chaque geste.
- **`dateUtil`** (`debutSemaine`/`debutMois`/`finMois`/`moisSuivant`/`moisPrecedent`/`addDays`…) et **`libelles.js`** (`libelleCreneau`, `libelleJour`) : réutilisés pour les libellés du sélecteur et des contrôles. **Aucun objet `Date` hors `dateUtil`.**

## 6. Composants

`views/` orchestre, `components/planning/` présente. Aucune logique métier dans les composants ; l'appel moteur **toujours** via une action du store. `011` **modifie** 3 composants existants (surface d'extension `010` §6.3), **crée** 1 composant (sélecteur), et **réutilise** `DialogueConfirmation`/`ModaleBase` (`@/components/communs`).

| Fichier | Type | Responsabilité |
|---|---|---|
| `src/views/PlanningView.vue` | **modifier** | **Orchestrateur d'édition.** Détient l'état volatil `modeEdition` (bascule lecture/édition), l'état du sélecteur (`selecteurVisible`, contexte du slot ciblé), l'état de la confirmation de régénération, et `chargement` (régénération). Câble la barre d'actions du planning (Modifier/Terminer, Annuler, Regénérer à l'identique, Essayer une variante), écoute les événements d'édition de `GrillePlanning`, dispatche les actions du store, puis **rafraîchit les diagnostics** (`evaluerCourant`) après chaque geste manuel (et depuis le `Resultat` retourné après une régénération). Réutilise tout l'existant `010` (formulaire, contrôles, grille, panneau, `IndicateurSauvegarde`, région `aria-live`). |
| `src/components/planning/GrillePlanning.vue` | **modifier** | **Passe une prop `editable`** (défaut `false` → comportement `010` strictement inchangé). Quand `editable`, transmet l'édition à `CellulePlanning` (via le slot par défaut) et **coordonne la géométrie** : résout le contexte de chaque case (tournée/date/créneau), tient l'état de glisser-déposer (id de l'affectation en cours de glisse), gère les zones de dépôt sur les `<td>`. **Reste présentational** : n'appelle ni store ni moteur ; **émet** des événements sémantiques vers `PlanningView`. Enrichit chaque élément de cellule de `verrouillee` (pour l'affichage du cadenas). |
| `src/components/planning/CellulePlanning.vue` | **modifier** | **Passe une prop `editable`** (défaut `false` → rendu `010` inchangé). Quand `editable`, ajoute par élément deux boutons (retirer, verrouiller/déverrouiller) et un repère **cadenas + libellé** pour les verrouillées, rend les éléments `draggable`, et affiche un bouton **« Ajouter une personne »** quand la case est éditable. **Purement présentational** : émet des événements élémentaires (`retirer`, `verrouiller`, `ajouter-ici`, `debut-glisser`, `fin-glisser`), remontés par `GrillePlanning`. |
| `src/components/planning/SelecteurPersonne.vue` | **créer** | **Mini-sélecteur de personne**, bâti sur `ModaleBase` (`@/components/communs`) pour l'accessibilité clé en main (focus piégé, Échap, retour du focus). Titre contextualisé (« Ajouter une personne — Tournée Nord, mercredi 12/08/2026 (Matin) »). Liste les **personnes actives** (pastille + Prénom Nom), chacune un bouton ; filtre texte simple si l'équipe est grande ; note informative discrète « déjà N ce jour-là » (lecture présentationnelle des affectations du planning, **aucune règle métier**) ; masque les personnes **déjà présentes sur ce créneau exact** (dé-doublonnage). N'accède au store que pour lister les personnes/pastilles. **Émet** `choisir(personneId)` / `annuler`. |
| `src/components/communs/DialogueConfirmation.vue` | **réutiliser** | Confirmation avant une **régénération** qui écraserait des ajustements manuels non verrouillés (§8). Aucune modification. |

### 6.1 Contrat d'interaction de la grille éditable

**Activation** : prop `editable: { type: Boolean, default: false }` sur `GrillePlanning`. `PlanningView` la pilote par `:editable="modeEdition"`. À `false`, la grille est **exactement** celle de `010` (aucun événement, aucun bouton, slot par défaut inchangé).

**Ancrage de l'édition = orientation `TOURNEES`** (décision de conception, §12). Une case y représente **(tournée, date)** ; le **créneau** est celui de la tournée (dénormalisé, 02 §Affectation). Le sélecteur liste donc toujours des **personnes** (« qui couvre cette tournée ce jour ? ») — modèle mental unique et conforme à la consigne. En orientation `PERSONNES`, la grille reste **en lecture seule même en mode édition** (les cases n'ont pas de créneau propre : y « ajouter » demanderait de choisir une tournée, un second flux qu'on écarte par KISS) ; un message discret invite à basculer sur « Tournées » pour modifier. Entrer en mode édition **force l'orientation `TOURNEES`** (`PlanningView`).

**Affordances d'édition** (uniquement quand `editable` **et** orientation `TOURNEES` **et** case ni fermée ni hors période) :

- **Ajouter (clic)** : bouton « Ajouter une personne » dans la case → `GrillePlanning` émet **`ajouter { tourneeId, date, creneau }`** (créneau résolu via `tournees/byId`).
- **Retirer (clic)** : bouton croix par élément → **`retirer { affectationId }`** (`element.id` porte déjà l'id de l'affectation, `010`).
- **Verrouiller (clic)** : bouton cadenas par élément → **`verrouiller { affectationId }`** (bascule côté store).
- **Déplacer (glisser-déposer)** : glisser un élément d'une case-tournée à une autre → **`deplacer { affectationId, versTourneeId, versDate, versCreneau }`**. L'événement identifie l'affectation par son `affectationId` ; c'est l'**action store** qui reconstruit l'affectation à destination **en préservant son identité** (même `id`, `verrouillee`, `commentaire`) — voir §4.4. Une affectation **verrouillée** peut donc être déplacée et **reste verrouillée** à destination.

**Répartition présentational** : `CellulePlanning` porte les contrôles par élément et le bouton « Ajouter » (il ne connaît qu'une case) et émet des événements **élémentaires** ; `GrillePlanning` connaît les **coordonnées** (ligne = tournée, colonne = date), l'état de glisse global et les zones de dépôt, et **traduit** ces événements élémentaires en événements **sémantiques** enrichis du contexte, réémis vers `PlanningView`. `PlanningView` **seule** dispatche vers le store. Ainsi le moteur n'est jamais appelé depuis un composant ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)), et la grille demeure aussi présentationnelle qu'en `010`.

### 6.2 UX du sélecteur de personne (tranché)

**Choix : une modale** (`SelecteurPersonne` sur `ModaleBase`), **pas** un popover ni un panneau latéral. Justification pour un public non-technique :

- **Accessibilité offerte** par `ModaleBase`/Bootstrap : focus piégé, fermeture au clavier (Échap = Annuler), retour du focus au déclencheur — indispensable pour un chemin clavier complet, sans le réimplémenter.
- **Robustesse de position** : un popover ancré à une case dans un **tableau large à défilement horizontal** (échelle Mois, première colonne figée) serait fragile (débordement, recouvrement de la colonne figée). Une modale est centrée, stable, lisible sur petit écran.
- **Cohérence** : la modale est déjà le pattern de l'app (archivage, confirmations) → « la régularité rassure » (08 §10).

**Contenu** : titre contextualisé (tournée + date FR + créneau), liste des personnes actives (pastille couleur **+ Prénom Nom**, jamais la couleur seule), filtre texte optionnel, note discrète « déjà N affectation(s) ce jour-là » (aide à équilibrer la charge, purement informative). Un clic sur un nom **affecte immédiatement** et **ferme** la modale (chemin court). Les personnes déjà sur ce créneau exact sont masquées (on ne peut pas affecter deux fois la même personne au même slot). **Aucune prédiction de légalité par le moteur** dans le sélecteur (ADR 0008 + KISS) : le contrôle qui fait foi est la **revalidation temps réel** juste après le choix (§8) — panneau + grille signalent aussitôt tout conflit (congé, chevauchement, repos), corrigeable ou annulable en un geste.

### 6.3 Feedback temps réel et repères visuels

- Après **chaque** geste (ajout/retrait/déplacement/verrouillage/régénération/annulation), `PlanningView` remet à jour ses diagnostics volatils → `GrillePlanning` (surlignage des cellules concernées) et `PanneauConflits` (liste erreurs/avertissements + tournées non couvertes) **réagissent immédiatement**. Réutilise **intégralement** le mapping présentational de `010` (§6.2 de `010`) : rien de nouveau côté surlignage.
- **Erreurs dures vs avertissements souples** : distinction déjà multi-canal en `010` (icône `PhWarningOctagon` vs `PhWarning`, bordure pleine vs pointillée, teinte), réutilisée telle quelle.
- **Verrouillage** : repère **cadenas (`PhLockSimple`) + libellé** « Verrouillée » sur l'élément (jamais la seule couleur). Le bouton de bascule utilise `PhLockSimpleOpen` (déverrouillée → cliquer pour verrouiller) / `PhLockSimple` (verrouillée → cliquer pour déverrouiller), avec `aria-label` explicite. Une affectation verrouillée **reste déplaçable** (glisser-déposer ou clic) et **conserve son verrou à destination** : le cadenas suit l'affectation (§4.4, §12 #7). Un déplacement ne déverrouille **jamais**.
- **Cible de dépôt (DnD)** : la case survolée pendant une glisse reçoit un contour marqué (bordure + fond léger), retiré à la fin de la glisse ; les cases fermées / hors période ne sont **pas** des cibles.

## 7. Règles de validation

**Aucun nouveau formulaire validé** n'est introduit par `011` : le seul formulaire de l'écran reste `FormulaireGeneration` (période, `010`, inchangé). Le **sélecteur de personne** est une **liste de choix**, pas un formulaire à valider → **pas de Vuelidate** ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) s'applique « si un formulaire/sélecteur structuré apparaît » — ce n'est pas le cas). Le filtre texte du sélecteur est un simple champ de recherche local ; `vue-debounce` reste disponible si l'on souhaite lisser la frappe sur de grandes équipes (facultatif, non requis en v1).

La « validation » propre à `011` est **métier**, portée par le moteur : après chaque geste, `diagnostiquer` recalcule l'intégralité des `violations`/`tourneesNonCouvertes` (contraintes dures et souples de `009`). Aucune règle métier n'est réécrite dans l'UI (ADR 0008).

**Garde-fous non bloquants (UI)**, cohérents avec le principe « le moteur ne bloque jamais » :

- Un ajout/déplacement **manuel** n'est **jamais** empêché a priori (le référent reste maître, mode hybride) : un choix créant un conflit est **autorisé** puis **signalé** en temps réel, et **annulable**.
- Dé-doublonnage seul : le sélecteur masque une personne déjà présente sur le **même créneau exact** (évite un doublon strictement inutile) — simple lecture, pas une règle du moteur.
- Cases **fermées** / **hors période** : non éditables (pas de bouton « Ajouter », non-cibles de dépôt), pour ne pas créer d'affectation qui serait immédiatement signalée `JOUR_FERME` ou hors des bornes.

## 8. Points d'attention ergonomie

Public non-technique ([08](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Une chose à la fois** : lecture par défaut, édition sur bascule explicite ; l'action principale de l'écran reste « Générer » (`010`), les actions d'édition sont regroupées dans une **barre d'actions du planning** claire.
- **Langage humain, zéro jargon** : « Modifier le planning », « Ajouter une personne », « Retirer », « Verrouiller cette affectation », « Annuler la dernière action », « Regénérer à l'identique », « Essayer une variante ». Les messages de conflit restent **ceux du moteur** (FR, non reformulés, `010`).
- **Feedback immédiat** : chaque geste déclenche un re-surlignage + une mise à jour du panneau ; une **annonce `aria-live`** (région existante `010`) résume le résultat (« Personne ajoutée. 1 point d'attention. », « Dernière action annulée. »).
- **Tolérance à l'erreur / réversibilité** :
  - **Undo 1-niveau** (« Annuler la dernière action », icône `PhArrowCounterClockwise`) : filet principal, couvre édition **et** régénération. Bouton **désactivé** quand rien n'est annulable (`peutAnnuler`). Aucun bouton « Rétablir » (pas de redo, §7-contexte).
  - **Confirmation avant régénération destructrice** : la régénération remplace toutes les affectations non verrouillées. On demande confirmation (`DialogueConfirmation`) **uniquement** s'il existe au moins une affectation `origine: 'MANUEL' && !verrouillee` (ajustement manuel qui serait perdu) ; sinon (planning encore « brut », exploration de variantes) la régénération est directe et sans friction. Message clair : « Cela remplacera les affectations actuelles. Les affectations verrouillées seront conservées. Vous pourrez annuler cette action. »
  - **Aucune saisie perdue** : les gestes sont atomiques et persistés ; l'undo restaure l'état exact d'avant.
- **Jamais l'information par la seule couleur** : pastille **+ nom** (héritage `010`), cadenas **+ libellé**, conflit = icône/motif **+ libellé**.
- **Accessibilité — critère de sortie** : l'édition est **entièrement réalisable au clavier et au clic** (ajouter via bouton → modale navigable au clavier ; retirer/verrouiller via boutons focusables avec `aria-label` ; déplacer sans DnD via retrait + ajout par le sélecteur — en re-verrouillant au besoin, l'ajout au clic créant une affectation manuelle non verrouillée, là où un glisser-déposer préserve le verrou, §4.4). Le **glisser-déposer natif est une commodité en plus**, jamais l'unique moyen (il ne fonctionne pas au tactile — raison même pour laquelle le clic est principal). Cibles cliquables ≥ `$cible-cliquable-min` ; focus visible ; boutons d'action jamais réduits à une icône nue.
- **Cohérence des icônes** (Phosphor uniquement) : `PhPencilSimple` (modifier), `PhUserPlus` (ajouter une personne), `PhX` (retirer), `PhLockSimple`/`PhLockSimpleOpen` (verrouiller/déverrouiller), `PhArrowCounterClockwise` (annuler), `PhArrowsClockwise` (regénérer à l'identique), `PhShuffle` (essayer une variante), `PhCheck` (terminer la modification).

## 9. Étapes d'implémentation

**6 tâches**, chacune pour **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé par les dépendances : **T1 → T2 → T3 → T4 → T5 → T6**. Découpage **fin** ; **undo (T2) et glisser-déposer (T5) sont chacun isolés**. Pas de suite de tests : chaque critère est vérifiable **à la main** (console pendant `npm run dev`, ou parcours écran).

### Tâche 1 — Domaine + store : fabrique manuelle, mutation d'édition, actions d'édition, snapshot

**Fichiers** :
- `src/domain/planning.js` (**modifier**) — ajouter `creerAffectationManuelle(personneId, tourneeId, date, creneau)` (§5.1).
- `src/store/modules/plannings.js` (**modifier**) — state `snapshotEdition: null` (§4.1) ; mutations `UPDATE_AFFECTATIONS` et `CAPTURER_SNAPSHOT` (§4.3) ; actions `ajouterAffectation`/`retirerAffectation`/`deplacerAffectation`/`basculerVerrouillage` (§4.4). `REPLACE`/`ADD`/`SELECT`/`REMOVE`/`genererPropose`/`evaluerCourant`/`assemblerEntree` **inchangés**.

**Dépend de** : `010` (store `plannings`, `creerPlanning`), `009` (`appliquerChangement`, importé depuis `@/domain/scheduling`).

**Critères de sortie** (console, `npm run dev`, avec un planning courant généré via `010`) :
- `creerAffectationManuelle('p1','t1','2026-07-13','MATIN')` renvoie un objet avec **tous** les champs de 02 §Affectation, `origine === 'MANUEL'`, `verrouillee === false`, `commentaire === ''`, `id` non vide, `createdAt`/`updatedAt` ISO.
- `store.dispatch('plannings/ajouterAffectation', { tourneeId, personneId, date, creneau })` ajoute **une** affectation `MANUEL` à `courant.affectations` (nouveau tableau, `updatedAt` du planning bump), **sans muter** l'ancien tableau ; `store.state.plannings.snapshotEdition` contient l'état **d'avant** (mêmes affectations qu'avant l'ajout).
- `retirerAffectation({ affectationId })` retire l'affectation ciblée (immuable) ; `deplacerAffectation({ affectationId, versTourneeId, versDate, versCreneau })` retire l'ancienne et ajoute une affectation `MANUEL` à la position cible conservant la **même `personneId`** ; `basculerVerrouillage({ affectationId })` inverse `verrouillee` et bump l'`updatedAt` de l'affectation.
- Chaque action capture un **snapshot** juste avant (vérifier `snapshotEdition.planningId === courant.id` et `snapshotEdition.affectations` = état antérieur). Les diagnostics ne sont **pas** touchés par le store (aucune propriété diagnostics dans le state).
- La persistance se déclenche (rechargement : les affectations manuelles/verrouillées demeurent) ; **aucun** accès `localStorage` ; `snapshotEdition` **absent** du JSON exporté (`008`).
- Aucun import Vue/Vuex dans le domaine ; aucun appel moteur direct hors store ; `npm run build` réussit.

### Tâche 2 — Undo simple (1 niveau, sans redo)

**Fichiers** :
- `src/store/modules/plannings.js` (**modifier**) — mutation `RESTAURER_SNAPSHOT` (§4.3), getter `peutAnnuler` (§4.2), action `annulerDerniereEdition` (§4.6).
- `src/views/PlanningView.vue` (**modifier**) — bouton **« Annuler la dernière action »** (`PhArrowCounterClockwise` + libellé) dans une barre d'actions du planning (visible dès qu'un planning courant existe), **désactivé** quand `!peutAnnuler` ; au clic, `annulerDerniereEdition` puis `rafraichirDiagnostics()` + annonce `aria-live` « Dernière action annulée. ».

**Dépend de** : T1 (snapshot + actions d'édition).

**Critères de sortie** (console + écran) :
- Après un geste d'édition (console : `dispatch('plannings/ajouterAffectation', …)`), `getters['plannings/peutAnnuler']` est `true` et le bouton « Annuler » est **actif**.
- `dispatch('plannings/annulerDerniereEdition')` restaure **exactement** les affectations d'avant le geste ; puis `peutAnnuler` repasse à `false` et le bouton se **désactive** (undo 1-niveau, pas de redo).
- **Rechargement (F5)** : `peutAnnuler` est `false` (snapshot volatil, non persisté) — le bouton est désactivé tant qu'un nouveau geste n'a pas eu lieu.
- Générer un **nouveau** planning (`010`, autre période) puis vérifier que le bouton est désactivé (snapshot devenu obsolète : `planningId` ≠ `courant.id`).
- Aucun bouton « Rétablir » présent ; `npm run build` réussit.

### Tâche 3 — Grille éditable au clic + sélecteur de personne

**Fichiers** :
- `src/components/planning/CellulePlanning.vue` (**modifier**) — prop `editable` (défaut `false`) ; quand éditable : bouton « Ajouter une personne » (case addable), bouton « Retirer » par élément, émissions `ajouter-ici` / `retirer({ affectationId })`. Rendu lecture seule **strictement inchangé** quand `editable === false`.
- `src/components/planning/GrillePlanning.vue` (**modifier**) — prop `editable` (défaut `false`) ; transmet `editable`/`ajoutable` à `CellulePlanning` (uniquement orientation `TOURNEES`, case ni fermée ni hors période), enrichit les éléments de `verrouillee` ; réémet **`ajouter { tourneeId, date, creneau }`** et **`retirer { affectationId }`** vers le parent (créneau résolu via `tournees/byId`). Aucun événement quand `editable === false` (comportement `010`).
- `src/components/planning/SelecteurPersonne.vue` (**créer**) — modale sur `ModaleBase` (§6.2) : titre contextualisé, liste des personnes actives (pastille + nom), filtre texte, masquage des déjà-présents sur le slot, note « déjà N ce jour » ; émet `choisir(personneId)` / `annuler`.
- `src/views/PlanningView.vue` (**modifier**) — état `modeEdition` + bascule « Modifier le planning » / « Terminer la modification » (`PhPencilSimple`/`PhCheck`) ; entrer en édition **force l'orientation `TOURNEES`** ; passe `:editable="modeEdition"` à `GrillePlanning` ; sur `@ajouter` ouvre `SelecteurPersonne` (mémorise le slot) ; sur `choisir` dispatche `ajouterAffectation` puis `rafraichirDiagnostics()` + annonce ; sur `@retirer` dispatche `retirerAffectation` puis rafraîchit ; message discret en orientation `PERSONNES` invitant à passer sur « Tournées » pour modifier.

**Dépend de** : T1 (actions `ajouterAffectation`/`retirerAffectation`), `010` (grille, cellule, `ModaleBase`).

**Critères de sortie** (parcours écran, `npm run dev`) :
- **Non-régression `010`** : hors mode édition (`editable` absent/`false`), la grille et la cellule sont **identiques** à `010` (aucun bouton, aucun événement, slot par défaut inchangé) dans les 2 orientations et les 3 échelles.
- « Modifier le planning » bascule en édition et **force l'affichage « Tournées »** ; « Terminer » revient en lecture. En « Personnes », un message invite à repasser sur « Tournées » (grille non éditable).
- En édition (Tournées), une case ouverte affiche « Ajouter une personne » ; un clic ouvre la modale listant les personnes actives ; choisir un nom **ajoute l'affectation** (visible aussitôt dans la case) et **ferme** la modale ; le panneau et le surlignage se **mettent à jour immédiatement**.
- La modale masque une personne **déjà présente sur ce créneau exact** ; le filtre texte réduit la liste ; navigation et choix **au clavier** possibles (focus piégé, Échap = Annuler).
- Le bouton « Retirer » d'un élément supprime l'affectation ; diagnostics rafraîchis. Les cases **fermées / hors période** n'offrent pas « Ajouter ».
- `npm run build` réussit ; aucun import `@/domain/scheduling` dans un composant ; aucun `localStorage` direct.

### Tâche 4 — Verrouillage d'affectations

**Fichiers** :
- `src/components/planning/CellulePlanning.vue` (**modifier**) — quand éditable : bouton bascule cadenas par élément (`PhLockSimpleOpen`/`PhLockSimple`, `aria-label` explicite), émet `verrouiller({ affectationId })` ; repère permanent **cadenas + « Verrouillée »** sur les éléments `verrouillee`.
- `src/components/planning/GrillePlanning.vue` (**modifier**) — réémet `verrouiller { affectationId }` vers le parent (utilise `element.verrouillee` déjà exposé en T3).
- `src/views/PlanningView.vue` (**modifier**) — sur `@verrouiller` dispatche `basculerVerrouillage` puis `rafraichirDiagnostics()` + annonce (« Affectation verrouillée. » / « Affectation déverrouillée. »).

**Dépend de** : T1 (`basculerVerrouillage`), T3 (grille éditable + éléments enrichis de `verrouillee`).

**Critères de sortie** :
- En édition, chaque élément porte un bouton cadenas ; un clic bascule l'état ; un élément verrouillé affiche **cadenas + libellé** (jamais la seule couleur), état visible aussi en lecture (mode édition off).
- `verrouillee` est **persistée** (rechargement : l'affectation reste verrouillée) ; le verrouillage est **annulable** (undo T2 restaure l'état antérieur).
- Le verrouillage ne crée pas de faux conflit (aucune violation nouvelle du seul fait de verrouiller) ; l'`aria-label` du bouton reflète l'action à venir (verrouiller/déverrouiller).
- `npm run build` réussit.

### Tâche 5 — Glisser-déposer natif (surcouche)

**Fichiers** :
- `src/components/planning/CellulePlanning.vue` (**modifier**) — éléments `draggable="true"` en édition ; `@dragstart` → `debut-glisser({ affectationId })` ; `@dragend` → `fin-glisser`. Aucun autre changement de rendu.
- `src/components/planning/GrillePlanning.vue` (**modifier**) — tient l'état volatil `affectationEnGlissement` ; sur les `<td>` éditables (Tournées, non fermé, non hors période) `@dragover.prevent` (autorise le dépôt + repère visuel de cible) et `@drop` → émet **`deplacer { affectationId, versTourneeId, versDate, versCreneau }`** ; ignore un dépôt sur la case source, une case fermée / hors période, ou hors mode édition. Nettoie la cible à `fin-glisser`.
- `src/views/PlanningView.vue` (**modifier**) — sur `@deplacer` dispatche `deplacerAffectation` puis `rafraichirDiagnostics()` + annonce.

**Dépend de** : T1 (`deplacerAffectation`), T3 (grille éditable). Indépendant de T4.

**Critères de sortie** :
- En édition (Tournées, souris), glisser une personne d'une case-tournée à une autre **déplace** l'affectation (disparaît de l'origine, apparaît à la cible) ; diagnostics rafraîchis ; le déplacement est **annulable** (undo).
- **Préservation du verrou et de l'identité** : déplacer une affectation **verrouillée** la laisse **verrouillée** à destination (cadenas conservé), avec le **même `id`** (et le même `commentaire`) ; déplacer une affectation non verrouillée la laisse non verrouillée. **Aucune duplication** : l'affectation d'origine disparaît de la case de départ.
- Le **clic et le clavier restent pleinement suffisants** sans jamais glisser (critère d'accessibilité) : retirer puis rajouter, ou re-sélectionner, aboutit au même résultat.
- Aucun dépôt possible sur une case **fermée**, **hors période**, ou sur la **case source** ; aucun dépôt hors mode édition ; la cible de dépôt reçoit un repère visuel pendant la glisse, retiré à la fin.
- **Aucune dépendance ajoutée** (`package.json` inchangé) ; DnD via l'API HTML5 native ; `npm run build` réussit.

### Tâche 6 — Régénération en place + intégration & validation temps réel de bout en bout

**Fichiers** :
- `src/store/modules/plannings.js` (**modifier**) — action `regenerer({ variante })` en place (§4.5) : capture snapshot, calcule seed/variante depuis `parametresGeneration`, assemble l'`Entree` + `affectationsVerrouillees`, `genererPlanning`, `UPDATE_AFFECTATIONS` (avec `parametresGeneration`), retourne le `Resultat`.
- `src/views/PlanningView.vue` (**modifier**) — dans la barre d'actions : boutons **« Regénérer à l'identique »** (`PhArrowsClockwise`) et **« Essayer une variante »** (`PhShuffle`) ; confirmation (`DialogueConfirmation`) **conditionnelle** (existence d'une affectation `MANUEL && !verrouillee`, §8) ; état `chargement` pendant la régénération (comme `onGenerer` : bascule + `await $nextTick()`), alimente les diagnostics depuis le `Resultat` retourné + annonce ; **vérifie** que chaque chemin d'édition (T3/T4/T5) rafraîchit bien les diagnostics.

**Dépend de** : T1–T5 (édition, undo, verrouillage), `010` (`genererPropose`/`evaluerCourant`, `assemblerEntree`).

**Critères de sortie** (parcours écran complet) :
- **« Regénérer à l'identique »** : sur un planning inchangé (mêmes données, mêmes verrouillées), reproduit la **même répartition** (mêmes affectations aux mêmes places) ; **même `id` de planning** (mutation `UPDATE`, `items.length` inchangé, `updatedAt` bump), pas un nouveau `Planning`.
- **« Essayer une variante »** : produit une répartition **différente** (au moins pour une partie des slots libres) tout en **conservant à l'identique** les affectations `verrouillee: true`. Répéter « variante » enchaîne des propositions distinctes et reproductibles.
- **Confirmation** : demandée **seulement** quand il existe un ajustement manuel non verrouillé ; sinon régénération directe. La confirmation explique la conservation des verrouillées et la possibilité d'annuler.
- **Undo d'une régénération** : « Annuler la dernière action » revient à l'état d'avant la régénération.
- **Validation temps réel bout en bout** : après ajout/retrait/déplacement/verrouillage/régénération/annulation, grille (surlignage) et panneau (erreurs/avertissements + tournées non couvertes) sont **cohérents** et à jour ; les compteurs du panneau correspondent à la grille.
- **Rechargement (F5)** : les affectations manuelles et verrouillées demeurent ; les diagnostics sont **recalculés** (`evaluerCourant`) ; l'undo repart de zéro.
- `npm run build` réussit ; aucun `localStorage` direct ; **aucun appel moteur hors action de store**.

## 10. Critères d'acceptation

- [ ] Depuis `/planning` avec un planning courant, « Modifier le planning » rend la grille éditable (orientation Tournées) ; « Terminer » revient à la lecture seule identique à `010`.
- [ ] **Ajouter** au clic : une case de tournée ouvre un sélecteur de personnes ; choisir un nom affecte la personne, visible immédiatement.
- [ ] **Retirer** et **verrouiller** au clic : chaque affectation offre un bouton retirer et un bouton cadenas ; le verrouillage affiche un repère **icône + libellé** (jamais la seule couleur) et est **persisté**.
- [ ] **Déplacer** par **glisser-déposer** natif fonctionne (souris), **sans dépendance ajoutée**, mais n'est **jamais** l'unique moyen : tout est réalisable au **clic et au clavier** (critère de sortie accessibilité). Un déplacement **préserve l'identité** de l'affectation (même `id`, `commentaire`) et son **verrou** (`verrouillee`) : une affectation verrouillée déplacée reste verrouillée à destination.
- [ ] **Validation temps réel** : après chaque modification manuelle, les diagnostics sont **entièrement recalculés** par le moteur (via `evaluerCourant`/`diagnostiquer`) ; grille et panneau se mettent à jour instantanément, erreurs dures et avertissements distingués par icône/motif + libellé.
- [ ] **Régénération en place** : « Regénérer à l'identique » (même seed) et « Essayer une variante » (variante incrémentée) **remplacent** les affectations du planning courant (mutation `UPDATE`, **pas** un nouveau `Planning`), en **préservant** les affectations verrouillées ; `parametresGeneration` est mis à jour.
- [ ] **Confirmation** avant une régénération qui écraserait un ajustement manuel non verrouillé ; message clair, réversible.
- [ ] **Undo 1-niveau** : « Annuler la dernière action » restaure l'état d'avant le dernier geste (édition **ou** régénération) ; bouton **désactivé** quand rien n'est annulable ; **aucun** rétablissement (redo) ; snapshot **volatil** (perdu au rechargement), **jamais** dans le `SaveDocument`.
- [ ] Les affectations manuelles portent `origine: 'MANUEL'` ; les diagnostics ne sont **jamais** persistés.
- [ ] **Toute** mutation d'affectation passe par une **action du store** appelant le domaine/moteur ; **aucun** composant n'importe `@/domain/scheduling` ; **aucun** accès `localStorage` direct ; **aucun** objet `Date` hors `dateUtil`.
- [ ] `npm run build` réussit après chacune des 6 tâches.

## 11. Vérification

Parcours de bout en bout (`npm run dev`) :

1. **Pré-requis** : via `010`, générer un planning sur une semaine (≥ 2 personnes actives, ≥ 1 tournée active). Idéalement provoquer 1 conflit (une absence `VALIDE` recoupant une affectation, ou une tournée sous-couverte) pour observer le temps réel.
2. **Mode édition** : « Modifier le planning » → l'affichage bascule sur « Tournées », les affordances apparaissent. « Personnes » affiche un message invitant à repasser sur « Tournées ». « Terminer » revient en lecture.
3. **Ajouter** : cliquer « Ajouter une personne » sur une case → sélectionner un nom (au clavier aussi) → l'affectation apparaît ; le panneau/surlignage se mettent à jour. Vérifier qu'une personne déjà sur ce créneau est masquée.
4. **Retirer / Verrouiller** : retirer une affectation (diagnostics à jour). Verrouiller une affectation (cadenas + libellé) ; recharger (F5) → toujours verrouillée.
5. **Déplacer (DnD)** : glisser une personne d'une case-tournée à une autre → déplacement effectif (même `id`, verrou conservé si elle était verrouillée), diagnostics à jour. Vérifier qu'aucun dépôt n'est accepté sur une case fermée / hors période / la source. Vérifier que la couverture équivalente reste atteignable **sans** glisser, au clic (retrait puis ajout via le sélecteur — en re-verrouillant si besoin, l'ajout créant une affectation manuelle non verrouillée).
6. **Régénération** : verrouiller 1-2 affectations, faire un ajustement manuel non verrouillé, puis « Essayer une variante » → **confirmation** demandée ; après confirmation, les verrouillées sont conservées, le reste change ; même `id` de planning (l'export `008` montre un seul planning, affectations modifiées). « Regénérer à l'identique » → répartition reproduite. Vérifier que `items.length` n'augmente pas.
7. **Undo** : après un geste (ajout / retrait / déplacement / verrouillage) puis après une régénération, « Annuler la dernière action » restaure l'état précédent ; le bouton se désactive ensuite ; recharger (F5) → bouton désactivé.
8. **Temps réel & cohérence** : à chaque étape, vérifier que les cellules surlignées correspondent aux violations listées et que les tournées non couvertes du panneau correspondent aux marqueurs de la grille.
9. **Persistance** : recharger la page ; affectations manuelles + verrouillées présentes ; diagnostics recalculés ; export JSON (`008`) sans diagnostics ni snapshot d'annulation.
10. **Build** : `npm run build` réussit après chaque tâche.

## 12. Décisions à confirmer / risques

1. **Édition ancrée sur l'orientation « Tournées » ; « Personnes » reste en lecture seule même en mode édition (retenu)** — Une case-tournée a un créneau propre → le sélecteur liste des **personnes** (modèle mental unique, conforme à la consigne « liste des personnes actives »). Éditer en orientation Personnes exigerait un second flux « choisir une tournée » : écarté par KISS. Entrer en édition force l'affichage « Tournées ». **À confirmer** ; alternative future : édition symétrique côté personnes.
2. **Mode édition explicite (bascule) plutôt que grille toujours éditable (retenu)** — Pour un public non-technique : évite les modifications accidentelles, garde la lecture propre (`010`), et rend les affordances **toujours visibles** (pas de survol, inutilisable au tactile). Se mappe directement sur la prop `editable`. **À confirmer** ; alternative : édition permanente avec contrôles au survol (rejetée : tactile/accessibilité).
3. **Sélecteur de personne = modale (`ModaleBase`) (retenu)** — Accessibilité clé en main (focus piégé, Échap, retour du focus), robustesse de position dans un tableau large à colonne figée, cohérence avec les autres modales. **À confirmer** ; alternatives (popover ancré, panneau latéral) rejetées pour fragilité de position / largeur.
4. **Pas de prédiction de légalité par le moteur dans le sélecteur (retenu, KISS + ADR 0008)** — Le sélecteur n'affiche que des repères **présentationnels** (déjà-présents masqués, note « déjà N ce jour »), sans réimplémenter de règle métier. Le contrôle qui fait foi est la **revalidation temps réel** après le choix. **À confirmer** ; alternative : action moteur `candidatsPour(slot)` (surface moteur élargie, différée).
5. **Confirmation de régénération conditionnelle (retenu)** — Confirmée uniquement s'il existe un ajustement `MANUEL && !verrouillee` (donc réellement à perdre) ; sinon régénération directe pour fluidifier l'exploration de variantes. Undo reste le filet dans tous les cas. **À confirmer** ; alternative : confirmer systématiquement (plus lourd) ou jamais (moins sûr).
6. **Sémantique de `regenerer({ variante })` et calcul du seed (retenu)** — `variante: false` = « à l'identique » (graine effective conservée), `variante: true` = « essayer une variante » (variante incrémentée, base conservée). Le calcul `base = meta.seed - meta.variante` s'appuie sur le contrat `meta` de `009` (graine effective = base + variante). **Risque** : si `parametresGeneration` est absent/altéré (import ancien), repli sur `{ seed: 0, variante: 0 }` — dégradé mais sans plantage. **À confirmer.**
7. **Déplacement (DEPLACER) préserve l'identité de l'affectation — RÉSOLU (arbitrage du porteur)** — Déplacer une affectation **conserve** son **`id`**, son drapeau **`verrouillee`** et son `commentaire` ; on met à jour uniquement `tourneeId`/`date`/`creneau` (créneau dénormalisé depuis la tournée cible) et `updatedAt`, et `origine` passe à `'MANUEL'` (placement fait à la main). Le **verrou suit** l'affectation à destination : une affectation verrouillée déplacée **reste verrouillée** (le cadenas suit), un déplacement ne déverrouille jamais. L'action `deplacerAffectation` reconstruit donc la destination **par spread de la source** (pas de `creerAffectationManuelle`, pas de nouvel `id`) — voir §4.4/§6.1. **Résolu.**
8. **Recalcul complet des diagnostics après chaque geste (retenu, KISS)** — Pas de validation incrémentale (hors v1) : `evaluerCourant`/`diagnostiquer` recalcule tout (quelques ms aux volumes visés). Cohérent `009`/`010`. **À confirmer** ; la validation incrémentale reste un chantier hors v1 documenté (05 §4, 009 §12).
9. **Snapshot d'annulation dans l'état volatil du module `plannings` (retenu)** — `snapshotEdition` n'est pas sérialisé (`toSaveDocument` ne renvoie que `plannings.items`) et repart de zéro au rechargement ; l'obsolescence (nouvelle génération, import) est neutralisée par le getter `peutAnnuler` (comparaison `planningId`). **À confirmer.**
10. **Undo 1-niveau sans redo (arrêté par le porteur)** — Choix explicite (§7 du contexte). L'annulation multi-niveaux et le redo sont **hors v1**. Non rediscuté ici ; mentionné pour mémoire.
