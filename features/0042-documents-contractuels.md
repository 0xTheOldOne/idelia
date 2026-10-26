# Feature 0042 — Documents contractuels

- **Statut** : Fait
- **Dépend de** :
  - `0041` (modèles de contrats) : module Vuex `contrats` (`{ modeles, documents }`, getters `modeleById`, `modelesActifs`, `documents`), collection racine `documentsContrats` **déjà persistée vide en v13**, domaine pur `src/domain/contrats/` (`construireContexte`, `valeurMarqueur`, `remplacerMarqueurs`, `marqueursNonResolus` dans `marqueurs.js` ; `estDeltaModeleValide`, `clesMarqueursUtilisees` dans `delta.js` ; `estCleMarqueurValide`, `libelleMarqueur`, `estChampLibre` dans `catalogueMarqueurs.js`), champs libres `ChampLibre { cle: 'saisie.<GUID>', libelle, type }` avec `TYPES_CHAMP_LIBRE` = `'TEXTE'|'DATE'|'NOMBRE'|'TAUX_RETROCESSION'`, composant `EditeurRiche.vue` (Quill chargé à la demande par `src/adaptateurs/editeurRiche.js`), styles `_editeur-riche.scss`, enregistrement explicite des modèles (bouton, Ctrl+S, garde de sortie), groupe de menu « Contrats » (avec « Modèles » seulement) ;
  - et donc `0039` (identité du cabinet : `nomCabinet`, `adresseCabinet` (`AdressePostale`), `logo` ; `src/domain/adresse.js` : `normaliserAdresse`, `lignesAdresse`, `adresseSurUneLigne` ; `src/domain/cabinet.js` : `estLogoValide`, `LOGO_LONGUEUR_MAX` ; validation partagée `REGLES_ADRESSE` / `controlerAdresse`, contrôleur `logo`) et `0040` (`Personne.adresse`, `dateNaissance`) ;
  - également `0018` (toasts `notifications/notifier`), `0012` (impression navigateur, `@page` A4 de `src/styles/_impression.scss`, motif `DiffusionView.vue`), `0038` (sous-arbre forcé en clair par `data-bs-theme="light"`), `0004` / `0030` / `0027` (écran Équipe, liens profonds `?modifier=…&champ=remplacement`).
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (PDF par la fenêtre d'impression du navigateur, aucune lib PDF), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance via le plugin du store, jamais `localStorage` direct), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (documents inclus dans l'export/import), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, horodatages ISO UTC), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS, tokens, `d-print-none`), [0013](../docs/adr/0013-icones-phosphor.md) (icônes), [0016](../docs/adr/0016-router-mode-hash-pour-pages.md) (routes paramétrées, F5 fiable), [0022](../docs/adr/0022-theme-sombre-css-custom-properties.md) §8 (impression toujours en clair), [0023](../docs/adr/0023-editeur-riche-quill.md) (éditeur Quill, rédigé par `0041`), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS + JSDoc).

## 1. Contexte & objectif

Avec `0041`, le cabinet dispose de **modèles** de contrats de remplacement et d'avenants. Il faut maintenant **produire les documents réels** d'une personne, les **conserver** et les **imprimer** (ou les enregistrer en PDF) avec l'en-tête du cabinet.

Résultat attendu :

