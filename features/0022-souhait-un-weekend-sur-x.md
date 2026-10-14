# Feature 0022 — Souhait « un weekend sur X »

- **Statut** : En cours (plan rédigé le 2026-10-14)
- **Dépend de** : `0005` (souhaits : `Preference` polymorphe, `FormulairePreference`, `SouhaitsView`), `0009` (moteur : `contraintePreference.js`, glouton MRV, recherche locale). Tient compte de la révision `0021` du 2026-10-14 (« titulaires d'abord », contrat `coutGlobal`).
- **ADR liés** : [0008](../docs/adr/0008-moteur-planification-module-pur.md) (moteur pur, une règle = une `Contrainte`), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (jours ISO 1-7, dates `"YYYY-MM-DD"`), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0013](../docs/adr/0013-icones-phosphor.md) (icônes). **Aucun écart d'ADR.**

## 1. Contexte & objectif

Sur le planning papier du cabinet, chaque personne suit une **trame de 3 semaines** : elle travaille un weekend, puis elle est en repos les deux weekends suivants. Aucun souhait actuel ne sait le dire : « Jours de repos souhaités samedi + dimanche » interdit **tous** les weekends.

La feature ajoute un **nouveau type de souhait** : « Travaille un weekend sur 3 (repère : le weekend du 04/07/2026) et se repose les autres weekends ». On saisit une **fréquence** (un weekend sur 2 à 6) et **un weekend travaillé** qui sert de repère ; le calendrier en déduit tous les autres, passés comme à venir. À la génération, la personne est **en repos** les weekends hors trame (obligatoire par défaut) et **planifiée en priorité** sur ses weekends travaillés.

**Hors périmètre** : jours fériés (`0023`, affichage seul) ; trame sur les jours de semaine ; signalement d'un weekend de trame non travaillé (voir §12 n° 9) ; vérification qu'un weekend est couvert par au moins une titulaire.

## 2. Écrans concernés

Aucune nouvelle route.

| Route | Écran | Changement |
|---|---|---|
| `/equipe/:id/souhaits` | Souhaits — modale « Ajouter / Modifier un souhait » (`FormulairePreference`) | Nouveau type au sélecteur, avec sa section de saisie. |
| `/equipe/:id/souhaits` | Souhaits — liste | Rien à coder : la phrase de résumé vient de `decrirePreference`. |
| `/planning` | Génération, panneau « Points d'attention » | Rien à coder : le moteur applique la trame ; une affectation sur un weekend de repos apparaît sous « Souhait non respecté : un weekend sur 2, 3, 4… » (libellé dérivé automatiquement). |

**Expérience visée** (modale de souhait, type « Un weekend sur 2, 3, 4… ») :

1. **« Tous les combien ? »** : liste « Travaille 1 weekend sur 2 » … « Travaille 1 weekend sur 6 », **« Travaille 1 weekend sur 3 » présélectionné** (trame du cabinet).
2. **« Date d'un weekend travaillé (un samedi ou un dimanche) »** : champ date (calendrier du navigateur). Aide : « Choisissez par exemple le samedi d'un weekend où cette personne travaille, passé ou à venir. Les autres weekends sont calculés automatiquement. » Le samedi comme le dimanche sont acceptés. Un jour de semaine est refusé avec un message qui dit quoi faire.
3. **Aperçu des prochains weekends**, dès que la saisie est valide : « À partir d'aujourd'hui, les prochains weekends de travail seront : samedi 24/10 et dimanche 25/10/2026 ; samedi 14/11 et dimanche 15/11/2026 ; samedi 05/12 et dimanche 06/12/2026. » C'est ce qui permet de vérifier, sans calcul, qu'on a reproduit la trame papier.
4. Nature **« Obligatoire »** proposée par défaut (modifiable, comme tous les souhaits). Aperçu habituel « Ce souhait signifie : Travaille un weekend sur 3 (repère : le weekend du 24/10/2026) et se repose les autres weekends ».

## 3. Modèle de données touché

Entité `Preference` (imbriquée dans `Personne`), [02 §Preference](../docs/architecture/02-modele-de-domaine.md).

| Élément | Changement |
|---|---|
| `TYPES_PREFERENCE` (`schema.js`) | Ajout de `'UN_WEEKEND_SUR_X'`, **en fin de liste**, pour garder le type par défaut du formulaire (`JOUR_OFF_RECURRENT`). |
| `params` du type `UN_WEEKEND_SUR_X` | `{ frequence: integer 2..6, weekendReference: "YYYY-MM-DD" }`. `weekendReference` est **toujours le samedi** du weekend repère : un dimanche saisi est ramené au samedi à l'enregistrement (`creerPreference`). Une valeur invalide est normalisée à `null` (aucun effet, aucun plantage). |

Exemple stocké : `{ type: 'UN_WEEKEND_SUR_X', nature: 'DURE', poids: 5, actif: true, params: { frequence: 3, weekendReference: '2026-07-04' }, … }`.

**`schemaVersion` / migrations : aucune.** `CURRENT_SCHEMA_VERSION` reste `6`. Ajouter une valeur à l'enum et une forme de `params` ne change pas le schéma du document : c'est l'extensibilité prévue par [02](../docs/architecture/02-modele-de-domaine.md) (« sans changer le schéma »). Aucun document existant ne contient ce type, et `verifierIntegrite` n'a rien à contrôler (aucune référence sortante). Compatibilité ascendante : une sauvegarde v6 contenant ce type, ouverte par une version antérieure d'Idelia, ne plante pas (le moteur ignore les types inconnus) ; voir §12 n° 6.

