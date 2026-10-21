<template>
  <div class="equipe-view">
    <div
      v-if="statutSauvegarde === 'ERREUR_CHARGEMENT'"
      class="alert alert-warning d-flex gap-2"
      role="alert"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Les personnes enregistrées n'ont pas pu être relues ; la liste affichée peut être
        incomplète. Une copie de sauvegarde a été conservée. Rechargez la page pour réessayer ; si
        le problème persiste, réimportez une sauvegarde.
      </p>
    </div>

    <router-link
      v-if="planningRetour"
      class="equipe-retour"
      :to="{ name: 'diffusion', params: { id: planningRetour.id }, query: { envoi: '1' } }"
    >
      <PhArrowLeft :size="18" aria-hidden="true" />
      <span>Retour à l'envoi du planning</span>
    </router-link>

    <div class="equipe-entete">
      <h1>Équipe</h1>
      <button
        ref="boutonAjout"
        type="button"
        class="btn btn-primary equipe-bouton-ajout"
        @click="ouvrirAjout"
      >
        <PhUserPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une personne</span>
      </button>
    </div>

    <div v-if="aucunePersonne" class="equipe-etat-vide">
      <PhUsers :size="48" aria-hidden="true" />
      <p class="mb-0">
        Aucune personne pour l'instant. Ajoutez la première pour composer votre équipe.
      </p>
      <button type="button" class="btn btn-primary equipe-bouton-ajout" @click="ouvrirAjout">
        <PhUserPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Ajouter une personne</span>
      </button>
    </div>

    <template v-else>
      <section class="equipe-section">
        <h2 class="equipe-titre-section">Personnes de l'équipe</h2>

        <ul v-if="actifsTries.length" class="equipe-liste">
          <li v-for="personne in actifsTries" :key="personne.id" class="equipe-ligne">
            <span
              class="equipe-pastille"
              :style="stylePastille(personne)"
              aria-hidden="true"
            >{{ repere(personne) }}</span>
            <div class="equipe-identite">
              <span class="equipe-nom">{{ personne.prenom }} {{ personne.nom }}</span>
              <span class="equipe-details">
                {{ libelleStatutPersonne(personne.statut) }} · {{ personne.quotite }} %
                <template v-if="libelleRythme(personne)"> · {{ libelleRythme(personne) }}</template>
                <template v-if="periodeTexte(personne)"> · {{ periodeTexte(personne) }}</template>
                <template v-if="libelleRemplacement(personne, toutesLesPersonnes)"> · {{ libelleRemplacement(personne, toutesLesPersonnes) }}</template>
              </span>
            </div>
            <div class="equipe-actions">
              <button
                type="button"
                class="btn btn-outline-secondary equipe-bouton-icone"
                title="Modifier la fiche"
                :aria-label="`Modifier la fiche de ${nomComplet(personne)}`"
                @click="ouvrirEdition(personne)"
              >
                <PhPencilSimple :size="18" aria-hidden="true" />
                <span class="d-md-none" aria-hidden="true">Modifier</span>
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary equipe-bouton-icone equipe-bouton-informations"
                title="Informations utiles"
                :aria-label="`Informations utiles de ${nomComplet(personne)}`"
                @click="ouvrirInformations(personne)"
              >
                <PhIdentificationCard :size="18" aria-hidden="true" />
                <span class="d-md-none" aria-hidden="true">Informations utiles</span>
              </button>
              <router-link
                class="btn btn-outline-secondary equipe-bouton-icone"
                title="Souhaits"
                :aria-label="`Souhaits de ${nomComplet(personne)}`"
                :to="{ name: 'souhaits', params: { id: personne.id } }"
              >
                <PhShootingStar :size="18" aria-hidden="true" />
                <span class="d-md-none" aria-hidden="true">Souhaits</span>
              </router-link>
              <button
                type="button"
                class="btn btn-outline-danger equipe-bouton-icone equipe-bouton-archiver"
                title="Archiver"
                :aria-label="`Archiver ${nomComplet(personne)}`"
                @click="demanderArchivage(personne)"
              >
                <PhArchive :size="18" aria-hidden="true" />
                <span class="d-md-none" aria-hidden="true">Archiver</span>
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="equipe-texte-explication">Aucune personne active pour le moment.</p>
      </section>

      <section v-if="inactifs.length" class="equipe-section">
        <h2 class="equipe-titre-section">
          <button
            type="button"
            class="btn btn-link equipe-bascule"
            :aria-expanded="archivesOuvertes ? 'true' : 'false'"
            aria-controls="equipe-liste-archivees"
            @click="archivesOuvertes = !archivesOuvertes"
          >
            <PhCaretRight
              :size="18"
              weight="bold"
              class="equipe-bascule-icone"
              :class="{ 'equipe-bascule-icone--ouvert': archivesOuvertes }"
              aria-hidden="true"
            />
            <span>Personnes archivées ({{ inactifs.length }})</span>
          </button>
        </h2>

        <div v-show="archivesOuvertes" id="equipe-liste-archivees">
          <p class="equipe-texte-explication">
            Les personnes archivées sont conservées pour l'historique des plannings.
          </p>

          <ul class="equipe-liste equipe-liste--archivee">
            <li v-for="personne in inactifsTries" :key="personne.id" class="equipe-ligne">
              <span
                class="equipe-pastille"
                :style="stylePastille(personne)"
                aria-hidden="true"
              >{{ repere(personne) }}</span>
              <div class="equipe-identite">
                <span class="equipe-nom">{{ personne.prenom }} {{ personne.nom }}</span>
                <span class="equipe-details">
                  {{ libelleStatutPersonne(personne.statut) }} · {{ personne.quotite }} %
                </span>
              </div>
              <div class="equipe-actions">
                <button
                type="button"
                class="btn btn-outline-secondary equipe-bouton-icone equipe-bouton-informations"
                title="Informations utiles"
                :aria-label="`Informations utiles de ${nomComplet(personne)}`"
                @click="ouvrirInformations(personne)"
              >
                <PhIdentificationCard :size="18" aria-hidden="true" />
                <span class="d-md-none" aria-hidden="true">Informations utiles</span>
              </button>
                <button
                type="button"
                class="btn btn-outline-secondary equipe-bouton-icone"
                title="Restaurer"
                :aria-label="`Restaurer ${nomComplet(personne)}`"
                @click="restaurer(personne)"
              >
                <PhArrowCounterClockwise :size="18" aria-hidden="true" />
                <span class="d-md-none" aria-hidden="true">Restaurer</span>
              </button>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </template>

    <FormulairePersonne
      :visible="formulaireVisible"
      :personne="personneEnCours"
      :couleurs-suggerees="parametres.couleursParDefaut"
      :personnes="toutesLesPersonnes"
      :champ-initial="champInitial"
      @enregistrer="onEnregistrer"
      @annuler="onAnnulerFormulaire"
    />

    <ModaleInformationsUtiles
      :visible="informationsVisible"
      :personne="personneInformations"
      :modifiable="personneInformations?.actif !== false"
      @fermeture="onFermetureInformations"
      @modifier="onModifierDepuisInformations"
    />

    <DialogueConfirmation
      :visible="confirmationVisible"
      :titre="titreConfirmationArchivage"
      :message="messageConfirmationArchivage"
      libelle-confirmer="Archiver"
      variante-confirmer="primary"
      @confirmer="onConfirmerArchivage"
      @annuler="onAnnulerArchivage"
    />
  </div>
