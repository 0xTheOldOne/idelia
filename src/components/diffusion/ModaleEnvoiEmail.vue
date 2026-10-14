<template>
  <ModaleBase class="d-print-none" :visible="visible" :titre="titre" @fermeture="onFermeture">
    <!-- Aucune personne active -->
    <template v-if="envoi.etat === 'AUCUNE_PERSONNE'">
      <p>Il n'y a aucune personne active dans l'équipe : personne à qui envoyer le planning.</p>
      <button
        type="button"
        class="btn btn-outline-primary modale-envoi-bouton"
        @click="$emit('aller-equipe')"
      >
        <PhUsers :size="20" aria-hidden="true" />
        <span>Aller à l'équipe</span>
      </button>
    </template>

    <!-- Envoi bloqué : adresses à compléter -->
    <template v-else-if="envoi.etat === 'BLOQUE'">
      <p>
        Pour envoyer le planning à toute l'équipe, chaque personne doit avoir une adresse e-mail
        valide dans sa fiche. Complétez les fiches ci-dessous, puis revenez ici.
      </p>
      <ul class="modale-envoi-manquants">
        <li v-for="p in envoi.sansEmail" :key="p.personneId" class="modale-envoi-manquant">
          <span class="modale-envoi-manquant-texte">
            <strong>{{ p.nomComplet }}</strong>
            <template v-if="p.raison === 'INVALIDE'">
              — adresse à corriger : « {{ p.emailSaisi }} »</template
            >
            <template v-else> — pas d'adresse e-mail</template>
          </span>
          <button
            type="button"
            class="btn btn-outline-primary btn-sm modale-envoi-bouton modale-envoi-completer"
            :aria-label="`${p.raison === 'INVALIDE' ? 'Corriger' : 'Compléter'} la fiche de ${p.nomComplet}`"
            @click="$emit('completer-fiche', p.personneId)"
          >
            <PhPencilSimple :size="16" aria-hidden="true" />
            <span>{{ p.raison === 'INVALIDE' ? 'Corriger la fiche' : 'Compléter la fiche' }}</span>
          </button>
        </li>
      </ul>
      <p class="text-muted mb-0">Les personnes archivées ne sont pas concernées.</p>
    </template>

    <!-- Prêt -->
    <template v-else>
      <p>
        Le message sera envoyé à {{ nbAdresses }}
        {{ nbAdresses > 1 ? 'personnes' : 'personne' }}, en copie cachée (chacune reçoit le
        planning sans voir les adresses des autres) : {{ nomsTexte }}.
      </p>

      <ol class="modale-envoi-etapes">
        <li>
          Si ce n'est pas déjà fait, enregistrez le planning en PDF : fermez cette fenêtre, cliquez
          sur « Imprimer », choisissez « Enregistrer au format PDF », puis revenez cliquer sur
          l'enveloppe. Le fichier s'appelle « {{ envoi.nomFichierPdf }} ».
        </li>
        <li>
          Cliquez sur « Ouvrir ma messagerie » : un message prêt à partir s'ouvre (objet
          « {{ envoi.objet }} »).
        </li>
        <li>Joignez le fichier PDF au message (trombone « Joindre »), puis envoyez.</li>
      </ol>

      <div v-if="envoi.tropLong" class="alert alert-warning" role="alert">
        Il y a trop d'adresses pour les remplir automatiquement. Cliquez sur « Copier les
        adresses », puis collez-les dans le champ « Cci » (copie cachée) du message.
      </div>

      <div v-else class="alert alert-info modale-envoi-info">
        <PhInfo :size="20" class="flex-shrink-0" aria-hidden="true" />
        <span>
          Rien ne s'ouvre, ou vous utilisez une messagerie en ligne (Gmail, Orange, Outlook.com…) ?
          Cliquez sur « Copier les adresses », puis collez-les dans le champ « Cci » (copie cachée)
          d'un nouveau message.
        </span>
      </div>

      <p class="modale-envoi-statut" role="status" aria-live="polite">{{ messageEtat }}</p>

      <textarea
        v-if="selectionManuelle"
        ref="adresses"
        class="form-control modale-envoi-adresses"
        rows="3"
        readonly
        aria-label="Adresses de l'équipe"
        :value="envoi.adressesTexte"
      />
    </template>

    <template #pied>
      <button
        v-if="envoi.etat === 'PRET'"
        type="button"
        class="btn btn-outline-secondary modale-envoi-bouton modale-envoi-copier"
        @click="copier"
      >
        <PhCopy :size="20" aria-hidden="true" />
        <span>Copier les adresses</span>
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary modale-envoi-bouton"
        data-bs-dismiss="modal"
      >
        Fermer
      </button>
      <a
        v-if="envoi.etat === 'PRET'"
        class="btn btn-primary modale-envoi-bouton modale-envoi-ouvrir"
        :href="envoi.tropLong ? envoi.urlSansAdresses : envoi.url"
        @click="onOuvrir"
      >
        <PhEnvelopeSimple :size="20" aria-hidden="true" />
        <span>Ouvrir ma messagerie</span>
      </a>
    </template>
  </ModaleBase>
