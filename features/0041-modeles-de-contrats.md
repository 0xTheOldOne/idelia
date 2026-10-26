# Feature 0041 — Modèles de contrats

- **Statut** : Fait
- **Dépend de** :
  - [`0039`](0039-page-cabinet-et-menu.md) (page Cabinet : `ParametresCabinet.nomCabinet`, `ParametresCabinet.adresseCabinet` (`AdressePostale`), `ParametresCabinet.logo` ; module pur `src/domain/adresse.js` (`lignesAdresse`, `adresseSurUneLigne`) ; menu réorganisé ; migration **v10 → v11**) ;
  - [`0040`](0040-coordonnees-des-personnes.md) (coordonnées des personnes : `Personne.adresse` (`AdressePostale`), `Personne.dateNaissance` ; migration **v11 → v12** ; **pas de lieu de naissance**, décision du porteur) ;
  - `0038` (mode sombre : tokens en CSS custom properties, `m.translucide`, `data-bs-theme`).
  - Réutilise aussi : `0020` (`titulaireId`), `0030` (`identifiants`, `src/domain/identifiantsPro.js`), `0036` (`tauxRetrocession`), `0018` (toasts), `0015` (`MenuLateral.vue`, `estActif`).
- **Prépare** : `0042` (documents contractuels : génération depuis un modèle, saisie des champs à compléter, Brouillon → Signé, impression).
- **ADR liés** :
  - **[0023](../docs/adr/0023-editeur-riche-quill.md) (à rédiger en Tâche 1)** : éditeur riche `quill@2`, chargé à la demande ;
  - [0019](../docs/adr/0019-lecture-pdf-pdfjs.md) (précédent : dépendance figée, chargée à la demande, isolée derrière un adaptateur) ;
  - [0022](../docs/adr/0022-theme-sombre-css-custom-properties.md) (couleurs de l'éditeur via les tokens, jamais de couleur en dur) ;
  - [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) et [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (persistance et sauvegarde) ;
  - [0008](../docs/adr/0008-moteur-planification-module-pur.md) (domaine pur, sans Quill) ;
  - [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor, y compris dans la barre de l'éditeur).

## 1. Contexte & objectif

Le cabinet rédige à la main ses **contrats de remplacement** et ses **avenants** (par exemple un changement de taux de rétrocession). Il recopie à chaque fois les mêmes informations : nom, numéro RPPS, adresse, taux. Idelia connaît déjà ces informations.

Cette feature crée des **modèles de contrats** :

- un texte mis en forme simplement (titres, gras, listes, alignement) dans un éditeur riche **Quill** ;
- des **champs automatiques** insérés d'un clic (« Prénom de la personne », « N° RPPS de la titulaire remplacée », « Nom du cabinet », « Date du jour »…), remplis par Idelia lors de la création d'un document (0042) ;
- des **champs à compléter** propres au modèle (« Date d'effet », « Nouveau taux »…), demandés lors de la création d'un document (0042) ;
- **deux modèles de départ**, proposés au premier accès : « Contrat de remplacement » et « Avenant – taux de rétrocession ».

0041 ne crée **aucun document** : elle livre l'éditeur, les modèles, le catalogue des champs et les fonctions pures de remplacement, que 0042 utilisera.

## 2. Écrans concernés

### 2.1 Menu latéral (`MenuLateral.vue`)

Nouveau groupe **« Contrats »**, placé **après « Planning »** dans `data().groupes`, sur la version du menu livrée par 0039.

| Entrée | Chemin | Icône | Livrée par |
| --- | --- | --- | --- |
| **Documents** | `/contrats` | `PhSignature` (décision du porteur : même icône que le bouton « Contrats et avenants » de l'Équipe en 0042) | **0042** |
| **Modèles** | `/modeles-contrats` | `PhFileText` | **0041** |

- **0041 n'ajoute que « Modèles »** (décision §12 n° 1). 0042 insère « Documents » **en premier** dans le groupe, avec `PhSignature`.
- Chemin `/modeles-contrats` distinct de `/contrats` : `estActif()` (`MenuLateral.vue` l. 203-210) active un item sur son chemin exact ou sur le préfixe `chemin/`. Avec `/contrats/modeles`, « Documents » serait aussi actif sur les modèles. `/modeles-contrats/:id` garde bien « Modèles » actif.

### 2.2 `/modeles-contrats` — liste des modèles (`ModelesContratsView.vue`, **créer**)

Parcours visé (utilisatrice peu à l'aise avec l'informatique) :

1. Elle ouvre **Contrats › Modèles**. Au tout premier accès, les deux modèles de départ sont déjà là, avec un toast « Deux modèles de départ ont été préparés. Faites-les relire avant de les utiliser. »
2. Chaque ligne montre : icône `PhFileText`, **titre**, badge du type (« Contrat » ou « Avenant », texte et non couleur seule), « Modifié le JJ/MM/AAAA ».
3. Actions de ligne, **icône seule** avec `title` et `aria-label` (44 px mini) :
   - **Modifier** (`PhPencilSimple`) ouvre l'éditeur ;
   - **Dupliquer** (`PhCopy`) crée « Copie de … » et ouvre l'éditeur de la copie ;
   - **Renommer** (`PhTextAa`) ouvre la petite fenêtre titre et type ;
   - **Archiver** (`PhArchive`), après confirmation.
4. En-tête : titre « Modèles de contrats » et, **à droite du titre**, le bouton principal **« Nouveau modèle »** (`PhPlus`, avec texte). Il ouvre une petite fenêtre (titre + type Contrat/Avenant), puis l'éditeur du nouveau modèle, vide.
5. Section repliable **« Modèles archivés (N) »**, sur le modèle de `TourneesView.vue` : fond `$couleur-fond-clair`, action **Restaurer** (`PhArrowCounterClockwise`), sans confirmation.
6. Texte d'introduction court sous le titre : « Un modèle est un texte type. Les champs en couleur seront remplis automatiquement pour chaque personne lors de la création d'un document. »

### 2.3 `/modeles-contrats/:id` — édition d'un modèle (`ModeleContratView.vue`, **créer**)

1. En-tête : titre du modèle et badge du type. À droite du titre :
   - le bouton principal **« Enregistrer »** (`PhFloppyDisk`, avec texte), désactivé tant que rien n'a changé ;
   - les icônes seules **Renommer** et **Retour à la liste** (`PhArrowLeft`).
2. Sous l'en-tête, un **état d'enregistrement** toujours visible (`role="status"`) : « Toutes les modifications sont enregistrées » ou « Modifications non enregistrées » (icône `PhWarningCircle` + texte).
3. La **barre d'outils** (Vue, icônes Phosphor, §6.3) : Gras, Italique, Souligné | Titre, Sous-titre | Liste à puces, Liste numérotée | Aligner à gauche, Centrer, Aligner à droite, Justifier | Annuler, Rétablir | **« Insérer un champ »** (bouton avec texte, `PhBracketsCurly`).
4. La **zone de texte** est une feuille blanche ou sombre selon le thème, largeur de lecture ≈ 21 cm. Les champs apparaissent en **pastilles** non éditables, avec leur libellé en français :
   - champ automatique : fond teal translucide, bordure pleine ;
   - champ à compléter : fond ambre translucide, bordure **en pointillés** et icône crayon en préfixe CSS.

   Les deux se distinguent donc aussi par la forme, pas seulement par la couleur.
5. **« Insérer un champ »** ouvre un menu déroulant groupé :
   - **Personne concernée** ;
   - **Titulaire remplacé(e)** ;
   - **Cabinet** ;
   - **Date** ;
   - **Champs à compléter** (ceux du modèle), puis en bas **« + Nouveau champ à compléter… »**.

   Un clic insère la pastille à l'emplacement du curseur et rend la main au texte.
6. Sous l'éditeur, section **« Champs à compléter lors de la création d'un document »** :
   - liste libellé et type (« Date », « Nombre », « Texte », « Taux de rétrocession (%) ») ;
   - actions icône seule **Modifier** et **Retirer** ;
   - « Retirer » est désactivé tant que le champ figure dans le texte, avec l'infobulle « Ce champ est utilisé dans le texte : supprimez-le d'abord du texte ».
7. **Quitter avec des modifications non enregistrées** (menu, Retour, autre lien) : fenêtre « Quitter sans enregistrer ? Vos dernières modifications seront perdues. » avec les boutons **« Rester sur la page »** (par défaut) et **« Quitter sans enregistrer »** (`danger`). Fermer l'onglet ou recharger : alerte native du navigateur (`beforeunload`).
8. **Ctrl+S** enregistre, sans ouvrir la fenêtre « Enregistrer sous » du navigateur.
9. **Premier chargement de l'éditeur** : indicateur « Chargement de l'éditeur… ». En cas d'échec (hors ligne au premier usage), message « L'éditeur de texte n'a pas pu être chargé. Vérifiez la connexion internet puis cliquez sur Réessayer. » avec le bouton **Réessayer**.
10. **Identifiant inconnu** (lien périmé) : « Ce modèle est introuvable. » et un lien « Revenir aux modèles ».
11. **Coller un contrat existant** (raccourci, décision du porteur) : un texte collé (Word, e-mail, page web) qui contient des codes `{{personne.nom}}` (espaces tolérés : `{{ personne.nom }}`) les voit **transformés en pastilles** dès lors que le code existe dans le catalogue.
    - Les codes inconnus restent du texte.
    - Un **avertissement non bloquant** apparaît au-dessus du texte (`alert-warning`, `role="status"`, fermable) : « 2 champs non reconnus : {{personne.adres}}, {{saisie.date}} — insérez-les avec « Insérer un champ ». » Au-delà de 5 codes, la liste est tronquée par « … ». L'avertissement est remplacé au collage suivant.
    - Les **champs à compléter** ne sont jamais créés au collage : leur code contient un GUID. Un `{{saisie.…}}` collé est donc toujours signalé comme non reconnu.
    - Une aide repliable **« Coller un contrat existant »**, sous la barre d'outils, explique la syntaxe : « Vous pouvez coller un contrat déjà rédigé. Les champs écrits entre doubles accolades, par exemple {{personne.nom}}, deviennent des pastilles. Les codes sont indiqués dans le menu « Insérer un champ ». »

## 3. Modèle de données touché

### 3.1 Nouvelle entité `ModeleContrat`

| Champ | Type | Requis | Description |
| --- | --- | --- | --- |
| `id` | GUID | oui | `genId()` |
| `titre` | string 1..120 | oui | « Contrat de remplacement » |
| `type` | `'CONTRAT'` \| `'AVENANT'` | oui | `TYPES_MODELE_CONTRAT` (schema.js) |
| `contenu` | Delta Quill `{ ops: Op[] }` | oui | **jamais de HTML** (§5.2) |
| `champsLibres` | `ChampLibre[]` (≤ 50) | oui (peut être `[]`) | champs à compléter déclarés par le modèle (**ajout** à la forme validée, §12 n° 3) |
| `actif` | boolean | oui | `false` = archivé (convention `Personne.actif`) |
| `createdAt` / `updatedAt` | ISO UTC | oui | horodatages techniques |

`ChampLibre` : `{ cle: 'saisie.<GUID>', libelle: string 1..80, type: 'TEXTE' | 'DATE' | 'NOMBRE' | 'TAUX_RETROCESSION' }`.

- `TAUX_RETROCESSION` est un type **dédié** (décision du porteur), dont le libellé de type est « Taux de rétrocession (%) ». La valeur attendue à la génération est un nombre de **0 à 100**.
- Ce type permet à 0042 de repérer, sans deviner d'après le libellé, le champ à comparer à `Personne.tauxRetrocession` pour le rappel « le taux saisi diffère du taux de la fiche ».
- **Au plus un** champ de ce type par modèle (§7).

- `cle` est générée (`'saisie.' + genId()`) : aucun identifiant lisible (règle du porteur).
- Elle est unique **dans le modèle** et conservée telle quelle par « Dupliquer ».

**Op autorisée** (tout le reste est refusé, §5.2) :

- `{ insert: string, attributes?: AttributsTexte }` ;
- `{ insert: { marqueur: { cle: string } }, attributes?: AttributsTexte }` ;
- avec `AttributsTexte` ⊂ `{ bold: true, italic: true, underline: true, header: 1|2, list: 'ordered'|'bullet', align: 'center'|'right'|'justify' }`.

Aucune op `retain` ni `delete` : un contenu stocké est toujours un document complet.

### 3.2 `SaveDocument` (schemaVersion 12 → **13**)

- Nouvelle collection racine **`modelesContrats: ModeleContrat[]`** (≤ 200).
- Nouvelle collection racine **`documentsContrats: object[]`**, **toujours vide en 0041**. Elle est réservée à 0042, qui en définit la forme et les règles. Elle est ajoutée dès maintenant pour éviter à 0042 une nouvelle migration (§12 n° 4).
- **Migration `MIGRATIONS[12]`** (`src/storage/migrations.js`) : `modelesContrats` et `documentsContrats` valent la liste existante si c'en est une, sinon `[]` (idempotent). `CURRENT_SCHEMA_VERSION = 13`.
- Les **modèles de départ ne sont pas créés par la migration** : on n'injecte jamais de contenu dans le fichier de l'utilisatrice sans qu'elle ouvre la page (§4).

### 3.3 Documentation

- `docs/architecture/02-modele-de-domaine.md` : section `ModeleContrat` et `ChampLibre` ; mention « Document contractuel : 0042 ».
- `docs/architecture/03-modele-de-donnees.md` : les deux collections, v13.

## 4. Store (Vuex)

### 4.1 Module `contrats` (`src/store/modules/contrats.js`, **créer**, namespaced, persisté)

Sur le modèle de `tournees.js` : mutations fines, construction dans le domaine, horodatages dans les actions, toasts via `notifications/notifier`.

- **State** : `{ modeles: [], documents: [] }`. `documents` est la place réservée à 0042 : 0041 ne l'alimente jamais.
- **Getters** :
  - `modeleById: (state) => (id) => …` ;
  - `modelesActifs` (triés par `titre`, `localeCompare('fr')`) ;
  - `modelesArchives` ;
  - `documents`.
- **Mutations** :
  - `REPLACE({ modeles, documents })` ;
  - `ADD_MODELE(modele)` ;
  - `UPDATE_MODELE({ id, patch })` (fusion immuable par `id`, comme `tournees/UPDATE`).
- **Actions** (aucune ne rejette) :
  - `assurerModelesDeDepart()` : si `state.modeles.length === 0` (archivés compris), ajoute `modelesDeDepart()` (domaine) et émet le toast d'information du §2.2. Renvoie `true` si des modèles ont été créés.
  - `creerModele({ titre, type })` → `id` (domaine `creerModeleContrat`, contenu vide). Toast « Le modèle « … » a été créé. »
  - `enregistrerModele({ id, contenu, champsLibres })` : patch et `updatedAt`. Toast « Le modèle « … » a été enregistré. »
  - `renommerModele({ id, titre, type })`.
  - `dupliquerModele(id)` → `id` de la copie (domaine `dupliquerModeleContrat`). Toast.
  - `archiverModele(id)` (toast `info`) / `restaurerModele(id)`.
- Le **plugin de persistance** est déjà générique (il observe toute mutation hors `ui/` et `notifications/`) : **rien à changer**.

### 4.2 Store racine (`src/store/index.js`, **modifier**)

- `import contrats from './modules/contrats'` et ajout dans `modules` (l. 644-653).
- `REPLACE_ALL` (l. 457-465) :
  - `state.contrats.modeles = etatRacine.contrats.modeles;`
  - `state.contrats.documents = etatRacine.contrats.documents;`

### 4.3 Volatil

L'état d'édition (contenu en cours, « modifié ») vit **dans la vue**, pas dans le store. Le store ne reçoit le contenu qu'à l'enregistrement explicite (§12 n° 2). On évite ainsi une écriture du `SaveDocument` complet à chaque frappe.

## 5. Domaine (logique pure) et adaptateur

Tout `src/domain/contrats/` est **pur** : aucun import de Vue, de Vuex ou de **Quill**, aucun accès au DOM. Il manipule le Delta comme un **objet JSON**, ce qui le rend testable sans navigateur.

### 5.1 Enums et libellés

- `src/domain/schema.js` (**modifier**) :
  - `TYPES_MODELE_CONTRAT = Object.freeze(['CONTRAT', 'AVENANT'])` ;
  - `TYPES_CHAMP_LIBRE = Object.freeze(['TEXTE', 'DATE', 'NOMBRE', 'TAUX_RETROCESSION'])` ;
  - `BORNES_TAUX_RETROCESSION = Object.freeze({ min: 0, max: 100 })` : bornes de la saisie, reprises par 0042 et alignées sur `Personne.tauxRetrocession`.
- `src/domain/libelles.js` (**modifier**) :
  - `LIBELLES_TYPE_MODELE_CONTRAT` (`Contrat`, `Avenant`), `libelleTypeModeleContrat`, `TYPES_MODELE_CONTRAT_OPTIONS` ;
  - `LIBELLES_TYPE_CHAMP_LIBRE` (`Texte`, `Date`, `Nombre`, `Taux de rétrocession (%)`), avec la même trilogie ;
  - `AIDES_TYPE_CHAMP_LIBRE`, une phrase par type pour les radios de `ModaleChampLibre`. Pour le taux : « Un pourcentage entre 0 et 100. Idelia le comparera au taux de la fiche de la personne. »
- `src/domain/utils/dates.js` (**modifier**) : `formatDateLongueFr('2026-11-03')` → « 3 novembre 2026 ». Découpage de chaîne et table des mois en minuscules, **sans objet `Date`** (ADR 0010). Ajout à `dateUtil`.

### 5.2 `src/domain/contrats/delta.js` (**créer**)

```js
/** Attributs de texte autorisés et leurs valeurs admises. */
export const ATTRIBUTS_AUTORISES = Object.freeze({
  bold: [true], italic: [true], underline: [true],
  header: [1, 2], list: ['ordered', 'bullet'], align: ['center', 'right', 'justify'],
});
/** Plafonds d'un contenu de modèle. */
export const MAX_OPS = 20000;
export const MAX_CARACTERES = 200000;
/** @returns {{ ops: object[] }} Document vide valide : `{ ops: [{ insert: '\n' }] }`. */
export function deltaVide() {}
/**
 * Contrôle strict : objet `{ ops: [] }`, chaque op n'a QUE `insert` (+ `attributes` facultatif) ;
 * `insert` = chaîne, ou `{ marqueur: { cle } }` avec une clé de forme valide (`estCleMarqueurValide`) ;
 * attributs ∈ ATTRIBUTS_AUTORISES (donc rejet de link, image, video, formula, color, background, script…) ;
 * plafonds MAX_OPS / MAX_CARACTERES ; propriétés propres uniquement (pas de __proto__). Ne lève jamais.
 * @param {*} delta
 * @returns {boolean}
 */
export function estDeltaModeleValide(delta) {}
/** Clés des marqueurs présents, dans l'ordre d'apparition, sans doublon. @returns {string[]} */
export function clesMarqueursUtilisees(delta) {}
```

### 5.3 `src/domain/contrats/catalogueMarqueurs.js` (**créer**)

- `GROUPES_MARQUEURS` (figé), dans cet ordre. Libellés **en français, lisibles seuls**, car c'est ce qu'affiche la pastille :

| Groupe (`code` / libellé) | Clés et libellés |
| --- | --- |
| `PERSONNE` / « Personne concernée » | `personne.prenom` « Prénom de la personne », `personne.nom` « Nom de la personne », `personne.nomComplet` « Prénom et nom de la personne », `personne.statut` « Statut (titulaire ou remplaçant(e)) », `personne.quotite` « Quotité de travail », `personne.tauxRetrocession` « Taux de rétrocession », `personne.dateEntree` « Date d'arrivée au cabinet », `personne.dateNaissance` « Date de naissance » [0040], `personne.adresse` « Adresse de la personne » [0040], `personne.email` « E-mail de la personne », `personne.telephone` « Téléphone de la personne », puis **un marqueur par entrée de `CHAMPS_IDENTIFIANTS`** (`personne.rpps`, `personne.adeli`, `personne.ordinal`, `personne.cps`, `personne.carteProfessionnelle`, `personne.siret`), libellé dérivé : « N° RPPS de la personne »… |
| `TITULAIRE` / « Titulaire remplacé(e) » | `titulaire.prenom`, `titulaire.nom`, `titulaire.nomComplet`, `titulaire.adresse`, `titulaire.dateNaissance`, `titulaire.rpps`, `titulaire.adeli`, `titulaire.ordinal`, `titulaire.siret`, avec des libellés « … de la titulaire remplacée » |
| `CABINET` / « Cabinet » | `cabinet.nom` « Nom du cabinet » (`ParametresCabinet.nomCabinet`), `cabinet.adresse` « Adresse du cabinet » (`ParametresCabinet.adresseCabinet`) [0039] |
| `DATE` / « Date » | `date.jour` « Date du jour » |

- Les libellés RPPS, ADELI… sont **dérivés de `CHAMPS_IDENTIFIANTS`** (`identifiantsPro.js`), sans copie en dur. Formulation exacte ajustable par `ui-ux`.
- `PREFIXE_SAISIE = 'saisie.'`.
- `estCleMarqueurValide(cle)` : clé du catalogue, ou `saisie.` suivi d'un GUID (regex `FORMAT_GUID`, à factoriser depuis `migrations.js` vers `src/domain/utils/id.js` sous le nom `estGuid`).
- `libelleMarqueur(cle, champsLibres)` → libellé du catalogue, ou libellé du champ libre, ou « Champ inconnu ».
- `estChampLibre(cle)`.

### 5.4 `src/domain/contrats/modeles.js` (**créer**)

- `creerModeleContrat({ titre, type, contenu?, champsLibres? })` : `id`, titre nettoyé (`trim`, 120 max), type normalisé (`CONTRAT` par défaut), `contenu` valide ou `deltaVide()`, `actif: true`, horodatages.
- `dupliquerModeleContrat(modele)` : nouvel `id`, titre « Copie de « X » » tronqué à 120, copie **profonde** de `contenu` et `champsLibres` (`structuredClone`), `actif: true`, horodatages neufs.
- `creerChampLibre({ libelle, type })` → `{ cle: 'saisie.' + genId(), libelle: trim, type }`.
- `champLibreUtilise(contenu, cle)` → boolean.
- `champTauxRetrocession(champsLibres)` → le premier `ChampLibre` de type `TAUX_RETROCESSION`, ou `null`. 0042 s'en sert pour son rappel « taux saisi ≠ taux de la fiche ».
- `peutAjouterTauxRetrocession(champsLibres, cleEnCours)` → `false` si un **autre** champ (clé ≠ `cleEnCours`) a déjà ce type.
- `estTauxSaisiValide(valeur)` (nom distinct de `estTauxRetrocessionValide` de `personnes.js`, qui n'accepte que des entiers) → nombre fini dans `BORNES_TAUX_RETROCESSION`. Utilisé par `valeurMarqueur` et par la saisie de 0042.
- `normaliserModeleContrat(brut)` : utilisé par `fromSaveDocument`. `champsLibres` absent → `[]` ; `actif` absent → `true`. Il ne réécrit **jamais** le contenu : un contenu invalide a déjà été refusé par la validation.

### 5.5 `src/domain/contrats/marqueurs.js` (**créer**), fonctions destinées à 0042

```js
/**
 * @typedef {Object} ContexteMarqueurs
 * @property {object|null} personne
 * @property {object|null} titulaire     - résolu via personne.titulaireId (peut être null)
 * @property {import('@/domain/schema.js').ParametresCabinet|null} cabinet - lu : nomCabinet, adresseCabinet (le logo sert à 0042, pas aux marqueurs)
 * @property {string} aujourdhui         - "YYYY-MM-DD" (injecté : pas de new Date() dans le domaine)
 * @property {Object<string, (string|number|null)>} saisies - valeurs des champs libres, par clé
 * @property {ChampLibre[]} champsLibres - pour typer/formater les saisies
 */
/** Construit le contexte depuis les données du store (titulaire retrouvé dans `personnes`). */
export function construireContexte({ personne, personnes, cabinet, aujourdhui, saisies, champsLibres }) {}
/** Valeur affichable FR d'un marqueur, ou null si absente/vide (= non résolu). */
export function valeurMarqueur(cle, contexte) {}
/** Nouveau Delta : chaque marqueur résolu devient du texte (attributs de l'embed conservés) ; les non résolus restent des embeds. Delta d'entrée non modifié. */
export function remplacerMarqueurs(delta, contexte) {}
/** Marqueurs sans valeur, uniques, dans l'ordre : [{ cle, libelle }]. */
export function marqueursNonResolus(delta, contexte) {}
```

Formatage des valeurs (dans `valeurMarqueur`) :

- **dates** (`dateEntree`, `dateNaissance`, `date.jour`, saisie `DATE`) : `formatDateLongueFr` ;
- **quotité et taux** : « 80 % » (espace insécable) ;
- **saisie `NOMBRE`** : virgule décimale, **sans** unité, car le modèle écrit lui-même l'unité ;
- **saisie `TAUX_RETROCESSION`** : même rendu que `personne.tauxRetrocession`, soit « 25 % » (virgule décimale si besoin, espace insécable). Une valeur hors 0..100 ou non numérique vaut `null` (non résolu) ;
- **statut** : `libelleStatutPersonne` ;
- **nom complet** : « Prénom Nom » ;
- **adresse** (`personne.adresse`, `titulaire.adresse` = `Personne.adresse` ; `cabinet.adresse` = `ParametresCabinet.adresseCabinet`, toutes des `AdressePostale`) : **`adresseSurUneLigne`** de `src/domain/adresse.js` (0039), réutilisée telle quelle, par exemple « 12 rue des Lilas, 75011 Paris ». Adresse vide (`''`) → `null`. `marqueurs.js` importe ce module pur : pas de nouvelle fonction de formatage ;
- **identifiants** : la valeur normalisée ;
- **valeur vide** (`''`, `null`, absente) : `null`.

### 5.5 bis `src/domain/contrats/collage.js` (**créer**) : marqueurs écrits `{{cle}}` dans un texte collé

```js
/** Syntaxe affichée à l'utilisatrice pour un marqueur du catalogue : `{{personne.nom}}`. */
export function syntaxeMarqueur(cle) {}
/** Motif d'un marqueur écrit : `{{`, espaces facultatifs, segments [A-Za-z]+ séparés par des points (2 à 3), espaces, `}}`. Longueur de clé ≤ 60. */
export const RE_MARQUEUR_TEXTE = /\{\{\s*([A-Za-z]+(?:\.[A-Za-z]+){1,2})\s*\}\}/g;
/**
 * Convertit les marqueurs écrits d'un Delta (ops `insert` texte uniquement) en embeds `marqueur`.
 * - clé du CATALOGUE (comparaison insensible à la casse → clé canonique) : devient
 *   `{ insert: { marqueur: { cle } }, attributes }`, avec les attributs du texte d'origine (gras…) ;
 * - clé inconnue, ou `saisie.*` (jamais créée au collage : GUID) : reste du texte, et sa forme écrite
 *   d'origine est ajoutée à `inconnus` (unique, ordre d'apparition) ;
 * - ops non texte et attributs : inchangés ; Delta d'entrée non modifié ; ne lève jamais.
 * @param {{ ops: object[] }} delta
 * @param {ReadonlyArray<string>} clesCatalogue - `clesDuCatalogue()` (catalogueMarqueurs.js)
 * @returns {{ delta: { ops: object[] }, inconnus: string[] }}
 */
export function convertirMarqueursTexte(delta, clesCatalogue) {}
/** Message FR de l'avertissement (§2.3 n° 11) ; '' si `inconnus` est vide. 5 codes au plus, puis « … ». */
export function messageMarqueursInconnus(inconnus) {}
```

- `catalogueMarqueurs.js` (**compléter**) : `clesDuCatalogue()` renvoie la liste figée des clés de `GROUPES_MARQUEURS`, sans les `saisie.*`. La JSDoc d'en-tête documente la **syntaxe écrite `{{cle}}`**, réservée au collage. Le Delta stocké ne contient jamais de `{{…}}` interprété : seulement des embeds `{ marqueur: { cle } }`.
- Pur, sans DOM : la regex s'applique au texte des ops. Un marqueur coupé par une mise en forme (`{{personne.<b>nom</b>}}`) n'est pas reconnu. Il reste du texte, sans avertissement : c'est un cas limite accepté.

### 5.6 `src/domain/contrats/modelesDeDepart.js` (**créer**)

`modelesDeDepart()` → deux `ModeleContrat` construits par `creerModeleContrat`. Leurs champs libres sont créés par `creerChampLibre` (GUID **générés à l'appel**, jamais écrits en dur). Le texte est construit par de petites aides locales :

- `titre(texte, niveau)` ;
- `paragraphe(...morceaux)` ;
- `champ(cle)`, qui produit l'embed.

**Le contenu est indicatif.** Il s'inspire de la structure du contrat type de remplacement entre infirmiers libéraux proposé par l'Ordre national des infirmiers, sans prétendre le reproduire ni citer d'article de loi. Le premier paragraphe de chaque modèle est, en italique :

> « Modèle indicatif préparé par Idelia. Faites-le relire (Ordre des infirmiers, juriste) et adaptez-le avant toute utilisation. Supprimez ce paragraphe une fois le modèle vérifié. »

Ainsi, un modèle non relu porte l'avertissement jusque sur le papier.

**« Contrat de remplacement »** (`CONTRAT`). Champs libres : « Date de début du remplacement » (DATE), « Date de fin du remplacement » (DATE), « Lieu de signature » (TEXTE).

1. Titre 1 : « Contrat de remplacement entre infirmier(e)s libéraux(ales) ». Puis l'avertissement.
2. Titre 2 « Entre les soussigné(e)s » :
   - [titulaire.nomComplet], infirmier(e) libéral(e) exerçant au sein de [cabinet.nom], [cabinet.adresse], n° RPPS [titulaire.rpps], n° ordinal [titulaire.ordinal], ci-après « le/la titulaire » ;
   - et [personne.nomComplet], né(e) le [personne.dateNaissance], demeurant [personne.adresse], n° RPPS [personne.rpps], n° ordinal [personne.ordinal], ci-après « le/la remplaçant(e) ».
3. « Article 1 – Objet » : remplacement du/de la titulaire auprès de sa patientèle, pendant ses absences, dans le respect des règles professionnelles.
4. « Article 2 – Durée » : du [saisie Date de début] au [saisie Date de fin] inclus.
5. « Article 3 – Conditions d'exercice » : utilisation des locaux et du matériel du cabinet, continuité des soins, information des patients, pas d'activité en parallèle du/de la titulaire pendant le remplacement.
6. « Article 4 – Rétrocession » : le/la remplaçant(e) rétrocède au/à la titulaire [personne.tauxRetrocession] des honoraires perçus au titre du remplacement, selon les modalités convenues entre les parties.
7. « Article 5 – Assurance » : chaque partie déclare être couverte par une assurance de responsabilité civile professionnelle.
8. « Article 6 – Après le remplacement » : clause de non-installation à préciser par les parties (durée, périmètre), dans les limites prévues par les règles professionnelles.
9. « Article 7 – Litiges » : recherche d'une solution amiable, au besoin par une conciliation auprès du conseil départemental de l'Ordre.
10. « Article 8 – Communication à l'Ordre » : le présent contrat est communiqué au conseil départemental de l'Ordre des infirmiers.
11. « Fait à [saisie Lieu de signature], le [date.jour], en deux exemplaires. »
12. Deux paragraphes de signature : « Le/la titulaire (mention « Lu et approuvé ») » / « Le/la remplaçant(e) (mention « Lu et approuvé ») ».

**« Avenant – taux de rétrocession »** (`AVENANT`). Champs libres : « Date du contrat initial » (DATE), « Date d'effet » (DATE), « Nouveau taux de rétrocession » (**TAUX_RETROCESSION**), « Lieu de signature » (TEXTE).

1. Titre 1 : « Avenant au contrat de remplacement ». Puis l'avertissement.
2. Mêmes parties que le contrat, en version courte : nom complet, RPPS, cabinet.
3. « Article 1 – Objet » : modification du taux de rétrocession prévu au contrat de remplacement signé le [saisie Date du contrat initial].
4. « Article 2 – Nouveau taux » : à compter du [saisie Date d'effet], le taux de rétrocession passe de [personne.tauxRetrocession] à [saisie Nouveau taux de rétrocession]. Les deux valeurs portent déjà « % » : rien n'est à écrire après la pastille.
5. « Article 3 – Autres clauses » : toutes les autres clauses du contrat initial restent inchangées.
6. « Fait à … le [date.jour] », puis les signatures, comme le contrat.

### 5.7 Adaptateur Quill `src/adaptateurs/editeurRiche.js` (**créer**, hors domaine, ADR 0023)

**Seul fichier** qui importe `quill`.

- `chargerQuill()` : `import('quill/core')` (ou `import('quill')` selon la §12 n° 6) et `import('quill/dist/quill.core.css')`, en **dynamique**, une seule fois (promesse mémorisée). Il enregistre le blot `marqueur` une seule fois. Erreur de chargement : `Error` portant `code: 'EDITEUR_INDISPONIBLE'`, et la promesse mémorisée est remise à zéro pour permettre « Réessayer ».
- **Blot `MarqueurBlot`** (`Quill.import('blots/embed')`) :
  - `blotName = 'marqueur'`, `tagName = 'span'`, `className = 'ql-marqueur'` ;
  - `create({ cle })` pose `data-cle`, la classe `ql-marqueur--saisie` si la clé commence par `saisie.`, et `textContent` = libellé résolu. Le libellé passe **toujours** par `textContent`, jamais par `innerHTML` ;
  - `value(node)` → `{ cle: node.dataset.cle }` : seule la clé est stockée, le libellé n'est jamais persisté.
  - La résolution du libellé passe par un `resoudreLibelle` de module, fixé par l'instance active (une seule instance éditable à la fois).
- `creerEditeur(element, { contenu, resoudreLibelle, lectureSeule = false, libelleAccessible })` → `Promise<ControleurEditeur>` :
  - `new Quill(element, { theme: undefined /* core */, readOnly: lectureSeule, formats: ['bold','italic','underline','header','list','align','marqueur'], modules: { toolbar: false, history: { userOnly: true } } })` ;
  - la **liste blanche `formats`** élimine au collage tout ce qui n'est pas autorisé : liens, images, couleurs, polices ;
  - pose `aria-label`, `aria-multiline="true"` et `role="textbox"` sur `.ql-editor`.
- `ControleurEditeur` (API minimale consommée par `EditeurRiche.vue`) :
  - `lireContenu()` → `{ ops }` (copie JSON) et `ecrireContenu(delta)` (`setContents`, source `api`) ;
  - `basculerFormat(nom, valeur)` (`format`/`formatLine` selon le format) et `formatsCourants()` ;
  - `insererMarqueur(cle)` à la dernière sélection connue (mémorisée sur `selection-change`), suivie d'un espace, puis curseur après ;
  - `annuler()` / `retablir()` ;
  - `rafraichirLibelles()` : réécrit `textContent` de chaque `.ql-marqueur` après le renommage d'un champ libre ;
  - `surChangement(rappel)` (`text-change` source `user`) et `surSelection(rappel)` ;
  - `focus()` et `detruire()` (détache les écouteurs).
- `afficherEnLecture(element, delta, resoudreLibelle)` : raccourci `lectureSeule: true`, **prévu pour 0042** (rendu sans `v-html`).
- **Collage** : option `convertirCollage(delta) → { delta, inconnus }` de `creerEditeur`, **injectée** par `EditeurRiche.vue`. L'adaptateur reste générique et n'importe pas le domaine.
  - L'adaptateur enregistre une sous-classe de `Quill.import('modules/clipboard')` qui surcharge `onPaste(range, { text, html })` :
    1. `const colle = this.convert({ html, text })` : texte déjà assaini par Quill, limité à la liste blanche `formats` ;
    2. `const { delta, inconnus } = convertirCollage(colle)` ;
    3. application comme le comportement natif : `retain(range.index)`, `delete(range.length)`, `concat(delta)`, `updateContents(…, 'user')`, curseur placé après le texte collé, défilement jusqu'à lui ;
    4. rappel `surMarqueursInconnus(inconnus)`, appelé même avec une liste vide, ce qui efface l'avertissement précédent.
  - En lecture seule, le collage est sans objet.
  - Repli documenté si la surcharge pose problème en Quill 2 : un `clipboard.addMatcher(Node.TEXT_NODE, …)` qui applique `convertirCollage` nœud par nœud.

## 6. Composants et styles

### 6.1 `src/components/contrats/EditeurRiche.vue` (**créer**)

Enveloppe Options API de l'adaptateur.

- **Props** : `contenu` (Object, requis), `champsLibres` (Array), `lectureSeule` (Boolean), `libelleAccessible` (String).
- **Émet** : `modifie` (sans charge utile), `pret`, `erreur-chargement`.
- **Collage** : il passe `convertirCollage: (d) => convertirMarqueursTexte(d, clesDuCatalogue())` à l'adaptateur. Il affiche lui-même l'avertissement `messageMarqueursInconnus(inconnus)` au-dessus de la zone de texte (`alert-warning`, `role="status"`, bouton de fermeture `btn-close` avec `aria-label="Fermer l'avertissement"`). Il contient aussi l'aide repliable « Coller un contrat existant » (`PhClipboardText`, bascule Vue `aria-expanded`), sous la barre d'outils.
- **Méthodes publiques**, appelées par la vue via `ref` : `lireContenu()`, `insererMarqueur(cle)`, `rafraichirLibelles()`, `focus()`.
- **Piège Vue** : l'instance Quill et le contrôleur ne sont **jamais dans `data()`**. Le proxy réactif casse Quill. On les affecte en `mounted` à une propriété non déclarée (`this.controleur = …`) et on les libère dans `beforeUnmount` (`detruire()`).
- `resoudreLibelle` = `(cle) => libelleMarqueur(cle, this.champsLibres)`.
- Contient `BarreOutilsEditeur` et la zone `div.editeur-riche__zone`. Affiche le chargement ou l'erreur avec « Réessayer » (§2.3, point 9).

### 6.2 `src/components/contrats/BarreOutilsEditeur.vue` (**créer**)

- `role="toolbar"`, `aria-label="Mise en forme du texte"` ; navigation au clavier : `Tab` entre les groupes, boutons natifs.
- Boutons **icône seule**, `title` + `aria-label` en français, `aria-pressed` selon `formatsCourants`, 44 px. Espacement `$espace-1` dans un groupe, `$espace-3` entre groupes (préférence du porteur). Sur mobile, toute la largeur.
- Icônes Phosphor : `PhTextB`, `PhTextItalic`, `PhTextUnderline`, `PhTextHOne`, `PhTextHTwo`, `PhListBullets`, `PhListNumbers`, `PhTextAlignLeft`, `PhTextAlignCenter`, `PhTextAlignRight`, `PhTextAlignJustify`, `PhArrowCounterClockwise`, `PhArrowClockwise`.
- `@mousedown.prevent` sur chaque bouton : le texte garde sa sélection.
- Émet `format({ nom, valeur })`, `annuler`, `retablir` ; inclut `MenuInsererChamp`.

### 6.3 `src/components/contrats/MenuInsererChamp.vue` (**créer**)

- Bouton **« Insérer un champ »** (texte + `PhBracketsCurly`), `aria-haspopup="menu"`, `aria-expanded`.
- Bascule Vue simple, sans JS Bootstrap, comme le préconise `style-scss.md`.
- Chaque champ du catalogue affiche, sous son libellé, son **code** en petit et en police à chasse fixe, couleur `t.$couleur-texte-attenue` (`syntaxeMarqueur(cle)`, par ex. `{{personne.nom}}`). C'est la documentation visible de la syntaxe de collage. Le code est inclus dans le nom accessible : « Nom de la personne, code {{personne.nom}} ». Les champs à compléter n'affichent pas de code (GUID), mais la mention « à insérer depuis ce menu ».
- Menu en liste groupée (`GROUPES_MARQUEURS`, puis les champs libres du modèle, puis « + Nouveau champ à compléter… ») :
  - flèches haut et bas, `Entrée` pour choisir, `Échap` pour fermer et rendre le focus au bouton ;
  - fermeture au clic extérieur ;
  - hauteur maximale avec défilement.
- Émet `choisir(cle)` et `nouveau-champ`.

### 6.4 `src/components/contrats/ModaleModeleContrat.vue` (**créer**)

- Sur `ModaleBase`, avec Vuelidate : **Titre** (texte) et **Type** (deux radios « Contrat » / « Avenant », avec aide d'une ligne).
- Mode création (« Nouveau modèle », bouton « Créer et ouvrir ») ou renommage (« Renommer le modèle », bouton « Enregistrer »).
- Émet `valider({ titre, type })`.

### 6.5 `src/components/contrats/ModaleChampLibre.vue` (**créer**)

- **Libellé** (aide : « Ce texte sera affiché dans le modèle et demandé lors de la création du document, par ex. « Date d'effet ». »).
- **Type** : radios Texte / Date / Nombre / Taux de rétrocession (%), chacun avec son aide (`AIDES_TYPE_CHAMP_LIBRE`).
- Le radio « Taux de rétrocession (%) » est **désactivé** si un autre champ du modèle a déjà ce type, avec l'aide « Ce modèle demande déjà un taux de rétrocession. »
- Création ou modification. Émet `valider({ libelle, type })`.

### 6.6 Vues

- **`src/views/ModelesContratsView.vue`** (**créer**) : §2.2.
  - `created` → `assurerModelesDeDepart()` ;
  - utilise `ModaleModeleContrat` et `DialogueConfirmation` (archivage) ;
  - classes et structure calquées sur `TourneesView.vue` (en-tête, liste, archives repliables, état vide).
- **`src/views/ModeleContratView.vue`** (**créer**) : §2.3.
  - `data()` : `modifie`, `champsLibresBrouillon` (copie), `dialogueQuitter`, `resoudreQuitter` (fonction).
  - `beforeRouteLeave` : si `modifie`, renvoie une `Promise<boolean>` résolue par `DialogueConfirmation` (« Rester sur la page » → `false`).
  - `beforeRouteUpdate` : même garde, au passage d'un modèle à un autre (Dupliquer).
  - `mounted` / `beforeUnmount` : `window` `beforeunload` (seulement si `modifie`) et `keydown` Ctrl+S (`preventDefault`).
  - « Enregistrer » → `contrats/enregistrerModele({ id, contenu: editeur.lireContenu(), champsLibres })`, puis `modifie = false`.
  - « Retirer » d'un champ libre : désactivé si `champLibreUtilise(editeur.lireContenu(), cle)`, réévalué à chaque `modifie`.

### 6.7 Routeur et menu

- `src/router/index.js` (**modifier**), avec chargement **paresseux** pour que le chunk Quill ne pèse que sur ces écrans :
  - `{ path: '/modeles-contrats', name: 'modeles-contrats', component: () => import('@/views/ModelesContratsView.vue') }` ;
  - `{ path: '/modeles-contrats/:id', name: 'modele-contrat', component: () => import('@/views/ModeleContratView.vue') }`.
- `src/components/communs/MenuLateral.vue` (**modifier**) :
  - groupe `{ titre: 'Contrats', items: [{ nom: 'modeles-contrats', chemin: '/modeles-contrats', libelle: 'Modèles', icone: 'PhFileText' }] }` après « Planning » ;
  - import et enregistrement de `PhFileText` ;
  - **ne pas** ajouter « Documents » (`/contrats`, `PhSignature`) : 0042 l'insère en tête du groupe.

### 6.8 Styles `src/styles/_editeur-riche.scss` (**créer**, importé dans `main.scss` après `_base`)

Global, car Quill crée son DOM hors du scope des composants. Préfixé `.editeur-riche`, assez spécifique pour l'emporter sur `quill.core.css`, chargé plus tard.

- `.ql-editor` :
  - fond `t.$couleur-fond`, texte `t.$couleur-texte`, bordure `t.$couleur-bordure`, rayon `t.$rayon-md` ;
  - police Manrope héritée, `font-size` 1rem, `line-height` 1.6, `min-height` 50vh, `max-width` 21cm, centré ;
  - focus : `m.focus-visible` ou contour `t.$couleur-focus`.
- `h1` et `h2` dans l'éditeur : tailles du thème.
- `.ql-editor.ql-blank::before` (texte indicatif) : `t.$couleur-texte-attenue`, non italique. Texte : « Commencez à écrire votre modèle ici… ».
- `.ql-marqueur` :
  - `display: inline-block`, `padding: 0 t.$espace-1`, `border-radius: t.$rayon-sm` ;
  - `background: m.translucide(t.$couleur-primaire, 0.14)`, `border: 1px solid t.$couleur-primaire`, `color: t.$couleur-texte`, `font-weight: t.$graisse-moyenne`, `white-space: nowrap`.
- `.ql-marqueur--saisie` : `background: m.translucide(t.$couleur-accent-foncee, 0.14)`, `border-style: dashed`, `border-color: t.$couleur-accent-foncee`, préfixe `::before { content: '✎ '; }` ou équivalent CSS, sans dépendance.
- **Aucune couleur en dur ni `rgba(t.…)`** (ADR 0022) : les deux thèmes fonctionnent d'office.
- `@media print` : sans objet en 0041 (l'impression vient avec 0042).

## 7. Règles de validation

| Saisie | Règles (Vuelidate) | Messages FR |
| --- | --- | --- |
| Titre du modèle | requis (après `trim`), ≤ 120 | « Donnez un titre au modèle. » / « 120 caractères au maximum. » |
| Type du modèle | requis, ∈ `TYPES_MODELE_CONTRAT` | « Choisissez Contrat ou Avenant. » |
| Libellé d'un champ à compléter | requis, ≤ 80, **unique dans le modèle** (insensible à la casse et aux espaces) | « Donnez un nom à ce champ. » / « 80 caractères au maximum. » / « Ce modèle a déjà un champ portant ce nom. » |
| Type d'un champ à compléter | requis, ∈ `TYPES_CHAMP_LIBRE` ; `TAUX_RETROCESSION` **au plus une fois par modèle** (`peutAjouterTauxRetrocession`, radio désactivé et validateur) | « Choisissez le type de réponse attendue. » / « Ce modèle demande déjà un taux de rétrocession. » |

- Deux modèles peuvent porter le même titre : c'est **non bloquant**, avec la note sous le champ « Un autre modèle porte déjà ce titre. ». Débounce `vue-debounce` 300 ms sur cette vérification.
- Contenu vide : enregistrable (un brouillon de modèle peut être vide).
- **Import** (`src/domain/validationImport.js`, **modifier**) :
  - `MAX.modelesContrats = 200`, `MAX.documentsContrats = 5000`, `MAX.champsLibres = 50` ;
  - nouveau contrôleur `delta: (v) => estDeltaModeleValide(v)` dans `CONTROLEURS` ;
  - `REGLES_MODELE_CONTRAT` = `{ id: id requis, titre: texte requis max 120, type: enum TYPES_MODELE_CONTRAT requis, contenu: delta requis, champsLibres: tableau max 50, actif: booleen, createdAt, updatedAt: horodatage }` ;
  - `REGLES_CHAMP_LIBRE` = `{ cle: texte requis max 100 + forme saisie.<GUID>, libelle: texte requis max 80, type: enum TYPES_CHAMP_LIBRE requis }`. La forme de `cle` passe par un contrôleur `cleSaisie` dédié. `TYPES_CHAMP_LIBRE` inclut `TAUX_RETROCESSION` : un fichier contenant ce type est accepté, un type inconnu est refusé ;
  - dans `verifierStructure`, après le contrôle des collections : pour chaque modèle dont `champsLibres` est une liste, **plus d'un** champ `TAUX_RETROCESSION` produit l'erreur « Modèle de contrat n°X : un seul champ « Taux de rétrocession » est permis. » ;
  - `COLLECTIONS` : ajout de `{ nom: 'modelesContrats', regles: REGLES_MODELE_CONTRAT, libelle: 'Modèle de contrat', sous: [{ champ: 'champsLibres', regles: REGLES_CHAMP_LIBRE, libelle: 'champ à compléter' }] }` ;
  - `documentsContrats` : contrôlé dans `verifierStructure` comme `vacancesScolaires` (liste, ≤ 5000, éléments objets). Ses règles détaillées viennent en 0042.
  - Message type, déjà produit par `controlerChamps` : « Modèle de contrat n°2 : le champ « contenu » est invalide. »
- `verifierIntegrite` : **aucun contrôle référentiel** en 0041, car un modèle ne référence aucune entité. 0042 y ajoutera `document.personneId` et `document.modeleId`. Mettre à jour sa JSDoc en conséquence.

## 8. Points d'attention ergonomie

- **Insertion normale par le menu** : les champs s'insèrent par « Insérer un champ », s'affichent en français et se suppriment comme un seul caractère (Retour arrière). Il n'est jamais nécessaire de taper `{{…}}`.
- **Le collage est un raccourci** pour reprendre un contrat existant. Les codes `{{cle}}` reconnus deviennent des pastilles, les autres restent du texte et sont signalés sans bloquer, avec le renvoi vers « Insérer un champ ». La pastille obtenue est identique à celle du menu : le contenu enregistré ne garde aucune syntaxe technique. Taper `{{personne.nom}}` au clavier ne le convertit pas : seul le collage le fait, ce qui reste prévisible.
- **Deux sortes de champs, deux formes** : bordure pleine pour un champ automatique, pointillés et crayon pour un champ à compléter. Le libellé est lisible sans légende. Une phrase d'aide sous la barre d'outils le rappelle : « En couleur : rempli automatiquement. En pointillés : demandé lors de la création du document. »
- **Barre réduite** : uniquement ce qui sert à un contrat. Pas de couleurs, de polices, de liens ni d'images, ce qui évite aussi les copier-coller de Word qui « cassent » la mise en page (le collage est nettoyé par la liste blanche).
- **Annuler / Rétablir** visibles (et Ctrl+Z / Ctrl+Y) : on peut toujours revenir en arrière.
- **Enregistrement explicite**, mais **impossible à oublier** : bouton principal à droite du titre, état « Modifications non enregistrées » permanent, confirmation en quittant, alerte du navigateur en fermant l'onglet, Ctrl+S.
- **Pas de suppression définitive** : archiver se rattrape (section « Modèles archivés », Restaurer).
- **Modèles de départ** : la page n'est jamais vide au premier accès. L'avertissement « à faire relire » est dans le texte lui-même et dans le toast.
- **Contrastes** : pastilles et éditeur via les tokens, contrôlés dans les deux thèmes (texte des pastilles ≥ 4,5:1).
- **Accessibilité** : zone de texte nommée « Texte du modèle « … » », barre `role="toolbar"`, `aria-pressed`, menu « Insérer un champ » utilisable entièrement au clavier, focus rendu au texte après insertion. La pastille est annoncée par son libellé, son texte étant réel.
- **Premier chargement** : la bibliothèque (~ 200 kB) n'est chargée qu'à l'ouverture d'un modèle. Un message clair s'affiche si elle n'arrive pas.

## 9. Étapes d'implémentation

Six tâches, chacune confiée à **un nouveau sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)).

- Ordre : **T1 → T2 → T3 → T4 → T5 → T6**.
- **Pré-requis bloquant** : 0039 (v11) et 0040 (v12) sont livrées : `CURRENT_SCHEMA_VERSION === 12`, `MIGRATIONS[10]` et `MIGRATIONS[11]` présentes, menu réorganisé, `src/domain/adresse.js` disponible. Sinon, s'arrêter et le signaler, sans renuméroter la migration de 0041 (`MIGRATIONS[12]`, v12 → v13).
- Contexte à transmettre à chaque sous-agent :
  - règles d'or n° 2, 3, 4, 5, 7, 8, 9, 10, 12 ;
  - ADR 0022, ADR 0023 (après T1) ;
  - ce plan, et la préférence UI « bouton à droite du titre, actions en icône seule + `title` + `aria-label` ».
- **Un seul commit pour la feature**, en fin de T6, après la recette (§11).

### Tâche 1 — ADR 0023 et dépendance `quill@2`

**Fichiers** :

- `docs/adr/0023-editeur-riche-quill.md` (**créer**, gabarit `docs/adr/0000-modele-adr.md`, statut « Accepté », décideurs « porteur du projet (choix de Quill confirmé le 2026-10-26), rédaction par l'agent architecte »).
  - **Contexte** : besoin d'un texte mis en forme avec champs non éditables, public non technique, KISS (règle n° 12), aucun backend, pas de `v-html`, mode sombre.
  - **Décision** :
    - `quill` **2.x**, **version exacte** sans `^` : la dernière 2.x publiée depuis plus de 2 semaines (vérifier `npm view quill time --json` ; 2.0.3 à la rédaction) ;
    - **sans wrapper Vue** (`vue-quill`, `@vueup/vue-quill` écartés : dépendance en plus, souvent en retard sur Quill, Composition API) ;
    - **chargée à la demande** (`import()` dynamique, routes paresseuses), **isolée** dans `src/adaptateurs/editeurRiche.js` ;
    - thème **core** seulement : `quill.core.css` structurel, aucune icône Quill, barre d'outils en Vue et icônes Phosphor (ADR 0013), couleurs par les tokens (ADR 0022) ;
    - **liste blanche `formats`** ;
    - contenu stocké en **Delta JSON**, jamais en HTML, validé à l'import ;
    - rendu en lecture par Quill `readOnly` (0042), jamais `v-html` ;
    - champs = **blot embed** `marqueur` `{ cle }`.
  - **Conséquences** :
    - positives : bundle principal inchangé, Delta testable sans DOM, collage nettoyé, une seule bibliothèque remplaçable en touchant un fichier ;
    - négatives : dépendance à suivre (alertes de sécurité), réseau nécessaire au premier usage, rendu Quill (classes `ql-*`) à styler nous-mêmes, Quill 2 jeune sur certains points (embeds et sélection) ;
    - suivi : réévaluer si Quill n'est plus maintenu.
  - **Alternatives considérées** :
    - `contenteditable` maison et `execCommand` (obsolète, fragile) ;
    - TipTap / ProseMirror (plus lourd, écosystème orienté Composition API et extensions) ;
    - CKEditor / TinyMCE (lourds, licences, services en ligne) ;
    - textarea Markdown (inadapté au public) ;
    - HTML stocké et `v-html` (XSS).
  - **Liens** : ADR 0002, 0005, 0008, 0013, 0019, 0022 ; features 0041, 0042.
- `package.json` / `package-lock.json` (**modifier**) : `npm install quill@<version> --save-exact`.
- `docs/architecture/06-structure-du-code.md` (**modifier**) :
  - `editeurRiche.js # éditeur Quill chargé à la demande, blot marqueur [ADR 0023, 0041]` sous `adaptateurs/` ;
  - `contrats/ # modèles de contrats : catalogue des marqueurs, Delta, remplacement [0041]` sous `domain/` ;
  - `components/contrats/` ;
  - `_editeur-riche.scss`.

**Critères de sortie** :

- L'ADR suit le gabarit, ses cinq sections sont remplies, et il est référencé depuis ce plan.
- `package.json` contient `"quill": "2.x.y"` **sans** `^` ni `~`. `npm run build` réussit.
- Aucune autre dépendance ajoutée.

### Tâche 2 — Domaine pur des contrats

**Fichiers** :

- `src/domain/schema.js` (**modifier**) : `TYPES_MODELE_CONTRAT`, `TYPES_CHAMP_LIBRE` (§5.1). La partie état et sérialisation vient en T3.
- `src/domain/libelles.js` (**modifier**) : §5.1.
- `src/domain/utils/dates.js` (**modifier**) : `formatDateLongueFr`, ajouté à `dateUtil`.
- `src/domain/utils/id.js` (**modifier**) : `estGuid(valeur)`. `src/storage/migrations.js` réutilise `estGuid` au lieu de sa regex locale `FORMAT_GUID`, sans changement de comportement.
- `src/domain/contrats/delta.js`, `catalogueMarqueurs.js` (avec `clesDuCatalogue`), `modeles.js`, `marqueurs.js`, `collage.js`, `modelesDeDepart.js` (**créer**) : §5.2 à §5.6 (et §5.5 bis), JSDoc complète (`@typedef ModeleContrat`, `ChampLibre`, `ContexteMarqueurs`).

**Critères de sortie** :

- Une recherche `from 'vue'|from 'vuex'|quill|document\.|window\.` dans `src/domain/contrats/` ne renvoie **rien**.
- Les fonctions sont vérifiées en console (`npm run dev`, `const m = await import('/src/domain/contrats/marqueurs.js')`…), avec une personne fictive. Données d'essai : GUID générés, jamais d'identifiants lisibles.
  - `remplacerMarqueurs` remplace `personne.prenom` par le prénom et garde l'attribut `bold` de l'embed. Il laisse `titulaire.rpps` en embed si la personne n'a pas de titulaire, et ne modifie pas le Delta d'entrée (comparaison `JSON.stringify` avant/après).
  - `marqueursNonResolus` renvoie chaque clé une seule fois, dans l'ordre, avec son libellé.
  - Une saisie `DATE` `'2026-11-03'` donne « 3 novembre 2026 ». `NOMBRE` `12.5` donne « 12,5 ». Le taux 20 donne « 20 % ».
  - Une saisie `TAUX_RETROCESSION` de `25` donne « 25 % », et `22.5` donne « 22,5 % ». `-1`, `101` et `'abc'` sont non résolus et listés par `marqueursNonResolus`.
  - `champTauxRetrocession` sur l'avenant de départ renvoie le champ « Nouveau taux de rétrocession ». Sur le contrat de départ, il renvoie `null`.
  - `peutAjouterTauxRetrocession` vaut `false` sur l'avenant de départ pour une nouvelle clé, et `true` pour la clé du champ existant (modification).
  - `estDeltaModeleValide` refuse :
    - `{ insert: 'x', attributes: { link: 'javascript:alert(1)' } }` ;
    - `{ insert: { image: 'https://…' } }` ;
    - `{ retain: 3 }` ;
    - `{ insert: { marqueur: { cle: 'saisie.abc' } } }` ;
    - un `ops` de 20 001 éléments ;
    - `null`.

    Il accepte les deux modèles de départ.
  - `convertirMarqueursTexte` (`collage.js`), avec `clesDuCatalogue()` :
    - `{ ops: [{ insert: 'Entre {{personne.nom}} et {{ Titulaire.NomComplet }}\n' }] }` produit le texte « Entre », l'embed `personne.nom`, le texte « et », l'embed `titulaire.nomComplet` (clé canonique), puis `'\n'`, avec `inconnus: []` ;
    - `{ insert: 'Né le {{personne.dateNaissance}}', attributes: { bold: true } }` donne un embed qui garde `bold: true` ;
    - `'{{personne.adres}} {{saisie.date}} {{personne.adres}}'` laisse tout en texte, avec `inconnus: ['{{personne.adres}}', '{{saisie.date}}']` (unique, dans l'ordre) ;
    - `'{personne.nom}'`, `'{{}}'`, `'{{ personne }}'` et un texte de 100 000 caractères sans accolades restent inchangés, sans erreur ;
    - un op embed déjà présent est conservé ; le Delta d'entrée n'est pas modifié (`JSON.stringify` avant/après) ; le résultat vérifie `estDeltaModeleValide` ;
    - `messageMarqueursInconnus` de 7 codes affiche 5 codes puis « … », et commence par « 7 champs non reconnus » ; une liste vide donne `''`.
  - `modelesDeDepart()` appelé deux fois produit des `id` et des `cle` de champs libres **différents**. Chaque `saisie.*` utilisée dans le texte existe dans `champsLibres`.
- `npm run build` réussit.

### Tâche 3 — Persistance : schéma, migration v13, validation d'import, module Vuex

**Fichiers** :

- `src/domain/schema.js` (**modifier**) :
  - `EtatRacine.contrats: { modeles, documents }` et `SaveDocument.modelesContrats` / `documentsContrats` (JSDoc) ;
  - `etatParDefaut()` → `contrats: { modeles: [], documents: [] }` ;
  - `toSaveDocument` → `modelesContrats: rootState.contrats.modeles`, `documentsContrats: rootState.contrats.documents` ;
  - `fromSaveDocument` → `contrats: { modeles: (doc.modelesContrats ?? []).map(normaliserModeleContrat), documents: doc.documentsContrats ?? [] }` ;
  - JSDoc de `verifierIntegrite` (§7).
- `src/storage/migrations.js` (**modifier**) : `CURRENT_SCHEMA_VERSION = 13`, `MIGRATIONS[12]` documentée (§3.2).
- `src/domain/validationImport.js` (**modifier**) : §7.
- `src/store/modules/contrats.js` (**créer**) : §4.1.
- `src/store/index.js` (**modifier**) : §4.2.
- `docs/architecture/02-modele-de-domaine.md`, `03-modele-de-donnees.md`, `04-gestion-etat-vuex.md` (**modifier**) : entité, collections v13, module `contrats`.

**Critères de sortie** :

- `npm run build` réussit.
- Démarrage sur les données v12 de `idelia-sermet.json` : aucune erreur. `localStorage` contient, après la première modification, `schemaVersion: 13`, `modelesContrats: []` et `documentsContrats: []`.
- Console :
  - `store.dispatch('contrats/assurerModelesDeDepart')` crée 2 modèles et un toast ; un second appel ne crée rien ;
  - `dupliquerModele` crée une copie indépendante : modifier la copie ne change pas l'original ;
  - `archiverModele` et `restaurerModele` déplacent le modèle entre `modelesActifs` et `modelesArchives`.
- **Export puis import** : les modèles reviennent à l'identique, contenu Delta compris.
- **Import forgé** (copie de l'export avec `"attributes": { "link": "javascript:alert(1)" }` dans un modèle) : refusé avec « Modèle de contrat n°1 : le champ « contenu » est invalide. », et les données actuelles sont conservées.
- **Import forgé (taux)** : un second champ `TAUX_RETROCESSION` ajouté à l'avenant est refusé avec « … un seul champ « Taux de rétrocession » est permis. ». Un champ de type `"POURCENT"` est refusé (« le champ « type » est invalide »). L'export d'origine, qui contient un champ `TAUX_RETROCESSION`, se réimporte sans erreur.
- « Effacer toutes les données » vide les modèles.
- Une recherche `localStorage` dans `src/` ne trouve que `storageRepository.js`.

### Tâche 4 — Éditeur riche : adaptateur Quill, composants, styles

**Fichiers** :

- `src/adaptateurs/editeurRiche.js` (**créer**) : §5.7.
- `src/components/contrats/EditeurRiche.vue`, `BarreOutilsEditeur.vue`, `MenuInsererChamp.vue` (**créer**) : §6.1 à §6.3. Sont inclus le collage converti (surcharge `onPaste` de l'adaptateur, §5.7), l'avertissement des codes inconnus, l'aide « Coller un contrat existant » et l'affichage des codes `{{…}}` dans le menu.
- `src/styles/_editeur-riche.scss` (**créer**) et `src/styles/main.scss` (**modifier**, import et commentaire d'ordre) : §6.8.
- `docs/instructions/composants-vue.md` (**modifier**) : courte règle « Bibliothèque impérative (Quill…) : instance hors `data()`, détruite dans `beforeUnmount` ; jamais de `v-html` sur du contenu utilisateur ».

**Critères de sortie** :

- `npm run build` : Quill est dans un **chunk séparé**. Le chunk d'entrée ne contient pas `quill` : vérifier `dist/assets` et la taille de l'entrée inchangée à ± 2 %.
- Une recherche `from 'quill'|import\('quill` dans `src/` ne trouve que `editeurRiche.js`. Une recherche `v-html` dans `src/` ne renvoie **rien**.
- Page de test temporaire (ou T5/T6 directement) :
  - chaque bouton applique ou retire son format, avec un `aria-pressed` juste ;
  - Ctrl+Z annule ;
  - « Insérer un champ » insère une pastille au curseur, que Retour arrière supprime d'un coup ;
  - coller depuis une page web un texte avec lien, image et couleurs ne garde que gras, italique, souligné, titres, listes et alignement ;
  - coller « Je soussigné(e) {{ personne.nomComplet }}, n° RPPS {{personne.rpps}}, {{personne.adres}} » produit deux pastilles et laisse `{{personne.adres}}` en texte, avec l'avertissement « 1 champ non reconnu : {{personne.adres}} — insérez-le avec « Insérer un champ ». ». Le collage suivant, sans code inconnu, efface l'avertissement. Ctrl+Z annule le collage en une fois ;
  - le menu « Insérer un champ » affiche le code `{{…}}` sous chaque champ du catalogue, et l'aide « Coller un contrat existant » s'ouvre et se ferme au clavier ;
  - `lireContenu()` ne contient que des ops valides (`estDeltaModeleValide === true`).
- Mode sombre : éditeur, pastilles, barre et menu lisibles ; aucune couleur en dur (une recherche `#[0-9a-f]{3,6}|rgba\(` dans les nouveaux fichiers ne renvoie rien).

### Tâche 5 — Menu, routes et page Modèles (liste)

**Fichiers** :

- `src/router/index.js` (**modifier**) : les deux routes paresseuses (§6.7). La vue d'édition peut être un squelette jusqu'à T6.
- `src/components/communs/MenuLateral.vue` (**modifier**) : groupe « Contrats » avec « Modèles » (`PhFileText`), après « Planning ». « Documents » (`PhSignature`) n'est **pas** ajouté (0042).
- `src/views/ModelesContratsView.vue` (**créer**) : §2.2 et §6.6.
- `src/components/contrats/ModaleModeleContrat.vue` (**créer**) : §6.4.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) : lignes `/modeles-contrats` et `/modeles-contrats/:id`, groupe de menu « Contrats ».

**Critères de sortie** :

- Le menu affiche le groupe « Contrats » après « Planning », replié et déplié (infobulle « Modèles »). L'item est actif sur `/modeles-contrats` **et** `/modeles-contrats/<GUID>`, et seulement là.
- Premier accès : deux modèles et un toast. Aucun doublon après rechargement.
- Nouveau modèle, Dupliquer, Renommer, Archiver (avec confirmation) et Restaurer fonctionnent, chacun avec son toast. Les actions de ligne sont des icônes seules avec `title` et `aria-label`.
- Vuelidate : titre vide refusé avec le message du §7 ; titre en double signalé sans blocage.
- `npm run build` réussit.

### Tâche 6 — Page d'édition d'un modèle

**Fichiers** :

- `src/views/ModeleContratView.vue` (**créer** ou compléter) : §2.3 et §6.6.
- `src/components/contrats/ModaleChampLibre.vue` (**créer**) : §6.5.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier** si besoin) : détail de l'écran d'édition.

**Critères de sortie** :

- Le parcours §11 (étapes 3 à 8) est entièrement vert.
- Enregistrer puis recharger (`F5`) : le contenu, les pastilles et les champs à compléter sont identiques.
- La garde de sortie fonctionne via le menu, via « Retour » et via le passage d'un modèle à sa copie. `beforeunload` n'intervient que si des modifications sont en attente.
- Renommer un champ à compléter met à jour **immédiatement** toutes ses pastilles. « Retirer » est désactivé tant que le champ est dans le texte.
- `npm run build` réussit. L'agent `ui-ux` relit les deux écrans dans les deux thèmes, puis l'agent `security` audite le lot (§12 n° 9).

## 10. Critères d'acceptation

- [ ] L'**ADR 0023** existe et la dépendance `quill` est **figée** (version exacte), chargée **uniquement** à l'ouverture d'un modèle.
- [ ] Le menu comporte un groupe **« Contrats »** après « Planning », avec l'entrée **« Modèles »** (`PhFileText`) active sur la liste et sur l'édition.
- [ ] Au premier accès, deux modèles de départ existent : « Contrat de remplacement » et « Avenant – taux de rétrocession ». Leur texte commence par l'avertissement « à faire relire ».
- [ ] On peut **créer**, **modifier**, **dupliquer**, **renommer**, **archiver** et **restaurer** un modèle. Aucune suppression définitive n'est proposée.
- [ ] L'éditeur offre gras, italique, souligné, titre, sous-titre, listes, alignements, annuler et rétablir, avec des **icônes Phosphor** et des infobulles en français.
- [ ] **« Insérer un champ »** propose les champs groupés (Personne, Titulaire remplacé(e), Cabinet, Date, Champs à compléter). La pastille insérée affiche un libellé en français et ne se modifie pas lettre par lettre.
- [ ] On peut créer, renommer et retirer des **champs à compléter** (Texte, Date, Nombre, Taux de rétrocession (%)). On ne peut pas retirer un champ encore utilisé. Un modèle compte au plus un champ « Taux de rétrocession ». Celui de l'avenant de départ (« Nouveau taux de rétrocession ») est de ce type.
- [ ] Les modifications non enregistrées sont **signalées en permanence** et protégées à la sortie (fenêtre de confirmation, alerte du navigateur). Ctrl+S enregistre.
- [ ] Le collage depuis Word ou une page web ne conserve que les mises en forme autorisées (ni lien, ni image, ni couleur).
- [ ] Coller un texte contenant des codes `{{cle}}` (espaces tolérés) du catalogue les transforme en pastilles. Les codes inconnus et les `{{saisie.…}}` restent du texte, et un avertissement non bloquant les liste avec le renvoi vers « Insérer un champ ». Le menu affiche le code de chaque champ, et une aide « Coller un contrat existant » explique la syntaxe.
- [ ] Le contenu est stocké en **Delta** (aucun HTML dans `localStorage` ni dans l'export). Aucun `v-html` dans `src/`.
- [ ] Les modèles sont dans la **sauvegarde** (export/import, `schemaVersion` 13). Un fichier v12 s'ouvre sans erreur. Un fichier contenant un lien `javascript:` ou une image dans un modèle est **refusé**.
- [ ] L'éditeur et les pastilles sont lisibles en **mode clair et en mode sombre**.
- [ ] Le domaine `src/domain/contrats/` n'importe ni Vue, ni Vuex, ni Quill. `remplacerMarqueurs` et `marqueursNonResolus` fonctionnent sur un Delta JSON.

## 11. Vérification

Recette navigateur : Playwright MCP, `npm run dev` sur le **port 5199**, données **`idelia-sermet.json`** importées (Paramètres › Restaurer une sauvegarde). Les GUID des personnes sont lus dans les données, jamais inventés.

1. **Migration** : après l'import, `localStorage` affiche `schemaVersion: 13`, `modelesContrats: []` et `documentsContrats: []`, sans erreur en console.
2. **Menu et premier accès** : le groupe « Contrats » se trouve après « Planning ». Cliquer sur « Modèles » : deux modèles et le toast. Recharger : toujours deux. Menu replié : infobulle « Modèles ». Fenêtre < 992 px : rail d'icônes, item visible.
3. **Chargement paresseux** : dans l'onglet Réseau, le chunk Quill n'est demandé qu'à l'ouverture d'un modèle (`browser_network_requests`). Couper le réseau avant la première ouverture : le message d'échec s'affiche ; rétablir le réseau, puis « Réessayer » : l'éditeur s'affiche.
4. **Édition** : ouvrir « Avenant – taux de rétrocession ». Mettre un mot en gras, ajouter un sous-titre et une liste numérotée, centrer une ligne, puis Ctrl+Z et Ctrl+Y. Insérer « N° RPPS de la personne » via le menu, au clavier uniquement (Tab, Entrée, flèches, Entrée) : la pastille apparaît au curseur et le focus revient au texte. Retour arrière la supprime d'un coup.
5. **Champs à compléter** : « + Nouveau champ à compléter… » → « Date de signature », type Date → pastille en pointillés insérée, ligne ajoutée sous l'éditeur. Renommer le champ en « Date de la signature » : la pastille change aussitôt. « Retirer » est désactivé ; supprimer la pastille du texte : « Retirer » s'active. Créer un second champ avec le même nom : refusé avec le message du §7. Sur l'avenant de départ, « Nouveau taux de rétrocession » est affiché avec le type « Taux de rétrocession (%) ». En créant un nouveau champ, le radio de ce type est désactivé avec son aide ; en modifiant le champ existant, il reste sélectionné.
6. **Collage** : coller (via `browser_evaluate` et un `ClipboardEvent` avec du `text/html`) `<p><a href="javascript:alert(1)">lien</a> <img src="https://exemple.org/x.png"> <span style="color:red">rouge</span></p>`. Seul le texte « lien rouge » est conservé, sans lien, image ni couleur. Aucune requête vers `exemple.org`.
   - **Collage de marqueurs** : coller (même méthode, `text/html` puis `text/plain` seul) `<p>Entre <b>{{ personne.nomComplet }}</b> et {{titulaire.nom}}, demeurant {{personne.adres}}, à compter du {{saisie.dateEffet}}.</p>`.
     - Il apparaît deux pastilles, celle de `personne.nomComplet` en gras, et deux codes restés en texte.
     - L'avertissement s'affiche : « 2 champs non reconnus : {{personne.adres}}, {{saisie.dateEffet}} — insérez-les avec « Insérer un champ ». ». Il est fermable et n'empêche ni l'édition ni l'enregistrement.
     - Après Ctrl+S et `F5`, les deux pastilles sont toujours là et l'export ne contient aucun `{{personne.nomComplet}}`.
     - Taper `{{personne.nom}}` au clavier le laisse en texte.
7. **Enregistrement et garde** : modifier, puis cliquer sur « Équipe » dans le menu : la fenêtre « Quitter sans enregistrer ? » s'affiche. « Rester sur la page » conserve le texte. Ctrl+S : état « Toutes les modifications sont enregistrées » et toast. `F5` : contenu identique, pastilles comprises. Modifier, puis `F5` : alerte native du navigateur (Playwright : `page.on('dialog')`).
8. **Liste** : Dupliquer l'avenant : l'éditeur de « Copie de « Avenant – taux de rétrocession » » s'ouvre. Retour, Renommer en « Avenant – taux 2027 », Archiver (confirmation), puis Restaurer. Titre vide dans « Nouveau modèle » : message d'erreur.
9. **Mode sombre** : basculer avec le bouton soleil/lune du menu. Éditeur, pastilles (les deux formes), barre, menu déroulant et fenêtres sont lisibles, avec un focus visible. Contraste des pastilles ≥ 4,5:1 (DevTools).
10. **Sauvegarde** : exporter. Le JSON contient `modelesContrats` avec des `ops`, aucune balise HTML (`<p`, `<span` absents) et des clés `saisie.<GUID>`. Modifier le fichier (`"attributes": { "link": "javascript:alert(1)" }`) puis l'importer : refusé, données conservées. Remettre le fichier d'origine : import réussi.
11. **Domaine** (console) : rejouer les vérifications de la Tâche 2 avec une remplaçante de `idelia-sermet.json` (titulaire rattachée) puis une titulaire. Pour la titulaire, `marqueursNonResolus` liste les `titulaire.*`.
12. **Non-régression** : Équipe, Planning, Feuille de route et Paramètres fonctionnent. `npm run build` réussit. Aucun `v-html` ni `localStorage` hors `storageRepository`.

## 12. Décisions à confirmer / risques

1. **Entrée « Documents » ajoutée par 0042, pas ici (retenu).** Une entrée de menu vers une page vide, ou « bientôt disponible », dérouterait le public cible et créerait une route à maintenir sans usage. Le groupe « Contrats » n'a donc qu'une entrée en 0041. 0042 ajoute **« Documents » (`/contrats`, `PhSignature`, décision du porteur) en tête du groupe**, avant « Modèles » (`PhFileText`). Comme 0041 et 0042 s'enchaînent, l'état intermédiaire est court.
2. **Enregistrement explicite plutôt qu'automatique : VALIDÉ par le porteur.** Le bouton « Enregistrer », Ctrl+S et la confirmation avant de quitter sont retenus. Un texte long modifié à chaque frappe déclencherait une réécriture complète du `SaveDocument` (logo 0039 compris) toutes les 400 ms. L'utilisatrice peut aussi « essayer » puis abandonner. L'oubli est couvert par l'état permanent, la confirmation de sortie et `beforeunload`.
3. **`champsLibres` ajouté à la forme validée du modèle.** Le libellé et le type des marqueurs libres doivent vivre quelque part. Les dupliquer dans chaque pastille du Delta obligerait à réécrire le texte à chaque renommage. Le Delta ne porte donc que `{ cle }`, et le modèle déclare ses champs libres. Les clés `saisie.<GUID>` respectent la règle « IDs = GUID partout ». Les clés du catalogue (`personne.prenom`…) sont des **codes stables**, comme les enums, pas des identifiants d'entité.
4. **`documentsContrats` persisté vide dès la v13.** Cela évite à 0042 une migration 13 → 14 si la forme d'un document se contente de champs nouveaux dans cette collection. 0042 définit `REGLES_DOCUMENT_CONTRAT` et les contrôles d'intégrité (`personneId`, `modeleId`). Si 0042 juge préférable sa propre migration, cette réserve reste sans effet.
5. **Un modèle n'est jamais supprimé définitivement, seulement archivé (décision du porteur).** Archiver se rattrape (Restaurer). Aucune action de suppression n'existe, ni en 0041 ni en 0042. Les documents de 0042 référencent leur modèle par `modeleId`, et 0042 contrôle cette référence dans `verifierIntegrite` : un modèle disparu rendrait la sauvegarde **incohérente**, d'où l'archivage seul. Un modèle archivé n'est plus proposé pour créer un document, mais reste résolu pour les documents existants.
6. **`quill/core` ou `quill` complet.** `quill/core` (sans thèmes ni modules UI) suffit et allège le chunk. Il faut alors enregistrer explicitement les formats `bold`, `italic`, `underline`, `header`, `list`, `align` (`Quill.register`). Le développeur T4 choisit la variante la plus simple qui fonctionne et la note dans l'ADR 0023. Repli : `import('quill')` avec `theme` non défini.
7. **Données reprises de 0039 / 0040** (noms réels) :
   - cabinet : `ParametresCabinet.nomCabinet`, `ParametresCabinet.adresseCabinet` (`AdressePostale` `{ ligne1, ligne2, codePostal, ville }`) et `ParametresCabinet.logo` (data URL, utilisé par l'en-tête de 0042, pas par les marqueurs) ;
   - personne : `Personne.adresse` (`AdressePostale`, quatre clés toujours présentes, `''` par défaut) et `Personne.dateNaissance` (`"YYYY-MM-DD"` ou `null`). **Aucun lieu de naissance** (décision du porteur) : ni marqueur `personne.lieuNaissance` / `titulaire.lieuNaissance`, ni mention dans les modèles de départ ;
   - formatage : `adresseSurUneLigne` (et `lignesAdresse` si 0042 veut une adresse sur plusieurs lignes) du module pur générique **`src/domain/adresse.js` créé par 0039**. Ce module porte aussi le typedef `AdressePostale`, `normaliserAdresse` et `LONGUEURS_MAX_ADRESSE` ; `REGLES_ADRESSE` est dans `validationImport.js`. 0040 le réutilise, et 0041 l'importe dans `marqueurs.js` **sans rien recréer**.

   Les plans 0039 et 0040 sont alignés sur ce module (vérifié sur disque). Il ne reste aucune hypothèse.
8. **Texte des modèles de départ** : indicatif, sans valeur juridique, inspiré de la structure du contrat type de l'Ordre national des infirmiers, sans citation d'article. L'avertissement est **dans le texte** pour suivre le document jusqu'à l'impression. **À faire valider par le porteur** (ou une relecture professionnelle) avant diffusion large.
9. **Sécurité (pour l'agent `security`)** :
   - **Dépendance tierce** (A03:2025 Software Supply Chain Failures) : `quill` en version exacte, choisie après au moins 2 semaines de publication, `package-lock.json` versionné, `npm audit` au moment de l'installation. Aucun CDN : le chunk est servi par Pages.
   - **Injection / XSS** (A05:2025 Injection) :
     - aucun HTML stocké ni rendu par `v-html` ;
     - Delta validé **strictement** à l'import (liste blanche d'attributs et d'embeds, rejet de `link` dont `javascript:`, `image`, `video`, `formula`, styles ; plafonds de taille ; propriétés propres seulement) ;
     - liste blanche `formats` dans Quill (défense en profondeur, collage compris) ;
     - **conversion des `{{cle}}` au collage** : elle s'applique au Delta **déjà assaini** par `clipboard.convert`, après le filtrage par la liste blanche `formats`. Elle ne lit jamais de HTML ni de DOM. Elle ne crée que des embeds dont la clé appartient au catalogue figé (jamais de `saisie.*`, jamais de clé arbitraire). La regex est bornée (pas de retour arrière catastrophique : segments `[A-Za-z]+`, 3 au plus) ;
     - libellés des pastilles écrits par `textContent` ;
     - clé de marqueur contrôlée par une regex.
   - **Fuites réseau** : aucune image externe possible, donc aucun pistage au rendu. Pas de lien cliquable.
   - **Données personnelles** : 0041 ne stocke aucune donnée de personne dans les modèles (seulement des clés). Les valeurs n'apparaissent qu'à la génération (0042).
   - **Volume** : plafonds (200 modèles, 20 000 ops, 200 000 caractères par modèle, 50 champs). Le quota `localStorage` (~5 Mo) partagé avec le logo de 0039 est à surveiller. L'erreur d'écriture est déjà signalée par l'indicateur de sauvegarde.
   - **Prototype pollution** : `estDeltaModeleValide` et `normaliserModeleContrat` ne lisent que des propriétés propres et ignorent `__proto__` / `constructor`.
10. **Conversion des `{{cle}}` au collage : VALIDÉE par le porteur.** C'est un raccourci pour reprendre un contrat existant ; l'insertion normale reste le menu. Seules les clés du catalogue sont converties, sans tenir compte de la casse. Les inconnues et les `saisie.*` (GUID) restent du texte, avec un avertissement non bloquant. Rien n'est converti à la frappe. La logique est pure (`src/domain/contrats/collage.js`) et injectée dans l'adaptateur. Limite assumée : un code coupé par une mise en forme n'est pas reconnu.
11. **Robustesse Quill 2** : la sélection et le focus après un clic dans la barre ou le menu (d'où `mousedown.prevent` et la dernière sélection mémorisée) ; le curseur à côté d'un embed en fin de ligne. Si un comportement gêne la recette, l'agent `ui-ux` l'arbitre. Le contournement reste confiné à l'adaptateur.
12. **Statut de l'ADR 0023** : « Accepté » — choix de Quill **confirmé par le porteur** le 2026-10-26 (validé).
