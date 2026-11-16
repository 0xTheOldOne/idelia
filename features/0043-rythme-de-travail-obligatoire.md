# Feature 0043 — Rythme de travail obligatoire (fin du temps de travail en %)

- **Statut** : Fait
- **Dépend de** :
  - `0020` (rythme mensuel `Personne.joursTravaillesParMois`, `src/domain/rythmeMensuel.js`, équité « avec rythme ») ;
  - `0021` (titulaires d'abord, remplaçantes hors moyenne d'équité) ;
  - `0024` (récap mensuel, consommateur du rythme) ;
  - `0031` (présence, `fractionPresence`) ;
  - `0041` / `0042` (catalogue de marqueurs, Delta des modèles, documents contractuels figés).
- **ADR liés** :
  - [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS + JSDoc) ;
  - [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance via `storageRepository`, migrations) ;
  - [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (anciennes sauvegardes migrées à l'import) ;
  - [0008](../docs/adr/0008-moteur-planification-module-pur.md) (moteur pur) ;
  - [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate) ;
  - [0023](../docs/adr/0023-editeur-riche-quill.md) (Delta Quill, marqueurs).

## 1. Contexte & objectif

Demande du porteur : « Le temps de travail en % ne fonctionne pas pour une personne en libéral. Les infirmières libérales définissent un **nombre de jours travaillés par mois**. Il faut supprimer le temps de travail en %, complètement, et ne garder que le rythme de travail, qui devient obligatoire. »

Résultat attendu :

- `Personne.quotite` **disparaît partout** : modèle, formulaire, affichages, moteur, import, marqueurs de contrats, documentation d'architecture.
- `Personne.joursTravaillesParMois` devient **obligatoire** pour **toute** personne, titulaire comme remplaçante : entier de 1 à 31.
- Les données existantes (navigateur et anciennes sauvegardes JSON) sont **migrées** en v14 :
  - une personne sans rythme reçoit un rythme **proposé**, calculé de façon déterministe depuis son ancien pourcentage ;
  - l'utilisatrice en est **prévenue une fois**, avec les noms concernés.
- L'équité du moteur ne connaît plus qu'une règle : **chacun vise son rythme**.

**Hors périmètre** :

- réécrire le texte déjà rédigé des documents contractuels (brouillons ou signés, §3.3) ;
- rééquilibrage proportionnel sous le rythme (§12 n° 3) ;
- renommer le bloc « Rythme de travail » de la page Cabinet (§12 n° 7) ;
- réécrire les anciens plans `features/*.md`, qui restent historiques.

## 2. Écrans concernés

| Route | Écran | Changement |
|---|---|---|
| `/equipe` | **Équipe** → `EquipeView.vue` + modale `FormulairePersonne.vue` | Le champ « Temps de travail (%) » est **supprimé**. Le champ « Rythme de travail » devient **obligatoire** (plus de « facultatif »). Les lignes affichent « Titulaire · 15 jours par mois » au lieu de « Titulaire · 100 % · 15 jours par mois ». |
| `/souhaits/:id` | **Souhaits** → `SouhaitsView.vue` | Rappel sous le titre : « Titulaire · 15 jours par mois » au lieu de « Titulaire · 100 % ». |
| `/modeles-contrats/:id` | Éditeur de modèle (menu « Insérer un champ ») | « Quotité de travail » est remplacé par « Rythme de travail (jours par mois) ». Les pastilles déjà posées sont converties par la migration. |
| (démarrage, import) | Toast | Avertissement unique : un rythme a été proposé pour telle et telle personne, à vérifier dans Équipe. |
| `/planning` (points d'attention, récap) | Inchangés à l'écran | La cause « Charge de travail mal répartie » disparaît. Les remplaçantes affichent désormais un rythme dans le récap. |

### 2.1 Parcours visé (utilisatrice peu à l'aise avec l'informatique)

1. Elle ouvre Idelia après la mise à jour. Un toast d'avertissement, qui reste affiché jusqu'à ce qu'elle le ferme, indique : « Le temps de travail en pourcentage n'existe plus : chaque personne a maintenant un nombre de jours travaillés par mois. Vérifiez dans le menu Équipe le nombre de jours calculé pour Léa Roux, Marc Petit, Sophie Durand et Inès Bernard, d'après leur ancien pourcentage. »
2. Dans **Équipe**, chaque ligne affiche le statut et le rythme, par exemple « Remplaçant(e) · 22 jours par mois ». Elle corrige Léa en ouvrant sa fiche et en saisissant 8.
3. Elle ajoute une nouvelle personne et oublie le rythme. En cliquant « Enregistrer », le formulaire place le curseur sur le champ, qui affiche « Indiquez le nombre de jours travaillés par mois, par exemple 15. »

```
Rythme de travail
[ 15        ] jours par mois
Nombre de jours travaillés dans un mois complet, par exemple 15. Le planning cherche
à s'en approcher, en tenant compte des jours d'ouverture du cabinet et des absences.
```

## 3. Modèle de données touché

### 3.1 `Personne`

| Champ | Avant | Après |
|---|---|---|
| `quotite` | `number` 0..100, défaut 100 | **supprimé** |
| `joursTravaillesParMois` | `integer 1..31 \| null`, facultatif | **`integer 1..31`, obligatoire** (saisie, fabrique, import) |

### 3.2 Migration de schéma v13 → v14 (`MIGRATIONS[13]`)

`CURRENT_SCHEMA_VERSION` passe de **13 à 14**.

`preparerDocument` valide le document **après** l'avoir migré. La migration doit donc être **totale** : le moindre reste rendrait un fichier invalide. Conséquences d'un reste :

- au démarrage, `bootstrap` tombe en `ERREUR_CHARGEMENT` et l'application affiche un état vide ;
- à l'import, le fichier est refusé.

La migration est idempotente. Un élément non objet est laissé tel quel, `verifierStructure` le rejettera (motif des migrations existantes).

**a) Personnes** (actives **et** archivées) :

- `joursTravaillesParMois` est **conservé** s'il est un entier de 1 à 31 (`Number.isInteger`).
- **Sinon**, il est remplacé par `rythmeDepuisQuotite(personne.quotite, doc.cabinet)` (§5.1). Cela couvre :
  - `null` ou absent ;
  - `0` (l'ancienne règle d'import tolérait `min: 0`) ;
  - un décimal comme `12.5` (l'import tolérait `type: 'nombre'`) ;
  - une valeur au-delà de 31, ou non numérique.
- `quotite` est **retiré** de l'objet.

**Règle du rythme proposé** (déterministe, pure) :

```
J = nombre de jours distincts valides (entiers 1..7) dans cabinet.joursOuverture
r = cabinet.reposHebdoMin s'il est un entier de 0 à 7, sinon 0
joursParSemaine = min(J, 7 − r) ; si joursParSemaine < 1 (cabinet absent, aucun jour) → 5
q = quotite si nombre fini, borné à [0, 100] ; sinon 100   (l'ancien import tolérait jusqu'à 1000)
rythme = borne(arrondi(q / 100 × joursParSemaine × 52 / 12), 1, 31)
```

Justification :

- **L'ancienne quotité est conservée en proportion** : 80 % donne 80 % du rythme d'un temps plein.
- **Le temps plein est celui du cabinet** :
  - `52 / 12` ≈ 4,33 semaines par mois moyen ;
  - une personne ne peut pas travailler plus de jours par semaine que le cabinet n'est ouvert ;
  - elle ne peut pas non plus dépasser `7 − reposHebdoMin` jours, règle dure du moteur. Sans ce plafond, un cabinet ouvert 7 jours sur 7 proposerait 30 jours par mois, valeur irréaliste.
- **Déterministe** : même fichier, même résultat. Aucun `Date`, aucun aléa.
- Le **repli à 5 jours par semaine** ne sert que pour un cabinet sans jour d'ouverture valide (donnée corrompue).

Valeurs attendues (à contrôler en recette) :

| Fichier | Cabinet | Personne | Résultat |
|---|---|---|---|
| `files/idelia-sermet.json` (v13) | 7 j/7, repos 2 → 5 j/sem. | 2 titulaires avec rythme 15 et 11 | **15** et **11** (conservés) |
| idem | idem | 4 remplaçantes `null`, 100 % | **22** chacune (`round(21,67)`) |
| `files/sauvegarde-test-4-personnes.json` (v4) | 7 j/7, repos 2 → 5 j/sem. | 100 %, 100 %, 80 %, 100 % (aucun rythme) | **22, 22, 17, 22** |
| Cabinet du lundi au vendredi, repos 2 | 5 j/sem. | 50 % | **11** (`round(10,83)`) |

**b) Modèles de contrats** (`modelesContrats[].contenu.ops`) :

- Chaque embed `{ marqueur: { cle: 'personne.quotite' } }` devient `{ marqueur: { cle: 'personne.joursTravaillesParMois' } }`.
- Les attributs de mise en forme sont conservés.
- `updatedAt` reste inchangé : la migration est technique, pas une modification de l'utilisatrice.
- Sans cette réécriture, la clé retirée du catalogue rendrait `estCleMarqueurValide` faux. Le contrôleur `delta` refuserait alors tout le fichier.

**c) Documents contractuels** (`documentsContrats[]`) :

- `contenu.ops` : même réécriture des embeds. Défense en profondeur : l'invariant de `0042` veut qu'un document n'ait **aucun** embed, mais le contrôleur `delta` en accepte à l'import.
- `valeursSaisies[].cle === 'personne.quotite'` devient `'personne.joursTravaillesParMois'`. `libelle`, `type` et `valeur` sont **conservés tels quels** (copie figée). Cette entrée n'existe que si la fiche n'avait pas de quotité à la génération (cas rare), mais elle ferait échouer le contrôleur `cleMarqueur` (`validationImport.js` l. 340).
- **Le texte n'est jamais réécrit**, ni pour un brouillon ni pour un document signé (§3.3).

**d) Reste du document** : inchangé (tournées, absences, plannings, cabinet, cache des vacances).

