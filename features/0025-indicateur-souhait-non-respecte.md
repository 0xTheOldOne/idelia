# Feature 0025 — Indicateur de souhait non respecté

- **Statut** : En cours (plan rédigé le 2026-10-14)
- **Dépend de** : `0011` (éditeur : `GrillePlanning` / `CellulePlanning`, diagnostics recalculés à chaque geste, glisser-déposer, annuler). S'appuie sur `0005` (souhaits, `decrirePreference`), `0009` (violations `PREFERENCE_*` de `contraintePreference.js`), `0016` (affectation = tournée + date + `segmentIndex`), `0021` / `0022` (contraintes **silencieuses** : aucune violation, donc aucun pouce).
- **ADR liés** : [0008](../docs/adr/0008-moteur-planification-module-pur.md) (localisation dans un module pur, moteur inchangé), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, `dateUtil`), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + tokens ; **ni tooltip ni popover Bootstrap** : modules non importés), [0013](../docs/adr/0013-icones-phosphor.md) (`PhThumbsDown`), [0014](../docs/adr/0014-pas-authentification-v1.md) (pas de comptes : la gestionnaire voit tout en v1). **Aucun écart d'ADR.**

## 1. Contexte & objectif

Quand le planning place une personne **contre l'un de ses souhaits** (fiche Souhaits, `0005`), l'information n'existe aujourd'hui que dans le panneau « Points d'attention », sous forme de liste. Sur la grille, la case est au mieux surlignée « Point d'attention », sans dire **qui** est lésé quand plusieurs personnes y travaillent.

`0025` pose un **pouce baissé** (`PhThumbsDown`) **sur la personne concernée, dans la case concernée**, en affichage par tournée comme par personne. Au survol, une infobulle dit « Souhait non respecté pour Claire Martin » ; au clic (ou Entrée), un petit détail s'ouvre sous la personne avec la phrase du souhait (« Souhaite être en repos le mercredi — mais est affectée le mercredi 07/10/2026 (07:00 – 13:00). » — le nom, déjà affiché au-dessus, est retiré du début de la phrase). L'indicateur suit **en temps réel** chaque modification (ajout, retrait, glisser-déposer, annuler, régénérer).

Calcul **dérivé des violations déjà produites par le moteur**, jamais stocké : aucun champ, aucune migration, **aucune modification du moteur**.

**Hors périmètre** : impression / diffusion (`0012`, §12 n° 6) ; restriction « chacun ne voit que soi » (avec les comptes, post-v1, §12 n° 7) ; avertissement dans le sélecteur de personne avant de placer quelqu'un (§12 n° 10).

## 2. Écrans concernés

Aucune nouvelle route. `/planning` uniquement.

