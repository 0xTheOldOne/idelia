# Feature 0039 — Page Cabinet et menu

- **Statut** : Fait
- **Dépend de** : `0003` (écran Paramètres : brouillon local + Vuelidate + `cabinet/majParametres`, rubriques Jours d'ouverture, Créneaux de travail, Rythme de travail), `0015` (menu latéral repliable `MenuLateral.vue`, état actif `estActif()`, infobulles en menu replié et en fenêtre étroite `App.vue`), `0038` (bouton « Passer en mode sombre » du pied de menu, `.menu-theme`, dont on reprend le style pour Paramètres).
- **Prépare** : `0040` (coordonnées des personnes), `0041` (modèles de contrats, marqueurs `cabinet.*`, groupe de menu « Contrats »), `0042` (documents contractuels : **en-tête logo + nom + adresse du cabinet**).
- **ADR liés** : [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance via `storageRepository`), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (le logo voyage dans la sauvegarde), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (validation pure dans `src/domain/`), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate, vue-debounce), [0013](../docs/adr/0013-icones-phosphor.md) (icône `PhBuildings`), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md), [0016](../docs/adr/0016-router-mode-hash-pour-pages.md) (route `/cabinet` en mode hash). **Aucun nouvel ADR** : le traitement d'image passe par `<canvas>`, API native du navigateur, sans dépendance.

## 1. Contexte & objectif

Le porteur veut produire des contrats et des avenants depuis Idelia (0041, 0042). Ces documents portent un **en-tête** : logo, nom et adresse du cabinet. Aujourd'hui, ces informations n'existent pas (adresse, logo) ou ne sont pas modifiables (`nomCabinet` est dans le modèle depuis 0002, mais aucun écran ne le propose).

