# Feature 0021 — Moteur : règles de remplacement

- **Statut** : En cours — plan initial livré (commit `9ceb772`), **révisé le 2026-10-14** (« titulaires d'abord ») : tâches T5 à T7 à implémenter.
- **Dépend de** : `0009` (moteur pur : contraintes, glouton, recherche locale, validation), `0020` (`Personne.titulaireId`, `joursTravaillesParMois`, équité à deux groupes). S'appuie aussi sur `0011` (éditeur : dépôt manuel jamais bloqué, verrou, régénération) et `0016` (grain = segment).
- **ADR liés** : [0007](../docs/adr/0007-generation-planning-hybride.md) (mode hybride : le geste manuel prime), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (moteur pur, modèle de contraintes unique), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, jours ISO). **Aucun écart d'ADR** ; le contrat `Contrainte` gagne une méthode facultative `coutGlobal` (architecture 05, §5.5 ci-dessous).

## Révision du 2026-10-14 — titulaires d'abord

### Pourquoi la révision

La règle livrée par le plan initial (« une remplaçante ne travaille **que** pour couvrir l'absence d'une titulaire », contrainte **dure**) est fausse métier. Recette sur les données réelles du cabinet (2 titulaires, 4 remplaçantes) : en novembre, **0 affectation de remplaçante** (24 avant `0021`) et **3 tournées non couvertes**. Le cabinet fait travailler ses remplaçantes **hors absences** : jours de repos des titulaires, week-ends, limites de jours d'affilée… sinon elles ne travailleraient presque jamais.

**Décision du porteur (validée)** — « Titulaires d'abord » : le moteur remplit d'abord avec les titulaires, dans le respect de **toutes** leurs règles (repos, jours d'affilée, souhaits, absences, rythme mensuel `joursTravaillesParMois` s'il est saisi) ; les remplaçantes prennent ensuite les tournées restantes. La remplaçante habituelle (`titulaireId`) passe avant les autres remplaçantes les jours où sa titulaire **ne travaille pas** (absente **ou** simplement non planifiée). Plus aucun avertissement « sans absence ».

### Ce qui est retiré

- La contrainte **dure** `remplacement-sur-absence` (une remplaçante candidate seulement sur absence de titulaire, plafond « pas plus de remplaçantes que de titulaires absentes »), et la gradation de sévérité selon `Affectation.origine`.
- Les codes de violation `REMPLACANTE_SANS_ABSENCE`, `REMPLACANTES_EN_SURNOMBRE` **et** `REMPLACANTE_HABITUELLE_NON_PLANIFIEE` (gabarits de `messages.js`, libellés de `libelles.js`) : plus aucun signalement propre aux remplaçantes, ni à la génération, ni après un placement manuel.
- Dans `src/domain/remplacement.js` : `absencesARemplacerLe`, `absencesSurHoraires`, `absencesACouvrir`, `titulairesAbsentes` (plus aucun appelant). Les exports ajoutés pour elles redeviennent privés : `horairesDeAffectation` (`contrainteAbsence.js`), `listeFrancaise` (`personnes.js`).
- Écrans : la note « pas d'absence à remplacer sur ces horaires (choix possible) » du sélecteur ; le rappel sous « Tournées non couvertes » du panneau.

### Ce qui change

