# Feature 0020 — Équipe : rythme mensuel & remplaçante rattachée

- **Statut** : À faire
- **Dépend de** : `0004` (équipe : `Personne`, `FormulairePersonne`, `EquipeView`). S'appuie aussi sur l'existant de `0008` (export/import via `migrate`), `0009`/`0016` (moteur, contrainte d'équité) et `0034` (dernière migration, v5).
- **ADR liés** : [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (nouveaux champs persistés via store + plugin uniquement), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (migration de schéma v5 → v6), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (moteur pur, calcul du rythme en module pur), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, jours ISO 1-7), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0013](../docs/adr/0013-icones-phosphor.md), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md).

## 1. Contexte & objectif

Retours de tests avec le cabinet (juillet 2026) : chaque infirmière a un **rythme** exprimé en **jours travaillés par mois** (« Claire fait 15 jours par mois »), plus parlant pour le cabinet que le pourcentage de temps de travail ; et chaque remplaçante remplace **d'abord une titulaire précise**.

`0020` :
1. ajoute à chaque personne un champ facultatif **« Rythme de travail » = `joursTravaillesParMois`** (entier 1-31), saisi dans la modale et visible sur la page Équipe ;
2. fait **consommer ce rythme par la contrainte d'équité du moteur** : une personne qui a un rythme est planifiée au plus près de ce rythme (ramené à la période planifiée, au prorata des jours d'ouverture, de sa présence et de ses absences validées) ; les personnes sans rythme gardent la règle actuelle (temps de travail en %) ;
3. permet de **rattacher une remplaçante à sa titulaire** (`titulaireId`), saisi dans la modale et affiché sur la page Équipe (dans les deux sens : « Remplace en priorité Claire Martin » / « Remplacé(e) en priorité par Léa Roux ») ;
4. migre le schéma de sauvegarde en **v6**.

**L'e-mail reste facultatif** : aucun changement (champ « Adresse e-mail (facultatif) », seul le format est contrôlé s'il est rempli). Son contrôle de présence se fera **au moment de l'envoi** (`0027`).

**Hors périmètre (frontières explicites)** :
- **`0021` — règles de remplacement** : `titulaireId` n'est **ni lu ni utilisé par le moteur** dans `0020` (aucun changement sur la façon dont une remplaçante est planifiée). Il est seulement saisi, stocké, affiché.
- **`0024` — récap mensuel** : `0020` ne crée **aucun** affichage du nombre de jours travaillés dans le planning. Elle fournit seulement la fonction pure de calcul des jours attendus (`src/domain/rythmeMensuel.js`), que `0024` réutilisera pour le passage « en rouge ».
- **`0031` — dates de présence** : `0020` tient compte de `dateEntree`/`dateSortie` **pour calculer les jours attendus** (sinon une arrivée en cours de mois serait signalée « en dessous du rythme »), mais n'ajoute **aucune** contrainte de présence au moteur.

## 2. Écrans concernés

### 2.1 Modale « Ajouter / Modifier une personne » (`FormulairePersonne`, route `/equipe`)

**a) Juste sous « Statut », visible uniquement si le statut est « Remplaçant »** :
- Liste déroulante **« Remplace en priorité (facultatif) »** (`id="personne-titulaire"`).
- Première option : « — Non précisé — » (valeur vide). Puis les **titulaires actives** de l'équipe, triées par nom puis prénom (« Claire Martin »). La personne en cours d'édition n'y figure jamais.
- Si la personne était déjà rattachée à une titulaire **archivée** ou qui **n'est plus titulaire**, cette titulaire reste proposée (et sélectionnée) avec la mention « (personne archivée) » ou « (n'est plus titulaire) » : on ne perd jamais un rattachement en silence.
- Aide (`form-text`) : « Le ou la titulaire que cette personne remplace d'habitude pendant ses absences. »
- Si aucune titulaire active n'existe : la liste ne contient que « — Non précisé — » et l'aide ajoute « Ajoutez d'abord une personne titulaire pour pouvoir la choisir ici. »
- Repasser le statut à « Titulaire » **masque** la liste sans effacer le choix du brouillon (revenir à « Remplaçant » le retrouve) ; à l'enregistrement d'une titulaire, le rattachement est vidé (`null`).

**b) Section « Temps de travail »** devient une ligne à deux colonnes (`row g-3`, `col-sm-6`) :
- à gauche : « Temps de travail » (%) — **inchangé** ;
- à droite : **« Rythme de travail (facultatif) »** : champ nombre (`id="personne-rythme"`, `min="1" max="31" step="1"`, `inputmode="numeric"`) suivi d'un suffixe `input-group-text` **« jours par mois »**, placeholder « 15 ».
- Aide sous le champ : « Nombre de jours travaillés dans un mois complet, par exemple 15. Le planning cherche à s'en approcher, en tenant compte des jours d'ouverture et des absences. Si ce champ est rempli, c'est lui qui compte pour répartir le travail (et non le pourcentage). Laissez vide si ce n'est pas fixé. »