Par ailleurs, les réglages « qui décrivent le cabinet » (jours d'ouverture, créneaux, rythme de travail) sont mêlés dans Paramètres aux réglages « de l'application » (affichage, apparence, sauvegarde). Pour une utilisatrice peu à l'aise avec l'informatique, ce mélange rend ces réglages difficiles à trouver.

Résultat attendu :

- une nouvelle page **« Cabinet »** (`/cabinet`), en tête du groupe « Pilotage », qui regroupe :
  - l'**identité** du cabinet : nom, adresse, logo ;
  - les rubriques **Jours d'ouverture**, **Créneaux de travail** et **Rythme de travail**, **déplacées** depuis Paramètres, avec un comportement identique ;
- un **menu réorganisé** : Accueil seul en tête, « Pilotage » (Cabinet, Équipe, Tournées, Absences & congés), « Planning » (Planning, Feuille de route), et **Paramètres tout en bas**, sous le bouton de thème ;
- un **logo** importé depuis un fichier PNG ou JPEG, réduit automatiquement et enregistré dans les données d'Idelia (il est donc inclus dans les sauvegardes).

## 2. Écrans concernés

- **`/cabinet`** (`CabinetView.vue`, **créer**). Titre « Cabinet ». Sections, dans cet ordre :
  1. **Identité du cabinet** : nom, adresse (deux lignes, code postal, ville), puis logo (aperçu, « Choisir une image », « Retirer »).
  2. **Jours d'ouverture** (déplacée, inchangée).
  3. **Créneaux de travail** (déplacée, inchangée).
  4. **Rythme de travail** (déplacée, inchangée, avec son avertissement de cohérence).
- **`/parametres`** (`ParametresView.vue`, **modifier**). Titre « Paramètres » (et non plus « Paramètres du cabinet »). Il ne reste que : **Affichage**, **Apparence**, **Vacances scolaires**, **Sauvegarde**, **Sauvegarde automatique**.
- **Menu latéral** (`MenuLateral.vue`, **modifier**), sur tous les écrans.

Liens profonds : la recherche de `parametres` dans `src/` ne trouve **aucun lien** (`router-link`, `$router.push`) vers les rubriques déplacées. Les mentions textuelles de « Paramètres » restantes portent toutes sur la **sauvegarde** ou les **vacances scolaires**, qui restent dans Paramètres. Elles sont **à conserver** : `store/index.js` l.76 et l.291, `AccueilView.vue` l.12, `ModaleFichierSauvegardeIntrouvable.vue` l.37, `domain/calendrier/vacancesScolaires.js` l.324. Le développeur refait la recherche en T3 (`Paramètres|parametres|jours d'ouverture|créneaux|rythme`) pour le confirmer.

Parcours visé (utilisatrice peu à l'aise avec l'informatique) :

1. Elle ouvre **Cabinet** depuis le menu : les informations du cabinet sont toutes là.
2. Elle tape le nom et l'adresse. C'est enregistré tout seul, sans bouton « Enregistrer ». Une phrase le dit sous le titre.
3. Elle clique sur « Choisir une image » et prend le fichier du logo (par exemple reçu par e-mail). Un court message « Préparation de l'image… » s'affiche, puis le logo apparaît en aperçu sur fond blanc, comme sur le papier.
4. Si le fichier ne convient pas (PDF, SVG, image abîmée), un message simple dit quoi faire, et l'ancien logo reste en place.
5. « Retirer le logo » demande une confirmation. Elle peut en choisir un autre à tout moment.

## 3. Modèle de données touché

`ParametresCabinet` (singleton `cabinet` du `SaveDocument`) :

| champ | type | oblig. | notes |
|---|---|---|---|
| `nomCabinet` | string | non | **existe déjà** (défaut `''`), désormais éditable. Max 100 caractères à la saisie. |
| `adresseCabinet` | `AdressePostale` `{ ligne1, ligne2, codePostal, ville }` (4 chaînes, module générique `src/domain/adresse.js`, réutilisé par 0040) | oui (forme garantie) | **nouveau**. Défaut : `adresseVide()`. Valeurs nettoyées (espaces de bord retirés, espaces du code postal retirés). `codePostal` vide ou 5 chiffres. |
| `logo` | string \| null | oui (`null` possible) | **nouveau**. Défaut `null`. Data URL `data:image/png;base64,…` ou `data:image/jpeg;base64,…`, au plus **200 000 caractères** (≈ 146 Ko d'image), au plus **400 px** de côté. |

Impacts :

- **`CURRENT_SCHEMA_VERSION` : 10 → 11** (`src/storage/migrations.js` l.17).
- **`MIGRATIONS[10]`** (v10 → v11), sur le modèle de `MIGRATIONS[8]` (l.295-301), qui modifie le `cabinet`, et de `MIGRATIONS[9]` (l.314-324). Si `cabinet` est un objet :
  - `adresseCabinet: normaliserAdresse(cabinet.adresseCabinet)` (`src/domain/adresse.js` ; idempotent : absent ou malformé → 4 chaînes vides) ;
  - `logo: cabinet.logo ?? null`.

  Le reste du document est inchangé. Un `logo` présent mais non conforme n'est **pas** corrigé ici : il est écarté par `fromSaveDocument` (§5.3, §12 n° 4).
- **Validation structurelle** (`src/domain/validationImport.js`) : `REGLES_CABINET` (l.148-158) reçoit `adresseCabinet`, contrôlée par une règle partagée `REGLES_ADRESSE` (réutilisée par 0040). Le **logo n'est pas une règle bloquante** : un logo invalide ne fait jamais refuser une sauvegarde (§5.4, décision du porteur).
- **Désérialisation** (`fromSaveDocument`, `src/domain/schema.js` l.215-238) : `adresseCabinet` est normalisée. `logo` passe par `normaliserLogo` : **c'est l'assainissement** (non conforme → `null`, §5.3). L'action `importer` prévient l'utilisatrice par un avertissement (§4).
- **Taille** : le logo ajoute au plus ≈ 200 Ko au `SaveDocument`, donc au stockage local (quota ≈ 5 Mo), aux exports et à la sauvegarde automatique dans un fichier (0018). Un dépassement de quota suit le chemin d'erreur existant (`storageRepository.save` → `statutSauvegarde` en erreur → `IndicateurSauvegarde`).
- Le moteur de planification reçoit `cabinet.parametres` tel quel (`plannings.js` l.66, `reglesCabinet`). Il ignore les nouveaux champs, et `Resultat.meta` ne recopie pas les paramètres : le logo **n'est pas dupliqué** dans les plannings.

## 4. Store (Vuex)

Module **`cabinet`** (`src/store/modules/cabinet.js`) : **aucune nouvelle mutation ni action**. Le state reste `{ parametres }` et la mutation `REPLACE` est inchangée. L'action existante `majParametres(patch)` suffit (fusion immuable + `updatedAt`) :

- `majParametres({ nomCabinet })` ;
- `majParametres({ adresseCabinet })`, avec l'objet complet (4 champs) déjà passé par `normaliserAdresse` ;
- `majParametres({ logo })`, avec une data URL validée, ou `null` pour retirer le logo.

**Store racine** (`src/store/index.js`, **modifier**), action **`importer`** (l.539-589) :

- juste après `preparation.ok` (l.567-570) et **avant** `REPLACE_ALL`, mémoriser `const logoEcarte = logoNonConforme(preparation.doc.cabinet?.logo)` (domaine, §5.2) ;
- `REPLACE_ALL(fromSaveDocument(…))` inchangé : le logo non conforme y devient `null`, et `flushImmediat` persiste aussitôt l'état assaini ;
- après `SET_STATUT_SAUVEGARDE('ENREGISTRE')`, si `logoEcarte` : `dispatch('notifications/notifier', { type: 'avertissement', message: MESSAGE_LOGO_NON_REPRIS }, { root: true })` (pile de toasts de 0018) ;
- le résultat reste `{ ok: true, message: 'Import réussi.' }` : tout le reste est restauré.

L'action **`bootstrap`** (l.499-525) ne change pas. Un logo non conforme dans le stockage local (modification manuelle uniquement) y est ramené à `null` en silence par `fromSaveDocument`. Aucun toast au démarrage (§12 n° 4).

La persistance passe par le plugin du store racine (mutation `cabinet/REPLACE` → écriture débouncée via `storageRepository`). Il n'y a aucun accès à `localStorage` dans les composants ni dans l'adaptateur (règle d'or n° 8). Seule la JSDoc d'en-tête du module est complétée (identité : feature 0039).

## 5. Domaine (logique pure) et adaptateur

### 5.1 `src/domain/adresse.js` (**créer**, module pur générique)

Structure d'adresse **partagée** : l'adresse du cabinet (0039) et celle des personnes (0040) l'utilisent toutes les deux. Le module n'importe rien de Vue ni de Vuex et ne dépend d'aucun autre module du domaine. JSDoc complète.

```js
/** @typedef {{ ligne1: string, ligne2: string, codePostal: string, ville: string }} AdressePostale */

/** Longueurs maximales (saisie Vuelidate et contrôle d'import) : une seule source de vérité. */
export const LONGUEURS_MAX_ADRESSE = Object.freeze({ ligne1: 150, ligne2: 150, codePostal: 10, ville: 100 });
/** Code postal français : 5 chiffres (métropole, Corse, outre-mer). */
export const RE_CODE_POSTAL = /^\d{5}$/;

/** `true` si le code postal est vide ('' après normalisation) ou conforme à RE_CODE_POSTAL. */
export function estCodePostalValide(valeur) {}
/** Adresse vide (nouvelle instance à chaque appel). @returns {AdressePostale} */
export function adresseVide() {}
/** Non-chaîne → '' ; sinon tous les espaces retirés (« 69 003 » → « 69003 »). Ne valide pas : voir estCodePostalValide. */
export function normaliserCodePostal(valeur) {}
/** Forme garantie : objet → 4 chaînes (trim ; codePostal via normaliserCodePostal) ; champ non-chaîne → '' ; non-objet → adresseVide(). */
export function normaliserAdresse(valeur) {}
/** Lignes non vides, prêtes à afficher (en-tête 0042) : [ligne1, ligne2, 'CP Ville'] (la 3ᵉ sans espace superflu). @returns {string[]} */
export function lignesAdresse(adresse) {}
/** Adresse sur une ligne (marqueurs des contrats 0041) : lignesAdresse(adresse).join(', ') ; '' si vide. */
export function adresseSurUneLigne(adresse) {}
```

`normaliserAdresse` et `lignesAdresse` tolèrent `null` et `undefined` (adresse vide).

### 5.2 `src/domain/cabinet.js` (**modifier**, module pur existant)

`cabinet.js` **importe** `adresse.js` sans le dupliquer. Le champ reste `adresseCabinet`, typé `import('@/domain/adresse.js').AdressePostale`. Ajouts, avec une JSDoc complète, à côté de `coherenceParametres` :

```js
/** Longueur maximale du nom du cabinet (saisie Vuelidate). */
export const LONGUEUR_MAX_NOM_CABINET = 100;

/** Côté maximal du logo enregistré (px). */
export const LOGO_COTE_MAX_PX = 400;
/** Longueur maximale de la data URL du logo (caractères) : ≈ 146 Ko d'image. */
export const LOGO_LONGUEUR_MAX = 200000;
/** Seules formes acceptées : PNG ou JPEG en base64, rien d'autre (ni SVG, ni URL externe, ni javascript:). */
const RE_LOGO = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;
/** `true` si `valeur` est une data URL de logo conforme (type, forme, longueur). */
export function estLogoValide(valeur) {}
/** Logo conforme → lui-même ; tout le reste (préfixe, type JS, taille) → null. Assainissement à la désérialisation et à l'affichage. */
export function normaliserLogo(valeur) {}
/** `true` si un logo est présent (ni null ni undefined) mais non conforme : il sera écarté à l'import. */
export function logoNonConforme(valeur) {}
/** Avertissement affiché quand un logo importé est écarté (décision du porteur). */
export const MESSAGE_LOGO_NON_REPRIS = "Le logo du cabinet n'a pas été repris : réimportez-le dans la page Cabinet.";

/** Messages FR des échecs de préparation du logo (codes de l'adaptateur, §5.5). Code inconnu → IMAGE_ILLISIBLE. */
export function messageErreurLogo(code) {}
```

Le contrôle de longueur de `estLogoValide` se fait **avant** le test de l'expression régulière, qui est linéaire. `typeof valeur === 'string'` est vérifié d'abord.

Messages de `messageErreurLogo` :

| Code | Message |
|---|---|
| `FORMAT_NON_ACCEPTE` | « Ce type de fichier n'est pas accepté. Choisissez une image PNG ou JPEG (fichier .png, .jpg ou .jpeg). » |
| `FICHIER_TROP_LOURD` | « Cette image est trop lourde (plus de 10 Mo). Choisissez une image plus légère. » |
| `IMAGE_ILLISIBLE` | « Cette image n'a pas pu être lue. Elle est peut-être abîmée : essayez avec une autre image. » |
| `IMAGE_TROP_GRANDE` | « Cette image est trop grande pour être préparée. Choisissez une image plus petite. » |
| `LOGO_TROP_LOURD` | « Même réduite, cette image reste trop lourde pour être enregistrée. Essayez une image plus simple (moins de détails, fond uni). » |

### 5.3 `src/domain/schema.js` (**modifier**)

- Typedef `ParametresCabinet` (l.93-104) : ajouter `@property {import('@/domain/adresse.js').AdressePostale} adresseCabinet` et `@property {(string|null)} logo - Data URL PNG/JPEG (0039), null = aucun logo`.
- `etatParDefaut()` (l.147-159) : `adresseCabinet: adresseVide()`, `logo: null`.
- `fromSaveDocument` (l.221-228) : `adresseCabinet: normaliserAdresse(doc.cabinet?.adresseCabinet)` et `logo: normaliserLogo(doc.cabinet?.logo)`. Le commentaire précise : « assainissement (0039) : un logo non conforme ne bloque jamais l'import, il est écarté ici et l'action `importer` le signale ».

### 5.4 `src/domain/validationImport.js` (**modifier**)

- `CONTROLEURS` (l.72-86) : **inchangé**. Il n'y a pas de type `logo`.
- `REGLES_CABINET` (l.148-158) :
  - `nomCabinet: { type: 'texte' }` inchangé (500 max, tolérant) ;
  - `adresseCabinet: { type: 'objet' }` ;
  - **pas de règle `logo`**. Les clés non listées sont tolérées : un logo invalide traverse la validation et il est **écarté** par `fromSaveDocument` (§5.3). Un commentaire au-dessus de `REGLES_CABINET` le dit explicitement : « `logo` volontairement absent : jamais bloquant, assaini par `normaliserLogo` (0039) ».
- Nouvelle règle **partagée** `REGLES_ADRESSE`, réutilisée telle quelle par 0040 pour l'adresse des personnes. Elle est construite à partir de `LONGUEURS_MAX_ADRESSE` (`@/domain/adresse.js`) :

  ```js
  /** Règles d'une AdressePostale (adresse du cabinet 0039, adresse des personnes 0040). */
  const REGLES_ADRESSE = {
    ligne1: { type: 'texte', max: LONGUEURS_MAX_ADRESSE.ligne1 },
    ligne2: { type: 'texte', max: LONGUEURS_MAX_ADRESSE.ligne2 },
    codePostal: { type: 'texte', max: LONGUEURS_MAX_ADRESSE.codePostal },
    ville: { type: 'texte', max: LONGUEURS_MAX_ADRESSE.ville },
  };
  ```

  Le format du code postal **n'est pas** contrôlé à l'import (tolérance, aucun risque) : seule la longueur l'est.
- Petite fonction locale `controlerAdresse(valeur, contexte, erreurs)` : si `estObjet(valeur)`, elle appelle `controlerChamps(valeur, REGLES_ADRESSE, contexte, erreurs)`. Une valeur non objet est déjà signalée par la règle `objet` du parent. 0040 la réutilise.
- `verifierStructure` (l.316-320) : après `controlerChamps(doc.cabinet, …)`, appeler `controlerAdresse(doc.cabinet.adresseCabinet, 'Adresse du cabinet', erreurs)`.
- Conséquence : un fichier dont le `logo` est une URL `https://…`, une `javascript:…`, un `data:image/svg+xml…`, une valeur trop longue, non base64 ou d'un autre type JS (nombre, objet) est **importé**. Tout est restauré **sauf le logo**, qui devient `null`, et un toast d'avertissement affiche `MESSAGE_LOGO_NON_REPRIS` (§4). Le contenu invalide n'est jamais stocké ni rendu.
- La taille globale reste bornée par le plafond de fichier existant (`TAILLE_MAX_FICHIER_OCTETS`, 10 Mo).

### 5.5 `src/adaptateurs/imageLogo.js` (**créer**, I/O navigateur, aucune persistance)

Sur le modèle de `lireGlyphesPdf.js` : constantes exportées, erreurs à **code stable** (`erreurPreparation(code, cause)`), et aucun message technique à l'écran.

```js
/** Taille maximale du fichier source (octets) : 10 Mo. */
export const TAILLE_MAX_IMAGE_SOURCE_OCTETS = 10 * 1024 * 1024;
/** Nombre maximal de pixels de l'image source décodée : 40 mégapixels. */
export const PIXELS_MAX_SOURCE = 40 * 1000 * 1000;
/** Valeur de l'attribut `accept` du sélecteur de fichier. */
export const ACCEPT_LOGO = 'image/png,image/jpeg,.png,.jpg,.jpeg';

/** PNG ou JPEG d'après le type MIME, sinon d'après l'extension si le type est vide (Windows). SVG toujours refusé. */
export function estFichierImageAcceptee(fichier) {}

/**
 * Prépare un logo : décode, réduit (jamais d'agrandissement), réencode en PNG ou JPEG.
 * @param {File} fichier
 * @returns {Promise<string>} data URL conforme à `estLogoValide`
 * @throws {Error & {code: 'FORMAT_NON_ACCEPTE'|'FICHIER_TROP_LOURD'|'IMAGE_ILLISIBLE'|'IMAGE_TROP_GRANDE'|'LOGO_TROP_LOURD'}}
 */
export async function preparerLogo(fichier) {}
```

Algorithme de `preparerLogo` :

1. `estFichierImageAcceptee(fichier)` est faux → `FORMAT_NON_ACCEPTE`. Un type MIME **renseigné** autre que `image/png` ou `image/jpeg` est refusé, même avec l'extension `.png`.
2. `fichier.size > TAILLE_MAX_IMAGE_SOURCE_OCTETS` → `FICHIER_TROP_LOURD`.
3. Décodage : `createImageBitmap(fichier)`. Le navigateur reconnaît le format **d'après le contenu** : un SVG ou un texte renommé en `.png` échoue. Un échec, ou une API absente, donne `IMAGE_ILLISIBLE`. L'orientation EXIF est appliquée par défaut.
4. `largeur × hauteur > PIXELS_MAX_SOURCE` → `IMAGE_TROP_GRANDE` (fermer le bitmap).
5. Tentatives successives, en s'arrêtant à la **première** dont la data URL passe `estLogoValide` :
   - (400 px, format d'origine : PNG si la source est PNG, pour garder la transparence, sinon JPEG qualité 0,88) ;
   - (400 px, JPEG 0,8) ;
   - (300 px, JPEG 0,8) ;
   - (200 px, JPEG 0,75).

   Échelle : `Math.min(1, cote / Math.max(l, h))`, dimensions arrondies, au moins 1 px. En JPEG, le canvas est **d'abord rempli de blanc**, car la transparence deviendrait noire. Le papier est blanc, le rendu est donc fidèle. Export : `canvas.toDataURL(type, qualite)`.
6. Aucune tentative ne convient → `LOGO_TROP_LOURD`. Le bitmap est toujours fermé (`bitmap.close()`, dans un `finally`).

Le réencodage par canvas **supprime les métadonnées** du fichier d'origine (EXIF, dont une éventuelle position GPS), ainsi que tout contenu non image. Seuls les pixels sont conservés.

## 6. Composants

### 6.1 `src/views/CabinetView.vue` (**créer**)

Vue conteneur légère, **sans Vuelidate ni brouillon**. Chaque bloc gère les siens.

- `<h1>Cabinet</h1>`, suivi d'un paragraphe d'introduction en `$couleur-texte-attenue` : « Les informations de votre cabinet. Elles servent à préparer le planning et figureront en en-tête des contrats. Tout est enregistré automatiquement. »
- La même alerte `ERREUR_CHARGEMENT` que Paramètres (`ParametresView.vue` l.5-16, `mapState(['statutSauvegarde'])`) : les valeurs du cabinet sont alors les valeurs par défaut, l'utilisatrice doit le savoir ici aussi.
- Sections `<section class="cabinet-section">` (même style que `.parametres-section` : marge, filet bas, pas de filet sur la dernière) :
  1. `<h2>Identité du cabinet</h2>`, puis `<BlocIdentiteCabinet />` et `<BlocLogoCabinet />` ;
  2. `<BlocJoursOuverture />` ;
  3. `<BlocCreneauxTravail />` ;
  4. `<BlocRythmeTravail />`.

### 6.2 Blocs déplacés depuis Paramètres (**créer**, logique inchangée)

Ils sont extraits de `ParametresView.vue` l.19-163 (gabarit), l.241-345 (données, validations, gestionnaires) et des styles associés. Ce sont des **composants conteneurs**, sur le modèle de `src/components/parametres/BlocApparence.vue` et `BlocVacancesScolaires.vue`. Chacun :

- lit `mapGetters('cabinet', ['parametres'])` et appelle `mapActions('cabinet', ['majParametres'])` ;
- a son propre `setup() { return { v$: useVuelidate() }; }` (même commentaire « pont requis par Vuelidate 2 », ADR 0011) et son propre brouillon, limité à ses champs, copié dans `created()` ;
- porte son propre titre `<h2>` (dans la `<legend>` pour les groupes de cases, comme aujourd'hui) ;
- conserve **mot pour mot** les libellés, les aides, les messages d'erreur, les `id` et les `aria-describedby` existants.

| Composant | Champs | Reprend |
|---|---|---|
| `src/components/cabinet/BlocJoursOuverture.vue` | `joursOuverture` | l.19-50, règle `required`, `onJoursOuvertureChange` |
| `src/components/cabinet/BlocCreneauxTravail.vue` | `creneauxActifs` | l.52-81, règle `required`, `onCreneauxActifsChange` |
| `src/components/cabinet/BlocRythmeTravail.vue` | `reposHebdoMin`, `maxJoursConsecutifs` | l.83-163, règles `required/integer/between`, `describedBy`, avertissement `coherenceParametres` (`@/domain/cabinet.js`) |

**Styles partagés** : `.parametres-case`, `.parametres-legende` et `.parametres-erreur` (`ParametresView.vue` l.388-455) servent à plusieurs blocs. On les transforme en **mixins** de `src/styles/_mixins.scss`, pour ne pas les dupliquer :

- `@mixin case-confortable` ;
- `@mixin legende-titre` ;
- `@mixin message-erreur-champ`.

Chaque bloc les inclut dans ses classes scoped (`.bloc-jours__case { @include m.case-confortable; }`…). La cible minimale `min-height: t.$cible-cliquable-min` des `.form-control` / `.form-select` est reprise dans `BlocRythmeTravail` et `BlocIdentiteCabinet`.

### 6.3 `src/components/cabinet/BlocIdentiteCabinet.vue` (**créer**)

Formulaire du nom et de l'adresse. Même mécanique que les autres blocs : brouillon local, Vuelidate, enregistrement d'un champ seulement s'il est valide.

- Brouillon : `nomCabinet` et `adresse` (copie de `normaliserAdresse(parametres.adresseCabinet)`, `@/domain/adresse.js`).
- Champs, en `form-control`, avec `<label>` visible et `autocomplete` adapté :

| id | Libellé | Aide / placeholder | `autocomplete` |
|---|---|---|---|
| `cabinet-nom` | Nom du cabinet | placeholder « ex. Cabinet infirmier des Tilleuls » | `organization` |
| `cabinet-adresse-ligne1` | Adresse | placeholder « ex. 12 rue des Lilas » | `address-line1` |
| `cabinet-adresse-ligne2` | Complément d'adresse (facultatif) | placeholder « ex. Bâtiment B, 1er étage » | `address-line2` |
| `cabinet-code-postal` | Code postal | `inputmode="numeric"`, `maxlength="10"` (`LONGUEURS_MAX_ADRESSE.codePostal` : on tolère « 69 003 ») | `postal-code` |
| `cabinet-ville` | Ville | — | `address-level2` |

- Mise en page : nom en pleine largeur ; adresse et complément en pleine largeur ; code postal (`col-sm-4`) et ville (`col-sm-8`) sur une ligne, empilés sur mobile.
- Aide sous le groupe (`form-text`) : « Ces informations apparaîtront en en-tête des contrats et des avenants. »
- Enregistrement :
  - `v-model` + `v-debounce:600ms` (directive globale déjà enregistrée dans `main.js` l.33), qui enregistre pendant la frappe ;
  - et `@change` en filet de sécurité (perte de focus) ;
  - les deux appellent le même gestionnaire, idempotent : `$touch()`, puis, si le champ est valide, `majParametres({ nomCabinet: nom.trim() })` ou `majParametres({ adresseCabinet: normaliserAdresse(this.brouillon.adresse) })`.
  - Le brouillon n'est **jamais** réécrit depuis le store pendant la saisie.
- Erreurs : même présentation que les autres blocs (`message-erreur-champ`, `PhWarning` 14 px, `is-invalid`, `aria-describedby`).

### 6.4 `src/components/cabinet/BlocLogoCabinet.vue` (**créer**)

- En-tête : `<h3>Logo</h3>`, avec à **droite du titre** (flex, `justify-content: space-between`, passe dessous si la place manque) :
  - bouton principal `btn btn-outline-primary` avec icône `PhImage` et texte : « Choisir une image » s'il n'y a pas de logo, « Remplacer le logo » s'il y en a un ;
  - s'il y a un logo, bouton **icône seule** `btn btn-outline-danger`, `PhTrash`, avec `title` et `aria-label` « Retirer le logo » (44 px minimum).
- Champ fichier caché `<input type="file" class="d-none" tabindex="-1" :accept="ACCEPT_LOGO">`, déclenché par le bouton. C'est le motif de `ZoneDepotFichier.vue` l.16-33 et l.68-78, y compris la remise à `''` de `value`, pour pouvoir rechoisir le même fichier.
- Cadre d'aperçu (`data-bs-theme="light"`, fond blanc, bordure `$couleur-bordure`, `$rayon-md`, hauteur 160 px, image centrée en `object-fit: contain`, au plus 100 % × 140 px) :
  - avec un logo : `<img :src="logoAffichable" alt="Logo du cabinet">`, où `logoAffichable = normaliserLogo(parametres.logo)`. On ne lie **jamais** une valeur non validée ;
  - sans logo : fond `$couleur-fond-clair` (rendu « vide » homogène), icône `PhImage` 40 px atténuée et texte « Aucun logo pour l'instant » ;
  - pendant la préparation : `spinner-border` et « Préparation de l'image… », boutons désactivés (`aria-busy`).
- Aide (`form-text`) : « Image PNG ou JPEG. Elle est réduite automatiquement (400 pixels au plus) pour rester légère. Le logo est inclus dans vos sauvegardes. »
- Zone d'annonce `role="status" aria-live="polite"` :
  - succès : `alert-success` « Logo enregistré. » ;
  - échec : `alert-warning` avec `messageErreurLogo(err.code)`. L'**ancien logo reste en place**, rien n'est modifié.
  - Le message précédent est effacé à chaque nouveau choix.
- Flux de choix : `preparerLogo(fichier)` (adaptateur), puis `majParametres({ logo: dataUrl })`. Garde `enCours`, sans double déclenchement.
- Retrait : `DialogueConfirmation` (`src/components/communs/DialogueConfirmation.vue`) :
  - titre « Retirer le logo ? » ;
  - message « Le logo ne figurera plus sur les documents. Vous pourrez en choisir un autre à tout moment. » ;
  - `libelle-confirmer="Retirer"`, `variante-confirmer="danger"`.

  Après confirmation : `majParametres({ logo: null })`, puis le focus revient sur « Choisir une image ».

### 6.5 `src/views/ParametresView.vue` (**modifier**)

- `<h1>Paramètres</h1>`.
- Supprimer les trois rubriques déplacées (l.19-163), avec leurs données, validations et gestionnaires (`onJoursOuvertureChange`, `onCreneauxActifsChange`, `onReposHebdoMinChange`, `onMaxJoursConsecutifsChange`, `describedBy`, `avertissementsCoherence`), et les imports devenus inutiles (`coherenceParametres`, `CRENEAUX`, `libelleCreneau`).
- Le brouillon ne contient plus que `premierJourSemaine`. C'est une liste fermée, sans Vuelidate (l.346-350) : **retirer** `useVuelidate`, `validations()` et l'import `@vuelidate/*` s'ils ne servent plus. `onDonneesRemplacees` recopie `premierJourSemaine` (sans `v$.$reset()`).
- Retirer les styles devenus orphelins (`.parametres-case`, `.parametres-legende`, `.parametres-erreur`). Garder `.parametres-section` et `.parametres-select`.
- Mettre à jour la JSDoc du composant : les rubriques « cabinet » vivent désormais dans `CabinetView` (0039).

### 6.6 `src/router/index.js` (**modifier**)

- `import CabinetView from '@/views/CabinetView.vue';` (import statique, comme les autres).
- `{ path: '/cabinet', name: 'cabinet', component: CabinetView }`, juste après `accueil`.
- Une ligne dans la JSDoc d'en-tête : « `cabinet` (feature 0039) : identité du cabinet et règles d'organisation, sans paramètre. »

### 6.7 `src/components/communs/MenuLateral.vue` (**modifier**)

Configuration (`data()`, l.132-165) :

```js
groupes: [
  { nom: 'tete', titre: null, libelleAccessible: 'Accueil',
    items: [{ nom: 'accueil', chemin: '/', libelle: 'Accueil', icone: 'PhHouse' }] },
  { nom: 'pilotage', titre: 'Pilotage', items: [
    { nom: 'cabinet', chemin: '/cabinet', libelle: 'Cabinet', icone: 'PhBuildings' },
    /* equipe, tournees, absences : inchangés */ ] },
  { nom: 'planning', titre: 'Planning', items: [ /* planning, feuille-de-route */ ] },
  // Le groupe « Contrats » sera ajouté ici par la feature 0041.
],
itemParametres: { nom: 'parametres', chemin: '/parametres', libelle: 'Paramètres', icone: 'PhGear' },
```

Gabarit (l.11-38) :

- `:key="groupe.nom"`, qui remplace `groupe.titre`, désormais nullable ;
- `:aria-labelledby="groupe.titre ? idTitreGroupe(index) : null"` et `:aria-label="groupe.titre ? null : groupe.libelleAccessible"` ;
- `<p class="menu-groupe__titre" v-if="groupe.titre">`. Un groupe sans titre n'affiche **ni titre déplié, ni trait replié**.

Pied : nouveau bloc `<div class="menu-parametres">` **après** `.menu-theme` (l.52-63) et **avant** `.menu-bascule`. Il contient un `router-link` identique aux items de navigation :

- `class="menu-item"`, `:class="{ 'menu-item--actif': estActif(itemParametres) }"` ;
- `aria-current`, `aria-label`, `active-class=""`, `exact-active-class=""` ;
- icône `PhGear` 21 px, `.menu-item__libelle`, `.menu-item__infobulle`.

Ordre final du pied : indicateur de sauvegarde → « Passer en mode sombre » → **Paramètres** → « Réduire le menu ».

Autres modifications :

- Style : `.menu-parametres { margin-top: t.$espace-1; padding: 0 t.$espace-2; }`, aligné sur `.menu-theme` (l.536-539). Le repli et le mode étroit (`App.vue` l.143-174, sélecteurs `:deep(.menu-item…)`) s'appliquent sans modification. Vérifier que `App.vue` n'a rien à changer.
- Composants : ajouter `PhBuildings` à l'import (l.80-91) et à `components`.
- JSDoc : compléter l'en-tête (groupe de tête sans titre, Paramètres en pied, 0039) et `idTitreGroupe` (utilisé seulement pour les groupes titrés).

## 7. Règles de validation

Vuelidate dans `BlocIdentiteCabinet`. Les sources sont toutes dans le domaine :

- longueur du nom : `LONGUEUR_MAX_NOM_CABINET` (`cabinet.js`) ;
- longueurs de l'adresse : `LONGUEURS_MAX_ADRESSE` (`adresse.js`) ;
- code postal : `estCodePostalValide` (`adresse.js`), appliqué à `normaliserCodePostal(saisie)`, pour que « 69 003 » soit accepté.

0040 réutilise les mêmes règles et les mêmes messages pour l'adresse des personnes. **Tous les champs sont facultatifs** : un cabinet peut ne rien saisir.

| Champ | Règle | Message |
|---|---|---|
| `nomCabinet` | `maxLength(100)` | « Le nom du cabinet ne doit pas dépasser 100 caractères. » |
| `adresse.ligne1`, `adresse.ligne2` | `maxLength(150)` | « Cette ligne d'adresse ne doit pas dépasser 150 caractères. » |
| `adresse.codePostal` | `helpers.withMessage(…, (v) => estCodePostalValide(normaliserCodePostal(v)))` | « Indiquez un code postal à 5 chiffres (ex. 69003). » |
| `adresse.ville` | `maxLength(100)` | « Le nom de la ville ne doit pas dépasser 100 caractères. » |

- Les erreurs s'affichent **après interaction** (`$touch` sur `@change` ou au délai de débounce), jamais sur un formulaire vierge.
- Un champ invalide garde la saisie et n'écrase pas la dernière valeur valide enregistrée (même principe que 0003).
- Comme l'adresse est enregistrée **en bloc**, un code postal invalide bloque l'enregistrement des autres champs d'adresse modifiés en même temps. Le gestionnaire vérifie donc `v$.brouillon.adresse.$invalid` avant d'enregistrer. C'est acceptable, car le message est visible sous le champ fautif.
- Logo : aucune règle Vuelidate. C'est un fichier, contrôlé par l'adaptateur (§5.5) puis par `estLogoValide`.
- Rubriques déplacées : règles et messages **inchangés** (0003).

## 8. Points d'attention ergonomie

- **Trouver les choses où on les attend** : ce qui décrit le cabinet est dans « Cabinet », ce qui règle l'application est dans « Paramètres ». La phrase d'introduction de la page Cabinet dit à quoi servent ces informations (planning, en-tête des contrats).
- **Enregistrement automatique, dit clairement** : pas de bouton « Enregistrer ». La phrase « Tout est enregistré automatiquement » est en tête de page, et l'indicateur de sauvegarde du menu reste la référence.
- **Logo : retours à chaque étape**. Préparation visible (spinner + texte), succès annoncé, échec expliqué avec la marche à suivre, et l'ancien logo conservé en cas d'échec. Aucune notion technique (« data URL », « base64 », « pixels » réservé à l'aide).
- **Aperçu fidèle au papier** : le cadre d'aperçu reste blanc, même en mode sombre (`data-bs-theme="light"`, comme `FeuilleDiffusion.vue`).
- **Action destructrice protégée** : « Retirer le logo » demande une confirmation. Annuler, la croix et Échap ne retirent rien.
- **Boutons** : action principale du bloc avec texte, action secondaire (Retirer) en icône seule avec infobulle et `aria-label`, cibles de 44 px, à droite du titre (préférences du porteur).
- **Menu** :
  - Accueil seul en tête : il se repère tout de suite ;
  - Paramètres en bas, séparé des écrans de travail, à l'endroit habituel des réglages ;
  - l'état actif de Cabinet et de Paramètres (fond + barre d'accent + graisse, `aria-current`) fonctionne en menu déplié, replié et en fenêtre étroite (< 992 px), avec infobulles.
- **Rien ne change dans les rubriques déplacées** : mêmes libellés, mêmes messages, même comportement. Seule leur place change.
- **Clavier et lecteur d'écran** :
  - le champ fichier caché n'est pas un arrêt de tabulation, le bouton l'est ;
  - les annonces passent par `role="status"` ;
  - le focus revient sur « Choisir une image » après un retrait.

## 9. Étapes d'implémentation

Cinq tâches, chacune confiée à **un sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)).

- Ordre : **T1 → T2 → T3 → T4 → T5**. T5 (menu) ne dépend que de la route créée en T3.
- Contexte à transmettre à chaque sous-agent : ce plan, règles d'or n° 2, 3, 4, 5, 7, 8 et 10, ADR 0005, 0008 et 0011, et les préférences UI (bouton à droite du titre, actions secondaires en icône seule + infobulle).
- **Un seul commit pour la feature**.

### Tâche 1 — Modèle : identité du cabinet, migration v11, validation d'import

**Fichiers** :

- `src/domain/adresse.js` (**créer**) : §5.1, module générique partagé avec 0040. Typedef `AdressePostale`, `LONGUEURS_MAX_ADRESSE`, `RE_CODE_POSTAL`, `estCodePostalValide`, `adresseVide`, `normaliserCodePostal`, `normaliserAdresse`, `lignesAdresse`, `adresseSurUneLigne`. JSDoc complète.
- `src/domain/cabinet.js` (**modifier**) : §5.2. Import de `adresse.js`, `LONGUEUR_MAX_NOM_CABINET`, `LOGO_COTE_MAX_PX`, `LOGO_LONGUEUR_MAX`, `estLogoValide`, `normaliserLogo`, `logoNonConforme`, `MESSAGE_LOGO_NON_REPRIS`, `messageErreurLogo`. JSDoc complète.
- `src/domain/schema.js` (**modifier**) : §5.3 (typedef, `etatParDefaut`, `fromSaveDocument`).
- `src/domain/validationImport.js` (**modifier**) : §5.4 (`REGLES_CABINET` sans règle `logo` + commentaire, `REGLES_ADRESSE` partagée, `controlerAdresse`, appel dans `verifierStructure`).
- `src/store/index.js` (**modifier**) : action `importer`, détection `logoNonConforme` avant `REPLACE_ALL` et toast d'avertissement après l'enregistrement (§4). JSDoc de l'action complétée.
- `docs/architecture/06-structure-du-code.md` (**modifier**) : sous `domain/`, `adresse.js  # adresse postale générique : forme, normalisation, code postal, affichage (cabinet 0039, personnes 0040)`.
- `src/storage/migrations.js` (**modifier**) : `CURRENT_SCHEMA_VERSION = 11`, `MIGRATIONS[10]` documentée (§3).
- `src/store/modules/cabinet.js` (**modifier**) : JSDoc d'en-tête seulement (§4).
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) : lignes `adresseCabinet` (type `AdressePostale`, voir `src/domain/adresse.js`) et `logo` dans le tableau `ParametresCabinet` (l.185-197), et `nomCabinet` noté « éditable dans Cabinet (0039) ». Courte description de **`AdressePostale`** (4 champs, longueurs, code postal vide ou 5 chiffres), présentée comme une structure de valeur partagée (cabinet, personnes en 0040).
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) :
  - `schemaVersion: 11` et la mention « v11 = cabinet.adresseCabinet + cabinet.logo » (l.9) ;
  - exemple `cabinet` (l.31-38) complété (`adresseCabinet`, `"logo": null`) ;
  - paragraphe **`MIGRATIONS[10]` (v10 → v11)** sur le modèle de celui de `MIGRATIONS[8]` (l.134). Il précise : « un logo non conforme ne bloque jamais l'import : `fromSaveDocument` le ramène à `null` et `importer` affiche un avertissement ».

**Critères de sortie** :

- `npm run build` réussit, sans dépendance ajoutée.
- En console (`npm run dev`), sur un poste neuf : `store.state.cabinet.parametres.adresseCabinet` vaut 4 chaînes vides et `logo` vaut `null`.
- Une sauvegarde v10 (`idelia-sermet.json`) s'importe sans erreur. Après import, l'export est en `schemaVersion: 11`, avec l'adresse vide et `logo: null`. Les autres données sont identiques.
- Un JSON v11 forgé avec `"logo"` valant `"https://exemple.org/x.png"`, `"javascript:alert(1)"`, `"data:image/svg+xml;base64,PHN2Zz4="`, une data URL PNG de plus de 200 000 caractères, ou `42` est **importé**, avec :
  - le résultat `ok: true` ;
  - les personnes, tournées, plannings, l'adresse et le nom restaurés ;
  - `cabinet.logo === null` dans le store **et** dans `localStorage['idelia:data']` ;
  - un toast d'avertissement « Le logo du cabinet n'a pas été repris : réimportez-le dans la page Cabinet. ».
- Un import avec un logo valide ou `"logo": null` n'affiche **aucun** toast d'avertissement.
- En console :
  - `normaliserLogo` renvoie `null` pour chacune des valeurs invalides ci-dessus ;
  - `logoNonConforme(null)` et `logoNonConforme(undefined)` valent `false` ;
  - `logoNonConforme('javascript:alert(1)')` vaut `true`.
- `"adresseCabinet": "texte"` reste **refusé** (champ « adresseCabinet » invalide), de même qu'une `ville` numérique (« Adresse du cabinet : le champ « ville » est invalide. »).
- Fonctions de `src/domain/adresse.js`, vérifiées en console (import dynamique du module) :
  - `normaliserAdresse(null)`, `normaliserAdresse('x')` et `normaliserAdresse({ ville: 42 })` donnent 4 chaînes vides (`ville: ''` pour le dernier) ;
  - `normaliserAdresse({ ligne1: ' 12 rue A ', codePostal: '69 003', ville: 'Lyon ' })` donne `{ ligne1: '12 rue A', ligne2: '', codePostal: '69003', ville: 'Lyon' }` ;
  - `estCodePostalValide('')` et `estCodePostalValide('69003')` valent `true` ; `'6900'`, `'69A03'` et `'690031'` valent `false` ;
  - `lignesAdresse({ ligne1: '12 rue A', ligne2: '', codePostal: '69003', ville: 'Lyon' })` donne `['12 rue A', '69003 Lyon']` ; `lignesAdresse(adresseVide())` donne `[]` ;
  - `adresseSurUneLigne(…même adresse…)` donne `'12 rue A, 69003 Lyon'` ; `adresseSurUneLigne(adresseVide())` donne `''`.
- `src/domain/adresse.js` n'importe aucun autre module. `cabinet.js` ne redéfinit aucune fonction d'adresse.
- Une `ligne1` de 151 caractères dans un JSON importé est refusée (`REGLES_ADRESSE`). Un code postal « ABC » (longueur ≤ 10) est accepté à l'import (format non contrôlé à l'import, §5.4).
- Une recherche de `localStorage` dans `src/` ne trouve que `storageRepository.js`.