- une page **« Documents »** (`/contrats`) et son entrée de menu : on choisit une personne, on voit ses contrats et avenants (titre, modèle d'origine, date de création, statut) ;
- un bouton **« Contrats et avenants »** sur chaque personne active de l'Équipe, qui ouvre directement cette page ;
- **génération** depuis un modèle : Idelia remplit tout ce qu'il connaît (personne, titulaire, cabinet, date du jour) et ne demande **que le reste** (champs à compléter du modèle, informations absentes de la fiche) ; le document naît **Brouillon** ;
- le brouillon se **retouche** dans l'éditeur et s'**enregistre** comme un modèle (bouton « Enregistrer », Ctrl+S, confirmation avant de quitter), s'**imprime** pour signature, puis se **« Marque comme signé »** : il devient **figé** (lecture seule, non supprimable, seulement archivable), **nom et adresse du cabinet compris** (le logo reste celui de la page Cabinet) ;
- le document est une **copie figée** : modifier le modèle ensuite ne change rien aux documents déjà créés ;
- **rappel non bloquant** si le taux de rétrocession saisi diffère de celui de la fiche, **sans jamais modifier la fiche** automatiquement ;
- **aperçu imprimable** A4, toujours clair, avec en-tête **logo + nom + adresse du cabinet**, via `window.print()`.

**Hors périmètre** : signature électronique, envoi par e-mail du document, lien avenant ↔ contrat parent, historique des versions d'un brouillon, en-tête/pied répétés sur chaque page imprimée, numérotation des pages (§12).

## 2. Écrans concernés

| Route | Nom | Écran | Changement |
|---|---|---|---|
| `/contrats` | `contrats` | **Documents** → `ContratsView.vue` | **Créé** : choix de la personne. |
| `/contrats/:id` | `contrats-personne` | **Documents** d'une personne → `ContratsView.vue` (même composant) | **Créé** : liste des documents de la personne `:id`, bouton « Nouveau document ». |
| `/contrats/:id/documents/:documentId` | `document-contrat` | **Document** → `DocumentContratView.vue` | **Créé** : feuille A4 (édition du brouillon ou lecture seule), signature, impression (§12 n° 1). |
| `/equipe` | `equipe` | **Équipe** → `EquipeView.vue` | **Modifié** : bouton icône « Contrats et avenants » entre Souhaits et Archiver. |
| (menu) | — | `MenuLateral.vue` | **Modifié** : entrée **« Documents »** (`/contrats`, `PhSignature`) insérée **en tête** du groupe « Contrats », avant « Modèles » (décision `0041` §12 n° 1). |

`MenuLateral.estActif` teste le préfixe `chemin/` : « Documents » reste actif sur `/contrats/...`, et `/modeles-contrats` ne l'active pas (choix de chemin de `0041`).

### 2.1 Parcours visé (utilisatrice peu à l'aise avec l'informatique)

1. Dans **Équipe**, sur la ligne de Marie, elle clique l'icône **signature** (infobulle « Contrats et avenants »). Elle arrive sur « Contrats et avenants de Marie Dupont ».
2. Elle clique **« Nouveau document »** (à droite du titre). Une fenêtre s'ouvre : elle choisit « Avenant – taux de rétrocession ».
3. La fenêtre ne lui demande que ce qu'Idelia ne sait pas : « Date du contrat initial », « Date d'effet », « Nouveau taux de rétrocession (en %) », « Lieu de signature ». Sous le taux, une aide indique « Taux actuel sur la fiche : 10 % ». Si l'adresse de Marie manque, une rubrique « Informations absentes de la fiche » la propose, **facultative**.
4. Elle clique **« Créer le brouillon »**. Elle arrive sur la feuille A4 du document, déjà remplie, avec le logo et l'adresse du cabinet en haut. Un toast confirme. Si le taux saisi diffère de la fiche, un second toast **et** un encadré le rappellent, avec « Ouvrir la fiche de Marie ».
5. Elle corrige une phrase directement dans la feuille. L'état passe à « Modifications non enregistrées ». Elle clique **« Enregistrer »** (ou Ctrl+S) : « Toutes les modifications sont enregistrées » et un toast. Si elle tente de quitter sans enregistrer, Idelia lui demande « Quitter sans enregistrer ? ».
6. Elle clique **« Imprimer / Enregistrer en PDF »** : seule la feuille sort, en clair, sans menu ni boutons.
7. Une fois le papier signé, elle clique **« Marquer comme signé »**, confirme la date de signature (aujourd'hui par défaut). Le document passe en lecture seule, badge « Signé le 28/10/2026 ». Le nom et l'adresse du cabinet dans son en-tête ne bougeront plus, même si le cabinet déménage.

```
← Retour aux documents de Marie Dupont
Avenant – taux de rétrocession            [Enregistrer] [Imprimer / Enregistrer en PDF]
[Brouillon] Créé le 26/10/2026 à partir du modèle « Avenant – taux de rétrocession »
(✓) Toutes les modifications sont enregistrées
(i) Ce document est un brouillon : vous pouvez encore corriger le texte. Une fois signé, il ne pourra plus être modifié.
(!) Le taux saisi (15 %) diffère de la fiche de Marie Dupont (10 %). La fiche n'a pas été modifiée.  [Ouvrir la fiche]
Titre du document [______________________]          [Marquer comme signé] [corbeille]
[barre de mise en forme de 0041, sans « Insérer un champ »]
┌──────────────────────── feuille A4 (toujours claire) ────────────────────────┐
│ [logo]  Cabinet infirmier des Tilleuls                                      │
│         12 rue des Lilas                                                    │
│         75011 Paris                                                         │
│ ─────────────────────────────────────────────────────────────────────────── │
│ AVENANT AU CONTRAT DE REMPLACEMENT                                          │
│ Entre Madame Claire Leroy, titulaire… et Madame Marie Dupont…               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. Modèle de données touché

### 3.1 Nouvelle entité `DocumentContrat`

| Champ | Type | Règle |
|---|---|---|
| `id` | GUID | `genId()`, jamais lisible. |
| `personneId` | GUID | Personne concernée (doit exister, active ou archivée). |
| `modeleId` | GUID | Modèle d'origine (doit exister ; un modèle n'est **jamais supprimé**, seulement archivé, `0041`). |
| `titre` | string | 1 à 200 caractères, proposé = titre du modèle. |
| `type` | `TYPES_MODELE_CONTRAT` (`'CONTRAT'` \| `'AVENANT'`) | Recopié du modèle à la création. |
| `contenu` | Delta Quill `{ ops: [] }` | **Copie profonde** du Delta du modèle, **sans aucun embed `marqueur`** : tous les champs sont devenus du texte (§5.1). Jamais de HTML. |
| `valeursSaisies` | `ValeurSaisie[]` | Ce qui a été saisi à la génération (voir ci-dessous), conservé pour l'affichage et le rappel de taux. |
| `statut` | `'BROUILLON'` \| `'SIGNE'` | `BROUILLON` à la création ; `SIGNE` est définitif. |
| `signeLe` | `"YYYY-MM-DD"` \| `null` | Posé au passage en `SIGNE`, `null` en brouillon. |
| `enteteCabinet` | `EnteteCabinet` \| `null` | **`null` en brouillon** (en-tête lu en direct dans `cabinet.parametres`). **Copié au passage en `SIGNE`** : `{ nomCabinet, adresseCabinet }`, puis seul utilisé pour le nom et l'adresse du document signé. **Le logo n'est jamais copié** : l'en-tête affiche toujours le logo actuel de la page Cabinet (brouillon comme signé). |
| `archive` | boolean | `false` à la création ; seul un document `SIGNE` s'archive. |
| `createdAt`, `updatedAt` | ISO UTC | Horodatages techniques. |

`EnteteCabinet` = `{ nomCabinet: string, adresseCabinet: AdressePostale }` :

- `nomCabinet` : `trim` du nom du cabinet (`''` si absent) ;
- `adresseCabinet` : `normaliserAdresse(parametres.adresseCabinet)` (4 chaînes, `0039`).

`ValeurSaisie` = `{ cle, libelle, type, valeur }` :

- `cle` : clé du marqueur, soit un champ à compléter du modèle (`'saisie.<GUID>'`), soit une clé du catalogue absente de la fiche (`'personne.adresse'`, `'titulaire.rpps'`…) ;
- `libelle` : libellé affiché au moment de la saisie (`ChampLibre.libelle` ou `libelleMarqueur`), copie figée indépendante d'un renommage ultérieur ;
- `type` : `TYPES_CHAMP_LIBRE` (`'TEXTE'` | `'DATE'` | `'NOMBRE'` | `'TAUX_RETROCESSION'`) ;
- `valeur` : texte, date `"YYYY-MM-DD"`, nombre (y compris le taux), ou `null` si une information de fiche absente a été laissée vide.

### 3.2 `SaveDocument` : pas de migration

- `0041` persiste déjà la collection racine **`documentsContrats`** (vide) dès la **v13**, ainsi que `etatParDefaut`, `toSaveDocument`, `fromSaveDocument` et `REPLACE_ALL` pour `state.contrats.documents` (`0041` §3.2, §4.2, §12 n° 4).
- **0042 ne crée donc aucune migration** : `CURRENT_SCHEMA_VERSION` reste **13**, `src/storage/migrations.js` n'est pas modifié.
- 0042 apporte seulement :
  - la forme des éléments et leur **validation** (`REGLES_DOCUMENT_CONTRAT`, en-tête figé compris, qui remplace le contrôle minimal « liste d'objets » posé par `0041`) ;
  - l'**intégrité** (`verifierIntegrite`) : `documentsContrats[].personneId` ∈ personnes, `documentsContrats[].modeleId` ∈ `modelesContrats` ;
  - la **normalisation** à la relecture (`normaliserDocument` dans `fromSaveDocument`).
- Un fichier v13 produit par `0041` (`documentsContrats: []`) reste valide tel quel.

### 3.3 Volumétrie

- Un contrat de 2 pages ≈ 6 à 10 Ko de Delta JSON ; l'en-tête figé (nom + adresse) ajoute quelques centaines de caractères. 100 documents ≈ 1 Mo.
- Le `localStorage` est limité à ≈ 5 millions de caractères par origine, logo du cabinet (une seule fois), modèles et plannings compris. Quelques centaines de documents restent tenables (§12 n° 6, mesure en recette §11 n° 12).

## 4. Store (Vuex)

Module **`contrats`** (`src/store/modules/contrats.js`, livré par `0041`, **modifier**). L'état `documents: []`, le getter `documents`, la mutation `REPLACE({ modeles, documents })` et `REPLACE_ALL` existent déjà : **`src/store/index.js` n'est pas modifié**. Le plugin de persistance sauvegarde toute mutation hors `ui/*` et `notifications/*`.

L'état d'édition d'un brouillon (contenu en cours, titre, « modifié ») vit **dans la vue**, comme pour les modèles (`0041` §4.3) : le store ne reçoit le contenu qu'à l'enregistrement explicite.

- **Getters** (ajouts) :
  - `documentById: (state) => (id) => …` ;
  - `documentsDe: (state) => (personneId) => trierDocuments(state.documents.filter(…))` (domaine §5.1) ;
  - `nbDocumentsDe: (state) => (personneId) => …` (pour le sélecteur de personne).
- **Mutations** (fines, sans logique, nommage aligné sur `ADD_MODELE` / `UPDATE_MODELE`) : `ADD_DOCUMENT(doc)`, `UPDATE_DOCUMENT({ id, patch })` (fusion immuable par `id`), `REMOVE_DOCUMENT(id)`.
- **Actions** (horodatages posés ici, `new Date().toISOString()` ; aucune ne rejette) :
  - `genererDocument({ getters, commit, dispatch, rootState, rootGetters }, { personneId, modeleId, titre, valeursSaisies })` → `{ ok: true, id }` ou `{ ok: false, message }`. Récupère la personne, `rootState.personnes.items` (titulaire résolu par `construireContexte`), `rootGetters['cabinet/parametres']` (passé tel quel comme `cabinet`, conformément à `ContexteMarqueurs` de `0041`), le modèle (`getters.modeleById`) ; appelle `genererDocument` du domaine avec `aujourdhui = dateUtil.format(new Date())` ; `ADD_DOCUMENT` ; toast **succès** « Le brouillon « {titre} » a été créé. » ; puis, si `ecartTauxRetrocession(...)` n'est pas `null`, toast **avertissement** (§8).
  - `enregistrerBrouillon({ commit, dispatch, getters }, { id, titre, contenu })` → `true` / `false`. Renvoie `false` sans rien faire si `!estModifiable(doc)` ; sinon `UPDATE_DOCUMENT` avec `titre`, `contenu`, `updatedAt`. Toast succès « Le brouillon « {titre} » a été enregistré. » (comme `enregistrerModele`).
  - `marquerSigne({ commit, dispatch, getters, rootGetters }, { id, signeLe, titre, contenu })` : garde `estModifiable` ; **un seul** patch `{ titre?, contenu?, statut: 'SIGNE', signeLe, enteteCabinet: figerEnteteCabinet(rootGetters['cabinet/parametres']), updatedAt }` (les modifications non enregistrées sont intégrées, un seul toast) ; toast succès « « {titre} » est marqué comme signé le {JJ/MM/AAAA}. Il ne peut plus être modifié. »
  - `supprimerBrouillon(id)` : garde `estSupprimable` (brouillon uniquement) ; `REMOVE_DOCUMENT` ; toast info « Le brouillon « {titre} » a été supprimé. »
  - `archiverDocument(id)` / `restaurerDocument(id)` : garde `estArchivable` (signé) ; patch `archive` + `updatedAt` ; toast info « « {titre} » a été archivé. Vous le retrouverez dans « Documents archivés ». » / « … a été restauré. »
- JSDoc d'en-tête du module complétée (partie documents, invariants).

## 5. Domaine (logique pure)

### 5.1 `src/domain/contrats/documents.js` (**créer**)

Module pur : aucun import Vue/Vuex/Quill, aucun `new Date()` (horloge injectée via `maintenant` / `aujourdhui`). Il **réutilise** `src/domain/contrats/` de `0041`, `src/domain/adresse.js` et `src/domain/cabinet.js` de `0039`, et n'en duplique rien : le formatage des valeurs (dates longues « 3 novembre 2026 », nombres à virgule, taux, adresses via `adresseSurUneLigne`) reste dans `valeurMarqueur`.

```js
/** @typedef {'BROUILLON'|'SIGNE'} StatutDocument */
/** @typedef {{ cle: string, libelle: string, type: 'TEXTE'|'DATE'|'NOMBRE'|'TAUX_RETROCESSION', valeur: (string|number|null) }} ValeurSaisie */
/** @typedef {{ cle: string, libelle: string, type: ValeurSaisie['type'], requis: boolean }} ChampGeneration */
/** @typedef {{ nomCabinet: string, adresseCabinet: import('@/domain/adresse.js').AdressePostale }} EnteteCabinet */
/** @typedef {EnteteCabinet & { logo: (string|null) }} EnteteAffichee */
/** @typedef {Object} DocumentContrat — voir §3.1 (JSDoc complète, une @property par champ). */

export const STATUTS_DOCUMENT = Object.freeze(['BROUILLON', 'SIGNE']);
/** Texte posé à la place d'une information de fiche laissée vide : à compléter à la main sur le papier. */
export const BLANC_A_COMPLETER = '……………………';

/** Libellé FR d'un statut (« Brouillon », « Signé »). */
export function libelleStatutDocument(statut) {}

/**
 * Champs à demander à la génération, dans l'ordre d'apparition dans le texte :
 * - `libres` : `modele.champsLibres` dont la clé figure dans `clesMarqueursUtilisees(modele.contenu)`, requis ;
 * - `manquants` : `marqueursNonResolus(modele.contenu, contexte)` hors `saisie.*`, facultatifs ;
 *   type 'DATE' pour les clés de date du catalogue (`*.dateNaissance`, `personne.dateEntree`), 'TEXTE' sinon.
 * `contexte` = `construireContexte(...)` sans saisies. `date.jour` est toujours résolu, donc jamais demandé.
 * @returns {{ libres: ChampGeneration[], manquants: ChampGeneration[] }}
 */
export function champsAGenerer(modele, contexte) {}

/** '12,5' → 12.5 ; ' 10 ' → 10 ; '' / 'abc' → null. */
export function lireNombreSaisi(texte) {}

/**
 * Construit le document Brouillon :
 * 1. `contexte = construireContexte({ personne, personnes, cabinet, aujourdhui, saisies, champsLibres: modele.champsLibres })`,
 *    `saisies` = valeurs des `saisie.*` de `valeursSaisies`, par clé ;
 * 2. `remplacerMarqueurs(structuredClone(modele.contenu), contexte)` (le modèle n'est jamais muté) ;
 * 3. figeage des embeds `marqueur` restants (informations de fiche absentes) : chaque embed devient un
 *    `insert` texte, avec les attributs de l'embed : valeur saisie (DATE → `dateUtil.formatDateLongueFr`,
 *    TEXTE → `trim`) ou `BLANC_A_COMPLETER` si vide. Invariant : le Delta résultat ne contient AUCUN embed.
 * Statut BROUILLON, signeLe null, enteteCabinet null, archive false, createdAt = updatedAt = maintenant.
 * @param {{ modele, personne, personnes: object[], cabinet, titre: string, valeursSaisies: ValeurSaisie[], aujourdhui: string, maintenant: string }} p
 * @returns {DocumentContrat}
 */
export function genererDocument(p) {}

/** Champ « taux de rétrocession » : `champ.type === 'TAUX_RETROCESSION'` (type dédié de 0041, pas de détection par le libellé). */
export function estChampTaux(champ) {}

/**
 * Écart entre la valeur saisie d'un champ TAUX_RETROCESSION et `personne.tauxRetrocession`.
 * `null` si aucun champ de ce type, ou valeurs égales, ou fiche vide d'une personne non remplaçante.
 * @returns {null | { valeurSaisie: number, valeurFiche: (number|null) }}
 */
export function ecartTauxRetrocession({ valeursSaisies, personne }) {}

/**
 * Copie de l'en-tête à figer à la signature : `{ nomCabinet: trim, adresseCabinet: normaliserAdresse(...) }`.
 * Le logo n'est PAS copié. Nouvelle référence, aucun partage avec `parametres`.
 * @returns {EnteteCabinet}
 */
export function figerEnteteCabinet(parametres) {}

/**
 * En-tête à afficher et imprimer :
 * - nom + adresse : `document.enteteCabinet` si le document est SIGNE et qu'il en a un, sinon `figerEnteteCabinet(parametres)`
 *   (lecture en direct, cas du brouillon) ;
 * - logo : TOUJOURS le logo actuel, `estLogoValide(parametres.logo) ? parametres.logo : null` (brouillon comme signé).
 * @returns {EnteteAffichee}
 */
export function enteteAffichee(document, parametres) {}

/** `true` si l'en-tête affiché ne contient ni nom, ni adresse, ni logo. */
export function enteteEstVide(entete) {}

export function estModifiable(doc) {}   // BROUILLON
export function estSupprimable(doc) {}  // BROUILLON
export function estArchivable(doc) {}   // SIGNE

/** Date de signature acceptable : date valide (dateUtil.estDateValide) et ≤ aujourdhui (comparaison de chaînes). */
export function estDateSignatureValide(date, aujourdhui) {}

/** Tri d'affichage : createdAt décroissant, puis titre (localeCompare 'fr'). Ne mute pas l'entrée. */
export function trierDocuments(documents) {}

/** Titre de l'onglet = nom de PDF proposé : « {titre} - {Prénom Nom} - JJ-MM-AAAA », sans / \ : * ? " < > |. */
export function titreFichierDocument(document, personne) {}

/**
 * Normalisation tolérante à la relecture (fromSaveDocument) : valeursSaisies absent → [],
 * archive absent → false, signeLe invalide → null, enteteCabinet → null en brouillon ou si absent
 * (le document signé retombe alors sur l'en-tête en direct), sinon réduit à { nomCabinet, adresseCabinet }
 * avec adresse normalisée (toute autre clé, dont `logo`, est retirée). Jamais bloquant.
 */
export function normaliserDocument(doc) {}
```

Règles à respecter :

- **Copie figée du texte** : copie profonde du Delta **avant** remplacement (`remplacerMarqueurs` ne mute déjà pas son entrée, la copie est une défense en profondeur). Vérification : générer, puis modifier le modèle, le document ne change pas.
- **Nom et adresse figés à la signature** : après signature, modifier le nom ou l'adresse du cabinet ne change pas le document signé ; un brouillon, lui, suit le cabinet. Le **logo** suit toujours la page Cabinet (décision du porteur, §12 n° 5).
- **Aucun embed dans un document** : le contenu se rouvre dans l'éditeur sans dépendre du catalogue ni des `champsLibres` du modèle (qui peuvent changer ou être archivés).
- Les valeurs sont insérées comme **texte** dans les `insert` (jamais de HTML), avec les attributs de mise en forme de l'embed d'origine.
- Une information de fiche absente laissée vide devient `BLANC_A_COMPLETER` dans le texte, et `valeur: null` dans `valeursSaisies`. Elle n'est **jamais** recopiée sur la fiche.
- `ecartTauxRetrocession` compare des nombres ; une fiche à `null` ne déclenche le rappel que si `personne.statut === 'REMPLACANT'` (message « la fiche n'indique pas de taux »).

### 5.2 `src/domain/schema.js` (**modifier**)

- `fromSaveDocument` : `documents: (doc.documentsContrats ?? []).map(normaliserDocument)` (au lieu de la recopie brute de `0041`).
- `verifierIntegrite` : pour chaque document, `personneId` et `modeleId` doivent exister (`doc.modelesContrats ?? []`). Messages FR, motif existant : « Document « {id} » : la personne « {personneId} » référencée est introuvable. » / « … : le modèle « {modeleId} » référencé est introuvable. » Mettre à jour le JSDoc (liste des contrôles).
- Typedef `SaveDocument.documentsContrats` : `DocumentContrat[]` (au lieu de `object[]`).
- `etatParDefaut`, `toSaveDocument` : **inchangés** (posés par `0041`).

### 5.3 `src/domain/validationImport.js` (**modifier**)

- `MAX.documentsContrats` (5000, posé par `0041`) inchangé ; ajouter `MAX.valeursSaisies: 100`.
- Nouveaux contrôleurs : `texteOuNombre` (`v` chaîne ≤ 2000 caractères **ou** nombre fini) et `cleMarqueur` (`estCleMarqueurValide(v)`, `0041`).
- `REGLES_DOCUMENT_CONTRAT` : `id` (id, requis), `personneId` (id, requis), `modeleId` (id, requis), `titre` (texte, max 200, requis), `type` (enum `TYPES_MODELE_CONTRAT`, requis), `contenu` (contrôleur **`delta`** de `0041`, requis), `valeursSaisies` (tableau, max `MAX.valeursSaisies`), `statut` (enum `STATUTS_DOCUMENT`, requis), `signeLe` (date), `enteteCabinet` (objet, facultatif), `archive` (booléen), `createdAt` / `updatedAt` (horodatage).
- `REGLES_VALEUR_SAISIE` : `cle` (`cleMarqueur`, requis), `libelle` (texte, max 80), `type` (enum `TYPES_CHAMP_LIBRE`, requis), `valeur` (`texteOuNombre`).
- `REGLES_ENTETE_CABINET` : `nomCabinet` (texte, comme `REGLES_CABINET.nomCabinet`), `adresseCabinet` (objet, puis `controlerAdresse` de `0039`). **Pas de `logo`** : il n'est jamais figé ; une clé `logo` présente dans un fichier est ignorée (tolérance des clés inconnues) et retirée par `normaliserDocument`. Appliqué dans `verifierStructure`, après les collections, à chaque document dont `enteteCabinet` est un objet. Message type : « Document n°3, en-tête : le champ « nomCabinet » est invalide. »
- `COLLECTIONS` : ajouter `{ nom: 'documentsContrats', regles: REGLES_DOCUMENT_CONTRAT, libelle: 'Document', sous: [{ champ: 'valeursSaisies', regles: REGLES_VALEUR_SAISIE, libelle: 'valeur saisie' }] }`, et **retirer** le contrôle minimal de `documentsContrats` posé par `0041` dans `verifierStructure` (désormais couvert, plafond compris).
- Le contrôleur `delta` (`estDeltaModeleValide`) accepte les embeds `marqueur` : un document importé qui en contiendrait reste lisible (les embeds s'afficheraient en pastilles). Ce n'est pas bloquant ; l'invariant « aucun embed » est garanti à la génération.

## 6. Composants

### 6.1 Fichiers

| Fichier | Type | Responsabilité |
|---|---|---|
| `src/router/index.js` | **modifier** | Routes plates **paresseuses** (comme `0041`) : `contrats` et `contrats-personne` (même composant `ContratsView`), `document-contrat` (`DocumentContratView`) ; commentaire d'en-tête (rechargement direct fiable, motif `souhaits`). |
| `src/components/communs/MenuLateral.vue` | **modifier** | Item `{ nom: 'contrats', chemin: '/contrats', libelle: 'Documents', icone: 'PhSignature' }` en **tête** du groupe « Contrats » ; import et enregistrement de `PhSignature`. |
| `src/views/ContratsView.vue` | **créer** | Lit `this.$route.params.id` (computed, motif `SouhaitsView`). En-tête : `h1` « Documents » sans personne, « Contrats et avenants de {Prénom Nom} » sinon, bouton **« Nouveau document »** (`btn-primary`, `PhFilePlus`) **à droite du titre**, masqué si personne archivée ou absente. Sélecteur de personne (§6.2). Liste via `ListeDocumentsPersonne`. Section repliable « Documents archivés (n) » (motif Équipe). Personne introuvable : « Cette personne est introuvable. » + « Retour à l'équipe » (motif `SouhaitsView`). Orchestre `ModaleNouveauDocument` et les confirmations (`DialogueConfirmation`). Aucune logique métier. |
| `src/components/contrats/ListeDocumentsPersonne.vue` | **créer** | Props `documents`, `archives` (Boolean). Titre du modèle d'origine lu via `contrats/modeleById` (archivé compris). Une ligne par document : icône `PhFileText` + libellé de type (`libelleTypeModeleContrat`), **titre en lien** vers `document-contrat`, « Créé le JJ/MM/AAAA à partir de « {modèle} » », `BadgeStatutDocument`. Actions en **icône seule + infobulle** (≥ `$cible-cliquable-min`, libellé `d-md-none` sous `md`, motif Équipe) : « Ouvrir » (`PhEye`, lien), « Supprimer le brouillon » (`PhTrash`, `btn-outline-danger`, brouillon) ou « Archiver » (`PhArchive`, signé) ; en mode `archives`, « Restaurer » (`PhArrowCounterClockwise`). Émet `supprimer`, `archiver`, `restaurer`. |
| `src/components/contrats/BadgeStatutDocument.vue` | **créer** | Badge texte + icône, jamais la couleur seule : « Brouillon » (`PhPencilSimpleLine`, ton avertissement), « Signé le JJ/MM/AAAA » (`PhSealCheck`, ton succès), « Archivé » en plus si `archive`. |
| `src/components/contrats/ModaleNouveauDocument.vue` | **créer** | Sur `ModaleBase`. Props `visible`, `personne`, `personnes`, `cabinet`, `modeles` (= `modelesActifs`). Deux blocs : (1) **choix du modèle** (radios en cartes, groupées « Contrats » / « Avenants », présélection s'il n'y en a qu'un) ; (2) une fois le modèle choisi, « Titre du document » (prérempli), puis `champsAGenerer` → champs à compléter (requis), puis rubrique « Informations absentes de la fiche de {Prénom} » (facultatives ; si toutes les `titulaire.*` manquent, phrase « Aucune titulaire remplacée n'est indiquée sur la fiche » avant le groupe). Type : `TEXTE` → `input text`, `DATE` → `input type="date"`, `NOMBRE` et `TAUX_RETROCESSION` → `input text inputmode="decimal"` lu par `lireNombreSaisi` ; pour `TAUX_RETROCESSION`, suffixe visuel « % » et aide « Taux actuel sur la fiche : 10 % » (ou « non renseigné »). Vuelidate (§7). Pied : « Annuler » / **« Créer le brouillon »**. Émet `creer({ modeleId, titre, valeursSaisies })`, `annuler`. Aucun modèle actif : message + lien « Voir les modèles » vers `/modeles-contrats`. |
| `src/views/DocumentContratView.vue` | **créer** | Lit `params.id` (personne) et `params.documentId` ; introuvable (ou `personneId` ≠ `id`) : « Ce document est introuvable. » + retour. **Barre d'outils `d-print-none`** : lien « Retour aux documents de {Prénom Nom} », `h1` = titre ; **à droite du titre** : en brouillon, **« Enregistrer »** (`btn-primary`, `PhFloppyDisk`, désactivé tant que rien n'a changé) puis « Imprimer / Enregistrer en PDF » (`btn-outline-primary`, `PhPrinter`) ; en signé, « Imprimer / Enregistrer en PDF » en `btn-primary`. `BadgeStatutDocument` + « Créé le … à partir du modèle « … » ». En brouillon : **état d'enregistrement permanent** (`role="status"`, motif `ModeleContratView`) « Toutes les modifications sont enregistrées » / « Modifications non enregistrées » (`PhWarningCircle` + texte), champ « Titre du document » (fait partie des modifications à enregistrer), boutons « Marquer comme signé » (`btn-outline-primary`, `PhSealCheck`) et « Supprimer le brouillon » (icône `PhTrash` + infobulle). Signé : « Archiver » / « Restaurer ». Encadré d'état (brouillon / signé), encadré de rappel de taux (§8) avec lien « Ouvrir la fiche de {Prénom} » (`{ name: 'equipe', query: { modifier: id, champ: 'remplacement' } }`, masqué si personne archivée). Puis `FeuilleDocument`. **Garde de sortie** identique à `ModeleContratView` (`0041` §6.6) : `beforeRouteLeave` / `beforeRouteUpdate` → `DialogueConfirmation` « Quitter sans enregistrer ? » (« Rester sur la page » par défaut, « Quitter sans enregistrer » `danger`) si `modifie` ; `beforeunload` seulement si `modifie` ; **Ctrl+S** (`preventDefault`) en brouillon. Gère `document.title` (posé au montage, restauré en `beforeUnmount`, motif `DiffusionView`). |
| `src/components/contrats/FeuilleDocument.vue` | **créer** | `<article class="feuille-document" data-bs-theme="light">` (motif `FeuilleDiffusion`) : `EnTeteCabinet` (prop `entete` = `enteteAffichee(document, parametres)`), puis **`EditeurRiche`** (`0041`) : props `contenu` = `document.contenu`, `champsLibres` = `[]`, `lectureSeule` = `!modifiable`, `libelleAccessible` = « Texte du document « {titre} » » (+ « , lecture seule »), `avecInsertionChamps` = `false`. Relaie `@modifie` (émis par `0041` sur source `user` uniquement) ; expose `lireContenu()` (délègue à `this.$refs.editeur`). Jamais de `v-html`. |
| `src/components/contrats/EditeurRiche.vue`, `BarreOutilsEditeur.vue` (`0041`) | **modifier** | Prop `avecInsertionChamps` (Boolean, défaut `true`) transmise à la barre pour masquer `MenuInsererChamp`. En `lectureSeule`, la barre d'outils **n'est pas rendue**. Rétrocompatible pour `ModeleContratView`. |
| `src/components/contrats/EnTeteCabinet.vue` | **créer** | Props `entete` (`EnteteAffichee` : nom + adresse figés ou en direct, logo toujours actuel), `lienCabinet` (Boolean : `true` en brouillon). Logo (`<img :src="entete.logo" alt="">` seulement si `estLogoValide`, défense en profondeur), nom du cabinet en gras, adresse ligne par ligne via **`lignesAdresse(entete.adresseCabinet)`** (`0039`), filet séparateur. Éléments vides non affichés. Si `enteteEstVide` : rien à l'impression ; à l'écran (`d-print-none`), si `lienCabinet`, « L'en-tête est vide : renseignez le nom, l'adresse et le logo dans la page Cabinet. » + lien `/cabinet`. Réutilisable plus tard par d'autres impressions. |
| `src/components/communs/DialogueConfirmation.vue` | **modifier** | Ajouter un **slot par défaut facultatif** rendu sous le message (`<slot />`), pour la date de signature. Rétrocompatible : aucun appelant existant ne change. |
| `src/views/EquipeView.vue` | **modifier** | Bouton « Contrats et avenants » (§6.3). |

### 6.2 Sélecteur de personne (`ContratsView`)

- `<label for="contrats-personne">Personne</label>` + `<select class="form-select">` : « Choisir une personne… », puis les personnes **actives** triées nom puis prénom (tri local de présentation, comme Équipe), libellé « Prénom Nom — 2 documents » (`nbDocumentsDe`).
- Case `form-check` « Afficher aussi les personnes archivées » : ajoute un `<optgroup label="Personnes archivées">`. Cochée d'office si `:id` désigne une personne archivée.
- `@change` → `$router.push({ name: 'contrats-personne', params: { id } })` (l'URL reste partageable et rechargeable).
- Sans personne : état vide « Choisissez une personne pour voir ses contrats et avenants. »
- Personne archivée : documents consultables et imprimables ; pas de « Nouveau document », avec l'aide « Restaurez {Prénom} dans Équipe pour lui créer un nouveau document. »

### 6.3 Bouton dans Équipe (`EquipeView.vue`)

Entre le `router-link` Souhaits (l. 90-98) et le bouton Archiver (l. 99-108), même gabarit que Souhaits :

```html
<router-link
  class="btn btn-outline-secondary equipe-bouton-icone"
  title="Contrats et avenants"
  :aria-label="`Contrats et avenants de ${nomComplet(personne)}`"
  :to="{ name: 'contrats-personne', params: { id: personne.id } }"
>
  <PhSignature :size="18" aria-hidden="true" />
  <span class="d-md-none" aria-hidden="true">Contrats et avenants</span>
</router-link>
```

Importer et déclarer `PhSignature` (**choix tranché par le porteur**). C'est la même icône que l'entrée de menu « Documents » (`/contrats`) ajoutée au §6.1 : l'utilisatrice reconnaît le même repère partout. L'espace avant Archiver reste assuré par `.equipe-bouton-archiver { margin-left: t.$espace-3 }` (l. 544-546) : **aucun style à ajouter**. Compléter le JSDoc d'en-tête (mention `0042`). Liste des archivées inchangée (§12 n° 7).

### 6.4 Styles d'impression

- **`src/styles/_tokens.scss` (modifier)**, section « Impression » : `$impression-marge-interieure-document: 10mm` (s'ajoute aux 10 mm de `@page` : 20 mm au total), `$impression-taille-texte-document: 11pt`, `$impression-hauteur-logo-document: 18mm`. Valeurs fixes (tokens d'impression, ADR 0022), ajustables par `ui-ux`.
- **`FeuilleDocument.vue`** (scoped, `:deep()` pour le DOM Quill) :
  - surcharges de `_editeur-riche.scss` (`0041`) **dans la feuille** : `.ql-editor` sans bordure, sans rayon, fond transparent, `min-height: auto`, `max-width: none`, `padding: 0`, police `$impression-taille-texte-document` (aperçu fidèle) ;
  - à l'écran : largeur `$impression-largeur-feuille`, `max-width: 100%` + défilement horizontal du conteneur si l'écran est étroit, padding = 20 mm, fond `$couleur-fond` (clair, sous-arbre `data-bs-theme="light"`), `$ombre-legere` ; la barre de mise en forme reste **au-dessus** de la feuille et suit le thème ;
  - à l'impression : `width: auto; margin: 0; box-shadow: none; padding: t.$impression-marge-interieure-document` ; barre de mise en forme masquée (`d-print-none` sur son conteneur) ; `.ql-editor { height: auto; overflow: visible }` ; `p { orphans: 3; widows: 3 }` ; `break-inside: avoid` sur l'en-tête.
- **`EnTeteCabinet.vue`** : `print-color-adjust: exact` (+ `-webkit-`) sur le logo, hauteur `$impression-hauteur-logo-document`.
- **Aucune nouvelle règle `@page`** : on garde l'A4 portrait de `_impression.scss`. Menu, toasts et bandeaux sont déjà masqués à l'impression (`App.vue`, `PileNotifications`, `d-print-none`). En sombre, `beforeprint` et `@media print` repassent tout en clair (0038) ; la feuille est en plus forcée claire par `data-bs-theme="light"`.
- L'impression reproduit **ce qui est affiché**, enregistré ou non.
- La feuille **en brouillon** s'imprime **exactement** comme la feuille signée : pas de filigrane « Brouillon », car on imprime le brouillon pour le faire signer (§12 n° 3).

## 7. Règles de validation

Vuelidate, messages FR orientés correction, affichés après interaction sur le champ ou à la tentative de validation (jamais à l'ouverture).

| Champ | Règle | Message |
|---|---|---|
| Modèle | requis | « Choisissez un modèle de document. » |
| Titre du document | requis, ≤ 200 | « Donnez un titre au document. » / « Le titre est trop long (200 caractères au maximum). » |
| Champ à compléter `TEXTE` | requis, ≤ 500 | « Renseignez « {libellé} ». » / « Ce texte est trop long (500 caractères au maximum). » |
| Champ à compléter `DATE` | requis, `dateUtil.estDateValide` | « Renseignez « {libellé} ». » / « Saisissez une date valide (jour/mois/année). » |
| Champ à compléter `NOMBRE` | requis, `lireNombreSaisi` ≠ `null` | « Saisissez un nombre, par exemple 12,5. » |
| Champ à compléter `TAUX_RETROCESSION` | requis, nombre, 0 ≤ n ≤ 100 | « Saisissez un nombre, par exemple 12,5. » / « Le taux doit être compris entre 0 et 100 %. » |
| Informations absentes de la fiche | **facultatives**, mêmes contrôles de format si remplies | idem |
| Titre (page du brouillon) | requis, ≤ 200 ; contrôlé à « Enregistrer », à Ctrl+S et à la signature, qui sont refusés tant qu'il est invalide (message sous le champ, focus dessus) | idem titre |
| Date de signature | requis, `estDateSignatureValide` (pas dans le futur), défaut = aujourd'hui | « Indiquez la date de signature. » / « La date de signature ne peut pas être dans le futur. » |

Astuce d'implémentation : les clés de marqueurs contiennent un point et un GUID (`saisie.<GUID>`). Dans l'état du formulaire, indexer les champs par une clé sûre (`c0`, `c1`…) et refaire la correspondance vers `cle` à l'envoi. Les règles Vuelidate sont construites dynamiquement dans `validations()` à partir de `champsAGenerer`.

Signature : « Marquer comme signé » valide la date ; si elle est invalide, le message s'affiche et la fenêtre reste ouverte.

## 8. Points d'attention ergonomie

- **Ne demander que l'inconnu** : tout ce que la fiche et le cabinet savent est rempli automatiquement. Les informations de fiche absentes sont **facultatives** et expliquées : « Laissez vide pour compléter à la main sur le papier. Pour ne plus avoir à les saisir, complétez la fiche dans Équipe. »
- **Rappel de taux, jamais d'effet caché** (champ de type « Taux de rétrocession », `0041`) :
  - dans la fenêtre : aide « Taux actuel sur la fiche : 10 % » sous le champ ;
  - à la création : toast avertissement « Le taux saisi (15 %) diffère de celui de la fiche de Marie Dupont (10 %). La fiche n'a pas été modifiée : mettez-la à jour dans Équipe si besoin. » (fiche vide : « La fiche de Marie Dupont n'indique pas de taux de rétrocession. ») ;
  - sur la page du document (brouillon **et** signé), un encadré `alert-warning` `d-print-none` avec le même texte et « Ouvrir la fiche de Marie », qui disparaît dès que la fiche est alignée.
- **Enregistrement homogène avec les modèles** (`0041`) : bouton principal « Enregistrer » à droite du titre, état permanent « Toutes les modifications sont enregistrées » / « Modifications non enregistrées », Ctrl+S, confirmation « Quitter sans enregistrer ? » (bouton par défaut « Rester sur la page »), alerte du navigateur en fermant l'onglet. Même vocabulaire, mêmes icônes.
- **Signer sans perdre de modification** : si des modifications ne sont pas enregistrées, la confirmation de signature l'indique (« Vos dernières modifications seront enregistrées avec la signature. ») et les intègre ; pas de double étape.
- **Statuts lisibles** : « Brouillon » / « Signé le … » / « Archivé », toujours texte + icône. Encadré d'état explicite : « Ce document est un brouillon : vous pouvez encore corriger le texte. Une fois signé, il ne pourra plus être modifié. » / « Ce document est signé : il ne peut plus être modifié, ni le nom ni l'adresse du cabinet dans son en-tête. Vous pouvez l'imprimer ou l'archiver. »
- **Irréversibilité annoncée** : la confirmation de signature dit clairement « Une fois marqué comme signé, « {titre} » ne pourra plus être modifié ni supprimé. Le nom et l'adresse du cabinet seront conservés tels qu'ils sont aujourd'hui. Vous pourrez toujours l'imprimer ou l'archiver. » La suppression d'un brouillon passe par `DialogueConfirmation` `variante-confirmer="danger"` : « Le brouillon « {titre} » sera définitivement supprimé. Cette action ne peut pas être annulée. » L'archivage, réversible, se fait **sans** confirmation (toast + section « Documents archivés »).
- **Aperçu = tirage** : la feuille A4 à l'écran est celle qui s'imprime ; en brouillon, on corrige **dans** la feuille.
- **Deux « Enregistrer » à l'écran** (« Enregistrer » et « Imprimer / Enregistrer en PDF ») : distingués par l'icône (disquette / imprimante), la forme (plein / contour) et l'aide sous le bouton d'impression « Pour obtenir un PDF, choisissez « Enregistrer au format PDF » dans la fenêtre qui s'ouvre. » Risque de confusion à relire par `ui-ux` (§12 n° 9).
- **Une action principale par écran** : « Nouveau document » sur la liste ; « Enregistrer » sur un brouillon, « Imprimer / Enregistrer en PDF » sur un document signé.
- **Actions de ligne** en icône seule + infobulle, libellé visible sous `md`, rendus homogènes avec Équipe ; « Supprimer » / « Archiver » écartés des autres actions.
- **Même icône partout** : `PhSignature` pour « Documents » dans le menu et pour « Contrats et avenants » dans l'Équipe.
- **Accessibilité** : éditeur nommé « Texte du document « … » » (lecture seule annoncée) ; état d'enregistrement en `role="status"` ; `h1` unique ; focus visible dans les deux thèmes ; logo décoratif `alt=""` (le nom du cabinet est écrit).
- **Mode sombre** : la page et la barre de mise en forme suivent le thème, la feuille reste blanche (aperçu papier), l'impression est toujours claire.
- **Mots du métier** : « Contrats et avenants », « Brouillon », « Signé », « Enregistrer », « Imprimer », « Enregistrer au format PDF ». Jamais « Delta », « marqueur », « générer » à l'écran (on dit « créer »).

## 9. Étapes d'implémentation

Six tâches, chacune confiée à **un sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)).

- Ordre : **T1 → T2 → T3 → T4 → T5 → T6**.
- **Pré-requis bloquant** : `0041` livrée (`CURRENT_SCHEMA_VERSION === 13`, `documentsContrats` persisté, `TAUX_RETROCESSION` dans `TYPES_CHAMP_LIBRE`, `src/domain/contrats/` et `EditeurRiche.vue` présents) et `0039` livrée (`adresse.js`, `estLogoValide`, contrôleur `logo`). Sinon, s'arrêter et le signaler.
- Contexte à transmettre à chaque sous-agent : règles d'or n° 2, 3, 4, 5, 7, 8, 10 ; ce plan ; le plan `0041` **et** le code livré par `0041` (`src/domain/contrats/`, `src/store/modules/contrats.js`, `EditeurRiche.vue`, `ModeleContratView.vue` pour la garde de sortie et Ctrl+S, ADR 0023) ; `0039` §5 (adresse, logo, validation) ; ADR 0022 §8 pour T5.
- **Un seul commit pour la feature** (la page n'a de sens qu'avec génération et impression).

### Tâche 1 — Domaine des documents (pur)

**Fichiers** :

- `src/domain/contrats/documents.js` (**créer**) : §5.1, JSDoc complète, réutilisation de `marqueurs.js`, `delta.js`, `catalogueMarqueurs.js`, `adresse.js`, `cabinet.js`.

**Critères de sortie** (console, `npm run dev`) :

- `genererDocument` sur l'avenant de départ et une remplaçante réelle : `statut === 'BROUILLON'`, `enteteCabinet === null`, `id` au format GUID, **aucun embed** `marqueur` dans `contenu.ops`, dates en toutes lettres (« 3 novembre 2026 »), `valeursSaisies` conforme (le taux a le type `TAUX_RETROCESSION`). Le Delta du modèle est **strictement identique** avant et après (`JSON.stringify`).
- Information de fiche absente laissée vide : `BLANC_A_COMPLETER` dans le texte (avec l'attribut `bold` de l'embed s'il en avait un), `valeur: null`.
- `champsAGenerer` sur l'avenant : 4 champs à compléter dans l'ordre du texte ; pour une titulaire sans titulaire remplacée, les `titulaire.*` apparaissent dans `manquants`.
- `lireNombreSaisi('12,5') === 12.5`, `('abc') === null`.
- `estChampTaux` : vrai pour `type: 'TAUX_RETROCESSION'`, faux pour un `NOMBRE` libellé « taux ». `ecartTauxRetrocession` : saisi 15 / fiche 10 → écart ; 10 / 10 → `null` ; remplaçante fiche `null` → écart avec `valeurFiche: null` ; titulaire fiche `null` → `null`.
- `figerEnteteCabinet` : copie indépendante (modifier `parametres.adresseCabinet.ville` après coup ne change pas la copie), **sans clé `logo`**. `enteteAffichee` : brouillon → nom et adresse en direct ; signé avec `enteteCabinet` → nom et adresse de la copie ; signé sans `enteteCabinet` → en direct ; dans tous les cas `logo` = logo actuel du cabinet (`null` si absent ou non conforme, par ex. `https://…` ou `data:image/svg+xml…`).
- `estDateSignatureValide('2999-01-01', '2026-10-26') === false`.
- `titreFichierDocument` ne contient aucun caractère interdit dans un nom de fichier.
- Aucun import Vue/Vuex/Quill, aucun `new Date` dans le fichier ; `npm run build` réussit.

### Tâche 2 — Persistance : validation, intégrité, store

**Fichiers** :

- `src/domain/schema.js` (**modifier**) : §5.2.
- `src/domain/validationImport.js` (**modifier**) : §5.3.
- `src/store/modules/contrats.js` (**modifier**) : §4 (getters, mutations, actions documents).
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) : entités `DocumentContrat` et `EnteteCabinet` + invariants (copie figée du texte, nom et adresse du cabinet figés à la signature, logo jamais figé, aucun embed, signé définitif, intégrité).
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) : forme des éléments de `documentsContrats` (v13, sans migration).
- `docs/architecture/04-gestion-etat-vuex.md` (**modifier**) : partie documents du module `contrats`.

