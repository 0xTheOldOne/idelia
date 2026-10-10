# Feature 0034 — Initiales Vega des personnes et reversements entre infirmières (Feuille de route)

- **Statut** : À faire
- **Dépend de** : `0004` (équipe : `Personne`, `FormulairePersonne`, `EquipeView`), `0008` (export/import JSON via `migrate`), `0033` (écran Feuille de route, `detecterRelais`, `ListeRelais` — implémentée, non commitée).
- **ADR liés** : [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (nouveau champ persisté, via le store et le plugin de persistance uniquement), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (export/import : migration de schéma), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (liaison et reversements en modules purs), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0013](../docs/adr/0013-icones-phosphor.md) (icônes), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (Bootstrap), [0019](../docs/adr/0019-lecture-pdf-pdfjs.md) (lecture PDF, inchangée).

## 1. Contexte & objectif

La Feuille de route (`0033`) affiche les infirmières par leur **code Vega** (colonne « PS » : FC, LR, CB, EMM…), que le cabinet doit traduire de tête, et propose une répartition « À verser » qui ne dit pas **qui doit de l'argent à qui**. Or, dans la réalité, la Sécurité sociale paie **chaque ligne à l'infirmière de la ligne** : celle du matin touche le soin de base (BSx) + l'IFI, celles des passages suivants ne touchent que l'IFI. Il faut donc rééquilibrer par un virement.

`0034` :
1. ajoute à chaque personne un champ **« Initiales Vega »** (facultatif, unique), saisi dans sa fiche et visible sur la page Équipe ;
2. relie, sur la Feuille de route, chaque code PS à la personne correspondante (« Claire Martin (FC) ») — **lecture seule** du store, toujours **rien de persistant issu du PDF** ;
3. calcule, pour chaque cas, ce que chaque infirmière **a touché**, **sa part** équitable, et la liste minimale des **reversements** : « FC (Claire) reverse 9,10 € à LR (Léa) ».

**Hors périmètre / suite** : total mensuel et bilan global « qui doit quoi à qui » sur toute la période (page façon Tricount) → **feature `0035` « Bilan qui doit quoi (Tricount) »**, ajoutée à la roadmap (⬜). Aucun historique, aucune mémorisation d'analyse, aucune impression dans `0034`. Le plan `0033` notait le rapprochement équipe ↔ codes PS comme hors périmètre : c'est précisément ce que `0034` apporte.

## 2. Écrans concernés

### 2.1 Modale « Ajouter / Modifier une personne » (`FormulairePersonne`, route `/equipe`)

- Nouveau champ **« Initiales Vega (facultatif) »**, placé juste **après « Statut »** (champ court, largeur ~8rem).
- Aide sous le champ (`form-text`) : « Le code de 2 à 4 lettres ou chiffres qui désigne cette personne dans Vega (colonne « PS »), par exemple FC. Sert à afficher son nom sur la Feuille de route. »
- La saisie passe **automatiquement en majuscules** pendant la frappe (« fc » s'affiche « FC ») ; les espaces autour sont retirés.
- Erreurs affichées **après sortie du champ** ou à la tentative d'enregistrement (comme les autres champs), avec un message qui dit quoi faire (§7). Le brouillon n'est jamais perdu.

### 2.2 Page Équipe (`/equipe`)

Dans la ligne de chaque personne (actives **et** archivées), les initiales Vega apparaissent **uniquement dans la pastille de couleur** (Tâche 5) : pas de mention « Initiales Vega : … » dans la ligne de détails (retour utilisateur).

### 2.3 Feuille de route (`/feuille-de-route`), état « Résultat »

- **Passages** : « Infirmière : Claire Martin (FC) ». Si le code n'est relié à personne : « Infirmière : EMM » suivi, en petit et atténué, de « code Vega non relié à l'équipe ».
- **Encart d'aide** (au-dessus de la liste, seulement s'il existe au moins un code non relié dans les cas affichés) — `alert alert-info` + `PhInfo` : « Les codes Vega EMM et CB ne sont reliés à aucune personne de l'équipe : seul le code est affiché. Pour voir les noms, renseignez le champ « Initiales Vega » dans la fiche de chaque personne (page **Équipe**), puis analysez à nouveau le fichier. » — « page Équipe » est un `router-link` vers `{ name: 'equipe' }`. (Le résultat n'étant pas conservé, la phrase dit honnêtement qu'il faudra refaire l'analyse.)
- **Récapitulatif d'une carte** (remplace l'ancienne ligne « À verser : … ») :
  1. Ligne d'explication : « Total 23,70 € pour 2 passages, soit 11,85 € par passage. »
  2. Une ligne par infirmière : « **Claire Martin (FC)** a touché 20,95 € — sa part : 11,85 € » ; si elle a fait plusieurs passages : « **Claire Martin (FC)** a touché 23,70 € pour 2 passages — sa part : 17,63 € ».
  3. **Phrase en évidence** (bloc à fond clair accentué + bordure gauche marquée + icône `PhHandCoins` `aria-hidden`), une ligne par reversement : « **FC (Claire) reverse 9,10 € à LR (Léa)** ». Sans prénom connu : « FC reverse 9,10 € à LR ».
  4. Si aucun reversement n'est nécessaire (écarts nuls) : « Rien à reverser : chaque infirmière a déjà touché sa part. »
  5. Si `montantIncomplet` : « Montant illisible pour au moins un passage : impossible de calculer qui reverse quoi. » (ni lignes « a touché », ni reversement).
