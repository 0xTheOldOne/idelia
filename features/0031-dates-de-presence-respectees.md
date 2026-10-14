# Feature 0031 — Dates de présence respectées (moteur + vue Personnes)

- **Statut** : À faire (plan rédigé le 2026-10-14)
- **Dépend de** : `0009` (moteur pur : contraintes dures, glouton, recherche locale, validation), `0011` (éditeur : dépôt manuel jamais bloqué, verrou, sélecteur de personne). S'appuie sur `0020` (`rythmeMensuel.js` gère déjà la présence au prorata), `0021` révisée (« titulaires d'abord », remplaçante habituelle), `0022` (trame des weekends, terme de réservation), `0024` (récap) et `0025` (pouce : codes `PREFERENCE_*` seulement).
- **ADR liés** : [0007](../docs/adr/0007-generation-planning-hybride.md) (le geste manuel prime), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (moteur pur, catalogue unique de contraintes), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates `"YYYY-MM-DD"` comparées comme chaînes). **Aucun écart d'ADR.** Une **exception documentée** au contrat `Violation` (« dure → erreur ») : la contrainte `presence` produit un `avertissement` sur une affectation posée à la main (§5.3).

## 1. Contexte & objectif

`Personne.dateEntree` / `dateSortie` sont saisies dans la fiche (0004) mais **inertes** : le moteur n'exclut une personne que si elle est archivée (`actif === false`, [glouton.js:140](../src/domain/scheduling/heuristiques/glouton.js#L140)), et la grille du planning ne les lit pas. Résultat : une remplaçante qui arrive le 9 est planifiée le 2, une titulaire qui part le 15 est planifiée jusqu'au 30.

Objectif : une personne n'est **planifiée automatiquement** que les jours où elle fait partie du cabinet (`dateEntree ≤ date ≤ dateSortie`, borne vide = ouverte). Un **placement manuel** hors de ces dates reste possible (le gestionnaire a le dernier mot, ADR 0007) mais il est **signalé**. Dans la vue « par personne », les jours hors présence sont **grisés** avec un libellé clair (« Avant son arrivée » / « Après son départ »). Couvre la remplaçante temporaire et la titulaire sortante.

**Hors périmètre** : archivage automatique d'une personne partie ; masquage des colonnes de personnes absentes de toute la fenêtre ; impression/diffusion (0012) ; souhaits « minimum de jours » sur une semaine partielle (§12 n° 6).

## 2. Écrans concernés

Aucun nouvel écran, aucune nouvelle route.

### 2.1 Planning (`/planning`) — génération / régénération

- Une personne n'est jamais proposée par le moteur avant sa date d'arrivée ni après sa date de départ (la date de départ est son **dernier jour** au cabinet, incluse).
- Si personne d'autre ne peut prendre la tournée, elle apparaît dans « Tournées non couvertes » comme aujourd'hui.

### 2.2 Planning — vue « Personnes » (lecture seule, inchangé)

La vue par personne est déjà en lecture seule (`GrillePlanning.editableEffectif` exige l'orientation Tournées) : rien n'y est éditable ni déposable, cela reste vrai.

- Case d'une personne un jour où elle **n'est pas encore arrivée** : fond grisé + libellé en clair « Avant son arrivée ».
- Case un jour **après son départ** : fond grisé + « Après son départ ».
- Un jour fermé reste « Fermé » (prioritaire). « Hors période » reste affiché en plus si les deux s'appliquent.
- Si une affectation manuelle existe quand même sur une case grisée, elle reste visible, avec le surlignage « Point d'attention » habituel.

### 2.3 Planning — vue « Tournées », mode édition

- **Sélecteur « Ajouter une personne »** (`SelecteurPersonne`) : une personne hors présence ce jour-là **reste proposée** (le placement manuel est toléré), mais **en fin de liste**, avec une mention en clair dans le bouton : « Pas encore arrivée (arrive le 09/11/2026) » ou « A quitté le cabinet (dernier jour : 15/11/2026) ». Le gestionnaire sait avant de cliquer.
- **Glisser-déposer** : inchangé (jamais bloqué). Déposer une personne sur un jour hors présence produit un point d'attention.
- Panneau « Points d'attention » : deux nouvelles causes (§5.4).

### 2.4 Équipe — modale « Ajouter / Modifier une personne » (`FormulairePersonne`)

Une ligne d'aide sous les deux dates (`id="personne-presence-aide"`, reliée par `aria-describedby` aux deux champs, combinée avec l'erreur existante de la date de départ) :
« La date de départ est le dernier jour au cabinet. Le planning ne proposera pas cette personne avant son arrivée ni après son départ. »