`src/storage/migrations.js` et `src/store/index.js` : **non modifiés**.

**Critères de sortie** :

- `npm run build` réussit ; `CURRENT_SCHEMA_VERSION` vaut toujours 13 ; recherche `localStorage` dans `src/` : uniquement `storageRepository.js`.
- En console : `genererDocument` crée un brouillon ; `enregistrerBrouillon` le modifie (toast), persisté après F5 ; `marquerSigne` le fige et pose `enteteCabinet` (nom + adresse du cabinet courant, sans logo) ; ensuite `enregistrerBrouillon` renvoie `false` sans rien changer ; `supprimerBrouillon` sur un signé ne fait rien. Modifier l'adresse du cabinet : `enteteCabinet` du signé inchangé.
- Export : les documents sont dans `documentsContrats`, `enteteCabinet` sans logo. Import de ce fichier : documents restaurés à l'identique.
- Import refusé avec message FR, données actuelles conservées, pour : `modeleId` inconnu, `personneId` inconnu, `statut: 'X'`, `valeursSaisies` de 101 éléments, `contenu` avec `"attributes": { "link": "javascript:alert(1)" }`, `enteteCabinet.nomCabinet` non texte. Un `enteteCabinet.logo` ajouté à la main est ignoré puis retiré à la relecture, jamais affiché.
- Import d'une sauvegarde v13 de `0041` (`documentsContrats: []`) et de `idelia-sermet.json` (version antérieure) : accepté, aucun document.

