# Feature 0018 — Système de notifications (toasts)

- **Statut** : À faire
- **Dépend de** : `0001` (shell `App.vue`), `0002` (store Vuex, plugin de persistance débouncé), `0004` (module `personnes`, écran Équipe), `0005` (préférences imbriquées dans `personnes`, écran Souhaits), `0006` (module `tournees`, écran Tournées), `0007`/`0017` (module `absences`, écran Absences & congés), `0015` (shell `App.vue` actuel en grille sidebar + contenu, module `ui` volatile).
- **ADR liés** : [0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md) (Vue 3 Options API + Vuex — fonde le choix d'architecture du §"bus de messages", voir §4), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance derrière `storageRepository` — **le nouveau module n'est PAS persisté**, voir §4), [0012](../docs/adr/0012-style-scss.md) / [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (SCSS thémé par tokens, réutilisation de `alert`/`close` déjà importés), [0013](../docs/adr/0013-icones-phosphor.md) (icônes Phosphor exclusivement).

> **Note de numérotation** : cette feature porte le n° `0018`. Une future **ADR** `0018-...md` (voir feature [0019](0019-sauvegarde-fiable-et-periodique.md) §12) portera un numéro d'ADR différent mais numériquement identique par coïncidence — les deux numérotations (`features/` et `docs/adr/`) sont indépendantes, aucun conflit réel.

## 1. Contexte & objectif

Aujourd'hui, la plupart des actions de création/modification/archivage/suppression (Équipe, Souhaits, Tournées, Absences) ne donnent **aucun retour visuel immédiat** : le formulaire se ferme, la liste se met à jour, et c'est tout (vérifié dans `EquipeView.vue`, `TourneesView.vue`, `AbsencesView.vue`, `SouhaitsView.vue` — aucun message de confirmation). Pour un public **peu à l'aise avec l'informatique**, ce silence est un vrai défaut d'ergonomie ([08 §4](../docs/architecture/08-principes-ux-ergonomie.md) : « Toute action produit un retour clair »).

`0018` introduit un **système de notifications éphémères (« toasts »)** : un petit message qui apparaît, confirme ce qui vient de se passer en langage clair, puis disparaît tout seul après quelques secondes. Les toasts sont **empilables** (plusieurs peuvent coexister, avec une marge entre eux), **fermables** à tout moment, et **accessibles** (annoncés aux lecteurs d'écran, jamais l'information par la seule couleur).

**Architecture retenue — un module Vuex `notifications`, pas un event bus dédié.** Le porteur a évoqué « un composant à ajouter au niveau du layout et l'utilisation d'un bus de message ». En pratique :

- **Composant unique** : `PileNotifications.vue`, monté une fois dans `App.vue` (aux côtés de `MenuLateral`), qui affiche la pile de toasts courante.
- **Bus de messages** : plutôt qu'une dépendance externe (ex. `mitt`) ou un `EventEmitter` maison, on réutilise le mécanisme déjà central de l'application — **Vuex** ([ADR 0003](../docs/adr/0003-stack-vue-vite-optionsapi-vuex-router.md)) — via un **module namespaced volatile `notifications`**, sur le modèle exact du module `ui` existant (`src/store/modules/ui.js`) : n'importe quel module de store ou composant peut `dispatch('notifications/notifier', {...})` depuis n'importe où, sans import ni couplage direct au composant d'affichage. `dispatch` **est** le bus de messages : il découple totalement l'émetteur (une action de store, un composant) du récepteur (`PileNotifications`, qui ne fait que lire `state.notifications.items` de façon réactive). Cette solution est **strictement plus simple** qu'un event emitter maison : elle réutilise un mécanisme déjà connu de toute l'équipe, offre la réactivité Vue « gratuitement » (`mapState`), et n'ajoute **aucune dépendance** ([règle d'or #12](../CLAUDE.md), KISS). Alternative écartée : voir §12.1.

**Où les toasts sont émis** : **centralisés dans les actions de store** des modules `personnes` (CRUD personne + préférences), `tournees` et `absences` — jamais dispatchés depuis un composant pour les CRUD métier, conformément à la règle d'or #10 (« la logique métier vit dans `src/domain/`/le store, pas dans les composants »). Un composant qui appelle `dispatch('personnes/ajouter', ...)` obtient le toast « gratuitement », sans rien coder de plus.

**Relation avec `IndicateurSauvegarde`** : les deux se **complètent**, ils ne se remplacent pas. `IndicateurSauvegarde` répond en continu à la question « mes données sont-elles enregistrées dans ce navigateur ? » (état permanent, visible en haut de `ParametresView`/`AccueilView`). Le toast répond à une question différente et ponctuelle : « qu'est-ce qui vient de se passer, à l'instant, sur cette action précise ? » (« Claire Dupont a été ajoutée à l'équipe. »). Un toast **ne dit jamais** « sauvegardé » à la place de l'indicateur — il ne s'agit jamais d'un état de persistance.

**Hors périmètre `0018`** :

- **Écran Planning** (`plannings.js`) : différé (« à terme », selon le porteur). Ce module a des mutations plus nombreuses et plus fréquentes (génération, verrouillage, glisser-déposer d'affectations) : y accrocher des toasts demande un calibrage séparé (quelles actions méritent un toast sans devenir bruyantes pendant une édition intensive) — à traiter dans une itération ultérieure, une fois ce module stabilisé. Le mécanisme (`notifications/notifier`) sera réutilisable tel quel.
- **`cabinet/majParametres`** (écran Paramètres) : **volontairement exclu** de l'instrumentation automatique — voir §12.2 (raisonnement détaillé, décision à confirmer par le porteur).
- **Actions racines `exporter`/`importer`/`reinitialiser`** (bloc Sauvegarde de Paramètres) : **différées à la feature [0019](0019-sauvegarde-fiable-et-periodique.md)**, qui doit d'abord fiabiliser la détection de succès réel de l'écriture fichier (bug G11) avant qu'un toast puisse annoncer honnêtement un succès — voir §12.3.
- **Aucune nouvelle dépendance** : pas de librairie de toast (ex. `vue-toastification`), conformément à KISS.

## 2. Écrans concernés

Aucune nouvelle route. Le composant `PileNotifications` est monté **une seule fois**, dans le shell `App.vue` ([07-navigation-et-ecrans](../docs/architecture/07-navigation-et-ecrans.md)) : il est donc visible **depuis tous les écrans** (Équipe, Souhaits, Tournées, Absences, Paramètres, Planning, Accueil), sans rien ajouter dans chaque vue.

**Expérience visée** (utilisateur non-technique) :

- Après une action (ex. « Ajouter une personne », « Archiver cette tournée », « Supprimer ce souhait »), un petit encart apparaît en haut à droite de l'écran, avec une **icône**, un **message clair** en français courant (jamais « Entité créée » ou du jargon technique) et une **croix de fermeture**.
- Il **disparaît tout seul** après quelques secondes (~4,5 s pour une confirmation, un peu plus pour un avertissement ou une erreur) — l'utilisateur n'a rien à faire, mais peut le fermer plus tôt s'il le souhaite.
- Si plusieurs actions s'enchaînent, les toasts s'**empilent verticalement avec un espacement net** entre eux, sans jamais se chevaucher.
- Le message ne se substitue jamais à l'action elle-même (la liste s'est déjà mise à jour) : il ne fait que **confirmer**, en nommant la chose concernée (« Claire Dupont a été archivée. » plutôt que « Personne modifiée. »).

## 3. Modèle de données touché

**Aucune entité métier, aucun champ, aucune migration** (`schemaVersion` reste inchangé). Les toasts sont un état **entièrement volatil**, jamais persisté, jamais inclus dans le `SaveDocument` ([03-modele-de-donnees](../docs/architecture/03-modele-de-donnees.md)) — exactement comme le module `ui` existant.

## 4. Store (Vuex)

### 4.1 Nouveau module `src/store/modules/notifications.js` (namespaced, **volatile**)

Sur le modèle exact de `src/store/modules/ui.js` (module namespaced, **jamais hydraté**, **jamais persisté**) :

```js
import { genId } from '@/domain/utils/id.js';

/** Types valides d'un toast ; toute valeur hors de cette liste retombe sur 'info'. */
const TYPES_VALIDES = ['succes', 'info', 'avertissement', 'erreur'];

/** Durées d'affichage par défaut (ms) avant disparition automatique. */
const DUREE_PAR_DEFAUT = {
  succes: 4500,
  info: 4500,
  avertissement: 6000,
  erreur: 8000,
};

export default {
  namespaced: true,
  state: () => ({ items: [] }),
  mutations: {
    AJOUTER(state, toast) { state.items.push(toast); },
    RETIRER(state, id) { state.items = state.items.filter((t) => t.id !== id); },
  },
  actions: {
    /**
     * Émet un toast. C'est le seul point d'entrée du « bus de messages » :
     * n'importe quel module de store ou composant peut l'appeler.
     * @param {{ type?: string, message: string, duree?: number }} payload
     *   `duree` en ms ; `0` = ne disparaît jamais tout seul (fermeture manuelle
     *   uniquement). Absent : durée par défaut selon `type`.
     * @returns {string|null} L'id du toast créé, ou `null` si `message` est vide.
     */
    notifier({ commit }, { type = 'info', message, duree } = {}) {
      if (!message) return null;
      const typeFinal = TYPES_VALIDES.includes(type) ? type : 'info';
      const id = genId();
      const dureeMs = duree ?? DUREE_PAR_DEFAUT[typeFinal];
      commit('AJOUTER', { id, type: typeFinal, message });
      if (dureeMs > 0) {
        setTimeout(() => commit('RETIRER', id), dureeMs);
      }
      return id;
    },
    /** Ferme un toast manuellement (clic sur la croix). */
    retirer({ commit }, id) {
      commit('RETIRER', id);
    },
  },
};
```

- **Aucune mutation `REPLACE`** : ce module n'est jamais hydraté par `bootstrap`/`REPLACE_ALL` ([architecture 04](../docs/architecture/04-gestion-etat-vuex.md)), exactement comme `ui`.
- Enregistrer le module dans `src/store/index.js` (`modules: { ..., ui, notifications }`).

### 4.2 Modification **impérative** de `src/store/index.js` — garde du plugin de persistance

Le plugin de persistance (`persistancePlugin`) observe **toutes** les mutations et planifie une écriture `localStorage` débouncée pour chacune, sauf celles explicitement exclues. Aujourd'hui la garde ignore `ui/*` :

```js
function persistancePlugin(store) {
  store.subscribe((mutation) => {
    if (mutation.type.startsWith('ui/')) return;
    // ...
  });
}
```

**Il faut impérativement étendre cette garde** à `notifications/*` :

```js
if (mutation.type.startsWith('ui/') || mutation.type.startsWith('notifications/')) return;
```

Sans cette modification, chaque `AJOUTER`/`RETIRER` de toast déclencherait une écriture `localStorage` inutile (débouncée, donc pas de bug fonctionnel visible, mais un gaspillage certain, et un statut `EN_COURS`/`ENREGISTRE` qui clignoterait dans `IndicateurSauvegarde` sans raison métier). C'est un point de vigilance **critique** de cette feature (voir aussi §10 et §12.4).

### 4.3 Instrumentation des modules existants (émission centralisée)

Chaque action `ajouter`/`modifier`/`archiver`/`restaurer`/`desactiver`/`reactiver`/`supprimer` (et les CRUD de préférences) des modules `personnes`, `tournees`, `absences` **dispatche** un toast **après** son `commit`, via `dispatch('notifications/notifier', {...}, { root: true })` (le module `notifications` est un sibling namespaced, pas un enfant — `{ root: true }` est nécessaire). Convention de **type** retenue (§12.5, à confirmer) :

| Nature de l'action | Type de toast |
|---|---|
| Création (`ajouter`), modification (`modifier`), restauration (`reactiver`/`restaurer`) | `succes` |
| Archivage/désactivation (`desactiver`/`archiver`), suppression physique (`supprimer`), mise en pause d'un souhait | `info` |

**`src/store/modules/personnes.js`** (modifier chaque action pour ajouter `dispatch` en paramètre de contexte et le dispatch de notification) :

- `ajouter(champs)` → après `commit('ADD', personne)` : `succes` — « {Prénom} {Nom} a été ajouté(e) à l'équipe. »
- `modifier({ id, ...champs })` → après `commit`, relire via `getters.byId(id)` : `succes` — « Les informations de {Prénom} {Nom} ont été mises à jour. »
- `desactiver(id)` → après `commit`, relire via `getters.byId(id)` : `info` — « {Prénom} {Nom} a été archivé(e). »
- `reactiver(id)` → idem : `succes` — « {Prénom} {Nom} a été restauré(e). »
- `ajouterPreference({ personneId, ...champs })` → `succes` — « Souhait ajouté pour {Prénom} {Nom}. »
- `modifierPreference({ personneId, preferenceId, ...champs })` → `succes` — « Souhait modifié pour {Prénom} {Nom}. »
- `supprimerPreference({ personneId, preferenceId })` → `info` — « Souhait supprimé pour {Prénom} {Nom}. »
- `basculerPreference({ personneId, preferenceId })` → `info`, message selon le **nouvel** état (relu après `commit`) — « Souhait mis en pause pour {Prénom} {Nom}. » **ou** « Souhait de nouveau pris en compte pour {Prénom} {Nom}. » (vocabulaire aligné sur le libellé « Pris en compte » de `SouhaitsView.vue`).

**`src/store/modules/tournees.js`** :

- `ajouter(champs)` → `succes` — « La tournée « {libelle} » a été ajoutée. »
- `modifier({ id, ...champs })` → relire via `getters.byId(id)` : `succes` — « La tournée « {libelle} » a été modifiée. »
- `archiver(id)` → `info` — « La tournée « {libelle} » a été archivée. »
- `restaurer(id)` → `succes` — « La tournée « {libelle} » a été restaurée. »

**`src/store/modules/absences.js`** : ce module n'a pas de nom de personne dans son propre state — utiliser `rootGetters['personnes/byId'](personneId)` (lecture inter-module légitime, aucune logique métier dupliquée) :

- `ajouter(champs)` → après `commit('ADD', absence)`, résoudre la personne via `rootGetters['personnes/byId'](absence.personneId)` : `succes` — « L'absence de {Prénom} {Nom} a été enregistrée. »
- `modifier({ id, ...champs })` → relire l'absence mise à jour + la personne : `succes` — « L'absence de {Prénom} {Nom} a été modifiée. »
- `supprimer(id)` → résoudre la personne **avant** `commit('REMOVE', id)` (sinon l'absence n'existe plus pour retrouver `personneId`) : `info` — « L'absence de {Prénom} {Nom} a été supprimée. »

> Chaque action reste **fine** : le message est construit en une ligne, aucune fonction de domaine n'est nécessaire (aucun calcul, juste de l'interpolation de chaîne — voir §5).

## 5. Domaine (logique pure)

**Aucun ajout dans `src/domain/`.** Construire un message de confirmation (« {Prénom} {Nom} a été ajouté(e) à l'équipe. ») n'est pas une règle métier mais de la **présentation** d'un événement déjà survenu — cohérent avec l'absence d'ajout domaine dans la feature `0015` (préférence d'UI pure). Le mapping type→durée/icône est de la **configuration de présentation**, portée directement par `notifications.js` (durées) et `PileNotifications.vue` (icônes/couleurs), sans faire l'objet d'un module domaine dédié (KISS — un seul endroit de plus à maintenir pour un mapping de 4 valeurs n'apporterait rien).

## 6. Composants

### 6.1 `src/components/communs/PileNotifications.vue` (**nouveau**)

Composant transverse (comme `IndicateurSauvegarde`, `MenuLateral`), monté **une fois** dans `App.vue`. Présentational : lit `state.notifications.items` via `mapState`, dispatche `notifications/retirer` au clic sur la croix.

- **Racine** : `<div class="pile-notifications" role="status" aria-live="polite" aria-label="Notifications">` — région d'annonce unique (pattern déjà utilisé par `BlocSauvegarde`/`IndicateurSauvegarde`, `role` + `aria-live` combinés) ; position `fixed`, coin **haut-droit**, `z-index` au-dessus de tout (y compris les modales Bootstrap, pour rester visible même si une boîte de dialogue est ouverte).
- **Liste** : `<transition-group name="toast" tag="div" class="pile-notifications__liste">`, un élément par toast (`:key="toast.id"`).
- **Un toast** : réutilise les classes Bootstrap déjà importées (`alert`, `d-flex`) plutôt que de réinventer un style — cohérent avec `BlocSauvegarde`/`ParametresView` qui utilisent déjà `alert alert-success`/`alert-danger` :

```html
<div
  v-for="toast in items"
  :key="toast.id"
  class="alert d-flex align-items-start gap-2 pile-notifications__toast"
  :class="classeAlerte(toast.type)"
>
  <component :is="icone(toast.type)" :size="20" weight="fill" aria-hidden="true" class="flex-shrink-0" />
  <p class="mb-0 pile-notifications__message">{{ toast.message }}</p>
  <button
    type="button"
    class="btn-close pile-notifications__fermer"
    aria-label="Fermer cette notification"
    @click="retirer(toast.id)"
  />
</div>
```

- **`classeAlerte(type)`** : `{ succes: 'alert-success', info: 'alert-info', avertissement: 'alert-warning', erreur: 'alert-danger' }`.
- **`icone(type)`** (composants Phosphor importés) : `succes` → `PhCheckCircle`, `info` → `PhInfo`, `avertissement` → `PhWarningCircle`, `erreur` → `PhXCircle`. Toujours doublées du message texte (jamais l'icône ou la couleur seule).
- **Croix de fermeture** : réutilise `.btn-close` de Bootstrap — **même choix** que `ModaleBase.vue` (qui utilise déjà `.btn-close` pour sa fermeture, hors Phosphor : précédent explicitement accepté dans ce projet pour cette action générique de fermeture). Agrandir sa cible cliquable à `$cible-cliquable-min` (~44 px) avec la **même technique de padding compensé** que `ModaleBase.vue` (§"modal-header .btn-close").
- **Empilement** : `display:flex; flex-direction:column; gap: $espace-2;` sur `.pile-notifications__liste` — l'espacement demandé par le porteur. Les toasts s'accumulent dans l'ordre d'arrivée (le plus récent en bas de la pile).
- **Transition** (`transition-group`, classes `toast-enter-active`/`toast-leave-active`/`toast-enter-from`/`toast-leave-to`) : fondu + léger déplacement, **désactivée** sous `@media (prefers-reduced-motion: reduce)`.
- **Impression** : `@media print { .pile-notifications { display: none; } }` (aucun sens sur papier, cohérent avec le traitement du menu latéral dans `App.vue`).
- **Accès store** : `computed: { ...mapState('notifications', ['items']) }`, `methods: { ...mapActions('notifications', ['retirer']) }`.

### 6.2 `src/App.vue` (**modifier**)

Ajouter `<PileNotifications />` dans le template (position `fixed`, peu importe l'emplacement exact dans le DOM), et l'enregistrer dans `components`. Aucun autre changement au shell (grille sidebar/contenu déjà en place, `0015`).

### 6.3 Réutilisation

- `alert`/`close` Bootstrap déjà importés (`_bootstrap.scss`, features `0003`/`0004`) : **aucun ajout SCSS Bootstrap**.
- Icônes Phosphor déjà présentes dans `package.json` (`@phosphor-icons/vue`).
- `genId()` (`src/domain/utils/id.js`), déjà utilisé partout ailleurs.

## 7. Règles de validation

**Aucune** : cette feature n'introduit aucun formulaire, aucune saisie utilisateur.

## 8. Points d'attention ergonomie

Public **peu à l'aise avec l'informatique** ([08-principes-ux-ergonomie](../docs/architecture/08-principes-ux-ergonomie.md), [checklist](../docs/instructions/accessibilite-ergonomie.md)) :

- **Langage humain** : chaque message nomme la chose concernée (« Claire Dupont », « La tournée « Secteur Nord » ») plutôt qu'un générique « Élément mis à jour ». Aucun jargon (« CRUD », « mutation », « entité »).
- **Jamais l'information par la seule couleur** : chaque toast porte une **icône** distincte par type **et** un **texte complet** ; la couleur de fond (succès/info/avertissement/erreur) ne fait que renforcer, jamais porter seule le sens.
- **Toujours fermable, jamais bloquant** : le toast n'intercepte jamais le clic ailleurs sur l'écran (pas de focus piégé, pas de fond assombri) ; une croix explicite (`aria-label="Fermer cette notification"`) permet de le faire disparaître à tout moment, cible ≥ 44 px.
- **Disparition automatique prévisible** : durées courtes pour les confirmations (4,5 s), un peu plus longues pour les avertissements/erreurs (6-8 s) qui demandent plus d'attention — jamais instantané, jamais interminable par défaut.
- **Accessibilité** : région `role="status" aria-live="polite"` annonçant l'apparition de chaque message aux lecteurs d'écran ; `prefers-reduced-motion` respecté (pas d'animation d'entrée/sortie si demandé) ; focus clavier visible sur la croix de fermeture (`Tab` l'atteint normalement).
- **Cohérence** : mêmes couleurs sémantiques que le reste de l'app (`alert-success`/`alert-danger`/`alert-warning`/`alert-info`, déjà utilisées par `BlocSauvegarde`/`ParametresView`) ; mêmes icônes Phosphor que celles déjà associées à ces états ailleurs dans l'app quand c'est pertinent (`PhCheckCircle` pour le succès, cohérent avec `IndicateurSauvegarde`).
- **Ne remplace pas** `IndicateurSauvegarde` : les deux messages ne se contredisent jamais (le toast ne parle jamais de « sauvegarde »).

## 9. Étapes d'implémentation

Découpage en **3 tâches**, chacune pour **un sous-agent** (`developpeur-vue`, `model: sonnet`, effort `medium`). Ordre imposé : **T1 → T2 → T3** (T2/T3 dispatchent vers le module créé en T1).

### Tâche 1 — Fondations : module `notifications` + garde de persistance + composant `PileNotifications`

**Fichiers** :
- `src/store/modules/notifications.js` (**créer**) — module namespaced volatile, state `{ items: [] }`, mutations `AJOUTER`/`RETIRER`, actions `notifier`/`retirer` (§4.1).
- `src/store/index.js` (**modifier**) — enregistrer le module `notifications` ; **étendre la garde du plugin de persistance** pour ignorer `notifications/*` (§4.2, **critique**).
- `src/components/communs/PileNotifications.vue` (**créer**) — pile de toasts empilés, fermables, accessible, réutilisant `alert`/`btn-close` Bootstrap (§6.1).
- `src/App.vue` (**modifier**) — monter `<PileNotifications />` dans le shell.

**Critères de sortie** :
- `store.dispatch('notifications/notifier', { type: 'succes', message: 'Test' })` ajoute un toast visible à l'écran (icône `PhCheckCircle` + texte + fond vert), qui **disparaît seul après ~4,5 s**.
- Émettre 3 toasts successifs (types différents) : ils s'**empilent verticalement avec un espacement net**, sans chevauchement.
- Cliquer la croix d'un toast le retire **immédiatement**, sans affecter les autres.
- **Aucune écriture de persistance déclenchée** : après un `dispatch('notifications/notifier', ...)`, `statutSauvegarde` ne bascule **pas** sur `EN_COURS` (vérifiable dans la console : le `commit('notifications/AJOUTER', ...)` ne doit produire aucun effet dans `persistancePlugin`).
- `prefers-reduced-motion: reduce` (simulé via les DevTools) supprime les transitions d'apparition/disparition.
- Focus clavier : `Tab` atteint la croix de fermeture de chaque toast visible ; `Entrée`/`Espace` la ferme.
- `npm run build` réussit.

### Tâche 2 — Instrumentation du module `personnes` (Équipe + Souhaits)

**Fichiers** :
- `src/store/modules/personnes.js` (**modifier**) — ajouter `dispatch` au contexte de chaque action concernée et le `dispatch('notifications/notifier', {...}, { root: true })` correspondant (§4.3) : `ajouter`, `modifier`, `desactiver`, `reactiver`, `ajouterPreference`, `modifierPreference`, `supprimerPreference`, `basculerPreference`.

**Dépend de** : T1 (module `notifications`).

**Critères de sortie** (parcours écran, `npm run dev`) :
- Sur `/equipe` : ajouter une personne → toast succès nommant la personne. Modifier → toast succès. Archiver → toast info. Restaurer (section « Personnes archivées ») → toast succès.
- Sur `/equipe/:id/souhaits` : ajouter un souhait → toast succès. Modifier → toast succès. Supprimer → toast info. Basculer « Pris en compte » → toast info dont le texte reflète l'état (mis en pause / repris en compte).
- Chaque message **nomme** la personne concernée (prénom + nom) ou évoque le souhait de la bonne personne.
- Aucune régression sur les écrans existants (listes, modales, confirmations inchangées) ; `npm run build` réussit.

### Tâche 3 — Instrumentation des modules `tournees` et `absences` (Tournées + Absences)

**Fichiers** :
- `src/store/modules/tournees.js` (**modifier**) — `dispatch('notifications/notifier', {...}, { root: true })` dans `ajouter`, `modifier`, `archiver`, `restaurer` (§4.3).
- `src/store/modules/absences.js` (**modifier**) — idem dans `ajouter`, `modifier`, `supprimer`, en résolvant le nom de la personne via `rootGetters['personnes/byId']` (§4.3).

**Dépend de** : T1 (module `notifications`).

**Critères de sortie** (parcours écran, `npm run dev`) :
- Sur `/tournees` : ajouter/modifier/archiver/restaurer une tournée déclenche le toast attendu, nommant la tournée (son `libelle`).
- Sur `/absences` : ajouter/modifier/supprimer une absence déclenche le toast attendu, nommant la personne concernée.
- Aucune régression ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] Un composant unique `PileNotifications`, monté dans `App.vue`, affiche les toasts sur **tous** les écrans.
- [ ] N'importe quelle action de store peut émettre un toast via `dispatch('notifications/notifier', { type, message })` — aucun couplage direct entre modules et composant d'affichage.
- [ ] Les toasts sont **empilables** (plusieurs coexistent, avec un espacement net) et **disparaissent automatiquement** après un délai qui dépend du type (succès/info ~4,5 s, avertissement ~6 s, erreur ~8 s).
- [ ] Chaque toast est **fermable manuellement** (croix, cible ≥ 44 px, `aria-label` explicite).
- [ ] **Équipe** (ajout/modification/archivage/restauration de personne, souhaits ajout/modification/suppression/mise en pause), **Tournées** (ajout/modification/archivage/restauration) et **Absences** (ajout/modification/suppression) déclenchent chacun un toast, **centralisé dans les actions de store** correspondantes (jamais dans un composant).
- [ ] Les messages sont en **français courant**, nomment la personne/tournée concernée, **zéro jargon**.
- [ ] Aucune information n'est portée par la **seule couleur** (icône + texte systématiques).
- [ ] Le module `notifications` est **volatile** : aucune mutation `notifications/*` ne déclenche d'écriture de persistance (`statutSauvegarde` inchangé) ; aucune mutation `REPLACE`, jamais hydraté par `bootstrap`/`REPLACE_ALL`.
- [ ] `prefers-reduced-motion: reduce` supprime les animations d'apparition/disparition.
- [ ] Aucune nouvelle dépendance npm ajoutée.
- [ ] `npm run build` réussit après chacune des 3 tâches.

## 11. Vérification

Parcours manuel (`npm run dev`) :

1. **Fondations** — Ouvrir la console, `window.store.dispatch('notifications/notifier', { type: 'succes', message: 'Test' })` : un toast vert apparaît en haut à droite, disparaît seul après ~4,5 s. Répéter avec `type: 'erreur'` : disparaît plus tard (~8 s), style rouge, icône différente. Émettre 3 toasts d'affilée : empilement propre, espacé.
2. **Fermeture manuelle** — Émettre un toast, cliquer sa croix avant la fin du délai : disparaît immédiatement, sans affecter un autre toast émis en parallèle.
3. **Équipe** — `/equipe` : ajouter une personne → toast (« … a été ajouté(e) à l'équipe. »). Modifier → toast. Archiver → toast. Restaurer → toast.
4. **Souhaits** — `/equipe/:id/souhaits` : ajouter/modifier/supprimer un souhait, basculer « Pris en compte » → toasts correspondants, nommant la personne.
5. **Tournées** — `/tournees` : ajouter/modifier/archiver/restaurer une tournée → toasts nommant la tournée.
6. **Absences** — `/absences` : ajouter/modifier/supprimer une absence → toasts nommant la personne concernée.
7. **Persistance** — Ouvrir l'onglet Application/Storage du navigateur, observer `localStorage['idelia:data']` : émettre plusieurs toasts sans effectuer d'autre action ne modifie **pas** ce contenu (aucune écriture parasite).
8. **Accessibilité** — Activer un lecteur d'écran (ou simuler `prefers-reduced-motion: reduce` dans les DevTools) : les toasts sont annoncés, les animations disparaissent en mode réduit ; `Tab` atteint chaque croix de fermeture visible.
9. **Build** — `npm run build` réussit.

## 12. Décisions à confirmer / risques

1. **Bus de messages = module Vuex `notifications` (retenu), pas d'event emitter dédié.** Le `dispatch` Vuex namespacé joue le rôle de bus : n'importe quel appelant émet vers un point d'entrée unique, sans import direct du composant d'affichage. **Alternative écartée** : un petit `EventEmitter`/`mitt` maison (`src/utils/busNotifications.js`) — introduirait un **second** mécanisme de communication transverse à côté de Vuex (déjà établi pour tout état partagé volatil via le module `ui`), moins cohérent, et nécessiterait quand même un état réactif quelque part pour que `PileNotifications` se mette à jour (donc pas réellement plus simple). **À confirmer**, mais fortement recommandé.
2. **`cabinet/majParametres` exclu de l'instrumentation automatique (à confirmer).** Le porteur a cité « Paramètres » dans la liste des écrans concernés, mais l'unique action CRUD de ce module (`majParametres`) est appelée **par champ** (`onJoursOuvertureChange`, `onReposHebdoMinChange`, etc. — un `dispatch` par case cochée/valeur modifiée), pas par un geste « Enregistrer » global. Y accrocher un toast produirait un **toast par frappe/case cochée**, très bruyant, et **redondant** avec `IndicateurSauvegarde` déjà présent en haut de l'écran (qui affiche déjà « Modifications enregistrées le … » en continu). **Recommandation** : ne pas instrumenter `majParametres`. **Alternative si le porteur insiste** : n'ajouter un toast que si `ParametresView` acquiert un jour un bouton « Enregistrer » global unique (hors périmètre actuel de l'écran, qui sauvegarde champ par champ par conception).
3. **Actions racines `exporter`/`importer`/`reinitialiser` différées à `0019` (à confirmer).** Ces actions vivent dans `src/store/index.js` (module racine) et alimentent à la fois `BlocSauvegarde.vue` (Paramètres) et `CarteSauvegarde.vue` (Accueil). `0019` doit **précisément** corriger la détection de succès réel de l'écriture fichier (bug G11 : la date se met à jour même en cas d'annulation) — ajouter dès `0018` un toast « Sauvegarde enregistrée » sur `exporter` referait la **même erreur** (annoncer un succès qu'on ne peut pas garantir avec un simple lien `<a download>`). **Le bon endroit pour ce toast est `0019`**, une fois la détection fiabilisée (au moins sur la branche File System Access API). Risque assumé : Paramètres reste sans toast de sauvegarde jusqu'à `0019`.
4. **Convention des 4 types et leurs durées (proposée, à confirmer/ajuster).** `succes`/`info` ~4,5 s, `avertissement` ~6 s, `erreur` ~8 s ; `duree: 0` réservé pour un futur toast **persistant** (fermeture manuelle uniquement), non utilisé par `0018` mais disponible pour `0019` (ex. échec d'une sauvegarde automatique). Durées ajustables sans impact structurel (une seule constante).
5. **Répartition succès/info par nature d'action (proposée, mineure, à confirmer).** Création/modification/restauration → `succes` (vert) ; archivage/suppression/mise en pause → `info` (bleu, neutre — ce sont des actions **voulues** par l'utilisateur, pas des échecs). Alternative : tout mettre en `succes`. Impact cosmétique uniquement.
6. **Position/empilement : haut-droit, nouveauté en bas de pile (mineure, à confirmer).** Choix par défaut sans enjeu fonctionnel ; à ajuster librement si le porteur préfère bas-droit ou l'ordre inverse.
7. **Portée « Planning » différée (à acter avec le porteur).** Aucune notification automatique sur `plannings.js` en `0018` (génération, verrouillage, glisser-déposer) — mécanisme réutilisable tel quel pour une itération ultérieure dédiée, une fois un calibrage spécifique défini (éviter le bruit pendant l'édition intensive du planning).
8. **Pas de plafond de toasts simultanés en `0018`.** Non nécessaire dans le périmètre actuel (actions ponctuelles, une à la fois en pratique) ; à envisager si un usage futur (ex. import en lot) en générait beaucoup d'un coup.
