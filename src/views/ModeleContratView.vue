<template>
  <div class="modele-contrat-view">
    <template v-if="modele">
      <div class="modele-entete">
        <h1 class="modele-titre">
          {{ modele.titre }}
          <span class="modele-badge">{{ libelleTypeModeleContrat(modele.type) }}</span>
        </h1>
        <div class="modele-actions">
          <button
            v-if="!archive"
            type="button"
            class="btn btn-primary modele-bouton-enregistrer"
            :disabled="!modifie || !editeurPret"
            @click="enregistrer"
          >
            <PhFloppyDisk :size="20" weight="bold" aria-hidden="true" />
            <span>Enregistrer</span>
          </button>
          <button
            v-if="!archive"
            type="button"
            class="btn btn-outline-secondary modele-bouton-icone"
            title="Renommer"
            aria-label="Renommer le modèle"
            @click="modaleRenommageVisible = true"
          >
            <PhTextAa :size="20" aria-hidden="true" />
          </button>
          <router-link
            class="btn btn-outline-secondary modele-bouton-icone"
            :to="{ name: 'modeles-contrats' }"
            title="Retour à la liste"
            aria-label="Retour à la liste des modèles"
          >
            <PhArrowLeft :size="20" aria-hidden="true" />
          </router-link>
        </div>
      </div>

      <p v-if="archive" class="alert alert-info" role="status">
        Ce modèle est archivé : il est affiché en lecture seule. Restaurez-le depuis la liste des modèles pour le
        modifier.
      </p>
      <p v-else class="modele-etat" :class="{ 'modele-etat--attente': modifie }" role="status">
        <template v-if="modifie">
          <PhWarningCircle :size="20" weight="bold" aria-hidden="true" />
          <span>Modifications non enregistrées</span>
        </template>
        <template v-else>
          <PhCheckCircle :size="20" weight="bold" aria-hidden="true" />
          <span>Toutes les modifications sont enregistrées</span>
        </template>
      </p>

      <EditeurRiche
        :key="modele.id"
        ref="editeur"
        :contenu="contenuInitial"
        :champs-libres="champsLibresBrouillon"
        :lecture-seule="archive"
        :libelle-accessible="`Texte du modèle « ${modele.titre} »`"
        @modifie="onModifie"
        @pret="editeurPret = true"
        @nouveau-champ="ouvrirNouveauChamp"
      />

      <section class="modele-champs" aria-labelledby="modele-champs-titre">
        <h2 id="modele-champs-titre" class="modele-champs-titre">
          Champs à compléter lors de la création d'un document
        </h2>
        <ul v-if="champsLibresBrouillon.length" class="modele-champs-liste">
          <li v-for="champ in champsLibresBrouillon" :key="champ.cle" class="modele-champ">
            <div class="modele-champ-identite">
              <span class="modele-champ-libelle">{{ champ.libelle }}</span>
              <span class="modele-champ-type">{{ libelleTypeChampLibre(champ.type) }}</span>
            </div>
            <div v-if="!archive" class="modele-champ-actions">
              <button
                type="button"
                class="btn btn-outline-secondary modele-bouton-icone"
                title="Modifier"
                :aria-label="`Modifier le champ ${champ.libelle}`"
                @click="ouvrirModificationChamp(champ)"
              >
                <PhPencilSimple :size="18" aria-hidden="true" />
              </button>
              <!-- Un champ désactivé ne reçoit pas le survol : l'infobulle est portée par l'enveloppe. -->
              <span :title="champUtilise(champ.cle) ? MESSAGE_CHAMP_UTILISE : 'Retirer'">
                <button
                  type="button"
                  class="btn btn-outline-danger modele-bouton-icone"
                  :disabled="champUtilise(champ.cle)"
                  :aria-label="
                    champUtilise(champ.cle)
                      ? `Retirer le champ ${champ.libelle} : ${MESSAGE_CHAMP_UTILISE}`
                      : `Retirer le champ ${champ.libelle}`
                  "
                  @click="retirerChamp(champ)"
                >
                  <PhTrash :size="18" aria-hidden="true" />
                </button>
              </span>
            </div>
          </li>
        </ul>
        <p v-else class="modele-champs-vide">
          Aucun champ à compléter. Utilisez « Insérer un champ » puis « Nouveau champ à compléter » pour en ajouter.
        </p>
        <button v-if="!archive" type="button" class="btn btn-outline-secondary modele-champ-ajout" @click="ouvrirNouveauChamp">
          <PhPlus :size="18" weight="bold" aria-hidden="true" />
          <span>Nouveau champ à compléter</span>
        </button>
      </section>

      <ModaleChampLibre
        :visible="modaleChampVisible"
        :champ="champEnCours"
        :champs-libres="champsLibresBrouillon"
        @valider="onValiderChamp"
        @annuler="fermerModaleChamp"
      />

      <ModaleModeleContrat
        :visible="modaleRenommageVisible"
        :modele="modele"
        :titres-existants="titresAutresModeles"
        @valider="onRenommer"
        @annuler="modaleRenommageVisible = false"
      />
    </template>

    <template v-else>
      <h1>Ce modèle est introuvable.</h1>
      <router-link :to="{ name: 'modeles-contrats' }">Revenir aux modèles</router-link>
    </template>

    <DialogueConfirmation
      :visible="dialogueQuitter"
      titre="Quitter sans enregistrer ?"
      message="Vos dernières modifications seront perdues."
      libelle-annuler="Rester sur la page"
      libelle-confirmer="Quitter sans enregistrer"
      variante-confirmer="danger"
      @confirmer="repondreQuitter(true)"
      @annuler="repondreQuitter(false)"
    />
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import { copieJson } from '@/domain/utils/json.js';
import {
  PhFloppyDisk,
  PhTextAa,
  PhArrowLeft,
  PhWarningCircle,
  PhCheckCircle,
  PhPencilSimple,
  PhTrash,
  PhPlus,
} from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import EditeurRiche from '@/components/contrats/EditeurRiche.vue';
import ModaleChampLibre from '@/components/contrats/ModaleChampLibre.vue';
import ModaleModeleContrat from '@/components/contrats/ModaleModeleContrat.vue';
import { libelleTypeModeleContrat, libelleTypeChampLibre } from '@/domain/libelles.js';
import { champLibreUtilise, creerChampLibre } from '@/domain/contrats/modeles.js';

