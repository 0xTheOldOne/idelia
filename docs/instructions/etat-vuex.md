# Instructions — État (Vuex)

Référence : [architecture 04](../architecture/04-gestion-etat-vuex.md), [ADR 0003](../adr/0003-stack-vue-vite-optionsapi-vuex-router.md).

## Structure d'un module namespaced

```js
// src/store/modules/personnes.js
export default {
  namespaced: true,
  state: () => ({ items: [] }),
  getters: {
    actifs: (state) => state.items.filter((p) => p.actif),
    byId: (state) => (id) => state.items.find((p) => p.id === id)
  },
  actions: {
    ajouter({ commit }, personne) { commit('ADD', personne); },
    modifier({ commit }, personne) { commit('UPDATE', personne); },
    desactiver({ commit }, id) { commit('UPDATE', { id, actif: false }); }, // soft-delete
    // Hydratation depuis un SaveDocument
    remplacer({ commit }, items) { commit('REPLACE', items); }
  },
  mutations: {
    ADD(state, p) { state.items.push(p); },
    UPDATE(state, patch) { /* fusion immuable par id */ },
    REPLACE(state, items) { state.items = items; }
  }
};
```

## Règles

- **Un module par domaine** (`cabinet`, `personnes`, `tournees`, `absences`, `plannings`), tous **namespaced**. Plus `ui` (**non persisté**) et le module racine `app`.
- **Mutation `REPLACE`** obligatoire dans chaque module persisté : elle sert à l'hydratation atomique (`REPLACE_ALL`) au démarrage et à l'import ([architecture 03](../architecture/03-modele-de-donnees.md)).
- **La logique métier ne vit pas dans le store.** Les actions orchestrent ; les calculs métier (génération, validation, sérialisation) appartiennent à `src/domain/`. Exemple : `plannings/generer` appelle `genererPlanning(input)` puis commit le résultat.
- **Soft-delete** : désactiver (`actif=false` / `archivee=true`), ne pas supprimer physiquement une entité référencée ([architecture 02](../architecture/02-modele-de-domaine.md)).
- **Interdiction absolue** d'accéder à `localStorage` depuis un module : la persistance est gérée par le **plugin dédié** via `storageRepository` ([ADR 0005](../adr/0005-persistance-localstorage-derriere-repository.md)).
- **IDs** générés via `src/domain/utils/id.js` (`genId()`).
- **Immutabilité raisonnable** : privilégier des mises à jour claires ; ne pas muter des objets partagés hors mutation.

## Persistance & sérialisation

- Le **plugin de persistance** (dans `src/store/index.js`) s'abonne au store, sérialise via `toSaveDocument(state)` et appelle `storageRepository.save(doc)` de façon **débouncée**. Ne pas réimplémenter d'écriture ailleurs.
- L'export/import passe par les actions du module `app` (`exporter`, `importer`) et les fonctions `toSaveDocument`/`fromSaveDocument` de `src/domain/schema.js`.