</template>

<script>
import { mapGetters, mapActions, mapState } from 'vuex';
import {
  PhWarning,
  PhUserPlus,
  PhUsers,
  PhPencilSimple,
  PhArchive,
  PhArrowCounterClockwise,
  PhCaretRight,
  PhShootingStar,
  PhArrowLeft,
  PhIdentificationCard,
} from '@phosphor-icons/vue';

import DialogueConfirmation from '@/components/communs/DialogueConfirmation.vue';
import FormulairePersonne from '@/components/equipe/FormulairePersonne.vue';
import ModaleInformationsUtiles from '@/components/equipe/ModaleInformationsUtiles.vue';
import { libelleStatutPersonne } from '@/domain/libelles.js';
import {
  reperePersonne,
  couleurTexteRepere,
  libelleRythme,
  libelleRemplacement,
} from '@/domain/personnes.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Écran « Équipe » (feature 0004) : liste les personnes du cabinet et
 * **orchestre** leur cycle de vie (ajout, édition, archivage, restauration)
 * via le store `personnes`. Ne contient **aucune logique métier** : la
 * construction/normalisation d'une personne est déléguée au domaine
 * (`creerPersonne`, appelé par l'action `personnes/ajouter`) ; le tri
 * (titulaires puis remplaçantes, puis alphabétique) n'est qu'un choix de
 * présentation local à l'écran.
 *
 * Consultation (feature 0030) : « Informations utiles » (personnes actives et
 * archivées) ouvre `ModaleInformationsUtiles` ; « Modifier ces informations »
 * ferme d'abord la consultation, puis ouvre la fiche sur l'onglet
 * professionnel (`champInitial: 'identifiants'`) après l'événement de fermeture.
 *
 * Liens profonds (feature 0027, envoi du planning par e-mail), paramètres
 * d'URL de `/equipe` :
 * - `?modifier=<personneId>` : ouvre la fiche de cette personne **active**,
 *   curseur dans le champ e-mail. Id inconnu ou personne archivée : ignoré
 *   sans message. Le paramètre est retiré de l'URL après lecture (pas de
 *   réouverture au rechargement).
 * - `&champ=remplacement` (feature 0036, avec `modifier`) : curseur dans
 *   « Remplace en priorité » au lieu de l'e-mail ; toute autre valeur est
 *   ignorée (liste blanche). Retiré de l'URL avec `modifier`.
 * - `?retour=<planningId>` : si ce planning existe dans le store, affiche le
 *   lien « Retour à l'envoi du planning » vers `/planning/<id>/diffusion?envoi=1`
 *   (la modale d'envoi s'y rouvre). La valeur n'est JAMAIS utilisée comme URL :
 *   c'est seulement une clé de recherche, la route cible est construite ici
 *   (route nommée interne), donc aucune redirection ouverte possible. Elle est
 *   conservée dans l'URL après l'enregistrement de la fiche.
 */
