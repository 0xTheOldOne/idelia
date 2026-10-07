<template>
  <section class="panneau-conflits" aria-labelledby="panneau-conflits-titre">
    <h2 id="panneau-conflits-titre" class="panneau-conflits-titre">Points d'attention</h2>

    <p class="panneau-conflits-compteurs">
      <span class="panneau-conflits-compteur">
        <strong>{{ violations.length }}</strong>
        point{{ violations.length > 1 ? 's' : '' }} d'attention
      </span>
      <span class="panneau-conflits-compteur">
        <strong>{{ tourneesNonCouvertes.length }}</strong>
        tournée{{ tourneesNonCouvertes.length > 1 ? 's' : '' }} non couverte{{
          tourneesNonCouvertes.length > 1 ? 's' : ''
        }}
      </span>
    </p>

    <div v-if="aucunConflit" class="alert alert-success panneau-conflits-aucun" role="status">
      <PhCheckCircle :size="24" weight="fill" class="flex-shrink-0" aria-hidden="true" />
      <p class="mb-0">
        Aucun conflit : ce planning respecte toutes les règles connues et couvre toutes les
        tournées.
      </p>
    </div>

    <template v-else>
      <div
        v-for="section in sections"
        :key="section.severite"
        class="panneau-conflits-groupe"
      >
        <h3 class="panneau-conflits-sous-titre" :class="`panneau-conflits-sous-titre--${section.severite}`">
          <PhWarningOctagon v-if="section.severite === 'erreur'" :size="20" weight="bold" aria-hidden="true" />
          <PhWarning v-else :size="20" weight="bold" aria-hidden="true" />
          <span>{{ section.titre }} ({{ section.total }})</span>
        </h3>

        <!-- Une cause = un volet dépliant, fermé par défaut, avec son nombre
             de points (retour porteur 2026-10-07). `<details>` natif :
             accessible au clavier, sans JavaScript. -->
        <details
          v-for="cause in section.causes"
          :key="cause.code"
          class="panneau-conflits-cause"
          :class="`panneau-conflits-cause--${section.severite}`"
        >
          <summary class="panneau-conflits-cause-titre">
            <PhCaretRight :size="16" weight="bold" class="panneau-conflits-chevron" aria-hidden="true" />
            <span class="panneau-conflits-cause-libelle">{{ cause.libelle }}</span>
            <span class="panneau-conflits-cause-nombre">{{ cause.violations.length }}</span>
          </summary>
          <ul class="panneau-conflits-liste">
            <li
              v-for="(violation, index) in cause.violations"
              :key="`${cause.code}-${index}`"
              class="panneau-conflits-item"
              :class="`panneau-conflits-item--${section.severite}`"
            >
              {{ violation.message }}
            </li>
          </ul>
        </details>
      </div>

      <details
        v-if="detailsNonCouvertes.length"
        class="panneau-conflits-groupe panneau-conflits-cause panneau-conflits-cause--avertissement"
      >
        <summary class="panneau-conflits-cause-titre">
          <PhCaretRight :size="16" weight="bold" class="panneau-conflits-chevron" aria-hidden="true" />
          <PhWarningCircle :size="20" weight="fill" aria-hidden="true" />
          <span class="panneau-conflits-cause-libelle">Tournées non couvertes</span>
          <span class="panneau-conflits-cause-nombre">{{ detailsNonCouvertes.length }}</span>
        </summary>
        <ul class="panneau-conflits-liste">
          <li
            v-for="detail in detailsNonCouvertes"
            :key="detail.id"
            class="panneau-conflits-item panneau-conflits-item-couverture"
          >
            <span
              class="panneau-conflits-pastille"
              :style="{ backgroundColor: detail.couleur }"
              aria-hidden="true"
            />
            <span class="panneau-conflits-couverture-texte">
              <span>
                <strong
                  >{{ detail.nomTournee }}<template v-if="detail.archivee"> (archivée)</template></strong
                >
                — {{ detail.dateTexte }} ({{ detail.horairesTexte }})
              </span>
              <span class="panneau-conflits-couverture-manque">
                Il manque {{ detail.manque }} personne{{ detail.manque > 1 ? 's' : '' }}
              </span>
            </span>
          </li>
        </ul>
      </details>
    </template>
  </section>