## 3. Modèle de données touché

**Aucun changement persistant, aucune migration** (`CURRENT_SCHEMA_VERSION` reste `8`).

- Lus : `Personne.dateEntree`, `Personne.dateSortie` (existants, `"YYYY-MM-DD"` ou `null`), `Affectation.origine` (`'AUTO'` | `'MANUEL'`, existant ; `deplacerAffectation` le pose déjà à `'MANUEL'`).
- **Sémantique précisée** (déjà celle de `rythmeMensuel.js`) : bornes **incluses** ; `null`, `''` ou valeur mal formée = borne ouverte.
- Volatil : deux nouveaux `Violation.code` : `AVANT_ARRIVEE`, `APRES_DEPART`.
- Doc à mettre à jour : [02-modele-de-domaine](../docs/architecture/02-modele-de-domaine.md) (sémantique des deux dates).

## 4. Store (Vuex)

**Aucun module, getter, mutation ni action modifié.** `plannings/assemblerEntree` transmet déjà `personnes/actifs` (avec leurs dates) et l'origine des affectations est déjà posée par `ajouterAffectation` / `deplacerAffectation`. Les composants lisent les dates via les getters existants (`personnes/actifs`, `personnes/byId`).

## 5. Domaine (logique pure)

### 5.1 Nouveau module `src/domain/presence.js` (source unique, partagée moteur et UI)

Module pur, **imports relatifs uniquement** (`./utils/dates.js`), parce que `rythmeMensuel.js` (chargeable sans Vite) l'importera.

| Fonction | Rôle |
|---|---|
| `etatPresenceLe(personne, date)` → `'PRESENTE'` \| `'AVANT_ARRIVEE'` \| `'APRES_DEPART'` | Borne valide = chaîne `^\d{4}-\d{2}-\d{2}$`, sinon ouverte. `date < dateEntree` → `AVANT_ARRIVEE` ; `date > dateSortie` → `APRES_DEPART`. Personne absente / `null` → `'PRESENTE'` (jamais de crash). |
| `estPresentLe(personne, date)` → `boolean` | `etatPresenceLe(...) === 'PRESENTE'`. |
| `aDesDatesDePresence(personne)` → `boolean` | Au moins une borne valide (sert aux raccourcis de performance, §5.3). |
| `libellePresenceLe(personne, date)` → `string` | `''` si présente, sinon `'Pas encore arrivée'` / `'A quitté le cabinet'`. |
| `precisionPresenceLe(personne, date)` → `string` | `''` si présente, sinon `'arrive le 09/11/2026'` / `'dernier jour : 15/11/2026'` (`dateUtil.formatDateFr`). |
| `fractionPresence(personne, dates)` → `number` 0..1 | Part des `dates` où la personne est présente ; `1` si `dates` est vide. |

JSDoc complet (`@typedef EtatPresence`). Aucune règle ailleurs : composants et contraintes appellent ces fonctions.

### 5.2 `src/domain/rythmeMensuel.js` — refactor sans effet