### Tâche 2 — Adaptateur de préparation du logo

**Fichiers** :

- `src/adaptateurs/imageLogo.js` (**créer**) : §5.5. JSDoc complète, codes d'erreur stables, `bitmap.close()` dans un `finally`.
- `docs/architecture/06-structure-du-code.md` (**modifier**) : sous `adaptateurs/`, `imageLogo.js # préparation du logo du cabinet : décodage, réduction ≤ 400 px, réencodage PNG/JPEG via canvas [0039]`.

**Critères de sortie** :

- `npm run build` réussit.
- En console (`npm run dev`, import dynamique du module), avec des fichiers d'essai fabriqués dans le scratchpad (§11) :
  - un PNG de 2000 × 1000 px avec transparence donne `data:image/png;base64,…` de 400 × 200 px, transparence conservée ;
  - un JPEG de 4000 × 3000 px donne `data:image/jpeg;…` de 400 × 300 px ;
  - un PNG de 120 × 80 px n'est **pas agrandi** ;
  - un SVG, un PDF, ou un `.txt` renommé en `.png` donne respectivement `FORMAT_NON_ACCEPTE`, `FORMAT_NON_ACCEPTE` et `IMAGE_ILLISIBLE` ;
  - un fichier de plus de 10 Mo donne `FICHIER_TROP_LOURD`.
