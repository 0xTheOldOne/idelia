# ADR 0017 — Modélisation des tournées coupées (segments horaires)

- **Statut** : Accepté
- **Date** : 2026-07-10

## Contexte

Le métier distingue deux formats de tournée :

- **Petite tournée** — journée continue (ex. `07:00 → 13:30`, le matin).
- **Grosse tournée** — **journée coupée** : une vacation le matin (`07:00 → 13:30`) **puis** une reprise le soir (ex. `17:00 → 20:00`). La coupure du milieu de journée **n'est pas un repos**.

Deux exigences supplémentaires cadrent le besoin :

1. Une grosse tournée peut être assurée par **la même personne** matin et soir (cas nominal), **ou partagée entre deux personnes** (matin = X, soir = Y) lorsque la personne du matin a un empêchement l'après-midi. Les deux vacations sont donc **assignables indépendamment**.
2. Lorsqu'une même personne assure les deux vacations d'un même jour, cela doit compter pour **une seule journée travaillée** (repos hebdomadaire, jours consécutifs).

Or le modèle actuel repose sur l'axiome **une tournée = un créneau = une plage horaire continue** :

- `Tournee` porte un `creneau` scalaire (`'MATIN' | 'APRES_MIDI' | 'JOURNEE'`) et **un seul** couple `heureDebut`/`heureFin`, validé `heureFin > heureDebut` (`src/domain/tournees.js`). Aucune place pour deux segments disjoints. La limite « pas de tournée à cheval sur minuit » (feature 0006 §12.2) illustre le même verrou.
- L'enum `CRENEAUX` est figé à trois valeurs, **sans « soir »** (`src/domain/schema.js`).
- Le moteur remplit chaque `Demande` **indépendamment** (glouton + recherche locale, `src/domain/scheduling/`) ; il ne sait pas coupler deux slots sur la même personne.
- Le chevauchement et les absences raisonnent par **bucket symbolique** (`creneauxSeChevauchent`, `src/domain/absences.js`), **jamais par heures réelles**.

Point favorable déjà en place : le décompte des jours est fait **par date** — `indexer` construit `joursTravaillesParPersonne: Map<personneId, Set<date>>` (`src/domain/scheduling/modele/planning.js`), et `contrainteReposLegal` s'appuie dessus. Deux affectations le même jour comptent donc déjà pour **un seul jour travaillé**.

## Décision

Nous modélisons une tournée comme une entité portant **une liste de segments horaires** :

```
Tournee.segments: [{ heureDebut: "HH:mm", heureFin: "HH:mm", nbPersonnesRequises: integer >= 1 }]
```

