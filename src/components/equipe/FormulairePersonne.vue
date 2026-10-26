<template>
  <ModaleBase
    :visible="visible"
    :titre="titreModale"
    taille="lg"
    @fermeture="$emit('annuler')"
    @affichee="onAffichee"
  >
    <form :id="idFormulaire" novalidate @submit.prevent="soumettre">
      <ListeOnglets
        v-model="ongletActif"
        class="mb-3"
        :onglets="ONGLETS_FICHE"
        prefixe-id="personne"
        libelle-groupe="Rubriques de la fiche personne"
      />

      <div
        v-show="ongletActif === 'general'"
        id="personne-panneau-general"
        role="tabpanel"
        aria-labelledby="personne-onglet-general"
        tabindex="0"
      >
      <!-- Identité -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="personne-prenom" class="form-label">Prénom</label>
          <input
            id="personne-prenom"
            ref="champPrenom"
            v-model.trim="formulaire.prenom"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.prenom.$error }"
            :aria-describedby="v$.formulaire.prenom.$error ? 'personne-prenom-erreur' : null"
            @blur="v$.formulaire.prenom.$touch()"
          >
          <p v-if="v$.formulaire.prenom.$error" id="personne-prenom-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.prenom.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="personne-nom" class="form-label">Nom</label>
          <input
            id="personne-nom"
            v-model.trim="formulaire.nom"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.nom.$error }"
            :aria-describedby="v$.formulaire.nom.$error ? 'personne-nom-erreur' : null"
            @blur="v$.formulaire.nom.$touch()"
          >
          <p v-if="v$.formulaire.nom.$error" id="personne-nom-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.nom.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Statut -->
      <div class="mb-4">
        <label for="personne-statut" class="form-label">Statut</label>
        <select
          id="personne-statut"
          v-model="formulaire.statut"
          class="form-select formulaire-select"
          :aria-describedby="estRemplacant ? 'personne-statut-aide' : null"
        >
          <option v-for="option in STATUTS_PERSONNE_OPTIONS" :key="option.code" :value="option.code">
            {{ option.libelle }}
          </option>
        </select>
        <div v-if="estRemplacant" id="personne-statut-aide" class="form-text">
          Le planning confie d'abord les tournées aux titulaires. Une personne remplaçante prend celles qui
          restent (jours de repos ou absences des titulaires, par exemple).
        </div>
      </div>

      <!-- Titulaire remplacée en priorité + rétrocession (remplaçant uniquement) -->
      <div v-if="estRemplacant" class="row g-3 mb-4">
        <div class="col-sm-8">
          <label for="personne-titulaire" class="form-label">Remplace en priorité</label>
          <select
            id="personne-titulaire"
            v-model="formulaire.titulaireId"
            class="form-select formulaire-select"
            :class="{ 'is-invalid': v$.formulaire.titulaireId.$error }"
            required
            :aria-describedby="
              describedBy(
                'personne-titulaire-aide',
                v$.formulaire.titulaireId.$error ? 'personne-titulaire-erreur' : null
              )
            "
            @change="v$.formulaire.titulaireId.$touch()"
            @blur="v$.formulaire.titulaireId.$touch()"
          >
            <option value="">— Choisir —</option>
            <option v-for="option in optionsTitulaireListe" :key="option.id" :value="option.id">
              {{ option.libelle }}
            </option>
          </select>
          <div id="personne-titulaire-aide" class="form-text">
            Les jours où cette titulaire ne travaille pas, cette personne est proposée avant les autres
            remplaçantes dans le planning. Les paiements des soins de cette personne sont versés à cette
            titulaire.
          </div>
          <p v-if="aucuneTitulaireActive" class="form-text text-danger mb-0">
            Aucune titulaire n'est enregistrée : ajoutez d'abord une personne titulaire pour pouvoir la choisir ici.
          </p>
          <p
            v-if="v$.formulaire.titulaireId.$error"
            id="personne-titulaire-erreur"
            class="formulaire-erreur"
          >
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.titulaireId.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-4">
          <label for="personne-retrocession" class="form-label">Rétrocession</label>
          <div class="input-group formulaire-retrocession">
            <input
              id="personne-retrocession"
              v-model="formulaire.tauxRetrocession"
              type="number"
              inputmode="numeric"
              min="0"
              max="100"
              step="1"
              class="form-control"
              :class="{ 'is-invalid': v$.formulaire.tauxRetrocession.$error }"
              :aria-describedby="
                describedBy(
                  'personne-retrocession-aide',
                  v$.formulaire.tauxRetrocession.$error ? 'personne-retrocession-erreur' : null
                )
              "
              @blur="v$.formulaire.tauxRetrocession.$touch()"
            >
            <span class="input-group-text">%</span>
          </div>
          <div id="personne-retrocession-aide" class="form-text">
            Pourcentage gardé par la titulaire sur les soins de cette remplaçante. Exemple : 11 → la
            titulaire garde 11 %, la remplaçante reçoit 89 %.
          </div>
          <p
            v-if="v$.formulaire.tauxRetrocession.$error"
            id="personne-retrocession-erreur"
            class="formulaire-erreur"
          >
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.tauxRetrocession.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Initiales Vega -->
      <div class="mb-4">
        <label for="personne-initiales-vega" class="form-label">Initiales Vega (facultatif)</label>
        <input
          id="personne-initiales-vega"
          v-model="formulaire.initialesVega"
          type="text"
          class="form-control formulaire-initiales"
          maxlength="4"
          autocomplete="off"
          placeholder="FC"
          :class="{ 'is-invalid': v$.formulaire.initialesVega.$error }"
          :aria-describedby="
            describedBy(
              'personne-initiales-vega-aide',
              v$.formulaire.initialesVega.$error ? 'personne-initiales-vega-erreur' : null
            )
          "
          @input="mettreInitialesEnMajuscules"
          @blur="v$.formulaire.initialesVega.$touch()"
        >
        <div id="personne-initiales-vega-aide" class="form-text">
          Code de 2 à 4 lettres utilisé dans la feuille de route Vega (ex. FC).
        </div>
        <p
          v-if="v$.formulaire.initialesVega.$error"
          id="personne-initiales-vega-erreur"
          class="formulaire-erreur"
        >
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.initialesVega.$errors[0].$message }}</span>
        </p>
      </div>

      <!-- Couleur de repère -->
      <div class="mb-4">
        <span class="form-label d-block">Couleur de repère</span>

        <div
          class="d-flex flex-wrap gap-2 formulaire-palette"
          role="radiogroup"
          aria-label="Couleur de repère dans le planning"
        >
          <button
            v-for="(couleur, index) in couleursSuggerees"
            :key="couleur"
            type="button"
            role="radio"
            class="formulaire-pastille"
            :style="{ backgroundColor: couleur }"
            :aria-checked="formulaire.couleur === couleur"
            :aria-label="'Couleur ' + (index + 1)"
            :tabindex="tabIndexPastille(couleur)"
            :data-couleur="couleur"
            @click="choisirCouleur(couleur)"
            @keydown="onKeydownPastille($event, couleur)"
          >
            <PhCheck
              v-if="formulaire.couleur === couleur"
              :size="20"
              weight="bold"
              class="formulaire-pastille-coche"
              aria-hidden="true"
            />
          </button>
        </div>

        <div class="mt-3">
          <label for="personne-couleur-libre" class="form-label">Autre couleur…</label>
          <input
            id="personne-couleur-libre"
            v-model="formulaire.couleur"
            type="color"
            class="form-control form-control-color"
            @blur="v$.formulaire.couleur.$touch()"
          >
        </div>

        <p v-if="v$.formulaire.couleur.$error" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.couleur.$errors[0].$message }}</span>
        </p>

        <div class="formulaire-apercu mt-3">
          <span
            class="formulaire-pastille formulaire-pastille--apercu"
            :style="{ backgroundColor: formulaire.couleur, color: couleurTexteApercu }"
            aria-hidden="true"
          >{{ repereApercu }}</span>
          <span>{{ formulaire.prenom || 'Prénom' }} {{ formulaire.nom || 'Nom' }}</span>
        </div>
      </div>

      <!-- Temps de travail -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="personne-quotite" class="form-label">Temps de travail</label>
          <div class="input-group formulaire-quotite">
            <input
              id="personne-quotite"
              v-model.number="formulaire.quotite"
              type="number"
              min="0"
              max="100"
              step="1"
              class="form-control"
              :class="{ 'is-invalid': v$.formulaire.quotite.$error }"
              :aria-describedby="
                describedBy('personne-quotite-aide', v$.formulaire.quotite.$error ? 'personne-quotite-erreur' : null)
              "
              @blur="v$.formulaire.quotite.$touch()"
            >
            <span class="input-group-text">%</span>
          </div>
          <div id="personne-quotite-aide" class="form-text">
            Proportion du temps plein travaillé par cette personne.
          </div>
          <p v-if="v$.formulaire.quotite.$error" id="personne-quotite-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.quotite.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="personne-rythme" class="form-label">Rythme de travail (facultatif)</label>
          <div class="input-group formulaire-rythme">
            <input
              id="personne-rythme"
              v-model.number="formulaire.joursTravaillesParMois"
              type="number"
              min="1"
              max="31"
              step="1"
              inputmode="numeric"
              placeholder="15"
              class="form-control"
              :class="{ 'is-invalid': v$.formulaire.joursTravaillesParMois.$error }"
              :aria-describedby="
                describedBy(
                  'personne-rythme-aide',
                  v$.formulaire.joursTravaillesParMois.$error ? 'personne-rythme-erreur' : null
                )
              "
              @blur="v$.formulaire.joursTravaillesParMois.$touch()"
            >
            <span class="input-group-text">jours par mois</span>
          </div>
          <div id="personne-rythme-aide" class="form-text">
            Nombre de jours travaillés dans un mois complet, par exemple 15. Le planning cherche à
            s'en approcher, en tenant compte des jours d'ouverture et des absences. Si ce champ est
            rempli, c'est lui qui compte pour répartir le travail (et non le pourcentage). Laissez
            vide si ce n'est pas fixé.
          </div>
          <p
            v-if="v$.formulaire.joursTravaillesParMois.$error"
            id="personne-rythme-erreur"
            class="formulaire-erreur"
          >
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.joursTravaillesParMois.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Présence -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6">
          <label for="personne-date-entree" class="form-label">Date d'arrivée (si connue)</label>
          <input
            id="personne-date-entree"
            v-model="formulaire.dateEntree"
            type="date"
            class="form-control"
            aria-describedby="personne-date-entree-aide"
          >
          <div id="personne-date-entree-aide" class="form-text">
            Avant cette date, le planning ne propose pas la personne.
          </div>
        </div>

        <div class="col-sm-6">
          <label for="personne-date-sortie" class="form-label">Date de départ (si connue)</label>
          <input
            id="personne-date-sortie"
            v-model="formulaire.dateSortie"
            type="date"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.dateSortie.$error }"
            :aria-describedby="v$.formulaire.dateSortie.$error ? 'personne-date-sortie-erreur personne-date-sortie-aide' : 'personne-date-sortie-aide'"
            @blur="v$.formulaire.dateSortie.$touch()"
          >
          <div id="personne-date-sortie-aide" class="form-text">
            Après cette date, le planning ne propose plus la personne.
          </div>
          <p v-if="v$.formulaire.dateSortie.$error" id="personne-date-sortie-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.dateSortie.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <!-- Coordonnées & notes -->
      <div class="row g-3 mb-3">
        <div class="col-sm-6">
          <label for="personne-email" class="form-label">Adresse e-mail</label>
          <input
            id="personne-email"
            v-model.trim="formulaire.contact.email"
            type="email"
            class="form-control"
            :class="{ 'is-invalid': v$.formulaire.contact.email.$error }"
            :aria-describedby="
              describedBy(
                'personne-email-aide',
                v$.formulaire.contact.email.$error ? 'personne-email-erreur' : null
              )
            "
            @blur="v$.formulaire.contact.email.$touch()"
          >
          <div id="personne-email-aide" class="form-text">
            Facultatif. Nécessaire pour recevoir le planning par e-mail.
          </div>
          <p v-if="v$.formulaire.contact.email.$error" id="personne-email-erreur" class="formulaire-erreur">
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.contact.email.$errors[0].$message }}</span>
          </p>
        </div>

        <div class="col-sm-6">
          <label for="personne-telephone" class="form-label">Téléphone (facultatif)</label>
          <input
            id="personne-telephone"
            v-model.trim="formulaire.contact.telephone"
            type="tel"
            class="form-control"
            placeholder="06 12 34 56 78"
          >
        </div>
      </div>

      <div class="mb-2">
        <label for="personne-notes" class="form-label">Notes (facultatif)</label>
        <textarea
          id="personne-notes"
          v-model="formulaire.notes"
          class="form-control"
          rows="3"
          maxlength="500"
          :class="{ 'is-invalid': v$.formulaire.notes.$error }"
          :aria-describedby="v$.formulaire.notes.$error ? 'personne-notes-erreur' : null"
          @blur="v$.formulaire.notes.$touch()"
        />
        <p v-if="v$.formulaire.notes.$error" id="personne-notes-erreur" class="formulaire-erreur">
          <PhWarning :size="14" weight="bold" aria-hidden="true" />
          <span>{{ v$.formulaire.notes.$errors[0].$message }}</span>
        </p>
      </div>
      </div>

      <div
        v-show="ongletActif === 'coordonnees'"
        id="personne-panneau-coordonnees"
        role="tabpanel"
        aria-labelledby="personne-onglet-coordonnees"
        tabindex="0"
      >
        <p class="form-text mb-3">
          Facultatif. Ces informations servent à préparer les contrats de remplacement. Elles restent
          enregistrées sur cet ordinateur et sont incluses dans les sauvegardes. Vous pourrez les
          retrouver et les copier depuis la page Équipe (bouton « Informations utiles »).
        </p>

        <fieldset class="mb-4">
          <legend class="form-label fw-bold fs-6">Adresse</legend>
          <div class="row g-3">
            <div v-for="champ in CHAMPS_LIGNES_ADRESSE" :key="champ.cle" class="col-12">
              <label :for="`personne-adresse-${champ.cle}`" class="form-label">{{ champ.libelle }}</label>
              <input
                :id="`personne-adresse-${champ.cle}`"
                v-model="formulaire.adresse[champ.cle]"
                type="text"
                class="form-control"
                :maxlength="LONGUEURS_MAX_ADRESSE[champ.cle]"
                autocomplete="off"
                :placeholder="champ.exemple"
              >
            </div>

            <div class="col-sm-4">
              <label for="personne-adresse-code-postal" class="form-label">{{ champCodePostal.libelle }}</label>
              <input
                id="personne-adresse-code-postal"
                v-model="formulaire.adresse.codePostal"
                type="text"
                inputmode="numeric"
                :maxlength="LONGUEURS_MAX_ADRESSE.codePostal"
                autocomplete="off"
                class="form-control formulaire-code-postal"
                :placeholder="champCodePostal.exemple"
                :class="{ 'is-invalid': v$.formulaire.adresse.codePostal.$error }"
                :aria-describedby="v$.formulaire.adresse.codePostal.$error ? 'personne-adresse-code-postal-erreur' : null"
                @blur="normaliserCodePostalSaisi"
              >
              <p
                v-if="v$.formulaire.adresse.codePostal.$error"
                id="personne-adresse-code-postal-erreur"
                class="formulaire-erreur"
              >
                <PhWarning :size="14" weight="bold" aria-hidden="true" />
                <span>{{ v$.formulaire.adresse.codePostal.$errors[0].$message }}</span>
              </p>
            </div>

            <div class="col-sm-8">
              <label for="personne-adresse-ville" class="form-label">{{ champVille.libelle }}</label>
              <input
                id="personne-adresse-ville"
                v-model="formulaire.adresse.ville"
                type="text"
                class="form-control"
                :maxlength="LONGUEURS_MAX_ADRESSE.ville"
                autocomplete="off"
                :placeholder="champVille.exemple"
              >
            </div>
          </div>
        </fieldset>

        <div class="mb-2">
          <label for="personne-date-naissance" class="form-label">Date de naissance</label>
          <input
            id="personne-date-naissance"
            v-model="formulaire.dateNaissance"
            type="date"
            class="form-control formulaire-date-naissance"
            :min="bornesNaissance.min"
            :max="bornesNaissance.max"
            autocomplete="off"
            :class="{ 'is-invalid': v$.formulaire.dateNaissance.$error }"
            :aria-describedby="
              describedBy(
                'personne-date-naissance-aide',
                v$.formulaire.dateNaissance.$error ? 'personne-date-naissance-erreur' : null
              )
            "
            @blur="v$.formulaire.dateNaissance.$touch()"
          >
          <div id="personne-date-naissance-aide" class="form-text">
            Vous pouvez taper la date au clavier : le jour, le mois, puis l'année.
          </div>
          <p
            v-if="v$.formulaire.dateNaissance.$error"
            id="personne-date-naissance-erreur"
            class="formulaire-erreur"
          >
            <PhWarning :size="14" weight="bold" aria-hidden="true" />
            <span>{{ v$.formulaire.dateNaissance.$errors[0].$message }}</span>
          </p>
        </div>
      </div>

      <div
        v-show="ongletActif === 'pro'"
        id="personne-panneau-pro"
        role="tabpanel"
        aria-labelledby="personne-onglet-pro"
        tabindex="0"
      >
        <p class="form-text mb-3">
          Facultatif. Ces numéros restent enregistrés sur cet ordinateur, avec le reste du planning, et
          sont inclus dans les sauvegardes. Vous pourrez les retrouver et les copier depuis la page
          Équipe (bouton « Informations utiles »).
        </p>
        <div v-for="champ in CHAMPS_IDENTIFIANTS" :key="champ.cle" class="mb-4">
          <label :for="`personne-identifiant-${champ.cle}`" class="form-label">{{ champ.libelle }}</label>
          <input
            :id="`personne-identifiant-${champ.cle}`"
            v-model="formulaire.identifiants[champ.cle]"
            type="text"
            class="form-control formulaire-identifiant"
            :maxlength="LONGUEUR_MAX_IDENTIFIANT"
            autocomplete="off"
            :aria-describedby="
              describedBy(
                `personne-identifiant-${champ.cle}-aide`,
                avertissements[champ.cle] ? `personne-identifiant-${champ.cle}-avertissement` : null
              )
            "
          >
          <div :id="`personne-identifiant-${champ.cle}-aide`" class="form-text">{{ champ.aide }}</div>
          <p
            v-if="avertissements[champ.cle]"
            :id="`personne-identifiant-${champ.cle}-avertissement`"
            class="formulaire-avertissement"
          >
            <PhInfo :size="14" weight="bold" aria-hidden="true" />
            <span>{{ avertissements[champ.cle] }}</span>
          </p>
        </div>
      </div>

      <p
        v-if="soumissionInvalide"
        class="formulaire-erreur mt-3"
        role="status"
        aria-live="polite"
      >
        <PhWarning :size="14" weight="bold" aria-hidden="true" />
        <span>Certains champs sont à corriger.</span>
      </p>
    </form>

    <template #pied>
      <button type="button" class="btn btn-outline-secondary" @click="$emit('annuler')">Annuler</button>
      <button type="submit" :form="idFormulaire" class="btn btn-primary">Enregistrer</button>
    </template>
  </ModaleBase>