const MESSAGE_CHAMP_UTILISE = 'Ce champ est utilisé dans le modèle : retirez-le d’abord du texte';


/**
 * Édition d'un modèle de contrat (feature 0041, §2.3 et §6.6).
 * Enregistrement explicite (bouton + Ctrl+S) ; garde de sortie par
 * `beforeRouteLeave` / `beforeRouteUpdate` et `beforeunload`.
 * Un modèle archivé s'ouvre en lecture seule.
 */
export default {
  name: 'ModeleContratView',
  components: {
    PhFloppyDisk,
    PhTextAa,
    PhArrowLeft,
    PhWarningCircle,
    PhCheckCircle,
    PhPencilSimple,
    PhTrash,
    PhPlus,
    DialogueConfirmation,
    EditeurRiche,
    ModaleChampLibre,
    ModaleModeleContrat,
  },
  data() {
    return {
      MESSAGE_CHAMP_UTILISE,
      modifie: false,
      editeurPret: false,
      // Copies de travail : le store n'est touché qu'à l'enregistrement.
      contenuInitial: { ops: [] },
      champsLibresBrouillon: [],
      // Incrémenté à chaque frappe pour réévaluer « champ utilisé dans le texte ».
      versionContenu: 0,
      dialogueQuitter: false,
      resoudreQuitter: null,
      modaleChampVisible: false,
      champEnCours: null,
      modaleRenommageVisible: false,
    };
  },
  computed: {
    ...mapGetters('contrats', ['modeleById', 'modelesActifs', 'modelesArchives']),
    modele() {
      return this.modeleById(this.$route.params.id) ?? null;
    },
    archive() {
      return !!this.modele && this.modele.actif === false;
    },
    titresAutresModeles() {
      return [...this.modelesActifs, ...this.modelesArchives]
        .filter((m) => !this.modele || m.id !== this.modele.id)
        .map((m) => m.titre);
    },
  },
  watch: {
    // Passage d'un modèle à un autre (la garde a déjà été franchie) : on repart de zéro.
    '$route.params.id'() {
      this.charger();
    },
  },
  created() {
    this.charger();
  },
  mounted() {
    window.addEventListener('beforeunload', this.surFermetureOnglet);
    window.addEventListener('keydown', this.surToucheClavier);
  },
  beforeUnmount() {
    window.removeEventListener('beforeunload', this.surFermetureOnglet);
    window.removeEventListener('keydown', this.surToucheClavier);
  },
  beforeRouteLeave() {
    return this.confirmerSortie();
  },
  beforeRouteUpdate() {
    return this.confirmerSortie();
  },
  methods: {
    ...mapActions('contrats', ['enregistrerModele', 'renommerModele']),
    libelleTypeModeleContrat,
    libelleTypeChampLibre,

    /** Prépare les copies de travail depuis le modèle courant. */
    charger() {
      this.modifie = false;
      this.editeurPret = false;
      this.versionContenu = 0;
      this.contenuInitial = this.modele ? copieJson(this.modele.contenu) : { ops: [] };
      this.champsLibresBrouillon = this.modele ? copieJson(this.modele.champsLibres ?? []) : [];
    },
    onModifie() {
      if (this.archive) return;
      this.modifie = true;
      this.versionContenu += 1;
    },
    /** Le champ figure-t-il dans le texte ? (réévalué à chaque modification) */
    champUtilise(cle) {
      // eslint-disable-next-line no-unused-expressions
      this.versionContenu;
      const editeur = this.$refs.editeur;
      return !!editeur && champLibreUtilise(editeur.lireContenu(), cle);
    },

    async enregistrer() {
      if (!this.modele || this.archive || !this.modifie || !this.editeurPret) return;
      const enregistre = await this.enregistrerModele({
        id: this.modele.id,
        contenu: copieJson(this.$refs.editeur.lireContenu()),
        champsLibres: copieJson(this.champsLibresBrouillon),
      });
      if (enregistre) this.modifie = false;
    },
    async onRenommer({ titre, type }) {
      await this.renommerModele({ id: this.modele.id, titre, type });
      this.modaleRenommageVisible = false;
    },

    // ---- Champs à compléter ----
    ouvrirNouveauChamp() {
      if (this.archive) return;
      this.champEnCours = null;
      this.modaleChampVisible = true;
    },
    ouvrirModificationChamp(champ) {
      this.champEnCours = champ;
      this.modaleChampVisible = true;
    },
    fermerModaleChamp() {
      this.modaleChampVisible = false;
      this.champEnCours = null;
    },
    async onValiderChamp({ libelle, type }) {
      if (this.champEnCours) {
        // Renommage : même clé, les pastilles se mettent à jour par le watcher de l'éditeur.
        const index = this.champsLibresBrouillon.findIndex((c) => c.cle === this.champEnCours.cle);
        if (index !== -1) this.champsLibresBrouillon.splice(index, 1, { ...this.champsLibresBrouillon[index], libelle, type });
        this.modifie = true;
        this.fermerModaleChamp();
        return;
      }
      const champ = creerChampLibre({ libelle, type });
      this.champsLibresBrouillon.push(champ);
      this.modifie = true;
      this.fermerModaleChamp();
      // Le champ vient d'être demandé depuis le texte : on l'y insère directement.
      await this.$nextTick();
      this.$refs.editeur?.insererMarqueur(champ.cle);
    },
    retirerChamp(champ) {
      if (this.champUtilise(champ.cle)) return;
      this.champsLibresBrouillon = this.champsLibresBrouillon.filter((c) => c.cle !== champ.cle);
      this.modifie = true;
    },

    // ---- Garde de sortie ----
    /** @returns {(boolean|Promise<boolean>)} `true` si la navigation peut continuer. */
    confirmerSortie() {
      if (!this.modifie) return true;
      return new Promise((resolve) => {
        this.resoudreQuitter = resolve;
        this.dialogueQuitter = true;
      });
    },
    repondreQuitter(quitter) {
      this.dialogueQuitter = false;
      const resoudre = this.resoudreQuitter;
      this.resoudreQuitter = null;
      if (resoudre) resoudre(quitter);
    },
    surFermetureOnglet(evenement) {
      if (!this.modifie) return;
      evenement.preventDefault();
      // Requis par certains navigateurs pour afficher l'alerte native.
      evenement.returnValue = '';
    },
    surToucheClavier(evenement) {
      if ((evenement.ctrlKey || evenement.metaKey) && evenement.key.toLowerCase() === 's') {
        evenement.preventDefault();
        this.enregistrer();
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.modele-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-3;
}

.modele-titre {
  display: flex;
  flex: 1 1 20rem;
  flex-wrap: wrap;
  align-items: center;
  gap: t.$espace-3;
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.modele-badge {
  padding: 0.1rem t.$espace-2;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

.modele-actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: t.$espace-2;
}

.modele-bouton-enregistrer {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.modele-bouton-icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;
  line-height: 1;
}

.modele-etat {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin-bottom: t.$espace-3;
  color: t.$couleur-texte-attenue;

  &--attente {
    color: t.$couleur-texte;
    font-weight: t.$graisse-gras;
  }
}

.modele-champs {
  margin-top: t.$espace-5;
}

.modele-champs-titre {
  font-size: 1.25rem;
  margin-bottom: t.$espace-3;
}

.modele-champs-liste {
  list-style: none;
  padding: 0;
  margin: 0 0 t.$espace-3;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.modele-champ {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-3;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

.modele-champ-identite {
  display: flex;
  flex-direction: column;
  flex: 1 1 12rem;
  min-width: 0;
}

.modele-champ-libelle {
  font-weight: t.$graisse-gras;
}

.modele-champ-type {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.modele-champ-actions {
  display: flex;
  gap: t.$espace-1;
  margin-left: auto;
}

.modele-champs-vide {
  color: t.$couleur-texte-attenue;
}

.modele-champ-ajout {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