- Toute data URL renvoyée passe `estLogoValide`.
- L'adaptateur n'importe ni Vue, ni Vuex, ni `storageRepository`.

### Tâche 3 — Page Cabinet, route et déplacement des rubriques

**Fichiers** :

- `src/styles/_mixins.scss` (**modifier**) : mixins `case-confortable`, `legende-titre` et `message-erreur-champ` (§6.2), repris des styles de `ParametresView.vue` l.388-455.
- `src/components/cabinet/BlocJoursOuverture.vue`, `src/components/cabinet/BlocCreneauxTravail.vue`, `src/components/cabinet/BlocRythmeTravail.vue` (**créer**) : §6.2.
- `src/views/CabinetView.vue` (**créer**) : §6.1, avec les trois blocs déplacés. La section « Identité du cabinet » est ajoutée en T4.
- `src/views/ParametresView.vue` (**modifier**) : §6.5.
- `src/router/index.js` (**modifier**) : §6.6.
- Recherche `Paramètres|parametres|jours d'ouverture|créneaux de travail|rythme de travail` dans `src/` (§2) : corriger toute mention qui renverrait vers Paramètres pour les rubriques déplacées. Aucune n'est attendue.
- `docs/architecture/06-structure-du-code.md` (**modifier**) : `CabinetView.vue   # identité du cabinet et règles d'organisation [0039]` sous `views/`, et nouvelle ligne `cabinet/  # blocs de la page Cabinet : identité, logo, jours d'ouverture, créneaux, rythme [0039]` sous `components/`.

