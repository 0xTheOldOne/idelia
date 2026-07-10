<template>
  <div class="souhaits-view">
    <template v-if="!personne">
      <div class="souhaits-introuvable">
        <PhUserMinus :size="48" aria-hidden="true" />
        <p class="mb-0">Cette personne est introuvable.</p>
        <router-link class="btn btn-outline-secondary" :to="{ name: 'equipe' }">
          <PhArrowLeft :size="18" aria-hidden="true" />
          <span>Retour à l'équipe</span>
        </router-link>
      </div>
    </template>

    <template v-else>
      <router-link class="souhaits-retour" :to="{ name: 'equipe' }">
        <PhArrowLeft :size="16" aria-hidden="true" />
        <span>Retour à l'équipe</span>
      </router-link>

      <h1>Souhaits et contraintes de {{ personne.prenom }} {{ personne.nom }}</h1>
      <p class="souhaits-rappel">
        {{ libelleStatutPersonne(personne.statut) }} · {{ personne.quotite }} %
      </p>

      <div class="souhaits-explication">
        <p class="mb-1">
          <PhLock :size="16" aria-hidden="true" />
          <strong>Obligatoire</strong> : toujours respecté par le planning.
        </p>
        <p class="mb-0">
          <PhStar :size="16" aria-hidden="true" />
          <strong>Souhait</strong> : pris en compte si possible.
        </p>
      </div>

      <div
        v-if="statutSauvegarde === 'ERREUR_CHARGEMENT'"
        class="alert alert-warning d-flex gap-2"
        role="alert"
      >
        <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <p class="mb-0">
          Les souhaits enregistrés n'ont pas pu être relus ; la liste affichée peut être
          incomplète. Une copie de sauvegarde a été conservée. Rechargez la page pour réessayer ;
          si le problème persiste, réimportez une sauvegarde.
        </p>
      </div>

      <IndicateurSauvegarde
        :statut="statutSauvegarde"
        :derniere-sauvegarde="derniereSauvegarde"
        :apres-edition="aEdite"
      />

      <div class="souhaits-entete">
        <button
          ref="boutonAjout"
          type="button"
          class="btn btn-primary souhaits-bouton-ajout"
          @click="ouvrirAjout"
        >
          <PhPlus :size="20" weight="bold" aria-hidden="true" />
          <span>Ajouter un souhait</span>
        </button>
      </div>

      <div v-if="personne.preferences.length === 0" class="souhaits-etat-vide">
        <PhSlidersHorizontal :size="48" aria-hidden="true" />
        <p class="mb-0">
          Aucun souhait pour l'instant. Ajoutez-en un pour guider la création des plannings.
        </p>
        <button type="button" class="btn btn-primary souhaits-bouton-ajout" @click="ouvrirAjout">
          <PhPlus :size="20" weight="bold" aria-hidden="true" />
          <span>Ajouter un souhait</span>
        </button>
      </div>

      <ul v-else class="souhaits-liste">
        <li
          v-for="preference in personne.preferences"
          :key="preference.id"
          class="souhaits-ligne"
          :class="{ 'souhaits-ligne--pause': !preference.actif }"
        >
          <div class="souhaits-corps">
            <p class="souhaits-resume">{{ decrirePreference(preference, { nomTournee }) }}</p>
            <p class="souhaits-nature">
              <PhLock v-if="preference.nature === 'DURE'" :size="16" aria-hidden="true" />
              <PhStar v-else :size="16" aria-hidden="true" />
              <span>{{ libelleNaturePreference(preference.nature) }}</span>
              <template v-if="preference.nature === 'SOUPLE'">
                <span aria-hidden="true"> · </span>
                <span>{{ libelleImportance(preference.poids) }}</span>
              </template>
            </p>
            <p v-if="preference.libelle" class="souhaits-libelle">{{ preference.libelle }}</p>
          </div>

          <div class="souhaits-etat">
            <div class="form-check form-switch">
              <input
                :id="'souhait-actif-' + preference.id"
                class="form-check-input"
                type="checkbox"
                role="switch"
                :checked="preference.actif"
                @change="basculer(preference)"
              >
              <label class="form-check-label" :for="'souhait-actif-' + preference.id">
                Pris en compte
              </label>
            </div>
            <span v-if="!preference.actif" class="souhaits-badge-pause">En pause</span>
          </div>

          <div class="souhaits-actions">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="ouvrirEdition(preference)"
            >
              <PhPencilSimple :size="18" aria-hidden="true" />
              <span>Modifier</span>
            </button>
            <button
              type="button"
              class="btn btn-outline-danger"
              @click="demanderSuppression(preference)"
            >
              <PhTrash :size="18" aria-hidden="true" />
              <span>Supprimer</span>
            </button>
          </div>
        </li>
      </ul>

      <FormulairePreference
        :visible="formulaireVisible"
        :preference="preferenceEnCours"
        :tournees-actives="tourneesActives"
        :nom-tournee="nomTournee"
        @enregistrer="onEnregistrer"
        @annuler="onAnnulerFormulaire"
      />

      <DialogueConfirmation
        :visible="confirmationVisible"
        titre="Supprimer ce souhait ?"
        :message="messageConfirmationSuppression"
        libelle-confirmer="Supprimer"
        variante-confirmer="danger"
        @confirmer="onConfirmerSuppression"
        @annuler="onAnnulerSuppression"
      />
    </template>
  </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex';
