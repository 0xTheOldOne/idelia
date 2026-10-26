<template>
  <ModaleBase :visible="visible" titre="Nouveau document" @fermeture="$emit('annuler')" @affichee="onAffichee">
    <div v-if="!modeles.length" class="modele-aucun">
      <p class="mb-3">Aucun modèle de document n'est disponible : créez ou restaurez un modèle pour continuer.</p>
      <router-link class="btn btn-outline-primary" :to="{ path: '/modeles-contrats' }" @click="$emit('annuler')">
        <PhFileText :size="18" aria-hidden="true" />
        <span>Voir les modèles</span>
      </router-link>
    </div>

    <form v-else :id="idFormulaire" ref="formulaireEl" novalidate @submit.prevent="soumettre">
      <fieldset class="mb-4">
        <legend class="form-label">Modèle de document</legend>
        <template v-for="groupe in groupesModeles" :key="groupe.code">
          <p class="modele-groupe">{{ groupe.libelle }}</p>
          <label
            v-for="m in groupe.modeles"
            :key="m.id"
            class="modele-carte"
            :class="{ 'modele-carte--choisi': formulaire.modeleId === m.id }"
          >
            <input
              v-model="formulaire.modeleId"
              class="form-check-input"
              type="radio"
              name="modele-document"
              :value="m.id"
              @change="v$.formulaire.modeleId.$touch()"
            >
            <span class="fw-semibold">{{ m.titre }}</span>
          </label>
        </template>
        <p v-if="v$.formulaire.modeleId.$error" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.modeleId.$errors[0].$message }}</span>
        </p>
      </fieldset>

      <template v-if="modele">
        <div class="mb-4">
          <label :for="`${idBase}-titre`" class="form-label">Titre du document</label>
          <input
            :id="`${idBase}-titre`"
            v-model="formulaire.titre"
            type="text"
            class="form-control"
            maxlength="200"
            :class="{ 'is-invalid': v$.formulaire.titre.$error }"
            :aria-describedby="v$.formulaire.titre.$error ? `${idBase}-titre-erreur` : null"
            @blur="v$.formulaire.titre.$touch()"
          >
          <p v-if="v$.formulaire.titre.$error" :id="`${idBase}-titre-erreur`" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.titre.$errors[0].$message }}</span>
          </p>
        </div>

        <fieldset v-if="champs.libres.length" class="mb-4">
          <legend class="form-label">À compléter</legend>
          <ChampSaisieDocument
            v-for="champ in champs.libres"
            :key="champ.cle"
            v-model="formulaire.valeurs[champ.id]"
            class="mb-3"
            :champ="champ"
            :id-base="idBase"
            :erreur="erreurChamp(champ)"
            :aide="champ.type === 'TAUX_RETROCESSION' ? aideTaux() : ''"
            @blur="v$.formulaire.valeurs[champ.id]?.$touch()"
          />
        </fieldset>

        <fieldset v-if="champs.manquants.length" class="mb-2">
          <legend class="form-label">Informations absentes de la fiche de {{ personne.prenom }}</legend>
          <p class="form-text mt-0">
            Laissez vide pour compléter à la main sur le papier. Pour ne plus avoir à les saisir, complétez la fiche
            dans Équipe.
          </p>
          <p v-if="aucuneTitulaire" class="form-text mt-0">
            Aucune titulaire remplacée n'est indiquée sur la fiche.
          </p>
          <ChampSaisieDocument
            v-for="champ in champs.manquants"
            :key="champ.cle"
            v-model="formulaire.valeurs[champ.id]"
            class="mb-3"
            :champ="champ"
            :id-base="idBase"
            :erreur="erreurChamp(champ)"
            @blur="v$.formulaire.valeurs[champ.id]?.$touch()"
          />
          <p v-if="nbBlancs" class="modele-blancs" role="status" aria-live="polite">
            <PhInfo :size="16" weight="bold" aria-hidden="true" />
            <span>
              {{ nbBlancs }} information{{ nbBlancs > 1 ? 's' : '' }} laissée{{ nbBlancs > 1 ? 's' : '' }} vide{{ nbBlancs > 1 ? 's' : '' }} :
              des pointillés seront inscrits dans le document, à compléter à la main.
            </span>
          </p>
        </fieldset>
      </template>

      <p v-if="soumissionInvalide" class="formulaire-erreur mt-3" role="status" aria-live="polite">
        <PhWarning :size="14" weight="bold" aria-hidden="true" />
        <span>Certains champs sont à corriger.</span>
      </p>
    </form>

    <template #pied>
      <button type="button" class="btn btn-outline-secondary" @click="$emit('annuler')">Annuler</button>
      <button v-if="modeles.length" type="submit" :form="idFormulaire" class="btn btn-primary">
        Créer le brouillon
      </button>
    </template>
  </ModaleBase>
