<template>
  <div class="bloc-sauvegarde-automatique">
    <div class="bloc-sauvegarde-automatique__pedagogie">
      <PhClockCountdown :size="24" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">{{ texteExplicatif }}</p>
    </div>

    <div class="form-check form-switch bloc-sauvegarde-automatique__interrupteur">
      <input
        id="sauvegarde-auto-active"
        class="form-check-input"
        type="checkbox"
        role="switch"
        :checked="sauvegardeAutoActive"
        @change="onActiveChange"
      >
      <label class="form-check-label" for="sauvegarde-auto-active">
        Activer la sauvegarde automatique
      </label>
    </div>

    <div class="bloc-sauvegarde-automatique__frequence">
      <label for="sauvegarde-auto-intervalle" class="form-label">Fréquence</label>
      <select
        id="sauvegarde-auto-intervalle"
        class="form-select bloc-sauvegarde-automatique__select"
        :value="sauvegardeAutoIntervalleMinutes"
        :disabled="!sauvegardeAutoActive"
        @change="onIntervalleChange"
      >
        <option v-for="minutes in FREQUENCES" :key="minutes" :value="minutes">
          Toutes les {{ minutes }} minutes
        </option>
      </select>
    </div>

    <!-- Fichier de sauvegarde actif (File System Access API, Chrome/Edge
         uniquement) : masqué, jamais grisé, sur les navigateurs incompatibles. -->
    <div v-if="compatible" class="bloc-sauvegarde-automatique__fichier">
      <h3 class="bloc-sauvegarde-automatique__soustitre">Fichier de sauvegarde actif</h3>

      <template v-if="!fichierSauvegardeActif">
        <button
          type="button"
          class="btn btn-outline-secondary bloc-sauvegarde-automatique__bouton"
          :disabled="activationEnCours"
          @click="onChoisirFichier"
        >
          <PhFile :size="20" aria-hidden="true" />
          <span>Choisir un fichier de sauvegarde</span>
        </button>
        <p class="bloc-sauvegarde-automatique__aide">
          Idelia écrira directement dans le fichier choisi, à chaque enregistrement et lors des
          sauvegardes automatiques, sans redemander à chaque fois.
        </p>
      </template>

      <template v-else>
        <p class="bloc-sauvegarde-automatique__statut" role="status" aria-live="polite">
          <PhCheckCircle :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
          <span>
            Fichier actif : « {{ nomFichierSauvegarde }} » — Dernière écriture le
            {{ texteDerniereEcriture }}
          </span>
        </p>
        <div class="bloc-sauvegarde-automatique__actions-fichier">
          <button
            type="button"
            class="btn btn-outline-secondary bloc-sauvegarde-automatique__bouton"
            :disabled="activationEnCours"
            @click="onChoisirFichier"
          >
            <PhArrowsClockwise :size="20" aria-hidden="true" />
            <span>Changer de fichier</span>
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary bloc-sauvegarde-automatique__bouton"
            @click="onDesactiverFichier"
          >
            <PhProhibit :size="20" aria-hidden="true" />
            <span>Désactiver</span>
          </button>
        </div>

        <p class="bloc-sauvegarde-automatique__aide bloc-sauvegarde-automatique__rappel-session">
          Ce choix est valable pour cette session&nbsp;: après avoir rechargé la page, choisissez à
          nouveau votre fichier pour continuer à l'utiliser.
        </p>
      </template>
    </div>
  </div>
</template>

<script>
import { mapActions, mapState } from 'vuex';
import {
  PhClockCountdown,
  PhFile,
  PhArrowsClockwise,
  PhProhibit,
  PhCheckCircle,
} from '@phosphor-icons/vue';

import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Bloc « Sauvegarde automatique » de l'écran Paramètres (feature 0019) :
 * réglage d'activation/fréquence d'un rappel (Bloc 1, tous navigateurs) et,
 * sur Chrome/Edge, gestion du « fichier de sauvegarde actif » (Bloc 2, File
 * System Access API, ADR 0018).
 *
 * Composant **conteneur**, sur le modèle de `BlocSauvegarde.vue` : dispatche
 * les actions, affiche leur résultat, aucune logique métier.
 *
 * La détection `compatible` (capacité du navigateur à écrire un fichier via
 * la File System Access API) masque entièrement le Bloc 2 sur Firefox/Safari
 * — jamais grisé, pour éviter la frustration d'un bouton qui ne peut jamais
 * fonctionner sur ce navigateur.
 */