import {
  PhWarning,
  PhUserMinus,
  PhArrowLeft,
  PhSlidersHorizontal,
  PhPlus,
  PhLock,
  PhStar,
  PhPencilSimple,
  PhTrash,
} from '@phosphor-icons/vue';

import IndicateurSauvegarde from '@/components/communs/IndicateurSauvegarde.vue';
import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import FormulairePreference from '@/components/equipe/FormulairePreference.vue';
import { libelleStatutPersonne, libelleNaturePreference } from '@/domain/libelles.js';
import { decrirePreference, NIVEAUX_IMPORTANCE, poidsVersNiveau } from '@/domain/preferences.js';

/**
 * Écran « Souhaits et contraintes » (feature 0005) : liste les souhaits et
 * contraintes d'**une** personne (paramètre de route `id`) et **orchestre**
 * leur cycle de vie (ajout, édition, suppression, mise en pause) via le
 * store `personnes`. Ne contient **aucune logique métier** : les résumés en
 * clair (`decrirePreference`), les libellés (`libelles.js`) et l'importance
 * en mots (`poidsVersNiveau`/`NIVEAUX_IMPORTANCE`) sont délégués au domaine.
 *
 * Première route paramétrée de l'application (`/equipe/:id/souhaits`) : le
 * `bootstrap` du store hydrate l'état avant le montage, donc `byId(id)`
 * résout correctement même après un rechargement direct sur cette URL. Si
 * l'identifiant est inconnu, seul l'état « personne introuvable » est rendu.
 */
