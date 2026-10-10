<template>
  <div class="feuille-de-route">
    <div class="feuille-de-route-entete">
      <h1>Feuille de route</h1>
      <button
        v-if="etape === ETAPES.RESULTAT"
        type="button"
        class="btn btn-primary feuille-de-route-bouton"
        @click="recommencer"
      >
        <PhArrowCounterClockwise :size="20" weight="bold" aria-hidden="true" />
        <span>Analyser un autre fichier</span>
      </button>
    </div>

    <template v-if="etape !== ETAPES.RESULTAT">
      <p>
        Repérez les patients vus plusieurs fois dans la journée par des infirmières différentes, et qui doit reverser combien à qui.
        Déposez la <em>Liste des séances sur une période</em> exportée de Vega.
      </p>
      <p class="feuille-de-route-rassurant">
        <PhShieldCheck :size="24" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <span>
          Le fichier est lu uniquement sur cet ordinateur : il n'est envoyé nulle part et rien
          n'est conservé.
        </span>
      </p>
    </template>

    <div
      v-if="etape === ETAPES.ERREUR"
      ref="erreur"
      class="alert alert-danger d-flex gap-2 feuille-de-route-erreur"
      role="alert"
      tabindex="-1"
    >
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">{{ messageErreur }}</p>
    </div>

    <div role="status" aria-live="polite">
      <p v-if="etape === ETAPES.ANALYSE" class="feuille-de-route-analyse">
        <span class="spinner-border spinner-border-sm" aria-hidden="true" />
        <span class="feuille-de-route-nom-fichier">Lecture du fichier « {{ nomFichier }} »…</span>
      </p>
    </div>

    <ZoneDepotFichier
      v-if="etape !== ETAPES.RESULTAT"
      ref="zone"
      :desactivee="etape === ETAPES.ANALYSE"
      @fichiers-choisis="analyser"
    />

    <template v-if="etape === ETAPES.RESULTAT">
      <p
        ref="resume"
        class="feuille-de-route-resume"
        tabindex="-1"
      >
        {{ resume }}
      </p>
      <p class="feuille-de-route-rappel">
        Rien n'est enregistré : ce résultat disparaît quand vous quittez cette page.
      </p>

      <div v-if="cas.length === 0" class="alert alert-info d-flex gap-2">
        <PhInfo :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <p class="mb-0">
          Aucun patient vu par plusieurs infirmières sur cette période.
        </p>
      </div>
      <template v-else>
        <div v-if="codesNonReliesListe.length > 0" class="alert alert-info d-flex gap-2">
          <PhInfo :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
          <p class="mb-0">
            {{ texteCodesNonRelies }}
            Pour voir leur nom ici, renseignez leurs initiales Vega sur leur fiche dans
            <router-link :to="{ name: 'equipe' }">Équipe</router-link>.
            Attention : ce résultat sera perdu en quittant cette page, il faudra redéposer le fichier.
          </p>
        </div>
        <ListeRelais :cas="cas" :infirmieres="indexInfirmieres" />
      </template>
    </template>
  </div>
</template>

<script>
import { mapState } from 'vuex';
import {
  PhArrowCounterClockwise,
  PhShieldCheck,
  PhWarning,
  PhInfo,
} from '@phosphor-icons/vue';

import ZoneDepotFichier from '@/components/feuilleDeRoute/ZoneDepotFichier.vue';
import ListeRelais from '@/components/feuilleDeRoute/ListeRelais.vue';
import {
  TAILLE_MAX_PDF_OCTETS,
  estFichierPdf,
  lireGlyphesPdf,
} from '@/adaptateurs/lireGlyphesPdf.js';
import { extraireSeances } from '@/domain/feuilleDeRoute/extraireSeances.js';
import { detecterRelais } from '@/domain/feuilleDeRoute/detecterRelais.js';
import {
  indexerParInitialesVega,
  codesNonRelies,
} from '@/domain/feuilleDeRoute/relierInfirmieres.js';
import { libelleJour } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';

