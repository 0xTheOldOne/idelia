# Feature 0016 — Refonte du modèle Tournée & tournées coupées

- **Statut** : À faire
- **Dépend de** : `0006` (modèle/CRUD tournée actuel, `src/domain/tournees.js`, `FormulaireTournee`, `TourneesView`), `0009` (moteur pur `src/domain/scheduling/`), `0010` (génération + grille lecture seule), `0011` (éditeur — **EN COURS dans une autre session**). Touche aussi `0005` (souhaits qui référencent des tournées : `FormulairePreference`, `SouhaitsView`, `preferences.js`) et `0007` (absences, via la réconciliation créneau ↔ horaires).
- **ADR liés** : [0017](../docs/adr/0017-modelisation-tournees-coupees-segments.md) (**décision fondatrice** : une tournée = une liste de segments horaires ; le type complète/coupée est dérivé de `segments.length` ; segments assignables indépendamment ; recouvrement horaire réel ; continuité intra-journée **souple**), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (moteur pur), [0007](../docs/adr/0007-generation-planning-hybride.md) (mode hybride, verrouillage préservé), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (**migration de schéma** derrière `storageRepository`), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7, dates `"YYYY-MM-DD"`, **heures `"HH:mm"`**, horodatages ISO UTC), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS + JSDoc), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0013](../docs/adr/0013-icones-phosphor.md) (Phosphor), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + Bootstrap thémé).

> ⚠️ **REFACTOR TRANSVERSE À FORT RISQUE DE CONFLIT.** Cette feature réécrit le cœur du modèle `Tournee` et se propage dans le moteur (`0009`), la génération (`0010`) et **l'éditeur `0011`, actuellement en cours dans une autre session**. **Elle ne doit pas démarrer avant que `0011` soit atterri sur `main`** ; le développeur repart alors de `main` à jour. Voir §12 (« Coordination & séquencement ») — à lire **avant** toute implémentation.

## 1. Contexte & objectif

Le métier des cabinets infirmiers distingue deux formats de tournée (ADR 0017) :

- **Tournée « complète »** — journée continue (ex. `07:00 → 13:30`).
- **Tournée « coupée »** — une vacation le matin **puis** une reprise le soir (ex. `07:00 → 13:30` **puis** `17:00 → 20:00`), avec une **coupure au milieu de journée qui n'est pas un repos**. Chaque vacation est **assignable indépendamment** : cas nominal = la même personne matin et soir ; cas de repli = deux personnes différentes (la personne du matin ayant un empêchement l'après-midi). Quand une même personne assure les deux vacations, cela compte pour **une seule journée travaillée**.

Le modèle actuel repose sur l'axiome « une tournée = **un** créneau symbolique = **une** plage horaire continue » (`src/domain/tournees.js` : `creneau`, `heureDebut`/`heureFin` uniques). Il ne peut pas exprimer une journée coupée.

`0016` implémente le **nouveau modèle décidé** — une tournée porte une **liste de 1 ou 2 segments horaires** — et les **simplifications** décidées ensuite (suppression de `secteur` et `code` ; le `libelle` texte libre remplace `nom` ; le soft-delete `archivee` est **conservé**). C'est un **refactor transverse** : modèle de données + **migration de schéma** + moteur + formulaires + affichage. Résultat attendu : le gestionnaire peut décrire une tournée coupée en un formulaire simple, le moteur la planifie correctement (segments couvrables par des personnes différentes, continuité intra-journée privilégiée mais non imposée, recouvrement horaire réel), et le planning l'affiche et la rend éditable comme un tout.

**Hors périmètre `0016`** :

- **Granularité horaire des absences** (`0007`) : les absences **restent** à la granularité demi-journée (`CRENEAUX` : `MATIN`/`APRES_MIDI`/`JOURNEE`). On **réconcilie** créneau symbolique ↔ horaires réels dans le moteur (§5.4), sans passer les absences aux heures réelles (KISS, public non-technique — voir §12, sous-décision A).
- **Mise à jour des documents d'architecture** (`docs/architecture/02`, `03`, `05`) pour refléter le nouveau modèle `Tournee`/`Affectation` : à faire en suivi, hors de ce plan (§12).
- **Nouveau mécanisme d'archivage de tournée** : le **soft-delete existant** (`archivee`, `0006`) est **conservé à l'identique** (voir §3, §4.1, §12 sous-décision C) — cette feature ne le retouche pas, elle retire seulement le **repère « Active »** de la liste (bruit visuel).

## 2. Écrans concernés

Aucune **nouvelle route**. Les écrans existants sont **adaptés** ([07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md)) :

| Route | Écran | Changement `0016` |
|---|---|---|
| `/tournees` | **Tournées** (`0006`) | Le formulaire passe de « créneau + horaires uniques + effectif » à « **libellé + 1 ou 2 segments** (chacun : horaires + effectif) ». La liste affiche le libellé, les horaires (une ou deux plages), un repère **« Coupée »**, l'effectif par segment. Plus de secteur/code/créneau ; le **soft-delete (`archivee`) reste**, mais le repère **« Active »** disparaît (bruit visuel). |
| `/souhaits` | **Souhaits** (`0005`) | Les libellés de tournée référencées passent de `nom` (+ créneau/horaires) à `libelle` (+ horaires des segments). Aucune logique nouvelle. |
| `/planning` | **Planning** (`0010`/`0011`) | L'unité sous-journalière d'une cellule passe du **créneau** au **segment** : une cellule (tournée, date) présente ses affectations groupées **par segment** (matin / reprise) pour une tournée coupée ; l'ajout / le glisser-déposer / la sous-couverture ciblent désormais un **segment** (indice), pas un créneau. **Glissement, pas refonte** (§6.4). |

**Expérience visée** (utilisateur non-technique) :

- Sur **Tournées**, décrire une tournée coupée doit être **une évidence** : on remplit les horaires du matin ; un bouton clair **« Ajouter une reprise le soir (journée coupée) »** fait apparaître un second bloc d'horaires. Un bouton **« Retirer la reprise »** revient à une tournée complète. Jamais de jargon (« segment », « vacation » restent implicites : on parle de « le matin » / « la reprise du soir »).
- Sur **Planning**, une tournée coupée reste **une seule ligne** ; à l'intérieur d'une case, les deux vacations sont **visuellement distinctes** (petit intitulé « Matin 07:00–13:30 » / « Soir 17:00–20:00 ») pour qu'on comprenne qui fait quoi, sans transformer la grille.

## 3. Modèle de données touché

### 3.1 Entité `Tournee` — modèle cible

Le `creneau` symbolique, les `heureDebut`/`heureFin`/`nbPersonnesRequises` uniques, `secteur` et `code` **disparaissent** ; ils sont remplacés par une **liste de segments**. Le soft-delete **`archivee` est conservé**.