**c) E-mail** : inchangé (toujours « (facultatif) », jamais bloquant s'il est vide).

### 2.2 Page Équipe (`/equipe`) — ligne de détails des personnes **actives**

Ligne `.equipe-details` actuelle : « Titulaire · 100 % · depuis le 01/09/2019 ». On y ajoute, dans cet ordre, après le pourcentage :
- si rythme : « · 15 jours par mois » ;
- si période : « · depuis le … » (inchangé) ;
- si remplaçante rattachée : « · Remplace en priorité Claire Martin » (+ « (personne archivée) » si la titulaire est archivée) ;
- si titulaire ayant au moins une remplaçante **active** rattachée : « · Remplacé(e) en priorité par Léa Roux » (plusieurs : « par Léa Roux et Marc Petit », « par A, B et C »).

Lignes des personnes **archivées** : inchangées (KISS).

Aucun nouveau bouton : l'en-tête et les actions de ligne (Modifier / Souhaits / Archiver) ne changent pas.

### 2.3 Planning (`/planning`) — points d'attention

Pas de nouvel écran. Deux nouvelles causes peuvent apparaître dans le panneau des points d'attention existant (groupes par cause, `LIBELLES_CAUSE_VIOLATION`) :
- « **Rythme de travail dépassé** » : « Claire Martin travaille 17 jour(s) sur cette période, plus que son rythme habituel : 15 jours par mois, soit environ 15 jour(s) attendu(s) ici. »
- « **Rythme de travail non atteint** » : « Claire Martin ne travaille que 11 jour(s) sur cette période, moins que son rythme habituel : 15 jours par mois, soit environ 15 jour(s) attendu(s) ici. »

## 3. Modèle de données touché

### 3.1 `Personne` — deux nouveaux champs persistés

| champ | type | oblig. | notes |
|---|---|---|---|
| joursTravaillesParMois | integer 1..31 \| null | non | rythme habituel en **jours travaillés par mois complet** ; `null` = pas de rythme (l'équité utilise alors `quotite`) [0020] |
| titulaireId | uuid → Personne \| null | non | titulaire remplacée **en priorité** ; renseigné **seulement si `statut = REMPLACANT`** (sinon toujours `null`) ; une seule titulaire par remplaçante, une titulaire peut avoir plusieurs remplaçantes ; jamais soi-même ; conservé si la titulaire est archivée [0020] |

Exemple (ids GUID) :

```json
{ "id": "3f1c2a9e-7b4d-4e8a-9c21-5d6f0a1b2c3d", "prenom": "Léa", "nom": "Roux",
  "statut": "REMPLACANT", "joursTravaillesParMois": null,
  "titulaireId": "89efbb0f-5e16-4188-b64b-029c88a7e1b2", "...": "..." }
```

`quotite` est **conservée** (toujours obligatoire, défaut 100) : elle reste la base de l'équité pour les personnes sans rythme.

### 3.2 Schéma de sauvegarde : v5 → **v6**

`CURRENT_SCHEMA_VERSION` passe de **5 à 6**, avec `MIGRATIONS[5]` :

```js
// Chaque personne reçoit (idempotent) :
//   joursTravaillesParMois: personne.joursTravaillesParMois ?? null
//   titulaireId:            personne.titulaireId ?? null
// tournees, absences, plannings, cabinet : inchangés.
```

- Appliquée au chargement (`storageRepository.load()`) **et** à l'import (`migrate()`) : rien à changer côté appelants.
- Export : `toSaveDocument` sérialise `personnes.items` tels quels → champs exportés sans code supplémentaire. Un fichier v7 reste refusé (garde existante).
- **Coordination** : `0023`, `0029`, `0030` prévoient aussi une migration. Si l'une d'elles a livré la v6 avant, prendre la version libre suivante (`MIGRATIONS[n]`, `n = CURRENT_SCHEMA_VERSION` courant).

### 3.3 Intégrité référentielle (`verifierIntegrite`, `src/domain/schema.js`)

Nouveau contrôle, sur le modèle de `planning.referentId` : pour chaque personne dont `titulaireId != null`, l'id doit résoudre vers une personne existante (active ou archivée). Message : « Personne « {id} » : la personne remplacée en priorité « {titulaireId} » est introuvable. » (Ne peut arriver que par un JSON modifié à la main : les personnes ne sont jamais supprimées physiquement.)

### 3.4 Structure volatile (JSDoc, jamais persistée)

```js
/**
 * @typedef {Object} AttenduRythme
 * @property {number} rythme            // joursTravaillesParMois de la personne
 * @property {number} attendu           // jours attendus sur la période (réel, prorata)
 * @property {number} attenduArrondi    // Math.round(attendu) : valeur affichée et comparée
 * @property {number} joursDisponibles  // jours ouverts de la période où la personne est présente et non absente toute la journée
 */
```

## 4. Store (Vuex)

**Aucun module, getter, mutation ni action ajouté.**

- `personnes/ajouter` → `creerPersonne` (qui normalise les deux nouveaux champs, §5.2) ; `personnes/modifier` fusionne le patch émis par le formulaire (déjà normalisé, §6.1) : aucun changement.
- `EquipeView` transmet déjà `toutesLesPersonnes` (actives + archivées) au formulaire : réutilisé pour la liste des titulaires.
- `plannings` : `assemblerEntree` transmet déjà `personnes` (actives, avec leurs champs), `absences` et `reglesCabinet` : **rien à changer**, le moteur lit `joursTravaillesParMois` sur les personnes reçues.
- Persisté : `Personne.joursTravaillesParMois`, `Personne.titulaireId`. Volatil : `AttenduRythme` (recalculé à chaque génération/validation).

## 5. Domaine (logique pure)

### 5.1 `src/domain/rythmeMensuel.js` (**créer**)

Module pur, **imports relatifs uniquement** (`./utils/dates.js`, qui n'importe rien) : il doit pouvoir être chargé par un script Node jetable, sans Vite. N'importe **pas** `absences.js` (qui importe `@/…`) : le test « date dans une absence » est une simple comparaison de chaînes.

- `export const RYTHME_MIN = 1;` `export const RYTHME_MAX = 31;`
- `export function normaliserRythmeMensuel(valeur)` → `number|null` : `''`, `null`, `undefined` → `null` ; sinon `Number(valeur)` (sans arrondi : la validation refuse les décimales).
- `export function estRythmeMensuelValide(valeur)` → `true` si la valeur normalisée est `null` **ou** un entier de `RYTHME_MIN` à `RYTHME_MAX`.
- `export function joursAttendusSurPeriode(personne, periode, { joursOuverture, absences })` → `AttenduRythme | null` :
  1. `rythme = normaliserRythmeMensuel(personne.joursTravaillesParMois)` ; `null` (ou invalide) → retourne `null`.
  2. Absences retenues : celles de **cette personne**, `statut === 'VALIDE'` **et** `creneau === 'JOURNEE'` (une demi-journée ne retire pas un jour ; une absence non validée ne compte pas — même règle que le blocage moteur).
  3. Pour chaque mois `m` touché par la période (de `dateUtil.debutMois(periode.debut)` à `periode.fin`, pas `dateUtil.moisSuivant`) :
     - `joursOuvertsMois` = nombre de jours du **mois entier** dont le jour ISO (`dateUtil.weekdayISO`) ∈ `joursOuverture` ; si `0`, mois ignoré ;
     - `jours` = jours de `[max(m, periode.debut), min(finMois(m), periode.fin)]` qui sont ouverts, dans `[dateEntree, dateSortie]` (bornes `null` = ouvertes) et non couverts par une absence retenue ;
     - `attendu += rythme × jours / joursOuvertsMois` ; `joursDisponibles += jours`.
  4. Retourne `{ rythme, attendu, attenduArrondi: Math.round(attendu), joursDisponibles }`.
- Ne lève jamais (entrées manquantes → listes vides). Aucun objet `Date` hors `dateUtil`.

**Exemples de référence** (cabinet ouvert du lundi au samedi `[1..6]`, rythme 15 ; octobre 2026 = 27 jours ouverts, novembre 2026 = 25) :

| Cas | Période | Particularité | Attendu | Arrondi |
|---|---|---|---|---|
| Mois complet | 2026-10-01 → 2026-10-31 | — | 15 × 27/27 = 15 | 15 |
| Une semaine | 2026-10-05 → 2026-10-11 | — | 15 × 6/27 ≈ 3,33 | 3 |
| Congé d'une semaine | 2026-10-01 → 2026-10-31 | absence VALIDE JOURNEE 2026-10-12 → 2026-10-17 | 15 × 21/27 ≈ 11,67 | 12 |
| À cheval sur deux mois | 2026-10-26 → 2026-11-08 | — | 15 × 6/27 + 15 × 6/25 ≈ 6,93 | 7 |
| Arrivée en cours de mois | 2026-10-01 → 2026-10-31 | `dateEntree` 2026-10-15 | 15 × 15/27 ≈ 8,33 | 8 |
| Demi-journée / absence non validée | 2026-10-01 → 2026-10-31 | absence MATIN, ou statut DEMANDE | 15 | 15 |
| Sans rythme | — | `joursTravaillesParMois: null` | `null` | — |

### 5.2 `src/domain/personnes.js` (**modifier**)

- Typedef `Personne` : `@property {(number|null)} joursTravaillesParMois` et `@property {(string|null)} titulaireId`.
- `creerPersonne` : `joursTravaillesParMois: normaliserRythmeMensuel(champs.joursTravaillesParMois)`, `titulaireId: normaliserTitulaireId(statut, champs.titulaireId)` (où `statut` est le statut final calculé).
- `export function normaliserTitulaireId(statut, titulaireId)` → `titulaireId` si `statut === 'REMPLACANT'` et chaîne non vide, sinon `null`.
- `export function optionsTitulaire(personnes, { idExclu = null, titulaireIdActuel = null } = {})` → `{ id, libelle }[]` : titulaires **actives** (`statut === 'TITULAIRE'`), hors `idExclu`, triées nom puis prénom (`localeCompare(…, 'fr')`), libellé « Prénom Nom » ; si `titulaireIdActuel` est renseigné et absent de cette liste mais résout vers une personne, l'ajouter **à la fin** avec le suffixe « (personne archivée) » (si `actif === false`) ou « (n'est plus titulaire) ».
- `export function remplacantsDe(personneId, personnes)` → personnes **actives** `REMPLACANT` dont `titulaireId === personneId`, triées nom puis prénom.
- `export function libelleRemplacement(personne, personnes)` → texte de la ligne Équipe (§2.2) : « Remplace en priorité Claire Martin » (+ « (personne archivée) ») pour une remplaçante rattachée ; « Remplacé(e) en priorité par Léa Roux et Marc Petit » pour une titulaire ayant des remplaçantes actives ; sinon `''`. Liste française « A, B et C ».
- `export function libelleRythme(personne)` → « 15 jours par mois » ou `''`.

### 5.3 Moteur — `src/domain/scheduling/contraintes/contrainteEquite.js` (**modifier**)

La contrainte souple globale `equite` (id et type inchangés) traite désormais **deux groupes** parmi les personnes actives de l'entrée :

**Groupe « sans rythme »** (`joursTravaillesParMois == null`) — **règle actuelle, inchangée** : charge = nombre d'affectations ÷ (`quotite`/100) ; moyenne calculée **sur ce groupe seulement** ; même `coutMarginal`, mêmes seuils, même violation `EQUITE_DESEQUILIBREE`. Si personne n'a de rythme, le comportement est **strictement identique** à aujourd'hui.

**Groupe « avec rythme »** — on vise les **jours attendus** (`attenduArrondi`, §5.1). L'unité est le **jour travaillé** (date distincte : les deux vacations d'une tournée coupée le même jour comptent pour **un** jour, comme `reposLegal`), lu dans `ctx.index.joursTravaillesParPersonne`.
- **Précalcul** : `creerContrainteEquite(poids, entree)` calcule une fois `attendus: Map<personneId, AttenduRythme>` via `joursAttendusSurPeriode(p, entree.periode, { joursOuverture: entree.reglesCabinet?.joursOuverture ?? [], absences: entree.absences ?? [] })` pour chaque personne active ayant un rythme (import `@/domain/rythmeMensuel.js`, comme les autres imports `@/domain/…` du moteur).
- **`coutMarginal(personneId, demande, ctx)`** pour une personne avec rythme : `0` si `demande.date` est déjà un jour travaillé de la personne ; sinon `poids × max(0, joursActuels + 1 − attenduArrondi)` (dépasser coûte, de plus en plus ; rester en dessous ne coûte rien — même logique asymétrique que la règle actuelle, qui ne pénalise que le dépassement de la moyenne).
- **`evaluer(ctx)`** ajoute, pour chaque personne avec rythme (ordre de `entree.personnes`, déterminisme) :
  - `jours > attenduArrondi` → violation `EQUITE_RYTHME_DEPASSE`, `penalite = poids × (jours − attenduArrondi)` ;
  - `jours < attenduArrondi − TOLERANCE_SOUS_RYTHME` (constante = `1` : un jour de moins est toléré) → violation `EQUITE_RYTHME_NON_ATTEINT`, `penalite = poids × (attenduArrondi − jours)` ;
  - `severite: 'avertissement'`, `contrainteId: 'equite'`, `cible: { personneId }`, `params: { personneId, jours, attendu: attenduArrondi, rythme }`.
- C'est `evaluer` (source de vérité, utilisée par la recherche locale) qui rééquilibre aussi les personnes **en dessous** de leur rythme ; le glouton, lui, les favorise naturellement (coût nul tant qu'elles n'ont pas atteint leur rythme).
- Jamais de crash : personne sans jour ouvert dans la période → `attenduArrondi = 0`, aucun « non atteint ».

### 5.4 Moteur — autres fichiers

- `src/domain/scheduling/contraintes/index.js` (**modifier**) : `creerContrainteEquite(poids.equite, entree)`.
- `src/domain/scheduling/modele/messages.js` (**modifier**) : gabarits défensifs `EQUITE_RYTHME_DEPASSE` et `EQUITE_RYTHME_NON_ATTEINT` (textes §2.3, paramètres `nomPersonne`, `jours`, `rythme`, `attendu`).
- `src/domain/libelles.js` (**modifier**) : `LIBELLES_CAUSE_VIOLATION` + `EQUITE_RYTHME_DEPASSE: 'Rythme de travail dépassé'`, `EQUITE_RYTHME_NON_ATTEINT: 'Rythme de travail non atteint'`.
- **Ne pas toucher** : `glouton.js`, `rechercheLocale.js`, `scoring.js`, `genererPlanning.js`, `validerPlanning.js`, toute autre contrainte. **Aucune lecture de `titulaireId`** dans `src/domain/scheduling/` (périmètre `0021`).

### 5.5 Réutilisé (non modifié)

`src/domain/utils/dates.js` (`dateUtil` : `debutMois`, `finMois`, `moisSuivant`, `rangeInclusive`, `weekdayISO`, `formatDateFr`), `src/domain/initialesVega.js`, `src/domain/libelles.js` (`libelleStatutPersonne`, `STATUTS_PERSONNE_OPTIONS`), `src/domain/scheduling/modele/planning.js` (`indexer`, `joursTravaillesParPersonne`).

## 6. Composants

### 6.1 `src/components/equipe/FormulairePersonne.vue` (**modifier**)

- Brouillon : `joursTravaillesParMois: personne?.joursTravaillesParMois ?? ''`, `titulaireId: personne?.titulaireId ?? ''` (création : `''`).
- `computed` `optionsTitulaire` → `optionsTitulaire(this.personnes, { idExclu: this.personne?.id ?? null, titulaireIdActuel: this.formulaire.titulaireId || null })` ; `estRemplacant` → `formulaire.statut === 'REMPLACANT'`.
- Liste « Remplace en priorité » (§2.1 a) sous Statut, `v-if="estRemplacant"`, classe `form-select formulaire-select`, `aria-describedby` vers l'aide. Pas de règle Vuelidate (choix contraint par la liste).
- Ligne « Temps de travail | Rythme de travail » (§2.1 b) ; rythme en `v-model.number`, `input-group` + « jours par mois », `aria-describedby` = aide + erreur via `describedBy`, `@blur` → `$touch()`, classes `is-invalid` sur le modèle des autres champs.
- Validation (§7) via `estRythmeMensuelValide` — **aucune borne codée en dur dans le composant**.
- `champsEnOrdre()` : insérer `{ validation: v$.formulaire.joursTravaillesParMois, id: 'personne-rythme' }` après `quotite`.
- `soumettre()` émet en plus `joursTravaillesParMois: normaliserRythmeMensuel(this.formulaire.joursTravaillesParMois)` et `titulaireId: normaliserTitulaireId(this.formulaire.statut, this.formulaire.titulaireId)`.
- Style : `.formulaire-rythme { max-width: 14rem; }` (tokens uniquement).
- Le composant reste **présentationnel** (aucun accès au store) ; la prop `personnes` existe déjà (0034).

### 6.2 `src/views/EquipeView.vue` (**modifier**)

- Ligne de détails des **actives** (§2.2) : `libelleRythme(personne)` et `libelleRemplacement(personne, toutesLesPersonnes)` insérés avec le séparateur « · », uniquement s'ils sont non vides. Aucune logique de recherche dans la vue (appels au domaine).
- Rien d'autre (en-tête, actions, archivées inchangés).

### 6.3 Réutilisé

`ModaleBase`, motif `.formulaire-erreur` + `PhWarning`, `describedBy`, `input-group` Bootstrap (déjà utilisé pour « % »), tokens `_tokens.scss` (aucun nouveau token).

## 7. Règles de validation

| Champ | Règle (Vuelidate) | Condition (domaine) | Message |
|---|---|---|---|
| Rythme de travail | `rythme` | `estRythmeMensuelValide(valeur)` | « Indiquez un nombre entier de jours entre 1 et 31, ou laissez le champ vide. » |
| Remplace en priorité | — | choix dans la liste | — |
| E-mail | `email` (inchangé) | — | inchangé ; **jamais obligatoire** |

- Champ vide → aucune erreur, enregistré `null`.
- Erreur affichée après sortie du champ ou à la tentative d'enregistrement ; focus sur le premier champ en erreur (mécanisme existant) ; brouillon conservé.
- Pas de `vue-debounce` (vérification instantanée, aucune écriture déclenchée).
- Pas de contrôle croisé rythme ↔ pourcentage (deux notions différentes, l'aide l'explique).

## 8. Points d'attention ergonomie

- **Vocabulaire du cabinet** : « Rythme de travail », « jours par mois », « Remplace en priorité », « Non précisé ». Jamais « cible », « titulaireId », « quotité » ni « équité » à l'écran.
- **Un seul champ visible quand il sert** : la liste des titulaires n'apparaît que pour une remplaçante ; basculer le statut ne fait rien perdre.
- **Aide qui dit à quoi ça sert** : le rythme indique qu'il remplace le pourcentage pour la répartition et qu'il est proratisé (ouverture, absences) — pas de surprise quand une personne en congé travaille moins.
- **Lisible des deux côtés** : la titulaire voit qui la remplace, la remplaçante voit qui elle remplace.
- **Messages moteur concrets** : nombre de jours réalisés, rythme habituel et jours attendus ici, pour que le gestionnaire comprenne d'où vient l'avertissement.
- **Honnêteté** : le rattachement n'influence pas encore le planning (`0021`) ; l'aide ne promet rien de plus que ce qu'elle fait.
- **Accessibilité** : `label` associé à chaque champ, aide et erreur reliées par `aria-describedby`, suffixe « jours par mois » visible (pas seulement en placeholder), cibles ≥ 44 px (`$cible-cliquable-min`), aucune information par la seule couleur.
- **Préférences d'en-tête** : aucun nouveau bouton ; si une action secondaire apparaissait, icône seule + infobulle à droite du titre.

## 9. Étapes d'implémentation

**3 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre : **T1 → T2 → T3** (T2 et T3 ne dépendent que de T1 ; T3 après T2 pour pouvoir saisir les rythmes à la main lors du test).

### Tâche 1 — Modèle `Personne`, calcul du rythme, migration v6, intégrité

**Fichiers** :
- `src/domain/rythmeMensuel.js` (**créer**) — §5.1.
- `src/domain/personnes.js` (**modifier**) — §5.2.
- `src/storage/migrations.js` (**modifier**) — `CURRENT_SCHEMA_VERSION = 6` ; `MIGRATIONS[5]` documentée en JSDoc sur le modèle de `MIGRATIONS[4]` (§3.2).
- `src/domain/schema.js` (**modifier**) — `verifierIntegrite` : contrôle `titulaireId` (§3.3) + JSDoc de la fonction.
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — deux lignes dans le tableau `Personne` (§3.1) ; relation `Personne 0..1─* Personne (titulaireId, remplaçante → titulaire)` ; point d'intégrité n° 3 complété (`titulaireId`).
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) — `schemaVersion` 6 (structure racine : « v6 = Personne.joursTravaillesParMois + titulaireId », exemple), champs dans la personne d'exemple (`"joursTravaillesParMois": 15, "titulaireId": null`), `CURRENT_SCHEMA_VERSION (= 6)`, paragraphe **`MIGRATIONS[5]` (v5 → v6)**, intégrité (`titulaireId`).
- `docs/architecture/06-structure-du-code.md` (**modifier**) — sous `domain/` : `rythmeMensuel.js  # jours attendus d'une personne sur une période selon son rythme mensuel [0020, réutilisé par 0024]`.

