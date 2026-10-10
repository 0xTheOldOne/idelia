# Feature 0033 — Feuille de route (patients vus par plusieurs infirmières, depuis le PDF Vega)

- **Statut** : En cours
- **Dépend de** : `0001` (socle Vite/Vue/router), `0015` (menu latéral `MenuLateral.vue`). Aucune dépendance aux données du cabinet (personnes, tournées, plannings) : l'écran est **autonome**.
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (tout dans le navigateur, rien n'est envoyé), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (non concerné : **rien n'est persisté**), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (règles de lecture et de détection en modules purs), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, heures `"HH:mm"`), [0013](../docs/adr/0013-icones-phosphor.md) (icônes), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (Bootstrap), [0016](../docs/adr/0016-router-mode-hash-pour-pages.md) (route en mode hash), **[0019](../docs/adr/0019-lecture-pdf-pdfjs.md) — nouveau, créé par la tâche 1** (lecture PDF avec `pdfjs-dist`, chargé à la demande).

## 1. Contexte & objectif

Le cabinet exporte depuis son logiciel de facturation **Vega** une « **Liste des séances sur une période** » au format PDF. On veut repérer automatiquement les **patients soignés le matin par une infirmière et l'après-midi par une autre** (« relais »), pour vérifier la feuille de route sans relire des centaines de lignes à la main.

`0033` ajoute un écran **« Feuille de route »** : l'utilisateur dépose le PDF, Idelia le lit **dans le navigateur** (règle d'or n° 1), en extrait les séances et affiche la liste des relais, groupés par jour. **Rien n'est conservé** : ni le fichier, ni les noms de patients (données de santé) — l'état vit uniquement dans la vue, le temps de la consultation.

Règle validée à la main sur le fichier d'exemple (348 séances) : **un seul cas attendu** — jeu. 08/10/2026, patiente de test, Fin 01/06/27, FC 07:00 `BSB1+IFI1 (…` → LR 17:00 `IFI1 (DOM)`.

**Hors périmètre** : impression / export du résultat ; mémorisation d'une analyse ; rapprochement avec l'équipe ou les plannings d'Idelia (les codes PS de Vega ne sont pas reliés aux `Personne`) ; autres exports Vega.

## 2. Écrans concernés

**Nouvelle route** `/feuille-de-route` → `FeuilleDeRouteView.vue` ([architecture 07](../docs/architecture/07-navigation-et-ecrans.md)). Route **sœur** de `/planning`, **pas** `/planning/...` : `MenuLateral.estActif()` surlignerait sinon aussi « Planning ». Nouvel item de menu **« Feuille de route »** dans le groupe « Planning », **entre « Planning » et « Paramètres »**.

Expérience visée (personne peu à l'aise avec l'informatique) — l'écran a **quatre états** :

