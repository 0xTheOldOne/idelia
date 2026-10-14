# Feature 0029 — Tournées : icône de repère

- **Statut** : À faire
- **Dépend de** : `0006` (CRUD des tournées, `FormulaireTournee`, `TourneesView`), `0016` (modèle `Tournee` à segments, livré). Touche des écrans livrés par `0010`/`0011` (grille, cellule, panneau de conflits) et `0012` (diffusion / impression), sans en changer le comportement.
- **ADR liés** : [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (nouveau champ persisté via store + plugin), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (export/import, migration de schéma), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (codes et libellés en module pur), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + tokens, Bootstrap déjà importé), [0013](../docs/adr/0013-icones-phosphor.md) (icônes exclusivement Phosphor), [0017](../docs/adr/0017-modelisation-tournees-coupees-segments.md) (modèle `Tournee`).

## 1. Contexte & objectif

Les tournées se distinguent aujourd'hui uniquement par leur **libellé** et leur **couleur**. Le cabinet souhaite reconnaître certaines tournées d'un coup d'œil (« la tournée vaccination », « les consultations au cabinet ») par une **petite icône** posée **au centre de la pastille colorée**.

`0029` :
1. ajoute un champ **facultatif** `Tournee.icone` (code stable choisi dans une **liste restreinte** de 12 icônes « soin / déplacement », défaut : aucune) ;
2. propose un **sélecteur visuel** dans le formulaire de tournée ;
3. **centralise la pastille de tournée** dans un composant partagé `PastilleTournee` et le rend **partout** où une tournée s'affiche avec sa couleur (liste, grille de planning, panneau de conflits, planning imprimé et sa légende).

L'icône est **redondante** : elle ne porte jamais de sens seule, le libellé de la tournée est toujours écrit à côté (accessibilité, daltonisme, impression).

**Tournée temporaire** (ex. campagne de vaccination) : **déjà couverte** par `dateDebutValidite` / `dateFinValidite` (formulaire, liste et moteur via `tourneeApplicableLe` / `scheduling/modele/demande.js`). Rien à construire : seul le texte d'aide du formulaire cite cet exemple (§6.3).

**Hors périmètre** : icônes libres ou importées, choix de la graisse/taille par l'utilisateur, icône pour les personnes, pastille dans la liste des tournées du souhait « Tournée préférée ou évitée » (`FormulairePreference`, sans pastille aujourd'hui — §12 n° 6).

## 2. Écrans concernés

| Route | Écran | Changement `0029` |
|---|---|---|
| `/tournees` | Tournées | Pastille partagée (avec icône) dans la liste des actives et des archivées ; **nouveau groupe « Icône de repère (facultatif) »** dans la modale ; aperçu mis à jour ; aide « période de validité » enrichie. |
| `/planning`, `/planning/:id` | Planning (éditeur) | Pastille partagée dans l'en-tête de colonne (vue « par tournée »), dans les cases (vue « par personne ») et dans le panneau « Tournées non couvertes ». |
| `/planning/:id/diffusion` | Diffusion / impression | Pastille partagée dans l'en-tête de colonne de chaque mois et dans la légende « Tournées ». |

**Expérience visée** (utilisateur peu à l'aise avec l'informatique) :

- Dans la fiche d'une tournée, sous « Couleur de repère », un bloc **« Icône de repère (facultatif) »** présente une **grille de vignettes** : chacune montre la **pastille avec l'icône sur la couleur choisie** et son **nom écrit dessous** (« Seringue », « Voiture »…). La première vignette, **« Aucune »**, est sélectionnée par défaut. Un clic choisit ; la vignette choisie est **encadrée et cochée** (pas seulement colorée).
- Un **aperçu** « pastille + nom de la tournée + horaires » montre immédiatement le rendu final (couleur + icône).
- Partout ailleurs, l'utilisateur retrouve la **même pastille** (même couleur, même icône) à côté du nom de la tournée : liste, planning, impression. Une tournée sans icône garde une pastille unie, comme aujourd'hui.
- Réversible : rouvrir la tournée et choisir « Aucune » retire l'icône.

## 3. Modèle de données touché

### 3.1 `Tournee` — nouveau champ persisté

| champ | type | oblig. | notes |
|---|---|---|---|
| icone | string (code de `ICONES_TOURNEE`) \| null | non | défaut `null` (aucune icône) ; **code stable** MAJUSCULES_SNAKE, jamais le nom d'un composant Phosphor ; valeur inconnue → traitée comme `null` [0029] |

