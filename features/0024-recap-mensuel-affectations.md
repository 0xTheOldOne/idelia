# Feature 0024 — Récap mensuel des affectations

- **Statut** : En cours
- **Dépend de** : `0011` (éditeur de planning : `PlanningView`, édition temps réel, glisser-déposer), `0020` (`Personne.joursTravaillesParMois`, `src/domain/rythmeMensuel.js`). S'appuie sur `0016` (modèle `Tournee.segments[]`, tournée complète / coupée).
- **ADR liés** : [0008](../docs/adr/0008-moteur-planification-module-pur.md) (calcul en module pur dans `src/domain/`, hors moteur), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, jours ISO 1-7, `dateUtil`), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS + Bootstrap thémé par tokens), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor), [0017](../docs/adr/0017-modelisation-tournees-coupees-segments.md) (type complète / coupée **dérivé** de `segments.length`).

## 1. Contexte & objectif

Retour de la session de test avec le cabinet (planning papier à l'appui) : en préparant le planning, la gestionnaire compte à la main, pour chaque infirmière, **combien de grandes et de petites tournées** elle fait dans le mois et **combien de jours** elle travaille, pour vérifier qu'elle ne dépasse pas son rythme habituel.

`0024` affiche ce compte **d'un coup d'œil**, sous la grille de la page Planning : un tableau par mois civil couvert par le planning, une ligne par personne (titulaires puis remplaçantes), avec grandes tournées, petites tournées, jours travaillés et rythme de travail. Une personne qui **dépasse son rythme** (0020) est signalée **en rouge, avec une icône et un texte** (« Dépasse son rythme de 2 jours »). Le tableau se met à jour **immédiatement** à chaque modification du planning (ajout, retrait, glisser-déposer, annulation, régénération).

Calcul **dérivé, jamais stocké** : aucun nouveau champ, aucune migration.

**Hors périmètre** :
- Impression / diffusion (`0012`) : le récap **n'est pas** ajouté au tirage papier (§12, décision n° 6).
- Cumul entre plusieurs plannings : seul le **planning affiché** est compté (§12, décision n° 4).
- Aucun changement du moteur ni du panneau « Points d'attention » (les avertissements « Rythme de travail dépassé / non atteint » de `0020` restent tels quels).

## 2. Écrans concernés

### 2.1 Page Planning (`/planning`) — nouvelle section « Récapitulatif du mois »

Placée **entre la grille et le panneau « Points d'attention »**, visible dès qu'un planning est affiché, en lecture comme en mode modification, quelle que soit l'orientation de la grille (par tournée / par personne). Aucun nouveau bouton dans l'en-tête.

```
Récapitulatif par mois                                                     (h2)
Grande tournée : tournée coupée faite le matin et le soir. Petite tournée :
tournée d'un seul horaire, ou seulement le matin ou le soir d'une tournée coupée.
Jours travaillés : jours où la personne a au moins une tournée.            (aide)

▼ Octobre 2026 · mois complet · ⚠ 1 personne dépasse son rythme      (<details open>)
  ┌────────────────────┬─────────┬─────────┬──────────┬──────────────────────────────┐
  │ Personne           │ Grandes │ Petites │ Jours    │ Rythme de travail            │
  │                    │ tournées│ tournées│ travaillés│                             │
  ├────────────────────┼─────────┼─────────┼──────────┼──────────────────────────────┤
  │ (C) Claire Martin  │   16    │    0    │   16     │ 15 jours par mois            │ ← fond rouge pâle,
  │     Titulaire      │         │         │          │ ⚠ Dépasse son rythme de 1 jour│   bordure gauche rouge
  │ (P) Paul Durand    │    0    │    9    │    9     │ 10 jours par mois            │
  │     Titulaire      │         │ dont 1 moitié de grande tournée │ ✓ Dans son rythme │
  │ (L) Léa Roux       │   10    │    1    │   11     │ Pas de rythme fixé           │
  │     Remplaçant     │         │ dont 1 moitié…  │          │                      │
  └────────────────────┴─────────┴─────────┴──────────┴──────────────────────────────┘

▼ Novembre 2026 · du 1er au 8 novembre (mois incomplet) · Tout le monde est dans son rythme
  … même tableau …
  Rythme : « 15 jours par mois (environ 4 prévus sur ces jours) »
  Note sous le tableau : « Mois incomplet : seuls les jours de ce planning sont comptés.
  Le rouge n'apparaît que si le rythme du mois entier est déjà dépassé. »
```

Comportement :
- **Un volet par mois civil touché** par la période du planning, dans l'ordre chronologique, **ouvert par défaut** (`<details open>` natif, repliable au clic ou au clavier — même motif que `PanneauConflits`). Le résumé (`<summary>`) reste lisible volet fermé : mois, couverture, nombre de dépassements.
- **Lignes** : toutes les personnes **actives** (même à 0, pour voir qui ne travaille pas) + toute personne **archivée** ayant au moins une affectation ce mois-là (nom suivi de « (archivée) »). Ordre : titulaires, puis remplaçantes, puis par nom et prénom.
- **Pastille** de couleur de la personne avec son repère (`reperePersonne`, comme la grille), nom complet, statut en petit texte atténué dessous.
- **Rouge = jamais la seule information** : icône `PhWarning` + texte « Dépasse son rythme de N jour(s) » + fond et bordure gauche pleine. « Dans son rythme » avec `PhCheckCircle`. Personne sans rythme : « Pas de rythme fixé » en texte atténué, **jamais** de rouge.
- **Temps réel** : le tableau est un `computed` sur le planning du store ; toute modification se reflète sans action de l'utilisateur.
- **Mobile** : tableau dans un conteneur à défilement horizontal (`table-responsive`), colonne « Personne » en premier.

## 3. Modèle de données touché

**Aucun champ persisté ajouté, aucune migration** (`CURRENT_SCHEMA_VERSION` reste à 6). Lus seulement :
- `Planning.dateDebut`, `dateFin`, `affectations[]` (`personneId`, `tourneeId`, `date`, `segmentIndex`) ;
- `Tournee.segments` (type dérivé par `estCoupee`, ADR 0017) ;
- `Personne.prenom`, `nom`, `statut`, `actif`, `couleur`, `initialesVega`, `joursTravaillesParMois`, `dateEntree`, `dateSortie` ;
- `Absence` (via `joursAttendusSurPeriode`, règles 0020 inchangées) ;
- `cabinet.parametres.joursOuverture`.

### 3.1 Structures volatiles (JSDoc, jamais persistées)

```js
/**
 * @typedef {'SANS_RYTHME'|'DANS_LE_RYTHME'|'DEPASSE'} EtatRythme
 *
 * @typedef {Object} LigneRecap
 * @property {string} personneId
 * @property {string} nomComplet        // « Prénom Nom » (+ « (archivée) »), « Personne inconnue » si introuvable
 * @property {string} statutTexte       // libelleStatutPersonne(statut), '' si inconnue
 * @property {string} repere            // reperePersonne(personne), '?' si inconnue
 * @property {string} couleur           // hex, '' si inconnue
 * @property {string} couleurTexte      // couleurTexteRepere(couleur)
 * @property {number} grandes           // tournées coupées faites matin ET soir
 * @property {number} petites           // tournées d'un segment + moitiés de tournée coupée
 * @property {number} moitiesDeGrande   // part de `petites` = un seul segment d'une tournée coupée
 * @property {number} joursTravailles   // dates distinctes
 * @property {(number|null)} rythme     // joursTravaillesParMois valide, sinon null
 * @property {(number|null)} seuil      // nb de jours au-delà duquel on signale ; null si pas de rythme
 * @property {(number|null)} attenduPartie // mois incomplet : jours attendus (arrondis) sur la partie couverte, info neutre ; null sinon
 * @property {number} depassement       // max(0, joursTravailles − seuil) ; 0 sans rythme
 * @property {EtatRythme} etat
 * @property {string} texteRythme       // « 20 jours par mois (15 prévus sur ce mois) », « 3 jours par mois (environ 1 prévu sur ces jours) », « Pas de rythme fixé »
 * @property {string} texteEtat         // « Dépasse son rythme de 1 jour » / « … de 2 jours », « Dans son rythme », '' si SANS_RYTHME
 *
 * @typedef {Object} MoisRecap
 * @property {string} cle               // 'YYYY-MM'
 * @property {string} libelle           // 'Octobre 2026'
 * @property {string} debut             // borne couverte = max(1er du mois, planning.dateDebut)
 * @property {string} fin               // borne couverte = min(fin du mois, planning.dateFin)
 * @property {boolean} complet          // tous les jours OUVERTS du mois sont dans le planning
 * @property {string} texteCouverture   // 'mois complet' | 'du 1er au 8 novembre (mois incomplet)'
 * @property {LigneRecap[]} lignes
 * @property {number} nbDepassements    // nb de lignes à l'état DEPASSE
 * @property {string} texteResume       // '1 personne dépasse son rythme' | '2 personnes dépassent leur rythme' | 'Tout le monde est dans son rythme'
 */
```

## 4. Store (Vuex)

**Aucun module, getter, mutation ni action ajouté ou modifié.** `PlanningView` lit en plus, via `mapState`/`mapGetters` existants :
- `state.personnes.items` (actives **et** archivées, pour nommer une personne archivée affectée) ;
- `state.tournees.items` (actives **et** archivées, pour classer une affectation sur une tournée archivée) ;
- `state.absences.items` ;
- `getters['cabinet/parametres']` (→ `joursOuverture`).

Rien de persisté ; le récap est recalculé à chaque changement de ces sources (réactivité Vue).

## 5. Domaine (logique pure)

### 5.1 `src/domain/recapMensuel.js` (**créer**)

Module pur (aucun import Vue/Vuex, aucun accès stockage). Imports autorisés : `@/domain/utils/dates.js` (`dateUtil`), `@/domain/tournees.js` (`estCoupee`), `@/domain/rythmeMensuel.js` (`normaliserRythmeMensuel`, `estRythmeMensuelValide`, `joursAttendusSurPeriode`), `@/domain/personnes.js` (`reperePersonne`, `couleurTexteRepere`), `@/domain/libelles.js` (`libelleMois`, `libelleStatutPersonne`). **N'importe rien de `@/domain/scheduling/`.**

```js
export function construireRecapMensuel(planning, { personnes, tournees, absences, joursOuverture } = {}) // → MoisRecap[]
```

Algorithme :

1. Garde : `planning` absent ou sans `dateDebut`/`dateFin` → `[]`. Entrées manquantes → listes vides. Dates invalides (format, calendrier, début > fin) → `[]` ; plafond de 36 mois ; éléments non objets ignorés ; tournée sans `segments` = petite tournée ; affectation sans date `YYYY-MM-DD` ignorée.
2. **Mois** : de `dateUtil.debutMois(planning.dateDebut)` tant que `≤ planning.dateFin`, pas `dateUtil.moisSuivant`. Pour chaque mois `m` : `debut = max(m, planning.dateDebut)`, `fin = min(dateUtil.finMois(m), planning.dateFin)`.
3. **Mois complet** : le mois compte au moins un jour ouvert (`dateUtil.weekdayISO(date) ∈ joursOuverture`) **et** aucun jour ouvert du mois n'est hors `[planning.dateDebut, planning.dateFin]`. (Un planning du 02/11 au 30/11 est donc **complet** si le 01/11 est un dimanche fermé.) Mois sans aucun jour ouvert → `complet = false`.
4. **Comptage** des affectations dont `debut ≤ date ≤ fin` :
   - regrouper par **(personneId, date, tourneeId)** → ensemble des `segmentIndex` ;
   - pour chaque groupe : tournée résolue et `estCoupee(tournee)` → si l'ensemble contient **tous** les indices `0..segments.length−1` : **+1 grande** ; sinon **+1 petite** et **+1 `moitiesDeGrande`** ;
   - tournée d'un seul segment, ou tournée introuvable : **+1 petite** ;
   - `joursTravailles` = nombre de **dates distinctes** de la personne dans le mois (une tournée coupée faite matin et soir = 1 jour ; deux tournées le même jour = 1 jour).
5. **Lignes** : personnes `actif !== false` + personnes ayant ≥ 1 affectation ce mois-ci (archivées ou introuvables). Tri : `TITULAIRE` (0), `REMPLACANT` (1), autre/inconnue (2), puis `nom`, `prenom` (`localeCompare(…, 'fr')`), puis `id`.
6. **Rythme et seuil** : `rythme = normaliserRythmeMensuel(p.joursTravaillesParMois)`, ramené à `null` s'il n'est pas `estRythmeMensuelValide`.
   - `rythme === null` → `seuil = null`, `etat = 'SANS_RYTHME'`, `texteRythme = 'Pas de rythme fixé'`, `texteEtat = ''`.
   - **Mois complet** → `seuil = joursAttendusSurPeriode(p, { debut: m, fin: finMois(m) }, { joursOuverture, absences }).attenduArrondi` (même prorata absences validées journée entière / présence que le moteur, 0020). `texteRythme` = `libelleRythme` + « (N prévu(s) sur ce mois) », ex. « 20 jours par mois (15 prévus sur ce mois) ».
   - **Mois incomplet** → `seuil = rythme` (le rythme du mois entier : un dépassement est alors **certain**, aucun faux positif). `attenduPartie = joursAttendusSurPeriode(p, { debut, fin }, …).attenduArrondi`, affiché à titre indicatif : « 15 jours par mois (environ 4 prévus sur ces jours) ».
   - `depassement = max(0, joursTravailles − seuil)` ; `etat = depassement > 0 ? 'DEPASSE' : 'DANS_LE_RYTHME'` ; `texteEtat` = « Dépasse son rythme de 1 jour » / « … de N jours » ou « Dans son rythme ».
7. `libelle` = `libelleMois(numéro) + ' ' + année` ; `texteCouverture` = « mois complet » ou « du 1er au 8 novembre (mois incomplet) » (1er pour le 1, sinon le nombre sans zéro ; mois en toutes lettres) ; `texteResume` (§3.1).

Aucun objet `Date` hors `dateUtil` ; comparaisons de chaînes `"YYYY-MM-DD"`.

### 5.2 Réutilisé (non modifié)

`src/domain/rythmeMensuel.js` (0020), `src/domain/tournees.js` (`estCoupee`), `src/domain/personnes.js` (`reperePersonne`, `couleurTexteRepere`, `libelleRythme`), `src/domain/libelles.js` (`libelleMois`, `libelleStatutPersonne`), `src/domain/utils/dates.js`.

## 6. Composants

### 6.1 `src/components/planning/RecapMensuel.vue` (**créer**)

Composant **présentationnel**, Options API, **sans accès au store**, sans logique métier (il n'affiche que les champs de `MoisRecap`/`LigneRecap`, textes compris).
- Prop : `mois: { type: Array, required: true }` (`MoisRecap[]`).
- Structure : `<section aria-labelledby="recap-mensuel-titre">`, `h2` « Récapitulatif par mois », paragraphe d'aide (§2.1), puis un `<details open>` par mois (`:key="m.cle"`).
- `<summary>` : chevron `PhCaretRight` (rotation à l'ouverture, comme `PanneauConflits`), `libelle` en gras, `· texteCouverture`, `· texteResume` précédé de `PhWarning` si `nbDepassements > 0` (sinon `PhCheckCircle`).
- `<div class="table-responsive">` + `<table class="table table-sm recap-mensuel-table">` : `<caption class="visually-hidden">` « {libelle} : tournées et jours travaillés par personne », `th scope="col"` pour les en-têtes, `th scope="row"` pour la cellule Personne.
- Cellule Personne : pastille (fond `couleur`, texte `couleurTexte`, contenu `repere`, `aria-hidden="true"`) + `nomComplet` + `statutTexte` en `small` atténué.
- Cellule Petites : nombre ; si `moitiesDeGrande > 0`, `small` dessous « dont 1 moitié de grande tournée » / « dont N moitiés de grande tournée ».
- Cellule Rythme : `texteRythme` ; dessous, si `etat === 'DEPASSE'` : `PhWarning` (bold) + `texteEtat` en gras couleur erreur ; si `DANS_LE_RYTHME` : `PhCheckCircle` + `texteEtat` atténué.
- Ligne à l'état `DEPASSE` : classe `recap-mensuel-ligne--depasse` (fond `rgba($couleur-erreur, 0.08)`, bordure gauche pleine 3px `$couleur-erreur`).
- Sous le tableau d'un mois **incomplet** : note atténuée « Mois incomplet : seuls les jours de ce planning sont comptés. Le rouge n'apparaît que si le rythme du mois entier est déjà dépassé. »
- `mois.length === 0` → rien n'est rendu (`v-if` sur la section).
- Style : SCSS scoped, tokens uniquement (`@use '@/styles/tokens' as t`), chiffres centrés (`font-variant-numeric: tabular-nums`), cible du `summary` ≥ `t.$cible-cliquable-min`, `:focus-visible` avec `t.$couleur-focus`. Aucun nouveau token.

### 6.2 `src/views/PlanningView.vue` (**modifier**)

- Importer et déclarer `RecapMensuel` et `construireRecapMensuel`.
- Ajouter dans `computed` : `mapState` pour `personnes.items`, `tournees.items`, `absences.items` (noms explicites : `toutesLesPersonnes`, `toutesLesTournees`, `toutesLesAbsences`) et `mapGetters('cabinet', { parametresCabinet: 'parametres' })`.
- `computed recapMensuel()` → `construireRecapMensuel(this.planningCourant, { personnes, tournees, absences, joursOuverture: this.parametresCabinet?.joursOuverture ?? [] })`.
- Template : `<RecapMensuel :mois="recapMensuel" />` entre `</GrillePlanning>` et `<PanneauConflits …>`.
- Compléter le bloc JSDoc du composant (une phrase « Récapitulatif mensuel (0024) »). **Ne rien changer d'autre** (pas de `rafraichirDiagnostics` : la réactivité suffit).

### 6.3 Réutilisé

Motif `<details>`/`<summary>` + chevron de `PanneauConflits.vue`, pastille personne de la grille, `table` Bootstrap, icônes `PhWarning`, `PhCheckCircle`, `PhCaretRight`.

## 7. Règles de validation

Sans objet : aucune saisie.

## 8. Points d'attention ergonomie

- **Vocabulaire du cabinet** : « grandes / petites tournées », « jours travaillés », « rythme de travail », « jours par mois ». Jamais « cible », « segment », « affectation », « quotité » à l'écran (cohérent avec 0020 §8).
- **Définitions visibles** : la phrase d'aide explique grande / petite / jour travaillé, sans infobulle à découvrir.
- **Rouge jamais seul** : icône + texte + bordure ; texte concret avec le nombre de jours de trop.
- **Pas de fausse alerte** : sur un mois incomplet, le rouge n'apparaît que si le dépassement est certain ; l'indication « environ N prévus sur ces jours » reste neutre. La note sous le tableau l'explique.
- **Rassurant** : « Dans son rythme » coché ; résumé « Tout le monde est dans son rythme » lisible volet fermé.
- **Personnes à 0** affichées : on voit aussi qui n'a rien.
- **Temps réel** : aucune action pour mettre à jour ; l'effet d'un glisser-déposer se voit tout de suite.
- **Accessibilité** : tableau avec `caption`, en-têtes `scope`, `details/summary` natifs (clavier), icônes décoratives `aria-hidden`, contrastes AA des tokens, cibles ≥ 44 px.
- **Préférences d'en-tête** : aucun bouton ajouté dans l'en-tête du planning.

## 9. Étapes d'implémentation

**2 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). **Séquentielles : T1 → T2** (T2 importe le module de T1 ; le contrat §3.1 est figé, donc la rédaction du composant peut démarrer en parallèle si besoin, mais la vérification de T2 exige T1 terminée).

### Tâche 1 — Module pur `recapMensuel.js`

**Fichiers** :
- `src/domain/recapMensuel.js` (**créer**) — §3.1 (typedefs JSDoc), §5.1.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — sous `domain/`, après `rythmeMensuel.js` : `recapMensuel.js  # récap par mois et par personne : grandes/petites tournées, jours travaillés, dépassement du rythme [0024]`.

**Critères de sortie** :
- Script jetable dans le dossier temporaire de session (**jamais dans le dépôt**), qui crée un serveur Vite (`createServer` depuis `node_modules/vite`, `root` = projet, `server.middlewareMode: true`) et charge `src/domain/recapMensuel.js` via `ssrLoadModule` ; il rejoue le **jeu d'essai §11.1** et vérifie chaque valeur attendue ; supprimé après usage.
- Aucun import de `@/domain/scheduling/`, de `vue` ou de `vuex` ; `npm run build` réussit.

### Tâche 2 — Composant `RecapMensuel` et intégration à la page Planning

**Fichiers** :
- `src/components/planning/RecapMensuel.vue` (**créer**) — §2.1, §6.1, §8.
- `src/views/PlanningView.vue` (**modifier**) — §6.2.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — ligne `planning/` : « grille, cellule, panneau de conflits, récap mensuel [0024], drag & drop ».
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) — ligne `/planning` : « Générer, éditer (drag & drop), voir les conflits, récap mensuel par personne | `0010`, `0011`, `0024` ».

**Dépend de** : T1.

**Critères de sortie** : recette navigateur §11.2 ; `npm run build` réussit ; `RecapMensuel.vue` n'importe ni le store ni aucun module `@/domain/` (présentationnel pur).

## 10. Critères d'acceptation

**Calcul** (script jetable, jeu d'essai §11.1)
- [x] Une tournée coupée faite matin et soir par la même personne compte **1 grande tournée** et **1 jour**.
- [x] Une tournée d'un seul horaire compte **1 petite tournée**.
- [x] Une personne qui ne fait que le matin (ou que le soir) d'une tournée coupée compte **1 petite tournée**, mentionnée « dont 1 moitié de grande tournée ».
- [x] Deux tournées le même jour = **1 jour travaillé**.
- [x] Un planning à cheval sur deux mois donne **deux volets**, chacun ne comptant que ses propres jours.
- [x] Mois complet sans absence, rythme 15, 16 jours → « Dépasse son rythme de 1 jour ».
- [x] Mois complet avec une semaine d'absence validée (journée entière), rythme 15 → « 15 jours par mois (11 prévus sur ce mois) » ; 12 jours → dépassement de 1.
- [x] Planning du 02/11 au 30/11/2026 (le 01/11 étant un dimanche fermé) → novembre considéré **complet**.
- [x] Mois incomplet : 6 jours pour un rythme de 15 → **pas de rouge**, « environ 4 prévus sur ces jours » ; 11 jours pour un rythme de 10 → rouge (« Dépasse son rythme de 1 jour »).
- [x] Personne sans rythme : jamais de rouge, « Pas de rythme fixé ».
- [x] Personne active sans affectation : ligne à 0 ; personne archivée affectée : ligne avec « (archivée) ».

**Écran Planning** (navigateur)
- [x] La section « Récapitulatif par mois » apparaît sous la grille, au-dessus des « Points d'attention », avec l'aide qui définit grande / petite tournée et jour travaillé.
- [x] Titulaires d'abord, puis remplaçantes ; chaque ligne a la pastille de couleur, le nom et le statut.
- [x] Un dépassement est visible **sans la couleur** (icône + texte « Dépasse son rythme de N jour(s) ») ; le résumé du volet l'indique aussi volet fermé.
- [x] Glisser-déposer une affectation d'une personne à une autre (mode modification) : les compteurs des deux personnes changent **immédiatement** ; « Annuler la dernière action » les rétablit.
- [x] Retirer le soir d'une tournée coupée faite par une personne : sa grande tournée devient « 1 petite tournée, dont 1 moitié de grande tournée ».
- [x] Le récap reste affiché en lecture, en mode modification, en affichage par tournée et par personne.
- [x] Volets repliables à la souris et au clavier (Tab + Entrée/Espace), focus visible.
- [x] Sur mobile, le tableau défile horizontalement sans casser la page.
- [x] Aucune nouvelle clé dans `localStorage`, `schemaVersion` inchangé (6).
- [x] `npm run build` réussit.

## 11. Vérification

### 11.1 Jeu d'essai (script jetable, T1)

Cabinet ouvert du lundi au samedi (`joursOuverture: [1,2,3,4,5,6]`). Ids générés par `crypto.randomUUID()` (GUID), noms **fictifs**.

**Tournées**
- `tA` « Tournée A » : 2 segments `07:00–13:30` / `16:30–20:30` (coupée), jours 1-6.
- `tB` « Tournée B » : 1 segment `07:00–13:00`, jours 1, 3, 5.

**Personnes**
- `claire` Claire Martin, TITULAIRE, actif, `joursTravaillesParMois: 15`.
- `paul` Paul Durand, TITULAIRE, actif, `10`.
- `lea` Léa Roux, REMPLACANT, actif, `null`, `titulaireId: claire`.
- `sophie` Sophie Bernard, TITULAIRE, actif, `12`, aucune affectation.
- `marc` Marc Petit, TITULAIRE, **archivé** (`actif: false`), `null`.

Une affectation = `{ id: GUID, personneId, tourneeId, date, segmentIndex }`.

**Scénario 1 — chevauchement de deux mois** : planning `2026-10-01 → 2026-11-08`.
- Claire : `tA` segments 0 **et** 1 sur les jours ouverts du 01/10 au 19/10 (16 jours) et du 02/11 au 07/11 (6 jours).
- Paul : `tB` les lundis et mercredis d'octobre (5, 7, 12, 14, 19, 21, 26, 28 → 8 jours) + `tA` segment 0 seul le 20/10.
- Léa : `tA` segment 1 seul le 20/10 + `tA` segments 0 et 1 du 21/10 au 31/10 (10 jours ouverts).
- Marc : `tB` le 30/10.

| Mois | Personne | Grandes | Petites (dont moitiés) | Jours | Seuil | État / textes |
|---|---|---|---|---|---|---|
| Oct. (complet) | Claire | 16 | 0 | 16 | 15 | DEPASSE 1 — « Dépasse son rythme de 1 jour » |
| Oct. | Paul | 0 | 9 (1) | 9 | 10 | DANS_LE_RYTHME |
| Oct. | Léa | 10 | 1 (1) | 11 | — | SANS_RYTHME — « Pas de rythme fixé » |
| Oct. | Sophie | 0 | 0 | 0 | 12 | DANS_LE_RYTHME |
| Oct. | Marc | 0 | 1 | 1 | — | SANS_RYTHME, nom « Marc Petit (archivée) » |
| Nov. (incomplet, « du 1er au 8 novembre (mois incomplet) ») | Claire | 6 | 0 | 6 | 15 | DANS_LE_RYTHME, `attenduPartie` 4 (15 × 6/25 = 3,6), « 15 jours par mois (environ 4 prévus sur ces jours) » |
| Nov. | Marc | — | — | — | — | **absent** (archivé, aucune affectation en novembre) |

Ordre des lignes d'octobre : Sophie Bernard, Paul Durand, Claire Martin, Marc Petit (titulaires, par nom), puis Léa Roux. En novembre, Paul, Sophie et Léa (actifs) figurent aussi, à 0. `nbDepassements` : octobre 1, novembre 0.

**Scénario 2 — mois complet malgré un 1er jour fermé, absence** : planning `2026-11-02 → 2026-11-30` ; absence de Claire `{ statut: 'VALIDE', creneau: 'JOURNEE', dateDebut: '2026-11-09', dateFin: '2026-11-14' }`.
- Claire : `tA` segments 0 et 1 du 02/11 au 07/11 et du 16/11 au 21/11 (12 jours).
- Paul : `tB` tous les lundis, mercredis et vendredis de novembre à partir du 02/11 (13 jours).
- Attendu : novembre `complet: true`, « mois complet » ; Claire seuil 11 (15 × 19/25 = 11,4), « 15 jours par mois (11 prévus sur ce mois) », DEPASSE 1 ; Paul seuil 10, 13 petites, DEPASSE 3 (« Dépasse son rythme de 3 jours ») ; `texteResume` « 2 personnes dépassent leur rythme ».

**Scénario 3 — mois incomplet, dépassement certain** : planning `2026-12-01 → 2026-12-20` ; Paul `tA` segments 0 et 1 du 01/12 au 12/12 (11 jours ouverts).
- Attendu : décembre `complet: false` ; Paul 11 grandes, 11 jours, seuil 10, DEPASSE 1, `attenduPartie` 6 (10 × 17/27 ≈ 6,3).

**Scénario 4 — robustesse** : `construireRecapMensuel(null, …)` → `[]` ; planning sans affectation → lignes des actifs à 0, aucune erreur ; `joursOuverture: []` → `complet: false` partout, aucun crash ; affectation sur une tournée introuvable → comptée en petite tournée.

### 11.2 Recette navigateur (T2)

1. `npm run dev` → http://localhost:5199/idelia/#/ ; importer `files/idelia-sermet.json` (Paramètres > Sauvegarde) — données réelles : ne rien en recopier dans le dépôt ni dans un rapport.
2. **Équipe** : fixer un rythme bas (ex. 3 jours par mois) à une titulaire pour provoquer un dépassement ; laisser une personne sans rythme.
3. **Planning** : générer du 26/10/2026 au 08/11/2026 → deux volets (octobre et novembre, tous deux « mois incomplet ») ; contrôler grandes / petites / jours en recomptant sur la grille.
4. Vérifier le rouge (icône + texte) sur la titulaire au rythme bas seulement si ses jours d'un mois dépassent 3 ; aucune ligne rouge pour la personne sans rythme.
5. Mode modification : glisser une affectation de la tournée coupée vers une autre personne, retirer le soir d'une tournée coupée, annuler → compteurs à jour à chaque geste.
6. Générer un mois complet (01/11 → 30/11/2026) → « mois complet », rythme ramené si une absence validée existe.
7. Basculer l'affichage par personne / par tournée, replier / déplier les volets au clavier, réduire la fenêtre (mobile).
8. DevTools > Application : aucune nouvelle clé, `schemaVersion` 6.
9. Relecture `ui-ux` (libellés, aide, rouge non exclusif), puis audit `security` (interpolation seule, aucun `v-html`, aucun accès stockage).

## 12. Décisions à confirmer / risques

**Hypothèses à faire confirmer par le porteur (cabinet)**

1. **Grande = tournée coupée faite matin et soir ; petite = tournée d'un seul horaire.** Rien ne définit ces termes dans l'appli ; la règle est **dérivée** du modèle (`segments.length`, ADR 0017) et correspond à la forme des tournées réelles du cabinet (une tournée matin + reprise du soir tous les jours, une tournée du matin seule certains jours). Avantages : aucun champ, aucune migration, aucune saisie. **Si le cabinet a une grande tournée d'un seul horaire** (ou l'inverse), il faudra un champ `Tournee.taille` (`GRANDE`/`PETITE`) saisi dans le formulaire de tournée → migration v7, changement local à `recapMensuel.js` (le classement reste isolé dans une seule fonction).
2. **Moitié de tournée coupée** (seulement le matin ou seulement le soir) : comptée comme **petite tournée**, avec la mention « dont N moitié(s) de grande tournée » pour ne rien cacher. Alternative si le cabinet préfère : la compter en grande, ou ne pas la compter (changement local).
3. **Seuil de rouge** :
   - mois **complet** → jours attendus du mois selon 0020 (rythme réduit par les absences validées journée entière et les dates d'arrivée / départ), soit **la même règle que l'avertissement « Rythme de travail dépassé » du moteur** — pas d'écart entre le récap et les points d'attention. Si la question ouverte n° 9 de 0020 est tranchée « 15 reste 15 même avec des congés », passer à `seuil = rythme` (une ligne) ;
   - mois **incomplet** → rouge seulement si les jours du planning dépassent déjà le rythme du **mois entier** (dépassement certain, aucun faux positif) ; l'attendu au prorata est montré en information neutre.
4. **Seul le planning affiché est compté**. Si le cabinet découpe un mois en plusieurs plannings (par semaine), le récap d'un mois incomplet ne voit pas les autres semaines. Cumuler plusieurs plannings supposerait de savoir lesquels sont « les bons » (variantes, plannings qui se chevauchent) → hors périmètre ; à reconsidérer avec `0028` (versions).
5. **Libellé** : la demande parle de « dépasse la cible de N jours » ; le plan utilise **« Dépasse son rythme de N jours »**, car 0020 a fixé le vocabulaire « Rythme de travail » et proscrit « cible » à l'écran. À valider en relecture `ui-ux`.
6. **Impression (0012)** : récap **non imprimé**. Le tirage papier est diffusé à toute l'équipe, alors que le récap (et son rouge) est un outil de la gestionnaire ; l'ajouter chargerait aussi la pagination A4 de `diffusion.js`. Suite possible si le cabinet le demande : une case « Ajouter le récapitulatif » dans `DiffusionView`, avec un tableau sans couleur (repère texte), en réutilisant `construireRecapMensuel` tel quel.
7. **Lignes** : toutes les personnes actives (même à 0) + les archivées affectées. Les remplaçantes sont comptées comme les titulaires ; elles n'ont en général pas de rythme, donc pas de rouge.

**Risques**

- **Long planning** (plusieurs mois) : autant de volets ouverts que de mois → page longue. Acceptable (le cabinet planifie au mois ou à la semaine) ; si besoin, n'ouvrir par défaut que le mois de `dateReference` de la grille (changement local au composant).
- **Tournée modifiée après coup** (passée de coupée à un seul horaire) : le classement suit la définition **actuelle** de la tournée, comme la grille. Cohérent, mais un ancien planning peut changer de récap.
- **Écart avec les points d'attention** sur un mois incomplet : le moteur peut signaler « Rythme de travail dépassé » (prorata sur la période) alors que le récap n'est pas rouge (dépassement non certain). C'est voulu ; la note sous le tableau l'explique.
- **Aucun écart d'ADR** : calcul pur dans `src/domain/` (ADR 0008), dates en chaînes (ADR 0010), rien de persisté (ADR 0005), Phosphor (ADR 0013), Bootstrap + tokens (ADR 0015).