La correspondance des clés renommées vit à un **seul** endroit : `CLES_MARQUEURS_RENOMMEES` dans `catalogueMarqueurs.js` (§5.3). La migration l'importe.

### 3.3 Documents contractuels déjà rédigés : on ne touche pas au texte

Par construction (`0042` §5.1), un document est une **copie figée** : chaque marqueur a été remplacé par **du texte** à la génération. Un contrat généré avec « Quotité de travail » contient donc la chaîne « 100 % », et plus aucune trace de `{{personne.quotite}}`.

- **Document signé** : le texte reste **intact**. C'est la copie de ce qui a été signé sur papier. Le modifier, même pour une seule chaîne, trahirait le principe « signé = figé » de `0042` (lecture seule, en-tête figé) et ne pourrait de toute façon pas cibler la valeur de façon fiable.
- **Brouillon** : même règle. Le texte « 100 % » reste. L'utilisatrice peut le corriger à la main dans la feuille, puisque le brouillon est modifiable.
- **Modèles** : seule la **pastille** change de clé (§3.2 b). Le texte qui l'entoure, par exemple « quotité de travail de », est du texte libre qu'aucune migration ne peut corriger. Il pourra se lire « quotité de travail de 22 jours par mois » (§12 n° 4).

### 3.4 Autres impacts

- `schema.js` / `normaliserPersonneChargee` : retire une clé `quotite` résiduelle. Cas visés : un fichier v14 édité à la main, ou une fiche réenregistrée entre deux tâches de développement. Aucune erreur levée.
- Volumétrie : un champ en moins par personne, négligeable.

## 4. Store (Vuex)

- **`src/storage/migrations.js` / `preparerDocument`** :
  - en cas de succès, renvoie aussi `rythmesProposes: string[]`, les noms complets (« Prénom Nom ») des personnes **actives** dont le rythme a été proposé par la migration ;
  - la liste est calculée sur le document **brut**, avant migration, quand `brut.schemaVersion < 14` : `personnesSansRythmeValide(brut.personnes)` (§5.1) ;
  - `prenom` et `nom` ne sont touchés par aucune migration ;
  - liste vide pour un fichier v14 ou si tout le monde avait déjà un rythme valide.
