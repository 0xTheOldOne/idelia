<template>
  <div class="editeur-riche">
    <BarreOutilsEditeur
      v-if="!lectureSeule"
      class="d-print-none"
      :avec-insertion-champs="avecInsertionChamps"
      :champs-libres="champsLibres"
      :formats="formats"
      :desactive="lectureSeule || !editeurPret"
      @format="basculerFormat"
      @annuler="controleur && controleur.annuler()"
      @retablir="controleur && controleur.retablir()"
      @choisir="insererMarqueur"
      @nouveau-champ="$emit('nouveau-champ')"
    />

    <p v-if="avecInsertionChamps" class="editeur-riche__legende">
      En couleur : rempli automatiquement. En pointillés : demandé lors de la création du document.
    </p>

    <div v-if="avecInsertionChamps" class="editeur-riche__aide">
      <button
        type="button"
        class="btn btn-link editeur-riche__aide-bouton"
        :aria-expanded="aideOuverte ? 'true' : 'false'"
        aria-controls="editeur-riche-aide"
        @click="aideOuverte = !aideOuverte"
      >
        <PhClipboardText :size="20" aria-hidden="true" />
        Coller un contrat existant
      </button>
      <div v-show="aideOuverte" id="editeur-riche-aide" class="editeur-riche__aide-texte">
        <p class="mb-2">
          Copiez le texte de votre contrat (Word, PDF, page web) et collez-le ici. La mise en forme simple est
          conservée (gras, italique, souligné, titres, listes, alignement), le reste est retiré.
        </p>
        <p class="mb-0">
          Les codes écrits entre doubles accolades, comme <code>{{ exempleCode }}</code
          >, deviennent des champs. Les codes que nous ne connaissons pas restent du texte : insérez-les avec
          « Insérer un champ ».
        </p>
      </div>
    </div>

    <div v-if="avertissement" class="alert alert-warning editeur-riche__avertissement d-print-none" role="status">
      <PhWarning :size="20" aria-hidden="true" />
      <span class="editeur-riche__avertissement-texte">{{ avertissement }}</span>
      <button type="button" class="btn-close" aria-label="Fermer l'avertissement" @click="avertissement = ''"></button>
    </div>

    <div v-if="erreurChargement" class="alert alert-danger editeur-riche__erreur" role="alert">
      <p class="mb-2">L'éditeur n'a pas pu s'ouvrir. Vérifiez votre connexion, puis réessayez.</p>
      <button type="button" class="btn btn-outline-danger" @click="demarrer">Réessayer</button>
    </div>
    <p v-else-if="!editeurPret" class="editeur-riche__chargement" role="status">Ouverture de l'éditeur…</p>

    <div ref="zone" class="editeur-riche__zone"></div>
  </div>
</template>

<script>
import { PhClipboardText, PhWarning } from '@phosphor-icons/vue';
import BarreOutilsEditeur from '@/components/contrats/BarreOutilsEditeur.vue';
import { creerEditeur } from '@/adaptateurs/editeurRiche.js';
import { clesDuCatalogue, libelleMarqueur } from '@/domain/contrats/catalogueMarqueurs.js';
import {
  convertirMarqueursTexte,
  messageMarqueursInconnus,
  syntaxeMarqueur,
} from '@/domain/contrats/collage.js';

/**
 * Éditeur de texte riche d'un modèle de contrat (enveloppe Options API de l'adaptateur Quill).
 *
 * L'instance Quill et son contrôleur ne sont JAMAIS dans `data()` (le proxy réactif de Vue
 * casse Quill) : ils sont affectés à `this.controleur` en `mounted` et libérés en `beforeUnmount`.
 * Aucun HTML injecté : le contenu passe uniquement par Quill.
 *
 * Méthodes publiques (via `ref`) : `lireContenu()`, `insererMarqueur(cle)`,
 * `rafraichirLibelles()`, `focus()`.
 */