**Critères de sortie** :

- `npm run build` réussit.
- `http://localhost:5199/idelia/#/cabinet` affiche les trois rubriques, avec le **même** rendu, les mêmes libellés et messages, et le même comportement qu'avant dans Paramètres :
  - décocher tous les jours affiche « Cochez au moins un jour d'ouverture. » et n'enregistre rien ;
  - le repos à 8 affiche le message ;
  - repos 2 + consécutifs 6 affiche l'avertissement de cohérence.
- Chaque modification valide est persistée (`localStorage['idelia:data']` après environ 1,5 s) et prise en compte par la génération du planning (jour décoché → plus d'affectation ce jour-là).
- Paramètres n'affiche plus que Affichage, Apparence, Vacances scolaires, Sauvegarde et Sauvegarde automatique. « Premier jour de la semaine » fonctionne toujours. Une restauration de sauvegarde met à jour ce choix sans rechargement.
- Plus aucune référence à `useVuelidate` dans `ParametresView.vue`, si elle n'est plus utile. Aucun style orphelin.

### Tâche 4 — Identité du cabinet : nom, adresse, logo

**Fichiers** :

- `src/components/cabinet/BlocIdentiteCabinet.vue` (**créer**) : §6.3 et §7.
- `src/components/cabinet/BlocLogoCabinet.vue` (**créer**) : §6.4.
- `src/views/CabinetView.vue` (**modifier**) : section « Identité du cabinet » en tête (§6.1).

**Critères de sortie** :

- `npm run build` réussit.
- Le nom et l'adresse saisis sont enregistrés pendant la frappe (environ 600 ms) et retrouvés après `F5`. Les espaces de bord sont retirés dans le stockage.
- Le code postal « 6900 » affiche le message, et ni l'adresse ni le code postal ne sont enregistrés. Corrigé en « 69003 », l'adresse est enregistrée. « 69 003 » est accepté et stocké « 69003 ». Un code postal vide est accepté.
- Logo :
  - choisir un PNG affiche l'aperçu et « Logo enregistré. » ;
  - `F5` le conserve ;
  - « Remplacer le logo » le change ;
  - « Retirer le logo » suivi d'« Annuler » ne change rien ; « Retirer » le retire, et le focus revient sur « Choisir une image » ;
  - un SVG affiche le message `FORMAT_NON_ACCEPTE` et l'ancien logo reste en place.
- En mode sombre, le cadre d'aperçu reste blanc et le reste du bloc est lisible.
- Le logo apparaît dans l'export JSON (`cabinet.logo`), et une restauration le rétablit.

### Tâche 5 — Menu latéral réorganisé et documentation de navigation

**Fichiers** :

- `src/components/communs/MenuLateral.vue` (**modifier**) : §6.7.
- `src/App.vue` (**vérifier**, modifier seulement si nécessaire) : rendu étroit des items et du lien Paramètres.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) :
  - ligne `/cabinet` dans la carte des écrans : « **Cabinet** | Identité du cabinet (nom, adresse, logo des en-têtes de documents), jours d'ouverture, créneaux de travail, rythme de travail | `0003`, `0039` » ;
  - ligne `/parametres` : « Affichage, apparence, **vacances scolaires**, sauvegarde / import / export, sauvegarde automatique | `0003`, `0008`, `0019`, `0023`, `0038`, `0039` » ;
  - « Principes de navigation » (l.21) : Accueil seul en tête (sans titre), groupes « Pilotage » / « Planning », **Paramètres en pied de menu** sous la bascule de thème, groupe « Contrats » à venir (0041) ;
  - nouvelle section courte « Écran Cabinet » : ordre des sections, enregistrement automatique, logo (PNG/JPEG, réduit à 400 px au plus, plafond, inclus dans la sauvegarde, aperçu sur fond blanc).

