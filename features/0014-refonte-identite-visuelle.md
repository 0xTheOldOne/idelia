# Feature 0014 — Refonte de l'identité visuelle (tokens + police Manrope)

- **Statut** : À faire
- **Dépend de** : `0001` (socle SCSS : `_tokens.scss`, `_bootstrap.scss`, `_base.scss`, `_mixins.scss`, intégration Bootstrap thémée, `main.js`).
- **ADR liés** : [0012](../docs/adr/0012-style-scss.md) (style en SCSS, tokens = source de vérité), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (Bootstrap thémé **par nos tokens**, jamais de valeur en dur), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor — information jamais portée par la seule couleur). Instruction : [style-scss](../docs/instructions/style-scss.md).

> ### ⚠️ Note de coordination (à lire avant de démarrer)
>
> Cette feature modifie **exclusivement des fichiers globaux** partagés par toute l'application : `src/styles/_tokens.scss`, `src/styles/_bootstrap.scss`, `src/styles/_base.scss`, `src/main.js`, `package.json`. Le moindre changement se **répercute sur tous les écrans**.
>
> - **Risque de conflit** avec toute session touchant ces fichiers (historiquement la feature `0011` — éditeur de planning). **Séquencer** : ne lancer `0014` que lorsque aucune autre tâche n'édite `_tokens.scss` / `_bootstrap.scss` / `_base.scss` / `main.js`. Rebaser/repartir de `main` juste avant.
> - **Feature `0015` (refonte du layout / menu latéral) dépend de `0014`** : elle consomme les **tokens « menu latéral »** définis ici (§Modèle de tokens). `0014` ne crée **pas** le menu ; elle prépare uniquement ses tokens.
> - Les **valeurs de tokens changent, mais leurs noms sont préservés** (voir §12) : aucun composant existant n'a à être réécrit pour que le build passe.

## 1. Contexte & objectif

Le rendu actuel est jugé **« un peu vert et fade »** : la primaire du code (`#1d5c63`) est une version **désaturée et sombre**, alors que le logo (`public/logo.png`) porte un **teal vif** (≈ `#1c8e9c`). L'application manque d'une identité chaleureuse et affirmée, alors que l'ergonomie et la lisibilité sont sa priorité (public **peu à l'aise avec l'informatique**).

