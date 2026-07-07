/**
 * Règles métier pures relatives aux `ParametresCabinet`
 * (voir `docs/architecture/02-modele-de-domaine.md`).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

/**
 * @typedef {object} ResultatCoherence
 * @property {string[]} avertissements - Messages FR non bloquants (peut être vide).
 */

/**
 * Contrôle la cohérence du rythme de travail des `ParametresCabinet` et
 * renvoie des **avertissements non bloquants**, prêts à afficher.
 *
 * Règle KISS retenue : si `reposHebdoMin + maxJoursConsecutifs > 7`, le
 * nombre de jours consécutifs autorisés dépasse ce que le repos minimum
 * hebdomadaire permet réellement (7 jours par semaine) ; c'est signalé,
 * mais **jamais bloquant** (c'est un conseil, pas une erreur de saisie).
 *
 * Tolérant aux valeurs manquantes ou non numériques : dans ce cas, aucun
 * avertissement n'est levé (on ne peut pas conclure).
 *
 * @param {{ reposHebdoMin?: number, maxJoursConsecutifs?: number }} parametres - Paramètres du cabinet (ou sous-ensemble).
 * @returns {ResultatCoherence} Liste d'avertissements FR (vide si tout va bien).
 */
export function coherenceParametres(parametres) {
  const avertissements = [];
  const { reposHebdoMin, maxJoursConsecutifs } = parametres ?? {};

  const reposValide = Number.isFinite(reposHebdoMin);
  const maxJoursValide = Number.isFinite(maxJoursConsecutifs);

  if (reposValide && maxJoursValide && reposHebdoMin + maxJoursConsecutifs > 7) {
    const joursTravailMax = 7 - reposHebdoMin;
    avertissements.push(
      `Avec au moins ${reposHebdoMin} jour(s) de repos par semaine, on ne peut pas enchaîner ` +
        `plus de ${joursTravailMax} jour(s) de travail. Or vous autorisez ${maxJoursConsecutifs} jour(s) consécutifs.`
    );
  }

  return { avertissements };
}
