<template>
  <section
    class="regles-calcul"
    aria-labelledby="regles-calcul-titre">
    <h2
      id="regles-calcul-titre"
      class="regles-calcul__titre">
      Règles de calcul
    </h2>
    <p>
      Cette page explique comment Idelia calcule le bilan.<br />
      Les exemples utilisent un soin de base BSB ({{ e(bs) }}) et un déplacement IFI ({{ e(ifi) }}).
    </p>

    <h3 class="regles-calcul__sous-titre">1. Quels patients sont concernés</h3>
    <p>Un patient entre dans le calcul seulement si, pour une même journée :</p>
    <ul>
      <li>il a été soigné par <strong>au moins deux infirmières différentes</strong> ;</li>
      <li>il y a <strong>au moins un soin de base</strong> (BSA, BSB ou BSC) ;</li>
      <li>il s'agit de la même prise en charge (même date de fin dans Vega).</li>
    </ul>
    <p>Un patient vu par une seule infirmière n'est pas concerné : rien à partager.</p>

    <h3 class="regles-calcul__sous-titre">2. Qui reçoit l'argent</h3>
    <ul>
      <li>Chaque passage est payé à <strong>l'infirmière qui l'a fait</strong>.</li>
      <li>Si c'est une <strong>remplaçante</strong>, l'argent arrive sur le compte de <strong>sa titulaire</strong> (celle choisie dans « Remplace en priorité », onglet Équipe).</li>
      <li>Les remplaçantes ne se font donc jamais de virement entre elles : tout passe par les titulaires.</li>
    </ul>

    <h3 class="regles-calcul__sous-titre">3. Ce qui est partagé</h3>
    <p><strong>Seul le soin de base est partagé.</strong> Le déplacement (IFI), les autres actes (AMI…), les majorations et les indemnités kilométriques restent à l'infirmière qui les a faits.</p>
    <table class="regles-calcul__table">
      <caption>
        Montants des soins de base utilisés par Idelia
      </caption>
      <thead>
        <tr>
          <th scope="col">Soin de base</th>
          <th scope="col">Montant</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(montant, code) in tarifs"
          :key="code">
          <th scope="row">{{ code }}</th>
          <td>{{ e(montant) }}</td>
        </tr>
      </tbody>
    </table>

    <h3 class="regles-calcul__sous-titre">4. Comment le soin de base est partagé</h3>
    <ul>
      <li>Il est divisé <strong>à parts égales entre les infirmières différentes</strong> de la journée : en 2 pour deux infirmières, en 3 pour trois.</li>
      <li>Une infirmière qui passe deux fois compte une seule fois.</li>
      <li>Si la division ne tombe pas juste au centime, le centime en trop reste à l'infirmière qui a fait le soin de base.</li>
    </ul>
    <div
      class="alert alert-warning d-flex gap-2"
      role="note">
      <PhWarning
        :size="20"
        weight="fill"
        class="flex-shrink-0"
        aria-hidden="true" />
      <p class="mb-0">
        <strong>Question en suspens dans l'équipe.</strong> Quand une infirmière passe deux fois et une autre une fois, faut-il diviser par le nombre d'infirmières (règle actuelle) ou par le nombre de
        passages, les soins du matin étant souvent plus lourds ? Rien ne change tant que l'équipe n'a pas décidé.
      </p>
    </div>

    <h3 class="regles-calcul__sous-titre">5. Tous les cas, avec un exemple</h3>
    <p>Matin : soin de base + déplacement ({{ e(bs + ifi) }}). Soir : déplacement seul ({{ e(ifi) }}).</p>

    <article class="regles-calcul__cas">
      <h4>Cas 1 — Deux titulaires (A le matin, B le soir)</h4>
      <p>A reçoit {{ e(bs + ifi) }}, B reçoit {{ e(ifi) }}.</p>
      <p>
        <strong>A vire {{ e(moitie) }} à B</strong> : la moitié du soin de base.
      </p>
    </article>

    <article class="regles-calcul__cas">
      <h4>Cas 2 — Une titulaire et sa propre remplaçante (dans n'importe quel ordre)</h4>
      <p>Tout l'argent arrive chez la titulaire : <strong>aucun virement</strong>. La remplaçante a droit à la moitié du soin de base ({{ e(moitie) }}), moins sa rétrocession.</p>
      <ul>
        <li>
          La titulaire a fait le soin de base : elle <strong>ajoute {{ e(r.partRemplacanteCentimes) }}</strong> à ce qu'elle reverse à sa remplaçante (taux de {{ taux }} % : elle garde
          {{ e(r.partTitulaireCentimes) }}).
        </li>
        <li>
          La remplaçante a fait le soin de base : la titulaire <strong>déduit {{ e(r.partRemplacanteCentimes) }}</strong>
          de ce qu'elle lui reverse (sa remplaçante a déjà ce soin dans ses actes).
        </li>
      </ul>
    </article>

    <article class="regles-calcul__cas">
      <h4>Cas 3 — Une titulaire A et la remplaçante de la titulaire B</h4>
      <ul>
        <li>
          A fait le matin : <strong>A vire {{ e(moitie) }} à B</strong>. B <strong>ajoute {{ e(r.partRemplacanteCentimes) }}</strong> à ce qu'elle reverse à sa remplaçante (taux de {{ taux }} % : B
          garde {{ e(r.partTitulaireCentimes) }}).
        </li>
        <li>
          La remplaçante de B fait le matin : l'argent arrive chez B. <strong>B vire {{ e(moitie) }} à A</strong>, et <strong>déduit {{ e(r.partRemplacanteCentimes) }}</strong> de ce qu'elle reverse à
          sa remplaçante.
        </li>
      </ul>
    </article>

    <article class="regles-calcul__cas">
      <h4>Cas 4 — La remplaçante de A et la remplaçante de B</h4>
      <p>
        Même calcul que le cas 3, mais l'argent de chaque remplaçante arrive chez sa titulaire : la titulaire de celle du matin <strong>vire {{ e(moitie) }}</strong> à l'autre titulaire. Ensuite,
        chaque titulaire ajoute ou déduit {{ e(r.partRemplacanteCentimes) }} (la somme moins la rétrocession) sur ce qu'elle reverse à sa remplaçante.
      </p>
    </article>

    <article class="regles-calcul__cas">
      <h4>Cas 5 — Deux remplaçantes de la même titulaire</h4>
      <p>Tout arrive chez la titulaire : <strong>aucun virement</strong>. Elle ajoute à l'une et déduit à l'autre la moitié du soin de base, moins la rétrocession de chacune.</p>
    </article>

    <article class="regles-calcul__cas">
      <h4>Cas 6 — Trois infirmières différentes</h4>
      <p>Le soin de base est divisé en 3. Exemple avec un BSA ({{ e(tarifs.BSA) }}) : {{ e(tiers.celleDuBs) }} pour celle qui l'a fait, {{ e(tiers.autre) }} pour chacune des deux autres.</p>
    </article>

    <article class="regles-calcul__cas">
      <h4>Cas 7 — La même infirmière passe deux fois</h4>
      <p>
        A le matin et le soir, B à midi : le soin de base est divisé en 2, pas en 3.
        <strong>A vire {{ e(moitie) }} à B.</strong> C'est la question en suspens de la partie 4.
      </p>
    </article>

    <h3 class="regles-calcul__sous-titre">6. La rétrocession</h3>
    <ul>
      <li>Le taux de rétrocession est la part gardée par la titulaire (fiche de la remplaçante, onglet Équipe). Avec {{ taux }} %, la remplaçante reçoit {{ 100 - taux }} %.</li>
      <li>Elle s'applique <strong>uniquement sur la part de soin de base</strong>, jamais sur le déplacement.</li>
      <li>Les sommes de la rubrique « À ajouter ou retirer sur le reversement habituel » ne sont pas des virements en plus : elles corrigent ce que la titulaire verse déjà à sa remplaçante.</li>
      <li>Arrondi au centime ; la titulaire garde le reste, pour que le total tombe juste.</li>
    </ul>

    <h3 class="regles-calcul__sous-titre">7. Le bilan de la période</h3>
    <ul>
      <li>Les montants de tous les patients du fichier sont additionnés, par titulaire.</li>
      <li>Idelia propose le moins de virements possible entre titulaires pour tout équilibrer.</li>
      <li>Les sommes de l'onglet « Détail par patient » servent à comprendre : <strong>seul le bilan dit quoi virer</strong>.</li>
    </ul>

    <h3 class="regles-calcul__sous-titre">8. Ce qui n'est pas calculé ou est signalé</h3>
    <ul>
      <li>Un montant illisible, ou une ligne plus petite que le tarif de son soin de base : le patient n'est pas compté, et sa date est signalée.</li>
      <li>Un code Vega relié à personne de l'équipe : ses sommes sont comptées à part et signalées.</li>
      <li>Une remplaçante sans titulaire : elle est comptée comme si elle recevait l'argent elle-même, et signalée.</li>
      <li>Une remplaçante sans taux de rétrocession : la somme exacte ne peut pas être donnée, elle est signalée.</li>
    </ul>
  </section>
