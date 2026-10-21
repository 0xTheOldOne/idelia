<template>
  <section v-if="mois.length > 0" class="recap-mensuel" aria-labelledby="recap-mensuel-titre">
    <h2 id="recap-mensuel-titre" class="recap-mensuel-titre">Récapitulatif par mois</h2>
    <p class="recap-mensuel-aide">
      Grande tournée : tournée coupée faite le matin et le soir. Petite tournée : tournée d'un seul
      horaire, ou seulement le matin ou le soir d'une tournée coupée. Jours travaillés : jours où la
      personne a au moins une tournée.
    </p>

    <!-- Un volet par mois civil, ouvert par défaut (`<details>` natif :
         clavier, sans JavaScript) — même motif que PanneauConflits. -->
    <details v-for="m in mois" :key="m.cle" class="recap-mensuel-mois" open>
      <summary class="recap-mensuel-resume">
        <PhCaretRight :size="16" weight="bold" class="recap-mensuel-chevron" aria-hidden="true" />
        <span class="recap-mensuel-resume-texte">
          <strong class="recap-mensuel-resume-mois">{{ m.libelle }}</strong>
          <span class="recap-mensuel-resume-detail">
            <span class="recap-mensuel-attenue">{{ m.texteCouverture }}</span>
            <span
              class="recap-mensuel-resume-etat"
              :class="{ 'recap-mensuel-resume-etat--depasse': m.nbDepassements > 0 }"
            >
              <PhWarning v-if="m.nbDepassements > 0" :size="18" weight="bold" aria-hidden="true" />
              <PhCheckCircle v-else :size="18" aria-hidden="true" />
              <span>{{ m.texteResume }}</span>
            </span>
          </span>
        </span>
      </summary>

      <!-- Conteneur défilable au-dessus de 576 px : focalisable au clavier. -->
      <div
        class="recap-mensuel-conteneur"
        tabindex="0"
        :aria-label="`Tableau récapitulatif de ${m.libelle}, défilable horizontalement`"
      >
        <!-- Les rôles ARIA explicites préservent la sémantique de tableau quand
             le CSS empile les lignes en cartes (display: block, mobile). -->
        <table class="recap-mensuel-table" role="table">
          <caption class="visually-hidden">
            {{ m.libelle }} : tournées et jours travaillés par personne
          </caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Personne</th>
              <th scope="col" role="columnheader" class="recap-mensuel-nombre">Grandes tournées</th>
              <th scope="col" role="columnheader" class="recap-mensuel-nombre">Petites tournées</th>
              <th scope="col" role="columnheader" class="recap-mensuel-nombre">Jours travaillés</th>
              <th scope="col" role="columnheader">Rythme de travail</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            <tr
              role="row"
              v-for="ligne in m.lignes"
              :key="ligne.personneId"
              :class="{ 'recap-mensuel-ligne--depasse': ligne.etat === 'DEPASSE' }"
            >
              <th scope="row" role="rowheader" class="recap-mensuel-personne">
                <div class="recap-mensuel-personne-contenu">
                <span
                  class="recap-mensuel-pastille"
                  :style="{ backgroundColor: ligne.couleur, color: ligne.couleurTexte }"
                  aria-hidden="true"
                >{{ ligne.repere }}</span>
                <span class="recap-mensuel-personne-texte">
                  <span class="recap-mensuel-nom">{{ ligne.nomComplet }}</span>
                  <small class="recap-mensuel-attenue">{{ ligne.statutTexte }}</small>
                </span>
                </div>
              </th>
              <td role="cell" class="recap-mensuel-nombre recap-mensuel-stat" data-label="Grandes">{{ ligne.grandes }}</td>
              <td role="cell" class="recap-mensuel-nombre recap-mensuel-stat" data-label="Petites">
                {{ ligne.petites }}
                <small v-if="ligne.moitiesDeGrande > 0" class="recap-mensuel-attenue recap-mensuel-sous-texte">
                  dont {{ ligne.moitiesDeGrande }}
                  {{ ligne.moitiesDeGrande > 1 ? 'moitiés' : 'moitié' }} de grande tournée
                </small>
              </td>
              <td role="cell" class="recap-mensuel-nombre recap-mensuel-stat" data-label="Jours">{{ ligne.joursTravailles }}</td>
              <td role="cell" class="recap-mensuel-rythme">
                <span :class="{ 'recap-mensuel-attenue': ligne.etat === 'SANS_RYTHME' }">{{
                  ligne.texteRythme
                }}</span>
                <span
                  v-if="ligne.etat === 'DEPASSE'"
                  class="recap-mensuel-etat recap-mensuel-etat--depasse"
                >
                  <PhWarning :size="18" weight="bold" aria-hidden="true" />
                  <span>{{ ligne.texteEtat }}</span>
                </span>
                <span
                  v-else-if="ligne.etat === 'DANS_LE_RYTHME'"
                  class="recap-mensuel-etat recap-mensuel-attenue"
                >
                  <PhCheckCircle :size="18" aria-hidden="true" />
                  <span>{{ ligne.texteEtat }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!m.complet" class="recap-mensuel-note recap-mensuel-attenue">
        Mois incomplet : seuls les jours de ce planning sont comptés. Le rouge n'apparaît que si le
        rythme du mois entier est déjà dépassé.
      </p>
    </details>
  </section>
</template>

<script>
import { PhWarning, PhCheckCircle, PhCaretRight } from '@phosphor-icons/vue';

/**
 * Récapitulatif mensuel des affectations (feature 0024), **présentationnel** :
 * affiche les `MoisRecap[]` calculés par `construireRecapMensuel` (textes
 * compris), sans accès au store ni logique métier. Un volet par mois, ouvert
 * par défaut ; un dépassement de rythme est signalé par icône + texte +
 * bordure (jamais la seule couleur).
 */
export default {
  name: 'RecapMensuel',
  components: { PhWarning, PhCheckCircle, PhCaretRight },
  props: {
    /** `MoisRecap[]` (voir `src/domain/recapMensuel.js`). */
    mois: { type: Array, required: true },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;
@use '@/styles/mixins' as m;

.recap-mensuel {
  margin-top: t.$espace-4;
  padding: t.$espace-4;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-lg;
}

.recap-mensuel-titre {
  margin-bottom: t.$espace-2;
  font-size: t.$taille-titre-2;
}

.recap-mensuel-aide {
  margin-bottom: t.$espace-3;
  color: t.$couleur-texte-attenue;
  font-size: t.$taille-texte-petite;
}

.recap-mensuel-mois {
  margin-bottom: t.$espace-2;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;

  &[open] .recap-mensuel-chevron {
    transform: rotate(90deg);
  }
}

.recap-mensuel-resume {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  min-height: t.$cible-cliquable-min;
  padding: t.$espace-2 t.$espace-3;
  cursor: pointer;
  list-style: none; // masque le triangle natif (remplacé par le chevron)

  &::-webkit-details-marker {
    display: none;
  }

  &:hover {
    background-color: t.$couleur-fond-clair;
  }

  &:focus-visible {
    outline: t.$epaisseur-focus solid t.$couleur-focus;
    outline-offset: 2px;
  }
}

.recap-mensuel-chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.recap-mensuel-resume-texte {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.recap-mensuel-resume-detail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: t.$espace-3;
}

.recap-mensuel-resume-etat {
  display: inline-flex;
  align-items: center;
  gap: t.$espace-1;

  &--depasse {
    color: t.$couleur-erreur;
    font-weight: t.$graisse-gras;
  }
}

// Le module « tables » de Bootstrap n'est pas importé (_bootstrap.scss) :
// défilement horizontal et espacement des cellules sont portés ici.
.recap-mensuel-conteneur {
  padding: 0 t.$espace-3;
  overflow-x: auto;

  &:focus-visible {
    @include m.focus-visible;
  }
}

.recap-mensuel-table {
  width: 100%;
  min-width: 40rem;
  margin-bottom: t.$espace-2;
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
}

.recap-mensuel-nombre {
  text-align: center;
}

.recap-mensuel-personne {
  font-weight: t.$graisse-normale;
}

.recap-mensuel-personne-contenu {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
}

.recap-mensuel-personne-texte {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.recap-mensuel-nom {
  font-weight: t.$graisse-gras;
}

.recap-mensuel-pastille {
  @include m.pastille-initiales;
}

.recap-mensuel-attenue {
  color: t.$couleur-texte-attenue;
}

.recap-mensuel-sous-texte {
  display: block;
}

.recap-mensuel-etat {
  display: flex;
  align-items: center;
  gap: t.$espace-1;

  &--depasse {
    color: t.$couleur-erreur;
    font-weight: t.$graisse-gras;
  }
}

// Ligne en dépassement : fond + bordure gauche pleine (jamais la seule couleur,
// l'icône et le texte la doublent).
.recap-mensuel-ligne--depasse {
  background-color: rgba(t.$couleur-erreur, 0.08);

  > :first-child {
    border-left: 3px solid t.$couleur-erreur;
  }

  > * {
    background-color: transparent;
  }
}

// Mobile (< 576 px) : chaque ligne devient une carte (nom + statut, puis
// « Grandes : 7 · Petites : 16 · Jours : 15 », puis le rythme). Plus de
// défilement horizontal. Les rôles ARIA du gabarit gardent la sémantique.
@media (max-width: t.$rupture-sm - 0.02px) {
  .recap-mensuel-conteneur {
    overflow-x: visible;
  }

  .recap-mensuel-table {
    min-width: 0;

    &,
    tbody,
    tr,
    th,
    td {
      display: block;
    }

    // En-têtes de colonnes masqués visuellement, restent lus par les lecteurs d'écran.
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    tbody tr {
      margin-bottom: t.$espace-2;
      padding: t.$espace-2 0;
      border: 1px solid t.$couleur-bordure;
      border-radius: t.$rayon-md;
    }

    tbody tr + tr {
      border-top: 1px solid t.$couleur-bordure;
    }

    th,
    td {
      padding: t.$espace-1 t.$espace-3;
    }
  }

  .recap-mensuel-stat {
    display: inline-block;
    text-align: left;

    &::before {
      content: attr(data-label) ' : ';
      color: t.$couleur-texte-attenue;
    }
  }

  .recap-mensuel-sous-texte {
    display: inline;
    margin-left: t.$espace-1;
  }

  .recap-mensuel-ligne--depasse > :first-child {
    border-left: 3px solid t.$couleur-erreur;
  }
}

.recap-mensuel-note {
  margin: 0;
  padding: 0 t.$espace-3 t.$espace-3;
  font-size: t.$taille-texte-petite;
}
</style>
