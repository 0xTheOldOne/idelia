<template>
  <div class="barre-editeur" role="toolbar" aria-label="Mise en forme du texte">
    <div v-for="groupe in groupes" :key="groupe.nom" class="barre-editeur__groupe" role="group" :aria-label="groupe.nom">
      <button
        v-for="bouton in groupe.boutons"
        :key="bouton.libelle"
        type="button"
        class="btn btn-outline-secondary barre-editeur__bouton"
        :title="bouton.libelle"
        :aria-label="bouton.libelle"
        :aria-pressed="estActif(bouton) ? 'true' : 'false'"
        :class="{ 'barre-editeur__bouton--actif': estActif(bouton) }"
        :disabled="desactive"
        @mousedown.prevent
        @click="$emit('format', { nom: bouton.nom, valeur: bouton.valeur })"
      >
        <component :is="bouton.icone" :size="22" aria-hidden="true" />
      </button>
    </div>

    <div class="barre-editeur__groupe" role="group" aria-label="Historique">
      <button
        type="button"
        class="btn btn-outline-secondary barre-editeur__bouton"
        title="Annuler (Ctrl+Z)"
        aria-label="Annuler"
        :disabled="desactive"
        @mousedown.prevent
        @click="$emit('annuler')"
      >
        <PhArrowCounterClockwise :size="22" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary barre-editeur__bouton"
        title="Rétablir (Ctrl+Y)"
        aria-label="Rétablir"
        :disabled="desactive"
        @mousedown.prevent
        @click="$emit('retablir')"
      >
        <PhArrowClockwise :size="22" aria-hidden="true" />
      </button>
    </div>

    <MenuInsererChamp
      :champs-libres="champsLibres"
      :desactive="desactive"
      @choisir="(cle) => $emit('choisir', cle)"
      @nouveau-champ="$emit('nouveau-champ')"
    />
  </div>
</template>

<script>
import {
  PhArrowClockwise,
  PhArrowCounterClockwise,
  PhListBullets,
  PhListNumbers,
  PhTextAlignCenter,
  PhTextAlignJustify,
  PhTextAlignLeft,
  PhTextAlignRight,
  PhTextB,
  PhTextHOne,
  PhTextHTwo,
  PhTextItalic,
  PhTextUnderline,
} from '@phosphor-icons/vue';
import MenuInsererChamp from '@/components/contrats/MenuInsererChamp.vue';

/**
 * Barre d'outils réduite de l'éditeur : uniquement ce qui sert à un contrat.
 * Boutons icône seule (`title` + `aria-label`), `aria-pressed` selon les formats courants.
 * `@mousedown.prevent` : le clic ne retire pas la sélection du texte.
 */
export default {
  name: 'BarreOutilsEditeur',
  components: { MenuInsererChamp, PhArrowClockwise, PhArrowCounterClockwise },
  props: {
    /** Champs à compléter du modèle, proposés par le menu « Insérer un champ ». */
    champsLibres: { type: Array, default: () => [] },
    /** Formats du texte sous le curseur (`{ bold: true, header: 1… }`). */
    formats: { type: Object, default: () => ({}) },
    desactive: { type: Boolean, default: false },
  },
  emits: ['format', 'annuler', 'retablir', 'choisir', 'nouveau-champ'],
  computed: {
    groupes() {
      return [
        {
          nom: 'Style du texte',
          boutons: [
            { libelle: 'Gras', nom: 'bold', valeur: true, icone: PhTextB },
            { libelle: 'Italique', nom: 'italic', valeur: true, icone: PhTextItalic },
            { libelle: 'Souligné', nom: 'underline', valeur: true, icone: PhTextUnderline },
          ],
        },
        {
          nom: 'Titres',
          boutons: [
            { libelle: 'Titre', nom: 'header', valeur: 1, icone: PhTextHOne },
            { libelle: 'Sous-titre', nom: 'header', valeur: 2, icone: PhTextHTwo },
          ],
        },
        {
          nom: 'Listes',
          boutons: [
            { libelle: 'Liste à puces', nom: 'list', valeur: 'bullet', icone: PhListBullets },
            { libelle: 'Liste numérotée', nom: 'list', valeur: 'ordered', icone: PhListNumbers },
          ],
        },
        {
          nom: 'Alignement',
          boutons: [
            { libelle: 'Aligner à gauche', nom: 'align', valeur: false, icone: PhTextAlignLeft },
            { libelle: 'Centrer', nom: 'align', valeur: 'center', icone: PhTextAlignCenter },
            { libelle: 'Aligner à droite', nom: 'align', valeur: 'right', icone: PhTextAlignRight },
            { libelle: 'Justifier', nom: 'align', valeur: 'justify', icone: PhTextAlignJustify },
          ],
        },
      ];
    },
  },
  methods: {
    /** « Aligner à gauche » est actif quand aucun autre alignement n'est posé. */
    estActif({ nom, valeur }) {
      const courant = this.formats[nom];
      return valeur === false ? !courant : courant === valeur;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.barre-editeur {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: t.$espace-3;
  width: 100%;
}

.barre-editeur__groupe {
  display: flex;
  gap: t.$espace-1;
}

.barre-editeur__bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: t.$cible-cliquable-min;
  height: t.$cible-cliquable-min;
  padding: 0;
}

.barre-editeur__bouton--actif {
  border-color: t.$couleur-primaire;
  background: m.translucide(t.$couleur-primaire, 0.18);
  color: t.$couleur-primaire;
}
</style>