### Tâche 3 — Routes, menu, page Documents et bouton Équipe

**Fichiers** :

- `src/router/index.js` (**modifier**) : §6.1.
- `src/components/communs/MenuLateral.vue` (**modifier**) : entrée « Documents » (§6.1).
- `src/views/ContratsView.vue` (**créer**) : §6.1, §6.2, **sans** la modale de création (T4).
- `src/components/contrats/ListeDocumentsPersonne.vue` (**créer**).
- `src/components/contrats/BadgeStatutDocument.vue` (**créer**).
- `src/views/EquipeView.vue` (**modifier**) : §6.3.

**Critères de sortie** :

- Menu : groupe « Contrats » = « Documents » (`PhSignature`) puis « Modèles », déplié et replié (infobulle) ; « Documents » actif sur `/contrats` et `/contrats/...`, pas sur `/modeles-contrats`.
- Depuis Équipe, l'icône signature (entre Souhaits et Archiver, même taille, infobulle « Contrats et avenants », libellé sous `md`) ouvre `/contrats/<id>`.
- `/contrats` : sélecteur, état vide ; choisir une personne change l'URL ; la case « archivées » ajoute le groupe ; F5 sur `/contrats/<id>` : même rendu ; id inconnu : message introuvable.
- Liste (documents créés en console à T2) : tri du plus récent au plus ancien, statuts texte + icône, « Supprimer » (avec `DialogueConfirmation` danger) sur un brouillon, « Archiver » sur un signé, section « Documents archivés » repliable avec « Restaurer ».
- Personne archivée : documents visibles, pas de « Nouveau document », aide affichée.
- `npm run build` réussit.

