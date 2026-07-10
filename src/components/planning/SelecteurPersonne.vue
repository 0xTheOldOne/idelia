<template>
  <ModaleBase :visible="visible" :titre="titre" @fermeture="$emit('annuler')" @affichee="onAffichee">
    <div class="mb-3">
      <label for="selecteur-personne-filtre" class="form-label">Rechercher une personne</label>
      <input
        id="selecteur-personne-filtre"
        ref="champFiltre"
        v-model.trim="filtre"
        type="text"
        class="form-control"
        placeholder="Nom ou prénom"
      >
    </div>

    <p v-if="personnesMasquees" class="selecteur-personne-aide-masquage">
      Les personnes déjà présentes sur ces horaires ne sont pas affichées.
    </p>

    <ul v-if="personnesFiltrees.length" class="selecteur-personne-liste">
      <li v-for="personne in personnesFiltrees" :key="personne.id">
        <button
          type="button"
          class="btn btn-outline-secondary selecteur-personne-bouton"
          @click="$emit('choisir', personne.id)"
        >
          <span
            class="selecteur-personne-pastille"
            :style="{ backgroundColor: personne.couleur }"
            aria-hidden="true"
          />
          <span class="selecteur-personne-nom">{{ personne.nom }}</span>
          <span v-if="personne.nbAffectationsCeJour > 0" class="selecteur-personne-note">
            déjà {{ personne.nbAffectationsCeJour }} affectation{{ personne.nbAffectationsCeJour > 1 ? 's' : '' }}
            ce jour-là
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="selecteur-personne-vide">
      {{
        personnesDisponibles.length === 0
          ? 'Toute l’équipe active est déjà affectée sur ces horaires.'
          : 'Aucune personne ne correspond à cette recherche.'
      }}
    </p>

    <template #pied>
      <button type="button" class="btn btn-outline-secondary" @click="$emit('annuler')">Annuler</button>
    </template>
  </ModaleBase>
</template>

<script>
import { mapGetters } from 'vuex';

import ModaleBase from '@/components/communs/ModaleBase.vue';
import { libelleJour } from '@/domain/libelles.js';
import { dateUtil } from '@/domain/utils/dates.js';

/**
 * Mini-sélecteur de personne (feature 0011, tâche 3) : modale bâtie sur
 * `ModaleBase` (§6.2 du plan) listant les **personnes actives** (pastille +
 * Prénom Nom, jamais la couleur seule), avec filtre texte et note discrète
 * « déjà N affectation(s) ce jour-là » (lecture présentationnelle des
 * affectations du planning courant, **aucune règle métier**). Masque les
 * personnes déjà présentes sur **ce segment exact** ciblé (feature 0016,
 * ADR 0017 — même tournée, même date, même `segmentIndex` : dé-doublonnage)
 * et affiche alors une ligne d'aide expliquant ce masquage (correctif
 * ergonomie MIN-5, feature 0011), sans jamais employer le mot « segment » à
 * l'écran (on parle d'« horaires »).
 *
 * **Liste de choix, pas un formulaire** ([ADR 0011](../../../docs/adr/0011-validation-vuelidate-vue-debounce.md)) :
 * pas de Vuelidate. Un clic sur un nom émet `choisir(personneId)` ; toute
 * autre fermeture (croix, Échap, clic hors fenêtre, bouton « Annuler »)
 * émet `annuler` — jamais une confirmation implicite.
 *
 * N'accède au store que pour lister les personnes actives (pastille + nom) ;
 * aucun import `@/domain/scheduling`, aucun `dispatch` : c'est `PlanningView`
 * qui dispatche `ajouterAffectation` sur `choisir`.
 */
