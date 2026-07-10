<template>
  <component
    :is="composant"
    v-bind="attributsSpecifiques"
    class="tuile-action"
    :class="{ 'tuile-action--accent': accent }"
    @click="declencher"
  >
    <component :is="icone" :size="32" aria-hidden="true" class="tuile-action__icone" />
    <span class="tuile-action__contenu">
      <span class="tuile-action__titre">{{ titre }}</span>
      <span v-if="description" class="tuile-action__description">{{ description }}</span>
    </span>
  </component>
</template>

<script>
/**
 * Grande tuile d'action réutilisable (tableau de bord, feature 0013).
 *
 * Deux modes, selon la prop `to` :
 * - `to` fourni → rend un `<router-link>` : navigation directe, clic et
 *   clavier (Entrée) gérés nativement par le lien.
 * - `to` absent → rend un `<button type="button">` qui émet `activer` au
 *   clic (Entrée/Espace activent nativement un `<button>`) : pour les
 *   tuiles qui doivent d'abord poser une sélection avant de naviguer
 *   (ex. « Ouvrir le planning en cours »).
 *
 * Présentational pur : aucune logique métier, aucun accès au store. La cible
 * cliquable est le **bloc entier** (icône + titre + description).
 *
 * Accessibilité : icône `aria-hidden` (toujours doublée du titre visible) ;
 * `accent` ne change que l'aspect (fond + couleur de texte), jamais
 * l'information portée (le titre reste lisible dans les deux cas).
 */
export default {
  name: 'TuileAction',
  props: {
    /** Titre de la tuile, toujours visible. */
    titre: { type: String, required: true },
    /** Description courte, facultative. */
    description: { type: String, default: '' },
    /** Composant d'icône Phosphor (importé et passé tel quel par l'appelant). */
    icone: { type: [Object, Function], required: true },
    /** Destination `vue-router` (String ou objet route) ; absent → bouton émettant `activer`. */
    to: { type: [String, Object], default: null },
    /** Met la tuile en avant (geste le plus fréquent) : fond teal, texte inversé. */
    accent: { type: Boolean, default: false },
  },
  emits: ['activer'],
  computed: {
    composant() {
      return this.to ? 'router-link' : 'button';
    },
    attributsSpecifiques() {
      return this.to ? { to: this.to } : { type: 'button' };
    },
  },
  methods: {
    declencher() {
      if (!this.to) this.$emit('activer');
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.tuile-action {
  display: flex;
  align-items: center;
  gap: t.$espace-3;
  width: 100%;
  min-height: 96px;
  padding: t.$espace-4;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-lg;
  background-color: t.$couleur-fond;
  color: t.$couleur-texte;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover {
    border-color: t.$couleur-primaire;
  }

  &:focus-visible {
    @include m.focus-visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tuile-action {
    transition: none;
  }
}

.tuile-action__icone {
  flex-shrink: 0;
  color: t.$couleur-primaire;
}

.tuile-action__contenu {
  display: flex;
  flex-direction: column;
  gap: t.$espace-1;
  min-width: 0;
}

.tuile-action__titre {
  font-size: t.$taille-texte-grande;
  font-weight: t.$graisse-gras;
}

.tuile-action__description {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

// Mise en avant : fond teal + texte inversé. L'information (le titre) reste
// portée par le texte, pas par la seule couleur — la tuile garde sa taille,
// son icône et son titre lisibles dans les deux cas.
.tuile-action--accent {
  border-color: t.$couleur-primaire;
  background-color: t.$couleur-primaire;
  color: t.$couleur-texte-inverse;

  &:hover {
    background-color: t.$couleur-primaire-foncee;
    border-color: t.$couleur-primaire-foncee;
  }

  .tuile-action__icone {
    color: t.$couleur-texte-inverse;
  }

  .tuile-action__description {
    color: t.$couleur-texte-inverse;
  }
}
</style>