</template>

<script>
import { useVuelidate } from '@vuelidate/core';
import { helpers } from '@vuelidate/validators';
import { PhWarning, PhInfo, PhFileText } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import ChampSaisieDocument from '@/components/contrats/ChampSaisieDocument.vue';
import { libelleTypeModeleContrat } from '@/domain/libelles.js';
import { TYPES_MODELE_CONTRAT } from '@/domain/schema.js';
import { champsAGenerer, lireNombreSaisi, estChampTaux } from '@/domain/contrats/documents.js';
import { construireContexte } from '@/domain/contrats/marqueurs.js';
import { dateUtil } from '@/domain/utils/dates.js';
import { genId } from '@/domain/utils/id.js';

const LONGUEUR_MAX_TITRE = 200;
const LONGUEUR_MAX_TEXTE = 500;
const MESSAGE_NOMBRE = 'Saisissez un nombre, par exemple 12,5.';

/** Vrai si la saisie est vide (après trim). */
function estVide(valeur) {
  return String(valeur ?? '').trim() === '';
}

/**
 * Fenêtre « Nouveau document » (feature 0042, §6.1 et §7).
 * Présentationnelle : ni store ni routeur (le lien « Voir les modèles » excepté).
 *
 * Props : `visible`, `personne`, `personnes`, `cabinet`, `modeles` (modèles actifs).
 * Événements : `creer({ modeleId, titre, valeursSaisies })`, `annuler`.
 */
