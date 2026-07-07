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
| `ui` (**non persisté**) | mode d'affichage, filtres, état drag&drop, panneaux | — | mutations UI |
| racine `app` | `schemaVersion`, statut de sauvegarde (ex. `derniereSauvegarde`) | — | `bootstrap`, `importer`, `exporter`, `reinitialiser` + mutation `REPLACE_ALL` |

Chaque module persisté expose une mutation `REPLACE(payload)` pour l'hydratation. `REPLACE_ALL` (module racine) appelle le `REPLACE` de chaque module → **hydratation atomique**.

## Persistance

- **Plugin de persistance maison** branché sur `store.subscribe((mutation, state) => …)`.
- À chaque mutation d'un module **persisté** (tout sauf `ui`), il sérialise l'état via `toSaveDocument(state)` et appelle `storageRepository.save(doc)`.
- L'écriture est **débouncée (~400 ms)** pour ne pas écrire à chaque frappe (synergie avec `vue-debounce` côté formulaires).
- **Règle non négociable** : le plugin écrit **toujours via `storageRepository`**, jamais `localStorage` en direct. C'est pourquoi on **n'utilise pas `vuex-persistedstate`** (qui taperait `localStorage` directement) — voir [ADR 0005](../adr/0005-persistance-localstorage-derriere-repository.md).

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

- **Données persistées** : `cabinet`, `personnes`, `tournees`, `absences`, `plannings`.
- **État volatile** (jamais persisté) : `ui` (sélection courante, filtres d'affichage, état du drag & drop, ouverture de panneaux).
- **Calculé, jamais stocké** : les diagnostics/conflits d'un planning (via getters s'appuyant sur le moteur, [05](05-moteur-de-planification.md)).