- **`src/store/index.js`** :
  - **`importer`** : après `REPLACE_ALL` et `flushImmediat`, si `rythmesProposes.length > 0`, toast `avertissement`, `duree: 0` (fermeture manuelle), message `messageRythmesProposes(noms)` (§5.1). Même motif que le toast du logo non repris (`0039`).
  - **`bootstrap`** (signature `{ commit, dispatch, state }`) : si `rythmesProposes.length > 0` :
    1. `modifieDepuisEcritureFichier = true` ;
    2. `await flushImmediat({ state, commit })`. Le stockage passe ainsi tout de suite en v14 et le toast n'apparaît **qu'une fois**. Sans ce flush, `REPLACE_ALL` n'est pas persisté et le toast reviendrait à chaque ouverture jusqu'à la première modification ;
    3. le même toast.
  - Un échec du flush ne bloque pas le démarrage : erreur capturée, toast quand même. Le stockage sera écrit à la prochaine modification.
- **`src/store/modules/personnes.js`** : **aucune modification**. `creerPersonne` reçoit les champs du formulaire, et `modifier` fusionne un patch qui ne contient plus `quotite`.
- Aucun état volatil nouveau. La notification passe par le module `notifications`, jamais persisté.

## 5. Domaine (logique pure)

### 5.1 `src/domain/rythmeMensuel.js` (**modifier**)

Le module reste pur, avec des imports relatifs uniquement (chargeable par Node).

```js
/** Semaines dans un mois moyen (52 / 12). */
export const SEMAINES_PAR_MOIS = 52 / 12;

/**
 * Rythme valide : entier de RYTHME_MIN à RYTHME_MAX. `null`, '' et undefined sont désormais INVALIDES (0043).
 * @param {*} valeur
 * @returns {boolean}
 */
export function estRythmeMensuelValide(valeur) {}

/**
 * Rythme proposé à la migration v14 depuis l'ancienne quotité (§3.2 de 0043).
 * @param {*} quotite - Ancienne quotité (0..100 attendu, tolère tout).
 * @param {{ joursOuverture?: *, reposHebdoMin?: * } | null | undefined} cabinet
 * @returns {number} Entier de 1 à 31.
 */
export function rythmeDepuisQuotite(quotite, cabinet) {}

/**
 * Noms complets des personnes ACTIVES (objets, `actif !== false`) dont le rythme n'est pas valide.
 * Lit un document brut (n'importe quelle version) : jamais d'exception.
 * @param {*} personnes
 * @returns {string[]}
 */
export function personnesSansRythmeValide(personnes) {}

/**
 * Texte du toast (§8). 5 noms au plus, puis « et N autres personnes ».
 * @param {string[]} noms
 * @returns {string} '' si la liste est vide.
 */
export function messageRythmesProposes(noms) {}

/**
 * « 15 jours par mois », « 1 jour par mois » ; '' si le rythme n'est pas valide.
 * @param {*} valeur
 * @returns {string}
 */
export function libelleRythmeMensuel(valeur) {}
```

- `normaliserRythmeMensuel` est **inchangé** : il renvoie toujours `null` pour une saisie vide. C'est la validation qui refuse.
- `joursAttendusSurPeriode` est **inchangé** : il teste déjà `null` avant `estRythmeMensuelValide`. Mettre à jour sa JSDoc : `null` ne peut plus venir que d'une donnée invalide.
- Mettre à jour la JSDoc d'en-tête : rythme obligatoire (0043).

`libelleRythmeMensuel` vit **ici**, et non dans `personnes.js`, pour éviter un cycle d'imports `schema.js` → `contrats/*` → `personnes.js` → `schema.js`. Il est utilisé par `marqueurs.js` (§5.3).

### 5.2 `src/domain/personnes.js` (**modifier**)

- Typedef `Personne` :
  - **supprimer** `@property {number} quotite` ;
  - `joursTravaillesParMois` devient `@property {number} joursTravaillesParMois - Rythme : jours travaillés par mois complet, entier 1..31, obligatoire (0020, 0043).`
- `creerPersonne` : **supprimer** `quotite: champs.quotite ?? 100`. `joursTravaillesParMois` reste `normaliserRythmeMensuel(...)`. La fabrique fait confiance à l'appelant, comme pour `statut`, et n'invente aucune valeur par défaut.
- `libelleRythme(personne)` délègue à `libelleRythmeMensuel(personne?.joursTravaillesParMois)`, avec le même résultat qu'aujourd'hui. Mettre à jour sa JSDoc : `''` seulement sur une donnée invalide.

### 5.3 `src/domain/contrats/` (**modifier**)

- **`catalogueMarqueurs.js`** :
  - dans le groupe `PERSONNE`, remplacer `m('personne.quotite', 'Quotité de travail')` par `m('personne.joursTravaillesParMois', 'Rythme de travail (jours par mois)')`, au même rang ;
  - ajouter et exporter la correspondance utilisée par la migration :
    ```js
    /** Clés retirées du catalogue → clé de remplacement (migrations de schéma). */
    export const CLES_MARQUEURS_RENOMMEES = Object.freeze({ 'personne.quotite': 'personne.joursTravaillesParMois' });
    ```
- **`marqueurs.js`** / `valeurPersonne` :
  - supprimer `case 'quotite'` ;
  - ajouter `case 'joursTravaillesParMois': return texte(libelleRythmeMensuel(p.joursTravaillesParMois));`, qui donne « 15 jours par mois » ou `null` si invalide (marqueur alors non résolu, demandé à la génération) ;
  - la fonction `pourcentage` reste utilisée par `tauxRetrocession`.
- **`delta.js`** : nouvelle fonction pure.
  ```js
  /**
   * Nouveau Delta où chaque embed `marqueur` dont la clé figure dans `correspondance` reçoit la nouvelle clé
   * (attributs conservés). Toute autre op est recopiée. Tolérant : entrée non conforme → renvoyée telle quelle.
   * @param {*} delta
   * @param {Readonly<Record<string, string>>} correspondance
   * @returns {*}
   */
  export function renommerMarqueurs(delta, correspondance) {}
  ```
- `collage.js` : **aucune modification**. Coller `{{personne.quotite}}` laisse ce texte tel quel et affiche l'avertissement « champ inconnu » existant.

### 5.4 Moteur : `src/domain/scheduling/contraintes/contrainteEquite.js` (**modifier**)

