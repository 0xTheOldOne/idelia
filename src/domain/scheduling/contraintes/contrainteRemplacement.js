/**
 * Contraintes de **remplacement** (feature 0021, révisée le 2026-10-14 :
 * « titulaires d'abord »). Les titulaires sont planifiées d'abord, dans le
 * respect de toutes leurs règles ; les remplaçantes (`statut === 'REMPLACANT'`)
 * prennent les tournées restantes. `type: 'REMPLACEMENT'` est commun aux deux
 * fabriques de ce fichier, toutes deux **souples « silencieuses »** :
 * `evaluer` renvoie toujours `[]` (aucun message, rien à signaler), la
 * préférence agit à la génération via `coutMarginal` (glouton) et `coutGlobal`
 * (recherche locale), deux lectures de la même règle à garder cohérentes.
 *
 * - `creerContrainteTitulairesDAbord` : chaque case confiée à une remplaçante
 *   coûte un peu (moins qu'un souhait ou qu'un dépassement de rythme d'une
 *   titulaire, plus qu'une titulaire « dans sa norme »).
 * - `creerContrainteRemplacementPrioritaire` : un jour où sa titulaire ne
 *   travaille pas (absente ou non planifiée), la remplaçante rattachée passe
 *   avant les autres remplaçantes.
 *
 * Une remplaçante hors présence (pas encore arrivée / déjà partie, 0031) n'est
 * pas « disponible » : elle n'empêche pas une autre remplaçante de passer.
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage` (ADR 0008).
 */

import { periodesSeChevauchent } from '@/domain/absences.js';
import { estRemplacante } from '@/domain/remplacement.js';
import { estPresentLe } from '@/domain/presence.js';

/** Poids par défaut de « titulaires d'abord » (par case confiée à une remplaçante). */
const POIDS_TITULAIRES_D_ABORD_DEFAUT = 2;

/** Poids par défaut de la priorité à la remplaçante rattachée. */
const POIDS_PRIORITAIRE_DEFAUT = 0.5;

/**
 * Précalcul commun aux fabriques (recréé à chaque `creerContraintes`).
 *
 * @param {import('../modele/types.js').Entree} entree
 */
function preparerRemplacement(entree) {
  const personnes = (entree.personnes ?? []).filter((p) => p.actif !== false);
  const absences = entree.absences ?? [];
  const remplacantes = personnes.filter(estRemplacante);
  const remplacantesParId = new Map(remplacantes.map((p) => [p.id, p]));
  const titulairesParId = new Map(personnes.filter((p) => p.statut === 'TITULAIRE').map((p) => [p.id, p]));

  /** Titulaire rattachée à `remplacante`, `null` si absente / archivée / plus titulaire. */
  const titulaireDe = (remplacante) => titulairesParId.get(remplacante.titulaireId) ?? null;

  /** Remplaçantes rattachées à la titulaire `titulaireId` (ordre de l'entrée). */
  const habituellesDe = (titulaireId) => remplacantes.filter((r) => r.titulaireId === titulaireId);

  /** Titulaires (ordre de l'entrée) ayant au moins une remplaçante habituelle. */
  const titulairesAvecHabituelles = [...titulairesParId.values()].filter((t) => habituellesDe(t.id).length > 0);

  /** Disponible = présente au cabinet (dates d'arrivée / départ, 0031) et aucune absence validée qui couvre ce jour-là. */
  const estDisponible = (personne, date) =>
    estPresentLe(personne, date) &&
    !absences.some(
      (a) =>
        a.statut === 'VALIDE' &&
        a.personneId === personne.id &&
        periodesSeChevauchent(a.dateDebut, a.dateFin, date, date)
    );

  /** `true` si la personne a au moins une affectation ce jour-là (niveau jour, pas demi-journée). */
  const travaille = (personneId, date, ctx) =>
    ctx.index.joursTravaillesParPersonne.get(personneId)?.has(date) ?? false;

  return {
    remplacantes,
    remplacantesParId,
    titulaireDe,
    habituellesDe,
    titulairesAvecHabituelles,
    estDisponible,
    travaille,
  };
}