- **Une petite tournée a un segment ; une grosse tournée en a deux.** La tournée reste une entité de première classe (un seul enregistrement, un seul nom, une seule couleur).
- **Chaque segment est une unité de demande indépendante** : l'expansion (`modele/demande.js`) produit une `Demande` par (tournée, date, **segment**) × `nbPersonnesRequises`. Deux segments d'une même grosse tournée peuvent donc être couverts par **deux personnes différentes**.
- **La continuité intra-journée (même personne sur les segments d'une même tournée le même jour) est une préférence _souple_**, pas une contrainte dure : le moteur privilégie une seule personne mais peut scinder quand c'est nécessaire. Elle s'inscrit dans la logique existante de `contrainteContinuite.js`.
- L'**unité assignable sous-journalière** passe conceptuellement du *créneau symbolique global* au *segment de la tournée* (horaires réels). La forme `Personne × Tournee × date × sous-unité` de l'`Affectation` est **préservée** : l'affectation référence un segment (indice) au lieu d'un code de créneau.
- Le **chevauchement** et le **recouvrement d'absence** deviennent des tests de **recouvrement horaire réel** entre segments, et non plus des égalités de bucket.

Le comptage « une seule journée travaillée » n'appelle **aucun changement** : il repose déjà sur `Set<date>` (voir Contexte).

## Conséquences

- **Positives** :
  - Répond au besoin de partage matin/soir sans inventer de contrainte de couplage dure (le point coûteux de l'alternative « deux tournées liées »).
  - La grosse tournée reste une entité unique → diffusion, impression et éditeur la présentent comme un tout.
  - Repos hebdomadaire et jours consécutifs restent corrects sans retouche (comptage par date).
  - Le recouvrement horaire réel est plus juste que les buckets symboliques (il détecte les vrais conflits de temps).
  - Impact contenu sur l'éditeur (feature 0011) : glissement « créneau → segment », pas refonte.
- **Négatives / compromis** :
  - Changement de la structure `Tournee` → **migration** de schéma (bump `schemaVersion`, `src/storage/migrations.js`) : les tournées existantes deviennent des tournées à un segment.
  - Chevauchement (`contrainteChevauchement.js`) et absences (`absences.js`, `contrainteAbsence.js`, feature 0007) à réécrire en logique horaire.
  - Formulaire de tournée (feature 0006) à étendre (1 → 2 segments) ; affichage grille (0010) et éditeur (0011) à adapter pour deux plages.
  - Le rôle de l'enum `creneau` se réduit (dérivable des heures, ou conservé comme étiquette grossière) — à clarifier lors de l'implémentation.
- **Suivi** — deux sous-décisions restent **ouvertes**, à trancher au moment de l'implémentation (éventuellement par un ADR dédié) :
  1. **Granularité des absences et préférences** : conserver des buckets grossiers (quitte à ajouter un code `SOIR`) — plus simple pour un public non-technique — ou passer aux **heures réelles** (plus cohérent avec les segments). Cette question dépasse les tournées.
  2. **Mesure de charge pour l'équité** (`contrainteEquite.js`) : aujourd'hui l'équité compte les affectations, donc une grosse tournée (2 segments) pèse plus qu'une petite — comportement acceptable par défaut. Si l'on veut refléter la charge horaire réelle, pondérer par la durée. Aucun changement obligatoire.
  - **Timing** : acter avant que la feature 0011 (éditeur, en cours) ne fige le modèle `(tournée, date, créneau)`.

## Alternatives considérées

- **Deux tournées distinctes liées** (créneaux `MATIN` + un nouveau `SOIR`). Écartée : impose un nouveau code de créneau (ripple sur absences, préférences, libellés, migration), **et surtout** une contrainte de couplage **dure** « même personne sur les deux » que le moteur (remplissage slot par slot) ne sait pas exprimer. La grosse tournée n'existerait pas comme entité (diffusion en deux lignes).
- **Une tournée `JOURNEE` `07:00 → 20:00`**. Écartée : le modèle croirait à 13 h de travail continu ; la coupure serait invisible et aucun champ ne pourrait l'exprimer.
- **Une tournée = une affectation couvrant toute la journée** (une seule personne obligatoire). Écartée : empêche le partage matin/soir entre deux personnes, contraire à l'exigence 1.

## Liens

- Modèle de domaine : [`docs/architecture/02-modele-de-domaine.md`](../architecture/02-modele-de-domaine.md), [`03-modele-de-donnees.md`](../architecture/03-modele-de-donnees.md).
- Moteur : [ADR 0008](0008-moteur-planification-module-pur.md), [`docs/architecture/05-moteur-de-planification.md`](../architecture/05-moteur-de-planification.md).
- Conventions dates/heures : [ADR 0010](0010-conventions-dates-et-jours-iso.md).
- Features concernées : [0003 Paramètres cabinet](../../features/0003-parametres-cabinet.md), [0006 Gestion des tournées](../../features/0006-gestion-tournees.md), [0007 Absences](../../features/0007-absences-et-conges.md), [0009 Moteur](../../features/0009-moteur-planification.md), [0010 Génération UI](../../features/0010-generation-planning-ui.md), [0011 Éditeur](../../features/0011-editeur-de-planning.md).