**Comportement tranché** : il n'existe plus qu'**un** groupe, celui des personnes avec rythme, c'est-à-dire tout le monde. La règle « avec rythme » de `0020` / `0021` s'applique **sans changement** :

- **Coût marginal** :
  - `poids × max(0, jours + 1 − attenduArrondi)` pour un jour **nouveau** ;
  - `0` si la personne travaille déjà ce jour-là ;
  - `0` sous l'attendu.
- **Évaluation** :
  - `EQUITE_RYTHME_DEPASSE` dès que les jours travaillés dépassent l'attendu ;
  - `EQUITE_RYTHME_NON_ATTEINT` à partir de 2 jours sous l'attendu, pour les **titulaires seulement**. Les remplaçantes n'ont jamais de « non atteint » (`0021`, inchangé).
- **Attendu** : `joursAttendusSurPeriode`, au prorata des jours d'ouverture, de la présence (`0031`) et des absences validées sur la journée entière.
- **Défense** : une personne dont `attendus` n'a pas d'entrée (rythme invalide malgré l'import) coûte `0` et n'est jamais signalée.

À supprimer (code mort une fois le groupe « sans rythme » retiré) :

- `aUnRythme`, `chargeNormalisee`, `chargesDeLequipe`, `moyenne` ;
- `SEUIL_ECART_MIN`, `SEUIL_ECART_RATIO` ;
- la map `fractions` et son précalcul ;
- les branches « sans rythme » de `coutMarginal` et `evaluer` ;
- les imports devenus inutiles (`fractionPresence`, `dateUtil` s'il n'est plus utilisé).

Réécrire la JSDoc d'en-tête et celle de `creerContrainteEquite`.

Conséquences, à documenter dans `05-moteur-de-planification.md` (T5) :

1. **Titulaires qui avaient déjà un rythme** (cas de `idelia-sermet.json`) : **aucun changement**.
2. **Titulaires sans rythme** dans d'anciennes données : elles passent de « équilibrage à la moyenne pondérée par la quotité » à « viser le rythme proposé ». Sous leur rythme, l'équité ne les départage plus. Ce sont les autres contraintes souples qui décident : continuité, souhaits, titulaires d'abord, trame weekend.
3. **Remplaçantes sans rythme** :
   - elles ne coûtaient rien à l'équité ;
   - elles ont maintenant un **plafond** (22 jours par mois pour sermet), au-delà duquel le moteur préfère une autre personne et signale « Rythme de travail dépassé » ;
   - en dessous, rien ne change.
4. Le code `EQUITE_DESEQUILIBREE` n'est plus jamais produit.

`src/domain/scheduling/contraintes/index.js` est **inchangé** : il passe déjà `entree` à `creerContrainteEquite`, seul appelant.

### 5.5 Messages et libellés du moteur (**modifier**)

- `src/domain/scheduling/modele/messages.js` : supprimer `EQUITE_DESEQUILIBREE`.
- `src/domain/libelles.js` / `LIBELLES_CAUSE_VIOLATION` : supprimer `EQUITE_DESEQUILIBREE`.
- Les violations ne sont **pas persistées** (recalculées). Ni `schema.js` ni les fichiers de `files/` ne contiennent ce code (vérifié). Aucun planning stocké ne peut donc le référencer.

### 5.6 `src/domain/presence.js` (**modifier**)

- `fractionPresence` n'a plus d'appelant (seul `contrainteEquite.js` l'utilisait) : la **supprimer**.
- Revérifier par une recherche avant suppression.
- Mettre à jour les mentions dans la doc (T5).

### 5.7 `src/domain/recapMensuel.js` (**JSDoc seulement**)

- Aucune modification fonctionnelle.
- L'état `SANS_RYTHME` (« Pas de rythme fixé ») **reste**. Il sert encore pour une ligne « Personne inconnue » (affectation dont la personne a disparu) et pour une donnée invalide.
- Préciser ces deux cas dans la JSDoc de `EtatRythme`.

### 5.8 Import : `src/domain/validationImport.js` et `src/domain/schema.js` (**modifier**)

- `REGLES_PERSONNE` :
  - **supprimer** `quotite` (une clé inconnue reste tolérée) ;
  - `joursTravaillesParMois: { type: 'entier', min: 1, max: 31, requis: true }`. `controlerChamps` traite `null` et `undefined` comme **manquants** quand `requis` est posé (l. 122-124) : un fichier v14 sans rythme est refusé avec « … : le champ « joursTravaillesParMois » est manquant. ».
- `schema.js` / `normaliserPersonneChargee` : `const { quotite, ...reste } = p ?? {}` puis normalisations existantes sur `reste` (§3.4).

## 6. Composants

| Fichier | Type | Changement |
|---|---|---|
| `src/components/equipe/FormulairePersonne.vue` | **modifier** | Voir le détail ci-dessous. |
| `src/views/EquipeView.vue` | **modifier** | Voir le détail ci-dessous. |
| `src/views/SouhaitsView.vue` | **modifier** | Voir le détail ci-dessous. |

**`FormulairePersonne.vue`**

- **Supprimer** :
  - le bloc « Temps de travail » (`#personne-quotite`, l. 255-283) ;
  - la règle `quotite` (l. 774-787) ;
  - `quotite` dans `construireFormulaire` (l. 866 et 889) ;
  - l'entrée de `champsEnOrdre` (l. 1040) ;
  - `quotite` dans le payload de `soumettre` (l. 1084) ;
  - le style `.formulaire-quotite` (l. 1123-1125) ;
  - les imports `integer` et `between` de `@vuelidate/validators`, utilisés seulement par la quotité.
- **Champ rythme** :
  - libellé « Rythme de travail », sans « (facultatif) » ;
  - attribut `required` et `aria-required="true"` sur l'input ;
  - aide réécrite (§8), sans « et non le pourcentage » ni « Laissez vide… » ;
  - en création, valeur `''` (champ vide, placeholder « 15 ») ;
  - le commentaire `<!-- Temps de travail -->` devient `<!-- Rythme de travail -->` ;
  - la rangée ne contient plus que ce champ (`col-sm-6`).
- **Règles Vuelidate** : `required` puis `rythme` (§7).

**`EquipeView.vue`**

- Ligne active (l. 63) : supprimer seulement « `· {{ personne.quotite }} %` ». La ligne 64 affiche **déjà** `libelleRythme` après le statut : ne **pas** ajouter un second rythme.
- Ligne archivée (l. 159) : `{{ libelleStatutPersonne(personne.statut) }}` suivi de `<template v-if="libelleRythme(personne)"> · {{ libelleRythme(personne) }}</template>`.
- Le JSDoc d'en-tête mentionne `0043`.

**`SouhaitsView.vue`**

- Rappel (l. 34) : même gabarit que la ligne archivée d'Équipe.
- Importer `libelleRythme` depuis `@/domain/personnes.js` et l'exposer dans `methods`, comme `EquipeView`.

Réutilisés sans modification : `ModaleBase`, `PileNotifications`, `RecapMensuel.vue`, `EditeurRiche.vue`, `MenuInsererChamp` (lit le catalogue, le nouveau libellé apparaît tout seul).

## 7. Règles de validation

| Champ | Règle | Message (FR) |
|---|---|---|
| Rythme de travail | requis (`required`) | « Indiquez le nombre de jours travaillés par mois, par exemple 15. » |
| Rythme de travail | `estRythmeMensuelValide` : entier de 1 à 31 | « Indiquez un nombre entier de jours entre 1 et 31. » |

- Ordre : `required` d'abord. Un champ vide n'affiche que le premier message (`$errors[0]`).
- Affichage après sortie du champ (`$touch` au `blur`) ou à la tentative d'enregistrement. Jamais à l'ouverture d'un formulaire vierge.
- Une soumission invalide place le focus sur le champ : l'entrée `champsEnOrdre` existante (`personne-rythme`) est conservée.
- Import JSON : §5.8.

## 8. Points d'attention ergonomie

- **Aide du champ**, sans jargon : « Nombre de jours travaillés dans un mois complet, par exemple 15. Le planning cherche à s'en approcher, en tenant compte des jours d'ouverture du cabinet et des absences. »
- **Aucune valeur par défaut en création** : le rythme doit être un choix conscient. Le placeholder « 15 » sert d'exemple, et un oubli donne un message clair avec le focus sur le champ (§12 n° 8).
- **Toast de migration** :
  - type avertissement, fermeture manuelle uniquement (`duree: 0`) ;
  - une seule fois (flush au démarrage) ;
  - au plus 5 noms, puis « et N autres personnes » ;
  - texte (révisé après relecture `ui-ux`, plus actionnable) : « Le temps de travail en pourcentage n'existe plus : chaque personne a maintenant un nombre de jours travaillés par mois. Vérifiez dans le menu Équipe le nombre de jours calculé pour {noms}, d'après leur ancien pourcentage. »
  - aide du champ complétée d'un repère de conversion : « Pour un temps plein, comptez environ 21 à 22 jours. » ; placeholder « ex. 15 ».
  - pour une seule personne : « … pour Léa Roux, d'après son ancien pourcentage : vérifiez-le dans Équipe. »
- **Texte complet plutôt qu'abréviation** : « 15 jours par mois », pas « 15 j/mois ». Ce libellé existe déjà (`libelleRythme`) et est lisible par le public cible (§12 n° 2).
- **Mots du métier** : « Rythme de travail », « jours par mois ». Ne plus jamais afficher « quotité », « temps de travail » ou « % » à propos d'une personne. Le « % » reste pour la **rétrocession**, qui est bien un pourcentage.
- **Accessibilité** : champ requis annoncé (`required`, `aria-required`), erreur reliée par `aria-describedby` (mécanisme `describedBy` existant).

## 9. Étapes d'implémentation

Cinq tâches de code et une étape préalable sans code. Chaque tâche de code est confiée à **un sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)).