</template>

<script>
import { useVuelidate } from '@vuelidate/core';
import { required, requiredIf, integer, between, email, maxLength, helpers } from '@vuelidate/validators';
import { PhCheck, PhInfo, PhWarning } from '@phosphor-icons/vue';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import ListeOnglets from '@/components/communs/ListeOnglets.vue';
import {
  CHAMPS_IDENTIFIANTS,
  LONGUEUR_MAX_IDENTIFIANT,
  normaliserIdentifiants,
  avertissementIdentifiant,
} from '@/domain/identifiantsPro.js';
import { STATUTS_PERSONNE_OPTIONS } from '@/domain/libelles.js';
import { genId } from '@/domain/utils/id.js';
import {
  reperePersonne,
  couleurTexteRepere,
  optionsTitulaire,
  normaliserTitulaireId,
  normaliserTauxRetrocession,
  estTauxRetrocessionValide,
} from '@/domain/personnes.js';
import { dateUtil } from '@/domain/utils/dates.js';
import {
  LONGUEURS_MAX_ADRESSE,
  adresseVide,
  normaliserAdresse,
  normaliserCodePostal,
  estCodePostalValide,
} from '@/domain/adresse.js';
import {
  CHAMPS_ADRESSE_PERSONNE,
  normaliserDateNaissance,
  estDateNaissancePassee,
  estAgeNaissancePlausible,
  bornesDateNaissance,
} from '@/domain/coordonnees.js';
import { estRythmeMensuelValide, normaliserRythmeMensuel } from '@/domain/rythmeMensuel.js';
import {
  normaliserInitialesVega,
  estInitialesVegaValide,
  personneAvecInitialesVega,
} from '@/domain/initialesVega.js';