/**
 * Construit la contrainte **souple silencieuse** « titulaires d'abord » : une
 * case confiée à une remplaçante coûte `poids`, une case confiée à une
 * titulaire ne coûte rien ici (ses propres règles la départagent).
 *
 * @param {number} [poids=POIDS_TITULAIRES_D_ABORD_DEFAUT]
 * @param {import('../modele/types.js').Entree} entree
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteTitulairesDAbord(poids = POIDS_TITULAIRES_D_ABORD_DEFAUT, entree) {
  const { remplacantes, remplacantesParId } = preparerRemplacement(entree ?? {});

  return {
    id: 'titulaires-d-abord',
    type: 'REMPLACEMENT',
    durete: 'souple',
    poids,
    granularite: 'cellule',

    coutMarginal(personneId) {
      return remplacantesParId.has(personneId) ? poids : 0;
    },

    /** `poids ×` nombre total d'affectations des remplaçantes (pénalité jamais affichée). */
    coutGlobal(ctx) {
      let total = 0;
      for (const r of remplacantes) total += (ctx.index.parPersonne.get(r.id) ?? []).length;
      return poids * total;
    },

    evaluer() {
      return [];
    },
  };
}

/**
 * Construit la contrainte **souple silencieuse** « remplaçante habituelle
 * d'abord » : un jour où une titulaire ne travaille pas et où une de ses
 * remplaçantes habituelles est disponible mais ne travaille pas, une autre
 * remplaçante coûte `poids` de plus.
 *
 * @param {number} [poids=POIDS_PRIORITAIRE_DEFAUT]
 * @param {import('../modele/types.js').Entree} entree
 * @returns {import('../modele/types.js').Contrainte}
 */
export function creerContrainteRemplacementPrioritaire(poids = POIDS_PRIORITAIRE_DEFAUT, entree) {
  const { remplacantes, remplacantesParId, titulaireDe, habituellesDe, titulairesAvecHabituelles, estDisponible, travaille } =
    preparerRemplacement(entree ?? {});

  /** `titulaire` attend son habituelle le jour `date` : elle ne travaille pas, aucune habituelle non plus, et une est disponible. */
  const attendSonHabituelle = (titulaire, date, ctx) => {
    if (travaille(titulaire.id, date, ctx)) return false;
    const habituelles = habituellesDe(titulaire.id);
    if (habituelles.some((h) => travaille(h.id, date, ctx))) return false;
    return habituelles.some((h) => estDisponible(h, date));
  };

  return {
    id: 'remplacement-prioritaire',
    type: 'REMPLACEMENT',
    durete: 'souple',
    poids,
    granularite: 'global',

    coutMarginal(personneId, demande, ctx) {
      const r = remplacantesParId.get(personneId);
      if (!r) return 0; // titulaire : jamais concernée
      const date = demande.date;
      if (travaille(r.id, date, ctx)) return 0; // déjà présente ce jour-là
      const sienne = titulaireDe(r);
      if (sienne && !travaille(sienne.id, date, ctx)) return 0; // elle remplace « sa » titulaire
      const autreAttend = titulairesAvecHabituelles.some((t) => t.id !== sienne?.id && attendSonHabituelle(t, date, ctx));
      return autreAttend ? poids : 0;
    },

    /** `+ poids` par (jour, titulaire en attente) où une autre remplaçante, hors habituelle, travaille. */
    coutGlobal(ctx) {
      const dates = new Set();
      for (const r of remplacantes) {
        for (const jour of ctx.index.joursTravaillesParPersonne.get(r.id) ?? []) dates.add(jour);
      }
      let total = 0;
      for (const date of [...dates].sort()) {
        for (const t of titulairesAvecHabituelles) {
          if (!attendSonHabituelle(t, date, ctx)) continue;
          const autreTravaille = remplacantes.some((r) => {
            if (!travaille(r.id, date, ctx) || r.titulaireId === t.id) return false;
            const sienne = titulaireDe(r);
            return !sienne || travaille(sienne.id, date, ctx);
          });
          if (autreTravaille) total += poids;
        }
      }
      return total;
    },

    evaluer() {
      return [];
    },
  };
}