- Ordre : **T0 → T1 → T2 → T3 → T4 → T5**.
- **Un seul commit pour la feature**, après la recette.
- Contexte à transmettre à chaque sous-agent :
  - règles d'or n° 2, 3, 5, 7, 8, 9, 10, 12 ;
  - ce plan ;
  - les extraits utiles de `0020` (rythme, équité « avec rythme »), `0021` (remplaçantes) et `0042` §5.1 (documents sans embed) ;
  - mémoire projet : **IDs = GUID partout**, y compris dans les jeux de test fabriqués ;
  - **ne jamais écraser `files/idelia-sermet.json`** (lecture seule).
- **T1 regroupe catalogue et migration exprès** : retirer `personne.quotite` du catalogue sans la migration rendrait invalide un `localStorage` contenant cette pastille. L'application ne démarrerait plus entre deux tâches.

### Tâche 0 — Relevé de référence du moteur (orchestrateur, aucun code)

Avant toute modification, sur la version actuelle :

1. `npm run dev` (port 5199).
2. Importer `files/idelia-sermet.json`.
3. Générer un planning sur **2026-12-01 → 2026-12-31**, puis **le conserver** dans le stockage. Après passage sur la branche de la feature, il sera régénéré en mode reproductible (même graine) pour la comparaison.
4. Noter :
   - le nombre de points d'attention par code `EQUITE_*` ;
   - le récap mensuel de décembre (jours travaillés par personne).
5. Garder ce relevé pour la comparaison §11 n° 9.

### Tâche 1 — Données : rythme obligatoire, migration v14, import, marqueurs

**Fichiers** :

- `src/domain/rythmeMensuel.js` (**modifier**) : §5.1.
- `src/domain/personnes.js` (**modifier**) : §5.2.
- `src/domain/contrats/catalogueMarqueurs.js`, `src/domain/contrats/marqueurs.js`, `src/domain/contrats/delta.js` (**modifier**) : §5.3.
- `src/storage/migrations.js` (**modifier**) :
  - `CURRENT_SCHEMA_VERSION = 14` ;
  - `MIGRATIONS[13]` (§3.2), avec une JSDoc au format des migrations existantes ;
  - `preparerDocument` renvoie `rythmesProposes` (§4).
- `src/domain/validationImport.js` (**modifier**) : §5.8.
- `src/domain/schema.js` (**modifier**) : `normaliserPersonneChargee` (§3.4).

**Critères de sortie** (console du navigateur, `npm run dev`) :

