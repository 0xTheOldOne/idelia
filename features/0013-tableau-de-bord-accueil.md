# Feature 0013 — Tableau de bord (Accueil)

- **Statut** : À faire
- **Dépend de** : `0004` (`personnes/actifs` — indicateur « Équipe active », tuile « Ajouter une personne »), `0006` (`tournees/actives` — indicateur « Tournées »), `0007` (`absences.items` — indicateur « Absences à venir », tuile « Saisir une absence »), `0011` (écran `/planning` complet : `plannings.items`, mutation `SELECT`, `diagnostiquer`/`evaluerCourant`, ouverture d'un planning précis dans l'éditeur). S'appuie aussi sur `0002` (store persisté, état racine `statutSauvegarde`/`derniereSauvegarde`, plugin de persistance), `0003` (composant `IndicateurSauvegarde`, getter `cabinet/parametres` → `nomCabinet`), `0008` (action racine `exporter` — bouton « Exporter une sauvegarde », **aucun** envoi réseau, [ADR 0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md)), `0009` (fonction pure `diagnostiquer` du moteur, appelée **via une action** du store). **Séquencer après `0014` (identité visuelle) et `0015` (menu latéral)** pour le rendu final — voir la note de coordination ci-dessous ; la feature reste toutefois **buildable en standalone** (elle n'emploie que des tokens déjà existants, dont les noms sont préservés par `0014`).
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (aucun backend : l'« export de sauvegarde » réutilise `0008`, jamais d'envoi réseau), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance via le store/plugin, jamais `localStorage` direct), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (export JSON), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (le moteur reste pur : tout appel — dont `diagnostiquer` — passe par une action du store, jamais depuis un composant), [0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md) (workflow référent : rappel visible de la sauvegarde, statut de diffusion des plannings), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"`, jours ISO 1-7, aucun objet `Date` hors `dateUtil`), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS thémé par tokens, base Bootstrap), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor uniquement).

