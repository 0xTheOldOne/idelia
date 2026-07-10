<template>
  <section class="carte-a-traiter" aria-labelledby="carte-a-traiter-titre">
    <h2 id="carte-a-traiter-titre">À traiter</h2>

    <div v-if="etat === 'aucun'" class="carte-a-traiter-vide">
      <PhCalendarPlus :size="32" aria-hidden="true" />
      <p class="mb-0">Aucun planning pour l'instant.</p>
      <router-link class="btn btn-primary carte-a-traiter-bouton" :to="{ name: 'planning' }">
        <PhCalendarPlus :size="20" weight="bold" aria-hidden="true" />
        <span>Générer un planning</span>
      </router-link>
    </div>

    <p v-else-if="etat === 'chargement'" class="carte-a-traiter-chargement">
      <PhHourglassMedium :size="20" aria-hidden="true" />
      <span>Vérification du planning en cours…</span>
    </p>

    <template v-else>
      <div class="alert d-flex gap-2" :class="classeEncart" role="status">
        <component :is="iconeEtat" :size="24" weight="fill" class="flex-shrink-0" aria-hidden="true" />
        <p class="mb-0">{{ messageEtat }}</p>
      </div>

      <button
        type="button"
        class="btn btn-primary carte-a-traiter-bouton"
        @click="$emit('ouvrir', planning.id)"
      >
        <span>Ouvrir l'éditeur</span>
        <PhArrowRight :size="18" aria-hidden="true" />
      </button>
    </template>
  </section>
</template>

<script>
import {
  PhCalendarPlus,
  PhHourglassMedium,
  PhWarning,
  PhInfo,
  PhCheckCircle,
  PhArrowRight,
} from '@phosphor-icons/vue';

import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Carte « À traiter » (feature 0013, tableau de bord) : pointe les conflits
 * du planning **pertinent** (`prochainPlanning`, domaine). **Présentational**
 * pur — reçoit `planning` et `resume` déjà calculés (l'appel moteur
 * `diagnostiquer` passe uniquement par l'action `plannings/resumeConflits`,
 * jamais depuis ce composant, [ADR 0008](../../../docs/adr/0008-moteur-planification-module-pur.md)).
 *
 * Quatre états visibles (§6.2 du plan), plus un état neutre transitoire
 * (« chargement ») tant que `resume` n'est pas encore disponible pour un
 * planning existant (le résumé est peuplé de façon asynchrone au montage de
 * l'écran, §8 : jamais bloquant, jamais présenté comme une erreur) :
 * - `planning === null` → invite à générer un premier planning ;
 * - `resume === null` (planning existant) → état neutre, en attente ;
 * - `resume.aResoudre > 0` → encart avertissement (bloquant) ;
 * - `aResoudre === 0 && nbAvertissements > 0` → encart info (souple) ;
 * - sinon → encart rassurant (« Ce planning est prêt. »).
 *
 * Aucune reformulation des messages du moteur : uniquement des **comptes**
 * et un lien vers l'éditeur, où `PanneauConflits` affiche les messages
 * verbatim.
 */
export default {
  name: 'CarteATraiter',
  components: {
    PhCalendarPlus,
    PhHourglassMedium,
    PhWarning,
    PhInfo,
    PhCheckCircle,
    PhArrowRight,
  },
  props: {
    /** Le planning pertinent (`prochainPlanning`, domaine), ou `null` si aucun. */
    planning: { type: Object, default: null },
    /**
     * Résumé de conflits du planning pertinent (`resumerDiagnostic`) :
     * `{ nbErreurs, nbAvertissements, nbNonCouvertes, aResoudre }`, ou `null`
     * tant qu'il n'a pas encore été calculé (ou si `planning` est `null`).
     */
    resume: { type: Object, default: null },
  },
  emits: ['ouvrir'],
  computed: {
    etat() {
      if (!this.planning) return 'aucun';
      if (!this.resume) return 'chargement';
      if (this.resume.aResoudre > 0) return 'bloquant';
      if (this.resume.nbAvertissements > 0) return 'avertissement';
      return 'pret';
    },
    classeEncart() {
      if (this.etat === 'bloquant') return 'alert-warning';
      if (this.etat === 'avertissement') return 'alert-info';
      return 'alert-success';
    },
    iconeEtat() {
      if (this.etat === 'bloquant') return PhWarning;
      if (this.etat === 'avertissement') return PhInfo;
      return PhCheckCircle;
    },
    messageEtat() {
      if (this.etat === 'bloquant') {
        const n = this.resume.aResoudre;
        const semaine = dateUtil.numeroSemaineIso(this.planning.dateDebut);
        return `${n} point${n > 1 ? 's' : ''} à résoudre sur le planning de la semaine ${semaine}`;
      }
      if (this.etat === 'avertissement') {
        const n = this.resume.nbAvertissements;
        return `${n} souhait${n > 1 ? 's' : ''} non tenu${n > 1 ? 's' : ''}`;
      }
      return 'Ce planning est prêt.';
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.carte-a-traiter {
  padding: t.$espace-4;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-lg;
}

.carte-a-traiter-vide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: t.$espace-3;
  padding: t.$espace-5 t.$espace-4;
  margin-top: t.$espace-3;
  text-align: center;
  color: t.$couleur-texte-attenue;
  background-color: t.$couleur-fond-clair;
  border-radius: t.$rayon-lg;
}

.carte-a-traiter-chargement {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin: t.$espace-3 0 0;
  color: t.$couleur-texte-attenue;
}

.carte-a-traiter-bouton {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
  margin-top: t.$espace-3;
}

.alert {
  margin-top: t.$espace-3;
}
</style>
