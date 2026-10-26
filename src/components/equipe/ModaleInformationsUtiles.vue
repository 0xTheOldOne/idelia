<template>
  <ModaleBase :visible="visible" :titre="titre" @fermeture="$emit('fermeture')" @affichee="focaliserFermer">
    <template v-if="personne">
      <section class="infos-rubrique" aria-labelledby="infos-titre-coordonnees">
        <div class="infos-rubrique-entete">
          <h3 id="infos-titre-coordonnees" class="infos-rubrique-titre">Adresse et naissance</h3>
          <button
            v-if="modifiable"
            type="button"
            class="btn btn-outline-primary infos-bouton"
            data-rubrique="coordonnees"
            title="Modifier l'adresse et la naissance"
            aria-label="Modifier l'adresse et la naissance"
            @click="$emit('modifier', 'coordonnees')"
          >
            <PhPencilSimple :size="18" aria-hidden="true" />
            <span class="d-md-none" aria-hidden="true">Modifier</span>
          </button>
        </div>
        <dl v-if="avecCoordonnees" class="infos-liste">
          <div v-for="ligne in rubriquesCoordonnees" :key="ligne.cle" class="infos-ligne">
            <dt class="infos-libelle">{{ ligne.libelle }}</dt>
            <dd class="infos-valeur">
              <template v-if="ligne.lignes.length">
                <span class="infos-texte user-select-all">
                  <span v-for="(texte, i) in ligne.lignes" :key="i" class="d-block">{{ texte }}</span>
                </span>
                <button
                  type="button"
                  class="btn btn-outline-secondary infos-copier"
                  :data-cle="ligne.cle"
                  title="Copier"
                  :aria-label="`Copier ${ligne.libelleCopie}`"
                  @click="copier(ligne)"
                >
                  <PhCopy :size="20" aria-hidden="true" />
                </button>
              </template>
              <span v-else class="infos-vide">Non renseigné</span>
            </dd>
          </div>
        </dl>
        <p v-else class="mb-0">
          Aucune adresse ni date de naissance n'a encore été saisie pour {{ personne.prenom }}.
          <template v-if="modifiable">Cliquez sur le crayon pour les renseigner.</template>
        </p>
      </section>

      <section class="infos-rubrique" aria-labelledby="infos-titre-identifiants">
        <div class="infos-rubrique-entete">
          <h3 id="infos-titre-identifiants" class="infos-rubrique-titre">Informations professionnelles</h3>
          <button
            v-if="modifiable"
            type="button"
            class="btn btn-outline-primary infos-bouton"
            data-rubrique="identifiants"
            title="Modifier les informations professionnelles"
            aria-label="Modifier les informations professionnelles"
            @click="$emit('modifier', 'identifiants')"
          >
            <PhPencilSimple :size="18" aria-hidden="true" />
            <span class="d-md-none" aria-hidden="true">Modifier</span>
          </button>
        </div>
        <dl v-if="avecNumeros" class="infos-liste">
          <div v-for="ligne in lignes" :key="ligne.cle" class="infos-ligne">
            <dt class="infos-libelle">{{ ligne.libelle }}</dt>
            <dd class="infos-valeur">
              <template v-if="ligne.valeur">
                <span class="infos-numero user-select-all font-monospace">{{ ligne.valeur }}</span>
                <button
                  type="button"
                  class="btn btn-outline-secondary infos-copier"
                  :data-cle="ligne.cle"
                  title="Copier"
                  :aria-label="`Copier ${libelleCopie(ligne.libelle)}`"
                  @click="copier(ligne)"
                >
                  <PhCopy :size="20" aria-hidden="true" />
                </button>
              </template>
              <span v-else class="infos-vide">Non renseigné</span>
            </dd>
          </div>
        </dl>
        <p v-else class="mb-0">
          Aucune information professionnelle n'a encore été saisie pour {{ personne.prenom }}.
          <template v-if="modifiable">Cliquez sur le crayon pour les renseigner.</template>
        </p>
      </section>

      <p v-if="!modifiable" class="infos-note">
        Pour modifier ces informations, restaurez d'abord la personne.
      </p>

      <p class="infos-statut" role="status" aria-live="polite">{{ statut }}</p>
    </template>

    <template #pied>
      <button ref="boutonFermer" type="button" class="btn btn-primary" data-bs-dismiss="modal">
        Fermer
      </button>
    </template>
  </ModaleBase>
