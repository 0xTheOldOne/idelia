# Feature 0040 — Coordonnées des personnes

- **Statut** : Fait
- **Dépend de** : `0004` (équipe : `FormulairePersonne`, `EquipeView`), `0030` (onglets de la fiche via `ListeOnglets`, consultation `ModaleInformationsUtiles`, bouton « Copier » via `src/adaptateurs/pressePapiers.js`), `0039` (page Cabinet : **migration 10 → 11**, `MIGRATIONS[10]`, cette feature part donc de la v11 ; **module pur partagé `src/domain/adresse.js`** : typedef `AdressePostale`, `LONGUEURS_MAX_ADRESSE`, `RE_CODE_POSTAL`, `estCodePostalValide`, `adresseVide`, `normaliserCodePostal`, `normaliserAdresse`, `lignesAdresse`, `adresseSurUneLigne` ; table `REGLES_ADRESSE` de `validationImport.js`. 0040 les **réutilise** sans les recréer). Touche des ajouts de `0027` (prop `champInitial`, lien `?modifier=`) et `0036` (`champInitial: 'remplacement'`), sans en changer le comportement.
- **Prépare** : `0041` (marqueurs `personne.adresse` et `personne.dateNaissance` dans les modèles de contrats) et `0042` (documents contractuels).
- **ADR liés** : [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance via store + plugin), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (export/import, migration de schéma), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (règles en module pur), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (date `"YYYY-MM-DD"`, jamais d'objet `Date` persisté), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0013](../docs/adr/0013-icones-phosphor.md) (icônes), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (styles Bootstrap, pas de JS ajouté).

## 1. Contexte & objectif

Les contrats de remplacement (0041, 0042) citent l'**adresse** et la **date de naissance** de la remplaçante et de la titulaire. Idelia ne les connaît pas encore. Résultat attendu :

1. `Personne` reçoit deux champs **facultatifs** : `adresse` (`{ ligne1, ligne2, codePostal, ville }`) et `dateNaissance`. Migration **v11 → v12**.
2. La fiche personne gagne un **troisième onglet « Adresse et naissance »**, entre « Informations générales » et « Informations professionnelles ». Le formulaire principal ne s'allonge pas.
3. La fenêtre **« Informations utiles »** de la page Équipe affiche ces informations, avec un bouton « Copier » par ligne, comme pour les numéros professionnels.

Aucune saisie obligatoire. Deux contrôles bloquants seulement, et uniquement si le champ est rempli : code postal à 5 chiffres, date de naissance passée et plausible.

**Hors périmètre** :

- **lieu de naissance** (retiré par décision du porteur, §12 n° 3) ;
- marqueurs de contrats et leur mise en forme (0041) ;
- affichage dans la liste Équipe, le planning, l'impression ou l'e-mail (sobriété RGPD, comme en 0030) ;
- adresses hors de France (§12 n° 3) ;
- recherche ou autocomplétion d'adresse en ligne (règle d'or n° 1) ;
- déplacement de l'e-mail et du téléphone (§12 n° 1).

## 2. Écrans concernés

| Route | Écran | Changement `0040` |
|---|---|---|
| `/equipe` (modale « Ajouter / Modifier la personne ») | `FormulairePersonne` | Troisième onglet **« Adresse et naissance »** : adresse (4 champs) et date de naissance. |
| `/equipe` (modale « Informations utiles ») | `ModaleInformationsUtiles` | Deux rubriques titrées : **« Adresse et naissance »** puis **« Informations professionnelles »**, chacune avec son bouton « Modifier » à droite du titre. |

**Expérience visée** (utilisatrice peu à l'aise avec l'informatique) :