export default {
  name: 'SelecteurPersonne',
  components: { ModaleBase },
  props: {
    /** Affiche (`true`) ou masque (`false`) le sélecteur ; piloté par le parent. */
    visible: { type: Boolean, required: true },
    /** Id de la tournée ciblée (sert au dé-doublonnage sur le segment exact). */
    tourneeId: { type: String, default: '' },
    /** Libellé de la tournée ciblée, pour le titre contextualisé. */
    tourneeNom: { type: String, default: '' },
    /** Date ciblée `"YYYY-MM-DD"`, pour le titre et le calcul « déjà N affectation(s) ce jour-là ». */
    date: { type: String, default: '' },
    /**
     * Indice (0-based) du segment ciblé dans `tournee.segments` (feature
     * 0016, ADR 0017 — remplace l'ancien `creneau`), pour le dé-doublonnage.
     */
    segmentIndex: { type: Number, default: 0 },
    /**
     * Horaires du segment ciblé, en clair (`libelleSegment`), pour le titre.
     * Pour une tournée coupée, résolu par `PlanningView` avec un
     * qualificatif devant (« le matin, 07:00 – 13:30 » / « la reprise du
     * soir, 17:00 – 20:00 ») — ce composant l'affiche tel quel.
     */
    horaires: { type: String, default: '' },
    /**
     * `Affectation[]` du planning courant — lecture seule, utilisée
     * uniquement pour masquer les personnes déjà présentes sur ce segment
     * exact et afficher la note « déjà N affectation(s) ce jour-là ».
     */
    affectations: { type: Array, default: () => [] },
  },
  emits: ['choisir', 'annuler'],
  data() {
    return {
      // Filtre texte local (simple recherche client, aucune validation).
      filtre: '',
    };
  },
  computed: {
    ...mapGetters('personnes', { personnesActives: 'actifs' }),

    /** Titre contextualisé : « Ajouter une personne — {tournée}, {date FR} ({horaires}) ». */
    titre() {
      if (!this.date) return 'Ajouter une personne';
      return `Ajouter une personne — ${this.tourneeNom}, ${this.libelleDateComplet} (${this.horaires})`;
    },

    /** Date complète lisible, ex. « mercredi 12/08/2026 ». */
    libelleDateComplet() {
      const jour = libelleJour(dateUtil.weekdayISO(this.date));
      return `${jour.toLowerCase()} ${dateUtil.formatDateFr(this.date)}`;
    },

    /**
     * Ids des personnes déjà présentes sur le segment exact ciblé
     * (même tournée, même date, même `segmentIndex`, feature 0016) —
     * dé-doublonnage (§7).
     * @returns {Set<string>}
     */
    personneIdsPresents() {
      return new Set(
        this.affectations
          .filter(
            (a) =>
              a.tourneeId === this.tourneeId && a.date === this.date && a.segmentIndex === this.segmentIndex
          )
          .map((a) => a.personneId)
      );
    },

    /**
     * Personnes actives proposables (celles déjà sur le segment exact sont
     * masquées), chacune enrichie de son nombre d'affectations ce jour-là
     * (toutes tournées confondues) — note purement informative.
     * @returns {Array<{id: string, nom: string, couleur: string, nbAffectationsCeJour: number}>}
     */
    personnesDisponibles() {
      return this.personnesActives
        .filter((p) => !this.personneIdsPresents.has(p.id))
        .map((p) => ({
          id: p.id,
          nom: `${p.prenom} ${p.nom}`,
          couleur: p.couleur,
          nbAffectationsCeJour: this.affectations.filter((a) => a.personneId === p.id && a.date === this.date)
            .length,
        }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    },

    /** `personnesDisponibles` réduites par le filtre texte (insensible à la casse). */
    personnesFiltrees() {
      const texte = this.filtre.toLowerCase();
      if (!texte) return this.personnesDisponibles;
      return this.personnesDisponibles.filter((p) => p.nom.toLowerCase().includes(texte));
    },

    /**
     * `true` si au moins une personne active a été masquée de la liste car
     * déjà présente sur ce segment exact (§7) — pilote la ligne d'aide
     * discrète expliquant le masquage (correctif ergonomie MIN-5,
     * feature 0011), affichée uniquement quand un masquage a effectivement
     * lieu.
     * @returns {boolean}
     */
    personnesMasquees() {
      return this.personnesActives.some((p) => this.personneIdsPresents.has(p.id));
    },
  },
  watch: {
    /** Réinitialise le filtre à chaque nouvelle ouverture (état propre). */
    visible(estVisible) {
      if (estVisible) {
        this.filtre = '';
      }
    },
  },
  methods: {
    /**
     * Pose le focus sur le champ de recherche une fois la transition
     * d'ouverture de la modale terminée (évite que le piège à focus de
     * `ModaleBase` ne le reprenne).
     */
    onAffichee() {
      this.$refs.champFiltre?.focus();
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

// Ligne d'aide discrète expliquant le masquage de personnes déjà présentes
// sur le segment exact (correctif ergonomie MIN-5, feature 0011) : affichée
// uniquement quand un masquage a effectivement lieu.
.selecteur-personne-aide-masquage {
  margin: 0 0 t.$espace-3;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
  font-style: italic;
}

.selecteur-personne-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
  max-height: 50vh;
  overflow-y: auto;
}

.selecteur-personne-bouton {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  width: 100%;
  min-height: t.$cible-cliquable-min;
  padding: t.$espace-2 t.$espace-3;
  text-align: left;
}

.selecteur-personne-pastille {
  flex-shrink: 0;
  width: t.$espace-4;
  height: t.$espace-4;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
}

.selecteur-personne-nom {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: t.$graisse-gras;
  overflow-wrap: break-word;
}

.selecteur-personne-note {
  flex-shrink: 0;
  font-size: t.$taille-texte-petite;
  color: t.$couleur-texte-attenue;
  font-style: italic;
}

.selecteur-personne-vide {
  margin: t.$espace-4 0;
  text-align: center;
  color: t.$couleur-texte-attenue;
}
</style>