**Critères de sortie** :
- Script jetable (dossier temporaire de session, **hors dépôt**) important `src/domain/rythmeMensuel.js` par chemin absolu (`pathToFileURL`) : les 7 exemples du tableau §5.1 donnent l'attendu et l'arrondi indiqués ; `normaliserRythmeMensuel('')`/`(null)` → `null`, `('15')` → `15` ; `estRythmeMensuelValide` vrai pour `null`, `''`, `1`, `15`, `31`, faux pour `0`, `32`, `12.5`, `-3` ; personnes et absences de test avec ids GUID (`crypto.randomUUID()`).
- `src/domain/rythmeMensuel.js` n'importe que `./utils/dates.js` ; `npm run build` réussit.
- Rechargement de l'app avec des données v5 dans `localStorage` : aucune erreur ; après un geste persistant, `schemaVersion: 6` et `"joursTravaillesParMois": null`, `"titulaireId": null` sur chaque personne.
- Import d'un fichier v5 → champs à `null` ; export puis réimport d'un fichier v6 → identique ; un JSON dont un `titulaireId` pointe vers un id inconnu est refusé avec le message §3.3.

### Tâche 2 — Formulaire de personne et page Équipe

**Fichiers** :
- `src/components/equipe/FormulairePersonne.vue` (**modifier**) — §2.1, §6.1, §7.
- `src/views/EquipeView.vue` (**modifier**) — §2.2, §6.2.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) — ligne `/equipe` : « … (ajout/édition/désactivation, rythme mensuel, remplaçant(e) rattaché(e)) | `0004`, `0020` ».

