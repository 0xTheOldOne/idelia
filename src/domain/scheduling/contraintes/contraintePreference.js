/**
 * Contrainte générique dure/souple « préférence » : une `Preference` active
 * d'une personne devient une `Contrainte` dont la **dureté est celle de la
 * donnée** (`preference.nature`), jamais d'un catalogue figé (§12 point 1 du
 * plan). Un seul fichier couvre les **8** `TYPES_PREFERENCE` (§5 du plan,
 * écart KISS assumé par rapport à `05`) : une fonction d'évaluation interne
 * par type, routée par `creerContraintePreference(preference, personne)`.
 *
 * Chaque message réutilise `decrirePreference` (`src/domain/preferences.js`)
 * pour rester cohérent avec le phrasé déjà vu dans l'écran Souhaits (§5.6/§7.2
 * du plan).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { decrirePreference } from '@/domain/preferences.js';
import { creneauChevaucheHoraires } from '@/domain/absences.js';
import { dateUtil } from '@/domain/utils/dates.js';
import { semaineIsoDe } from '../utils/dates.js';
import { messagePour } from '../modele/messages.js';

/**
 * @param {import('../modele/types.js').Entree} entree
 * @param {string} tourneeId
 * @returns {string}
 */
function nomTourneeDe(entree, tourneeId) {
  const tournee = entree.tournees.find((t) => t.id === tourneeId);
  return tournee ? tournee.libelle : 'cette tournée';
}

/**
 * Résout les horaires réels `"HH:mm"` d'une `Affectation`, par lookup de
 * `tournee.segments[affectation.segmentIndex]` (feature 0016, ADR 0017).
 * `null` si la tournée ou le segment référencé est introuvable : jamais de
 * crash, l'affectation est alors simplement ignorée par l'appelant.
 *
 * @param {import('../modele/affectation.js').Affectation} affectation
 * @param {import('../modele/types.js').Entree} entree
 * @returns {({heureDebut: string, heureFin: string}|null)}
 */
function horairesDeAffectation(affectation, entree) {
  const tournee = entree.tournees.find((t) => t.id === affectation.tourneeId);
  const segment = tournee ? tournee.segments[affectation.segmentIndex] : undefined;
  return segment ? { heureDebut: segment.heureDebut, heureFin: segment.heureFin } : null;
}

/**
 * Réduit une `Affectation` aux champs utiles à une `Violation.cible`/`params`.
 *
 * @param {import('../modele/affectation.js').Affectation} affectation
 * @returns {Object}
 */
function cibleAffectation(affectation) {
  return {
    personneId: affectation.personneId,
    tourneeId: affectation.tourneeId,
    date: affectation.date,
    segmentIndex: affectation.segmentIndex,
  };
}

/**
 * Longueur de la plus longue séquence de jours calendaires consécutifs d'une
 * liste de dates triées et dédupliquées (même logique que
 * `contrainteReposLegal.js`, dupliquée volontairement — fichiers indépendants).
 *
 * @param {string[]} joursTries
 * @returns {number}
 */
function calculerRunMaxConsecutif(joursTries) {
  let max = 0;
  let courant = 0;
  let precedent = null;

  for (const jour of joursTries) {
    courant = precedent !== null && dateUtil.diffDays(precedent, jour) === 1 ? courant + 1 : 1;
    max = Math.max(max, courant);
    precedent = jour;
  }

  return max;
}

/**
 * Découpe une liste de dates triées/dédupliquées en séquences de jours
 * calendaires consécutifs.
 *
 * @param {string[]} joursTries
 * @returns {{debut: string, fin: string, longueur: number}[]}
 */
function listerRunsConsecutifs(joursTries) {
  const runs = [];
  let debut = null;
  let precedent = null;

  for (const jour of joursTries) {
    const suiteDuRun = precedent !== null && dateUtil.diffDays(precedent, jour) === 1;
    if (!suiteDuRun) {
      if (debut !== null) runs.push({ debut, fin: precedent, longueur: dateUtil.diffDays(debut, precedent) + 1 });
      debut = jour;
    }
    precedent = jour;
  }

  if (debut !== null) runs.push({ debut, fin: precedent, longueur: dateUtil.diffDays(debut, precedent) + 1 });

  return runs;
}