- `rythmeDepuisQuotite` :
  - `(100, { joursOuverture: [1,2,3,4,5,6,7], reposHebdoMin: 2 })` → 22 ;
  - `(80, idem)` → 17 ;
  - `(50, { joursOuverture: [1,2,3,4,5], reposHebdoMin: 2 })` → 11 ;
  - `(100, null)` → 22 (repli 5 jours) ;
  - `(0, idem)` → 1 ;
  - `(1000, { joursOuverture: [1,2,3,4,5,6,7], reposHebdoMin: 0 })` → 30 ;
  - `('abc', idem)` → valeur du 100 %.
- `estRythmeMensuelValide` : `null`, `''`, `0`, `12.5` et `32` → `false` ; `1`, `15` et `31` → `true`.
- `libelleRythmeMensuel(1)` → « 1 jour par mois » ; `(15)` → « 15 jours par mois » ; `(null)` → `''`.
- `renommerMarqueurs` :
  - remplace la clé et conserve `attributes` ;
  - laisse le texte et les autres embeds intacts ;
  - ne mute pas son entrée (comparer `JSON.stringify` avant et après).
- `valeurMarqueur('personne.joursTravaillesParMois', ctx)` → « 22 jours par mois » ; `estCleMarqueurValide('personne.quotite')` → `false`.
- Rechargement (F5) avec un `localStorage` v13 issu de sermet :
  - l'application démarre ;
  - `JSON.parse(localStorage.getItem('idelia:data'))` (lecture seule, en console) n'est réécrit qu'à la première modification. Le flush arrive en T2.
- `preparerDocument(sermet)` : `ok: true`, `doc.schemaVersion === 14`, aucune clé `quotite`, rythmes 15, 11, 22, 22, 22, 22, et `rythmesProposes` contient les 4 remplaçantes.
- `preparerDocument(test-4 v4)` : rythmes 22, 22, 17, 22.
- Appliquer `migrate` deux fois de suite donne le même résultat.
- Un fichier v14 sans `joursTravaillesParMois` est refusé (« … est manquant ») ; avec `0`, il est refusé (« … est invalide ») ; avec une clé `quotite` en plus, il est accepté et la clé est retirée après `fromSaveDocument`.
- `npm run build` réussit. Une recherche `localStorage` dans `src/` ne trouve que `storageRepository.js`.

### Tâche 2 — Store : rythmes proposés annoncés une fois

**Fichiers** :

- `src/store/index.js` (**modifier**) : `bootstrap` et `importer` (§4), toast `messageRythmesProposes`.

**Critères de sortie** :

- Import de sermet (v13) :
  - toast avertissement avec les 4 noms des remplaçantes, qui reste affiché jusqu'à fermeture ;
  - l'import réussit comme avant.
- Import d'un export v14 : aucun toast de rythme.
- `localStorage` v13 puis F5 :
  - le toast apparaît une fois et le stockage passe en v14 (`schemaVersion: 14`, sans `quotite`) ;
  - un second F5 n'affiche **plus** le toast.
- Toast du logo (`0039`) inchangé. `npm run build` réussit.

### Tâche 3 — Interface : formulaire et affichages

**Fichiers** :

- `src/components/equipe/FormulairePersonne.vue` (**modifier**) : §6, §7, §8.
- `src/views/EquipeView.vue` (**modifier**) : §6.
- `src/views/SouhaitsView.vue` (**modifier**) : §6.

**Critères de sortie** :

- Plus aucun champ « Temps de travail ». Le champ « Rythme de travail » est sans « (facultatif) » et porte l'aide du §8.
- Création :
  - rythme vide → message requis et focus sur le champ ;
  - 0, 12,5 ou 32 → message « entier entre 1 et 31 » ;
  - 18 → enregistré, la ligne affiche « Titulaire · 18 jours par mois ».
- Édition : vider le rythme d'une fiche existante est refusé.
- Équipe (actives et archivées) et Souhaits : plus aucun « % » à côté du statut ; le rythme apparaît une seule fois.
- Recherche `quotite` dans `src/` : n'apparaît plus que dans `migrations.js`, `catalogueMarqueurs.js` (`CLES_MARQUEURS_RENOMMEES`) et `schema.js` (retrait défensif).
- `npm run build` réussit, sans avertissement d'import inutilisé.

### Tâche 4 — Moteur : équité par le seul rythme

**Fichiers** :

- `src/domain/scheduling/contraintes/contrainteEquite.js` (**modifier**) : §5.4.
- `src/domain/scheduling/modele/messages.js`, `src/domain/libelles.js` (**modifier**) : §5.5.
- `src/domain/presence.js` (**modifier**) : §5.6, après une recherche confirmant l'absence d'autre appelant.
- `src/domain/recapMensuel.js` (**JSDoc seulement**) : §5.7.

**Critères de sortie** :

- Aucun import Vue/Vuex dans `src/domain/scheduling/`. Recherche `EQUITE_DESEQUILIBREE`, `fractionPresence` et `quotite` dans `src/domain/scheduling/` : 0 résultat.
- Sermet, même période et même graine que T0 (planning de T0 conservé dans le stockage, puis « Régénérer » en mode reproductible) :
  - si aucune remplaçante n'atteint 22 jours en décembre, les titulaires ont les **mêmes** jours travaillés et les mêmes alertes de rythme qu'au relevé T0 ;
  - sinon, des écarts sont admis (le nouveau plafond déplace des remplaçantes, puis la continuité peut déplacer des titulaires), mais chacun doit être expliqué dans le compte rendu ;
  - les remplaçantes ne dépassent pas 22 jours sur le mois, ou un « Rythme de travail dépassé » est signalé ;
  - aucun « Charge de travail mal répartie ».
- Placement manuel en surplus (glisser une titulaire au-delà de son rythme) : alerte « Rythme de travail dépassé » en temps réel, comme avant.
- `npm run build` réussit.

### Tâche 5 — Documentation d'architecture et d'instructions

**Fichiers** :