**Dépend de** : T1.

**Critères de sortie** :
- Rythme « 15 » → enregistré `15`, ligne « Titulaire · 100 % · 15 jours par mois » ; vide → `null`, rien d'affiché ; « 0 », « 32 », « 12,5 » → message §7, enregistrement bloqué sans perte de saisie, focus sur le champ.
- Statut « Remplaçant » → liste visible avec les titulaires actives (sans la personne elle-même) ; choisir Claire Martin → `titulaireId` = id de Claire ; ligne de la remplaçante « Remplace en priorité Claire Martin », ligne de Claire « Remplacé(e) en priorité par Léa Roux ».
- Repasser en « Titulaire » → liste masquée ; enregistrer → `titulaireId: null`.
- Archiver Claire → la ligne de Léa affiche « … Claire Martin (personne archivée) » ; rouvrir Léa → Claire toujours sélectionnée avec la mention.
- E-mail vide → enregistrement possible (aucune régression).
- `npm run build` réussit.

### Tâche 3 — Moteur : l'équité consomme le rythme mensuel

**Fichiers** :
- `src/domain/scheduling/contraintes/contrainteEquite.js` (**modifier**) — §5.3 (en-tête du module mis à jour).
- `src/domain/scheduling/contraintes/index.js` (**modifier**) — §5.4.
- `src/domain/scheduling/modele/messages.js` (**modifier**) — §5.4.
- `src/domain/libelles.js` (**modifier**) — §5.4.
- `docs/architecture/05-moteur-de-planification.md` (**modifier**) — catalogue des souples : « `equite` (personnes **sans** rythme : écart de charge pondéré par `quotite` ; personnes **avec** `joursTravaillesParMois` : écart aux jours attendus sur la période, prorata ouverture / présence / absences validées — `domain/rythmeMensuel.js` [0020]) ».