- **Fiche** : trois onglets en haut. Le premier, ouvert par défaut, est inchangé. Le deuxième, « Adresse et naissance », commence par une phrase : « Facultatif. Ces informations servent à préparer les contrats de remplacement… ». Puis le groupe titré **Adresse** (« Numéro et rue », « Complément d'adresse », « Code postal » et « Ville » côte à côte) et, en dessous, le champ **« Date de naissance »**. Chaque champ d'adresse porte un exemple (« 12 rue des Lilas », « 75011 », « Paris »).
- **Erreur claire** : un code postal « 7501 » affiche en quittant le champ, en rouge : « Saisissez un code postal de 5 chiffres (ex. 75011), ou laissez le champ vide. » Une date en 2085 affiche : « La date de naissance doit être une date passée. »
- **Pas de piège d'onglet** : si on clique « Enregistrer » depuis un onglet alors qu'une erreur est dans un autre, la fiche **bascule d'elle-même** sur le bon onglet et place le curseur dans le champ à corriger.
- **Consultation** : « Informations utiles — Claire Martin » montre d'abord « Adresse et naissance » (adresse sur 2 ou 3 lignes, puis « 14/03/1985 »), ensuite les numéros professionnels. « Copier » à côté de l'adresse copie « 12 rue des Lilas, Bâtiment B, 75011 Paris » (une seule ligne, prête à coller dans un formulaire). Le crayon à droite du titre ouvre la fiche directement sur le bon onglet.
- **Réversible** : vider un champ et enregistrer l'efface.

## 3. Modèle de données touché

### 3.1 `Personne` — nouveaux champs persistés

| champ | type | oblig. | notes |
|---|---|---|---|
| adresse | `AdressePostale` | oui (bloc toujours présent) | 4 clés, chacune `string`, `''` par défaut [0040] |
| dateNaissance | `"YYYY-MM-DD"` \| null | non | `null` par défaut ; date existante, passée, âge entre 16 et 100 ans **à la saisie** (§7) ; jamais d'objet `Date` (ADR 0010) [0040] |

`AdressePostale` : typedef **définie par 0039** dans `src/domain/adresse.js` (objet imbriqué, pas d'`id`), la même que l'adresse du cabinet. Clés dans l'**ordre d'affichage**, avec les libellés propres à la fiche personne :

| Clé | Libellé (fiche) | Exemple (placeholder) | Longueur max |
|---|---|---|---|
| `ligne1` | Numéro et rue | 12 rue des Lilas | `LONGUEURS_MAX_ADRESSE.ligne1` (0039) |
| `ligne2` | Complément d'adresse | Bâtiment B, appartement 12 | `LONGUEURS_MAX_ADRESSE.ligne2` (0039) |
| `codePostal` | Code postal | 75011 | 5 à la saisie (`maxlength`) ; normalisation selon 0039 |
| `ville` | Ville | Paris | `LONGUEURS_MAX_ADRESSE.ville` (0039) |

Les `maxlength` des champs sont lus dans `LONGUEURS_MAX_ADRESSE`, jamais recopiés en dur.

Choix (KISS, alignés sur 0030) :

- **Bloc imbriqué** `adresse` plutôt que 4 champs à plat : la personne reste lisible, et `personnes/modifier` (fusion en surface) remplace le bloc d'un coup. Le formulaire émet toujours le bloc **complet** normalisé.
- **Clés toujours présentes**, valeur `''` (choix du porteur : « chaînes vides par défaut ») : le code lit `personne.adresse.ville` sans garde. `dateNaissance` vaut `null` quand elle est absente, comme `dateEntree` / `dateSortie`.
- **Normalisation**, appliquée partout (création, formulaire, migration, chargement) :
  - adresse : `normaliserAdresse` et `normaliserCodePostal` de `src/domain/adresse.js` (**0039**, réutilisés tels quels). La forme « 5 chiffres » (`estCodePostalValide`, `RE_CODE_POSTAL`) est contrôlée par Vuelidate à la saisie, **pas** par la normalisation : un fichier ancien ou modifié à la main n'est jamais bloqué ;
  - date de naissance : `normaliserDateNaissance` (`src/domain/coordonnees.js`, §5.1), conservée si `dateUtil.estDateValide`, sinon `null`. La plausibilité (passée, 16-100 ans) n'est contrôlée qu'à la saisie.

### 3.2 Schéma de sauvegarde : v11 → **v12**

`CURRENT_SCHEMA_VERSION` passe de **11 à 12** (`src/storage/migrations.js`), avec `MIGRATIONS[11]`, sur le patron de `MIGRATIONS[9]` (élément non objet laissé tel quel) :

```js
// Chaque personne (objet) reçoit :
//   adresse: normaliserAdresse(personne.adresse)                    // @/domain/adresse (0039) ; absent → 4 '' ; idempotent
//   dateNaissance: normaliserDateNaissance(personne.dateNaissance)  // absent ou invalide → null
// Élément non objet laissé tel quel : verifierStructure le rejettera.
// tournees, absences, plannings, cabinet : inchangés.
```

- **Prérequis** : `0039` livrée (`CURRENT_SCHEMA_VERSION = 11`, `MIGRATIONS[10]`, `src/domain/adresse.js`, `REGLES_ADRESSE`). Si `0039` n'est pas encore fusionnée au démarrage de T1, **s'arrêter et le signaler** : ne pas renuméroter, ne pas recréer le module d'adresse.
- Appliquée au chargement (`bootstrap`) **et** à l'import (`importer`) via `preparerDocument` → `migrate` : rien à changer côté appelants.
- **Fichier v12 modifié à la main** (`adresse` absent ou `null`, `dateNaissance` absente) : `fromSaveDocument` normalise les deux champs de chaque personne, **sans erreur**, comme `identifiants` (0030). Types faux ou longueurs démesurées : refus par `verifierStructure` (§5.4).
- **Export** : `toSaveDocument` sérialise `personnes.items` tels quels → `"schemaVersion": 12`, `"adresse"` et `"dateNaissance"` sur chaque personne, sans code supplémentaire. Un fichier v13 reste refusé (garde existante).

## 4. Store (Vuex)

**Aucun changement.** `personnes/ajouter` passe par `creerPersonne` (qui normalise, §5.2) ; `personnes/modifier` fusionne le patch du formulaire, qui contient toujours `adresse` **complète** et `dateNaissance` déjà normalisées.

- Persisté : `Personne.adresse`, `Personne.dateNaissance`.
- Volatil (local à `EquipeView`) : onglet à ouvrir après la consultation (`champApresInformations`, §6.3).

## 5. Domaine (logique pure)

### 5.1 `src/domain/coordonnees.js` (**créer**)

Module pur, **limité à ce qui est propre aux personnes** : date de naissance, âges, rubriques de la consultation. En-tête « Module pur : aucun import Vue/Vuex (ADR 0008) ». Imports autorisés : `dateUtil` (`@/domain/utils/dates.js`) et `@/domain/adresse.js` (0039), tous deux purs. **Aucune fonction d'adresse n'est redéfinie ici.**

- **Constantes** :
  - `export const AGE_MIN_NAISSANCE = 16;` et `export const AGE_MAX_NAISSANCE = 100;`
  - `export const CHAMPS_ADRESSE_PERSONNE` : `Object.freeze([...])` d'objets gelés `{ cle, libelle, exemple }`, dans l'ordre du tableau §3.1 (libellés et placeholders de la fiche personne). Si `adresse.js` (0039) expose déjà des libellés équivalents, les réutiliser et ne pas créer cette constante.
- `export function normaliserDateNaissance(valeur)` → `string|null`.
- `export function ageEnAnnees(dateNaissance, aujourdhui)` → nombre entier d'années révolues, calculé **par comparaison de chaînes** (année, puis `MM-DD`), sans objet `Date` ; `null` si l'une des deux dates est invalide.
- `export function bornesDateNaissance(aujourdhui)` → `{ min, max }` en `"YYYY-MM-DD"` : `max` = aujourd'hui moins `AGE_MIN_NAISSANCE` ans, `min` = aujourd'hui moins `AGE_MAX_NAISSANCE` ans. Un 29 février sur une année non bissextile devient le 28 février. Sert aux attributs `min` / `max` du champ date (le calendrier du navigateur s'ouvre ainsi sur une année plausible).
- `export function estDateNaissancePassee(valeur, aujourdhui)` → `true` si vide, ou date valide **strictement antérieure** à `aujourdhui`.
- `export function estAgeNaissancePlausible(valeur, aujourdhui)` → `true` si vide, ou `AGE_MIN_NAISSANCE <= ageEnAnnees <= AGE_MAX_NAISSANCE`.
- `export function aDesCoordonnees(personne)` → `true` si au moins un champ de `normaliserAdresse(personne?.adresse)` ou `dateNaissance` est renseigné.
- `export function lignesCoordonnees(personne)` → `Array<{ cle, libelle, lignes: string[], texteCopie: (string|null), libelleCopie, confirmation }>` des 2 rubriques, dans cet ordre, à partir des valeurs normalisées :

  | `cle` | `libelle` | `lignes` | `texteCopie` | `libelleCopie` (nom accessible du bouton) | `confirmation` |
  |---|---|---|---|---|---|
  | `adresse` | Adresse | `lignesAdresse` (0039) | `adresseSurUneLigne` (0039) | l'adresse | Adresse copiée. |
  | `dateNaissance` | Date de naissance | `[dateUtil.formatDateFr(d)]` | idem (« 14/03/1985 ») | la date de naissance | Date de naissance copiée. |

  `lignes = []` et `texteCopie = null` quand la rubrique est vide. Les confirmations sont accordées en genre (le code actuel de la modale, `libelle.split(' (')[0] + ' copié.'`, donnerait « Adresse copié. »).

### 5.2 `src/domain/personnes.js` (**modifier**)

- Imports : `normaliserAdresse` et le typedef `AdressePostale` (JSDoc `import('@/domain/adresse.js').AdressePostale`) depuis `@/domain/adresse.js` (0039) ; `normaliserDateNaissance` depuis `@/domain/coordonnees.js`.
- Typedef `Personne` (l. 32-54) : `@property {AdressePostale} adresse` et `@property {(string|null)} dateNaissance` (`"YYYY-MM-DD"`), mention `(0040)`, placés après `contact`.
- `creerPersonne` (l. 68-97) : `adresse: normaliserAdresse(champs.adresse)`, `dateNaissance: normaliserDateNaissance(champs.dateNaissance)`.

### 5.3 `src/domain/schema.js` (**modifier**)

`fromSaveDocument` (l. 230) : la normalisation par personne devient une petite fonction locale `normaliserPersonneChargee(p)` qui renvoie `{ ...p, identifiants: …, adresse: normaliserAdresse(p?.adresse), dateNaissance: normaliserDateNaissance(p?.dateNaissance) }` (`normaliserAdresse` importée de `@/domain/adresse.js`, déjà utilisée par 0039 pour `cabinet.adresse`). Commentaire : forme garantie, jamais bloquant (0030, 0040).

### 5.4 `src/domain/validationImport.js` (**modifier**)

- `REGLES_PERSONNE` : ajouter
  - `adresse: { type: 'objet' }` ;
  - `dateNaissance: { type: 'date' }` (comme `dateEntree` : une chaîne qui n'est pas une date existante est refusée ; `null` accepté).
- **`REGLES_ADRESSE` : réutilisée telle quelle** (créée par 0039 pour `cabinet.adresse`). Ne pas la dupliquer ni changer ses plafonds.
- **Contrôle d'un objet imbriqué dans une collection** : si 0039 a déjà ajouté un mécanisme générique, le réutiliser. Sinon, `controlerCollection` accepte une option `objets` (`{ champ, regles, libelle }[]`). Pour chaque élément, si `item[champ]` est un objet, `controlerChamps(item[champ], regles, \`${contexte}, ${libelle}\`, erreurs)`. Entrée `personnes` de `COLLECTIONS` : `objets: [{ champ: 'adresse', regles: REGLES_ADRESSE, libelle: 'adresse' }]`, transmis par `verifierStructure`.
- Les plafonds d'import de `REGLES_ADRESSE` refusent un fichier forgé ; la normalisation de 0039 coupe ensuite aux longueurs de `LONGUEURS_MAX_ADRESSE`.

### 5.5 Réutilisé (non modifié)

**`src/domain/adresse.js` (0039)** : `AdressePostale`, `LONGUEURS_MAX_ADRESSE`, `RE_CODE_POSTAL`, `estCodePostalValide`, `adresseVide`, `normaliserCodePostal`, `normaliserAdresse`, `lignesAdresse`, `adresseSurUneLigne` ; `REGLES_ADRESSE` (`validationImport.js`, 0039) ; `dateUtil.estDateValide`, `dateUtil.formatDateFr`, `dateUtil.format` ; `copierTexte` (`src/adaptateurs/pressePapiers.js`) ; `ModaleBase` ; `ListeOnglets` (gère déjà N onglets, flèches avec bouclage, Origine / Fin).

## 6. Composants

### 6.1 `src/components/equipe/FormulairePersonne.vue` (**modifier**)

- **Onglets** : `ONGLETS_FICHE` reçoit `{ code: 'coordonnees', libelle: 'Adresse et naissance' }` **entre** `general` et `pro`.
- **Prop `champInitial`** : nouvelle valeur `'coordonnees'`. Une méthode `ongletInitial()` remplace les deux ternaires (`data` l. 555 et `reinitialiser` l. 758) : `'identifiants'` → `'pro'`, `'coordonnees'` → `'coordonnees'`, sinon `'general'`. `onAffichee()` : pour `'coordonnees'`, focus sur `#personne-adresse-ligne1`. JSDoc de la prop complétée.
- **Panneau `coordonnees`** (`v-show`, `id="personne-panneau-coordonnees"`, `role="tabpanel"`, `aria-labelledby="personne-onglet-coordonnees"`, `tabindex="0"`), même structure que le panneau `pro` :
  - Introduction (`form-text mb-3`) : « Facultatif. Ces informations servent à préparer les contrats de remplacement. Elles restent enregistrées sur cet ordinateur et sont incluses dans les sauvegardes. Vous pourrez les retrouver et les copier depuis la page Équipe (bouton « Informations utiles »). »
  - `<fieldset class="mb-4">` + `<legend class="form-label fw-bold fs-6">Adresse</legend>` :
    - « Numéro et rue » (`#personne-adresse-ligne1`) puis « Complément d'adresse » (`#personne-adresse-ligne2`), pleine largeur ;
    - ligne `row g-3` : « Code postal » (`col-sm-4`, `#personne-adresse-code-postal`, `inputmode="numeric"`, `maxlength="5"`) et « Ville » (`col-sm-8`, `#personne-adresse-ville`) ;
    - `maxlength` de `ligne1`, `ligne2`, `ville` lus dans `LONGUEURS_MAX_ADRESSE` (0039) ; libellés et placeholders lus dans `CHAMPS_ADRESSE_PERSONNE` (§5.1) ;
    - tous les champs : `type="text"`, `autocomplete="off"` (ce n'est pas l'adresse de l'utilisatrice : on évite que le navigateur propose ou mémorise des adresses), `class="form-control"`.
  - Sous le groupe Adresse, le champ **« Date de naissance »** seul (`div.mb-2`, pas de `fieldset` pour un champ unique) : `#personne-date-naissance`, `type="date"`, `:min` / `:max` = `bornesDateNaissance(aujourdhui)`, `autocomplete="off"`, classe `formulaire-date-naissance`. Aide (`#personne-date-naissance-aide`) : « Vous pouvez taper la date au clavier : le jour, le mois, puis l'année. »
  - Erreurs Vuelidate (code postal, date) : même rendu que l'existant (`is-invalid`, `<p class="formulaire-erreur">` + `PhWarning`, `aria-describedby` via `describedBy`).
- **Normalisation à la sortie du champ** : au `blur` du code postal, la valeur affichée devient `normaliserCodePostal(valeur)` (« 75 011 » → « 75011 »), puis `$touch()`.
- **`aujourdhui`** : `computed` = `dateUtil.format(new Date())`, comme `FormulaireGeneration.vue` l. 175. Injecté dans les fonctions du domaine.
- **Brouillon** (`construireFormulaire`) :
  - édition : `adresse: { ...normaliserAdresse(this.personne.adresse) }`, `dateNaissance: this.personne.dateNaissance ?? ''` ;
  - création : `adresse: adresseVide()`, `dateNaissance: ''`.
- **Émission** (`soumettre`) : `adresse: normaliserAdresse(this.formulaire.adresse)`, `dateNaissance: normaliserDateNaissance(this.formulaire.dateNaissance || null)`.
- **Erreur dans un onglet masqué** : chaque entrée de `champsEnOrdre()` reçoit `onglet` (`'general'` pour les 11 actuelles ; `'coordonnees'` pour `adresse.codePostal` → `personne-adresse-code-postal` et `dateNaissance` → `personne-date-naissance`, ajoutées en fin de liste). `focusPremierChampErrone()` :
  1. prend le premier champ en erreur **de l'onglet affiché** ;
  2. sinon, le premier champ en erreur dans l'ordre des onglets (`general`, puis `coordonnees`) ;
  3. bascule `ongletActif` si besoin, puis pose le focus au `$nextTick` (le commentaire « Tous les champs validés sont dans l'onglet général » est mis à jour).
- Imports : `dateUtil` ; depuis `@/domain/adresse.js` (0039) : `LONGUEURS_MAX_ADRESSE`, `adresseVide`, `normaliserAdresse`, `normaliserCodePostal`, `estCodePostalValide` ; depuis `@/domain/coordonnees.js` : `CHAMPS_ADRESSE_PERSONNE`, `normaliserDateNaissance`, `estDateNaissancePassee`, `estAgeNaissancePlausible`, `bornesDateNaissance`.
- **Style** : `.formulaire-code-postal { max-width: 8rem; }` sur grand écran, `.formulaire-date-naissance { max-width: 14rem; }`. Tokens uniquement, aucune couleur en dur.

### 6.2 `src/components/equipe/ModaleInformationsUtiles.vue` (**modifier**)

- **Deux rubriques**, chacune en `<section>` avec un en-tête flex (`justify-content: space-between`, passe dessous si la place manque) : titre `<h3 class="infos-rubrique-titre">` à gauche, bouton « Modifier » à droite.
  1. **« Adresse et naissance »** : `<dl>` des 2 lignes de `lignesCoordonnees(personne)` (Adresse, Date de naissance) si `aDesCoordonnees`. `<dd>` : les `lignes` en `<span class="d-block">` dans un conteneur `user-select-all` (police normale, pas de chasse fixe) + bouton icône seule `PhCopy` (`title="Copier"`, `aria-label="Copier " + libelleCopie`), ou « Non renseigné » en texte atténué. Sinon : « Aucune adresse ni date de naissance n'a encore été saisie pour Prénom. »
  2. **« Informations professionnelles »** : contenu actuel (6 numéros, phrase « Aucune information professionnelle… »), inchangé.
- **Bouton « Modifier » de rubrique** (si `modifiable`) : `btn btn-outline-primary`, **icône seule** `PhPencilSimple` (préférence du porteur : bouton à droite du titre, icône seule + infobulle), `title` « Modifier l'adresse et la naissance » / « Modifier les informations professionnelles », `aria-label` identique, libellé court « Modifier » écrit à côté sous `md` (`<span class="d-md-none">`), 44 px mini. Émet `modifier` avec `'coordonnees'` ou `'identifiants'`.
- **Pied** : seul le bouton « Fermer » reste. Le bouton « Modifier ces informations / Compléter la fiche » de 0030 est **remplacé** par les deux boutons de rubrique (§12 n° 4).
- **Copie** : `copier(ligne)` lit `ligne.texteCopie ?? ligne.valeur` et affiche `ligne.confirmation` si elle existe, sinon le message actuel des numéros. Message d'échec : « …Cliquez sur le texte pour le sélectionner, puis copiez-le avec Ctrl+C. » (« texte » au lieu de « numéro », valable pour les deux rubriques).
- **Personne archivée** : rubriques visibles et copiables, aucun bouton « Modifier », phrase « Pour modifier ces informations, restaurez d'abord la personne. » conservée (une seule fois, en bas).
- Focus initial inchangé (« Fermer »). Interpolation seule, **aucun `v-html`**.
- JSDoc d'en-tête : rubriques, payload de `modifier`.

### 6.3 `src/views/EquipeView.vue` (**modifier**)

- `data` : `ficheApresInformations` (booléen) devient `champApresInformations` (`null` | `'coordonnees'` | `'identifiants'`).
- `onModifierDepuisInformations(champ)` : `champApresInformations = champ`, puis `informationsVisible = false`.
- `onFermetureInformations()` : si `champApresInformations`, `ouvrirEdition(personneInformations, champApresInformations)` puis remise à `null`.
- JSDoc d'en-tête (l. 247-250) complétée. Lien `?modifier=` (0027) et `champ=remplacement` (0036) **inchangés**.

## 7. Règles de validation

**Bloquantes (Vuelidate)**, déclarées dans `validations()` de `FormulairePersonne`, uniquement si le champ est rempli :

| Champ | Règle (domaine) | Message |
|---|---|---|
| `adresse.codePostal` | `estCodePostalValide` (`@/domain/adresse.js`, 0039) | « Saisissez un code postal de 5 chiffres (ex. 75011), ou laissez le champ vide. » |
| `dateNaissance` | `estDateNaissancePassee(v, aujourdhui)` | « La date de naissance doit être une date passée. » |
| `dateNaissance` | `estAgeNaissancePlausible(v, aujourdhui)` | « Vérifiez l'année de naissance : la personne aurait moins de 16 ans ou plus de 100 ans. » |

- Ordre des règles `dateNaissance` : `passee` puis `plausible` (`$errors[0]` affiche le plus parlant).
- Affichage au `blur` ou à la tentative d'enregistrement, jamais sur une fiche vierge.
- **Aucun contrôle** sur `ligne1`, `ligne2`, `ville` : `maxlength` borne la saisie. Pas d'avertissement non bloquant non plus (KISS).
- Une date tapée incomplète laisse le champ `type="date"` vide (comportement du navigateur, identique à « Date d'arrivée ») : pas d'erreur, rien n'est enregistré.

## 8. Points d'attention ergonomie

- **Le formulaire d'aujourd'hui ne change pas** : l'onglet général reste ouvert par défaut, avec les mêmes champs.
- **Libellés concrets** : « Numéro et rue », « Complément d'adresse », « Code postal », « Ville » ; jamais « ligne 1 ». Un exemple réaliste dans chaque champ d'adresse.
- **Onglet au nom explicite** : « Adresse et naissance » dit ce qu'il contient. Sur écran étroit, les trois onglets passent à la ligne (comportement `nav-tabs`) : à vérifier en recette (≤ 576 px).
- **Date de naissance** : saisie au clavier possible (aide explicite), calendrier borné sur des années plausibles. Erreurs formulées comme une correction (« Vérifiez l'année »), pas comme un refus.
- **Pas de piège d'onglet** : priorité à l'onglet affiché, sinon bascule automatique avec focus dans le champ en erreur ; le message « Certains champs sont à corriger. » reste visible sous tous les onglets.
- **Copie utile** : l'adresse se copie sur une ligne, la date au format « JJ/MM/AAAA » ; confirmation accordée (« Adresse copiée. ») ; consigne de repli si la copie échoue.
- **Modifier au bon endroit** : chaque rubrique de la consultation a son crayon, qui ouvre la fiche sur l'onglet correspondant, curseur dans le premier champ.
- **Sobriété** : rien de plus dans la liste Équipe ; ces informations ne s'affichent que sur demande.
- **Clavier et lecteur d'écran** : `fieldset` / `legend` pour « Adresse », aides et erreurs reliées par `aria-describedby`, focus visible, flèches dans la barre d'onglets (3 onglets, bouclage).

## 9. Étapes d'implémentation

**3 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre : **T1 → (T2 ∥ T3)**.

- T2 et T3 touchent des fichiers disjoints. Contrats partagés, fixés ici : la valeur `'coordonnees'` de `champInitial`, et le payload `'coordonnees' | 'identifiants'` de l'événement `modifier`.
- Contexte à transmettre à chaque sous-agent : ce plan, règles d'or n° 2, 3, 5, 7, 8, 10, ADR 0010 et 0011, `features/0030-personne-informations-professionnelles.md` (§6.2 à 6.4, patron des onglets et de la consultation), `features/0039-page-cabinet-et-menu.md` (module `src/domain/adresse.js` et `REGLES_ADRESSE`, à réutiliser).
- **Un seul commit pour la feature** (migration et écrans livrés ensemble).

### Tâche 1 — Modèle, normalisation, migration v12, validation d'import

**Prérequis** : 0039 livrée, c'est-à-dire `CURRENT_SCHEMA_VERSION` vaut **11** dans `src/storage/migrations.js`, `src/domain/adresse.js` existe avec les exports listés en tête de plan, et `REGLES_ADRESSE` existe dans `validationImport.js`. Sinon, s'arrêter et le signaler.

**Fichiers** :

- `src/domain/adresse.js` : **non modifié** (réutilisé, 0039).
- `src/domain/coordonnees.js` (**créer**) : §5.1, JSDoc complète, aucune fonction d'adresse.
- `src/domain/personnes.js` (**modifier**) : §5.2.
- `src/domain/schema.js` (**modifier**) : §5.3.
- `src/storage/migrations.js` (**modifier**) : `CURRENT_SCHEMA_VERSION = 12`, `MIGRATIONS[11]` documentée en JSDoc sur le modèle de `MIGRATIONS[9]` (§3.2).
- `src/domain/validationImport.js` (**modifier**) : §5.4 (`REGLES_PERSONNE` et rattachement de `REGLES_ADRESSE` existante à `personnes`).
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) : lignes `adresse` et `dateNaissance` dans le tableau `Personne` (après `contact`) ; la ligne `adresse` renvoie à la sous-section « AdressePostale » rédigée par 0039 (y ajouter seulement « utilisée aussi par `Personne.adresse` [0040] »).
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) : commentaire `schemaVersion` (« v12 = Personne.adresse + dateNaissance »), valeur de l'exemple `12`, champs dans la personne d'exemple (`"adresse": { "ligne1": "", "ligne2": "", "codePostal": "", "ville": "" }, "dateNaissance": null`), paragraphe **`MIGRATIONS[11]` (v11 → v12)** — feature 0040.
- `docs/architecture/06-structure-du-code.md` (**modifier**) : `coordonnees.js  # date de naissance et rubriques « Adresse et naissance » d'une personne (adresse : voir adresse.js) [0040]` sous `domain/`.

**Critères de sortie** (script jetable, §11 étape 1) :

- **Pas de doublon** : `coordonnees.js` ne déclare aucun des exports de `adresse.js` ; une recherche `function (normaliserAdresse|normaliserCodePostal|estCodePostalValide|adresseVide|lignesAdresse|adresseSurUneLigne)` dans `src/` ne trouve que `adresse.js`. Les tests unitaires de l'adresse restent ceux de 0039.
- `CHAMPS_ADRESSE_PERSONNE` : 4 clés, mêmes clés que `adresseVide()`, ordre §3.1.
- `normaliserDateNaissance` : `'1985-03-14'` → inchangé ; `'1985-02-30'`, `'14/03/1985'`, `''`, `12`, `undefined` → `null`.
- Avec `aujourdhui = '2026-10-26'` : `ageEnAnnees('1985-10-27', …)` → 40, `('1985-10-26', …)` → 41 ; `estDateNaissancePassee('2026-10-26', …)` → `false`, `('2026-10-25', …)` → `true`, `('', …)` → `true` ; `estAgeNaissancePlausible('2012-01-01', …)` → `false` (14 ans), `('1920-01-01', …)` → `false` (106 ans), `('1985-03-14', …)` → `true`. `bornesDateNaissance('2000-02-29')` → `{ min: '1900-02-28', max: '1984-02-29' }` (1900 n'est pas bissextile) ; `bornesDateNaissance('2026-10-26')` → `{ min: '1926-10-26', max: '2010-10-26' }`.
- `lignesCoordonnees` d'une personne avec `adresse: { ligne1: '12 rue des Lilas', ligne2: '', codePostal: '75011', ville: 'Paris' }` et `dateNaissance: '1985-03-14'` : 2 entrées dans l'ordre du §5.1 ; adresse `lignes` = `['12 rue des Lilas', '75011 Paris']`, `texteCopie` = `'12 rue des Lilas, 75011 Paris'` (résultats de `lignesAdresse` / `adresseSurUneLigne` de 0039) ; date `14/03/1985`. Personne sans ces champs : `lignes = []`, `texteCopie` `null`, `aDesCoordonnees` → `false`.
- `creerPersonne({ prenom: 'A', nom: 'B' })` → `adresse` à 4 `''`, `dateNaissance: null`, et **aucune** clé `lieuNaissance`.
- `migrate` d'un document v11 fabriqué (ids GUID via `crypto.randomUUID()`) avec 3 personnes (sans les champs ; `adresse: { ville: ' Lyon ' }` ; `adresse: 'texte', dateNaissance: '2026-02-30'`) → `schemaVersion: 12`, blocs attendus, tous les autres champs strictement identiques ; `preparerDocument` → `ok: true` ; re-`migrate` → identique (idempotence).
- `preparerDocument` d'un v12 forgé : `adresse: { ligne1: <chaîne au-delà du plafond de REGLES_ADRESSE> }` → refusé (« Personne n°1, adresse : le champ « ligne1 » est invalide. ») ; `adresse: { ville: 12 }` → refusé ; `dateNaissance: '1985-02-30'` → refusé ; `adresse: null` → accepté, puis `fromSaveDocument` → 4 `''`.
- `coordonnees.js` n'importe que `@/domain/utils/dates.js` et `@/domain/adresse.js` ; `adresse.js` inchangé (`git diff` vide sur ce fichier) ; `npm run build` réussit.

### Tâche 2 — Onglet « Adresse et naissance » de la fiche

**Fichiers** :

- `src/components/equipe/FormulairePersonne.vue` (**modifier**) : §6.1.

**Dépend de** : T1. **Parallélisable** avec T3.

**Critères de sortie** :

- Parcours §10 « Fiche » vert.
- Création sans ouvrir le nouvel onglet → `localStorage['idelia:data']` contient pour la personne `"adresse"` à 4 `""` et `"dateNaissance": null`.
- Prénom vide + code postal « 7501 », « Enregistrer » depuis l'onglet « Adresse et naissance » → reste sur cet onglet, curseur dans « Code postal ». Corriger le code postal, réenregistrer → bascule sur « Informations générales », curseur dans « Prénom ».
- `champInitial` `'identifiants'`, `'email'` (0027) et `'remplacement'` (0036) : comportement inchangé.
- Aucune couleur en dur, aucun `v-html` ; `npm run build` réussit.

### Tâche 3 — Consultation « Informations utiles » et enchaînement vers la fiche

**Fichiers** :

- `src/components/equipe/ModaleInformationsUtiles.vue` (**modifier**) : §6.2.
- `src/views/EquipeView.vue` (**modifier**) : §6.3.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) : ligne `/equipe`, mentionner « adresse et date de naissance (onglet de la fiche, consultation « Informations utiles ») » et ajouter `0040` aux features.

**Dépend de** : T1. **Parallélisable** avec T2. Si T2 n'est pas encore livrée, le crayon « Adresse et naissance » ouvre la fiche sur l'onglet général : à revérifier après T2.

**Critères de sortie** :

- Parcours §10 « Consultation » vert.
- Confirmations de copie accordées (« Adresse copiée. », « Date de naissance copiée. », « Numéro RPPS copié. »).
- Personne archivée : aucun bouton « Modifier », copie possible.
- `PhPencilSimple` et `PhCopy` importés depuis `@phosphor-icons/vue` ; aucun `v-html` ; `npm run build` réussit.

## 10. Critères d'acceptation

**Fiche**

- [ ] « Ajouter une personne » et « Modifier » ouvrent la fiche sur « Informations générales », inchangé.
- [ ] La fiche a trois onglets dans cet ordre : « Informations générales », « Adresse et naissance », « Informations professionnelles ». Les flèches du clavier passent de l'un à l'autre, avec bouclage.
- [ ] « Adresse et naissance » montre la phrase d'introduction, le groupe « Adresse » (4 champs avec exemple) et le champ « Date de naissance ». Aucun champ « Lieu de naissance ».
- [ ] Code postal « 75 011 » → affiché « 75011 » en quittant le champ, sans erreur. « 7501 » → message rouge « Saisissez un code postal de 5 chiffres… » et « Enregistrer » refuse.
- [ ] Date de naissance future → « La date de naissance doit être une date passée. » ; date donnant 10 ans ou 110 ans → « Vérifiez l'année de naissance… » ; « Enregistrer » refuse.
- [ ] Le calendrier du champ date s'ouvre sur des années plausibles (16 à 100 ans).
- [ ] Une erreur dans un autre onglet que celui affiché ramène sur cet onglet, curseur dans le champ ; la saisie des trois onglets est conservée.
- [ ] Tous les champs vides → la fiche s'enregistre sans message.
- [ ] Vider l'adresse et enregistrer → « Informations utiles » affiche « Non renseigné » pour l'adresse.

**Consultation**

- [ ] « Informations utiles » affiche la rubrique « Adresse et naissance » (Adresse, Date de naissance) au-dessus de « Informations professionnelles ».
- [ ] L'adresse s'affiche sur plusieurs lignes (« 12 rue des Lilas » / « Bâtiment B » / « 75011 Paris »), la date en « 14/03/1985 ».
- [ ] « Copier » de l'adresse met « 12 rue des Lilas, Bâtiment B, 75011 Paris » dans le presse-papiers et affiche « Adresse copiée. » ; « Copier » de la date met « 14/03/1985 » et affiche « Date de naissance copiée. ».
- [ ] Personne sans aucune de ces informations → « Aucune adresse ni date de naissance n'a encore été saisie pour Prénom. »
- [ ] Le crayon de « Adresse et naissance » ferme la consultation et ouvre la fiche sur cet onglet, curseur dans « Numéro et rue » ; celui de « Informations professionnelles » ouvre l'onglet professionnel, curseur dans « Numéro RPPS ». À la fermeture de la fiche, le focus revient sur le bouton « Informations utiles » de la ligne.
- [ ] Personne archivée : informations visibles et copiables, aucun crayon, phrase « restaurez d'abord la personne ».

**Sauvegarde**

- [ ] Des données existantes (v11) se rechargent sans erreur ; après une modification, `localStorage` contient `"schemaVersion": 12`, `"adresse"` et `"dateNaissance"` sur chaque personne.
- [ ] Export → `"schemaVersion": 12` ; ré-import du fichier exporté → identique ; import d'une sauvegarde plus ancienne (v10, v11) → champs vides.
- [ ] Un fichier v12 modifié à la main avec `"adresse": null` s'importe sans erreur ; avec `"adresse": { "ville": 12 }` ou une date de naissance inexistante, il est refusé avec un message lisible.
- [ ] Non-régression sur `files/idelia-sermet.json` : migration vers v12 sans aucune perte (§11 étape 2).
- [ ] Aucune information d'adresse ou de naissance n'apparaît dans la liste Équipe, le planning, l'impression, l'e-mail ou la feuille de route.
- [ ] `npm run build` réussit, aucune dépendance ajoutée.

## 11. Vérification

1. **Script jetable domaine + migration (T1)** : dans le scratchpad de session (**jamais dans le dépôt**), un `.mjs` qui démarre Vite en mode middleware (`createServer({ root: <dépôt>, server: { middlewareMode: true }, appType: 'custom' })`) et charge par `ssrLoadModule` `/src/domain/coordonnees.js`, `/src/domain/adresse.js` (lecture seule), `/src/domain/personnes.js`, `/src/domain/schema.js`, `/src/storage/migrations.js`. Il exécute les contrôles de T1, ferme le serveur, puis est supprimé. Adresses et dates de test **fictives** (celles du §9).
2. **Non-régression sur les données réelles** : même script, chemin de `files/idelia-sermet.json` **passé en argument**. `preparerDocument`, puis n'afficher **que des compteurs et des booléens** (jamais de nom, de date ni d'adresse) :
   - version d'origine → 12 ;
   - mêmes nombres de personnes, préférences, tournées, absences, plannings, affectations ;
   - chaque personne identique à l'originale, hormis les deux nouveaux champs (vides) ;
   - tournées, absences, plannings, cabinet strictement identiques ;
   - `ok === true` ; idempotence.

   Ne rien copier du fichier dans le dépôt, un commit ou un rapport.
3. `npm run build`.
4. **Recette navigateur** (Playwright MCP ; `npx vite --port 5199 --strictPort` ; `http://localhost:5199/idelia/#/equipe` ; données importées depuis `idelia-sermet.json` par Paramètres → Restaurer) :
   1. Ouvrir une personne, onglet « Adresse et naissance » : saisir une adresse **fictive** (« 12 rue des Lilas », « Bâtiment B », « 75 011 », « Paris ») et la date « 14/03/1985 ». Enregistrer. Après ~1,5 s, `localStorage['idelia:data']` contient `"codePostal":"75011"` et `"dateNaissance":"1985-03-14"`, et aucune clé `lieuNaissance`.
   2. Erreurs : code postal « 7501 », date en 2030, date en 1900, puis le cas « prénom vide + erreur dans l'autre onglet » (T2).
   3. Consultation : rubriques, copie de l'adresse et de la date (lire le presse-papiers via `navigator.clipboard.readText()` avec la permission accordée), crayons vers chaque onglet, retour du focus, personne archivée.
   4. Non-régression 0027 : Diffusion → envoi par e-mail → « Compléter la fiche » ouvre l'onglet général, curseur dans l'e-mail. Non-régression 0036 : lien du bilan vers « Remplace en priorité ».
   5. Fenêtre à 375 px de large : les trois onglets restent lisibles (retour à la ligne), code postal et ville empilés, libellé « Modifier » écrit à côté des crayons.
   6. En mode sombre (0038) : nouvel onglet et rubriques lisibles.
   7. Export puis import → identique ; import d'un fichier v12 modifié (copie dans le scratchpad) : `"adresse": null` accepté, `"adresse": { "ville": 12 }` refusé avec message.
   8. Captures éventuelles dans `.playwright-mcp/` (gitignoré), jamais dans le scratchpad ni le dépôt.
5. **Clavier seul et lecteur d'écran** : « Adresse et naissance, onglet, 2 sur 3 » ; groupe « Adresse » annoncé ; aide et erreurs reliées aux champs ; crayons annoncés « Modifier l'adresse et la naissance ».
6. Relecture `ui-ux` (nom de l'onglet, crayons icône seule dans la consultation, messages de date), puis audit `security` (§12 n° 8).

## 12. Décisions à confirmer / risques

1. **Troisième onglet « Adresse et naissance » (validé par le porteur)** plutôt qu'une section repliable dans l'onglet général (déjà long, et un repli de plus serait un second mécanisme de rangement à côté des onglets) ou que l'onglet professionnel (ce ne sont pas des données professionnelles). L'e-mail et le téléphone **restent** dans l'onglet général : les déplacer casserait le lien « Compléter la fiche » de 0027 et changerait un formulaire que l'équipe connaît. D'où le libellé « Adresse et naissance », et non « Coordonnées », qui laisserait chercher l'e-mail dans cet onglet.
2. **Valeurs par défaut** : chaînes vides pour l'adresse (décision du porteur), `null` pour la date (comme `dateEntree`). Différent de `identifiants` (0030), qui utilise `null` : assumé, chaque bloc reste cohérent en lui-même.
3. **Adresse en France : code postal à 5 chiffres, bloquant (validé par le porteur).** Les DOM (97xxx) et la Corse (20xxx) sont acceptés. Le **lieu de naissance est supprimé** du périmètre (décision du porteur) : ni champ, ni migration, ni règle d'import, ni marqueur en 0041.
4. **Consultation : un crayon par rubrique (retenu)**, à droite du titre, en icône seule + infobulle (préférence du porteur), libellé écrit sur mobile. Le bouton de pied « Modifier ces informations / Compléter la fiche » de 0030 disparaît : avec deux rubriques, un bouton unique ne saurait pas quel onglet ouvrir. Risque : découvrabilité de l'icône seule → relecture `ui-ux` ; repli : garder le texte « Modifier » à partir de `md`.
5. **Bornes de plausibilité de 16 à 100 ans, bloquantes (validé par le porteur)** : une année mal tapée (2085 au lieu de 1985) ne doit pas finir dans un contrat. Modifiables par constantes (`AGE_MIN_NAISSANCE`, `AGE_MAX_NAISSANCE`) sans migration.
6. **Format des marqueurs de contrats** : `adresseSurUneLigne` et `formatDateFr` sont fournis, mais le rendu final dans un contrat (« né(e) le 14 mars 1985 », adresse sur une ou plusieurs lignes) est décidé par **0041**.
7. **Dépendance envers 0039** : 0040 suppose 0039 livrée (schéma v11, module `src/domain/adresse.js`, `REGLES_ADRESSE`). Si l'ordre change, renuméroter **les deux** plans avant d'implémenter, jamais en cours de route.
   - **Module d'adresse partagé** : l'adresse du cabinet et celle des personnes ont la même forme, les mêmes règles et le même rendu (utile aux marqueurs de 0041). Toute évolution passe par `adresse.js` et vaut pour les deux.
   - Si un besoin propre aux personnes apparaissait dans l'adresse, il irait dans `coordonnees.js`, sans dupliquer `adresse.js`.
8. **Sécurité et RGPD (pour l'agent `security`)** :
   - **Nature des données** : l'adresse et la date de naissance sont des données personnelles **identifiantes** (non sensibles au sens de l'article 9 RGPD). Combinées, elles facilitent l'usurpation d'identité : elles ne doivent sortir que par une action volontaire.
   - **Aucune nouvelle exposition** : aucune requête réseau ; stockage uniquement via le store, le plugin de persistance et `storageRepository` (`localStorage`) ; sortie uniquement par le fichier de sauvegarde (export JSON) et la copie volontaire au presse-papiers. Rien dans le planning, l'impression, l'e-mail, la feuille de route ni la liste Équipe. Jamais journalisées (`console`).
   - **Rendu** : interpolation Vue uniquement, aucun `v-html` (les adresses seront réinjectées dans des contrats en 0041 : la règle « jamais de HTML brut » y sera reprise).
   - **Entrées importées** : types contrôlés et longueurs plafonnées par `verifierStructure` (`REGLES_ADRESSE` de 0039, date existante), puis normalisées par `normaliserAdresse` (0039) et `normaliserDateNaissance` avant d'atteindre le store.
   - **Navigateur** : `autocomplete="off"` sur ces champs, pour que l'adresse d'une collègue ne soit ni proposée ni mémorisée par le remplissage automatique d'un poste partagé.
   - **Minimisation et effacement** : tous les champs sont facultatifs, avec une finalité dite à l'écran (contrats) ; le lieu de naissance, non indispensable, n'est pas collecté. Vider un champ l'efface. **Limite** : une personne archivée garde ses coordonnées et n'est plus modifiable. Pour les effacer, il faut la restaurer, vider les champs, puis l'archiver de nouveau. À signaler au porteur (responsable du traitement) ; pas de bouton dédié en v1 (KISS).
   - **Fichier de sauvegarde** : il contient désormais des adresses et des dates de naissance. Le rappel de prudence existant sur la conservation des sauvegardes reste suffisant ; aucun ADR à ajouter.
9. **Aucun écart d'ADR** : aucune dépendance ajoutée ; onglets via `ListeOnglets` existant ; icônes Phosphor ; date en chaîne `"YYYY-MM-DD"` (ADR 0010) ; persistance par migration (ADR 0005, 0006) ; logique dans un module pur (ADR 0008) ; Vuelidate pour le bloquant (ADR 0011) ; tokens SCSS (ADR 0012, 0015, 0022).
