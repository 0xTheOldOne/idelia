# Feature 0015 — Layout : menu latéral repliable

- **Statut** : À faire
- **Dépend de** : `0014` (identité visuelle : tokens SCSS « menu latéral » — dégradé teal, texte, item actif, accent — consommés ici, jamais codés en dur). S'appuie sur l'existant de `0001` (layout racine `App.vue`, `navigation`, tokens, intégration Bootstrap, Phosphor), `0002` (module `ui` volatile, `storageRepository`).
- **ADR liés** : [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Vue 3 Options API + Vuex + vue-router), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière `storageRepository` — **point de vigilance**, voir §4/§12), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS thémé par tokens, base Bootstrap), [0013](../docs/adr/0013-icones-phosphor.md) (icônes exclusivement Phosphor).

## 1. Contexte & objectif

Aujourd'hui la navigation d'Idelia est une **navbar horizontale en haut** (`src/App.vue`, feature `0001`) : icône + libellé, mise en avant de l'écran courant par gras + soulignement. Le porteur du produit a validé, via une **maquette interactive**, un **menu latéral à gauche, repliable** :

- **déplié** : pastille de marque + wordmark « Idelia », items groupés (icône Phosphor **+** libellé) ;
- **replié** : largeur réduite (rail d'icônes seules), les libellés revenant en **infobulle** au survol/focus, doublés d'un `aria-label` ;
- un **bouton de repli** en bas ; l'état déplié/replié est **mémorisé** d'une session à l'autre.

Objectif de `0015` : livrer **uniquement la coquille de navigation** (le « shell » : `App.vue` en grille `sidebar + contenu` + un composant `MenuLateral`), sans toucher au contenu des écrans ni à la définition de la palette (c'est `0014`). Résultat attendu : une navigation latérale claire, repliable, persistante et accessible, pour un public **peu à l'aise avec l'informatique**.

**Hors périmètre `0015`** (à ne pas implémenter ici) :

- **Définition des couleurs / tokens** du menu (dégradé, accent, teintes) → feature `0014`. `0015` **consomme** ces tokens, ne les crée pas.
- **Contenu des écrans** (topbar, fil d'Ariane, titres `h1`, actions principales de chaque vue visibles dans la maquette) → hors sujet : `App.vue` ne fournit que la grille + `<router-view/>`.
- **Indicateur de sauvegarde dans le menu** (le bloc « Sauvegardé · 14:32 » de la maquette) → **différé** (voir §6.1 et §12) : le composant réutilisable `IndicateurSauvegarde` existe déjà, mais son intégration dans la barre latérale n'est pas indispensable au shell ; à traiter avec l'Accueil (`0013`) si retenu. `0015` peut **réserver l'emplacement** sans le remplir.

## 2. Écrans concernés

Aucune route créée ni modifiée ([architecture 07](../docs/architecture/07-navigation-et-ecrans.md)). `0015` change **le cadre commun à tous les écrans** : la barre de navigation permanente passe du **haut** (horizontale) à la **gauche** (verticale, repliable). Toutes les routes existantes (`/`, `/equipe`, `/tournees`, `/absences`, `/planning`, `/parametres`, + sous-routes) restent inchangées et s'affichent désormais **à droite** du menu.

**Expérience visée** (utilisateur non-technique) :

- **Toujours savoir où l'on est** : l'item de l'écran courant est mis en évidence par **plusieurs canaux** (fond teinté **+** barre d'accent verticale **+** graisse renforcée), jamais par la seule couleur.
- **Menu compréhensible et stable** : items regroupés sous des intitulés courts (« Pilotage », « Planning »), libellés en français courant, icônes cohérentes (Phosphor).
- **Repli réversible et prévisible** : un bouton explicite en bas (« Réduire le menu » / « Déplier le menu ») ; en replié, chaque icône révèle son libellé en **infobulle** au survol **et au focus clavier**. Le choix est **mémorisé** : au rechargement, le menu revient dans l'état laissé par l'utilisateur.
- **Petits écrans** : le menu se réduit automatiquement au rail d'icônes pour laisser la place au contenu, sans que l'utilisateur ait à agir (voir §6.3).

## 3. Modèle de données touché

**Aucune** entité métier touchée ([architecture 02](../docs/architecture/02-modele-de-domaine.md)/[03](../docs/architecture/03-modele-de-donnees.md)). **Aucun impact** sur `schemaVersion` (reste `1`), **aucune migration**.

Seule donnée introduite : une **préférence d'interface** — « menu replié : oui/non » — qui n'appartient **pas** au domaine métier et **ne fait pas partie du `SaveDocument`** (ni exportée, ni importée en `0008`). Sa persistance est traitée à part (§4).

## 4. Store (Vuex)

L'état déplié/replié est une **préférence d'UI**, pas de la donnée métier. Il est logé dans le module **`ui`** (volatile, [architecture 04](../docs/architecture/04-gestion-etat-vuex.md), `src/store/modules/ui.js`) afin que **`App.vue` et `MenuLateral` lisent la même source** (pas de prop drilling) et que **la logique reste hors des composants** (règle d'or #10).

### 4.1 Module `ui` — état + getter + mutation + actions

- **State** : ajouter `menuReplie: false` (défaut : **déplié**, l'état le plus lisible au premier lancement).
- **Getter** : `menuReplie` (booléen).
- **Mutation** : `SET_MENU_REPLIE(state, valeur)` — pose le booléen.
- **Action** `basculerMenu({ commit, getters })` : `commit('SET_MENU_REPLIE', !getters.menuReplie)` **puis persiste** la préférence (§4.2). Seule « logique » : l'inversion + l'écriture de la préférence.
- **Action** `initialiserMenu({ commit })` : lit la préférence persistée (§4.2) et `commit('SET_MENU_REPLIE', valeur)`. Appelée **au démarrage** (§4.3) pour restituer le choix de l'utilisateur.

> `menuReplie` reste **hors du mécanisme de persistance métier** : le module `ui` n'est **pas** hydraté par `bootstrap`/`REPLACE_ALL` et le plugin de persistance débouncé ignore déjà les mutations `ui/*` (voir en-tête de `ui.js` et `src/store/index.js`). Sa persistance passe par un **canal dédié** (§4.2).

### 4.2 Persistance de la préférence — canal dédié, distinct du `SaveDocument`

Contrainte : la préférence doit survivre au rechargement, **sans** entrer dans la sauvegarde métier (règle d'or #8 : *toute persistance passe par `storageRepository`* — cf. **arbitrage §12.1**). Choix retenu pour concilier règle d'or #8 **et** l'intention « ce n'est pas de la persistance métier » :

- **Étendre `storageRepository`** (`src/storage/storageRepository.js`) de **deux méthodes dédiées**, sur une **clé `localStorage` séparée** (ex. `idelia:prefs-ui`), **indépendante** de la clé du `SaveDocument` :
  - `lirePreferenceMenuReplie()` → `boolean` : lecture **synchrone** (une préférence triviale ; lecture directe pour éviter tout scintillement au premier rendu) ; renvoie `false` si absente/illisible.
  - `enregistrerPreferenceMenuReplie(valeur)` : écriture **best-effort** (silencieuse en cas d'échec, comme le reste du repository).
- Ainsi **tout accès `localStorage` reste centralisé dans `storageRepository`** (respect de la règle d'or #8), tandis que la préférence demeure **hors du `SaveDocument`** (respect de l'intention produit : pas de persistance métier, pas d'export/import de ce réglage).

> KISS : une clé, un booléen, deux méthodes. Aucune dépendance ajoutée. Pas de migration, pas de versionnage de cette préférence (si le format change un jour, on repart sur le défaut « déplié »).

### 4.3 Initialisation au démarrage (sans scintillement)

Dans `src/main.js`, **après** création du store et **avant** `app.mount(...)`, restituer la préférence pour qu'elle soit appliquée **dès le premier rendu** (pas de « saut » déplié→replié visible) :

- soit `store.dispatch('ui/initialiserMenu')`, qui lit via `storageRepository.lirePreferenceMenuReplie()` (synchrone) et commit ;
- l'appel est **synchrone** et n'interfère pas avec le `app/bootstrap` métier (asynchrone) déjà en place.

**Persisté vs volatile** : la valeur en mémoire (`ui.menuReplie`) est **volatile** (état de session), mais **reflétée** dans `idelia:prefs-ui` (persistant, hors `SaveDocument`). Aucune autre donnée n'est ajoutée au store.

## 5. Domaine (logique pure)

**Aucun** ajout dans `src/domain/`. `0015` est purement **présentation + préférence d'UI** : il n'y a pas de règle métier à calculer. Les données de navigation (libellés, chemins, icônes, groupes) sont de la **configuration d'UI** et vivent dans les `data()` de `MenuLateral` (§6.2) — comme l'actuel tableau `navigation` de `App.vue`, simplement restructuré en groupes.

## 6. Composants

`App.vue` orchestre le **shell** (grille + montage du menu + `<router-view/>`) ; `MenuLateral` porte **toute** la barre latérale. Icônes **exclusivement Phosphor** ([ADR 0013](../docs/adr/0013-icones-phosphor.md)), chaque icône doublée d'un libellé (visible en déplié) ou d'un `aria-label` (en replié). Aucune logique métier ; l'état de repli vient du store (§4).

### 6.1 `src/components/communs/MenuLateral.vue` (**nouveau**)

Composant transverse (placé dans `communs/`, comme `IndicateurSauvegarde`). Options API, `name: 'MenuLateral'`, SCSS `scoped`. Structure calquée sur la maquette (`aside.sidebar`) :

1. **En-tête de marque** (`.menu-marque`) :
   - **pastille** : le **logo de la marque** affiché depuis `public/favicon.png` (cercle teal + croix), en `<img>` d'environ 38 px, arrondi, avec un léger liseré clair (`box-shadow`) pour le détacher du dégradé de la barre. C'est un **asset de marque**, **pas** une icône d'UI → hors périmètre de l'ADR 0013 (voir §12.4) ;
   - **wordmark** : « Idelia » (fort) + sous-titre discret « Planning infirmier » (`<small>` sur une seconde ligne).
   - En **replié** : le wordmark est masqué, la pastille est centrée. La pastille reste un repère visuel de marque (pas un bouton).

2. **Groupes de navigation** (`.menu-groupe`) : un intitulé de section (en capitales, discret) suivi de ses items. Reprend **les routes/données de nav actuelles** d'`App.vue`, réparties ainsi (validé par la maquette) :
   - **Pilotage** : Accueil (`/`), Équipe (`/equipe`), Tournées (`/tournees`), Absences & congés (`/absences`).
   - **Planning** : Planning (`/planning`), Paramètres (`/parametres`).
   - En **replié** : l'intitulé de groupe est masqué (n'a de sens qu'accompagné des libellés) ; les items restent, réduits au rail.

3. **Items de navigation** (`.menu-item`) — un `<router-link>` par entrée :
   - `<component :is="item.icone" :size="21" aria-hidden="true" />` (Phosphor) **+** `<span class="menu-item__libelle">{{ item.libelle }}</span>` **+** infobulle `<span class="menu-item__infobulle">{{ item.libelle }}</span>`.
   - **`:aria-label="item.libelle"`** systématique sur le lien : le nom accessible reste stable, y compris en replié (où le libellé visuel est masqué).
   - **État actif** : classe active de `vue-router` (voir §6.4) → **fond teinté** (`$menu-item-actif-fond`) **+** **barre d'accent verticale** (`::before`, `$menu-accent`) **+** **graisse renforcée**. L'information ne repose **jamais** sur la seule couleur (barre + graisse = repères non-colorés).
   - **Hauteur ≥ `$cible-cliquable-min` (44 px)**, cible cliquable large ; `:hover`/`:focus` visibles.

4. **Pied** : un `.menu-espaceur` (flex) pousse vers le bas :
   - *(optionnel/différé)* **emplacement réservé** pour l'indicateur de sauvegarde (voir §12.5) — non rempli en `0015` ;
   - **bouton de repli** (`.menu-bascule`, `<button type="button">`) : icône chevron Phosphor (`PhCaretDoubleLeft` orienté ; pivote de 180° en replié pour « pointer » vers l'ouverture) **+** libellé « Réduire le menu » (déplié) / « Déplier le menu » (replié). `@click="basculerMenu"`. **`:aria-expanded="!menuReplie"`**. En replié, seul l'icône reste (le libellé du bouton est masqué), l'`aria-label` fournit le nom.

**Accès store** : `...mapGetters('ui', ['menuReplie'])`, `...mapActions('ui', ['basculerMenu'])`. Le composant applique sur sa racine une classe `menu-lateral--replie` liée à `menuReplie` (pilote ses styles `scoped`). **Aucun** `emit` nécessaire (état partagé via le store).

**Données locales** (config d'UI, `data()`), forme :

```
groupes: [
  { titre: 'Pilotage', items: [
    { nom: 'accueil',   chemin: '/',          libelle: 'Accueil',            icone: 'PhHouse' },
    { nom: 'equipe',    chemin: '/equipe',    libelle: 'Équipe',             icone: 'PhUsers' },
    { nom: 'tournees',  chemin: '/tournees',  libelle: 'Tournées',           icone: 'PhPath' },
    { nom: 'absences',  chemin: '/absences',  libelle: 'Absences & congés',  icone: 'PhCalendarX' },
  ]},
  { titre: 'Planning', items: [
    { nom: 'planning',   chemin: '/planning',   libelle: 'Planning',   icone: 'PhCalendarBlank' },
    { nom: 'parametres', chemin: '/parametres', libelle: 'Paramètres', icone: 'PhGear' },
  ]},
]
```

Icônes importées comme dans l'`App.vue` actuel (mêmes composants Phosphor : `PhHouse`, `PhUsers`, `PhPath`, `PhCalendarX`, `PhCalendarBlank`, `PhGear`) + `PhCaretDoubleLeft` (bouton de repli). Le **logo de marque n'est pas une icône Phosphor** : c'est l'image `public/favicon.png` (`<img>`).

### 6.2 `src/App.vue` (**réécriture** du shell)

- Le layout racine passe d'une `navbar navbar-expand` horizontale à une **grille CSS `sidebar + contenu`** :
  - conteneur `.app-layout` en `display: grid` ; `grid-template-columns: <largeur-menu-déplié> 1fr` ; en replié, la première colonne passe à la **largeur rail** (ex. `76px`).
  - la largeur de colonne est pilotée par la **même** source (`ui/menuReplie`, via `mapGetters`) → App.vue applique une classe `app-layout--menu-replie`.
- **Colonne 1** : `<MenuLateral />`. **Colonne 2** : `<main class="app-contenu"><router-view /></main>`.
- Le menu occupe **toute la hauteur** (`100vh`, colonne fixe) ; le contenu **défile** indépendamment (`overflow: auto` sur `main`).
- Suppression de l'ancienne `navbar` et de ses styles ; conserver le seul rôle de shell.
- **Aucune couleur en dur** : App.vue n'a plus besoin de couleur de barre (déportée dans `MenuLateral` via les tokens `0014`). Ses styles se limitent à la grille et aux transitions de largeur.

### 6.3 Comportement responsive (décision KISS)

**Option retenue** : **repli automatique en rail sur petit écran, en CSS pur** (pas de listener JS, pas d'overlay, pas de hamburger — KISS) :

- **≥ `$rupture-lg` (992px)** : comportement normal, piloté par la préférence utilisateur (déplié par défaut, bascule via le bouton).
- **< `$rupture-lg`** : une **media query** force l'**apparence repliée** (rail d'icônes + infobulles), **indépendamment** de la préférence ; le **bouton de repli est masqué** (sans effet à cette taille). Le contenu récupère l'espace. La grille passe à `76px 1fr`.
- **Très petits écrans (< `$rupture-sm`, 576px)** : le rail (76px) **reste affiché** ; **pas d'off-canvas en v1** (voir §12.3, alternative documentée).

Ainsi l'utilisateur non-technique n'a **rien à gérer** sur tablette/petit écran : la navigation reste visible et compacte. La media query duplique ciblément les règles « repliées » nécessaires à l'apparence (largeur + masquage libellés + infobulles), sans JavaScript.

### 6.4 État actif & `aria-current`

- Utiliser l'`active-class` de `<router-link>` pour le style actif. Vue Router pose `aria-current="page"` sur le lien **exact-actif** → l'exigence d'accessibilité est couverte par défaut.
- **Accueil (`/`)** doit être actif **uniquement** sur la racine (sinon il resterait actif partout) : s'appuyer sur l'**exact-active** pour `/` et sur l'active « préfixe » pour les autres, afin que `/equipe/:id/souhaits` conserve **Équipe** en surbrillance. Concrètement : le style « actif » s'applique via la classe active de router-link ; pour `/`, cadrer sur l'exact-active. (Détail d'implémentation laissé au développeur ; le critère est : **un seul item actif à la fois, cohérent avec la route courante**, avec `aria-current="page"` dessus.)

### 6.5 Infobulles (maison, sans lib)

- En **déplié** : pas d'infobulle (le libellé est déjà visible).
- En **replié** : `.menu-item__infobulle` (positionnée à droite de l'item) apparaît sur **`:hover` ET `:focus-visible`/`:focus-within`** (l'accès clavier ne doit pas être oublié — la maquette ne gérait que `:hover`, **à compléter**). `pointer-events: none`, `z-index` au-dessus du contenu.
- L'infobulle est un **complément visuel** ; le nom accessible réel est porté par l'`aria-label` de l'item (§6.1). Aucune dépendance de tooltip (KISS).

## 7. Règles de validation

**Aucun formulaire**, donc **aucune règle Vuelidate**. `0015` n'introduit aucune saisie utilisateur (seulement navigation + bascule de repli).

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([architecture 08](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Toujours savoir où l'on est** : item actif marqué par **fond + barre d'accent + graisse** (jamais la seule couleur, point 8 de `08`). `aria-current="page"` sur l'item courant.
- **Repli réversible et explicite** : bouton avec **libellé clair** (« Réduire le menu » / « Déplier le menu »), `aria-expanded` reflétant l'état ; état **mémorisé** (tolérance à l'effort, on ne réimpose pas un choix à chaque visite).
- **En replié, aucune perte d'information** : chaque icône a une **infobulle** (survol **et** focus) et un **`aria-label`** ; une icône seule n'est jamais une commande muette (point 9 de `08`, [ADR 0013](../docs/adr/0013-icones-phosphor.md)).
- **Ergonomie physique** : items **≥ 44 px** de haut, bien espacés ; en replié, la cible reste large (icône centrée dans une zone ≥ 44 px).
- **Focus clavier visible** partout (item, bouton de repli) : outline non supprimé, s'appuyer sur `$couleur-focus`/`$epaisseur-focus` (et le mixin de focus du projet si présent dans `_mixins.scss`). Ordre de tabulation naturel : marque → items (haut→bas) → bouton de repli.
- **Contraste AA** : texte clair sur le dégradé teal (tokens `0014`, conçus pour AA) ; item actif et infobulle lisibles.
- **Cohérence** : mêmes icônes que le reste de l'app (une icône = une destination), libellés identiques à ceux du glossaire et de l'ancienne navbar. La régularité rassure (point 10 de `08`).
- **Pas de mouvement gênant** : transition de largeur douce et courte ; respecter `prefers-reduced-motion` (réduire/supprimer l'animation de repli et de l'infobulle si l'utilisateur le demande).

## 9. Étapes d'implémentation

Découpage en **3 tâches**, chacune pour **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé : **T1 → T2 → T3** (T2 consomme l'action/le getter de T1 ; T3 monte le composant de T2). **Prérequis** : les tokens « menu latéral » de la feature `0014` doivent être disponibles (sinon coordonner — voir §12.2).

### Tâche 1 — Préférence UI persistée (`storageRepository` + module `ui` + init `main.js`)

**Fichiers** :
- `src/storage/storageRepository.js` (**modifier**) — ajouter `lirePreferenceMenuReplie()` (lecture **synchrone**, clé dédiée `idelia:prefs-ui`, tolérante) et `enregistrerPreferenceMenuReplie(valeur)` (écriture best-effort). **Ne pas** toucher la logique du `SaveDocument` (§4.2).
- `src/store/modules/ui.js` (**modifier**) — `state.menuReplie` (défaut `false`), getter `menuReplie`, mutation `SET_MENU_REPLIE`, actions `basculerMenu` (commit inversé + `enregistrerPreferenceMenuReplie`) et `initialiserMenu` (lit + commit) (§4.1).
- `src/main.js` (**modifier**) — appeler `store.dispatch('ui/initialiserMenu')` **avant** `app.mount(...)`, pour appliquer la préférence dès le premier rendu (§4.3).

**Critères de sortie** :
- `store.getters['ui/menuReplie']` vaut `false` par défaut (menu déplié).
- `store.dispatch('ui/basculerMenu')` inverse le getter **et** écrit dans `idelia:prefs-ui` ; un second appel revient à l'état initial.
- Après `basculerMenu` (menu replié), **recharger** la page : `ui/initialiserMenu` restitue `menuReplie === true` (préférence persistée, appliquée avant le montage).
- La clé `idelia:prefs-ui` est **distincte** de la clé du `SaveDocument` ; l'export/import (`0008`) **n'inclut pas** cette préférence (le `SaveDocument` est inchangé).
- Aucun accès `localStorage` **hors** `storageRepository` ; le module `ui` reste non hydraté par `bootstrap`/`REPLACE_ALL` et ignoré du plugin de persistance. `npm run build` réussit.

### Tâche 2 — Composant `MenuLateral.vue`

**Fichiers** :
- `src/components/communs/MenuLateral.vue` (**créer**) — structure §6.1 : marque (pastille croix médicale Phosphor + wordmark + sous-titre), groupes « Pilotage » / « Planning », items `router-link` (icône Phosphor + libellé + infobulle + `aria-label`), bouton de repli en pied (`aria-expanded`, libellé « Réduire le menu » / « Déplier le menu »). Lit `ui/menuReplie`, dispatch `ui/basculerMenu`. Styles `scoped` pilotés par `menu-lateral--replie`. **Couleurs uniquement via les tokens `0014`** (dégradé, texte, item actif, accent, infobulle). État actif = fond + barre d'accent + graisse (jamais la seule couleur). Infobulles maison sur `:hover` **et** `:focus-visible`.

**Dépend de** : T1 (getter/action `ui`), tokens `0014`, existant (import des icônes Phosphor).

**Critères de sortie** (le composant peut être vérifié monté seul ou dans `App.vue` après T3) :
- Les 6 destinations apparaissent sous leurs deux groupes, avec icône **+** libellé en déplié.
- L'item de la route courante est mis en évidence (**fond + barre d'accent + graisse**) et porte `aria-current="page"` ; **un seul** item actif à la fois (Accueil actif **uniquement** sur `/`).
- Cliquer le bouton de repli : le menu passe en rail (icônes seules, libellés masqués, intitulés de groupe masqués, wordmark masqué) ; `aria-expanded` passe à `false` ; le libellé du bouton devient « Déplier le menu ».
- En replié : survoler **ou** focus-clavier un item affiche son **infobulle** (libellé) ; chaque item conserve un `aria-label`.
- Items ≥ 44 px ; **focus visible** sur items et bouton ; navigation clavier Tab dans l'ordre marque→items→bouton.
- Aucune couleur codée en dur (uniquement tokens) ; icônes 100 % Phosphor ; aucune lib de tooltip. `npm run build` réussit.

### Tâche 3 — Refonte `App.vue` en grille `sidebar + contenu` + responsive

**Fichiers** :
- `src/App.vue` (**réécrire** le shell) — grille CSS `sidebar + contenu` (§6.2) : colonne 1 `<MenuLateral />` pleine hauteur, colonne 2 `<main><router-view/></main>` défilant ; largeur de colonne pilotée par `ui/menuReplie` (classe `app-layout--menu-replie`) ; media query responsive `< $rupture-lg` forçant l'apparence rail et masquant le bouton de repli (§6.3) ; suppression de l'ancienne `navbar` et de ses styles. Aucune couleur de barre en dur.

**Dépend de** : T2 (`MenuLateral`), T1 (getter `ui/menuReplie`).

**Critères de sortie** :
- Le menu est **à gauche**, en **grille** (`sidebar + contenu`) ; le contenu des écrans s'affiche à droite et **défile** sans faire défiler le menu.
- Basculer le repli **réduit/élargit** la colonne du menu de façon synchronisée avec l'apparence interne du menu (une seule source `ui/menuReplie`).
- **Rechargement** : l'état (déplié/replié) est **restitué** sans scintillement (préférence appliquée avant le montage).
- **Responsive** : en réduisant la fenêtre sous `~992px`, le menu passe **automatiquement** en rail (icônes + infobulles) et le bouton de repli disparaît ; au-dessus, la préférence utilisateur reprend la main.
- Toutes les routes existantes restent accessibles et rendues correctement dans la colonne de contenu. `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] La navigation est un **menu latéral à gauche**, `App.vue` étant une **grille `sidebar + contenu`** (fini la navbar horizontale).
- [ ] Le menu affiche une **pastille de marque** (le **logo `public/favicon.png`**) + wordmark « Idelia » + sous-titre, et les destinations **groupées** (« Pilotage », « Planning ») avec **icône + libellé**.
- [ ] Un **bouton en bas** **replie/déplie** le menu ; en replié le menu est un **rail d'icônes seules**.
- [ ] En **replié**, chaque item montre son libellé en **infobulle** au **survol ET au focus clavier**, et porte un **`aria-label`**.
- [ ] L'état déplié/replié est **persistant** : après rechargement, le menu revient dans l'état laissé, **sans scintillement**, et **sans** faire partie du `SaveDocument` (non exporté/importé).
- [ ] L'item de l'écran courant est mis en évidence par **fond + barre d'accent + graisse** (jamais la seule couleur) et porte **`aria-current="page"`** ; un seul item actif à la fois.
- [ ] Le bouton de repli expose **`aria-expanded`** cohérent avec l'état.
- [ ] **Focus clavier visible** sur tous les éléments interactifs ; cibles **≥ 44 px** ; ordre de tabulation logique.
- [ ] **Responsive** : sous ~992px, le menu se réduit automatiquement au rail (KISS, sans overlay) ; au-dessus, la préférence utilisateur pilote l'affichage.
- [ ] **Aucune couleur du menu codée en dur** : toutes viennent des **tokens `0014`**. **Icônes d'UI 100 % Phosphor** ([ADR 0013](../docs/adr/0013-icones-phosphor.md)) ; seule exception assumée : le **logo de marque** (`public/favicon.png`, asset image). **Aucune dépendance ajoutée**.
- [ ] Aucun accès `localStorage` **hors** `storageRepository` (règle d'or #8 respectée) ; aucune logique métier dans les composants.
- [ ] `npm run build` réussit après chaque tâche.

## 11. Vérification

Parcours manuel (`npm run dev`) :

1. **Disposition** — L'app s'ouvre avec le menu **à gauche** ; le contenu de l'écran courant est à droite. Faire défiler un écran long : le menu **reste fixe**.
2. **Groupes & libellés** — Vérifier « Pilotage » (Accueil, Équipe, Tournées, Absences & congés) et « Planning » (Planning, Paramètres), icônes cohérentes.
3. **Item actif** — Naviguer vers chaque écran : l'item correspondant est mis en évidence (fond + barre d'accent + graisse) ; ouvrir `/equipe/:id/souhaits` → **Équipe** reste actif ; sur `/`, seul **Accueil** est actif. Vérifier `aria-current="page"` (inspecteur).
4. **Repli/dépli** — Cliquer « Réduire le menu » : le menu devient un rail d'icônes ; le libellé du bouton devient « Déplier le menu » ; `aria-expanded="false"`. Re-cliquer : retour déplié.
5. **Infobulles (replié)** — Survoler une icône → infobulle avec le libellé. Puis **au clavier** (Tab jusqu'à un item) → l'infobulle apparaît aussi au focus. Vérifier l'`aria-label` (inspecteur / lecteur d'écran).
6. **Persistance** — Replier, **recharger** (F5) : le menu revient **replié**, sans passer visuellement par l'état déplié. Déplier, recharger : revient **déplié**. Vérifier que `localStorage` contient bien `idelia:prefs-ui` **et** que la clé du `SaveDocument` ne contient **pas** ce réglage.
7. **Export/import (`0008`)** — Exporter une sauvegarde : le JSON **n'inclut pas** la préférence de menu. Importer sur un autre état : le menu conserve la préférence locale (non écrasée par l'import).
8. **Responsive** — Réduire la largeur de la fenêtre sous ~992px : le menu passe **automatiquement** en rail, le bouton de repli disparaît ; élargir : la préférence reprend la main.
9. **Clavier / accessibilité** — Parcourir au Tab : focus visible partout, ordre marque→items→bouton ; activer un item à Entrée ; activer le repli à Entrée/Espace. Tester `prefers-reduced-motion` (l'animation de repli est réduite/supprimée).
10. **Build** — `npm run build` réussit.

## 12. Décisions à confirmer / risques

1. **Persistance de la préférence via `storageRepository` (clé dédiée) — arbitrage règle d'or #8 / ADR 0005.** L'énoncé produit demande une persistance « **PAS** via le repository de persistance **métier** ». Interprétation retenue : la préférence **ne doit pas entrer dans le `SaveDocument`** (ni export/import), **mais** tout accès `localStorage` doit rester **derrière `storageRepository`** (règle d'or #8, non négociable). Solution : **deux méthodes dédiées** dans `storageRepository`, sur une **clé séparée** (`idelia:prefs-ui`), hors `SaveDocument`. Cela concilie les deux exigences. **À confirmer** ; alternative plus littérale à l'intention produit (accès `localStorage` **direct** depuis le module `ui`) **entrerait en conflit avec la règle d'or #8** et n'est **pas** retenue.
2. **Dépendance à la feature `0014` (tokens du menu).** `0015` **consomme** les tokens « menu latéral » (dégradé teal, texte, item actif, accent, infobulle) mais **ne les définit pas**. Les **noms exacts** de ces tokens doivent être **figés avec `0014`** (proposition : `$menu-fond-haut`/`$menu-fond-bas`, `$menu-texte`, `$menu-texte-attenue`, `$menu-item-actif-fond`, `$menu-item-survol-fond`, `$menu-accent`, `$menu-infobulle-fond`/`$menu-infobulle-texte`). **Séquencer `0015` après `0014`.** Si `0015` démarre avant, prévoir des tokens provisoires alignés sur ces noms, à réconcilier.
3. **Responsive = rail auto, sans overlay (KISS, retenu).** Sous `$rupture-lg`, apparence rail forcée en CSS, bouton de repli masqué ; pas d'off-canvas/hamburger en v1. **À confirmer.** Alternative (plus tard) : un **menu en overlay** (glissant) sous `$rupture-sm` pour libérer totalement la largeur sur téléphone — non nécessaire pour un usage cabinet (poste/tablette).
4. **Logo de marque = `public/favicon.png` (tranché).** La maquette utilisait un SVG `#i-cross` ad hoc ; le porteur a décidé d'utiliser **l'asset de marque `public/favicon.png`** (cercle teal + croix) affiché en `<img>`. Comme c'est un **élément de marque** et non une icône d'UI, il **sort du périmètre de l'ADR 0013** (Phosphor reste obligatoire pour les icônes d'interface) — **pas d'exception à acter**. Sur le dégradé teal de la barre, ajouter un léger liseré/`box-shadow` pour le détacher du fond (le cercle du logo étant lui aussi teal).
5. **Indicateur de sauvegarde dans le menu — différé.** La maquette montre un bloc « Sauvegardé · 14:32 » en pied de menu. `0015` **réserve l'emplacement** mais **ne l'implémente pas** (le shell n'en a pas besoin ; `IndicateurSauvegarde` existe déjà et pourra y être branché avec l'Accueil `0013`). **À confirmer** : garder l'emplacement vide en `0015` ou intégrer l'indicateur dès maintenant.
6. **Coordination sur `src/App.vue` (fichier global).** `0015` **réécrit** `App.vue`. Au moment de la décision, la feature `0011` (éditeur de planning) était en cours et **peut** avoir touché des fichiers globaux. **Risque de conflit de merge** : séquencer `0015` **après** l'atterrissage de `0011` et **avec/après** `0014`. Vérifier l'état de `App.vue` juste avant l'implémentation.
7. **Documentation à mettre à jour (hors périmètre code, à signaler).** `07-navigation-et-ecrans.md` décrit une « **barre de navigation permanente** » sans préjuger de l'orientation ; après `0015`, préciser qu'elle est **latérale et repliable**. Non bloquant, à acter par le porteur (mise à jour doc, pas dans cette feature).