> ### Note de coordination (à lire avant de démarrer)
>
> - **Fichier partagé `src/domain/libelles.js`** : `0013` y ajoute les libellés de statut de planning. `0014`/`0015` n'y touchent pas ; risque de conflit uniquement avec une autre session éditant `libelles.js`.
> - **Fichier partagé `src/domain/utils/dates.js`** : `0013` y ajoute `numeroSemaineIso`. `0010` y avait déjà ajouté les helpers de fenêtre calendaire ; se caler sur le même style (helper pur, exporté dans l'objet `dateUtil`).
> - **Fichier partagé `src/store/modules/plannings.js`** : `0013` y ajoute **une** action lecture seule (`resumeConflits`). `0011` a laissé ce module riche (génération, édition, régénération, undo) ; **ne rien modifier d'existant**, seulement **ajouter** l'action et réutiliser le helper privé `assemblerEntree` déjà présent.
> - **`0014` (identité) / `0015` (layout)** : `0013` crée **son propre écran** (`AccueilView.vue`) et ses composants dans `src/components/accueil/` — il ne touche **ni** `App.vue` (refondu par `0015`) **ni** `_tokens.scss` (refondu par `0014`). L'en-tête d'écran de `0013` (fil d'Ariane + titre + action) est du **contenu de vue**, hors du périmètre de `0015` (qui ne livre que le « shell » de navigation). Pour rester buildable sans `0014`, `0013` **n'emploie que des tokens existants** (`$couleur-primaire`, `$couleur-fond`, `$couleur-fond-clair`, `$couleur-bordure`, `$couleur-texte`, `$couleur-texte-attenue`, sémantiques, espacements, rayons) — tous **conservés par `0014`** ([0014 §12.3](0014-refonte-identite-visuelle.md)) : le tableau de bord se re-thème automatiquement quand `0014` atterrit. **Ne pas** référencer les tokens *nouveaux* de `0014` (`$couleur-accent`, `$couleur-marque`, `$couleur-page`, `$graisse-moyenne`…) tant que `0014` n'est pas mergée (voir §12).

## 1. Contexte & objectif

`/` (Accueil) est aujourd'hui un placeholder (« Cet écran arrivera prochainement. »). C'est pourtant la **porte d'entrée** de l'application et, pour un référent **peu à l'aise avec l'informatique**, l'endroit qui doit répondre en un coup d'œil à : « où en suis-je, et que puis-je faire tout de suite ? ».

`0013` transforme cet écran en **tableau de bord** : une **vue d'ensemble** chiffrée (équipe, tournées, absences à venir, prochain planning), des **actions rapides** à cibles larges (ouvrir le planning, ajouter une personne, saisir une absence), un accès aux **plannings récents** avec leur statut, une carte **« À traiter »** qui pointe les conflits du planning à venir, et un rappel de l'**état de sauvegarde** avec un bouton d'export. Rien n'est calculé ni décidé dans le composant : il **agrège** ce que le store et le domaine exposent déjà.

**Hors périmètre `0013`** :

- **Générer, éditer, diffuser un planning** — c'est `0010`/`0011`/`0012`. Le tableau de bord **renvoie** vers `/planning` (et sélectionne le bon planning au passage), il ne génère ni ne modifie rien.
- **CRUD équipe/tournées/absences** — features `0004`/`0006`/`0007`. Les tuiles d'action **naviguent** vers ces écrans.
- **Import de sauvegarde** — l'écran propose l'**export** (réutilise `0008`) ; l'import complet reste sur `/parametres` (`0008`).
- **Identité visuelle & menu latéral** — features `0014`/`0015`. `0013` consomme les tokens/le shell existants sans les redéfinir.

## 2. Écrans concernés

Une seule route, déjà déclarée en `0001` ([07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md), ligne `/` → Accueil, feature `0013`) :

| Route | Écran | Changement `0013` |
|---|---|---|
| `/` | **Accueil** | Remplace le placeholder par le **tableau de bord** (vue d'ensemble, actions rapides, plannings récents, à traiter, sauvegarde). |

Aucune route ajoutée ni paramétrée. Le tableau de bord **navigue** vers des routes existantes (`equipe`, `tournees`, `absences`, `planning`, `parametres`).

**Expérience visée** (utilisateur non-technique) :

- **En-tête clair** : un fil d'Ariane = **nom du cabinet** (issu des réglages), un grand titre **« Tableau de bord »**, et **une action principale dominante** — **« Générer un planning »** (bouton `btn btn-primary`, icône Phosphor) qui mène à l'écran Planning.
- **Trois actions rapides** sous forme de **grandes tuiles cliquables** (cibles très larges, bien plus que 44 px) : « Ouvrir le planning en cours », « Ajouter une personne », « Saisir une absence ». La première est **mise en avant** (couleur d'accent) car c'est le geste le plus fréquent.
- **Vue d'ensemble** : quatre **indicateurs** lisibles (grand chiffre + libellé + icône), eux-mêmes cliquables vers l'écran concerné — « Équipe active », « Tournées », « Absences à venir », « Prochain planning » (ex. « Sem. 29 »).
- **Deux colonnes** dessous : à gauche les **« Plannings récents »** (liste cliquable : semaine, dates, **statut** en clair, et une **méta** utile) ; à droite une carte **« À traiter »** (conflits du planning à venir → « Ouvrir l'éditeur ») et une carte **« Sauvegarde »** (« Dernière sauvegarde le… » + « Exporter une sauvegarde »).
- **Jamais de cul-de-sac** : sur une base vide (pas d'équipe, pas de planning), chaque bloc explique quoi faire et propose le bon lien.

## 3. Modèle de données touché

**Aucune nouvelle entité, aucun nouveau champ, aucune migration** (`schemaVersion` reste `1`). Le tableau de bord **lit** des entités existantes ([02](../docs/architecture/02-modele-de-domaine.md)) :

- `Personne` (via `personnes/actifs`) — comptage « Équipe active ».
- `Tournee` (via `tournees/actives`) — comptage « Tournées ».
- `Absence` (via `absences.items`) — « Absences à venir » : filtrées par date et statut (§5).
- `Planning` (via `plannings.items`) — « Plannings récents », « Prochain planning », « À traiter ». Les champs lus : `id`, `nom`, `dateDebut`, `dateFin`, `statut` (`BROUILLON`/`VALIDE`/`PUBLIE`), `publieLe`, `updatedAt`, `affectations`.
- État racine `statutSauvegarde` / `derniereSauvegarde` — carte « Sauvegarde ».
- `ParametresCabinet.nomCabinet` (via `cabinet/parametres`) — fil d'Ariane.

**Jamais persisté / recalculé à la volée** ([02](../docs/architecture/02-modele-de-domaine.md) : « les diagnostics ne sont jamais stockés ») : les **conflits** d'un planning (violations / tournées non couvertes) affichés dans « À traiter » et dans la méta d'une entrée récente sont **recalculés** par le moteur (`diagnostiquer`, via l'action `plannings/resumeConflits`, §4), **jamais lus depuis un stockage** ni **dérivés en UI**.

## 4. Store (Vuex)

Le tableau de bord consomme des getters/état **déjà en place** et n'ajoute qu'**une** brique côté store — l'appel moteur devant obligatoirement passer par une action ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)). Tout le reste (comptages, sélection « à venir »/« prochain », résumé d'un diagnostic) est de la **logique pure** placée dans le domaine (§5) et invoquée par le composant avec des données du store — cohérent avec `AbsencesView` (qui importe `dateUtil` et trie en `computed`).

### 4.1 Getters / état lus (existants, en lecture seule)

- `personnes/actifs`, `tournees/actives` — comptages (`.length`).
- `mapState('absences', ['items'])`, `mapState('plannings', ['items'])` — sources des sélecteurs purs (§5).
- `cabinet/parametres` — `nomCabinet`.
- `mapState(['statutSauvegarde', 'derniereSauvegarde'])` — carte « Sauvegarde ».

### 4.2 Mutation réutilisée (existante) — ouvrir un planning précis dans l'éditeur

Pour rendre les **plannings récents** et le bouton **« Ouvrir l'éditeur »** réellement cliquables vers **le bon** planning : le composant `commit('plannings/SELECT', id)` **puis** `router.push({ name: 'planning' })`. `PlanningView` (`0011`) respecte une sélection déjà posée (son `mounted` n'auto-sélectionne que si `selectionId` est `null`) et affiche donc le planning choisi. `SELECT` est la **mutation existante** de `plannings.js` — précédent : `PlanningView` la mappe déjà (`mapMutations('plannings', ['SELECT'])`). **Aucune mutation nouvelle.**

### 4.3 Action à ajouter — `plannings/resumeConflits` (lecture seule, appel moteur)

Seule addition au store. Action **namespacée** `plannings/resumeConflits`, **sans `commit`** (aucune mutation, aucune sélection : elle ne doit rien changer sur le tableau de bord) :

```
resumeConflits({ rootGetters, rootState }, { plannings }) {
  const resume = {};
  for (const pl of plannings) {
    const entree = assemblerEntree(rootGetters, rootState, { debut: pl.dateDebut, fin: pl.dateFin });
    const diagnostic = diagnostiquer(pl.affectations, entree);   // moteur pur, @/domain/scheduling
    resume[pl.id] = resumerDiagnostic(diagnostic);               // domaine pur (§5)
  }
  return resume;                                                  // { [id]: { nbErreurs, nbAvertissements, nbNonCouvertes, aResoudre } }
}
```

- Réutilise **tel quel** le helper interne privé `assemblerEntree(rootGetters, rootState, periode)` **déjà présent** dans `plannings.js` (0010), et `diagnostiquer` (importé depuis `@/domain/scheduling`, déjà importé dans le module).
- Reçoit la **liste des plannings à évaluer** (le composant lui passe les plannings récents affichés + le « prochain », plafonnés — voir §6) : l'action ne décide pas quels plannings évaluer, elle exécute. Chaque planning est évalué **contre les données courantes** (comme `evaluerCourant`) ; le moteur reste l'**unique source de vérité** des diagnostics.
- **Retour** : un objet `{ [planningId]: { nbErreurs, nbAvertissements, nbNonCouvertes, aResoudre } }` (résumé produit par `resumerDiagnostic`, §5). Volatil : le composant le garde en état local, jamais persisté.

> KISS : une seule action, appliquée à une **petite** liste (plannings récents plafonnés, §6). Pas de nouvel index, pas de cache persistant. Alternative écartée (recomposer les conflits en UI à partir des affectations) : violerait [ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md).

**Persisté vs volatile** : rien de nouveau n'est persisté. Volatils : la carte de résumés issue de `resumeConflits`, et la sélection posée par `SELECT` au clic (déjà volatile par conception, `0002`).

## 5. Domaine (logique pure)

Aucune logique métier dans le composant ni dans le store ([ADR 0008](../docs/adr/0008-moteur-planification-module-pur.md)). Cinq ajouts **purs** (aucun import Vue/Vuex, aucun `localStorage`), réutilisables :

### 5.1 `src/domain/libelles.js` (modifier) — libellés de statut de planning

Sur le modèle **exact** de `LIBELLES_STATUT_PERSONNE` / `STATUTS_PERSONNE_OPTIONS` déjà présents :

| Export | Forme | Rôle |
|---|---|---|
| `LIBELLES_STATUT_PLANNING` | `{ BROUILLON: 'Brouillon', VALIDE: 'Validé', PUBLIE: 'Diffusé' }` | Table code → libellé FR. **« Diffusé » = `PUBLIE`** (cohérent avec le workflow référent, [ADR 0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md)). |
| `libelleStatutPlanning(code)` | `(string) → string` | `'PUBLIE' → 'Diffusé'` ; `''` si inconnu. |
| `STATUTS_PLANNING_OPTIONS` | `STATUTS_PLANNING.map(...)` | Liste prête à itérer (dérivée de `STATUTS_PLANNING` + `LIBELLES_STATUT_PLANNING`). |

> Les **codes** restent la source de vérité dans `schema.js` (`STATUTS_PLANNING = ['BROUILLON','VALIDE','PUBLIE']`) — **ne pas** inventer de statut. Ce module ne porte que l'affichage.

### 5.2 `src/domain/utils/dates.js` (modifier) — numéro de semaine ISO

`dateUtil` est le **seul** endroit autorisé à toucher `Date` ([ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)). Ajouter, dans le même style que `debutSemaine`/`finMois` (0010) :

- **`numeroSemaineIso(dateStr)`** → `number` (1..53) : numéro de **semaine ISO 8601** de la date `"YYYY-MM-DD"`, selon la règle du **jeudi** (la semaine appartient à l'année de son jeudi ; la semaine 1 est celle qui contient le premier jeudi de l'année). Construit sur `parse` (interne) et l'arithmétique de jours, **sans exposer** de nouvel objet `Date`. Déterministe, **jamais** `Date.now()`. Sert l'affichage « Prochain planning : Sem. N » et pourra resservir à `0012`.

> Algorithme de référence (jeudi de la semaine courante vs premier jeudi de l'année). L'exemple « Sem. 29 » de la maquette est **illustratif** ; cas vérifiables : `numeroSemaineIso('2024-01-01')` → `1` (lundi), `numeroSemaineIso('2024-07-01')` → `27` (lundi, 26 semaines pleines après la semaine 1), `numeroSemaineIso('2024-12-30')` → `1` (semaine 1 de 2025).

### 5.3 `src/domain/absences.js` (modifier) — absences à venir

- **`absencesAVenir(absences, dateReference)`** → `Absence[]` : absences dont `dateFin >= dateReference` (comparaison **lexicographique de chaînes** `"YYYY-MM-DD"`, [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md)) **et** `statut !== 'REFUSE'` (une absence refusée n'est pas « à venir »). Triées par `dateDebut` croissant. Pure et déterministe : `dateReference` (aujourd'hui) est **fournie** par l'appelant, jamais lue via `Date.now()` ici. Le tableau de bord n'en affiche que le **compte** (`.length`).

> Choix du filtre statut : on inclut `DEMANDE` **et** `VALIDE` (tout ce qui pèsera sur les futurs plannings), on exclut `REFUSE`. **À confirmer** (§12).

### 5.4 `src/domain/planning.js` (modifier) — planning « à venir » & résumé de diagnostic

Deux sélecteurs purs (aux côtés de `creerPlanning`/`creerAffectationManuelle`) :

- **`prochainPlanning(plannings, dateReference)`** → `Planning | null` : le planning **le plus pertinent maintenant** = parmi ceux **non terminés** (`dateFin >= dateReference`), celui de plus petite `dateDebut` (le planning courant ou, à défaut, le prochain à démarrer). Si aucun n'est en cours/à venir → `null`. Comparaisons de chaînes uniquement, `dateReference` fournie par l'appelant. Alimente l'indicateur « Prochain planning », la carte « À traiter » et la tuile « Ouvrir le planning en cours ».
- **`resumerDiagnostic(diagnostic)`** → `{ nbErreurs, nbAvertissements, nbNonCouvertes, aResoudre }` : à partir d'un `{ violations, tourneesNonCouvertes }` (forme renvoyée par `diagnostiquer`/`evaluerCourant`), compte `nbErreurs` = violations `severite === 'erreur'`, `nbAvertissements` = `severite === 'avertissement'`, `nbNonCouvertes` = `tourneesNonCouvertes.length`, et `aResoudre = nbErreurs + nbNonCouvertes` (les points **bloquants** à corriger ; les avertissements souples sont comptés à part). Purement de la **synthèse** (aucune règle métier nouvelle, aucune reformulation de message).

> Le **tri** et le **plafonnement** de la liste « Plannings récents » sont de la **présentation** : faits en `computed` dans le composant (comme `AbsencesView`), pas dans le domaine. Le sélecteur `prochainPlanning`, lui, exprime un **concept métier** (« le planning pertinent ») → domaine.

## 6. Composants

`views/` orchestre ; `components/accueil/` présente (nouveau dossier, cohérent avec [06-structure-du-code](../docs/architecture/06-structure-du-code.md) : `components/<domaine>/`). Aucune logique métier dans les composants ; libellés via `libelles.js`, dates via `dateUtil`, appel moteur **uniquement** via l'action `plannings/resumeConflits`. Icônes **Phosphor** ([ADR 0013](../docs/adr/0013-icones-phosphor.md)), toujours doublées d'un libellé/`aria-label`.

| Fichier | Type | Responsabilité |
|---|---|---|
| `src/views/AccueilView.vue` | **réécrire** | **Orchestrateur** du tableau de bord. Lit les getters/état, calcule les indicateurs (via les sélecteurs purs de §5 + `aujourdhui = dateUtil.format(new Date())`), détient l'état volatil `resumeConflits` (peuplé au montage), rend l'en-tête (fil d'Ariane + titre + action) et les blocs, gère les états vides, la navigation (`SELECT` + `push`) et l'export. Réutilise `IndicateurSauvegarde` (`@/components/communs`). |
| `src/components/accueil/TuileAction.vue` | **créer** | **Grande tuile d'action** réutilisable (×3). Props : `titre`, `description`, `icone` (composant Phosphor), `to` (route, optionnel), `accent` (Boolean — mise en avant). Si `to` fourni → rend un `<router-link>` ; sinon → un `<button type="button">` émettant `activer` (pour les tuiles qui doivent d'abord sélectionner un planning). Cible **très large** (bloc entier cliquable), `min-height` ≥ ~96 px, focus visible. |
| `src/components/accueil/IndicateurCle.vue` | **créer** | **Indicateur** (×4) : grand `valeur` + `libelle` + `icone`, optionnellement cliquable (`to`). Présentational pur (reçoit une valeur déjà calculée). Icône `aria-hidden`, l'info portée par le libellé + le chiffre (jamais la seule couleur). |
| `src/components/accueil/ListePlanningsRecents.vue` | **créer** | Liste **cliquable** des plannings récents (déjà triés/plafonnés en prop `plannings`). Chaque entrée : **semaine** (`Sem. {numeroSemaineIso(dateDebut)}`), **dates** (`dateUtil.formatDateFr`), **badge de statut** (`libelleStatutPlanning`, icône + libellé, pas la seule couleur) et une **méta** (§6.1). Reçoit `resumeConflits` (map) pour la méta « à résoudre ». Émet `ouvrir(planningId)`. État vide guidant si `plannings` est vide. |
| `src/components/accueil/CarteATraiter.vue` | **créer** | Carte **« À traiter »** : reçoit `planning` (le prochain, ou `null`) et `resume` (`{ nbErreurs, nbAvertissements, nbNonCouvertes, aResoudre }` ou `null`). Quatre états (§6.2). Bouton **« Ouvrir l'éditeur »** → émet `ouvrir(planning.id)`. Aucune reformulation des messages du moteur : un **compte** + un lien vers l'éditeur (où `PanneauConflits` liste les messages verbatim, `0010`/`0011`). |
| `src/components/accueil/CarteSauvegarde.vue` | **créer** | Carte **« Sauvegarde »** : réutilise `IndicateurSauvegarde` (props `statut`/`derniereSauvegarde`, `apresEdition = false`) pour la ligne d'état, ajoute un rappel (« Pensez à exporter régulièrement une copie de vos données. ») et un bouton **« Exporter une sauvegarde »** → émet `exporter`. Présentational : ne dispatche pas (la vue dispatche `exporter`). |

### 6.1 Méta d'une entrée « Plannings récents »

Une seule ligne de méta par entrée, choisie ainsi (KISS, du plus actionnable au plus informatif) :

1. **Points à résoudre** (prioritaire) : si `resumeConflits[id].aResoudre > 0` → « {N} point(s) à résoudre » (icône `PhWarning`). Sinon, s'il n'y a que des avertissements (`nbAvertissements > 0`) → « {N} souhait(s) non tenu(s) » (icône discrète).
2. **Diffusé** : sinon si `statut === 'PUBLIE'` → « Envoyé à l'équipe » (+ date `publieLe` si présente).
3. **Modifié** : sinon → « Modifié le {formatDateFr(updatedAt)} » (date, KISS — pas de « il y a N j » qui exigerait un helper de temps relatif, voir §12).

> Les conflits n'apparaissent que pour les plannings **effectivement évalués** par `resumeConflits` (la liste plafonnée). Un planning sans entrée dans la map (hors périmètre d'évaluation) retombe sur les métas « Diffusé »/« Modifié » — jamais d'erreur.

### 6.2 États de la carte « À traiter »

- **Aucun planning** (`planning === null`) : message « Aucun planning pour l'instant. » + bouton « Générer un planning » (→ `/planning`).
- **Points bloquants** (`aResoudre > 0`) : encart **avertissement** (icône + libellé, jamais la seule couleur) « {N} point(s) à résoudre sur le planning de la semaine {Sem. N} » + « Ouvrir l'éditeur ».
- **Uniquement des avertissements** (`aResoudre === 0 && nbAvertissements > 0`) : encart **info** « {N} souhait(s) non tenu(s) » + « Ouvrir l'éditeur ».
- **Rien à traiter** (`aResoudre === 0 && nbAvertissements === 0`) : encart **rassurant** (icône `PhCheckCircle`) « Ce planning est prêt. » + « Ouvrir l'éditeur ».

### 6.3 En-tête, actions rapides & navigation (dans `AccueilView`)

- **En-tête** : fil d'Ariane = `nomCabinet` (si vide → discret lien « Nommer votre cabinet » vers `/parametres`) ; `<h1>` « Tableau de bord » ; action principale **« Générer un planning »** (`btn btn-primary`, `router-link` vers `{ name: 'planning' }`).
- **Actions rapides** (`TuileAction` ×3) :
  - **« Ouvrir le planning en cours »** — *accent* (`accent`), **sans** `to` → `@activer="ouvrirPlanningPertinent"` : `commit('SELECT', prochain.id)` puis `push({ name: 'planning' })` si un `prochainPlanning` existe ; sinon `push({ name: 'planning' })` (l'utilisateur y génère un planning). Icône ex. `PhCalendarCheck`.
  - **« Ajouter une personne »** — `to: { name: 'equipe' }` (`router-link`). Icône `PhUserPlus`.
  - **« Saisir une absence »** — `to: { name: 'absences' }`. Icône `PhCalendarPlus`.
- **Ouverture d'un planning précis** : `ListePlanningsRecents` et `CarteATraiter` émettent `ouvrir(id)` → méthode `ouvrirPlanning(id)` = `SELECT(id)` + `push({ name: 'planning' })`.
- **Export** : `CarteSauvegarde` émet `exporter` → la vue `dispatch('exporter')` (action **racine** `0008`, téléchargement de fichier JSON, **aucun réseau**).
- **Montage** : `aujourdhui = dateUtil.format(new Date())` ; calcule `prochain = prochainPlanning(plannings, aujourdhui)` et `recents` (computed, tri `updatedAt` décroissant, plafond ~6) ; `resumeConflits = await this.resumeConflits({ plannings: <union recents + prochain, dédupliquée> })`. Robuste si `plannings` est vide (map vide, aucun appel superflu).

### 6.4 Réutilisation & style

- `IndicateurSauvegarde` (`components/communs/`), `libelles.js`, `dateUtil`, tokens SCSS, base Bootstrap, Phosphor : **déjà en place**, réutilisés tels quels.
- Mise en page en **grille responsive** (utilitaires Bootstrap `row`/`col` déjà importés ; grille CSS `scoped` si besoin) : indicateurs sur une rangée qui s'empile sur petit écran ; les deux colonnes (« récents » / « à traiter + sauvegarde ») passent en pile sous `$rupture-lg`.
- SCSS `scoped` limité au **spécifique** (tuiles, cartes, badges de statut) ; tout le reste via classes Bootstrap et **tokens** (aucune valeur « magique »). **N'utiliser que des tokens existants** (voir note de coordination) : la tuile *accent* emploie `$couleur-primaire` (fond teal, texte blanc — contraste AA sur le blanc/teal actuel) en attendant l'adoption éventuelle de `$couleur-accent` une fois `0014` mergée (§12). Cibles ≥ `$cible-cliquable-min`, focus visible partout.

## 7. Règles de validation

**Aucun formulaire, aucune saisie** dans `0013` → **aucune règle Vuelidate**. L'écran ne fait que lire, naviguer et déclencher un export. (Les validations vivent sur les écrans cibles.)

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Une action principale évidente** : « Générer un planning » dominante en en-tête ; la première tuile (accent) renforce le geste le plus fréquent. Le reste est secondaire (tuiles/indicateurs neutres).
- **Toujours savoir où l'on est / où aller** : titre « Tableau de bord », fil d'Ariane avec le nom du cabinet, chaque bloc mène quelque part (aucun cul-de-sac). Sur base vide : messages guidants + liens (« Ajoutez votre première personne », « Générez votre premier planning »).
- **Vocabulaire du glossaire** : personne, tournée, absence, planning, « Diffusé » (= publié). **Jamais** de jargon (« diagnostic », « violation »…). Les statuts s'affichent en clair via `libelleStatutPlanning`.
- **Jamais l'information par la seule couleur** ([08 §8](../docs/architecture/08-principes-ux-ergonomie.md), [ADR 0013](../docs/adr/0013-icones-phosphor.md)) : chaque badge de statut = **icône + libellé** ; la carte « À traiter » distingue ses états par icône + texte, pas par la seule teinte ; l'indicateur de sauvegarde reste doublé de texte.
- **Conflits : compter, ne pas reformuler** : le tableau de bord affiche des **comptes** (« 2 points à résoudre ») et renvoie à l'éditeur, où les messages du moteur s'affichent **verbatim** (`PanneauConflits`, `0010`/`0011`). On ne réécrit jamais un message de conflit ici.
- **Rappel de sauvegarde visible** ([ADR 0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md), [08 §7](../docs/architecture/08-principes-ux-ergonomie.md)) : « Dernière sauvegarde le… » + encouragement à exporter, bien en vue.
- **Ergonomie physique & clavier** : tuiles/indicateurs à cibles larges (bloc entier cliquable, ≥ 44 px), focus visible, `<a>`/`<button>` sémantiques (les tuiles de navigation pure sont de vrais liens, `router-link`), structure de titres cohérente (`h1` « Tableau de bord » → `h2` par bloc).
- **Chargement discret** : `resumeConflits` s'exécute au montage (validation moteur, rapide) ; la carte « À traiter » et les métas apparaissent une fois la map disponible (état initial neutre, jamais bloquant).

## 9. Étapes d'implémentation

**4 tâches**, chacune pour **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé : **T1 → T2 → T3 → T4**. Chaque critère est vérifiable **à la main** (console pendant `npm run dev`, ou parcours écran).

### Tâche 1 — Fondations : libellés + `numeroSemaineIso` + sélecteurs purs + action `resumeConflits`

**Fichiers** :
- `src/domain/libelles.js` (**modifier**) — `LIBELLES_STATUT_PLANNING`, `libelleStatutPlanning`, `STATUTS_PLANNING_OPTIONS` (§5.1).
- `src/domain/utils/dates.js` (**modifier**) — ajouter `numeroSemaineIso` à `dateUtil` (§5.2).
- `src/domain/absences.js` (**modifier**) — `absencesAVenir(absences, dateReference)` (§5.3).
- `src/domain/planning.js` (**modifier**) — `prochainPlanning(plannings, dateReference)`, `resumerDiagnostic(diagnostic)` (§5.4).
- `src/store/modules/plannings.js` (**modifier**) — **ajouter** l'action lecture seule `resumeConflits` (§4.3), important `resumerDiagnostic` depuis `@/domain/planning.js` et réutilisant `assemblerEntree` + `diagnostiquer` **déjà présents**. **Ne rien modifier** d'existant.

**Critères de sortie** (console, `npm run dev`) :
- `libelleStatutPlanning('PUBLIE') === 'Diffusé'` ; `libelleStatutPlanning('BROUILLON') === 'Brouillon'` ; `libelleStatutPlanning('VALIDE') === 'Validé'` ; `STATUTS_PLANNING_OPTIONS` a **3** entrées cohérentes avec `STATUTS_PLANNING`.
- `dateUtil.numeroSemaineIso('2024-01-01') === 1` ; `dateUtil.numeroSemaineIso('2024-07-01') === 27` ; `dateUtil.numeroSemaineIso('2024-12-30') === 1`.
- `absencesAVenir(items, aujourdhui)` exclut les `REFUSE` et les absences déjà terminées (`dateFin < aujourdhui`), inclut `DEMANDE`/`VALIDE` à venir, triées par `dateDebut`.
- `prochainPlanning(items, aujourdhui)` renvoie le planning non terminé de plus petite `dateDebut`, `null` si aucun ; `resumerDiagnostic({ violations, tourneesNonCouvertes })` compte correctement `nbErreurs`/`nbAvertissements`/`nbNonCouvertes` et `aResoudre = nbErreurs + nbNonCouvertes`.
- Après avoir généré ≥ 1 planning (`0010`/`0011`) : `store.dispatch('plannings/resumeConflits', { plannings: store.state.plannings.items })` renvoie `{ [id]: { nbErreurs, nbAvertissements, nbNonCouvertes, aResoudre } }` **sans exception**, **sans** modifier `selectionId` ni `items` (aucun `commit`).
- Aucun import Vue/Vuex dans les modules de domaine ; aucun `localStorage` ; aucun `Date.getDay()`/`new Date("YYYY-MM-DD")` hors `dateUtil` ; l'appel moteur passe **uniquement** par l'action ; `npm run build` réussit.

### Tâche 2 — Composants réutilisables : `TuileAction` + `IndicateurCle`

**Fichiers** :
- `src/components/accueil/TuileAction.vue` (**créer**) — grande tuile ; rend `<router-link>` si `to`, sinon `<button>` émettant `activer` ; prop `accent` pour la mise en avant (§6).
- `src/components/accueil/IndicateurCle.vue` (**créer**) — indicateur (valeur + libellé + icône), cliquable si `to` (§6).

**Dépend de** : existant (Phosphor, tokens). Développables avec des **props factices**.

**Critères de sortie** :
- `TuileAction` avec `to` rend un lien navigable (clavier + clic) ; sans `to`, un bouton qui émet `activer` au clic/Entrée/Espace. `accent` change l'aspect (fond teal + texte blanc) **sans** que l'info repose sur la seule couleur (titre toujours lisible). Icône `aria-hidden`, titre visible.
- `IndicateurCle` affiche `valeur` + `libelle` + icône ; si `to`, l'ensemble est cliquable et focusable. Cible ≥ 44 px, focus visible.
- Aucune couleur en dur (tokens uniquement), icônes 100 % Phosphor ; `npm run build` réussit.

### Tâche 3 — `ListePlanningsRecents` + `CarteATraiter` + `CarteSauvegarde`

**Fichiers** :
- `src/components/accueil/ListePlanningsRecents.vue` (**créer**) — liste cliquable (semaine + dates + badge statut + méta §6.1), émet `ouvrir(id)`, état vide guidant (§6).
- `src/components/accueil/CarteATraiter.vue` (**créer**) — 4 états (§6.2), émet `ouvrir(id)`.
- `src/components/accueil/CarteSauvegarde.vue` (**créer**) — réutilise `IndicateurSauvegarde`, bouton « Exporter une sauvegarde » émettant `exporter` (§6).

**Dépend de** : T1 (`libelleStatutPlanning`, `numeroSemaineIso`), existant (`IndicateurSauvegarde`, `dateUtil`, `formatDateFr`). Développables avec des **props factices** (plannings + map de résumés construits à la main).

**Critères de sortie** :
- `ListePlanningsRecents` : chaque entrée montre `Sem. N`, les dates FR, le **badge de statut** (icône + libellé : Brouillon / Validé / Diffusé), et **une** méta selon la priorité §6.1 (« N points à résoudre » si `aResoudre>0`, sinon « Envoyé à l'équipe » si `PUBLIE`, sinon « Modifié le … »). Cliquer une entrée émet `ouvrir(id)`. Liste vide → message + invitation à générer.
- `CarteATraiter` : rend les 4 états attendus selon `planning`/`resume` ; le bouton « Ouvrir l'éditeur » émet `ouvrir(planning.id)` ; « Aucun planning » propose « Générer un planning » (lien `/planning`). Icône + libellé pour chaque état (jamais la seule couleur).
- `CarteSauvegarde` : affiche l'état de sauvegarde (via `IndicateurSauvegarde`) et « Dernière sauvegarde le … » ; « Exporter une sauvegarde » émet `exporter`.
- Badges/états distingués par icône **+** libellé ; focus visible ; `npm run build` réussit.

### Tâche 4 — `AccueilView` : orchestration & intégration

**Fichiers** :
- `src/views/AccueilView.vue` (**réécrire**) — en-tête (fil d'Ariane + `h1` + « Générer un planning »), rangée d'indicateurs (`IndicateurCle` ×4), rangée de tuiles (`TuileAction` ×3), deux colonnes (`ListePlanningsRecents` | `CarteATraiter` + `CarteSauvegarde`) ; état volatil `resumeConflits` peuplé au **montage** ; méthodes `ouvrirPlanning(id)` (`SELECT` + `push`), `ouvrirPlanningPertinent()`, `dispatch('exporter')` ; `aujourdhui` + sélecteurs purs pour les indicateurs (§6.3).

**Dépend de** : T1 (domaine + action), T2 (`TuileAction`, `IndicateurCle`), T3 (`ListePlanningsRecents`, `CarteATraiter`, `CarteSauvegarde`).

**Critères de sortie** (parcours écran, `npm run dev`) :
- Sur une base fraîche (aucune donnée) : indicateurs à `0`/« — », « Prochain planning » vide, blocs « récents »/« à traiter » guidants (invitent à générer / ajouter), aucune erreur JS. Le fil d'Ariane propose « Nommer votre cabinet » si `nomCabinet` est vide.
- Avec des données (≥ 2 personnes actives, ≥ 1 tournée active, quelques absences à venir, ≥ 1 planning généré) : « Équipe active » = nb d'actives, « Tournées » = nb d'actives, « Absences à venir » = compte correct (exclut `REFUSE` et le passé), « Prochain planning » = « Sem. N » du planning pertinent.
- « Générer un planning » et les indicateurs mènent aux bons écrans ; « Ajouter une personne » → `/equipe`, « Saisir une absence » → `/absences`.
- Cliquer une entrée de « Plannings récents » **ouvre ce planning précis** dans l'éditeur (il est bien sélectionné à l'arrivée sur `/planning`, pas remplacé par un autre) ; « Ouvrir le planning en cours » et « Ouvrir l'éditeur » ouvrent le **planning pertinent**.
- La carte « À traiter » reflète les conflits du planning pertinent (compte cohérent avec ce que montre `PanneauConflits` dans l'éditeur pour le même planning) ; « Exporter une sauvegarde » télécharge un fichier JSON (réutilise `0008`, aucun réseau).
- Aucun accès `localStorage` direct ; aucun appel moteur hors action de store ; aucun objet `Date` hors `dateUtil` ; aucune logique métier dans le composant (comptages/sélections via getters + domaine pur) ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] La route `/` affiche un **tableau de bord** (fini le placeholder) : en-tête (fil d'Ariane = nom du cabinet, titre « Tableau de bord », action « Générer un planning »), vue d'ensemble, actions rapides, plannings récents, « À traiter », sauvegarde.
- [ ] **Vue d'ensemble** : « Équipe active » = nb de personnes actives, « Tournées » = nb de tournées actives, « Absences à venir » = nb d'absences non refusées se terminant aujourd'hui ou après, « Prochain planning » = « Sem. N » (numéro **ISO**) du planning pertinent (ou « — » si aucun).
- [ ] **Actions rapides** : trois grandes tuiles cliquables ; la première (« Ouvrir le planning en cours ») est **mise en avant** ; « Ajouter une personne » → Équipe, « Saisir une absence » → Absences.
- [ ] **Plannings récents** : liste cliquable, chaque entrée = semaine + dates + **statut** en clair (Brouillon / Validé / **Diffusé** = `PUBLIE`) + une méta utile (« N points à résoudre » / « Envoyé à l'équipe » / « Modifié le … »).
- [ ] Cliquer une entrée récente (ou « Ouvrir l'éditeur ») **ouvre le planning concerné** dans l'éditeur (sélection posée via `SELECT` avant navigation).
- [ ] **« À traiter »** : montre les conflits (compte) du planning pertinent avec un bouton « Ouvrir l'éditeur » ; état rassurant si le planning est prêt ; guide vers la génération si aucun planning n'existe. Les messages de conflit ne sont **pas** reformulés (comptes + renvoi à l'éditeur).
- [ ] **Sauvegarde** : « Dernière sauvegarde le… » + bouton **« Exporter une sauvegarde »** qui réutilise l'export JSON (`0008`) — **aucun** envoi réseau ([ADR 0002](../docs/adr/0002-application-frontend-sans-backend.md)).
- [ ] Le calcul des conflits passe **toujours** par l'action `plannings/resumeConflits` (moteur pur `diagnostiquer`) ; **aucun** import de `@/domain/scheduling` dans un composant ; **aucun** accès `localStorage` ; **aucun** objet `Date` hors `dateUtil`.
- [ ] **Aucune information par la seule couleur** : statuts et états = icône + libellé ; cibles ≥ 44 px ; focus clavier visible ; icônes **Phosphor** exclusivement.
- [ ] Les statuts affichés proviennent de `STATUTS_PLANNING` (`schema.js`) via `libelleStatutPlanning` — **aucun statut inventé**.
- [ ] `npm run build` réussit après chacune des 4 tâches.

## 11. Vérification

Parcours de bout en bout (`npm run dev`, ouvrir `/`) :

1. **Base vide** (`localStorage.clear()` + recharger) : indicateurs à 0/« — » ; blocs « récents » et « à traiter » guidants (aucun cul-de-sac) ; fil d'Ariane propose « Nommer votre cabinet ». Aucune erreur console.
2. **Remplir les données** : nommer le cabinet (`/parametres`), ajouter ≥ 2 personnes (`/equipe`), ≥ 1 tournée (`/tournees`), 1–2 absences à venir (`/absences`), générer 1–2 plannings (`/planning`). Revenir sur `/`.
3. **Vue d'ensemble** : vérifier les 4 chiffres (équipe active, tournées, absences à venir = non refusées & non passées, prochain planning = Sem. N ISO). Cliquer chaque indicateur → écran attendu.
4. **Actions rapides** : « Générer un planning » → `/planning` ; « Ajouter une personne » → `/equipe` ; « Saisir une absence » → `/absences` ; « Ouvrir le planning en cours » → `/planning` avec le planning pertinent affiché.
5. **Plannings récents** : vérifier l'ordre (plus récemment modifiés en tête), le badge de statut (Brouillon/Validé/Diffusé), la méta (générer un conflit — ex. absence `VALIDE` recoupant une affectation — pour voir « N points à résoudre »). Cliquer une entrée précise → **ce** planning s'ouvre dans l'éditeur.
6. **À traiter** : provoquer une sous-couverture/conflit sur le planning pertinent → la carte affiche le bon compte et « Ouvrir l'éditeur » ouvre ce planning ; comparer le compte avec `PanneauConflits` dans l'éditeur (cohérents). Sans conflit → état « Ce planning est prêt. ». Sans planning → « Générer un planning ».
7. **Sauvegarde** : la carte montre « Dernière sauvegarde le… » ; « Exporter une sauvegarde » télécharge `idelia-sauvegarde-AAAA-MM-JJ.json` (vérifier son contenu = `SaveDocument`, `0008`). Aucune requête réseau (onglet Réseau vide).
8. **Rechargement** : recharger `/` → les chiffres et la liste réapparaissent (données persistées) ; les conflits sont **recalculés** (jamais lus depuis un stockage).
9. **Accessibilité / clavier** : parcourir au `Tab` (tuiles, indicateurs, entrées, boutons) : focus visible, activation à Entrée/Espace, un `aria-label`/libellé sur chaque cible. Statuts lisibles en niveaux de gris (aucune info par la seule couleur).
10. **Build** : `npm run build` réussit.

## 12. Décisions à confirmer / risques

1. **Portée des conflits sur le tableau de bord (retenu : liste récente plafonnée).** `resumeConflits` évalue les plannings **affichés** (récents plafonnés ~6 + le pertinent), une évaluation moteur par planning. Peu coûteux (validation seule), mais c'est **la seule dépense moteur** au chargement de l'écran d'accueil. **À confirmer** le plafond (~6) et l'idée d'évaluer plusieurs plannings ; alternative plus minimale : n'évaluer **que** le planning pertinent (carte « À traiter ») et n'afficher aucun compte de conflits dans la liste récente (métas statut/temps uniquement).
2. **Définition de « prochain planning »/« planning en cours » (retenu).** `prochainPlanning` = planning **non terminé** (`dateFin >= aujourd'hui`) de plus petite `dateDebut`. Sert à la fois l'indicateur « Prochain planning », la carte « À traiter » et la tuile « Ouvrir le planning en cours ». Si aucun planning en cours/à venir → `null` (indicateur « — », cartes guidantes). **À confirmer** ; alternative : distinguer « en cours » (couvre aujourd'hui) de « prochain » (démarre plus tard).
3. **« Sem. N » via numéro de semaine ISO (retenu).** Ajout d'un helper pur `dateUtil.numeroSemaineIso`. Conforme à la maquette (« Sem. 29 ») et à [ADR 0010](../docs/adr/0010-conventions-dates-et-jours-iso.md). **À confirmer** ; alternative KISS déjà employée en `0010` (nom auto-descriptif « Planning du JJ/MM au JJ/MM ») — on pourrait afficher les **dates** plutôt que le numéro de semaine si l'on veut éviter ce helper.
4. **Filtre « Absences à venir » (retenu : non refusées, non passées).** Inclut `DEMANDE` + `VALIDE`, exclut `REFUSE`, `dateFin >= aujourd'hui`. **À confirmer** ; alternative : ne compter que les `VALIDE` (absences certaines).
5. **Ordre & plafond des « Plannings récents » (retenu : `updatedAt` décroissant, ~6).** Tri de **présentation** en `computed` (comme `AbsencesView`). **À confirmer** l'axe de tri (`updatedAt` vs `dateDebut`) et le nombre affiché.
6. **Ouverture d'un planning précis via `SELECT` + `push` (retenu).** Réutilise la mutation existante et le comportement de `PlanningView` (`0011`) qui respecte une sélection posée. **À confirmer** ; c'est le seul moyen d'ouvrir **un** planning donné sans route paramétrée (`/planning/:id` n'existe pas — réservé à `0012` pour la diffusion).
7. **Méta « Modifié le {date} » plutôt que « il y a 5 j » (retenu, KISS).** Le temps relatif exigerait un helper pur `tempsEcouleFr(iso, refIso)` (comparaison à « maintenant »). Reporté ; **à confirmer** si le libellé relatif de la maquette est jugé indispensable (petit helper pur à ajouter dans `dateUtil`).
8. **Tuiles « Ajouter une personne » / « Saisir une absence » = navigation simple (retenu).** Elles **naviguent** vers `/equipe` / `/absences` (où le bouton d'ajout est proéminent) sans **ouvrir** la modale d'ajout. **À confirmer** ; un « ouvrir directement la modale » nécessiterait une petite addition à `EquipeView`/`AbsencesView` (lecture d'un paramètre de route) — hors périmètre `0013`, à acter séparément.
9. **Dépendance de style à `0014`/`0015` (coordination).** `0013` **ne référence que des tokens existants** (conservés par `0014`) pour rester buildable en standalone, et n'emploie **pas** encore `$couleur-accent`/`$couleur-marque`/`$couleur-page`. La tuile mise en avant utilise `$couleur-primaire` en attendant ; une fois `0014` mergée, elle **pourra** adopter `$couleur-accent` (ambre) fidèle à la maquette. **À confirmer** : soit séquencer `0013` après `0014` et livrer directement avec `$couleur-accent`, soit livrer avec `$couleur-primaire` puis ajuster. `0013` ne touche **pas** `App.vue` (refonte `0015`) : son en-tête d'écran est du contenu de vue, compatible avec la navbar actuelle **comme** avec le futur menu latéral.
10. **`IndicateurSauvegarde` sur un écran sans édition (retenu).** Sur `/` (aucune édition), l'indicateur affiche « Vos réglages sont enregistrés le… » (`apresEdition = false`) — message rassurant, cohérent avec le workflow référent. **À confirmer** ; alternative : n'afficher que le texte « Dernière sauvegarde le… » sans le composant.