1. **Attente** (arrivée sur l'écran)
   - Titre « Feuille de route ».
   - Phrase d'aide : « Repérez les patients vus plusieurs fois dans la journée par des infirmières différentes, avec le montant à répartir. Déposez la *Liste des séances sur une période* exportée de Vega. »
   - Phrase rassurante (icône bouclier) : « Le fichier est lu uniquement sur cet ordinateur : il n'est envoyé nulle part et rien n'est conservé. »
   - Une **grande zone de dépôt** (bordure en pointillés, icône PDF) : « Glissez le fichier PDF ici », « ou », bouton principal **« Choisir un fichier PDF »**. Pendant le survol avec un fichier : zone mise en évidence (bordure + fond + texte « Relâchez pour lancer la lecture »), jamais par la seule couleur.
2. **Analyse** : zone neutralisée, indicateur (spinner Bootstrap) + « Lecture du fichier « Listedesseances….pdf »… » annoncé aux lecteurs d'écran.
3. **Résultat**
   - Résumé : « 348 séances lues du jeudi 08/10/2026 au mercredi 14/10/2026 — 1 patient vu par plusieurs infirmières. » (singulier/pluriel gérés ; voir §12 n° 2).
   - S'il y a des cas : la liste, **groupée par jour** (titre « Jeudi 08/10/2026 »), une carte par cas : **nom du patient**, « Fin le 01/06/2027 », puis un bloc par passage (Matin / Soir, ou Matin / Midi / Soir) avec infirmière, heure, cotation et montant, puis le total, la part par passage et la répartition « À verser ».
   - S'il n'y en a aucun : encart `alert-info` + `PhInfo` « Aucun patient vu par plusieurs infirmières sur cette période. »
   - Rappel discret : « Rien n'est enregistré : ce résultat disparaît quand vous quittez cette page. »
   - À droite du titre : bouton **« Analyser un autre fichier »** → retour à l'état Attente (focus remis sur « Choisir un fichier PDF »).
4. **Erreur** : encart `alert-danger` `role="alert"`, message sans jargon **qui dit quoi faire** (§7) ; la zone de dépôt reste affichée dessous pour réessayer directement.

Un fichier lâché **à côté** de la zone ne doit **pas** faire ouvrir le PDF par le navigateur (l'utilisateur « perdrait » Idelia) : la vue neutralise le comportement par défaut du glisser-déposer sur la fenêtre tant qu'elle est affichée.

## 3. Modèle de données touché

**Aucune entité persistée, aucun impact sur `schemaVersion` ni sur les migrations, aucun changement de `schema.js`.** Les structures ci-dessous sont **volatiles** (JSDoc `@typedef`, en mémoire dans la vue uniquement).

```js
/**
 * @typedef {Object} GlyphePdf          // produit par l'adaptateur pdf.js (tâche 1), consommé par extraireSeances
 * @property {number} page              // n° de page, à partir de 1
 * @property {number} x                 // abscisse de début (transform[4]), en points PDF
 * @property {number} y                 // ordonnée (transform[5]) — origine en bas de page
 * @property {number} largeur           // largeur du fragment (item.width), 0 si inconnue
 * @property {string} str               // texte du fragment (1 ou plusieurs caractères, jamais vide)
 *
 * @typedef {Object} Seance
 * @property {string} date              // "YYYY-MM-DD" (ligne de jour précédente)
 * @property {string} ps                // code de l'infirmière dans Vega (FC, LR, CB, EMM…)
 * @property {string} heure             // "HH:mm"
 * @property {string} patient           // colonne « Bénéficiaire », espaces normalisés
 * @property {string} cotation          // colonne « Cotation », telle qu'imprimée
 * @property {(number|null)} montantCentimes // colonne « Montant » en centimes (20,95 → 2095), null si illisible
 * @property {(string|null)} fin        // "YYYY-MM-DD" (Fin dd/mm/yy → 20yy-mm-dd), null si absente/illisible
 *
 * @typedef {Object} ResultatExtraction
 * @property {({debut: string, fin: string}|null)} periode   // 1re et dernière date de jour lues, null si aucune
 * @property {Seance[]} seances
 *
 * @typedef {Object} CasRelais
 * @property {string} id                // GUID (genId) — sert de :key, jamais d'identifiant composite lisible
 * @property {string} date
 * @property {string} patient
 * @property {(string|null)} fin
 * @property {{ps: string, heure: string, cotation: string, montantCentimes: (number|null)}[]} passages  // triés par heure
 * @property {number} nbPassages
 * @property {(number|null)} totalCentimes          // null si montantIncomplet
 * @property {(number|null)} partParPassageCentimes
 * @property {{ps: string, nbPassages: number, montantCentimes: number}[]} parts  // somme = total
 * @property {boolean} montantIncomplet
 */
```

## 4. Store (Vuex)

**Aucun.** Ni module, ni getter, ni action, ni accès à `storageRepository` (décision validée : rien n'est conservé). L'état (étape de l'écran, nom du fichier, résumé, cas, message d'erreur) est dans le `data()` de `FeuilleDeRouteView` et disparaît au démontage. Pas de toast (`notifications`) : le retour est affiché dans l'écran lui-même.

## 5. Domaine (logique pure)

Nouveau dossier **`src/domain/feuilleDeRoute/`**. En-tête de module sur le modèle de `src/domain/absences.js` (« Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008) »), JSDoc complète, exports nommés.

> **Imports relatifs obligatoires** dans ce dossier (`../utils/id.js`, `./extraireSeances.js`…), **pas** l'alias `@/` : le script de vérification Node (§11) doit pouvoir charger ces modules sans Vite. Précédent : `src/domain/scheduling/` importe déjà en relatif.

### 5.1 `extraireSeances.js`

`export function extraireSeances(glyphes)` : `GlyphePdf[]` → `ResultatExtraction`. Étapes (fonctions internes nommées, documentées) :

1. **Regroupement en lignes** : par page puis par `y` (tolérance `TOLERANCE_LIGNE` = 1,5 pt) ; pages dans l'ordre, lignes de haut en bas (`y` décroissant), fragments triés par `x`. pdf.js fournit des fragments déjà **fusionnés** (mot ou cellule entière) : pas d'éclatement en caractères ; les fragments blancs (séparateurs de colonnes) sont ignorés.
2. **Texte d'une ligne / d'une cellule** : fragments joints par un espace, espaces multiples réduits, `trim`.
3. **Colonnes** : sur chaque page, la ligne d'**en-tête** est reconnue par son contenu normalisé (minuscules, sans accents via `normalize('NFD')`) contenant au moins `ps`, `heure`, `beneficiaire`, `cotation`, `montant`, `fin`. Les colonnes construites viennent d'une **liste blanche** de toutes les colonnes connues (`ps, heure, beneficiaire, cotation, montant, actes, nuit, dim, if, km, ik, de, facture, fin`) : le texte du PDF ne crée jamais de colonne, et Cotation s'arrête avant Montant. Chaque fragment de l'en-tête donne un **début de colonne** (son `x`). Repères mesurés sur le fichier d'exemple : PS 31.00, Heure 56.60, Bénéficiaire 87.80, Cotation 187.00, Montant 252.20, Actes 291.80, Nuit 323.00, Dim 351.40, IF 379.80, Km 408.00, IK 436.40, DE 464.80, Facture 493.20, Fin 532.80. Un fragment va dans la **dernière colonne dont le début − `TOLERANCE_COLONNE` ≤ x** (constante exportée, valeur initiale 2 pt, **à caler** pour que les montants alignés à droite ne débordent pas dans « Cotation »). Une page sans en-tête réutilise les colonnes de la page précédente ; sans aucun en-tête, aucune séance n'est lue.
4. **Lignes ignorées** : en-tête, pieds de page (texte commençant par `Vega5` ou contenant `Imprimé le`), totaux (`/séances pour un total de/i`) et toute ligne ne correspondant ni à un jour ni à une séance.
5. **Ligne de jour** (sur le texte complet de la ligne) : `/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)\s+(\d{2})\/(\d{2})\/(\d{4})$/` → date courante `"YYYY-MM-DD"`. Le jour **se poursuit d'une page à l'autre** tant qu'une nouvelle ligne de jour n'apparaît pas.
6. **Ligne de séance** : cellule PS conforme à `/^[A-Z0-9]{2,4}$/` (FC, LR, CB, **EMM**…) **et** cellule Heure conforme à `/^\d{1,2}:\d{2}$/` (complétée à `"HH:mm"`). Une séance rencontrée avant toute ligne de jour est ignorée. `patient` = cellule Bénéficiaire, `cotation` = cellule Cotation, `montantCentimes` = cellule Montant (`/^d{1,6},d{2}$/`, espaces retirés, ex. `20,95` → 2095 ; sinon `null`), `fin` = cellule Fin `dd/mm/yy` → `20yy-mm-dd` (`null` si vide ou non conforme).
7. **Période** : première et dernière date de jour rencontrées (comparaison de chaînes, ADR 0010), `null` s'il n'y en a aucune.

Aucun objet `Date` (simple découpage de chaînes). Constantes exportées pour le calage : `TOLERANCE_COLONNE`, `TOLERANCE_LIGNE`.

### 5.2 `detecterRelais.js`

- `export function detecterRelais(seances)` : `Seance[]` → `CasRelais[]`.
  - Groupes par **même date + même patient + même Fin** (patient en majuscules, espaces normalisés ; Fin `null` = une valeur comme une autre).
  - Un groupe n'est gardé que s'il contient au moins une séance dont la cotation commence par `BSA`/`BSB`/`BSC` + chiffre **et** au moins **2 codes PS distincts** parmi ses passages.
  - `passages` = toutes les séances du groupe triées par heure ; `N` = leur nombre (2 = matin + soir ; 3 = matin + midi + soir).
  - `totalCentimes` = somme des `montantCentimes` ; si l'un est `null` : `montantIncomplet = true`, `totalCentimes = null`, pas de répartition.
  - Répartition : part d'une infirmière = total × (ses passages) / N arrondi au centime ; la **dernière** (ordre de première apparition) reçoit `total − somme des autres` (somme exacte). `partParPassageCentimes = Math.round(total / N)`. Tout en centimes entiers.
  - `id` = `genId()` (GUID). Tri : date, heure du 1er passage, patient (`localeCompare(…, 'fr')`).
- `export function libelleMoment(index, nbPassages)` : N=2 → « Matin », « Soir » ; N=3 → « Matin », « Midi », « Soir » ; sinon « Passage 1 », « Passage 2 »…
- `export function grouperCasParDate(cas)` : `CasRelais[]` → `Array<{ date: string, cas: CasRelais[] }>` dans l'ordre chronologique.
- Formatage monétaire : `formaterEuros(centimes)` dans `src/domain/utils/montants.js`.

### 5.3 Réutilisé (non modifié)

- `src/domain/utils/id.js` — `genId()`.
- `src/domain/utils/dates.js` — `dateUtil.formatDateFr`, `dateUtil.weekdayISO` (affichage, côté composants).
- `src/domain/libelles.js` — `libelleJour` (titres de jour « Jeudi 08/10/2026 », résumé).

### 5.4 Adaptateur pdf.js — **hors domaine** : `src/adaptateurs/lireGlyphesPdf.js`

Emplacement **choisi** : nouveau dossier `src/adaptateurs/` (adaptateurs d'entrée/sortie du navigateur vers des bibliothèques tierces). Justification :
- **pas `src/domain/`** : lecture de `File`, `Worker`, bibliothèque tierce, asynchrone — tout ce que l'ADR 0008 exclut d'un module pur ;
- **pas `src/storage/`** : ce dossier signifie « persistance » (ADR 0005) ; y ranger un lecteur de fichier laisserait croire que quelque chose est conservé ;
- **pas dans le composant** : garder `pdfjs-dist` derrière une seule fonction rend la dépendance remplaçable (ADR 0019) et la vue simple ;
- le nom `src/lecture/` est écarté (ambigu avec la « vue lecture » de la diffusion, ADR 0009).

API (exports nommés, JSDoc) :

- `export const TAILLE_MAX_PDF_OCTETS = 20 * 1024 * 1024;` (§12 n° 4)
- `export function estFichierPdf(fichier)` → `true` si `fichier.type === 'application/pdf'` **ou** nom se terminant par `.pdf` (insensible à la casse ; Windows fournit parfois un type vide).
- `export async function lireGlyphesPdf(fichier)` → `Promise<GlyphePdf[]>` :
  - `const pdfjs = await import('pdfjs-dist');` — **chargement paresseux** (chunk séparé, rien dans le bundle principal) ;
  - worker : `import urlWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';` (import statique d'une **URL**, le fichier n'est chargé qu'à l'usage ; compatible `base: '/idelia/'`), puis `pdfjs.GlobalWorkerOptions.workerSrc = urlWorker` ;
  - `getDocument({ data, isEvalSupported: false, enableXfa: false, stopAtErrors: true, disableAutoFetch: true, disableStream: true, cMapUrl/standardFontDataUrl/wasmUrl: null })` (durcissement) → **aucune requête réseau** ;
  - pour chaque page : `getTextContent()` → pour chaque item de `str` non vide : `{ page, x: transform[4], y: transform[5], largeur: width ?? 0, str }` ;
  - `finally` : `loadingTask.destroy()` (libère worker et mémoire) ;
  - erreurs : rejette une `Error` portant un `code` — `'LECTEUR_INDISPONIBLE'` (échec du `import()` dynamique : hors ligne, application mise à jour entre-temps) `'PDF_TROP_COMPLEXE'` (plus de 200 pages ou 200 000 fragments : constantes `NB_PAGES_MAX`, `NB_FRAGMENTS_MAX`) ou `'PDF_ILLISIBLE'` (toute autre erreur pdf.js : fichier abîmé, protégé par mot de passe…). Jamais de message technique remonté tel quel à l'écran.
- **Aucun `console.log`** du contenu lu (noms de patients).

## 6. Composants

### 6.1 `src/views/FeuilleDeRouteView.vue` (créer) — conteneur

- `data()` : `etape` (`'ATTENTE' | 'ANALYSE' | 'RESULTAT' | 'ERREUR'`, constantes locales à la vue — état d'UI, pas du domaine), `nomFichier`, `nbSeances`, `periode`, `cas` (`CasRelais[]`), `codeErreur`. **Ne conserve ni le `File`, ni les glyphes, ni les séances** une fois l'analyse terminée (on ne garde que ce qui est affiché).
- `analyser(fichiers)` (handler de `fichiers-choisis`) :
  1. plus d'un fichier → erreur `PLUSIEURS_FICHIERS` ;
  2. `!estFichierPdf` → `PAS_PDF` ; taille > `TAILLE_MAX_PDF_OCTETS` → `TROP_VOLUMINEUX` ;
  3. `etape = 'ANALYSE'` ; `lireGlyphesPdf` (toute la chaîne lecture → extraction → détection dans un seul `try/catch` : `codeErreur = err.code ?? 'PDF_ILLISIBLE'`) ;
  4. `extraireSeances(glyphes)` ; 0 séance → `AUCUNE_SEANCE` ;
  5. `detecterRelais(seances)` → `etape = 'RESULTAT'` ; focus déplacé sur le résumé (`tabindex="-1"`).
- `recommencer()` (« Analyser un autre fichier ») : remet tout le `data()` à zéro, `$nextTick` → focus sur le bouton de la zone (méthode exposée `focaliser()` de `ZoneDepotFichier`, via `ref`).
- Résumé : computed construisant la phrase avec `libelleJour(dateUtil.weekdayISO(d)).toLowerCase()` + `dateUtil.formatDateFr(d)` (présentation uniquement, comme `AbsencesView.periodeTexte`).
- Messages d'erreur : table locale `code → texte` (§7).
- `mounted` / `beforeUnmount` : écouteurs `dragover` et `drop` sur `window` qui font seulement `preventDefault()` (empêche l'ouverture du PDF hors zone) ; **retirés** au démontage.
- En-tête sur le modèle de `src/views/AbsencesView.vue` (`.feuille-de-route-entete` : flex, `justify-content: space-between`, `flex-wrap`) : `<h1>Feuille de route</h1>` à gauche, bouton « Analyser un autre fichier » (`btn btn-primary`, `PhArrowCounterClockwise` + libellé) **à droite**, affiché seulement en étape `RESULTAT`.
- Annonces : conteneur `role="status" aria-live="polite"` pour « Lecture du fichier… » puis le résumé ; erreurs en `alert alert-danger` `role="alert"` + `PhWarning` ; état vide en `alert alert-info` + `PhInfo` (motif existant).
- Style `scoped`, `@use '@/styles/tokens' as t;`, tokens uniquement, `.btn { min-height: t.$cible-cliquable-min; }` comme ailleurs.

### 6.2 `src/components/feuilleDeRoute/ZoneDepotFichier.vue` (créer) — présentationnel, générique

- Props : `desactivee` (Boolean, défaut `false`), `accept` (String, défaut `'.pdf,application/pdf'`), `libelleBouton` (String, défaut `'Choisir un fichier PDF'`).
- Émet `fichiers-choisis` (`File[]`), que le fichier vienne du dépôt ou du sélecteur.
- Bouton visible + `<input type="file" class="d-none">` déclenché par `$refs.input.click()` — **motif de `src/components/parametres/BlocSauvegarde.vue`** : `event.target.value = ''` après lecture (re-choix du même fichier possible), focus rendu au bouton.
- Glisser-déposer : `@dragenter.prevent` / `@dragover.prevent` / `@dragleave` / `@drop.prevent` ; état local `survolee` (classe de mise en évidence + texte « Relâchez pour lancer la lecture »). Gestion du `dragleave` vers un élément enfant (compteur d'entrées ou test de `relatedTarget`) pour éviter le clignotement.
- Accessibilité : la zone elle-même n'est **pas** focusable (un seul arrêt clavier : le bouton) ; icône `PhFilePdf` `aria-hidden="true"` ; `desactivee` → bouton `disabled` et dépôt ignoré.
- Méthode publique `focaliser()` (focus du bouton).

### 6.3 `src/components/feuilleDeRoute/ListeRelais.vue` (créer) — présentationnel

- Prop : `cas` (Array, requis). Groupement via `grouperCasParDate` (domaine).
- Par jour : `<section>` + `<h2>` « Jeudi 08/10/2026 » (`libelleJour` + `formatDateFr`) ; `<ul>` de cartes (`:key="c.id"`).
- Carte : patient en gras ; « Fin le 01/06/2027 » (masqué si `fin` est `null`) ; un bloc `.liste-relais__moment` par passage : titre de moment écrit (`libelleMoment`) avec icône `PhSun` (matin), `PhSunDim` (midi), `PhMoon` (soir), « Infirmière : FC », « à 07:00 — BSB1+IFI1 (… », « Montant : 20,95 € » ; flèche `PhArrowRight` `aria-hidden` entre les passages (retour à la ligne propre à 3 passages, empilés en mobile). Puis récapitulatif : « Total 23,70 € ÷ 2 passages = 11,85 € par passage » et « À verser : FC 11,85 € · LR 11,85 € » (nombre de passages ajouté si > 1). Si `montantIncomplet` : « Montant illisible pour au moins un passage : répartition impossible. » Formatage via `formaterEuros` (`src/domain/utils/montants.js`, `Intl.NumberFormat('fr-FR')`). Les mots de moment sont **écrits** (jamais la seule icône).
- Texte rendu par interpolation `{{ }}` uniquement — **jamais `v-html`** (contenu issu d'un fichier externe).

### 6.4 Modifiés

- `src/router/index.js` — `{ path: '/feuille-de-route', name: 'feuille-de-route', component: FeuilleDeRouteView }` (import statique comme les autres vues ; pdf.js est déjà paresseux dans l'adaptateur) ; JSDoc d'en-tête complétée.
- `src/components/communs/MenuLateral.vue` — item `{ nom: 'feuille-de-route', chemin: '/feuille-de-route', libelle: 'Feuille de route', icone: 'PhPath' }` entre `planning` et `parametres` ; `PhPath` importée **et** enregistrée dans `components`.

### 6.5 Réutilisé

Motif d'en-tête de `AbsencesView.vue`, motif d'input fichier de `BlocSauvegarde.vue`, encarts Bootstrap `alert-info` / `alert-danger`, `spinner-border`, tokens `_tokens.scss` (aucun nouveau token).

## 7. Règles de validation

Pas de formulaire → pas de Vuelidate. Contrôles sur le fichier, avec messages (texte exact, ton calme, solution indiquée) :

| Code | Cas | Message |
|---|---|---|
| `PLUSIEURS_FICHIERS` | plusieurs fichiers déposés | « Déposez un seul fichier à la fois. » |
| `PAS_PDF` | extension/type non PDF | « Ce fichier n'est pas un PDF. Déposez la « Liste des séances sur une période » exportée de Vega (son nom se termine par .pdf). » |
| `TROP_VOLUMINEUX` | > 20 Mo | « Ce fichier est trop volumineux pour être lu ici (plus de 20 Mo). Exportez depuis Vega une période plus courte, puis réessayez. » |
| `PDF_ILLISIBLE` | erreur pdf.js | « Ce fichier PDF n'a pas pu être lu : il est peut-être abîmé ou protégé par un mot de passe. Refaites l'export depuis Vega, puis réessayez. » |
| `AUCUNE_SEANCE` | 0 séance reconnue | « Aucune séance n'a été trouvée dans ce fichier. Vérifiez qu'il s'agit bien de la « Liste des séances sur une période » exportée de Vega. » |
| `LECTEUR_INDISPONIBLE` | échec du chargement de pdf.js | « La lecture des PDF n'a pas pu démarrer. Vérifiez votre connexion internet, rechargez la page, puis réessayez. » |
| `PDF_TROP_COMPLEXE` | plus de 200 pages ou 200 000 fragments | « Ce fichier est trop long ou trop complexe pour être lu ici. Exportez depuis Vega une période plus courte, puis réessayez. » |

## 8. Points d'attention ergonomie

- **Une seule action** à chaque étape : déposer/choisir (Attente, Erreur), lire le résultat puis « Analyser un autre fichier » (Résultat).
- **Vocabulaire du cabinet** : « patient », « infirmière », « matin », « après-midi », « Fin » (repris de Vega) ; jamais « parser », « glyphe », « extraction », « worker ».
- **Confiance et confidentialité** : dire clairement que rien ne quitte l'ordinateur et que rien n'est conservé ; rappeler que le résultat disparaît en quittant la page (honnêteté, pas de surprise).
- **Feedback immédiat** : survol mis en évidence, indicateur pendant la lecture, résumé chiffré systématique (même sans cas : « 348 séances lues… » prouve que le fichier a bien été compris).
- **Tolérance à l'erreur** : dépôt hors zone sans effet ; erreur → on réessaie sur place, sans recharger.
- **Accessibilité** : bouton réel atteignable au clavier, focus visible, focus déplacé sur le résumé à l'arrivée du résultat et rendu au bouton après « Analyser un autre fichier » ; `aria-live` pour la progression et le résumé ; titres `h1` → `h2` (jours) ; icônes `aria-hidden` toujours doublées d'un texte ; cibles ≥ `$cible-cliquable-min`.
- **Préférences d'en-tête** : bouton d'action **à droite du titre** ; s'il apparaissait plus tard des actions secondaires (ex. imprimer), les mettre en **icône seule + infobulle** à côté.

## 9. Étapes d'implémentation

**4 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre : **T1 → T2 → T3 → T4** (T2 a besoin de `pdfjs-dist` installé pour sa vérification ; T3 consomme T1 et T2 ; T4 rend l'écran accessible).

### Tâche 1 — ADR 0019, dépendance `pdfjs-dist` et adaptateur de lecture PDF

**Fichiers** :
- `docs/adr/0019-lecture-pdf-pdfjs.md` (**créer**, gabarit `docs/adr/0000-modele-adr.md`, statut **Accepté**, date 2026-10-09, décideur : porteur du produit) — Contexte : lire un export Vega PDF sans backend. Décision : `pdfjs-dist` en **version exacte**, chargé **à la demande** (`import()` dynamique) avec worker via `?url`, **extraction de texte seulement** (aucun rendu), `isEvalSupported: false`, aucune ressource distante, isolé derrière `src/adaptateurs/lireGlyphesPdf.js`, aucune donnée conservée. Conséquences : chunk et worker séparés (bundle principal inchangé), dépendance à maintenir (alertes de sécurité pdf.js), premier usage nécessite le réseau pour charger le chunk. Alternatives écartées : lecture PDF « à la main » (flux compressés, encodages de polices → fragile), OCR (inutile, texte réel), traitement côté serveur (ADR 0002), export CSV depuis Vega (non disponible à ce jour — à réévaluer). Liens : ADR 0002, 0005, 0008, feature 0033.
- `package.json` / `package-lock.json` (**modifier**) — `npm view pdfjs-dist time --json`, retenir la **dernière version publiée avant le 2026-09-25** (≥ 2 semaines), puis `npm install pdfjs-dist@<version> --save-exact` (pas de `^`, contrairement aux autres dépendances : justifié dans l'ADR — bibliothèque qui lit des fichiers externes, montée de version volontaire et contrôlée).
- `src/adaptateurs/lireGlyphesPdf.js` (**créer**) — §5.4 (`TAILLE_MAX_PDF_OCTETS`, `estFichierPdf`, `lireGlyphesPdf`) ; typedef `GlyphePdf` référencé par `@typedef {import('../domain/feuilleDeRoute/extraireSeances.js').GlyphePdf}` une fois T2 livrée, ou défini ici en attendant puis déplacé par T2.
- `.gitignore` (**modifier**) — ajouter `files/` (exports Vega contenant des **données réelles de patients**, jamais versionnés).

**Critères de sortie** :
- `package.json` contient `"pdfjs-dist": "<x.y.z>"` exact, version publiée depuis plus de 2 semaines.
- `npm run build` réussit ; `dist/assets/` contient un **chunk pdf.js séparé** et le fichier `pdf.worker.min-*.mjs` ; la taille du chunk d'entrée n'augmente pas sensiblement (comparer avant/après).
- `git status` ne montre plus `files/`.
- L'ADR 0019 suit le gabarit et est cohérent avec ADR 0002/0005/0008.

### Tâche 2 — Modules purs `extraireSeances.js` et `detecterRelais.js`

**Fichiers** :
- `src/domain/feuilleDeRoute/extraireSeances.js` (**créer**) — §5.1 + typedefs `GlyphePdf`, `Seance`, `ResultatExtraction` (si `GlyphePdf` a été défini dans l'adaptateur en T1, l'y remplacer par une référence).
- `src/domain/feuilleDeRoute/detecterRelais.js` (**créer**) — §5.2 + typedef `CasRelais`.

**Dépend de** : T1 (pour la vérification uniquement).

**Critères de sortie** (script jetable, §11 étape 1 — **hors dépôt**) :
- **348 séances** extraites du fichier d'exemple ; codes PS distincts = **{ FC, EMM, CB, LR }** ; période du **2026-10-08** au **2026-10-14** (à confirmer par le script : dates de jour présentes dans le fichier).
- Aucune cotation polluée par la colonne Montant (afficher 10 séances au hasard : cellules propres) ; toutes les `fin` au format `YYYY-MM-DD` ou `null`.
- `detecterRelais` → **exactement 1 cas** : date `2026-10-08`, patient `patiente de test`, fin `2027-06-01`, matin `FC` `07:00` cotation commençant par `BSB1+IFI1`, après-midi `LR` `17:00` `IFI1 (DOM)` ; `id` au format GUID.
- Cas construits à la main dans le script : 3 passages FC/FC/LR (20,95 + 2,75 + 2,75) → total 2645, parts FC 1763 / LR 882 ; même PS partout → aucun cas ; aucun BSx → aucun cas ; Fin différente → groupes séparés ; un montant illisible → `montantIncomplet`.
- Aucun import Vue/Vuex/`@/` dans `src/domain/feuilleDeRoute/` ; `npm run build` réussit.

### Tâche 3 — Écran `FeuilleDeRouteView` et composants

**Fichiers** :
- `src/views/FeuilleDeRouteView.vue` (**créer**) — §6.1.
- `src/components/feuilleDeRoute/ZoneDepotFichier.vue` (**créer**) — §6.2.
- `src/components/feuilleDeRoute/ListeRelais.vue` (**créer**) — §6.3.

**Dépend de** : T1, T2.

**Critères de sortie** : la vue est vérifiable en l'ajoutant **temporairement** au routeur en local (ou en enchaînant directement T4) — parcours §11 étapes 3 à 8 ; `npm run build` réussit ; aucune logique de lecture/détection dans les `.vue` (uniquement appels à l'adaptateur et au domaine).

### Tâche 4 — Route, menu et documentation

**Fichiers** :
- `src/router/index.js` (**modifier**) — §6.4.
- `src/components/communs/MenuLateral.vue` (**modifier**) — §6.4.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) — ligne dans la carte des écrans, après `/planning/:id/diffusion` : `| /feuille-de-route | **Feuille de route** | Repérer, depuis la liste des séances exportée de Vega (PDF), les patients soignés le matin et l'après-midi par deux infirmières différentes — lu sur le poste, rien n'est conservé | 0033 |`.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — arborescence : `src/adaptateurs/` (`lireGlyphesPdf.js # lecture PDF via pdfjs-dist, chargé à la demande [ADR 0019, 0033]`), `src/domain/feuilleDeRoute/` (`extraireSeances.js`, `detecterRelais.js`), `views/FeuilleDeRouteView.vue`, `components/feuilleDeRoute/` ; une phrase sur le rôle de `adaptateurs/` (I/O navigateur + bibliothèques tierces, jamais de persistance).

**Dépend de** : T3.

**Critères de sortie** : item « Feuille de route » visible entre « Planning » et « Paramètres », déplié et replié (infobulle) ; actif **seul** sur `#/feuille-de-route` (« Planning » non surligné) ; rechargement direct de `#/feuille-de-route` fonctionnel ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] Le menu affiche « Feuille de route » entre « Planning » et « Paramètres » ; sur cet écran, seul cet item est mis en évidence.
- [ ] En glissant `files/Listedesseancessuruneperiode.pdf` sur la zone, l'écran affiche « 348 séances lues du jeudi 08/10/2026 au … — 1 patient vu par plusieurs infirmières. » puis, sous « Jeudi 08/10/2026 », la carte **patiente de test** · Fin le 01/06/2027 · Matin FC 07:00 BSB1+IFI1 (… 20,95 € → Soir LR 17:00 IFI1 (DOM) 2,75 €, « Total 23,70 € ÷ 2 passages = 11,85 € par passage », « À verser : FC 11,85 € · LR 11,85 € ».
- [ ] Même résultat en passant par le bouton « Choisir un fichier PDF », à la souris **et** au clavier (Tab + Entrée).
- [ ] Choisir deux fois de suite le même fichier relance bien la lecture.
- [ ] Pendant la lecture, « Lecture du fichier… » est affiché et la zone ne réagit pas.
- [ ] Un fichier `.json` (ou toute autre extension) affiche le message « Ce fichier n'est pas un PDF… » ; un PDF quelconque (sans séances Vega) affiche « Aucune séance n'a été trouvée… » ; un PDF abîmé (fichier texte renommé en `.pdf`) affiche « Ce fichier PDF n'a pas pu être lu… ». Dans tous les cas, on peut réessayer immédiatement.
- [ ] Déposer deux fichiers à la fois affiche « Déposez un seul fichier à la fois. »
- [ ] Lâcher le PDF **à côté** de la zone n'ouvre pas le PDF dans l'onglet.
- [ ] « Analyser un autre fichier » ramène à l'écran de départ, focus sur « Choisir un fichier PDF ».
- [ ] Un fichier sans relais affiche l'encart « Aucun patient vu par plusieurs infirmières sur cette période. »
- [ ] Après une analyse, `localStorage` (DevTools > Application) ne contient **rien de nouveau** et la sauvegarde exportée ne contient aucun nom de patient.
- [ ] Onglet Réseau : aucune requête vers un autre domaine ; seuls le chunk pdf.js et son worker (même origine) sont chargés, **au premier dépôt** et pas à l'ouverture de l'application.
- [ ] Quitter l'écran puis y revenir : écran de départ (rien n'est conservé).
- [ ] `npm run build` réussit ; `files/` n'apparaît pas dans `git status`.

## 11. Vérification

1. **Script jetable (T2)** — dans le dossier temporaire de session (**jamais dans le dépôt**), un script Node `.mjs` qui :
   - importe `pdfjs-dist/legacy/build/pdf.mjs` **par chemin absolu** vers `node_modules` du projet (via `pathToFileURL`) ;
   - lit le PDF passé en argument (`fs.readFile` → `Uint8Array`), reproduit le mapping de l'adaptateur (`{ page, x: transform[4], y: transform[5], largeur: width, str }`) ;
   - importe par chemin absolu `src/domain/feuilleDeRoute/extraireSeances.js` et `detecterRelais.js` ;
   - affiche : nombre de séances, codes PS distincts, période, 10 séances échantillons, la liste des cas ; puis exécute les mini-cas construits à la main (§9 T2).
   - Le supprimer une fois la vérification faite ; ne jamais coller ses sorties (noms de patients) dans un commit, une PR ou un fichier du dépôt.
2. `npm run build` — chunk pdf.js séparé, worker émis dans `dist/assets/`.
3. `npm run dev` → `#/feuille-de-route` : glisser le PDF d'exemple → cas de test affiché.
4. Même chose via le bouton, puis au clavier uniquement.
5. Cas d'erreur : `.json`, PDF quelconque, faux PDF, deux fichiers, dépôt hors zone (§10).
6. « Analyser un autre fichier » → état initial, focus correct ; naviguer vers « Planning » puis revenir → état initial.
7. DevTools > Application : rien de nouveau dans `localStorage` ; DevTools > Réseau : pas de requête externe, chunk pdf.js chargé seulement au premier dépôt.
8. Lecteur d'écran (NVDA/Narrateur) : annonce de « Lecture du fichier… », du résumé, des erreurs.
9. `npm run preview` (base `/idelia/`) : le worker se charge bien depuis `/idelia/assets/…` (pas de 404).
10. Relecture `ui-ux`, puis audit `security` (points à examiner : `isEvalSupported: false`, absence de `v-html`, aucune journalisation de données patients, limite de taille, version exacte de `pdfjs-dist` sans vulnérabilité connue).

## 12. Décisions à confirmer / risques

1. **Place dans la roadmap** : ligne ajoutée à la section « Retours de tests avec le cabinet » (besoin exprimé par le cabinet), faute de section « outils annexes ». À déplacer si le porteur préfère une section dédiée.
2. **Comptage du résumé** : « N patient(s) vu(s) par plusieurs infirmières » compte des **cas** (un par patient **et par jour**). Le libellé de période utilise le jour en toutes lettres (« du jeudi 08/10/2026 au mercredi 14/10/2026 ») avec les helpers existants.
3. **Un cas par groupe** (date + patient + Fin) : au moins un soin BSA/BSB/BSC et au moins deux codes PS distincts parmi **tous** les passages du groupe (2 passages = matin + soir ; 3 = matin + midi + soir). Plus de coupure à 14:00 : seule la position des passages (triés par heure) donne le libellé du moment.
4. **Limite de 20 Mo** (proposée) : protège le navigateur d'un fichier démesuré ; un export Vega d'une semaine pèse bien moins. Ajustable via `TAILLE_MAX_PDF_OCTETS`.
5. **Compatibilité navigateur** : la build « moderne » de `pdfjs-dist` vise des navigateurs récents (Chrome/Edge à jour, poste type du cabinet). Si un poste ancien échoue, basculer l'adaptateur sur `pdfjs-dist/legacy/build/pdf.mjs` (une ligne) — à noter dans l'ADR 0019.
6. **Build Vite** : si `pdfjs-dist` impose une cible plus récente (ex. `await` de premier niveau) et que `npm run build` échoue, ajuster `build.target` dans `vite.config.js` — modification de configuration à **signaler** au porteur, pas à faire en silence.
7. **Calage des tolérances** (`TOLERANCE_COLONNE`, `TOLERANCE_LIGNE`, `ECART_ESPACE`) : valeurs initiales indicatives, à caler sur le fichier réel par le script. Un changement de mise en page de Vega pourrait casser la lecture → le message `AUCUNE_SEANCE` le signalera sans planter.
8. **Libellé « Fin »** : on affiche « Fin le 01/06/2027 » sans interpréter la colonne (fin de prescription ? de prise en charge ?). À confirmer avec le cabinet pour un libellé plus parlant.
9. **Premier usage hors ligne** : le chunk pdf.js est chargé au premier dépôt ; hors connexion (ou après un redéploiement pendant que l'onglet était ouvert), message `LECTEUR_INDISPONIBLE`. Acceptable (l'application elle-même est servie en ligne).
10. **Hébergement** : vérifier au premier déploiement que GitHub Pages sert le worker `.mjs` avec un type MIME JavaScript (sinon le worker ne démarre pas).
11. **Nouveau dossier `src/adaptateurs/`** : complète l'arborescence de l'architecture 06 (mise à jour en T4) ; pas d'écart d'ADR. **Aucun autre écart** : rien n'est persisté (ADR 0005 non concerné), aucune donnée ne quitte le poste (ADR 0002), logique en modules purs (ADR 0008), dates/heures en chaînes (ADR 0010).
12. **Données de santé** : le fichier d'exemple et toute sortie du script contiennent des noms réels — `files/` ignoré par git (T1), aucune trace dans les commits, la doc ou les journaux de la console.