</template>

<script>
import { PhCopy, PhEnvelopeSimple, PhInfo, PhPencilSimple, PhUsers } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import { copierTexte } from '@/adaptateurs/pressePapiers.js';

/**
 * Modale d'envoi du planning par e-mail (feature 0027). Présentation seule :
 * ni store ni routeur, tout est calculé par `preparerEnvoiEmail` (domaine) et
 * reçu en prop. Trois états : prêt (étapes, lien « Ouvrir ma messagerie »,
 * copie des adresses), bloqué (personnes à compléter) et aucune personne.
 * Les navigations sont déléguées au parent via les événements.
 */
export default {
  name: 'ModaleEnvoiEmail',
  components: { ModaleBase, PhCopy, PhEnvelopeSimple, PhInfo, PhPencilSimple, PhUsers },
  props: {
    /** Affiche la modale (source de vérité côté parent). */
    visible: { type: Boolean, required: true },
    /** Résultat de `preparerEnvoiEmail`. */
    envoi: { type: Object, required: true },
  },
  emits: ['fermeture', 'completer-fiche', 'aller-equipe'],
  data() {
    return {
      // Message de la zone d'état (copie, ouverture de la messagerie). Volatil.
      messageEtat: '',
      // Affiche les adresses sélectionnées si la copie automatique échoue.
      selectionManuelle: false,
    };
  },
  computed: {
    titre() {
      return this.envoi.etat === 'BLOQUE'
        ? 'Il manque des adresses e-mail'
        : 'Envoyer le planning par e-mail';
    },
    nbAdresses() {
      return this.envoi.adresses.length;
    },
    /** Noms des destinataires en liste française « A, B et C ». */
    nomsTexte() {
      const noms = this.envoi.destinataires.map((d) => d.nomComplet);
      if (noms.length <= 1) return noms.join('');
      return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`;
    },
  },
  watch: {
    visible(estVisible) {
      if (estVisible) this.reinitialiser();
    },
  },
  methods: {
    reinitialiser() {
      this.messageEtat = '';
      this.selectionManuelle = false;
    },
    onFermeture() {
      this.reinitialiser();
      this.$emit('fermeture');
    },
    onOuvrir() {
      this.messageEtat =
        "Si votre messagerie ne s'est pas ouverte, utilisez « Copier les adresses ».";
    },
    async copier() {
      const ok = await copierTexte(this.envoi.adressesTexte);
      if (ok) {
        this.selectionManuelle = false;
        const n = this.nbAdresses;
        this.messageEtat = `${n} ${n > 1 ? 'adresses copiées' : 'adresse copiée'}. Collez-les dans le champ « Cci » de votre message.`;
        return;
      }
      this.messageEtat =
        "La copie automatique n'a pas fonctionné. Sélectionnez les adresses ci-dessous et copiez-les (Ctrl+C).";
      this.selectionManuelle = true;
      await this.$nextTick();
      const zone = this.$refs.adresses;
      if (zone) {
        zone.focus();
        zone.select();
      }
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.modale-envoi-bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
}

.modale-envoi-manquants {
  padding-left: 0;
  list-style: none;
}

.modale-envoi-manquant {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: t.$espace-2;
  padding: t.$espace-2 0;
}

.modale-envoi-manquant-texte {
  flex: 1 1 14rem;
}

.modale-envoi-completer {
  margin-left: auto;
}

.modale-envoi-etapes li {
  margin-bottom: t.$espace-2;
}

.modale-envoi-info {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-2;
}

.modale-envoi-statut {
  min-height: 1.5em;
  margin-bottom: t.$espace-2;
}

.modale-envoi-adresses {
  min-height: 5rem;
}
</style>