export default {
  name: 'ModaleNouveauDocument',
  components: {
    ModaleBase,
    PhWarning,
    PhInfo,
    PhFileText,
    ChampSaisieDocument,
  },
  props: {
    visible: { type: Boolean, required: true },
    personne: { type: Object, default: null },
    personnes: { type: Array, default: () => [] },
    cabinet: { type: Object, default: null },
    modeles: { type: Array, default: () => [] },
  },
  emits: ['creer', 'annuler'],
  setup() {
    // Pont requis par Vuelidate 2 en Options API (ADR 0011).
    return { v$: useVuelidate() };
  },
  data() {
    return {
      idBase: `nouveau-document-${genId()}`,
      idFormulaire: `formulaire-nouveau-document-${genId()}`,
      formulaire: { modeleId: '', titre: '', valeurs: {} },
      titrePropose: '',
      soumissionInvalide: false,
    };
  },
  computed: {
    modele() {
      return this.modeles.find((m) => m.id === this.formulaire.modeleId) ?? null;
    },
    groupesModeles() {
      return TYPES_MODELE_CONTRAT.map((code) => ({
        code,
        libelle: `${libelleTypeModeleContrat(code)}s`,
        modeles: this.modeles.filter((m) => m.type === code),
      })).filter((g) => g.modeles.length);
    },
    /** Champs à demander, avec une clé sûre (`c0`, `c1`…) pour le formulaire. */
    champs() {
      if (!this.modele || !this.personne) return { libres: [], manquants: [] };
      const contexte = construireContexte({
        personne: this.personne,
        personnes: this.personnes,
        cabinet: this.cabinet,
        aujourdhui: dateUtil.format(new Date()),
        saisies: {},
        champsLibres: this.modele.champsLibres,
      });
      const { libres, manquants } = champsAGenerer(this.modele, contexte);
      let i = 0;
      const cle = (c) => ({ ...c, id: `c${i++}` });
      return { libres: libres.map(cle), manquants: manquants.map(cle) };
    },
    tousLesChamps() {
      return [...this.champs.libres, ...this.champs.manquants];
    },
    aucuneTitulaire() {
      return !this.personne?.titulaireId && this.champs.manquants.some((c) => c.cle.startsWith('titulaire.'));
    },
    nbBlancs() {
      return this.champs.manquants.filter((c) => estVide(this.formulaire.valeurs[c.id])).length;
    },
  },
  watch: {
    visible(estVisible) {
      if (estVisible) this.reinitialiser();
    },
    'formulaire.modeleId'() {
      this.preparerModele();
    },
  },
  mounted() {
    if (this.visible) this.reinitialiser();
  },
  validations() {
    const valeurs = {};
    for (const champ of this.tousLesChamps) valeurs[champ.id] = this.reglesChamp(champ);
    return {
      formulaire: {
        modeleId: {
          required: helpers.withMessage('Choisissez un modèle de document.', (v) => !estVide(v)),
        },
        titre: {
          required: helpers.withMessage('Donnez un titre au document.', (v) => !estVide(v)),
          maxLength: helpers.withMessage(
            `Le titre est trop long (${LONGUEUR_MAX_TITRE} caractères au maximum).`,
            (v) => String(v ?? '').trim().length <= LONGUEUR_MAX_TITRE,
          ),
        },
        valeurs,
      },
    };
  },
  methods: {
    /** Règles Vuelidate d'un champ selon son type (requis ou facultatif). */
    reglesChamp(champ) {
      const regles = {};
      if (champ.requis) {
        const message = champ.type === 'NOMBRE' || champ.type === 'TAUX_RETROCESSION'
          ? MESSAGE_NOMBRE
          : `Renseignez « ${champ.libelle} ».`;
        regles.required = helpers.withMessage(message, (v) => !estVide(v));
      }
      if (champ.type === 'TEXTE') {
        regles.maxLength = helpers.withMessage(
          `Ce texte est trop long (${LONGUEUR_MAX_TEXTE} caractères au maximum).`,
          (v) => String(v ?? '').trim().length <= LONGUEUR_MAX_TEXTE,
        );
      } else if (champ.type === 'DATE') {
        regles.date = helpers.withMessage(
          'Saisissez une date valide (jour/mois/année).',
          (v) => estVide(v) || dateUtil.estDateValide(String(v)),
        );
      } else {
        regles.nombre = helpers.withMessage(MESSAGE_NOMBRE, (v) => estVide(v) || lireNombreSaisi(v) !== null);
        if (estChampTaux(champ)) {
          regles.plage = helpers.withMessage('Le taux doit être compris entre 0 et 100 %.', (v) => {
            const n = lireNombreSaisi(v);
            return n === null || (n >= 0 && n <= 100);
          });
        }
      }
      return regles;
    },
    erreurChamp(champ) {
      const regle = this.v$.formulaire.valeurs[champ.id];
      return regle?.$error ? regle.$errors[0].$message : '';
    },
    aideTaux() {
      const taux = this.personne?.tauxRetrocession;
      const texte = typeof taux === 'number' ? `${String(taux).replace('.', ',')} %` : 'non renseigné';
      return `Taux actuel sur la fiche : ${texte}`;
    },
    reinitialiser() {
      this.formulaire = {
        modeleId: this.modeles.length === 1 ? this.modeles[0].id : '',
        titre: '',
        valeurs: {},
      };
      this.titrePropose = '';
      this.soumissionInvalide = false;
      this.preparerModele();
      this.$nextTick(() => this.v$.$reset());
    },
    /** Change de modèle : champs vides et titre proposé (sans écraser un titre déjà retouché). */
    preparerModele() {
      const valeurs = {};
      for (const champ of this.tousLesChamps) valeurs[champ.id] = '';
      this.formulaire.valeurs = valeurs;
      const propose = this.modele
        ? `${this.modele.titre} - ${this.personne?.prenom ?? ''} ${this.personne?.nom ?? ''}`.trim().slice(0, LONGUEUR_MAX_TITRE)
        : '';
      if (estVide(this.formulaire.titre) || this.formulaire.titre === this.titrePropose) {
        this.formulaire.titre = propose;
      }
      this.titrePropose = propose;
    },
    onAffichee() {
      this.$refs.formulaireEl?.querySelector('input')?.focus();
    },
    /** Valeur à émettre selon le type ; `null` si laissée vide. */
    valeurEmise(champ) {
      const brute = this.formulaire.valeurs[champ.id];
      if (estVide(brute)) return null;
      if (champ.type === 'NOMBRE' || champ.type === 'TAUX_RETROCESSION') return lireNombreSaisi(brute);
      return String(brute).trim();
    },
    async soumettre() {
      this.formulaire.titre = this.formulaire.titre.trim();
      const valide = await this.v$.$validate();
      if (!valide) {
        this.soumissionInvalide = true;
        return;
      }
      const valeursSaisies = this.tousLesChamps.map((c) => ({
        cle: c.cle,
        libelle: c.libelle,
        type: c.type,
        valeur: this.valeurEmise(c),
      }));
      this.$emit('creer', { modeleId: this.formulaire.modeleId, titre: this.formulaire.titre, valeursSaisies });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.formulaire-erreur {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-1;
  margin: t.$espace-2 0 0;
  color: t.$couleur-erreur;
  font-size: t.$taille-texte-petite;

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
  }
}

.modele-groupe {
  margin: t.$espace-2 0 t.$espace-1;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.modele-carte {
  display: flex;
  align-items: center;
  gap: t.$espace-3;
  min-height: t.$cible-cliquable-min;
  margin-bottom: t.$espace-2;
  padding: t.$espace-2 t.$espace-3;
  border: 1px solid var(--bs-border-color);
  border-radius: t.$rayon-md;
  cursor: pointer;

  &:hover,
  &:focus-within {
    background-color: t.$couleur-fond-clair;
  }

  &--choisi {
    border-color: var(--bs-primary);
  }
}

.modele-blancs {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-2;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
  }
}

.btn {
  min-height: t.$cible-cliquable-min;
}
</style>