### 3.2 Liste restreinte (12 icônes, ordre d'affichage du sélecteur)

| Code stocké | Libellé FR (sous la vignette) | Composant Phosphor (rendu uniquement) |
|---|---|---|
| `SERINGUE` | Seringue | `PhSyringe` |
| `STETHOSCOPE` | Stéthoscope | `PhStethoscope` |
| `PANSEMENT` | Pansement | `PhBandaids` |
| `MEDICAMENTS` | Médicaments | `PhPill` |
| `GOUTTE` | Goutte | `PhDrop` |
| `TROUSSE` | Trousse de soins | `PhFirstAidKit` |
| `DOMICILE` | Domicile | `PhHouseLine` |
| `VOITURE` | Voiture | `PhCar` |
| `A_PIED` | À pied | `PhPersonSimpleWalk` |
| `VELO` | Vélo | `PhBicycle` |
| `SOLEIL` | Soleil | `PhSun` |
| `LUNE` | Lune | `PhMoon` |

Les 12 composants existent dans `node_modules/@phosphor-icons/vue` (vérifié). Soleil / Lune servent de repère matin / soir (utile pour distinguer des tournées proches).

### 3.3 Schéma de sauvegarde : v6 → **v7**

`CURRENT_SCHEMA_VERSION` passe de **6 à 7** (`src/storage/migrations.js`), avec `MIGRATIONS[6]` :

```js
// Chaque tournée reçoit icone: normaliserIconeTournee(tournee.icone) (idempotent :
// absent → null ; code connu conservé ; valeur inconnue → null).
// personnes, absences, plannings, cabinet : inchangés.
```

- Appliquée au chargement (`bootstrap`) **et** à l'import (`importer`) via `migrate()` : rien à changer côté appelants (`src/store/index.js`).
- **Valeur hors liste dans un fichier v7** (fichier modifié à la main) : `fromSaveDocument` (`src/domain/schema.js`) normalise `icone` de chaque tournée → `null`, **sans erreur ni blocage** (même esprit que la palette `couleursParDefaut` ré-appliquée au même endroit). `verifierIntegrite` : **inchangée** (champ cosmétique, ne doit jamais empêcher un import).
- **Export** : `toSaveDocument` sérialise `tournees.items` tels quels → `"schemaVersion": 7` et `"icone"` sur chaque tournée sans code supplémentaire. Un fichier v8 reste refusé (garde existante).

## 4. Store (Vuex)

**Aucun changement.** `tournees/ajouter` construit la tournée via `creerTournee` (qui gère le nouveau champ, §5.2) ; `tournees/modifier` fusionne le patch émis par le formulaire (qui contient `icone`). Persisté : `Tournee.icone`. Rien de volatil.

## 5. Domaine (logique pure)

### 5.1 `src/domain/iconesTournee.js` (**créer**)

Module pur, **sans aucun import** (chargé par `tournees.js`, `schema.js`, `diffusion.js` et `migrations.js` ; aucun risque de cycle). En-tête « Module pur : aucun import Vue/Vuex (ADR 0008) ».

- `export const ICONES_TOURNEE` : `Object.freeze([...])` d'objets gelés `{ code, libelle }`, **dans l'ordre du tableau §3.2**. Aucune référence à Phosphor ici.
- `export function normaliserIconeTournee(valeur)` → `string|null` : la valeur si c'est **exactement** un code de `ICONES_TOURNEE`, sinon `null` (couvre `undefined`, `''`, minuscules, code inconnu, non-chaîne).
- `export function libelleIconeTournee(code)` → libellé FR, `''` si code inconnu/`null`.

### 5.2 `src/domain/tournees.js` (**modifier**)

- Typedef `Tournee` : `@property {(string|null)} icone - Code d'icône de repère (ICONES_TOURNEE, iconesTournee.js), ou null.`
- `creerTournee` : `icone: normaliserIconeTournee(champs.icone)`.

### 5.3 `src/domain/schema.js` (**modifier**)

- `fromSaveDocument` : `tournees: { items: (doc.tournees ?? []).map((t) => ({ ...t, icone: normaliserIconeTournee(t.icone) })) }` + commentaire (valeur inconnue → `null`, jamais bloquant).