| Zone | Changement |
|---|---|
| Grille (`GrillePlanning` → `CellulePlanning`), lecture **et** mode modification, orientations Tournées **et** Personnes, échelles Jour / Semaine / Mois | Pouce sur l'élément (personne en vue Tournées, tournée en vue Personnes) dont l'affectation ne respecte pas un souhait ; détail dépliable sous l'élément. |
| Panneau « Points d'attention » (`PanneauConflits`) | Le même pouce, décoratif, devant le titre des volets « Souhait non respecté : … », pour relier visuellement la grille et la liste. |
| Diffusion `/planning/:id/diffusion` | **Rien** (aucun pouce à l'écran ni au tirage). |

**Expérience visée** (affichage par tournée, mercredi 07/10, Tournée A) :

```
┌──────────────────────────────────────────────┐
│ ⚠ Point d'attention                          │  ← surlignage existant (0010), inchangé
│ ● Claire Martin                              │
│   [👎]                                        │  ← bouton icône seule, infobulle :
│                                              │     « Souhait non respecté pour Claire Martin. Voir le détail »
│ ● Sophie Durand                              │  ← pas de pouce : son souhait n'est pas en cause
└──────────────────────────────────────────────┘
        clic / Entrée sur [👎] ↓
│ ● Claire Martin                              │
│   [👎]                                        │
│ ┊ Souhait — Souhaite être en repos le        │  ← détail dans la case (pleine largeur de
│ ┊ mercredi — mais est affectée le mercredi   │     l'élément), même style que les lignes du
│ ┊ 07/10/2026 (07:00 – 13:00).               │     panneau ; Échap ou re-clic pour fermer
```

- **Un pouce par personne lésée**, jamais sur toute la case. Une personne contre plusieurs souhaits dans la même case : **un seul** pouce, le détail liste chaque souhait.
- **Obligatoire vs souhait** : le mot est **écrit** (infobulle, `aria-label`, détail : « Obligatoire — … » / « Souhait — … ») ; en plus, même convention que le surlignage existant : bordure **pleine** et teinte erreur si au moins un souhait obligatoire, bordure **pointillée** et teinte avertissement sinon.
- **Mode modification** : le pouce reste sous le nom, à gauche ; les boutons cadenas et « Retirer » restent à droite, inchangés. Un élément verrouillé montre le repère « Verrouillée » **et** le pouce.
- **Glisser-déposer** : le pouce disparaît / apparaît dès le dépôt ; le détail ouvert se referme au début d'un glisser.

## 3. Modèle de données touché

**Aucun champ persisté, aucune migration** (`CURRENT_SCHEMA_VERSION` reste 6). Lus seulement : `Planning.affectations[]` (`id`, `personneId`, `tourneeId`, `date`, `segmentIndex`), `Violation` (`code`, `severite`, `cible`, `message`, `params`) issues de `diagnostiquer` / `genererPlanning` / `regenerer`, `Personne.prenom` / `nom`.

### 3.1 Violations prises en compte

Seules les violations des **souhaits de la fiche Souhaits** : `code` commençant par `PREFERENCE_` **et** `params.preferenceId` présent (produites par `creerContraintePreference`), **quelle que soit la sévérité** (souple → `avertissement`, obligatoire → `erreur`, ce dernier cas n'arrivant qu'après un placement manuel).

| Code | `cible` | Cases portant le pouce |
|---|---|---|
| `PREFERENCE_JOUR_OFF_RECURRENT`, `PREFERENCE_JOURS_REPOS_SOUHAITES`, `PREFERENCE_CRENEAU_OFF`, `PREFERENCE_INDISPO_HEBDO`, `PREFERENCE_UN_WEEKEND_SUR_X`, `PREFERENCE_TOURNEE` | `{ personneId, tourneeId, date, segmentIndex }` | **l'affectation exacte** (mêmes personne, tournée, date, segment). |
| `PREFERENCE_MAX_JOURS_CONSECUTIFS` | `{ personneId }`, `params.maxAutorise` | **les jours en trop** : dans chaque suite de jours travaillés consécutifs plus longue que `maxAutorise`, les jours au-delà du `maxAutorise`-ième (max 3, suite du 05 au 09/10 → 08/10 et 09/10). Toutes les affectations de la personne ces jours-là. |
| `PREFERENCE_NB_JOURS_SEMAINE` | `{ personneId }`, `params.semaineDebut`, `nb`, `min`, `max` | **maximum dépassé** (`max` entier et `nb > max`) : les jours travaillés de la semaine au-delà du `max`-ième (ordre chronologique). **Minimum non atteint seul** : **aucun pouce** (aucune case ne « viole » un manque de travail), le point reste dans le panneau. |
| `PREFERENCE_MIN_JOURS_CONSECUTIFS` | `{ personneId }`, `params.debut`, `params.fin` | **tous les jours de la suite trop courte** `[debut, fin]` (au plus `min − 1` jours). |
| autre `PREFERENCE_*` sans `date` | — | aucun pouce (robustesse). |

**Exclues** (aucun pouce, inchangées dans le panneau) : règles du cabinet (`TROP_JOURS_CONSECUTIFS`, `REPOS_HEBDO_INSUFFISANT`, `CHEVAUCHEMENT`, `JOUR_FERME`, `SOUS_COUVERTURE`), absences (`ABSENCE_VALIDEE`, `ABSENCE_DEMANDEE`), rythme et équité (`EQUITE_*`, `0020`), continuité (`CONTINUITE_SEGMENTS_ROMPUE`). Les contraintes silencieuses (`titulaires-d-abord`, `remplacement-prioritaire`, `trame-weekend`) ne produisent aucune violation, donc aucun pouce. Voir §12 n° 1.

### 3.2 Structures volatiles (JSDoc, jamais persistées)

```js
/**
 * @typedef {Object} SouhaitNonRespecte
 * @property {string}  preferenceId
 * @property {string}  personneId
 * @property {boolean} obligatoire     // Violation.severite === 'erreur'
 * @property {string}  message         // Violation.message, tel quel (déjà en français, contient le nom et decrirePreference)
 *
 * @typedef {Object<string, SouhaitNonRespecte[]>} SouhaitsParAffectation  // clé = Affectation.id
 *
 * @typedef {Object} IndicateurSouhait   // prêt à afficher par CellulePlanning
 * @property {boolean} obligatoire       // au moins un souhait obligatoire
 * @property {string}  libelle           // infobulle (title) + aria-label du bouton
 * @property {Array<{nature: string, message: string}>} details  // nature = 'Obligatoire' | 'Souhait' (libelleNaturePreference)
 */
```

## 4. Store (Vuex)

**Aucun changement.** Les diagnostics restent l'état local volatil de `PlanningView` (`diagnostics.violations`), déjà rafraîchi après chaque geste (`rafraichirDiagnostics`), annulation et régénération. L'indicateur en est un `computed`.

## 5. Domaine (logique pure)

### 5.1 `src/domain/souhaitsNonRespectes.js` (**créer**)

Module pur (aucun import Vue/Vuex, aucun accès stockage). Imports autorisés : `@/domain/utils/dates.js` (`dateUtil`), `@/domain/libelles.js` (`libelleNaturePreference`). **N'importe rien de `@/domain/scheduling/`** (il consomme des `Violation` comme simples données).

```js
export function estCodeSouhait(code)                                  // → boolean : typeof code === 'string' && code.startsWith('PREFERENCE_')
export function indexerSouhaitsNonRespectes(affectations, violations) // → SouhaitsParAffectation
export function construireIndicateurSouhait(souhaits, nomPersonne)    // → IndicateurSouhait | null
```

**`indexerSouhaitsNonRespectes`** :

1. Gardes : `affectations` / `violations` non tableaux → `[]` ; éléments non objets ignorés ; ne lève jamais.
2. Pré-index : affectations par `personneId` ; jours travaillés distincts et triés par personne (même définition que `indexer().joursTravaillesParPersonne` du moteur : **toutes** les affectations, dates distinctes).
3. Pour chaque violation retenue (§3.1 : `estCodeSouhait(v.code) && v.params?.preferenceId`), `personneId = v.cible?.personneId ?? v.params?.personneId` ; dates / affectations ciblées selon le tableau §3.1 :
   - **`cible.date` présente** : affectations de la personne avec `a.date === cible.date`, et `a.tourneeId === cible.tourneeId` si `cible.tourneeId` est défini, et `a.segmentIndex === cible.segmentIndex` si `cible.segmentIndex` est défini. **Correspondance par coordonnées, jamais par id** : une violation périmée (affectation déplacée, diagnostics pas encore rafraîchis) ne s'accroche pas à l'affectation déplacée.
   - **`PREFERENCE_MAX_JOURS_CONSECUTIFS`** (`params.maxAutorise` entier ≥ 1) : découper les jours travaillés en suites consécutives (`dateUtil.diffDays(precedent, jour) === 1`) ; pour chaque suite de longueur `> max`, dates `dateUtil.rangeInclusive(dateUtil.addDays(debut, max), fin)`.
   - **`PREFERENCE_NB_JOURS_SEMAINE`** (`params.max` entier, `params.nb > params.max`, `params.semaineDebut` valide) : jours travaillés dans `[semaineDebut, addDays(semaineDebut, 6)]`, triés, `.slice(max)`.
   - **`PREFERENCE_MIN_JOURS_CONSECUTIFS`** (`params.debut`, `params.fin` valides) : jours travaillés dans `[debut, fin]`.
   - sinon : rien.
   Pour une liste de dates : toutes les affectations de la personne à ces dates.
4. Ajouter `{ preferenceId, personneId, obligatoire: v.severite === 'erreur', message: v.message ?? '' }` à `resultat[a.id]`, **sans doublon** (même `preferenceId` deux fois sur la même affectation → une seule entrée).
5. Ordre dans chaque liste : obligatoires d'abord, puis ordre d'arrivée (déjà trié par le moteur) ; résultat **déterministe**.

Aucun objet `Date` hors `dateUtil` ; comparaisons de chaînes `"YYYY-MM-DD"`.

**`construireIndicateurSouhait(souhaits, nomPersonne)`** : `null` si liste vide ou absente. Sinon, `n = souhaits.length`, `k` = nombre d'obligatoires, `nom = nomPersonne || 'cette personne'` :
- `obligatoire` = `k > 0` ;
- `libelle` :
  - `n === 1`, souple : « Souhait non respecté pour Claire Martin. Voir le détail » ;
  - `n === 1`, obligatoire : « Souhait obligatoire non respecté pour Claire Martin. Voir le détail » ;
  - `n > 1` : « 2 souhaits non respectés pour Claire Martin, dont 1 obligatoire. Voir le détail » (« , dont k obligatoire(s) » seulement si `k > 0`) ;
- `details` = `souhaits.map(s => ({ nature: libelleNaturePreference(s.obligatoire ? 'DURE' : 'SOUPLE'), message: s.message }))` → « Obligatoire » / « Souhait ».

### 5.2 Réutilisé, **non modifié**

Moteur (`contraintePreference.js`, `messages.js`, `validerPlanning.js`, `diagnostiquer.js`) : les messages contiennent déjà le nom de la personne et la phrase du souhait (`decrirePreference`), ils sont affichés **tels quels** (comme `PanneauConflits`). `libelles.js` (`libelleNaturePreference`), `utils/dates.js`.

## 6. Composants

### 6.1 `src/views/PlanningView.vue` (**modifier**)

- Importer `indexerSouhaitsNonRespectes`.
- `computed souhaitsNonRespectes()` → `indexerSouhaitsNonRespectes(this.planningCourant?.affectations ?? [], this.diagnostics.violations)`.
- Template : `<GrillePlanning … :souhaits-non-respectes="souhaitsNonRespectes">`.
- JSDoc du composant : une phrase « Souhaits non respectés (0025) : … ». **Rien d'autre** (le rafraîchissement existant suffit ; annonce `aria-live` inchangée).

### 6.2 `src/components/planning/GrillePlanning.vue` (**modifier**)

- Prop `souhaitsNonRespectes: { type: Object, default: () => ({}) }` (`SouhaitsParAffectation`), JSDoc.
- Importer `construireIndicateurSouhait`.
- `construireElement(affectation)` : ajouter à **chaque** branche (y compris « Personne inconnue » / « Tournée inconnue ») `souhait: construireIndicateurSouhait(this.souhaitsNonRespectes[affectation.id] ?? [], nomPersonne)`, où `nomPersonne` = « Prénom Nom » de `personneParId(affectation.personneId)` (dans les **deux** orientations), sinon `''`.
- Compléter le typedef `ElementCellule` (`@property {?IndicateurSouhait} souhait`) et le JSDoc du composant. Aucune autre logique ; toujours aucun import de `@/domain/scheduling`.

### 6.3 `src/components/planning/CellulePlanning.vue` (**modifier**)

Reste **présentationnel** (aucun calcul : il n'affiche que `element.souhait`).

- Importer `PhThumbsDown`.
- `data` : `souhaitOuvertId: null` (id de l'élément dont le détail est ouvert, un seul à la fois par case).
- Dans `.cellule-planning-libelles`, **après** le repère « Verrouillée » :
  ```html
  <button v-if="element.souhait" :ref="…" type="button"
          class="cellule-planning-bouton-souhait"
          :class="element.souhait.obligatoire ? '…--obligatoire' : '…--souhait'"
          :aria-label="element.souhait.libelle" :title="element.souhait.libelle"
          :aria-expanded="souhaitOuvertId === element.id ? 'true' : 'false'"
          :aria-controls="`souhait-detail-${element.id}`"
          @click="basculerSouhait(element.id)" @keydown.esc="fermerSouhait(element.id)">
    <PhThumbsDown :size="16" :weight="element.souhait.obligatoire ? 'fill' : 'bold'" aria-hidden="true" />
  </button>
  ```
- **Après** `.cellule-planning-actions-element`, dernier enfant du `<li>` : `<div v-if="souhaitOuvertId === element.id" :id="`souhait-detail-${element.id}`" class="cellule-planning-souhait-detail" @keydown.esc="fermerSouhait(element.id)">` contenant une `<ul>` : `<li v-for>` `<strong>{{ d.nature }}</strong> — {{ d.message }}`. Interpolation seule, **pas de `v-html`**. Variante de bordure selon `element.souhait.obligatoire`.
- `.cellule-planning-element` : ajouter `flex-wrap: wrap` ; le détail en `flex: 1 0 100%` (pleine largeur de l'élément, sous la ligne nom + boutons).
- Méthodes : `basculerSouhait(id)` (ouvre / ferme) ; `fermerSouhait(id)` (ferme et **rend le focus** au bouton pouce de cet élément, `$nextTick`). `onDebutGlisser` : remettre `souhaitOuvertId` à `null`.
- **Détail en ligne, pas de bulle flottante** : la grille est dans un conteneur à défilement (`overflow-x: auto`) avec une colonne figée ; une bulle positionnée serait coupée ou passerait sous la colonne. Le détail dans le flux de la case fonctionne à la souris, au tactile et au clavier, sans dépendance.
- Styles (SCSS scoped, tokens uniquement, aucun nouveau token) :
  - `.cellule-planning-bouton-souhait` : `inline-flex` centré, `align-self: flex-start`, `min-width` / `min-height` **2rem** (32 px, §12 n° 5), `margin-top: t.$espace-1`, `padding: 0`, `border-radius: t.$rayon-sm`, fond transparent ; `--obligatoire` : `color: t.$couleur-erreur`, `border: 1px solid t.$couleur-erreur`, `background-color: rgba(t.$couleur-erreur, 0.08)` ; `--souhait` : `color: t.$couleur-avertissement-texte`, `border: 1px dashed t.$couleur-avertissement`, `background-color: rgba(t.$couleur-avertissement, 0.1)` ; `:focus-visible` : `outline: t.$epaisseur-focus solid t.$couleur-focus; outline-offset: 2px`.
  - `.cellule-planning-souhait-detail` : `margin-top: t.$espace-1`, `padding: t.$espace-2`, `border-radius: t.$rayon-sm`, `font-size: t.$taille-texte-petite`, liste sans puces ; variantes = celles de `.panneau-conflits-item--erreur` / `--avertissement` (fond léger + bordure gauche 3px pleine / pointillée).
- JSDoc : documenter `element.souhait` dans la prop `elements` et le comportement (paragraphe « Souhait non respecté (0025) »).

### 6.4 `src/components/planning/PanneauConflits.vue` (**modifier**)

- Importer `PhThumbsDown` et `estCodeSouhait`.
- Dans le `<summary>` d'une cause, entre le chevron et le libellé : `<PhThumbsDown v-if="estCodeSouhait(cause.code)" :size="16" weight="bold" aria-hidden="true" />` (décoratif : le libellé dit déjà « Souhait non respecté : … »). Exposer `estCodeSouhait` dans `methods`. Rien d'autre.

### 6.5 Réutilisé tel quel

`DiffusionView` et `components/diffusion/*` (aucun pouce), `SelecteurPersonne`, store `plannings`.

## 7. Règles de validation

Sans objet : aucune saisie.

## 8. Points d'attention ergonomie

- **Vocabulaire** : « souhait non respecté », « obligatoire », « voir le détail ». Jamais « violation », « préférence », « contrainte », « pénalité » à l'écran. Le détail reprend la **même phrase** que le panneau et que la fiche Souhaits (`decrirePreference`).
- **Jamais l'icône seule** : infobulle (`title`) + `aria-label` complets (qui, obligatoire ou non) ; le détail dit tout en texte. La couleur double l'information (bordure pleine / pointillée, convention déjà utilisée par le surlignage et le panneau).
- **Pas de bruit** : pouce sur la seule personne concernée ; un seul pouce par personne et par case ; période trop longue → seulement les jours en trop ; minimum non atteint → pas de pouce (rien à reprocher à une case travaillée).
- **Clavier** : le pouce est un vrai bouton (Tab, Entrée / Espace) ; `aria-expanded` / `aria-controls` ; Échap referme et rend le focus au pouce ; focus visible.
- **Tactile** : pas d'information réservée au survol, le tap ouvre le détail.
- **Densité de la case** : le pouce est sous le nom, à gauche ; il ne déplace ni le cadenas ni « Retirer » ; il ne prend pas de largeur supplémentaire en mode modification.
- **Temps réel, réversible** : le pouce apparaît / disparaît au geste ; « Annuler la dernière action » le rétablit.
- **Confidentialité** : rien n'est imprimé (le tirage est distribué à toute l'équipe).

## 9. Étapes d'implémentation

**2 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). **Séquentielles : T1 → T2** (le contrat §3.2 / §5.1 est figé, la rédaction de T2 peut démarrer en parallèle, mais sa vérification exige T1 terminée). Les fichiers sont disjoints.

```
T1 (domaine) ── T2 (grille, cellule, panneau, vue)
```

### Tâche 1 — Module pur `souhaitsNonRespectes.js`

**Fichiers** :
- `src/domain/souhaitsNonRespectes.js` (**créer**) — §3.1, §3.2 (typedefs JSDoc), §5.1.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — sous `domain/`, après `recapMensuel.js` : `souhaitsNonRespectes.js  # localise les souhaits non respectés (violations PREFERENCE_*) sur les affectations, textes de l'indicateur [0025]`.

**Critères de sortie** :
- Script jetable dans le dossier temporaire de session (**jamais dans le dépôt**) : serveur Vite (`createServer` depuis `node_modules/vite`, `root` = projet, `server.middlewareMode: true`), `ssrLoadModule` de `src/domain/souhaitsNonRespectes.js` et de `src/domain/scheduling/index.js` (`validerPlanning`, pour produire de **vraies** violations) ; rejoue les scénarios §11.1 ; serveur fermé et script supprimé après usage.
- Aucun import de `@/domain/scheduling/`, `vue` ou `vuex` dans le module ; aucun `new Date()` / `getDay()` ; `npm run build` réussit.

### Tâche 2 — Pouce dans la grille, détail, lien avec le panneau

**Dépend de** : T1.

**Fichiers** :
- `src/views/PlanningView.vue` (**modifier**) — §6.1.
- `src/components/planning/GrillePlanning.vue` (**modifier**) — §6.2.
- `src/components/planning/CellulePlanning.vue` (**modifier**) — §6.3, §8.
- `src/components/planning/PanneauConflits.vue` (**modifier**) — §6.4.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) — ligne `/planning` : « Générer, éditer (drag & drop), voir les conflits et les souhaits non respectés, récap mensuel par personne | `0010`, `0011`, `0024`, `0025` ».

**Critères de sortie** : recette navigateur §11.2 ; `npm run build` réussit ; `CellulePlanning.vue` n'importe ni le store ni `@/domain/` ; aucun `v-html` ; `DiffusionView` et `components/diffusion/*` intacts.

## 10. Critères d'acceptation

**Localisation** (script jetable, §11.1)
- [x] Un souhait « par case » non respecté (repos du mercredi, weekend de repos, demi-journée, tournée évitée) marque **exactement** l'affectation concernée, et aucune autre de la même case.
- [x] « Pas plus de 3 jours d'affilée » avec une suite de 5 jours : seuls les **4ᵉ et 5ᵉ** jours portent le pouce ; deux tournées le 5ᵉ jour → les deux.
- [x] « Au plus 4 jours par semaine » avec 5 jours : seul le **5ᵉ** jour ; minimum non atteint seul → **aucun** pouce.
- [x] « Au moins 2 jours d'affilée » avec un jour isolé en milieu de période : ce jour porte le pouce ; une suite de 2 jours, non.
- [x] Absence validée, rythme dépassé, règles du cabinet : **aucun** pouce.
- [x] Souhait obligatoire → `obligatoire: true`, détail « Obligatoire — … » ; souhait souple → « Souhait — … ».
- [x] Affectation déplacée sans rafraîchir les violations → plus de pouce sur elle (coordonnées) ; robustesse : entrées vides / `null` / code inconnu → `{}`, aucune erreur.

**Écran Planning** (navigateur, §11.2)
- [x] Affichage par tournée : dans une case à deux personnes dont une seule est lésée, **un seul** pouce, sur elle.
- [x] Affichage par personne : le pouce est sur la tournée concernée, dans la colonne de la personne.
- [x] Survol : infobulle « Souhait non respecté pour Claire Martin. Voir le détail » (ou « Souhait obligatoire … ») ; clic : le détail s'ouvre sous la personne avec la phrase du panneau ; re-clic ou Échap : il se ferme, le focus revient au pouce.
- [x] Clavier seul : Tab jusqu'au pouce, Entrée ouvre, Échap ferme ; focus visible ; un lecteur d'écran annonce le libellé et l'état ouvert / fermé.
- [x] Obligatoire et souhait se distinguent **sans la couleur** (texte « Obligatoire » / « Souhait », bordure pleine / pointillée).
- [x] Mode modification : cadenas et « Retirer » à leur place et utilisables ; un élément verrouillé montre « Verrouillée » et le pouce ; le glisser-déposer part toujours de l'élément.
- [x] Glisser Claire de son mercredi de repos vers le jeudi : le pouce disparaît **immédiatement** ; « Annuler la dernière action » le fait réapparaître.
- [x] Régénérer / Essayer une variante : les pouces suivent le nouveau planning.
- [x] Dans le panneau, les volets « Souhait non respecté : … » portent le pouce ; chaque souhait « par case » du panneau a son pouce sur la grille.
- [x] Aperçu d'impression (`/planning/:id/diffusion`) : **aucun** pouce.
- [x] Aucune nouvelle clé dans `localStorage`, `schemaVersion` inchangé (6) ; `npm run build` réussit.

## 11. Vérification

### 11.1 Jeu d'essai et script jetable (T1)

Fichier fabriqué dans le dossier temporaire de session, **jamais dans le dépôt**. **Ids : `crypto.randomUUID()` (GUID) partout**, noms fictifs. Cabinet ouvert **7 jours sur 7**, `maxJoursConsecutifs: 6`, `reposHebdoMin: 2`. Période : **lundi 05/10/2026 → dimanche 18/10/2026**.

**Tournées** (1 segment chacune, effectif 1, lundi → dimanche) : « Tournée A » 07:00–13:00, « Tournée B » 07:00–13:00, « Après-midi » 14:00–19:00.

**Personnes et souhaits** (tous `actif: true`) :
| Personne | Statut | Souhaits |
|---|---|---|
| Claire Martin | Titulaire | `JOURS_REPOS_SOUHAITES` mercredi (`[3]`), **Souhait**, poids 5 ; `UN_WEEKEND_SUR_X` `{ frequence: 3, weekendReference: '2026-07-04' }`, **Obligatoire** (weekend travaillé : 17-18/10 ; repos : 10-11/10) |
| Sophie Durand | Titulaire | `MAX_JOURS_CONSECUTIFS` `{ max: 3 }`, Souhait, poids 8 |
| Marc Petit | Titulaire | `PREFERENCE_TOURNEE` `{ sens: 'EVITE', tourneeIds: [Après-midi] }`, Souhait, poids 3 ; `NB_JOURS_SEMAINE` `{ min: 2, max: 4 }`, Souhait, poids 5 |
| Léa Roux | Remplaçante (`titulaireId` = Claire) | `CRENEAU_OFF` `{ creneaux: ['APRES_MIDI'] }`, **Obligatoire** |
| Zoé Blanc | Remplaçante | `MIN_JOURS_CONSECUTIFS` `{ min: 2 }`, Souhait, poids 3 |

Le script construit l'`Entree` comme `assemblerEntree` (`{ periode, personnes, tournees, absences, reglesCabinet }`), des affectations à la main (`{ id: GUID, personneId, tourneeId, date, segmentIndex: 0, origine: 'MANUEL', verrouillee: false }`), appelle `validerPlanning` puis `indexerSouhaitsNonRespectes`, et vérifie (chaque scénario part d'un planning **vide**, les données en mémoire sont réinitialisées entre scénarios) :

