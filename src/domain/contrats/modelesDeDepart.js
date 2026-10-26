/**
 * Modèles de départ proposés au premier accès (0041).
 *
 * Contenu INDICATIF : inspiré de la structure d'un contrat type de remplacement entre
 * infirmiers libéraux, sans prétendre le reproduire ni citer de texte de loi.
 * Les clés des champs à compléter sont générées à chaque appel (jamais écrites en dur).
 *
 * Module pur : aucun import Vue/Vuex/Quill.
 */

import { creerModeleContrat, creerChampLibre } from '@/domain/contrats/modeles.js';

const AVERTISSEMENT =
  'Modèle indicatif préparé par Idelia. Faites-le relire (Ordre des infirmiers, juriste) et adaptez-le avant toute utilisation. Supprimez ce paragraphe une fois le modèle vérifié.';

/** Ops d'un titre (texte + fin de ligne portant le niveau). */
const titre = (texte, niveau) => [{ insert: texte }, { insert: '\n', attributes: { header: niveau } }];

/** Ops d'un paragraphe : chaînes et embeds (`champ`) ; `options.italic` / `options.align` pour la ligne. */
const paragraphe = (...morceaux) => {
  const ops = morceaux.map((m) => (typeof m === 'string' ? { insert: m } : m));
  ops.push({ insert: '\n' });
  return ops;
};

/** Paragraphe en italique (avertissement). */
const paragrapheItalique = (texte) => [{ insert: texte, attributes: { italic: true } }, { insert: '\n' }];

/** Embed d'un marqueur. */
const champ = (cle) => ({ insert: { marqueur: { cle } } });

/** Paragraphe de signature, aligné à droite. */
const signature = (texte) => [{ insert: texte }, { insert: '\n', attributes: { align: 'right' } }];

/** Parties de l'avenant (version courte). */
function partiesCourtes() {
  return [
    ...titre('Entre les soussigné(e)s', 2),
    ...paragraphe(
      champ('titulaire.nomComplet'), ', n° RPPS ', champ('titulaire.rpps'),
      ', exerçant au sein de ', champ('cabinet.nom'), ', ci-après « le/la titulaire » ;'
    ),
    ...paragraphe(
      'et ', champ('personne.nomComplet'), ', n° RPPS ', champ('personne.rpps'), ', ci-après « le/la remplaçant(e) ».'
    ),
  ];
}

