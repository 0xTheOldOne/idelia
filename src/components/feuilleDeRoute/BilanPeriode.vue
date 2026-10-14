<template>
  <section class="bilan-periode" aria-labelledby="bilan-periode-titre">
    <div class="bilan-periode__entete">
      <h2 id="bilan-periode-titre" class="bilan-periode__titre">{{ titre }}</h2>
      <button
        type="button"
        class="btn btn-outline-primary bilan-periode__imprimer d-print-none"
        title="Imprimer le bilan"
        aria-label="Imprimer le bilan"
        @click="imprimer"
      >
        <PhPrinter :size="22" aria-hidden="true" />
      </button>
    </div>

    <p v-if="bilan.nbCasRetenus > 0" class="bilan-periode__intro">{{ introduction }}</p>

    <div v-if="plusieursMois" class="alert alert-info d-flex gap-2">
      <PhInfo :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Ce fichier couvre plusieurs mois : ce bilan cumule toute la période. Pour un bilan par
        mois, exportez de Vega un mois à la fois.
      </p>
    </div>

    <div v-if="bilan.nbCasExclus > 0" class="alert alert-warning d-flex gap-2">
      <PhWarning :size="20" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">{{ texteCasExclus }}</p>
    </div>

    <p v-if="bilan.nbCasRetenus === 0" class="bilan-periode__aucun">
      Aucun bilan possible : aucun montant n'a pu être lu en entier.
    </p>

    <template v-else>
      <p class="bilan-periode__explication">
        Chaque infirmière a encaissé ce que ses patients ont payé ; « Ce qui lui revient » est sa
        part équitable. La différence est ce qu'elle doit reverser ou recevoir.
      </p>
      <table class="bilan-periode__table" role="table">
        <caption class="visually-hidden">
          Ce que chaque infirmière a encaissé, ce qui lui revient et ce qu'elle doit faire
        </caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">Infirmière</th>
            <th scope="col" role="columnheader" class="bilan-periode__montant">Encaissé</th>
            <th scope="col" role="columnheader" class="bilan-periode__montant">Ce qui lui revient</th>
            <th scope="col" role="columnheader" class="bilan-periode__montant">À faire</th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr v-for="ligne in bilan.lignes" :key="ligne.ps" role="row" class="bilan-periode__ligne">
            <th scope="row" role="rowheader" class="bilan-periode__infirmiere">
              <span class="bilan-periode__nom">{{ nomLong(ligne.ps) }}</span>
              <small class="bilan-periode__attenue">
                <template v-if="!estRelie(ligne.ps)">code Vega non relié à l'équipe · </template>{{
                  passages(ligne.nbPassages)
                }}
              </small>
            </th>
            <td role="cell" class="bilan-periode__montant" data-label="Encaissé">
              {{ euros(ligne.toucheCentimes) }}
            </td>
            <td role="cell" class="bilan-periode__montant" data-label="Ce qui lui revient">
              {{ euros(ligne.partCentimes) }}
            </td>
            <td role="cell" class="bilan-periode__montant bilan-periode__resultat" data-label="À faire">
              <strong v-if="ligne.soldeCentimes > 0">
                Doit reverser {{ euros(ligne.soldeCentimes) }}
              </strong>
              <strong v-else-if="ligne.soldeCentimes < 0">
                Doit recevoir {{ euros(-ligne.soldeCentimes) }}
              </strong>
              <span v-else class="bilan-periode__attenue">Rien à reverser ni à recevoir</span>
            </td>
          </tr>
        </tbody>
        <tfoot role="rowgroup">
          <tr role="row" class="bilan-periode__total">
            <th scope="row" role="rowheader">Total</th>
            <td role="cell" class="bilan-periode__montant" data-label="Encaissé">
              {{ euros(bilan.totalCentimes) }}
            </td>
            <td role="cell" class="bilan-periode__montant" data-label="Ce qui lui revient">
              {{ euros(bilan.totalCentimes) }}
            </td>
            <td role="cell" class="bilan-periode__montant" />
          </tr>
        </tfoot>
      </table>

      <h3 class="bilan-periode__sous-titre">Virements à faire</h3>
      <template v-if="bilan.virements.length > 0">
        <div class="bilan-periode__virements">
          <PhArrowsLeftRight :size="24" weight="bold" class="flex-shrink-0" aria-hidden="true" />
          <div>
            <p v-for="(v, i) in bilan.virements" :key="i" class="bilan-periode__virement">
              <strong>{{ nomCourt(v.de) }} reverse {{ euros(v.montantCentimes) }} à {{ nomCourt(v.vers) }}</strong>
            </p>
          </div>
        </div>
        <p class="bilan-periode__avertissement">
          Ces virements soldent toute la période. Ils remplacent ceux indiqués patient par patient :
          ne faites pas les deux.
        </p>
      </template>
      <p v-else class="bilan-periode__aucun">
        Rien à reverser sur la période : chaque infirmière a déjà touché sa part.
      </p>
    </template>
  </section>