export default {
  name: 'EditeurRiche',
  components: { BarreOutilsEditeur, PhClipboardText, PhWarning },
  props: {
    /** Contenu initial (Delta `{ ops }`). Lu une fois au montage ; la vue relit via `lireContenu()`. */
    contenu: { type: Object, required: true },
    /** Champs à compléter du modèle (`{ cle, libelle, type }`), pour libellés et menu. */
    champsLibres: { type: Array, default: () => [] },
    lectureSeule: { type: Boolean, default: false },
    /** Menu « Insérer un champ » dans la barre (faux pour un document généré). */
    avecInsertionChamps: { type: Boolean, default: true },
    /** Nom accessible de la zone de texte. */
    libelleAccessible: { type: String, default: '' },
  },
  emits: ['modifie', 'pret', 'erreur-chargement', 'nouveau-champ'],
  data() {
    return {
      editeurPret: false,
      erreurChargement: false,
      formats: {},
      aideOuverte: false,
      avertissement: '',
    };
  },
  computed: {
    exempleCode() {
      return syntaxeMarqueur('personne.nom');
    },
  },
  watch: {
    champsLibres: {
      deep: true,
      handler() {
        this.rafraichirLibelles();
      },
    },
  },
  mounted() {
    this.demarrer();
  },
  beforeUnmount() {
    this.annule = true;
    if (this.controleur) this.controleur.detruire();
    this.controleur = null;
  },
  methods: {
    /** Charge Quill puis crée l'éditeur (relancé par « Réessayer »). */
    async demarrer() {
      this.erreurChargement = false;
      try {
        const controleur = await creerEditeur(this.$refs.zone, {
          contenu: this.contenu,
          resoudreLibelle: (cle) => libelleMarqueur(cle, this.champsLibres),
          lectureSeule: this.lectureSeule,
          libelleAccessible: this.libelleAccessible,
          convertirCollage: (delta) => convertirMarqueursTexte(delta, clesDuCatalogue()),
          surMarqueursInconnus: (inconnus) => {
            this.avertissement = messageMarqueursInconnus(inconnus);
          },
        });
        if (this.annule) {
          controleur.detruire();
          return;
        }
        controleur.surChangement(() => {
          this.formats = controleur.formatsCourants();
          this.$emit('modifie');
        });
        controleur.surSelection(() => {
          this.formats = controleur.formatsCourants();
        });
        this.controleur = controleur;
        this.editeurPret = true;
        this.$emit('pret');
      } catch (err) {
        if (this.annule) return;
        this.erreurChargement = true;
        this.$emit('erreur-chargement', err);
      }
    },
    basculerFormat({ nom, valeur }) {
      if (!this.controleur) return;
      this.controleur.basculerFormat(nom, valeur);
      this.formats = this.controleur.formatsCourants();
      this.$emit('modifie');
    },
    /** Insère un champ à la position du curseur. @param {string} cle */
    insererMarqueur(cle) {
      if (!this.controleur) return;
      this.controleur.insererMarqueur(cle);
      this.$emit('modifie');
    },
    /** @returns {{ops: object[]}} contenu courant (Delta JSON). */
    lireContenu() {
      return this.controleur ? this.controleur.lireContenu() : this.contenu;
    },
    /** À appeler après le renommage d'un champ à compléter. */
    rafraichirLibelles() {
      if (this.controleur) this.controleur.rafraichirLibelles();
    },
    focus() {
      if (this.controleur) this.controleur.focus();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.editeur-riche__legende {
  margin: t.$espace-2 0;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.editeur-riche__aide-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
  padding-left: 0;
}

.editeur-riche__aide-texte {
  margin-bottom: t.$espace-3;
  padding: t.$espace-3;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
  background: t.$couleur-fond-clair;
  font-size: t.$taille-texte-petite;
}

.editeur-riche__avertissement {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-2;

  svg {
    flex-shrink: 0;
    margin-top: 0.15em;
  }
}

.editeur-riche__avertissement-texte {
  flex: 1;
}

.editeur-riche__chargement {
  color: t.$couleur-texte-attenue;
}
</style>