Le référent a **tranché** (maquette interactive validée) : adopter la palette **« Teal & Sable »** (teal vif de marque + primaire interactive lisible + accent ambre pour les points d'attention + neutres sable chauds) et la police **Manrope** (libre, licence SIL OFL), qui apporte de la clarté et du caractère tout en restant très lisible.

**Résultat attendu** : l'application entière se re-thème **par le seul jeu de tokens** (aucune couleur en dur ajoutée), et affiche du texte en **Manrope** (4 graisses). Aucun écran n'est restructuré ; aucune logique n'est touchée. C'est un socle visuel réutilisé par toutes les features (et directement par `0015`). **`0014` rend correctement en standalone** — fond de page sable + cartes/champs blancs, sur **tous** les écrans — **sans attendre `0015`** et **sans aucune migration** de composant (le sable est porté par un token de page **dédié**, `$couleur-fond` restant blanc — voir §Modèle de tokens et §12).

**Hors périmètre `0014`** (à ne pas faire ici) :

- **Le layout / le menu latéral repliable** — c'est la feature `0015`. `0014` se limite à **définir les tokens** qu'elle consommera.
- **La refonte du contenu ou de la structure des écrans** (grilles, cartes, formulaires) — inchangée ; seul le thème (couleurs/police) évolue via les tokens.
- L'ajout de tout composant, route, store ou domaine.

## 2. Écrans concernés

**Aucune route créée ni modifiée**, **aucun écran restructuré** ([07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md) inchangé). La feature est **transversale** : tous les écrans existants (`/accueil`, `/parametres`, `/equipe`, `/souhaits`, `/tournees`, `/absences`, `/planning`…) sont **re-thémés automatiquement** parce qu'ils consomment les tokens et les composants Bootstrap thémés.

**Expérience visée** (utilisateur non-technique) :

- Un rendu **plus chaleureux et plus contrasté** : fond **sable** doux, cartes et champs **blanc pur** posés dessus (relief clair), teal **vif** sur les éléments de marque, teal **profond** sur les actions, ambre en **petits repères** d'attention.
- Une **typographie nette et moderne** (Manrope) qui améliore la lisibilité sans changer les repères de l'utilisateur (mêmes écrans, mêmes gestes).
- **Aucune perte de repère** : les libellés, positions, icônes et parcours restent identiques ; seule l'ambiance visuelle change.

## 3. Modèle de données touché

**Aucun.** Purement stylistique. `schemaVersion` inchangé, aucune migration, aucune (dé)sérialisation impactée.

> Nuance : les couleurs **de données** (`ParametresCabinet.couleursParDefaut`, `Personne.couleur`, `Tournee.couleur`…) sont des **données métier**, pas du style — elles ne sont **pas** concernées par cette feature (elles vivent en JS, pas dans les tokens). Voir la note en §12 sur un `#hex` de repli obsolète dans deux formulaires.

## 4. Store (Vuex)

**Aucun.** Ni module, ni getter, ni action, ni mutation.

## 5. Domaine (logique pure)

**Aucun.** Aucune fonction de `src/domain/` créée ou modifiée.

## 6. Composants

**Aucun composant `.vue` créé ni réécrit.** Le re-thème passe **entièrement** par les tokens et le pont Bootstrap ; les composants héritent du nouveau thème sans modification, conformément à la règle « jamais de couleur en dur dans les composants » ([style-scss](../docs/instructions/style-scss.md), [ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md)).

Deux constats à connaître (traités, ou notés en §12, mais **hors périmètre de réécriture** ici) :

- **`src/App.vue`** contient trois `color: #fff` en dur (texte blanc sur la barre de navigation teal, héritée de `0001`). Ils restent valides visuellement. La barre de navigation actuelle est **remplacée par le menu latéral en `0015`** ; on n'y touche pas ici. Pour éviter d'ajouter un `#hex` de style « orphelin », `0014` **peut** exposer un token `$couleur-texte-inverse: #FFFFFF` (texte sur fonds teal/foncés) que `0015` adoptera — voir §Modèle de tokens.
- **Composants référençant `$couleur-fond`** comme fond de surface (cartes, champs, panneaux) : `$couleur-fond` **reste `#FFFFFF`** → ils demeurent **corrects sans aucune modification**. Le sable est porté par un token **dédié** au fond de page, `$couleur-page` (appliqué **uniquement** au fond de page via `$body-bg` et la règle `body` de `_base.scss`). `0014` rend donc **proprement en standalone**, sans état transitoire (§12).

## 7. Règles de validation

**Aucune.** Pas de formulaire, pas de saisie.

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie.md](../docs/architecture/08-principes-ux-ergonomie.md), [checklist accessibilité](../docs/instructions/accessibilite-ergonomie.md)) :

- **Contraste AA obligatoire (≥ 4.5:1 pour le texte normal)** sur chaque couple texte/fond. Ratios clés **vérifiés** (calcul WCAG relative luminance) :

  | Premier plan | Fond | Ratio ≈ | Verdict |
  |---|---|---|---|
  | Texte `#2B2924` | Fond de page `#FAF7F1` | **13.6:1** | ✅ AAA |
  | Texte `#2B2924` | Surface `#FFFFFF` | **14.5:1** | ✅ AAA |
  | Texte atténué `#6E6656` | Fond de page `#FAF7F1` | **5.3:1** | ✅ AA |
  | Texte atténué `#6E6656` | Surface `#FFFFFF` | **5.7:1** | ✅ AA |
  | Blanc `#FFFFFF` | Primaire `#0E6E77` | **6.0:1** | ✅ AA (boutons pleins) |
  | Blanc `#FFFFFF` | Primaire foncée `#0B565E` | **8.4:1** | ✅ AAA (hover/pressed) |
  | Texte-sur-accent `#3A2B0C` | Accent ambre `#DD9A44` | **5.7:1** | ✅ AA |
  | Blanc `#FFFFFF` | Accent ambre `#DD9A44` | **2.4:1** | ❌ **insuffisant** → motive la règle « accent = repères, pas de gros bouton plein à texte blanc » |
  | Blanc `#FFFFFF` | Succès `#15803D` | **5.0:1** | ✅ AA |
  | Blanc `#FFFFFF` | Alerte `#B45309` | **5.0:1** | ✅ AA |
  | Blanc `#FFFFFF` | Erreur `#C0392B` | **5.4:1** | ✅ AA |
  | Marque `#17868F` (texte) | Surface `#FFFFFF` | **4.3:1** | ⚠️ sous 4.5 → **repères/gros éléments seulement**, pas de texte courant (utiliser `$couleur-primaire` pour le texte) |

