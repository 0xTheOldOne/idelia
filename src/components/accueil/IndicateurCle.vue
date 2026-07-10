<template>
  <component
    :is="composant"
    v-bind="attributsSpecifiques"
    class="indicateur-cle"
    :class="{ 'indicateur-cle--cliquable': !!to }"
    :aria-label="`${libelle} : ${valeur}`"
  >
    <component :is="icone" :size="28" aria-hidden="true" class="indicateur-cle__icone" />
    <span class="indicateur-cle__contenu">
      <span class="indicateur-cle__valeur">{{ valeur }}</span>
      <span class="indicateur-cle__libelle">{{ libelle }}</span>
    </span>
  </component>
</template>

<script>
/**
 * Indicateur clé du tableau de bord (feature 0013) : grand chiffre + libellé
 * + icône. Présentational pur — reçoit une valeur déjà calculée par
 * l'écran appelant (aucun calcul ici).
 *
 * `to` (facultatif) rend l'indicateur cliquable/focusable via un
 * `router-link` (navigation vers l'écran concerné) ; sans `to`, l'indicateur
 * est un conteneur non interactif.
 *
 * Accessibilité : icône `aria-hidden` (l'information est portée par le
 * libellé et le chiffre, jamais par la seule couleur) ; cible cliquable
 * ≥ `$cible-cliquable-min`, focus visible quand cliquable ; `aria-label`
 * (« libellé : valeur ») pour une restitution naturelle par les lecteurs
 * d'écran, notamment lorsque l'indicateur est cliquable (`router-link`).
 */
export default {
  name: 'IndicateurCle',
  props: {
    /** Valeur affichée en grand (chiffre ou texte court, ex. « Sem. 29 » ou « — »). */
    valeur: { type: [String, Number], required: true },
    /** Libellé de l'indicateur, toujours visible. */
    libelle: { type: String, required: true },
    /** Composant d'icône Phosphor (importé et passé tel quel par l'appelant). */
    icone: { type: [Object, Function], required: true },
    /** Destination `vue-router` (String ou objet route) ; absent → conteneur non cliquable. */
    to: { type: [String, Object], default: null },
  },
  computed: {
    composant() {
      return this.to ? 'router-link' : 'div';
    },
    attributsSpecifiques() {
      return this.to ? { to: this.to } : {};
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.indicateur-cle {
  display: flex;
  align-items: center;
  gap: t.$espace-3;
  min-height: t.$cible-cliquable-min;
  padding: t.$espace-3 t.$espace-4;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
  background-color: t.$couleur-fond-clair;
  color: t.$couleur-texte;
  text-decoration: none;
}

.indicateur-cle--cliquable {
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: t.$couleur-primaire;
  }

  &:focus-visible {
    @include m.focus-visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .indicateur-cle--cliquable {
    transition: none;
  }
}

.indicateur-cle__icone {
  flex-shrink: 0;
  color: t.$couleur-primaire;
}

.indicateur-cle__contenu {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.indicateur-cle__valeur {
  font-size: t.$taille-titre-2;
  font-weight: t.$graisse-extra-gras;
  line-height: 1.1;
}

.indicateur-cle__libelle {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}
</style>
