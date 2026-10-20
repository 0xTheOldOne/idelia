<template>
  <DialogueConfirmation
    :visible="!!fichierSauvegardeIntrouvable"
    titre="Fichier de sauvegarde introuvable"
    :message="message"
    libelle-confirmer="Choisir un nouveau fichier"
    libelle-annuler="Continuer sans fichier"
    variante-confirmer="primary"
    @confirmer="onChoisirNouveau"
    @annuler="acquitterFichierIntrouvable"
  />
</template>

<script>
import { mapActions, mapState } from 'vuex';
import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';

/**
 * Fenêtre affichée une seule fois quand le fichier de sauvegarde mémorisé a
 * disparu (déplacé, renommé, supprimé) — feature 0032, ADR 0021. Rassure
 * d'abord (les données sont conservées dans le navigateur) puis propose de
 * choisir un nouveau fichier ou de continuer sans. Composant conteneur monté
 * une fois dans `App.vue`.
 */
export default {
  name: 'ModaleFichierSauvegardeIntrouvable',
  components: { DialogueConfirmation },
  computed: {
    ...mapState('ui', ['fichierSauvegardeIntrouvable', 'nomFichierSauvegarde']),

    message() {
      return (
        `Idelia ne trouve plus votre fichier de sauvegarde « ${this.fichierSauvegardeIntrouvable} » : `
        + 'il a peut-être été déplacé, renommé ou supprimé. Vos données ne sont pas perdues, '
        + 'elles sont toujours enregistrées dans ce navigateur. Choisissez un nouveau fichier '
        + 'pour que la sauvegarde continue. Sinon, un simple rappel vous invitera à enregistrer '
        + 'vous-même une sauvegarde ; vous pourrez choisir un fichier plus tard dans Paramètres.'
      );
    },
  },
  methods: {
    ...mapActions('ui', ['acquitterFichierIntrouvable']),
    ...mapActions(['activerSauvegardeFichier']),
    ...mapActions('notifications', ['notifier']),

    /**
     * Ferme la fenêtre puis ouvre le sélecteur de fichier dans le même geste
     * de clic (exigé par le navigateur). Messages identiques à ceux de
     * `BlocSauvegardeAutomatique.onChoisirFichier`.
     */
    async onChoisirNouveau() {
      this.acquitterFichierIntrouvable();
      const resultat = await this.activerSauvegardeFichier();
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
  },
};
</script>