## 4. Store (Vuex)

**Aucun changement.** Les actions `personnes/ajouterPreference` et `personnes/modifierPreference` (`0005`) passent déjà par `creerPreference`, qui normalisera les nouveaux `params`. `plannings/assemblerEntree` transmet déjà les personnes avec leurs préférences au moteur.

## 5. Domaine (logique pure)

### 5.1 Règle métier retenue

| # | Règle | Mécanisme |
|---|---|---|
| R1 | **Weekend** = samedi (ISO 6) + dimanche (ISO 7) de la même semaine, identifié par la date de son **samedi**. Les jours de fermeture du cabinet n'ont pas de tournées : la règle ne s'applique qu'aux jours ouverts, sans traitement particulier. | `trameWeekend.js` |
| R2 | **Échéance** : le weekend de samedi `s` est travaillé si `n = diffDays(weekendReference, s) / 7` vérifie `((n % frequence) + frequence) % frequence === 0`. La formule vaut avant comme après le weekend repère (`n` négatif). | `trameWeekend.js` |
| R3 | **Weekend hors trame = repos.** Obligatoire (`DURE`) : la personne n'est jamais candidate un samedi ou un dimanche hors trame, et un placement manuel est signalé en **erreur**. Souhait (`SOUPLE`) : chaque affectation coûte le poids du souhait et est signalée en **avertissement**. | handler `UN_WEEKEND_SUR_X` de `contraintePreference.js` (nature de la donnée, comme les 8 autres types) |
| R4 | **Weekend de trame = travail favorisé, jamais imposé ni signalé.** Chaque jour ouvert d'un weekend de trame où la personne ne travaille pas encore coûte `1`. Il l'emporte donc sur une autre personne « à égalité ». Ce n'est jamais une obligation : une absence, le repos légal ou un manque de tournées peuvent l'empêcher sans produire d'erreur. | nouvelle souple silencieuse `trame-weekend` (`coutMarginal` + `coutGlobal`, patron `0021`) |

**Pourquoi R4 n'est pas dure** : une contrainte dure du moteur sait **interdire** (`autoriseAffectation`), pas **obliger**. Une obligation de travailler ne pourrait être contrôlée qu'après coup (`evaluer`, comme `MIN_JOURS_CONSECUTIFS`), et produirait des erreurs inévitables (congés posés ce weekend-là, repos légal, weekend sans tournée), contraires à l'invariant « aucune erreur dure évitable » ([05 §4](../docs/architecture/05-moteur-de-planification.md)). Cela reproduit déjà la trame papier : R3 libère les weekends hors trame, R4 et le tri MRV du glouton (les weekends, avec moins de candidats légaux, sont traités en premier) placent la personne sur les siens.

**Interaction avec « titulaires d'abord » (`0021`, révision du 2026-10-14)**, coûts marginaux par case :

| Situation un jour de weekend | Coût |
|---|---|
| Titulaire, weekend de sa trame, pas encore planifiée ce jour-là | **−3** (0 − 3), plus l'éventuelle surcharge d'équité |
| Titulaire sans souhait de trame | 0 |
| Remplaçante, weekend de sa trame | −1 (2 − 3), voire −0,5 avec la priorité `0021` |
| Remplaçante sans trame | 2 / 2,5 |
| Titulaire, weekend hors trame, souhait **Souhait** | poids du souhait (3 / 5 / 8) |
| Titulaire, weekend hors trame, souhait **Obligatoire** | non candidate |

> **Correctif de recette (2026-10-14)** — le plan initial fixait le bonus à **1**, sous le coût d'une remplaçante. En recette (graine 0 de l'interface), Sophie perdait le samedi de son weekend de trame : le glouton traite les weekends en premier (MRV), moment où l'équité voit la titulaire seule « chargée » (surcharge jusqu'à 4), si bien que 4 − 1 = 3 > 2 et la remplaçante l'emportait ; le repos hebdomadaire interdisait ensuite le samedi. Le bonus passe à **3** (correct de 2,5 à 4, vérifié sur les graines 0 à 10), et un terme de **réservation** s'ajoute : dans une semaine contenant des jours de trame non encore tenus, chaque jour de semaine travaillé au-delà de `7 − reposHebdoMin − jours de trame restants` coûte `poids`. Conséquence assumée : une remplaçante, **sur son propre weekend de trame**, passe devant une titulaire sans trame (elle a demandé ce weekend-là) ; hors de ses weekends de trame, « titulaires d'abord » est inchangé.

Avec des titulaires décalées d'une semaine chacune, les deux autres weekends reviennent aux remplaçantes, comme sur le papier.

**Pas assez de monde** : avec la nature « Obligatoire », la règle prime sur la couverture. La tournée apparaît sous « Tournées non couvertes », sans violation de souhait (même comportement que les autres souhaits obligatoires). Avec « Souhait », le moteur fait travailler la personne si personne d'autre ne peut, et le signale.

### 5.2 `src/domain/trameWeekend.js` (**créer**), module pur, n'importe que `dateUtil`

