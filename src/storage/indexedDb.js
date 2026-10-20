/**
 * Accès minimal à IndexedDB (ADR 0021) : seul fichier de l'application qui
 * touche à `indexedDB`, importé uniquement par `storageRepository.js`.
 *
 * Magasin clé/valeur générique, en API native (aucune dépendance). La base est
 * ouverte puis refermée à chaque opération : aucune connexion ne reste ouverte,
 * donc rien ne bloque une suppression ou une future montée de version.
 *
 * Ces fonctions **peuvent rejeter** : les protections sont dans
 * `storageRepository`.
 */

const NOM_BASE = 'idelia';
const VERSION_BASE = 1;
const MAGASIN = 'cles-valeurs';

/**
 * Vérifie que IndexedDB est disponible dans l'environnement courant.
 *
 * @throws {Error} Si `indexedDB` n'existe pas.
 */
function verifierDisponibilite() {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB indisponible');
  }
}

/**
 * Ouvre la base et crée le magasin au besoin. La connexion se ferme
 * d'elle-même si une autre version de la base est demandée.
 *
 * @returns {Promise<IDBDatabase>}
 */
function ouvrir() {
  return new Promise((resolve, reject) => {
    try {
      verifierDisponibilite();
      const requete = indexedDB.open(NOM_BASE, VERSION_BASE);
      requete.onupgradeneeded = () => {
        const db = requete.result;
        if (!db.objectStoreNames.contains(MAGASIN)) db.createObjectStore(MAGASIN);
      };
      requete.onsuccess = () => {
        const db = requete.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      requete.onerror = () => reject(requete.error ?? new Error('Ouverture IndexedDB impossible'));
      requete.onblocked = () => reject(new Error('Ouverture IndexedDB bloquée'));
    } catch (erreur) {
      reject(erreur);
    }
  });
}

/**
 * Promesse résolue à la fin d'une requête IDB (rejet sur erreur).
 *
 * @param {IDBRequest} requete
 * @returns {Promise<*>}
 */
function requeteEnPromesse(requete) {
  return new Promise((resolve, reject) => {
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

/**
 * Ouvre la base, exécute `operation` dans une transaction sur le magasin,
 * attend la fin de la transaction, puis REFERME toujours la base.
 *
 * @param {'readonly'|'readwrite'} mode
 * @param {(magasin: IDBObjectStore) => IDBRequest} operation - Renvoie la requête dont le résultat est attendu.
 * @returns {Promise<*>} Résultat de la requête, après `oncomplete`.
 */
async function avecMagasin(mode, operation) {
  const db = await ouvrir();
  try {
    const transaction = db.transaction(MAGASIN, mode);
    const terminee = new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Transaction IndexedDB annulée'));
    });
    const resultat = requeteEnPromesse(operation(transaction.objectStore(MAGASIN)));
    const [valeur] = await Promise.all([resultat, terminee]);
    return valeur;
  } finally {
    db.close();
  }
}

export const indexedDb = {
  /**
   * @param {string} cle
   * @returns {Promise<*>} La valeur, ou `undefined` si la clé est absente.
   */
  lire: (cle) => avecMagasin('readonly', (magasin) => magasin.get(cle)),

  /**
   * @param {string} cle
   * @param {*} valeur
   * @returns {Promise<void>}
   */
  ecrire: (cle, valeur) =>
    avecMagasin('readwrite', (magasin) => magasin.put(valeur, cle)).then(() => undefined),

  /**
   * @param {string} cle
   * @returns {Promise<void>}
   */
  supprimer: (cle) =>
    avecMagasin('readwrite', (magasin) => magasin.delete(cle)).then(() => undefined),

  /**
   * Supprime toute la base (sans effet si elle n'existe pas). Résout aussi sur
   * `onblocked` (la suppression aboutira à la fermeture des autres
   * connexions) : ne fait jamais attendre l'interface.
   *
   * @returns {Promise<void>}
   */
  supprimerBase: () =>
    new Promise((resolve, reject) => {
      try {
        verifierDisponibilite();
        const requete = indexedDB.deleteDatabase(NOM_BASE);
        requete.onsuccess = () => resolve();
        requete.onblocked = () => resolve();
        requete.onerror = () => reject(requete.error);
      } catch (erreur) {
        reject(erreur);
      }
    }),
};