- **Rôles de couleur clairs** : `$couleur-marque` (teal vif) = **décoratif / repères de marque / grands éléments** ; `$couleur-primaire` (teal profond, 6:1) = **texte et éléments interactifs** ; `$couleur-accent` (ambre) = **points d'attention** (item de menu actif, petites pastilles) — **jamais** un aplat plein portant du texte blanc.
- **Jamais l'information par la seule couleur** ([ADR 0013](../docs/adr/0013-icones-phosphor.md)) : la palette **ne remplace pas** le doublage icône + libellé déjà en place ; elle le renforce (les couleurs sémantiques restent AA en texte comme en aplat).
- **Lisibilité de la police** : Manrope en **16 px** de base ([`$taille-texte-base`], confort déjà retenu) ; graisses **400** (courant), **500** (libellés/emphase légère), **700** (titres), **800** (marque / gros chiffres). `font-display: swap` (fourni par `@fontsource`) évite le texte invisible au chargement.
- **Focus visible** conservé : `$couleur-focus` reste la primaire foncée (`#0B565E`), contraste renforcé sur sable et sur blanc.
- **Cohérence** : une **seule source de vérité** (`_tokens.scss`) → tous les écrans changent d'un bloc, sans divergence.

## Modèle de tokens (référence normative — `_tokens.scss`)

Les **noms FR existants sont conservés** ; seules leurs **valeurs** changent (compatibilité ascendante). Les tokens **nouveaux** sont marqués « (nouveau) ».

### Marque & primaire

| Token | Valeur | Rôle |
|---|---|---|
| `$couleur-marque` **(nouveau)** | `#17868F` | Teal vif du logo — **décoratif / repères de marque / grands éléments** (pas le texte courant, cf. §8). |
| `$couleur-primaire` | `#0E6E77` | Primaire **interactive** (boutons, liens, texte teal) — blanc AA 6:1. |
| `$couleur-primaire-foncee` | `#0B565E` | Hover / pressed / focus. |
| `$couleur-primaire-claire` | `= $couleur-marque` (`#17868F`) | **Alias** (référence SCSS, pas de hex dupliqué) : conservé car consommé par plusieurs écrans et par le mapping `$info`. |

### Accent (points d'attention uniquement)

| Token | Valeur | Rôle |
|---|---|---|
| `$couleur-accent` **(nouveau)** | `#DD9A44` | Ambre — item de menu actif, petits repères. **Jamais** un aplat plein à texte blanc. |
| `$couleur-accent-texte` **(nouveau)** | `#3A2B0C` | Texte **sur** fond accent (5.7:1). |
| `$couleur-accent-foncee` **(nouveau)** | `#8A5A12` | Variante foncée pour **texte ambre sur fond clair** (≈ 5.9:1 sur blanc). Valeur à ajuster si jugée trop brune (§12). |

### Neutres « sable chauds »

> Décision référent : **`$couleur-fond` reste blanc** (surface des cartes/champs/modales, valeur inchangée) ; le sable est porté par un token **dédié** au fond de page, `$couleur-page`. Ainsi `0014` rend proprement en standalone, **sans migration** de composant.