- `FREQUENCE_WEEKEND_MIN = 2`, `FREQUENCE_WEEKEND_MAX = 6`, `FREQUENCE_WEEKEND_DEFAUT = 3`.
- `samediDuWeekend(date)` → `"YYYY-MM-DD"` | `null` : `date` si `dateUtil.weekdayISO(date) === 6`, `addDays(date, -1)` si `7`, sinon `null`. Refuse une date non calendaire (ex. `2026-02-31`) par aller-retour `format(parse(d)) === d`. Tolère `null`, `''` ou une chaîne mal formée (→ `null`, contrôle `^\d{4}-\d{2}-\d{2}$`).
- `estTrameValide(params)` → boolean : `frequence` entier dans [2, 6] **et** `samediDuWeekend(weekendReference) !== null`.
- `estWeekendTravaille(date, params)` → `true` | `false` | `null` : `null` si `date` n'est pas un samedi/dimanche ou si la trame est invalide ; sinon R2 avec `s = samediDuWeekend(date)`, `ref = samediDuWeekend(params.weekendReference)`.
- `prochainsWeekendsTravailles(params, aPartirDe, nombre = 3)` → `string[]` (samedis, ordre croissant) : `[]` si trame invalide. Départ = samedi du weekend contenant `aPartirDe` s'il tombe un samedi/dimanche, sinon le samedi suivant. Premier travaillé = départ + 7 × `((-(n0 % f)) + f) % f` semaines (`n0` = écart en semaines entre `ref` et départ), puis pas de `7 × f` jours. `aPartirDe` est **injecté** par l'appelant (jamais `new Date()` ici).
- `libelleWeekend(samedi)` → « samedi 24/10 et dimanche 25/10/2026 » (`JJ/MM` puis `JJ/MM/AAAA` du dimanche, via `dateUtil.formatDateFr` ; gère le chevauchement de mois, ex. « samedi 31/10 et dimanche 01/11/2026 »).
- JSDoc complet, `@typedef {{frequence: number, weekendReference: string}} TrameWeekend`. Aucun `getDay()` : seulement `dateUtil.weekdayISO`.

### 5.3 `src/domain/schema.js` (**modifier**)

`TYPES_PREFERENCE` : ajouter `'UN_WEEKEND_SUR_X'` en dernier.

### 5.4 `src/domain/preferences.js` (**modifier**)

- `normaliserParams` : `case 'UN_WEEKEND_SUR_X': return { frequence: normaliserEntier(p.frequence), weekendReference: samediDuWeekend(p.weekendReference) };`.
- `META_TYPES_PREFERENCE.UN_WEEKEND_SUR_X` : `{ champs: 'weekendSurX', natureParDefaut: 'DURE', aide: "Indiquez tous les combien de weekends cette personne travaille, et un weekend où elle travaille : elle sera en repos les autres weekends." }`. Compléter le JSDoc de `MetaTypePreference.champs` (`'tournees'` | `'weekendSurX'`).
- `decrirePreference` : `case 'UN_WEEKEND_SUR_X'` → helper `decrireUnWeekendSurX(p)` :
  - trame valide : « Travaille un weekend sur 3 (repère : le weekend du 04/07/2026) et se repose les autres weekends » (date du **samedi** normalisé, `formatDateFr`) ;
  - fréquence absente : « Un weekend sur plusieurs : fréquence non précisée » ;
  - date absente ou invalide : « Travaille un weekend sur 3 (weekend de départ non précisé) et se repose les autres weekends ».
- **Correctif au passage** : le `default` de `decrirePreference` renvoie aujourd'hui « Préférence de tournée » pour un type inconnu (faux). Le remplacer par « Souhait non reconnu par cette version d'Idelia ».
- Mettre à jour les commentaires « 8 types » → « 9 types » (JSDoc `TYPES_PREFERENCE_OFFERTS`, `decrirePreference`).

### 5.5 `src/domain/libelles.js` (**modifier**)

- `LIBELLES_TYPE_PREFERENCE.UN_WEEKEND_SUR_X = 'Un weekend sur 2, 3, 4…'`. Le libellé de cause `PREFERENCE_UN_WEEKEND_SUR_X` (« Souhait non respecté : un weekend sur 2, 3, 4… ») en découle automatiquement dans `LIBELLES_CAUSE_VIOLATION`, rien à ajouter.
- `FREQUENCES_WEEKEND_OPTIONS` : `[{ valeur: 2, libelle: 'Travaille 1 weekend sur 2' }, …, { valeur: 6, libelle: 'Travaille 1 weekend sur 6' }]`, dérivée de `FREQUENCE_WEEKEND_MIN..MAX` (`trameWeekend.js`).
- Commentaire « 8 types » → « 9 types ».

### 5.6 Moteur : `src/domain/scheduling/contraintes/contraintePreference.js` (**modifier**)

Nouvelle entrée de `HANDLERS` (R3) :

```js
UN_WEEKEND_SUR_X: {
  code: 'PREFERENCE_UN_WEEKEND_SUR_X',
  granularite: 'cellule',
  estCandidatViole(params, demande) → estWeekendTravaille(demande.date, params) === false,
  listerCibles(params, ctx, personne) → affectations de la personne avec estWeekendTravaille(a.date, params) === false,
    mappées comme JOUR_OFF_RECURRENT : { cible: cibleAffectation(a), params: { date, heureDebut, heureFin } },
}
```

Import `estWeekendTravaille` de `@/domain/trameWeekend.js`. En-tête : « couvre les **9** `TYPES_PREFERENCE` ». Trame invalide (`null` partout) → aucune violation, toujours candidat.

### 5.7 Moteur : `src/domain/scheduling/modele/messages.js` (**modifier**)