</template>

<script>
import { mapGetters } from 'vuex';
import { PhWarning, PhWarningOctagon, PhWarningCircle, PhCheckCircle, PhCaretRight } from '@phosphor-icons/vue';

import { dateUtil } from '@/domain/utils/dates.js';
import { libelleCauseViolation } from '@/domain/libelles.js';

/**
 * Regroupe des violations par cause (`code`), dans l'ordre de première
 * apparition (le moteur trie déjà par gravité).
 * @param {object[]} violations - `Violation[]`.
 * @returns {Array<{code: string, libelle: string, violations: object[]}>}
 */
function grouperParCause(violations) {
  const groupes = new Map();
  for (const violation of violations) {
    if (!groupes.has(violation.code)) {
      groupes.set(violation.code, {
        code: violation.code,
        libelle: libelleCauseViolation(violation.code),
        violations: [],
      });
    }
    groupes.get(violation.code).violations.push(violation);
  }
  return [...groupes.values()];
}

/**
 * Panneau de conflits (feature 0010), **présentational** : affiche les
 * `Violation` reçues **telles quelles** (message FR du moteur, jamais
 * reformulé), groupées erreurs (dures) puis avertissements (souples), et
 * résume les tournées non couvertes à partir de `tourneesNonCouvertes` (pas
 * de dérivation depuis les violations `SOUS_COUVERTURE`, §6 du plan).
 *
 * N'accède au store que pour résoudre le nom/couleur d'une tournée
 * (`tournees/byId`) ; aucune logique métier, aucun appel moteur, aucun
 * événement essentiel émis en `0010`. Réutilisable par `0011`.
 */
export default {
  name: 'PanneauConflits',
  components: { PhWarning, PhWarningOctagon, PhWarningCircle, PhCheckCircle, PhCaretRight },
  props: {
    /** `Violation[]` du moteur, triées erreurs d'abord (voir `Resultat`/`diagnostiquer`). */
    violations: { type: Array, default: () => [] },
    /** `NonCouverture[]` du moteur. */
    tourneesNonCouvertes: { type: Array, default: () => [] },
  },
  computed: {
    ...mapGetters('tournees', { tourneeParId: 'byId' }),

    /** Violations dures, dans l'ordre reçu (le moteur les place déjà en tête). */
    erreurs() {
      return this.violations.filter((v) => v.severite === 'erreur');
    },
    /** Violations souples, dans l'ordre reçu. */
    avertissements() {
      return this.violations.filter((v) => v.severite === 'avertissement');
    },
    /**
     * Sections affichées (erreurs puis avertissements), chacune découpée en
     * groupes par cause ; les sections vides sont omises.
     * @returns {Array<{severite: string, titre: string, total: number, causes: object[]}>}
     */
    sections() {
      return [
        { severite: 'erreur', titre: 'Erreurs à corriger', liste: this.erreurs },
        { severite: 'avertissement', titre: 'Avertissements', liste: this.avertissements },
      ]
        .filter((section) => section.liste.length > 0)
        .map(({ severite, titre, liste }) => ({
          severite,
          titre,
          total: liste.length,
          causes: grouperParCause(liste),
        }));
    },
    /** État rassurant : ni violation, ni tournée non couverte. */
    aucunConflit() {
      return this.violations.length === 0 && this.tourneesNonCouvertes.length === 0;
    },

    /**
     * Détail affichable de chaque `NonCouverture`, résolu pour l'affichage
     * (libellé + couleur de la tournée, date FR, horaires réels du segment
     * sous-couvert — feature 0016, ADR 0017 : remplace le créneau
     * symbolique). Ne dérive aucune donnée métier : ne fait que résoudre
     * des libellés.
     * @returns {Array<{id: string, nomTournee: string, couleur: string, archivee: boolean, dateTexte: string, horairesTexte: string, manque: number}>}
     */
    detailsNonCouvertes() {
      return this.tourneesNonCouvertes.map((nonCouverture, index) => {
        const tournee = this.tourneeParId(nonCouverture.tourneeId);
        return {
          id: `${nonCouverture.tourneeId}-${nonCouverture.date}-${nonCouverture.segmentIndex}-${index}`,
          nomTournee: tournee ? tournee.libelle : 'Tournée inconnue',
          couleur: tournee ? tournee.couleur : 'transparent',
          archivee: tournee ? tournee.archivee : false,
          dateTexte: dateUtil.formatDateFr(nonCouverture.date),
          horairesTexte: `${nonCouverture.heureDebut} – ${nonCouverture.heureFin}`,
          manque: nonCouverture.manque,
        };
      });
    },
  },
};
</script>