export default {
  name: 'EquipeView',
  components: {
    PhWarning,
    PhUserPlus,
    PhUsers,
    PhPencilSimple,
    PhArchive,
    PhArrowCounterClockwise,
    PhCaretRight,
    PhShootingStar,
    PhArrowLeft,
    PhIdentificationCard,
    DialogueConfirmation,
    ModaleInformationsUtiles,
    FormulairePersonne,
  },
  data() {
    return {
      // Pilotage de la modale d'ajout/édition (`personneEnCours = null` en
      // création, objet `Personne` en édition).
      formulaireVisible: false,
      personneEnCours: null,
      // Champ qui reçoit le focus à l'ouverture de la fiche ('prenom' | 'email').
      champInitial: 'prenom',
      // Consultation « Informations utiles » (feature 0030) ; le drapeau
      // enchaîne vers la fiche une fois la consultation totalement fermée
      // (Bootstrap n'affiche qu'une modale à la fois).
      informationsVisible: false,
      personneInformations: null,
      ficheApresInformations: false,
      // Pilotage de la confirmation d'archivage.
      confirmationVisible: false,
      personneAArchiver: null,
      // Section « Personnes archivées » repliée par défaut (bascule Vue
      // simple, sans JS `collapse` de Bootstrap).
      archivesOuvertes: false,
    };
  },
  computed: {
    ...mapGetters('personnes', ['actifs', 'inactifs']),
    ...mapGetters('cabinet', ['parametres']),
    ...mapGetters('plannings', { planningParId: 'byId' }),
    ...mapState(['statutSauvegarde']),
    /** Planning de `?retour=` s'il existe (sinon `undefined` : pas de lien). */
    planningRetour() {
      const id = this.$route.query.retour;
      return typeof id === 'string' ? this.planningParId(id) : undefined;
    },
    aucunePersonne() {
      return this.actifs.length === 0 && this.inactifs.length === 0;
    },
    /** Actives + archivées : l'unicité des initiales Vega les couvre toutes. */
    toutesLesPersonnes() {
      return [...this.actifs, ...this.inactifs];
    },
    actifsTries() {
      return [...this.actifs].sort(this.comparerPersonnes);
    },
    inactifsTries() {
      return [...this.inactifs].sort(this.comparerPersonnes);
    },
    titreConfirmationArchivage() {
      const personne = this.personneAArchiver;
      return personne ? `Archiver ${personne.prenom} ${personne.nom} ?` : 'Archiver cette personne ?';
    },
    messageConfirmationArchivage() {
      const personne = this.personneAArchiver;
      const nom = personne ? `${personne.prenom} ${personne.nom}` : 'Cette personne';
      return (
        `${nom} sera retirée de la liste des personnes actives, mais restera conservée : ` +
        'vous pourrez la restaurer à tout moment depuis « Personnes archivées ». ' +
        'Aucune donnée n\'est supprimée.'
      );
    },
  },
  watch: {
    '$route.query.modifier'() {
      this.ouvrirDepuisLien();
    },
  },
  mounted() {
    this.ouvrirDepuisLien();
  },
  methods: {
    /**
     * Lien profond `?modifier=<personneId>` : ouvre la fiche de la personne
     * active correspondante, focus sur l'e-mail. Le paramètre est ensuite
     * retiré de l'URL (`retour` est conservé).
     */
    ouvrirDepuisLien() {
      const id = this.$route.query.modifier;
      if (id === undefined) return;
      const personne = typeof id === 'string' ? this.actifs.find((p) => p.id === id) : undefined;
      if (personne) {
        this.personneEnCours = personne;
        // Liste blanche : toute valeur de `champ` autre que 'remplacement' → e-mail.
        this.champInitial = this.$route.query.champ === 'remplacement' ? 'remplacement' : 'email';
        this.formulaireVisible = true;
      }
      this.$router.replace({ query: { ...this.$route.query, modifier: undefined, champ: undefined } });
    },
    /** Initiales affichées dans la pastille d'une personne. */
    repere(personne) {
      return reperePersonne(personne);
    },
    /** Fond + couleur de texte lisible de la pastille. */
    stylePastille(personne) {
      return { backgroundColor: personne.couleur, color: couleurTexteRepere(personne.couleur) };
    },
    ...mapActions('personnes', ['ajouter', 'modifier', 'desactiver', 'reactiver']),
    libelleStatutPersonne,
    libelleRythme,
    libelleRemplacement,

    /**
     * Ordre d'affichage (présentation uniquement, `ordreAffichage` n'est pas
     * utilisé en 0004) : titulaires avant remplaçantes, puis nom puis prénom,
     * comparaison locale française.
     * @param {object} a
     * @param {object} b
     * @returns {number}
     */
    comparerPersonnes(a, b) {
      return (
        Number(a.statut !== 'TITULAIRE') - Number(b.statut !== 'TITULAIRE') ||
        a.nom.localeCompare(b.nom, 'fr') ||
        a.prenom.localeCompare(b.prenom, 'fr')
      );
    },

    /**
     * Période de présence lisible, au format FR `JJ/MM/AAAA` (via
     * `dateUtil.formatDateFr`, aucun objet `Date` manipulé ici, KISS).
     * @param {{ dateEntree: ?string, dateSortie: ?string }} personne
     * @returns {string} Texte de période, ou chaîne vide si aucune date renseignée.
     */
    periodeTexte(personne) {
      const { dateEntree, dateSortie } = personne;
      const entree = dateUtil.formatDateFr(dateEntree);
      const sortie = dateUtil.formatDateFr(dateSortie);
      if (entree && sortie) return `du ${entree} au ${sortie}`;
      if (entree) return `depuis le ${entree}`;
      if (sortie) return `jusqu'au ${sortie}`;
      return '';
    },

    ouvrirAjout() {
      this.personneEnCours = null;
      this.champInitial = 'prenom';
      this.formulaireVisible = true;
    },
    ouvrirEdition(personne, champ = 'prenom') {
      this.personneEnCours = personne;
      this.champInitial = champ;
      this.formulaireVisible = true;
    },
    /** Nom complet, pour les noms accessibles des boutons de ligne. */
    nomComplet(personne) {
      return `${personne.prenom} ${personne.nom}`;
    },
    ouvrirInformations(personne) {
      this.personneInformations = personne;
      this.informationsVisible = true;
    },
    onModifierDepuisInformations() {
      this.ficheApresInformations = true;
      this.informationsVisible = false;
    },
    /** Appelé quand la fermeture de la consultation est terminée. */
    onFermetureInformations() {
      this.informationsVisible = false;
      if (this.ficheApresInformations) {
        this.ficheApresInformations = false;
        this.ouvrirEdition(this.personneInformations, 'identifiants');
      }
    },
    onEnregistrer(champs) {
      const estCreation = !this.personneEnCours;
      if (this.personneEnCours) {
        this.modifier({ id: this.personneEnCours.id, ...champs });
      } else {
        this.ajouter(champs);
      }
      this.formulaireVisible = false;
      this.personneEnCours = null;
      if (estCreation) {
        // Depuis l'état vide, le bouton « Ajouter une personne » qui a ouvert
        // la modale disparaît du DOM en même temps que l'état vide (la liste
        // n'est plus vide) : `ModaleBase` ne peut alors pas lui restaurer le
        // focus à la fermeture, qui retombe sur `<body>`. On le replace donc
        // nous-mêmes sur le bouton d'en-tête. Sans effet en édition : le
        // bouton « Modifier » déclencheur reste dans le DOM et `ModaleBase`
        // lui restaure normalement le focus (après le nôtre, donc prioritaire).
        this.$nextTick(() => this.$refs.boutonAjout?.focus());
      }
    },
    onAnnulerFormulaire() {
      this.formulaireVisible = false;
      this.personneEnCours = null;
    },

    demanderArchivage(personne) {
      this.personneAArchiver = personne;
      this.confirmationVisible = true;
    },
    onConfirmerArchivage() {
      this.desactiver(this.personneAArchiver.id);
      this.confirmationVisible = false;
      this.personneAArchiver = null;
      // Le bouton « Archiver » déclencheur disparaît du DOM (la personne
      // quitte la liste des actifs) : on replace le focus sur un point
      // stable plutôt que de le laisser retomber sur `<body>`.
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
    onAnnulerArchivage() {
      this.confirmationVisible = false;
      this.personneAArchiver = null;
    },

    restaurer(personne) {
      this.reactiver(personne.id);
      // Idem : si c'était la dernière personne archivée, toute la section
      // disparaît (`v-if="inactifs.length"`) et le bouton « Restaurer »
      // déclencheur avec elle.
      this.$nextTick(() => this.$refs.boutonAjout?.focus());
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.equipe-retour {
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

.equipe-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
}

.equipe-bouton-ajout {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

// Actions de ligne en icône seule (libellé écrit sous `md`, voir gabarit).
.equipe-bouton-icone {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: t.$espace-1;
  min-width: t.$cible-cliquable-min;
  line-height: 1;
}

// « Archiver » retire la personne de la liste active : écarté des autres actions
// (en plus de sa couleur), relecture ui-ux 0030.
.equipe-bouton-archiver {
  margin-left: t.$espace-3;
}

.equipe-etat-vide {
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

.equipe-section {
  margin-bottom: t.$espace-5;
}

.equipe-titre-section {
  margin-bottom: t.$espace-3;
}

.equipe-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.equipe-ligne {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: t.$espace-3;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

// Présentation atténuée des personnes archivées (en plus du libellé et de la
// section dédiée, jamais la seule différence pour comprendre le statut).
.equipe-liste--archivee .equipe-ligne {
  background-color: t.$couleur-fond-clair;
  color: t.$couleur-texte-attenue;
}

.equipe-pastille {
  @include m.pastille-initiales;
}

.equipe-identite {
  display: flex;
  flex-direction: column;
  flex: 1 1 12rem;
  min-width: 0;
}

.equipe-nom {
  font-weight: t.$graisse-gras;
}

.equipe-details {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.equipe-actions {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-1;
  margin-left: auto;
}

.equipe-bascule {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  padding: t.$espace-1 t.$espace-2;
  margin-left: -#{t.$espace-2};
  text-decoration: none;
  border-radius: t.$rayon-md;
  transition: background-color 0.15s ease-in-out;

  // Indice de cliquabilité renforcé (public peu à l'aise avec l'informatique) :
  // léger fond + soulignement au survol/focus, en plus du focus clavier
  // global (`:focus-visible`, voir `_base.scss`) et du chevron qui pivote.
  &:hover,
  &:focus-visible {
    text-decoration: underline;
    background-color: t.$couleur-fond-clair;
  }
}

.equipe-bascule-icone {
  transition: transform 0.15s ease-in-out;

  &--ouvert {
    transform: rotate(90deg);
  }
}

.equipe-texte-explication {
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
