# Feature 0026 — Date de génération visible

- **Statut** : En cours
- **Dépend de** : `0010` (génération : action `plannings/genererPropose`, fabrique `creerPlanning`, écran `/planning` → `PlanningView`). Transitivement : `0002` (`migrations.js`, `schema.js`, plugin de persistance), `0011` (régénération en place `plannings/regenerer`, snapshot d'annulation `CAPTURER_SNAPSHOT`/`RESTAURER_SNAPSHOT`, mutation `UPDATE_AFFECTATIONS`).
- **Consommée par** : `0012` (diffusion / impression — reprend la date sous le sous-titre « Planning du … au … »), `0028` (historique des versions). `0026` **n'implémente pas** `0012` : elle livre une donnée persistée et un helper de domaine directement exploitables par la vue imprimable.
- **ADR liés** : [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (horodatage technique ISO UTC via `toISOString()` ; aucun objet `Date` hors `dateUtil`), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (persistance via store + plugin, migration de schéma), [0006](../docs/adr/0006-sauvegarde-partage-par-export-import-json.md) (le champ voyage dans l'export/import, vieux fichiers migrés), [0007](../docs/adr/0007-generation-planning-hybride.md) (génération vs ajustement manuel), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (le moteur n'est **pas** touché), [0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md) (diffusion, `publieLe` distinct), [0004](../docs/adr/0004-pas-de-typescript-js-jsdoc.md) (JS + JSDoc), [0013](../docs/adr/0013-icones-phosphor.md) (icône Phosphor).

## 1. Contexte & objectif

Le planning papier du cabinet porte en en-tête une mention « **Mise à jour 15/06/2026** » : quand plusieurs tirages circulent, chacun sait lequel est le plus récent. Idelia ne mémorise aujourd'hui que des horodatages techniques (`createdAt`, `updatedAt`, `publieLe`) dont aucun ne dit « quand cette proposition a été calculée ».

`0026` ajoute au `Planning` un horodatage **`genereLe`** (ISO UTC), posé **à chaque génération** (nouveau planning) **et à chaque régénération** (« Regénérer à l'identique » / « Essayer une variante »), puis l'**affiche dans l'éditeur** sous le titre du planning (« Généré le 15/06/2026 »). Si le planning a été retouché à la main après cette génération, une mention complémentaire honnête l'indique (« modifié à la main le 20/06/2026 »). La donnée est prête à être reprise telle quelle par la vue imprimable (`0012`).

**Hors périmètre** :

- La vue diffusée / imprimée et son en-tête → `0012` (qui consommera `infoGeneration`, §5.2).
- L'historique des versions → `0028`.
- Toute modification du moteur `src/domain/scheduling/` (le moteur reste ignorant de `genereLe`).
- Le tableau de bord `0013` : **non modifié** (voir §6.3 et §12 #4).

## 2. Écrans concernés

Un seul écran modifié : **`/planning`** → `PlanningView.vue` ([architecture 07](../docs/architecture/07-navigation-et-ecrans.md)). Aucune nouvelle route.

Expérience visée pour une personne non-technique :

- Juste sous le titre du planning (« Planning du 13/07/2026 au 19/07/2026 »), une **ligne discrète** avec une petite icône horloge : **« Généré le 15/06/2026 »**. Elle est visible en lecture comme en mode modification.
- Après « Regénérer à l'identique » ou « Essayer une variante », la date se met **immédiatement** à jour (aujourd'hui).
- Après un ajustement à la main (ajout, retrait, déplacement, verrouillage), la date de génération **ne change pas** ; la ligne se complète : **« Généré le 15/06/2026 · modifié à la main le 20/06/2026 »**. L'utilisateur comprend sans jargon que la proposition d'origine a été retouchée.
- « Annuler la dernière action » remet aussi la ligne dans l'état d'avant (une régénération annulée retrouve son ancienne date ; un ajustement annulé fait disparaître la mention « modifié à la main » s'il était le seul).
- Pour un planning créé **avant** cette version d'Idelia (date inconnue), **rien n'est affiché** : pas de message technique, pas de date inventée. La ligne apparaîtra à la prochaine régénération ou pour tout nouveau planning.

## 3. Modèle de données touché

### 3.1 Nouveau champ `Planning.genereLe`

| champ | type | oblig. | notes |
|---|---|---|---|
| genereLe | ISO UTC \| null | oui (`null` possible) | Horodatage de la **dernière génération ou régénération** par le moteur. `null` = inconnu (planning antérieur à `0026`). Posé **uniquement** par `genererPropose` et `regenerer` ; **jamais** par un geste manuel. |

Constat d'existant (vérifié dans le code) : **aucun** champ équivalent n'existe. `Planning` porte `createdAt` / `updatedAt` (techniques, `updatedAt` bumpé par **tout** geste, y compris manuel, dans `UPDATE_AFFECTATIONS` et `RESTAURER_SNAPSHOT` de `src/store/modules/plannings.js`) et `publieLe` (diffusion, `0012`, toujours `null` aujourd'hui). Le nommage `genereLe` suit la convention existante des horodatages d'événement métier (`publieLe`, `demandeLe`, `decideLe`).

`genereLe` ≠ `publieLe` : on peut régénérer plusieurs fois avant de diffuser ; `0012` posera `publieLe` au moment de la diffusion.

### 3.2 Invariant d'égalité (clé du « modifié à la main »)

À chaque génération/régénération, **`genereLe` et `updatedAt` reçoivent exactement la même valeur** (une seule chaîne `toISOString()` calculée une fois). Conséquence : `updatedAt > genereLe` (comparaison de chaînes, valide car `toISOString()` produit un format de largeur fixe `YYYY-MM-DDTHH:mm:ss.sssZ`) **si et seulement si** un geste a modifié le planning après sa génération. Aucun compteur ni drapeau supplémentaire n'est nécessaire (KISS).

> **Piège à éviter** : calculer `genereLe` et `updatedAt` par deux appels distincts à `new Date().toISOString()` (quelques ms d'écart ⇒ « modifié à la main » affiché à tort juste après une génération). Voir §4 pour la mise en œuvre.

### 3.3 Migration de schéma v2 → v3

Ajout de champ ⇒ **bump de `schemaVersion`** (règle de [03](../docs/architecture/03-modele-de-donnees.md) §Versionnement) : `CURRENT_SCHEMA_VERSION` passe de **2 à 3**, avec `MIGRATIONS[2]` :

- chaque `Planning` de `doc.plannings` reçoit `genereLe: planning.genereLe ?? null` (idempotent, aucun autre champ touché) ;
- `personnes`, `tournees`, `absences`, `cabinet` : inchangés.

**Pas de rétro-remplissage** depuis `createdAt` (choix d'honnêteté : un planning régénéré depuis sa création afficherait une date fausse ; voir §12 #2). La migration est appliquée au chargement (`storageRepository.load()`) **et** à l'import d'un ancien fichier (`0008`), via `migrate()` — rien à ajouter côté appelants.

> **Coordination** : `0020`, `0023`, `0029`, `0030` prévoient aussi une migration. Le numéro de version est **séquentiel** : si une autre feature a déjà livré la v3 au moment de l'implémentation, prendre la version libre suivante (`MIGRATIONS[n]` avec `n = CURRENT_SCHEMA_VERSION` courant) — la logique de migration est indépendante.

### 3.4 `schema.js`

**Aucune modification** : `toSaveDocument` sérialise `plannings.items` tel quel (le champ suit automatiquement), `fromSaveDocument` les recopie tels quels, `verifierIntegrite` ne contrôle que les références (`genereLe` n'est pas une référence ; pas de contrôle de format, tolérance volontaire).

## 4. Store (Vuex)

Toutes les modifications sont dans **`src/store/modules/plannings.js`**. Aucun nouveau module, aucun nouveau getter, aucun accès `localStorage`.

### 4.1 `genererPropose` (génération d'un nouveau planning)

Calculer **une seule fois** l'horodatage et le passer à la fabrique pour `createdAt`, `updatedAt` **et** `genereLe` :

```js
const maintenant = new Date().toISOString();
const planning = creerPlanning({
  nom: …, dateDebut, dateFin,
  affectations: resultat.affectations,
  parametresGeneration: resultat.meta,
  createdAt: maintenant,
  updatedAt: maintenant,
  genereLe: maintenant,
});
```

(Nécessite que `creerPlanning` accepte `updatedAt` en entrée — §5.1.)

### 4.2 `UPDATE_AFFECTATIONS` — accepte un `genereLe` optionnel

Signature étendue : `UPDATE_AFFECTATIONS(state, { id, affectations, parametresGeneration, genereLe })`.

- Si `genereLe` est **fourni** (régénération uniquement) : `updatedAt = genereLe` **et** `genereLe = genereLe` (invariant §3.2).
- Sinon (gestes manuels, inchangés) : `updatedAt = new Date().toISOString()`, `genereLe` **non touché**.

```js
UPDATE_AFFECTATIONS(state, { id, affectations, parametresGeneration, genereLe }) {
  const horodatage = genereLe ?? new Date().toISOString();
  state.items = state.items.map((pl) =>
    pl.id === id
      ? {
          ...pl,
          affectations,
          updatedAt: horodatage,
          ...(parametresGeneration !== undefined ? { parametresGeneration } : {}),
          ...(genereLe !== undefined ? { genereLe } : {}),
        }
      : pl
  );
}
```

### 4.3 `regenerer` — pose `genereLe`

Juste avant le `commit('UPDATE_AFFECTATIONS', …)` existant : `const maintenant = new Date().toISOString();` puis ajouter `genereLe: maintenant` au payload. Valable pour les deux modes (`variante: false` « à l'identique » **et** `variante: true` « variante ») : dans les deux cas le moteur a recalculé la proposition.

Les actions manuelles (`ajouterAffectation`, `retirerAffectation`, `deplacerAffectation`, `basculerVerrouillage`) **ne passent pas** `genereLe` : leur comportement de persistance est inchangé.

### 4.4 Snapshot d'annulation : capturer et restaurer l'état de génération

Aujourd'hui, `CAPTURER_SNAPSHOT` ne mémorise que les affectations ; annuler une régénération laisserait donc `genereLe` (et `parametresGeneration`) sur les valeurs de la régénération annulée — **date fausse affichée**. Correction :

- **`CAPTURER_SNAPSHOT(state, planning)`** reçoit désormais **le planning courant** (au lieu de `{ planningId, affectations }`) et mémorise :
  ```js
  state.snapshotEdition = {
    planningId: planning.id,
    affectations: [...planning.affectations],
    genereLe: planning.genereLe ?? null,
    parametresGeneration: planning.parametresGeneration ?? null,
    updatedAt: planning.updatedAt,
  };
  ```
  Les **5 appels** existants deviennent `commit('CAPTURER_SNAPSHOT', courant)` (ou `planning` dans `regenerer`). `peutAnnuler` est inchangé (`snapshotEdition.planningId`).
- **`RESTAURER_SNAPSHOT(state)`** restaure **l'état d'avant le geste** au complet :
  ```js
  { ...pl, affectations: snap.affectations, genereLe: snap.genereLe,
    parametresGeneration: snap.parametresGeneration, updatedAt: snap.updatedAt }
  ```
  Restaurer `updatedAt` (au lieu de le re-horodater) préserve l'invariant §3.2 : annuler l'unique ajustement fait après une génération fait disparaître la mention « modifié à la main ». Aucun code ne s'appuie sur le bump d'`updatedAt` à l'annulation (vérifié : le plugin de persistance réagit aux **mutations**, pas aux valeurs ; seul effet de bord, voulu : la liste « Plannings récents » de `0013`, triée par `updatedAt`, reflète l'état restauré). Le snapshot reste **volatil**, jamais sérialisé (inchangé).

> Restaurer aussi `parametresGeneration` corrige au passage un défaut latent de `0011` : après avoir annulé une variante, « Regénérer à l'identique » reproduisait la variante annulée (graine non restaurée). Même lignes de code, coût nul — voir §12 #5.

## 5. Domaine (logique pure)

### 5.1 `src/domain/planning.js`

- **Typedef `Planning`** : ajouter `@property {(string|null)} genereLe - Horodatage ISO UTC de la dernière génération/régénération par le moteur ; null si inconnu (planning antérieur à 0026).`
- **`creerPlanning(champs)`** :
  - ajouter `genereLe: champs.genereLe ?? null` ;
  - remplacer `updatedAt: maintenant` par `updatedAt: champs.updatedAt ?? maintenant` (même patron que `createdAt`, rétro-compatible : seul appelant = `genererPropose`).
- **Nouvelle fonction pure `infoGeneration(planning)`** — point d'entrée **unique** réutilisé par l'éditeur (`0026`) et la vue imprimable (`0012`) :

```js
/**
 * @typedef {Object} InfoGeneration
 * @property {string} genereLe - Horodatage ISO UTC brut (pour l'attribut `datetime`).
 * @property {string} dateTexte - Date locale « JJ/MM/AAAA » de la génération.
 * @property {boolean} modifieDepuis - `true` si le planning a été modifié après sa génération (`updatedAt > genereLe`).
 * @property {string} dateModificationTexte - Date locale « JJ/MM/AAAA » de la dernière modification, '' si `modifieDepuis` est faux.
 */

/**
 * @param {Planning|null|undefined} planning
 * @returns {InfoGeneration|null} `null` si le planning est absent ou si `genereLe` est inconnu.
 */
export function infoGeneration(planning) { … }
```

Règles : `null` si `!planning?.genereLe` ; `modifieDepuis = !!planning.updatedAt && planning.updatedAt > planning.genereLe` (comparaison de chaînes ISO, aucun objet `Date`) ; les deux textes via `dateUtil.formatHorodatageDateFr` (§5.2). La fonction **ne construit pas de phrase** : chaque écran choisit sa formulation (« Généré le … » dans l'éditeur, « Mise à jour du … » à l'impression `0012`).

### 5.2 `src/domain/utils/dates.js` — nouveau formateur

```js
/**
 * Formate un horodatage technique ISO UTC en date **locale** courte FR « JJ/MM/AAAA ».
 * @param {string} iso
 * @returns {string} '' si `iso` est vide/absent.
 */
function formatHorodatageDateFr(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
```

À exporter dans `dateUtil`. **Ne jamais** découper la chaîne ISO (`iso.slice(0, 10)`) ni utiliser `formatDateFr` (réservé aux dates calendaires `"YYYY-MM-DD"`) : la partie date d'un ISO UTC est la date **UTC** — une génération à 00:30 heure de Paris (22:30 UTC la veille) afficherait la veille. Conversion locale obligatoire, centralisée ici (seul module autorisé à manipuler `Date`, ADR 0010).

### 5.3 `src/storage/migrations.js`

`CURRENT_SCHEMA_VERSION = 3` et `MIGRATIONS[2]` documentée en JSDoc (même style que `MIGRATIONS[1]`) :

```js
MIGRATIONS[2] = (doc) => {
  const plannings = Array.isArray(doc.plannings)
    ? doc.plannings.map((planning) => ({ ...planning, genereLe: planning.genereLe ?? null }))
    : doc.plannings;
  return { ...doc, plannings };
};
```

## 6. Composants

### 6.1 `src/views/PlanningView.vue` (modifier)

- Importer `infoGeneration` depuis `@/domain/planning.js` et l'icône `PhClockCounterClockwise` depuis `@phosphor-icons/vue`.
- Computed `infoGenerationCourante()` → `infoGeneration(this.planningCourant)` (réactif : se met à jour seul après génération, régénération, geste manuel ou annulation — aucune méthode à appeler).
- Template, **dans `.planning-resultat`, juste après `.planning-resultat-entete`** (sous le titre et le badge « Mode modification », avant la barre d'actions) :

```html
<p v-if="infoGenerationCourante" class="planning-date-generation">
  <PhClockCounterClockwise :size="16" aria-hidden="true" />
  <span>
    Généré le
    <time :datetime="infoGenerationCourante.genereLe">{{ infoGenerationCourante.dateTexte }}</time>
    <template v-if="infoGenerationCourante.modifieDepuis">
      · modifié à la main le {{ infoGenerationCourante.dateModificationTexte }}
    </template>
  </span>
</p>
```

- Style scoped `.planning-date-generation` : `display: inline-flex` / `align-items: center` / `gap: t.$espace-1`, `color: t.$couleur-texte-attenue`, `font-size: t.$taille-texte-petite`, marge basse `t.$espace-3` ; réduire la marge basse de `.planning-resultat-entete` si l'espacement titre → date paraît trop large (ajustement visuel, tokens uniquement, aucune valeur en dur).
- **Aucune** logique de date dans le composant (tout vient de `infoGeneration`). Pas de nouvelle annonce `aria-live` : les messages existants « Planning généré… » / « Planning regénéré… » suffisent ; la ligne est un texte statique lisible au lecteur d'écran dans le flux.
- Mettre à jour le bloc JSDoc d'en-tête du composant (mention feature `0026`).

### 6.2 Réutilisation

- `dateUtil` (`src/domain/utils/dates.js`) — étendu, pas dupliqué.
- Patron d'affichage discret déjà utilisé : `.plannings-recents-meta` (`ListePlanningsRecents.vue`) — icône + texte atténué en petite taille.
- Tokens SCSS existants (`_tokens.scss`) — aucun nouveau token.

### 6.3 Tableau de bord `0013` — non modifié (KISS)

`ListePlanningsRecents.vue` affiche déjà **une seule méta par entrée**, choisie par priorité (points à résoudre > souhaits non tenus > diffusé > « Modifié le … »). Y ajouter la date de génération encombrerait une liste volontairement sobre pour une information déjà approchée par « Modifié le … ». Décision proposée : ne pas y toucher (voir §12 #4).

## 7. Règles de validation

Sans objet : aucune saisie utilisateur. La date est posée exclusivement par le store.

## 8. Points d'attention ergonomie

- **Langage clair** : « Généré le » (ce que la personne a fait : cliquer sur « Générer ») et « modifié à la main » (ses propres retouches). Pas de « horodatage », « seed », « variante n° ».
- **Date seule, format papier** `JJ/MM/AAAA` : c'est le repère que l'équipe connaît (« Mise à jour 15/06/2026 »). L'heure n'est pas affichée (bruit inutile) ; elle reste disponible dans l'attribut `datetime` de `<time>`.
- **Discrétion** : texte atténué, petite taille, sous le titre — ne concurrence ni le titre ni la barre d'actions. Contraste : `$couleur-texte-attenue` sur fond clair doit rester ≥ 4,5:1 (déjà le cas pour les métas existantes — à vérifier par `ui-ux`).
- **L'icône n'est jamais porteuse de sens seule** : toujours accompagnée du texte, `aria-hidden="true"`.
- **Honnêteté** : jamais de date inventée (planning ancien ⇒ rien d'affiché) ; la mention « modifié à la main » évite qu'un tirage retouché passe pour la proposition d'origine.
- **Réversibilité cohérente** : « Annuler la dernière action » remet aussi la date dans l'état d'avant — ce que l'utilisateur voit correspond toujours au contenu de la grille.

## 9. Étapes d'implémentation

Découpage en **3 tâches**, chacune pour **un sous-agent `dev-front`**. Ordre imposé : **T1 → T2 → T3** (T2 utilise la fabrique/le helper de T1, T3 le helper de T1 et le champ posé par T2).

### Tâche 1 — Modèle, migration v3 et utilitaires de domaine

**Fichiers** :
- `src/storage/migrations.js` (**modifier**) — `CURRENT_SCHEMA_VERSION = 3` ; `MIGRATIONS[2]` (§5.3) avec JSDoc. *(Si une autre feature a déjà pris la v3 : version libre suivante, §3.3.)*
- `src/domain/planning.js` (**modifier**) — typedef `genereLe` ; `creerPlanning` : `genereLe: champs.genereLe ?? null`, `updatedAt: champs.updatedAt ?? maintenant` ; nouvelle fonction exportée `infoGeneration` + typedef `InfoGeneration` (§5.1).
- `src/domain/utils/dates.js` (**modifier**) — `formatHorodatageDateFr` + export dans `dateUtil` (§5.2).
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — table **Planning** : ligne `genereLe` (§3.1).
- `docs/architecture/03-modele-de-donnees.md` (**modifier**) — `schemaVersion` 3 dans la structure racine et l'exemple, `genereLe` dans l'exemple de planning, `CURRENT_SCHEMA_VERSION (= 3)`, paragraphe **`MIGRATIONS[2]` (v2 → v3)** sur le modèle du paragraphe `MIGRATIONS[1]`.

**Critères de sortie** :
- `npm run build` réussit.
- Au rechargement de l'app avec des données existantes (v2 dans `localStorage`), aucune erreur ; après un geste quelconque persistant, `localStorage` montre `"schemaVersion": 3` et chaque planning porte `"genereLe": null`.
- En console : `infoGeneration({ genereLe: null })` → `null` ; avec `genereLe === updatedAt` → `modifieDepuis: false` ; avec `updatedAt` postérieur → `modifieDepuis: true` et `dateModificationTexte` renseigné.
- `dateUtil.formatHorodatageDateFr('2026-06-14T22:30:00.000Z')` → `"15/06/2026"` sur un poste en heure de Paris (date **locale**, pas UTC).

### Tâche 2 — Store : poser `genereLe` et fiabiliser l'annulation

**Fichiers** :
- `src/store/modules/plannings.js` (**modifier**) — `genererPropose` (§4.1) ; `UPDATE_AFFECTATIONS` avec `genereLe` optionnel (§4.2) ; `regenerer` (§4.3) ; `CAPTURER_SNAPSHOT(state, planning)` + adaptation des **5** appels + `RESTAURER_SNAPSHOT` complet (§4.4) ; mise à jour des JSDoc (en-tête du module : mention `0026`).

**Dépend de** : T1.

**Critères de sortie** (console / onglet Application du navigateur, `npm run dev`) :
- Générer un planning : il porte `genereLe` **strictement égal** à `updatedAt` et `createdAt`.
- Ajouter / retirer / déplacer / verrouiller une affectation : `genereLe` inchangé, `updatedAt` > `genereLe`.
- « Regénérer à l'identique » puis « Essayer une variante » : `genereLe` mis à jour à chaque fois, égal à `updatedAt`.
- Régénérer puis « Annuler la dernière action » : `genereLe`, `parametresGeneration` et `updatedAt` reviennent **exactement** aux valeurs d'avant.
- Générer → un ajustement → annuler : `updatedAt === genereLe` à nouveau.
- Le bouton « Annuler » garde son comportement (`peutAnnuler`) ; `npm run build` réussit.

### Tâche 3 — Affichage dans l'éditeur

**Fichiers** :
- `src/views/PlanningView.vue` (**modifier**) — import `infoGeneration` + `PhClockCounterClockwise`, computed `infoGenerationCourante`, ligne `.planning-date-generation` sous l'en-tête, style scoped par tokens, JSDoc d'en-tête (§6.1).

**Dépend de** : T1, T2.

**Critères de sortie** : parcours §11 étapes 2 à 7 ; `npm run build` réussit.

## 10. Critères d'acceptation

- [ ] Générer un nouveau planning affiche, sous son titre, « Généré le JJ/MM/AAAA » à la date du jour.
- [ ] « Regénérer à l'identique » et « Essayer une variante » mettent la date à jour (date du jour) et effacent la mention « modifié à la main ».
- [ ] Un ajustement manuel (ajout, retrait, glisser-déposer, verrouillage) ne change **pas** la date de génération et fait apparaître « · modifié à la main le JJ/MM/AAAA ».
- [ ] « Annuler la dernière action » après une régénération rétablit l'ancienne date de génération ; après l'unique ajustement manuel, fait disparaître la mention « modifié à la main ».
- [ ] Un planning existant avant la mise à jour (sans date connue) s'ouvre sans erreur et **sans** ligne de date ; la ligne apparaît après une régénération.
- [ ] La date affichée est la date **locale** (une génération juste après minuit affiche bien le jour courant).
- [ ] Après rechargement de la page, la date (et la mention éventuelle) est toujours affichée à l'identique (persistée).
- [ ] Export puis import d'une sauvegarde : la date est conservée. Import d'un ancien fichier (v2) : accepté, plannings sans ligne de date.
- [ ] La ligne est visible en lecture comme en mode modification ; texte + icône (jamais l'icône seule).
- [ ] Le tableau de bord est inchangé ; aucune nouvelle dépendance npm ; `npm run build` réussit.

## 11. Vérification

Parcours manuel (`npm run dev`) :

1. **Migration** — Avec des données existantes, ouvrir l'app : pas d'erreur. Onglet Application → `localStorage` (clé Idelia) : après un geste, `schemaVersion: 3` et `genereLe: null` sur les anciens plannings. Ouvrir un ancien planning sur `/planning` : aucune ligne de date.
2. **Génération** — Générer un planning : « Généré le <aujourd'hui> » sous le titre, sans mention « modifié à la main ».
3. **Ajustement manuel** — Mode modification, ajouter une personne puis en glisser une autre : la date ne bouge pas, « · modifié à la main le <aujourd'hui> » apparaît.
4. **Annulation d'un ajustement** — Générer un nouveau planning, faire **un seul** ajustement, cliquer « Annuler la dernière action » : la mention disparaît.
5. **Régénération** — « Essayer une variante » : la date est celle d'aujourd'hui, la mention disparaît. « Annuler la dernière action » : la date et la mention d'avant reviennent ; puis « Regénérer à l'identique » reproduit bien la répartition d'avant la variante (graine restaurée).
6. **Ancien planning** — Sur un planning migré (`genereLe: null`), « Regénérer à l'identique » : la ligne apparaît.
7. **Persistance & sauvegarde** — Recharger la page : ligne identique. Exporter, réinitialiser/importer : ligne identique. Importer un ancien fichier v2 : accepté.
8. **Fuseau** — (facultatif) DevTools → Sensors → fuseau `Europe/Paris`, appeler en console `dateUtil.formatHorodatageDateFr('2026-06-14T22:30:00.000Z')` → `15/06/2026`.
9. **Accessibilité** — Lecteur d'écran : la ligne est lue dans le flux (« Généré le 15/06/2026 ») ; l'icône est ignorée.
10. **Build** — `npm run build` réussit.

## 12. Décisions à confirmer / risques

> **Validé par le porteur (2026-10-07)** : recommandations retenues telles quelles — (1) `0012` imprimera « Mise à jour du <date la plus récente> » ; (2)/(3) pas de rétro-remplissage, rien d'affiché pour un planning sans `genereLe` ; (5) restauration complète à l'annulation, correctif de la graine inclus dans 0026.

1. **Seules la génération et la régénération posent `genereLe` (retenu, conforme à la roadmap).** Un geste manuel ne la change pas : `genereLe` date la **proposition du moteur**, ce qui reste stable et vérifiable. **Piège identifié** : si seule cette date était imprimée (`0012`), deux tirages au contenu différent (avant/après un glisser-déposer le même jour ou plus tard) porteraient la **même** « Mise à jour » — l'équipe ne saurait pas lequel est le bon. **Parade retenue** : la mention « modifié à la main le … » (dérivée de `updatedAt`, zéro donnée nouvelle), exposée par `infoGeneration` pour que `0012` puisse la reprendre. **À trancher dans `0012`** : imprimer « Mise à jour du <genereLe> » seul, ou la date la plus récente des deux (recommandé : « Mise à jour du <date la plus récente> », puisque c'est ce que signifie « mise à jour » sur le papier). C'est aussi pourquoi l'éditeur dit « Généré le » et non « Mis à jour le » : le libellé reste exact quoi qu'il arrive ensuite.
2. **Pas de rétro-remplissage des anciens plannings (retenu).** `genereLe: null` + aucun affichage. **Alternative** : remplir avec `createdAt` (toujours une vraie date de génération, puisque tout planning vient de `genererPropose`), mais **fausse** si le planning a été régénéré depuis. Inconvénient du choix retenu : pour faire apparaître la date sur un ancien planning, il faut le régénérer (les affectations non verrouillées sont alors remplacées — la confirmation existante de `0011` protège les ajustements manuels). Impact faible en phase de test (plannings anciens = plannings d'essai). À confirmer.
3. **Planning ancien : rien d'affiché (retenu)** plutôt qu'un texte « Date de génération inconnue ». Un message d'absence n'apporte rien d'actionnable à une personne non-technique. Si le porteur préfère l'explicite, une seule ligne de template à ajouter (`v-else`).
4. **Tableau de bord `0013` non modifié (retenu, KISS).** La liste « Plannings récents » affiche une méta unique par priorité ; « Modifié le … » y joue déjà ce rôle. À rouvrir seulement si la testeuse le demande.
5. **Annulation : restauration complète (`genereLe`, `parametresGeneration`, `updatedAt`).** Changement de comportement **mineur** de `0011` : après « Annuler », `updatedAt` revient à sa valeur d'avant au lieu d'être re-horodaté (donc « Modifié le … » et le tri des « Plannings récents » reflètent l'état restauré). Corrige au passage un défaut latent : la graine (`parametresGeneration`) n'était pas restaurée, si bien que « Regénérer à l'identique » après l'annulation d'une variante reproduisait la variante annulée. Si le porteur souhaite isoler ce correctif, retirer `parametresGeneration` du snapshot (le reste de la feature fonctionne sans).
6. **Numéro de version de schéma** : v3 pris par `0026` au moment de la rédaction ; collision possible avec `0020`/`0023`/`0029`/`0030` si elles atterrissent avant — prendre la version libre suivante (§3.3), sans autre impact.
7. **Granularité « modifié à la main »** : basée sur `updatedAt` du planning, donc **tout** geste compte (y compris un simple verrouillage, qui ne change pas la répartition). Acceptable : verrouiller est une décision humaine sur le planning. Pas d'ADR nécessaire.
8. **Aucun écart d'ADR** identifié : horodatage ISO UTC (ADR 0010), conversion locale centralisée dans `dateUtil`, persistance via store + plugin + migration (ADR 0005), moteur intact (ADR 0008).
