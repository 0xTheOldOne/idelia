# Feature 0035 — Bilan qui doit quoi (Tricount)

- **Statut** : À faire
- **Dépend de** : `0033` (écran Feuille de route, `detecterRelais`, `ListeRelais`), `0034` (`calculerReversements`, `relierInfirmieres`, initiales Vega) — toutes deux livrées.
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (tout dans le navigateur), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (non concerné : **rien n'est persisté**), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (cumul et compensation en module pur), [0013](../docs/adr/0013-icones-phosphor.md) (icônes), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (Bootstrap, aucun module ajouté), [0019](../docs/adr/0019-lecture-pdf-pdfjs.md) (lecture PDF, inchangée).

## 1. Contexte & objectif

Depuis `0034`, chaque carte de la Feuille de route dit « FC (Claire) reverse 9,10 € à LR (Léa) » **patient par patient**. Sur un export d'un mois, cela fait des dizaines de petits virements, souvent dans les deux sens entre les mêmes infirmières. Le cabinet veut, comme dans Tricount, **un seul bilan pour la période** : ce que chaque infirmière a touché au total, sa part, son solde, et la **liste minimale des virements** qui solde tout.

`0035` ajoute, sur l'écran de résultat de la Feuille de route, un onglet **« Bilan de la période »** : un tableau par infirmière (a touché / sa part / doit reverser ou doit recevoir) et la liste « X reverse N € à Y », **imprimable** (sans aucun nom de patient). **Rien n'est conservé** (règle 0033) : le bilan est calculé à partir des cas déjà affichés et disparaît avec eux.

**Hors périmètre** : cumul de plusieurs fichiers (un export à la fois, inchangé) ; mémorisation ou historique des bilans ; découpage automatique par mois civil (§2.3, §12 n° 2) ; export PDF/CSV autre que l'impression du navigateur ; suivi « virement fait / pas fait ».

## 2. Écrans concernés

### 2.1 Choix : onglet sur l'écran de résultat, pas de page dédiée (écart assumé avec la roadmap)

La roadmap parlait d'une « page dédiée ». **Écarté** : rien n'étant conservé (ni Vuex, ni `localStorage`), une route séparée (`/feuille-de-route/bilan`) obligerait à **redéposer le PDF** ou à faire transiter les cas par le store — contraire à la règle 0033 (données de santé). Le PDF couvre déjà une période : le bilan est un **second regard sur la même analyse**. On réutilise donc `ListeOnglets` (`src/components/communs/ListeOnglets.vue`, 0030) dans `FeuilleDeRouteView`, état « Résultat » :

| Onglet | Code | Contenu |
|---|---|---|
| **Bilan de la période** (actif par défaut) | `bilan` | nouveau composant `BilanPeriode` (§6.1) |
| **Détail par patient** | `detail` | `ListeRelais` existant, inchangé |

Pourquoi des onglets plutôt qu'un bloc au-dessus de la liste : sur un mois, la liste est longue (le bilan serait noyé ou repousserait le détail très bas) ; les titres de jour de `ListeRelais` restent des `h2` sans renumérotation ; l'impression du bilan seul est simple (§2.4). L'onglet actif par défaut est le **Bilan** : c'est la réponse à la question « qui doit quoi à qui ? » ; le détail sert à vérifier (§12 n° 1).

Route, menu, `MenuLateral` : **inchangés**.

### 2.2 Ce qui ne change pas dans l'état « Résultat »

En-tête (titre + « Analyser un autre fichier »), résumé chiffré (focus à l'arrivée), rappel « Rien n'est enregistré… », encart « Aucun patient vu par plusieurs infirmières sur cette période » (s'il n'y a **aucun cas : pas d'onglets**, comme aujourd'hui), encart des codes Vega non reliés (placé **au-dessus des onglets**, il concerne les deux).

Nouveau, en tête du panneau « Détail par patient » (une ligne, `text-body-secondary` ou équivalent token) : « Pour savoir quoi virer au total sur la période, consultez l'onglet « Bilan de la période ». »

### 2.3 Panneau « Bilan de la période » (`BilanPeriode`)

De haut en bas :

1. **Titre** `h2` : « Bilan du 01/10/2026 au 31/10/2026 » (« Bilan du 08/10/2026 » si un seul jour), avec **à droite** un bouton **icône seule** `PhPrinter` + infobulle (`title` + `aria-label` « Imprimer le bilan ») — préférence d'en-tête du projet.
2. **Phrase d'introduction** : « Calculé sur 2 patients vus par plusieurs infirmières, pour un total de 50,15 €. » (singulier : « Calculé sur 1 patient vu… » ; compte les cas retenus, comme le résumé).
3. **Plusieurs mois** (si la période du fichier s'étend sur plus d'un mois civil) — `alert alert-info` + `PhInfo` : « Ce fichier couvre plusieurs mois : ce bilan cumule toute la période. Pour un bilan par mois, exportez de Vega un mois à la fois. »
4. **Cas exclus** (au moins un cas `montantIncomplet`) — `alert alert-warning` + `PhWarning` : « 1 patient n'est pas compté dans ce bilan car un montant est illisible (jeudi 08/10/2026). Vérifiez-le dans l'onglet « Détail par patient » et réglez-le à part. » (pluriel : « 2 patients ne sont pas comptés… (jeudi 08/10/2026, mardi 13/10/2026) »). **Aucun nom de patient**, seulement les jours.
5. **Tableau par infirmière** (vrai `<table>`, `caption` visible « Ce que chaque infirmière a touché et sa part ») :

   | Infirmière | Encaissé | Ce qui lui revient | À faire |
   |---|---|---|---|
   | **Claire Martin (FC)**<br><small>2 passages</small> | 41,90 € | 20,67 € | **Doit reverser 21,23 €** |
   | **Léa Roux (LR)**<br><small>2 passages</small> | 5,50 € | 20,67 € | **Doit recevoir 15,17 €** |
   | **CB**<br><small>code Vega non relié à l'équipe · 1 passage</small> | 2,75 € | 8,81 € | **Doit recevoir 6,06 €** |
   | **Total** | 50,15 € | 50,15 € | |

   Solde nul : « Rien à reverser ni à recevoir ». Montants alignés à droite, chiffres tabulaires. Le texte porte le sens (« Doit reverser » / « Doit recevoir »), **jamais la couleur seule**. Ligne de total en `tfoot` (permet de vérifier : touché = parts).
6. **Virements à faire** (`h3`) — bloc en évidence (même aspect que `.liste-relais__reversements` : fond clair, bordure gauche accentuée, `PhArrowsLeftRight` `aria-hidden`), une ligne par virement en gras : « **FC (Claire) reverse 15,17 € à LR (Léa)** », « **FC (Claire) reverse 6,06 € à CB** ».
   Sous le bloc : « Ces virements soldent toute la période. Ils remplacent ceux indiqués patient par patient : ne faites pas les deux. »
   Aucun virement (tous les soldes nuls) : « Rien à reverser sur la période : chaque infirmière a déjà touché sa part. »
7. **Aucun cas retenu** (tous les cas ont un montant illisible) : seulement l'encart du point 4 et « Aucun bilan possible : aucun montant n'a pu être lu en entier. » (pas de tableau, pas de virements).

Exemple du tableau ci-dessus : cas cumulés A + C du §5.4. Mobile : le tableau passe en lignes empilées avec libellés (`data-label`), sur le modèle de `src/components/planning/RecapMensuel.vue`.

### 2.4 Impression (sobre, A4 portrait existant)

- Le bouton d'impression appelle `window.print()`. Que l'utilisateur passe par ce bouton **ou** par Ctrl+P depuis n'importe quel onglet, **seul le bilan s'imprime** : titre « Feuille de route » + panneau Bilan. Masqués à l'impression : bouton « Analyser un autre fichier », résumé, rappel, encarts au-dessus des onglets, barre d'onglets, panneau « Détail par patient », bouton d'impression lui-même. Le menu latéral est déjà masqué (`App.vue`), la page A4 portrait déjà posée (`src/styles/_impression.scss`).
- Conséquence voulue : **aucun nom de patient ne peut partir sur papier** depuis cet écran (minimisation des données de santé).

## 3. Modèle de données touché

**Aucune entité persistée, aucun impact sur `schemaVersion` ni sur les migrations.** Structures volatiles (JSDoc, en mémoire dans la vue) :

```js
/**
 * @typedef {Object} LigneBilan
 * @property {string} ps                 // code Vega
 * @property {number} nbPassages         // Σ de ses passages sur les cas retenus
 * @property {number} toucheCentimes     // Σ PartRelais.toucheCentimes
 * @property {number} partCentimes       // Σ PartRelais.partCentimes
 * @property {number} soldeCentimes      // toucheCentimes − partCentimes ; > 0 = doit reverser, < 0 = doit recevoir
 *
 * @typedef {Object} BilanPeriode
 * @property {LigneBilan[]} lignes       // triées par code (localeCompare 'fr') ; vide si aucun cas retenu
 * @property {Reversement[]} virements   // compensation globale (calculerReversements) ; vide si soldes nuls
 * @property {number} totalCentimes      // Σ totalCentimes des cas retenus (= Σ touché = Σ parts)
 * @property {number} nbCasRetenus       // cas avec montants complets
 * @property {number} nbCasExclus        // cas montantIncomplet (non comptés)
 * @property {string[]} datesCasExclus   // "YYYY-MM-DD" distinctes, triées — jamais de nom de patient
 */
```

`Reversement` : typedef existant de `detecterRelais.js` (`{ de, vers, montantCentimes }`).

## 4. Store (Vuex)

**Aucun.** La vue lit toujours `personnes.items` en lecture seule (index des initiales, 0034) ; le bilan est un `computed` de `FeuilleDeRouteView` dérivé de `cas` (`data()`), perdu au démontage ou à « Analyser un autre fichier ». L'onglet actif est un état d'UI local (`data()`).

## 5. Domaine (logique pure)

### 5.1 `src/domain/feuilleDeRoute/bilanReversements.js` (**créer**)

En-tête « Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008) », **imports relatifs uniquement** (`./detecterRelais.js`), exports nommés, JSDoc complète (typedefs §3).

- `export function calculerBilan(cas)` → `BilanPeriode` :
  1. cas retenus = `cas.filter((c) => !c.montantIncomplet)` ; exclus = les autres (`nbCasExclus`, `datesCasExclus` = dates distinctes triées) ;
  2. pour chaque `PartRelais` des cas retenus, cumul par `ps` (une `Map`, jamais un objet indexé par le texte du PDF) : `nbPassages`, `toucheCentimes`, `partCentimes` ; `soldeCentimes = touche − part` ;
  3. `lignes` triées par code (`a.ps.localeCompare(b.ps, 'fr')`) — ordre stable et prévisible ;
  4. `virements = calculerReversements(lignes.map((l) => ({ ps: l.ps, ecartCentimes: l.soldeCentimes })))` — **réutilisation telle quelle** du glouton 0034 (déterministe, départage par l'ordre des lignes) ;
  5. `totalCentimes` = Σ `totalCentimes` des cas retenus.
  - **Pas de nouvel arrondi** : on additionne des centimes entiers déjà arrondis cas par cas (règle 0033/0034). Le bilan est donc exact au centime et cohérent avec le détail : solde d'une infirmière = Σ de ses écarts par cas.
  - Invariants (vérifiés par le script §11) : Σ `partCentimes` = Σ `toucheCentimes` = `totalCentimes` ; Σ `soldeCentimes` = 0 ; Σ virements = Σ soldes positifs ; au plus (lignes de solde non nul − 1) virements ; tous les montants entiers.
- `export function couvrePlusieursMois(periode)` → `boolean` : `periode !== null && periode.debut.slice(0, 7) !== periode.fin.slice(0, 7)` (chaînes `"YYYY-MM-DD"`, ADR 0010, aucun `Date`).

### 5.2 `src/domain/feuilleDeRoute/detecterRelais.js` (**modifier — JSDoc seulement**)

`calculerReversements` : élargir le type du paramètre à `Array<{ps: string, ecartCentimes: number}>` (n'utilise que ces deux champs) et compléter la description (« utilisé par cas (0034) et pour le bilan de la période (0035) »). **Aucun changement de comportement.**

### 5.3 Réutilisé (non modifié)

`relierInfirmieres.js` (`infirmiereDuCode`, `libelleInfirmiere`, `libelleCourtInfirmiere`), `src/domain/utils/montants.js` (`formaterEuros`), `src/domain/utils/dates.js` (`dateUtil.formatDateFr`, `dateUtil.weekdayISO`), `src/domain/libelles.js` (`libelleJour`).

### 5.4 Valeurs attendues

**PDF de test** (équipe : Claire Martin = FC, Léa Roux = LR) — chaque fichier ne contient qu'un cas, le bilan égale donc le cas :

| Fichier | Cas | Lignes (touché · part · solde) | Total | Virements |
|---|---|---|---|---|
| `Vega_UnDoublon.pdf` | 1 | FC 20,95 · 11,85 · +9,10 (1 passage) ; LR 2,75 · 11,85 · −9,10 (1 passage) | 23,70 | FC → LR **9,10 €** |
| `Vega_TroisDoublons.pdf` | 1 (3 passages) | FC 23,70 · 17,63 · +6,07 (2 passages) ; LR 2,75 · 8,82 · −6,07 (1 passage) | 26,45 | FC → LR **6,07 €** |
| `Vega_ZeroDoublon.pdf` | 0 | — (pas d'onglets, encart « Aucun patient… ») | — | — |

(Si le script révèle plus d'un cas dans un fichier, le bilan attendu est la somme de leurs parts : c'est précisément ce que vérifient les invariants.)

**Cas construits à la main** (script, montants en centimes) — `A` = FC 2095 · LR 275 ; `B` = LR 2095 · FC 275 ; `C` = FC 2095 · LR 275 · CB 275 (parts 882 / 882 / 881) ; `D` = LR 2095 · CB 275 ; `E` = FC 2095 · LR illisible :

| Cas cumulés | Soldes | Virements | Ce que ça prouve |
|---|---|---|---|
| A + B | FC 0 · LR 0 | aucun | les reversements opposés s'annulent |
| A + D | CB −910 · FC +910 · LR 0 | FC → CB 9,10 | **1 virement au lieu de 2** (compensation globale) |
| A + C | CB −606 · FC +2123 · LR −1517 ; total 5015, touché FC 4190 / LR 550 / CB 275, parts 2067 / 2067 / 881 | FC → LR 15,17 ; FC → CB 6,06 | cumul à 3 infirmières, ordre déterministe |
| A + E | FC +910 · LR −910 ; `nbCasExclus` 1, `datesCasExclus` = [date de E] | FC → LR 9,10 | exclusion des montants illisibles |
| E seul | `lignes` vide, `nbCasRetenus` 0 | aucun | « Aucun bilan possible » |
| aucun cas | `lignes` vide, total 0 | aucun | pas de plantage |

## 6. Composants

### 6.1 `src/components/feuilleDeRoute/BilanPeriode.vue` (**créer**) — présentationnel

- Props : `bilan` (Object, requis — `BilanPeriode`), `periode` (Object, défaut `null` — `{debut, fin}`), `infirmieres` (`Map`, défaut `() => new Map()` — index 0034).
- Méthodes de présentation déléguant au domaine (comme `ListeRelais`) : `nomLong(code)`, `nomCourt(code)`, `estRelie(code)`, `euros` (`formaterEuros`), `jourComplet(iso)` (« jeudi 08/10/2026 »), `imprimer()` → `window.print()`.
- `computed` : `titre` (§2.3 n° 1), `plusieursMois` (`couvrePlusieursMois(periode)`), phrases singulier/pluriel (introduction, cas exclus).
- Rendu §2.3 ; tableau sur le modèle de `RecapMensuel.vue` (`border-collapse`, `font-variant-numeric: tabular-nums`, `th scope="col"`, `th scope="row"` pour l'infirmière, empilement mobile avec `data-label`). **Pas** d'import du module Bootstrap `tables` (styles `scoped` en tokens, KISS).
- Bloc des virements : reprendre le style de `.liste-relais__reversements` (copie locale de quelques lignes, tokens uniquement).
- Bouton d'impression : `btn btn-sm btn-outline-primary` (ou motif `planning-bouton-icone` de `PlanningView`), `PhPrinter` `aria-hidden`, `aria-label` + `title` « Imprimer le bilan », cible ≥ `$cible-cliquable-min`, classe `d-print-none`.
- **Jamais de `v-html`** (codes PS issus du PDF, noms saisis) ; le composant ne reçoit **aucun nom de patient** (le bilan n'en contient pas).

### 6.2 `src/views/FeuilleDeRouteView.vue` (**modifier**)

- `data()` / `etatInitial()` : `ongletActif: 'bilan'` (remis à `'bilan'` par `recommencer()`).
- Constante locale `ONGLETS = [{ code: 'bilan', libelle: 'Bilan de la période' }, { code: 'detail', libelle: 'Détail par patient' }]`.
- `computed` : `bilan()` → `calculerBilan(this.cas)`.
- Template (branche `cas.length > 0`) : encart des codes non reliés (inchangé), puis `<ListeOnglets v-model="ongletActif" :onglets="ONGLETS" prefixe-id="feuille-de-route" libelle-groupe="Résultat de l'analyse" />`, puis deux panneaux `v-show` (`id="feuille-de-route-panneau-bilan|detail"`, `role="tabpanel"`, `aria-labelledby="feuille-de-route-onglet-…"`, `tabindex="0"`) : `<BilanPeriode :bilan="bilan" :periode="periode" :infirmieres="indexInfirmieres" />` et la phrase de renvoi (§2.2) + `<ListeRelais … />` inchangé.
- Impression : classe `d-print-none` sur le bouton d'en-tête, le résumé, le rappel, les encarts, `ListeOnglets` et le panneau détail ; règle `@media print` `scoped` forçant le panneau bilan visible (`display: block !important`, pour l'emporter sur le `display: none` posé par `v-show` si l'on imprime depuis l'onglet Détail) et le panneau détail masqué (`display: none !important`). Vérifier dans le build que `.d-print-none` est bien généré (utilitaires Bootstrap importés) ; sinon, règles `@media print` locales équivalentes.
- Commentaire d'en-tête : ajouter « bilan de la période (0035) calculé à la volée, jamais conservé ».

### 6.3 Réutilisé (non modifié)

`ListeOnglets` (0030), `ListeRelais` (0034), motifs d'encarts `alert-info` / `alert-warning` + icônes Phosphor, motif de tableau de `RecapMensuel.vue`, règles d'impression globales (`App.vue`, `_impression.scss`), tokens `_tokens.scss` (aucun nouveau token).

## 7. Règles de validation

Pas de saisie → pas de Vuelidate.

## 8. Points d'attention ergonomie

- **La réponse d'abord** : l'onglet Bilan s'ouvre par défaut ; les virements sont la partie la plus visible (gras, encadrés) ; le tableau sert à comprendre et vérifier.
- **Éviter le double paiement** : phrase explicite sous les virements (« Ils remplacent ceux indiqués patient par patient : ne faites pas les deux ») et renvoi depuis le détail vers le bilan.
- **Vocabulaire du cabinet** : « a touché », « sa part », « doit reverser », « doit recevoir », « reverse … à … » ; jamais « solde », « débiteur », « créancier », « compensation », « centimes » à l'écran.
- **Honnêteté** : un cas au montant illisible n'est pas compté **et on le dit**, avec le jour pour le retrouver ; un fichier sur plusieurs mois est signalé.
- **Données de santé** : ni à l'écran du bilan ni sur papier, aucun nom de patient ; rappel « Rien n'est enregistré » conservé.
- **Accessibilité** : onglets clavier (flèches, Origine/Fin — déjà dans `ListeOnglets`) ; vrai tableau avec `caption` et en-têtes `scope` ; ligne « Total » en `tfoot` ; icônes `aria-hidden` doublées de texte ; bouton icône avec nom accessible et infobulle ; contraste des petites mentions (`$couleur-texte-attenue`) ; le sens d'un montant n'est jamais porté par la seule couleur.
- **Préférences d'en-tête** : action secondaire (imprimer) en icône seule + infobulle à droite du titre du bilan ; l'action principale « Analyser un autre fichier » reste seule à droite du `h1`.

## 9. Étapes d'implémentation

**2 tâches, un sous-agent `dev-front` par tâche** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre : **T1 → T2** (T2 consomme le module de T1 ; elle peut démarrer en parallèle sur le contrat du §3 si besoin, mais sa vérification exige T1).

### Tâche 1 — Domaine : cumul et compensation globale

**Fichiers** :
- `src/domain/feuilleDeRoute/bilanReversements.js` (**créer**) — §5.1, typedefs §3.
- `src/domain/feuilleDeRoute/detecterRelais.js` (**modifier**, JSDoc seulement) — §5.2.
- `docs/architecture/09-feuille-de-route-vega.md` (**modifier**) — schéma de chaîne (`bilanReversements.js` après `detecterRelais`), ligne du tableau des modules, section « Bilan de la période » (règle de cumul, exclusion des montants illisibles, compensation par le même glouton, un bilan par fichier), « Limites connues » : remplacer « bilan mensuel prévu en 0035 » par « un bilan par fichier : exporter un mois à la fois pour un bilan mensuel », historique des décisions (+ 0035).
- `docs/architecture/06-structure-du-code.md` (**modifier**) — sous `feuilleDeRoute/` : `bilanReversements.js  # cumul de la période et virements à faire [0035]` ; commentaire du dossier « … reversements et bilan [0033, 0034, 0035] ».

**Critères de sortie** (script jetable hors dépôt, §11 étape 1) :
- Tous les cas du §5.4 donnent exactement les valeurs attendues ; invariants vérifiés sur chacun.
- `couvrePlusieursMois({debut:'2026-10-01', fin:'2026-10-31'})` = `false` ; `({debut:'2026-09-28', fin:'2026-10-04'})` = `true` ; `(null)` = `false`.
- PDF de test : valeurs du tableau §5.4 (UnDoublon, TroisDoublons, ZeroDoublon).
- Aucun import Vue/Vuex/`@/` dans `src/domain/feuilleDeRoute/` ; `npm run build` réussit.

### Tâche 2 — Onglets, composant Bilan et impression

**Fichiers** :
- `src/components/feuilleDeRoute/BilanPeriode.vue` (**créer**) — §6.1, §2.3.
- `src/views/FeuilleDeRouteView.vue` (**modifier**) — §6.2, §2.2, §2.4.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) — rôle de `/feuille-de-route` complété : « … avec qui reverse combien à qui, patient par patient et en bilan de la période (imprimable, sans nom de patient) … » ; colonne Feature : `0033`, `0034`, `0035`.
- `docs/architecture/01-vue-ensemble.md` (**modifier**) — ligne « Feuille de route » : « … → affichage des cas, des reversements et du bilan de la période ».

**Dépend de** : T1.

**Critères de sortie** : parcours §10 ; aucune somme, aucun tri ni calcul de solde dans les `.vue` (uniquement appels au domaine et conditions d'affichage sur le signe) ; aucun `v-html` ; `npm run build` réussit.

## 10. Critères d'acceptation

Équipe de test : Claire Martin = FC, Léa Roux = LR.

- [x] `Vega_UnDoublon.pdf` : après analyse, deux onglets « Bilan de la période » (actif) et « Détail par patient ». Le bilan affiche « Bilan du … au … », « Calculé sur 1 patient vu par plusieurs infirmières, pour un total de 23,70 €. », le tableau « Claire Martin (FC) — a touché 20,95 € — sa part 11,85 € — Doit reverser 9,10 € » et « Léa Roux (LR) — 2,75 € — 11,85 € — Doit recevoir 9,10 € », total 23,70 € / 23,70 €, et en évidence « **FC (Claire) reverse 9,10 € à LR (Léa)** ».
- [x] `Vega_TroisDoublons.pdf` : « Claire Martin (FC) » 2 passages, a touché 23,70 €, sa part 17,63 €, doit reverser 6,07 € ; « Léa Roux (LR) » 1 passage, 2,75 €, 8,82 €, doit recevoir 6,07 € ; total 26,45 € ; « **FC (Claire) reverse 6,07 € à LR (Léa)** ».
- [x] `Vega_ZeroDoublon.pdf` : pas d'onglets ; l'encart « Aucun patient vu par plusieurs infirmières sur cette période » est inchangé.
- [x] L'onglet « Détail par patient » montre les cartes 0034 inchangées, précédées de la phrase de renvoi vers le bilan ; les onglets se pilotent au clavier (flèches, Origine, Fin) et le panneau affiché correspond à l'onglet sélectionné.
- [x] En retirant les initiales de Léa Roux puis en ré-analysant : ligne « LR » + « code Vega non relié à l'équipe » dans le tableau, virement « FC (Claire) reverse 9,10 € à LR ».
- [x] Le bouton imprimante (infobulle « Imprimer le bilan ») ouvre l'impression ; l'aperçu ne contient que le titre et le bilan (tableau + virements), **aucun nom de patient**, ni menu, ni onglets, ni boutons. Même aperçu avec Ctrl+P depuis l'onglet « Détail par patient ».
- [x] « Analyser un autre fichier » puis nouvelle analyse : l'onglet Bilan est de nouveau actif ; quitter l'écran et revenir : écran de départ.
- [x] Après analyse, `localStorage` ne contient rien de nouveau ; la sauvegarde exportée non plus.
- [x] Le script jetable (§11 étape 1) confirme les cas cumulés du §5.4 (dont A + D → un seul virement FC → CB 9,10 €, et l'exclusion d'un cas illisible).
- [x] `npm run build` réussit.

## 11. Vérification

1. **Script jetable (T1)** — dans le dossier temporaire de session (**jamais dans le dépôt**), un `.mjs` exécuté via Vite `ssrLoadModule` (ou Node direct : les modules du dossier n'ont que des imports relatifs) qui :
   - importe par chemin absolu `src/domain/feuilleDeRoute/bilanReversements.js` et `detecterRelais.js` ;
   - construit les cas A à E du §5.4 en appelant `detecterRelais` sur des séances fictives (dates `2026-10-0x`, patients fictifs « PATIENT 1 »…, montants en centimes) puis `calculerBilan` sur les combinaisons du tableau, et contrôle valeurs + invariants (§5.1) ;
   - pour les PDF : reproduit la lecture de `0034` §11 (`pdfjs-dist/legacy/build/pdf.mjs`, mapping de l'adaptateur, `extraireSeances`, `detecterRelais`) sur `files/Vega_UnDoublon.pdf`, `Vega_TroisDoublons.pdf`, `Vega_ZeroDoublon.pdf` (chemins en argument) et affiche **uniquement** codes PS, passages et montants du bilan — **jamais de nom de patient** ;
   - est supprimé après usage ; aucune sortie collée dans un commit, une PR ou un fichier du dépôt.
2. `npm run build`.
3. Recette navigateur `http://localhost:5199/idelia/#/feuille-de-route` (équipe fictive FC / LR saisie dans Équipe) : les trois PDF, critères §10.
4. Clavier seul : Tab jusqu'aux onglets, flèches, Tab dans le panneau, bouton d'impression atteignable avec focus visible.
5. Aperçu d'impression (bouton et Ctrl+P depuis chaque onglet) : bilan seul, A4 portrait, lisible en noir et blanc.
6. Largeur mobile (≈ 375 px) : tableau empilé lisible, pas de défilement horizontal.
7. DevTools > Application : rien de nouveau dans `localStorage`.
8. Relecture `ui-ux` (formulation des phrases d'argent, risque de double paiement, onglet par défaut), puis audit `security` (aucun `v-html`, aucune donnée patient imprimable ni persistée, aucune journalisation).

## 12. Décisions à confirmer / risques

1. **Onglet plutôt que page dédiée** (écart avec la lettre de la roadmap, §2.1) : imposé par « rien n'est conservé » ; aucune route ajoutée. **Onglet actif par défaut = Bilan** : change le premier affichage des recettes 0033/0034 (les cartes sont désormais à un clic). À confirmer par le porteur ; inverser = changer la valeur initiale de `ongletActif`.
2. **Un bilan par fichier, pas par mois civil** (KISS) : le cabinet règle ses comptes au mois et exporte déjà une période de Vega ; découper automatiquement multiplierait tableaux et virements à l'écran. Un fichier à cheval sur deux mois est **signalé** (encart §2.3 n° 3). Si le besoin d'un découpage apparaît, `calculerBilan` pourra être appelé sur `cas` filtrés par mois sans autre changement.
3. **Compensation** : même glouton que 0034 (plus gros débiteur → plus gros créancier). Minimal pour 2 infirmières, au plus (n − 1) virements au-delà ; l'optimum exact est combinatoire et inutile ici. Résultat déterministe (lignes triées par code).
4. **Arrondis** : aucun nouvel arrondi ; le bilan cumule les parts arrondies par cas (la dernière infirmière de chaque cas absorbe le centime). Le bilan peut donc différer d'un « total ÷ N » calculé sur la période entière de quelques centimes : c'est voulu (cohérence exacte avec le détail patient par patient).
5. **Cas exclus** (montant illisible) : non comptés, signalés avec leur jour ; pas de bilan partiel trompeur sur ces cas. Le cabinet les règle à la main.
6. **Codes non reliés** : comptés dans le bilan sous leur code (c'est une vraie infirmière, ou un code à relier) ; l'encart existant au-dessus des onglets explique comment obtenir le nom.
7. **Impression** : via le navigateur (A4 portrait global) ; on ne crée pas d'en-tête de cabinet ni de date d'édition (à ajouter si le porteur le souhaite). Le forçage `!important` en `@media print` est la façon la plus simple de neutraliser le `v-show` ; à défaut, rendre les panneaux avec une classe conditionnelle plutôt que `v-show`.
8. **Données de santé** : le bilan ne reçoit ni ne rend aucun nom de patient ; seuls les jours des cas exclus apparaissent. Aucun écart d'ADR : rien n'est persisté (ADR 0005 non concerné, règle 0033), logique en module pur (ADR 0008), aucun module Bootstrap ajouté (ADR 0015), icônes Phosphor (ADR 0013).

## 13. Retouches de recette (2026-10-14)

Après relecture `ui-ux` : colonnes « Encaissé / Ce qui lui revient / À faire » ; phrase d'explication placée **au-dessus** du tableau (la légende devient `caption` réservée aux lecteurs d'écran) ; avertissement anti double paiement en gras. Recette navigateur : 13 critères vérifiés, impression limitée au bilan quel que soit l'onglet (aucun nom de patient), rien de persistant ; non-régression 0033/0034 (détail désormais dans l'onglet « Détail par patient »).
