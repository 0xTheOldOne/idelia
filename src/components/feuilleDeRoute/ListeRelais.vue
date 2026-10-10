<template>
  <div class="liste-relais">
    <section v-for="groupe in groupes" :key="groupe.date" class="liste-relais__jour">
      <h2 class="liste-relais__titre-jour">{{ titreJour(groupe.date) }}</h2>
      <ul class="liste-relais__cartes">
        <li v-for="c in groupe.cas" :key="c.id" class="liste-relais__carte">
          <div class="liste-relais__identite">
            <span class="liste-relais__patient">{{ c.patient }}</span>
            <span v-if="c.fin" class="liste-relais__fin">Fin le {{ formatDate(c.fin) }}</span>
          </div>
          <div class="liste-relais__passages">
            <template v-for="(p, i) in c.passages" :key="i">
              <PhArrowRight
                v-if="i > 0"
                :size="20"
                class="liste-relais__fleche"
                aria-hidden="true"
              />
              <div class="liste-relais__moment">
                <span class="liste-relais__moment-titre">
                  <component :is="iconeMoment(i, c.nbPassages)" :size="20" aria-hidden="true" />
                  <span>{{ libelleMoment(i, c.nbPassages) }}</span>
                </span>
                <span class="liste-relais__infirmiere">Infirmière : {{ nomLong(p.ps) }}</span>
                <span v-if="!estRelie(p.ps)" class="liste-relais__non-relie">
                  code Vega non relié à l'équipe
                </span>
                <span>à {{ p.heure }} — {{ p.cotation }}</span>
                <span v-if="p.montantCentimes !== null">Montant : {{ euros(p.montantCentimes) }}</span>
                <span v-else>Montant : illisible</span>
              </div>
            </template>
          </div>
          <p v-if="c.montantIncomplet" class="liste-relais__recap">
            Montant illisible pour au moins un passage : impossible de calculer qui reverse quoi.
          </p>
          <div v-else class="liste-relais__recap">
            <p class="liste-relais__total">
              Total {{ euros(c.totalCentimes) }} pour {{ c.nbPassages }} passages, soit
              {{ euros(c.partParPassageCentimes) }} par passage.
            </p>
            <ul class="liste-relais__parts">
              <li v-for="part in c.parts" :key="part.ps">
                <strong>{{ nomLong(part.ps) }}</strong> a touché {{ euros(part.toucheCentimes)
                }}<template v-if="part.nbPassages > 1"> pour {{ part.nbPassages }} passages</template>
                — sa part : {{ euros(part.partCentimes) }}
              </li>
            </ul>
            <div v-if="c.reversements.length > 0" class="liste-relais__reversements">
              <PhArrowsLeftRight :size="24" weight="bold" class="flex-shrink-0" aria-hidden="true" />
              <div>
                <p v-for="(r, i) in c.reversements" :key="i" class="liste-relais__reversement">
                  <strong>{{ nomCourt(r.de) }} reverse {{ euros(r.montantCentimes) }} à {{ nomCourt(r.vers) }}</strong>
                </p>
              </div>
            </div>
            <p v-else class="liste-relais__rien">
              Rien à reverser : chaque infirmière a déjà touché sa part.
            </p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script>
import { PhSun, PhSunDim, PhMoon, PhArrowRight, PhArrowsLeftRight } from '@phosphor-icons/vue';

import { grouperCasParDate, libelleMoment } from '@/domain/feuilleDeRoute/detecterRelais.js';
import {
  infirmiereDuCode,
  libelleInfirmiere,
  libelleCourtInfirmiere,
} from '@/domain/feuilleDeRoute/relierInfirmieres.js';
import { libelleJour } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';
import { formaterEuros } from '@/domain/utils/montants.js';

/**
 * Liste des patients vus par plusieurs infirmières, groupés par jour (feature 0033).
 * Présentationnel : le groupement est délégué au domaine. Texte rendu par
 * interpolation uniquement (contenu issu d'un fichier externe, jamais `v-html`).
 */
export default {
  name: 'ListeRelais',
  components: { PhSun, PhSunDim, PhMoon, PhArrowRight, PhArrowsLeftRight },
  props: {
    /** @type {import('vue').PropType<import('@/domain/feuilleDeRoute/detecterRelais.js').CasRelais[]>} */
    cas: { type: Array, required: true },
    /** Index des infirmières par initiales Vega (voir `indexerParInitialesVega`). */
    infirmieres: { type: Map, default: () => new Map() },
  },
  computed: {
    groupes() {
      return grouperCasParDate(this.cas);
    },
  },
  methods: {
    formatDate: (iso) => dateUtil.formatDateFr(iso),
    libelleMoment,
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
    /**
     * Icône du moment : soleil le matin, soleil bas à midi, lune le soir.
     * @param {number} index
     * @param {number} nb
     */
    iconeMoment(index, nb) {
      if (nb === 3 && index === 1) return 'PhSunDim';
      if (nb === 3 || nb === 2) return index === 0 ? 'PhSun' : 'PhMoon';
      return 'PhSun';
    },
    /** @param {string} date "YYYY-MM-DD" */
    titreJour(date) {
      return `${libelleJour(dateUtil.weekdayISO(date))} ${dateUtil.formatDateFr(date)}`;
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.liste-relais__jour {
  margin-bottom: t.$espace-4;
}

.liste-relais__titre-jour {
  font-size: t.$taille-titre-2;
  margin-bottom: t.$espace-3;
}

.liste-relais__cartes {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.liste-relais__carte {
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
  padding: t.$espace-3;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;
}

.liste-relais__identite {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: t.$espace-2 t.$espace-3;
}

.liste-relais__patient {
  font-weight: t.$graisse-gras;
}

.liste-relais__fin {
  font-size: t.$taille-texte-petite;
}

.liste-relais__passages {
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;

  @media (min-width: t.$rupture-md) {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
}

.liste-relais__recap {
  margin: 0;
  padding: t.$espace-2 t.$espace-3;
  border-left: 4px solid t.$couleur-bordure;
}

.liste-relais__total,
.liste-relais__rien,
.liste-relais__reversement {
  margin: 0;
}

.liste-relais__parts {
  margin: t.$espace-2 0;
  padding-left: t.$espace-4;
}

.liste-relais__reversements {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  padding: t.$espace-2 t.$espace-3;
  background-color: t.$couleur-fond-clair;
  border-left: 4px solid t.$couleur-focus;
  border-radius: t.$rayon-md;
  font-size: t.$taille-texte-grande;
}

.liste-relais__non-relie {
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
}

.liste-relais__moment {
  display: flex;
  flex-direction: column;
  gap: t.$espace-1;
  min-width: 0;
  overflow-wrap: anywhere;
  padding: t.$espace-2 t.$espace-3;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-md;

  @media (min-width: t.$rupture-md) {
    flex: 1 1 12rem;
  }
}

.liste-relais__moment-titre {
  display: flex;
  align-items: center;
  gap: t.$espace-1;
  font-size: t.$taille-texte-petite;
  font-weight: t.$graisse-gras;
}

.liste-relais__infirmiere {
  font-weight: t.$graisse-gras;
}

.liste-relais__fleche {
  flex-shrink: 0;
  color: t.$couleur-texte-attenue;
  align-self: center;
  transform: rotate(90deg);

  @media (min-width: t.$rupture-md) {
    transform: none;
  }
}
</style>