- `docs/architecture/02-modele-de-domaine.md` (**modifier**) :
  - supprimer la ligne `quotite` ;
  - ligne `joursTravaillesParMois` : `integer 1..31`, **oui**, « rythme habituel en jours travaillés par mois complet, obligatoire pour toute personne [0020, 0043] ; la migration v14 propose une valeur dérivée de l'ancienne quotité » ;
  - ligne `dateSortie` : retirer `fractionPresence` de la liste des fonctions de `presence.js`.
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) :
  - `schemaVersion` 14 dans les deux blocs JSON, avec « v14 = suppression de `Personne.quotite`, rythme obligatoire » dans le commentaire ;
  - `"quotite": 100` retiré de l'exemple ;
  - corriger « `CURRENT_SCHEMA_VERSION` (= **9**) » en **14** ;
  - ajouter l'entrée **`MIGRATIONS[13]` (v13 → v14)** : règle du rythme proposé, réécriture des pastilles et des `valeursSaisies`, texte des documents jamais réécrit.
- `docs/architecture/05-moteur-de-planification.md` (**modifier**) :
  - réécrire la description de `equite` (§5.4 : un seul groupe, plafond et alertes, conséquences pour les remplaçantes, `EQUITE_DESEQUILIBREE` retiré) ;
  - dans le paragraphe `presence`, remplacer « l'équité calcule son écart au prorata de ses jours de présence (`fractionPresence`…) » par « l'attendu de son rythme est calculé au prorata de ses jours de présence (`joursAttendusSurPeriode`, `rythmeMensuel.js`) ».
- `docs/architecture/04-gestion-etat-vuex.md` (**modifier**) : dans le cycle de vie « Démarrage » et « Import », mentionner que `preparerDocument` renvoie `rythmesProposes` ; si la liste n'est pas vide, `bootstrap` persiste aussitôt le document migré (flush) et les deux actions affichent le toast unique (§4).
- `docs/instructions/formulaires-validation.md` (**modifier**) :
  - « quotité 0–100 » devient « rythme de travail requis, entier de 1 à 31 jours par mois » ;
  - retirer « quotité 100 % » des exemples de valeurs par défaut ;
  - ajouter : « une donnée qui engage l'organisation (ex. rythme de travail) n'a **pas** de valeur par défaut : elle se saisit consciemment ».

**Critères de sortie** : recherche `quotit` dans `docs/` : 0 résultat. Les anciens plans `features/*.md` sont inchangés.

## 10. Critères d'acceptation

- [ ] Plus aucun « temps de travail en % » nulle part dans l'application (formulaire, Équipe, Souhaits, menu « Insérer un champ »).
- [ ] Le rythme de travail est **obligatoire** pour toute personne : la création et la modification sans rythme valide (entier de 1 à 31) sont refusées avec un message clair et le focus sur le champ.
- [ ] Équipe et Souhaits affichent « Statut · N jours par mois ».
- [ ] Une ancienne sauvegarde (v4 à v13) s'importe sans erreur ; chaque personne sans rythme valide reçoit le rythme proposé par la règle §3.2 ; le fichier exporté ensuite est en v14, sans `quotite`.
- [ ] Les données du navigateur sont migrées au démarrage ; le toast d'avertissement nomme les personnes concernées et n'apparaît qu'une fois.
- [ ] Un fichier v14 sans rythme est refusé proprement, avec les données actuelles conservées.
- [ ] Les modèles de contrats qui utilisaient « Quotité de travail » affichent la pastille « Rythme de travail (jours par mois) », qui se remplit par « N jours par mois ».
- [ ] Le texte des documents déjà créés (brouillons et signés) est inchangé.
- [ ] Le moteur équilibre par le seul rythme : titulaires sermet inchangées par rapport au relevé T0, plus aucune alerte « Charge de travail mal répartie ».
- [ ] `npm run build` réussit ; aucun `localStorage` hors `storageRepository` ; aucune dépendance ajoutée ; `files/idelia-sermet.json` non modifié.

## 11. Vérification

Recette navigateur : Playwright MCP, `npm run dev` sur le port **5199**. Les GUID sont lus dans les données ou générés (`crypto.randomUUID()`), jamais inventés à la main.

**Jeu fabriqué v13** :

- Construit dans le scratchpad de session, **jamais dans `files/`**, à partir d'une copie de sermet, avec des GUID réels.
- Contenu :
  - personnes avec rythme `0`, `12.5`, `null` + `quotite: 80`, `null` sans `quotite`, et une personne **archivée** à `null` ;
  - un modèle de contrat dont le `contenu` contient l'embed `{ "insert": { "marqueur": { "cle": "personne.quotite" } }, "attributes": { "bold": true } }` ;
  - un document **BROUILLON** qui contient ce même embed (« égaré ») et une `valeursSaisies` de clé `personne.quotite` ;
  - un document **SIGNE** dont le texte contient « Quotité : 80 % ».

**Contrôles** :

1. **Relevé T0** fait avant le code (§9).
2. **Migration au démarrage** :
   1. Sur la version actuelle, importer sermet, puis passer sur la branche de la feature et faire F5.
   2. Constater le toast avec les 4 remplaçantes.
   3. Dans Équipe : « Titulaire · 15 jours par mois », « … · 11 jours par mois », « Remplaçant(e) · 22 jours par mois » (×4), aucun « % ».
   4. F5 : plus de toast.
   5. En console, `idelia:data` a `schemaVersion: 14` et aucune clé `quotite`.
3. **Création refusée sans rythme** : « Ajouter une personne », prénom et nom saisis, rythme vide → « Enregistrer » → message requis et focus sur le champ. Puis :
   - `0` → message « entier entre 1 et 31 » ;
   - `12,5` → même message ;
   - `32` → même message ;
   - `18` → enregistrée, ligne « Titulaire · 18 jours par mois ».
4. **Édition** : vider le rythme d'une titulaire → refus. Annuler : la fiche est inchangée.
5. **Import d'une ancienne sauvegarde** (`files/sauvegarde-test-4-personnes.json`, v4) : import réussi, toast avec 4 noms, rythmes 22, 22, 17 (la remplaçante à 80 %) et 22. Exporter : `schemaVersion: 14`, aucun `quotite`, `joursTravaillesParMois` entiers.
6. **Jeu fabriqué v13** : import réussi. Contrôler :
   - rythmes proposés : 0 → 22, 12,5 → 22, 80 % → 17, `quotite` absente → 22 ;
   - l'archivée a un rythme mais **n'est pas** nommée dans le toast ;
   - le modèle montre la pastille « Rythme de travail (jours par mois) » en gras ;
   - un nouveau document généré depuis ce modèle contient « 17 jours par mois » pour la personne à 80 % ;
   - le document **signé** contient toujours « Quotité : 80 % » ;
   - le brouillon s'ouvre sans erreur ; l'embed égaré y apparaît comme pastille du nouveau libellé ;
   - l'export contient `valeursSaisies[].cle = "personne.joursTravaillesParMois"` avec libellé et valeur d'origine.