</template>

<script>
import { PhCopy, PhPencilSimple } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import { copierTexte } from '@/adaptateurs/pressePapiers.js';
import { lignesIdentifiants, aDesIdentifiants } from '@/domain/identifiantsPro.js';
import { lignesCoordonnees, aDesCoordonnees } from '@/domain/coordonnees.js';

/**
 * Consultation des informations utiles d'une personne : rubrique « Adresse et
 * naissance » (feature 0040) et rubrique « Informations professionnelles »
 * (feature 0030). Présentationnel : ni store ni routeur. Interpolation seule
 * (aucun v-html).
 *
 * Props : `visible`, `personne` (ou null), `modifiable` (false si archivée).
 * Événements : `fermeture` (fermeture terminée), `modifier` (payload
 * `'coordonnees'` ou `'identifiants'` : rubrique dont le crayon est cliqué).
 */
export default {
  name: 'ModaleInformationsUtiles',
  components: { ModaleBase, PhCopy, PhPencilSimple },
  props: {
    visible: { type: Boolean, required: true },
    personne: { type: Object, default: null },
    modifiable: { type: Boolean, default: true },
  },
  emits: ['fermeture', 'modifier'],
  data() {
    return { statut: '' };
  },
  computed: {
    titre() {
      return this.personne
        ? `Informations utiles — ${this.personne.prenom} ${this.personne.nom}`
        : 'Informations utiles';
    },
    rubriquesCoordonnees() {
      return lignesCoordonnees(this.personne);
    },
    avecCoordonnees() {
      return aDesCoordonnees(this.personne);
    },
    lignes() {
      return lignesIdentifiants(this.personne?.identifiants);
    },
    avecNumeros() {
      return aDesIdentifiants(this.personne?.identifiants);
    },
  },
  watch: {
    visible(estVisible) {
      if (estVisible) this.statut = '';
    },
  },
  methods: {
    /** « Numéro RPPS » -> « le numéro RPPS » (minuscule initiale). */
    libelleCopie(libelle) {
      return `le ${libelle.charAt(0).toLocaleLowerCase('fr')}${libelle.slice(1)}`;
    },
    /** Copie `texteCopie` (coordonnées) ou `valeur` (numéros) et confirme. */
    async copier(ligne) {
      const ok = await copierTexte(ligne.texteCopie ?? ligne.valeur);
      this.statut = ok
        ? (ligne.confirmation ?? `${ligne.libelle.split(' (')[0]} copié.`)
        : "La copie automatique n'a pas fonctionné. Cliquez sur le texte pour le sélectionner, puis copiez-le avec Ctrl+C.";
    },
    /** Focus initial déterministe : bouton « Fermer » (action sûre). */
    focaliserFermer() {
      this.$refs.boutonFermer?.focus();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.infos-rubrique + .infos-rubrique {
  margin-top: t.$espace-4;
}

.infos-rubrique-entete {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: t.$espace-2;
  margin-bottom: t.$espace-3;
}

.infos-rubrique-titre {
  margin: 0;
  font-size: 1.125rem;
}

.infos-liste {
  display: flex;
  flex-direction: column;
  gap: t.$espace-3;
  margin: 0;
}

.infos-ligne {
  display: flex;
  flex-direction: column;
  gap: t.$espace-1;

  @media (min-width: 576px) {
    flex-direction: row;
    align-items: center;
    gap: t.$espace-3;
  }
}

.infos-libelle {
  flex: 0 0 16rem;
  margin: 0;
  font-weight: t.$graisse-gras;
}

.infos-valeur {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin: 0;
}

.infos-numero {
  font-size: 1.125rem;
  letter-spacing: 0.04em;
}

.infos-vide,
.infos-note {
  color: t.$couleur-texte-attenue;
}

.infos-note {
  margin-top: t.$espace-3;
  margin-bottom: 0;
}

.infos-statut {
  min-height: 1.5rem;
  margin: t.$espace-3 0 0;
  color: t.$couleur-texte-attenue;
}

.infos-copier,
.infos-bouton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: t.$espace-2;
  min-width: t.$cible-cliquable-min;
}

.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
