# Feature 0021 — Moteur : règles de remplacement

- **Statut** : En cours (plan rédigé)
- **Dépend de** : `0009` (moteur pur : contraintes, glouton, recherche locale, validation), `0020` (`Personne.titulaireId`, `joursTravaillesParMois`, équité à deux groupes). S'appuie aussi sur `0011` (éditeur : dépôt manuel jamais bloqué, verrou, régénération), `0016` (grain = segment, recouvrement absence ↔ horaires) et `0017` (absences saisies directement en `VALIDE`).
- **ADR liés** : [0007](../docs/adr/0007-generation-planning-hybride.md) (mode hybride : le geste manuel prime, il est signalé et non bloqué), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (moteur pur, une contrainte = une source de vérité partagée génération / validation), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, horaires `"HH:mm"`, jours ISO), [0017](../docs/adr/0017-modelisation-tournees-coupees-segments.md) (segments, recouvrement horaire). **Aucun écart d'ADR.**

## 1. Contexte & objectif

Retours de tests avec le cabinet (juillet 2026) : une **remplaçante ne travaille que pour remplacer une absence**. Aujourd'hui, le moteur la traite comme n'importe quelle titulaire : il peut la planifier « spontanément » un jour où personne n'est absent, au détriment des titulaires. `0020` a seulement enregistré à qui elle est rattachée (`titulaireId`), sans effet sur le planning.

`0021` :
1. **Règle stricte de génération** : le moteur ne place une remplaçante sur une tournée que si **une titulaire est absente** sur cet horaire, et jamais plus de remplaçantes un jour donné que de titulaires absentes ce jour-là.
2. **Priorité à la titulaire rattachée** : quand Claire est absente, c'est Léa (« Remplace en priorité Claire Martin ») qui est proposée d'abord ; une autre remplaçante ne vient que si Léa n'est pas disponible.
3. **Geste manuel respecté** : dans l'éditeur (`0011`), le gestionnaire peut toujours poser une remplaçante hors absence (appel exceptionnel, hors cadre légal) ; c'est **signalé** dans « Points d'attention », en **avertissement**, jamais bloqué, jamais compté « à résoudre ».
4. **Équité assainie** : les remplaçantes ne faussent plus la moyenne de charge des titulaires (elles travaillent peu par construction).

Résultat attendu : sans absence, aucune remplaçante n'apparaît dans un planning généré ; pendant l'absence d'une titulaire, sa remplaçante attitrée la couvre, et le gestionnaire comprend chaque signalement en lisant une phrase.

**Hors périmètre** : dates de présence `dateEntree`/`dateSortie` (`0031`, qui pourra reprendre le même principe « manuel = avertissement ») ; récap mensuel (`0024`) ; aucune notion de « tournée habituelle » d'une titulaire (le moteur ne sait pas quelle tournée Claire aurait faite : il sait seulement qu'une place est libérée).

## 2. Écrans concernés

Aucun nouvel écran, aucune nouvelle route. Changements de comportement et de textes uniquement.

### 2.1 Planning (`/planning`) — génération et régénération

- Un planning généré **ne contient plus** de remplaçante les jours où aucune titulaire n'est absente. Si les titulaires ne suffisent pas, la tournée apparaît dans « Tournées non couvertes » (comportement existant) plutôt que d'être confiée en silence à une remplaçante.
- Pendant l'absence (validée) d'une titulaire, une remplaçante est proposée sur les horaires concernés, **en priorité** celle qui lui est rattachée.

### 2.2 Planning — panneau « Points d'attention » (`PanneauConflits`)

Trois nouvelles causes (volets dépliants existants, groupés par `code`) :

| Cause (titre du volet) | Section | Exemple de message |
|---|---|---|
| **Remplaçante planifiée sans absence à couvrir** | Avertissements si posée à la main ; Erreurs à corriger si posée par le moteur | « Zoé Blanc (remplaçante) est planifiée le jeudi 08/10/2026 (07:00 – 13:00), mais aucune titulaire n'est absente à ces horaires. Si c'est un appel exceptionnel, vous pouvez laisser ainsi ; sinon, retirez-la de cette case. » |
| **Plus de remplaçantes que d'absences** | idem (avertissement si au moins une de ces affectations a été posée à la main) | « Le mercredi 07/10/2026, 2 remplaçantes sont planifiées (Léa Roux et Zoé Blanc) pour une seule titulaire absente (Claire Martin) : une absence ne justifie qu'une seule remplaçante. Retirez-en une si ce n'est pas voulu. » |
| **Remplaçante habituelle non planifiée** | Avertissements | « Claire Martin est absente le mercredi 07/10/2026. Léa Roux, qui la remplace d'habitude, n'est pas planifiée ce jour-là ; Zoé Blanc l'est à sa place. » |