- Phrase d'introduction de l'état Attente ajustée : « Repérez les patients vus plusieurs fois dans la journée par des infirmières différentes, et qui doit reverser combien à qui. Déposez la *Liste des séances sur une période* exportée de Vega. »

## 3. Modèle de données touché

### 3.1 `Personne` — nouveau champ persisté

| champ | type | oblig. | notes |
|---|---|---|---|
| initialesVega | string `^[A-Z0-9]{2,4}$` \| null | non | code « PS » de la personne dans Vega ; `null` si non renseigné ; **unique** parmi toutes les personnes (actives et archivées) ; stocké **en majuscules, sans espaces** [0034] |

### 3.2 Schéma de sauvegarde : v4 → **v5**

Convention du projet ([03 §Versionnement](../docs/architecture/03-modele-de-donnees.md) : « toute évolution de la forme des données ⇒ bump ») : `CURRENT_SCHEMA_VERSION` passe de **4 à 5**, avec `MIGRATIONS[4]` :

```js
// Chaque personne reçoit initialesVega: personne.initialesVega ?? null (idempotent).
// tournees, absences, plannings, cabinet : inchangés.
```

- Appliquée au chargement (`storageRepository.load()` → `bootstrap`) **et** à l'import d'un ancien fichier (`importer`), via `migrate()` : **rien à changer** côté appelants.
- **Export** : `toSaveDocument` sérialise `personnes.items` tels quels → le champ est exporté sans code supplémentaire. **Import** d'un fichier v4 → champ `null` pour chaque personne ; import d'un fichier v5 → champ conservé. Un fichier v6 reste refusé (garde existante).
- `verifierIntegrite` : **inchangée** (voir §12 n° 3 : un doublon ou une valeur mal formée introduite à la main dans un JSON ne bloque pas l'import ; la liaison §5.3 y est tolérante).
- **Coordination** : `0020`, `0023`, `0029`, `0030` prévoient aussi une migration. Le numéro est séquentiel : si une autre feature a déjà livré la v5, prendre la version libre suivante (`MIGRATIONS[n]` avec `n = CURRENT_SCHEMA_VERSION` courant).

### 3.3 Structures volatiles de la Feuille de route (JSDoc, jamais persistées)

`PartRelais` est **redéfinie** (le champ ambigu `montantCentimes` est remplacé par des noms explicites ; `0033` n'est pas encore commitée, aucun autre consommateur que `ListeRelais`) et `CasRelais` reçoit `reversements` :

```js
/**
 * @typedef {Object} PartRelais
 * @property {string} ps                 // code Vega
 * @property {number} nbPassages
 * @property {number} toucheCentimes     // somme des montants de SES lignes (ce que la Sécu lui paie)
 * @property {number} partCentimes       // part équitable : total × ses passages ÷ N (dernière = reste)
 * @property {number} ecartCentimes      // toucheCentimes − partCentimes ; > 0 = doit reverser, < 0 = doit recevoir
 *
 * @typedef {Object} Reversement
 * @property {string} de                 // code PS qui verse
 * @property {string} vers               // code PS qui reçoit
 * @property {number} montantCentimes    // > 0
 *
 * @typedef {Object} CasRelais           // champs 0033 inchangés, plus :
 * @property {PartRelais[]} parts        // vide si montantIncomplet ; Σ partCentimes = total ; Σ ecartCentimes = 0
 * @property {Reversement[]} reversements // vide si montantIncomplet ou si tous les écarts sont nuls
 *
 * @typedef {Object} PersonneReliee      // projection minimale d'une Personne pour l'affichage
 * @property {string} id
 * @property {string} prenom
 * @property {string} nom
 * @property {boolean} actif
 *
 * @typedef {Object} InfirmiereVega
 * @property {string} code               // code PS tel que lu dans le PDF
 * @property {(PersonneReliee|null)} personne // null = code non relié à l'équipe
 */
```

## 4. Store (Vuex)

**Aucun module, getter, mutation ni action ajouté.**

- `personnes/ajouter` construit la personne via `creerPersonne` (qui gère le nouveau champ, §5.1) ; `personnes/modifier` fusionne le patch émis par le formulaire (qui contient désormais `initialesVega`) : aucun changement.
- Les écrans lisent la collection complète par `mapState('personnes', { toutesLesPersonnes: 'items' })` (actives **et** archivées) — en lecture seule.
- La Feuille de route **ne commit rien** et n'écrit rien : l'index des initiales est un `computed` de la vue.
- Persisté : `Personne.initialesVega`. Volatil : tout ce qui vient du PDF (inchangé depuis `0033`).

## 5. Domaine (logique pure)

### 5.1 `src/domain/initialesVega.js` (**créer**) — règles du champ

Module pur, **sans aucun import** (il est chargé à la fois par `@/domain/personnes.js` et, en **import relatif**, par `src/domain/feuilleDeRoute/` que le script Node de vérification charge sans Vite).

- `export const FORMAT_INITIALES_VEGA = /^[A-Z0-9]{2,4}$/;` (même forme que la cellule PS reconnue par `extraireSeances`).
- `export function normaliserInitialesVega(valeur)` → `string|null` : `String(valeur ?? '').trim().toUpperCase()`, `null` si vide. **Ne valide pas** le format (c'est le rôle de `estInitialesVegaValide`).
- `export function estInitialesVegaValide(valeur)` → `boolean` : `true` si la valeur normalisée est `null` (champ facultatif) **ou** respecte `FORMAT_INITIALES_VEGA`.
- `export function personneAvecInitialesVega(valeur, personnes, idExclu = null)` → la première `Personne` (actives et archivées) dont `normaliserInitialesVega(p.initialesVega)` égale la valeur normalisée, en ignorant `idExclu` (la personne en cours d'édition) ; `null` si la valeur est vide ou libre. Sert à la règle d'unicité **et** au message (nom de la personne qui les utilise).

### 5.2 `src/domain/personnes.js` (**modifier**)

- Typedef `Personne` : `@property {(string|null)} initialesVega - Code « PS » dans Vega (2-4 car. A-Z0-9, majuscules), ou null.`
- `creerPersonne` : `initialesVega: normaliserInitialesVega(champs.initialesVega)` (import `@/domain/initialesVega.js`, cohérent avec le reste du fichier).

### 5.3 `src/domain/feuilleDeRoute/relierInfirmieres.js` (**créer**) — liaison code PS → personne

Module pur, **imports relatifs uniquement** (`../initialesVega.js`), en-tête « Module pur : aucun import Vue/Vuex… (ADR 0008) ».

- `export function indexerParInitialesVega(personnes)` → `Map<string, PersonneReliee>` : clé = `normaliserInitialesVega(p.initialesVega)` (personnes sans initiales ignorées). **Collision** (seulement possible via un JSON modifié à la main) : une personne **active** l'emporte sur une archivée ; à statut égal, la première de la liste. Projection `{ id, prenom, nom, actif }` (on ne fait circuler que le nécessaire).
- `export function infirmiereDuCode(code, index)` → `InfirmiereVega` : recherche **insensible à la casse** (`normaliserInitialesVega(code)`).
- `export function libelleInfirmiere(infirmiere)` → « Claire Martin (FC) » si reliée, sinon « FC ».
- `export function libelleCourtInfirmiere(infirmiere)` → « FC (Claire) » si reliée, sinon « FC » (phrase de reversement, §12 n° 1).
- `export function codesNonRelies(cas, index)` → `string[]` : codes PS distincts apparaissant dans les passages des cas fournis et absents de l'index, triés (`localeCompare(…, 'fr')`).

### 5.4 `src/domain/feuilleDeRoute/detecterRelais.js` (**modifier**)

- `repartir(passages, total)` produit désormais des `PartRelais` complètes (§3.3) :
  - `partCentimes` : **règle inchangée** — `Math.round(total × n / N)`, la **dernière** infirmière (ordre de première apparition) reçoit `total − somme des autres` ;
  - `toucheCentimes` : somme des `montantCentimes` des passages de cette infirmière ;
  - `ecartCentimes = toucheCentimes − partCentimes`.
- `export function calculerReversements(parts)` → `Reversement[]`, **glouton en centimes entiers** :
  1. débiteurs = parts d'écart `> 0` (montant = écart), créanciers = parts d'écart `< 0` (montant = −écart) ; écarts nuls ignorés ;
  2. tant qu'il reste un débiteur et un créancier : prendre le **plus gros débiteur** et le **plus gros créancier** (à montant égal : ordre de première apparition dans `parts` — tri stable, résultat **déterministe**), virer `m = min(dette, créance)`, décrémenter les deux, retirer ceux qui tombent à 0 ;
  3. garantie : Σ montants versés = Σ écarts positifs ; au plus `(débiteurs + créanciers − 1)` virements.
- `detecterRelais` : `reversements = montantIncomplet ? [] : calculerReversements(parts)`. Tri, groupement, `libelleMoment`, `partParPassageCentimes` : **inchangés**.
- Mettre à jour l'en-tête du module et les typedefs (§3.3).

**Exemples de référence** (à reproduire dans le script de vérification) :

| Cas | Passages | Total | Parts | Touché | Écarts | Reversements |
|---|---|---|---|---|---|---|
| 2 passages | FC 20,95 · LR 2,75 | 23,70 | FC 11,85 · LR 11,85 | FC 20,95 · LR 2,75 | +9,10 · −9,10 | FC → LR 9,10 |
| 3 passages | FC 20,95 · FC 2,75 · LR 2,75 | 26,45 | FC 17,63 · LR 8,82 | FC 23,70 · LR 2,75 | +6,07 · −6,07 | FC → LR 6,07 |
| 3 infirmières | FC 20,95 · LR 2,75 · CB 2,75 | 26,45 | FC 8,82 · LR 8,82 · CB 8,81 | 20,95 · 2,75 · 2,75 | +12,13 · −6,07 · −6,06 | FC → LR 6,07 ; FC → CB 6,06 |
| Écarts nuls | FC 10,00 (BSA1) · LR 10,00 (BSA1) | 20,00 | 10,00 · 10,00 | 10,00 · 10,00 | 0 · 0 | aucun |
| Montant illisible | FC 20,95 · LR ? | — | — | — | — | aucun (`montantIncomplet`) |

### 5.5 Réutilisé (non modifié)

`src/domain/utils/montants.js` (`formaterEuros`), `src/domain/utils/id.js` (`genId`), `src/domain/feuilleDeRoute/extraireSeances.js`, `src/domain/libelles.js`, `src/domain/utils/dates.js`.

## 6. Composants

### 6.1 `src/components/equipe/FormulairePersonne.vue` (**modifier**)

- **Nouvelle prop** `personnes` (Array, défaut `() => []`) : toutes les personnes (actives et archivées), pour la règle d'unicité. Le composant reste présentationnel (aucun accès au store).
- Brouillon : `initialesVega: this.personne?.initialesVega ?? ''` (création : `''`).
- Champ (`id="personne-initiales-vega"`) après « Statut » : `<input type="text" maxlength="4" autocomplete="off" spellcheck="false" autocapitalize="characters">`, classes/attributs d'erreur sur le modèle des autres champs (`is-invalid`, `aria-describedby` = aide + erreur via `describedBy`), `@blur` → trim + `$touch()`.
- Majuscules à la frappe : `@input` → `formulaire.initialesVega = event.target.value.toUpperCase()` (pas de `v-model.trim` : le trim se fait au `blur` et à l'émission, pour ne pas gêner la frappe).
- Validations (§7) : règles `format` et `unique`, via les fonctions du domaine (§5.1) — **aucune regex ni recherche dans le composant**.
- `champsEnOrdre()` : insérer `{ validation: v$.formulaire.initialesVega, id: 'personne-initiales-vega' }` après `nom`.
- `soumettre()` émet `initialesVega: normaliserInitialesVega(this.formulaire.initialesVega)` (→ `null` si vide).
- Style : `.formulaire-initiales { max-width: 8rem; }`, tokens uniquement.

### 6.2 `src/views/EquipeView.vue` (**modifier**)

- `...mapState('personnes', { toutesLesPersonnes: 'items' })` → `<FormulairePersonne :personnes="toutesLesPersonnes" …>`.
- Lignes « actifs » et « archivées » : `<template v-if="personne.initialesVega"> · Initiales Vega : {{ personne.initialesVega }}</template>` dans `.equipe-details`.

### 6.3 `src/views/FeuilleDeRouteView.vue` (**modifier**)

- `...mapState('personnes', { toutesLesPersonnes: 'items' })` (lecture seule).
- `computed` : `indexInfirmieres` = `indexerParInitialesVega(this.toutesLesPersonnes)` ; `codesNonRelies` = `codesNonRelies(this.cas, this.indexInfirmieres)` ; `texteCodesNonRelies` (« Le code Vega EMM n'est relié… » / « Les codes Vega EMM et CB ne sont reliés… », singulier/pluriel, liste « A, B et C »).
- Encart d'aide §2.3 au-dessus de `ListeRelais`, si `codesNonRelies.length > 0` (`router-link` vers `{ name: 'equipe' }`, `RouterLink` global déjà disponible).
- `<ListeRelais :cas="cas" :infirmieres="indexInfirmieres" />`.
- Phrase d'introduction ajustée (§2.3). Aucun autre changement (étapes, erreurs, résumé, focus).
- Commentaire d'en-tête : préciser « lit les personnes du store en lecture seule pour afficher les noms ; n'écrit rien ».

### 6.4 `src/components/feuilleDeRoute/ListeRelais.vue` (**modifier**)

- **Nouvelle prop** `infirmieres` (`Map`, défaut `() => new Map()`) : index produit par `indexerParInitialesVega`.
- Méthodes de présentation déléguant au domaine : `infirmiere(code)` → `infirmiereDuCode(code, this.infirmieres)` ; `libelleInfirmiere`, `libelleCourtInfirmiere`.
- Passage : « Infirmière : {{ libelleInfirmiere(infirmiere(p.ps)) }} » + si non reliée `<span class="liste-relais__non-relie">code Vega non relié à l'équipe</span>` (petit, `t.$couleur-texte-attenue`).
- Récapitulatif (§2.3) : ligne d'explication, `<ul>` des parts (« **{nom}** a touché X — sa part : Y »), bloc `.liste-relais__reversements` (une `<p>` par reversement, `<strong>` sur toute la phrase, icône `PhHandCoins` `aria-hidden`), cas « Rien à reverser » et cas `montantIncomplet`.
- Supprimer l'ancienne ligne « À verser : … » et la classe `.liste-relais__verser`.
- Toujours **aucun `v-html`** (codes et noms rendus par interpolation). Ne pas reposer l'information sur la seule couleur : la phrase est un texte complet.

### 6.5 Réutilisé

`ModaleBase`, motif d'erreur `.formulaire-erreur` + `PhWarning`, encarts `alert-info` + `PhInfo`, tokens `_tokens.scss` (aucun nouveau token).

## 7. Règles de validation

Champ **facultatif** : vide → aucune erreur, enregistré `null`. Les règles s'appliquent à la valeur **normalisée** (trim + majuscules), via le domaine :

| Règle (Vuelidate) | Condition (domaine) | Message |
|---|---|---|
| `format` | `estInitialesVegaValide(valeur)` | « Saisissez de 2 à 4 lettres sans accent ou chiffres, sans espace, par exemple FC. » |
| `unique` | `personneAvecInitialesVega(valeur, personnes, personne?.id) === null` | « Ces initiales sont déjà utilisées par Claire Martin. Chaque personne doit avoir des initiales Vega différentes. » (ajouter « (personne archivée) » après le nom si elle est archivée) |

- Message dynamique : `helpers.withMessage(() => …, validateur)` qui relit `personneAvecInitialesVega` pour le nom.
- Moment d'affichage : après `blur` ou à la soumission (comme les autres champs ; pas d'erreur sur un formulaire vierge).
- Pas de `vue-debounce` : la vérification est instantanée (quelques personnes), elle ne déclenche ni écriture ni calcul coûteux.

## 8. Points d'attention ergonomie

- **Vocabulaire du cabinet** : « Initiales Vega », « code Vega », « a touché », « sa part », « reverse … à … » ; jamais « écart », « débiteur », « créancier », « centimes » à l'écran.
- **La phrase qui compte est visible tout de suite** : « FC (Claire) reverse 9,10 € à LR (Léa) » en gras, encadrée, sous les lignes de détail ; le détail « a touché / sa part » permet de la vérifier.
- **Champ facultatif clairement indiqué** (« (facultatif) » dans le libellé) avec un exemple (« par exemple FC ») et l'usage expliqué (Feuille de route).
- **Pas de surprise** : majuscules automatiques, message d'unicité qui nomme la personne concernée (on sait quoi corriger).
- **Honnêteté** : un code non relié n'est pas une erreur bloquante ; l'encart explique comment obtenir les noms et prévient qu'il faudra relancer l'analyse.
- **Accessibilité** : champ relié à son aide et à son erreur (`aria-describedby`) ; focus sur le premier champ en erreur ; icônes `aria-hidden` toujours doublées d'un texte ; contraste suffisant pour la mention atténuée ; la liste des parts est une vraie liste (`<ul>`).
- **Préférences d'en-tête** : aucun nouveau bouton ; si une action secondaire apparaissait plus tard, icône seule + infobulle à droite du titre.

## 9. Étapes d'implémentation

**5 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre : **T1 → T2 → T3 → T4** (T2 et T3 ne dépendent que de T1 ; T4 dépend de T1 et T3).

### Tâche 1 — Modèle `Personne`, règles des initiales, migration v5

**Fichiers** :
- `src/domain/initialesVega.js` (**créer**) — §5.1.
- `src/domain/personnes.js` (**modifier**) — §5.2.
- `src/storage/migrations.js` (**modifier**) — `CURRENT_SCHEMA_VERSION = 5` ; `MIGRATIONS[4]` documentée en JSDoc sur le modèle de `MIGRATIONS[2]` (§3.2).
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — ligne `initialesVega` dans le tableau `Personne` (§3.1).
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) — `schemaVersion` 5 (structure racine, commentaire « v5 = Personne.initialesVega », exemple), `"initialesVega": "CM"` dans la personne d'exemple, `CURRENT_SCHEMA_VERSION (= 5)`, paragraphe **`MIGRATIONS[4]` (v4 → v5)**.

**Critères de sortie** :
- Script jetable (dossier temporaire de session, hors dépôt) important `src/domain/initialesVega.js` par chemin absolu : `normaliserInitialesVega(' fc ') === 'FC'`, `('') === null`, `(null) === null` ; `estInitialesVegaValide` vrai pour `null`, `'FC'`, `'EMM'`, `'A1B2'`, faux pour `'F'`, `'ABCDE'`, `'F C'`, `'ÉM'`, `'F-C'` ; `personneAvecInitialesVega('fc', [p1{FC}], null)` = p1, `(…, p1.id)` = `null` (ids des personnes de test en GUID via `crypto.randomUUID()`).
- Au rechargement de l'app avec des données v4 dans `localStorage` : aucune erreur ; après un geste persistant, `schemaVersion: 5` et `"initialesVega": null` sur chaque personne.
- Export puis import du fichier obtenu : identique. Import d'un fichier v4 : personnes avec `initialesVega: null`.
- `src/domain/initialesVega.js` n'a **aucun import** ; `npm run build` réussit.

### Tâche 2 — Formulaire de personne et page Équipe

**Fichiers** :
- `src/components/equipe/FormulairePersonne.vue` (**modifier**) — §6.1, §7.
- `src/views/EquipeView.vue` (**modifier**) — §6.2.

**Dépend de** : T1.

**Critères de sortie** :
- Saisir « fc » → affiché « FC » ; enregistrer → la pastille affiche « FC » ; `localStorage` contient `"initialesVega": "FC"`.
- Laisser vide → enregistré `null`, rien d'affiché dans la ligne.
- « F », « F C », « ÉM », « F-C » → message de format (5 caractères impossibles : `maxlength="4"`) ; « FC » sur une 2ᵉ personne → message d'unicité nommant la 1ʳᵉ ; idem si la 1ʳᵉ est archivée (mention « (personne archivée) »).
- Modifier une personne sans toucher ses initiales → pas d'erreur d'unicité contre elle-même.
- Le focus va sur le champ « Initiales Vega » s'il est le premier en erreur ; `npm run build` réussit.

### Tâche 3 — Domaine Feuille de route : liaison et reversements

**Fichiers** :
- `src/domain/feuilleDeRoute/relierInfirmieres.js` (**créer**) — §5.3.
- `src/domain/feuilleDeRoute/detecterRelais.js` (**modifier**) — §5.4, typedefs §3.3.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — sous `domain/` : `initialesVega.js  # règles du champ Personne.initialesVega [0034]` ; sous `feuilleDeRoute/` : `relierInfirmieres.js` ; mettre à jour le commentaire du dossier (« … détection des relais, répartition et reversements [0033, 0034] »).

**Dépend de** : T1 (`initialesVega.js`).

**Critères de sortie** (script Node jetable **hors dépôt**, §11 étape 1) :
- `Vega_UnDoublon.pdf` : **348** séances, **1** cas, 2 passages ; parts FC 1185 / LR 1185 ; touché FC 2095 / LR 275 ; écarts +910 / −910 ; `reversements = [{ de: 'FC', vers: 'LR', montantCentimes: 910 }]`.
- `Vega_TroisDoublons.pdf` : **349** séances, **1** cas, 3 passages ; total 2645 ; parts FC 1763 / LR 882 ; touché FC 2370 / LR 275 ; `reversements = [{ de: 'FC', vers: 'LR', montantCentimes: 607 }]` (codes exacts du fichier à confirmer par le script ; les montants font foi).
- Tous les cas construits à la main du tableau §5.4 donnent le résultat attendu ; pour chaque cas : Σ `partCentimes` = total, Σ `ecartCentimes` = 0, tous les montants sont des entiers, Σ reversements = Σ écarts positifs.
- Liaison : personnes fictives `{FC}` active et `{LR}` archivée (ids GUID) → `libelleInfirmiere` « Prénom Nom (FC) », `libelleCourtInfirmiere` « FC (Prénom) », code `'lr'` relié (casse ignorée), code `'EMM'` non relié → `codesNonRelies` = `['EMM']` ; collision active/archivée → l'active l'emporte.
- Aucun import Vue/Vuex/`@/` dans `src/domain/feuilleDeRoute/` ni dans `src/domain/initialesVega.js` ; `npm run build` réussit.

### Tâche 4 — Affichage Feuille de route

**Fichiers** :
- `src/views/FeuilleDeRouteView.vue` (**modifier**) — §6.3.
- `src/components/feuilleDeRoute/ListeRelais.vue` (**modifier**) — §6.4.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) — description de `/feuille-de-route` complétée : « … avec qui reverse combien à qui (noms via les initiales Vega de l'équipe) | 0033, 0034 ».

**Dépend de** : T1, T3 (T2 recommandé pour le test manuel : saisir les initiales).

**Critères de sortie** : parcours §10 (Feuille de route) ; plus aucune référence à `part.montantCentimes` ni à « À verser » ; aucune logique de calcul ou de recherche dans les `.vue` (uniquement appels au domaine) ; `npm run build` réussit.

### Tâche 6 — Repères du planning imprimé (diffusion)

**Fichiers** : `src/domain/diffusion.js` (**modifier** — `calculerReperesPersonnes`, JSDoc).

**Règle** : sur le planning imprimé (vue Diffusion, légende comprise), le repère d'une personne est son `initialesVega` (normalisé) lorsqu'il est renseigné. Les autres suivent l'algorithme de la feature 0012 (initiale du prénom, puis prénom + nom, puis suffixe numérique) en évitant tout code déjà pris par une initiale Vega (si le repère calculé est réservé, on passe au niveau suivant puis au suffixe). Résultat déterministe, indépendant de l'ordre d'entrée, unique dans le tirage. Sans aucune initiale Vega : comportement inchangé. `DiffusionView` transmet déjà les personnes du store (champ `initialesVega` inclus).

### Tâche 5 — Initiales dans les pastilles de personne

Demande ajoutée : afficher les initiales dans les pastilles de couleur des personnes, là où elles sont assez grandes (`$espace-5`).

**Fichiers** :
- `src/domain/personnes.js` (**modifier**) — `reperePersonne(personne)` : `initialesVega` normalisées, sinon 1re lettre du prénom, sinon du nom, sinon `''` (majuscules `fr`, accents conservés) ; `couleurTexteRepere(couleur)` : texte clair sur fond foncé (`estCouleurFoncee`), sinon foncé (contraste AA).
- `src/styles/_mixins.scss` (**modifier**) — mixin `pastille-initiales` : cercle pour 1-2 caractères, pilule (`min-width` = hauteur, largeur auto) pour 3-4 ; même hauteur qu'avant.
- `src/views/EquipeView.vue` (2 pastilles), `src/views/AbsencesView.vue`, `src/components/absences/FormulaireAbsence.vue`, `src/components/equipe/FormulairePersonne.vue` (aperçu en direct : initiales Vega saisies, sinon prénom) (**modifier**).

**Hors périmètre** : petites pastilles (planning, sélecteur, conflits), pastilles de tournée, sélecteurs de couleur. `aria-hidden="true"` conservé (le nom est écrit à côté).

**Critères de sortie** : initiales visibles et lisibles dans les 4 écrans ; « EMM » / « A1B2 » ne débordent pas ; `npm run build` réussit.

## 10. Critères d'acceptation

**Équipe**
- [ ] La fiche d'une personne propose « Initiales Vega (facultatif) » avec son aide ; « fc » devient « FC » à la frappe.
- [ ] Une personne enregistrée avec « FC » affiche « FC » dans sa pastille sur la page Équipe (aussi dans la liste des archivées) ; aucune mention « Initiales Vega » dans la ligne de détails.
- [ ] Saisir des initiales déjà prises (même en minuscules) affiche « Ces initiales sont déjà utilisées par … » et bloque l'enregistrement sans perdre la saisie ; un format invalide affiche le message de format.
- [ ] Rouvrir et enregistrer une personne sans changer ses initiales fonctionne.

**Sauvegarde**
- [ ] Des données existantes (avant 0034) se rechargent sans erreur ; la sauvegarde exportée contient `"schemaVersion": 5` et `"initialesVega"` pour chaque personne.
- [ ] Importer une ancienne sauvegarde (v4) fonctionne ; les personnes ont des initiales vides.

**Feuille de route** (équipe : Claire Martin = FC, Léa Roux = LR, aucune personne pour EMM/CB)
- [ ] `Vega_UnDoublon.pdf` : carte avec « Infirmière : Claire Martin (FC) » (matin, 20,95 €) et « Infirmière : Léa Roux (LR) » (soir, 2,75 €) ; « Total 23,70 € pour 2 passages, soit 11,85 € par passage. » ; « Claire Martin (FC) a touché 20,95 € — sa part : 11,85 € » ; « Léa Roux (LR) a touché 2,75 € — sa part : 11,85 € » ; en évidence « **FC (Claire) reverse 9,10 € à LR (Léa)** ».
- [ ] `Vega_TroisDoublons.pdf` : 3 passages ; « Claire Martin (FC) a touché 23,70 € pour 2 passages — sa part : 17,63 € » ; « Léa Roux (LR) a touché 2,75 € — sa part : 8,82 € » ; « **FC (Claire) reverse 6,07 € à LR (Léa)** ».
- [ ] En retirant les initiales de Léa Roux puis en ré-analysant : « Infirmière : LR » + « code Vega non relié à l'équipe », phrase « FC (Claire) reverse 9,10 € à LR », et l'encart « Le code Vega LR n'est relié à aucune personne de l'équipe… » avec un lien vers la page Équipe qui fonctionne.
- [ ] Une personne **archivée** portant des initiales est bien nommée sur la Feuille de route.
- [ ] Après une analyse, `localStorage` ne contient rien de nouveau (ni nom de patient, ni montant) ; la sauvegarde exportée non plus.
- [ ] `npm run build` réussit.

## 11. Vérification

1. **Script jetable (T1 puis T3)** — dans `C:/Users/jmaguy/AppData/Local/TEMP/claude/c--Users-jmaguy--DEV--github-idelia/62d996f6-7830-4f8c-b170-47042d644af1/scratchpad` (**jamais dans le dépôt**), un `.mjs` qui :
   - charge `pdfjs-dist/legacy/build/pdf.mjs` par chemin absolu vers `node_modules` du projet (`pathToFileURL`), reproduit le mapping de l'adaptateur (comme en `0033`) ;
   - importe par chemin absolu `src/domain/feuilleDeRoute/extraireSeances.js`, `detecterRelais.js`, `relierInfirmieres.js` et `src/domain/initialesVega.js` ;
   - traite `files/Vega_UnDoublon.pdf` et `files/Vega_TroisDoublons.pdf` (chemins passés en argument) et affiche, par cas : passages (codes + montants), parts, touchés, écarts, reversements — **sans afficher les noms de patients** (inutiles ici) ;
   - exécute les mini-cas du tableau §5.4 et les contrôles d'invariants (Σ parts = total, Σ écarts = 0, entiers) ; personnes fictives avec ids GUID ;
   - est supprimé après usage ; aucune sortie collée dans un commit, une PR ou un fichier du dépôt.
2. `npm run build`.
3. `npm run dev` → Équipe : saisir FC / LR sur deux personnes fictives, tester les erreurs (§10), archiver la seconde puis vérifier qu'une 3ᵉ ne peut pas prendre « LR ».
4. DevTools > Application : `schemaVersion: 5`, champ présent ; export puis import du fichier → identique ; import d'un ancien export v4 (s'il en existe un hors dépôt) → `initialesVega: null`.
5. Feuille de route : déposer les deux PDF d'exemple, vérifier cartes et phrases (§10) ; retirer des initiales, ré-analyser, vérifier mention + encart + lien.
6. Clavier seul : formulaire (Tab, saisie, erreurs, focus sur le premier champ fautif) ; lien de l'encart atteignable.
7. Lecteur d'écran : l'aide et l'erreur du champ sont lues ; la phrase de reversement est lue en entier.
8. Relecture `ui-ux` (formulation des phrases d'argent, lisibilité de la carte), puis audit `security` (pas de `v-html`, aucune donnée du PDF persistée ou journalisée, champ saisi rendu par interpolation).

## 12. Décisions à confirmer / risques

1. **Deux formats de nom** (demandés) : « Claire Martin (FC) » dans les passages et le détail, « FC (Claire) » dans la phrase de reversement (plus courte, met le code en tête comme sur le relevé Vega). Si la relecture `ui-ux` juge le double format déroutant, harmoniser sur « Claire Martin (FC) » partout : changement limité à `libelleCourtInfirmiere`.
2. **Unicité étendue aux archivées** (proposé) : une ancienne infirmière garde son code ; un vieux PDF reste correctement nommé, et l'on évite qu'un code soit réattribué par erreur. Pour réutiliser un code, il faut d'abord l'effacer de la fiche archivée (modifier une personne archivée suppose de la restaurer : à signaler à l'utilisateur si le cas se présente). À confirmer.
3. **Doublons importés** : un JSON modifié à la main pourrait contenir deux personnes avec les mêmes initiales ou une valeur mal formée. Choix KISS : **pas de blocage à l'import** (`verifierIntegrite` inchangée) ; la liaison retient la personne active, puis la première ; une valeur mal formée ne correspond simplement à aucun code. Le formulaire signalera le doublon à la prochaine modification.
4. **Règle de partage** (confirmée par le porteur) : part = total ÷ N × passages de l'infirmière ; reversement = ce qu'elle a touché − sa part. Le glouton donne le **minimum de virements** pour 2 infirmières (cas courant) et un résultat très proche du minimum au-delà (le minimum exact est un problème combinatoire — inutile ici). Résultat déterministe à montants égaux.
5. **Arrondis** : la dernière infirmière absorbe le centime d'arrondi de la part (règle 0033 inchangée) ; les reversements sont donc exacts au centime.
6. **Place du champ** : `0030` prévoit un onglet « informations professionnelles » ; les initiales Vega pourront y migrer à ce moment-là (sans impact de données). En attendant, champ dans le bloc principal, après « Statut ».
7. **Version de schéma** : v5 si aucune autre feature (0020, 0023, 0029, 0030) ne l'a prise avant ; sinon version libre suivante (§3.2).
8. **Lien vers Équipe** : il fait quitter la Feuille de route et perdre le résultat (rien n'est conservé, choix 0033). Assumé et annoncé dans l'encart ; **pas** d'ouverture dans un nouvel onglet (deux onglets Idelia ouverts pourraient s'écraser mutuellement leurs données, le store n'étant pas synchronisé entre onglets).
9. **Suite** : `0035` « Bilan qui doit quoi (Tricount) » cumulera les reversements de tous les cas d'une période (total par paire d'infirmières, compensation globale). Elle réutilisera `calculerReversements` sur la somme des écarts : garder cette fonction générique (entrée = liste `{ ps, ecartCentimes }`).
10. **Aucun écart d'ADR** : champ persisté via store + plugin + migration (ADR 0005/0006), logique en modules purs (ADR 0008), Vuelidate (ADR 0011), rien d'issu du PDF n'est conservé (ADR 0002, choix 0033).