**Dépend de** : T1 (T2 recommandé pour saisir les rythmes à la main).

**Critères de sortie** : parcours §10 « Planning » ; aucune lecture de `titulaireId` dans `src/domain/scheduling/` ; aucune modification des fichiers listés « Ne pas toucher » (§5.4) ; `npm run build` réussit.

## 10. Critères d'acceptation

**Équipe**
- [x] La modale propose « Rythme de travail (facultatif) » avec le suffixe « jours par mois » et son aide ; 15 est accepté, 0 / 32 / 12,5 sont refusés avec un message qui dit quoi faire ; vide est accepté.
- [x] La liste « Remplace en priorité (facultatif) » n'apparaît que pour une remplaçante, ne propose que les titulaires actives (jamais la personne elle-même) et « — Non précisé — ».
- [x] La page Équipe affiche « 15 jours par mois », « Remplace en priorité Claire Martin » et, côté titulaire, « Remplacé(e) en priorité par Léa Roux ».
- [x] Une titulaire archivée reste visible (avec « (personne archivée) ») dans la fiche et la ligne de sa remplaçante ; rien n'est perdu.
- [x] Une personne repassée « Titulaire » n'a plus de rattachement après enregistrement.
- [x] L'e-mail reste facultatif : une personne sans e-mail s'enregistre normalement.