<style scoped lang="scss">
@use '@/styles/tokens' as t;

.panneau-conflits {
  margin-top: t.$espace-4;
  padding: t.$espace-4;
  background-color: t.$couleur-fond;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-lg;
}

.panneau-conflits-titre {
  margin-bottom: t.$espace-2;
  font-size: t.$taille-titre-2;
}

.panneau-conflits-compteurs {
  display: flex;
  flex-wrap: wrap;
  gap: t.$espace-4;
  margin-bottom: t.$espace-3;
  color: t.$couleur-texte-attenue;
}

.panneau-conflits-compteur {
  strong {
    color: t.$couleur-texte;
    font-size: t.$taille-texte-grande;
  }
}

.panneau-conflits-aucun {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-3;
  margin-bottom: 0;
}

.panneau-conflits-groupe {
  margin-top: t.$espace-4;

  &:first-of-type {
    margin-top: 0;
  }
}

.panneau-conflits-sous-titre {
  display: flex;
  align-items: center;
  gap: t.$espace-2;
  margin-bottom: t.$espace-2;
  font-size: t.$taille-texte-base;
  font-weight: t.$graisse-gras;

  &--erreur {
    color: t.$couleur-erreur;
  }

  &--avertissement {
    color: t.$couleur-avertissement-texte;
  }
}

// Volet dépliant d'une cause (`<details>`) : bordure gauche reprenant la
// gravité (pleine = erreur, pointillée = avertissement, jamais la seule couleur).
.panneau-conflits-cause {
  margin-bottom: t.$espace-2;
  border: 1px solid t.$couleur-bordure;
  border-radius: t.$rayon-md;

  &--erreur {
    border-left: 3px solid t.$couleur-erreur;
  }

  &--avertissement {
    border-left: 3px dashed t.$couleur-avertissement;
  }

  &[open] .panneau-conflits-chevron {
    transform: rotate(90deg);
  }
}

.panneau-conflits-cause-titre {
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

.panneau-conflits-chevron {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.panneau-conflits-cause-libelle {
  flex: 1 1 auto;
  min-width: 0;
}

// Nombre de points de la cause, en pastille.
.panneau-conflits-cause-nombre {
  flex-shrink: 0;
  min-width: 1.75em;
  padding: 0 t.$espace-2;
  border-radius: 999px;
  background-color: t.$couleur-fond-clair;
  border: 1px solid t.$couleur-bordure;
  font-weight: t.$graisse-gras;
  text-align: center;
}

.panneau-conflits-cause > .panneau-conflits-liste {
  padding: 0 t.$espace-3 t.$espace-3;
}

.panneau-conflits-liste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: t.$espace-2;
}

.panneau-conflits-item {
  padding: t.$espace-2 t.$espace-3;
  border-radius: t.$rayon-md;
  font-size: t.$taille-texte-petite;

  &--erreur {
    background-color: rgba(t.$couleur-erreur, 0.08);
    border-left: 3px solid t.$couleur-erreur;
  }

  &--avertissement {
    background-color: rgba(t.$couleur-avertissement, 0.1);
    border-left: 3px dashed t.$couleur-avertissement;
  }
}

.panneau-conflits-item-couverture {
  display: flex;
  align-items: flex-start;
  gap: t.$espace-2;
}

.panneau-conflits-pastille {
  flex-shrink: 0;
  width: t.$espace-3;
  height: t.$espace-3;
  margin-top: 0.2em;
  border-radius: 50%;
  border: 1px solid t.$couleur-bordure;
}

.panneau-conflits-couverture-texte {
  display: flex;
  flex-direction: column;
  gap: t.$espace-1;
  min-width: 0;
}

.panneau-conflits-couverture-manque {
  font-weight: t.$graisse-gras;
}
</style>