Gabarit `PREFERENCE_UN_WEEKEND_SUR_X({ nomPersonne, descriptionPreference, date, heureDebut, heureFin })` :
« Claire Martin est affectée le samedi 24/10/2026 (07:00 – 13:00), alors que c'est un de ses weekends de repos (souhait : un weekend sur 3). » La fréquence est transmise par la violation (`params.frequence`) ; si elle est inconnue : « (souhait : un weekend sur X) ». Défensif comme les autres gabarits (valeurs par défaut neutres).

### 5.8 Moteur : `src/domain/scheduling/contraintes/contrainteTrameWeekend.js` (**créer**), R4

`creerContrainteTrameWeekend(poids = 3, entree)` : **souple silencieuse**, `id: 'trame-weekend'`, `type: 'TRAME_WEEKEND'`, `granularite: 'global'`, `evaluer() → []`.

- Précalcul : pour chaque personne **active** de `entree.personnes` (ordre de l'entrée), ses préférences `actif === true`, de type `UN_WEEKEND_SUR_X` et `estTrameValide(params)`, **quelle que soit leur nature** → `tramesParPersonne: Map<personneId, TrameWeekend[]>` (ordre stable).
- `estJourDeTrame(personneId, date)` : `true` si **au moins une** de ses trames donne `estWeekendTravaille(date, trame) === true`.
- `coutMarginal(personneId, demande, ctx)` : `-poids` si `estJourDeTrame(personneId, demande.date)` **et** si la personne ne travaille pas encore ce jour-là (`ctx.index.joursTravaillesParPersonne.get(personneId)?.has(demande.date)`), sinon `0`. C'est exactement la baisse de `coutGlobal` que produit l'affectation.
- `coutGlobal(ctx)` : `poids ×` nombre de couples (personne avec trame, date de `ctx.joursPeriode ?? []`) tels que `estJourDeTrame` et que la personne ne travaille pas ce jour-là. Parcours dans l'ordre des personnes, puis des dates triées (déterminisme). Les jours où la personne ne peut pas travailler (absence, aucune tournée) ajoutent une constante, sans effet sur les choix.
- Sans aucune trame dans l'équipe : `coutMarginal` et `coutGlobal` valent 0, et la génération est **strictement identique** à avant (le RNG ne consomme rien de plus).

### 5.9 Moteur : `src/domain/scheduling/contraintes/index.js` (**modifier**)

- Importer et instancier `creerContrainteTrameWeekend(poids.trameWeekend, entree)` juste après `creerContrainteRemplacementPrioritaire(...)` ; en-tête : « **11 contraintes fixes** » (+ « trame des weekends », 0022).
- `POIDS_SOUPLES_PAR_DEFAUT.trameWeekend = 3` (revu en recette, cf. §5.1) (+ JSDoc du type).
- `TYPES_CONTRAINTE` : ajouter `'TRAME_WEEKEND'` et `'PREFERENCE_UN_WEEKEND_SUR_X'`.

**Non modifiés** : `glouton.js`, `scoring.js`, `rechercheLocale.js` (somme déjà les `coutGlobal`), `validerPlanning.js`, `diagnostiquer.js`, `genererPlanning.js`.

## 6. Composants

### 6.1 `src/components/equipe/FormulairePreference.vue` (**modifier**)

Seul composant touché. Reste présentational (aucun accès store) ; toute la logique de calcul vient de `trameWeekend.js` / `preferences.js`.

- **Imports** : `FREQUENCES_WEEKEND_OPTIONS` (`libelles.js`) ; `samediDuWeekend`, `prochainsWeekendsTravailles`, `libelleWeekend`, `FREQUENCE_WEEKEND_DEFAUT` (`trameWeekend.js`) ; `dateUtil` (`utils/dates.js`).
- **`recopierParams`** : `case 'weekendSurX': return { frequence: p.frequence ?? FREQUENCE_WEEKEND_DEFAUT, weekendReference: p.weekendReference ?? '' };`.
- **Section dynamique** `v-else-if="metaType.champs === 'weekendSurX'"` (bloc `mb-4`, même présentation d'erreurs que le reste du formulaire) :
  1. `<label for="preference-frequence">Tous les combien ?</label>` + `<select id="preference-frequence" class="form-select formulaire-select" v-model.number="formulaire.params.frequence">` sur `FREQUENCES_WEEKEND_OPTIONS`.
  2. `<label for="preference-weekend">Date d'un weekend travaillé (un samedi ou un dimanche)</label>` + `<input id="preference-weekend" type="date" class="form-control" v-model="formulaire.params.weekendReference" @blur/@change="…$touch()">`, largeur limitée (`.formulaire-date`, ~14rem), `aria-describedby` = aide + erreur éventuelle. Aide (`form-text`, id `preference-weekend-aide`) : « Choisissez par exemple le samedi d'un weekend où cette personne travaille, passé ou à venir. Les autres weekends sont calculés automatiquement. »
  3. **Aperçu des prochains weekends** (`v-if="prochainsWeekends.length > 0"`, `role="status"`, classe `.formulaire-apercu-weekends` : fond blanc + bordure gauche primaire, distinct de « Ce souhait signifie ») : « À partir d'aujourd'hui, les prochains weekends de travail seront : » suivi d'une liste `<ul>` de `libelleWeekend(samedi)`. Icône `PhCalendarCheck` décorative (`aria-hidden`).
- **Computed** : `aujourdhui()` → `dateUtil.format(new Date())` (même patron que `FormulaireGeneration`) ; `prochainsWeekends()` → `metaType.champs === 'weekendSurX' ? prochainsWeekendsTravailles(this.formulaire.params, this.aujourdhui, 3) : []`.
- **`champsEnOrdre`** : pour `weekendSurX`, `{ validation: v$.formulaire.params.frequence, id: 'preference-frequence' }` puis `{ validation: v$.formulaire.params.weekendReference, id: 'preference-weekend' }`.
- **Soumission** : inchangée (`params` émis tels quels ; le dimanche est ramené au samedi par `creerPreference`).
- JSDoc de `typesProposes` : « les 9 types ».

### 6.2 Réutilisé tel quel

`SouhaitsView.vue` (résumé via `decrirePreference`, nature, pause, suppression), `ModaleBase`, `PanneauConflits` (groupement par `libelleCauseViolation`), store `personnes`.

## 7. Règles de validation

Vuelidate dans `FormulairePreference.validations()`, branche `champs === 'weekendSurX'` :

| Champ | Règle | Message FR |
|---|---|---|
| `params.frequence` | `required`, `integer`, `between(2, 6)` (liste fermée, défensif) | « Choisissez tous les combien de weekends cette personne travaille. » |
| `params.weekendReference` | `required` | « Choisissez la date d'un weekend où cette personne travaille. » |
| `params.weekendReference` | `estSamediOuDimanche` : `(v) => !v \|\| samediDuWeekend(v) !== null` | « Cette date n'est ni un samedi ni un dimanche : choisissez le samedi ou le dimanche d'un weekend travaillé. » |

Validation à la soumission et après interaction, jamais sur un formulaire vierge ; saisie conservée si invalide ; focus sur le premier champ en erreur (mécanisme existant). **Pas de magnétisme silencieux** : un mercredi n'est pas déplacé vers un weekend (on ne saurait pas lequel).

## 8. Points d'attention ergonomie

- **Vocabulaire du cabinet** : « weekend travaillé », « en repos », « tous les combien ». Jamais « fréquence », « référence », « échéance », « modulo », « trame » à l'écran (« trame » reste interne au code).
- **Pas de calcul demandé** : on choisit un weekend qu'on connaît (sur le planning papier) et l'aperçu montre les 3 prochains. C'est le principal garde-fou contre une erreur de décalage d'une semaine.
- **Samedi ou dimanche indifférent** : on peut cliquer l'un ou l'autre jour du weekend. Seul un jour de semaine est refusé, avec un message qui dit quoi faire.
- **Liste plutôt que champ numérique** pour la fréquence : pas de saisie libre, pas de valeur absurde, phrase complète (« Travaille 1 weekend sur 3 »).
- **Résumé relisible** dans la liste des souhaits et dans le panneau du planning (même phrase, via `decrirePreference`).
- **Réversible** : modifier, mettre en pause (« Pris en compte »), supprimer avec confirmation, comme tout souhait.
- **Accessibilité** : `label` sur chaque champ, `aria-describedby` (aide + erreur), aperçu `role="status"`, cibles ≥ 44 px (`.form-control`/`.form-select` déjà dimensionnés), icône décorative masquée, erreurs icône + texte (jamais la couleur seule).
- **Honnêteté** : avec « Obligatoire », la personne ne sera jamais planifiée sur un weekend de repos, quitte à laisser une tournée non couverte. L'aide générale « Toujours respecté par le planning » le dit déjà ; à rappeler au porteur pendant la recette (§12 n° 5).

## 9. Étapes d'implémentation

Trois tâches, une par sous-agent `dev-front` ([workflow](../docs/instructions/workflow-implementation.md)). **T1 d'abord** ; puis **T2 et T3 en parallèle** (fichiers disjoints, toutes deux dépendent de T1 seulement).

```
T1 (domaine) ──┬── T2 (moteur)
               └── T3 (formulaire)
```

> **Avant T2** : capturer la ligne de base de non-régression sur les données réelles (§11.2, étape a), sur le code d'avant T2.

### Tâche 1 — Domaine : trame des weekends, type de souhait, libellés

**Fichiers** :
- `src/domain/trameWeekend.js` (**créer**) — §5.2.
- `src/domain/schema.js` (**modifier**) — §5.3.
- `src/domain/preferences.js` (**modifier**) — §5.4.
- `src/domain/libelles.js` (**modifier**) — §5.5.
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — table « PreferenceType → params » : ligne `UN_WEEKEND_SUR_X` | `{ frequence: integer 2..6, weekendReference: "YYYY-MM-DD" (samedi) }` | un weekend sur 3, dont celui du 04/07/2026 [0022].
- `docs/architecture/06-structure-du-code.md` (**modifier**) — ligne `trameWeekend.js   # weekends travaillés / de repos d'une trame « un weekend sur X » [0022]` à côté de `rythmeMensuel.js`.

**Critères de sortie** (script jetable `ssrLoadModule`, §11.1) :
- `samediDuWeekend('2026-07-04') === '2026-07-04'`, `('2026-07-05') === '2026-07-04'`, `('2026-07-08') === null`, `('') === null`, `(null) === null`.
- Trame `{ frequence: 3, weekendReference: '2026-07-04' }` : `estWeekendTravaille` vaut `true` le 04/07, le 05/07, le 25/07, le 17/10, le 18/10 et le 13/06/2026 (avant le repère) ; `false` le 11/07, le 18/07 et le 20/06/2026 ; `null` le 08/07/2026 (mercredi).
- `prochainsWeekendsTravailles({ frequence: 3, weekendReference: '2026-07-04' }, '2026-10-14', 3)` → `['2026-10-17', '2026-11-07', '2026-11-28']` ; depuis `'2026-10-18'` (dimanche) → commence à `'2026-10-17'` ; trame invalide → `[]`.
- `libelleWeekend('2026-10-31') === 'samedi 31/10 et dimanche 01/11/2026'`.
- `creerPreference({ type: 'UN_WEEKEND_SUR_X', params: { frequence: '3', weekendReference: '2026-10-25', joursSemaine: [1] } })` → `nature === 'DURE'`, `params` **exactement** `{ frequence: 3, weekendReference: '2026-10-24' }`.
- `decrirePreference` produit les trois phrases du §5.4 ; un type inconnu → « Souhait non reconnu par cette version d'Idelia ».
- `libelleTypePreference('UN_WEEKEND_SUR_X')` non vide ; `libelleCauseViolation('PREFERENCE_UN_WEEKEND_SUR_X')` commence par « Souhait non respecté : » ; `FREQUENCES_WEEKEND_OPTIONS` a 5 entrées (2 à 6).
- Aucun import Vue/Vuex, aucun `getDay()` hors `dateUtil`, aucun `new Date()` dans `trameWeekend.js` ; `npm run build` réussit.

### Tâche 2 — Moteur : repos hors trame et priorité sur les weekends de trame

**Dépend de** : T1. **Parallélisable avec** T3.

**Fichiers** :
- `src/domain/scheduling/contraintes/contraintePreference.js` (**modifier**) — §5.6.
- `src/domain/scheduling/modele/messages.js` (**modifier**) — §5.7.
- `src/domain/scheduling/contraintes/contrainteTrameWeekend.js` (**créer**) — §5.8.
- `src/domain/scheduling/contraintes/index.js` (**modifier**) — §5.9.
- `docs/architecture/05-moteur-de-planification.md` (**modifier**) — catalogue **souples** : ajouter « `trameWeekend` (silencieuse : sur un weekend de sa trame « un weekend sur X », la personne passe avant les autres, sans jamais y être obligée [0022]) » ; ajouter une phrase après le catalogue : « Le souhait « un weekend sur X » est dur ou souple selon sa nature (repos les weekends hors trame) [0022]. » ; §7 arborescence : `contrainteTrameWeekend.js`.

**Critères de sortie** : scénarios S1 à S8 du §11.1 conformes ; non-régression §11.2 (b) **strictement identique** ; aucun import Vue/Vuex ; fichiers « non modifiés » du §5.9 intacts ; `npm run build` réussit.

### Tâche 3 — Formulaire de souhait : saisie « un weekend sur X »

**Dépend de** : T1. **Parallélisable avec** T2.

**Fichiers** :
- `src/components/equipe/FormulairePreference.vue` (**modifier**) — §6.1, §7.

**Critères de sortie** : critères §10 « Saisie » vérifiables dans le navigateur (le moteur n'est pas requis) ; aucune logique de calcul de dates dans le composant (uniquement des appels à `trameWeekend.js` ; `new Date()` seulement dans `aujourdhui`, via `dateUtil.format`) ; aucun accès store ; `npm run build` réussit.

## 10. Critères d'acceptation

**Jeu d'essai** (fichier fabriqué dans le dossier temporaire de session, **jamais dans le dépôt**, ids `crypto.randomUUID()`) : cabinet ouvert **7 jours sur 7**, max 6 jours d'affilée, 2 jours de repos par semaine. Tournées « Tournée A » et « Tournée B » 07:00 – 13:00, « Après-midi » 14:00 – 19:00, une personne chacune, lundi → dimanche. Titulaires **Claire Martin**, **Sophie Durand**, **Marc Petit** (sans rythme) ; remplaçantes **Léa Roux** (rattachée à Claire) et **Zoé Blanc**. Souhaits « Un weekend sur 3 », Obligatoire :
- Claire : weekend repère **04/07/2026** (avant la période) → weekends travaillés 17-18/10, puis 07-08/11 ;
- Sophie : repère **21/11/2026** (après la période) → 10-11/10 et 31/10-01/11 ;
- Marc : repère saisi **dimanche 25/10/2026** (enregistré au samedi 24/10) → 24-25/10.

Période générée : **lundi 05/10/2026 → dimanche 01/11/2026**.

**Saisie (T1 + T3)**
- [x] Le sélecteur « Type de souhait » propose « Un weekend sur 2, 3, 4… » ; à sa sélection, la nature passe à « Obligatoire », la fréquence vaut « Travaille 1 weekend sur 3 », l'aide du type s'affiche.
- [x] Saisir un **mercredi** puis « Enregistrer » : message « Cette date n'est ni un samedi ni un dimanche… », rien n'est enregistré, la saisie est conservée, le focus va sur la date.
- [x] Date vide puis « Enregistrer » : « Choisissez la date d'un weekend où cette personne travaille. »
- [x] Saisir le **dimanche 25/10/2026** pour Marc : l'aperçu liste trois weekends (« samedi 24/10 et dimanche 25/10/2026 » si on est avant cette date, sinon les suivants, toutes les 3 semaines) ; après enregistrement, la liste affiche « Travaille un weekend sur 3 (repère : le weekend du 24/10/2026) et se repose les autres weekends » + repère « Obligatoire » ; « Modifier » montre le **samedi** 24/10/2026.
- [x] Changer la fréquence à « Travaille 1 weekend sur 2 » : l'aperçu se met à jour immédiatement (pas de 14 jours).
- [x] Recharger la page : le souhait est conservé (`params` = `{ frequence: 3, weekendReference: '2026-10-24' }` dans `localStorage`).
- [x] Clavier seul : sélecteur, liste de fréquence, champ date et boutons atteignables ; erreurs lues (aria) ; aucune information par la seule couleur.

**Génération (T2)**
- [x] Sur chacun des 8 jours de weekend de la période, **aucune titulaire hors de sa trame** n'est planifiée (ex. ni Claire ni Marc le 10-11/10).
- [x] La titulaire dont c'est le weekend (10-11/10 Sophie, 17-18/10 Claire, 24-25/10 Marc, 31/10-01/11 Sophie) travaille **les deux jours** ; les autres tournées du weekend sont tenues par Léa et/ou Zoé ; aucune tournée non couverte ; aucun point d'attention « Souhait non respecté : un weekend sur 2, 3, 4… ».
- [x] Les jours de semaine restent tenus d'abord par les titulaires (règle `0021`) ; aucun point d'attention nouveau par rapport à une génération sans ces souhaits, hors éventuels « Charge de travail mal répartie » préexistants.
- [x] **Pas assez de monde** : archiver Léa et Zoé puis régénérer → sur chaque jour de weekend, la tournée que la titulaire de la trame ne peut pas tenir apparaît dans « Tournées non couvertes » ; **aucune** autre titulaire n'est planifiée ces weekends ; aucune violation « Souhait non respecté ».
- [x] Même situation, passer le souhait de Claire en **« Souhait »** (Très important) puis régénérer : Claire peut apparaître sur des weekends hors de sa trame, chaque fois signalée sous « Souhait non respecté : un weekend sur 2, 3, 4… » par une phrase du type « Claire Martin est affectée le samedi 10/10/2026 (07:00 – 13:00), alors que c'est un de ses weekends de repos (souhait : un weekend sur 3). » ; moins de tournées non couvertes qu'à l'étape précédente.
- [x] Mettre le souhait de Marc **en pause** puis régénérer : Marc peut à nouveau être planifié n'importe quel weekend.
- [x] Claire **absente** (congés) du 17 au 18/10 : la génération réussit, aucune erreur, aucun message à propos de son weekend de trame.
- [x] « Régénérer » à l'identique deux fois de suite donne le même planning.

**Édition manuelle (`0011`)**
- [x] Déposer Sophie sur la Tournée A du **samedi 17/10** (weekend de repos pour elle, souhait Obligatoire) : le dépôt est accepté (geste manuel libre) et une **erreur** apparaît sous « Souhait non respecté : un weekend sur 2, 3, 4… » ; « Annuler » la retire.

**Non-régression**
- [x] Données réelles (§11.2) : à graine égale, planning **identique** avant/après la feature tant qu'aucun souhait « un weekend sur X » n'est saisi.
- [x] `npm run build` réussit.

## 11. Vérification

1. **Script jetable** (dossier temporaire de session, **jamais dans le dépôt**) : un `.mjs` crée un serveur Vite (`createServer` depuis `node_modules/vite`, `root` = projet, `server.middlewareMode: true`), charge par `ssrLoadModule` `src/domain/trameWeekend.js`, `src/domain/preferences.js`, `src/domain/libelles.js` (critères T1) puis `src/domain/scheduling/index.js`, et rejoue le jeu du §10 (ids `crypto.randomUUID()`, `seed` fixe, `budgetMs` 300) :
   - **S1** jeu de base → pour chaque date samedi/dimanche, l'ensemble des titulaires planifiées ⊆ {titulaire de la trame ce weekend-là} ; aucune violation `PREFERENCE_UN_WEEKEND_SUR_X` ; 0 non-couverture ;
   - **S2** la titulaire de la trame travaille chacun des 8 jours de weekend (afficher les exceptions avec leur cause probable : repos légal, chevauchement) ;
   - **S3** Léa et Zoé archivées → au moins une non-couverture chaque jour de weekend, aucune titulaire hors trame un weekend, aucune violation `PREFERENCE_UN_WEEKEND_SUR_X` (des non-couvertures en semaine, dues au repos légal, sont tolérées et listées) ;
   - **S4** S3 + souhait de Claire `SOUPLE` poids 8 → violations `PREFERENCE_UN_WEEKEND_SUR_X` en `avertissement` pour chaque affectation de Claire hors trame, messages FR sans `undefined` ; non-couvertures < S3 ;
   - **S5** `validerPlanning` sur S1 + une affectation `MANUEL` de Sophie le 2026-10-17 → exactement une violation `PREFERENCE_UN_WEEKEND_SUR_X`, `severite: 'erreur'`, `cible.date === '2026-10-17'` ;
   - **S6** Claire absente (`VALIDE`, `JOURNEE`) du 2026-10-17 au 2026-10-18 → génération sans erreur dure, Claire absente du planning ces deux jours ;
   - **S7** déterminisme : deux générations à graine égale → mêmes quadruplets (personne, tournée, date, segment) ;
   - **S8** `validerPlanning` ne renvoie jamais de violation `contrainteId === 'trame-weekend'` ; `coutGlobal` de `trame-weekend` = 0 sur une équipe sans souhait de trame.
   Fermer le serveur Vite, supprimer le script après usage.
2. **Non-régression sur les données réelles** `files/idelia-sermet.json` (lues par le script, **jamais copiées** dans le dépôt ni dans le plan) :
   a. **avant T2** (code actuel) : générer novembre 2026 (même graine, même budget que la recette `0021`), enregistrer les quadruplets triés dans un fichier du dossier temporaire de session ;
   b. **après T2** : même génération, comparer → **identique** (aucun souhait de trame dans les données) ;
   c. puis, en mémoire uniquement, ajouter « un weekend sur 3 » Obligatoire aux deux titulaires (repères décalés d'une semaine) → aucune titulaire hors trame un weekend, nombre de tournées non couvertes relevé et commenté (comparé à b).
3. `npm run build`.
4. **Recette navigateur** (MCP Playwright) : `npx vite --port 5199 --strictPort`, application sur `http://localhost:5199/idelia/#/`. Restaurer le jeu d'essai via Paramètres → « Restaurer », dérouler le §10 (saisie des trois souhaits par l'interface, dont Marc par le dimanche). Volets du panneau = `<details>` fermés : les ouvrir avant lecture ; glisser-déposer par `DragEvent` synthétiques après « Modifier le planning ».
5. Relecture `ui-ux` (libellé du type, aides, aperçu, messages), puis audit `security` (interpolation seule, aucun `v-html`, aucune persistance nouvelle).

## 12. Décisions à confirmer / risques

**Décisions prises (KISS, à valider)**

1. **Weekend = samedi + dimanche** (ISO 6 et 7), repéré par son samedi. Un jour de fermeture n'a pas de tournées, donc rien de spécial à coder. Si le cabinet est fermé le dimanche (réglage par défaut), seul le samedi compte. S'il est fermé les deux jours, le souhait est sans effet ; aucun avertissement n'est affiché (KISS). À revoir si cela arrive.
2. **Deux faces, deux natures** : le **repos** hors trame suit la nature du souhait (Obligatoire par défaut). Le **travail** sur les weekends de trame est une **priorité silencieuse** (bonus 1 par jour), jamais une obligation ni un signalement. Raison : le moteur ne sait pas obliger (§5.1) ; une obligation produirait des erreurs inévitables (congés, repos légal).
3. **Repère = n'importe quel samedi ou dimanche**, passé ou futur, ramené au samedi à l'enregistrement. Un jour de semaine est **refusé** plutôt que déplacé (un mercredi est à égale distance de deux weekends).
4. **Fréquence de 2 à 6**, par liste. « 1 sur 1 » ne contraint rien ; au-delà de 6, aucun besoin connu.
5. **Obligatoire + manque de personnel → tournée non couverte**, pas de violation (comme les autres souhaits obligatoires). Pour que le moteur puisse « dépanner » avec la personne, passer le souhait en « Souhait ». À expliquer au porteur pendant la recette.
6. **Aucune migration.** Nouveau type et nouvelle forme de `params`, sans changement de schéma ([02](../docs/architecture/02-modele-de-domaine.md), « Extensibilité »). Risque résiduel : une sauvegarde ouverte par une version plus ancienne d'Idelia ignore le souhait sans prévenir (site statique : tout le monde a la dernière version, risque faible). Le libellé de repli de `decrirePreference` est corrigé (§5.4).
7. **Poids du bonus = 3** (revu en recette, initialement 1 — voir l'encadré « Correctif de recette » du §5.1) + terme de **réservation** de la semaine du weekend de trame. Une remplaçante passe devant une titulaire sans trame **uniquement sur son propre weekend de trame** ; entre remplaçantes, celle dont c'est le weekend passe devant.
8. **Plusieurs souhaits de trame pour une même personne** : rien ne l'empêche. Chacun s'applique : les repos se cumulent, le bonus vaut si l'une des trames tombe ce weekend-là. Aucun contrôle croisé entre souhaits (cohérent avec `0005`).

**Questions ouvertes**

9. **Signaler un weekend de trame non travaillé ?** Non retenu, car ce serait du bruit dès qu'il y a des congés ou le repos légal. Si le cabinet le demande, ce serait un avertissement léger (à rapprocher de `0025`).
10. **Libellé du type** « Un weekend sur 2, 3, 4… » et libellés « Tous les combien ? » / « Date d'un weekend travaillé (un samedi ou un dimanche) » : à valider par la relecture `ui-ux`.
11. **Vendredi soir / lundi** : certains cabinets comptent le vendredi soir dans le weekend. Non géré : la trame ne porte que sur le samedi et le dimanche.

**Risques**

- **Repos légal autour du weekend de trame** : MRV place les weekends en premier, puis les jours de semaine s'adaptent. Si `maxJoursConsecutifs` est bas, la titulaire peut perdre un jour de son weekend au profit d'une remplaçante (sans message). C'est contrôlé par S2 ; à surveiller sur les données réelles (§11.2 c).
- **Cohérence `coutMarginal` / `coutGlobal`** de `trame-weekend` : deux lectures de la même règle, à garder alignées (S1, S2).
- **Charge des remplaçantes le weekend** : avec toutes les titulaires en « un weekend sur 3 », environ 2 weekends sur 3 sont tenus par les remplaçantes, entre elles au hasard (seedé) hors priorité `0021`. C'est le comportement attendu ; le rythme mensuel (`0020`) reste le levier de plafonnement.
