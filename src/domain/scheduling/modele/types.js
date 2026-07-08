/**
 * Contrats de types (JSDoc) du moteur de planification.
 *
 * Fichier de **pure documentation** : aucune exécution, aucun export
 * exécutable ([ADR 0004](../../../../docs/adr/0004-pas-de-typescript-js-jsdoc.md)
 * — JS + JSDoc, pas de TypeScript). Toutes les structures ci-dessous sont
 * **purement techniques** : elles n'existent que dans `src/domain/scheduling/`
 * et ne sont **jamais sérialisées** (absentes du `SaveDocument`, jamais
 * écrites en `localStorage`).
 *
 * Module pur : aucun import Vue/Vuex, aucun accès `localStorage`
 * ([ADR 0008](../../../../docs/adr/0008-moteur-planification-module-pur.md)).
 *
 * Convention : dans tout le moteur, les jours de semaine sont en **ISO 1-7**
 * ([ADR 0010](../../../../docs/adr/0010-conventions-dates-et-jours-iso.md)) ;
 * toute date manipulée est une chaîne `"YYYY-MM-DD"`, jamais un objet `Date`.
 *
 * `Personne`, `Tournee`, `Absence`, `ParametresCabinet`, `Planning` et
 * `Affectation` référencés ci-dessous sont les entités déjà définies par les
 * features précédentes (voir `docs/architecture/02-modele-de-domaine.md`,
 * `src/domain/personnes.js`, `src/domain/tournees.js`,
 * `src/domain/absences.js`, `src/domain/schema.js`,
 * `src/domain/scheduling/modele/affectation.js`).
 */

/**
 * @typedef {Object} Entree
 * @property {{debut: string, fin: string}} periode - `"YYYY-MM-DD"` inclusifs.
 * @property {Personne[]} personnes - Déjà filtrées "actives" par l'appelant.
 * @property {Tournee[]}  tournees - Déjà filtrées "non archivées" par l'appelant.
 * @property {Absence[]}  absences - Toutes ; le moteur filtre lui-même par statut.
 * @property {ParametresCabinet} reglesCabinet - `cabinet.parametres` tel quel.
 * @property {Object} [poids] - Surcharge partielle des poids souples par défaut (§7.5 du plan).
 * @property {Planning} [planningPrecedent] - Pour l'heuristique de continuité uniquement.
 * @property {Affectation[]} [affectationsVerrouillees] - Préservées telles quelles (mode hybride, ADR 0007).
 */

/**
 * @typedef {Object} Options
 * @property {number} [seed=0]
 * @property {number} [variante=0]
 * @property {number} [budgetMs=200] - Budget de la recherche locale (anytime).
 */

/** @typedef {'erreur'|'avertissement'} Severite */

/**
 * @typedef {Object} Violation
 * @property {string}   contrainteId
 * @property {Severite} severite
 * @property {Object}   cible - `{ personneId?, tourneeId?, date?, creneau? }`.
 * @property {string}   code - Stable, ex. `'ABSENCE_VALIDEE'` (voir `modele/messages.js`).
 * @property {string}   message - FR, prêt à afficher tel quel.
 * @property {number}   penalite - Souples : `poids * amplitude` ; dures : `0`.
 * @property {Object}   [params] - Données brutes (debug / reconstruction du message).
 */

/**
 * @typedef {Object} NonCouverture
 * @property {string} date
 * @property {string} creneau
 * @property {string} tourneeId
 * @property {number} requis
 * @property {number} affectes
 * @property {number} manque
 */

/**
 * @typedef {Object} Resultat
 * @property {Affectation[]}   affectations - Liste PLATE, JSON-sérialisable (inclut les verrouillées, inchangées).
 * @property {Violation[]}     violations - Triées : erreurs d'abord, puis avertissements par pénalité décroissante.
 * @property {number}          score - Somme pondérée des pénalités souples (bas = mieux).
 * @property {NonCouverture[]} tourneesNonCouvertes
 * @property {Object}          meta - `{ seed, variante, dureeMs, faisable, nbErreursDures }`.
 */

/** @typedef {'dure'|'souple'} Durete */
/** @typedef {'cellule'|'creneau'|'personne-periode'|'global'} Granularite */

/**
 * @typedef {Object} Contrainte
 * @property {string}       id - Stable : ex. `'chevauchement'`, `'pref-<preferenceId>'`.
 * @property {string}       type - Catégorie métier, voir `TYPES_CONTRAINTE` (`contraintes/index.js`).
 * @property {Durete}       durete
 * @property {number}       [poids] - Souples uniquement.
 * @property {Granularite}  granularite - Portée d'impact (prépare une future validation incrémentale).
 * @property {function(ContexteEvaluation): Violation[]} evaluer - SOURCE DE VÉRITÉ.
 * @property {function(string, Demande, ContexteEvaluation): boolean} [autoriseAffectation] - Dures.
 * @property {function(string, Demande, ContexteEvaluation): number}  [coutMarginal] - Souples.
 */

/**
 * @typedef {Object} Demande - Unité de demande : UN slot à pourvoir.
 * @property {string} id - Ex. `` `${tourneeId}|${date}|${creneau}|${index}` ``.
 * @property {string} date
 * @property {number} jourIso - 1..7 (ADR 0010).
 * @property {string} creneau
 * @property {string} tourneeId
 * @property {number} index - 0..nbPersonnesRequises-1.
 */

/**
 * @typedef {Object} PlanningIndexe
 * @property {Affectation[]} affectations
 * @property {Map<string, Affectation[]>} parCreneau - Clé `` `${date}|${creneau}` ``.
 * @property {Map<string, Affectation[]>} parPersonne - Clé `personneId`.
 * @property {Map<string, Affectation[]>} parTournee - Clé `tourneeId`.
 * @property {Map<string, Set<string>>}   joursTravaillesParPersonne - Clé `personneId` -> `Set` de dates.
 */

/**
 * @typedef {Object} ContexteEvaluation
 * @property {Entree}        entree
 * @property {PlanningIndexe} index
 * @property {Demande[]}     demandes
 * @property {string[]}      joursPeriode - Dates `"YYYY-MM-DD"` des jours OUVERTS de la période, triées.
 */

/**
 * @typedef {Object} Changement
 * @property {'AJOUTER'|'RETIRER'|'DEPLACER'} type
 * @property {Affectation} [affectation] - AJOUTER/DEPLACER : affectation à sa nouvelle position.
 * @property {string}      [affectationId] - RETIRER/DEPLACER : id de l'affectation d'origine.
 */

export {};
