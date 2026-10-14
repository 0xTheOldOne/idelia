# Feature 0023 — Repères calendaires (fériés, dimanches, vacances scolaires)

- **Statut** : En cours (plan rédigé le 2026-10-14)
- **Dépend de** : `0003` (paramètres du cabinet : on y ajoute la zone scolaire), `0011` (grille de l'éditeur : en-tête de ligne du jour). S'appuie sur `0012` (point d'extension `reperesDuJour(date, sources)` / `construireDiffusion({ sourcesReperes })`, classes `mois-diffusion-ligne--repere-*`, bloc « Repères » de la légende déjà en place), `0018` (toasts) et `0008` (import/export du `SaveDocument`).
- **ADR liés** : **[0020](../docs/adr/0020-exception-reseau-api-calendrier-scolaire.md) (préalable, Accepté le 2026-10-14 : seule dépendance réseau autorisée)**, [0002](../docs/adr/0002-application-frontend-sans-backend.md) (amendé par 0020), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (cache persisté via `storageRepository`), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (cache exporté/importé), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (aucun réseau dans le domaine, moteur inchangé), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, `Date` seulement dans `dates.js`), [0013](../docs/adr/0013-icones-phosphor.md), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md).

## 1. Contexte & objectif

Le planning papier du cabinet met en évidence les **dimanches** (tournées mieux rémunérées) et **surligne les vacances scolaires** (période de charge et d'absences). Idelia ne montre aujourd'hui que les dimanches, et seulement à l'impression (0012).

Résultat attendu, **à l'écran (grille du planning) comme à l'impression** :

- les **dimanches** mis en évidence ;
- les **jours fériés** français, nommés (« Férié : Toussaint »), **calculés localement** (Pâques par algorithme), sans réseau ;
- les **vacances scolaires** de la **zone choisie dans les Paramètres**, récupérées sur l'API open-data de l'Éducation nationale ([ADR 0020](../docs/adr/0020-exception-reseau-api-calendrier-scolaire.md)), puis **mises en cache dans le fichier de sauvegarde** (par zone et année scolaire). Rien n'est écrit en dur.

**Affichage seul** : aucun effet sur la génération (le moteur `src/domain/scheduling/` n'est pas modifié), ni sur les jours d'ouverture, ni sur le récapitulatif mensuel (0024).

**Hors périmètre** : fériés d'Alsace-Moselle et fériés propres aux départements d'outre-mer (§12 n° 1 et 2), calcul de majorations, ponts, saisie manuelle de vacances.

## 2. Écrans concernés

Aucune nouvelle route.

### 2.1 Paramètres (`/parametres`) — nouvelle section « Vacances scolaires »

Placée entre « Affichage » et « Sauvegarde », dans un composant dédié `BlocVacancesScolaires`.

- En-tête : titre « Vacances scolaires », et **à droite du titre** le bouton « Mettre à jour » (icône `PhArrowsClockwise`, avec texte, car c'est l'action principale de la section). Il n'apparaît que si une zone est choisie.
- Liste déroulante **« Zone de vacances scolaires »** :
  - « Aucune — ne pas afficher les vacances scolaires » (valeur par défaut) ;
  - puis les zones (§5.2), avec les académies dans le libellé : « Zone A — Besançon, Bordeaux, Clermont-Ferrand, Dijon, Grenoble, Limoges, Lyon, Poitiers ».
- Aide sous la liste (toujours visible) : « Les dates officielles sont récupérées sur le site public de l'Éducation nationale (data.education.gouv.fr). Seules la zone et l'année scolaire sont transmises : aucune information sur le cabinet, l'équipe ou les patients. Les jours fériés et les dimanches sont toujours indiqués, même sans zone. »
- État du cache (`role="status"`) :
  - « Dates enregistrées : année scolaire 2025-2026 (récupérée le 14/10/2026), 2026-2027 (récupérée le 14/10/2026). »
  - ou « Aucune date enregistrée pour l'instant. »
- **Changer de zone** enregistre le choix tout de suite, comme les autres réglages. Les dates de l'ancienne zone sont oubliées et l'année scolaire en cours est récupérée aussitôt. Pendant la requête, le bouton est désactivé, avec une petite roue d'attente et le texte « Mise à jour… » (`aria-busy`). Le résultat s'affiche sous la liste, dans une alerte `role="status"` : succès en vert, échec en orange avec le message du §5.2.
- Revenir à « Aucune » oublie toutes les dates en cache. Aucune requête n'est faite, aucune confirmation n'est demandée : le choix est réversible, il suffit de rechoisir la zone pour récupérer les dates.

### 2.2 Planning (`/planning`) — grille, vues « Tournées » et « Personnes »

Les repères vont **uniquement dans l'en-tête de ligne du jour** (colonne figée « Jour »). Les cases gardent leurs états actuels (vide, fermé, hors période, hors présence, cible de dépôt, conflit), ce qui évite de surcharger la grille.

- **Dimanche** : fond de l'en-tête légèrement teinté (token `$couleur-fond-repere-majore`). Le nom « Dimanche » est déjà en gras.
- **Férié** : même fond teinté, plus une ligne « Férié : Toussaint » (icône `PhFlag`, `aria-hidden`). Le texte peut passer à la ligne.
- **Vacances scolaires** : barre verticale à gauche de l'en-tête (`border-left`), plus une ligne « Vacances » (icône `PhBackpack`, `aria-hidden`). Le détail complet est en infobulle (`title`) et en texte réservé aux lecteurs d'écran : « Vacances scolaires : Vacances de la Toussaint ».
- Un jour **fermé** garde son fond gris et « Fermé », qui restent prioritaires. Les lignes « Férié » et « Vacances » s'affichent en plus.
- Au chargement d'un planning, l'application vérifie que les vacances de la période sont en cache. Si une année scolaire manque, elle la récupère **en arrière-plan** : la grille s'affiche tout de suite et les vacances apparaissent dès réception. En cas d'échec, un seul toast d'avertissement par session (§5.2). Le planning reste utilisable.

### 2.3 Diffusion (`/planning/:id/diffusion`) et impression

- Ligne d'un **férié** : même rendu que le dimanche (fond grisé et jour en gras), plus le marqueur **« F »** près du numéro du jour.
- Ligne d'un jour de **vacances** : marqueur **« V »**, fine barre à gauche de la cellule « Jour » et fond très léger. Si le jour est aussi un dimanche ou un férié, le fond du dimanche l'emporte et le « V » reste.
- Légende, bloc « Repères » : « Dimanche », « F Jour férié », « V Vacances scolaires (zone A) », plus les entrées existantes (« — », « Fermé »). Chaque repère n'apparaît que s'il est présent dans le tirage (comportement déjà en place, dédoublonnage par code).
- Si une zone est choisie mais que les vacances de la période n'ont pas pu être récupérées : alerte non imprimée (`d-print-none`) au-dessus de l'aperçu, « Les vacances scolaires n'ont pas pu être récupérées : elles n'apparaîtront pas sur ce tirage. », avec un bouton « Réessayer ». Pas de toast sur cet écran : l'alerte suffit.
- Lisible en **noir et blanc** : les lettres F et V et le gras portent le sens, les fonds ne font qu'aider.

## 3. Modèle de données touché

**Migration de schéma v8 → v9** (`CURRENT_SCHEMA_VERSION` : 8 → **9**).

### 3.1 `ParametresCabinet.zoneScolaire` (nouveau)

| champ | type | oblig. | notes |
|---|---|---|---|
| zoneScolaire | string \| null | oui (`null` possible) | code de `ZONES_SCOLAIRES` (§5.2), ex. `'ZONE_A'`. Défaut `null` = aucune zone, donc aucune requête réseau. Valeur inconnue ramenée à `null` (`normaliserZoneScolaire`). |

### 3.2 Racine `vacancesScolaires` (nouveau) — cache des vacances

```jsonc
"vacancesScolaires": [
  {
    "zone": "ZONE_A",                         // code ZONES_SCOLAIRES
    "anneeScolaire": "2026-2027",             // "AAAA-AAAA", 2e année = 1re + 1
    "recupereLe": "2026-10-14T08:00:00.000Z", // ISO UTC (horodatage technique)
    "periodes": [
      { "libelle": "Vacances de la Toussaint", "debut": "2026-10-17", "fin": "2026-11-01" }
    ]
  }
]
```

- Bornes `debut` et `fin` **incluses**, au format `"YYYY-MM-DD"`, comme `Absence`. `debut` est le jour de fin des cours, `fin` la **veille de la reprise** (§5.2).
- **Pas d'`id`** : ce n'est pas une entité référencée. La clé est le couple (`zone`, `anneeScolaire`), avec une seule entrée par couple. Les codes de zone sont des codes d'énumération (comme `MATIN`), pas des identifiants.
- On ne garde que les entrées de la **zone courante** : elles sont purgées au changement de zone. Volume : une entrée d'une dizaine de périodes par année scolaire, soit environ 1 ko par an.
- **Non bloquant** : un cache absent ou malformé est normalisé en `[]` ou filtré, jamais refusé. `verifierIntegrite` **n'est pas modifiée**, car un cache de données publiques ne doit jamais empêcher d'ouvrir une sauvegarde.

### 3.3 `MIGRATIONS[8]` (v8 → v9), dans `src/storage/migrations.js`

- `cabinet` (si c'est un objet) : `zoneScolaire: normaliserZoneScolaire(doc.cabinet.zoneScolaire)`. Idempotent : absent → `null`.
- `vacancesScolaires: normaliserCacheVacances(doc.vacancesScolaires)`. Idempotent : absent → `[]`.
- `personnes`, `tournees`, `absences`, `plannings` : inchangés.

### 3.4 Volatil (jamais persisté)

Échecs de récupération de la session, requêtes en cours, toast déjà émis : ce sont des variables **de module** du store `vacancesScolaires`, sur le modèle de `minuteur` dans `ui.js`.

## 4. Store (Vuex)

### 4.1 Nouveau module persisté `src/store/modules/vacancesScolaires.js` (namespaced)

- `state: () => ({ entrees: [] })`.
- **Getters**
  - `entrees`.
  - `zoneCourante(state, getters, rootState)` : `rootState.cabinet.parametres?.zoneScolaire ?? null`.
  - `periodesZoneCourante` : `periodesDeZone(state.entrees, zoneCourante)`.
  - `entreesZoneCourante` : entrées de la zone courante triées par `anneeScolaire`, pour l'état affiché dans Paramètres.
- **Mutations**
  - `REPLACE(entrees)` : hydratation.
  - `ENREGISTRER({ zone, anneeScolaire, periodes, recupereLe })` : remplace l'entrée du couple, ou l'ajoute.
  - `GARDER_ZONE(zone)` : supprime les entrées des autres zones (`null` → tout supprimer).
- **Actions** (toutes renvoient un `ResultatVacances = { ok: boolean, etat: 'SANS_ZONE'|'A_JOUR'|'MIS_A_JOUR'|'ECHEC', message: string }`, et **ne rejettent jamais**) :
  - `assurerCouverture({ dateDebut, dateFin, silencieux = false, forcer = false })`.
    1. Sans zone : `SANS_ZONE`.
    2. On calcule `anneesManquantes(entrees, zone, dateDebut, dateFin)`, en retirant les couples déjà en échec dans la session (sauf si `forcer`).
    3. Rien ne manque : `A_JOUR`.
    4. Sinon, pour chaque année (une à une) : `recupererAnnee(zone, annee)`, avec dédoublonnage des requêtes en cours par une `Map` de promesses. Un succès avec au moins une période donne `ENREGISTRER` avec `recupereLe = new Date().toISOString()`. Un échec (y compris « non publiée ») ajoute le couple aux échecs de session.
    5. S'il y a un échec et que `silencieux` vaut `false`, on émet **un seul** toast `avertissement` par session : `dispatch('notifications/notifier', …, { root: true })`, convention 0018.
  - `mettreAJour()` : la mise à jour manuelle (bouton Paramètres). Années demandées : celles déjà en cache pour la zone, plus `anneeScolaireDe(aujourd'hui)` (aujourd'hui = `dateUtil.format(new Date())`, comme `exporter`). On vide les échecs de session, on **redemande** toutes ces années et on remplace chaque entrée récupérée avec succès. Les années en échec gardent leur ancienne entrée. Message de résultat construit par le domaine. Pas de toast : le résultat s'affiche à côté du bouton.
  - `changerZone(code)` :
    1. `dispatch('cabinet/majParametres', { zoneScolaire: normaliserZoneScolaire(code) }, { root: true })` ;
    2. `commit('GARDER_ZONE', code)` ;
    3. on vide les échecs de session ;
    4. avec une zone : `return dispatch('mettreAJour')`, sinon `SANS_ZONE`.
- Les actions appellent l'adaptateur `recupererCalendrierScolaire` (§5.4) puis `normaliserReponseCalendrierScolaire` (domaine). **Aucune** logique de dates dans le store.

### 4.2 `src/store/index.js`

- Enregistrer le module `vacancesScolaires`.
- `REPLACE_ALL` : `state.vacancesScolaires.entrees = etatRacine.vacancesScolaires.entrees`.
- Le plugin de persistance n'a **pas** à changer : les mutations `vacancesScolaires/*` doivent être persistées, et elles le sont.
- `plannings/assemblerEntree` (moteur) : **inchangé**, les vacances ne lui sont jamais transmises.

### 4.3 `src/domain/schema.js`

- `etatParDefaut()` : `cabinet.parametres.zoneScolaire: null` et `vacancesScolaires: { entrees: [] }`.
- `toSaveDocument` : `vacancesScolaires: rootState.vacancesScolaires.entrees`.
- `fromSaveDocument` :
  - `cabinet.parametres.zoneScolaire` passé par `normaliserZoneScolaire` ;
  - `vacancesScolaires: { entrees: normaliserCacheVacances(doc.vacancesScolaires) }`.
- Typedefs mis à jour : `ParametresCabinet.zoneScolaire`, `EtatRacine.vacancesScolaires`, `SaveDocument.vacancesScolaires`. `verifierIntegrite` reste **inchangée**.

## 5. Domaine (logique pure)

Nouveau dossier **`src/domain/calendrier/`**, en imports **relatifs** (`../utils/dates.js`), pour rester chargeable par le script de vérification. Aucun import Vue ou Vuex, **aucun `fetch`**.

### 5.1 `src/domain/calendrier/joursFeries.js`

| Fonction | Rôle |
|---|---|
| `datePaques(annee)` → `"YYYY-MM-DD"` | Dimanche de Pâques grégorien, par l'**algorithme anonyme de Meeus/Jones/Butcher** : arithmétique entière seulement, aucun objet `Date`, valable dès 1583. Paramètre non entier ou < 1583 : `null`. |
| `joursFeriesAnnee(annee)` → `Array<{ date, libelle }>` triés | Les **11 fériés légaux nationaux** (code du travail, art. L3133-1) : Jour de l'an (01-01), Lundi de Pâques (P+1), Fête du Travail (05-01), Victoire 1945 (05-08), Ascension (P+39), Lundi de Pentecôte (P+50), Fête nationale (07-14), Assomption (08-15), Toussaint (11-01), Armistice 1918 (11-11), Noël (12-25). Les jours mobiles sont calculés par `dateUtil.addDays(datePaques(annee), n)`. |
| `joursFeriesEntre(dateDebut, dateFin)` → `Map<date, libelle>` | Union des années couvertes, filtrée sur `[dateDebut, dateFin]` (comparaison de chaînes). |

**Choix (KISS)** : la liste nationale seulement. Le lundi de Pentecôte est affiché, car il reste un jour férié légal même quand il est travaillé (journée de solidarité). Les fériés d'Alsace-Moselle et d'outre-mer sont hors périmètre (§12).

### 5.2 `src/domain/calendrier/vacancesScolaires.js`

**Zones proposées** (`ZONES_SCOLAIRES`, gelée). Valeurs `valeurApi` **à confirmer à l'étape 0** :

| code | libellé (liste déroulante) | `valeurApi` (champ `zones`) |
|---|---|---|
| `ZONE_A` | Zone A — Besançon, Bordeaux, Clermont-Ferrand, Dijon, Grenoble, Limoges, Lyon, Poitiers | `Zone A` |
| `ZONE_B` | Zone B — Aix-Marseille, Amiens, Lille, Nancy-Metz, Nantes, Nice, Normandie, Orléans-Tours, Reims, Rennes, Strasbourg | `Zone B` |
| `ZONE_C` | Zone C — Créteil, Montpellier, Paris, Toulouse, Versailles | `Zone C` |
| `CORSE` | Corse | `Corse` |
| `GUADELOUPE` | Guadeloupe | `Guadeloupe` |
| `MARTINIQUE` | Martinique | `Martinique` |
| `GUYANE` | Guyane | `Guyane` |
| `REUNION` | La Réunion | `La Réunion` |
| `MAYOTTE` | Mayotte | `Mayotte` |

Pourquoi ces zones : ce sont celles du jeu de données qui concernent un cabinet soumis au droit français métropolitain ou des DROM. Les collectivités du Pacifique et Saint-Pierre-et-Miquelon sont écartées : autre calendrier, autre droit du travail (§12 n° 2). On stocke un **code stable** plutôt que le texte de l'API : si l'API renomme une zone, seule la table change, pas les sauvegardes.

| Fonction | Rôle |
|---|---|
| `normaliserZoneScolaire(v)` → code \| `null` | Code connu, sinon `null`. |
| `zoneScolaireParCode(code)` → objet \| `undefined` | Lecture de la table. |
| `anneeScolaireDe(date)` → `"AAAA-AAAA"` | Mois ≥ 9 : `${a}-${a+1}`, sinon `${a-1}-${a}`. Arithmétique de chaînes. |
| `anneesScolairesCouvrant(dateDebut, dateFin)` → `string[]` trié, sans doublon | `anneeScolaireDe` de chaque date, **plus**, pour toute date de **septembre**, l'année précédente. Les vacances d'été appartiennent à l'année qui se termine et durent jusqu'à la rentrée, début septembre. |
| `normaliserReponseCalendrierScolaire(enregistrements, { zone, anneeScolaire })` → `PeriodeVacances[]` \| `null` | Voir les règles ci-dessous. `null` si la réponse n'est pas un tableau (→ `REPONSE_INVALIDE`). |
| `normaliserCacheVacances(valeur)` → `EntreeVacances[]` | Pas un tableau → `[]`. On garde les entrées valides : zone connue ; `anneeScolaire` de la forme `^\d{4}-\d{4}$` avec 2e année = 1re + 1 ; `periodes` revalidées une à une (libellé chaîne non vide ≤ 80 caractères, `debut` et `fin` au format date, `debut ≤ fin`) ; `recupereLe` chaîne ou `null`. En cas de doublon (zone, année), on garde la dernière. Ne lève jamais. |
| `anneesManquantes(entrees, zone, dateDebut, dateFin)` → `string[]` | `anneesScolairesCouvrant` moins les années en cache pour la zone. |
| `periodesDeZone(entrees, zone)` → `PeriodeVacances[]` | Périodes de toutes les entrées de la zone, à plat. |
| `vacancesEntre(periodes, dateDebut, dateFin)` → `Map<date, libelle>` | Chaque jour de chaque période, limité à la fenêtre. Si deux périodes se chevauchent, la première en ordre de `debut` l'emporte. |
| `messageVacances(code, { anneeScolaire, zone, annees })` → `string` | Messages en français (ci-dessous). |

**Règles de normalisation de la réponse API** (cœur de la feature, à figer dans le JSDoc) :

1. On ne considère que les **500 premiers** enregistrements. Un élément qui n'est pas un objet est ignoré.
2. **Filtrage défensif** : on garde l'enregistrement seulement si `zones` est égal à la `valeurApi` de la zone **et** si `annee_scolaire` est égal à l'année demandée (quand ces champs sont présents). On ne fait pas confiance au filtrage côté serveur.
3. **Population** : on écarte les lignes `population` = « Enseignants ». On compare sans casse ni accents : les dates de pré-rentrée et de fin d'année des enseignants diffèrent de celles des élèves. On garde « Élèves », « - », vide ou absent.
4. **Libellé** : `description` est une chaîne. On retire les espaces en trop et on coupe à 80 caractères. Chaîne vide : ligne ignorée.
5. **Dates et fuseau horaire**, le piège classique : l'API renvoie des instants avec fuseau, qui correspondent au **minuit local** du jour concerné. Exemple : `"2026-10-16T22:00:00+00:00"` est le 17 octobre à 00:00 à Paris. Couper la chaîne donnerait la **veille**. On utilise `dateUtil.dateCalendaireDepuisInstant(iso)` (nouvelle fonction de `dates.js`, §5.5) : elle arrondit au jour calendaire le plus proche en ajoutant 12 h puis en prenant la date UTC. Le résultat est juste pour un minuit local de **n'importe quel** fuseau de UTC−12 à UTC+12, donc aussi pour les DROM, sans table de fuseaux. Une chaîne déjà au format `"YYYY-MM-DD"` est gardée telle quelle.
6. **Bornes** : `debut = jour(start_date)`, qui est le jour de fin des cours ; `fin = jour(end_date) − 1 jour`, car `end_date` est le jour de la **reprise**. Exemple (Toussaint 2026) : 17/10/2026 → 01/11/2026. On ignore la ligne si une date manque ou est invalide, si `fin < debut`, ou si la période dépasse 120 jours.
7. **Dédoublonnage** : il y a une ligne par académie (et parfois par population). La clé est `libelle|debut|fin`. Tri par `debut`, puis par `libelle`. Si deux académies d'une même zone avaient des dates différentes, les deux périodes sont gardées et les jours sont réunis (§12 n° 6).
8. **Résultat vide** (année pas encore publiée, ou tout filtré) : il n'est **pas mis en cache**, sinon on ne redemanderait jamais l'année une fois publiée. Le store le traite comme un échec `NON_PUBLIEE`.

**Messages** (`messageVacances`), sans jargon, chacun dit quoi faire :

| code | message |
|---|---|
| `MIS_A_JOUR` | « Vacances scolaires mises à jour ({zone} : {années}). » |
| `HORS_LIGNE` | « Impossible de récupérer les vacances scolaires : vérifiez que l'ordinateur est connecté à internet, puis réessayez. Le planning reste utilisable. » |
| `DELAI_DEPASSE` | « Le site de l'Éducation nationale met trop de temps à répondre. Réessayez dans quelques minutes. » |
| `ERREUR_SERVICE` | « Le site de l'Éducation nationale est momentanément indisponible. Réessayez plus tard. » |
| `REPONSE_INVALIDE` | « Les dates reçues sont illisibles. Réessayez plus tard ; si le problème continue, signalez-le. » |
| `NON_PUBLIEE` | « Les vacances de l'année scolaire {année} ne sont pas encore publiées. Réessayez plus tard. » |
| toast automatique | « Les vacances scolaires n'ont pas pu être récupérées. Le planning reste utilisable ; vous pourrez les mettre à jour depuis les Paramètres. » |

En échec, si des dates sont déjà en cache, on ajoute : « Les dates déjà enregistrées restent affichées. »

### 5.3 `src/domain/calendrier/reperes.js` — source unique des repères (grille et impression)

- `@typedef RepereJour` (déplacé depuis `diffusion.js` et complété) : `{ code: 'FERIE'|'DIMANCHE'|'VACANCES_SCOLAIRES', libelle, court, detail }`.
  - `libelle` est le texte de légende, identique pour tous les jours d'un même code ;
  - `court` est le marqueur d'impression ;
  - `detail` est propre au jour (« Toussaint », « Vacances de la Toussaint »), `''` sinon.
- `construireSourcesReperes({ dateDebut, dateFin, periodesVacances = [], zone = null })` renvoie `{ feries: Map, vacances: Map, libelleVacances }`, avec `libelleVacances` = « Vacances scolaires (zone A) ». Le libellé court de la zone vient de la table : « zone A », « Corse », « La Réunion »…
- `reperesDuJour(date, sources = {})` renvoie les repères **dans cet ordre** :
  1. `FERIE` (`libelle` « Jour férié », `court` « F », `detail` = nom du férié) ;
  2. `DIMANCHE` (`libelle` « Dimanche », `court` '', `detail` '') ;
  3. `VACANCES_SCOLAIRES` (`libelle` = `sources.libelleVacances`, `court` « V », `detail` = libellé de la période).

  Avec `sources = {}`, seul `DIMANCHE` sort : c'est le comportement actuel de 0012, conservé.

### 5.4 Adaptateur `src/adaptateurs/calendrierScolaire.js` (hors domaine, seul endroit qui fait du réseau)

`recupererCalendrierScolaire({ valeurZone, anneeScolaire, delaiMs = 10000 })` renvoie `Promise<{ ok: true, enregistrements: object[] } | { ok: false, erreur: 'HORS_LIGNE'|'DELAI_DEPASSE'|'ERREUR_SERVICE'|'REPONSE_INVALIDE' }>`. **Ne lève jamais.**

- **Point d'accès** : API Explore v2.1 d'Opendatasoft, en **export JSON**, qui renvoie un tableau simple, sans pagination. L'endpoint `records` est limité à 100 lignes, or une zone de 11 académies × plusieurs périodes peut dépasser cette limite.

  ```
  GET https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/exports/json
      ?select=description,population,start_date,end_date,location,zones,annee_scolaire
      &where=zones="Zone A" and annee_scolaire="2026-2027"
  ```

  - La requête est construite avec `URLSearchParams` à partir d'une constante `URL_CALENDRIER_SCOLAIRE`, jamais d'une saisie libre.
  - `valeurZone` vient de la table fermée. `anneeScolaire` est validée par `^\d{4}-\d{4}$` avant envoi, sinon `REPONSE_INVALIDE` sans requête.
  - Les guillemets doubles délimitent les chaînes en ODSQL. Repli si `exports/json` pose problème à l'étape 0 : `/records?limit=100` avec le même `where`.
- **Champs utilisés** : `description` (« Vacances de la Toussaint »…), `population` (« - », « Élèves », « Enseignants »), `start_date` et `end_date` (instants ISO 8601 avec fuseau), `zones`, `annee_scolaire` (« 2026-2027 »), `location` (académie, informatif seulement).
- **Options `fetch`** ([ADR 0020](../docs/adr/0020-exception-reseau-api-calendrier-scolaire.md)) : `method: 'GET'`, `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `redirect: 'error'`, `headers: { Accept: 'application/json' }`, `signal` d'un `AbortController` armé à `delaiMs`.
- **Classement des erreurs** :

  | situation | erreur |
  |---|---|
  | `navigator.onLine === false` (si `navigator` existe), avant tout appel | `HORS_LIGNE` |
  | arrêt par le délai (`AbortError`) | `DELAI_DEPASSE` |
  | `TypeError` du `fetch` (réseau, DNS, CORS refusé, redirection refusée) | `HORS_LIGNE` (on ne peut pas distinguer ces cas, et le message couvre les deux) |
  | statut HTTP hors 2xx | `ERREUR_SERVICE` |
  | corps de plus de 1 Mo (lu par `response.text()`), JSON invalide, ou JSON qui n'est pas un tableau | `REPONSE_INVALIDE` |

- **Aucune** journalisation de la réponse. Un `console.warn` court suffit pour le diagnostic, sans le corps de la réponse.
- **CORS** : les API Opendatasoft envoient normalement `Access-Control-Allow-Origin: *`, **à confirmer à l'étape 0 et en recette navigateur**.

### 5.5 Autres modules du domaine

- `src/domain/utils/dates.js` : ajouter `dateCalendaireDepuisInstant(iso)`, qui renvoie `"YYYY-MM-DD"` ou `null`.
  - Une chaîne `^\d{4}-\d{2}-\d{2}$` est renvoyée telle quelle.
  - Sinon : `Date.parse(iso)` ; `NaN` donne `null` ; sinon on prend `new Date(ms + 12 h).toISOString().slice(0, 10)`.
  - JSDoc : arrondi au jour calendaire le plus proche, prévu pour un minuit local de UTC−12 à UTC+12. C'est le **seul** endroit qui touche à `Date` pour cette feature (ADR 0010).
- `src/domain/diffusion.js` : supprimer la `reperesDuJour` locale. À la place, `import { reperesDuJour } from './calendrier/reperes.js'` et `export { reperesDuJour }` pour la compatibilité. Le typedef `RepereJour` renvoie vers `reperes.js`. `construireDiffusion({ sourcesReperes })` ne change pas de signature ; seul le JSDoc « Réservé à 0023 » devient « Repères calendaires (0023) ».

## 6. Composants

| Composant | Changement |
|---|---|
| `src/components/parametres/BlocVacancesScolaires.vue` | **créer** — section §2.1 : en-tête (titre, bouton « Mettre à jour » à droite), liste déroulante des zones (`ZONES_SCOLAIRES`), aide, état du cache (`entreesZoneCourante`, dates par `dateUtil.formatHorodatageDateFr`), alerte de résultat. Dispatche `vacancesScolaires/changerZone` et `vacancesScolaires/mettreAJour`. État local : `enCours`, `resultat`. La zone est lue dans le store (getter, sans brouillon) : elle se met donc à jour toute seule après un import. |
| `src/views/ParametresView.vue` | Monter `<BlocVacancesScolaires />` dans une `<section class="parametres-section">` entre le `</form>` et la section « Sauvegarde ». Aucun ajout au `brouillon` ni à Vuelidate. |
| `src/components/planning/GrillePlanning.vue` | Lire `vacancesScolaires/periodesZoneCourante` et `zoneCourante` (`mapGetters`). Nouveau computed `sourcesReperes` = `construireSourcesReperes({ dateDebut: datesFenetre[0], dateFin: dernière date, periodesVacances, zone })`. `colonnes` ajoute `reperes: reperesDuJour(date, sourcesReperes)`. Dans l'en-tête de ligne : classes `--dimanche`, `--ferie`, `--vacances` et lignes de statut (§2.2), au style de `.grille-planning-jour-statut` (`white-space: normal` pour le férié). Texte réservé aux lecteurs d'écran : classe existante `.grille-planning-texte-invisible`. Icônes `PhFlag`, `PhBackpack`. Mettre à jour le JSDoc d'en-tête. |
| `src/views/PlanningView.vue` | Dispatcher `vacancesScolaires/assurerCouverture({ dateDebut, dateFin })` du planning courant, **sans attendre le résultat** pour afficher la page, dans `mounted` (après la sélection automatique) et dans un `watch` sur `planningCourant?.id` (changement de planning ou nouvelle génération). |
| `src/views/DiffusionView.vue` | Computed `sourcesReperes` (période du planning, `periodesZoneCourante`, `zoneCourante`), passé à `construireDiffusion`. Dans `mounted` et le `watch` `planning` : `assurerCouverture({ …, silencieux: true })`, résultat gardé dans `data.resultatVacances`. Si `!ok` et `etat !== 'SANS_ZONE'` : alerte `d-print-none` (`alert-warning`, `PhWarning`) avec le message §2.3 et un bouton « Réessayer » (`forcer: true`, `aria-busy` pendant l'appel). |
| `src/components/diffusion/MoisDiffusion.vue` | Infobulle du marqueur = `repere.detail` ou, à défaut, `repere.libelle`. Texte réservé aux lecteurs d'écran avec le détail. Styles `.mois-diffusion-ligne--repere-ferie`, identiques au dimanche (un seul sélecteur groupé). `.mois-diffusion-ligne--repere-vacances-scolaires` : `border-left` sur `.mois-diffusion-jour` et fond `$impression-fond-repere-vacances`, avec `print-color-adjust: exact`. Les règles du dimanche et du férié sont déclarées **après** celle des vacances : leur fond l'emporte. |
| `src/components/diffusion/LegendeDiffusion.vue` | Échantillons `--ferie` (comme `--dimanche`, avec « F ») et `--vacances-scolaires` (bordure gauche et fond vacances, avec « V »). Aucun changement de template : le rendu par code existe déjà. |
| `src/styles/_tokens.scss` | Nouveaux tokens : `$couleur-fond-repere-majore` (écran, dimanche et férié : par ex. `rgba($couleur-accent, 0.14)` aplati en hex), `$couleur-bordure-repere-vacances` (par ex. `$couleur-primaire`), `$impression-fond-repere-vacances` (très clair, par ex. mélange 8 % de `$couleur-marque` sur blanc). Valeurs indicatives, **à ajuster par ui-ux**, avec un contraste du texte d'au moins 4,5:1. |

Réutilisés tels quels : `FeuilleDiffusion.vue` (passe déjà `legendeReperes`), `RepereDiffusion.vue`, `PileNotifications.vue`, `BlocSauvegarde.vue`.

## 7. Règles de validation

Pas de Vuelidate : la zone se choisit dans une **liste fermée**, comme « Premier jour de la semaine ». La sécurité vient de `normaliserZoneScolaire` (store, migration, `fromSaveDocument`). Les données venues de l'API sont validées par le domaine (§5.2) et seulement **interpolées** dans les templates (`{{ }}`, jamais `v-html`).

## 8. Points d'attention ergonomie

- **Le texte porte le sens** : « Férié : Toussaint », « Vacances », « F », « V », le gras du dimanche. Les fonds et la barre ne font qu'aider. Lisible en noir et blanc et pour les personnes daltoniennes.
- **Pas de surcharge** : repères dans l'en-tête du jour seulement, jamais dans les cases. La ligne « Vacances » reste courte, le détail est en infobulle et lu par les lecteurs d'écran. Sur mobile (pas de survol), le mot « Vacances » suffit, et le détail est dans les Paramètres et sur le tirage.
- **Rien ne bloque** : sans réseau, le planning, l'édition et l'impression marchent ; seules les vacances manquent. Un seul toast par session pour les tentatives automatiques, pour ne pas harceler.
- **Transparence** : l'aide de la section explique d'où viennent les dates et ce qui est transmis, en une phrase sans jargon (« site public de l'Éducation nationale »).
- **Réversible** : changer de zone ou revenir à « Aucune » se défait en rechoisissant. Pas de confirmation.
- **Attente visible** : bouton désactivé, roue d'attente et `aria-busy` pendant la requête (10 s au plus) ; résultat annoncé (`role="status"`).
- **Avant d'imprimer** : si les vacances manquent, l'alerte de l'aperçu le dit avant le tirage, avec « Réessayer ».
- Contraste des fonds teintés vérifié (texte ≥ 4,5:1). La barre « vacances » ne doit pas se confondre avec le surlignage de conflit (bordure du haut) : elle est à gauche et d'une autre couleur.

## 9. Étapes d'implémentation

**7 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). **Ordre : étape 0 → (T1 ∥ T2) → T3 → (T4 ∥ T5 ∥ T6 ∥ T7)**. Les fichiers de T4, T5, T6 et T7 sont disjoints. Les tokens SCSS, partagés par T5 et T6, sont posés par T1 pour éviter les conflits.

**Étape 0 (orchestrateur, avant T1) — sonde de l'API**, en PowerShell, le résultat restant dans le scratchpad (jamais commité) :

1. Liste exacte des zones :

   ```
   Invoke-RestMethod 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?select=zones&group_by=zones&limit=100'
   ```

   Corriger si besoin la colonne `valeurApi` du §5.2 avant de lancer T1.
2. Échantillon réel, sur l'URL `exports/json` du §5.4 avec Zone A et 2026-2027 : vérifier les noms des champs, le format de `start_date` et `end_date`, les valeurs de `population`, la sémantique des bornes (Toussaint 2026 : fin des cours samedi 17/10/2026, reprise lundi 02/11/2026 selon le calendrier officiel publié sur education.gouv.fr) et le nombre de lignes. L'enregistrer dans le scratchpad (`0023-echantillon.json`).
3. CORS :

   ```
   (Invoke-WebRequest '<même URL>' -Headers @{ Origin = 'http://localhost:5199' }).Headers['Access-Control-Allow-Origin']
   ```

   Résultat attendu : `*` (ou l'origine). S'il est absent, **arrêter** et remonter au porteur, car l'ADR 0020 ne tient plus sans proxy.

Les tâches :

1. **T1 — Domaine calendrier + tokens** (parallèle à T2).
   - Modifier `src/domain/utils/dates.js` (§5.5).
   - Créer `src/domain/calendrier/joursFeries.js` (§5.1), `src/domain/calendrier/vacancesScolaires.js` (§5.2), `src/domain/calendrier/reperes.js` (§5.3).
   - Modifier `src/domain/diffusion.js` (§5.5) et `src/styles/_tokens.scss` (§6, trois tokens).
   - Vérif : script S1–S5 (§11), `npm run build`, diffusion inchangée sans zone (S5).
2. **T2 — Adaptateur réseau** (parallèle à T1).
   - Créer `src/adaptateurs/calendrierScolaire.js` (§5.4). Il ne dépend d'aucun module du domaine : `valeurZone` et `anneeScolaire` lui sont passées.
   - Vérif : script S6 (appel réel depuis Node, qui fournit `fetch` ; erreurs simulées).
3. **T3 — Schéma, migration v9, store** (après T1 et T2).
   - Modifier `src/storage/migrations.js` (`CURRENT_SCHEMA_VERSION = 9`, `MIGRATIONS[8]`, §3.3), `src/domain/schema.js` (§4.3) et `src/store/index.js` (§4.2).
   - Créer `src/store/modules/vacancesScolaires.js` (§4.1).
   - Vérif : script S7 (migration de `files/idelia-sermet.json`), `npm run build`, démarrage de l'appli sans erreur dans la console.
4. **T4 — Paramètres** (après T3).
   - Créer `src/components/parametres/BlocVacancesScolaires.vue`. Modifier `src/views/ParametresView.vue` (§2.1, §6).
   - Vérif : recette R1, R2, R6.
5. **T5 — Grille du planning** (après T3).
   - Modifier `src/components/planning/GrillePlanning.vue` et `src/views/PlanningView.vue` (§2.2, §6).
   - Vérif : recette R3, R5.
6. **T6 — Diffusion et impression** (après T3).
   - Modifier `src/views/DiffusionView.vue`, `src/components/diffusion/MoisDiffusion.vue` et `src/components/diffusion/LegendeDiffusion.vue` (§2.3, §6).
   - Vérif : recette R4, R5.
7. **T7 — Documentation** (après T3, en parallèle de T4 à T6).
   - [`docs/architecture/01-vue-ensemble.md`](../docs/architecture/01-vue-ensemble.md) : flux « Repères calendaires », seul appel réseau, lien ADR 0020.
   - [`02-modele-de-domaine.md`](../docs/architecture/02-modele-de-domaine.md) : `ParametresCabinet.zoneScolaire`, cache `vacancesScolaires`, glossaire « Repère calendaire ».
   - [`03-modele-de-donnees.md`](../docs/architecture/03-modele-de-donnees.md) : structure racine, `schemaVersion` 9, `MIGRATIONS[8]` ; corriger « (= **7**) » en « (= **9**) ».
   - [`04-gestion-etat-vuex.md`](../docs/architecture/04-gestion-etat-vuex.md) : module `vacancesScolaires`.
   - [`06-structure-du-code.md`](../docs/architecture/06-structure-du-code.md) : `domain/calendrier/`, `adaptateurs/calendrierScolaire.js`, module de store.
   - [`07-navigation-et-ecrans.md`](../docs/architecture/07-navigation-et-ecrans.md) : Paramètres, avec « vacances scolaires ».
   - [`docs/adr/0002`](../docs/adr/0002-application-frontend-sans-backend.md) : ajouter sous le statut la ligne « **Amendé par** : [ADR 0020](0020-exception-reseau-api-calendrier-scolaire.md) (lecture de l'API du calendrier scolaire) ».
   - Note : la règle d'or n° 1 de `CLAUDE.md` est modifiée par **l'orchestrateur** (texte proposé dans le compte rendu de l'architecte).

Puis, côté orchestrateur : recette navigateur §11, relecture `ui-ux`, audit `security` (point d'attention : premier appel réseau), passage de la ROADMAP 0023 à ✅ au commit.

## 10. Critères d'acceptation

- [x] Sans zone choisie (défaut), aucune requête vers `data.education.gouv.fr` n'est émise, à vérifier dans l'onglet Réseau. Dimanches et fériés s'affichent quand même.
- [x] Les 11 fériés nationaux s'affichent avec leur nom dans la grille (« Férié : Lundi de Pentecôte » le 25/05/2026) et avec « F » à l'impression. Pâques est juste pour 2024 à 2030.
- [x] Les dimanches sont mis en évidence dans la grille (en-tête teinté) et à l'impression (comme avant).
- [x] Après le choix de la zone A dans Paramètres, les vacances de l'année en cours sont récupérées et l'état affiche « Dates enregistrées : année scolaire 2026-2027 (récupérée le …) ».
- [x] La Toussaint 2026 (zone A) apparaît du **samedi 17/10/2026 au dimanche 01/11/2026 inclus**, et pas le lundi 02/11 (reprise) : aucun décalage d'un jour.
- [x] Les vacances apparaissent dans la grille (« Vacances », barre à gauche) et à l'impression (« V », légende « Vacances scolaires (zone A) »).
- [x] Le cache est dans le fichier de sauvegarde exporté (`vacancesScolaires`, `cabinet.zoneScolaire`). Après import sur un navigateur **hors-ligne**, les vacances s'affichent.
- [x] Rouvrir un planning dont l'année est en cache n'émet **aucune** requête. Un planning sur une année scolaire non encore en cache en émet une (une par année manquante).
- [x] Hors-ligne, avec une année manquante, le planning s'affiche normalement ; un seul toast d'avertissement par session ; aucune erreur dans la console hors un `warn` court.
- [x] Hors-ligne, « Mettre à jour » affiche le message « vérifiez que l'ordinateur est connecté à internet… » et les dates déjà enregistrées restent affichées.
- [x] Changer de zone (A → C) remplace les dates. Revenir à « Aucune » les efface et retire les vacances de la grille et du tirage.
- [x] Aperçu de diffusion avec une zone, mais vacances non récupérables : l'alerte « … n'apparaîtront pas sur ce tirage » et le bouton « Réessayer » sont visibles à l'écran et **absents** à l'impression.
- [x] Un férié tombant un dimanche (01/11/2026) affiche les deux repères. Un jour fermé reste « Fermé » avec ses repères en plus.
- [x] Ouvrir `files/idelia-sermet.json` (schéma v6) migre en v9 sans perte : `zoneScolaire: null`, `vacancesScolaires: []`, tout le reste identique. Une génération à graine égale donne le même planning qu'avant la feature.
- [x] Aucun fichier de `src/domain/scheduling/` n'est modifié.
- [x] La requête n'envoie ni cookie ni `Referer`. Son URL ne contient que la zone et l'année scolaire.

## 11. Vérification

### Script jetable (scratchpad, Vite `createServer({ server: { middlewareMode: true }, appType: 'custom' })` + `ssrLoadModule`, jamais commité)

- **S1 Pâques** : `datePaques` donne 2008-03-23, 2011-04-24, 2019-04-21, 2024-03-31, 2025-04-20, **2026-04-05**, 2027-03-28, 2028-04-16, 2038-04-25. Entrée invalide (`1500`, `'x'`) : `null`.
- **S2 Fériés 2026** : 11 dates exactement, dont 2026-04-06 (lundi de Pâques), 2026-05-14 (Ascension), 2026-05-25 (lundi de Pentecôte), 2026-11-01. Pour 2027 : 2027-03-29, 2027-05-06, 2027-05-17. `joursFeriesEntre('2026-12-20', '2027-01-05')` contient les 25/12 et 01/01.
- **S3 Dates et années scolaires** :
  - `dateCalendaireDepuisInstant` : `'2026-10-16T22:00:00+00:00'` → `'2026-10-17'` ; `'2026-11-01T23:00:00+00:00'` → `'2026-11-02'` ; `'2026-10-17T04:00:00+00:00'` (minuit aux Antilles) → `'2026-10-17'` ; `'2026-10-16T20:00:00+00:00'` (La Réunion) → `'2026-10-17'` ; `'2026-10-17'` → identique ; `'n/a'` → `null`.
  - `anneeScolaireDe('2026-09-01')` = `'2026-2027'`, `anneeScolaireDe('2027-08-31')` = `'2026-2027'`.
  - `anneesScolairesCouvrant('2027-08-20', '2027-09-10')` = `['2026-2027', '2027-2028']`.
- **S4 Normalisation figée** (tableau écrit dans le script, **inspiré** de l'échantillon de l'étape 0, sans données du cabinet) : Toussaint 2026, Zone A, deux académies (doublon), une ligne « Enseignants », une ligne d'une autre zone, une ligne sans `end_date`, une ligne avec `start_date` invalide, un élément `null`. Résultat attendu : exactement `[{ libelle: 'Vacances de la Toussaint', debut: '2026-10-17', fin: '2026-11-01' }]`. Une réponse `{}` donne `null`, une réponse `[]` donne `[]`. Puis `normaliserCacheVacances` sur des entrées mélangées (zone inconnue, année « 2026-2028 », période inversée, doublon) : seules les entrées valides restent, la dernière en cas de doublon.
- **S5 Repères** : `reperesDuJour('2026-11-01', sources)` donne `[FERIE (detail 'Toussaint'), DIMANCHE, VACANCES_SCOLAIRES]` avec une période Toussaint en source ; `reperesDuJour('2026-07-19')` (sans source) donne `[DIMANCHE]`, comme 0012. `construireDiffusion` sans `sourcesReperes` donne un `legendeReperes` identique à avant.
- **S6 Adaptateur** : un appel réel (zone A, 2026-2027) donne `ok: true` avec au moins 10 enregistrements, que `normaliserReponseCalendrierScolaire` transforme en au moins 5 périodes. `anneeScolaire: 'abc'` donne `REPONSE_INVALIDE` sans requête. `delaiMs: 1` donne `DELAI_DEPASSE`. Hôte bloqué (variante de test avec une URL inexistante, sans changer le code commité) : `HORS_LIGNE`.
- **S7 Migration** : `migrate()` sur `files/idelia-sermet.json` lu à l'exécution (jamais copié) donne `schemaVersion` 9, `cabinet.zoneScolaire === null`, `vacancesScolaires` = `[]`, et `personnes`, `tournees`, `absences`, `plannings` profondément égaux à la migration v8 de référence (calculée dans le même script avec `CURRENT_SCHEMA_VERSION` à 8, ou en comparant champ à champ). `verifierIntegrite` OK. `fromSaveDocument` sur un document v9 avec un cache malformé (`vacancesScolaires: 'x'`) donne `entrees: []`, sans erreur.

### Recette navigateur (`npm run dev`, http://localhost:5199/idelia/#/, MCP Playwright)

- **R1** Paramètres, nouvelle section : zone « Aucune » par défaut, aide visible, aucune requête vers `data.education.gouv.fr` dans le réseau. Choisir la zone A : roue d'attente, puis « Vacances scolaires mises à jour (zone A : 2026-2027) » et l'état du cache. Vérifier dans les en-têtes de la requête : aucun `Referer`, aucun cookie, et une réponse avec `Access-Control-Allow-Origin`.
- **R2** Changer pour la zone C : les dates sont remplacées, l'état est à jour. Revenir à « Aucune » : l'état disparaît et le bouton « Mettre à jour » est masqué.
- **R3** Planning (importer `files/idelia-sermet.json`, générer octobre–novembre 2026) avec la zone A :
  - vue Tournées, puis vue Personnes : en-têtes du 17/10 au 01/11 avec « Vacances » ; 01/11 avec « Férié : Toussaint » et le fond teinté ; 11/11 « Férié : Armistice 1918 » ; dimanches teintés ;
  - lecteur d'écran (ou arbre d'accessibilité) : « Vacances scolaires : Vacances de la Toussaint » ;
  - mobile 375 px : lisible, les lignes passent à la ligne sans casser la colonne figée.
- **R4** Diffusion du même planning : « F » le 01/11 et le 11/11, « V » sur les vacances, légende « F Jour férié · V Vacances scolaires (zone A) · Dimanche ». Aperçu d'impression en **noir et blanc** : repères lisibles.
- **R5** **Hors-ligne simulé** : bloquer `data.education.gouv.fr` (Playwright `route` → `abort`, ou DevTools « Offline »).
  - Planning sur une année non en cache (générer septembre 2027) : la grille s'affiche, un seul toast d'avertissement, rien de plus après une navigation aller-retour.
  - Diffusion : l'alerte avec « Réessayer » est visible et absente de l'aperçu d'impression.
  - Réseau rétabli, « Réessayer » : les vacances apparaissent.
  - Données déjà en cache, hors-ligne : affichage normal, aucune alerte.
- **R6** Export, puis « Effacer les données », puis import du fichier exporté avec le réseau coupé : zone et vacances restaurées, affichées sans requête.
- **R7** Non-régression : `files/idelia-sermet.json` importé sans erreur ; génération d'un mois à graine égale identique avant et après la feature ; `git diff --stat` ne montre rien sous `src/domain/scheduling/`.

## 12. Décisions à confirmer / risques

1. **Fériés d'Alsace-Moselle** (Vendredi saint P−2, 26 décembre) : **hors périmètre (proposé)**. Ajout simple plus tard : un booléen `cabinet.feriesAlsaceMoselle` et deux lignes dans `joursFeriesAnnee`. **À confirmer par le porteur** (le cabinet n'est a priori pas concerné).
2. **Outre-mer** : les zones DROM sont proposées pour les vacances, mais leurs fériés propres (abolition de l'esclavage, dates différentes selon le département) ne sont **pas** calculés. Les collectivités du Pacifique et Saint-Pierre-et-Miquelon ne sont pas proposées. Alternative plus simple : ne proposer que A, B, C et Corse. **À confirmer.**
3. **Bornes des vacances** : du jour de fin des cours (samedi) à la **veille de la reprise** (dimanche), comme le calendrier officiel (« fin des cours samedi 17 octobre, reprise lundi 2 novembre »). À vérifier sur l'échantillon réel (étape 0). Si `start_date` désignait autre chose, seule la règle 6 du §5.2 change.
4. **CORS, noms de champs, valeurs de zones** : supposés d'après la documentation Opendatasoft et le jeu `fr-en-calendrier-scolaire`, **à confirmer à l'étape 0**. Sans CORS, on s'arrête et on remonte au porteur : pas de proxy, car ce serait un backend (ADR 0020).
5. **`exports/json` plutôt que `records`** : pas de limite de 100 lignes, pas de pagination. Le repli `records?limit=100` est documenté. Le filtrage défensif (§5.2, règle 2) protège dans les deux cas.
6. **Académies aux dates divergentes dans une même zone** : jours réunis (union). Ce cas est rare ou inexistant en métropole depuis la réforme des zones, et acceptable pour un simple repère visuel.
7. **« Pont de l'Ascension »** et autres libellés de l'API : affichés comme des vacances, sous leur propre libellé. Pas de liste blanche de libellés : on fait confiance à la source officielle.
8. **Années non publiées** : un résultat vide n'est pas mis en cache. Il sera redemandé au prochain chargement de page, ou par le bouton.
9. **Mémoire des échecs par session** : après un échec, pas de nouvelle tentative automatique avant un rechargement de la page. Le bouton « Mettre à jour » et « Réessayer » forcent la tentative. Cela évite de solliciter le service à chaque navigation.
10. **Couverture demandée = période du planning**, pas la fenêtre affichée. Si la grille montre des jours hors période d'une autre année scolaire (cas rare), ils peuvent rester sans vacances. Acceptable (KISS).
11. **Écran : priorité visuelle** : « Fermé » (fond gris) l'emporte sur la teinte du dimanche ou du férié ; les libellés restent. Teintes à valider par `ui-ux`.
12. **CSP** : aucune aujourd'hui. Si on en ajoute une, prévoir `connect-src 'self' https://data.education.gouv.fr` (ADR 0020).
13. **Sécurité** (pour l'audit) : URL constante, paramètres issus de listes fermées ou validés, `credentials: 'omit'`, `no-referrer`, `redirect: 'error'`, corps limité à 1 Mo, 500 lignes au plus, libellés limités à 80 caractères et seulement interpolés. Aucune donnée du cabinet n'est envoyée.
14. **Alternative écartée** : pas de module `calendrier` séparé avec un réglage « afficher les dimanches et fériés ». Ces repères sont toujours affichés, ce qui fait un réglage de moins.

## 13. Retouches de recette (relectures security et ui-ux)

- **M1** : `anneesScolairesCouvrant` valide strictement ses dates (format + aller-retour calendaire, `dateDebut <= dateFin`), sinon `[]` ; garde-fou de 120 itérations (plus de boucle infinie sur `'abc'`).
- **M2** : au plus **4 années scolaires** par appel (les plus anciennes, donc celles qui couvrent le début de la période, dans l'ordre) ; l'adaptateur refuse avant tout appel une année hors **2000-2001 … 2099-2100**.
- **F1** : cache importé durci : dates par aller-retour calendaire, durée max 120 jours, 50 périodes par entrée, 10 entrées au total (les dernières), `recupereLe` ISO valide sinon `null` (affiché « date de récupération inconnue »).
- **UX** : aide `#vacances-aide` réécrite en deux paragraphes courts.
- **Robustesse** : le store ne laisse plus d'entrée périmée dans `requetesEnCours` quand la zone est inconnue.
- **F2 (risque accepté)** : pas de lecture incrémentale du flux ; le corps est limité à 1 Mo après lecture complète.
- **F3 (reporté)** : CSP à décider plus tard (voir point 12).
