# Feature 0030 — Personne : informations professionnelles

- **Statut** : À faire
- **Dépend de** : `0004` (équipe : `FormulairePersonne`, `EquipeView`, livré). Touche des ajouts livrés par `0020` (rythme, remplaçante), `0027` (prop `champInitial`, liens `?modifier=` / `?retour=`, `src/adaptateurs/pressePapiers.js`) et `0034` (initiales Vega), sans en changer le comportement.
- **ADR liés** : [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (nouveau bloc persisté via store + plugin), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (export/import, migration de schéma), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (règles en module pur), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate pour le bloquant uniquement), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (styles `nav-tabs` déjà importés, pas de JS Bootstrap ajouté).

## 1. Contexte & objectif

Le cabinet veut retrouver facilement les **identifiants professionnels** de chaque personne (n° RPPS, ADELI, ordinal, SIRET, CPS, carte professionnelle) : utiles pour les contrats de remplacement, les rétrocessions et les démarches (Ordre, URSSAF, Assurance maladie).

`0030` :
1. ajoute un bloc **facultatif** `Personne.identifiants` (6 champs texte, `null` par défaut), migration **v7 → v8** ;
2. range ces champs dans un **second onglet « Informations professionnelles »** de la modale de création/édition, pour ne pas allonger le formulaire principal ;
3. ajoute dans chaque ligne de la page Équipe un bouton **« Informations utiles »** qui ouvre une **fenêtre de consultation** (lecture, bouton « Copier » par numéro, raccourci vers la modification).

Aucune saisie obligatoire. Une **vérification légère** des formats connus (RPPS, ADELI, SIRET) affiche un **avertissement non bloquant** : l'enregistrement reste toujours possible.