- **Nouvelle souple « silencieuse » `titulaires-d-abord`** : chaque case confiée à une remplaçante coûte `2` (aucun message). Une titulaire disponible et « dans sa norme » passe donc toujours avant ; un souhait souple, une absence demandée ou un dépassement de rythme de la titulaire coûtent plus cher (≥ 3) : on appelle alors une remplaçante. La couverture prime toujours (une remplaçante légale est préférée à une case vide).
- **`remplacement-prioritaire` réécrite, silencieuse** : la priorité joue les jours où la titulaire rattachée **ne travaille pas** (absente ou non planifiée), plus seulement quand elle est absente. Poids `0,5`, aucun message.
- **Contrat `Contrainte`** : méthode facultative `coutGlobal(ctx) → number`, pénalité de génération **jamais affichée**, ajoutée au score de la recherche locale (sans elle, la recherche locale défairait « titulaires d'abord » en silence).
- **Équité, groupe « sans rythme »** : le coût marginal ne compte plus que la **surcharge déjà acquise** au-dessus de la moyenne des titulaires (suppression du « socle » d'une case, qui rendait une titulaire à l'équilibre plus chère qu'une remplaçante). `evaluer` inchangé.
- **Textes de la modale personne** reformulés selon la nouvelle règle.

### Ce qui reste (livré par T1–T4, conservé)

- Les remplaçantes restent **hors de la moyenne d'équité** ; avec un rythme saisi, seul « Rythme de travail dépassé » peut les viser (jamais « non atteint »).
- `estRemplacante` (`src/domain/remplacement.js`), le type `'REMPLACEMENT'`, le fichier `contrainteRemplacement.js` (contenu réécrit), l'enregistrement dans `creerContraintes`.
- Aucune migration, aucun changement de store, génération reproductible à graine égale.

## 1. Contexte & objectif

Le cabinet compte des titulaires et des remplaçantes (`Personne.statut`). Les remplaçantes doivent prendre les tournées que les titulaires **ne peuvent pas** assurer (repos, jours d'affilée, absences, souhaits, rythme mensuel), et seulement celles-là. Quand une titulaire ne travaille pas un jour donné, c'est en priorité « sa » remplaçante (rattachement `0020`) qui vient.

Résultat attendu : un planning généré où chaque titulaire est utilisée autant que ses règles le permettent, où les remplaçantes comblent les trous (week-ends, jours de repos des titulaires), et où plus aucune tournée ne reste vide alors qu'une remplaçante était disponible. Aucun message spécifique : le gestionnaire voit simplement un planning cohérent.

**Hors périmètre** : dates de présence `dateEntree`/`dateSortie` (`0031`) ; récap mensuel (`0024`) ; équité **entre remplaçantes** (voir §12 n° 10) ; notion de « tournée habituelle » d'une titulaire.

## 2. Écrans concernés

Aucun nouvel écran, aucune nouvelle route.

### 2.1 Planning (`/planning`) — génération et régénération

- Les titulaires sont planifiées d'abord ; les remplaçantes apparaissent sur les cases que les titulaires ne pouvaient pas prendre sans enfreindre une de leurs règles (ou sans dépasser leur rythme mensuel s'il est saisi).
- Les jours où une titulaire ne travaille pas, sa remplaçante habituelle est proposée avant les autres.
- Une tournée n'apparaît dans « Tournées non couvertes » que si **personne** (titulaire ou remplaçante) ne pouvait la prendre.

### 2.2 Planning — panneau « Points d'attention » (`PanneauConflits`)

- Aucune cause propre aux remplaçantes. Les causes « Remplaçante planifiée sans absence à couvrir », « Plus de remplaçantes que d'absences », « Remplaçante habituelle non planifiée » disparaissent.
- Le rappel sous « Tournées non couvertes » (« Une remplaçante n'est proposée automatiquement que pour remplacer une titulaire absente… ») est **retiré** : il décrivait l'ancienne règle.

### 2.3 Planning — mini-sélecteur « Ajouter une personne » (`SelecteurPersonne`)

La note « pas d'absence à remplacer sur ces horaires (choix possible) » est **retirée**. Les remplaçantes sont listées comme tout le monde (pastille, nom, « déjà N affectation(s) ce jour-là »). Les placer à la main ne déclenche aucun signalement.

### 2.4 Équipe (`/equipe`) — modale « Ajouter / Modifier une personne » (`FormulairePersonne`)

- Aide sous « Statut », visible **uniquement si « Remplaçant » est choisi** (inchangé : `id="personne-statut-aide"`, `aria-describedby` conditionnel), nouveau texte : « Le planning confie d'abord les tournées aux titulaires. Une personne remplaçante prend celles qui restent (jours de repos ou absences des titulaires, par exemple). »
- Aide de « Remplace en priorité (facultatif) », nouveau texte : « La titulaire que cette personne remplace d'habitude. Les jours où cette titulaire ne travaille pas, cette personne sera proposée avant les autres remplaçantes. » (la phrase conditionnelle « Ajoutez d'abord une personne titulaire… » est conservée).

## 3. Modèle de données touché

**Aucun changement persistant, aucune migration** (`CURRENT_SCHEMA_VERSION` inchangé).

- Remplaçante : `Personne.statut === 'REMPLACANT'` (existant). Rattachement : `Personne.titulaireId` (existant, `0020`), lu par le moteur.
- Rythme : `Personne.joursTravaillesParMois` (existant, `0020`), sert de **plafond** naturel (titulaire comme remplaçante).
- `Affectation.origine` n'est plus lu par les règles de remplacement.
- Volatil : les trois codes `REMPLACANTE_*` / `REMPLACANTES_EN_SURNOMBRE` n'existent plus ; aucun nouveau code.

## 4. Store (Vuex)

**Aucun module, getter, mutation ni action modifié.** `plannings/assemblerEntree` transmet déjà `personnes` (avec `statut`, `titulaireId`, `joursTravaillesParMois`) et `absences`. `SelecteurPersonne` et `PanneauConflits` cessent de lire `absences` / `personnes/actifs` pour les aides retirées (§6).

## 5. Domaine (logique pure)

### 5.1 Règles métier retenues

| # | Règle | Nature |
|---|---|---|
| R1 | **Titulaires d'abord** : pour une case, une titulaire autorisée par toutes les règles dures et « dans sa norme » (sous la moyenne des titulaires sans rythme, ou sous son rythme) est toujours préférée à une remplaçante. | souple silencieuse `titulaires-d-abord`, coût `2` par case de remplaçante |
| R2 | **Couverture d'abord** : une remplaçante autorisée est toujours préférée à une case non couverte. | existant (glouton : tout candidat légal est affecté ; couverture = dure) |
| R3 | **Règles de la titulaire avant R1** : souhait souple (3 / 5 / 8), absence demandée (5), dépassement de rythme (4 par jour de trop) coûtent plus que R1 → on appelle une remplaçante plutôt que d'enfreindre l'une d'elles. | ordre des poids (§5.3) |
| R4 | **Remplaçante habituelle** : un jour où sa titulaire ne travaille pas (absente ou non planifiée), la remplaçante rattachée passe avant les autres remplaçantes. | souple silencieuse `remplacement-prioritaire`, coût `0,5` |
| R5 | **Équité** : titulaires sans rythme équilibrées entre elles (coût = surcharge acquise, sans socle) ; remplaçantes hors moyenne ; rythme d'une remplaçante = plafond seulement. | souple `equite` (modifiée) |
| R6 | **Aucun signalement** propre aux remplaçantes, quelle que soit l'origine (moteur ou geste manuel). | — |

Remplaçante **sans titulaire rattachée**, ou rattachée à une personne archivée / qui n'est plus titulaire : R1, R2, R5 s'appliquent ; aucune priorité R4.

### 5.2 Échelle des coûts marginaux (cohérence des poids)

Coût ajouté pour confier **une case** à une personne (glouton : le candidat légal le moins cher l'emporte) :

| Situation | Coût |
|---|---|
| Titulaire « dans sa norme » (sous la moyenne du groupe sans rythme, ou sous son rythme) | **0** |
| Titulaire sans rythme déjà au-dessus de la moyenne des titulaires | 4 × surcharge (en cases) |
| Remplaçante habituelle (sa titulaire ne travaille pas ce jour-là) / remplaçante sans priorité en jeu | **2** |
| Autre remplaçante alors qu'une habituelle libre existe ce jour-là | **2,5** |
| Titulaire : souhait souple « Peu / Assez / Très important » | 3 / 5 / 8 |
| Titulaire avec rythme : 1er, 2e… jour au-delà du rythme | 4, 8, … |
| Absence demandée (non validée) | 5 |
| Case non couverte | interdit tant qu'un candidat légal existe |

Contraintes de calibrage : `titulairesDAbord + remplacementPrioritaire` (2,5) **<** plus petit souhait (3) **<** premier dépassement de rythme (4). La recherche locale voit les mêmes ordres de grandeur via `evaluer` (souhaits, rythme) et `coutGlobal` (R1, R4).

### 5.3 `src/domain/remplacement.js` (**modifier**)

Ne garde que `estRemplacante(personne)` (inchangée). Supprimer `absencesARemplacerLe`, `absencesSurHoraires`, `absencesACouvrir`, `titulairesAbsentes` et l'import de `@/domain/absences.js`. En-tête : « Identification des remplaçantes (feature 0021, révisée le 2026-10-14 : titulaires d'abord) ». Module pur, aucun import.

### 5.4 `src/domain/scheduling/contraintes/contrainteRemplacement.js` (**réécrire**)

Un fichier, `type: 'REMPLACEMENT'`, deux fabriques **souples silencieuses** (`evaluer` renvoie toujours `[]`). Imports : `estRemplacante` (`@/domain/remplacement.js`), `periodesSeChevauchent` (`@/domain/absences.js`). Plus d'import de `messages.js` ni de `contrainteAbsence.js`.

**Précalcul commun** `preparerRemplacement(entree)` (closure, recréé à chaque `creerContraintes`) :
- `remplacantes` : personnes actives `estRemplacante`, **ordre de `entree.personnes`** ; `remplacantesParId: Map` ;
- `titulairesParId: Map` : personnes actives de statut `'TITULAIRE'` ;
- `titulaireDe(r)` : `titulairesParId.get(r.titulaireId) ?? null` (archivée / plus titulaire → `null`) ;
- `habituellesDe(titulaireId)` : remplaçantes avec `titulaireId === titulaireId` (ordre de l'entrée) ; `titulairesAvecHabituelles` : titulaires (ordre de l'entrée) ayant au moins une habituelle ;
- `estDisponible(personne, date)` : aucune `Absence` `VALIDE` de la personne dont la période couvre `date` (`periodesSeChevauchent(a.dateDebut, a.dateFin, date, date)`) ;
- `travaille(personneId, date, ctx)` : `ctx.index.joursTravaillesParPersonne.get(personneId)?.has(date) ?? false`.

#### a) `creerContrainteTitulairesDAbord(poids = 2, entree)` — **souple**, `id: 'titulaires-d-abord'`, `granularite: 'cellule'`

- `coutMarginal(personneId)` : `remplacantesParId.has(personneId) ? poids : 0`.
- `coutGlobal(ctx)` : `poids ×` nombre total d'affectations des remplaçantes (`ctx.index.parPersonne`, parcours dans l'ordre de `remplacantes`). Les affectations verrouillées / manuelles y figurent : constante pendant la recherche locale, donc sans effet sur ses choix.
- `evaluer()` : `[]`.

#### b) `creerContrainteRemplacementPrioritaire(poids = 0.5, entree)` — **souple**, `id: 'remplacement-prioritaire'`, `granularite: 'global'`

Pour une date `d` et une titulaire `T` de `titulairesAvecHabituelles`, `T` **attend son habituelle** le jour `d` si : `!travaille(T.id, d)`, **aucune** de `habituellesDe(T.id)` ne travaille le jour `d`, et **au moins une** est `estDisponible` le jour `d`.

- `coutMarginal(personneId, demande, ctx)` — avec `r = remplacantesParId.get(personneId)`, `d = demande.date` :
  1. `r` introuvable (titulaire) → `0` ;
  2. `travaille(r.id, d)` → `0` (déjà présente ce jour-là) ;
  3. `titulaireDe(r)` existe et `!travaille(titulaireDe(r).id, d)` → `0` (elle remplace « sa » titulaire) ;
  4. s'il existe `T` (≠ titulaire de `r`) qui **attend son habituelle** le jour `d` → `poids` ; sinon `0`.
- `coutGlobal(ctx)` — dates où au moins une remplaçante travaille, **triées** ; pour chaque `T` (ordre de l'entrée) qui **attend son habituelle** le jour `d`, si au moins une **autre** remplaçante travaille ce jour-là (pas une habituelle de `T`, et dont la propre titulaire travaille ce jour-là ou qui n'en a pas) → `+ poids`.
- `evaluer()` : `[]`.

Effet : Claire ne travaille pas le mercredi → Léa (2) passe avant Zoé (2,5). Si Léa est absente, ou travaille déjà ce jour-là, Zoé n'est pas pénalisée. Les titulaires ne sont jamais concernées.

Limite connue (acceptée) : pendant le glouton, « ne travaille pas » s'apprécie sur le planning **en cours de construction** ; la recherche locale, qui évalue le planning complet via `coutGlobal`, corrige les écarts.

### 5.5 Contrat `Contrainte` — `coutGlobal` (**nouveau, facultatif**)

- `src/domain/scheduling/modele/types.js` (**modifier**) : ajouter au typedef `Contrainte` `@property {function(ContexteEvaluation): number} [coutGlobal] - Souples « silencieuses » : pénalité de génération sur le planning entier, jamais affichée ; ajoutée au score de la recherche locale (0021).` ; ramener `Violation.severite` à « Dure → `erreur` ; souple → `avertissement`. » (suppression de la mention « placement manuel », 0021 initiale).
- `src/domain/scheduling/heuristiques/rechercheLocale.js` (**modifier**) : dans `evaluerEtat`, après la boucle des violations d'une contrainte, `if (typeof contrainte.coutGlobal === 'function') score += contrainte.coutGlobal(ctx) ?? 0;` ; compléter le JSDoc de `evaluerEtat` (« … plus les `coutGlobal` des souples silencieuses »). Rien d'autre.
- **Non modifiés** : `glouton.js` et `scoring.js` (`coutMarginalAgrege` somme déjà tous les `coutMarginal` des souples), `validerPlanning.js`, `diagnostiquer.js` (le `score` affiché reste la somme des avertissements : une préférence silencieuse n'est pas un manquement), `genererPlanning.js`.

Justification (ADR 0008) : la règle reste portée par **un seul objet** `Contrainte` ; une préférence de génération sans manquement à signaler n'a rien à valider, donc rien à dupliquer. `coutMarginal` (glouton) et `coutGlobal` (recherche locale) sont deux lectures de la même préférence, à garder cohérentes.

### 5.6 `src/domain/scheduling/contraintes/contrainteEquite.js` (**modifier**)

- `coutMarginal`, branche « sans rythme » : remplacer `poids × max(0, chargeApres − moy)` par **`poids × max(0, chargeNormalisee(personne, nbActuel) − moy)`** (surcharge déjà acquise). Raison : l'ancienne formule fait payer `poids` (4) à une titulaire **à l'équilibre**, donc plus cher qu'une remplaçante (2) → les remplaçantes passeraient devant. La nouvelle aligne le groupe sans rythme sur le groupe avec rythme (0 tant qu'on reste dans la norme). L'ordre entre titulaires au-dessus de la moyenne est inchangé (décalage constant) ; seules les titulaires sous la moyenne se départagent désormais par le tirage seedé.
- Inchangé : exclusion des remplaçantes (`chargesDeLequipe`, `coutMarginal` → `0`), branche avec rythme, `evaluer` (`EQUITE_DESEQUILIBREE`, `EQUITE_RYTHME_DEPASSE`, « non atteint » jamais pour une remplaçante).
- En-tête JSDoc : remplacer « (elles ne travaillent que sur absence) » par « (elles prennent les tournées que les titulaires ne peuvent pas assurer, 0021) » et documenter la nouvelle formule.

### 5.7 `src/domain/scheduling/contraintes/index.js` (**modifier**)

- Retirer `creerContrainteRemplacementSurAbsence` (import + appel). Ajouter `creerContrainteTitulairesDAbord(poids.titulairesDAbord, entree)` juste **avant** `creerContrainteRemplacementPrioritaire(...)` (après l'équité).
- `POIDS_SOUPLES_PAR_DEFAUT` : `titulairesDAbord: 2`, `remplacementPrioritaire: 0.5` (au lieu de 3) ; JSDoc du type à jour.
- En-tête : « les **10 contraintes fixes** du cabinet (dont « titulaires d'abord » et « remplaçante habituelle », 0021) ». `TYPES_CONTRAINTE` inchangé (`'REMPLACEMENT'` reste).

### 5.8 Nettoyage

- `src/domain/scheduling/modele/messages.js` (**modifier**) : supprimer les gabarits `REMPLACANTE_SANS_ABSENCE`, `REMPLACANTES_EN_SURNOMBRE`, `REMPLACANTE_HABITUELLE_NON_PLANIFIEE` et l'import de `listeFrancaise`.
- `src/domain/libelles.js` (**modifier**) : supprimer les trois entrées correspondantes de `LIBELLES_CAUSE_VIOLATION`.
- `src/domain/scheduling/contraintes/contrainteAbsence.js` (**modifier**) : `horairesDeAffectation` redevient privée (retirer `export`).
- `src/domain/personnes.js` (**modifier**) : `listeFrancaise` redevient privée (retirer `export`), comportement inchangé.
- Vérifier par recherche qu'aucun fichier n'importe plus les symboles supprimés.

## 6. Composants

### 6.1 `src/components/planning/SelecteurPersonne.vue` (**modifier**)

Retirer : l'import `@/domain/remplacement.js`, `mapState('absences')`, le getter `tournees/byId` et `segmentCible` (s'ils ne servent qu'à la note), `aucuneAbsenceACouvrir`, la propriété `sansAbsenceACouvrir` (et son JSDoc), le `<span>` de la note, le paragraphe « Feature 0021 » de l'en-tête et la mention « les absences et la tournée ciblée » de l'accès store. Conserver la note « déjà N affectation(s) ce jour-là » et le style `.selecteur-personne-note`.

### 6.2 `src/components/planning/PanneauConflits.vue` (**modifier**)

Retirer : le `<p class="panneau-conflits-aide">`, `equipeAvecRemplacantes`, `mapGetters('personnes', …)`, l'import `estRemplacante`, la règle SCSS `.panneau-conflits-aide` et son commentaire. Le JSDoc d'en-tête redit l'accès store limité à `tournees/byId`.

### 6.3 `src/components/equipe/FormulairePersonne.vue` (**modifier**)

Textes d'aide §2.4 uniquement (statut, rattachement). Aucune logique, aucune validation.

## 7. Règles de validation

Aucune nouvelle saisie, aucune règle Vuelidate.

## 8. Points d'attention ergonomie

- **Rien à comprendre de plus** : le gestionnaire ne voit plus de message propre aux remplaçantes ; le planning « fait ce qu'on attend » (titulaires d'abord, remplaçante habituelle ensuite).
- **Geste manuel libre** : poser, déplacer, verrouiller une remplaçante ne déclenche aucun signalement ; seules les règles générales (absence, chevauchement, repos…) restent signalées. Annuler (1 niveau) inchangé.
- **Honnêteté de l'écran Équipe** : les deux aides décrivent la règle réelle, en vocabulaire du cabinet (« titulaires », « remplaçante », « jours de repos », « souhaits »). Jamais « contrainte », « poids », « coût ».
- **Plafonner une personne** : le levier compréhensible est le **rythme mensuel** (`0020`) ; c'est lui qui limite une titulaire (sinon chargée jusqu'à ses limites) ou une remplaçante (sinon répartie au hasard). À rappeler au porteur lors de la recette (§12 n° 9 et 10).
- **Accessibilité** : `aria-describedby` de l'aide du statut conservé ; aucune nouvelle cible cliquable.

## 9. Étapes d'implémentation

**Déjà livré (commit `9ceb772`, tâches T1 à T4)** : notamment la contrainte dure « sur absence » et `remplacement.js` (T1), la priorité et l'équité sans remplaçantes (T2), les aides à l'écran (T3). Ces livraisons sont en partie **défaites** par la révision ci-dessous ; les nouvelles tâches sont numérotées à partir de T5.

**Révision : 3 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). **T5 et T6 sont indépendantes** (fichiers disjoints) et peuvent être menées en parallèle ; **T7 après T5 et T6** (elle supprime des symboles encore utilisés par l'ancien code de T5/T6).

### Tâche 5 — Moteur : « titulaires d'abord » à la place de la règle dure

**Fichiers** :
- `src/domain/scheduling/contraintes/contrainteRemplacement.js` (**réécrire**) — §5.4.
- `src/domain/scheduling/contraintes/index.js` (**modifier**) — §5.7.
- `src/domain/scheduling/heuristiques/rechercheLocale.js` (**modifier**) — §5.5 (une ligne + JSDoc).
- `src/domain/scheduling/modele/types.js` (**modifier**) — §5.5.
- `src/domain/scheduling/contraintes/contrainteEquite.js` (**modifier**) — §5.6.
- `docs/architecture/05-moteur-de-planification.md` (**modifier**) :
  - §1 typedef `Contrainte` : ajouter `@property {(ctx) => number} [coutGlobal] // souples silencieuses : pénalité de génération jamais affichée (recherche locale) [0021]` et une puce : « `coutGlobal(ctx)` : facultatif, pour une **préférence de génération** sans manquement à signaler (`evaluer` → `[]`) ; ajouté au score de la recherche locale, jamais au `score` affiché ; doit rester cohérent avec `coutMarginal`. »
  - Objet `Violation` : `severite` → « dure->erreur ; souple->avertissement » (retirer la mention 0021 « placement manuel »).
  - Catalogue **dures** : retirer `remplacementSurAbsence`.
  - Catalogue **souples** : remplacer l'entrée `remplacementPrioritaire` par « `titulairesDAbord` (silencieuse : une case confiée à une remplaçante coûte un peu, moins qu'un souhait ou qu'un dépassement de rythme d'une titulaire — les titulaires sont planifiées d'abord, les remplaçantes prennent le reste [0021]), `remplacementPrioritaire` (silencieuse : les jours où sa titulaire ne travaille pas, la remplaçante rattachée passe avant les autres [0021]) » ; dans `equite`, remplacer « remplaçantes exclues de la moyenne ; avec rythme : seul le dépassement est signalé [0021] » par « remplaçantes exclues de la moyenne, rythme = plafond seulement ; coût marginal sans rythme = surcharge acquise au-dessus de la moyenne [0021] ».
  - §3 « Amélioration locale » : ajouter « Le score comparé = pénalités des avertissements + `coutGlobal` des souples silencieuses. »

**Critères de sortie** :
- Script jetable (§11.1) : scénarios S1 à S8 conformes.
- `validerPlanning` ne renvoie jamais de violation `contrainteId` `'titulaires-d-abord'`, `'remplacement-prioritaire'` ou `'remplacement-sur-absence'`.
- Aucun import Vue/Vuex dans le moteur ; `glouton.js`, `scoring.js`, `genererPlanning.js`, `validerPlanning.js`, `diagnostiquer.js` non modifiés.
- `npm run build` réussit.

### Tâche 6 — Écrans : retirer les aides de l'ancienne règle, reformuler la fiche personne

**Fichiers** :
- `src/components/planning/SelecteurPersonne.vue` (**modifier**) — §2.3, §6.1.
- `src/components/planning/PanneauConflits.vue` (**modifier**) — §2.2, §6.2.
- `src/components/equipe/FormulairePersonne.vue` (**modifier**) — §2.4, §6.3.

**Critères de sortie** : critères §10 « Écrans » ; plus aucun import de `@/domain/remplacement.js` dans ces deux composants planning ; aucun import `@/domain/scheduling` ; `npm run build` réussit.

### Tâche 7 — Nettoyage du domaine et de la documentation

**Dépend de** : T5, T6.

**Fichiers** :
- `src/domain/remplacement.js` (**modifier**) — §5.3.
- `src/domain/scheduling/modele/messages.js` (**modifier**) — §5.8.
- `src/domain/libelles.js` (**modifier**) — §5.8.
- `src/domain/scheduling/contraintes/contrainteAbsence.js` (**modifier**) — §5.8.
- `src/domain/personnes.js` (**modifier**) — §5.8.
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — ligne `statut` : « … ; un `REMPLACANT` reçoit les tournées que les titulaires ne peuvent pas assurer (titulaires d'abord) [0021] » ; ligne `titulaireId` : « … ; lu par le moteur : priorité les jours où cette titulaire ne travaille pas [0021] ».
- `docs/architecture/06-structure-du-code.md` (**modifier**) — ligne `remplacement.js  # identification des remplaçantes (estRemplacante) [0021]`.

**Critères de sortie** : recherche sur le dépôt (hors `features/`) sans résultat pour `REMPLACANTE_SANS_ABSENCE`, `REMPLACANTES_EN_SURNOMBRE`, `REMPLACANTE_HABITUELLE_NON_PLANIFIEE`, `absencesACouvrir`, `absencesARemplacerLe`, `titulairesAbsentes`, `remplacement-sur-absence` ; `npm run build` réussit ; script S1 rejoué sans erreur.

## 10. Critères d'acceptation

**Jeu d'essai** (ids GUID, fichier fabriqué hors dépôt) : cabinet ouvert du lundi au samedi, paramètres par défaut (max 6 jours d'affilée, 2 jours de repos par semaine) ; « Tournée A » et « Tournée B » 07:00 – 13:00, « Après-midi » 14:00 – 19:00, une personne chacune, du lundi au samedi ; titulaires **Claire Martin**, **Sophie Durand**, **Marc Petit** (sans rythme, sans souhait) ; remplaçantes **Léa Roux** (« Remplace en priorité Claire Martin ») et **Zoé Blanc** (non rattachée). Période générée : lundi 05/10/2026 → samedi 10/10/2026.
**Option « manque »** : ajouter « Tournée C » 07:00 – 13:00 (lundi–samedi, une personne) et régler Paramètres → nombre maximum de jours consécutifs = **2**.

« Titulaire empêchée » un jour J = absente ce jour-là, ou J ferait un 3e jour d'affilée (option manque) compte tenu de ses jours planifiés, ou J dépasserait son rythme mensuel s'il est saisi.

**Génération**
- [x] Jeu de base, sans absence : Léa et Zoé n'apparaissent pas ; aucune tournée non couverte ; aucun point d'attention mentionnant une remplaçante.
- [x] Jeu de base, Claire absente (journée) le mercredi 07/10 : Sophie et Marc assurent A, B et Après-midi le 07 ; Léa et Zoé n'apparaissent pas de la semaine.
- [x] Option manque : Léa et/ou Zoé apparaissent. **Chaque jour où une remplaçante travaille, chacune des trois titulaires travaille aussi ce jour-là ou est empêchée** (seule exception tolérée : une titulaire qui a déjà au moins 2 tournées de plus que la moyenne des titulaires). En pratique, chaque titulaire travaille 4 jours sur 6.
- [x] Option manque : une tournée n'est « non couverte » que si, ce jour-là, Léa et Zoé sont elles aussi déjà planifiées sur un horaire qui se chevauche ou empêchées.
- [x] Option manque, priorité : chaque jour où Claire ne travaille pas et où une remplaçante travaille, **Léa** est planifiée ce jour-là, sauf si elle est empêchée.
- [x] Option manque + Léa absente (journée) un jour où Claire ne travaille pas : Zoé prend la place ; aucun message ne parle de Léa ni de remplaçante.
- [x] Rythme : jeu de base + Sophie et Marc à **9 jours par mois** (≈ 2 jours attendus sur la semaine) : Sophie et Marc travaillent au plus 2 jours chacun, aucun « Rythme de travail dépassé » ; Claire travaille tous les jours ; Léa/Zoé ne tiennent que les tournées du matin restantes (en pratique 2 sur la semaine).
- [x] Aucun « Charge de travail mal répartie » ne vise Léa ou Zoé.
- [x] Équipe sans remplaçante (Léa et Zoé archivées), jeu de base : toutes les tournées couvertes, aucun nouveau type de point d'attention, aucun « Charge de travail mal répartie ».
- [x] « Régénérer » à l'identique deux fois de suite donne le même planning.

**Édition manuelle (`0011`)**
- [x] Jeu de base : retirer la titulaire de la Tournée A du jeudi 08/10 et y poser Zoé : accepté, aucun point d'attention ne concerne Zoé ou les remplaçantes ; « Annuler » rétablit l'état précédent.
- [x] Verrouiller cette affectation de Zoé puis « Régénérer » : Zoé reste le 08 et le moteur n'ajoute aucune autre remplaçante dans la semaine.

**Écrans**
- [x] Sélecteur « Ajouter une personne » : Léa et Zoé sont listées sans la note « pas d'absence à remplacer… » ; la note « déjà N affectation(s) ce jour-là » fonctionne toujours.
- [x] Panneau, volet « Tournées non couvertes » (provoquer un manque : option manque + Léa et Zoé absentes le mercredi) : plus de rappel sur les remplaçantes sous la liste.
- [x] Modale personne : en choisissant « Remplaçant », l'aide « Le planning confie d'abord les tournées aux titulaires… » apparaît et est lue par le lecteur d'écran ; l'aide « Remplace en priorité » dit « Les jours où cette titulaire ne travaille pas, cette personne sera proposée avant les autres remplaçantes. »
- [x] `npm run build` réussit.

**Critères du plan initial retirés par la révision** (traçabilité) : ~~sans absence, aucune remplaçante~~ ; ~~une seule remplaçante pendant l'absence de Claire, aucune ailleurs~~ ; ~~absence du matin → remplaçante seulement le matin~~ ; ~~au plus autant de remplaçantes que de titulaires absentes~~ ; ~~absence d'une titulaire archivée ne libère pas de place~~ ; ~~avertissement « Remplaçante planifiée sans absence à couvrir » (manuel) / erreur (automatique)~~ ; ~~« Plus de remplaçantes que d'absences »~~ ; ~~« Remplaçante habituelle non planifiée »~~ ; ~~note du sélecteur~~ ; ~~rappel sous « Tournées non couvertes »~~ ; ~~aides « …que pour couvrir l'absence d'une titulaire »~~.

## 11. Vérification

1. **Script jetable moteur (T5)** — dans le dossier temporaire de session (**jamais dans le dépôt**) : un `.mjs` qui crée un serveur Vite (`createServer` depuis `node_modules/vite`, `root` = projet, `server.middlewareMode: true`), charge `src/domain/scheduling/index.js` par `ssrLoadModule` (alias `@/`), rejoue le jeu du §10 (ids `crypto.randomUUID()`, `seed` fixe, `budgetMs` 300) et vérifie :
   - **S1** jeu de base → 0 affectation de remplaçante, 0 non-couverture ;
   - **S2** Claire absente `JOURNEE` le 2026-10-07 → 0 affectation de remplaçante, 0 non-couverture ;
   - **S3** option manque (`reglesCabinet.maxJoursConsecutifs = 2`, Tournée C) → au moins une affectation de remplaçante ; pour chaque date avec une remplaçante, chaque titulaire travaille ce jour-là ou est empêchée (absence, ou run > 2 si on ajoutait la date à ses jours) — afficher les éventuelles exceptions avec l'écart de charge à la moyenne ;
   - **S4** S3 : pour chaque date où Claire ne travaille pas et où une remplaçante travaille, Léa travaille ou est empêchée ; puis Léa absente un tel jour → Zoé le couvre ;
   - **S5** jeu de base + Sophie et Marc `joursTravaillesParMois: 9` → aucune `EQUITE_RYTHME_DEPASSE`, Sophie et Marc ≤ 2 jours ;
   - **S6** `validerPlanning` sur un planning contenant Zoé `MANUEL` le 2026-10-08 → aucune violation dont le `code` commence par `REMPLACANT` ni dont le `contrainteId` vaut `titulaires-d-abord` / `remplacement-prioritaire` / `remplacement-sur-absence` ;
   - **S7** déterminisme : deux `genererPlanning` même graine → mêmes quadruplets (personne, tournée, date, segment) ;
   - **S8** équipe sans remplaçante → génération complète, aucun nouveau code ; `coutGlobal` des deux contraintes = 0.
   Fermer le serveur Vite ; supprimer le script après usage.
2. `npm run build`.
3. **Recette navigateur** (MCP Playwright) : `npx vite --port 5199 --strictPort`, application sur `http://localhost:5199/idelia/#/`. Restaurer le jeu d'essai (fichier fabriqué dans le dossier temporaire de session, ids GUID) via Paramètres → « Restaurer » ; dérouler le §10. Les volets du panneau sont des `<details>` fermés : les ouvrir avant de lire ; glisser-déposer par `DragEvent` synthétiques après « Modifier le planning ».
4. **Contrôle sur données réelles** (novembre, mêmes réglages qu'à la recette du 2026-10-14) : affectations de remplaçantes **> 0** et réparties sur les jours de repos des titulaires / week-ends ; tournées non couvertes **< 3** (idéalement 0) ; comparer le nombre de « Rythme de travail non atteint » et « Charge de travail mal répartie » avant / après. Les données réelles ne sont **jamais** copiées dans le dépôt.
5. Clavier seul : modale personne (aide du statut annoncée), sélecteur, panneau.
6. Relecture `ui-ux` (textes de la modale), puis audit `security` (interpolation seule, aucun `v-html`, aucune persistance nouvelle).

## 12. Décisions à confirmer / risques

**Décisions prises (KISS, à valider)**

1. **Mécanisme = deux souples « silencieuses » + `coutGlobal`.** Écartés : une contrainte **dure** « pas de remplaçante si une titulaire est libre » (elle ne sait pas qu'un souhait ou un rythme devrait céder, et rendrait des cases vides) ; un simple **tri dans le glouton** (la recherche locale le défairait en silence) ; une violation **visible** à pénalité (un message par case de remplaçante = bruit). La règle reste dans un seul objet `Contrainte` (ADR 0008 respecté).
2. **Poids** : `titulairesDAbord = 2`, `remplacementPrioritaire = 0,5` (§5.2). Somme (2,5) sous le plus petit souhait (3) et sous le premier jour de dépassement de rythme (4) : un souhait ou un rythme de titulaire l'emporte toujours sur « titulaires d'abord » ; la couverture prime sur tout.
3. **Équité sans rythme sans « socle »** (§5.6) : changement **global** du coût marginal (pas seulement pour les équipes avec remplaçantes) — sans lui, une titulaire à l'équilibre (4) coûterait plus qu'une remplaçante (2). Conséquence : à graine égale, les plannings des équipes **sans** remplaçante peuvent différer d'avant (départages entre titulaires sous la moyenne) ; l'équilibre final est équivalent (alerte « mal répartie » inchangée), et les souhaits souples sont mieux respectés face à l'équité.
4. **Remplaçantes hors équité** (conservé) plutôt qu'une moyenne propre aux remplaçantes : une équité entre remplaçantes combattrait la priorité à l'habituelle (une case d'écart coûte 4, la priorité 0,5) et produirait des « Charge de travail mal répartie » structurelles (l'habituelle travaille par construction plus que les autres). Entre remplaçantes sans priorité en jeu, le départage est le tirage seedé ; le **rythme** d'une remplaçante, s'il est saisi, la plafonne.
5. **Aucun signalement**, y compris l'ancien « Remplaçante habituelle non planifiée » : avec 4 remplaçantes et des titulaires absentes ou au repos environ un jour sur deux, l'avertissement se déclencherait presque chaque fois que l'habituelle est retenue par ses propres règles (repos, jours d'affilée, souhaits) ou simplement par le tirage, sans action utile pour le gestionnaire. Placement manuel : jamais signalé.
6. **« Ne travaille pas ce jour-là » au niveau du jour** (aucune affectation ce jour-là), pas de la demi-journée : une titulaire présente l'après-midi seulement « travaille ». Plus simple et suffisant pour la priorité.
7. **Rattachement à une titulaire archivée ou qui n'est plus titulaire** : aucune priorité, toutes les autres règles s'appliquent.
8. **Aucune migration, aucun changement de store.**

**Questions ouvertes**

9. **Sans rythme saisi, une titulaire est chargée jusqu'à ses limites dures** (jours d'affilée, repos hebdomadaire, absences, souhaits obligatoires) : c'est le sens de « titulaires d'abord ». Le rythme mensuel (`0020`) est le levier pour la plafonner — à expliquer au porteur pendant la recette.
10. **Répartition entre remplaçantes** : au hasard (seedé) hors priorité. Si le cabinet la juge trop inégale, saisir un rythme pour chaque remplaçante, ou ouvrir une feature « équité entre remplaçantes » (poids faible, sous la priorité).
11. **Tolérance d'équité** : une titulaire sans rythme nettement plus chargée que ses collègues (au-delà d'une demi-case dans le glouton, et au-delà du seuil « mal répartie » — 2 cases — dans la recherche locale) peut céder une case à une remplaçante alors qu'elle était libre. Acceptable ?
12. **Équipes mixtes (rythme / sans rythme)** : avant, une titulaire avec rythme passait devant une titulaire sans rythme à l'équilibre (effet du « socle ») ; désormais elles se départagent au tirage. Risque : un peu plus de « Rythme de travail non atteint », corrigés en principe par la recherche locale — à surveiller au contrôle §11.4.

**Risques**

- **Budget de la recherche locale** : sur un mois réel, la correction des choix du glouton (priorité, titulaires d'abord) dépend du budget (`budgetMs`, ~200 ms). Contrôle §11.4 ; augmenter le budget seulement si nécessaire.
- **Cohérence `coutMarginal` ↔ `coutGlobal`** : deux lectures de la même préférence, à garder alignées (S3, S4).
- **Régression perçue** pour les équipes sans remplaçante (décision 3) : plannings différents à graine égale ; vérifier sur les données réelles qu'aucune alerte nouvelle n'apparaît en nombre.
- **Coordination** : `0031` (dates de présence) ajoutera une dure « présence » ; indépendante de cette révision.