Variante « posée par le moteur » du premier message (cas où l'absence a été supprimée **après** la génération) : « … mais aucune titulaire n'est absente à ces horaires. L'absence qu'elle couvrait a sans doute été modifiée ou supprimée : retirez-la de cette case ou regénérez le planning. »

**Rappel sous « Tournées non couvertes »** (uniquement si l'équipe compte au moins une remplaçante active), petite ligne d'aide : « Une remplaçante n'est proposée automatiquement que pour remplacer une titulaire absente. Vous pouvez en ajouter une à la main pour un appel exceptionnel : le planning vous le signalera, sans l'empêcher. »

### 2.3 Planning — mini-sélecteur « Ajouter une personne » (`SelecteurPersonne`)

Pour chaque **remplaçante** listée, si aucune titulaire n'est absente sur les horaires de la case : note discrète en italique (peut passer à la ligne), à la place (ou à la suite) de « déjà N affectation(s) ce jour-là » : « **pas d'absence à remplacer sur ces horaires (choix possible)** ». Elle reste cliquable (jamais bloquée). Rien ne change pour les titulaires.

### 2.4 Équipe (`/equipe`) — modale « Ajouter / Modifier une personne » (`FormulairePersonne`)

- Sous « Statut », aide visible **uniquement si « Remplaçant » est choisi** (`id="personne-statut-aide"`, relié par `aria-describedby`) : « Une personne remplaçante n'est planifiée automatiquement que pour couvrir l'absence d'une titulaire. »
- Aide de « Remplace en priorité (facultatif) » complétée (honnêteté : le rattachement agit désormais) : « La titulaire que cette personne remplace d'habitude. Elle sera proposée en premier quand cette titulaire est absente. »

## 3. Modèle de données touché

**Aucun changement persistant, aucune migration** (`CURRENT_SCHEMA_VERSION` inchangé).

- Identification d'une remplaçante : champ **existant** `Personne.statut === 'REMPLACANT'` (`STATUTS_PERSONNE`, `src/domain/schema.js`).
- Rattachement : champ **existant** `Personne.titulaireId` (`0020`), désormais **lu par le moteur**.
- Absences : seules les `Absence` au statut `VALIDE` comptent (en v1 toutes le sont, `0017`) ; leur `creneau` (`MATIN`/`APRES_MIDI`/`JOURNEE`) est réconcilié avec les horaires réels du segment par `creneauChevaucheHoraires` (pivot midi, `0016`).
- Champ existant `Affectation.origine` (`'AUTO'` | `'MANUEL'`) : sert à **graduer la sévérité** des signalements (§5.3). Rien n'est ajouté.

Volatil uniquement (jamais persisté) : nouveaux `Violation.code` `REMPLACANTE_SANS_ABSENCE`, `REMPLACANTES_EN_SURNOMBRE`, `REMPLACANTE_HABITUELLE_NON_PLANIFIEE`.

## 4. Store (Vuex)

**Aucun module, getter, mutation ni action modifié.**

- `plannings/assemblerEntree` transmet déjà `personnes` (actives, avec `statut` et `titulaireId`) et `absences` (toutes) : le moteur a tout ce qu'il faut.
- `ajouterAffectation` / `deplacerAffectation` posent déjà `origine: 'MANUEL'` ; `regenerer` conserve déjà les affectations verrouillées : rien à changer.
- Composants : `SelecteurPersonne` et `PanneauConflits` lisent en plus `absences` (state) / `personnes/actifs` (getter) **en lecture seule** pour leurs aides (§6).

## 5. Domaine (logique pure)

### 5.1 Règles métier retenues (synthèse)

| # | Règle | Nature |
|---|---|---|
| R1 | Une **titulaire absente** = une `Absence` `VALIDE` d'une personne **active** de statut `TITULAIRE`. Seules ces absences « libèrent une place ». | définition |
| R2 | Une remplaçante n'est candidate sur un segment (date + horaires) que si **au moins une titulaire est absente sur ces horaires** (recouvrement période + créneau ↔ horaires, mêmes helpers que la contrainte d'absence). | **dure** (génération) |
| R3 | Un jour donné, le nombre de remplaçantes **distinctes** qui travaillent « sur absence » ne dépasse pas le nombre de **titulaires distinctes absentes** ce jour-là (au moins en partie). Une remplaçante déjà présente ce jour-là peut prendre un second segment (matin + reprise). | **dure** (génération) |
| R4 | Si la titulaire rattachée d'une remplaçante est absente ce jour-là, cette remplaçante est préférée aux autres remplaçantes. | **souple** (priorité) |
| R5 | Placement **manuel** violant R2/R3 : signalé en **avertissement**, jamais bloqué. Placement **automatique** violant R2/R3 (données modifiées depuis la génération) : **erreur** à corriger. | sévérité |
| R6 | Les remplaçantes sortent de la **moyenne d'équité** des titulaires ; une remplaçante avec rythme peut être signalée « rythme dépassé », jamais « non atteint ». | équité |

Remplaçante **sans titulaire rattachée** (ou rattachée à une personne archivée / qui n'est plus titulaire) : R2, R3, R5 s'appliquent normalement ; elle n'a simplement **aucune priorité** (R4) et couvre n'importe quelle absence de titulaire.

### 5.2 `src/domain/remplacement.js` (**créer**)

Module pur hors moteur (comme `rythmeMensuel.js`) : il est la **source de vérité unique** de « quelles absences ouvrent un remplacement », réutilisée par la contrainte du moteur **et** par l'aide du sélecteur (§6.2). Imports : `@/domain/absences.js` (`periodesSeChevauchent`, `creneauChevaucheHoraires`) uniquement. Ne lève jamais (entrées manquantes → listes vides). Aucun objet `Date`.

```js
/** @param {Personne} personne @returns {boolean} statut === 'REMPLACANT' */
export function estRemplacante(personne)

/**
 * Absences qui libèrent une place le jour `date` (R1) : statut 'VALIDE',
 * personne présente dans `personnes`, active (actif !== false) et 'TITULAIRE',
 * période couvrant `date` (periodesSeChevauchent(a.dateDebut, a.dateFin, date, date)).
 * Ordre : celui de `absences`.
 * @param {string} date - "YYYY-MM-DD"
 * @param {{personnes?: Personne[], absences?: Absence[]}} sources
 * @returns {Absence[]}
 */
export function absencesARemplacerLe(date, { personnes = [], absences = [] } = {})

/** Sous-ensemble dont le créneau recouvre les horaires "HH:mm" (creneauChevaucheHoraires). */
export function absencesSurHoraires(absences, heureDebut, heureFin)

/** Raccourci : absencesSurHoraires(absencesARemplacerLe(date, sources), heureDebut, heureFin). */
export function absencesACouvrir(date, heureDebut, heureFin, sources)

/**
 * Titulaires distinctes concernées par une liste d'absences, dans l'ordre de `personnes`
 * (déterminisme).
 * @returns {Personne[]}
 */
export function titulairesAbsentes(absences, personnes)
```

### 5.3 Moteur — `src/domain/scheduling/contraintes/contrainteRemplacement.js` (**créer**)

Un fichier, `type: 'REMPLACEMENT'`, deux fabriques (même schéma que `contrainteAbsence.js` qui en porte deux).

**Précalcul commun dans chaque fabrique (closure, recréée à chaque `creerContraintes`, donc jamais périmée)** :
- `personnesParId: Map` des `entree.personnes` actives ; `remplacantes` = actives `estRemplacante`, **ordre de `entree.personnes`** ;
- `absencesDuJour(date)` : mémo `Map<date, Absence[]>` rempli à la demande via `absencesARemplacerLe(date, { personnes: entree.personnes, absences: entree.absences })` ;
- `nbTitulairesAbsentes(date)` = `titulairesAbsentes(absencesDuJour(date), entree.personnes).length`.

Helper interne `remplacantesSurAbsenceLe(date, ctx)` → ids (ordre `remplacantes`) des remplaçantes ayant **au moins une** affectation ce jour-là (`ctx.index.parPersonne`) dont les horaires (`horairesDeAffectation`, voir §5.6) recouvrent une absence de `absencesDuJour(date)` (`absencesSurHoraires` non vide). C'est le **même** comptage pour `autoriseAffectation` et `evaluer` (invariant de cohérence, architecture 05 §1).

#### a) `creerContrainteRemplacementSurAbsence(entree)` — **dure**, `id: 'remplacement-sur-absence'`, `granularite: 'global'`

`autoriseAffectation(personneId, demande, ctx)` :
1. personne introuvable ou non remplaçante → `true` (titulaires jamais concernées, test O(1)) ;
2. `absencesSurHoraires(absencesDuJour(demande.date), demande.heureDebut, demande.heureFin)` vide → `false` (R2) ;
3. `deja = remplacantesSurAbsenceLe(demande.date, ctx)` ; `true` si `deja` contient `personneId`, sinon `deja.length < nbTitulairesAbsentes(demande.date)` (R3).

Le glouton reconstruit l'index avant chaque décision : R3 est donc vérifiée **dynamiquement**, comme le repos légal.

`evaluer(ctx)` — dates parcourues **triées**, personnes dans l'ordre de l'entrée :
- **R2** : pour chaque affectation d'une remplaçante dont les horaires ne recouvrent aucune absence de `absencesDuJour(date)` → violation `REMPLACANTE_SANS_ABSENCE` :
  - `severite: affectation.origine === 'MANUEL' ? 'avertissement' : 'erreur'` (R5), `penalite: 0` ;
  - `cible: { personneId, tourneeId, date, segmentIndex }` (surlignage de la case existant) ;
  - `params: { personneId, date, segmentIndex, origine }` ; message `messagePour('REMPLACANTE_SANS_ABSENCE', { nomPersonne, date, heureDebut, heureFin, origine })`.
- **R3** : pour chaque date où `remplacantesSurAbsenceLe(date).length > nbTitulairesAbsentes(date)` → **une** violation `REMPLACANTES_EN_SURNOMBRE` :
  - `severite: 'avertissement'` si au moins une affectation de ces remplaçantes ce jour-là est `MANUEL`, sinon `'erreur'` ; `penalite: 0` ;
  - `cible: { date }` ; `params: { date, remplacanteIds, titulaireIds }` ; message avec les listes de noms.
- Une remplaçante posée hors absence n'est **pas** comptée dans R3 (déjà signalée par R2 : pas de double signalement).

**Pourquoi la sévérité dépend de `origine`** : le moteur, lui, ne crée que des affectations `AUTO` ; la recherche locale ne peut donc jamais introduire une violation R2/R3 sans augmenter le nombre d'erreurs (elle le refuse déjà, `rechercheLocale.js` — **aucune modification**). À l'inverse, un dépôt ou un ajout manuel pose `origine: 'MANUEL'` : le signalement devient un avertissement (non compté « à résoudre » par `resumerDiagnostic`, `meta.faisable` reste vrai même si l'affectation est verrouillée puis régénérée). Une affectation `AUTO` devenue illégitime (absence supprimée après coup) reste une **erreur** : le planning est périmé et doit être corrigé.

#### b) `creerContrainteRemplacementPrioritaire(poids, entree)` — **souple**, `id: 'remplacement-prioritaire'`, `granularite: 'global'`

Définitions pour une date `d` : `absentes(d)` = `titulairesAbsentes(absencesDuJour(d), entree.personnes)` ; pour une titulaire `T`, `habituelles(T)` = remplaçantes actives avec `titulaireId === T.id` (ordre de l'entrée) ; une habituelle est **disponible** le jour `d` si elle n'a aucune absence `VALIDE` touchant `d` ; elle **travaille** si `ctx.index.joursTravaillesParPersonne.get(id)?.has(d)`.

`evaluer(ctx)` — pour chaque date travaillée triée, pour chaque `T` de `absentes(d)` :
- `dispos` = `habituelles(T)` disponibles ; ignorer si vide ou si **l'une** des `habituelles(T)` travaille ce jour-là ;
- `autres` = remplaçantes qui travaillent ce jour-là, hors `habituelles(T)`, **et dont la propre titulaire n'est pas dans `absentes(d)`** (elles couvrent légitimement leur titulaire) ; ignorer si vide ;
- sinon violation `REMPLACANTE_HABITUELLE_NON_PLANIFIEE` : `severite: 'avertissement'`, `penalite: poids`, `cible: { personneId: dispos[0].id, date }` (en vue Personnes, la case vide de Léa est surlignée), `params: { titulaireId, date, habituelleIds, autreIds }`.

`coutMarginal(personneId, demande, ctx)` — reflet glouton de la même règle :
- `0` si la personne n'est pas remplaçante, si sa titulaire est dans `absentes(demande.date)`, ou si elle travaille déjà ce jour-là ;
- `poids` s'il existe `T` dans `absentes(demande.date)` ayant au moins une habituelle disponible et **aucune** habituelle qui travaille déjà ce jour-là ;
- sinon `0`.

Effet : pendant l'absence de Claire, Léa (coût 0) passe avant Zoé (coût `poids`) ; si Léa est absente elle aussi, Zoé n'est pas pénalisée. Les titulaires ne sont jamais concernées (pas de biais titulaire/remplaçante introduit ici).

### 5.4 Moteur — `src/domain/scheduling/contraintes/contrainteEquite.js` (**modifier**, R6)

Conséquence directe de R2 : une remplaçante travaille peu par construction ; laissée dans le groupe « sans rythme », elle ferait baisser la moyenne et déclencherait des « Charge de travail mal répartie » pour elle **et** pour les titulaires.
- `chargesDeLequipe` : exclure les remplaçantes (`estRemplacante`, import `@/domain/remplacement.js`) → moyenne calculée sur les titulaires sans rythme seulement.
- `coutMarginal`, branche « sans rythme » : `return 0` pour une remplaçante (sa venue est déjà encadrée par R2/R3/R4).
- Groupe « avec rythme » : une remplaçante garde `coutMarginal` et l'alerte `EQUITE_RYTHME_DEPASSE` (son rythme vaut plafond), mais **jamais** `EQUITE_RYTHME_NON_ATTEINT` (elle ne travaille qu'au gré des absences).
- En-tête JSDoc du module mis à jour. Sans remplaçante dans l'équipe : comportement **strictement identique**.

### 5.5 Moteur — autres fichiers

- `contraintes/index.js` (**modifier**) : enregistrer `creerContrainteRemplacementSurAbsence(entree)` (après `creerContrainteAbsenceDemandee()`) et `creerContrainteRemplacementPrioritaire(poids.remplacementPrioritaire, entree)` (après l'équité) ; `POIDS_SOUPLES_PAR_DEFAUT.remplacementPrioritaire = 3` ; `TYPES_CONTRAINTE` + `'REMPLACEMENT'` ; en-tête (« 8 contraintes fixes » → nombre à jour).
- `modele/messages.js` (**modifier**) : gabarits défensifs (valeurs par défaut neutres) des trois codes, textes §2.2 ; listes de noms via `listeFrancaise` (« A », « A et B », « A, B et C ») ; accords singulier/pluriel (« une seule titulaire absente » / « 2 titulaires absentes », « n'est pas planifiée » / « ne sont pas planifiées », « (remplaçante) l'est » / « (remplaçantes) le sont ») ; `REMPLACANTE_SANS_ABSENCE` choisit sa seconde phrase selon `origine` (`'MANUEL'` → « s'il s'agit d'un appel exceptionnel, vous pouvez laisser ainsi » ; sinon → « retirez-la de cette case ou régénérez le planning »).
- `modele/types.js` (**modifier**) : JSDoc de `Violation.severite` — « dure → `erreur`, sauf placement manuel signalé en `avertissement` (`0021`) ».
- `src/domain/libelles.js` (**modifier**) : `LIBELLES_CAUSE_VIOLATION` + `REMPLACANTE_SANS_ABSENCE: 'Remplaçante planifiée sans absence à couvrir'`, `REMPLACANTES_EN_SURNOMBRE: "Plus de remplaçantes que d'absences"`, `REMPLACANTE_HABITUELLE_NON_PLANIFIEE: 'Remplaçante habituelle non planifiée'`.
- `src/domain/personnes.js` (**modifier**) : **exporter** `listeFrancaise` (aujourd'hui privée), sans changer son comportement.

### 5.6 Réutilisé (non modifié, sauf export)

- `contrainteAbsence.js` : **exporter** `horairesDeAffectation` (lookup des horaires d'une affectation, aujourd'hui privé) ; aucune autre modification.
- `src/domain/absences.js` (`periodesSeChevauchent`, `creneauChevaucheHoraires`), `modele/planning.js` (`indexer` : `parPersonne`, `joursTravaillesParPersonne`), `src/domain/utils/dates.js` (`dateUtil.formatDateFr`, `weekdayISO`).
- **Ne pas toucher** : `glouton.js`, `rechercheLocale.js`, `scoring.js`, `genererPlanning.js`, `validerPlanning.js`, `diagnostiquer.js`, `src/store/**`.

## 6. Composants

### 6.1 `src/components/equipe/FormulairePersonne.vue` (**modifier**)

Textes d'aide §2.4 uniquement : `form-text` sous « Statut » (`v-if="estRemplacant"`, `id="personne-statut-aide"`, `aria-describedby` sur le `select` seulement quand l'aide est visible) ; aide du rattachement complétée. Aucune logique, aucune validation ajoutée.

### 6.2 `src/components/planning/SelecteurPersonne.vue` (**modifier**)

- `computed` `segmentCible` : `tournees/byId(tourneeId)?.segments[segmentIndex]` (horaires bruts `heureDebut`/`heureFin`) ; `absences` lues via `mapState('absences', { absences: 'items' })`.
- Chaque entrée de `personnesDisponibles` gagne `sansAbsenceACouvrir` : `estRemplacante(p) && segmentCible && absencesACouvrir(date, segmentCible.heureDebut, segmentCible.heureFin, { personnes: personnesActives, absences }).length === 0` — **appel au domaine**, aucune règle dans le composant.
- Gabarit : note « pas d'absence à remplacer sur ces horaires (choix possible) » (classe existante `.selecteur-personne-note`), affichée si `sansAbsenceACouvrir`. Le bouton reste actif. Mettre à jour le commentaire d'en-tête (le composant lit désormais `absences` et `tournees` en lecture seule, toujours sans import `@/domain/scheduling`).

### 6.3 `src/components/planning/PanneauConflits.vue` (**modifier**)

- `computed` `equipeAvecRemplacantes` : `personnes/actifs` (getter existant) `.some(estRemplacante)`.
- Dans le volet « Tournées non couvertes », sous la liste : `<p class="panneau-conflits-aide">` avec le rappel §2.2, `v-if="equipeAvecRemplacantes"`. Style : `font-size: t.$taille-texte-petite; color: t.$couleur-texte-attenue;` (sans italique) (tokens uniquement).
- Les nouvelles causes s'affichent **sans autre code** (groupement par `code` + `libelleCauseViolation`).

### 6.4 Réutilisé

`ModaleBase`, `.selecteur-personne-note`, `<details>` du panneau, getters `tournees/byId`, `personnes/actifs`.

## 7. Règles de validation

Aucune nouvelle saisie, aucune règle Vuelidate. Les seules « validations » sont celles du moteur (§5), restituées en messages FR dans le panneau.

## 8. Points d'attention ergonomie

- **Jamais bloquer le gestionnaire** : un dépôt ou un ajout de remplaçante hors absence est toujours accepté, puis signalé en **avertissement** (orange, section « Avertissements »), pas en « Erreurs à corriger » — c'est un choix assumé, pas une faute. Annulable (undo 1 niveau existant).
- **Messages qui disent quoi faire** : chaque message nomme la personne, la date en clair (« jeudi 08/10/2026 ») et les horaires, puis la conduite à tenir (« vous pouvez laisser ainsi » / « retirez-la de cette case ou régénérez le planning »).
- **Vocabulaire du cabinet** : « remplaçante », « titulaire », « absente », « qui la remplace d'habitude » (repris de la page Équipe, `0020`). Jamais « contrainte », « dure », « origine », « AUTO/MANUEL », « slot », « segment ».
- **Prévenir plutôt que guérir** : la note « pas d'absence à remplacer sur ces horaires (choix possible) » dans le sélecteur informe **avant** le clic.
- **Comprendre une tournée non couverte** : le rappel sous « Tournées non couvertes » explique pourquoi une remplaçante libre n'a pas été utilisée, et comment la poser quand même.
- **Honnêteté de l'écran Équipe** : les aides disent désormais ce que le planning fait réellement du statut et du rattachement.
- **Accessibilité** : aides reliées par `aria-describedby`, information jamais portée par la seule couleur (titres de section + texte), aucune nouvelle cible cliquable.
- **Accords** : messages au féminin comme le reste du moteur (« est planifiée », « est affectée ») ; à relire par `ui-ux` avec la question ouverte de `0020` §12 n° 11 (« Remplaçant » masculin à l'écran Équipe).

## 9. Étapes d'implémentation

**3 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre **T1 → T2 → T3** (T2 et T3 utilisent `src/domain/remplacement.js` créé en T1 ; T2 et T3 sont indépendantes entre elles mais T2 et T1 touchent les mêmes fichiers moteur : ne pas paralléliser T1/T2).

### Tâche 1 — Règle « une remplaçante ne vient que pour une absence » (contrainte dure)

**Fichiers** :
- `src/domain/remplacement.js` (**créer**) — §5.2.
- `src/domain/scheduling/contraintes/contrainteRemplacement.js` (**créer**) — précalcul commun + `creerContrainteRemplacementSurAbsence` (§5.3 a). Prévoir l'emplacement de la seconde fabrique (T2) sans l'écrire.
- `src/domain/scheduling/contraintes/contrainteAbsence.js` (**modifier**) — `export` de `horairesDeAffectation`, rien d'autre.
- `src/domain/scheduling/contraintes/index.js` (**modifier**) — enregistrement de la dure, `TYPES_CONTRAINTE` + `'REMPLACEMENT'`, en-tête.
- `src/domain/scheduling/modele/messages.js` (**modifier**) — gabarits `REMPLACANTE_SANS_ABSENCE`, `REMPLACANTES_EN_SURNOMBRE`.
- `src/domain/scheduling/modele/types.js` (**modifier**) — JSDoc `severite` (§5.5).
- `src/domain/libelles.js` (**modifier**) — deux causes.
- `src/domain/personnes.js` (**modifier**) — `export` de `listeFrancaise`.
- `docs/architecture/05-moteur-de-planification.md` (**modifier**) — catalogue des **dures** : « `remplacementSurAbsence` (une remplaçante n'est candidate que si une titulaire est absente sur les horaires du segment ; pas plus de remplaçantes un jour que de titulaires absentes ; placement **manuel** signalé en `avertissement` [0021]) » ; objet `Violation` : nuance « dure → erreur, sauf placement manuel » ; §7 : `contrainteRemplacement.js` dans l'arborescence.
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — ligne `statut` : « … ; un `REMPLACANT` n'est planifié automatiquement que pour couvrir l'absence d'un titulaire [0021] » ; ligne `titulaireId` : « lu par le moteur (priorité de remplacement) [0021] ».
- `docs/architecture/06-structure-du-code.md` (**modifier**) — sous `domain/` : `remplacement.js  # absences de titulaires qui libèrent une place (règle de remplacement) [0021]`.

**Critères de sortie** :
- Script jetable (§11.1) : scénarios S1 à S7 conformes.
- `src/domain/remplacement.js` n'importe que `@/domain/absences.js` ; aucun import Vue/Vuex dans les fichiers du moteur ; aucun fichier de la liste « Ne pas toucher » (§5.6) modifié.
- `npm run build` réussit.

### Tâche 2 — Priorité à la titulaire rattachée & équité sans les remplaçantes

**Dépend de** : T1.

**Fichiers** :
- `src/domain/scheduling/contraintes/contrainteRemplacement.js` (**modifier**) — `creerContrainteRemplacementPrioritaire` (§5.3 b).
- `src/domain/scheduling/contraintes/index.js` (**modifier**) — `POIDS_SOUPLES_PAR_DEFAUT.remplacementPrioritaire = 3` (+ JSDoc du type), enregistrement de la souple.
- `src/domain/scheduling/contraintes/contrainteEquite.js` (**modifier**) — §5.4.
- `src/domain/scheduling/modele/messages.js` (**modifier**) — gabarit `REMPLACANTE_HABITUELLE_NON_PLANIFIEE`.
- `src/domain/libelles.js` (**modifier**) — cause `REMPLACANTE_HABITUELLE_NON_PLANIFIEE`.
- `docs/architecture/05-moteur-de-planification.md` (**modifier**) — catalogue des **souples** : « `remplacementPrioritaire` (la remplaçante rattachée à une titulaire absente passe avant les autres remplaçantes ; avertissement si elle est disponible mais non planifiée alors qu'une autre l'est [0021]) » ; entrée `equite` complétée : « remplaçantes exclues de la moyenne ; avec rythme : seul le dépassement est signalé [0021] ».

**Critères de sortie** : script jetable (§11.1) scénarios S8 à S11 ; `npm run build` réussit.

### Tâche 3 — Explications à l'écran (sélecteur, panneau, fiche personne)

**Dépend de** : T1 (`estRemplacante`, `absencesACouvrir`).

**Fichiers** :
- `src/components/planning/SelecteurPersonne.vue` (**modifier**) — §2.3, §6.2.
- `src/components/planning/PanneauConflits.vue` (**modifier**) — §2.2 (rappel), §6.3.
- `src/components/equipe/FormulairePersonne.vue` (**modifier**) — §2.4, §6.1.

**Critères de sortie** : critères §10 « Écrans » ; aucun import `@/domain/scheduling` dans ces composants ; `npm run build` réussit.

## 10. Critères d'acceptation

Jeu d'essai (ids GUID, fichier fabriqué hors dépôt) : cabinet ouvert du lundi au samedi ; deux tournées « Tournée A » et « Tournée B », 07:00 – 13:00, une personne chacune, tous les jours ouvrés ; une tournée « Après-midi » 14:00 – 19:00 (pour les demi-journées) ; titulaires **Claire Martin** et **Sophie Durand**, plus une troisième titulaire pour l'après-midi ; remplaçantes **Léa Roux** (« Remplace en priorité Claire Martin ») et **Zoé Blanc** (non rattachée). Période : semaine du lundi 05/10/2026 au samedi 10/10/2026.

**Génération**
- [x] Sans aucune absence : ni Léa ni Zoé n'apparaissent dans le planning généré ; une tournée que les titulaires ne peuvent pas assurer apparaît dans « Tournées non couvertes ».
- [x] Claire absente (journée entière) le mercredi 07/10 : une seule remplaçante travaille le 07, c'est **Léa** ; aucune remplaçante les autres jours.
- [x] Claire absente le **matin** du 07 seulement : la remplaçante n'est placée que sur une tournée du matin, jamais sur « Après-midi ».
- [x] Claire **et** Léa absentes le 07 : **Zoé** couvre ; aucun avertissement « Remplaçante habituelle non planifiée ».
- [x] Claire et Sophie absentes le 07 : au plus **deux** remplaçantes ce jour-là (Léa et Zoé).
- [x] Sophie (sans remplaçante rattachée) absente le 08 : **une** remplaçante au plus le 08 (Léa ou Zoé).
- [x] Claire archivée avec une absence le 07 : son absence ne libère plus de place (aucune remplaçante le 07 du fait de Claire).
- [x] Aucun message « Charge de travail mal répartie » ne vise Léa ou Zoé, et leur présence ne crée pas de tels messages pour les titulaires.
- [x] Équipe **sans** remplaçante : aucun nouveau message, génération inchangée par rapport à avant `0021`.

**Édition manuelle (`0011`)**
- [x] Ajouter Zoé le jeudi 08/10 (aucune absence) : l'ajout est accepté ; « Avertissements » affiche « Remplaçante planifiée sans absence à couvrir » avec le message « … Si c'est un appel exceptionnel, vous pouvez laisser ainsi ; sinon, retirez-la de cette case. » ; la case est surlignée en avertissement ; rien dans « Erreurs à corriger » ; le tableau de bord ne la compte pas « à résoudre ».
- [x] Verrouiller cette affectation puis « Régénérer » : Zoé reste le 08, l'avertissement aussi, et le moteur n'ajoute aucune autre remplaçante.
- [x] Glisser Léa (posée par le moteur le 07) vers le 09 sans absence : avertissement (geste manuel), pas d'erreur.
- [x] Planning généré avec Léa le 07 (absence de Claire), puis **suppression** de l'absence de Claire : « Erreurs à corriger » affiche le message « … retirez-la de cette case ou régénérez le planning » ; « Régénérer » retire Léa.
- [x] Claire absente le 07, Léa planifiée par le moteur : ajouter Zoé à la main le 07 → « Plus de remplaçantes que d'absences », en avertissement, avec les deux noms.
- [x] Claire absente le 07 : retirer Léa et poser Zoé à la main → « Remplaçante habituelle non planifiée » : « Claire Martin est absente le mercredi 07/10/2026. Léa Roux, qui la remplace d'habitude, n'est pas planifiée ce jour-là ; Zoé Blanc l'est à sa place. »
- [x] « Annuler » après chacun de ces gestes fait disparaître le signalement correspondant.

**Écrans**
- [x] Sélecteur « Ajouter une personne » sur une case du 08 (aucune absence) : Léa et Zoé portent la note « pas d'absence à remplacer sur ces horaires (choix possible) » et restent cliquables ; sur une case du 07 (Claire absente) : pas de note.
- [x] Sous « Tournées non couvertes », le rappel sur les remplaçantes s'affiche quand l'équipe compte une remplaçante active, et pas sinon.
- [x] Modale personne : en choisissant « Remplaçant », l'aide « …n'est planifiée automatiquement que pour couvrir l'absence d'une titulaire » apparaît (lue par le lecteur d'écran) ; l'aide « Remplace en priorité » indique que la titulaire est proposée en premier.
- [x] `npm run build` réussit.

## 11. Vérification

1. **Script jetable moteur (T1, T2)** — dans le dossier temporaire de session (**jamais dans le dépôt**, aucune sortie collée dans le dépôt) : un `.mjs` qui crée un serveur Vite (`createServer` depuis `node_modules/vite`, `root` = projet, `server.middlewareMode: true`), charge `src/domain/scheduling/index.js` et `src/domain/remplacement.js` par `ssrLoadModule` (les modules utilisent l'alias `@/`), puis rejoue sur l'entrée du §10 (ids `crypto.randomUUID()`, `seed` fixe, `budgetMs` réduit) :
   - **S1** sans absence → aucune affectation de remplaçante ;
   - **S2** Claire absente `JOURNEE` le 2026-10-07 → exactement une remplaçante le 07, aucune ailleurs ;
   - **S3** Claire absente `MATIN` → remplaçante seulement sur un segment qui recouvre le matin ;
   - **S4** Claire + Sophie absentes → ≤ 2 remplaçantes distinctes le 07 ;
   - **S5** `diagnostiquer` sur une affectation `MANUEL` de Zoé le 08 → `REMPLACANTE_SANS_ABSENCE` en `avertissement` ; même affectation en `AUTO` → `erreur` ;
   - **S6** Léa `AUTO` + Zoé `MANUEL` le 07 avec Claire seule absente → `REMPLACANTES_EN_SURNOMBRE` en `avertissement` ;
   - **S7** déterminisme : deux `genererPlanning` même graine → mêmes quadruplets (personne, tournée, date, segment) ;
   - **S8** (T2) S2 → la remplaçante du 07 est Léa ; Claire + Léa absentes → Zoé, sans `REMPLACANTE_HABITUELLE_NON_PLANIFIEE` ;
   - **S9** (T2) Zoé `MANUEL` le 07, Léa non planifiée, Claire absente → `REMPLACANTE_HABITUELLE_NON_PLANIFIEE` ciblant Léa ;
   - **S10** (T2) aucune `EQUITE_DESEQUILIBREE` visant une remplaçante ; remplaçante avec rythme : jamais `EQUITE_RYTHME_NON_ATTEINT` ;
   - **S11** (T2) équipe sans remplaçante : résultat identique à S7 rejoué sans les deux remplaçantes (aucun nouveau code de violation).
   Fermer le serveur Vite à la fin ; supprimer le script après usage.
2. `npm run build`.
3. **Recette navigateur** (MCP Playwright) : `npx vite --port 5199 --strictPort`, application sur `http://localhost:5199/idelia/#/`. Restaurer le jeu d'essai (fichier fabriqué dans le dossier temporaire de session, ids GUID) via Paramètres → « Restaurer » ; dérouler les critères §10. Les volets du panneau sont des `<details>` fermés : les ouvrir avant de lire ; le glisser-déposer nécessite des `DragEvent` synthétiques après « Modifier le planning ». Les données réelles du cabinet peuvent servir de contrôle de non-régression (génération d'un mois) mais **ne doivent jamais être copiées dans le dépôt**.
4. Clavier seul : sélecteur (notes lues), modale personne (aide du statut annoncée), volets du panneau.
5. Relecture `ui-ux` (messages, accords, rappel sous « Tournées non couvertes »), puis audit `security` (interpolation seule, aucun `v-html`, aucune persistance nouvelle).

## 12. Décisions à confirmer / risques

**Décisions prises (KISS, à valider)**

1. **Seules les absences de titulaires libèrent une place (R1)** — écart assumé avec la lettre du résumé ROADMAP (« celles d'une autre personne (titulaire ou remplaçante) »). Raison : une remplaçante ne travaille que pendant une absence ; si son absence ouvrait aussi une place, une remplaçante qui pose ses congés (cas courant pour dire « ne m'appelez pas cette semaine ») permettrait d'en planifier une autre **sans qu'aucune titulaire ne soit absente**, c'est-à-dire spontanément. Le cas visé par la ROADMAP reste couvert : si Léa, qui devait remplacer Claire, est absente, l'absence de **Claire** libère toujours la place et Zoé la prend. Pour revenir à la lettre, il suffit d'élargir le filtre de `absencesARemplacerLe` (un seul endroit).
2. **Plafond par jour (R3)** : « pas plus de remplaçantes distinctes un jour que de titulaires absentes ce jour-là » (une demi-journée d'absence compte pour une). Une même remplaçante peut assurer matin et reprise. Plus simple et plus lisible qu'un plafond par horaire.
3. **Priorité = contrainte souple avec avertissement visible (R4)**, plutôt qu'un simple ordre de tri : le moteur garde **une seule source de vérité** (`evaluer`), la recherche locale ne peut pas défaire la priorité en silence, et le gestionnaire voit quand la remplaçante attitrée a été écartée. Poids par défaut `3`.
4. **Sévérité selon l'origine de l'affectation (R5)** : `MANUEL` → avertissement (geste assumé, non compté « à résoudre ») ; `AUTO` → erreur (planning devenu incohérent). Aucune modification de la recherche locale nécessaire. Principe réutilisable par `0031` (dates de présence).
5. **Équité (R6)** : remplaçantes hors de la moyenne ; leur rythme, s'il est saisi, n'agit que comme plafond.
6. **Remplaçante sans titulaire, ou rattachée à une titulaire archivée / qui n'est plus titulaire** : traitée comme « sans priorité », toutes les autres règles s'appliquent.
7. **Aucune migration, aucun changement de store.**

**Questions ouvertes**

8. Une titulaire absente un jour où elle **ne travaille pas d'habitude** (temps partiel, jour non travaillé dans ses souhaits) libère quand même une place : le moteur ne connaît pas son « planning habituel ». Le plafond R3 limite l'effet à une remplaçante. À observer sur données réelles ; affinage possible plus tard (ignorer les absences tombant sur un jour non travaillé obligatoire).
9. Pendant une absence, une remplaçante (coût d'équité nul) passe désormais devant une titulaire au-dessus de la moyenne : c'est le comportement attendu (« une absence = une place pour une remplaçante ») ; le cabinet préfère-t-il au contraire faire travailler davantage les titulaires disponibles ?
10. L'avertissement de priorité peut viser une remplaçante attitrée **non absente mais empêchée** par une autre règle (repos légal, jours d'affilée, souhait obligatoire). Le message reste factuel (« n'est pas planifiée ce jour-là ») ; à confirmer en relecture `ui-ux`.

**Risques**

- **Davantage de tournées non couvertes** après `0021` dans les équipes qui comptaient sur les remplaçantes en temps normal : c'est la règle voulue, mais le gestionnaire doit le comprendre (rappel §2.2, note du sélecteur).
- **Cohérence `autoriseAffectation` ↔ `evaluer`** (architecture 05 §1) : même comptage `remplacantesSurAbsenceLe` des deux côtés ; à vérifier par S2 à S6.
- **Performance** : mémo des absences par date dans la fabrique ; titulaires écartées en O(1) par `autoriseAffectation`. La validation reste linéaire en nombre d'affectations.
- **Coordination** : `0031` ajoutera aussi une dure « présence » ; s'il atterrit avant, l'ordre d'enregistrement dans `creerContraintes` est indifférent.
