# ADR 0020 — Exception réseau : lecture de l'API open-data du calendrier scolaire

- **Statut** : Accepté
- **Date** : 2026-10-14
- **Décideurs** : porteur du produit (validation du 2026-10-14)
- **Amende** : [ADR 0002](0002-application-frontend-sans-backend.md) (règle d'or n° 1), sans le remplacer

## Contexte

La feature [0023](../../features/0023-reperes-calendaires.md) affiche des repères calendaires dans le planning et sur le tirage papier : dimanches, jours fériés, **vacances scolaires**. Le planning papier actuel du cabinet surligne les vacances scolaires : l'équipe s'en sert pour anticiper les absences et la charge.

- Les **dimanches** et les **jours fériés** français se calculent localement (le seul férié mobile, Pâques, a un algorithme connu). Aucun réseau n'est nécessaire.
- Les **vacances scolaires** sont fixées par arrêté ministériel, par zone, chaque année. Aucune règle ne permet de les calculer. Les écrire en dur dans le code obligerait à publier une nouvelle version d'Idelia chaque année. L'application doit durer des années sans maintenance : c'est exclu.
- L'Éducation nationale publie ces dates en open-data (licence ouverte Etalab) : jeu `fr-en-calendrier-scolaire` sur `data.education.gouv.fr`, servi par l'API Explore v2.1 d'Opendatasoft. L'API est publique, sans clé ni compte, en lecture seule. Les API Opendatasoft envoient normalement `Access-Control-Allow-Origin: *`, ce qui permet de les appeler depuis un site statique (**à confirmer en recette**).

La règle d'or n° 1 et l'[ADR 0002](0002-application-frontend-sans-backend.md) excluent tout backend et toute webapi. Ils visent d'abord l'absence de serveur **à nous** (coût, maintenance, surface d'attaque) et la confidentialité des données du cabinet. Lire une donnée publique de référence ne touche à aucun de ces deux points, à condition d'encadrer l'appel strictement. C'est néanmoins la **première dépendance réseau au fonctionnement** de l'application. Elle doit donc être actée.

## Décision

Nous autorisons **une seule dépendance réseau au fonctionnement** : la **lecture** de l'API open-data du calendrier scolaire de l'Éducation nationale. Le périmètre est strict :

1. **Un seul domaine** : `https://data.education.gouv.fr`, jeu `fr-en-calendrier-scolaire`, requête `GET` uniquement. L'URL de base est une **constante** du code, jamais construite à partir d'une saisie libre.
2. **Lecture seule, rien n'est envoyé sur le cabinet** : la requête ne contient que la **zone scolaire** (choisie dans une liste fermée) et l'**année scolaire** (calculée, ex. `2026-2027`). Aucune donnée sur le cabinet, l'équipe, les patients ou les plannings. Options `fetch` : `credentials: 'omit'` (aucun cookie), `referrerPolicy: 'no-referrer'` (l'adresse du site Idelia n'est pas transmise), `redirect: 'error'`. Restent visibles pour le serveur, comme pour toute requête web : l'adresse IP et le navigateur du poste.
3. **Activation volontaire** : aucune requête tant qu'aucune zone n'est choisie dans les Paramètres (valeur par défaut : aucune zone). Les dimanches et les fériés restent affichés sans réseau.
4. **Isolée dans un seul adaptateur** : `src/adaptateurs/calendrierScolaire.js` fait le `fetch` (délai maximal, erreurs typées, ne lève jamais). Le domaine (`src/domain/`) ne fait **aucun** accès réseau ([ADR 0008](0008-moteur-planification-module-pur.md)). Il normalise la réponse (fonction pure) et la valide strictement : forme, dates, longueurs.
5. **Cache dans le `SaveDocument`**, par zone et année scolaire, persisté via `storageRepository` ([ADR 0005](0005-persistance-localstorage-derriere-repository.md)). Il est exporté et importé avec le reste ([ADR 0006](0006-sauvegarde-partage-par-export-import-json.md)). Une année en cache n'est **jamais** redemandée automatiquement. L'API n'est interrogée que si la zone change, si une année scolaire manque pour la période affichée, ou si l'utilisateur clique sur le bouton de mise à jour.
6. **Dégradation gracieuse** : hors-ligne, en cas de panne ou de réponse illisible, on affiche le cache s'il existe, sinon aucune vacance. Le planning reste entièrement utilisable. Un message clair et non bloquant s'affiche, au plus une fois par session pour les tentatives automatiques.
7. **Affichage seul** : ces données n'ont **aucun effet** sur la génération du planning. Le moteur ne les reçoit pas.

**Toute autre dépendance réseau** (autre domaine, autre API, envoi de données) exige un **nouvel ADR**.

## Conséquences

- **Positives** : les vacances scolaires sont officielles et à jour chaque année, sans nouvelle version d'Idelia ni saisie manuelle. Une fois l'année en cache, tout fonctionne hors-ligne, y compris sur un autre poste après import de la sauvegarde. Aucun serveur à opérer.
- **Négatives / compromis** :
  - **Disponibilité** : on dépend d'un service tiers (panne, changement d'URL ou de champs, fin du jeu de données). Le pire cas est l'absence des vacances à l'écran. La dégradation gracieuse et le cache limitent l'effet. Un changement de format est détecté par la validation stricte, qui renvoie « réponse illisible » et n'affiche rien de faux.
  - **CORS** : l'appel depuis le navigateur suppose `Access-Control-Allow-Origin` sur la réponse. Si l'en-tête disparaît, la requête échoue proprement et le cas « hors-ligne » s'applique. Aucun proxy ne sera ajouté (ce serait un backend).
  - **Politique de sécurité du contenu (CSP)** : l'hébergement statique (Pages) ne permet pas de poser des en-têtes HTTP. Aucune CSP n'est déclarée à ce jour. Si une CSP est ajoutée (par exemple une balise `<meta http-equiv="Content-Security-Policy">`), elle devra contenir `connect-src 'self' https://data.education.gouv.fr`.
  - **Vie privée** : le service public voit l'adresse IP du poste et l'heure des requêtes. C'est dit en clair dans l'écran Paramètres, à côté du choix de la zone.
  - **Fichier de sauvegarde** : il grossit légèrement (une dizaine de périodes par année scolaire). Migration de schéma v8 → v9.
  - **Plafonds anti-rafale** : au plus **4 années scolaires** demandées par période de planning (les plus anciennes, donc le début de la période) ; l'adaptateur refuse, avant tout appel, une année hors **2000-2001 … 2099-2100**.
  - **Plafonds du cache importé** : dates validées par aller-retour calendaire, 120 jours max par période, 50 périodes par entrée, 10 entrées au total ; un horodatage `recupereLe` invalide devient `null`.
  - La règle d'or n° 1 de `CLAUDE.md` doit mentionner cette exception.
- **Suivi** :
  - Si l'API change de forme ou d'adresse, seuls l'adaptateur et la fonction de normalisation sont à modifier.
  - Si le jeu de données disparaît, le repli envisagé est l'import manuel d'un fichier de vacances (nouvel ADR).
  - Toute nouvelle source réseau (fériés locaux, autre service) passe par un nouvel ADR, pas par une extension implicite de celui-ci.

## Alternatives considérées

- **Vacances écrites en dur dans le code** : une nouvelle version d'Idelia serait nécessaire chaque année, et l'application ne marcherait plus après la dernière année saisie. Rejeté (l'appli doit durer des années).
- **Saisie manuelle des vacances par le cabinet** : ce sont plusieurs périodes par an, avec un risque d'erreur, pour un public peu à l'aise avec l'informatique. Rejeté pour la v1. Ce repli reste possible si l'API disparaît.
- **Fichier de vacances déposé à la main (export du site officiel)** : plus lourd pour l'utilisateur que l'appel automatique. Rejeté pour la v1.
- **Proxy ou fonction serverless qui interroge l'API** : c'est un backend. Contraire à l'[ADR 0002](0002-application-frontend-sans-backend.md). Rejeté.
- **Bibliothèque npm embarquant le calendrier** : même problème que les données en dur (mise à jour du paquet chaque année), avec une dépendance en plus. Rejeté.

## Liens

[ADR 0002](0002-application-frontend-sans-backend.md), [ADR 0005](0005-persistance-localstorage-derriere-repository.md), [ADR 0006](0006-sauvegarde-partage-par-export-import-json.md), [ADR 0008](0008-moteur-planification-module-pur.md), [ADR 0010](0010-conventions-dates-et-jours-iso.md), feature [0023](../../features/0023-reperes-calendaires.md), feature [0012](../../features/0012-diffusion-impression-pdf.md).
