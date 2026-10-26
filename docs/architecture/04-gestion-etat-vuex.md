# 04 — Gestion de l'état (Vuex)

Le store Vuex ([ADR 0003](../adr/0003-stack-vue-vite-optionsapi-vuex-router.md)) centralise l'état applicatif. Il est **namespaced** par domaine. La logique métier n'est **pas** dans le store : elle est dans `src/domain/` ; le store orchestre et conserve l'état.

## Modules

| module | state principal | getters clés | actions / mutations clés |
|---|---|---|---|
| `cabinet` | objet singleton | `parametres` | `majParametres` · `SET_CABINET` · `REPLACE` |
| `personnes` | `{ items: [] }` | `actifs`, `byId`, `parStatut` | CRUD personne + `ADD/UPDATE/REMOVE_PREFERENCE` · `REPLACE` |
| `tournees` | `{ items: [] }` | `actives`, `applicablesLe(date)` | CRUD, `archiver` · `REPLACE` |
| `absences` | `{ items: [] }` | `parPersonne`, `validesSur(periode)`, `enConflit(affectation)` | CRUD, `changerStatut` · `REPLACE` |
| `plannings` | `{ items: [], selectionId }` | `courant`, `affectationsDe(id)`, `besoinsNonCouverts`, `conflits` | CRUD planning + CRUD affectation, `generer`, `verrouiller` · `REPLACE` |
| `vacancesScolaires` | `{ entrees: [] }` (cache par zone et année scolaire) | `entrees`, `zoneCourante`, `periodesZoneCourante`, `entreesZoneCourante` | `assurerCouverture`, `mettreAJour`, `changerZone` · `ENREGISTRER`, `GARDER_ZONE`, `REPLACE` |
| `contrats` | `{ modeles: [], documents: [] }` (`documents` réservé à 0042) | `modeleById`, `modelesActifs`, `modelesArchives`, `documents` | `assurerModelesDeDepart`, `creerModele`, `enregistrerModele`, `renommerModele`, `dupliquerModele`, `archiverModele`, `restaurerModele` · `REPLACE`, `ADD_MODELE`, `UPDATE_MODELE` |
| `ui` (**non persisté**) | mode d'affichage, filtres, état drag&drop, panneaux | — | mutations UI |
| racine `app` | `schemaVersion`, statut de sauvegarde (ex. `derniereSauvegarde`) | — | `bootstrap`, `importer`, `exporter`, `reinitialiser` + mutation `REPLACE_ALL` |

Chaque module persisté expose une mutation `REPLACE(payload)` pour l'hydratation. `REPLACE_ALL` (module racine) appelle le `REPLACE` de chaque module → **hydratation atomique**.

## Persistance

- **Plugin de persistance maison** branché sur `store.subscribe((mutation, state) => …)`.
- À chaque mutation d'un module **persisté** (tout sauf `ui`), il sérialise l'état via `toSaveDocument(state)` et appelle `storageRepository.save(doc)`.
- L'écriture est **débouncée (~400 ms)** pour ne pas écrire à chaque frappe (synergie avec `vue-debounce` côté formulaires).
- **Règle non négociable** : le plugin écrit **toujours via `storageRepository`**, jamais `localStorage` en direct. C'est pourquoi on **n'utilise pas `vuex-persistedstate`** (qui taperait `localStorage` directement) — voir [ADR 0005](../adr/0005-persistance-localstorage-derriere-repository.md).

- Le **handle du fichier de sauvegarde actif** (feature 0032) n'est pas dans le `SaveDocument` : il est stocké dans IndexedDB, uniquement via `storageRepository` ([ADR 0021](../adr/0021-indexeddb-handle-fichier-sauvegarde.md)) ; le store n'en garde que des reflets volatils dans `ui`.

## Cycle de vie

**Démarrage** — action `app/bootstrap` :
```
doc = await storageRepository.load()
si doc: doc = migrate(doc); verifierIntegrite(doc); commit REPLACE_ALL(fromSaveDocument(doc))
sinon:  commit REPLACE_ALL(etatParDefaut())   // cabinet par défaut, collections vides
```

**Import** — action `app/importer(fichier)` :
```
doc = JSON.parse(contenu)
refuser si doc.schemaVersion > CURRENT_SCHEMA_VERSION
doc = migrate(doc); verifierIntegrite(doc)
commit REPLACE_ALL(fromSaveDocument(doc))
flush immédiat de la persistance
```

**Export** — action `app/exporter` : `toSaveDocument(state)` → `Blob` JSON → téléchargement.

**Réinitialisation** — action `app/reinitialiser` : confirmation utilisateur → `REPLACE_ALL(etatParDefaut())` → `storageRepository.clear()`.

## Où va quoi

- **Données persistées** : `cabinet`, `personnes`, `tournees`, `absences`, `plannings`, `vacancesScolaires` (cache), `contrats` (modèles ; l'état d'édition d'un modèle reste volatil, dans la vue).
- **État volatile** (jamais persisté) : `ui` (sélection courante, filtres d'affichage, état du drag & drop, ouverture de panneaux).
- **Calculé, jamais stocké** : les diagnostics/conflits d'un planning (via getters s'appuyant sur le moteur, [05](05-moteur-de-planification.md)).

## Module `vacancesScolaires` (feature 0023)

Cache des vacances scolaires de la zone choisie (`cabinet.parametres.zoneScolaire`), persisté dans le SaveDocument. Les actions **ne rejettent jamais** : elles renvoient `{ ok, etat: 'SANS_ZONE'|'A_JOUR'|'MIS_A_JOUR'|'ECHEC', message }`.

- `assurerCouverture({ dateDebut, dateFin, silencieux, forcer })` : récupère les années scolaires manquantes pour la période (requêtes dédoublonnées). Un échec n'est pas retenté dans la session sauf `forcer` ; un seul toast d'avertissement par session (sauf `silencieux`).
- `mettreAJour()` : redemande les années en cache et l'année en cours (bouton des Paramètres).
- `changerZone(code)` : enregistre la zone via `cabinet/majParametres`, purge les autres zones (`GARDER_ZONE`), puis met à jour. Sans zone : cache vidé, aucune requête.
- Le réseau passe par l'adaptateur `recupererCalendrierScolaire`, la logique de dates par `src/domain/calendrier/` ; échecs de session et requêtes en cours sont des variables de module, **jamais persistées**.
