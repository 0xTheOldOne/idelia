<template>
  <div ref="liste" class="nav nav-tabs liste-onglets" role="tablist" :aria-label="libelleGroupe">
    <button
      v-for="onglet in onglets"
      :id="idOnglet(onglet.code)"
      :key="onglet.code"
      type="button"
      role="tab"
      class="nav-link"
      :class="{ active: onglet.code === modelValue }"
      :aria-selected="onglet.code === modelValue ? 'true' : 'false'"
      :aria-controls="idPanneau(onglet.code)"
      :tabindex="onglet.code === modelValue ? 0 : -1"
      @click="activer(onglet.code)"
      @keydown="surTouche($event, onglet.code)"
    >
      {{ onglet.libelle }}
    </button>
  </div>
</template>

<script>
/**
 * Barre d'onglets accessible (feature 0030), pilotée par Vue (pas de JS Bootstrap `Tab`).
 * Présentationnelle : le parent possède l'onglet actif (`v-model`) et rend ses panneaux.
 *
 * Usage côté parent :
 * ```
 * <ListeOnglets v-model="ongletActif" :onglets="onglets" prefixe-id="personne"
 *               libelle-groupe="Rubriques de la fiche" />
 * <div v-show="ongletActif === 'general'" id="personne-panneau-general"
 *      role="tabpanel" aria-labelledby="personne-onglet-general" tabindex="0"> … </div>
 * ```
 * Convention d'ids : onglet = `<prefixeId>-onglet-<code>`, panneau = `<prefixeId>-panneau-<code>`.
 *
 * Clavier (activation automatique) : flèches gauche/droite avec bouclage, Origine/Fin ;
 * l'onglet atteint est activé et reçoit le focus.
 *
 * @typedef {Object} Onglet
 * @property {string} code Identifiant stable de l'onglet (ex. `'general'`).
 * @property {string} libelle Libellé affiché, en clair.
 */
export default {
  name: 'ListeOnglets',
  props: {
    /** @type {import('vue').PropType<Onglet[]>} Onglets, dans l'ordre d'affichage. */
    onglets: { type: Array, required: true },
    /** Code de l'onglet actif (`v-model`). */
    modelValue: { type: String, required: true },
    /** Préfixe des ids, partagé avec les panneaux du parent. */
    prefixeId: { type: String, required: true },
    /** Nom accessible de la liste d'onglets (`aria-label`). */
    libelleGroupe: { type: String, required: true },
  },
  emits: ['update:modelValue'],
  methods: {
    /** @param {string} code @returns {string} Id du bouton d'onglet. */
    idOnglet(code) {
      return `${this.prefixeId}-onglet-${code}`;
    },
    /** @param {string} code @returns {string} Id du panneau associé (rendu par le parent). */
    idPanneau(code) {
      return `${this.prefixeId}-panneau-${code}`;
    },
    /** @param {string} code Active l'onglet (émet `update:modelValue`). */
    activer(code) {
      if (code !== this.modelValue) this.$emit('update:modelValue', code);
    },
    /**
     * Navigation clavier : flèches (bouclage), Origine, Fin.
     * @param {KeyboardEvent} evenement
     * @param {string} code Onglet portant le focus.
     */
    surTouche(evenement, code) {
      const total = this.onglets.length;
      const courant = this.onglets.findIndex((o) => o.code === code);
      let cible;
      if (evenement.key === 'ArrowRight') cible = (courant + 1) % total;
      else if (evenement.key === 'ArrowLeft') cible = (courant - 1 + total) % total;
      else if (evenement.key === 'Home') cible = 0;
      else if (evenement.key === 'End') cible = total - 1;
      else return;
      evenement.preventDefault();
      const codeCible = this.onglets[cible].code;
      this.activer(codeCible);
      this.$nextTick(() => {
        this.$refs.liste?.querySelector(`[id="${this.idOnglet(codeCible)}"]`)?.focus();
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.liste-onglets {
  border-bottom-color: t.$couleur-bordure;

  .nav-link {
    min-height: t.$cible-cliquable-min;
    padding: t.$espace-2 t.$espace-4;
    color: t.$couleur-primaire;
    background: transparent;

    &:hover {
      color: t.$couleur-primaire-foncee;
    }

    // Actif : gras en plus du soulignement (jamais la couleur seule)
    &.active {
      font-weight: t.$graisse-gras;
      color: t.$couleur-primaire-foncee;
      border-bottom: 3px solid t.$couleur-primaire;
    }
  }
}
</style>