/**
 * Table de routage par `type` de préférence (`TYPES_PREFERENCE`, `schema.js`).
 * Chaque entrée expose :
 * - `code` : code stable de `Violation.code` (voir §7.2 du plan, `messages.js`).
 * - `granularite` : portée d'impact de la règle.
 * - `estCandidatViole(params, demande, ctx, personne)` : `true` si affecter
 *   `personne` sur `demande` violerait la préférence (sert à la fois à
 *   `autoriseAffectation` — inversé — et `coutMarginal`).
 * - `listerCibles(params, ctx, personne)` : liste les violations déjà
 *   présentes dans le planning indexé, `{ cible, params }[]` (sert à `evaluer`).
 *
 * @type {Object<string, Object>}
 */
const HANDLERS = {
  JOUR_OFF_RECURRENT: {
    code: 'PREFERENCE_JOUR_OFF_RECURRENT',
    granularite: 'cellule',
    estCandidatViole(params, demande) {
      return (params.joursSemaine ?? []).includes(demande.jourIso);
    },
    listerCibles(params, ctx, personne) {
      const affectations = ctx.index.parPersonne.get(personne.id) ?? [];
      return affectations
        .filter((a) => (params.joursSemaine ?? []).includes(dateUtil.weekdayISO(a.date)))
        .map((a) => {
          const horaires = horairesDeAffectation(a, ctx.entree) ?? {};
          return { cible: cibleAffectation(a), params: { date: a.date, heureDebut: horaires.heureDebut, heureFin: horaires.heureFin } };
        });
    },
  },

  JOURS_REPOS_SOUHAITES: {
    code: 'PREFERENCE_JOURS_REPOS_SOUHAITES',
    granularite: 'cellule',
    estCandidatViole(params, demande) {
      return (params.joursSemaine ?? []).includes(demande.jourIso);
    },
    listerCibles(params, ctx, personne) {
      const affectations = ctx.index.parPersonne.get(personne.id) ?? [];
      return affectations
        .filter((a) => (params.joursSemaine ?? []).includes(dateUtil.weekdayISO(a.date)))
        .map((a) => {
          const horaires = horairesDeAffectation(a, ctx.entree) ?? {};
          return { cible: cibleAffectation(a), params: { date: a.date, heureDebut: horaires.heureDebut, heureFin: horaires.heureFin } };
        });
    },
  },

  CRENEAU_OFF: {
    code: 'PREFERENCE_CRENEAU_OFF',
    granularite: 'cellule',
    estCandidatViole(params, demande) {
      const jours = params.joursSemaine ?? [];
      const joursConcernes = jours.length === 0 || jours.includes(demande.jourIso);
      return (
        joursConcernes &&
        (params.creneaux ?? []).some((c) => creneauChevaucheHoraires(c, demande.heureDebut, demande.heureFin))
      );
    },
    listerCibles(params, ctx, personne) {
      const jours = params.joursSemaine ?? [];
      const affectations = ctx.index.parPersonne.get(personne.id) ?? [];
      return affectations
        .filter((a) => {
          const joursConcernes = jours.length === 0 || jours.includes(dateUtil.weekdayISO(a.date));
          if (!joursConcernes) return false;
          const horaires = horairesDeAffectation(a, ctx.entree);
          if (!horaires) return false;
          return (params.creneaux ?? []).some((c) => creneauChevaucheHoraires(c, horaires.heureDebut, horaires.heureFin));
        })
        .map((a) => {
          const horaires = horairesDeAffectation(a, ctx.entree) ?? {};
          return { cible: cibleAffectation(a), params: { date: a.date, heureDebut: horaires.heureDebut, heureFin: horaires.heureFin } };
        });
    },
  },

  INDISPO_HEBDO: {
    code: 'PREFERENCE_INDISPO_HEBDO',
    granularite: 'cellule',
    estCandidatViole(params, demande) {
      if (!(params.joursSemaine ?? []).includes(demande.jourIso)) return false;
      const creneaux = params.creneaux ?? [];
      if (creneaux.length === 0) return true;
      return creneaux.some((c) => creneauChevaucheHoraires(c, demande.heureDebut, demande.heureFin));
    },
    listerCibles(params, ctx, personne) {
      const creneaux = params.creneaux ?? [];
      const affectations = ctx.index.parPersonne.get(personne.id) ?? [];
      return affectations
        .filter((a) => {
          if (!(params.joursSemaine ?? []).includes(dateUtil.weekdayISO(a.date))) return false;
          if (creneaux.length === 0) return true;
          const horaires = horairesDeAffectation(a, ctx.entree);
          if (!horaires) return false;
          return creneaux.some((c) => creneauChevaucheHoraires(c, horaires.heureDebut, horaires.heureFin));
        })
        .map((a) => {
          const horaires = horairesDeAffectation(a, ctx.entree) ?? {};
          return { cible: cibleAffectation(a), params: { date: a.date, heureDebut: horaires.heureDebut, heureFin: horaires.heureFin } };
        });
    },
  },

  MAX_JOURS_CONSECUTIFS: {
    code: 'PREFERENCE_MAX_JOURS_CONSECUTIFS',
    granularite: 'personne-periode',
    estCandidatViole(params, demande, ctx, personne) {
      if (!Number.isInteger(params.max)) return false;
      const joursExistants = ctx.index.joursTravaillesParPersonne.get(personne.id) ?? new Set();
      const joursTries = [...new Set([...joursExistants, demande.date])].sort();
      return calculerRunMaxConsecutif(joursTries) > params.max;
    },
    listerCibles(params, ctx, personne) {
      if (!Number.isInteger(params.max)) return [];
      const joursSet = ctx.index.joursTravaillesParPersonne.get(personne.id) ?? new Set();
      const joursTries = [...joursSet].sort();
      const runMax = calculerRunMaxConsecutif(joursTries);
      if (runMax <= params.max) return [];
      return [{ cible: { personneId: personne.id }, params: { joursConsecutifs: runMax, maxAutorise: params.max } }];
    },
  },

  // Limite documentée (cf. §12 point 8 du plan, étendue ici) : une séquence
  // trop courte ne peut être détectée qu'une fois terminée (jour de coupure
  // observé) — `estCandidatViole` ne peut donc jamais bloquer/pénaliser un
  // candidat isolé sans connaître la suite ; seule `evaluer` (source de
  // vérité) porte cette règle.
  MIN_JOURS_CONSECUTIFS: {
    code: 'PREFERENCE_MIN_JOURS_CONSECUTIFS',
    granularite: 'personne-periode',
    estCandidatViole() {
      return false;
    },
    listerCibles(params, ctx, personne) {
      if (!Number.isInteger(params.min)) return [];
      const joursSet = ctx.index.joursTravaillesParPersonne.get(personne.id) ?? new Set();
      const joursTries = [...joursSet].sort();
      const { periode } = ctx.entree;

      return listerRunsConsecutifs(joursTries)
        .filter((run) => run.longueur < params.min && dateUtil.addDays(run.fin, 1) <= periode.fin)
        .map((run) => ({
          cible: { personneId: personne.id },
          params: { debut: run.debut, fin: run.fin, longueur: run.longueur, minRequis: params.min },
        }));
    },
  },

  NB_JOURS_SEMAINE: {
    code: 'PREFERENCE_NB_JOURS_SEMAINE',
    granularite: 'personne-periode',
    // Seule la borne `max` peut être vérifiée par candidat (une borne `min`
    // ne peut jamais justifier un blocage : refuser l'affectation ne ferait
    // qu'aggraver le déficit) — limite documentée, cf. `MIN_JOURS_CONSECUTIFS`.
    estCandidatViole(params, demande, ctx, personne) {
      if (!Number.isInteger(params.max)) return false;
      const semaineDebut = semaineIsoDe(demande.date);
      const semaineFin = dateUtil.addDays(semaineDebut, 6);
      const joursExistants = ctx.index.joursTravaillesParPersonne.get(personne.id) ?? new Set();
      const joursSemaineActuels = [...joursExistants].filter((j) => j >= semaineDebut && j <= semaineFin).length;
      const dejaCeJour = joursExistants.has(demande.date);
      const joursApres = dejaCeJour ? joursSemaineActuels : joursSemaineActuels + 1;
      return joursApres > params.max;
    },
    listerCibles(params, ctx, personne) {
      const joursSet = ctx.index.joursTravaillesParPersonne.get(personne.id) ?? new Set();
      const joursTries = [...joursSet].sort();
      const semaines = [...new Set(joursTries.map(semaineIsoDe))].sort();
      const cibles = [];

      for (const semaineDebut of semaines) {
        const semaineFin = dateUtil.addDays(semaineDebut, 6);
        const nb = joursTries.filter((j) => j >= semaineDebut && j <= semaineFin).length;
        const sousMin = Number.isInteger(params.min) && nb < params.min;
        const surMax = Number.isInteger(params.max) && nb > params.max;
        if (sousMin || surMax) {
          cibles.push({
            cible: { personneId: personne.id },
            params: { semaineDebut, nb, min: params.min, max: params.max },
          });
        }
      }

      return cibles;
    },
  },

  PREFERENCE_TOURNEE: {
    code: 'PREFERENCE_TOURNEE',
    granularite: 'cellule',
    estCandidatViole(params, demande) {
      const tourneeIds = params.tourneeIds ?? [];
      if (tourneeIds.length === 0) return false;
      const dansListe = tourneeIds.includes(demande.tourneeId);
      return params.sens === 'EVITE' ? dansListe : !dansListe;
    },
    listerCibles(params, ctx, personne) {
      const tourneeIds = params.tourneeIds ?? [];
      if (tourneeIds.length === 0) return [];
      const affectations = ctx.index.parPersonne.get(personne.id) ?? [];

      return affectations
        .filter((a) => {
          const dansListe = tourneeIds.includes(a.tourneeId);
          return params.sens === 'EVITE' ? dansListe : !dansListe;
        })
        .map((a) => {
          const horaires = horairesDeAffectation(a, ctx.entree) ?? {};
          return {
            cible: cibleAffectation(a),
            params: {
              date: a.date,
              heureDebut: horaires.heureDebut,
              heureFin: horaires.heureFin,
              tourneeId: a.tourneeId,
              nomTournee: nomTourneeDe(ctx.entree, a.tourneeId),
            },
          };
        });
    },
  },
};