/**
 * Formulaire présentational d'ajout/édition d'une personne (feature 0004).
 *
 * Bâti au-dessus de `ModaleBase`. N'accède **pas** au store : il reçoit ses
 * données par props (`personne` = `null` en création, objet en édition) et
 * **émet** le résultat normalisé (`enregistrer`) ou une annulation
 * (`annuler`) ; c'est l'écran appelant (`EquipeView`) qui dispatche vers le
 * store. Toute validation se fait avant émission : un formulaire invalide
 * n'émet jamais `enregistrer` et conserve la saisie en cours.
 */
export default {
  name: 'FormulairePersonne',
  components: { ModaleBase, ListeOnglets, PhCheck, PhInfo, PhWarning },
  props: {
    /** Affiche (`true`) ou masque (`false`) la modale ; piloté par le parent. */
    visible: { type: Boolean, required: true },
    /** `null` = mode création ; objet `Personne` = mode édition. */
    personne: { type: Object, default: null },
    /** Palette de couleurs suggérées (`cabinet/parametres.couleursParDefaut`). */
    couleursSuggerees: { type: Array, default: () => [] },
    /** Toutes les personnes (actives et archivées), pour l'unicité des initiales Vega. */
    personnes: { type: Array, default: () => [] },
    /**
     * Champ qui reçoit le focus à l'ouverture : `'prenom'` (défaut) ou
     * `'email'` (lien profond depuis l'envoi du planning, feature 0027) ou
     * `'identifiants'` (ouvre l'onglet « Informations professionnelles », feature 0030) ou
     * `'remplacement'` (lien profond depuis le bilan, feature 0036 : focus sur « Remplace en
     * priorité » ou « Rétrocession », et affichage immédiat de ce qui manque) ou
     * `'coordonnees'` (ouvre l'onglet « Adresse et naissance », feature 0040).
     */
    champInitial: { type: String, default: 'prenom' },
  },
  emits: ['enregistrer', 'annuler'],
  setup() {
    // Seul usage de la Composition API : pont requis par Vuelidate 2 en
    // Options API (ADR 0011), comme dans ParametresView.
    return { v$: useVuelidate() };
  },
  data() {
    return {
      STATUTS_PERSONNE_OPTIONS,
      CHAMPS_IDENTIFIANTS,
      LONGUEUR_MAX_IDENTIFIANT,
      LONGUEURS_MAX_ADRESSE,
      // Lignes pleine largeur de l'adresse ; code postal et ville ont leur propre rendu.
      CHAMPS_LIGNES_ADRESSE: CHAMPS_ADRESSE_PERSONNE.filter((c) => c.cle.startsWith('ligne')),
      champCodePostal: CHAMPS_ADRESSE_PERSONNE.find((c) => c.cle === 'codePostal'),
      champVille: CHAMPS_ADRESSE_PERSONNE.find((c) => c.cle === 'ville'),
      ONGLETS_FICHE: [
        { code: 'general', libelle: 'Informations générales' },
        { code: 'coordonnees', libelle: 'Adresse et naissance' },
        { code: 'pro', libelle: 'Informations professionnelles' },
      ],
      ongletActif: this.ongletInitial(),
      // Identifiant unique du `<form>`, pour relier le bouton « Enregistrer »
      // du pied de modale (hors du `<form>`) via l'attribut HTML `form`.
      idFormulaire: `formulaire-personne-${genId()}`,
      formulaire: this.construireFormulaire(),
      // `true` après une tentative de soumission bloquée par la validation :
      // affiche un court récapitulatif près du pied de modale.
      soumissionInvalide: false,
    };
  },
  computed: {
    /** Initiales de l'aperçu : suit en direct « Initiales Vega », sinon le prénom saisi. */
    repereApercu() {
      return reperePersonne(this.formulaire);
    },
    couleurTexteApercu() {
      return couleurTexteRepere(this.formulaire.couleur);
    },
    estRemplacant() {
      return this.formulaire.statut === 'REMPLACANT';
    },
    /** Titulaires proposables (hors la personne éditée) + rattachement actuel conservé. */
    optionsTitulaireListe() {
      return optionsTitulaire(this.personnes, {
        idExclu: this.personne?.id ?? null,
        titulaireIdActuel: this.formulaire.titulaireId || null,
      });
    },
    /** Aucune titulaire active proposable (hors rattachement conservé). */
    aucuneTitulaireActive() {
      return this.optionsTitulaireListe.length === 0;
    },
    /** Avertissements non bloquants par clé d'identifiant (hors Vuelidate). */
    avertissements() {
      const resultat = {};
      for (const { cle } of CHAMPS_IDENTIFIANTS) {
        resultat[cle] = avertissementIdentifiant(cle, this.formulaire.identifiants[cle]);
      }
      return resultat;
    },
    /** Date du jour `"YYYY-MM-DD"`, pour les bornes et contrôles de la date de naissance. */
    aujourdhui() {
      return dateUtil.format(new Date());
    },
    bornesNaissance() {
      return bornesDateNaissance(this.aujourdhui);
    },
    titreModale() {
      return this.personne ? 'Modifier la personne' : 'Ajouter une personne';
    },
  },
  watch: {
    visible(estVisible) {
      if (estVisible) {
        this.reinitialiser();
      }
    },
  },
  mounted() {
    if (this.visible) {
      this.reinitialiser();
    }
  },
  validations() {
    return {
      formulaire: {
        prenom: {
          required: helpers.withMessage('Indiquez le prénom de la personne.', required),
        },
        nom: {
          required: helpers.withMessage('Indiquez le nom de la personne.', required),
        },
        initialesVega: {
          format: helpers.withMessage(
            'Saisissez 2 à 4 lettres sans accent ou chiffres (ex. FC).',
            (valeur) => estInitialesVegaValide(valeur)
          ),
          unique: helpers.withMessage(
            (param) => {
              const autre = personneAvecInitialesVega(
                param.$model,
                this.personnes,
                this.personne?.id ?? null
              );
              return autre
                ? `Ces initiales sont déjà utilisées par ${autre.prenom} ${autre.nom}.`
                : 'Ces initiales sont déjà utilisées.';
            },
            (valeur) =>
              personneAvecInitialesVega(valeur, this.personnes, this.personne?.id ?? null) === null
          ),
        },
        couleur: {
          required: helpers.withMessage('Choisissez une couleur de repère.', required),
        },
        quotite: {
          required: helpers.withMessage(
            'Indiquez un temps de travail entre 0 et 100 %.',
            required
          ),
          integer: helpers.withMessage(
            'Indiquez un temps de travail en pourcentage entier (sans virgule).',
            integer
          ),
          between: helpers.withMessage(
            'Indiquez un temps de travail entre 0 et 100 %.',
            between(0, 100)
          ),
        },
        joursTravaillesParMois: {
          rythme: helpers.withMessage(
            'Indiquez un nombre entier de jours entre 1 et 31, ou laissez le champ vide.',
            (valeur) => estRythmeMensuelValide(valeur)
          ),
        },
        titulaireId: {
          required: helpers.withMessage(
            'Choisissez la titulaire que cette personne remplace.',
            requiredIf(() => this.formulaire.statut === 'REMPLACANT')
          ),
        },
        tauxRetrocession: {
          required: helpers.withMessage(
            'Indiquez la rétrocession, en pourcentage entier entre 0 et 100.',
            requiredIf(() => this.formulaire.statut === 'REMPLACANT')
          ),
          taux: helpers.withMessage(
            'Indiquez un pourcentage entier entre 0 et 100.',
            (valeur, parent) => parent.statut !== 'REMPLACANT' || estTauxRetrocessionValide(valeur)
          ),
        },
        dateSortie: {
          coherence: helpers.withMessage(
            "La date de départ doit être identique ou postérieure à la date d'arrivée.",
            (valeur, parent) => !parent.dateEntree || !valeur || valeur >= parent.dateEntree
          ),
        },
        adresse: {
          codePostal: {
            format: helpers.withMessage(
              'Indiquez un code postal à 5 chiffres (ex. 69003).',
              (valeur) => estCodePostalValide(normaliserCodePostal(valeur))
            ),
          },
        },
        dateNaissance: {
          passee: helpers.withMessage(
            'La date de naissance doit être une date passée.',
            (valeur) => estDateNaissancePassee(valeur, this.aujourdhui)
          ),
          age: helpers.withMessage(
            'Vérifiez la date de naissance : l\'âge doit être compris entre 16 et 100 ans.',
            (valeur) => estAgeNaissancePlausible(valeur, this.aujourdhui)
          ),
        },
        contact: {
          email: {
            email: helpers.withMessage(
              'Saisissez une adresse e-mail valide (ex. nom@exemple.fr).',
              email
            ),
          },
        },
        notes: {
          maxLength: helpers.withMessage(
            'La note ne doit pas dépasser 500 caractères.',
            maxLength(500)
          ),
        },
      },
    };
  },
  methods: {
    /**
     * Construit le brouillon local à partir de `personne` (édition) ou des
     * valeurs par défaut (création). Ne mute jamais la prop `personne` : les
     * objets imbriqués (`contact`) sont toujours recopiés.
     * @returns {Object} Brouillon prêt à être édité localement.
     */
    construireFormulaire() {
      if (this.personne) {
        return {
          prenom: this.personne.prenom,
          nom: this.personne.nom,
          statut: this.personne.statut,
          initialesVega: this.personne.initialesVega ?? '',
          couleur: this.personne.couleur,
          quotite: this.personne.quotite,
          joursTravaillesParMois: this.personne.joursTravaillesParMois ?? '',
          titulaireId: this.personne.titulaireId ?? '',
          tauxRetrocession: this.personne.tauxRetrocession ?? '',
          dateEntree: this.personne.dateEntree ?? '',
          dateSortie: this.personne.dateSortie ?? '',
          contact: {
            email: this.personne.contact?.email ?? '',
            telephone: this.personne.contact?.telephone ?? '',
          },
          notes: this.personne.notes ?? '',
          adresse: { ...normaliserAdresse(this.personne.adresse) },
          dateNaissance: this.personne.dateNaissance ?? '',
          identifiants: { ...normaliserIdentifiants(this.personne.identifiants) },
        };
      }

      return {
        prenom: '',
        nom: '',
        statut: 'TITULAIRE',
        initialesVega: '',
        couleur: this.couleursSuggerees[0] ?? '#0E8A8F',
        quotite: 100,
        joursTravaillesParMois: '',
        titulaireId: '',
        tauxRetrocession: '',
        dateEntree: '',
        dateSortie: '',
        contact: { email: '', telephone: '' },
        notes: '',
        adresse: adresseVide(),
        dateNaissance: '',
        identifiants: { ...normaliserIdentifiants(null) },
      };
    },

    /**
     * Onglet affiché à l'ouverture selon `champInitial`.
     * @returns {('general'|'coordonnees'|'pro')}
     */
    ongletInitial() {
      if (this.champInitial === 'identifiants') return 'pro';
      if (this.champInitial === 'coordonnees') return 'coordonnees';
      return 'general';
    },

    /** Au départ du champ « Code postal » : retire les espaces (« 75 011 » → « 75011 »), puis valide. */
    normaliserCodePostalSaisi() {
      this.formulaire.adresse.codePostal = normaliserCodePostal(this.formulaire.adresse.codePostal);
      this.v$.formulaire.adresse.codePostal.$touch();
    },

    /**
     * Réinitialise le brouillon et l'état de validation à chaque ouverture
     * de la modale (création vierge ou édition pré-remplie selon `personne`).
     * Le focus, lui, est posé séparément (voir `onAffichee`) une fois la
     * transition d'ouverture de la modale réellement terminée.
     */
    reinitialiser() {
      this.formulaire = this.construireFormulaire();
      this.ongletActif = this.ongletInitial();
      this.v$.$reset();
      this.soumissionInvalide = false;
    },

    /**
     * Place le focus sur le champ prénom une fois que `ModaleBase` a fini
     * d'afficher la modale (événement `affichee`, relayé depuis
     * `shown.bs.modal` de Bootstrap). Le focus est ainsi déterministe : posé
     * après la fin réelle de la transition, il ne se fait pas reprendre par
     * le piège à focus de la modale (contrairement à un délai arbitraire).
     */
    onAffichee() {
      if (this.champInitial === 'identifiants') {
        this.$el.querySelector(`#personne-identifiant-${CHAMPS_IDENTIFIANTS[0].cle}`)?.focus();
        return;
      }
      if (this.champInitial === 'coordonnees') {
        this.$el.querySelector('#personne-adresse-ligne1')?.focus();
        return;
      }
      if (this.champInitial === 'remplacement') {
        const id = this.formulaire.titulaireId ? '#personne-retrocession' : '#personne-titulaire';
        this.$el.querySelector(id)?.focus();
        this.v$.formulaire.titulaireId.$touch();
        this.v$.formulaire.tauxRetrocession.$touch();
        return;
      }
      if (this.champInitial === 'email') {
        this.$el.querySelector('#personne-email')?.focus();
        // Une adresse invalide affiche aussitôt son message ; vide = aucune erreur (facultatif).
        this.v$.formulaire.contact.email.$touch();
        return;
      }
      this.$refs.champPrenom?.focus();
    },

    /**
     * Construit une valeur `aria-describedby` à partir d'identifiants
     * optionnels (aide, erreur…), en ignorant ceux qui valent `null`/`''`.
     * @param {...(string|null)} ids
     * @returns {string|null}
     */
    describedBy(...ids) {
      const valides = ids.filter(Boolean);
      return valides.length ? valides.join(' ') : null;
    },

    /** Force les majuscules à la frappe dans le champ « Initiales Vega ». */
    mettreInitialesEnMajuscules(event) {
      this.formulaire.initialesVega = event.target.value.toUpperCase();
    },

    /** Index de tabulation d'une pastille (tabulation « roving » du groupe de radios). */
    tabIndexPastille(couleur) {
      if (this.formulaire.couleur === couleur) return 0;
      const uneSuggestionEstSelectionnee = this.couleursSuggerees.includes(this.formulaire.couleur);
      return !uneSuggestionEstSelectionnee && couleur === this.couleursSuggerees[0] ? 0 : -1;
    },

    choisirCouleur(couleur) {
      this.formulaire.couleur = couleur;
      this.v$.formulaire.couleur.$touch();
    },

    /**
     * Navigation clavier du groupe de pastilles de couleur (pattern ARIA
     * « radiogroup ») : `Entrée`/`Espace` sélectionnent la pastille sous le
     * focus ; les flèches (`←`/`↑` = précédente, `→`/`↓` = suivante)
     * déplacent la sélection **et** le focus vers la pastille voisine, avec
     * bouclage sur la première/dernière pastille du groupe.
     * @param {KeyboardEvent} event
     * @param {string} couleur Couleur portée par la pastille qui reçoit l'événement.
     */
    onKeydownPastille(event, couleur) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.choisirCouleur(couleur);
        return;
      }

      const versSuivante = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      const versPrecedente = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      if (!versSuivante && !versPrecedente) return;

      event.preventDefault();
      const bouton = event.currentTarget;
      const groupe = bouton.parentElement;
      const cible = versSuivante
        ? bouton.nextElementSibling ?? groupe.firstElementChild
        : bouton.previousElementSibling ?? groupe.lastElementChild;
      if (!cible) return;

      this.choisirCouleur(cible.dataset.couleur);
      cible.focus();
    },

    /**
     * Ordre visuel des champs du formulaire, utilisé pour focaliser le
     * premier champ en erreur après une tentative de soumission invalide
     * (`soumettre`). Chaque entrée relie une validation Vuelidate à
     * l'identifiant DOM du champ correspondant.
     * @returns {Array<{ validation: Object, id: string }>}
     */
    champsEnOrdre() {
      const f = this.v$.formulaire;
      return [
        { onglet: 'general', validation: f.prenom, id: 'personne-prenom' },
        { onglet: 'general', validation: f.nom, id: 'personne-nom' },
        { onglet: 'general', validation: f.initialesVega, id: 'personne-initiales-vega' },
        { onglet: 'general', validation: f.titulaireId, id: 'personne-titulaire' },
        { onglet: 'general', validation: f.tauxRetrocession, id: 'personne-retrocession' },
        { onglet: 'general', validation: f.couleur, id: 'personne-couleur-libre' },
        { onglet: 'general', validation: f.quotite, id: 'personne-quotite' },
        { onglet: 'general', validation: f.joursTravaillesParMois, id: 'personne-rythme' },
        { onglet: 'general', validation: f.dateSortie, id: 'personne-date-sortie' },
        { onglet: 'general', validation: f.contact.email, id: 'personne-email' },
        { onglet: 'general', validation: f.notes, id: 'personne-notes' },
        { onglet: 'coordonnees', validation: f.adresse.codePostal, id: 'personne-adresse-code-postal' },
        { onglet: 'coordonnees', validation: f.dateNaissance, id: 'personne-date-naissance' },
      ];
    },

    /**
     * Place le focus sur le premier champ en erreur (ordre visuel du
     * formulaire) après une tentative de soumission invalide : le fait
     * défiler dans la vue et guide la correction, plutôt que de laisser
     * l'utilisateur chercher le message d'erreur dans une longue modale.
     */
    focusPremierChampErrone() {
      const enErreur = this.champsEnOrdre().filter((champ) => champ.validation.$error);
      // Priorité à l'onglet affiché ; sinon premier champ en erreur dans l'ordre des onglets.
      const premierEnErreur =
        enErreur.find((champ) => champ.onglet === this.ongletActif) ?? enErreur[0];
      if (!premierEnErreur) return;
      // On bascule sur l'onglet du champ si besoin, puis on focalise une fois le panneau réaffiché.
      if (this.ongletActif !== premierEnErreur.onglet) this.ongletActif = premierEnErreur.onglet;
      this.$nextTick(() => {
        this.$el.querySelector(`#${premierEnErreur.id}`)?.focus();
      });
    },

    soumettre() {
      this.v$.$touch();
      if (this.v$.$invalid) {
        this.soumissionInvalide = true;
        this.focusPremierChampErrone();
        return;
      }
      this.soumissionInvalide = false;

      this.$emit('enregistrer', {
        prenom: this.formulaire.prenom.trim(),
        nom: this.formulaire.nom.trim(),
        statut: this.formulaire.statut,
        initialesVega: normaliserInitialesVega(this.formulaire.initialesVega),
        couleur: this.formulaire.couleur,
        quotite: this.formulaire.quotite,
        joursTravaillesParMois: normaliserRythmeMensuel(this.formulaire.joursTravaillesParMois),
        titulaireId: normaliserTitulaireId(this.formulaire.statut, this.formulaire.titulaireId),
        tauxRetrocession: normaliserTauxRetrocession(this.formulaire.statut, this.formulaire.tauxRetrocession),
        dateEntree: this.formulaire.dateEntree || null,
        dateSortie: this.formulaire.dateSortie || null,
        contact: {
          email: this.formulaire.contact.email || null,
          telephone: this.formulaire.contact.telephone || null,
        },
        notes: this.formulaire.notes,
        adresse: normaliserAdresse(this.formulaire.adresse),
        dateNaissance: normaliserDateNaissance(this.formulaire.dateNaissance || null),
        identifiants: normaliserIdentifiants(this.formulaire.identifiants),
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.formulaire-select {
  max-width: 20rem;
}

// Cible cliquable confortable, cohérente avec le reste de l'application.
.form-control,
.form-select {
  min-height: t.$cible-cliquable-min;
}

.formulaire-initiales {
  max-width: 10rem;
  text-transform: uppercase;
}

.formulaire-quotite {
  max-width: 12rem;
}

.formulaire-rythme {
  max-width: 14rem;
}

.formulaire-retrocession {
  max-width: 10rem;
}

.formulaire-code-postal {
  max-width: 8rem;
}

.formulaire-date-naissance {
  max-width: 14rem;
}

.formulaire-pastille {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: t.$cible-cliquable-min;
  height: t.$cible-cliquable-min;
  padding: 0;
  border: 2px solid t.$couleur-bordure;
  box-shadow: 0 0 0 1px t.$couleur-contour-pastille;
  border-radius: 50%;
  cursor: pointer;

  &:focus-visible {
    @include m.focus-visible;
  }
}

.formulaire-pastille-coche {
  color: #fff;
  // Assure la lisibilité de la coche sur une couleur claire comme sur une
  // couleur foncée (repère non-coloré, cf. accessibilité).
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.7));
}

.formulaire-pastille--apercu {
  @include m.pastille-initiales;
}

.formulaire-apercu {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  font-weight: t.$graisse-gras;
}

.formulaire-identifiant {
  max-width: 20rem;
}

// Avertissement non bloquant : icône info + couleur d'avertissement, pas de bordure rouge.
.formulaire-avertissement {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-1;
  margin: t.$espace-2 0 0;
  color: t.$couleur-avertissement-texte;
  font-size: t.$taille-texte-petite;

  svg {
    flex-shrink: 0;
    margin-top: 0.15em;
  }
}

// Présentation des messages d'erreur, cohérente avec ParametresView.
.formulaire-erreur {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-1;
  margin: t.$espace-2 0 0;
  color: t.$couleur-erreur;
  font-size: t.$taille-texte-petite;

  svg {
    flex-shrink: 0;
    margin-top: 0.15em;
  }
}
</style>