| champ | type | oblig. | rôle `0016` |
|---|---|---|---|
| `id` | uuid | oui | inchangé, immuable |
| `libelle` | string | oui | **remplace `nom`** — texte **libre** nommé par le gestionnaire (pas de secteur/localisation) |
| `segments` | `Segment[]` (**1 ou 2**) | oui | **1 segment = tournée complète ; 2 segments = tournée coupée.** Le type est **dérivé** de `segments.length`, jamais stocké |
| `joursApplication` | number[1..7] | oui | inchangé (jours ISO, triés/dédupliqués) |
| `couleur` | string hex `#RRGGBB` | non | inchangé |
| `archivee` | boolean | oui | **conservé** — soft-delete (`true` = archivée, défaut `false`), inchangé vs `0006` |
| `dateDebutValidite` | `"YYYY-MM-DD"` \| null | non | **conservé** (saisonnalité) |
| `dateFinValidite` | `"YYYY-MM-DD"` \| null | non | **conservé** |
| `ordreAffichage` | integer \| null | non | conservé (non édité, comme `0006`) |
| `notes` | string | non | conservé |
| `createdAt` / `updatedAt` | ISO UTC | oui | inchangés |

**Segment** (objet imbriqué, jamais une entité de première classe — pas d'`id`, repéré par son **indice** dans le tableau) :

| champ | type | oblig. | notes |
|---|---|---|---|
| `heureDebut` | `"HH:mm"` | oui | via `<input type="time">` |
| `heureFin` | `"HH:mm"` | oui | **> `heureDebut`** (comparaison lexicographique de chaînes) |
| `nbPersonnesRequises` | integer ≥ 1 | oui | effectif **de ce segment** (défaut `1`) |

**Suppressions** vs modèle actuel : `nom` (→ `libelle`), `creneau`, `heureDebut`/`heureFin` uniques, `nbPersonnesRequises` unique (→ dans les segments), `secteur`, **`code`** (recommandé : le libellé libre suffit — §12, sous-décision D). **`archivee` n'est PAS supprimé** : le soft-delete est conservé (§12, sous-décision C, tranchée).

### 3.2 Entité `Affectation` — référence un segment

L'`Affectation` (imbriquée dans `Planning`, produite par le moteur et l'éditeur) **remplace `creneau` par `segmentIndex`** (entier 0-based) :

| champ | avant | après |
|---|---|---|
| `creneau` | `'MATIN'`/`'APRES_MIDI'`/`'JOURNEE'` (dénormalisé depuis la tournée) | **supprimé** |
| `segmentIndex` | — | **entier ≥ 0** : indice du segment couvert dans `tournee.segments` |

Les autres champs (`id`, `personneId`, `tourneeId`, `date`, `origine`, `verrouillee`, `commentaire`, `createdAt`/`updatedAt`) sont **inchangés**. Les horaires réels d'une affectation se **résolvent** via `tournee.segments[affectation.segmentIndex]` (jamais dénormalisés sur l'affectation — KISS ; l'affectation ne porte que l'indice).

### 3.3 Migration (`schemaVersion` 1 → 2)

`src/storage/migrations.js` : **bump `CURRENT_SCHEMA_VERSION` à `2`** et ajout de `MIGRATIONS[1] = (doc) => …` (première migration réelle du projet), qui transforme un document v1 en v2 **sans perte** :

1. **Chaque `Tournee`** de `doc.tournees` :
   - `libelle` ← ancien `nom`.
   - `segments` ← `[{ heureDebut, heureFin, nbPersonnesRequises: nbPersonnesRequises ?? 1 }]` (un unique segment reconstruit depuis les anciens `heureDebut`/`heureFin`/`nbPersonnesRequises`).
   - **Suppression** de `nom`, `creneau`, `heureDebut`, `heureFin`, `nbPersonnesRequises`, `secteur`, `code`.
   - **Conservation** de `id`, `joursApplication`, `couleur`, **`archivee`** (recopié tel quel — une tournée archivée **reste archivée**), `dateDebutValidite`, `dateFinValidite`, `ordreAffichage`, `notes`, `createdAt`, `updatedAt`.
2. **Chaque `Affectation`** de `doc.plannings[].affectations` : `segmentIndex: 0` (l'unique segment de la tournée migrée) ; **suppression** de `creneau`. Correct car, en v1, une tournée = un seul créneau = une seule plage → toutes ses affectations retombent sur le segment 0.
3. `doc.absences` : **inchangées** (elles gardent leur `creneau` symbolique — voir §5.4).

> **Intégrité préservée** : `archivee` étant recopié, les tournées archivées en v1 **restent archivées** en v2 ; les plannings passés qui référencent leur `tourneeId` conservent une tournée résoluble (jamais de suppression physique — [02 §Intégrité](../docs/architecture/02-modele-de-domaine.md)).

**Impact `verifierIntegrite`** (`src/domain/schema.js`) : **aucun changement structurel requis** — la vérification d'intégrité ne lit aucun champ interne de `Tournee`, et le contrôle des `PREFERENCE_TOURNEE.params.tourneeIds` reste fondé sur les `id` (inchangés). (Mettre à jour uniquement la JSDoc si elle cite des champs supprimés.)

## 4. Store (Vuex)

### 4.1 Module `tournees` (`src/store/modules/tournees.js`)

- **Getters** : `byId`, `actives` (filtre `!archivee`) et `archivees` (`archivee === true`) **inchangés** vs `0006`. `actives` reste la source de `0010`/`0011` (`GrillePlanning`, `PlanningView`, `SouhaitsView`, `FormulairePreference`).
- **Actions** : `ajouter`/`modifier` **inchangées** (délèguent à `creerTournee`, posent `updatedAt`) ; `archiver`/`restaurer` **conservées** (soft-delete, `0006`).
- **Mutations** : `REPLACE`/`ADD`/`UPDATE` **inchangées**.

> **Module `tournees` quasi inchangé côté archivage** : le refactor ne touche que la **forme** des objets `Tournee` (via `creerTournee`), pas le mécanisme de soft-delete du store.

### 4.2 Module `plannings` (`src/store/modules/plannings.js`, actions d'édition de `0011`)

- `ajouterAffectation({ …, tourneeId, personneId, date, segmentIndex })` : **`creneau` → `segmentIndex`** ; passe `segmentIndex` à `creerAffectationManuelle` (§5.1).
- `deplacerAffectation({ …, affectationId, versTourneeId, versDate, versSegmentIndex })` : la destination reconstruite par spread de la source ne modifie plus `creneau` mais **`segmentIndex`** (préserve `id`/`verrouillee`/`commentaire`).
- `genererPropose` / `evaluerCourant` / `assemblerEntree` / `regenerer` : **inchangés** (ils passent `tournees/actives` tel quel ; le moteur fait le reste).

### 4.3 Persistance & schéma

- Le plugin débouncé (`0002`) et `storageRepository` (`ADR 0005`) restent la **seule** voie de persistance. **Aucun accès `localStorage`** ailleurs.
- `toSaveDocument`/`fromSaveDocument` (`schema.js`) : **inchangés** (ils recopient `tournees.items`/`plannings.items` tels quels ; la forme des objets change mais pas la frontière de (dé)sérialisation).
- Seul changement de contrat de persistance : `CURRENT_SCHEMA_VERSION` = `2` (§3.3).

## 5. Domaine (logique pure)

Tout dans `src/domain/`, **sans import Vue/Vuex ni `localStorage`** ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)).

### 5.1 `src/domain/tournees.js` (**réécrire la fabrique**) + `src/domain/planning.js`