**Critères de sortie** :

- `npm run build` réussit.
- Menu déplié :
  - Accueil en tête, sans titre de groupe ;
  - « Pilotage » contient Cabinet (icône bâtiments), Équipe, Tournées, Absences & congés ;
  - « Planning » contient Planning et Feuille de route ;
  - en pied : indicateur de sauvegarde, puis « Passer en mode sombre », puis **Paramètres**, puis « Réduire le menu ».
- Menu replié et fenêtre de moins de 992 px :
  - pas de trait au-dessus d'Accueil, un trait au-dessus de Pilotage et de Planning ;
  - Paramètres en icône seule, avec infobulle au survol et au focus.
- État actif correct sur `/cabinet`, `/parametres`, `/` et `/equipe/<id>/souhaits` (Équipe), avec `aria-current="page"` sur un seul lien.
- Lecteur d'écran (arbre d'accessibilité de Playwright) : le groupe de tête est exposé avec le nom « Accueil », les autres groupes avec leur titre.

## 10. Critères d'acceptation

- [ ] Le menu montre **Accueil** seul en tête, puis « **Pilotage** » (Cabinet, Équipe, Tournées, Absences & congés), puis « **Planning** » (Planning, Feuille de route). **Paramètres** est tout en bas, sous « Passer en mode sombre ».
- [ ] Menu déplié, replié et fenêtre étroite : Cabinet et Paramètres sont atteignables, ont une infobulle quand le libellé est masqué, et sont mis en évidence quand ils sont actifs.
- [ ] La page **Cabinet** (`/cabinet`) affiche, dans l'ordre : Identité du cabinet, Jours d'ouverture, Créneaux de travail, Rythme de travail.
- [ ] Les trois rubriques déplacées se comportent **exactement** comme avant : mêmes libellés, messages, avertissement de cohérence et effet sur la génération.
- [ ] Paramètres ne contient plus que Affichage, Apparence, Vacances scolaires, Sauvegarde et Sauvegarde automatique, et s'intitule « Paramètres ».
- [ ] Le **nom** et l'**adresse** (deux lignes, code postal, ville) s'enregistrent automatiquement et sont conservés après rechargement. Un code postal non vide doit faire 5 chiffres, avec un message clair sinon.
- [ ] Le **logo** s'importe depuis un PNG ou un JPEG. Il est réduit à 400 px de côté au plus, jamais agrandi, et affiché en aperçu sur fond blanc (y compris en mode sombre). Il peut être remplacé, ou retiré après confirmation.
- [ ] Un fichier refusé (SVG, PDF, image abîmée, trop lourde) affiche un message compréhensible, et le logo précédent reste en place.
- [ ] Le logo enregistré est une data URL PNG ou JPEG d'au plus 200 000 caractères, et rien d'autre.
- [ ] Une sauvegarde v10 s'ouvre sans perte (adresse vide, pas de logo). L'export contient `schemaVersion: 11`, `adresseCabinet` et `logo`.
- [ ] Une sauvegarde dont le logo est invalide (URL externe, `javascript:`, SVG, valeur démesurée, mauvais type) **s'importe quand même**. Tout est restauré sauf le logo, qui est vide. Un avertissement dit « Le logo du cabinet n'a pas été repris : réimportez-le dans la page Cabinet. ». Le contenu invalide n'est ni stocké ni affiché.
- [ ] Aucun `localStorage` hors `storageRepository`, aucune dépendance ajoutée, aucun `v-html`.

