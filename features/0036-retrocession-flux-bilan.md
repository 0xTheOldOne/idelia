# Feature 0036 — Rétrocession dans le bilan « qui doit quoi »
> **Mise à jour (2026-10-21) : schéma Mermaid abandonné.** Après essai, l'utilisatrice ne veut pas du schéma « chemin de l'argent » : dépendance `mermaid`, `schemaFlux.js`, `SchemaFlux.vue`, adaptateurs et ADR 0022 sont retirés. Les parties de ce plan qui décrivent le schéma (T4, libellés de flèches, sécurité du SVG) sont caduques ; le bilan garde les listes texte (virements entre titulaires, reversement aux remplaçantes, alertes).

- **Statut** : Terminé
- **Dépend de** : `0020` (`Personne.titulaireId`, « Remplace en priorité »), `0027` (lien profond `/equipe?modifier=<id>`), `0034` (`relierInfirmieres`, `calculerReversements`), `0035` (`calculerBilan`, `BilanPeriode`) — toutes livrées. **Pré-requis acquis, non replanifié** : le champ `Personne.tauxRetrocession` (entier 0..100 ou `null`, seulement si `REMPLACANT`) présent dans l'arbre de travail non commité — `src/domain/personnes.js` (`normaliserTauxRetrocession`, `estTauxRetrocessionValide`), migration v9 → v10 (`src/storage/migrations.js`), `src/domain/validationImport.js`, champ `personne-retrocession` de `FormulairePersonne.vue`, docs 02/03. Il part dans le même commit que 0036.
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (tout dans le navigateur), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (non concerné : rien de nouveau n'est persisté), [0008](../docs/adr/0008-moteur-planification-module-pur.md) (flux et schéma en modules purs), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (Vuelidate), [0013](../docs/adr/0013-icones-phosphor.md), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md), [0019](../docs/adr/0019-lecture-pdf-pdfjs.md) (modèle suivi pour la dépendance chargée à la demande), **nouvel ADR 0022** (Mermaid, à rédiger en T4).

## 1. Contexte & objectif

Depuis 0035, le bilan fait virer l'argent **d'un code PS à l'autre**, remplaçantes comprises. Ce n'est pas ce qui se passe au cabinet :

- l'argent des soins d'une remplaçante arrive sur le compte de **sa titulaire** (« Remplace en priorité », `titulaireId`) ;
- les virements se font donc **entre titulaires** ;
- quand une remplaçante **doit recevoir** X, sa titulaire lui reverse `X × (100 − taux) %` et garde le reste (`tauxRetrocession`, ex. Farah 11 % → elle reçoit 89 % de X) ;
- quand elle **doit payer** X, c'est sa titulaire qui vire X, et la rétrocession de la remplaçante **baisse** de `X × (100 − taux) %` (règle **symétrique**).

Les infirmières sont peu à l'aise avec les chiffres : un **schéma Mermaid** montre le chemin de l'argent, doublé d'un texte en toutes lettres.

**Décisions prises avec le porteur (non négociables dans ce plan)** : titulaire de référence = `titulaireId` ; règle symétrique ; « Remplace en priorité » et le taux deviennent **obligatoires** pour une remplaçante ; schéma avec la **librairie Mermaid** ; `calculerBilan` reste inchangé.

**Hors périmètre** : migration des données existantes (une remplaçante sans titulaire ou sans taux est **signalée** dans le bilan, pas corrigée) ; changement du détail par patient (`ListeRelais`, toujours code à code) ; mémorisation des virements faits ; chaînes de remplacement sur plusieurs niveaux.

## 2. Écrans concernés

### 2.1 Équipe — fiche personne (`FormulairePersonne`, T1)

Pour une personne au statut **Remplaçant(e)** :

- **« Remplace en priorité »** (sans « (facultatif) ») : liste avec option vide « — Choisir — ». Obligatoire. Aide en deux phrases : « Les jours où cette titulaire ne travaille pas, cette personne est proposée avant les autres remplaçantes dans le planning. Les paiements des soins de cette personne sont versés à cette titulaire. » Si aucune titulaire active n'existe, message séparé et visible (`form-text text-danger`) : « Aucune titulaire n'est enregistrée : ajoutez d'abord une personne titulaire pour pouvoir la choisir ici. »
- **« Rétrocession »** (libellé conservé : vocabulaire de l'utilisatrice ; sans « (facultatif) ») : entier 0..100 (`inputmode="numeric"`), obligatoire. Aide : « Pourcentage gardé par la titulaire sur les soins de cette remplaçante. Exemple : 11 → la titulaire garde 11 %, la remplaçante reçoit 89 %. »
- À l'enregistrement, un champ vide ou invalide reçoit le focus (comportement existant `focusPremierChampErrone`), avec un message en français sous le champ.
- Conséquence voulue : modifier une remplaçante **existante** (données non migrées) exige de compléter ces deux champs.

Lien profond étendu (T1) : `/equipe?modifier=<id>&champ=remplacement` ouvre la fiche avec le curseur dans « Remplace en priorité » (au lieu de l'e-mail, comportement 0027 inchangé sans `champ`).

### 2.2 Feuille de route — onglet « Bilan de la période » (`BilanPeriode`, T5)

Inchangés : titre, bouton d'impression, introduction, encarts « plusieurs mois » / « cas exclus », **tableau par infirmière** (par code PS, comme en 0035).

Le bloc « Virements à faire » est **remplacé**, de haut en bas, par :

1. **`h3` « Le chemin de l'argent »** : schéma Mermaid (T4) dans un `<figure>`, `<figcaption>` : « Flèche pleine : argent à virer. Flèche en pointillé : somme retirée de la rétrocession d'une remplaçante. Tout est écrit en toutes lettres juste en dessous. » Absent s'il n'y a ni virement ni rétrocession.
2. **`h3` « Virements entre titulaires »** : bloc en évidence (style actuel `.bilan-periode__virements`), une ligne en gras par virement : « **Emmanuelle SERMET vire 20,00 € à Sandrine OPPER** ». Puis l'avertissement existant (gras) : « Ces virements soldent toute la période. Ils remplacent ceux indiqués patient par patient : ne faites pas les deux. » Aucun virement : « Aucun virement entre titulaires sur la période. »
3. **`h3` « Rétrocession aux remplaçantes »** (masqué s'il n'y en a aucune) : phrase d'introduction « L'argent des soins d'une remplaçante arrive sur le compte de sa titulaire. Ces montants s'ajoutent à ce que la titulaire lui reverse d'habitude pour la période, ou s'en retirent. », puis une ligne par remplaçante :
   - sens « RECOIT » : « Emmanuelle SERMET reverse 17,80 € à Farah CHABANI (elle garde 2,20 €, taux 11 %) » ;
   - sens « PAIE » : « Sandrine OPPER retire 8,54 € de ce qu'elle reverse à Céline CUER (elle prend 1,51 € à sa charge, taux 15 %) » ;
   - taux non renseigné : « Sandrine OPPER doit reverser à Danielle OULGIMA sa part de 4,00 €, moins sa rétrocession : taux à renseigner sur sa fiche. » (RECOIT) / « La rétrocession de Danielle OULGIMA baisse, sur 4,00 € : taux à renseigner sur sa fiche. » (PAIE).
4. **Alertes** (`alert alert-warning` + `PhWarning`, titre « À vérifier dans Équipe ») — une ligne par alerte :
   - `SANS_TITULAIRE` : « Leslie RANCEL (LR) est remplaçante mais sa titulaire n'est pas renseignée : son argent est compté à part. » + lien « Compléter sa fiche » ;
   - `SANS_TAUX` : « Le taux de rétrocession de Danielle OULGIMA (DO) n'est pas renseigné. » + lien « Compléter sa fiche » ;
   - `CODE_INCONNU` : « Le code Vega XY n'est relié à personne : il est compté comme un compte à part. » + lien « Ouvrir Équipe ».
   - Sous la liste (`d-print-none`), la mise en garde déjà utilisée par l'encart des codes non reliés : « Attention : ce résultat sera perdu en quittant cette page, il faudra redéposer le fichier. »
   - Lien de fiche : `{ name: 'equipe', query: { modifier: <id>, champ: 'remplacement' } }` si la personne est **active** ; sinon (archivée) lien simple vers `{ name: 'equipe' }` (le lien profond 0027 ignore les archivées).

Impression : tout le bilan, schéma compris, part sur papier (règles 0035 inchangées : jamais de nom de patient).

## 3. Modèle de données touché

**Aucun champ nouveau, aucun changement de `schemaVersion`** (le pré-requis `tauxRetrocession` / v10 est déjà dans l'arbre de travail). Seule la **saisie** devient obligatoire pour une remplaçante (`titulaireId`, `tauxRetrocession`) ; l'import JSON et la migration restent tolérants (`null` accepté), d'où les alertes du bilan.

Structures **volatiles** (JSDoc, jamais persistées) : `CompteDuCode` (T2), `CompteFlux`, `VirementCompte`, `Retrocession`, `AlerteFlux`, `FluxComptes` (T3).

Clés de compte : l'`id` (GUID) de la personne qui détient le compte, ou `"ps:<CODE>"` pour un code non relié — clés techniques, **jamais affichées ni persistées**. Les id de nœuds Mermaid `n0`, `n1`… sont eux aussi techniques et invisibles.

## 4. Store (Vuex)

**Aucun changement.** `FeuilleDeRouteView` lit toujours `personnes.items` en lecture seule ; le flux est un `computed` perdu au démontage (règle 0033).

## 5. Domaine (logique pure)

Tous les modules de `src/domain/feuilleDeRoute/` : en-tête « Module pur », **imports relatifs uniquement** (doc 09 : ils doivent tourner sous Node). Donc **pas d'import de `../personnes.js`** (qui utilise l'alias `@/`) : les règles nécessaires (taux valide) sont réécrites localement en une ligne. Imports relatifs autorisés : `../initialesVega.js`, `../utils/montants.js`, `../utils/couleurs.js` (aucun import interne).

### 5.1 Règle de calcul (référence)

Pour une remplaçante rattachée, de solde `s` dans le bilan (`soldeCentimes`, > 0 = doit reverser) et de taux `t` :

```
partRemplacante = Math.round(|s| × (100 − t) / 100)
partTitulaire   = |s| − partRemplacante
sens            = s < 0 ? 'RECOIT' : 'PAIE'      (s = 0 : aucune ligne)
```

Le produit `|s| × (100 − t)` est entier : on multiplie **avant** de diviser. `Math.round` arrondit le demi-centime vers le haut (au profit de la remplaçante) ; la titulaire absorbe l'écart, donc `partRemplacante + partTitulaire = |s|` exactement.

Solde d'un compte = Σ des soldes des codes qui y sont comptés (ceux de la titulaire + ceux de ses remplaçantes rattachées). Les virements entre comptes réutilisent **tel quel** `calculerReversements` (`detecterRelais.js`).

### 5.2 Jeu d'exemple (GUID fictifs, codes du fichier `idelia-sermet.json`)

| Personne | Statut | Code PS | id (GUID) | Rattachement | Taux |
|---|---|---|---|---|---|
| Emmanuelle SERMET | TITULAIRE | EMM | `3f6c2a9e-8b41-4d7a-9c25-1e0b7d4a6f13` | — | — |
| Sandrine OPPER | TITULAIRE | SO | `a81d4e07-2c9b-4f5e-b6a3-90e7c4d2f158` | — | — |
| Farah CHABANI | REMPLACANT | FC | `5b2e9f71-d0c4-4a86-8e1f-37a6b9c0d4e2` | Emmanuelle | 11 |
| Céline CUER | REMPLACANT | CB | `c94a7b13-6e2f-4d08-a5b9-f1d3e8027c6a` | Sandrine | 15 |
| Leslie RANCEL | REMPLACANT | LR | `e2073c5d-9a1b-4f64-8d7e-b5c1a0f9e347` | **aucun** | `null` |
| Danielle OULGIMA | REMPLACANT | DO | `7d4f1e28-b3a6-4c9d-9f02-6a8e5c1b7d30` | Sandrine | **`null`** |
| (personne) | — | XY | — | code absent de l'équipe | — |

`calculerFlux` ne lit que `ps` et `soldeCentimes` des `LigneBilan` : les scénarios donnent les soldes directement (lignes triées par code, comme `calculerBilan`).

**Scénario A — cas principal (2 titulaires, 2 remplaçantes)** — lignes : `CB +1005`, `EMM +4000`, `FC −2000`, `SO −3005` (Σ = 0).

| Résultat | Attendu |
|---|---|
| `comptes` (ordre de 1ʳᵉ apparition) | Sandrine : codes `[CB, SO]`, solde **−2000** ; Emmanuelle : codes `[EMM, FC]`, solde **+2000** |
| `virements` | **1** : Emmanuelle → Sandrine **2000** (« Emmanuelle SERMET vire 20,00 € à Sandrine OPPER ») |
| `retrocessions[0]` | `ps CB`, Sandrine → Céline, solde **+1005**, taux 15, `PAIE`, partRemplacante **854** (`round(1005 × 85 / 100 = 854,25)`), partTitulaire **151** → « Sandrine OPPER retire 8,54 € de ce qu'elle reverse à Céline CUER (elle prend 1,51 € à sa charge, taux 15 %) » |
| `retrocessions[1]` | `ps FC`, Emmanuelle → Farah, solde **−2000**, taux 11, `RECOIT`, partRemplacante **1780** (`2000 × 89 / 100`), partTitulaire **220** → « Emmanuelle SERMET reverse 17,80 € à Farah CHABANI (elle garde 2,20 €, taux 11 %) » |
| `alertes` | aucune |
| Pour comparaison, 0035 (`bilan.virements`) | **3** virements code à code : EMM → SO 30,05 ; CB → FC 10,05 ; EMM → FC 9,95 |

Texte Mermaid attendu (montants produits par `formaterEuros`, donc avec ses espaces insécables ; `−` = U+2212) :

```
flowchart LR
  n0["Sandrine OPPER"]
  n1["Emmanuelle SERMET"]
  n2("Céline CUER")
  n3("Farah CHABANI")
  n1 -->|"20,00 €"| n0
  n0 -.->|"−8,54 € sur sa rétrocession"| n2
  n1 -->|"17,80 € (89 %)"| n3
  style n0 fill:<couleur de Sandrine>,color:<#fff ou #212529>,stroke:#212529
  style n1 …  style n2 …  style n3 …   (une ligne par nœud, couleur valide uniquement)
```

**Scénario B — alertes** — lignes : `EMM +500`, `LR −300`, `XY −200`.

| Résultat | Attendu |
|---|---|
| `comptes` | Emmanuelle `[EMM]` +500 ; Leslie (son propre compte) `[LR]` −300 ; `ps:XY` `[XY]` −200 |
| `virements` | Emmanuelle → Leslie **300** ; Emmanuelle → `ps:XY` **200** (« … vire 2,00 € à XY (non relié) ») |
| `retrocessions` | aucune |
| `alertes` | `{ps: 'LR', motif: 'SANS_TITULAIRE', personne: Leslie}`, `{ps: 'XY', motif: 'CODE_INCONNU', personne: null}` |

**Scénario C — titulaire et remplaçante sur le même compte** — lignes : `EMM +2000`, `FC −2000`.
`comptes` : Emmanuelle `[EMM, FC]` solde **0** → `virements` **vide** ; `retrocessions` : FC, `RECOIT`, 1780 / 220 ; schéma : `n0["Emmanuelle SERMET"]`, `n1("Farah CHABANI")`, `n0 -->|"17,80 € (89 %)"| n1`. (0035 aurait dit « EMM → FC 20,00 € » : un virement qui n'a pas lieu d'être, l'argent étant déjà sur le compte d'Emmanuelle.)

**Scénario D — taux non renseigné** — lignes : `DO −400`, `SO +400`.
`comptes` : Sandrine `[DO, SO]` solde 0 ; `virements` vide ; `retrocessions` : DO, Sandrine → Danielle, solde −400, taux `null`, parts `null`, `RECOIT` ; `alertes` : `{ps: 'DO', motif: 'SANS_TAUX', personne: Danielle}` ; arête Mermaid `-->|"4,00 € (taux à renseigner)"|`.

**Scénario E — arrondis et bornes** (`partsRetrocession`) :

| `soldeCentimes`, `taux` | partRemplacante | partTitulaire |
|---|---|---|
| −1235, 11 | 1099 (`1099,15`) | 136 |
| +1005, 15 | 854 (`854,25`) | 151 |
| −1, 50 | 1 (`0,5` → 1) | 0 |
| −2000, 0 | 2000 | 0 |
| −2000, 100 | 0 | 2000 |
| −400, `null` | `null` | `null` |

**Scénario F — vide** : `calculerFlux([], …)` → quatre tableaux vides ; `definitionSchemaFlux` → `null`.

### 5.3 Fichiers du domaine

- `relierInfirmieres.js` (**modifier**, T2) — projection étendue + `compteDuCode`.
- `fluxComptes.js` (**créer**, T3) — `calculerFlux`, `partsRetrocession`, `libellesFlux`.
- `schemaFlux.js` (**créer**, T4) — `echapperLibelleMermaid`, `definitionSchemaFlux`.
- **Réutilisés sans modification** : `bilanReversements.js` (`calculerBilan`), `detecterRelais.js` (`calculerReversements`), `utils/montants.js` (`formaterEuros`), `utils/couleurs.js` (`estCouleurFoncee`), `initialesVega.js` (`normaliserInitialesVega`).

Signatures détaillées : §9.

## 6. Composants

- `src/components/equipe/FormulairePersonne.vue` (**modifier**, T1) — champs obligatoires, `champInitial: 'remplacement'`.
- `src/views/EquipeView.vue` (**modifier**, T1) — paramètre `?champ=remplacement` du lien profond.
- `src/adaptateurs/dessinerSchemaMermaid.js` (**créer**, T4) — seul point de contact avec la librairie (même rôle que `lireGlyphesPdf.js` pour pdf.js) : import dynamique, configuration durcie, rendu en SVG.
- `src/components/feuilleDeRoute/SchemaFlux.vue` (**créer**, T4) — présentationnel : rend une définition Mermaid dans un `<figure>`.
- `src/components/feuilleDeRoute/BilanPeriode.vue` (**modifier**, T5) — nouvelle prop `flux`, blocs §2.2.
- `src/views/FeuilleDeRouteView.vue` (**modifier**, T5) — `computed` `flux`.
- **Réutilisés** : motifs d'encart `alert-*` + icônes Phosphor, style `.bilan-periode__virements`, `router-link` nommé, `formaterEuros`.

## 7. Règles de validation

`FormulairePersonne` (Vuelidate, ADR 0011), **seulement si `statut === 'REMPLACANT'`** :

| Champ | Règle | Message |
|---|---|---|
| `titulaireId` | `requiredIf(statut === 'REMPLACANT')` | « Choisissez la titulaire que cette personne remplace. » |
| `tauxRetrocession` | `requiredIf(statut === 'REMPLACANT')` | « Indiquez la rétrocession, en pourcentage entier entre 0 et 100. » |
| `tauxRetrocession` | `estTauxRetrocessionValide` (existant, inchangé) | « Indiquez un pourcentage entier entre 0 et 100. » (retirer « ou laissez le champ vide ») |

Statut Titulaire : aucune des deux règles (champs masqués, valeurs normalisées à `null` par l'existant).

## 8. Points d'attention ergonomie

- **Le texte fait foi, le schéma aide** : chaque flèche a son équivalent écrit ; si le schéma ne s'affiche pas (hors ligne au premier usage, erreur), le message le dit et renvoie au texte.
- **Vocabulaire du cabinet** : « vire », « reverse », « garde », « prend à sa charge », « rétrocession », « taux » ; jamais « compte », « solde », « débiteur », « flux » à l'écran.
- **Sens jamais porté par la couleur ni le seul trait** : pointillé **et** libellé « −… sur sa rétrocession » ; dans le texte, verbe explicite (« reverse » / « retire »).
- **Éviter le double paiement** : l'avertissement 0035 reste sous les virements ; les rétrocessions sont présentées comme un ajustement de la rétrocession habituelle, pas comme un virement en plus.
- **Alertes actionnables** : chaque alerte nomme la personne et mène à sa fiche, curseur dans le bon champ ; on prévient que le résultat sera perdu (il faudra redéposer le PDF).
- **Fiche personne** : obligation expliquée par l'aide (pourquoi on demande la titulaire et le taux) ; blocage sans titulaire active expliqué.
- **Accessibilité** : `<figure>` + `<figcaption>`, schéma en `role="img"` relié à la légende ; message d'erreur du schéma en `role="status"` ; liens explicites (« Compléter sa fiche » précédé du nom) ; contraste du texte des nœuds calculé (`estCouleurFoncee`).
- **Mobile** : le SVG se réduit à la largeur (`useMaxWidth`) ; les listes texte restent la référence.

## 9. Étapes d'implémentation

**5 tâches, un sous-agent `dev-front` par tâche** ([workflow](../docs/instructions/workflow-implementation.md)). Ordre : **T1** (indépendante, parallélisable) ; **T2 → T3 → T4 → T5**. T5 a besoin de T1 (paramètre `champ`), T3 et T4.

### T1 — Fiche personne : titulaire et taux obligatoires (remplaçante)

**Objectif** : une remplaçante ne peut plus être enregistrée sans « Remplace en priorité » ni « Rétrocession » ; lien profond vers ces champs.

**Fichiers** :
- `src/components/equipe/FormulairePersonne.vue` (**modifier**) :
  - libellés « Remplace en priorité » et « Rétrocession » (sans « (facultatif) ») ; option vide « — Choisir — » ; aides du §2.1 ;
  - `import { requiredIf } from '@vuelidate/validators'` ; dans `validations()` : `titulaireId: { required: helpers.withMessage(…, requiredIf(() => this.formulaire.statut === 'REMPLACANT')) }` et ajout de la même règle sur `tauxRetrocession` (le validateur `taux` existant est conservé, message du §7) ;
  - `<select id="personne-titulaire">` : classe `is-invalid` sur `$error`, `@change`/`@blur` → `$touch()`, `aria-describedby` = aide + erreur (via `describedBy`), `<p id="personne-titulaire-erreur" class="formulaire-erreur">` ;
  - `champsEnOrdre()` : ajouter `{ validation: this.v$.formulaire.titulaireId, id: 'personne-titulaire' }` **avant** l'entrée `personne-retrocession` (déjà présente) ;
  - prop `champInitial` : nouvelle valeur `'remplacement'` documentée ; `onAffichee()` : si `'remplacement'`, focus `#personne-titulaire` (ou `#personne-retrocession` si une titulaire est déjà choisie) et `$touch()` des deux champs pour afficher aussitôt ce qui manque.
- `src/views/EquipeView.vue` (**modifier**) — `ouvrirDepuisLien()` : `this.champInitial = this.$route.query.champ === 'remplacement' ? 'remplacement' : 'email'` (liste blanche, toute autre valeur → `'email'`) ; retirer `champ` de l'URL avec `modifier` ; commentaire d'en-tête des liens profonds complété.
- `docs/architecture/02-modele-de-domaine.md` (**modifier**) — lignes `titulaireId` et `tauxRetrocession` : « obligatoire **à la saisie** pour une remplaçante [0036] ; données antérieures non migrées (signalées par le bilan) » ; `tauxRetrocession` : remplacer « pas encore exploité (usage futur) » par « exploité par le bilan de la Feuille de route [0036] ».

**Critères d'acceptation** :
- Remplaçante sans titulaire ou sans taux : « Enregistrer » refuse, focus sur le premier champ manquant, message sous le champ, récapitulatif « Certains champs sont à corriger. ».
- Taux `12,5`, `-1`, `101` refusés ; `0` et `100` acceptés.
- Titulaire : enregistrement inchangé (aucune des deux règles).
- Aucune titulaire active : la phrase d'aide existante s'affiche avec l'erreur.
- `/equipe?modifier=<id d'une remplaçante active>&champ=remplacement` : fiche ouverte, curseur dans « Remplace en priorité », erreurs visibles ; `champ` et `modifier` retirés de l'URL. Sans `champ` : comportement 0027 (curseur dans l'e-mail) inchangé.
- `npm run build` réussit.

### T2 — Domaine : relier un code PS à son compte

**Objectif** : savoir, pour un code PS, sur quel compte arrive son argent.

**Fichier** : `src/domain/feuilleDeRoute/relierInfirmieres.js` (**modifier**), imports relatifs uniquement.

```js
/**
 * @typedef {Object} PersonneReliee        // projection minimale d'une Personne
 * @property {string} id
 * @property {string} prenom
 * @property {string} nom
 * @property {boolean} actif
 * @property {string} statut                 // 'TITULAIRE' | 'REMPLACANT'
 * @property {(string|null)} titulaireId
 * @property {(number|null)} tauxRetrocession
 * @property {(string|null)} couleur         // "#RRGGBB" attendu, non garanti (JSON importé)
 *
 * @typedef {'SANS_TITULAIRE'|'SANS_TAUX'|'CODE_INCONNU'} MotifAlerteCompte
 *
 * @typedef {Object} CompteDuCode
 * @property {string} cle                    // id de la détentrice du compte, ou "ps:<CODE>" (code non relié)
 * @property {(PersonneReliee|null)} titulaire   // détentrice du compte : la titulaire, ou la personne elle-même
 *                                               // (titulaire, ou remplaçante non rattachée) ; null = code non relié
 * @property {(PersonneReliee|null)} remplacante // remplaçante RATTACHÉE dont c'est le code ; null sinon
 * @property {(number|null)} taux            // taux de cette remplaçante rattachée (entier 0..100) ; null sinon ou non renseigné
 * @property {(MotifAlerteCompte|null)} alerte
 */

/** @param {Object} p @returns {PersonneReliee} */
function projeter(p) { /* … */ }

/**
 * @param {string} ps
 * @param {Map<string, PersonneReliee>} index            // indexerParInitialesVega
 * @param {Array<Object>} personnes                      // toutes (actives et archivées), pour trouver la titulaire par id
 * @returns {CompteDuCode}
 */
export function compteDuCode(ps, index, personnes) { /* … */ }
```

Règles de `compteDuCode` :
1. `infirmiereDuCode(ps, index).personne === null` → `{ cle: 'ps:' + (normaliserInitialesVega(ps) ?? ps), titulaire: null, remplacante: null, taux: null, alerte: 'CODE_INCONNU' }`.
2. Personne non `REMPLACANT` → son propre compte : `{ cle: personne.id, titulaire: personne, remplacante: null, taux: null, alerte: null }`.
3. `REMPLACANT` dont le `titulaireId` est `null` ou introuvable dans `personnes` → son propre compte, `alerte: 'SANS_TITULAIRE'`.
4. `REMPLACANT` rattachée → `{ cle: titulaire.id, titulaire: projeter(titulaire), remplacante: personne, taux, alerte: taux === null ? 'SANS_TAUX' : null }`, où `taux` = `tauxRetrocession` s'il est entier entre 0 et 100, sinon `null`. La titulaire de référence est **`titulaireId` tel quel** (archivée ou non, quel que soit son statut ; un seul niveau, pas de chaîne).

`indexerParInitialesVega` utilise `projeter` (comportement de collision inchangé). `infirmiereDuCode`, `libelleInfirmiere`, `libelleCourtInfirmiere`, `codesNonRelies` : inchangés.

**Critères d'acceptation** (script jetable, §11) : sur le jeu §5.2, `EMM` → cle Emmanuelle sans alerte ; `FC` → cle Emmanuelle, remplaçante Farah, taux 11 ; `CB` → cle Sandrine, taux 15 ; `LR` → cle Leslie, `SANS_TITULAIRE` ; `DO` → cle Sandrine, taux `null`, `SANS_TAUX` ; `XY` → cle `ps:XY`, `CODE_INCONNU` ; `fc` (minuscules) = `FC`. Aucun import `@/` ni Vue dans le dossier ; affichage 0034/0035 inchangé ; `npm run build` réussit.

### T3 — Domaine : flux d'argent

**Objectif** : à partir des lignes du bilan, calculer les virements entre comptes, les rétrocessions et les alertes.

**Fichiers** :
- `src/domain/feuilleDeRoute/fluxComptes.js` (**créer**) — module pur, imports relatifs (`./detecterRelais.js`).
- `docs/architecture/09-feuille-de-route-vega.md` (**modifier**) — section « Bilan de la période » : sous-section « Comptes et rétrocession » (règle §5.1, scénario A en exemple de référence, alertes) ; tableau des modules (+ `fluxComptes.js`) ; schéma de chaîne (`bilanReversements` → `fluxComptes` → vue).
- `docs/architecture/06-structure-du-code.md` (**modifier**) — `fluxComptes.js  # comptes des titulaires, virements et rétrocessions [0036]`.

```js
/**
 * @typedef {import('./bilanReversements.js').LigneBilan} LigneBilan
 * @typedef {import('./relierInfirmieres.js').CompteDuCode} CompteDuCode
 * @typedef {import('./relierInfirmieres.js').PersonneReliee} PersonneReliee
 *
 * @typedef {Object} CompteFlux
 * @property {string} cle
 * @property {(PersonneReliee|null)} titulaire   // null = code non relié
 * @property {string[]} codes                    // codes PS comptés ici, dans l'ordre des lignes
 * @property {number} soldeCentimes              // Σ soldes de ces codes ; > 0 = doit virer
 *
 * @typedef {Object} VirementCompte
 * @property {string} de                         // cle du compte qui vire
 * @property {string} vers                       // cle du compte qui reçoit
 * @property {number} montantCentimes            // > 0
 *
 * @typedef {Object} Retrocession
 * @property {string} ps                         // code de la remplaçante
 * @property {PersonneReliee} titulaire
 * @property {PersonneReliee} remplacante
 * @property {number} soldeCentimes              // solde signé de la remplaçante (≠ 0)
 * @property {(number|null)} taux
 * @property {(number|null)} partRemplacanteCentimes  // null si taux inconnu
 * @property {(number|null)} partTitulaireCentimes    // null si taux inconnu
 * @property {'RECOIT'|'PAIE'} sens              // RECOIT si solde < 0, PAIE si solde > 0
 *
 * @typedef {Object} AlerteFlux
 * @property {string} ps
 * @property {('SANS_TITULAIRE'|'SANS_TAUX'|'CODE_INCONNU')} motif
 * @property {(PersonneReliee|null)} personne    // pour le lien vers la fiche ; null si code non relié
 *
 * @typedef {Object} FluxComptes
 * @property {CompteFlux[]} comptes              // ordre de première apparition dans les lignes
 * @property {VirementCompte[]} virements
 * @property {Retrocession[]} retrocessions      // ordre des lignes ; aucune pour un solde nul
 * @property {AlerteFlux[]} alertes              // ordre des lignes, une par code au plus
 */

/**
 * @param {number} soldeCentimes   // signé
 * @param {(number|null)} taux     // entier 0..100, ou null
 * @returns {{partRemplacanteCentimes: (number|null), partTitulaireCentimes: (number|null)}}
 */
export function partsRetrocession(soldeCentimes, taux) { /* §5.1 */ }

/**
 * @param {LigneBilan[]} lignes                        // bilan.lignes (seuls ps et soldeCentimes sont lus)
 * @param {(ps: string) => CompteDuCode} resoudreCompte
 * @returns {FluxComptes}
 */
export function calculerFlux(lignes, resoudreCompte) { /* … */ }

/**
 * Noms affichés, partagés par le schéma et les listes : clé de compte ou id de remplaçante
 * → « Prénom NOM » ; compte non relié → « XY (non relié) ».
 * @param {FluxComptes} flux
 * @returns {Map<string, string>}
 */
export function libellesFlux(flux) { /* … */ }
```

Algorithme de `calculerFlux` : pour chaque ligne (ordre reçu) → `resoudreCompte(ps)` ; cumul du solde dans une `Map` par `cle` (jamais d'objet indexé par du texte) ; alerte si `alerte !== null` ; si `remplacante` non nulle et solde ≠ 0 → `Retrocession` via `partsRetrocession`. Puis `virements = calculerReversements(comptes.map((c) => ({ ps: c.cle, ecartCentimes: c.soldeCentimes })))` puis renommage `{de, vers, montantCentimes}` (mêmes champs). `calculerBilan` **non modifié**.

**Invariants** (contrôlés par le script) : Σ `comptes.soldeCentimes` = Σ `lignes.soldeCentimes` (= 0) ; Σ virements = Σ soldes positifs des comptes ; nombre de virements ≤ max(0, comptes de solde non nul − 1) ; chaque code apparaît dans exactement un `compte.codes` ; pour chaque rétrocession à taux connu : `partRemplacante + partTitulaire = |solde|`, deux entiers ≥ 0 ; tous les montants entiers.

**Critères d'acceptation** : scénarios A à F du §5.2 exacts ; invariants vrais sur chacun ; déterminisme (deux appels → même résultat) ; `npm run build` réussit.

### T4 — Schéma Mermaid

**Objectif** : dessiner le chemin de l'argent, sans ouvrir de faille ni alourdir le chargement initial.

**Fichiers** :
- `package.json` (**modifier**) — `"mermaid": "<version exacte>"` (sans `^`) : la **dernière 11.x publiée avant le 2026-10-07** (plus de 2 semaines), vérifiée par `npm view mermaid time --json` ; `npm install`. Vérifier `npm audit` pour cette version.
- `docs/adr/0022-mermaid-schema-flux.md` (**créer**, gabarit `0000-modele-adr.md`, sur le modèle de l'ADR 0019) :
  - Contexte : les infirmières lisent mal une liste de montants ; besoin d'un schéma (règle 12 : dépendance justifiée).
  - Décision : `mermaid` version exacte (n° + date de publication) ; **import dynamique** `import('mermaid')` dans un seul adaptateur, uniquement depuis l'écran Feuille de route ; configuration `startOnLoad: false`, `securityLevel: 'strict'`, `htmlLabels: false` (racine **et** `flowchart.htmlLabels: false`), `suppressErrorRendering: true`, liste `secure` par défaut conservée ; texte généré **uniquement** par le module pur `schemaFlux.js` (libellés échappés, couleurs en liste blanche `#RRGGBB`) ; **seule insertion de SVG brut de l'application** (`innerHTML` sur un conteneur dédié), réservée à la sortie de `mermaid.render` — exception explicite à la règle « jamais de `v-html` ».
  - Conséquences : chunks séparés (taille relevée au build), réseau requis au premier usage (même limite que pdf.js), suivi des alertes de sécurité, texte en clair toujours affiché comme équivalent.
  - Alternatives : SVG dessiné à la main (mise en page des flèches coûteuse), D3 / bibliothèque de graphes (plus lourd, plus bas niveau), texte seul (moins lisible pour le public), image générée côté serveur (contraire à l'ADR 0002).
- `src/domain/feuilleDeRoute/schemaFlux.js` (**créer**) — module pur, imports relatifs (`../utils/montants.js`, `../utils/couleurs.js`).

```js
/**
 * Échappe un texte pour un libellé Mermaid entre guillemets, en une seule passe
 * (pas de double échappement) : " → #quot;  < → #lt;  > → #gt;  # → #35;  ; → #59;
 * ` → #96;  | → #124; ; caractères de contrôle et retours à la ligne → espace ;
 * espaces multiples réduits ; coupé à 60 caractères.
 * @param {string} texte
 * @returns {string}
 */
export function echapperLibelleMermaid(texte) { /* texte.replace(/["<>#;`|]/g, (c) => TABLE[c]) … */ }

/**
 * Texte Mermaid `flowchart LR` du chemin de l'argent, ou null s'il n'y a ni virement
 * ni rétrocession.
 * @param {import('./fluxComptes.js').FluxComptes} flux
 * @param {Map<string, string>} libelles      // libellesFlux(flux)
 * @returns {(string|null)}
 */
export function definitionSchemaFlux(flux, libelles) { /* … */ }
```

Règles de `definitionSchemaFlux` :
- **Nœuds** dans l'ordre : comptes de `flux.comptes` qui participent à un virement ou à une rétrocession, puis remplaçantes des rétrocessions (sans doublon). Id techniques `n0`, `n1`… (jamais de GUID dans le texte). Comptes (titulaires, comptes non reliés) : rectangle `nX["…"]` ; remplaçantes : bords arrondis `nX("…")`. Libellé = `echapperLibelleMermaid(libelles.get(cle))`.
- **Arêtes** : virements d'abord, `nA -->|"20,00 €"| nB` ; puis rétrocessions : `RECOIT` → `nT -->|"17,80 € (89 %)"| nR` ; `PAIE` → `nT -.->|"−8,54 € sur sa rétrocession"| nR` ; taux inconnu → `"4,00 € (taux à renseigner)"` (`-->` si RECOIT, `-.->` si PAIE). Montants via `formaterEuros(valeur absolue)`, signe `−` (U+2212) ajouté par le module ; pourcentage `${100 − taux}` + espace insécable + `%`.
- **Couleurs** : `style nX fill:<couleur>,color:<#fff si estCouleurFoncee sinon #212529>,stroke:#212529` **seulement** si la couleur vérifie `/^#[0-9A-Fa-f]{6}$/` ; sinon aucune ligne `style` (couleurs du thème). Aucune autre donnée ne sort du texte d'un libellé.
- Facultatif (à vérifier sur la version retenue) : `accTitle: Chemin de l'argent sur la période` en 2ᵉ ligne.

- `src/adaptateurs/dessinerSchemaMermaid.js` (**créer**) :

```js
/**
 * Dessine une définition Mermaid en SVG (texte). Charge mermaid à la demande (une seule fois)
 * et l'initialise avec la configuration durcie de l'ADR 0022 (thème 'neutral',
 * fontFamily alignée sur les tokens).
 * @param {string} definition   // produite par definitionSchemaFlux
 * @returns {Promise<string>}   // SVG
 * @throws {Error}              // chargement ou rendu impossible
 */
export async function dessinerSchemaMermaid(definition) { /* mermaid.render(`schema-flux-${genId()}`, definition) */ }
```

- `src/components/feuilleDeRoute/SchemaFlux.vue` (**créer**) — props : `definition` (`String`, défaut `null`), `legende` (`String`, requis). État local `etat: 'chargement' | 'pret' | 'erreur'`. `watch` `definition` (`immediate`) → `dessinerSchemaMermaid` ; un compteur de rendu ignore les réponses périmées et celles arrivées après le démontage. SVG inséré dans `<div ref="dessin" role="img" :aria-labelledby="idLegende">` par `innerHTML` (exception ADR 0022 : **uniquement** la chaîne renvoyée par l'adaptateur). Chargement : « Préparation du schéma… » ; erreur (`role="status"`) : « Le schéma n'a pas pu être affiché. Les mêmes informations sont écrites juste en dessous. » ; `definition === null` : rien. Styles `scoped` : SVG `max-width: 100%`, `height: auto` ; `@media print` : `break-inside: avoid`, visible.

**Critères d'acceptation** : scénario A → texte exactement conforme au §5.2 (comparaison en construisant les montants attendus avec `formaterEuros`) ; scénario F → `null` ; un nom `O"Brien; <b>#1</b>` donne un libellé qui vérifie `` /^(?:[^"<>#;`|]|#\w+;)*$/ `` (attendu exact : `O#quot;Brien#59; #lt;b#gt;#35;1#lt;/b#gt;`) et ne casse pas la définition ; une couleur `red;click n0 call x()` ne produit aucune ligne `style` ; aucun GUID dans le texte ; `npm run build` réussit avec mermaid dans des chunks **séparés** (chunk principal `index-*.js` de taille quasi inchangée par rapport au build précédent).

### T5 — Affichage du bilan

**Objectif** : remplacer « Virements à faire » par le schéma, les virements entre titulaires, les rétrocessions et les alertes.

**Fichiers** :
- `src/views/FeuilleDeRouteView.vue` (**modifier**) — import de `compteDuCode` et `calculerFlux` ; `computed` :
  ```js
  /** Flux d'argent entre comptes de titulaires (domaine pur, 0036). */
  flux() {
    return calculerFlux(this.bilan.lignes, (ps) => compteDuCode(ps, this.indexInfirmieres, this.toutesLesPersonnes));
  },
  ```
  `<BilanPeriode … :flux="flux" />` ; commentaire d'en-tête : « flux et rétrocessions (0036) calculés à la volée, jamais conservés ».
- `src/components/feuilleDeRoute/BilanPeriode.vue` (**modifier**) — prop `flux` (`Object`, requis, `FluxComptes`) ; `computed` `libelles` (`libellesFlux(flux)`), `definitionSchema` (`definitionSchemaFlux(flux, libelles)`) ; méthodes de présentation `nomCle(cle)`, `phraseVirement(v)`, `phraseRetrocession(r)`, `phraseAlerte(a)`, `lienFiche(a)` (§2.2 ; `estRelie`, `nomLong` existants pour le code entre parenthèses) ; remplacement du bloc « Virements à faire » (lignes 93-110 actuelles) par les 4 blocs du §2.2. Interpolation uniquement (aucun `v-html`) ; aucune somme ni arrondi dans le composant (seul `formaterEuros` et le choix du verbe selon `sens`). Le tableau par infirmière ne change pas.
- `docs/architecture/09-feuille-de-route-vega.md` (**modifier**) — chaîne de traitement (`fluxComptes` + `schemaFlux` + adaptateur Mermaid), section sécurité (SVG Mermaid, ADR 0022), liaison avec l'équipe (rôle de `titulaireId` et `tauxRetrocession`), historique (+ 0036, ADR 0022).
- `docs/architecture/06-structure-du-code.md` (**modifier**) — `schemaFlux.js`, `adaptateurs/dessinerSchemaMermaid.js`, `components/feuilleDeRoute/SchemaFlux.vue`.

**Critères d'acceptation** : parcours §10 « Feuille de route » ; aucun calcul dans les `.vue` ; aucun `v-html` ; mermaid absent du réseau tant qu'on n'a pas affiché un bilan ; `npm run build` réussit.

## 10. Critères d'acceptation

Fiche personne (T1) :
- [ ] Une remplaçante sans « Remplace en priorité » ou sans « Rétrocession » ne s'enregistre pas ; curseur et message sur le champ manquant.
- [ ] Une titulaire s'enregistre comme avant.
- [ ] Sans titulaire active, la phrase d'aide explique le blocage.
- [ ] `/equipe?modifier=<id>&champ=remplacement` ouvre la fiche curseur dans « Remplace en priorité » ; sans `champ`, curseur dans l'e-mail (0027 inchangé).

Feuille de route (T5), avec `files/idelia-sermet.json` : Farah CHABANI (FC) rattachée à Emmanuelle SERMET à 11 %, Céline CUER (CB) rattachée à Sandrine OPPER à 15 %, puis dépôt d'un PDF Vega :
- [ ] L'onglet Bilan montre, sous le tableau inchangé : le schéma, « Virements entre titulaires », « Rétrocession aux remplaçantes », puis les alertes s'il y en a.
- [ ] Aucun virement n'est proposé entre une remplaçante rattachée et sa titulaire, ni d'une remplaçante rattachée vers qui que ce soit : les virements ne relient que des titulaires (ou des comptes signalés en alerte).
- [ ] Pour chaque titulaire, le montant net de ses virements = somme des « Doit reverser » / « Doit recevoir » du tableau pour son code et ceux de ses remplaçantes (vérifiable à la main).
- [ ] Une rétrocession « reverse X € … (elle garde Y €, taux T %) » vérifie X + Y = la somme « Doit recevoir » de la remplaçante dans le tableau, X ≈ (100 − T) % de cette somme ; même contrôle pour « retire … (elle prend … à sa charge) » avec « Doit reverser ».
- [ ] Une remplaçante sans titulaire (Leslie RANCEL si elle apparaît dans le PDF) ou sans taux (Danielle OULGIMA) est signalée, avec un lien qui ouvre sa fiche au bon champ ; un code non relié est signalé avec un lien vers Équipe.
- [ ] Le schéma a une flèche pleine par virement et par rétrocession reçue, en pointillé pour une rétrocession diminuée ; couleurs de repère des personnes ; libellés lisibles.
- [ ] Aperçu d'impression (bouton ou Ctrl+P depuis chaque onglet) : tableau, schéma, listes et alertes ; aucun nom de patient.
- [ ] Hors ligne avant tout premier affichage du schéma : message « Le schéma n'a pas pu être affiché… », listes texte complètes.
- [ ] `localStorage` et sauvegarde exportée : rien de nouveau après une analyse.
- [ ] `npm run build` réussit, mermaid dans des chunks séparés.

## 11. Vérification

1. **Script `.mjs` jetable** dans le dossier temporaire de session (**jamais dans le dépôt**), exécuté par Node : importe par chemin absolu `relierInfirmieres.js`, `fluxComptes.js`, `schemaFlux.js` ; construit le jeu §5.2 (GUID fictifs) et les scénarios A à F ; contrôle `compteDuCode` (T2), les valeurs exactes et les invariants (T3), le texte Mermaid du scénario A, `null` pour F, l'échappement de `O"Brien; <b>#1</b>` et le rejet de la couleur `red;click n0 call x()` (T4). Supprimé après usage.
2. `npm run build` : réussite ; relever les chunks mermaid et la taille du chunk principal avant / après.
3. **Recette navigateur** (Playwright, `http://localhost:5199/idelia/`, `files/idelia-sermet.json`) : fiche Farah (11 %, Emmanuelle) et Céline (15 %, Sandrine) ; tentative d'enregistrement d'une remplaçante sans titulaire ni taux (refus) ; lien profond `champ=remplacement` ; import du PDF Vega ; contrôle des critères §10 ; aperçu d'impression ; onglet Réseau : mermaid chargé seulement à l'affichage du bilan.
4. Clavier seul : liens d'alerte atteignables, focus visible ; lecteur d'écran : la légende du schéma est annoncée.
5. Largeur ≈ 375 px : schéma réduit sans débordement, listes lisibles.
6. Relecture `ui-ux` (phrases d'argent, sens « PAIE », place des alertes, aide du taux, schéma), puis audit `security` (nouvelle dépendance et version, configuration Mermaid, échappement des noms, liste blanche des couleurs, `innerHTML` limité à la sortie de `mermaid.render`, paramètre `champ` en liste blanche, aucune donnée patient).

## 12. Décisions à confirmer / risques

1. **Taux non renseigné (`SANS_TAUX`)** — motif ajouté au plan validé : la migration v10 met `tauxRetrocession` à `null` pour toutes les remplaçantes existantes, ce sera donc le cas le plus fréquent au début. Choix proposé : l'argent va bien au compte de la titulaire (décision « titulaire de référence = `titulaireId` »), la rétrocession est listée **sans montant** (« taux à renseigner ») et une alerte mène à la fiche. Alternative écartée : taux 0 implicite (résultat faux en silence).
2. **Rattachement à une personne archivée ou devenue titulaire, ou à une remplaçante** : on suit `titulaireId` tel quel, sur un seul niveau (KISS). Une remplaçante rattachée à une autre remplaçante crée un compte au nom de cette dernière.
3. **Arrondi** : `Math.round` arrondit le demi-centime au profit de la remplaçante ; la titulaire absorbe l'écart (somme toujours juste). À confirmer par le porteur.
4. **Solde nul d'une remplaçante** : aucune ligne de rétrocession (rien à ajuster).
5. **Lien profond `champ=remplacement`** : petite extension du mécanisme 0027 (liste blanche, une valeur). Les personnes archivées ne sont pas ouvrables par ce lien : lien simple vers Équipe.
6. **Détail par patient (`ListeRelais`)** : reste code à code (« FC reverse … à EMM »), ce qui peut sembler contredire le bilan. La phrase de renvoi existante pointe vers le bilan, qui fait foi ; une harmonisation éventuelle serait une autre feature.
7. **`bilan.virements`** (0035) est toujours calculé par `calculerBilan` (inchangé par décision) mais n'est plus affiché.
8. **`CODE_INCONNU`** apparaît aussi dans l'encart existant au-dessus des onglets : doublon assumé (l'alerte du bilan part à l'impression et explique l'effet sur les virements). `ui-ux` peut proposer de le retirer de l'un des deux.
9. **Sécurité** : première insertion de HTML/SVG brut de l'application (`innerHTML` du SVG Mermaid). Défense en profondeur : texte entièrement généré par le domaine, libellés échappés, couleurs en liste blanche, `securityLevel: 'strict'`, `htmlLabels: false`, aucune donnée patient. À acter dans l'ADR 0022 et à faire auditer.
10. **Poids et réseau** : mermaid est lourd ; chargé à la demande, il exige le réseau au premier affichage (comme pdf.js). Le texte reste l'équivalent complet.
11. **Homonymes** : deux personnes de même prénom et nom auraient le même libellé (risque jugé négligeable).
12. **Ordre des blocs** (schéma, virements, rétrocessions, alertes) : repris du plan validé ; si `ui-ux` juge les alertes trop basses, les remonter au-dessus du schéma ne change que le gabarit.

## 9. Corrections après relecture ui-ux et audit sécurité (libellés finaux)

Ces points remplacent les libellés du §4 lorsqu'ils diffèrent.

**Écran « Bilan de la période »** — ordre : tableau, « Virements entre titulaires », schéma, section reversement, alertes.
- Virements : « Personne n'a de virement à faire : chaque titulaire a déjà reçu sa part. » quand il n'y en a pas.
- Schéma : légende « Schéma qui résume les virements. Flèche pleine : somme à virer ou à ajouter. Flèche en pointillé : somme à déduire. Toutes les sommes sont aussi écrites en dessous. » (taille et couleur de texte standard). Libellés d'arête : plein « + 17,80 € (taux 11 %) » ; pointillé « à déduire : 8,54 € » ; taux inconnu : « (taux à renseigner) ». Sur petit écran, le SVG garde 480 px minimum dans un conteneur à défilement horizontal ; hauteur réservée pendant le chargement.
- Section « À ajouter ou retirer sur le reversement habituel aux remplaçantes » (le mot « rétrocession » n'est plus employé pour la somme reversée ; « taux de rétrocession X % » reste) : « Ces sommes ne sont pas des virements en plus. Elles se calculent sur le montant que la titulaire verse déjà à sa remplaçante pour cette période. » Une ligne par remplaçante, nom de la remplaçante en gras :
  - RECOIT : « Emmanuelle SERMET ajoute 17,80 € à ce qu'elle reverse à **Farah CHABANI**. Elle garde 2,20 € (taux 11 %). »
  - PAIE : « **Céline CUER** a encaissé trop : Sandrine OPPER déduit 8,54 € de ce qu'elle lui reverse. Sandrine OPPER garde la différence à sa charge : 1,51 € (taux 15 %). »
  - Sans taux : même début, puis « Le taux n'est pas renseigné : complétez sa fiche pour obtenir la somme exacte. »
- Alertes : titre « À corriger dans l'onglet Équipe » ; mise en garde « Ce résultat sera perdu en quittant cette page : il faudra redéposer le fichier. » placée **avant** la liste, sans doublon dans l'encart bleu ; plus de mot « compte » : « Le code Vega XY n'est relié à personne de l'équipe : ses sommes sont comptées à part. » + lien « Relier ce code dans Équipe » ; lien de fiche « Compléter la fiche » avec `aria-label` « Compléter la fiche de Prénom NOM ».
- Encart bleu au-dessus des onglets : allégé (codes non reliés + lien « Les relier dans Équipe »).

**Onglet « Détail par patient »** : encart `alert-info` (icône Phosphor) en tête : « Ce détail sert à comprendre chaque cas. Ne faites pas ces virements : les sommes à virer sont dans l'onglet « Bilan de la période ». » Cartes : « Part de FC (Claire) à rendre à CB (Sandrine) : 10,05 € » (non impératif, sans gras).

**Sécurité** : `echapperLibelleMermaid` échappe aussi `$` en `#36;` (ferme la surface KaTeX : `$$x$$` n'atteint plus le rendu mathématique) et supprime les caractères `\p{Cf}` (contrôles bidi, largeur nulle). Import : `tauxRetrocession` validé en `entier` 0..100. La compatibilité CSP (`style-src 'self'` et `<style>` du SVG Mermaid) reste à vérifier en recette sur `vite preview`.
