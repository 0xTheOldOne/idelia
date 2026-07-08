<template>
  <div
    ref="modale"
    class="modal fade"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="idTitre"
  >
    <div class="modal-dialog" :class="{ 'modal-lg': taille === 'lg' }">
      <div class="modal-content">
        <div class="modal-header">
          <h2 :id="idTitre" class="modal-title">{{ titre }}</h2>
          <button type="button" class="btn-close" aria-label="Fermer" data-bs-dismiss="modal" />
        </div>

        <div class="modal-body">
          <slot />
        </div>

        <div v-if="$slots.pied" class="modal-footer">
          <slot name="pied" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Modal from 'bootstrap/js/dist/modal';

import { genId } from '@/domain/utils/id.js';

/**
 * Coquille de modale accessible — seul composant à piloter le composant
 * **Modal de Bootstrap** (ADR 0015). On s'appuie dessus précisément pour
 * l'accessibilité fournie clé en main : focus piégé, fermeture au clavier
 * (Échap), retour du focus à l'élément déclencheur, gestion ARIA. Rien de
 * tout cela n'est réimplémenté à la main ici.
 *
 * La prop `visible` est la **source de vérité côté parent** : ce composant
 * ne fait que traduire `visible` en appels `show()`/`hide()` et remonter les
 * fermetures initiées par Bootstrap (croix, Échap, clic hors fenêtre) via
 * l'événement `fermeture`, pour que le parent réaligne `visible`.
 *
 * Important : l'élément racine `.modal` n'est **jamais** `v-if` — Bootstrap
 * doit conserver la référence DOM pendant toute la vie du composant.
 */
export default {
  name: 'ModaleBase',
  props: {
    /** Affiche (`true`) ou masque (`false`) la modale ; piloté par le parent. */
    visible: { type: Boolean, required: true },
    /** Titre affiché dans l'en-tête, relié au conteneur par `aria-labelledby`. */
    titre: { type: String, required: true },
    /** Taille de la boîte de dialogue : `''` (par défaut) ou `'lg'`. */
    taille: { type: String, default: '' },
  },
  // `fermeture` : la modale vient d'être masquée par Bootstrap (croix, Échap,
  // clic hors fenêtre) — le parent doit repositionner `visible` à `false`.
  // `affichee` : la modale vient d'être affichée (transition d'ouverture
  // terminée) — permet au parent de poser un focus déterministe (ex. 1er
  // champ d'un formulaire) sans délai arbitraire (`setTimeout`).
  emits: ['fermeture', 'affichee'],
  data() {
    return {
      // Identifiant unique du titre (plusieurs modales peuvent coexister
      // dans la page, chacune a besoin de son propre `aria-labelledby`).
      idTitre: `modale-titre-${genId()}`,
      instance: null,
      // Élément focalisé juste avant l'ouverture (le déclencheur). Piloter
      // la Modal Bootstrap par programmation (plutôt que `data-bs-toggle`)
      // prive Bootstrap du déclencheur qu'il utilise habituellement pour
      // restaurer le focus à la fermeture : on le mémorise donc nous-mêmes
      // pour le restaurer dans `onMasquee`.
      elementDeclencheur: null,
    };
  },
  watch: {
    visible(estVisible) {
      if (estVisible) {
        this.elementDeclencheur = document.activeElement;
        this.instance.show();
      } else {
        this.instance.hide();
      }
    },
  },
  mounted() {
    this.instance = new Modal(this.$refs.modale);
    this.$refs.modale.addEventListener('hidden.bs.modal', this.onMasquee);
    this.$refs.modale.addEventListener('shown.bs.modal', this.onAffichee);
    // Cas où la modale est déjà `visible` au montage (peu fréquent, mais à
    // couvrir pour rester cohérent avec le watcher).
    if (this.visible) {
      this.elementDeclencheur = document.activeElement;
      this.instance.show();
    }
  },
  beforeUnmount() {
    this.$refs.modale.removeEventListener('hidden.bs.modal', this.onMasquee);
    this.$refs.modale.removeEventListener('shown.bs.modal', this.onAffichee);
    this.instance?.dispose();
  },
  methods: {
    // Bootstrap vient de masquer la modale (croix, Échap, clic hors
    // fenêtre, ou fermeture programmatique via `visible = false`) : on
    // prévient le parent pour qu'il repositionne `visible`, puis on restaure
    // le focus sur l'élément déclencheur s'il est toujours présent dans le
    // document (sinon on l'ignore proprement — le parent gère ce cas, ex.
    // un bouton « Supprimer » retiré après suppression).
    onMasquee() {
      this.$emit('fermeture');
      const cible = this.elementDeclencheur;
      this.elementDeclencheur = null;
      if (cible && typeof cible.focus === 'function' && document.body.contains(cible)) {
        cible.focus();
      }
    },
    // Bootstrap vient de terminer la transition d'ouverture : le parent peut
    // poser un focus déterministe sans risquer de se le faire reprendre par
    // le piège à focus de la modale.
    onAffichee() {
      this.$emit('affichee');
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

// La croix de fermeture Bootstrap ne mesure par défaut qu'environ 24px de
// côté (icône 1em + un padding réduit) : bien en-dessous de la cible
// cliquable confortable visée par l'application. On agrandit le padding pour
// porter la zone cliquable totale à `$cible-cliquable-min` (~44px) et on
// compense par une marge négative équivalente pour que la croix reste
// visuellement à la même place, sans décaler l'en-tête de la modale.
.modal-header .btn-close {
  padding: calc((#{t.$cible-cliquable-min} - 1em) / 2) !important;
  margin: calc((1em - #{t.$cible-cliquable-min}) / 2)
    calc((1em - #{t.$cible-cliquable-min}) / 2)
    calc((1em - #{t.$cible-cliquable-min}) / 2)
    auto !important;
}
</style>