**Sauvegarde**
- [x] Des données existantes (v5) se rechargent sans erreur ; l'export contient `"schemaVersion": 6`, `"joursTravaillesParMois"` et `"titulaireId"` pour chaque personne.
- [x] Importer une ancienne sauvegarde (v5 ou antérieure) fonctionne ; les nouveaux champs valent `null`.

**Planning** (cabinet ouvert du lundi au samedi, une ou deux tournées complètes, 3-4 titulaires actives)
- [x] **Sans aucun rythme saisi** : la génération se comporte comme avant (aucun message « Rythme de travail … », messages « Charge de travail mal répartie » inchangés).
- [x] Rythme 10 pour Claire, génération sur octobre 2026 complet avec assez de personnes : Claire travaille 9 ou 10 jours ; sinon un avertissement « Rythme de travail dépassé » / « non atteint » la nomme avec les bons chiffres (10 jours par mois, environ 10 attendus).
- [x] Même cas avec une absence validée « journée entière » de Claire du 12 au 17/10/2026 : les jours attendus annoncés tombent à environ 8 (10 × 21/27 ≈ 7,8).
- [x] Planning d'une semaine (05 → 11/10/2026) : jours attendus annoncés = 2 pour un rythme de 10 (10 × 6/27 ≈ 2,2).
- [x] Une tournée coupée assurée matin et soir par Claire le même jour compte pour **un** jour.
- [x] Glisser-déposer dans l'éditeur (0011) : les avertissements de rythme se mettent à jour après le dépôt.
- [x] Le rattachement d'une remplaçante ne change rien à la génération (comparer deux générations même graine, avec et sans rattachement : mêmes affectations à budget de recherche égal).
- [x] `npm run build` réussit.