| Token | Valeur | Rôle |
|---|---|---|
| `$couleur-page` **(nouveau)** | `#FAF7F1` | Fond de **page** (sable chaud, « canvas » de l'app). Le sable ne s'applique **qu'ici** (via `$body-bg` + `body`). |
| `$couleur-fond` | `#FFFFFF` | Surface (cartes, champs, modales) — **blanc pur** posé sur le sable. *(valeur **inchangée**)* |
| `$couleur-fond-clair` | `#F3ECDF` | Surface **atténuée** / secondaire (zones douces, en-têtes de section). *(était `#f5f6f7`)* |
| `$couleur-bordure` | `#E7DECE` | Bordures / séparateurs. *(était `#ced4da`)* |
| `$couleur-texte` | `#2B2924` | Texte principal. *(était `#212529`)* |
| `$couleur-texte-attenue` | `#6E6656` | Texte secondaire / aides. *(était `#495057`)* |
| `$couleur-texte-inverse` **(nouveau, optionnel)** | `#FFFFFF` | Texte sur fonds teal/foncés (menu, boutons) — évite les `#fff` en dur (adopté par `0015`). |

> Les tokens `$couleur-surface` / `$couleur-surface-secondaire` envisagés initialement sont **abandonnés** (KISS) : `$couleur-fond` (blanc) tient déjà le rôle de surface et `$couleur-fond-clair` (`#F3ECDF`) celui de surface atténuée — nommage FR cohérent (`fond` / `fond-clair`), moins de tokens, aucun doublon de valeur.

### Sémantiques

| Token | Valeur | Rôle |
|---|---|---|
| `$couleur-succes` | `#15803D` | *(était `#2e7d4f`)* — blanc AA 5.0:1. |
| `$couleur-avertissement` | `#B45309` | *(était `#b8860b`)* — atteint désormais l'AA en **texte** (5.0:1). |
| `$couleur-avertissement-texte` | `#B45309` | **Alias** conservé (la base atteint l'AA texte ; mettre à jour le commentaire d'origine). |
| `$couleur-erreur` | `#C0392B` | *(était `#c62828`)* — blanc AA 5.4:1. |

### Tokens « menu latéral » (consommés par `0015`, définis ici)

| Token | Valeur | Rôle |
|---|---|---|
| `$couleur-menu-fond-haut` **(nouveau)** | `#147C84` | Haut du dégradé teal foncé. |
| `$couleur-menu-fond-bas` **(nouveau)** | `#0B525A` | Bas du dégradé. |
| `$degrade-menu` **(nouveau, optionnel)** | `linear-gradient(200deg, $couleur-menu-fond-haut, $couleur-menu-fond-bas)` | Recette de dégradé prête à l'emploi pour `0015`. |
| `$couleur-menu-texte` **(nouveau)** | `rgba(255, 255, 255, 0.82)` | Libellés d'items (état normal). |
| `$couleur-menu-texte-actif` **(nouveau)** | `#FFFFFF` | Libellé de l'item **actif** (blanc plein, meilleur contraste). |
| `$couleur-menu-item-actif-fond` **(nouveau)** | `rgba(255, 255, 255, 0.16)` | Fond de l'item actif. |
| `$couleur-menu-item-actif-accent` **(nouveau)** | `= $couleur-accent` (`#DD9A44`) | Barre d'accent ambre de l'item actif. |

> **Vérification `0015`** : le texte blanc sur le point **le plus clair** du dégradé (`#147C84`) est ≈ 4.95:1 ; à 82 % d'opacité il descend sous 4.5:1 pour du **petit** texte. `0015` doit donc réserver `$couleur-menu-texte` (82 %) aux libellés d'items (taille ≥ ~15 px / poids ≥ 500) et employer `$couleur-menu-texte-actif` (blanc plein) pour l'item actif. À valider au moment de `0015`.

### Typographie (Manrope)

| Token | Valeur | Note |
|---|---|---|
| `$police-base` | `'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` | Manrope en tête, **fallback système conservé**. |
| `$graisse-normale` | `400` | (inchangé) |
| `$graisse-moyenne` **(nouveau)** | `500` | Libellés / emphase légère. |
| `$graisse-gras` | `700` | (inchangé) — titres. |
| `$graisse-extra-gras` **(nouveau)** | `800` | Marque / gros chiffres. |

## Pont Bootstrap (référence normative — `_bootstrap.scss`)

**Aucune valeur en dur** : chaque variable Bootstrap pointe un token ([ADR 0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md)). Mappings **existants conservés** (leurs valeurs suivent les tokens), plus les ajouts ci-dessous.

| Variable Bootstrap | Token | Statut |
|---|---|---|
| `$primary` | `$couleur-primaire` | existant (valeur change) |
| `$success` | `$couleur-succes` | existant |
| `$danger` | `$couleur-erreur` | existant |
| `$warning` | `$couleur-avertissement` | existant |
| `$info` | `$couleur-primaire-claire` (= marque) | existant |
| `$body-color` | `$couleur-texte` | existant |
| `$body-bg` | `$couleur-page` (sable) | existant (**repointé** : `$couleur-fond` → `$couleur-page`) |
| `$border-color` | `$couleur-bordure` | existant |
| `$font-family-base` | `$police-base` (Manrope) | existant (valeur change en T2) |
| `$font-size-base` | `$taille-texte-base` | existant |
| `$border-radius` | `$rayon-md` | existant |
| `$spacer` | `$espace-3` | existant |
| `$input-bg` | `$couleur-fond` (blanc) | **ajout** — champs blancs sur la page sable |
| `$modal-content-bg` | `$couleur-fond` (blanc) | **ajout** — modales blanches sur la page sable |
| `$body-secondary-bg` / `$body-tertiary-bg` | `$couleur-fond-clair` | **ajout (optionnel)** — cohérence des fonds atténués |

> **Rappel KISS** : ne mapper que ce qui sert aux modules Bootstrap **réellement importés** (reboot, grid, containers, buttons, forms, nav, navbar, alert, close, modal, utilities). Le composant `card` n'est **pas** importé (les cartes de l'app sont en SCSS maison) : inutile de mapper `$card-bg`.