</template>

<script>
  import { PhWarning } from "@phosphor-icons/vue";

  import { TARIFS_BS_CENTIMES } from "@/domain/feuilleDeRoute/detecterRelais.js";
  import { partsRetrocession } from "@/domain/feuilleDeRoute/fluxComptes.js";
  import { formaterEuros } from "@/domain/utils/montants.js";

  /** Montant du déplacement IFI utilisé dans les exemples (centimes). */
  const IFI_EXEMPLE_CENTIMES = 275;
  /** Taux de rétrocession utilisé dans les exemples (%). */
  const TAUX_EXEMPLE = 11;

  /**
   * Onglet « Règles de calcul » de la Feuille de route (feature 0037) : explication statique de
   * chaque cas. Les montants d'exemple sont calculés avec les tarifs et la fonction de
   * rétrocession du domaine, pour rester alignés sur le bilan.
   */
  export default {
    name: "ReglesCalcul",
    components: { PhWarning },
    data() {
      return {
        tarifs: TARIFS_BS_CENTIMES,
        bs: TARIFS_BS_CENTIMES.BSB,
        ifi: IFI_EXEMPLE_CENTIMES,
        taux: TAUX_EXEMPLE,
      };
    },
    computed: {
      moitie() {
        return Math.floor(this.bs / 2);
      },
      r() {
        return partsRetrocession(this.moitie, this.taux);
      },
      tiers() {
        const base = Math.floor(this.tarifs.BSA / 3);
        return { autre: base, celleDuBs: this.tarifs.BSA - 2 * base };
      },
    },
    methods: {
      e(centimes) {
        return formaterEuros(centimes);
      },
    },
  };
</script>

<style lang="scss" scoped>
  @use "@/styles/tokens" as t;

  .regles-calcul {
    max-width: 50rem;
    margin-inline: auto;
  }

  .regles-calcul__titre {
    font-size: t.$taille-titre-2;
  }

  .regles-calcul__sous-titre {
    margin-top: t.$espace-4;
    margin-bottom: t.$espace-2;
    font-size: t.$taille-texte-grande;
  }

  .regles-calcul__table {
    margin-bottom: t.$espace-3;

    caption {
      caption-side: top;
      color: t.$couleur-texte;
      white-space: nowrap;
    }

    th,
    td {
      padding: t.$espace-1 t.$espace-3;
      border-bottom: 1px solid t.$couleur-bordure;
    }
  }

  .regles-calcul__cas {
    margin-bottom: t.$espace-3;
    padding: t.$espace-3;
    border: 1px solid t.$couleur-bordure;
    border-radius: t.$rayon-md;

    h4 {
      font-size: 1rem;
      font-weight: t.$graisse-gras;
    }

    p:last-child,
    ul:last-child {
      margin-bottom: 0;
    }
  }
</style>