/** Étapes de l'écran (état d'UI local, pas du domaine). */
const ETAPES = Object.freeze({
  ATTENTE: 'ATTENTE',
  ANALYSE: 'ANALYSE',
  RESULTAT: 'RESULTAT',
  ERREUR: 'ERREUR',
});

/** Message affiché pour chaque code d'erreur (ton calme, avec la marche à suivre). */
const MESSAGES_ERREUR = Object.freeze({
  PLUSIEURS_FICHIERS: 'Déposez un seul fichier à la fois.',
  PAS_PDF:
    "Ce fichier n'est pas un PDF. Déposez la « Liste des séances sur une période » exportée de Vega (son nom se termine par .pdf).",
  TROP_VOLUMINEUX:
    'Ce fichier est trop volumineux pour être lu ici (plus de 20 Mo). Exportez depuis Vega une période plus courte, puis réessayez.',
  PDF_ILLISIBLE:
    "Ce fichier PDF n'a pas pu être lu : il est peut-être abîmé ou protégé par un mot de passe. Refaites l'export depuis Vega, puis réessayez.",
  AUCUNE_SEANCE:
    "Aucune séance n'a été trouvée dans ce fichier. Vérifiez qu'il s'agit bien de la « Liste des séances sur une période » exportée de Vega.",
  PDF_TROP_COMPLEXE:
    'Ce fichier est trop long ou trop complexe pour être lu ici. Exportez depuis Vega une période plus courte, puis réessayez.',
  LECTEUR_INDISPONIBLE:
    "La lecture des PDF n'a pas pu démarrer. Vérifiez votre connexion internet, rechargez la page, puis réessayez.",
});

/**
 * @returns {{etape: string, nomFichier: string, nbSeances: number,
 *   periode: ({debut: string, fin: string}|null), cas: Array, codeErreur: string}}
 */
function etatInitial() {
  return {
    etape: ETAPES.ATTENTE,
    nomFichier: '',
    nbSeances: 0,
    periode: null,
    cas: [],
    codeErreur: '',
  };
}

/**
 * Écran « Feuille de route » (feature 0033) : lit un PDF exporté de Vega et
 * liste les patients vus par plusieurs infirmières le même jour.
 * Lit les personnes du store en lecture seule pour afficher les noms ; n'écrit rien.
 * Aucune logique de lecture ni de détection ici (adaptateur + domaine). Rien
 * n'est conservé : ni le fichier, ni les glyphes, ni les séances — seuls le
 * résumé et les cas affichés vivent dans `data()`, jusqu'au démontage ; rien
 * dans Vuex ni `storageRepository`.
 */