## 11. Vérification

1. **Script jetable (T1)** — dans le dossier temporaire de session (**jamais dans le dépôt**), un `.mjs` qui importe `src/domain/rythmeMensuel.js` par chemin absolu et rejoue le tableau §5.1 et les cas de `estRythmeMensuelValide` ; supprimé après usage, aucune sortie collée dans le dépôt.
2. *(Facultatif, T3)* Les modules du moteur importent `@/…` : pour un contrôle hors navigateur, un script jetable peut créer un serveur Vite (`createServer` de `node_modules/vite`, `root` = projet) et charger `src/domain/scheduling/index.js` via `ssrLoadModule`, puis appeler `validerPlanning` sur une petite entrée construite à la main (ids GUID). Sinon, vérification manuelle dans l'app (étapes 4-6).
3. `npm run build`.
4. `npm run dev` → **Équipe** : créer 3 titulaires et 1 remplaçante fictives ; parcourir les critères « Équipe » (saisie, erreurs, bascule de statut, archivage / restauration de la titulaire).
5. DevTools > Application : `schemaVersion: 6`, champs présents ; export puis import → identique ; import d'un ancien export v5 (hors dépôt, s'il en existe un) → champs à `null`.
6. **Planning** : générer octobre 2026 sans rythme (référence), puis avec un rythme sur une personne, puis avec une absence validée ; lire le panneau des points d'attention ; déplacer une affectation et vérifier la mise à jour.
7. Clavier seul : bascule du statut, liste des titulaires, champ rythme, erreurs et focus ; lecteur d'écran : aide et suffixe lus.
8. Relecture `ui-ux` (libellés « Rythme de travail », « Remplace en priorité », phrases du moteur), puis audit `security` (interpolation seule, aucun `v-html` ; rien de nouveau hors `storageRepository`).