Remplacer la fonction locale `estPresente` par `estPresentLe(personne, date)` importé de `./presence.js`. Résultat identique sur des données normales (`null` ou dates valides). Seul écart : une borne `''` (jamais produite par l'appli : `creerPersonne` et le formulaire posent `null`) devient ouverte au lieu de « jamais présente ».

### 5.3 Nouvelle contrainte dure `presence` — `src/domain/scheduling/contraintes/contraintePresence.js`

`creerContraintePresence(entree)` → `{ id: 'presence', type: 'PRESENCE', durete: 'dure', granularite: 'cellule', autoriseAffectation, evaluer }`. Même patron que `contrainteAbsence.js` (`nomPersonneDe`, résolution des horaires par `tournee.segments[segmentIndex]`, jamais de crash sur une référence introuvable).

- **Précalcul** à la création : `Map` id → personne de `entree.personnes`, et un drapeau `aucuneDate = !personnes.some(aDesDatesDePresence)`. Si `aucuneDate` : `autoriseAffectation` renvoie `true` et `evaluer` renvoie `[]` **immédiatement**. Effet : aucun coût ajouté, donc pas de risque de changer le nombre d'itérations de la recherche locale bornée par `budgetMs` (non-régression, §11).
- `autoriseAffectation(personneId, demande)` : `estPresentLe(personne, demande.date)` (personne inconnue → `true`).
- `evaluer(ctx)` : pour chaque affectation de `ctx.index.affectations` dont la personne est dans l'entrée et `etatPresenceLe ≠ 'PRESENTE'`, une violation :
  - `code` : `'AVANT_ARRIVEE'` ou `'APRES_DEPART'` ;
  - `cible` : `{ personneId, tourneeId, date, segmentIndex }` (surligne la case dans les deux orientations) ;
  - **`severite` selon l'origine** : `affectation.origine === 'MANUEL'` → `'avertissement'` (placement voulu, toléré mais signalé) ; sinon → `'erreur'` (le moteur ne le produit jamais : les dates ont changé après la génération, ou une case auto verrouillée a été conservée) ;
  - `penalite: 0` dans les deux cas (n'influence pas le score : les affectations manuelles non verrouillées ne passent jamais par la recherche locale, et les verrouillées sont constantes) ;
  - `params` : `{ personneId, date, segmentIndex, dateEntree | dateSortie, origine }`.
- Les personnes **archivées** ne sont pas dans `entree.personnes` : leurs affectations ne sont pas évaluées (comme aujourd'hui pour les souhaits).

**Pourquoi la gravité selon l'origine (décision).** Ce mécanisme **n'existe plus** dans le moteur : il a été retiré avec `remplacement-sur-absence` lors de la révision de 0021 (`Affectation.origine` n'est plus lu nulle part dans `src/domain/scheduling/`). On le **réintroduit localement**, dans cette seule contrainte, car le besoin diffère de 0021 : ici une case automatique hors présence est une **vraie incohérence** (« à corriger »), alors qu'un placement manuel est souvent voulu (journée de doublure avant l'arrivée, dernier remplacement après un départ). Tout signaler en « Erreur à corriger » rouge ferait passer un choix délibéré pour une faute et rendrait le planning « infaisable » (`meta.faisable`). Coût : un test sur `origine`. À documenter dans `modele/types.js` (`Violation.severite` : « Dure → `erreur`, sauf `presence` sur une affectation `MANUEL` → `avertissement` ») et dans [architecture 05](../docs/architecture/05-moteur-de-planification.md) (catalogue des dures).

**Archivée vs partie.** `actif === false` reste l'exclusion totale (filtre existant, inchangé). Une `dateSortie` passée **sans archivage** n'exclut la personne qu'**après** cette date ; avant, elle reste planifiable normalement. Aucun archivage automatique.

### 5.4 Messages et causes

`modele/messages.js` — deux gabarits, avec `manuel` (booléen) pour la variante, défensifs comme les autres (valeurs par défaut neutres) :

- `AVANT_ARRIVEE`, manuel : « Léa Roux est placée le jeudi 05/11/2026 (07:00 – 13:00), avant son arrivée au cabinet le 09/11/2026. »
- `AVANT_ARRIVEE`, auto : « Léa Roux est planifiée le jeudi 05/11/2026 (07:00 – 13:00), avant son arrivée au cabinet le 09/11/2026 (sa date d'arrivée a sans doute été modifiée après la création du planning). Retirez-la de cette case. »
- `APRES_DEPART`, manuel : « Marc Petit est placée le vendredi 20/11/2026 (07:00 – 13:00), après son départ du cabinet (dernier jour : 15/11/2026). »
- `APRES_DEPART`, auto : même phrase en « planifiée », suivie de « (sa date de départ a sans doute été modifiée après la création du planning). Retirez-la de cette case. »

(Accord au féminin : convention déjà suivie par tous les messages du moteur, « est affectée », « elle ne peut pas ».)

`src/domain/libelles.js` → `LIBELLES_CAUSE_VIOLATION` : `AVANT_ARRIVEE: 'Personne planifiée avant son arrivée'`, `APRES_DEPART: 'Personne planifiée après son départ'`. Ces codes **ne commencent pas** par `PREFERENCE_` : **pas de pouce** (0025), la présence n'est pas un souhait.

### 5.5 Enregistrement — `contraintes/index.js`

Ajouter `creerContraintePresence(entree)` juste après les deux contraintes d'absence ; ajouter `'PRESENCE'` à `TYPES_CONTRAINTE` ; en-tête : « 12 contraintes fixes ». L'ordre des dures dans le `.every` du glouton n'a pas d'effet sur le résultat.

### 5.6 Cohérence des contraintes souples avec la présence (sans effet quand aucune date n'est saisie)

| Fichier | Problème aujourd'hui | Correction |
|---|---|---|
| `contrainteRemplacement.js` (`preparerRemplacement.estDisponible`) | Une remplaçante habituelle **pas encore arrivée** est jugée « disponible » : une autre remplaçante est alors pénalisée (+0,5) pour rien. | `estDisponible = estPresentLe(personne, date) && aucune absence validée`. |
| `contrainteTrameWeekend.js` (`excedent`, terme de réservation) | Des jours de trame **hors présence** sont « réservés », ce qui freine à tort la semaine de la personne. | Ne compter un jour de trame restant que si la personne est présente ce jour-là (comme pour une absence). Map id → personne précalculée. Le bonus de `coutGlobal` sur ces jours reste une constante (aucun effet sur les choix). |
| `contrainteEquite.js`, groupe **sans rythme** | Pas de prorata de présence : une titulaire sortante le 15 est comparée à la moyenne du mois entier → « Charge de travail mal répartie » à tort, et elle tire la moyenne vers le bas. | Précalculer `fractionPresence(personne, joursOuvertsDeLaPériode)` à la création (même calcul de jours ouverts que `joursAttendusSurPeriode`). `chargeNormalisee` divise aussi par cette fraction ; une personne à fraction `0` sort du groupe. Fraction `1` (aucune date) → `x / 1 === x`, résultat **strictement identique**. |
| `contrainteEquite.js`, groupe **avec rythme** / `recapMensuel.js` (0024) | Prorata déjà géré par `joursAttendusSurPeriode` (0020). | **Aucun changement.** |

## 6. Composants

| Composant | Changement |
|---|---|
| `src/components/planning/GrillePlanning.vue` | Dans `celluleDescripteur`, en orientation **Personnes** seulement : `horsPresence = libellePresenceLe(personneParId(ligne.id), colonne.date)` (`''` en Tournées, pour un jour fermé, ou pour une personne introuvable). Ajouté au descripteur (donc au slot `cellule`) et passé à `CellulePlanning`. Mettre à jour le JSDoc d'en-tête (import de `@/domain/presence.js`, toujours aucun import de `@/domain/scheduling`). |
| `src/components/planning/CellulePlanning.vue` | Nouvelle prop `horsPresence: { type: String, default: '' }`. Non vide (et case non fermée) → classe `cellule-planning--hors-presence` (fond grisé) + texte `{{ horsPresence }}` au même style que « Hors période » (petit, italique, couleur atténuée). Rendu inchangé quand la prop est vide. |
| `src/components/planning/SelecteurPersonne.vue` | `personnesDisponibles` : enrichir chaque personne de `horsPresence` (`libellePresenceLe`) et `precisionPresence` (`precisionPresenceLe`) pour `date`. Tri : présentes d'abord, puis hors présence, puis par nom. Note dans le bouton (style `selecteur-personne-note`) : « Pas encore arrivée (arrive le 09/11/2026) ». La personne reste cliquable. |
| `src/components/equipe/FormulairePersonne.vue` | Ligne d'aide §2.4 sous la ligne des dates ; `aria-describedby` des deux champs : aide + erreur éventuelle de la date de départ. |

Réutilisés tels quels : `PanneauConflits.vue` (les causes viennent de `libelleCauseViolation`, aucun changement), `PlanningView.vue` (aucun changement).

## 7. Règles de validation

Rien de neuf : la règle existante « La date de départ doit être identique ou postérieure à la date d'arrivée. » (Vuelidate, `FormulairePersonne`) reste la seule. Pas de blocage ni de confirmation au moment du placement manuel (0011 : le dépôt n'est jamais bloqué).

## 8. Points d'attention ergonomie

- **Le texte porte le sens**, le gris ne fait qu'aider : « Avant son arrivée » / « Après son départ », jamais une case seulement colorée. Contraste du libellé sur le fond grisé ≥ 4,5:1 (tokens existants uniquement : par ex. fond `t.$couleur-fond-clair` assombri ou `rgba(t.$couleur-texte-attenue, …)` ; si le contraste échoue, texte en `t.$couleur-texte`). Aucune nouvelle couleur.
- La case grisée doit se distinguer d'un jour **fermé** (« Fermé ») et d'une case simplement vide (fond clair) : le libellé fait la différence.
- **Informer avant de cliquer** dans le sélecteur (mention + fin de liste), plutôt que masquer la personne : sinon le gestionnaire la chercherait sans comprendre, ou passerait par le glisser-déposer.
- Messages d'avertissement : ce qui se passe, la date en clair, que faire (« Retirez-la de cette case ») — aucun mot technique (« origine », « contrainte », « AUTO »).
- Un placement manuel voulu ne doit pas « crier » : avertissement orange, pas d'erreur rouge (§5.3).

## 9. Étapes d'implémentation

**4 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). **Ordre : étape 0 → T1 → (T2 ∥ T3 ∥ T4)**. T2, T3 et T4 touchent des fichiers disjoints et ne dépendent que de `presence.js` (T1).

**Étape 0 (orchestrateur, avant T1) — référence de non-régression.** Script jetable dans le scratchpad (`0031-reference.mjs`, Vite `createServer({ server: { middlewareMode: true }, appType: 'custom' })` + `ssrLoadModule('/src/domain/scheduling/index.js')`). Il génère avec **le code actuel**, graine fixe (`seed: 0`, `variante: 0`) et `budgetMs: 5000` (la recherche locale s'arrête alors à la convergence, pas au chronomètre) :
- (a) le jeu d'essai §11 **sans aucune date de présence** ;
- (b) `files/idelia-sermet.json`, lu à l'exécution (jamais copié), Entree assemblée comme `assemblerEntree` (personnes `actif !== false`, tournées non archivées, toutes les absences, `cabinet.parametres`), sur novembre et décembre 2026.
Il sauve la sortie normalisée (affectations triées réduites à `personneId|tourneeId|date|segmentIndex|origine`, codes + messages des violations, `tourneesNonCouvertes`, `score`). Le lancer **deux fois** pour vérifier qu'il est stable.

1. **T1 — Présence : domaine + contrainte dure.**
   - Créer `src/domain/presence.js` (§5.1).
   - Modifier `src/domain/rythmeMensuel.js` (§5.2).
   - Créer `src/domain/scheduling/contraintes/contraintePresence.js` (§5.3).
   - Modifier `src/domain/scheduling/contraintes/index.js` (§5.5), `src/domain/scheduling/modele/messages.js` (§5.4), `src/domain/scheduling/modele/types.js` (exception de gravité, JSDoc), `src/domain/libelles.js` (§5.4).
   - Vérif : scénarios S1–S5 (§11).
2. **T2 — Moteur : souples cohérentes avec la présence** (après T1).
   - Modifier `src/domain/scheduling/contraintes/contrainteRemplacement.js`, `contrainteTrameWeekend.js`, `contrainteEquite.js` (§5.6), avec les en-têtes JSDoc à jour.
   - Vérif : S6–S8.
3. **T3 — UI planning** (après T1, en parallèle de T2).
   - Modifier `src/components/planning/GrillePlanning.vue`, `CellulePlanning.vue`, `SelecteurPersonne.vue` (§6, §8).
   - Vérif : `npm run build` sans erreur ; recette R1–R3.
4. **T4 — Fiche personne + documentation** (après T1, en parallèle de T2 et T3).
   - Modifier `src/components/equipe/FormulairePersonne.vue` (§2.4).
   - Modifier `docs/architecture/05-moteur-de-planification.md` (dure `presence` + exception de gravité selon l'origine ; prorata de présence pour l'équité sans rythme) et `docs/architecture/02-modele-de-domaine.md` (bornes incluses, vide = ouverte, `dateSortie` = dernier jour).
   - Vérif : recette R6.

Puis (orchestrateur) : relancer le script de l'étape 0 sur le code modifié → **sortie identique** pour (a) et (b) ; recette navigateur §11 ; ROADMAP 0031 → ✅ au commit.

## 10. Critères d'acceptation

- [x] Une personne avec une date d'arrivée n'est **jamais** planifiée par le moteur avant cette date ; une personne avec une date de départ n'est **jamais** planifiée après (la date de départ elle-même reste travaillable).
- [x] Une personne sans dates est planifiée comme avant ; une personne archivée reste exclue comme avant.
- [x] Sans aucune date de présence saisie (cas des données réelles du cabinet), le planning généré est **strictement identique** à avant, à graine égale (affectations, points d'attention, tournées non couvertes, score).
- [x] Vue Personnes : les jours avant l'arrivée affichent « Avant son arrivée », ceux après le départ « Après son départ », sur fond grisé ; les jours fermés affichent toujours « Fermé ».
- [x] Vue Tournées, mode édition : dans « Ajouter une personne », une personne hors présence ce jour-là apparaît en fin de liste avec « (arrive le …) » ou « (dernier jour : …) », et reste sélectionnable.
- [x] La placer (clic ou glisser-déposer) n'est jamais bloqué ; la case passe en « Point d'attention » (orange) et le panneau affiche, sous « Avertissements », la cause « Personne planifiée avant son arrivée » (ou « … après son départ ») avec une phrase claire.
- [x] Après génération, avancer la date d'arrivée d'une personne déjà planifiée fait apparaître ses cases devenues hors présence en **« Erreur à corriger »** (rouge), avec un message qui explique que la date a changé et invite à la retirer.
- [x] Aucun pouce baissé sur ces cases (ce n'est pas un souhait).
- [x] Une titulaire sortante sans rythme n'est plus signalée « Charge de travail mal répartie » uniquement à cause de son départ en cours de mois.
- [x] Le récapitulatif mensuel (0024) est inchangé pour une personne sans dates, et tient déjà compte de la présence pour une personne avec rythme.
- [x] Fiche personne : l'aide sous les dates est affichée et annoncée par les lecteurs d'écran.

## 11. Vérification

### Jeu d'essai (ids GUID)

Cabinet ouvert du lundi au dimanche (`joursOuverture` `[1..7]`), `reposHebdoMin` 1, `maxJoursConsecutifs` 6. Période **2026-11-01 → 2026-11-30**.

| Entité | id | Détails |
|---|---|---|
| Claire Martin | `3f6b2c1e-8a4d-4e7b-9c2a-5d1e7f3a9b40` | Titulaire, sans dates |
| Sophie Durand | `a2d94e17-5c3b-4f68-8e1d-0b7c6a95f2e3` | Titulaire, sans dates ; absence validée `CONGE_PAYE` `JOURNEE` du 2026-11-09 au 2026-11-20 |
| Marc Petit | `7c1e5a93-2f4d-4b86-a07e-e93d1b4c6f58` | Titulaire **sortante** : `dateSortie` 2026-11-15, sans rythme |
| Léa Roux | `d58f0b26-91c7-4a3e-b4d2-6e8a1f73c905` | Remplaçante **temporaire** : `dateEntree` 2026-11-09, `dateSortie` 2026-11-20, `titulaireId` = Sophie Durand |
| Zoé Blanc | `1e9a7d42-c6b5-4f13-8a9e-2b4d70f6e8c1` | Remplaçante, sans dates, sans titulaire |
| Tournée A | `6b3e91d7-4a2c-4e5f-9d18-c7a0e2b5f439` | 07:00–13:00, 1 personne, tous les jours |
| Tournée B | `92f4c6a1-7e3b-4d29-b5c8-1a6e0d4f7b23` | 07:00–13:00, 1 personne, tous les jours |
| Après-midi | `e47a2d9c-0b15-4c6e-8f3a-5d9b1c7e2a68` | 14:00–19:00, 1 personne, tous les jours |

Variante « sans dates » pour la non-régression : mêmes données, `dateEntree`/`dateSortie` à `null` partout.

### Script jetable (Vite `ssrLoadModule`, scratchpad, jamais commité)

- **S1** `etatPresenceLe` : bornes `null` → présente ; `date === dateEntree` et `date === dateSortie` → présente ; veille d'arrivée → `AVANT_ARRIVEE` ; lendemain du départ → `APRES_DEPART` ; borne `''` ou `'2026-13-45x'` → ouverte ; personne `null` → présente. `fractionPresence` de Marc sur les jours de novembre = 15/30 ; tableau vide → 1.
- **S2** `genererPlanning` (seed 0) : aucune affectation de Léa avant le 09/11 ni après le 20/11 ; aucune de Marc après le 15/11 ; aucune violation `AVANT_ARRIVEE` / `APRES_DEPART` ; Léa a des affectations entre le 09 et le 20.
- **S3** `validerPlanning` avec une affectation `MANUEL` de Léa le 2026-11-05 (Tournée A) → exactement une violation `AVANT_ARRIVEE`, `severite: 'avertissement'`, `penalite: 0`, `cible` complète, message contenant « 09/11/2026 ».
- **S4** Même affectation en `AUTO` → `severite: 'erreur'`, message contenant « modifiée ».
- **S5** Affectation `MANUEL` de Marc le 2026-11-20 → `APRES_DEPART`, avertissement. `estCodeSouhait('AVANT_ARRIVEE') === false`.
- **S6** Non-régression : relancer le script de l'étape 0 → sorties (a) et (b) **identiques** à la référence.
- **S7** Équité : sur un planning où Marc travaille ~la moitié des jours de ses collègues titulaires sans rythme, pas d'`EQUITE_DESEQUILIBREE` pour Marc (noter si elle apparaissait avant T2, avec la référence de l'étape 0).
- **S8** `remplacement-prioritaire.coutMarginal` pour Zoé le 2026-11-05 (Sophie ne travaille pas, Léa pas encore arrivée) = `0` (avant T2 : `0,5`).

### Recette navigateur (`npm run dev`, http://localhost:5199/idelia/#/)

- **R1** Importer le jeu d'essai, générer novembre. Vue Personnes : colonne Léa « Avant son arrivée » du 01 au 08, travaillée possible du 09 au 20, « Après son départ » du 21 au 30 ; colonne Marc « Après son départ » du 16 au 30. Contraste vérifié, lisible sur mobile.
- **R2** Vue Tournées, Modifier, « Ajouter une personne » sur Tournée A le 05/11 : Léa en fin de liste avec « Pas encore arrivée (arrive le 09/11/2026) » ; la choisir → case orange, panneau « Avertissements » → « Personne planifiée avant son arrivée ». Annuler (undo) → tout disparaît.
- **R3** Glisser une affectation de Marc du 12/11 au 18/11 → avertissement « Personne planifiée après son départ ». Pas de pouce.
- **R4** Équipe : passer la date d'arrivée de Léa au 12/11, revenir au planning → ses cases des 09–11 en « Erreur à corriger » avec le message « … modifiée … Retirez-la de cette case. » ; régénérer → elles disparaissent.
- **R5** Données réelles `files/idelia-sermet.json` (aucune personne n'y a de date de présence, vérifié le 2026-10-14) : générer novembre avec la même graine avant et après la feature → planning identique ; aucune case grisée.
- **R6** Équipe, modifier une personne : l'aide sous les dates est visible ; la vérification « date de départ ≥ date d'arrivée » marche toujours.

## 12. Décisions à confirmer / risques

1. **Gravité selon l'origine** (retenu, §5.3) : `MANUEL` → avertissement, sinon erreur. Alternative plus simple écartée : toujours « erreur », comme une absence validée. Le mécanisme, retiré de 0021, n'est réintroduit **que** dans `presence`, et documenté dans `types.js` et l'architecture 05.
2. **`dateSortie` = dernier jour au cabinet, inclus** : aligné sur `rythmeMensuel.js` (0020) ; dit dans l'aide de la fiche.
3. **Sélecteur : proposer avec mention plutôt que masquer** (retenu) : cohérent avec « toléré mais signalé » et avec le glisser-déposer, qui ne bloque jamais.
4. **Libellés au féminin** (« Avant son arrivée », « est placée ») : convention déjà suivie par tous les messages du moteur. Alternative : « arrivé(e) ». À valider par le porteur.
5. **Personne partie mais non archivée** : sa colonne reste visible dans la vue Personnes (entièrement grisée si elle est partie avant la fenêtre affichée). Pas d'archivage ni de masquage automatique. À rediscuter si cela encombre.
6. **Semaines partielles** : les souhaits « nombre de jours par semaine » (borne min) et « minimum de jours d'affilée » peuvent donner un avertissement sur la semaine d'arrivée ou de départ, comme ils le font déjà autour d'une absence. Limite connue, hors périmètre.
7. **Déterminisme et budget** : la recherche locale s'arrête au plus tard à `budgetMs` (200 ms dans l'appli). Sur un gros jeu, deux générations à graine égale peuvent déjà différer si le budget est atteint avant la convergence. Le raccourci `aucuneDate` (§5.3) évite tout surcoût sans dates. La comparaison avant/après se fait avec `budgetMs: 5000` dans le script, et deux fois avant la feature dans le navigateur pour s'assurer que la référence est stable.
8. **Données réelles** : `files/idelia-sermet.json` ne contient **aucune** `dateEntree`/`dateSortie` renseignée → aucun changement attendu. (`files/sauvegarde-test-4-personnes.json` : seulement des dates d'arrivée passées, 2018–2025 → aucun effet sur les plannings 2026.)
9. **Diffusion / impression (0012)** : non modifiées (grille par tournée, seules les cases réellement affectées y apparaissent).

## 13. Retouches de recette (2026-10-14)

- **Textes épicènes** (décision de l'orchestrateur, pour ne pas écrire « Marc Petit … placée ») : cases « Avant son arrivée » / « Après son départ » + précision datée ; messages « {Nom} a une tournée le …, avant son arrivée au cabinet prévue le … » / « …, après son départ du cabinet (dernier jour : …) ».
- **Robustesse** (audit `security`, points Faible) : `params.origine` normalisé (`'MANUEL'` / `'AUTO'`), nom de repli « Cette personne », accès à `segments` protégé.
- Recette : données réelles strictement identiques à graine égale (aucune date de présence saisie) ; contraste du libellé hors présence ≈ 4,8:1.
