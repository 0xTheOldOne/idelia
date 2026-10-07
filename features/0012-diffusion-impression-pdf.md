# Feature 0012 — Diffusion / impression / PDF

- **Statut** : En cours
- **Dépend de** : `0011` (planning éditable : écran `/planning` → `PlanningView`, barre d'actions `.planning-barre-actions`, store `plannings` avec `byId`/`courant`/`SELECT`, action `resumeConflits` livrée par `0013`). Transitivement : `0016` (modèle `Tournee.segments[]`, helpers `estCoupee`/`libelleSegment`/`libelleHoraires` de `src/domain/tournees.js`), `0026` (`Planning.genereLe`, `infoGeneration`, `dateUtil.formatHorodatageDateFr` — implémentée, non committée), `0015` (shell `App.vue` déjà doté d'un bloc `@media print` qui masque le menu), `0018` (`PileNotifications` déjà masquée à l'impression).
- **Prépare (points d'extension, sans les implémenter)** : `0023` (repères calendaires fériés/vacances : fonction `reperesDuJour`, §5.5), `0027` (envoi par e-mail : le PDF produit ici + titre de document servant de nom de fichier, §6.4), `0029` (icône de tournée : la pastille de tournée de la légende est isolée, §6.2).
- **ADR liés** : [0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md) (**décision fondatrice** : le référent diffuse en lecture par impression / PDF), [0002](../docs/adr/0002-application-frontend-sans-backend.md) (aucun service distant : PDF via la boîte de dialogue d'impression du navigateur), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (le moteur n'est pas touché ; aucun composant n'importe `@/domain/scheduling`), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7, dates `"YYYY-MM-DD"`, aucun objet `Date` hors `dateUtil`), [0017](../docs/adr/0017-modelisation-tournees-coupees-segments.md) (une tournée coupée = 2 segments affichés distinctement), [0016](../docs/adr/0016-router-mode-hash-pour-pages.md) (route paramétrée en mode hash, rechargement direct fiable), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS, tokens = source de vérité, utilitaire Bootstrap `d-print-none`), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS + JSDoc), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (**aucune** écriture : la feature est en lecture seule).

## 1. Contexte & objectif

Le cabinet affiche aujourd'hui un **planning papier** : les **mois en colonnes**, une ligne par jour (numéro du jour), et pour chaque jour les tournées (T1, T2…) avec, dans chaque case, **la couleur et l'initiale** de la personne qui l'assure ; une **légende** relie initiales et couleurs aux noms ; l'en-tête porte « **Mise à jour 15/06/2026** ». Conformément à l'[ADR 0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md), Idelia doit permettre au référent de **produire ce support** pour l'équipe, sans backend et sans bibliothèque PDF.

`0012` livre une **vue imprimable** dédiée (`/planning/:id/diffusion`) qui reproduit ce format, avec un **aperçu à l'écran fidèle au tirage** et un gros bouton **« Imprimer »**. Le PDF s'obtient par la fonction native du navigateur (« Enregistrer au format PDF » dans la fenêtre d'impression). L'en-tête de chaque page reprend le titre « Idelia », le sous-titre « Planning du … au … », le logo calé à droite et la date « Mise à jour du … » (`0026`). Les **dimanches** sont mis en évidence dès maintenant (calcul local trivial) ; les autres repères calendaires (`0023`) se brancheront sur un point d'extension prévu.

**Hors périmètre** (voir §12 pour les justifications) :

- **Statut `PUBLIE` / `publieLe` / snapshot d'affichage figé** (02 §Intégrité n°2) : **non touchés** par `0012` (§12 n°1).
- **Jours fériés et vacances scolaires** → `0023` (ADR préalable réseau). `0012` n'en livre que le **point d'extension** (`reperesDuJour`, §5.5).
- **Absences / congés sur le tirage** : non demandés par le format papier ; non affichés.
- **Génération programmatique d'un fichier PDF** (jsPDF, html2pdf…) : exclue (KISS, aucune dépendance ajoutée).
- **Envoi par e-mail** → `0027`. **Icône de tournée** → `0029`.
- **Réglages d'impression dans l'app** (choix des mois, orientation, taille de police) : non (KISS) ; le navigateur reste maître de sa boîte de dialogue.
- Toute modification du moteur `src/domain/scheduling/` et du modèle de données.

## 2. Écrans concernés

| Route | Écran | Changement |
|---|---|---|
| `/planning/:id/diffusion` (nom `diffusion`) | **Diffusion** → `DiffusionView.vue` | **Créé** (route déjà prévue par [07](../docs/architecture/07-navigation-et-ecrans.md)). |
| `/planning` | **Planning** → `PlanningView.vue` | **Modifié** : bouton « Imprimer le planning » dans la barre d'actions. |

Le menu latéral met automatiquement en évidence l'item « Planning » sur la nouvelle route (`MenuLateral.estActif` teste déjà `path.startsWith('/planning/')`) : rien à changer.

### 2.1 Expérience visée (utilisateur non-technique)

**Depuis l'écran Planning** : un bouton bien visible **« Imprimer le planning »** (icône imprimante + libellé) dans la barre d'actions du planning ouvre l'écran de diffusion du planning affiché.

**Écran de diffusion, à l'écran** :

```
← Retour au planning

Imprimer le planning                                   (h1)
Voici le planning tel qu'il sera imprimé. Pour obtenir un fichier PDF
(par exemple pour l'envoyer par e-mail), choisissez « Enregistrer au
format PDF » dans la fenêtre qui s'ouvre.

[⚠ Ce planning a encore 2 points à résoudre … Revenir au planning]   (si besoin, non bloquant)

[ 🖨  Imprimer ]                                       (bouton principal, large)

┌──────────────────── aperçu : une feuille A4 par page ────────────────────┐
│ Idelia                                                        [logo]     │
│ Planning du 13/07/2026 au 30/08/2026                                     │
│ Mise à jour du 15/06/2026                                   Page 1 / 1   │
│ ┌─ Juillet 2026 ─────────────┐ ┌─ Août 2026 ────────────────┐            │
│ │ Jour │  T1        │  T2   │ │ Jour │  T1        │  T2   │            │
│ │      │ Matin│Soir │       │ │      │ Matin│Soir │       │            │
│ │ Lu 13│  [M] │ [M] │ [CL]  │ │ Sa 1 │  [S] │ [S] │  —    │            │
│ │ …    │      │     │       │ │ Di 2 │      Fermé           │ (grisé)   │
│ └────────────────────────────┘ └────────────────────────────┘            │
│ Légende — Personnes : [M] Marie Dupont · [CL] Claire Leroy · [S] Sophie… │
│ Tournées : T1 Tournée Nord (coupée : matin 07:00 – 13:30, soir 17:00 –   │
│ 20:00) · T2 Tournée Sud (07:00 – 13:30)                                  │
│ Repères : ligne grisée = dimanche · « — » = pas de tournée ce jour       │
└──────────────────────────────────────────────────────────────────────────┘
```

- **L'aperçu ressemble au tirage** : mêmes feuilles blanches au format A4, mêmes tailles de texte, mêmes couleurs ; seule la barre d'outils (retour, explication, bandeau, bouton) disparaît à l'impression.
- **Un seul geste** : « Imprimer » ouvre la fenêtre d'impression du navigateur (`window.print()`), d'où l'on imprime **ou** enregistre en PDF. Rien n'est modifié dans les données ; annuler la fenêtre ne change rien.
- **Pas de piège** : si le planning comporte encore des conflits ou des créneaux non pourvus, un **bandeau d'information** le signale avec un lien pour revenir corriger — sans jamais bloquer l'impression.
- **Planning introuvable** (lien obsolète, après un import) : message clair « Ce planning est introuvable. » + bouton « Retour au planning » (patron de `SouhaitsView`).

## 3. Modèle de données touché

**Aucun.** `0012` est en **lecture seule** : aucun champ ajouté, **`schemaVersion` inchangé**, aucune migration, aucune écriture dans le store.

Champs **lus** : `Planning.dateDebut`/`dateFin`/`affectations`/`genereLe`/`updatedAt` ; `Affectation.personneId`/`tourneeId`/`date`/`segmentIndex` ; `Personne.prenom`/`nom`/`couleur`/`actif` ; `Tournee.libelle`/`segments`/`joursApplication`/`dateDebutValidite`/`dateFinValidite`/`couleur`/`archivee` ; `ParametresCabinet.joursOuverture`.

**Non touchés** (décision §12 n°1) : `Planning.statut` (reste tel quel, `BROUILLON` en pratique) et `Planning.publieLe` (reste `null`). Le snapshot d'affichage figé à la publication (02 §Intégrité n°2) est **différé** : la vue résout noms/couleurs **en direct** via les collections complètes (personnes et tournées archivées comprises, jamais supprimées physiquement — 02 §Intégrité n°1), comme `GrillePlanning`.

## 4. Store (Vuex)

**Aucun module, getter, mutation ni action créé ou modifié.** La vue consomme l'existant :

| Élément | Usage |
|---|---|
| getter `plannings/byId(id)` | planning à diffuser, lu depuis `$route.params.id` |
| state `personnes.items`, `tournees.items` | collections **complètes** (archivées comprises) passées au domaine |
| getter `cabinet/parametres` | `joursOuverture` |
| action `plannings/resumeConflits({ plannings: [planning] })` (`0013`) | résumé des points à résoudre pour le bandeau (lecture seule, aucun `commit`) |
| mutation `plannings/SELECT(id)` | « Retour au planning » rouvre **ce** planning dans l'éditeur (patron `AccueilView.ouvrirPlanning`) |

**Volatil (état local de la vue, jamais persisté)** : le résumé de conflits du bandeau.

## 5. Domaine (logique pure)

Toute la mise en forme « planning papier » (regroupement par mois, colonnes de tournées, repères de personnes, applicabilité, pagination) est **calculée dans le domaine** par une fonction pure qui renvoie un modèle prêt à afficher. Les composants ne font que le rendre. Aucun import Vue/Vuex ; aucun import de `@/domain/scheduling`.

### 5.1 `src/domain/planning.js` (modifier) — `dateMiseAJour`

```js
/**
 * Date de « mise à jour » d'un planning pour le tirage papier (feature 0012) :
 * la plus récente de `genereLe` et `updatedAt` (comparaison de chaînes ISO,
 * largeur fixe). Repli naturel sur `updatedAt` si `genereLe` est inconnu
 * (planning antérieur à 0026) : `updatedAt` est toujours une date réelle de
 * dernière modification, jamais inventée.
 * @param {Planning|null|undefined} planning
 * @returns {{ iso: string, texte: string }|null} `texte` = « JJ/MM/AAAA » (date locale) ; `null` si aucune date.
 */
export function dateMiseAJour(planning) { … }
```

Règles : candidats `[planning.genereLe, planning.updatedAt].filter(Boolean)` ; `null` si vide ; `iso` = le plus grand (comparaison de chaînes) ; `texte` = `dateUtil.formatHorodatageDateFr(iso)` (conversion **locale** — ne jamais découper la chaîne ISO, cf. `0026` §5.2). Compte tenu de l'invariant `0026` §3.2 (`updatedAt >= genereLe`), le résultat vaut en pratique `updatedAt` ; le `max` reste écrit pour la robustesse (données importées incohérentes). Justification du repli : §12 n°2.

### 5.2 `src/domain/libelles.js` (modifier) — libellés courts

- `LIBELLES_JOUR_COURT` (ISO 1..7 → `'Lu'`, `'Ma'`, `'Me'`, `'Je'`, `'Ve'`, `'Sa'`, `'Di'`) + `libelleJourCourt(iso)` → `''` si inconnu. Abréviations usuelles des plannings papier français ; jours **ISO** (ADR 0010).
- `LIBELLES_MOIS` (1..12 → `'Janvier'` … `'Décembre'`) + `libelleMois(numero)` → `''` si inconnu.

`JOURS_SEMAINE` existant **inchangé** (aucun consommateur impacté).

### 5.3 `src/domain/utils/couleurs.js` (créer) — contraste du texte sur une pastille

```js
/**
 * Indique si une couleur de fond `#RRGGBB` est « foncée », c.-à-d. si un texte
 * clair y offre un meilleur contraste qu'un texte foncé (luminance relative
 * WCAG 2.x ; seuil d'égalité des contrastes ≈ 0,179). Couleur invalide/absente
 * → `false` (texte foncé, cas sûr sur fond clair).
 * @param {string} hex
 * @returns {boolean}
 */
export function estCouleurFoncee(hex) { … }
```

Le composant traduit le booléen en **classe** (`--texte-inverse`) dont la couleur vient des tokens (`$couleur-texte` / `$couleur-texte-inverse`) : aucune couleur en dur dans les composants. Réutilisable plus tard (`0029`, grille).

### 5.4 `src/domain/tournees.js` (modifier) — `tourneeApplicableLe`

```js
/**
 * `true` si la tournée existe à cette date : jour ISO ∈ `joursApplication` et
 * date dans `[dateDebutValidite, dateFinValidite]` (bornes nulles = ouvertes).
 * Même règle que l'expansion de la demande du moteur
 * (`scheduling/modele/demande.js`), exposée côté domaine d'affichage sans
 * importer un fichier interne du moteur (surface publique, 0009 §5.15).
 * @param {Tournee} tournee
 * @param {string} date - `"YYYY-MM-DD"`
 * @returns {boolean}
 */
export function tourneeApplicableLe(tournee, date) { … }
```

Comparaisons de chaînes uniquement ; jour via `dateUtil.weekdayISO`. Le moteur **n'est pas modifié** (duplication assumée de deux conditions, §12 n°14).

### 5.5 `src/domain/diffusion.js` (créer) — modèle du planning papier

#### Constantes (réglages de mise en page, documentés)

```js
/** Nombre de « colonnes utiles » (jour + segments de tournées) tenant sur la largeur d'une page A4 portrait. */
export const BUDGET_COLONNES_PAGE = 15;
/** Plafond de mois par page, pour la lisibilité. */
export const MOIS_PAR_PAGE_MAX = 4;
```

#### Typedefs (JSDoc)

```js
/**
 * @typedef {Object} RepereJour - Repère calendaire d'un jour (affichage seul).
 * @property {string} code - `'DIMANCHE'` (0012). Réservés à 0023 : `'FERIE'`, `'VACANCES_SCOLAIRES'`.
 * @property {string} libelle - Libellé FR pour la légende (ex. « Dimanche »).
 * @property {string} court - Marqueur court affiché près du jour ('' si aucun ; ex. 0023 : « F »).
 */
/**
 * @typedef {Object} SegmentColonne
 * @property {number} index - Indice du segment dans `tournee.segments`.
 * @property {string} libelleVacation - 'Matin' / 'Soir' (tournée coupée) ou '' (tournée complète).
 * @property {string} horaires - `libelleSegment(segment)`.
 */
/**
 * @typedef {Object} ColonneTournee
 * @property {string} tourneeId
 * @property {string} code - 'T1', 'T2'… (ordre des colonnes).
 * @property {string} libelle - Libellé complet (+ « (archivée) » le cas échéant).
 * @property {string} couleur
 * @property {boolean} coupee
 * @property {string} horaires - `libelleHoraires(tournee)`.
 * @property {SegmentColonne[]} segments - 1 ou 2.
 */
/**
 * @typedef {Object} PersonneDiffusion
 * @property {string} personneId
 * @property {string} repere - Initiale(s) unique(s) dans ce tirage (« M », « MD »…), '?' si inconnue.
 * @property {string} nomComplet - « Prénom Nom » (+ « (archivée) »), « Personne inconnue » si introuvable.
 * @property {string} couleur - Hex, ou '' si inconnue.
 * @property {boolean} fonce - `estCouleurFoncee(couleur)`.
 */
/**
 * @typedef {Object} CaseDiffusion - Une case = (jour, tournée, segment).
 * @property {string} tourneeId
 * @property {number} segmentIndex
 * @property {boolean} applicable - Tournée existante ce jour (`tourneeApplicableLe`).
 * @property {PersonneDiffusion[]} personnes - Personnes affectées (triées par repère).
 */
/**
 * @typedef {Object} JourDiffusion
 * @property {string} date
 * @property {number} numero - 1..31.
 * @property {string} jourCourt - `libelleJourCourt(weekdayISO(date))`.
 * @property {boolean} ferme - Jour hors `joursOuverture`.
 * @property {boolean} ligneFermee - `ferme` ET aucune personne dans aucune case → rendu « Fermé » sur toute la ligne.
 * @property {RepereJour[]} reperes
 * @property {CaseDiffusion[]} cases - Dans l'ordre des colonnes (segments aplatis).
 */
/**
 * @typedef {Object} MoisDiffusion
 * @property {string} cle - 'YYYY-MM'.
 * @property {string} libelle - 'Juillet 2026'.
 * @property {JourDiffusion[]} jours - Uniquement les jours de la période du planning.
 */
/**
 * @typedef {Object} Diffusion
 * @property {string} titre - 'Idelia'.
 * @property {string} sousTitre - 'Planning du JJ/MM/AAAA au JJ/MM/AAAA'.
 * @property {(string|null)} miseAJourIso
 * @property {string} miseAJourTexte - '' si aucune date.
 * @property {ColonneTournee[]} colonnes
 * @property {MoisDiffusion[][]} pages - Mois regroupés par page imprimée.
 * @property {PersonneDiffusion[]} legendePersonnes - Personnes présentes, triées par nom complet (fr).
 * @property {RepereJour[]} legendeReperes - Repères effectivement présents (dédupliqués par code).
 * @property {boolean} vide - Aucune affectation dans le planning.
 */
```

#### Fonctions exportées

1. **`reperesDuJour(date, sources = {})`** → `RepereJour[]` — **point d'extension de `0023`**. En `0012` : `[{ code: 'DIMANCHE', libelle: 'Dimanche', court: '' }]` si `dateUtil.weekdayISO(date) === 7`, sinon `[]`. Le paramètre `sources` est **réservé** (non lu en `0012`) : `0023` y passera ses données (fériés calculés, cache des vacances scolaires) et ajoutera ses codes **sans changer la signature** ni les composants (rendu générique par code, §6.2). Documenter cette intention dans le JSDoc.

2. **`calculerReperesPersonnes(personnes)`** → `Map<personneId, string>` — repères **uniques au sein du tirage**, déterministes :
   - ordre stable : tri par `nom`, puis `prenom` (`localeCompare('fr')`), puis `id` ;
   - niveau 1 : initiale du prénom en majuscule (repli : initiale du nom, puis `'?'`) ;
   - pour chaque groupe en collision : niveau 2 = initiale prénom + initiale nom (« MD ») ;
   - collision persistante : suffixe numérique dans l'ordre stable (« MD1 », « MD2 »).
   Lettres accentuées conservées (« É »). Calculée **uniquement** sur les personnes présentes dans les affectations du planning (repères les plus courts possibles, §12 n°7).

3. **`moisParPage(colonnes)`** → `number` = `Math.max(1, Math.min(MOIS_PAR_PAGE_MAX, Math.floor(BUDGET_COLONNES_PAGE / (1 + nbSegments))))` où `nbSegments` = somme des `segments.length` des colonnes. Ex. : 2 tournées dont 1 coupée → 3 segments → 3 mois/page ; 1 tournée complète → 4 (plafond) ; 7 tournées coupées → 1.

4. **`construireDiffusion({ planning, personnes, tournees, joursOuverture, sourcesReperes = {} })`** → `Diffusion`. Étapes :
   1. **Colonnes** : tournées **actives applicables au moins un jour** de la période (`tourneeApplicableLe`) **∪** tournées **référencées** par une affectation (archivées comprises, libellé suffixé « (archivée) ») ; tri par `libelle` (`localeCompare('fr')`, même ordre que `GrillePlanning.lignesTournees`, c'est-à-dire l'ordre des colonnes de l'éditeur transposé) ; code `T1…Tn` dans cet ordre ; `segments` décrits comme dans `GrillePlanning.segmentsCellule` (« Matin »/« Soir » si coupée, '' sinon).
   2. **Personnes** : ids présents dans `planning.affectations` → `PersonneDiffusion` via la collection complète ; repères via `calculerReperesPersonnes` ; id introuvable → repère `'?'`, « Personne inconnue », couleur ''.
   3. **Jours** : `dateUtil.rangeInclusive(dateDebut, dateFin)` ; pour chaque date : `numero`, `jourCourt`, `ferme`, `reperes = reperesDuJour(date, sourcesReperes)` ; une `CaseDiffusion` par (colonne, segment) avec `applicable` et les personnes des affectations correspondantes `(tourneeId, date, segmentIndex)`.
   4. **Honnêteté du tirage** : **toute** affectation du planning est imprimée, même sur un jour fermé ou une case non applicable (le papier ne doit jamais masquer ce qui est réellement planifié) ; `ligneFermee` n'est vrai que si le jour est fermé **et** vide. Affectation dont le `segmentIndex` n'existe plus (tournée repassée de coupée à complète) → rattachée au **dernier** segment de sa tournée. Tournée introuvable (impossible par la règle de soft-delete) → ignorée.
   5. **Mois** : regroupement par `date.slice(0, 7)` (chaîne, aucun `Date`) ; `libelle` = `libelleMois(n) + ' ' + annee`.
   6. **Pages** : découpage de la liste des mois en tranches de `moisParPage(colonnes)`.
   7. **En-tête** : `titre = 'Idelia'` ; `sousTitre` construit depuis `dateDebut`/`dateFin` via `dateUtil.formatDateFr` (indépendant de `planning.nom`) ; `miseAJour*` via `dateMiseAJour` (§5.1).
   8. **Légendes** : `legendePersonnes` triée par `nomComplet` (fr) ; `legendeReperes` = repères rencontrés, dédupliqués par `code`, dans l'ordre de première apparition.
   9. `vide = planning.affectations.length === 0`.

5. **`titreDocumentDiffusion(planning)`** → `'Idelia - Planning du 13-07-2026 au 30-08-2026'` (tirets plutôt que `/`, car le titre du document sert de **nom de fichier PDF proposé** par le navigateur — utile à `0027`).

### 5.6 Réutilisation

`dateUtil` (`rangeInclusive`, `weekdayISO`, `formatDateFr`, `formatHorodatageDateFr`), `libelles.js`, `tournees.js` (`estCoupee`, `libelleSegment`, `libelleHoraires`) — étendus, jamais dupliqués. **Aucun objet `Date` hors `dateUtil`.**

## 6. Composants

### 6.1 Cohérence avec la grille de l'éditeur, et pourquoi ne pas la réutiliser

**Orientation alignée.** Depuis sa transposition (demande du porteur), `GrillePlanning` affiche **un jour par ligne** (en-têtes de ligne `grille-planning-entete-jour`, colonne figée) et **une tournée — ou une personne — par colonne** (en-têtes `grille-planning-entete-entite`), via le computed `lignesJours` qui transpose `matrice` (entités × jours). Chaque **tableau de mois** de la vue imprimable suit **la même logique** : jours en lignes, tournées (et leurs segments) en colonnes, tournées dans le **même ordre** (tri par libellé, comme `lignesTournees`). Le référent retrouve donc sur papier la disposition de son écran ; la seule différence est la **mise côte à côte des mois** propre au format papier (dilemme : §12 n°17).

**Pourquoi un rendu dédié malgré tout.** `GrillePlanning`/`CellulePlanning` restent un composant **interactif d'écran** : édition, glisser-déposer, surlignage des conflits, colonne figée et défilement, cellules listant des **noms complets** sur une fenêtre jour/semaine/mois pilotée par `ControlesGrille`. Le tirage demande l'inverse : statique, **compact** (pastille + repère de 1-2 lettres), toute la période, **paginé**, une légende par page. Détourner la grille (props supplémentaires, `@media print` plaqués sur un tableau défilant à colonne `sticky`) serait plus coûteux et fragile qu'un rendu dédié **sans aucune logique** (tout vient de `construireDiffusion`). On réutilise ses **règles** (ordre des tournées, « Matin »/« Soir », résolution des archivées) via le domaine. **Divergence assumée** : une tournée coupée est rendue dans l'éditeur par deux **groupes empilés** dans une même cellule (`CellulePlanning`), et sur papier par deux **sous-colonnes** « Matin » / « Soir » (§12 n°5).

### 6.2 Fichiers

| Fichier | Type | Responsabilité |
|---|---|---|
| `src/views/DiffusionView.vue` | **créer** | **Orchestrateur.** Lit `$route.params.id` → `plannings/byId` ; calcule `diffusion` (computed) via `construireDiffusion` à partir du store ; rend la barre d'outils **écran seulement** (`d-print-none`) : lien « Retour au planning » (`PhArrowLeft`, pose `SELECT(id)` puis `push({ name: 'planning' })`), `h1` « Imprimer le planning », texte d'explication PDF, bandeau de points à résoudre (T4), bouton principal **« Imprimer »** (`PhPrinter`, `btn btn-primary btn-lg`, `window.print()`) ; puis une `FeuilleDiffusion` par page. État « introuvable » (patron `SouhaitsView`). Gère `document.title` (T4). Aucune logique métier. |
| `src/components/diffusion/FeuilleDiffusion.vue` | **créer** | **Une page imprimée.** Props : `diffusion` (le modèle complet), `mois` (`MoisDiffusion[]` de la page), `numeroPage`, `nbPages`. Rend l'**en-tête** (titre « Idelia », sous-titre, « Mise à jour du <time :datetime>…</time> » si `miseAJourTexte`, « Page n / N » si `nbPages > 1`, logo `${import.meta.env.BASE_URL}logo.png` calé à droite, `alt=""` car décoratif — le titre texte dit déjà « Idelia »), les `MoisDiffusion` côte à côte, puis la `LegendeDiffusion`. Saut de page après chaque feuille sauf la dernière. |
| `src/components/diffusion/MoisDiffusion.vue` | **créer** | **Un tableau de mois.** Props : `mois`, `colonnes`. `<table>` avec `<caption>` (« Juillet 2026 »), en-tête à 2 niveaux : `th` « Jour » (`rowspan=2`) ; par tournée `th` « T1 » (+ pastille couleur de tournée décorative) en `colspan=2` si coupée (sous-en-têtes « Matin » / « Soir ») ou `rowspan=2` si complète. Une ligne par jour : `th scope="row"` « Lu 13 » (+ marqueurs `court` des repères) ; classes de ligne **génériques** `mois-diffusion-ligne--repere-<code en kebab>` (ex. `--repere-dimanche`) ; si `ligneFermee` → une seule cellule `colspan` « Fermé » ; sinon une cellule par case : `RepereDiffusion` pour chaque personne, « — » (atténué, + texte invisible « Pas de tournée ce jour ») si `!applicable` et vide, case vide si applicable et vide (+ texte invisible « Personne »). |
| `src/components/diffusion/LegendeDiffusion.vue` | **créer** | **Légende** (reprise sur chaque page). Props : `personnes`, `colonnes`, `reperes`. Trois blocs courts : **Personnes** (`RepereDiffusion` + nom complet), **Tournées** (pastille couleur de tournée + « T1 — libellé — horaires », « coupée : matin …, soir … »), **Repères** (échantillon visuel par code + libellé, et toujours « — = pas de tournée ce jour » ; « Fermé = cabinet fermé » si une ligne fermée existe). La pastille de tournée est un élément isolé et classé pour que `0029` y insère son icône. |
| `src/components/diffusion/RepereDiffusion.vue` | **créer** | **Pastille de personne** : fond = couleur de la personne (style inline, seule valeur dynamique), texte = repère, classe `--texte-inverse` si `fonce`, fine bordure (visible sur fond clair et en noir & blanc), `print-color-adjust: exact` (+ `-webkit-`). Texte invisible pour lecteurs d'écran : nom complet (le repère seul n'est pas parlant). Réutilisée par `MoisDiffusion` et `LegendeDiffusion`. |
| `src/views/PlanningView.vue` | **modifier** | Bouton **« Imprimer le planning »** dans `.planning-barre-actions` : `router-link` `btn btn-primary` (`PhPrinter` + libellé), `:to="{ name: 'diffusion', params: { id: planningCourant.id } }"`, poussé à droite (`ms-auto`). |
| `src/router/index.js` | **modifier** | Route `{ path: '/planning/:id/diffusion', name: 'diffusion', component: DiffusionView }` ; mise à jour du commentaire d'en-tête (la route n'est plus « à ajouter plus tard »). |

### 6.3 Styles d'impression

- **`src/styles/_tokens.scss` (modifier)** — nouvelle section « Impression » : `$impression-marge-page: 10mm`, `$impression-largeur-feuille: 210mm`, `$impression-taille-texte: 9pt`, `$impression-taille-texte-petite: 7.5pt`, `$impression-taille-titre: 18pt`, `$impression-taille-sous-titre: 12pt`, `$impression-hauteur-logo: 20mm`, `$impression-fond-repere-dimanche: $couleur-fond-clair` (valeurs indicatives, ajustables par `ui-ux` ; aucune valeur en dur ailleurs).
- **`src/styles/_impression.scss` (créer)** — règles **globales** d'impression : `@page { size: A4 portrait; margin: t.$impression-marge-page; }` ; `@media print { body { background-color: t.$couleur-fond; } }` (pas de fond sable sur papier). Importé par `main.scss`.
- **`src/App.vue` (modifier)** — dans le bloc `@media print` existant : `.app-contenu { padding: 0; }` (les marges sont portées par `@page`).
- **Composants `diffusion/`** (scoped) : à l'écran, chaque feuille est une surface blanche de largeur `$impression-largeur-feuille` (avec `max-width: 100%` et défilement horizontal du conteneur si l'écran est étroit), ombre légère, espacée de la suivante ; **à l'impression**, ombre/espacement retirés, `break-after: page` sauf dernière feuille, `break-inside: avoid` sur chaque tableau de mois. Tailles de texte **identiques** à l'écran et au tirage (tokens `$impression-*`) : l'aperçu est fidèle. Tableaux en `table-layout: fixed; width: 100%` pour tenir la largeur quel que soit le nombre de tournées. `print-color-adjust: exact` (+ `-webkit-print-color-adjust`) sur les pastilles, les lignes de repères et les pastilles de tournée, pour que les couleurs s'impriment sans que l'utilisateur ait à cocher « Graphiques d'arrière-plan ».
- Barre d'outils de `DiffusionView` : utilitaire Bootstrap **`d-print-none`** (déjà généré par `utilities/api`).

### 6.4 Titre du document (nom du PDF)

`DiffusionView` pose `document.title = titreDocumentDiffusion(planning)` au montage (et quand le planning change), et **restaure** le titre précédent en `beforeUnmount`. Le navigateur propose ainsi « Idelia - Planning du 13-07-2026 au 30-08-2026.pdf » au lieu de « Idelia.pdf ».

## 7. Règles de validation

Sans objet : aucune saisie utilisateur. Aucun usage de Vuelidate ni de vue-debounce.

## 8. Points d'attention ergonomie

- **Bouton évident** : dans l'éditeur, « Imprimer le planning » est un bouton **plein** (`btn-primary`), avec icône **et** libellé, séparé des actions d'édition (poussé à droite). Sur l'écran de diffusion, « Imprimer » est l'**unique action principale**, grande (`btn-lg`), cible ≥ `$cible-cliquable-min`.
- **Langage clair** : « Imprimer le planning », « Enregistrer au format PDF » (le libellé exact affiché par Chrome/Edge/Firefox), « Retour au planning », « Mise à jour du … », « Fermé », « Pas de tournée ce jour ». Jamais « exporter », « print », « rendu ».
- **Aperçu = tirage** : mêmes feuilles, mêmes tailles, mêmes couleurs ; l'utilisateur sait ce qu'il va obtenir avant d'imprimer.
- **Jamais l'information par la seule couleur** : chaque pastille porte un **repère texte** (initiale(s)) ; la légende relie repère + couleur au **nom complet** (« couleurs de personnes toujours doublées du nom », checklist). Dimanche = fond grisé **et** jour en gras. Lisible en **noir & blanc** (08 §11) : les repères restent lisibles en niveaux de gris (texte foncé/clair choisi par contraste, fine bordure sur chaque pastille).
- **Repères stables et courts** : une lettre quand c'est possible, deux en cas d'homonymie d'initiale ; la légende figure **sur chaque page** (une page peut être affichée seule au cabinet).
- **Prévenir sans bloquer** : bandeau d'information (icône + texte, `role="status"`) si le planning a encore des points à résoudre, avec lien « Revenir au planning » ; l'impression reste possible.
- **Réversible / sans risque** : aucune donnée modifiée ; fermer la fenêtre d'impression ne change rien.
- **Accessibilité de l'aperçu** : structure `h1` (écran) → feuilles ; tableaux avec `caption`, `th scope` ; texte invisible pour les pastilles et les cases « — » ; logo décoratif `alt=""` ; focus visible sur les liens/boutons de la barre d'outils.
- **Points à faire valider par `ui-ux`** : taille de texte de l'aperçu (9 pt ≈ 12 px à l'écran), coexistence de deux boutons `btn-primary` sur `/planning` (« Générer le planning » et « Imprimer le planning »), lisibilité en niveaux de gris des 12 couleurs de la palette.

## 9. Étapes d'implémentation

**4 tâches**, chacune pour **un sous-agent `dev-front`**. Ordre : **T1 → T2 → T3 → T4** (T2 est indépendante de T1 et peut être menée en parallèle ; T3 dépend de T1 et T2 ; T4 de T3). Pas de suite de tests : critères vérifiables à la main (console `npm run dev`, aperçu d'impression du navigateur).

### Tâche 1 — Domaine de la diffusion (pur)

**Fichiers** :
- `src/domain/planning.js` (**modifier**) — `dateMiseAJour(planning)` (§5.1).
- `src/domain/libelles.js` (**modifier**) — `LIBELLES_JOUR_COURT` + `libelleJourCourt`, `LIBELLES_MOIS` + `libelleMois` (§5.2).
- `src/domain/utils/couleurs.js` (**créer**) — `estCouleurFoncee(hex)` (§5.3).
- `src/domain/tournees.js` (**modifier**) — `tourneeApplicableLe(tournee, date)` (§5.4).
- `src/domain/diffusion.js` (**créer**) — constantes, typedefs, `reperesDuJour`, `calculerReperesPersonnes`, `moisParPage`, `construireDiffusion`, `titreDocumentDiffusion` (§5.5).

**Critères de sortie** (console, `npm run dev`, avec des données réelles) :
- `dateMiseAJour({ genereLe: null, updatedAt: X })` → `{ iso: X, … }` ; avec `genereLe === updatedAt` → cette date ; `dateMiseAJour(null)` → `null` ; texte en date **locale** (`'2026-06-14T22:30:00.000Z'` → `15/06/2026` à Paris).
- `estCouleurFoncee('#2B2924')` → `true` ; `'#D99A26'` → `false` ; `'#0E8A8F'` → `false` ; `'pas-une-couleur'` → `false`.
- `tourneeApplicableLe` respecte `joursApplication` (ISO 1-7) et les bornes de validité nulles/renseignées.
- `reperesDuJour('2026-07-19')` (dimanche) → un repère `DIMANCHE` ; `reperesDuJour('2026-07-20')` → `[]`.
- `calculerReperesPersonnes` : « Marie Dupont » seule → « M » ; avec « Martine Roux » → « MD » / « MR » ; deux « Marie Dupont » → « MD1 » / « MD2 » ; résultat identique quel que soit l'ordre d'entrée.
- `construireDiffusion` sur un planning à cheval sur deux mois → 2 `MoisDiffusion` ne contenant **que** les jours de la période ; une tournée coupée produit 2 cases par jour ; les colonnes sont triées par libellé et codées T1…Tn ; une affectation posée à la main sur un jour fermé apparaît bien dans sa case (et `ligneFermee` est `false` ce jour-là) ; `pages` respecte `moisParPage`.
- `titreDocumentDiffusion` ne contient aucun `/`.
- Aucun import Vue/Vuex ni `@/domain/scheduling` dans ces fichiers ; aucun `new Date` hors `dateUtil` ; `npm run build` réussit.

### Tâche 2 — Socle d'impression (styles globaux)

**Fichiers** :
- `src/styles/_tokens.scss` (**modifier**) — section « Impression » (§6.3).
- `src/styles/_impression.scss` (**créer**) — `@page` A4 portrait + marge, fond blanc à l'impression (§6.3).
- `src/styles/main.scss` (**modifier**) — `@use 'impression';` après `base`.
- `src/App.vue` (**modifier**) — `.app-contenu { padding: 0; }` dans le bloc `@media print` existant.

**Critères de sortie** :
- `npm run build` réussit.
- Aperçu d'impression (Ctrl+P) de n'importe quel écran existant : menu latéral et notifications absents (inchangé), fond blanc, plus de marge intérieure parasite, format A4 portrait proposé.
- Aucun rendu **écran** modifié.

### Tâche 3 — Vue imprimable (route, feuilles, écran de diffusion)

**Dépend de** : T1, T2.

**Fichiers** :
- `src/router/index.js` (**modifier**) — route `diffusion` + commentaire d'en-tête (§6.2).
- `src/components/diffusion/RepereDiffusion.vue` (**créer**).
- `src/components/diffusion/MoisDiffusion.vue` (**créer**).
- `src/components/diffusion/LegendeDiffusion.vue` (**créer**).
- `src/components/diffusion/FeuilleDiffusion.vue` (**créer**).
- `src/views/DiffusionView.vue` (**créer**) — état introuvable, lien « Retour au planning » (`SELECT` + navigation), `h1`, texte d'explication PDF, bouton « Imprimer » (`window.print()`), une `FeuilleDiffusion` par page. **Sans** le bandeau de conflits ni `document.title` (T4).

**Critères de sortie** (`npm run dev`, en saisissant l'URL `/#/planning/<id>/diffusion` d'un planning existant — id lisible dans l'onglet Application) :
- Les feuilles s'affichent : en-tête (Idelia, « Planning du … au … », « Mise à jour du … », logo à droite), mois côte à côte avec jours de la période uniquement, colonnes T1/T2 (sous-colonnes Matin/Soir pour une tournée coupée), pastilles couleur + repère, « — » pour une tournée inexistante ce jour, « Fermé » sur une ligne de jour fermé vide, dimanches grisés et en gras, légende complète sur chaque feuille, « Page n / N » si plusieurs pages.
- Rechargement direct (F5) sur l'URL : même rendu (store hydraté avant montage). Id inconnu : message « Ce planning est introuvable. » + bouton de retour.
- « Imprimer » ouvre la fenêtre d'impression ; l'aperçu du navigateur ne contient **que** les feuilles (ni menu, ni barre d'outils), une feuille par page, couleurs imprimées sans cocher d'option, aucun tableau de mois coupé entre deux pages.
- « Retour au planning » rouvre l'éditeur **sur ce planning**.
- Aucune logique métier dans les composants (tout vient de `construireDiffusion`) ; aucune couleur en dur hors la couleur dynamique de personne/tournée ; `npm run build` réussit.

### Tâche 4 — Intégration et finitions

**Dépend de** : T3.

**Fichiers** :
- `src/views/PlanningView.vue` (**modifier**) — bouton « Imprimer le planning » dans `.planning-barre-actions` (§6.2) ; import `PhPrinter` ; mise à jour du JSDoc d'en-tête (mention `0012`).
- `src/views/DiffusionView.vue` (**modifier**) — bandeau non bloquant via `plannings/resumeConflits` au montage (si `aResoudre > 0` : « Ce planning a encore N point(s) à résoudre (conflits ou créneaux non pourvus). Vous pouvez l'imprimer tel quel, ou revenir le corriger. » + lien « Revenir au planning » ; échec silencieux en console, jamais bloquant, comme `AccueilView`) ; `document.title` posé/restauré (§6.4) ; message discret si `diffusion.vide` (« Ce planning ne contient encore aucune affectation. »).
- `docs/architecture/06-structure-du-code.md` (**modifier**) — ajouter `views/DiffusionView.vue`, `components/diffusion/`, `domain/diffusion.js`, `domain/utils/couleurs.js`, `styles/_impression.scss`.
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — §Intégrité n°2 : préciser que le snapshot d'affichage à la publication est **différé** (`0012` n'implémente pas la publication, voir `features/0012` §12 n°1).

**Critères de sortie** :
- Depuis `/planning`, « Imprimer le planning » ouvre la diffusion du planning affiché (y compris en mode modification).
- Planning avec conflit ou créneau non pourvu : bandeau visible à l'écran, **absent** de l'aperçu d'impression ; planning sans point à résoudre : pas de bandeau.
- « Enregistrer au format PDF » propose un nom de fichier « Idelia - Planning du … » ; en quittant la vue, l'onglet reprend le titre « Idelia ».
- `npm run build` réussit ; aucun `localStorage` direct ; aucune dépendance ajoutée (`package.json` inchangé).

## 10. Critères d'acceptation

- [ ] Depuis l'écran Planning, un bouton « Imprimer le planning » (icône + libellé) ouvre `/planning/<id>/diffusion` pour le planning affiché.
- [ ] L'écran de diffusion montre un aperçu en feuilles A4 fidèle au tirage et un bouton principal « Imprimer » qui ouvre la fenêtre d'impression du navigateur ; un texte explique comment obtenir un PDF.
- [ ] Format papier : mois en colonnes ; une ligne par jour de la période (« Lu 13 ») ; colonnes T1, T2… ; une tournée coupée a deux sous-colonnes « Matin » / « Soir » ; chaque personne est une pastille de sa couleur portant son repère (initiale(s) uniques dans le tirage).
- [ ] En-tête de chaque page : « Idelia », « Planning du JJ/MM/AAAA au JJ/MM/AAAA », logo calé à droite, « Mise à jour du JJ/MM/AAAA » (date la plus récente entre génération et dernière modification, y compris pour un planning ancien sans date de génération) ; « Page n / N » si plusieurs pages.
- [ ] Légende sur chaque page : personnes (repère + couleur + nom complet), tournées (code + libellé + horaires), repères (dimanche, « — », « Fermé »).
- [ ] Les dimanches sont mis en évidence (fond grisé **et** jour en gras) ; les jours fermés sans affectation affichent « Fermé » ; une case sans tournée ce jour affiche « — ».
- [ ] Toute affectation du planning figure sur le tirage (aucune masquée).
- [ ] À l'impression : ni menu, ni barre d'outils, ni bandeau, ni notifications ; couleurs imprimées sans réglage ; aucun tableau de mois coupé entre deux pages ; lisible en noir & blanc.
- [ ] Bandeau non bloquant si le planning a des points à résoudre.
- [ ] Planning introuvable : message clair + retour. Rechargement direct de l'URL : fonctionne.
- [ ] Aucune donnée modifiée (`statut`, `publieLe`, `updatedAt` inchangés après visite et impression) ; aucune dépendance ajoutée ; `npm run build` réussit.

## 11. Vérification

Parcours manuel (`npm run dev`, Chrome ou Edge — cibles principales ; contrôle complémentaire sous Firefox) :

1. **Préparer** : une équipe d'au moins 4 personnes dont deux de même initiale de prénom ; deux tournées dont une **coupée** et une non applicable le samedi ; cabinet fermé le dimanche. Générer un planning du 13/07 au 30/08 ; ajouter à la main une affectation un dimanche (jour fermé).
2. **Entrée** : sur `/planning`, cliquer « Imprimer le planning » → écran de diffusion de ce planning ; l'item « Planning » du menu reste en évidence.
3. **Aperçu** : vérifier en-tête, 2 mois côte à côte, jours du 13 au 31 puis du 1 au 30, sous-colonnes Matin/Soir, repères « MD »/« MR » pour les homonymes d'initiale, « — » le samedi pour la tournée non applicable, dimanches grisés, la ligne du dimanche avec affectation manuelle **montre** la personne, les autres dimanches affichent « Fermé ». Légende complète.
4. **Bandeau** : le planning ayant un conflit (jour fermé), le bandeau s'affiche ; « Revenir au planning » rouvre l'éditeur sur ce planning. Retirer l'affectation fautive, revenir : plus de bandeau.
5. **Mise à jour** : noter la date ; faire un ajustement manuel un autre jour (ou simuler en changeant l'horloge) : la date suit la dernière modification. Sur un planning migré sans `genereLe`, la date affichée est celle de sa dernière modification.
6. **Impression** : « Imprimer » → aperçu du navigateur : uniquement les feuilles, A4 portrait, couleurs présentes, une page par feuille. Basculer l'aperçu en « Noir et blanc » : repères lisibles. Choisir « Enregistrer au format PDF » : nom proposé « Idelia - Planning du 13-07-2026 au 30-08-2026 ». Annuler : rien n'a changé.
7. **Pagination** : planning de 5 mois avec 2 tournées dont 1 coupée → 2 pages (3 + 2 mois), chacune avec en-tête, légende et « Page n / 2 ».
8. **Cas limites** : URL avec id inconnu → message introuvable ; F5 sur une URL valide → rendu identique ; planning sans affectation → message « aucune affectation » et feuilles vides mais structurées ; personne archivée présente dans le planning → affichée « (archivée) » dans la légende.
9. **Non-régression** : l'éditeur (`/planning`) est inchangé hormis le nouveau bouton ; l'aperçu d'impression des autres écrans n'est pas dégradé.
10. **Données** : après visite + impression, l'export JSON (`0008`) du planning est identique (aucun champ modifié).
11. **Build** : `npm run build` réussit après chaque tâche.

## 12. Décisions à confirmer / risques

> **Validé par le porteur (2026-10-07) — prime sur le reste du plan en cas d'écart :**
> - **n°1** : publication (`statut`/`publieLe`) hors périmètre — OK.
> - **n°2** : « Mise à jour du » affiche la **date ET l'heure** locales (ex. « Mise à jour du 07/10/2026 à 14:32 »), toujours = la plus récente entre `genereLe` et `updatedAt`, repli `updatedAt`. Ajouter au besoin un formateur date + heure dans `dateUtil` (réutiliser `formatHorodatageDateFr` / `formatHeureFr`).
> - **n°3** : **A4 portrait** imposé — confirmé.
> - **n°4, n°7, n°9** : OK tels que rédigés.
> - **n°6 — modifié** : **pas de codes T1…Tn calculés**. L'en-tête de colonne affiche le **libellé réel de la tournée** (le cabinet les nomme déjà « T1 », « T2 »…), coupé proprement (ellipsis) s'il est trop long pour la colonne ; la légende donne le libellé complet + les horaires. Ordre des colonnes inchangé (alphabétique des libellés, comme l'éditeur).
> - **n°17** : option **(A) mois côte à côte** — confirmée.
> - **n°12, n°16** : arbitrés par `ui-ux` après implémentation.

1. **Statut `PUBLIE` / `publieLe` : hors périmètre de `0012` (recommandé).** Raisons : (a) le navigateur ne dit **pas** si l'impression a eu lieu (`afterprint` se déclenche aussi sur « Annuler ») — marquer « Diffusé » automatiquement serait mensonger ; (b) la sémantique après une modification ultérieure (redevenir brouillon ? « modifié depuis la diffusion » ?) n'est pas définie et relève de `0028` (historique, ADR préalable), qui a besoin de l'événement de publication **et** du snapshot d'affichage figé (02 §Intégrité n°2) ; (c) le besoin réel du papier — savoir quel tirage est le plus récent — est couvert par « Mise à jour du … ». Conséquences : la méta « Envoyé à l'équipe le … » de `ListePlanningsRecents` (`0013`) reste dormante ; la phrase de `0026` §3.1 « `0012` posera `publieLe` » devient caduque. **Alternative** si le porteur le souhaite : une petite feature dédiée « Marquer comme diffusé » (bouton explicite, éventuellement proposé après la fenêtre d'impression), à séquencer avec `0028`. **À confirmer.**
2. **« Mise à jour du » = date la plus récente entre `genereLe` et `updatedAt`, avec repli sur `updatedAt` (retenu, conforme à la validation `0026` §12 n°1).** Pour un planning sans `genereLe`, on affiche quand même `updatedAt` : contrairement au rétro-remplissage écarté par `0026` (qui aurait prétendu une date de *génération*), `updatedAt` est une date **réelle** de dernière modification — exactement ce que signifie « mise à jour » — et un tirage sans date perdrait sa raison d'être (identifier le tirage le plus récent). **Limites** : (a) **date seule**, donc deux tirages du même jour avant/après correction portent la même mention — ajouter l'heure (« Mise à jour du 15/06/2026 à 14:32 ») coûte une ligne ; (b) `updatedAt` ne bouge pas quand on renomme une personne/tournée ou change une couleur, alors que le tirage change. **À confirmer** : date seule (format papier actuel) ou date + heure.
3. **A4 portrait imposé par `@page` (retenu).** Le portrait offre la hauteur nécessaire aux 31 lignes d'un mois + en-tête + légende ; la largeur est gérée par la pagination (`moisParPage`). Effet de bord : Chrome/Edge **verrouillent** le choix d'orientation dans leur boîte de dialogue dès que `size` est fixé. Alternative : paysage (plus de mois par page, lignes plus serrées) ou ne pas fixer `size` (moins prévisible). La règle `@page` est globale : elle s'applique aussi à l'impression des autres écrans (sans inconvénient identifié). **À confirmer.**
4. **Lignes limitées aux jours de la période (retenu)** plutôt qu'une grille fixe 1→31 alignée d'un mois à l'autre : pas de lignes vides pour un planning court (une semaine = 7 lignes) ; chaque cellule de jour porte son numéro, donc pas d'ambiguïté. Alternative : lignes 1-31 alignées comme certains papiers (jours hors période grisés). **À confirmer.**
5. **Segments en sous-colonnes « Matin » / « Soir » (retenu)** plutôt que deux lignes empilées dans la case : une ligne par jour (hauteur constante, 31 lignes tiennent sur la page), en-têtes explicites, pas d'information portée par la seule position. **Écart avec l'éditeur** (deux groupes empilés dans la cellule, `CellulePlanning`) : acceptable car l'éditeur a besoin de place pour les boutons par vacation, le papier de compacité. **À confirmer.**
6. **Codes T1…Tn + légende (retenu)**, attribués dans l'ordre alphabétique des libellés (même ordre que l'éditeur), plutôt que le libellé complet en en-tête de colonne (trop large pour 4 mois de front). Les codes ne sont **pas** stockés : ajouter une tournée peut décaler les codes d'un tirage à l'autre. Alternatives : libellé court saisi par l'utilisateur (nouveau champ, migration) ou ordre par `ordreAffichage` (non éditable aujourd'hui). **À confirmer.**
7. **Repères de personnes calculés sur les seules personnes présentes dans le planning (retenu)** : repères les plus courts possibles ; contrepartie, le repère d'une même personne peut varier d'un tirage à l'autre (« M » puis « MD » si une homonyme d'initiale rejoint l'équipe). Alternative : calcul sur toute l'équipe active (repères plus stables, plus souvent à 2 lettres). **À confirmer.**
8. **Colonnes = tournées actives applicables sur la période ∪ tournées référencées (retenu)** : une tournée active jamais applicable sur la période (saisonnière hors dates) n'occupe pas de colonne inutile.
9. **Le tirage montre toute affectation, même sur un jour fermé (retenu, honnêteté)**, alors que la grille de l'éditeur vide les jours fermés (`GrillePlanning.celluleDescripteur`). Petite incohérence assumée : le papier ne doit rien cacher ; le bandeau signale le conflit `JOUR_FERME`. À rapprocher éventuellement côté éditeur (hors `0012`).
10. **Bandeau de points à résoudre non bloquant (retenu)** : réutilise `plannings/resumeConflits` (`0013`), lecture seule. Alternative plus stricte (confirmation avant impression) rejetée : friction pour un référent qui assume un planning imparfait.
11. **Dimanches mis en évidence dès `0012` (retenu, calcul local trivial)**, via `reperesDuJour`, point d'extension de `0023`. **À reprendre par `0023`** : ajouter `FERIE` / `VACANCES_SCOLAIRES` dans `reperesDuJour(date, sources)` (données passées par `construireDiffusion({ sourcesReperes })`), leurs styles (`mois-diffusion-ligne--repere-ferie`…) et entrées de légende, **et** la mise en évidence dans la grille de l'éditeur (non faite ici).
12. **Aperçu à l'échelle du tirage (9 pt ≈ 12 px à l'écran)** : fidèle mais petit pour un public peu à l'aise. Option : agrandir l'aperçu à l'écran par un facteur (`zoom`/`transform`) sans toucher au tirage — à arbitrer par `ui-ux`.
13. **Risque — nombreuses tournées** : au-delà d'environ 12 colonnes de segments, une seule page par mois et des colonnes étroites (`table-layout: fixed`) ; deux pastilles dans une même case peuvent passer sur deux lignes. Acceptable pour un cabinet (2-4 tournées). Les constantes `BUDGET_COLONNES_PAGE` / `MOIS_PAR_PAGE_MAX` sont ajustables.
14. **Duplication minime de la règle d'applicabilité** (`tourneeApplicableLe` vs `scheduling/modele/demande.js`) pour ne pas importer un fichier interne du moteur ni le modifier (ADR 0008, surface publique). Alternative : exposer la fonction dans `@/domain/scheduling/index.js` et faire consommer le domaine d'affichage par le moteur — refactor moteur écarté ici.
15. **Compatibilité impression** : `print-color-adjust` et `@page size` sont pris en charge par Chrome/Edge (cibles, cf. `0019`) et Firefox récents ; Safari partiellement (préfixe `-webkit-` posé). Vérifier sous Safari si le cabinet l'utilise.
16. **Deux boutons `btn-primary` sur `/planning`** (« Générer le planning » dans le formulaire, « Imprimer le planning » dans la barre d'actions) : écart possible au principe « une action principale par écran » ; justifié par le fait que, planning affiché, l'impression est l'étape suivante naturelle. Arbitrage `ui-ux` (alternative : `btn-outline-primary`).
17. **Dilemme de disposition : « mois en colonnes » (papier) vs liste continue (écran).** La grille de l'éditeur est désormais transposée (un jour par ligne, une tournée/personne par colonne, §6.1). Deux options pour le tirage :
    - **(A) Retenue — mois côte à côte**, chacun étant une grille « jours en lignes × tournées en colonnes » identique à l'écran. Avantages : fidèle au papier actuel du cabinet (repère connu de l'équipe, demandé par la roadmap) ; 2 à 4 mois par feuille, donc peu de pages. Inconvénient : la lecture « saute » d'un mois à l'autre horizontalement, ce que l'écran ne fait pas.
    - **(B) Liste continue** : une seule grille de tous les jours en lignes et tournées en colonnes, exactement comme l'écran, découpée en pages par hauteur (≈ 31 jours par feuille). Avantages : cohérence totale écran/papier, rendu plus simple (un seul tableau, `thead` répété par le navigateur, pas de `moisParPage`). Inconvénients : beaucoup de feuilles pour une longue période (≈ 1 par mois), ce qui s'éloigne du papier du cabinet.
    
    Le modèle de domaine (`construireDiffusion`) sert les deux options : seul le regroupement `pages` change (par mois et par budget de largeur en A, par tranches de jours en B). Le coût de bascule reste donc faible. **À confirmer par le porteur, idéalement après avoir montré l'aperçu à la testeuse.**
18. **Aucun écart d'ADR** : pas de backend ni de service distant (ADR 0002), aucune dépendance ajoutée (règle d'or n°12), moteur intact (ADR 0008), aucune persistance (ADR 0005), dates via `dateUtil` (ADR 0010). Aucun ADR nouveau requis.
