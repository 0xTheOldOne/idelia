<template>
  <table class="mois-diffusion">
    <caption class="mois-diffusion-titre">{{ mois.libelle }}</caption>
    <thead>
      <tr>
        <th scope="col" rowspan="2" class="mois-diffusion-col-jour">Jour</th>
        <th
          v-for="colonne in colonnes"
          :key="colonne.tourneeId"
          scope="col"
          :colspan="colonne.segments.length"
          :rowspan="colonne.coupee ? 1 : 2"
          class="mois-diffusion-col-tournee"
          :title="colonne.libelle"
        >
          <span class="mois-diffusion-entete-tournee">
            <PastilleTournee :couleur="colonne.couleur" :icone="colonne.icone" taille="impression" />
            <span class="mois-diffusion-libelle-tournee">{{ colonne.libelle }}</span>
          </span>
        </th>
      </tr>
      <tr>
        <template v-for="colonne in colonnes" :key="colonne.tourneeId">
          <th
            v-for="segment in colonne.coupee ? colonne.segments : []"
            :key="colonne.tourneeId + '-' + segment.index"
            scope="col"
            class="mois-diffusion-col-segment"
          >
            {{ segment.libelleVacation }}
          </th>
        </template>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="jour in mois.jours"
        :key="jour.date"
        class="mois-diffusion-ligne"
        :class="classesLigne(jour)"
      >
        <th scope="row" class="mois-diffusion-jour">
          <span>{{ jour.jourCourt }} {{ jour.numero }}</span>
          <span
            v-for="repere in jour.reperes.filter((r) => r.court)"
            :key="repere.code"
            class="mois-diffusion-marqueur"
            :title="repere.detail || repere.libelle"
          ><span aria-hidden="true">{{ repere.court }}</span><span class="visually-hidden"> {{ texteRepere(repere) }}</span></span>
        </th>

        <td
          v-if="jour.ligneFermee"
          :colspan="jour.cases.length"
          class="mois-diffusion-ferme"
        >
          Fermé
        </td>
        <template v-else>
          <td
            v-for="cellule in jour.cases"
            :key="cellule.tourneeId + '-' + cellule.segmentIndex"
            class="mois-diffusion-case"
          >
            <template v-if="cellule.personnes.length > 0">
              <RepereDiffusion
                v-for="personne in cellule.personnes"
                :key="personne.personneId"
                :personne="personne"
              />
            </template>
            <template v-else-if="!cellule.applicable">
              <span class="mois-diffusion-pas-de-tournee" aria-hidden="true">—</span>
              <span class="visually-hidden">Pas de tournée ce jour</span>
            </template>
            <span v-else class="visually-hidden">Personne</span>
          </td>
        </template>
      </tr>
    </tbody>
  </table>
</template>

<script>
import PastilleTournee from '@/components/communs/PastilleTournee.vue';
import RepereDiffusion from '@/components/diffusion/RepereDiffusion.vue';

/**
 * Tableau d'un mois du planning papier (feature 0012) : jours en lignes,
 * tournées (et leurs segments « Matin » / « Soir ») en colonnes. L'en-tête de
 * colonne est le libellé réel de la tournée (coupé par ellipsis s'il est trop
 * long). Aucune logique métier : tout vient de `MoisDiffusion` (domaine).
 */
export default {
  name: 'MoisDiffusion',
  components: { PastilleTournee, RepereDiffusion },
  props: {
    /** @type {import('vue').PropType<import('@/domain/diffusion.js').MoisDiffusion>} */
    mois: { type: Object, required: true },
    /** @type {import('vue').PropType<import('@/domain/diffusion.js').ColonneTournee[]>} */
    colonnes: { type: Array, required: true },
  },
  methods: {
    /**
     * Texte lu par les lecteurs d'écran pour un marqueur (« Jour férié : Toussaint »).
     * @param {import('@/domain/diffusion.js').RepereJour} repere
     * @returns {string}
     */
    texteRepere(repere) {
      return repere.detail ? `${repere.libelle} : ${repere.detail}` : repere.libelle;
    },
    /**
     * Classes génériques d'une ligne : une par repère calendaire
     * (`mois-diffusion-ligne--repere-dimanche`…), pour que 0023 n'ait qu'à
     * ajouter des styles.
     * @param {import('@/domain/diffusion.js').JourDiffusion} jour
     * @returns {string[]}
     */
    classesLigne(jour) {
      return jour.reperes.map(
        (r) => `mois-diffusion-ligne--repere-${r.code.toLowerCase().replaceAll('_', '-')}`,
      );
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.mois-diffusion {
  flex: 1 1 0;
  min-width: 0;
  table-layout: fixed;
  width: 100%;
  border-collapse: collapse;
  font-size: t.$impression-taille-texte-petite;
  color: t.$couleur-texte;
  break-inside: avoid;

  th,
  td {
    padding: 1px 2px;
    border: 1px solid t.$couleur-bordure;
    vertical-align: middle;
    text-align: center;
  }
}

.mois-diffusion-titre {
  caption-side: top;
  padding: 0 0 2px;
  font-size: t.$impression-taille-texte;
  font-weight: t.$graisse-gras;
  text-align: center;
  color: t.$couleur-texte;
}

thead th {
  background-color: t.$couleur-fond-clair;
  font-weight: t.$graisse-gras;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.mois-diffusion-col-jour {
  width: 3.4em;
}

.mois-diffusion-entete-tournee {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
}

// Libellé réel de la tournée, coupé proprement s'il dépasse la colonne.
.mois-diffusion-libelle-tournee {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mois-diffusion-jour {
  text-align: left;
  font-weight: t.$graisse-normale;
  white-space: nowrap;
  background-color: t.$couleur-fond;
}

.mois-diffusion-marqueur {
  margin-left: 2px;
  font-weight: t.$graisse-gras;
}

.mois-diffusion-case {
  white-space: normal;

  > * + * {
    margin-left: 1px;
  }
}

.mois-diffusion-pas-de-tournee {
  color: t.$couleur-texte-attenue;
}

.mois-diffusion-ferme {
  color: t.$couleur-texte-attenue;
  font-style: italic;
}

// Vacances scolaires : fine barre à gauche + fond très léger (déclaré AVANT
// dimanche/férié, dont le fond l'emporte ; le « V » porte le sens en noir et blanc).
.mois-diffusion-ligne--repere-vacances-scolaires {
  th,
  td {
    background-color: t.$impression-fond-repere-vacances;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .mois-diffusion-jour {
    border-left: 3px solid t.$couleur-texte;
  }
}

// Dimanche et férié : fond grisé ET jour en gras (jamais la couleur seule).
.mois-diffusion-ligne--repere-dimanche,
.mois-diffusion-ligne--repere-ferie {
  th,
  td {
    background-color: t.$impression-fond-repere-dimanche;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .mois-diffusion-jour {
    font-weight: t.$graisse-gras;
  }
}
</style>