## 9. Étapes d'implémentation

Découpage en **2 tâches**, chacune destinée à **un sous-agent** (`dev-front`, `model: sonnet`, effort `medium`). **Ordre imposé : T1 puis T2** (les deux éditent `_tokens.scss` dans des blocs distincts — couleurs pour T1, typographie pour T2 — les enchaîner évite tout conflit d'édition). Le build doit **rester vert après chaque tâche**.

### Tâche 1 — Palette « Teal & Sable » : tokens + pont Bootstrap + fond de page

**Fichiers** :
- `src/styles/_tokens.scss` (**modifier**) — bloc **Couleurs** uniquement :
  - Mettre à jour les **valeurs** des tokens existants : `$couleur-primaire` = `#0E6E77`, `$couleur-primaire-foncee` = `#0B565E`, `$couleur-succes` = `#15803D`, `$couleur-erreur` = `#C0392B`, `$couleur-avertissement` = `#B45309`, `$couleur-fond-clair` = `#F3ECDF`, `$couleur-bordure` = `#E7DECE`, `$couleur-texte` = `#2B2924`, `$couleur-texte-attenue` = `#6E6656`.
  - **Laisser `$couleur-fond` à `#FFFFFF`** (surface blanche des cartes/champs/modales) — **ne pas** la changer : tous les composants qui l'utilisent restent corrects, **aucune migration**.
  - **Aliaser** (référence SCSS, pas de hex dupliqué) : `$couleur-primaire-claire: $couleur-marque;` et `$couleur-avertissement-texte: $couleur-avertissement;` (mettre à jour les commentaires d'origine qui parlaient de contraste insuffisant).
  - **Ajouter** les tokens nouveaux : `$couleur-page` = `#FAF7F1` (fond de page sable), `$couleur-marque`, `$couleur-accent`, `$couleur-accent-texte`, `$couleur-accent-foncee`, `$couleur-texte-inverse`, et les **7 tokens « menu latéral »** (`$couleur-menu-*`, `$degrade-menu`). Respecter l'**ordre de déclaration** (un alias ne peut référencer qu'un token déjà défini : `$couleur-marque` avant `$couleur-primaire-claire`).
  - **Ne pas** introduire `$couleur-surface` / `$couleur-surface-secondaire` (doublon abandonné : `$couleur-fond` = blanc et `$couleur-fond-clair` = `#F3ECDF` tiennent déjà ces rôles).
  - `$couleur-focus` reste `$couleur-primaire-foncee` (désormais `#0B565E`) — ne pas y toucher.
  - Documenter en commentaire les **rôles** (marque = décoratif ; primaire = interactive ; accent = repères ; `page` = fond, `fond` = surface blanche) et les **ratios AA** clés (§8).
- `src/styles/_bootstrap.scss` (**modifier**) — **repointer `$body-bg` sur `$couleur-page`** (fond de page sable) ; **ajouter** `$input-bg: t.$couleur-fond;` et `$modal-content-bg: t.$couleur-fond;` (champs/modales **blancs** sur la page sable), et optionnellement `$body-secondary-bg`/`$body-tertiary-bg` = `t.$couleur-fond-clair` — **avant** l'import des variables Bootstrap ; **conserver** l'ordre d'import impératif et tous les mappings existants. Aucune valeur en dur.
- `src/styles/_base.scss` (**modifier**) — la règle `body { background-color: … }` (actuellement `t.$couleur-fond`) doit pointer **`t.$couleur-page`** (fond de page sable). Ne rien changer d'autre (`color` du body inchangé).

**Critères de sortie** :
- `$couleur-primaire` vaut `#0E6E77` ; `$couleur-primaire-foncee` vaut `#0B565E` ; `$couleur-marque` vaut `#17868F` ; `$couleur-accent` vaut `#DD9A44` ; **`$couleur-fond` reste `#FFFFFF`** ; `$couleur-page` vaut `#FAF7F1` ; `$couleur-fond-clair` vaut `#F3ECDF` ; les 7 tokens `$couleur-menu-*` existent avec les valeurs de §Modèle de tokens.
- Les tokens **historiques** (`$couleur-primaire-claire`, `$couleur-fond-clair`, `$couleur-avertissement-texte`) existent toujours (aliasés ou revalorisés) → **aucun** import cassé chez leurs consommateurs (`AbsencesView`, `SouhaitsView`, `TourneesView`, `EquipeView`, `FormulairePreference`, composants `planning/*`, etc.). **Aucun composant n'a besoin d'être migré** (`$couleur-fond` reste blanc).
- `_bootstrap.scss` : `$body-bg` = `$couleur-page` ; les champs (`<input>`, `<select>`, `<textarea>`) et les modales rendent sur **blanc** ; aucun `#hex` en dur ajouté. `_base.scss` : `body` a un fond **sable** (`$couleur-page`).
- `npm run build` **réussit**. Au `npm run dev`, l'app affiche la nouvelle palette sur **tous** les écrans (boutons teal profond, **fond de page sable + cartes/champs blancs**), **rendu propre en standalone**, sans état transitoire.

### Tâche 2 — Police Manrope (`@fontsource/manrope`, graisses 400 / 500 / 700 / 800)

**Fichiers** :
- `package.json` (**modifier**) — ajouter la dépendance `@fontsource/manrope` (installer via **npm** : `npm install @fontsource/manrope`). Aucune autre dépendance ajoutée (KISS).
- `src/main.js` (**modifier**) — importer **uniquement** les 4 graisses, en tête de fichier (avant ou avec les imports de styles) :
  - `import '@fontsource/manrope/400.css';`
  - `import '@fontsource/manrope/500.css';`
  - `import '@fontsource/manrope/700.css';`
  - `import '@fontsource/manrope/800.css';`
  - Ne rien changer d'autre au démarrage (bootstrap store, directive debounce, montage inchangés).
- `src/styles/_tokens.scss` (**modifier**) — bloc **Typographie** uniquement :
  - `$police-base: 'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;` (Manrope en tête, fallback système **conservé** pour le rendu avant chargement / en cas d'échec).
  - Ajouter `$graisse-moyenne: 500;` et `$graisse-extra-gras: 800;` (conserver `$graisse-normale: 400`, `$graisse-gras: 700`).

**Dépend de** : T1 (mêmes fichiers ; enchaîner pour éviter les conflits d'édition).

**Critères de sortie** :
- `@fontsource/manrope` figure dans les `dependencies` de `package.json` ; `node_modules/@fontsource/manrope` présent après `npm install`.
- `src/main.js` importe **exactement** les CSS des graisses 400, 500, 700, 800 (ni la 200/300/600, ni le variable font).
- `$police-base` commence par `'Manrope'` ; le **fallback système** est conservé derrière.
- Au `npm run dev`, l'inspecteur confirme que `body`/titres rendent en **Manrope** (et non plus en `system-ui`) ; le poids **800** est disponible (ex. titres de marque).
- `npm run build` **réussit** ; les fichiers de police Manrope sont bien émis dans le bundle de build.

## 10. Critères d'acceptation

- [ ] `$couleur-primaire` = `#0E6E77`, `$couleur-primaire-foncee` = `#0B565E`, `$couleur-marque` = `#17868F`, `$couleur-accent` = `#DD9A44` / `$couleur-accent-texte` = `#3A2B0C`.
- [ ] Neutres : `$couleur-page` = `#FAF7F1` (fond de page), **`$couleur-fond` reste `#FFFFFF`** (surface), `$couleur-fond-clair` = `#F3ECDF`, `$couleur-bordure` = `#E7DECE`, `$couleur-texte` = `#2B2924`, `$couleur-texte-attenue` = `#6E6656`.
- [ ] Sémantiques : `$couleur-succes` = `#15803D`, `$couleur-avertissement` = `#B45309`, `$couleur-erreur` = `#C0392B`.
- [ ] **Rendu autonome** : le fond de **page** est sable (`$couleur-page` via `$body-bg` + `body`) et les **cartes/champs/modales** sont blancs, sur **tous** les écrans, **sans état transitoire** et **sans migration** de composant.
- [ ] Les **7 tokens « menu latéral »** existent (dégradé `#147C84`→`#0B525A`, texte `rgba(255,255,255,.82)`, texte actif `#FFFFFF`, fond item actif `rgba(255,255,255,.16)`, barre d'accent = `$couleur-accent`) — prêts pour `0015`.
- [ ] Les **noms de tokens historiques** sont préservés (aliasés si besoin) → aucun composant existant n'est cassé, `npm run build` réussit.
- [ ] **Manrope chargée en 4 graisses** (400/500/700/800) via `@fontsource/manrope` ; `$police-base` pointe Manrope avec fallback système ; `body` et titres rendent en Manrope.
- [ ] **Contraste AA** vérifié sur les couples clés (§8) : texte/fond ≥ **4.5:1**, blanc/primaire ≥ 4.5:1, texte-sur-accent ≥ 4.5:1 ; l'accent ambre **n'est pas** utilisé en aplat plein à texte blanc.
- [ ] Le pont Bootstrap ne mappe **que des tokens** (aucun `#hex` en dur dans `_bootstrap.scss`) ; les champs et modales sont blancs, la page est sable.
- [ ] Aucune **nouvelle** couleur de style en dur : toute couleur SCSS provient de `_tokens.scss` (les `#fff` pré-existants d'`App.vue` sont notés en §12, hors périmètre).
- [ ] `npm run build` réussit ; `npm run dev` montre la nouvelle identité sur tous les écrans, sans régression de mise en page.

## 11. Vérification

Parcours manuel :

1. **Installation** — `npm install` (récupère `@fontsource/manrope`). `npm run dev` démarre sans erreur.
2. **Palette globale** — Ouvrir `/parametres`, `/equipe`, `/tournees`, `/planning` : **fond de page sable** (`#FAF7F1`), cartes/champs/modales **blanc pur** (relief net sur le sable), boutons primaires **teal profond** (`#0E6E77`), hover plus foncé (`#0B565E`). Rendu **propre dès `0014`** (pas de sable-sur-sable). Aucun écran n'a bougé en structure.
3. **Sémantiques** — Provoquer un état d'alerte/erreur/succès (ex. indicateur de sauvegarde, message de validation) : couleurs succès/alerte/erreur lisibles, **toujours doublées d'icône + libellé** (aucune info par la seule couleur).
4. **Accent** — Vérifier qu'aucun **gros bouton plein** ne porte du texte blanc sur ambre (l'accent reste réservé aux petits repères ; l'item de menu actif viendra en `0015`).
5. **Contraste** — Avec l'outil « contraste » du navigateur (ou un vérificateur WCAG), confirmer texte principal, texte atténué, et texte blanc sur boutons ≥ 4.5:1 (valeurs attendues en §8).
6. **Police** — Inspecter `body` et un `h1` : `font-family` résolue en **Manrope** ; couper le réseau après chargement puis recharger pour vérifier le `swap` (fallback système visible brièvement, jamais de texte invisible).
7. **Graisses** — Vérifier qu'un élément en `800` (gros titre/chiffre) et un en `500` (libellé) rendent bien avec ces poids (pas de faux-gras synthétique).
8. **Non-régression tokens** — `npm run build` réussit ; ouvrir un écran consommant `$couleur-primaire-claire`/`$couleur-fond-clair` (ex. `AbsencesView`, `PlanningView`) : rien n'est cassé, rendu cohérent avec la nouvelle palette.

## 12. Décisions à confirmer / risques

1. **Coordination fichiers globaux ⚠️** — `_tokens.scss`, `_bootstrap.scss`, `main.js`, `package.json` sont partagés. **Séquencer** `0014` hors de toute autre session éditant ces fichiers (historiquement `0011`) ; repartir de `main` juste avant. Voir la note de coordination en tête.
2. **`0015` consomme les tokens « menu latéral »** — Ils sont **définis ici** mais **non utilisés** avant `0015` (le menu latéral, le remplacement de la navbar d'`App.vue`, et l'adoption de `$couleur-texte-inverse` sont du ressort de `0015`). Confirmer que `0014` se limite bien aux tokens.
3. **Noms de tokens préservés, valeurs changées** — Choix retenu pour ne casser **aucun** consommateur existant (`$couleur-primaire-claire` et `$couleur-avertissement-texte` sont **aliasés** ; `$couleur-fond-clair` est **revalorisé** en `#F3ECDF`). Alternative écartée (renommer + migrer tous les consommateurs) : plus risquée, hors KISS. À confirmer.
4. **Fond de page vs surfaces — `0014` rend en standalone** — Décision référent : **`$couleur-fond` reste blanc** (surface des cartes/champs/modales) ; le sable est porté par un token **dédié**, `$couleur-page`, appliqué **uniquement** au fond de page (Bootstrap `$body-bg` + règle `body` de `_base.scss`). Conséquence : `0014` rend **correctement en standalone** — fond sable + cartes/champs blancs sur **tous** les écrans — **sans attendre `0015`** et **sans aucune migration** de composant (ceux qui utilisent `$couleur-fond` restent blancs, donc corrects). Aucun état transitoire, aucun T3 de migration. **Redondance résolue** : les tokens `$couleur-surface` / `$couleur-surface-secondaire` initialement envisagés sont **abandonnés** au profit de `$couleur-fond` (blanc) / `$couleur-fond-clair` (`#F3ECDF`) — KISS, nommage FR cohérent, pas de doublon.
5. **`$couleur-accent-foncee` = `#8A5A12`** — Variante foncée pour **texte ambre sur fond clair** (≈ 5.9:1). Valeur **à ajuster** si jugée trop brune (alternative plus claire à vérifier, ex. `#A5701F`, en gardant ≥ 4.5:1). Optionnelle tant qu'aucun écran n'en a besoin.
6. **`#fff` en dur pré-existants (`App.vue`)** — Trois `color: #fff` (texte sur navbar teal, héritée de `0001`). Non traités ici (la navbar est **remplacée par le menu latéral en `0015`**). `0014` expose `$couleur-texte-inverse` pour que `0015` s'en serve. À confirmer : ne rien changer à `App.vue` en `0014`.
7. **`#hex` de repli obsolète dans les formulaires** — `FormulairePersonne.vue` et `FormulaireTournee.vue` ont un repli `?? '#2E86AB'` (bleu, incohérent avec la nouvelle palette) pour la couleur d'entité **quand `couleursParDefaut` est vide**. C'est une **donnée**, pas du style ; hors périmètre `0014`. À signaler comme micro-dette (à aligner sur `$couleur-marque`/première couleur suggérée lors d'un passage sur ces formulaires).
8. **`@fontsource/manrope` (statique) vs variable font** — Retenu : le paquet **statique** avec import des **4 graisses** demandées (KISS, poids maîtrisé), et non `@fontsource-variable/manrope`. À confirmer. Licence **SIL OFL** (libre, redistribuable) — compatible hébergement statique.
9. **Mise à jour de la ROADMAP** — `0014` et `0015` ne figurent pas encore dans `features/ROADMAP.md` (elle s'arrête à `0013`). Les y ajouter (section « Finition » ou une section « Identité & layout ») est **hors périmètre de ce plan** (non modifié ici) mais à acter séparément.