### Tâche 4 — Création d'un document (fenêtre de génération)

**Fichiers** :

- `src/components/contrats/ModaleNouveauDocument.vue` (**créer**) : §6.1, §7.
- `src/views/ContratsView.vue` (**modifier**) : bouton « Nouveau document » → modale ; `@creer` → `contrats/genererDocument` → navigation vers `document-contrat` du nouvel id.

**Critères de sortie** :

- Avec les deux modèles de départ de `0041` : choix du modèle, champs à compléter affichés avec les bons types, champ taux avec « % » et aide « Taux actuel sur la fiche », informations absentes de la fiche facultatives.
- Envoi vide : messages FR sur les seuls champs requis ; date invalide, « abc » dans un nombre, taux 120 : messages adaptés ; aucune saisie perdue après une erreur.
- « Créer le brouillon » : fenêtre fermée, arrivée sur la route du document (écran introuvable ou minimal accepté tant que T5 n'est pas faite), toast succès ; taux différent : toast avertissement en plus, **fiche Équipe inchangée**.
- Aucun modèle actif (tous archivés) : message + lien vers `/modeles-contrats`.
- Clavier : `Tab` parcourt modèles puis champs, `Échap` = Annuler. `npm run build` réussit.

### Tâche 5 — Page du document : feuille A4, en-tête, édition, enregistrement et impression

**Fichiers** :

- `src/views/DocumentContratView.vue` (**créer**) : barre d'outils, introuvable, titre, « Enregistrer » + état d'enregistrement + Ctrl+S + garde de sortie + `beforeunload` (motif `ModeleContratView`), `document.title`, bouton d'impression (`window.print()`).
- `src/components/contrats/FeuilleDocument.vue` (**créer**) : §6.1, §6.4.
- `src/components/contrats/EnTeteCabinet.vue` (**créer**).
- `src/components/contrats/EditeurRiche.vue`, `src/components/contrats/BarreOutilsEditeur.vue` (**modifier**) : prop `avecInsertionChamps`, barre non rendue en lecture seule.
- `src/styles/_tokens.scss` (**modifier**) : tokens d'impression du document (§6.4).

**Critères de sortie** :

- Brouillon : corriger le texte ou le titre fait passer l'état à « Modifications non enregistrées » et active « Enregistrer » ; « Enregistrer » ou Ctrl+S → état « Toutes les modifications sont enregistrées » + toast, F5 conserve la correction ; ouvrir puis quitter sans rien toucher ne change pas `updatedAt` et n'ouvre aucune confirmation.
- Garde de sortie : modifier puis cliquer « Retour », un item du menu ou un autre document → « Quitter sans enregistrer ? » ; « Rester sur la page » conserve le texte ; F5 avec modifications → alerte native.
- Barre de mise en forme sans « Insérer un champ » ; l'éditeur de modèle (`/modeles-contrats/:id`) garde son menu.
- En-tête : logo, nom, adresse du cabinet sur plusieurs lignes (`lignesAdresse`) ; cabinet vide : aide écran avec lien `/cabinet`, rien à l'impression.
- `Ctrl+P` (vrai Chrome/Edge) : uniquement la feuille, A4 portrait, marges ≈ 20 mm, sans barre de mise en forme, ni menu, ni encadrés ; plusieurs pages si le texte est long, sans ligne coupée ; en mode sombre, aperçu entièrement clair et retour au sombre en fermant.
- Nom de PDF proposé : « {titre} - {Prénom Nom} - JJ-MM-AAAA » ; titre de l'onglet restauré en quittant la page.
- Aucun `v-html` dans `src/` ; `npm run build` réussit ; Quill reste dans son chunk séparé (routes paresseuses).

### Tâche 6 — Cycle de vie (signature et en-tête figé, suppression, archivage, rappel de taux) et documentation

**Fichiers** :

- `src/components/communs/DialogueConfirmation.vue` (**modifier**) : slot par défaut facultatif.
- `src/views/DocumentContratView.vue` (**modifier**) : « Marquer comme signé » (dialogue + date Vuelidate, modifications non enregistrées intégrées), « Supprimer le brouillon », « Archiver » / « Restaurer », encadrés d'état et de rappel de taux, lecture seule et en-tête figé après signature.
- `docs/architecture/06-structure-du-code.md` (**modifier**) : `views/ContratsView.vue`, `views/DocumentContratView.vue`, nouveaux composants de `components/contrats/`, `domain/contrats/documents.js` [0042].
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) : routes `/contrats`, `/contrats/:id`, `/contrats/:id/documents/:documentId`, entrée de menu « Documents », bouton Équipe.