- **`creerTournee(champs)`** → `Tournee` (modèle §3.1) :
  - `libelle` : `String(champs.libelle ?? '').trim()`.
  - `segments` : `normaliserSegments(champs.segments)`.
  - `joursApplication` : `normaliserJours(champs.joursApplication)` (helper interne **conservé**).
  - `couleur`, `archivee` (`champs.archivee ?? false`, **conservé**), `dateDebutValidite`, `dateFinValidite`, `ordreAffichage`, `notes`, `createdAt`, `updatedAt` : comme aujourd'hui.
  - **Ne recrée plus** `code`/`secteur`/`creneau`/`heureDebut`/`heureFin`/`nbPersonnesRequises`.
- **`normaliserSegments(valeur)`** (interne) : coerce en tableau de **1 à 2** objets `{ heureDebut, heureFin, nbPersonnesRequises }` ; `nbPersonnesRequises` en entier ≥ 1 (défaut `1`) ; si absent/vide → **un** segment par défaut `{ heureDebut: '', heureFin: '', nbPersonnesRequises: 1 }` ; **écrête à 2 segments** (au-delà : ignorés). Ne valide **pas** la cohérence horaire (portée par le formulaire, Vuelidate §7 — même principe qu'en `0006`).
- **`estCoupee(tournee)`** → `boolean` : `tournee.segments.length === 2`.
- **`libelleType(tournee)`** → `string` : `estCoupee(tournee) ? 'Tournée coupée' : 'Tournée complète'` (affichage/repère).
- **`libelleSegment(segment)`** → `string` : `"07:00 – 13:30"` (formatage d'un segment).
- **`libelleHoraires(tournee)`** → `string` : `"07:00 – 13:30"` (complète) ou `"07:00 – 13:30 puis 17:00 – 20:00"` (coupée). Affichage réutilisable (`TourneesView`, `FormulairePreference`).
- **`effectifTotal(tournee)`** → `number` : somme des `nbPersonnesRequises` des segments (pour un résumé « N personnes / jour » facultatif).

> JSDoc : mettre à jour `@typedef {Object} Tournee` (aligné §3.1) et ajouter `@typedef {Object} Segment`. **Pas** de `validerTournee` de domaine (différé, comme `0006`).

`src/domain/planning.js` (fabrique `0011`) : **`creerAffectationManuelle(personneId, tourneeId, date, segmentIndex)`** — dernier paramètre `creneau` → `segmentIndex` (pose `origine: 'MANUEL'`). Aligné sur `creerAffectationAuto` (§5.2).

### 5.2 `src/domain/absences.js` (**ajouter la réconciliation horaire**)

Le chevauchement et les absences passent d'un test par **bucket de créneau symbolique** à un **recouvrement horaire réel**. On ajoute — sans supprimer les helpers existants (`creneauxSeChevauchent`/`periodesSeChevauchent`/`absencesSeChevauchent`, toujours utilisés par le formulaire d'absences `0007`, où les deux côtés sont des buckets) :

- **`heuresSeChevauchent(debutA, finA, debutB, finB)`** → `boolean` : recouvrement **strict** de deux plages `"HH:mm"` (`debutA < finB && debutB < finA`, comparaison lexicographique — deux plages qui se **touchent** aux bornes ne se chevauchent pas ; ex. `13:30`/`17:00` non chevauchantes). **Seule source de vérité** du recouvrement horaire réel, réutilisée par le chevauchement (segment vs segment) et par la réconciliation créneau ↔ segment.
- **`CRENEAU_PLAGES`** (constante) : plage horaire canonique de chaque bucket symbolique, autour d'un **pivot midi** documenté (convention `"13:00"`, ajustable — §12, sous-décision A) :
  - `MATIN` → `{ debut: '00:00', fin: '13:00' }`
  - `APRES_MIDI` → `{ debut: '13:00', fin: '23:59' }`
  - `JOURNEE` → `{ debut: '00:00', fin: '23:59' }`
- **`creneauChevaucheHoraires(creneau, heureDebut, heureFin)`** → `boolean` : `heuresSeChevauchent(CRENEAU_PLAGES[creneau], [heureDebut, heureFin])`. Permet de savoir si un **bucket** (absence, préférence de créneau) recouvre un **segment** (horaires réels). Ex. le segment du soir `17:00–20:00` recoupe `APRES_MIDI` ; le segment du matin `07:00–13:30` recoupe **et** `MATIN` **et** `APRES_MIDI` (il déborde le pivot).

### 5.3 Moteur — expansion, indexation, fabrique (`src/domain/scheduling/modele/`)

- **`demande.js` (`expanserDemandes`)** : pour chaque jour ouvert, pour chaque tournée applicable ce jour, **pour chaque segment `s` (0..segments.length-1)**, pour chaque `i` (0..`segment.nbPersonnesRequises`-1) → une `Demande`. **Une demande par (tournée, date, indice de segment) × effectif du segment** : chaque segment est ainsi couvrable par une personne **différente** (ADR 0017). Nouvelle forme `Demande` : `id = `${tourneeId}|${date}|${segmentIndex}|${i}``, champs `date`, `jourIso`, `tourneeId`, `segmentIndex`, `heureDebut`, `heureFin` (dénormalisés du segment, pour les tests de recouvrement sans re-lookup), `index`. **Suppression** de `creneau`.
- **`affectation.js` (`creerAffectationAuto`)** : signature `(personneId, tourneeId, date, segmentIndex)` — `creneau` → `segmentIndex`. `@typedef Affectation` mis à jour (§3.2).
- **`planning.js` (`indexer`)** : `parPersonne`, `parTournee`, `joursTravaillesParPersonne` **inchangés**. **`parCreneau`** (clé `${date}|${creneau}`) **→ `parSlot`** (clé `${tourneeId}|${date}|${segmentIndex}`), consommé par la couverture (§5.5) et le glouton. `appliquerChangement` **inchangé** (opère sur la liste plate ; indifférent au champ segmentIndex).
- **`types.js`** : mettre à jour les `@typedef` `Demande`, `Affectation`, `NonCouverture` (`creneau` → `segmentIndex` + `heureDebut`/`heureFin`), `PlanningIndexe` (`parCreneau` → `parSlot`), et ajouter le type de contrainte continuité-segments.

### 5.4 Moteur — contraintes (`src/domain/scheduling/contraintes/`)

| Fichier | Changement |
|---|---|
| `contrainteChevauchement.js` | Passe du bucket au **recouvrement horaire réel**. `autoriseAffectation` : interdit si la personne a déjà, **le même jour**, une affectation dont les horaires (résolus via `tournee.segments`) **chevauchent** ceux de la demande (`heuresSeChevauchent`). `evaluer` : signale les paires même-personne/même-jour dont les horaires se chevauchent. **Conséquence clé** : les deux segments **disjoints** d'une même tournée coupée (matin/soir) **ne se chevauchent pas** → une même personne peut couvrir les deux (cas nominal ADR 0017). Nécessite un helper local `horairesDeAffectation(affectation, entree)` (lookup `tournee.segments[segmentIndex]`). |
| `contrainteAbsence.js` | `absenceChevaucheCellule(absence, date, creneau)` → **`absenceChevaucheSegment(absence, date, heureDebut, heureFin)`** = `periodesSeChevauchent(dates)` **&&** `creneauChevaucheHoraires(absence.creneau, heureDebut, heureFin)` (§5.2). L'absence reste **grossière** (bucket), le segment est **réel**. Vaut pour `absence-validee` (dure) et `absence-demandee` (souple). Résolution des horaires : demande via `demande.heureDebut/heureFin` ; affectation via lookup tournée/segment. |
| `contrainteCouverture.js` | `calculerNonCouvertures` regroupe par **(tournée, date, segmentIndex)** (clé `${tourneeId}\|${date}\|${segmentIndex}`), compte via `parSlot`. `NonCouverture` : `creneau` → `segmentIndex` + `heureDebut`/`heureFin` (pour l'affichage `0010`). Message `SOUS_COUVERTURE` reformulé avec horaires. |
| `contrainteReposLegal.js` | **Inchangée** — déjà par date via `joursTravaillesParPersonne: Set<date>` : deux segments d'une même journée comptent déjà pour **un seul jour travaillé** (ADR 0017, aucun changement requis). **Vérifier** uniquement que rien ne référence `creneau`. |
| `contraintePreference.js` | `CRENEAU_OFF`/`INDISPO_HEBDO` : `creneauxSeChevauchent(c, demande.creneau)` → **`creneauChevaucheHoraires(c, heureDebut, heureFin)`** (bucket-préférence vs segment réel). `listerCibles` résout les horaires par lookup tournée/segment. `cibleAffectation` : `creneau` → `segmentIndex`. `PREFERENCE_TOURNEE` : **inchangée** (fondée sur `tourneeId`). `nomTourneeDe` : `tournee.nom` → **`tournee.libelle`**. |
| `contrainteEquite.js` | Logique **inchangée** (compte les affectations ; un segment = une unité). **Conséquence assumée** (ADR 0017, §12 sous-décision B) : une tournée coupée (2 segments) pèse 2× une complète — acceptable (charge réelle plus élevée). Seul le **libellé du message** évolue (« créneau(x) » → « vacation(s) »). |
| `contrainteContinuite.js` | Continuité **jour-à-jour** conservée (compare les personnes d'une tournée d'un jour ouvré au suivant, tous segments confondus — logique inchangée). Seul `nomTourneeDe` : `tournee.nom` → **`tournee.libelle`**. |
| **`contrainteContinuiteSegments.js`** (**NOUVEAU**) | Contrainte **souple globale** de **continuité intra-journée** : privilégier la **même personne** sur les 2 segments d'une **tournée coupée** le **même jour**. `coutMarginal` : si un **autre** segment de la même tournée/date est déjà couvert par une personne `P`, alors candidat `= P` → coût `0`, candidat `≠ P` → coût `poids` (neutre si aucun autre segment encore posé). `evaluer` : pour chaque tournée coupée/date dont les segments sont couverts par des **personnes disjointes**, un **avertissement** de faible pénalité (`CONTINUITE_SEGMENTS_ROMPUE`). **Aucune contrainte dure de couplage** (ADR 0017). Poids par défaut `3` (surchargeable `entree.poids.continuiteSegments`). |
| `contrainteJourOuverture.js` | `cible`/`params` : `creneau` → `segmentIndex` ; `nomTourneeDe` : `tournee.nom` → **`tournee.libelle`**. |

- **`contraintes/index.js`** : ajouter `creerContrainteContinuiteSegments(poids.continuiteSegments)` à la liste fixe ; ajouter `'CONTINUITE_SEGMENTS'` à `TYPES_CONTRAINTE` ; ajouter `continuiteSegments: 3` à `POIDS_SOUPLES_PAR_DEFAUT`.
- **`heuristiques/glouton.js`** : clé de `retirerDemandesCouvertes` `${tourneeId}|${date}|${creneau}` → `${tourneeId}|${date}|${segmentIndex}` ; `creerAffectationAuto(personneId, demande.tourneeId, demande.date, demande.segmentIndex)`.
- **`heuristiques/rechercheLocale.js`** : les « slots libres » construits depuis les `NonCouverture` portent `segmentIndex` (au lieu de `creneau`) ; `creerAffectationAuto` reçoit `segmentIndex`. **Vérifier** que les mouvements `REASSIGNER`/`ECHANGER`/`DEPLACER` recréent des affectations avec `segmentIndex`.
- **`modele/messages.js`** : reformuler les gabarits qui affichaient `libelleCreneau(...)` pour afficher les **horaires** du segment (`ABSENCE_VALIDEE`, `ABSENCE_DEMANDEE`, `CHEVAUCHEMENT`, `SOUS_COUVERTURE`, préférences de créneau) ; ajouter le gabarit `CONTINUITE_SEGMENTS_ROMPUE`. Les constraintes passent désormais `heureDebut`/`heureFin` (ou une chaîne d'horaires déjà formatée) dans `params`. Continuer de réutiliser `libelles.js`/`decrirePreference` pour le vocabulaire.
- **`diagnostiquer.js`** (`0010`) : **aucun changement de code** (il enchaîne `validerPlanning` + `calculerNonCouvertures` + `calculerScore`) — mais il **transmet** la nouvelle forme de `NonCouverture` ; vérifier la non-régression.

### 5.5 Invariants préservés

- **Déterminisme** (RNG seedé, ADR 0008) : intact. La nouvelle contrainte souple consomme le RNG dans le même ordre stable que les autres (départages via `coutMarginalAgrege`).
- **Jamais de crash** : une tournée coupée dont un segment n'est pas couvrable produit une `NonCouverture` (segment concerné) et une violation, jamais une exception.
- **Repos / jours consécutifs** : comptage par date (`Set<date>`) → deux segments un même jour = un seul jour travaillé (ADR 0017).

## 6. Composants

### 6.1 `src/components/tournees/FormulaireTournee.vue` (**réécrire les champs**)

Conserve la coquille (`ModaleBase`, sélecteur de couleur accessible, cases jours, période de validité, notes, focus/erreurs). **Changements** :

- **Retirer** : `code`, `secteur`, le `<select>` créneau, le couple `heureDebut`/`heureFin` unique, le `nbPersonnesRequises` unique.
- **Libellé** : le champ `nom` devient `libelle` (label « Nom de la tournée », inchangé pour l'utilisateur). Émet `libelle`.
- **Segments** (nouveau bloc central) :
  - **Segment 1 (toujours présent)** : « Heure de début » / « Heure de fin » + « Nombre de personnes requises ». Quand la tournée est complète, un intitulé neutre (« Horaires »).
  - **Bouton « Ajouter une reprise le soir (journée coupée) »** : ajoute un **segment 2** (bloc identique). Visible seulement s'il n'y a qu'un segment.
  - Quand 2 segments : intitulés explicites (« Le matin » / « La reprise du soir ») + **bouton « Retirer la reprise »** (revient à une tournée complète, sans confirmation — action réversible, non destructive de données persistées puisqu'on est dans un brouillon).
  - Un **repère de synthèse** discret : « Tournée coupée » quand 2 segments (icône Phosphor + libellé).
- **Aperçu** : « pastille + libellé + horaires » (via `libelleHoraires` de l'état local).
- **Émission `enregistrer`** : `{ libelle, segments: [{ heureDebut, heureFin, nbPersonnesRequises }, …], joursApplication, couleur, dateDebutValidite, dateFinValidite, notes }`.
- **État local** : `construireFormulaire()` recopie `tournee.segments` (copie profonde des objets segment, jamais muter la prop) en édition, ou `[{ heureDebut:'08:00', heureFin:'12:00', nbPersonnesRequises:1 }]` en création.

### 6.2 `src/views/TourneesView.vue` (**adapter la liste**)

- **Liste** : `tournee.libelle` (au lieu de `nom`), horaires via `libelleHoraires(tournee)`, repère **« Coupée »** (badge + libellé) si `estCoupee(tournee)`, effectif **par segment** (« Matin : 2 · Soir : 1 » pour une coupée ; « 2 personnes requises » pour une complète) via un helper de présentation, jours via `libelleJours`, période de validité via `periodeTexte`. **Retirer** l'affichage `secteur`/`code`/créneau (`creneauHoraireTexte`).
- **Getters** : consommer `actives` (renvoie tout) ; `aucuneTournee` = `actives.length === 0`.
- **Repère « Active »** : **retirer** tout badge/pastille « Active » sur les lignes de la liste principale (bruit visuel — toutes les tournées affichées le sont). **Seul** changement demandé sur l'archivage.
- **Archivage — CONSERVÉ** (`0006`) : garder l'action **« Archiver »** / **« Restaurer »** (au choix : dans un menu « … » par ligne, cohérent avec le reste de l'app), le `DialogueConfirmation` d'archivage, et un **accès aux tournées archivées** (section repliable « Tournées archivées » ou filtre). Une tournée obsolète peut donc être retirée **sans casser l'intégrité** des plannings passés (soft-delete). Ne pas réécrire cette logique : elle existe déjà en `0006`, on adapte seulement l'affichage des champs (libellé/horaires/coupée).
- Le reste (indicateur de sauvegarde, état vide accueillant, focus) : **inchangé**.

### 6.3 Souhaits (`0005`) — libellés de tournée

- `src/components/equipe/FormulairePreference.vue` : `libelleTourneeOption(tournee)` passe de `` `${tournee.nom} — ${libelleCreneau(tournee.creneau)} ${tournee.heureDebut} – ${tournee.heureFin}` `` à `` `${tournee.libelle} — ${libelleHoraires(tournee)}` `` (import de `libelleHoraires` depuis `@/domain/tournees.js`) ; `nomTourneeActiveLocale` : `tournee.nom` → `tournee.libelle`.
- `src/views/SouhaitsView.vue` : le résolveur `nomTournee(id)` renvoie `tournee.libelle` (au lieu de `tournee.nom`). `decrirePreference`/`preferences.js` : **aucun changement** (le nom de tournée arrive par le résolveur fourni).

### 6.4 Planning (`0010`/`0011`) — créneau → segment (glissement, pas refonte)

Le modèle de grille (matrice **lignes × jours**, créneau **agrégé dans la cellule**, `0010` §6.1) est **conservé**. Ce qui change : l'unité sous-journalière agrégée passe du **créneau** au **segment**, et le **mapping cellule/(tournée, date, segment)** apparaît pour l'édition.

- **`src/components/planning/GrillePlanning.vue`** :
  - `lignesTournees` : `t.nom` → `t.libelle` ; **conserver** la branche « (archivée) » (une tournée archivée mais référencée par une affectation reste affichée avec le suffixe « (archivée) », `0010` — inchangé, `archivee` conservé).
  - `construireElement` : `affectation.creneau` n'existe plus. Résoudre le segment via `tournee.segments[affectation.segmentIndex]` ; `libelleSecondaire` = horaires du segment (`libelleSegment`) — affiché en orientation **PERSONNES** (remplace `libelleCreneau`) et, pour une tournée **coupée**, en orientation **TOURNEES** (pour distinguer matin/soir). Rien de secondaire pour une complète en orientation TOURNEES (KISS).
  - `sousCouvertureCellule` : appariement par `(tourneeId, date, segmentIndex)` — une cellule coupée peut porter **plusieurs** entrées de sous-couverture (une par segment) ; les regrouper par segment (voir cellule).
  - `onAjouterIci`/`onDeposer` : l'événement `ajouter`/`deplacer` porte désormais **`segmentIndex`** (au lieu de `creneau`), résolu par la cellule/le sous-groupe ciblé.
  - `concerneeCellule` : inchangé (mapping `Violation.cible → cellule` par `tourneeId`+`date`, segment confondu au niveau cellule — le surlignage reste au grain cellule).
- **`src/components/planning/CellulePlanning.vue`** : pour une tournée **coupée**, grouper les éléments par **segment** avec un intitulé discret (« Matin 07:00–13:30 » / « Soir 17:00–20:00 ») ; un bouton **« Ajouter une personne »** et un marqueur de sous-couverture **par segment**. Pour une **complète**, présentation actuelle inchangée (un seul groupe implicite). Les événements élémentaires (`ajouter-ici`, `retirer`, `verrouiller`, glisser-déposer) portent le `segmentIndex` du sous-groupe.
- **`src/components/planning/SelecteurPersonne.vue`** : le titre affiche les **horaires du segment** au lieu de `libelleCreneau` ; le filtre « déjà présent sur ce créneau exact » devient « déjà présent sur ce **segment** exact » (`a.tourneeId === tourneeId && a.date === date && a.segmentIndex === segmentIndex`). `tourneeNom` (source) : `tournee.libelle`.
- **`src/views/PlanningView.vue`** : `slotSelection` porte `segmentIndex` (au lieu de `creneau`) ; `onAjouter({ tourneeId, date, segmentIndex })` ; le titre du sélecteur / `slotSelection.tourneeNom` = `tournee.libelle`.
- **`src/components/planning/PanneauConflits.vue`** : le résumé des tournées non couvertes affiche `tournee.libelle` + **horaires du segment** (au lieu de `libelleCreneau(nonCouverture.creneau)`), en lisant `nonCouverture.heureDebut/heureFin`. Clé d'item : `${tourneeId}-${date}-${segmentIndex}-${index}`.

> **Volume réel de changement UI planning** : ciblé (rename `nom→libelle`, `creneau→segmentIndex`, résolution d'horaires) + un **regroupement par segment dans la cellule** pour les coupées. C'est le point le plus sensible car il **recouvre `0011`** (§12).

## 7. Règles de validation

Vuelidate ([ADR 0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md)) dans `FormulaireTournee`. Messages **FR orientés correction**, après interaction / à la soumission.

| Champ | Règle | Message FR (exemple) |
|---|---|---|
| `libelle` | `required` | « Indiquez le nom de la tournée. » |
| `segments[i].heureDebut` | `required` | « Indiquez l'heure de début. » |
| `segments[i].heureFin` | `required` ; **`> heureDebut`** (chaînes `"HH:mm"`) | « L'heure de fin doit être après l'heure de début. » |
| `segments[i].nbPersonnesRequises` | `required`, `integer`, `between(1, 20)` | « Indiquez le nombre de personnes requises (entre 1 et 20). » |
| **Cohérence segment 2** (si présent) | `segments[1].heureDebut ≥ segments[0].heureFin` (la reprise commence après la fin du matin) | « La reprise du soir doit commencer après la fin de la première vacation. » |
| `joursApplication` | tableau, **≥ 1** | « Choisissez au moins un jour d'application. » |
| `couleur` | requise, hex `#RRGGBB` | « Choisissez une couleur de repère. » |
| `dateFinValidite` | facultative ; si les deux dates renseignées ⇒ `≥ dateDebutValidite` | « La date de fin doit être identique ou postérieure à la date de début. » |
| `notes` | facultatif ; `maxLength(500)` | « La note ne doit pas dépasser 500 caractères. » |

- La validation **par segment** se déclare sur un tableau (`formulaire.segments` : `$each`/collection Vuelidate, ou validations dérivées par indice — s'aligner sur le patron déjà utilisé pour les cases jours). Le **premier champ erroné** reçoit le focus (méthode existante `focusPremierChampErrone`, à étendre à l'ordre des segments).
- **Aucune validation de domaine** dupliquée : la cohérence horaire reste dans le formulaire (comme `0006`).

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Zéro jargon « segment »** : on parle de « la reprise du soir », « journée coupée », « le matin ». Le mot « segment » ne doit **jamais** apparaître à l'écran (réservé au code/JSDoc).
- **Découverte progressive** : une tournée est complète par défaut ; la journée coupée s'obtient par **un bouton explicite** (« Ajouter une reprise le soir »), réversible (« Retirer la reprise »). Pas de champ « type de tournée » à choisir — le type se **déduit** de l'action.
- **Repère « Coupée » toujours doublé d'un texte** (jamais la seule couleur/icône), dans la liste des tournées et dans la grille.
- **Horaires en clair** partout (« 07:00 – 13:30 puis 17:00 – 20:00 »), jamais de code créneau ni d'anglais.
- **Feedback & réversibilité** : indicateur « Modifications enregistrées » après chaque enregistrement ; erreurs sous le champ concerné, saisie jamais perdue ; ajout/retrait de la reprise instantané dans le formulaire.
- **Planning** : une tournée coupée reste **une seule ligne** ; les deux vacations sont lisibles à l'intérieur de la case (intitulé horaire par vacation) pour que « qui fait le matin / qui fait le soir » soit évident. Cohérence stricte avec l'existant `0010`/`0011` (mêmes gestes).
- **Migration invisible** : à la première ouverture après mise à jour, les tournées existantes s'affichent comme tournées **complètes** (un segment), sans action requise ni perte de données.

## 9. Étapes d'implémentation

> **Pré-requis absolu (§12)** : `0011` atterri sur `main`. Repartir de `main` à jour. **4 tâches**, chacune pour **un sous-agent** (`dev-front`, `model: sonnet`, effort `medium`). Ordre **strictement imposé** : **T1 → T2 → T3 → T4**. `npm run build` doit rester vert **à chaque étape** ; la **correction fonctionnelle** complète n'est atteinte qu'après T4 (refactor transverse — un état intermédiaire compile mais l'app n'est pleinement fonctionnelle qu'en fin de T4 ; c'est attendu, on valide de bout en bout à la fin).

### Tâche 1 — Modèle, migration, store, réconciliation horaire (domaine)

**Fichiers** :
- `src/domain/tournees.js` (**réécrire**) — `creerTournee` (§5.1), `normaliserSegments`, `estCoupee`, `libelleType`, `libelleSegment`, `libelleHoraires`, `effectifTotal` ; `@typedef Tournee`/`Segment`.
- `src/domain/absences.js` (**modifier**) — `heuresSeChevauchent`, `CRENEAU_PLAGES`, `creneauChevaucheHoraires` (§5.2). Conserver les helpers existants.
- `src/storage/migrations.js` (**modifier**) — `CURRENT_SCHEMA_VERSION = 2` + `MIGRATIONS[1]` (§3.3).
- `src/store/modules/tournees.js` (**vérifier / inchangé**) — getters `actives`/`archivees`, actions `archiver`/`restaurer` **conservés** ; aucun changement d'archivage (§4.1). Ne changer que si un ajustement s'avère nécessaire côté forme des objets.
- `src/domain/planning.js` (**modifier**) — `creerAffectationManuelle(..., segmentIndex)` (§5.1).

**Critères de sortie** :
- `creerTournee({ libelle:'Nord', segments:[{ heureDebut:'07:00', heureFin:'13:30', nbPersonnesRequises:2 }] })` → tournée complète : `libelle==='Nord'`, `segments.length===1`, `estCoupee()===false`, `libelleType()==='Tournée complète'`, `archivee===false` (**conservé**), pas de champ `nom`/`creneau`/`secteur`/`code`.
- `creerTournee({ segments:[{07:00-13:30, 2},{17:00-20:00, 1}] })` → `estCoupee()===true`, `libelleHoraires()==='07:00 – 13:30 puis 17:00 – 20:00'`, `effectifTotal()===3` ; un 3ᵉ segment fourni est **ignoré** (écrêtage à 2).
- `heuresSeChevauchent('07:00','13:30','17:00','20:00')===false` ; `heuresSeChevauchent('07:00','13:30','13:00','15:00')===true` ; bornes qui se touchent (`'13:30'`/`'13:30'`) → `false`.
- `creneauChevaucheHoraires('APRES_MIDI','17:00','20:00')===true` ; `creneauChevaucheHoraires('MATIN','17:00','20:00')===false` ; `creneauChevaucheHoraires('MATIN','07:00','13:30')===true`.
- **Migration** : un `SaveDocument` v1 (une tournée `{ nom, creneau, heureDebut, heureFin, nbPersonnesRequises, secteur, archivee: true, code }`, un planning avec affectations `{ creneau }`) migré via `migrate` → `schemaVersion===2`, tournée `{ libelle, segments:[{…}], archivee: true }` (**`archivee` recopié tel quel**) sans les autres champs supprimés, affectations `{ segmentIndex:0 }` sans `creneau`. Aucune perte d'`id`/`joursApplication`/`couleur`/`archivee`/dates.
- Store : `dispatch('tournees/ajouter', { libelle:'Nord', segments:[…], joursApplication:[1,2,3] })` ⇒ présente dans `getters['tournees/actives']` ; `archivees`/`archiver`/`restaurer` **toujours présents et fonctionnels** (`dispatch('tournees/archiver', id)` sort la tournée de `actives`, la place dans `archivees` ; `restaurer` inverse).
- Aucun import Vue/Vuex dans le domaine ; aucun `localStorage` ; `npm run build` réussit.

### Tâche 2 — Moteur (expansion, index, contraintes, continuité intra-journée, messages)

**Fichiers** (tous dans `src/domain/scheduling/`) : `modele/demande.js`, `modele/affectation.js`, `modele/planning.js`, `modele/types.js`, `modele/messages.js`, `contraintes/contrainteChevauchement.js`, `contraintes/contrainteAbsence.js`, `contraintes/contrainteCouverture.js`, `contraintes/contraintePreference.js`, `contraintes/contrainteJourOuverture.js`, `contraintes/contrainteContinuite.js`, `contraintes/contrainteEquite.js`, **`contraintes/contrainteContinuiteSegments.js` (créer)**, `contraintes/index.js`, `heuristiques/glouton.js`, `heuristiques/rechercheLocale.js` (§5.3/§5.4).

**Dépend de** : T1 (`creerTournee`, helpers de recouvrement horaire).

**Critères de sortie** (console, `npm run dev`, ou raisonnement d'invariant) :
- `expanserDemandes` sur une **tournée coupée** (`segments.length===2`, effectifs 2 et 1) un jour applicable produit **3** demandes ce jour (2 pour le segment 0, 1 pour le segment 1), `segmentIndex`/`heureDebut`/`heureFin` cohérents, `id` uniques.
- **Chevauchement** : une même personne peut être affectée aux **deux** segments d'une même tournée coupée le même jour (horaires disjoints → `autoriseAffectation===true`) ; deux affectations aux horaires **qui se chevauchent** (segments d'autres tournées) restent interdites/signalées.
- **Continuité intra-journée** : sur une tournée coupée, `genererPlanning` privilégie **la même personne** matin+soir quand c'est faisable (coût marginal nul) ; quand la personne du matin est indisponible l'après-midi (absence/préférence), le soir est couvert par une **autre** personne **sans erreur dure**, avec un **avertissement** `CONTINUITE_SEGMENTS_ROMPUE`.
- **Absence vs segment** : une absence `VALIDE` `APRES_MIDI` **bloque** le segment du soir `17:00–20:00` (dure) mais pas nécessairement le matin ; une absence `MATIN` bloque le segment du matin `07:00–13:30`.
- **Couverture** : `NonCouverture` produite **par segment** (`segmentIndex` + horaires) ; sous-couverture d'un segment isolée de l'autre.
- **Repos** : deux segments un même jour comptent pour **un seul** jour travaillé (`joursTravaillesParPersonne`) — inchangé.
- **Déterminisme** conservé : même seed + mêmes données ⇒ même résultat ; `genererPlanning`/`diagnostiquer` renvoient des `violations`/`tourneesNonCouvertes`/`score` cohérents entre eux.
- Messages FR affichent des **horaires** (jamais de code créneau) ; `tournee.libelle` partout. `npm run build` réussit.

### Tâche 3 — Formulaire de tournée + liste + libellés des souhaits

**Fichiers** :
- `src/components/tournees/FormulaireTournee.vue` (**modifier**) — libellé + 1→2 segments + Vuelidate (§6.1, §7).
- `src/views/TourneesView.vue` (**modifier**) — liste libellé + horaires + repère « Coupée » + effectif par segment ; retrait du repère « Active » et de l'affichage secteur/code ; **archivage (Archiver/Restaurer + accès aux archivées) conservé** (§6.2).
- `src/components/equipe/FormulairePreference.vue` (**modifier**) — `libelleTourneeOption`/`nomTourneeActiveLocale` via `libelle` + `libelleHoraires` (§6.3).
- `src/views/SouhaitsView.vue` (**modifier**) — résolveur `nomTournee` via `libelle` (§6.3).

**Dépend de** : T1 (fabrique, helpers d'affichage). N'a **pas** besoin de T2 pour compiler/afficher, mais T2 doit précéder pour que la génération reste cohérente (ordre imposé).

**Critères de sortie** :
- **Création** d'une tournée complète : un seul bloc d'horaires + effectif ; enregistrer produit `segments.length===1` ; visible dans la liste avec ses horaires.
- **Journée coupée** : « Ajouter une reprise le soir » fait apparaître un 2ᵉ bloc ; « Retirer la reprise » le supprime ; enregistrer produit `segments.length===2` ; la liste affiche le repère **« Coupée »** + les deux plages + l'effectif par vacation.
- **Édition** : les segments existants sont pré-remplis (copie, jamais mutés) ; réouverture réinitialise proprement.
- **Validation** : `heureFin > heureDebut` par segment ; reprise ≥ fin du matin ; effectif 1–20 par segment ; ≥ 1 jour ; messages FR sous les champs, focus au 1er champ erroné, saisie conservée.
- **Souhaits** : une préférence `PREFERENCE_TOURNEE` liste les tournées par **libellé + horaires** (plus de créneau) ; le résumé du souhait (`decrirePreference`) affiche le bon libellé.
- Plus de secteur/code/créneau ni de repère « Active » à l'écran ; l'**archivage reste disponible** (Archiver/Restaurer + accès aux tournées archivées, non-régression `0006`) ; `npm run build` réussit.

### Tâche 4 — Planning : grille, cellule, sélecteur, panneau, éditeur (créneau → segment)

**Fichiers** :
- `src/components/planning/GrillePlanning.vue`, `src/components/planning/CellulePlanning.vue`, `src/components/planning/SelecteurPersonne.vue`, `src/components/planning/PanneauConflits.vue`, `src/views/PlanningView.vue`, `src/store/modules/plannings.js` (**modifier** — §6.4, §4.2).

**Dépend de** : T1, T2 (moteur produit des `NonCouverture`/`Affectation` par segment), T3 (données de référence cohérentes).

**Critères de sortie** (parcours écran, `npm run dev`) :
- **Non-régression** des tournées **complètes** : affichage/édition identiques à `0010`/`0011` (une case = un groupe implicite).
- **Tournée coupée** : la case (tournée, date) présente **deux vacations** distinctes (intitulés horaires « Matin » / « Soir ») ; chaque vacation a son bouton « Ajouter une personne », son marqueur de sous-couverture, ses éléments.
- **Édition** : ajouter/retirer/verrouiller cible le **bon segment** ; le glisser-déposer d'une personne d'une vacation à l'autre (ou d'une tournée à une autre) déplace l'affectation avec le **bon `segmentIndex`** (identité/verrou préservés, `0011`). Le sélecteur masque une personne déjà présente sur **ce segment exact** et titre avec les **horaires**.
- **Diagnostics temps réel** : sous-couverture et conflits s'affichent **par segment** (panneau + surlignage) et restent cohérents grille ↔ panneau.
- **Rechargement (F5)** : les affectations (avec `segmentIndex`) demeurent ; les diagnostics sont recalculés.
- **Migration bout en bout** : une sauvegarde v1 importée (`0008`) s'ouvre en v2, les anciennes affectations tombent sur le segment 0, aucun plantage.
- Aucun accès `localStorage` direct ; aucun appel moteur hors action de store ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] Une `Tournee` porte `libelle` + `segments` (1 ou 2) ; le type complète/coupée est **dérivé** (`estCoupee`), jamais stocké ; plus de `nom`/`creneau`/`secteur`/`code`/horaires-uniques. Le soft-delete **`archivee` est conservé** (Archiver/Restaurer + accès aux archivées fonctionnels), seul le repère « Active » disparaît de la liste.
- [ ] **Migration `schemaVersion` 1 → 2** : les données existantes deviennent des tournées **à un segment**, les affectations historiques prennent `segmentIndex: 0`, sans perte ; l'import d'une sauvegarde v1 (`0008`) réussit.
- [ ] Le **formulaire** permet de créer une tournée complète, d'**ajouter une reprise le soir** (journée coupée) et de la retirer, avec effectif **par vacation** et validation FR par segment.
- [ ] Le **moteur** génère : une demande par (tournée, date, **segment**) × effectif ; les 2 segments d'une coupée peuvent être couverts par **deux personnes différentes** ; la **même personne** matin+soir est **privilégiée** (souple) mais jamais imposée (aucune contrainte dure de couplage).
- [ ] **Chevauchement** et **absences** raisonnent en **recouvrement horaire réel** entre segments (et bucket ↔ segment pour les absences), plus par égalité de créneau symbolique.
- [ ] **Repos hebdo / jours consécutifs** : deux segments un même jour = **une seule** journée travaillée (inchangé).
- [ ] **Équité** : comptage par affectation conservé (une coupée pèse ses 2 segments) — comportement documenté.
- [ ] Le **planning** affiche une tournée coupée comme **une ligne**, avec ses deux vacations lisibles ; l'édition (ajout/retrait/verrou/glisser-déposer) et la sous-couverture ciblent un **segment**.
- [ ] Aucun mot « segment »/« créneau » technique à l'écran ; horaires en clair ; repère « Coupée » doublé d'un libellé.
- [ ] `npm run build` réussit après **chacune** des 4 tâches.

## 11. Vérification

Parcours de bout en bout (`npm run dev`) :

1. **Migration** : partir d'une sauvegarde v1 (tournées + un planning). Ouvrir l'app → les tournées apparaissent comme **complètes** (un segment) ; le planning existant s'affiche (affectations sur segment 0) sans erreur. Exporter (`0008`) → `schemaVersion: 2`.
2. **Créer une tournée coupée** dans **Tournées** : horaires du matin, « Ajouter une reprise le soir », horaires du soir, effectifs distincts, jours. Vérifier le repère « Coupée » et les deux plages dans la liste ; **aucun repère « Active »** sur les lignes. Tester « Retirer la reprise » puis re-ajouter.
   - **Archivage (non-régression `0006`)** : « Archiver » une tournée → elle quitte la liste principale et se retrouve dans « Tournées archivées » ; « Restaurer » l'y ramène. Recharger (F5) : l'état d'archivage persiste ; un planning existant qui référence une tournée archivée reste résoluble (suffixe « (archivée) » dans la grille).
3. **Souhaits** : ajouter à une personne un souhait `PREFERENCE_TOURNEE` visant la tournée coupée → la liste montre libellé + horaires ; le résumé du souhait est correct.
4. **Générer** (`0010`) une semaine incluant la tournée coupée : vérifier que le matin et le soir sont couverts, idéalement par la **même personne** ; le panneau/la grille montrent les vacations par segment.
5. **Cas de partage** : poser une absence `VALIDE` l'**après-midi** pour la personne affectée le matin, régénérer → le soir est couvert par **une autre** personne, avec un **avertissement** de continuité (pas d'erreur dure).
6. **Sous-couverture** : mettre un effectif de soir supérieur au personnel disponible → « Il manque N personne(s) » **sur le segment du soir** uniquement.
7. **Éditeur** (`0011`) : en mode édition, ajouter/retirer/verrouiller une personne **sur une vacation précise** ; glisser une personne d'une vacation/tournée à l'autre (segment cible correct, verrou préservé) ; annuler (undo). Vérifier la cohérence temps réel.
8. **Repos** : vérifier qu'une personne assurant matin+soir le même jour ne déclenche pas de faux « trop de jours consécutifs ».
9. **Build** : `npm run build` après chaque tâche.

## 12. Décisions à confirmer / risques

**Coordination & séquencement (⚠️ risque majeur)** :

- **Séquencer après l'atterrissage de `0011`.** Cette feature réécrit des fichiers **au cœur** de `0009` (moteur), `0010` (grille/génération) et **`0011` (éditeur, EN COURS dans une autre session)** : `GrillePlanning.vue`, `CellulePlanning.vue`, `PlanningView.vue`, `SelecteurPersonne.vue`, `PanneauConflits.vue`, `store/modules/plannings.js`, `domain/planning.js`, et tout `src/domain/scheduling/`. Démarrer avant que `0011` soit mergé sur `main` provoquerait des **conflits de fusion majeurs** et un moteur incohérent. **Attendre `0011` sur `main`, puis repartir de `main` à jour.**
- **Refactor transverse, non partiellement livrable.** L'ordre T1→T2→T3→T4 garde `npm run build` vert, mais l'app n'est **pleinement fonctionnelle** qu'après T4. Traiter les 4 tâches comme **un seul lot** sur une branche dédiée, validé de bout en bout (§11) avant merge.

**Sous-décisions ouvertes de l'ADR 0017 (à trancher — recommandations)** :

- **A. Granularité des absences (et préférences de créneau)** — **Recommandation : garder les buckets grossiers** (`MATIN`/`APRES_MIDI`/`JOURNEE`) et **réconcilier** bucket ↔ segment via `creneauChevaucheHoraires` + un **pivot midi** (`CRENEAU_PLAGES`, convention `"13:00"`). Motif : plus simple pour un public non-technique (un congé se saisit en demi-journées, pas en heures), sans nouvel écran d'absences. **Alternative** : passer les absences aux **heures réelles** (plus cohérent avec les segments, mais UI absences plus lourde) — écartée en v1. **À confirmer**, notamment la **valeur du pivot** (13:00 vs 12:00) et l'ajout éventuel d'un bucket `SOIR` (jugé non nécessaire ici : le segment du soir tombe dans `APRES_MIDI`).
- **B. Mesure de charge pour l'équité** — **Recommandation : garder le comptage par affectation** (une tournée coupée pèse ses 2 segments). Motif : reflète une charge réelle plus élevée, aucun changement de code (seul le libellé « créneau » → « vacation » évolue). **Alternative** : pondérer par la durée horaire des segments (plus fin, mais introduit un calcul d'heures dans l'équité) — différée. **À confirmer.**

**Autres décisions** :

- **C. Soft-delete des tournées (`archivee`) — TRANCHÉE : conservé.** Décision du référent : on **garde** `archivee` (getters `actives`/`archivees`, actions `archiver`/`restaurer`, UI Archiver/Restaurer + accès aux archivées de `0006`), pour retirer une tournée obsolète **sans casser l'intégrité** des plannings passés (affectations référençant `tourneeId`). La migration **recopie** `archivee` (les archivées restent archivées). Seul changement d'affichage demandé : **retirer le repère « Active »** de la liste principale (bruit visuel — toutes les tournées affichées sont actives). Orthogonal aux segments, ripple nul sur le moteur. **Résolu.**
- **D. Suppression de `code`** — Recommandée (le libellé libre suffit, KISS). **À confirmer** ; si un code court d'affichage est souhaité, le réintroduire est trivial (champ optionnel).
- **E. Getter `tournees/actives` renvoyant tout** — Choix anti-ripple (ne casse pas `0010`/`0011`). Renommer en `tous` reste possible plus tard.
- **F. Affichage des segments dans la cellule de planning** — **Recommandation** : garder **une ligne par tournée** et **grouper par segment à l'intérieur de la cellule** (intitulés horaires) pour les coupées ; l'édition cible le segment via des sous-zones/boutons par vacation. **Alternative** : une **ligne par segment** en orientation Tournées (édition plus directe, mais change le modèle de lignes de la grille) — écartée pour rester « glissement, pas refonte ». **À confirmer** au moment de T4 avec l'état réel de `0011`.
- **G. Mise à jour de la documentation d'architecture** — `docs/architecture/02-modele-de-domaine.md` (entités `Tournee`/`Affectation`), `03-modele-de-donnees.md`, `05-moteur-de-planification.md` décrivent encore le modèle « créneau unique ». **À mettre à jour en suivi** (hors périmètre de ce plan, qui ne modifie que le code et ce fichier de feature).