/**
 * Construit la `Contrainte` correspondant à une `Preference` **active** d'une
 * `Personne`, dont la dureté est **toujours** celle de la donnée
 * (`preference.nature`) — jamais d'un catalogue figé. Ne plante jamais, même
 * sur un `type`/`params` mal formé (§7.4 du plan).
 *
 * @param {import('@/domain/preferences.js').Preference} preference
 * @param {import('@/domain/personnes.js').Personne} personne
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContraintePreference(preference, personne) {
  const handler = HANDLERS[preference.type];
  const code = handler ? handler.code : 'PREFERENCE_INCONNUE';
  const params = preference.params ?? {};
  const durete = preference.nature === 'SOUPLE' ? 'souple' : 'dure';
  const poids = preference.nature === 'SOUPLE' ? preference.poids : undefined;
  const nomPersonne = `${personne.prenom} ${personne.nom}`;
  const descriptionPreference = decrirePreference(preference);

  const contrainte = {
    id: `pref-${preference.id}`,
    type: code,
    durete,
    granularite: (handler && handler.granularite) || 'cellule',

    evaluer(ctx) {
      if (!handler) return [];

      return handler.listerCibles(params, ctx, personne).map((brut) => ({
        contrainteId: `pref-${preference.id}`,
        severite: durete === 'dure' ? 'erreur' : 'avertissement',
        cible: brut.cible,
        code,
        message: messagePour(code, { nomPersonne, descriptionPreference, ...brut.params }),
        penalite: durete === 'dure' ? 0 : poids,
        params: { preferenceId: preference.id, personneId: personne.id, ...brut.params },
      }));
    },
  };

  if (durete === 'dure') {
    contrainte.autoriseAffectation = (personneId, demande, ctx) => {
      if (!handler || personneId !== personne.id) return true;
      return !handler.estCandidatViole(params, demande, ctx, personne);
    };
  } else {
    contrainte.poids = poids;
    contrainte.coutMarginal = (personneId, demande, ctx) => {
      if (!handler || personneId !== personne.id) return 0;
      return handler.estCandidatViole(params, demande, ctx, personne) ? poids : 0;
    };
  }

  return contrainte;
}