**Critères de sortie** :

- Signature : date par défaut aujourd'hui, date future refusée avec message ; avec des modifications non enregistrées, la confirmation le dit et le texte signé les contient ; après confirmation, badge « Signé le … », éditeur en lecture seule sans barre, plus de champ titre, ni « Enregistrer », ni « Supprimer », bouton « Archiver », aucune garde de sortie.
- **En-tête figé** : après signature, changer le nom, l'adresse et le logo dans la page Cabinet → le document signé affiche et imprime l'**ancien nom et l'ancienne adresse** avec le **nouveau logo** ; un brouillon affiche tout le nouvel en-tête.
- Brouillon supprimé après confirmation : retour à la liste sans garde de sortie, toast. Signé : jamais supprimable (ni bouton, ni action).
- Archiver puis Restaurer : déplacement entre les deux sections, toasts.
- Rappel de taux : encadré présent tant que la fiche diffère, absent après mise à jour de la fiche via « Ouvrir la fiche » (curseur sur « Remplace en priorité »).
- Les appels existants de `DialogueConfirmation` (archivage Équipe, archivage de modèle, suppression de souhait…) sont inchangés. `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] Le menu « Contrats » commence par **« Documents »** (`PhSignature`), suivi de « Modèles ».
- [ ] Sur chaque personne active de l'Équipe, une icône `PhSignature` « Contrats et avenants » (entre Souhaits et Archiver) ouvre la page de ses documents.
- [ ] La page « Documents » permet de choisir une personne (actives, archivées en option) et liste ses documents : type, titre, modèle d'origine, date de création, statut.
- [ ] « Nouveau document » : choix d'un modèle actif, saisie des seules informations inconnues (champs à compléter requis, informations absentes de la fiche facultatives), messages d'erreur en français.
- [ ] Le document créé est un **Brouillon** entièrement rédigé (personne, titulaire, cabinet, date du jour, valeurs saisies, aucune pastille restante), retouchable dans la feuille.
- [ ] Le brouillon s'enregistre **comme un modèle** : bouton « Enregistrer », Ctrl+S, état permanent, confirmation avant de quitter, alerte du navigateur en fermant l'onglet.
- [ ] Modifier, renommer ou archiver le modèle ensuite **ne change pas** les documents déjà créés.
- [ ] « Marquer comme signé » demande une date (pas dans le futur), puis fige le document : lecture seule, non supprimable, archivable et restaurable.
- [ ] À la signature, le **nom et l'adresse du cabinet** sont **figés** dans le document : les changer ensuite ne modifie pas un document signé, mais modifie l'en-tête des brouillons. Le **logo** affiché est toujours celui de la page Cabinet.
- [ ] Un brouillon est supprimable après confirmation ; un document signé ne l'est jamais.
- [ ] Un taux saisi dans un champ « Taux de rétrocession » différent de la fiche déclenche un rappel (toast + encadré) ; la **fiche n'est jamais modifiée** automatiquement.
- [ ] « Imprimer / Enregistrer en PDF » n'imprime que la feuille A4, toujours claire, avec en-tête logo + nom + adresse du cabinet, et propose un nom de PDF parlant.
- [ ] Les documents sont dans l'export JSON et reviennent à l'import ; un fichier avec une personne ou un modèle inconnu est refusé proprement ; `schemaVersion` reste 13.
- [ ] Aucun `v-html`, aucun `localStorage` hors `storageRepository`, aucune dépendance ajoutée, `npm run build` réussit.

## 11. Vérification

Recette navigateur : Playwright MCP, `npm run dev` sur le port **5199**, données `idelia-sermet.json` importées par Paramètres (« Restaurer une sauvegarde ») : la chaîne de migrations jusqu'à 13 passe. Ouvrir une fois « Modèles » pour créer les deux modèles de départ. Compléter la page Cabinet (nom, adresse, **logo réel**) et, pour une remplaçante, `titulaireId` et `tauxRetrocession = 10`. Les GUID sont lus dans les données, jamais inventés.

1. **Menu et entrée par Équipe** : groupe « Contrats » = « Documents » puis « Modèles ». Sur une remplaçante, cliquer l'icône « Contrats et avenants » → `/contrats/<id>`, titre « Contrats et avenants de … », état vide, « Documents » actif. Réduire sous 768 px : le libellé texte apparaît sous l'icône, comme pour les autres actions.
2. **Sélecteur** : aller sur `/contrats`, choisir une autre personne → l'URL change ; cocher « archivées » → groupe affiché ; F5 → même rendu ; `/contrats/<GUID inconnu>` → « Cette personne est introuvable. »
3. **Création** : « Nouveau document » → « Avenant – taux de rétrocession ». Cliquer « Créer le brouillon » sans rien saisir → messages FR sur les champs requis. Saisir « abc » puis « 120 » dans le taux → messages adaptés. Remplir les dates, le lieu et 15 → « Créer le brouillon ». Page du document, toast succès **et** toast avertissement de taux, encadré de rappel. Vérifier dans Équipe que la fiche affiche toujours 10 %.
4. **Copie figée du texte** : dans « Modèles », modifier une phrase de l'avenant et renommer un champ à compléter, enregistrer. Rouvrir le document : texte inchangé, aucune pastille.
5. **Enregistrement du brouillon** : cliquer dans `.ql-editor`, taper une phrase (`keyboard.type`) → « Modifications non enregistrées ». Cliquer « Retour » → « Quitter sans enregistrer ? » → « Rester sur la page ». `Control+s` → état enregistré + toast, F5 → phrase conservée. Retaper puis F5 → alerte native (`page.on('dialog')`). Ouvrir/fermer un autre document sans le toucher : aucune confirmation, `updatedAt` inchangé (onglet Application).
6. **Impression** : `page.emulateMedia({ media: 'print' })` + capture : seule la feuille, en-tête cabinet, pas de barre de mise en forme. En mode sombre (`colorScheme: 'dark'`) : la feuille reste blanche à l'écran. Contrôle final en vrai Chrome (`Ctrl+P`, l'émulation ne déclenche pas `beforeprint`) : aperçu clair, nom de PDF proposé, marges ≈ 20 mm, contrat de remplacement sur 2 pages sans ligne coupée.
7. **Signature** : modifier une phrase sans enregistrer, puis « Marquer comme signé » → la confirmation signale les modifications ; `fill('2999-01-01')` → message « … dans le futur » ; date du jour → confirmer. Badge « Signé le … », phrase modifiée présente, éditeur non modifiable (taper n'a aucun effet), barre absente, plus de « Enregistrer » ni de « Supprimer ».
8. **En-tête figé** : dans la page Cabinet, changer le nom, la ville et remplacer le logo. Le document signé garde l'ancien nom et l'ancienne adresse mais montre le **nouveau logo** (écran et `emulateMedia print`) ; retirer le logo : le document signé n'en affiche plus. Un brouillon suit tout l'en-tête. Remettre le logo d'origine.
9. **Suppression et archivage** : créer un 2ᵉ brouillon (contrat de remplacement), le supprimer (confirmation danger) → retour à la liste sans garde de sortie, toast. Archiver le signé → section « Documents archivés (1) », restaurer → retour en liste.
10. **Rappel de taux résolu** : « Ouvrir la fiche » → fiche ouverte sur « Remplace en priorité » ; passer le taux à 15, enregistrer, revenir au document → encadré disparu.
11. **Sauvegarde et intégrité** : exporter, vérifier `schemaVersion: 13` et le document dans `documentsContrats` (aucune balise HTML, aucun embed `marqueur`, `enteteCabinet` avec nom et adresse **sans logo**). Éditer une copie du fichier (`modeleId` inconnu) et l'importer → refus avec message FR, données conservées. Copie avec `enteteCabinet.logo: "https://exemple.org/x.png"` → import accepté, clé ignorée, aucune requête vers `exemple.org`, logo actuel affiché. Réimporter l'export valide → documents identiques.
12. **Volumétrie** : noter `localStorage.getItem('idelia:data').length` avant ; en console, créer et signer 20 documents depuis le contrat de remplacement ; mesurer à nouveau. Reporter dans le compte rendu le coût moyen d'un document (attendu ≈ 6 à 10 Ko). Supprimer ensuite ces documents par un réimport de l'export du point 11.
13. **Personne archivée** : archiver la personne dans Équipe → `/contrats/<id>` montre ses documents, sans « Nouveau document », avec l'aide de restauration ; le lien « Ouvrir la fiche » du rappel est masqué.
14. **Non-régression** : éditeur de modèle (menu « Insérer un champ », enregistrement explicite) inchangé ; archivage d'une personne et suppression d'un souhait inchangés ; Diffusion imprimable comme avant ; `npm run build` réussit.

## 12. Décisions à confirmer / risques

> **Validé par le porteur** :
> - **Détection du taux** : par le type de champ dédié `TAUX_RETROCESSION` (ajouté à `TYPES_CHAMP_LIBRE` par `0041`), plus aucune détection par le libellé.
> - **En-tête figé à la signature, sans le logo** : nom et adresse lus en direct en brouillon, copiés dans `enteteCabinet` au passage à « Signé », puis seuls utilisés ; le **logo n'est jamais copié** et l'en-tête montre toujours le logo actuel de la page Cabinet.
> - **Enregistrement du brouillon aligné sur les modèles de `0041`** : bouton « Enregistrer », Ctrl+S, confirmation avant de quitter.
> - **Modèles jamais supprimés**, seulement archivés (`0041` corrige sa phrase) : l'intégrité `modeleId` est toujours satisfaite.

1. **Route du document `/contrats/:id/documents/:documentId` (ajoutée)** : la décision validée ne cite que `/contrats/:id`. Une page dédiée au document (plutôt qu'une modale) est nécessaire pour l'édition sur une vraie feuille A4, l'impression propre, la garde de sortie et le rechargement direct (F5). Route plate et paresseuse, comme celles de `0041`. **À confirmer.**
2. **Alignement avec `0041` (vérifié sur son plan)** : pas de migration (`documentsContrats` déjà en v13) ; noms repris tels quels (`contrats/modeleById`, `modelesActifs`, `REPLACE`, `ADD_*` / `UPDATE_*`, `construireContexte` avec `cabinet` = `ParametresCabinet`, `valeurMarqueur`, `remplacerMarqueurs`, `marqueursNonResolus`, `clesMarqueursUtilisees`, `estCleMarqueurValide`, `libelleMarqueur`, `TYPES_CHAMP_LIBRE`, `EditeurRiche.vue`, contrôleur `delta`, garde de sortie de `ModeleContratView`). Le formatage du type `TAUX_RETROCESSION` dans le texte (avec ou sans « % ») est celui de `valeurMarqueur` (`0041`).
3. **Pas de filigrane « Brouillon » à l'impression (retenu)** : le circuit réel est « imprimer le brouillon → signer sur papier → marquer comme signé ». Un filigrane rendrait le papier signé inexploitable. Le statut reste visible à l'écran.
4. **Signature avec modifications non enregistrées** : la signature les enregistre en même temps (un seul patch, un seul toast), annoncé dans la confirmation. Alternative : exiger d'enregistrer avant de signer (une étape de plus pour l'utilisatrice). **Retenu : intégrer.**
5. **Logo jamais figé (tranché par le porteur)** : seul le nom et l'adresse sont copiés à la signature, pour éviter jusqu'à ≈ 200 000 caractères de logo par document signé (plafond `0039`). Conséquence **acceptée par le porteur** : réimprimer un contrat signé après un changement de logo montre le **nouveau** logo (ou aucun si le logo a été retiré). Le papier signé d'origine reste la référence.
6. **Volumétrie (mineure)** : ≈ 6 à 10 Ko par document, en-tête figé compris ; quelques centaines de documents tiennent dans le `localStorage` (≈ 5 millions de caractères, logo du cabinet stocké une seule fois). En cas de dépassement, `storageRepository.save` signale déjà l'erreur de quota (statut « ERREUR », indicateur de sauvegarde), sans perte de l'état en mémoire. Pas de compression ni d'IndexedDB (hors v1, ADR à prévoir si le volume grandit). Mesure de contrôle en recette (§11 n° 12).
7. **Bouton aussi sur les personnes archivées de l'Équipe ?** Non retenu (décision validée : liste active uniquement). Les documents d'une ancienne remplaçante restent accessibles via `/contrats` et « Afficher aussi les personnes archivées ». Ajout trivial si souhaité (entre « Informations utiles » et « Restaurer »).
8. **Signature définitive, sans retour en brouillon (retenu)** : c'est la garantie d'un document « figé ». Une erreur de clic est évitée par la confirmation explicite. Si le besoin apparaît, « Créer une copie en brouillon » (nouveau document, l'original intact) serait l'évolution naturelle.
9. **Deux boutons « Enregistrer… » côte à côte en brouillon** (« Enregistrer » et « Imprimer / Enregistrer en PDF », libellé validé) : risque de confusion pour le public cible, atténué par les icônes, la forme et l'aide. Option à arbitrer par `ui-ux` : renommer le second « Imprimer ou créer un PDF ».
10. **Archivage sans confirmation (retenu)** : geste réversible, visible (section dédiée) et annoncé par un toast. Écart assumé avec l'archivage d'une personne ou d'un modèle, qui a une confirmation.
11. **Pagination et pied de page** : pas de numéro de page ni d'en-tête répété sur les pages suivantes (l'en-tête est sur la première page). Chrome/Edge récents supportent les zones de marge `@page` (`@bottom-right { content: counter(page) }`), à envisager si les contrats dépassent régulièrement 2 pages.
12. **Informations de fiche absentes laissées vides** : remplacées par des pointillés `BLANC_A_COMPLETER`, à compléter à la main. Alternative : les rendre requises (bloquant pour une donnée qu'on n'a pas toujours). **À confirmer.**
13. **Aucun écart d'ADR** : aucun backend, PDF par le navigateur (ADR 0002), Quill déjà acté par l'ADR 0023, persistance via le plugin du store et `storageRepository` (ADR 0005), dates via `dateUtil` (ADR 0010). Aucune dépendance nouvelle, aucune migration, aucun nouvel ADR.
14. **Sécurité (pour l'agent `security`)** :
    - **Rendu** : le contenu est un Delta rendu **par Quill** (`EditeurRiche`, liste blanche `formats` de `0041`), jamais de `v-html`. Les valeurs saisies et les données de fiche sont insérées comme **texte** dans les `insert`, jamais interprétées comme HTML ; aucun lien ni image possible dans le texte.
    - **Import** : `documentsContrats` contrôlé par `validationImport.js` (types, énumérations, longueurs, clés de marqueur par regex, Delta par `estDeltaModeleValide` avec rejet de `link`/`image`, plafonds 5000 documents / 100 valeurs saisies, fichier ≤ 10 Mo) puis par `verifierIntegrite` ; un fichier forgé n'atteint jamais le store.
    - **Logo** : seul le logo du cabinet existe (jamais copié dans un document) ; lié à `<img src>` seulement s'il passe `estLogoValide` (`data:image/(png|jpeg);base64,…`, plafond `LOGO_LONGUEUR_MAX`, contrôlé à l'import par `0039` et au rendu par `enteteAffichee` / `EnTeteCabinet`) ; une clé `logo` forgée dans `enteteCabinet` est ignorée et retirée par `normaliserDocument`, jamais rendue ; jamais d'URL distante, donc aucun pistage au rendu ; SVG refusé.
    - **Routes** : `:id` et `:documentId` ne servent que de clés de recherche dans le store (pas de redirection ouverte) ; le lien « Ouvrir la fiche » est une route nommée interne.
    - **Nom de fichier** : `document.title` vient du titre saisi, nettoyé des caractères interdits ; propriété texte, sans injection.
    - **Données personnelles** : les documents contiennent l'adresse et la date de naissance (0040) et figurent dans l'export JSON. Aucun envoi réseau ; l'utilisatrice reste responsable de la conservation du fichier exporté et des PDF.
    - **Intégrité métier** : les gardes `estModifiable` / `estSupprimable` / `estArchivable` sont appliquées **dans les actions du store**, pas seulement dans l'interface ; `enteteCabinet` n'est posé que par `marquerSigne`.
    - **Disponibilité** : saturation du `localStorage` peu probable (§12 n° 6) ; si elle survient, l'erreur est signalée, jamais silencieuse.