export default {
  name: 'BlocSauvegardeAutomatique',
  components: { PhClockCountdown, PhFile, PhArrowsClockwise, PhProhibit, PhCheckCircle },
  data() {
    return {
      /** Liste fermée de fréquences proposées, en minutes. */
      FREQUENCES: [5, 10, 15, 30, 60],
      /** Détection de capacité navigateur (pas une règle métier). */
      compatible: 'showSaveFilePicker' in window,
      /** `true` pendant l'`await` du choix de fichier (désactive le bouton). */
      activationEnCours: false,
    };
  },
  computed: {
    ...mapState('ui', [
      'sauvegardeAutoActive',
      'sauvegardeAutoIntervalleMinutes',
      'fichierSauvegardeActif',
      'nomFichierSauvegarde',
      'dernierFichierEnregistreLe',
    ]),

    texteExplicatif() {
      if (!this.compatible) {
        return "Ce navigateur ne permet pas d'écrire un fichier automatiquement : un rappel s'affichera pour vous inviter à enregistrer vous-même une sauvegarde.";
      }
      if (this.fichierSauvegardeActif) {
        return (
          `Toutes les ${this.sauvegardeAutoIntervalleMinutes} minutes, Idelia réécrit `
          + `automatiquement votre fichier « ${this.nomFichierSauvegarde} », sans rien vous `
          + 'demander.'
        );
      }
      return "Activez un fichier de sauvegarde ci-dessous pour une sauvegarde silencieuse ; en attendant, un rappel s'affichera.";
    },

    texteDerniereEcriture() {
      if (!this.dernierFichierEnregistreLe) return 'jamais encore';
      return dateUtil.formatHorodatageFr(this.dernierFichierEnregistreLe);
    },
  },
  methods: {
    ...mapActions('ui', ['configurerSauvegardeAuto']),
    ...mapActions(['activerSauvegardeFichier', 'desactiverSauvegardeFichier']),
    ...mapActions('notifications', ['notifier']),

    onActiveChange(event) {
      this.configurerSauvegardeAuto({
        active: event.target.checked,
        intervalleMinutes: this.sauvegardeAutoIntervalleMinutes,
      });
    },

    onIntervalleChange(event) {
      this.configurerSauvegardeAuto({
        active: this.sauvegardeAutoActive,
        intervalleMinutes: Number(event.target.value),
      });
    },

    /** Ouvre le sélecteur de fichier natif (choix initial ou changement). */
    async onChoisirFichier() {
      this.activationEnCours = true;
      const resultat = await this.activerSauvegardeFichier();
      this.activationEnCours = false;
      if (resultat.annule) return; // l'utilisateur a juste changé d'avis
      if (resultat.ok) {
        this.notifier({
          type: 'succes',
          message: `Fichier de sauvegarde actif : « ${this.nomFichierSauvegarde} ».`,
        });
      } else {
        this.notifier({ type: 'avertissement', message: resultat.message });
      }
    },

    /** Désactive le fichier actif et confirme le geste par un toast neutre. */
    onDesactiverFichier() {
      this.desactiverSauvegardeFichier();
      this.notifier({ type: 'info', message: 'Fichier de sauvegarde désactivé.' });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.bloc-sauvegarde-automatique__pedagogie {
  display: flex;
  gap: t.$espace-2;
  margin-bottom: t.$espace-4;
  color: t.$couleur-texte-attenue;
}

.bloc-sauvegarde-automatique__interrupteur {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
  padding-left: 0;
  margin-bottom: t.$espace-3;

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

.bloc-sauvegarde-automatique__select {
  max-width: 20rem;
  min-height: t.$cible-cliquable-min;
}

.bloc-sauvegarde-automatique__fichier {
  padding-top: t.$espace-4;
  margin-top: t.$espace-4;
  border-top: 1px solid t.$couleur-bordure;
}

.bloc-sauvegarde-automatique__soustitre {
  margin: 0 0 t.$espace-2;
  font-size: t.$taille-texte-base;
  font-weight: t.$graisse-gras;
}

.bloc-sauvegarde-automatique__statut {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin: 0 0 t.$espace-3;
}

.bloc-sauvegarde-automatique__actions-fichier {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-2;
}

.bloc-sauvegarde-automatique__bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.bloc-sauvegarde-automatique__aide {
  margin: t.$espace-2 0 0;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.bloc-sauvegarde-automatique__rappel-session {
  margin-top: t.$espace-3;
}
</style>