- **S1 — par case, souple** : Claire A le 07/10 et Sophie A le 07/10 → seule l'affectation de Claire est indexée (1 entrée, `obligatoire: false`, message contenant « Claire Martin » et « mercredi ») ; Sophie absente de l'index.
- **S2 — par case, obligatoire** : Claire B le samedi 10/10 → 1 entrée `obligatoire: true` (`PREFERENCE_UN_WEEKEND_SUR_X`) ; `construireIndicateurSouhait(…, 'Claire Martin').libelle === 'Souhait obligatoire non respecté pour Claire Martin. Voir le détail'`, `details[0].nature === 'Obligatoire'`.
- **S3 — max d'affilée** : Sophie B du 05 au 09/10 + Après-midi le 09/10 → indexées : B du 08/10, B du 09/10, Après-midi du 09/10 ; **pas** 05, 06, 07/10.
- **S4 — max par semaine et tournée évitée** : Marc A du lundi 05 au vendredi 09/10 + Après-midi le lundi 12/10 (seul jour de sa 2ᵉ semaine) → semaine 1 : seule A du 09/10 ; 12/10 : 1 seule entrée (`PREFERENCE_TOURNEE`), la violation « minimum non atteint » de la semaine 2 n'ajoute rien.
- **S5 — min d'affilée** : Zoé B le 13/10 seul, puis B les 15 et 16/10 → indexée : 13/10 uniquement.
- **S6 — demi-journée obligatoire** : Léa Après-midi le 14/10 → 1 entrée `obligatoire: true`.
- **S7 — cumul** : Claire A le mercredi 14/10 avec un souhait supplémentaire `JOUR_OFF_RECURRENT` mercredi Obligatoire (en mémoire) → 2 entrées, obligatoire en premier ; libellé « 2 souhaits non respectés pour Claire Martin, dont 1 obligatoire. Voir le détail ».
- **S8 — exclusions** : absence `{ statut: 'VALIDE', creneau: 'JOURNEE', dateDebut/dateFin: '2026-10-15' }` de Claire + Claire A le 15/10 → `ABSENCE_VALIDEE` présente dans les violations, affectation **non** indexée ; Marc `joursTravaillesParMois: 2` (en mémoire) et Marc A du 05 au 07/10 → violation `EQUITE_RYTHME_DEPASSE` présente, aucune affectation de Marc indexée.
- **S9 — périmé** : reprendre S1, changer la date de l'affectation de Claire en 08/10 (même id) **sans** revalider → `indexerSouhaitsNonRespectes` avec les anciennes violations → l'affectation n'est plus indexée.
- **S10 — robustesse** : `indexerSouhaitsNonRespectes(null, null)`, `([], [])`, violation `{ code: 'PREFERENCE_X', params: { preferenceId: 'x' }, cible: { personneId } }` → `{}`, aucune exception ; `construireIndicateurSouhait([], 'X') === null`.
- **S11 — déterminisme** : deux appels identiques → résultats `JSON.stringify` égaux.