export default {
  name: 'SouhaitsView',
  components: {
    PhWarning,
    PhUserMinus,
    PhArrowLeft,
    PhSlidersHorizontal,
    PhPlus,
    PhLock,
    PhStar,
    PhPencilSimple,
    PhTrash,
    IndicateurSauvegarde,
    DialogueConfirmation,
    FormulairePreference,
  },
  data() {
    return {
      // Pilotage de la modale d'ajout/édition (`preferenceEnCours = null` en
      // création, objet `Preference` en édition).
      formulaireVisible: false,
      preferenceEnCours: null,
      // Pilotage de la confirmation de suppression.
      confirmationVisible: false,
      preferenceASupprimer: null,
      // Distingue une sauvegarde issue d'une vraie action utilisateur d'une
      // sauvegarde héritée de l'hydratation initiale (même logique que
      // EquipeView/ParametresView) : passé à `IndicateurSauvegarde`.
      aEdite: false,
    };
  },
  computed: {
    ...mapGetters('personnes', ['byId']),
    // Alias explicites (objet, pas tableau) pour éviter toute collision de
    // nom avec `byId` de `personnes` ci-dessus : `tourneesActives` alimente
    // `FormulairePreference` (tournées proposables) ; `tourneeParId` sert de
    // résolveur pour `decrirePreference` (voir `nomTournee`), et couvre
    // aussi les tournées **archivées** (le `byId` de `tournees` cherche dans
    // `state.items`, actives et archivées confondues) pour ne jamais
    // afficher la phrase générique par erreur sur un souhait existant.
    ...mapGetters('tournees', { tourneesActives: 'actives', tourneeParId: 'byId' }),
    ...mapState(['statutSauvegarde', 'derniereSauvegarde']),
    /** Identifiant de la personne, lu depuis la route paramétrée. */
    id() {
      return this.$route.params.id;
    },
    /** Personne courante, ou `undefined` si l'identifiant est inconnu. */
    personne() {
      return this.byId(this.id);
    },
    messageConfirmationSuppression() {
      const preference = this.preferenceASupprimer;
      const resume = preference ? this.decrirePreference(preference, { nomTournee: this.nomTournee }) : 'Ce souhait';
      return (
        `« ${resume} » sera définitivement supprimé et ne sera pas conservé. ` +
        'Pour l\'exclure temporairement sans le perdre, préférez « Pris en compte ».'
      );
    },
  },
  methods: {
    ...mapActions('personnes', [
      'ajouterPreference',
      'modifierPreference',
      'supprimerPreference',
      'basculerPreference',
    ]),
    libelleStatutPersonne,
    libelleNaturePreference,
    decrirePreference,

    /**
     * Libellé FR de l'importance (« Peu / Assez / Très important »)
     * correspondant à un `poids` brut (1..10).
     * @param {number} poids
     * @returns {string}
     */
    libelleImportance(poids) {
      const niveau = NIVEAUX_IMPORTANCE.find((n) => n.code === poidsVersNiveau(poids));
      return niveau ? niveau.libelle : '';
    },

    /**
     * Résolveur `id → nom` injecté dans `decrirePreference` pour nommer les
     * tournées d'un souhait `PREFERENCE_TOURNEE` (voir `domain/preferences.js`).
     * Résout via `tournees/byId` (toutes les tournées, actives **et**
     * archivées) pour ne pas retomber sur la phrase générique si la tournée
     * référencée a depuis été archivée. Renvoie `''` si l'id est inconnu.
     * @param {string} id
     * @returns {string}
     */
    nomTournee(id) {
      const tournee = this.tourneeParId(id);
      return tournee ? tournee.libelle : '';
    },

    ouvrirAjout() {
      this.preferenceEnCours = null;
      this.formulaireVisible = true;
    },
    ouvrirEdition(preference) {
      this.preferenceEnCours = preference;
      this.formulaireVisible = true;
    },
    onEnregistrer(champs) {
      // Calculé avant la mutation : distingue une création déclenchée depuis
      // l'état vide (le bouton « Ajouter un souhait » de `.souhaits-etat-vide`
      // disparaît du DOM une fois la liste non vide, voir repli de focus
      // ci-dessous), d'une édition ou d'un ajout depuis une liste déjà
      // peuplée (où `ModaleBase` sait déjà rendre le focus normalement).
      const creationDepuisEtatVide = !this.preferenceEnCours && this.personne.preferences.length === 0;

      if (this.preferenceEnCours) {
        this.modifierPreference({
          personneId: this.id,
          preferenceId: this.preferenceEnCours.id,
          ...champs,
        });
      } else {
        this.ajouterPreference({ personneId: this.id, ...champs });
      }
      this.aEdite = true;
      this.formulaireVisible = false;
      this.preferenceEnCours = null;

      if (creationDepuisEtatVide) {
        // Le bouton d'ajout de l'état vide disparaît du DOM une fois la liste
        // peuplée : `ModaleBase` ne peut donc pas lui rendre le focus. On le
        // repose sur le bouton d'ajout persistant de l'en-tête. Ce bloc ne
        // s'exécutant qu'à la création depuis l'état vide, le retour de focus
        // normal (édition, ajout depuis une liste déjà peuplée) n'est pas
        // perturbé. (Une garde `document.body.contains(document.activeElement)`
        // serait inopérante : au moment du `$nextTick`, la transition de
        // fermeture Bootstrap n'a pas encore retiré la modale du flux.)
        this.$nextTick(() => this.$refs.boutonAjout?.focus());
      }
    },
    onAnnulerFormulaire() {
      this.formulaireVisible = false;
      this.preferenceEnCours = null;
    },

    demanderSuppression(preference) {
      this.preferenceASupprimer = preference;
      this.confirmationVisible = true;
    },
    onConfirmerSuppression() {
      this.supprimerPreference({ personneId: this.id, preferenceId: this.preferenceASupprimer.id });
      this.aEdite = true;
      this.confirmationVisible = false;
      this.preferenceASupprimer = null;
      // Le bouton « Supprimer » déclencheur disparaît du DOM (la ligne quitte
      // la liste) : on replace le focus sur un point stable plutôt que de le
      // laisser retomber sur `<body>` (même précaution qu'EquipeView, 0004).
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
    onAnnulerSuppression() {
      this.confirmationVisible = false;
      this.preferenceASupprimer = null;
    },

    basculer(preference) {
      this.basculerPreference({ personneId: this.id, preferenceId: preference.id });
      this.aEdite = true;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.souhaits-introuvable {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: t.$espace-3;
  padding: t.$espace-6 t.$espace-4;
  margin-top: t.$espace-4;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.souhaits-retour {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;
  margin-bottom: t.$espace-3;
  color: t.$couleur-primaire;
  text-decoration: underline;

  &:hover,
  &:focus-visible {
    color: t.$couleur-primaire-foncee;
  }
}

.souhaits-rappel {
  color: t.$couleur-texte-attenue;
  margin-bottom: t.$espace-4;
}

.souhaits-explication {
  padding: t.$espace-3;
  margin-bottom: t.$espace-4;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-md;
  font-size: t.$taille-texte-petite;

  p {
    display: flex;
    align-items: center;
    gap: t.$espace-2;
  }
}

.souhaits-entete {
  margin-bottom: t.$espace-4;
}

.souhaits-bouton-ajout {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.souhaits-etat-vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: t.$espace-3;
  padding: t.$espace-6 t.$espace-4;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.souhaits-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.souhaits-ligne {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-3;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

// Présentation atténuée d'un souhait mis en pause (en plus du badge texte
// « En pause », jamais la seule couleur pour comprendre l'état).
.souhaits-ligne--pause {
  background-color: t.$couleur-fond-clair;
  color: t.$couleur-texte-attenue;
}

.souhaits-corps {
  flex: 1 1 16rem;
  min-width: 0;
}

.souhaits-resume {
  font-weight: t.$graisse-gras;
  margin-bottom: t.$espace-1;
}

.souhaits-nature {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  margin-bottom: 0;
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.souhaits-libelle {
  margin: t.$espace-1 0 0;
  font-size: t.$taille-texte-petite;
  font-style: italic;
}

.souhaits-etat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: t.$espace-1;
  flex-shrink: 0;
}

.souhaits-badge-pause {
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
  color: t.$couleur-texte-attenue;
}

.souhaits-actions {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-2;
  margin-left: auto;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.btn,
.form-check-input {
  min-height: t.$cible-cliquable-min;
}

.form-check.form-switch {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
  padding-left: 0;

  .form-check-input {
    flex-shrink: 0;
    width: 2.5rem;
    height: 1.5rem;
    min-height: 0;
    margin: 0;
    float: none;
  }

  .form-check-label {
    cursor: pointer;
  }
}
</style>