7. **Imports refusés** (copies de l'export v14) :
   - une personne sans `joursTravaillesParMois` → refus « … est manquant », données actuelles conservées ;
   - avec `0` → refus « … est invalide » ;
   - avec `"quotite": 50` ajouté → accepté, clé absente après F5.
8. **Contrats** :
   - Modèles → « Insérer un champ » : « Rythme de travail (jours par mois) » est présent, « Quotité de travail » absent ;
   - coller `{{personne.quotite}}` → reste du texte, avec l'avertissement « champ inconnu » ;
   - coller `{{personne.joursTravaillesParMois}}` → pastille.
9. **Équité du moteur** : régénérer en mode reproductible le planning de décembre conservé en T0, puis comparer au relevé :
   - titulaires : mêmes jours et mêmes alertes si aucune remplaçante n'atteint 22 jours ; sinon, écarts expliqués ;
   - aucun « Charge de travail mal répartie » ;
   - remplaçantes : noter les éventuels « Rythme de travail dépassé » (nouveau plafond 22) ;
   - récap mensuel : les remplaçantes affichent « 22 jours par mois (N prévus sur ce mois) » au lieu de « Pas de rythme fixé ».

   Reporter les écarts dans le compte rendu.
10. **Souhaits** : `/souhaits/<id>` affiche « Titulaire · 15 jours par mois ».
11. **Non-régression** :
    - rétrocession toujours en % dans le formulaire et dans les contrats (`personne.tauxRetrocession`) ;
    - Feuille de route, Diffusion et Documents inchangés ;
    - `npm run build` réussit ;
    - `git status` : `files/idelia-sermet.json` non modifié.

## 12. Décisions à valider

1. **Règle du rythme proposé** (§3.2) :
   - formule : `quotité × min(jours d'ouverture, 7 − repos hebdo) × 52/12`, arrondie et bornée de 1 à 31 ;
   - effet : 22 jours pour une remplaçante à 100 % dans sermet, 30 sans le plafond du repos hebdo ;
   - **Recommandé** tel quel : proportionnel à l'ancienne quotité, cohérent avec les règles du cabinet, déterministe, et annoncé à l'utilisatrice pour vérification.
2. **Affichage « 15 jours par mois »** plutôt que « 15 j/mois » (formulation de la demande) :
   - **Recommandé** : texte complet, déjà affiché dans Équipe depuis `0020`. Les abréviations gênent le public cible.
3. **Équité : pas de rééquilibrage sous le rythme** (§5.4) :
   - sous son rythme, l'équité ne départage plus les personnes (règle « avec rythme » de `0020`, déjà en usage pour les titulaires sermet) ;
   - alternative : ajouter un petit coût proportionnel au taux de remplissage (`jours / attendu`), inférieur au coût « titulaires d'abord », pour répartir au prorata des rythmes quand la demande est inférieure à la somme des rythmes ;
   - **Recommandé** : ne pas l'ajouter maintenant (KISS, aucun changement pour les titulaires qui ont déjà un rythme). À rouvrir si la recette n° 9 montre une répartition déséquilibrée.
4. **Texte des modèles autour de l'ancienne pastille** : la migration change la pastille, pas les mots qui l'entourent (« quotité de travail de 22 jours par mois »).
   - **Recommandé** : accepter, contrôler en recette, et prévenir le porteur.
   - Les deux modèles de départ de `0041` n'utilisent pas ce marqueur, et sermet n'en contient aucun.
5. **Documents déjà rédigés, brouillons compris** : texte jamais réécrit (§3.3).
   - **Recommandé** : un signé est la copie de l'original papier ; un brouillon se corrige à la main.
6. **Annonce de la migration** : toast d'avertissement unique avec les noms des personnes actives, fermeture manuelle, et flush du stockage au démarrage pour ne pas le répéter (§4).
   - Alternative : migration silencieuse. **Non recommandée** : des valeurs proposées non vérifiées pèseraient sur tous les plannings suivants.
7. **Homonymie « Rythme de travail »** : le bloc de la page Cabinet (repos hebdomadaire, jours d'affilée) porte le même titre que le champ de la personne.
   - **Recommandé** : garder « Rythme de travail » pour la personne (mot du porteur, colonne du récap) ;
   - proposer plus tard de renommer le bloc Cabinet « Repos et jours d'affilée », hors périmètre, à soumettre à `ui-ux`.
8. **Pas de valeur par défaut en création** (champ vide, placeholder 15) :
   - **Recommandé** : la donnée engage l'organisation, donc elle doit être choisie consciemment ;
   - alternative : préremplir avec la valeur d'un temps plein du cabinet (22), au risque d'une validation sans y penser.
9. **Remplaçantes** :
   - rythme obligatoire comme pour les titulaires (demande du porteur) ;
   - leur rythme reste un **plafond** : jamais d'alerte « non atteint » (`0021`, inchangé) ;
   - **Recommandé** tel quel.
10. **Aucun écart d'ADR** :
    - aucun backend ;
    - migration via le pipeline existant (ADR 0005 / 0006) ;
    - moteur toujours pur (ADR 0008) ;
    - Vuelidate (ADR 0011) ;
    - aucune dépendance ajoutée ;
    - aucun nouvel ADR.
11. **Sécurité (pour l'agent `security`)** :
    - aucune nouvelle surface d'entrée ;
    - le contrôle d'import est **durci** (rythme requis et entier) ;
    - la migration ne fait que renommer des clés de marqueurs d'une liste fermée (`CLES_MARQUEURS_RENOMMEES`) et n'interprète jamais le texte ;
    - les noms affichés dans le toast passent par l'interpolation texte de Vue, jamais `v-html`.
