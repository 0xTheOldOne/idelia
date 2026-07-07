# Instructions — Composants Vue (Options API)

Référence : [ADR 0003](../adr/0003-stack-vue-vite-optionsapi-vuex-router.md). **Vue 3, Options API uniquement.**

## Structure d'un Single File Component

Ordre des blocs : `<template>` puis `<script>` puis `<style scoped lang="scss">`.

```vue
<template>
  <!-- un seul rôle par composant, markup lisible -->
</template>

<script>
export default {
  name: 'GrillePlanning',        // PascalCase, toujours renseigné
  components: { /* ... */ },
  props: {
    planning: { type: Object, required: true },
    lectureSeule: { type: Boolean, default: false }
  },
  emits: ['affectation-modifiee'],   // déclarer les événements émis
  data() {
    return { /* état local UI seulement */ };
  },
  computed: {
    /* dérivés ; mapState/mapGetters pour l'état du store */
  },
  methods: {
    /* handlers ; déléguer la logique métier au domaine/store */
  }
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as *;
/* styles du composant */
</style>
```

## Règles

- **Nom** en `PascalCase`, `name` toujours renseigné. Les écrans (routés) se terminent par `View` (`EquipeView.vue`).
- **Props** typées et documentées (`type`, `required`/`default`). Ne jamais muter une prop : émettre un événement.
- **Événements** déclarés dans `emits`, nommés en `kebab-case`.
- **`data()`** ne contient que de l'**état d'UI local** (ouverture d'un panneau, brouillon de formulaire). L'état partagé/persistant vit dans le **store**.
- **Pas de logique métier dans le composant** : appeler des getters/actions du store, ou des fonctions pures de `src/domain/`. Un composant orchestre l'affichage, il ne calcule pas un planning.
- **Découpage** : préférer des composants petits. Distinguer les composants « écran » (`views/`) des composants réutilisables (`components/`).
- **Icônes** exclusivement via `@phosphor-icons/vue` ([ADR 0013](../adr/0013-icones-phosphor.md)), toujours accompagnées d'un libellé ou d'un `aria-label`.
- **Style** : utiliser les **classes/composants Bootstrap** ([ADR 0015](../adr/0015-bootstrap-librairie-composants-scss.md)) pour ce qu'il couvre (grille, boutons, formulaires, modales, utilitaires) ; le SCSS `scoped` du composant sert au spécifique. Pour les composants interactifs, préférer une bascule **Vue simple** plutôt que la JS impérative de Bootstrap quand c'est trivial (voir [style-scss](style-scss.md)).
- **Dates/jours** : passer par les utilitaires (`src/domain/utils/dates.js`), jamais de manipulation `Date` à la main ([ADR 0010](../adr/0010-conventions-dates-et-jours-iso.md)).

## Accès au store

Utiliser les helpers `mapState`, `mapGetters`, `mapActions` (namespaced) pour garder les composants concis. Exemple :

```js
import { mapGetters, mapActions } from 'vuex';
export default {
  computed: { ...mapGetters('personnes', ['actifs']) },
  methods: { ...mapActions('personnes', ['ajouter', 'modifier']) }
};
```

Voir [`etat-vuex.md`](etat-vuex.md).