**Hors périmètre** : affichage des identifiants dans la liste Équipe, le planning, l'impression ou l'e-mail (sobriété RGPD : ils ne sortent de l'application que par le fichier de sauvegarde, comme l'e-mail et le téléphone aujourd'hui) ; vérification en ligne auprès d'un annuaire (règle d'or n° 1) ; contrôle d'unicité.

## 2. Écrans concernés

| Route | Écran | Changement `0030` |
|---|---|---|
| `/equipe` | Équipe | Actions de chaque ligne en **icône seule + infobulle** (préférence du porteur, rendu homogène) ; nouveau bouton **« Informations utiles »** (personnes actives **et** archivées) ; nouvelle modale de consultation. |
| `/equipe` (modale « Ajouter / Modifier la personne ») | `FormulairePersonne` | Deux onglets : **« Informations générales »** (tous les champs actuels, inchangés) et **« Informations professionnelles »** (6 champs). |

**Expérience visée** (utilisateur peu à l'aise avec l'informatique) :

- **Fiche** : en haut de la modale, deux onglets bien visibles. Le premier, ouvert par défaut, contient exactement le formulaire d'aujourd'hui. Le second commence par une phrase d'explication (« Ces numéros sont facultatifs… ») puis présente 6 champs avec un libellé complet et une aide courte (« 11 chiffres »). Si un numéro n'a pas la forme attendue, un message **orange** apparaît sous le champ quand on le quitte : « À vérifier : un numéro RPPS compte 11 chiffres. Vous pouvez tout de même enregistrer. » Pas de cadre rouge, pas de blocage.
- **Enregistrer** marche depuis l'un ou l'autre onglet. Si un champ obligatoire de l'onglet général est vide alors qu'on est sur l'onglet professionnel, la fiche **revient d'elle-même** sur « Informations générales » et place le curseur dans le champ à corriger.
- **Consultation** : dans la page Équipe, un clic sur la petite carte d'identité ouvre « Informations utiles — Claire Martin » : les 6 numéros avec leur nom en toutes lettres, « Non renseigné » sinon, un bouton « Copier » à côté de chaque numéro saisi (message « Numéro RPPS copié. »). Un bouton « Modifier ces informations » ouvre directement la fiche sur l'onglet professionnel.
- **Réversible** : vider un champ et enregistrer efface le numéro.

## 3. Modèle de données touché

### 3.1 `Personne` — nouveau champ persisté

| champ | type | oblig. | notes |
|---|---|---|---|
| identifiants | `IdentifiantsPro` | oui (bloc toujours présent) | 6 clés, chacune `string` (1 à 30 caractères, sans espace, majuscules) **ou `null`** ; toutes `null` par défaut [0030] |

`IdentifiantsPro` (objet imbriqué, pas d'`id`), clés dans l'**ordre d'affichage** :

| Clé | Libellé complet (fiche et consultation) | Aide sous le champ | Contrôle de forme (non bloquant) |
|---|---|---|---|
| `rpps` | Numéro RPPS | 11 chiffres. Répertoire partagé des professionnels de santé. | exactement 11 chiffres |
| `adeli` | Numéro ADELI | 9 caractères. Ancien numéro, remplacé peu à peu par le RPPS. | `^(\d{2}\|2A\|2B)\d{7}$` (département, dont Corse) |
| `ordinal` | Numéro ordinal (Ordre des infirmiers) | Numéro d'inscription attribué par l'Ordre. | aucun |
| `cps` | Numéro de carte CPS | Inscrit sur la carte de professionnel de santé. | aucun |
| `carteProfessionnelle` | Numéro de carte professionnelle | Inscrit sur la carte délivrée par l'Ordre. | aucun |
| `siret` | Numéro SIRET | 14 chiffres. Identifiant de l'activité libérale. | 14 chiffres **et** clé de Luhn |

Choix (KISS) :
- **Bloc imbriqué** plutôt que 6 champs à plat : la personne reste lisible, le bloc se remplace d'un coup (`personnes/modifier` fusionne en surface → patch `{ identifiants: {…6 clés} }` complet, aucune perte).
- **Clés toujours présentes** (valeur `null`) plutôt que bloc `null` : le code lit `personne.identifiants.rpps` sans garde ; la normalisation garantit la forme partout (création, migration, chargement).
- **Normalisation** (`normaliserIdentifiant`) : chaîne ou nombre → texte ; **tous les espaces retirés** (y compris insécables : on saisit souvent « 362 521 879 00034 ») ; majuscules (« 2a » → « 2A ») ; `''` → `null` ; tronqué à **30** caractères (atteint seulement par un fichier modifié à la main : le champ a `maxlength="30"`). Tout autre type → `null`. Le numéro est stocké **compact**, prêt à coller dans un formulaire en ligne.

### 3.2 Schéma de sauvegarde : v7 → **v8**

`CURRENT_SCHEMA_VERSION` passe de **7 à 8** (`src/storage/migrations.js`), avec `MIGRATIONS[7]` (patron `MIGRATIONS[4]`/`[6]`) :

```js
// Chaque personne reçoit identifiants: normaliserIdentifiants(personne.identifiants)
// (idempotent : absent → 6 null ; valeurs existantes normalisées ; clés inconnues ignorées).
// tournees, absences, plannings, cabinet : inchangés.
```

- Appliquée au chargement (`bootstrap`) **et** à l'import (`importer`) via `migrate()` : rien à changer côté appelants.
- **Fichier v8 modifié à la main** (`identifiants` absent, non-objet, valeurs numériques, chaîne trop longue) : `fromSaveDocument` normalise `identifiants` de chaque personne, **sans erreur ni blocage** (même choix que `icone` en 0029). `verifierIntegrite` : **inchangée**.
- **Export** : `toSaveDocument` sérialise `personnes.items` tels quels → `"schemaVersion": 8` et `"identifiants"` sur chaque personne, sans code supplémentaire. Un fichier v9 reste refusé (garde existante).

## 4. Store (Vuex)

**Aucun changement.** `personnes/ajouter` construit la personne via `creerPersonne` (qui normalise le bloc, §5.2) ; `personnes/modifier` fusionne le patch émis par le formulaire, qui contient toujours le bloc **complet** déjà normalisé. Persisté : `Personne.identifiants`. Volatil (local à `EquipeView`) : visibilité de la modale de consultation, personne consultée, demande « ouvrir la fiche après fermeture ».

## 5. Domaine (logique pure)

### 5.1 `src/domain/identifiantsPro.js` (**créer**)

Module pur, **sans aucun import** (chargé par `personnes.js`, `schema.js`, `migrations.js` et les composants). En-tête « Module pur : aucun import Vue/Vuex (ADR 0008) ».

- `export const LONGUEUR_MAX_IDENTIFIANT = 30;`
- `export const CHAMPS_IDENTIFIANTS` : `Object.freeze([...])` d'objets gelés `{ cle, libelle, aide }`, **dans l'ordre du tableau §3.1**.
- `export function identifiantsVides()` → `{ rpps: null, adeli: null, ordinal: null, cps: null, carteProfessionnelle: null, siret: null }` (objet neuf à chaque appel).
- `export function normaliserIdentifiant(valeur)` → `string|null` (règles §3.1).
- `export function normaliserIdentifiants(valeur)` → bloc complet : pour chaque clé de `CHAMPS_IDENTIFIANTS`, `normaliserIdentifiant(valeur?.[cle])` ; `valeur` non-objet (ou tableau) → `identifiantsVides()` ; clés inconnues ignorées.
- `export function avertissementIdentifiant(cle, valeur)` → message FR `string`, ou `null` si vide / forme correcte / clé sans contrôle. Travaille sur la valeur normalisée. Messages exacts :
  - `rpps` : « À vérifier : un numéro RPPS compte 11 chiffres. Vous pouvez tout de même enregistrer. »
  - `adeli` : « À vérifier : un numéro ADELI compte 9 caractères, en chiffres (2A ou 2B au début pour la Corse). Vous pouvez tout de même enregistrer. »
  - `siret` (longueur ou caractères) : « À vérifier : un numéro SIRET compte 14 chiffres. Vous pouvez tout de même enregistrer. »
  - `siret` (14 chiffres, clé fausse) : « À vérifier : ce numéro SIRET semble contenir une faute de frappe. Vous pouvez tout de même enregistrer. »
- `function cleLuhnValide(chiffres)` (interne) : somme de Luhn (en partant de la droite, un chiffre sur deux doublé, −9 si > 9) multiple de 10.
- `export function lignesIdentifiants(identifiants)` → `Array<{ cle, libelle, valeur: (string|null) }>` des 6 champs, dans l'ordre, à partir du bloc normalisé (pour la consultation).
- `export function aDesIdentifiants(identifiants)` → `true` si au moins une valeur non `null`.

### 5.2 `src/domain/personnes.js` (**modifier**)

- Typedef `IdentifiantsPro` (6 `@property {(string|null)}`) + `@property {IdentifiantsPro} identifiants` dans `Personne` (mention `[0030]`).
- `creerPersonne` : `identifiants: normaliserIdentifiants(champs.identifiants)`.

### 5.3 `src/domain/schema.js` (**modifier**)

- `fromSaveDocument` : `personnes: { items: (doc.personnes ?? []).map((p) => ({ ...p, identifiants: normaliserIdentifiants(p?.identifiants) })) }` + commentaire (forme garantie, jamais bloquant, 0030).

### 5.4 Réutilisé (non modifié)

`src/adaptateurs/pressePapiers.js` (`copierTexte`, 0027) pour le bouton « Copier » ; `ModaleBase` ; `reperePersonne` / `couleurTexteRepere`.

## 6. Composants

### 6.1 `src/components/communs/ListeOnglets.vue` (**créer**) — barre d'onglets accessible

Composant **présentationnel** (Options API, aucun accès store). Pas de JS Bootstrap `Tab` : il manipule les classes du DOM hors de Vue ; un pilotage Vue est plus simple et suit le précédent de la section « Personnes archivées » (`EquipeView`, sans le JS `collapse`). Les styles `.nav` / `.nav-tabs` sont déjà importés (`src/styles/_bootstrap.scss`).

- **Props** : `onglets` (Array `{ code, libelle }`, requis), `modelValue` (String, code actif, requis), `prefixeId` (String, requis), `libelleGroupe` (String, requis, `aria-label` de la liste).
- **Émet** : `update:modelValue` (code).
- **Rendu** : `<div class="nav nav-tabs" role="tablist" :aria-label="libelleGroupe">` puis un `<button type="button" role="tab" class="nav-link">` par onglet : `id = prefixeId + '-onglet-' + code`, `aria-controls = prefixeId + '-panneau-' + code`, `aria-selected`, classe `active`, `tabindex` 0 sur l'onglet actif et −1 sur les autres.
- **Clavier** (motif ARIA « tabs », activation automatique) : `←`/`→` = onglet précédent/suivant **avec bouclage**, `Origine`/`Fin` = premier/dernier ; chaque déplacement active l'onglet **et** lui donne le focus. `Tab` sort de la barre vers le contenu.
- **Convention d'ids** : le parent rend lui-même ses panneaux avec `id = prefixeId + '-panneau-' + code`, `role="tabpanel"`, `aria-labelledby = prefixeId + '-onglet-' + code` et `tabindex="0"`.
- **Style** (`scoped`, tokens) : onglets hauteur ≥ `$cible-cliquable-min`, onglet actif en gras (`$graisse-gras`) **en plus** du soulignement Bootstrap (pas seulement la couleur), focus visible (`m.focus-visible`).

### 6.2 `src/components/equipe/FormulairePersonne.vue` (**modifier**)

- **Onglets** : `ListeOnglets` en tête du `<form>` (`prefixeId="personne"`, `libelleGroupe="Rubriques de la fiche"`), onglets `general` « Informations générales » et `professionnel` « Informations professionnelles ». `data.ongletActif` (défaut `'general'`).
- **Panneau `general`** : **tout le contenu actuel** du formulaire (identité → notes), déplacé tel quel dans `<div v-show="ongletActif === 'general'" …role="tabpanel">`. `v-show` (pas `v-if`) : la saisie, les `ref` et les ids restent en place quand on change d'onglet.
- **Panneau `professionnel`** :
  - Phrase d'introduction (`form-text` ou paragraphe atténué) : « Ces numéros sont facultatifs. Vous les retrouverez avec le bouton « Informations utiles » de la page Équipe. Ils restent enregistrés sur cet ordinateur et dans votre fichier de sauvegarde. »
  - Les 6 champs générés par `v-for` sur `CHAMPS_IDENTIFIANTS` (grille `row g-3`, `col-sm-6`) : `<label :for>` = `libelle` + « (facultatif) » ; `<input type="text" :id="'personne-identifiant-' + cle" v-model="formulaire.identifiants[cle]" maxlength="30" autocomplete="off" spellcheck="false" class="form-control">` ; aide `form-text` (`id` `…-aide`) ; avertissement éventuel (`id` `…-avertissement`) ; `aria-describedby` via `describedBy(aide, avertissement)` existant.
  - Au `blur` : la valeur affichée est remplacée par `normaliserIdentifiant(valeur) ?? ''` (l'utilisateur voit ce qui sera enregistré), puis le champ est marqué « vérifié ».
- **Avertissement non bloquant** (distinct d'une erreur, voir §7) : `<p class="formulaire-avertissement">` avec `PhInfo` (`aria-hidden`) + message de `avertissementIdentifiant(cle, valeur)` ; affiché si le message n'est pas `null` **et** que le champ est « vérifié » (`data.identifiantsVerifies[cle]`). À l'ouverture d'une fiche existante, les champs **déjà remplis** sont marqués vérifiés (un numéro mal formé enregistré auparavant est signalé tout de suite). Style : couleur `$couleur-avertissement-texte`, même mise en page que `.formulaire-erreur` (icône + texte), **pas** de classe `is-invalid` ni de bordure rouge.
- **Brouillon** (`construireFormulaire`) : `identifiants` = objet des 6 clés, `personne.identifiants?.[cle] ?? ''` en édition, `''` en création (objet toujours recopié, la prop n'est jamais mutée). `reinitialiser()` remet `ongletActif` (voir ci-dessous) et `identifiantsVerifies`.
- **Émission** (`soumettre`) : ajoute `identifiants: normaliserIdentifiants(this.formulaire.identifiants)`.
- **Prop `champInitial`** : accepte une 3ᵉ valeur `'identifiants'`. `reinitialiser()` pose `ongletActif = champInitial === 'identifiants' ? 'professionnel' : 'general'` ; `onAffichee()` met alors le focus dans le **premier champ** de l'onglet professionnel (`#personne-identifiant-rpps`). `'prenom'` et `'email'` (lien 0027) : onglet général, comportement inchangé. JSDoc de la prop mise à jour.
- **Erreur bloquante dans l'onglet masqué** : chaque entrée de `champsEnOrdre()` reçoit `onglet: 'general'` (toutes les règles Vuelidate y vivent). `focusPremierChampErrone()` : si l'onglet du premier champ en erreur n'est pas l'onglet actif, bascule `ongletActif` puis pose le focus au `$nextTick` (un champ masqué par `v-show` ne peut pas recevoir le focus). Le message « Certains champs sont à corriger. » reste hors des panneaux (visible quel que soit l'onglet).
- Imports : `ListeOnglets`, `PhInfo`, `CHAMPS_IDENTIFIANTS`, `normaliserIdentifiant`, `normaliserIdentifiants`, `avertissementIdentifiant`.

### 6.3 `src/components/equipe/ModaleInformationsUtiles.vue` (**créer**)

Composant **présentationnel** au-dessus de `ModaleBase` (aucun store, aucun routeur), sur le modèle de `ModaleEnvoiEmail` (0027).

- **Props** : `visible` (Boolean, requis), `personne` (Object, défaut `null`), `modifiable` (Boolean, défaut `true` ; `false` pour une personne archivée).
- **Émet** : `fermeture`, `modifier`.
- **Titre** : « Informations utiles — Prénom Nom ».
- **Contenu** :
  - Si `aDesIdentifiants` : une liste `<dl>` des 6 lignes de `lignesIdentifiants` : `<dt>` = libellé complet ; `<dd>` = numéro dans un `<span class="user-select-all font-monospace">` (un clic le sélectionne en entier, chiffres faciles à lire) + bouton **icône seule** `PhCopy` (`title="Copier"`, `aria-label="Copier le numéro RPPS"` — libellé en minuscule après « le ») ; ou « Non renseigné » en texte atténué, sans bouton.
  - Sinon : « Aucune information professionnelle n'a encore été saisie pour Prénom. »
  - Personne archivée (`!modifiable`) : phrase atténuée « Pour modifier ces informations, restaurez d'abord la personne. »
  - Zone d'état `role="status" aria-live="polite"` : « Numéro RPPS copié. » après succès ; en cas d'échec de `copierTexte` : « La copie automatique n'a pas fonctionné. Cliquez sur le numéro pour le sélectionner, puis copiez-le avec Ctrl+C. » Vidée à chaque ouverture.
- **Pied** : si `modifiable`, bouton `btn-outline-primary` `PhPencilSimple` + « Modifier ces informations » (ou « Compléter la fiche » s'il n'y a aucun numéro) → émet `modifier` ; bouton `btn-primary` « Fermer » (`data-bs-dismiss="modal"`).
- **Style** (`scoped`, tokens) : lignes `dt`/`dd` lisibles (libellé au-dessus du numéro sur mobile, côte à côte à partir de `sm`), boutons ≥ `$cible-cliquable-min`.

### 6.4 `src/views/EquipeView.vue` (**modifier**)

- **Actions par ligne en icône seule** (préférence du porteur : actions secondaires en icône seule, `title` + `aria-label`, rendus homogènes), dans l'ordre : **Modifier** (`PhPencilSimple`), **Informations utiles** (`PhIdentificationCard`, nouveau), **Souhaits** (`PhShootingStar`, `router-link`), **Archiver** (`PhArchive`). Ligne archivée : **Informations utiles** puis **Restaurer** (`PhArrowCounterClockwise`).
  - `title` = libellé court (« Modifier la fiche », « Informations utiles », « Souhaits », « Archiver », « Restaurer ») ; `aria-label` = libellé + nom (« Informations utiles de Claire Martin ») pour distinguer les lignes au lecteur d'écran.
  - **Mobile** (pas de survol au toucher) : le libellé court reste écrit à côté de l'icône sous `md` (`<span class="d-md-none">`).
  - Classe commune `equipe-bouton-icone` (inline-flex centré, `min-width`/`min-height` `$cible-cliquable-min`, `gap` `$espace-1`) ; groupe `.equipe-actions` en `gap: $espace-1`. La règle spéciale `.equipe-bouton-souhaits` devient inutile (supprimée).
- **Consultation** : `data` `informationsVisible`, `personneInformations`, `ficheApresInformations` (booléen). `ouvrirInformations(personne)` ; `<ModaleInformationsUtiles :visible :personne="personneInformations" :modifiable="personneInformations?.actif !== false" @fermeture="onFermetureInformations" @modifier="onModifierDepuisInformations">`.
- **Enchaînement vers la fiche** (Bootstrap n'affiche qu'une modale à la fois) : `onModifierDepuisInformations` pose `ficheApresInformations = true` puis `informationsVisible = false` ; `onFermetureInformations` (appelé quand la fermeture est **terminée**) remet `informationsVisible = false` et, si demandé, appelle `ouvrirEdition(personne, 'identifiants')` puis remet le drapeau à `false`. Le focus revient ainsi au bouton « Informations utiles » à la fermeture de la fiche.
- `ouvrirEdition(personne, champ = 'prenom')` pose `champInitial = champ`. Lien profond `?modifier=` (0027) **inchangé** (`'email'`, onglet général).
- JSDoc d'en-tête complétée (consultation, enchaînement).

## 7. Règles de validation

- **Bloquantes (Vuelidate)** : **inchangées**, toutes dans l'onglet général. **Aucune règle Vuelidate** sur les identifiants : le format ne doit jamais empêcher d'enregistrer, et `maxlength="30"` borne déjà la longueur.
- **Avertissements (non bloquants)** : calculés par `avertissementIdentifiant` (domaine), **hors Vuelidate**, donc sans effet sur `v$.$invalid` ni sur `soumettre()`.
- **Distinction erreur / avertissement**, jamais par la seule couleur :

  | | Erreur (bloquante) | Avertissement (non bloquant) |
  |---|---|---|
  | Icône | `PhWarning` | `PhInfo` |
  | Couleur | `$couleur-erreur` | `$couleur-avertissement-texte` |
  | Bordure du champ | rouge (`is-invalid`) | inchangée |
  | Texte | dit quoi corriger | commence par « À vérifier : », finit par « Vous pouvez tout de même enregistrer. » (formule déjà utilisée par `FormulaireAbsence`) |
  | Enregistrement | refusé, focus sur le champ | accepté |

## 8. Points d'attention ergonomie

- **Le formulaire d'aujourd'hui ne change pas** : l'onglet général est ouvert par défaut et contient exactement les mêmes champs, dans le même ordre.
- **Onglets reconnaissables** : forme d'onglet classique, onglet actif en gras et souligné ; libellés en clair, jamais « identifiants » ni « données ».
- **Jamais bloqué par un numéro** : avertissement orange explicite et rassurant ; l'utilisateur garde la main.
- **Saisie tolérante** : on peut taper avec des espaces, en minuscules ; la valeur rangée s'affiche en quittant le champ.
- **Pas de piège d'onglet** : une erreur dans l'onglet non affiché ramène à cet onglet avec le curseur dans le champ.
- **Libellés complets partout** (fiche et consultation) : « Numéro RPPS », pas « RPPS » seul ; aide courte avec le nombre de chiffres attendu.
- **Copier sans risque** : un clic, un message de confirmation ; si la copie échoue, consigne simple et sélection en un clic.
- **Icônes seules** : infobulle au survol, libellé écrit sur mobile, nom de la personne dans le nom accessible ; relecture `ui-ux` sur la découvrabilité de « Archiver » et « Informations utiles » sans texte.
- **Clavier** : flèches dans la barre d'onglets, focus visible, Échap ferme les modales, focus rendu au bouton déclencheur.
- **Sobriété** : rien de plus dans la liste Équipe ; les numéros ne s'affichent que sur demande.

## 9. Étapes d'implémentation

**4 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre : **(T1 ∥ T2) → (T3 ∥ T4)**. T1 et T2 touchent des fichiers disjoints ; T3 et T4 aussi (seul contrat partagé : la valeur `'identifiants'` de `champInitial`, fixée ici).

### Tâche 1 — Modèle `Personne.identifiants`, règles de format, migration v8

**Fichiers** :
- `src/domain/identifiantsPro.js` (**créer**) — §5.1.
- `src/domain/personnes.js` (**modifier**) — §5.2.
- `src/domain/schema.js` (**modifier**) — §5.3.
- `src/storage/migrations.js` (**modifier**) — `CURRENT_SCHEMA_VERSION = 8` ; `MIGRATIONS[7]` documentée en JSDoc sur le modèle de `MIGRATIONS[6]` (§3.2).
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — ligne `identifiants` dans le tableau `Personne` + sous-section « IdentifiantsPro (imbriqué dans Personne) » (tableau §3.1).
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) — commentaire `schemaVersion` (« v8 = Personne.identifiants ») et valeur de l'exemple `8`, bloc `"identifiants": { "rpps": null, … }` dans la personne d'exemple, paragraphe **`MIGRATIONS[7]` (v7 → v8)** — feature 0030.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — `identifiantsPro.js  # identifiants professionnels d'une personne (normalisation, formats) [0030]` ; commentaire `communs/` complété (« barre d'onglets [0030] ») ; sous `equipe/` : `ModaleInformationsUtiles.vue [0030]`.

**Critères de sortie** (script jetable, §11 étape 1) :
- `CHAMPS_IDENTIFIANTS` : 6 clés uniques, ordre §3.1 ; `identifiantsVides()` renvoie un objet neuf à chaque appel.
- `normaliserIdentifiant` : `' 123 456 789 00007 '` → `'12345678900007'` ; `'2a1234567'` → `'2A1234567'` ; `' '` / `''` / `null` / `undefined` / `{}` → `null` ; `12345678901` (nombre) → `'12345678901'` ; 40 caractères → 30.
- `normaliserIdentifiants(undefined)`, `('x')`, `([])` → 6 `null` ; `({ rpps: '1', inconnu: 'x' })` → `rpps: '1'`, pas de clé `inconnu`.
- `avertissementIdentifiant` : `('rpps', '10012345678')` → `null` ; `('rpps', '1001234567')` → message RPPS ; `('adeli', '2B6012345')` → `null` ; `('adeli', '12345')` → message ADELI ; `('siret', '12345678900007')` → `null` ; `('siret', '123 456 789 00007')` → `null` ; `('siret', '12345678900008')` → message « faute de frappe » ; `('siret', '1234')` → message 14 chiffres ; `('ordinal', 'n’importe quoi')` → `null` ; toute clé avec `''` → `null`.
- `creerPersonne({ prenom: 'A', nom: 'B' }).identifiants` → 6 `null`.
- `migrate` d'un document v7 fabriqué (ids GUID via `crypto.randomUUID()`) avec 3 personnes (sans `identifiants` ; `identifiants: { siret: '123 456 789 00007' }` ; `identifiants: 'texte'`) → `schemaVersion: 8`, blocs complets attendus, tous les autres champs strictement identiques, `verifierIntegrite(doc).ok === true` ; re-`migrate` → identique (idempotence).
- `fromSaveDocument` d'un document v8 avec `identifiants: null` → 6 `null`.
- `identifiantsPro.js` n'a aucun import ; `npm run build` réussit.

### Tâche 2 — Composant partagé `ListeOnglets`

**Fichiers** :
- `src/components/communs/ListeOnglets.vue` (**créer**) — §6.1.

**Dépend de** : rien. **Parallélisable** avec T1.

**Critères de sortie** : rôles et attributs ARIA conformes au §6.1 (vérifiés à la relecture et en T3) ; flèches avec bouclage, Origine/Fin ; aucune dépendance au JS Bootstrap ; aucune couleur en dur ; `npm run build` réussit.

### Tâche 3 — Fiche personne à onglets

**Fichiers** :
- `src/components/equipe/FormulairePersonne.vue` (**modifier**) — §6.2.

**Dépend de** : T1, T2. **Parallélisable** avec T4.

**Critères de sortie** : parcours §10 « Fiche » ; création sans toucher l'onglet professionnel → `"identifiants"` à 6 `null` dans `localStorage` ; prénom vide + enregistrer depuis l'onglet professionnel → retour sur l'onglet général, focus sur « Prénom » ; lien `?modifier=` (0027) → onglet général, curseur dans l'e-mail ; `npm run build` réussit.

### Tâche 4 — Consultation et actions de la page Équipe

**Fichiers** :
- `src/components/equipe/ModaleInformationsUtiles.vue` (**créer**) — §6.3.
- `src/views/EquipeView.vue` (**modifier**) — §6.4.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) — ligne `/equipe` : « …, informations professionnelles (onglet de la fiche, consultation « Informations utiles ») », features `0030` ajoutée.

**Dépend de** : T1. **Parallélisable** avec T3 (si T3 n'est pas encore livrée, « Modifier ces informations » ouvre la fiche sur l'onglet général : à revérifier après T3).

**Critères de sortie** : parcours §10 « Page Équipe » et « Consultation » ; `PhIdentificationCard` importé depuis `@phosphor-icons/vue` (présent dans `node_modules`) ; aucun `v-html` ; `npm run build` réussit.

## 10. Critères d'acceptation

**Page Équipe**
- [x] Chaque personne active a 4 boutons icône : Modifier, Informations utiles, Souhaits, Archiver ; chaque personne archivée : Informations utiles, Restaurer. Au survol, une infobulle donne le nom de l'action ; sur un écran étroit, le nom est écrit à côté de l'icône.
- [x] Au lecteur d'écran, chaque bouton annonce l'action et la personne (« Informations utiles de Claire Martin »).
- [x] La liste n'affiche aucun numéro professionnel.

**Fiche**
- [x] « Ajouter une personne » et « Modifier » ouvrent la fiche sur « Informations générales », qui contient exactement les champs d'avant.
- [x] L'onglet « Informations professionnelles » montre la phrase d'introduction et 6 champs facultatifs avec libellé complet et aide.
- [x] Clavier : Tab atteint l'onglet actif, les flèches changent d'onglet (avec bouclage), le focus est visible.
- [x] Saisir « 123 456 789 00007 » en SIRET puis quitter le champ → il affiche « 12345678900007 », sans avertissement.
- [x] Saisir « 1001234567 » en RPPS puis quitter le champ → message orange « À vérifier : un numéro RPPS compte 11 chiffres. Vous pouvez tout de même enregistrer. », sans cadre rouge ; « Enregistrer » enregistre quand même.
- [x] SIRET « 12345678900008 » → message « faute de frappe » ; ADELI « 2B6012345 » → aucun message ; numéro ordinal quelconque → aucun message.
- [x] Rouvrir une fiche dont un numéro enregistré est mal formé → l'avertissement est visible dès l'onglet ouvert.
- [x] Prénom vidé, puis « Enregistrer » depuis l'onglet professionnel → la fiche revient sur « Informations générales », curseur dans « Prénom », message d'erreur affiché, rien n'est enregistré, la saisie des deux onglets est conservée.
- [x] Vider un numéro et enregistrer → il n'apparaît plus dans « Informations utiles ».
- [x] Depuis l'envoi du planning (0027), « Compléter la fiche » ouvre toujours l'onglet général, curseur dans l'e-mail.

**Consultation**
- [x] « Informations utiles » ouvre « Informations utiles — Prénom Nom » : 6 lignes avec libellé complet, numéro ou « Non renseigné ».
- [x] « Copier » d'une ligne met le numéro dans le presse-papiers et affiche « Numéro … copié. » ; un clic sur un numéro le sélectionne en entier.
- [x] Personne sans aucun numéro → phrase « Aucune information professionnelle… » et bouton « Compléter la fiche ».
- [x] « Modifier ces informations » ferme la consultation et ouvre la fiche sur l'onglet professionnel, curseur dans « Numéro RPPS » ; à la fermeture de la fiche, le focus revient sur le bouton « Informations utiles » de la ligne.
- [x] Personne archivée : numéros visibles et copiables, pas de bouton de modification, phrase « restaurez d'abord la personne ».

**Sauvegarde**
- [x] Des données existantes (v7) se rechargent sans erreur ; après une modification, `localStorage` contient `"schemaVersion": 8` et un bloc `"identifiants"` complet sur chaque personne.
- [x] Export → `"schemaVersion": 8` ; ré-import du fichier exporté → identique ; import d'une ancienne sauvegarde v7 → identifiants vides.
- [x] Un fichier v8 modifié à la main (`"identifiants": null`, ou `"rpps": 12345678901` en nombre) s'importe sans erreur.
- [x] Non-régression sur `files/idelia-sermet.json` : migration vers v8 sans aucune perte (§11 étape 2).
- [x] `npm run build` réussit.

## 11. Vérification

1. **Script jetable domaine + migration (T1)** — dans le dossier temporaire de session (scratchpad, **jamais dans le dépôt**), un `.mjs` qui démarre Vite en mode middleware (`createServer({ root: <dépôt>, server: { middlewareMode: true }, appType: 'custom' })`) et charge par `ssrLoadModule` `/src/domain/identifiantsPro.js`, `/src/domain/personnes.js`, `/src/domain/schema.js`, `/src/storage/migrations.js` ; exécute les contrôles de T1 ; ferme le serveur ; supprimé après usage. Les numéros de test sont **fictifs** (ceux du §9).
2. **Non-régression sur les données réelles** — même script, chemin de `files/idelia-sermet.json` **passé en argument** : `migrate` puis `verifierIntegrite` ; n'afficher **que des compteurs et des booléens** (jamais de nom, de date ni de contenu) : version d'origine → 8 ; mêmes nombres de personnes, préférences, tournées, absences, plannings et affectations ; chaque personne identique à l'originale hormis `identifiants` (6 `null`) ; tournées, absences, plannings, cabinet strictement identiques ; `verifierIntegrite.ok === true` ; idempotence. Ne rien copier du fichier dans le dépôt, un commit ou un rapport.
3. `npm run build`.
4. **Recette navigateur** (`npm run dev`, http://localhost:5199/idelia/#/, données importées depuis `idelia-sermet.json`) : parcours §10 Page Équipe → Fiche (deux onglets, avertissements, erreur bloquante depuis l'onglet professionnel) → Consultation (copie, enchaînement vers la fiche, personne archivée) → Diffusion > envoi par e-mail > « Compléter la fiche » (non-régression 0027).
5. DevTools > Application : `schemaVersion: 8`, bloc `identifiants` présent ; export puis import → identique ; import d'un fichier v8 modifié (copie hors dépôt) → aucune erreur.
6. Clavier seul et lecteur d'écran : barre d'onglets (« Informations professionnelles, onglet, 2 sur 2 »), avertissement relié au champ (`aria-describedby`), boutons de la liste annoncés avec le nom de la personne.
7. Relecture `ui-ux` (onglets, icônes seules dans la liste, ton des avertissements), puis audit `security` (aucun `v-html`, valeurs importées bornées et normalisées, numéros jamais journalisés ni envoyés hors du navigateur).

## 12. Décisions à confirmer / risques

1. **Actions de la page Équipe en icône seule** (retenu, préférence du porteur) : toutes les actions de ligne passent en icône seule pour un rendu homogène avec le nouveau bouton ; libellé écrit sur mobile. Risque : « Archiver » moins découvrable pour le public visé → relecture `ui-ux` ; repli possible : garder le texte à partir de `lg`.
2. **Contrôle de Luhn** : appliqué au **SIRET** seulement (règle publique et stable). Le RPPS comporterait aussi une clé de contrôle, mais en l'absence de référence vérifiée ici, on ne contrôle que les 11 chiffres (un faux avertissement serait pire qu'aucun). À ajouter plus tard sans migration si la règle est confirmée. ADELI : forme seulement (clé non publique).
3. **Stockage compact** (espaces retirés, majuscules) : prêt à coller dans les formulaires en ligne ; en contrepartie, un SIRET s'affiche sans espaces en consultation (police à chasse fixe pour la lisibilité). Alternative : afficher groupé (« 123 456 789 00007 ») en gardant la copie compacte — non retenu (KISS).
4. **« Initiales Vega » reste dans l'onglet général** : elles changent la pastille de la personne (aperçu « Couleur de repère » juste en dessous). À déplacer si le porteur préfère regrouper tout ce qui touche aux logiciels métiers.
5. **Consultation limitée aux 6 numéros** : l'e-mail et le téléphone n'y figurent pas (périmètre de la feuille de route). Les ajouter en tête de « Informations utiles » coûterait deux lignes et serait cohérent avec le nom du bouton — à décider par le porteur.
6. **RGPD** : ces numéros sont des données professionnelles personnelles. Ils vivent dans `localStorage` et le fichier de sauvegarde, comme l'e-mail et le téléphone ; aucune autre sortie (planning, PDF, e-mail, feuille de route). La phrase d'introduction de l'onglet le dit en clair. Rien à acter par ADR.
7. **Pas d'unicité** (deux personnes avec le même numéro) : non contrôlée, peu probable et sans conséquence fonctionnelle.
8. **Aucun écart d'ADR** : aucune dépendance ajoutée (onglets pilotés par Vue avec les styles `nav` déjà importés, JS Bootstrap limité à `Modal`), icônes Phosphor (`PhIdentificationCard`, `PhInfo`, `PhCopy`), persistance via store + plugin + migration (ADR 0005/0006), logique en module pur (ADR 0008), Vuelidate réservé au bloquant (ADR 0011), tokens SCSS (ADR 0012/0015).

## 13. Retouches de recette (2026-10-14)

- **Équipe** : « Archiver » en `btn-outline-danger` et écarté des autres actions (icône seule conservée, préférence du porteur ; la confirmation d'archivage reste le filet de sécurité). Le libellé « Informations utiles » est conservé (terme du porteur, ROADMAP).
- **Onglet pro** : texte d'introduction précisant que les numéros sont inclus dans les sauvegardes.
- **Robustesse** (audit `security`, points Faible) : pré-coupe à 200 caractères avant normalisation (chaîne géante importée) ; la migration v7 → v8 laisse tels quels les éléments non objets de `personnes`, que `verifierIntegrite` rejette ensuite.