### 11.2 Recette navigateur (T2)

1. `npx vite --port 5199 --strictPort` → http://localhost:5199/idelia/#/ ; restaurer le jeu d'essai §11.1 (exporté en `SaveDocument` dans le dossier temporaire de session) via Paramètres → « Restaurer ».
2. **Planning** : générer du 05/10 au 18/10/2026 ; ouvrir les volets « Souhait non respecté » du panneau et vérifier que chaque point « par case » a son pouce sur la grille.
3. **Mode modification** (affichage par tournée) : ajouter Claire sur la Tournée A du mercredi 07/10 en plus de la personne déjà placée (si Claire travaille déjà ce jour-là, la retirer d'abord pour éviter un chevauchement) → pouce sur Claire seulement ; ajouter Léa sur l'Après-midi du 14/10 → pouce « obligatoire » (bordure pleine) ; poser Sophie 5 jours de suite sur la Tournée B (en la retirant de ses autres cases ces jours-là) → pouces sur les 4ᵉ et 5ᵉ jours seulement.
4. Survol, clic, re-clic, Échap, navigation clavier ; verrouiller l'élément de Claire (cadenas + pouce visibles).
5. Glisser Claire du 07/10 vers le 08/10 → pouce disparu ; « Annuler » → revenu. Régénérer → pouces à jour.
6. Affichage par personne : pouce sur la bonne tournée dans la colonne de Claire. Échelles Jour / Mois.
7. Ouvrir l'impression : aucun pouce. DevTools > Application : aucune nouvelle clé, `schemaVersion` 6.
8. Pièges connus (MCP Playwright) : volets du panneau = `<details>` fermés, les ouvrir avant lecture ; glisser-déposer par `DragEvent` synthétiques après « Modifier le planning ».
9. Relecture `ui-ux` (libellés, taille du pouce §12 n° 5, densité en mode modification), puis audit `security` (interpolation seule, aucun `v-html`, aucun accès stockage).

## 12. Décisions à confirmer / risques

**Décisions prises (KISS, à valider)**

1. **Périmètre = souhaits de la fiche Souhaits, souples et obligatoires.** Un souhait obligatoire ne peut être enfreint que par un placement manuel : c'est le cas le plus important à montrer. **Exclus** : règles du cabinet (protègent tout le monde, déjà en « Conflit ») ; **absences** (`ABSENCE_VALIDEE` est une indisponibilité, déjà en « Conflit » ; `ABSENCE_DEMANDEE` est dormante en v1 depuis `0017` — à reconsidérer avec les comptes : une absence demandée non accordée sera alors un vrai « souhait non respecté ») ; **rythme 0020** (fixé par la gestionnaire, pas un souhait de la personne ; portée mensuelle sans case précise ; déjà en rouge dans le récap `0024`) ; équité, continuité. Les règles silencieuses de `0021` / `0022` ne produisent aucune violation : un weekend de trame non travaillé n'a pas de pouce (cohérent avec `0022` §12 n° 9).
2. **Souhaits « sur une période » : seulement les jours en trop**, dans l'ordre chronologique (max d'affilée : au-delà du max-ième jour de la suite ; max par semaine : au-delà du max-ième jour de la semaine). N'importe quel jour pourrait être retiré, mais marquer toute la suite serait bruyant ; les derniers jours sont la lecture naturelle (« c'est à partir d'ici que ça dépasse »). **Minimum par semaine non atteint : pas de pouce** (aucune case travaillée n'est en cause). **Minimum d'affilée** : tous les jours de la suite trop courte (au plus `min − 1` cases).
3. **Moteur inchangé.** Les violations de période n'ont pas de date : le module retrouve les jours à partir des affectations et des `params` existants (`maxAutorise`, `semaineDebut`/`nb`/`max`, `debut`/`fin`). Contrepartie : le découpage en suites de jours est refait dans le module (une dizaine de lignes, déjà dupliqué entre `contrainteReposLegal.js` et `contraintePreference.js`). Alternative si une divergence apparaît : ajouter au moteur un `params.periodes` purement additif (aucun effet sur le score ni les messages).
4. **Détail dans la case plutôt que bulle flottante ou renvoi au panneau.** Ni tooltip ni popover Bootstrap (modules SCSS non importés, JavaScript Bootstrap non chargé hors `modal`) ; une bulle positionnée serait coupée par le conteneur à défilement de la grille. Renvoyer au panneau (ouvrir le volet, faire défiler) éloignerait l'utilisateur de la case et demanderait de piloter des `<details>` d'un autre composant. Infobulle = `title` natif, comme les autres boutons icône seule de l'éditeur.
5. **Pouce de 32 × 32 px**, sous les 44 px du reste de l'application : la case est déjà dense en mode modification (cadenas + « Retirer » à 44 px). 32 px respecte WCAG 2.2 AA (2.5.8, ≥ 24 px). **À valider par `ui-ux`** ; repli : 44 px de haut sur toute la largeur de la colonne du nom.
6. **Pas de pouce à l'impression** (`0012`) : le tirage est distribué à toute l'équipe ; montrer à tous qui a été lésé contredit l'esprit « chacun ne voit que soi ». `DiffusionView` ne calcule d'ailleurs aucune violation : rien à coder.
7. **Visibilité** : en v1, la gestionnaire voit tous les pouces (pas de comptes, ADR 0014). Avec les comptes (post-v1), filtrer `souhaitsNonRespectes` sur la personne connectée dans `PlanningView` (un filtre sur `personneId`), sans changer le module. Rien n'est anticipé maintenant.
8. **Pas d'interrupteur « masquer les pouces »** : ils n'apparaissent que sur des points déjà listés dans le panneau. À ajouter si la recette les juge envahissants.
9. **Annonce `aria-live` inchangée** (« … N points d'attention … ») : le pouce est découvrable dans la case (bouton nommé).
10. **Suite possible** (hors périmètre) : dans `SelecteurPersonne`, signaler « Souhait non respecté » à côté d'une personne avant de la placer (réutiliserait `validerPlanning` sur l'état simulé → à concevoir avec le store).

**Risques**

- **Décalage bref** entre affectations (store, synchrone) et diagnostics (rafraîchis après `await`) : la correspondance par coordonnées évite d'accrocher un pouce périmé à une affectation déplacée ; l'écart dure un tick.
- **Densité** des cases étroites en mode modification (nom + pouce + deux boutons de 44 px) : le pouce, sous le nom, n'ajoute pas de largeur ; à contrôler en recette sur une semaine à nombreuses tournées.
- **Messages longs** dans le détail (souhait de tournée, weekend) : la case s'allonge tant que le détail est ouvert ; fermeture par re-clic / Échap.
- **Aucun écart d'ADR** : module pur dans `src/domain/` hors moteur (ADR 0008), dates en chaînes (ADR 0010), rien de persisté (ADR 0005), Phosphor (ADR 0013), SCSS + tokens sans nouveau module Bootstrap (ADR 0015).
