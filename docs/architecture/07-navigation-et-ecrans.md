# 07 — Navigation et écrans

Idelia s'organise autour d'un petit nombre d'écrans clairs, accessibles depuis un **menu latéral permanent, repliable** (à gauche ; [feature 0015](../../features/0015-layout-menu-lateral-repliable.md)). Le vocabulaire est celui de l'utilisateur (pas de jargon).

## Carte des écrans

| Route | Écran | Rôle | Feature |
|---|---|---|---|
| `/` | **Accueil** | Vue d'ensemble, actions rapides, état de la sauvegarde | `0013` |
| `/cabinet` | **Cabinet** | Identité du cabinet (nom, adresse, logo des en-têtes de documents), jours d'ouverture, créneaux de travail, rythme de travail | `0003`, `0039` |
| `/equipe` | **Équipe** | Gérer les personnes du cabinet (ajout/édition/désactivation, rythme mensuel, remplaçant(e) rattaché(e), informations professionnelles, adresse et date de naissance : onglets de la fiche et consultation « Informations utiles ») | `0004`, `0020`, `0030`, `0040` |
| `/equipe/:id/souhaits` | **Souhaits** | Souhaits & préférences d'une personne | `0005` |
| `/tournees` | **Tournées** | Gérer les tournées et leurs horaires | `0006` |
| `/absences` | **Absences & congés** | Saisir les absences (saisie directe, sans validation en v1) | `0007`, `0017` |
| `/planning` | **Planning** | Générer, éditer (drag & drop), voir les conflits et les souhaits non respectés, récap mensuel par personne | `0010`, `0011`, `0023`, `0024`, `0025` |
| `/planning/:id/diffusion` | **Diffusion** | Impression / export PDF (repères : dimanches, fériés « F », vacances « V »), envoi par e-mail à l'équipe (messagerie de l'utilisatrice) | `0012`, `0023`, `0027` |
| `/feuille-de-route` | **Feuille de route** | Repérer, depuis la liste des séances exportée de Vega (PDF), les patients soignés le matin et l'après-midi par deux infirmières différentes, avec qui reverse combien à qui, patient par patient et en bilan de la période (imprimable, sans nom de patient ; noms via les initiales Vega de l'équipe) — lu sur le poste, rien n'est conservé | `0033`, `0034`, `0035` |
| `/modeles-contrats` | **Modèles de contrats** | Liste des modèles (contrat de remplacement, avenant) : créer, modifier, dupliquer, renommer, archiver / restaurer ; deux modèles de départ au premier accès. Chargé à la demande | `0041` |
| `/modeles-contrats/:id` | **Modèle de contrat** | Édition d'un modèle dans l'éditeur riche (champs automatiques et champs à compléter). Chargé à la demande | `0041` |
| `/contrats` | **Documents** | Choisir une personne (actives, archivées en option) et lister ses documents contractuels. Chargé à la demande | `0042` |
| `/contrats/:id` | **Documents d'une personne** | Documents en cours et archivés d'une personne, « Nouveau document » à partir d'un modèle ; accessible depuis l'icône « Contrats et avenants » de l'Équipe. Chargé à la demande | `0042` |
| `/contrats/:id/documents/:documentId` | **Document** | Feuille A4 : brouillon éditable (enregistrement explicite, Ctrl+S, garde de sortie), « Marquer comme signé » (en-tête figé, lecture seule), suppression du brouillon, archivage, rappel de taux, impression / PDF. Chargé à la demande | `0042` |
| `/parametres` | **Paramètres** | Affichage, apparence, **vacances scolaires** (zone, mise à jour des dates), sauvegarde / import / export, sauvegarde automatique | `0003`, `0008`, `0019`, `0023`, `0038`, `0039` |

## Principes de navigation

- **Menu latéral toujours visible** (déplié : icônes Phosphor + libellés, Accueil seul en tête (sans titre), puis groupes « Pilotage » / « Planning » / « Contrats » (« Documents », 0042, puis « Modèles », 0041), **Paramètres en pied de menu** sous la bascule de thème ; replié : rail d'icônes seules avec infobulles au survol/focus). Repli **réversible** et **mémorisé** d'une session à l'autre ; sous ~992 px, repli automatique en rail. Icônes Phosphor ([ADR 0013](../adr/0013-icones-phosphor.md)) ; l'écran courant est mis en évidence par **fond + barre d'accent + graisse** (`aria-current`), jamais par la seule couleur.
- **Une action principale par écran**, visuellement dominante (ex. « Générer le planning »).
- **Fil d'Ariane** ou titre d'écran explicite en permanence : l'utilisateur sait toujours où il est.
- **Actions destructrices** protégées par confirmation ; retour/annulation possibles.
- **Rappel de sauvegarde** accessible depuis partout (état « dernière sauvegarde le… », bouton d'export) — cohérent avec le workflow référent ([ADR 0009](../adr/0009-workflow-referent-diffusion-lecture.md)).

## Écran Planning (le plus riche)

C'est l'écran central. Il enchaîne :
1. **Choix de la période** et lancement de la **génération** (le moteur propose).
2. **Grille d'édition** (personnes × jours, ou tournées × jours) avec **glisser-déposer** ; une tournée **coupée** présente ses deux vacations (matin / reprise du soir) distinctement dans la case, éditables séparément ([feature 0016](../../features/0016-tournees-coupees-modele.md)).
3. **Panneau de conflits** mis à jour en **temps réel** (erreurs dures en évidence, avertissements souples distincts), avec surlignage des cellules concernées.
4. **Verrouillage** d'affectations (préservées lors d'une régénération) et actions « regénérer » (reproductible / variante).

Les principes d'ergonomie détaillés sont dans [`08-principes-ux-ergonomie.md`](08-principes-ux-ergonomie.md).

## Repères calendaires (Planning et Diffusion)

- **Planning** : repères dans l'en-tête de ligne du jour uniquement (dimanche et férié : fond teinté, « Férié : Toussaint » ; vacances : barre à gauche et ligne « Vacances »). Les vacances manquantes sont récupérées en arrière-plan, sans bloquer l'écran.
- **Diffusion / impression** : marqueurs « F » (férié) et « V » (vacances) lisibles en noir et blanc, légende « Repères » ; si la zone est choisie mais les vacances non récupérables, alerte non imprimée avec « Réessayer ».

## Écran Cabinet

Sections dans l'ordre : identité (nom, adresse, logo), jours d'ouverture, créneaux de travail, rythme de travail. Chaque modification est **enregistrée automatiquement**. Le logo (PNG ou JPEG) est réduit à 400 px au plus, soumis à un plafond de poids, inclus dans la sauvegarde/export, et prévisualisé sur fond blanc (rendu des en-têtes de documents). Sans logo choisi, le **logo par défaut** d'Idelia (bâton d'Asclépios teal, `public/logo-cabinet-defaut.png`, jamais enregistré dans les données) est affiché dans l'aperçu et en tête des documents, y compris quand le nom et l'adresse du cabinet sont vides (le logo est toujours imprimé).

## Écran Paramètres : vacances scolaires

Section « Vacances scolaires » (composant `BlocVacancesScolaires`), entre « Affichage » et « Sauvegarde » : liste de la zone (« Aucune » par défaut), bouton « Mettre à jour » à droite du titre (visible seulement avec une zone), état du cache et résultat annoncés (`role="status"`). Changer de zone enregistre aussitôt et récupère l'année en cours ; revenir à « Aucune » oublie les dates, sans requête. Dimanches et jours fériés sont toujours indiqués, même sans zone ([ADR 0020](../adr/0020-exception-reseau-api-calendrier-scolaire.md)).