## 12. Décisions à confirmer / risques

**Décisions prises (KISS, à valider)**

1. **Une seule titulaire par remplaçante** ; une titulaire peut avoir **plusieurs** remplaçantes rattachées. Si le cabinet a besoin d'une remplaçante attitrée à deux titulaires, il faudra passer à `titulaireIds: uuid[]` (nouvelle migration, impact `0021`).
2. **Titulaire archivée** : le rattachement est **conservé** (l'archivage est réversible) et affiché avec « (personne archivée) ». Une titulaire qui devient remplaçante garde aussi ses remplaçantes rattachées (« (n'est plus titulaire) » dans la fiche) : **aucune modification en cascade** d'autres personnes. `0021` décidera quoi faire d'un rattachement vers une personne archivée.
3. **Rattachement réservé au statut « Remplaçant »** et vidé à l'enregistrement sinon.
4. **Le rythme remplace le pourcentage pour l'équité** de la personne concernée ; `quotite` reste obligatoire et sert aux personnes sans rythme. Les deux groupes sont équilibrés séparément (pas d'échelle commune sûre entre « % » et « jours par mois » sans un paramètre « jours d'un temps plein », que le cabinet n'a pas).
5. **Prorata** : jours attendus = rythme × (jours ouverts disponibles dans la période ÷ jours ouverts du mois entier), mois par mois. Ne réduisent le rythme que les absences **validées** sur la **journée entière** et les jours hors `dateEntree`/`dateSortie`. Les demi-journées ne réduisent rien.
6. **Tolérance** : dépassement signalé dès 1 jour de plus que l'attendu arrondi (cohérent avec le « rouge » de `0024`) ; « non atteint » signalé à partir de 2 jours de moins (un jour d'écart est souvent inévitable avec l'arrondi).
7. **Bornes du rythme** : entier de 1 à 31 ; pas de demi-journée (« 12,5 » refusé).
8. **Intégrité** : un `titulaireId` vers un id inconnu **bloque l'import** (cohérent avec `referentId`) ; ce cas ne peut venir que d'un JSON modifié à la main.

**Questions ouvertes**

9. Le cabinet veut-il qu'une absence réduise le rythme attendu (choix §12 n° 5) ? Si « 15 jours par mois » doit rester 15 même avec une semaine de congé, retirer l'étape 2 de `joursAttendusSurPeriode` (changement local).
10. À terme, le pourcentage « Temps de travail » doit-il disparaître au profit du seul rythme ? Hors périmètre ; à trancher après retour terrain.
11. Les libellés « Remplaçant » (statut existant) et « Remplacé(e) en priorité par » mélangent masculin et forme inclusive : à harmoniser lors de la relecture `ui-ux` (changement de libellés uniquement).

**Risques**

- **Mélange des deux groupes** : une personne avec rythme et en dessous de son attendu est préférée par le glouton à une personne sans rythme déjà au-dessus de la moyenne. C'est voulu (on cherche à tenir les rythmes) mais à observer sur des données réelles.
- **Recherche locale bornée dans le temps** (`budgetMs`) : deux générations « même graine » peuvent différer légèrement si le budget est atteint ; les comparaisons des critères §10 se font sur un petit jeu où la recherche converge avant le budget.
- **Plannings courts** (une semaine) : l'arrondi rend l'attendu grossier (3,33 → 3) ; acceptable, le récap `0024` raisonnera au mois.
- **Coordination de version** avec `0023` / `0029` / `0030` (§3.2).
- **Aucun écart d'ADR** : champs persistés via store + plugin + migration (ADR 0005/0006), calcul en module pur et moteur pur (ADR 0008), dates en chaînes et jours ISO (ADR 0010), Vuelidate (ADR 0011).