export default {
  name: 'FeuilleDeRouteView',
  components: {
    PhArrowCounterClockwise,
    PhShieldCheck,
    PhWarning,
    PhInfo,
    ZoneDepotFichier,
    ListeRelais,
  },
  data() {
    return { ETAPES, ...etatInitial() };
  },
  computed: {
    ...mapState('personnes', { toutesLesPersonnes: 'items' }),
    indexInfirmieres() {
      return indexerParInitialesVega(this.toutesLesPersonnes);
    },
    codesNonReliesListe() {
      return codesNonRelies(this.cas, this.indexInfirmieres);
    },
    /** Phrase d'explication des codes sans personne (singulier/pluriel). */
    texteCodesNonRelies() {
      const l = this.codesNonReliesListe;
      if (l.length === 1) return `Le code Vega ${l[0]} n'est relié à aucune personne de l'équipe.`;
      const liste = `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}`;
      return `Les codes Vega ${liste} ne sont reliés à aucune personne de l'équipe.`;
    },
    messageErreur() {
      return MESSAGES_ERREUR[this.codeErreur] ?? MESSAGES_ERREUR.PDF_ILLISIBLE;
    },
    /** Phrase de résumé (présentation uniquement ; singulier/pluriel gérés). */
    resume() {
      const n = this.nbSeances;
      const seances = `${n} ${n > 1 ? 'séances lues' : 'séance lue'}`;
      const p = this.periode;
      const periode = p
        ? p.debut === p.fin
          ? ` le ${this.jourComplet(p.debut)}`
          : ` du ${this.jourComplet(p.debut)} au ${this.jourComplet(p.fin)}`
        : '';
      const c = this.cas.length;
      const patients =
        c === 0
          ? 'aucun patient vu par plusieurs infirmières'
          : `${c} ${c > 1 ? 'patients vus' : 'patient vu'} par plusieurs infirmières`;
      return `${seances}${periode} — ${patients}.`;
    },
  },
  mounted() {
    // Un PDF lâché à côté de la zone ne doit pas s'ouvrir dans l'onglet.
    window.addEventListener('dragover', this.neutraliser);
    window.addEventListener('drop', this.neutraliser);
  },
  beforeUnmount() {
    window.removeEventListener('dragover', this.neutraliser);
    window.removeEventListener('drop', this.neutraliser);
  },
  methods: {
    /** @param {Event} event */
    neutraliser(event) {
      event.preventDefault();
    },

    /**
     * @param {string} iso "YYYY-MM-DD"
     * @returns {string} ex. « jeudi 08/10/2026 »
     */
    jourComplet(iso) {
      return `${libelleJour(dateUtil.weekdayISO(iso)).toLowerCase()} ${dateUtil.formatDateFr(iso)}`;
    },

    /** @param {string} code */
    signalerErreur(code) {
      this.codeErreur = code;
      this.etape = ETAPES.ERREUR;
      this.$nextTick(() => this.$refs.erreur?.focus());
    },

    /** @param {File[]} fichiers */
    async analyser(fichiers) {
      if (this.etape === ETAPES.ANALYSE) return;
      if (fichiers.length > 1) return this.signalerErreur('PLUSIEURS_FICHIERS');
      const fichier = fichiers[0];
      if (!estFichierPdf(fichier)) return this.signalerErreur('PAS_PDF');
      if (fichier.size > TAILLE_MAX_PDF_OCTETS) return this.signalerErreur('TROP_VOLUMINEUX');

      this.nomFichier = fichier.name;
      this.etape = ETAPES.ANALYSE;

      // Toute la chaîne dans un seul try/catch : l'écran ne reste jamais bloqué en ANALYSE.
      try {
        const glyphes = await lireGlyphesPdf(fichier);
        const { periode, seances } = extraireSeances(glyphes);
        if (seances.length === 0) return this.signalerErreur('AUCUNE_SEANCE');

        this.cas = detecterRelais(seances);
        this.nbSeances = seances.length;
        this.periode = periode;
        this.etape = ETAPES.RESULTAT;
        this.$nextTick(() => this.$refs.resume?.focus());
      } catch (err) {
        this.signalerErreur(err?.code ?? 'PDF_ILLISIBLE');
      }
    },

    /** Retour à l'écran de départ, focus sur le bouton de choix du fichier. */
    recommencer() {
      Object.assign(this, etatInitial());
      this.$nextTick(() => this.$refs.zone?.focaliser());
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.feuille-de-route-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-4;
}

.feuille-de-route-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
}

.feuille-de-route-rassurant {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin-bottom: t.$espace-4;
  color: t.$couleur-texte-attenue;
}

.feuille-de-route-analyse {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  font-weight: t.$graisse-gras;
}

.feuille-de-route-nom-fichier {
  overflow-wrap: anywhere;
  min-width: 0;
}

.feuille-de-route-erreur:focus {
  outline: t.$epaisseur-focus solid t.$couleur-focus;
  outline-offset: 2px;
}

.feuille-de-route-resume {
  margin-bottom: t.$espace-2;
  font-size: t.$taille-texte-grande;
  font-weight: t.$graisse-gras;

  &:focus {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: 2px;
  }
}

.feuille-de-route-rappel {
  margin-bottom: t.$espace-4;
}

.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
