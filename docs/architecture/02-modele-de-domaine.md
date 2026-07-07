# 02 — Modèle de domaine

Ce document définit les concepts métier d'Idelia et leurs structures. Le format JSON persisté correspondant est détaillé dans [`03-modele-de-donnees.md`](03-modele-de-donnees.md).

## Conventions transverses (rappel — [ADR 0010](../adr/0010-conventions-dates-et-jours-iso.md))

- **Jours de semaine** : ISO 8601, `1`=Lundi … `7`=Dimanche. Jamais `0-6`.
- **Dates calendaires** : `"YYYY-MM-DD"`. **Heures** : `"HH:mm"`. **Horodatages techniques** : ISO UTC (`toISOString()`).
- **Enums** : codes stables en `MAJUSCULES_SNAKE` (jamais les libellés affichés — ceux-ci passent par une table de correspondance, prête pour l'i18n).
- **Identifiants** : `crypto.randomUUID()` (contexte HTTPS des Pages garanti), avec un util `genId()` de secours. IDs immuables, jamais réutilisés.

## Glossaire

| Terme | Définition |
|---|---|
| **Personne** | Personne physique travaillant au cabinet (titulaire ou remplaçant). |
| **ParametresCabinet** | Réglages globaux du cabinet (singleton). |
| **Tournee** | Circuit de soins récurrent, avec horaires, créneau, jours d'application, effectif requis. |
| **Creneau** | Moment de la journée : `MATIN` / `APRES_MIDI` / `JOURNEE`. C'est le grain du planning. |
| **Preference** | Souhait/contrainte attaché à une Personne, **DURE** (jamais violable) ou **SOUPLE** (à optimiser). |
| **Absence** | Indisponibilité datée d'une Personne (congé, arrêt, maternité…), avec statut de validation. |
| **Affectation** | Brique élémentaire du planning : (Personne × Tournee × date × Creneau). |
| **Planning** | Période bornée + ensemble d'Affectations + statut. |
| **Referent** | Personne qui tient le planning et le diffuse ([ADR 0009](../adr/0009-workflow-referent-diffusion-lecture.md)). |
| **Besoin** | Notion **calculée** (non stockée) : effectif requis d'une tournée un jour/créneau vs affectations réelles. |
| **Diagnostic / Conflit** | Résultat **calculé** de l'évaluation d'un planning (contrainte dure violée, sous-effectif, souhait non tenu). |

## Choix d'agrégats

- **Collections racine** : `personnes[]`, `tournees[]`, `absences[]`, `plannings[]`, `cabinet` (singleton).
- `preferences` **imbriquées dans Personne** (éditées avec la personne, suppression en cascade).
- `affectations` **imbriquées dans Planning** (le planning se publie comme un tout, unité portable).
- `absences` **à plat** (avec `personneId`) : cycle de vie propre, listées transversalement (« demandes de congés »).
- Les **diagnostics ne sont jamais stockés** : recalculés à la volée pour ne jamais être obsolètes après un ajustement manuel.

## Entités

### Personne

| champ | type | oblig. | notes |
|---|---|---|---|
| id | uuid | oui | |
| prenom | string | oui | |
| nom | string | oui | |
| statut | enum | oui | `TITULAIRE`, `REMPLACANT` |
| actif | boolean | oui | défaut `true` (soft-delete = `false`) |
| couleur | string hex `#RRGGBB` | oui | affichage calendrier |
| quotite | number 0..100 | oui | défaut `100` (% temps de travail) |
| dateEntree | `"YYYY-MM-DD"` | non | |
| dateSortie | `"YYYY-MM-DD"` \| null | non | |
| contact | `{ email?, telephone? }` | non | |
| ordreAffichage | integer | non | |
| notes | string | non | |
| preferences | Preference[] | oui (`[]` possible) | imbriqué |
| createdAt / updatedAt | ISO UTC | oui | |

### Preference (imbriquée dans Personne)

Contraintes hétérogènes modélisées par **polymorphisme** : discriminant `type` + sac `params` dont la forme dépend du type. `nature` sépare dur/souple ; `poids` ne concerne que le souple.

| champ | type | oblig. | notes |
|---|---|---|---|
| id | uuid | oui | |
| type | enum PreferenceType | oui | voir table ci-dessous |
| nature | `DURE` \| `SOUPLE` | oui | DURE = filtrage strict ; SOUPLE = optimisée |
| poids | integer 1..10 | non | défaut `5` ; utilisé si `SOUPLE` |
| actif | boolean | oui | défaut `true` |
| params | object | oui | forme selon `type` |
| libelle | string | non | note lisible |
| createdAt / updatedAt | ISO UTC | oui | |

**PreferenceType → `params`**

| type | params | exemple |
|---|---|---|
| `JOUR_OFF_RECURRENT` | `{ joursSemaine: number[1..7] }` | pas le mercredi → `[3]` |
| `CRENEAU_OFF` | `{ creneaux: Creneau[], joursSemaine?: number[] }` | pas l'après-midi |
| `MAX_JOURS_CONSECUTIFS` | `{ max: integer>=1 }` | 5 jours max d'affilée |
| `MIN_JOURS_CONSECUTIFS` | `{ min: integer>=1 }` | au moins 2 jours d'affilée |
| `JOURS_REPOS_SOUHAITES` | `{ joursSemaine: number[1..7] }` | repos samedi/dimanche → `[6,7]` |
| `NB_JOURS_SEMAINE` | `{ min?: integer, max?: integer }` | 3 à 4 jours/semaine |
| `PREFERENCE_TOURNEE` | `{ tourneeIds: uuid[], sens: "PREFERE"\|"EVITE" }` | préfère la tournée Nord |
| `INDISPO_HEBDO` | `{ joursSemaine: number[], creneaux?: Creneau[] }` | indispo récurrente ciblée |

> **Extensibilité** : ajouter une contrainte = ajouter une valeur d'enum + une forme de `params` + une fonction d'évaluation dans le moteur ([05](05-moteur-de-planification.md)), **sans changer le schéma**.

### Tournee

| champ | type | oblig. | notes |
|---|---|---|---|
| id | uuid | oui | |
| nom | string | oui | |
| code | string | non | code court d'affichage |
| secteur | string | non | zone géographique (string libre, KISS) |
| creneau | enum Creneau | oui | `MATIN`, `APRES_MIDI`, `JOURNEE` |
| heureDebut | `"HH:mm"` | oui | |
| heureFin | `"HH:mm"` | oui | doit être > heureDebut (validé) |
| joursApplication | number[1..7] | oui | jours ISO où la tournée existe |
| nbPersonnesRequises | integer>=1 | oui | défaut `1` |
| couleur | string hex | non | |
| archivee | boolean | oui | défaut `false` (soft-delete) |
| dateDebutValidite | `"YYYY-MM-DD"` | non | tournée saisonnière |
| dateFinValidite | `"YYYY-MM-DD"` \| null | non | |
| ordreAffichage | integer | non | |
| notes | string | non | |
| createdAt / updatedAt | ISO UTC | oui | |

### Absence

| champ | type | oblig. | notes |
|---|---|---|---|
| id | uuid | oui | |
| personneId | uuid → Personne | oui | |
| type | enum | oui | `CONGE_PAYE, RTT, ARRET_MALADIE, MATERNITE, PATERNITE, NAISSANCE, FORMATION, AUTRE` |
| dateDebut | `"YYYY-MM-DD"` | oui | |
| dateFin | `"YYYY-MM-DD"` | oui | inclusive ; >= dateDebut |
| creneau | enum Creneau | oui | défaut `JOURNEE` (gère les demi-journées) |
| statut | enum | oui | `DEMANDE, VALIDE, REFUSE` ; défaut `DEMANDE` |
| commentaire | string | non | |
| demandeLe | ISO UTC | non | |
| decideLe | ISO UTC \| null | non | |
| createdAt / updatedAt | ISO UTC | oui | |

> **Règle** : seule une absence `VALIDE` **bloque** une affectation (contrainte dure). Une `DEMANDE` produit un **avertissement**, pas un blocage.

### Affectation (imbriquée dans Planning)

| champ | type | oblig. | notes |
|---|---|---|---|
| id | uuid | oui | |
| personneId | uuid → Personne | oui | |
| tourneeId | uuid → Tournee | oui | |
| date | `"YYYY-MM-DD"` | oui | |
| creneau | enum Creneau | oui | dénormalisé depuis la tournée (perf/lookup) |
| origine | `AUTO` \| `MANUEL` | oui | AUTO = posée par le moteur |
| verrouillee | boolean | oui | défaut `false` ; le moteur ne la retouche pas |
| commentaire | string | non | |
| createdAt / updatedAt | ISO UTC | oui | |

> `origine` et `verrouillee` sont le pilier du **mode hybride** ([ADR 0007](../adr/0007-generation-planning-hybride.md)) : une régénération préserve les affectations verrouillées.

### Planning

| champ | type | oblig. | notes |
|---|---|---|---|
| id | uuid | oui | |
| nom | string | non | ex. `"Semaine 28 - 2026"` |
| dateDebut | `"YYYY-MM-DD"` | oui | |
| dateFin | `"YYYY-MM-DD"` | oui | >= dateDebut |
| statut | enum | oui | `BROUILLON, VALIDE, PUBLIE` ; défaut `BROUILLON` |
| affectations | Affectation[] | oui (`[]` possible) | imbriqué |
| parametresGeneration | object | non | snapshot des réglages moteur (reproductibilité) |
| referentId | uuid → Personne | non | |
| publieLe | ISO UTC \| null | non | |
| createdAt / updatedAt | ISO UTC | oui | |

### ParametresCabinet (singleton)

| champ | type | oblig. | notes |
|---|---|---|---|
| nomCabinet | string | non | |
| joursOuverture | number[1..7] | oui | défaut `[1,2,3,4,5,6]` |
| creneauxActifs | Creneau[] | oui | défaut `[MATIN, APRES_MIDI]` |
| reposHebdoMin | integer | oui | défaut `2` (jours de repos/semaine) |
| maxJoursConsecutifs | integer | oui | défaut `6` |
| premierJourSemaine | number 1..7 | oui | défaut `1` (affichage) |
| couleursParDefaut | string[] | non | palette de suggestion |
| updatedAt | ISO UTC | oui | |

## Relations

```
Personne 1─* Preference (imbriquée)      Cabinet  (singleton)
Personne 1─* Absence                     Planning 1─* Affectation (imbriquée)
Personne 1─* Affectation (par id)        Tournee  1─* Affectation (par id)
```

## Intégrité & cycle de vie (points de vigilance)

1. **Ne jamais supprimer physiquement** une Personne ou une Tournee référencée : **soft-delete** (`actif=false` / `archivee=true`). Les plannings historiques gardent la référence.
2. À la **publication** d'un planning, figer un **snapshot d'affichage** (nom, couleur) dans chaque affectation → les exports/PDF restent stables même si la personne est désactivée plus tard.
3. **À l'import**, valider l'intégrité référentielle (`personneId`/`tourneeId`/`referentId` résolvent bien) avant de remplacer l'état ([03](03-modele-de-donnees.md)).
4. **Demi-journées** : le champ `creneau` sur Absence gère les arrêts partiels, cohérent avec le grain des affectations.
5. **Chevauchements** (calculés) : affectation vs absence `VALIDE` (bloquant) ; double affectation même personne/date/créneau (interdit) ; sous-effectif (avertissement, non bloquant).