## 11. Vérification

Recette navigateur : Playwright MCP, `npx vite --port 5199 --strictPort`, URL `http://localhost:5199/idelia/#/<route>`. Données réelles `files/idelia-sermet.json` (v10), restaurées via Paramètres → Sauvegarde. Les captures vont dans `.playwright-mcp/` (gitignoré), car elles contiennent des noms réels. On lit l'état dans `localStorage['idelia:data']` environ 1,5 s après une modification.

Fichiers d'essai à fabriquer dans le scratchpad, **jamais dans le dépôt** (script PowerShell `System.Drawing`, ou canvas dans la page puis téléchargement) :

- `logo-transparent.png` (2000 × 1000 px, fond transparent) ;
- `photo.jpg` (4000 × 3000 px) ;
- `petit.png` (120 × 80 px) ;
- `logo.svg` ;
- `faux.png` (un texte renommé) ;
- un PDF quelconque.

1. **Migration** : `localStorage.clear()`, `F5`, puis restaurer `idelia-sermet.json`. Aucune erreur. `cabinet.adresseCabinet` vaut 4 chaînes vides, `logo` vaut `null`, `schemaVersion` vaut 11. Équipe, Tournées, Planning sont identiques à avant.
2. **Menu** : vérifier l'ordre déplié (§10, 1ᵉʳ critère). Replier : pas de trait au-dessus d'Accueil, infobulle « Paramètres » au survol. Réduire la fenêtre à 900 px : même rendu en rail, infobulles présentes. Naviguer vers `/cabinet`, `/parametres`, `/`, puis une page Souhaits : un seul lien porte `aria-current="page"`, et c'est le bon.
3. **Rubriques déplacées** : sur `/cabinet`, décocher tous les jours (message, rien d'enregistré), puis recocher. Décocher le samedi, puis générer un planning : aucune affectation le samedi. Recocher. Saisir repos 8 (message), puis 2 avec 6 consécutifs (avertissement de cohérence).
4. **Paramètres** : seules les cinq rubriques restantes sont présentes. Changer « Premier jour de la semaine » : la grille du planning suit.
5. **Identité** : saisir « Cabinet Sermet » et une adresse complète. Attendre 1 s, puis `F5` : tout est conservé. Code postal « 6900 » : message, et ni l'adresse ni le code postal ne changent dans le stockage. « 69 003 » : enregistré sous « 69003 ». Saisir « Lyon  » : la valeur stockée est « Lyon ».
6. **Logo** (via `browser_file_upload` après clic sur « Choisir une image ») :
   - `logo-transparent.png` : aperçu, « Logo enregistré. » ; la valeur stockée commence par `data:image/png;base64,` et fait au plus 200 000 caractères ; l'image décodée en console (`new Image()`) mesure 400 × 200 px ;
   - `photo.jpg` : `data:image/jpeg`, 400 × 300 px ;
   - `petit.png` : 120 × 80 px ;
   - `logo.svg`, le PDF et `faux.png` : message adapté, l'ancien logo reste en place ;
   - « Retirer le logo » puis « Annuler » : inchangé ; puis « Retirer » : `logo: null`, et le focus est sur « Choisir une image ».
7. **Sombre** : basculer en mode sombre. Le cadre d'aperçu du logo reste blanc. Les champs, les messages et l'en-tête du bloc sont lisibles.
8. **Sauvegarde** : avec un logo, exporter : le JSON contient `cabinet.logo`. Effacer toutes les données, puis restaurer : le logo revient.
9. **Import forgé** : copier l'export dans le scratchpad et remplacer `logo` successivement par `"https://exemple.org/x.png"`, `"javascript:alert(1)"`, `"data:image/svg+xml;base64,PHN2Zz4="`, puis une chaîne `data:image/png;base64,` suivie de 250 000 « A », puis `42`. Pour chaque cas :
   - l'import **réussit** ;
   - le toast d'avertissement « Le logo du cabinet n'a pas été repris : réimportez-le dans la page Cabinet. » s'affiche ;
   - Équipe, Tournées, Planning et l'adresse sont restaurés ;
   - la page Cabinet montre « Aucun logo pour l'instant » ;
   - `localStorage['idelia:data']` contient `"logo":null` ;
   - aucune requête réseau vers `exemple.org` (onglet réseau / `browser_network_requests`).

   Ensuite, réimporter l'export d'origine (logo valide) : le logo revient, sans toast. `"adresseCabinet": 42` : import **refusé**, données en place intactes.
10. **Clavier** : `Tab` sur la page Cabinet. Le champ fichier caché n'est jamais atteint. « Choisir une image », « Retirer le logo » et les champs ont un focus visible. Entrée sur « Choisir une image » ouvre le sélecteur.
11. **Build** : `npm run build` réussit. Recherches `localStorage` (seul `storageRepository.js`) et `v-html` (aucune occurrence nouvelle).

## 12. Décisions à confirmer / risques

1. **SVG refusé (retenu)**, plutôt que rasterisé. Un SVG peut contenir du script et des références externes. Le rasteriser par canvas fonctionne, mais le rendu varie selon les navigateurs (polices, `foreignObject`) et ouvre une surface d'attaque pour un gain faible. Le message invite à fournir un PNG ou un JPEG. Si le porteur n'a qu'un SVG, il peut l'exporter en PNG (ou on rasterise plus tard, sans changer le stockage).
2. **Formats d'entrée PNG et JPEG seulement (retenu)**. Comme tout est réencodé, accepter aussi le WebP en entrée ne coûterait qu'une valeur dans `ACCEPT_LOGO` et `estFichierImageAcceptee`. On le garde fermé par simplicité, à ouvrir si le besoin apparaît.
3. **Plafonds : 400 px de côté et 200 000 caractères (≈ 146 Ko)**. Dans l'en-tête de 0042 (≈ 3-4 cm de large), 400 px donnent environ 250 à 300 dpi à l'impression, ce qui suffit. Le stockage local (≈ 5 Mo) garde une large marge. Les valeurs sont dans `src/domain/cabinet.js` et ajustables, mais les baisser imposerait une migration pour les logos déjà enregistrés.
4. **Logo non conforme dans un fichier importé : jamais bloquant (VALIDÉ par le porteur)**.
   - Le logo est remplacé par `null`, tout le reste est restauré, et un toast d'avertissement (0018) dit « Le logo du cabinet n'a pas été repris : réimportez-le dans la page Cabinet. ».
   - Mise en œuvre : pas de règle `logo` dans `validationImport.js`, assainissement par `normaliserLogo` dans `fromSaveDocument`, détection (`logoNonConforme`) et toast dans l'action `importer`.
   - C'est une exception assumée à la doctrine « refuser un fichier forgé » de `validationImport.js`, limitée au logo : une donnée décorative ne doit pas empêcher de récupérer le planning.
   - Au **démarrage** (`bootstrap`), un logo non conforme dans le stockage local (modification manuelle uniquement) est écarté **sans toast** (KISS). Il sera remplacé par `null` à la prochaine écriture.
5. **Transparence** : un PNG est conservé en PNG s'il tient sous le plafond. Sinon, il passe en JPEG sur **fond blanc**. C'est fidèle au papier, mais un logo transparent affiché sur fond coloré perdrait sa transparence (aucun usage prévu).
6. **Code postal à 5 chiffres (retenu)** : il couvre la métropole, la Corse et l'outre-mer. Une adresse étrangère n'est pas prévue pour un cabinet infirmier français.
7. **Groupe de tête sans titre : `aria-label="Accueil"` (décision du porteur)**. Le lecteur d'écran annoncera « groupe Accueil, lien Accueil », ce qui est légèrement redondant. L'alternative serait de ne pas poser `role="group"` sur ce groupe d'un seul lien. À trancher par l'agent `ui-ux`, en une ligne dans le gabarit.
8. **Groupe « Contrats »** : il sera ajouté par 0041, entre « Planning » et le pied du menu. Seul un commentaire le signale ici.
9. **Pas de glisser-déposer pour le logo (KISS)**. Un bouton suffit pour un geste fait une fois. `ZoneDepotFichier.vue` est propre au PDF (icône en dur) : le généraliser serait un ajout léger si le porteur le demande.
10. **Brouillons sans resynchronisation** : comme aujourd'hui dans Paramètres, chaque bloc copie les valeurs du store à sa création. Une restauration de sauvegarde se fait depuis Paramètres : en revenant sur Cabinet, les blocs sont recréés avec les nouvelles valeurs. Il n'y a pas de `watch`, qui risquerait d'écraser une saisie en cours.
11. **Le logo fait partie des données du cabinet**, pas des préférences du poste. Il est donc **exporté, importé, inclus dans la sauvegarde automatique** et effacé par « Effacer toutes les données ». Cela pèse sur la taille des fichiers de sauvegarde (≈ 200 Ko au plus).
12. **Titre « Paramètres »**, au lieu de « Paramètres du cabinet », puisque les réglages du cabinet ont déménagé.
13. **Sécurité (pour l'agent `security`)** :
    - **Entrée fichier** :
      - type vérifié deux fois (MIME ou extension, puis décodage réel par `createImageBitmap`) ;
      - SVG refusé ;
      - taille source plafonnée (10 Mo) et nombre de pixels plafonné (40 Mpx), contre les « bombes de décompression » ;
      - réencodage par canvas : seuls les pixels sont gardés, les métadonnées (EXIF/GPS) et les charges cachées sont éliminées.
    - **Valeur stockée** : uniquement `data:image/(png|jpeg);base64,<base64>` de longueur bornée (`estLogoValide`). Elle est contrôlée :
      - à la saisie (adaptateur, puis `estLogoValide`) ;
      - à l'import et au rechargement, par l'assainissement de `fromSaveDocument` (`normaliserLogo`, valeur non conforme → `null`, avertissement à l'import) ;
      - à l'affichage (`normaliserLogo` de nouveau).

      Le contenu invalide est **écarté, jamais stocké, jamais rendu** : il n'atteint ni le store, ni `localStorage`, ni un attribut `src`. Jamais d'URL externe (aucune requête réseau, aucune fuite), jamais de `javascript:`, jamais de SVG inline. Un logo invalide ne bloque pas l'import (§12 n° 4) : ce n'est pas un affaiblissement, puisque la valeur est jetée avant tout usage. Le volume reste borné par le plafond de fichier de 10 Mo.
    - **Rendu** : liaison `:src` d'un `<img>`, sans `v-html` ni `innerHTML`. La CSP existante (`vite.config.js` l.12 : `img-src 'self' data: blob:`) n'a pas à changer. Ne **pas** l'élargir à `https:`.
    - **Textes** : nom et adresse sont affichés par interpolation Vue (échappée). Longueurs bornées à la saisie (Vuelidate) et à l'import : nom en `texte` (500 caractères), adresse par `REGLES_ADRESSE` (150 / 150 / 10 / 100, issues de `LONGUEURS_MAX_ADRESSE`).
    - **Réfs** : OWASP Top 10:2025 A05 (injection), A08 (intégrité des données importées), A02 (configuration : CSP inchangée), ASVS 5.0.0 V5 (traitement des fichiers : type, taille, contenu) et V1/V2 (encodage, validation des entrées).