function contratDeRemplacement() {
  const debut = creerChampLibre({ libelle: 'Date de début du remplacement', type: 'DATE' });
  const fin = creerChampLibre({ libelle: 'Date de fin du remplacement', type: 'DATE' });
  const lieu = creerChampLibre({ libelle: 'Lieu de signature', type: 'TEXTE' });
  const ops = [
    ...titre('Contrat de remplacement entre infirmier(e)s libéraux(ales)', 1),
    ...paragrapheItalique(AVERTISSEMENT),
    ...titre('Entre les soussigné(e)s', 2),
    ...paragraphe(
      champ('titulaire.nomComplet'), ', infirmier(e) libéral(e) exerçant au sein de ', champ('cabinet.nom'), ', ',
      champ('cabinet.adresse'), ', n° RPPS ', champ('titulaire.rpps'), ', n° ordinal ', champ('titulaire.ordinal'),
      ', ci-après « le/la titulaire » ;'
    ),
    ...paragraphe(
      'et ', champ('personne.nomComplet'), ', né(e) le ', champ('personne.dateNaissance'), ', demeurant ',
      champ('personne.adresse'), ', n° RPPS ', champ('personne.rpps'), ', n° ordinal ', champ('personne.ordinal'),
      ', ci-après « le/la remplaçant(e) ».'
    ),
    ...titre('Article 1 – Objet', 2),
    ...paragraphe(
      'Le/la remplaçant(e) remplace le/la titulaire auprès de sa patientèle, pendant ses absences, dans le respect des règles professionnelles.'
    ),
    ...titre('Article 2 – Durée', 2),
    ...paragraphe('Le remplacement a lieu du ', champ(debut.cle), ' au ', champ(fin.cle), ' inclus.'),
    ...titre("Article 3 – Conditions d'exercice", 2),
    ...paragraphe(
      "Le/la remplaçant(e) utilise les locaux et le matériel du cabinet, assure la continuité des soins et informe les patients du remplacement. Il/elle n'exerce pas d'activité en parallèle du/de la titulaire pendant le remplacement."
    ),
    ...titre('Article 4 – Rétrocession', 2),
    ...paragraphe(
      'Le/la remplaçant(e) rétrocède au/à la titulaire ', champ('personne.tauxRetrocession'),
      ' des honoraires perçus au titre du remplacement, selon les modalités convenues entre les parties.'
    ),
    ...titre('Article 5 – Assurance', 2),
    ...paragraphe(
      'Chaque partie déclare être couverte par une assurance de responsabilité civile professionnelle.'
    ),
    ...titre('Article 6 – Après le remplacement', 2),
    ...paragraphe(
      "Une clause de non-installation peut être prévue : à préciser par les parties (durée, périmètre), dans les limites prévues par les règles professionnelles."
    ),
    ...titre('Article 7 – Litiges', 2),
    ...paragraphe(
      "Les parties recherchent une solution amiable, au besoin par une conciliation auprès du conseil départemental de l'Ordre."
    ),
    ...titre("Article 8 – Communication à l'Ordre", 2),
    ...paragraphe("Le présent contrat est communiqué au conseil départemental de l'Ordre des infirmiers."),
    ...paragraphe('Fait à ', champ(lieu.cle), ', le ', champ('date.jour'), ', en deux exemplaires.'),
    ...signature('Le/la titulaire (mention « Lu et approuvé »)'),
    ...signature('Le/la remplaçant(e) (mention « Lu et approuvé »)'),
  ];
  return creerModeleContrat({
    titre: 'Contrat de remplacement',
    type: 'CONTRAT',
    contenu: { ops },
    champsLibres: [debut, fin, lieu],
  });
}

function avenantTauxRetrocession() {
  const initial = creerChampLibre({ libelle: 'Date du contrat initial', type: 'DATE' });
  const effet = creerChampLibre({ libelle: "Date d'effet", type: 'DATE' });
  const taux = creerChampLibre({ libelle: 'Nouveau taux de rétrocession', type: 'TAUX_RETROCESSION' });
  const lieu = creerChampLibre({ libelle: 'Lieu de signature', type: 'TEXTE' });
  const ops = [
    ...titre('Avenant au contrat de remplacement', 1),
    ...paragrapheItalique(AVERTISSEMENT),
    ...partiesCourtes(),
    ...titre('Article 1 – Objet', 2),
    ...paragraphe(
      'Le présent avenant modifie le taux de rétrocession prévu au contrat de remplacement signé le ',
      champ(initial.cle), '.'
    ),
    ...titre('Article 2 – Nouveau taux', 2),
    ...paragraphe(
      'À compter du ', champ(effet.cle), ', le taux de rétrocession passe de ', champ('personne.tauxRetrocession'),
      ' à ', champ(taux.cle), '.'
    ),
    ...titre('Article 3 – Autres clauses', 2),
    ...paragraphe('Toutes les autres clauses du contrat initial restent inchangées.'),
    ...paragraphe('Fait à ', champ(lieu.cle), ', le ', champ('date.jour'), ', en deux exemplaires.'),
    ...signature('Le/la titulaire (mention « Lu et approuvé »)'),
    ...signature('Le/la remplaçant(e) (mention « Lu et approuvé »)'),
  ];
  return creerModeleContrat({
    titre: 'Avenant – taux de rétrocession',
    type: 'AVENANT',
    contenu: { ops },
    champsLibres: [initial, effet, taux, lieu],
  });
}

/**
 * Les deux modèles de départ (ids et clés de champs neufs à chaque appel).
 * @returns {import('@/domain/contrats/modeles.js').ModeleContrat[]}
 */
export function modelesDeDepart() {
  return [contratDeRemplacement(), avenantTauxRetrocession()];
}