</template>

<script>
import { PhPrinter, PhInfo, PhWarning, PhArrowsLeftRight } from '@phosphor-icons/vue';

import { couvrePlusieursMois } from '@/domain/feuilleDeRoute/bilanReversements.js';
import {
  infirmiereDuCode,
  libelleInfirmiere,
  libelleCourtInfirmiere,
} from '@/domain/feuilleDeRoute/relierInfirmieres.js';
import { libelleJour } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';
import { formaterEuros } from '@/domain/utils/montants.js';

/**
 * Bilan de la période (feature 0035), **présentationnel** : affiche le
 * `BilanPeriode` calculé par `calculerBilan` (domaine pur). Aucun nom de
 * patient reçu ni affiché (seuls les jours des cas exclus). Texte rendu par
 * interpolation uniquement (codes issus d'un fichier externe, jamais `v-html`).
 */
export default {
  name: 'BilanPeriode',
  components: { PhPrinter, PhInfo, PhWarning, PhArrowsLeftRight },
  props: {
    /** @type {import('vue').PropType<import('@/domain/feuilleDeRoute/bilanReversements.js').BilanPeriode>} */
    bilan: { type: Object, required: true },
    /** Période du fichier `{ debut, fin }` ("YYYY-MM-DD") ou `null`. */
    periode: { type: Object, default: null },
    /** Index des infirmières par initiales Vega (voir `indexerParInitialesVega`). */
    infirmieres: { type: Map, default: () => new Map() },
  },
  computed: {
    titre() {
      const p = this.periode;
      if (!p) return 'Bilan de la période';
      if (p.debut === p.fin) return `Bilan du ${dateUtil.formatDateFr(p.debut)}`;
      return `Bilan du ${dateUtil.formatDateFr(p.debut)} au ${dateUtil.formatDateFr(p.fin)}`;
    },
    plusieursMois() {
      return couvrePlusieursMois(this.periode);
    },
    introduction() {
      const n = this.bilan.nbCasRetenus;
      const patients = n > 1 ? 'patients vus' : 'patient vu';
      return `Calculé sur ${n} ${patients} par plusieurs infirmières, pour un total de ${this.euros(this.bilan.totalCentimes)}.`;
    },
    texteCasExclus() {
      const n = this.bilan.nbCasExclus;
      const jours = this.bilan.datesCasExclus.map((d) => this.jourComplet(d)).join(', ');
      const sujet =
        n > 1 ? `${n} patients ne sont pas comptés` : '1 patient n\'est pas compté';
      return `${sujet} dans ce bilan car un montant est illisible (${jours}). Vérifiez-le dans l'onglet « Détail par patient » et réglez-le à part.`;
    },
  },
  methods: {
    euros: formaterEuros,
    /** @param {string} code */
    estRelie(code) {
      return infirmiereDuCode(code, this.infirmieres).personne !== null;
    },
    /** @param {string} code ex. « Claire Martin (FC) » */
    nomLong(code) {
      return libelleInfirmiere(infirmiereDuCode(code, this.infirmieres));
    },
    /** @param {string} code ex. « FC (Claire) » */
    nomCourt(code) {
      return libelleCourtInfirmiere(infirmiereDuCode(code, this.infirmieres));
    },
    /** @param {number} n */
    passages(n) {
      return `${n} ${n > 1 ? 'passages' : 'passage'}`;
    },
    /** @param {string} iso "YYYY-MM-DD" @returns {string} ex. « jeudi 08/10/2026 » */
    jourComplet(iso) {
      return `${libelleJour(dateUtil.weekdayISO(iso)).toLowerCase()} ${dateUtil.formatDateFr(iso)}`;
    },
    imprimer() {
      window.print();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.bilan-periode__entete {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-3;
  margin-bottom: t.$espace-2;
}

.bilan-periode__titre {
  margin: 0;
  font-size: t.$taille-titre-2;
}

.bilan-periode__imprimer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: t.$cible-cliquable-min;
  min-height: t.$cible-cliquable-min;
}

.bilan-periode__intro {
  margin-bottom: t.$espace-3;
}

.bilan-periode__aucun {
  font-weight: t.$graisse-gras;
}

.bilan-periode__attenue {
  color: t.$couleur-texte-attenue;
}

// Le module « tables » de Bootstrap n'est pas importé : styles portés ici.
.bilan-periode__table {
  width: 100%;
  margin-bottom: t.$espace-4;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: t.$espace-2 t.$espace-3;
    vertical-align: middle;
  }

  thead th {
    border-bottom: 1px solid t.$couleur-bordure;
  }

  tbody tr + tr {
    border-top: 1px solid t.$couleur-bordure;
  }

  tfoot tr {
    border-top: 2px solid t.$couleur-bordure;
    font-weight: t.$graisse-gras;
  }
}

.bilan-periode__explication {
  margin-bottom: t.$espace-2;
}

.bilan-periode__montant {
  text-align: right;
}

.bilan-periode__infirmiere {
  font-weight: t.$graisse-normale;
  text-align: left;
}

.bilan-periode__nom {
  display: block;
  font-weight: t.$graisse-gras;
}

.bilan-periode__sous-titre {
  margin-bottom: t.$espace-2;
  font-size: t.$taille-texte-grande;
}

.bilan-periode__virements {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  padding: t.$espace-2 t.$espace-3;
  background-color: t.$couleur-fond-clair;
  border-left: 4px solid t.$couleur-focus;
  border-radius: t.$rayon-md;
  font-size: t.$taille-texte-grande;
}

.bilan-periode__virement {
  margin: 0;

  & + & {
    margin-top: t.$espace-1;
  }
}

// Risque de double paiement : texte plein et gras (relecture ui-ux 0035).
.bilan-periode__avertissement {
  margin-top: t.$espace-2;
  font-weight: t.$graisse-gras;
}

// Mobile (< 576 px) : chaque ligne devient une carte avec libellés.
@media (max-width: t.$rupture-sm - 0.02px) {
  .bilan-periode__table {
    &,
    tbody,
    tfoot,
    tr,
    th,
    td {
      display: block;
    }

    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    tbody tr,
    tfoot tr {
      margin-bottom: t.$espace-2;
      padding: t.$espace-2 0;
      border: 1px solid t.$couleur-bordure;
      border-radius: t.$rayon-md;
    }

    th,
    td {
      padding: t.$espace-1 t.$espace-3;
    }
  }

  .bilan-periode__montant {
    text-align: left;

    &[data-label]::before {
      content: attr(data-label) ' : ';
      color: t.$couleur-texte-attenue;
      font-weight: t.$graisse-normale;
    }
  }
}
</style>