### 5.4 `src/domain/diffusion.js` (**modifier**, tâche 5)

- Typedef `ColonneTournee` : `@property {(string|null)} icone`.
- `creerColonne` : `icone: normaliserIconeTournee(tournee.icone)`.

### 5.5 Réutilisé (non modifié)

`src/domain/utils/couleurs.js` (`estCouleurFoncee`) pour la couleur de l'icône ; `src/domain/libelles.js`, `dateUtil`.

## 6. Composants

### 6.1 `src/components/communs/PastilleTournee.vue` (**créer**) — pastille partagée

Composant **présentationnel** (Options API, aucun accès store).

- **Props** :
  - `couleur` (String, défaut `''`) — hex `#RRGGBB` ; vide → fond neutre `$couleur-fond-clair` (tournée inconnue).
  - `icone` (String, défaut `null`) — code `ICONES_TOURNEE` ; `null`/inconnu → **aucune icône, aucune erreur** (pastille unie).
  - `taille` (String, défaut `'petite'`, `validator` ∈ `['petite', 'grande', 'impression']`).
- **Rendu** : `<span class="pastille-tournee pastille-tournee--{taille}" :class="{ 'pastille-tournee--inverse': fonce }" :style="couleur ? { backgroundColor: couleur } : null" aria-hidden="true">` contenant `<component :is="composantIcone" v-if="composantIcone" :size="tailleIcone" weight="bold" />`.
- **Correspondance code → composant** : constante **de module** `COMPOSANTS_ICONE = { SERINGUE: PhSyringe, … }` (12 entrées, clés = codes §3.2), hors `data` (pas de réactivité sur des composants). `composantIcone` = `COMPOSANTS_ICONE[icone] ?? null`.
- **Contraste de l'icône** : `fonce = estCouleurFoncee(couleur)` (réutilisé) → classe `--inverse` ; couleurs **tirées des tokens** (`$couleur-texte-inverse` sur fond foncé, `$couleur-texte` sinon), comme `RepereDiffusion` (pas de `#fff` en dur, donc pas `couleurTexteRepere` qui en contient). Le seuil de luminance garantit le meilleur des deux contrastes (≥ 4,5:1 environ).
- **Tailles** (diamètre / icône — icône ≈ 60-65 % du diamètre pour rester inscrite dans le cercle) :

  | `taille` | Diamètre | Icône | Usages |
  |---|---|---|---|
  | `grande` | `$espace-5` (32 px) | 20 | liste Tournées, aperçu et vignettes du formulaire |
  | `petite` | `$espace-3 + $espace-1` (20 px) | 12 | grille de planning, cases, panneau de conflits (16 px aujourd'hui : trop petit pour une icône lisible) |
  | `impression` | `18px` | `13` | en-tête de mois et légende de la diffusion — taille fixe (en `em`, l'icône tombait à ~9 px, illisible : retouche de recette) |

- **Style** (`scoped`, tokens uniquement) : `inline-flex` centré, `flex-shrink: 0`, `border-radius: 50%`, `box-sizing: border-box`, bordure 1 px `$couleur-bordure` ; en `--impression` bordure 1 px `$couleur-texte` (contour visible en noir et blanc, comme aujourd'hui). `-webkit-print-color-adjust: exact; print-color-adjust: exact` sur toutes les tailles. En `--impression.--inverse`, icône avec `filter: drop-shadow(0 0 1px t.$couleur-texte)` pour rester visible si le navigateur n'imprime pas le fond (même procédé que la coche `.formulaire-pastille-coche`).
- **Accessibilité** : toujours `aria-hidden="true"` ; aucun `title` (le libellé de la tournée est toujours écrit à côté par le parent).

### 6.2 Recensement **exhaustif** des pastilles de tournée remplacées

| # | Fichier | Emplacement actuel | Remplacement | Donnée à fournir |
|---|---|---|---|---|
| 1 | `src/views/TourneesView.vue` | l. 46-50, liste des actives (`.tournees-pastille`) | `<PastilleTournee :couleur :icone taille="grande" />` | `tournee.couleur`, `tournee.icone` |
| 2 | `src/views/TourneesView.vue` | l. 115-119, liste des archivées | idem `grande` | idem |
| 3 | `src/components/tournees/FormulaireTournee.vue` | l. 231-236, aperçu (`.formulaire-pastille--apercu`) | `grande` (couleur + icône du brouillon) | `formulaire.couleur`, `formulaire.icone` |
| 4 | `src/components/planning/GrillePlanning.vue` | l. 34-38, en-tête de colonne (`.grille-planning-pastille`) — **seulement en orientation Tournées** | `petite` si `orientation === 'TOURNEES'`, sinon `<span>` actuel (personne) | `LigneGrille.icone` (ajouté : `t.icone` pour les tournées actives **et** archivées, `null` pour les personnes) |
| 5 | `src/components/planning/CellulePlanning.vue` | l. 53-57, élément (`.cellule-planning-pastille`) — **un élément est une tournée en orientation Personnes** | `petite` si `element.estTournee`, sinon `<span>` actuel (personne ou « inconnue ») | `ElementCellule.estTournee` + `ElementCellule.icone` (posés par `GrillePlanning.construireElement` : `true`/`tournee.icone` quand la tournée est résolue en orientation Personnes ; `false`/`null` partout ailleurs) |
| 6 | `src/components/planning/PanneauConflits.vue` | l. 82-86, « Tournées non couvertes » (`.panneau-conflits-pastille`) | `petite` | `detailsNonCouvertes[].icone` (ajouté : `tournee ? tournee.icone : null`) |
| 7 | `src/components/diffusion/MoisDiffusion.vue` | l. 17-21, en-tête de colonne (`.mois-diffusion-pastille-tournee`) | `impression` | `colonne.icone` (§5.4) |
| 8 | `src/components/diffusion/LegendeDiffusion.vue` | l. 17-22, légende « Tournées » (`.legende-diffusion-pastille-tournee`, point d'insertion prévu par 0012) | `impression` | `colonne.icone` |

**Classes SCSS à supprimer** (devenues inutiles) : `.tournees-pastille`, `.formulaire-pastille--apercu`, `.panneau-conflits-pastille`, `.mois-diffusion-pastille-tournee`, `.legende-diffusion-pastille-tournee`. **À conserver** : `.grille-planning-pastille` et `.cellule-planning-pastille` (pastilles de personne), `.formulaire-pastille` (palette de couleurs).

**Vérifiés et non concernés** (ne pas toucher) : palette de couleurs de `FormulaireTournee` (choix d'une couleur, pas une tournée) ; pastilles de **personne** (`EquipeView`, `AbsencesView`, `FormulaireAbsence`, `FormulairePersonne`, `SelecteurPersonne`, `RecapMensuel`, `RepereDiffusion`, en-tête de grille et cases en orientation opposée) ; `FormulairePreference` / `SouhaitsView` (tournées listées sans pastille) ; « pastilles » de `MenuLateral` / `IndicateurSauvegarde` (autre sens).

### 6.3 `src/components/tournees/FormulaireTournee.vue` (**modifier**)

- Brouillon : `icone: normaliserIconeTournee(this.tournee?.icone)` en édition (valeur inconnue → « Aucune » cochée) ; `icone: null` en création.
- **Nouveau groupe** placé **après « Couleur de repère »** et **avant « Période de validité »** :
  - `<fieldset class="mb-4" aria-describedby="tournee-icone-aide">` + `<legend class="formulaire-legende"><span class="form-label d-block">Icône de repère (facultatif)</span></legend>`.
  - Aide (`id="tournee-icone-aide"`, `form-text`) : « Une petite image dans la pastille de couleur, pour reconnaître la tournée d'un coup d'œil. Le nom de la tournée reste toujours affiché. »
  - Grille `d-flex flex-wrap gap-2` de **13 vignettes** = boutons radio **natifs** (navigation flèches et Tab gérées par le navigateur, aucun code de « roving tabindex ») selon le patron Bootstrap `.btn-check` (module `forms` déjà importé) :
    `<input type="radio" class="btn-check" name="tournee-icone" :id="'tournee-icone-' + (code ?? 'aucune')" :value="code" v-model="formulaire.icone">` puis `<label class="btn formulaire-icone-option" :for="…">` contenant `<PastilleTournee :couleur="formulaire.couleur" :icone="code" taille="grande" />` et le **libellé visible** (`libelle` de `ICONES_TOURNEE`, « Aucune » pour la 1ʳᵉ vignette, `:value="null"`).
  - Vignette : largeur fixe (~6.5 rem), pastille au-dessus du libellé (`$taille-texte-petite`), `min-height` ≥ `$cible-cliquable-min`. **Sélection** : bordure 2 px `$couleur-primaire` + fond `rgba($couleur-primaire, 0.12)` + petite icône `PhCheck` (`aria-hidden`) dans le coin — jamais la seule couleur. Focus visible via `.btn-check:focus-visible + .btn` (mixin `m.focus-visible`).
- **Aperçu** : déplacé **sous** le groupe d'icônes (il reflète couleur **et** icône), précédé de « Aperçu : » ; `PastilleTournee` `grande` + libellé + horaires (contenu inchangé sinon).
- **Période de validité** : texte d'aide remplacé par « Pour une tournée saisonnière ou temporaire, par exemple une campagne de vaccination d'octobre à décembre. Laissez vide si elle s'applique toute l'année. » (seul ajout lié à la tournée temporaire).
- `soumettre()` émet en plus `icone: normaliserIconeTournee(this.formulaire.icone)`.
- Imports : `PastilleTournee`, `ICONES_TOURNEE`, `normaliserIconeTournee` ; `data` expose `ICONES_TOURNEE` (comme `JOURS_SEMAINE`).

### 6.4 Autres composants modifiés

- `src/views/TourneesView.vue` — emplacements 1-2 ; supprimer `.tournees-pastille`.
- `src/components/planning/GrillePlanning.vue` — emplacement 4 ; `lignesTournees` (actives et archivées) ajoute `icone: t.icone`, `lignesPersonnes` ajoute `icone: null` ; `construireElement` ajoute `estTournee`/`icone` (§6.2 n° 5) ; typedefs `LigneGrille` / `ElementCellule` mis à jour.
- `src/components/planning/CellulePlanning.vue` — emplacement 5 ; JSDoc de la prop `elements` complétée (`estTournee`, `icone`). Aligner verticalement la pastille 20 px sur la première ligne du libellé (ajuster le `margin-top` existant).
- `src/components/planning/PanneauConflits.vue` — emplacement 6 ; supprimer `.panneau-conflits-pastille`.
- `src/components/diffusion/MoisDiffusion.vue` / `LegendeDiffusion.vue` — emplacements 7-8 ; supprimer les classes de pastille ; le libellé garde son ellipsis.

## 7. Règles de validation

- `icone` : **facultative**, liste **fermée** (boutons radio) : **aucune règle Vuelidate** nécessaire (aucune saisie libre possible, `null` admis). La normalisation (`normaliserIconeTournee`) à l'émission, dans `creerTournee`, à la migration et dans `fromSaveDocument` garantit qu'aucune valeur hors liste n'est stockée ni affichée.
- Les autres règles du formulaire sont inchangées.

## 8. Points d'attention ergonomie

- **Jamais l'icône seule** : partout, le libellé de la tournée est écrit à côté ; la pastille reste `aria-hidden`. Dans le sélecteur, chaque vignette a un **libellé visible** (nom accessible du bouton radio).
- **Choix sans risque** : « Aucune » par défaut ; changer d'avis = rouvrir et cliquer une autre vignette ; aperçu immédiat.
- **Voir avant de choisir** : chaque vignette montre l'icône **sur la couleur choisie** pour la tournée → on voit tout de suite si elle est lisible.
- **Sélection multi-canal** : cadre + fond + coche, pas uniquement une couleur.
- **Lisibilité** : icône claire sur couleur foncée, foncée sur couleur claire (calcul de contraste existant) ; taille minimale 12 px à l'écran ; à l'impression, contour noir de la pastille et contour de l'icône claire pour le noir et blanc.
- **Densité de la grille** : la pastille de tournée passe de 16 à 20 px dans le planning ; vérifier que les cases restent lisibles (relecture `ui-ux`).
- **Clavier** : Tab entre dans le groupe, flèches pour changer de vignette, focus visible.
- **Vocabulaire** : « Icône de repère », « Aucune » ; jamais « code », « Phosphor », « composant ».

## 9. Étapes d'implémentation

**5 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre : **T1 → T2 → (T3 ∥ T4 ∥ T5)**. T3, T4 et T5 touchent des fichiers **disjoints** et peuvent être lancées en parallèle.

### Tâche 1 — Modèle `Tournee.icone`, liste des icônes, migration v7

**Fichiers** :
- `src/domain/iconesTournee.js` (**créer**) — §5.1.
- `src/domain/tournees.js` (**modifier**) — §5.2.
- `src/domain/schema.js` (**modifier**) — §5.3 (`fromSaveDocument`).
- `src/storage/migrations.js` (**modifier**) — `CURRENT_SCHEMA_VERSION = 7` ; `MIGRATIONS[6]` documentée en JSDoc sur le modèle de `MIGRATIONS[4]`/`[5]` (§3.3).
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — ligne `icone` dans le tableau `Tournee` (§3.1).
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) — `schemaVersion` 7 (commentaire « v7 = Tournee.icone » et exemple), `"icone": null` dans la tournée d'exemple, `CURRENT_SCHEMA_VERSION (= 7)`, paragraphe **`MIGRATIONS[6]` (v6 → v7)** — feature 0029.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — sous `domain/` : `iconesTournee.js  # codes et libellés des icônes de repère des tournées [0029]`.

**Critères de sortie** (script jetable, §11 étape 1) :
- `ICONES_TOURNEE.length === 12`, codes uniques, ordre du §3.2.
- `normaliserIconeTournee('SERINGUE') === 'SERINGUE'` ; `undefined`, `null`, `''`, `'seringue'`, `'FOO'`, `42` → `null`. `libelleIconeTournee('A_PIED') === 'À pied'`, `libelleIconeTournee('FOO') === ''`.
- `creerTournee({ libelle: 'X' }).icone === null` ; `creerTournee({ icone: 'VELO' }).icone === 'VELO'` ; `creerTournee({ icone: 'FOO' }).icone === null`.
- `migrate` d'un document v6 fabriqué (ids GUID via `crypto.randomUUID()`) avec 3 tournées (sans `icone`, `icone: 'LUNE'`, `icone: 'FOO'`) → `schemaVersion: 7`, icônes `null` / `'LUNE'` / `null`, tous les autres champs strictement identiques, `verifierIntegrite(doc).ok === true` ; re-`migrate` du résultat → identique (idempotence).
- `fromSaveDocument` d'un document v7 avec `icone: 'FOO'` → `null`.
- `iconesTournee.js` n'a aucun import ; `npm run build` réussit.

### Tâche 2 — Composant partagé `PastilleTournee`

**Fichiers** :
- `src/components/communs/PastilleTournee.vue` (**créer**) — §6.1.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — commentaire de `communs/` complété (« … pastille de tournée [0029] »).

**Dépend de** : T1 (codes de `ICONES_TOURNEE`).

**Critères de sortie** :
- Les clés de `COMPOSANTS_ICONE` sont exactement les 12 codes de `ICONES_TOURNEE` (vérification à la relecture ; contrôle visuel en T3 : 12 vignettes avec icône).
- `icone` `null`, `''` ou inconnu → pastille unie, aucun avertissement dans la console.
- Couleur foncée (`#5B5BD6`) → icône claire ; couleur claire (`#D99A26`) → icône foncée ; couleur vide → fond neutre.
- Trois tailles conformes au tableau §6.1 ; `aria-hidden="true"` sur la racine ; aucune couleur en dur (tokens uniquement) ; `npm run build` réussit.

### Tâche 3 — Formulaire et écran Tournées

**Fichiers** :
- `src/components/tournees/FormulaireTournee.vue` (**modifier**) — §6.3, emplacement 3.
- `src/views/TourneesView.vue` (**modifier**) — emplacements 1-2.

**Dépend de** : T1, T2. **Parallélisable** avec T4 et T5.

**Critères de sortie** : parcours §10 « Tournées » ; création sans toucher l'icône → `"icone": null` dans `localStorage` ; choix « Seringue » → `"icone": "SERINGUE"` ; navigation clavier du groupe (Tab + flèches) ; `npm run build` réussit.

### Tâche 4 — Planning (grille, cases, conflits)

**Fichiers** :
- `src/components/planning/GrillePlanning.vue` (**modifier**) — emplacement 4, données §6.4.
- `src/components/planning/CellulePlanning.vue` (**modifier**) — emplacement 5.
- `src/components/planning/PanneauConflits.vue` (**modifier**) — emplacement 6.

**Dépend de** : T1, T2. **Parallélisable** avec T3 et T5.

**Critères de sortie** : parcours §10 « Planning » ; les pastilles de **personne** (en-tête en vue « par personne », cases en vue « par tournée ») sont **inchangées** ; glisser-déposer, verrouillage, pouce « souhait » : non régressés ; `npm run build` réussit.

### Tâche 5 — Diffusion / impression

**Fichiers** :
- `src/domain/diffusion.js` (**modifier**) — §5.4.
- `src/components/diffusion/MoisDiffusion.vue` (**modifier**) — emplacement 7.
- `src/components/diffusion/LegendeDiffusion.vue` (**modifier**) — emplacement 8 (retirer le commentaire « point d'insertion de l'icône (feature 0029) »).

**Dépend de** : T1, T2. **Parallélisable** avec T3 et T4.

**Critères de sortie** : parcours §10 « Impression » ; `construireDiffusion` renvoie `icone` sur chaque colonne (`null` si aucune ou inconnue) ; pagination (`moisParPage`) inchangée ; `npm run build` réussit.

## 10. Critères d'acceptation

**Tournées**
- [x] La fiche d'une tournée propose « Icône de repère (facultatif) » avec son aide, 13 vignettes (« Aucune » + 12), chacune avec un nom visible ; « Aucune » est cochée à la création.
- [x] Les vignettes montrent l'icône sur la couleur de la tournée ; changer la couleur met à jour toutes les vignettes et l'aperçu.
- [x] La vignette choisie est encadrée, sur fond léger et cochée ; Tab entre dans le groupe, les flèches changent le choix, le focus est visible.
- [x] Enregistrer avec « Seringue » : la liste affiche la pastille avec la seringue à côté du nom ; rouvrir la tournée montre « Seringue » cochée ; choisir « Aucune » et enregistrer → pastille unie.
- [x] Une tournée archivée garde son icône dans « Tournées archivées ».
- [x] L'aide de la période de validité cite l'exemple de la campagne de vaccination.

**Planning**
- [x] Vue « par tournée » : l'en-tête de chaque colonne montre la pastille (avec icône le cas échéant) ; vue « par personne » : chaque case montre la pastille de la tournée avec son icône à côté du nom de la tournée.
- [x] Les pastilles de personne sont inchangées ; le panneau « Tournées non couvertes » montre la pastille avec icône.
- [x] L'icône reste lisible sur une couleur foncée (icône claire) et sur une couleur claire (icône foncée).

**Impression**
- [x] Sur le planning imprimé (aperçu avant impression), l'en-tête de colonne et la légende « Tournées » montrent la pastille avec l'icône, lisible ; impression en noir et blanc (option de l'imprimante ou du PDF) : l'icône reste distinguable.

**Sauvegarde**
- [x] Des données existantes (v6) se rechargent sans erreur ; après une modification, `localStorage` contient `"schemaVersion": 7` et `"icone": null` sur chaque tournée.
- [x] Export → `"schemaVersion": 7` ; ré-import du fichier exporté → identique ; import d'une ancienne sauvegarde v6 → tournées sans icône.
- [x] Un fichier v7 modifié à la main avec `"icone": "FOO"` s'importe sans erreur ; la tournée s'affiche sans icône.
- [x] Non-régression sur `files/idelia-sermet.json` : migration v6 → v7 sans aucune perte (§11 étape 2).
- [x] `npm run build` réussit.

## 11. Vérification

1. **Script jetable domaine + migration (T1)** — dans le dossier temporaire de session (`C:\Users\jmaguy\AppData\Local\TEMP\claude\…\scratchpad`, **jamais dans le dépôt**), un `.mjs` qui démarre Vite en mode middleware (`createServer({ root: <dépôt>, server: { middlewareMode: true }, appType: 'custom' })`) et charge par `ssrLoadModule` `/src/domain/iconesTournee.js`, `/src/domain/tournees.js`, `/src/domain/schema.js`, `/src/storage/migrations.js` ; exécute les contrôles de T1 ; ferme le serveur ; supprimé après usage.
2. **Non-régression sur les données réelles** — même script, avec le chemin de `files/idelia-sermet.json` **passé en argument** : `migrate` puis `verifierIntegrite` ; vérifier et n'afficher **que des compteurs et des booléens** (jamais de nom, de date ni de contenu) : version d'origine → 7 ; mêmes nombres de personnes, tournées, absences, plannings et affectations ; chaque tournée identique à l'originale hormis `icone` (`null`) ; `verifierIntegrite.ok === true` ; idempotence. Ne rien copier du fichier dans le dépôt, un commit ou un rapport.
3. `npm run build`.
4. **Recette navigateur** (`npm run dev`, http://localhost:5199/idelia/#/, données chargées depuis `idelia-sermet.json` via l'import) : parcours §10 Tournées → Planning (deux orientations, mode modification : glisser-déposer et verrouillage toujours fonctionnels) → Diffusion (aperçu d'impression, couleur puis noir et blanc).
5. DevTools > Application : `schemaVersion: 7`, champ `icone` présent ; export puis import → identique ; import d'un fichier v7 modifié (`"icone": "FOO"`, copie hors dépôt) → aucune erreur, pas d'icône.
6. Clavier seul : formulaire (groupe d'icônes, Échap ferme la modale) ; lecteur d'écran : chaque vignette annoncée par son nom (« Seringue, bouton radio, 2 sur 13 »), aucune pastille annoncée ailleurs.
7. Relecture `ui-ux` (choix et lisibilité des 12 icônes, taille 20 px dans la grille, impression), puis audit `security` (aucun `v-html` ; valeur importée jamais interprétée comme nom de composant : la correspondance passe par une table fermée).

## 12. Décisions à confirmer / risques

1. **Code stocké plutôt que nom de composant Phosphor** (retenu) : découple les données de la librairie (un renommage Phosphor ne casse aucune sauvegarde) et empêche qu'une valeur importée choisisse un composant arbitraire (table fermée, sécurité).
2. **Liste des 12 icônes** (proposée, §3.2) : à valider par le porteur / `ui-ux`. Ajouter une icône plus tard = une ligne dans `ICONES_TOURNEE` + une entrée dans `COMPOSANTS_ICONE`, **sans migration** (champ déjà présent, valeurs existantes inchangées). Retirer une icône : les tournées qui l'utilisent l'affichent comme « Aucune » (normalisation), sans perte du reste.
3. **Taille dans le planning** (16 → 20 px pour **toutes** les pastilles de tournée, avec ou sans icône, pour un rendu homogène) : léger gain de place perdue dans les cases. Alternative si `ui-ux` la juge gênante : 20 px seulement quand une icône est présente (rendu hétérogène dans une même colonne, déconseillé).
4. **Valeur inconnue dans un fichier v7** : normalisée à `null` dans `fromSaveDocument`, **sans message** (champ purement visuel) ; `verifierIntegrite` inchangée — même choix que `0034` §12 n° 3.
5. **Impression noir et blanc** : la couleur de l'icône suit la luminance de la couleur de fond, ordre préservé en niveaux de gris ; contour noir de la pastille et ombre de contour sur l'icône claire si le navigateur n'imprime pas les fonds (`print-color-adjust: exact` le demande, Firefox peut l'ignorer selon les réglages). Même risque déjà accepté par `0012` pour `RepereDiffusion`.
6. **Souhait « Tournée préférée ou évitée »** (`FormulairePreference`, `SouhaitsView`) : les tournées y sont listées sans pastille ; ajouter la pastille partagée serait cohérent mais hors du périmètre annoncé — à décider (petite tâche ultérieure, sans impact de données).
7. **Tournée temporaire** : aucune construction ; seul le texte d'aide évolue. Si le cabinet voulait voir « temporaire » dans le planning, ce serait une feature distincte.
8. **Aucun écart d'ADR** : icônes Phosphor exclusivement (ADR 0013), aucune dépendance ajoutée, Bootstrap `.btn-check` déjà disponible via le module `forms` importé (`src/styles/_bootstrap.scss`), persistance via store + plugin + migration (ADR 0005/0006), logique en module pur (ADR 0008), tokens SCSS (ADR 0012/0015).

## 13. Retouches de recette (2026-10-14)

- **Impression** : pastille en taille fixe (18 px, icône 13 px) au lieu de `1.5em` / `1em` — l'icône tombait à ~9 px et devenait illisible (relecture `ui-ux`). Le liseré `drop-shadow` sur l'icône claire est retiré (il écrasait l'icône à cette taille) ; le contour noir de la pastille et `print-color-adjust: exact` suffisent.
- **Robustesse** : `fromSaveDocument` lit `t?.icone` (tournée `null` dans un document incohérent : pas d'exception). La validation des éléments non objets à l'import reste un chantier transverse hors de cette feature (audit `security`, point Faible).
