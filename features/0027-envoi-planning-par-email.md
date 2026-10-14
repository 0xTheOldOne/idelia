# Feature 0027 — Envoi du planning par e-mail

- **Statut** : En cours (plan rédigé le 2026-10-14)
- **Dépend de** : `0004` (équipe : `Personne.contact.email` facultatif, `FormulairePersonne` avec validation Vuelidate `email`, `EquipeView`), `0012` (écran de diffusion `/planning/:id/diffusion` → `DiffusionView`, `titreDocumentDiffusion` = nom du PDF proposé, `dateMiseAJour` « date et heure »), tous deux livrés. S'appuie sur `0020` (l'e-mail reste **facultatif** dans la fiche, contrôlé **seulement au moment de l'envoi**), `0026` (`genereLe`, repris via `dateMiseAJour`), `0015` (`ModaleBase`).
- **ADR liés** : [0002](../docs/adr/0002-application-frontend-sans-backend.md) (aucun serveur d'envoi : on **prépare** le message dans la messagerie de l'utilisateur via un lien `mailto:`), [0009](../docs/adr/0009-workflow-referent-diffusion-lecture.md) (la référente diffuse en lecture ; l'e-mail transporte le PDF de `0012`), [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md) (**rien** n'est persisté), [0010](../docs/adr/0010-conventions-dates-et-jours-iso.md) (dates via `dateUtil`), [0011](../docs/adr/0011-validation-vuelidate-vue-debounce.md) (aucune nouvelle saisie ; la fiche garde sa validation), [0013](../docs/adr/0013-icones-phosphor.md) (`PhEnvelopeSimple`, `PhCopy`), [0015](../docs/adr/0015-bootstrap-librairie-composants-scss.md) (modale via `ModaleBase`, **aucun nouveau module Bootstrap**), [0016](../docs/adr/0016-router-mode-hash-pour-pages.md) (paramètres de requête sur routes existantes). **Aucun écart d'ADR, aucun nouvel ADR.**

## 1. Contexte & objectif

Après avoir imprimé le planning en PDF (`0012`), la référente l'envoie aujourd'hui à la main : nouveau message, recherche de chaque adresse, objet à taper. Sans backend (règle d'or n° 1), Idelia ne peut pas envoyer d'e-mail elle-même, mais elle peut **préparer le message** : un lien `mailto:` ouvre la messagerie de l'utilisatrice avec les adresses de l'équipe, l'objet et un court texte déjà remplis. Il ne reste qu'à **joindre le PDF** et cliquer sur « Envoyer ».

`0027` ajoute, sur l'écran de diffusion, un bouton « Envoyer le planning par e-mail » qui ouvre une fenêtre d'explication : à qui le message partira, les 3 étapes (PDF → messagerie → pièce jointe), le bouton « Ouvrir ma messagerie » et un repli « Copier les adresses » pour les messageries en ligne. Tant qu'une personne active n'a pas d'adresse valide, l'envoi est **bloqué** et la même fenêtre liste les personnes à compléter, avec un lien direct vers leur fiche.

**Hors périmètre** : envoi réel (serveur SMTP, service tiers) ; pièce jointe automatique (impossible avec `mailto:`) ; génération d'un PDF par une bibliothèque (exclue par `0012`) ; mémoriser un « dernier envoi » (§12 n° 8) ; envoi individualisé (une personne = son planning) ; statut `PUBLIE` / `publieLe` (toujours hors périmètre, cf. `0012` §12 n° 1).

## 2. Écrans concernés

| Route | Écran | Changement |
|---|---|---|
| `/planning/:id/diffusion` | **Diffusion** → `DiffusionView.vue` | Titre « Imprimer ou envoyer le planning » ; bouton icône **Envoyer par e-mail** à gauche de « Imprimer » ; texte d'explication complété ; modale d'envoi ; réouverture automatique de la modale au retour de l'Équipe (`?envoi=1`). |
| `/planning` | **Planning** → `PlanningView.vue` | Le bouton icône imprimante devient « Imprimer ou envoyer le planning » (infobulle + `aria-label`), même destination. |
| `/equipe` | **Équipe** → `EquipeView.vue` | Lien profond `?modifier=<id>` qui ouvre la fiche de la personne, curseur dans le champ e-mail ; `?retour=<planningId>` affiche « ← Retour à l'envoi du planning ». |

### 2.1 Expérience visée

**Écran de diffusion (barre d'outils, jamais imprimée)** :

```
← Retour au planning

Imprimer ou envoyer le planning                 [✉]  [ 🖨 Imprimer ]
Voici le planning tel qu'il sera imprimé. Pour obtenir un fichier PDF, cliquez sur
« Imprimer » puis choisissez « Enregistrer au format PDF ». Pour l'envoyer à l'équipe,
cliquez ensuite sur le bouton enveloppe (« Envoyer le planning par e-mail »), à gauche d'« Imprimer » : votre messagerie s'ouvre avec les adresses de l'équipe.
```

`[✉]` = bouton icône seule (`PhEnvelopeSimple`), infobulle et `aria-label` « Envoyer le planning par e-mail ». Le paragraphe d'explication en est l'équivalent texte (mobile, pas de survol).

**Clic sur l'enveloppe — cas « prêt »** (modale `ModaleEnvoiEmail`) :

```
┌ Envoyer le planning par e-mail ────────────────────────────────── ✕ ┐
│ Le message sera envoyé à 5 personnes, en copie cachée (chacune     │
│ reçoit le planning sans voir les adresses des autres) :            │
│ Zoé Blanc, Sophie Durand, Claire Martin, Marc Petit et Léa Roux.   │
│                                                                    │
│ 1. Enregistrez le planning en PDF si ce n'est pas déjà fait :      │
│    fermez cette fenêtre, cliquez sur « Imprimer », puis choisissez │
│    « Enregistrer au format PDF ». Le fichier s'appelle             │
│    « Idelia - Planning du 13-07-2026 au 30-08-2026.pdf ».          │
│ 2. Cliquez sur « Ouvrir ma messagerie » : un message prêt à partir │
│    s'ouvre (objet « Planning du 13/07/2026 au 30/08/2026 … »).     │
│ 3. Joignez le fichier PDF au message (trombone « Joindre »), puis  │
│    envoyez.                                                        │
│                                                                    │
│ ⓘ Rien ne s'ouvre, ou vous utilisez une messagerie en ligne       │
│   (Gmail, Orange, Outlook.com…) ? Cliquez sur « Copier les         │
│   adresses », puis collez-les dans le champ « Cci » d'un nouveau   │
│   message.                                                         │
│ (zone d'état : « 5 adresses copiées. Collez-les dans … »)          │
├────────────────────────────────────────────────────────────────────┤
│        [⧉ Copier les adresses]   [Fermer]   [✉ Ouvrir ma messagerie]│
└────────────────────────────────────────────────────────────────────┘
```

**Cas « bloqué »** (au moins une personne active sans adresse ou avec une adresse invalide) :

```
┌ Il manque des adresses e-mail ──────────────────────────────────── ✕ ┐
│ Pour envoyer le planning à toute l'équipe, chaque personne doit    │
│ avoir une adresse e-mail valide dans sa fiche. Complétez les       │
│ fiches ci-dessous, puis revenez ici.                               │
│                                                                    │
│ • Zoé Blanc — pas d'adresse e-mail            [Compléter la fiche] │
│ • Sophie Durand — pas d'adresse e-mail        [Compléter la fiche] │
│ • Marc Petit — adresse à corriger :                                │
│   « marc.petit@orange »                       [Corriger la fiche]  │
│                                                                    │
│ Les personnes archivées ne sont pas concernées.                    │
├────────────────────────────────────────────────────────────────────┤
│                                                          [Fermer]  │
└────────────────────────────────────────────────────────────────────┘
```

« Compléter la fiche » ferme la modale, ouvre l'Équipe sur la fiche de Sophie, curseur dans « Adresse e-mail ». En haut de l'Équipe : « ← Retour à l'envoi du planning » ramène à la diffusion **et rouvre la modale**, qui reflète l'état à jour (autre personne à compléter, ou prêt).

**Cas « aucune personne active »** (marginal) : « Il n'y a aucune personne active dans l'équipe : personne à qui envoyer le planning. » + lien « Aller à l'équipe ».

## 3. Modèle de données touché

**Aucun.** Pas de champ, pas de migration (`CURRENT_SCHEMA_VERSION` reste **6**), aucune écriture dans le store, aucune nouvelle clé de stockage.

Champs **lus** : `Personne.id` / `prenom` / `nom` / `actif` / `contact.email` ; `Planning.id` / `dateDebut` / `dateFin` / `genereLe` / `updatedAt`.

## 4. Store (Vuex)

**Aucun changement.** `DiffusionView` lit déjà `personnes.items` (toutes les personnes) et `plannings/byId`. `EquipeView` lit en plus `plannings/byId` (lien de retour). État volatil local aux composants : visibilité de la modale, message d'état de copie, navigation en attente.

## 5. Domaine (logique pure)

### 5.1 `src/domain/envoiEmail.js` (**créer**)

Module pur : aucun import Vue/Vuex, aucun accès stockage ni `window` / `navigator`. Imports autorisés : `@/domain/utils/dates.js` (`dateUtil.formatDateFr`), `@/domain/planning.js` (`dateMiseAJour`), `@/domain/diffusion.js` (`titreDocumentDiffusion`).

#### Constantes

```js
/** Longueur maximale d'une URL `mailto:` jugée sûre (limites des messageries / de Windows ≈ 2 000 caractères). */
export const LONGUEUR_MAX_MAILTO = 2000;
/** Séparateur des adresses dans l'URL `mailto:` (RFC 6068). Voir §12 n° 5 (Outlook). */
export const SEPARATEUR_ADRESSES_MAILTO = ',';
/** Séparateur des adresses copiées dans le presse-papiers (accepté par Outlook, Gmail, Orange…). */
export const SEPARATEUR_ADRESSES_COPIE = '; ';
```

#### Typedefs (JSDoc)

```js
/**
 * @typedef {Object} DestinataireEmail
 * @property {string} personneId
 * @property {string} nomComplet - « Prénom Nom ».
 * @property {string} email - Adresse nettoyée (espaces retirés).
 */
/**
 * @typedef {Object} PersonneSansEmail
 * @property {string} personneId
 * @property {string} nomComplet
 * @property {'ABSENTE'|'INVALIDE'} raison
 * @property {string} emailSaisi - Valeur actuelle nettoyée ('' si absente), affichée pour « adresse à corriger ».
 */
/**
 * @typedef {Object} EnvoiEmail
 * @property {'PRET'|'BLOQUE'|'AUCUNE_PERSONNE'} etat
 * @property {DestinataireEmail[]} destinataires - Personnes actives à adresse valide, triées nom puis prénom.
 * @property {PersonneSansEmail[]} sansEmail - Personnes actives bloquantes, même tri.
 * @property {string[]} adresses - Adresses dédupliquées (insensible à la casse), ordre des destinataires.
 * @property {string} adressesTexte - `adresses.join(SEPARATEUR_ADRESSES_COPIE)`.
 * @property {string} objet
 * @property {string} corps - Lignes séparées par "\r\n".
 * @property {string} url - `mailto:` complet (Cci + objet + corps) ; '' si `etat !== 'PRET'`.
 * @property {string} urlSansAdresses - `mailto:` objet + corps seulement (repli si trop long) ; '' si pas de planning.
 * @property {boolean} tropLong - `url.length > LONGUEUR_MAX_MAILTO`.
 * @property {string} nomFichierPdf - `titreDocumentDiffusion(planning) + '.pdf'`.
 */
```

#### Fonctions exportées

1. **`estEmailValide(valeur)`** → `boolean`. `typeof valeur === 'string'`, après `trim()` : longueur 3..254 et motif `^[^\s@,;<>()\[\]\\"]+@[^\s@,;<>()\[\]\\"]+\.[^\s@,;<>()\[\]\\".]{2,}$` (une seule `@`, un point dans le domaine, extension ≥ 2 caractères ; **aucun espace ni retour à la ligne, aucune virgule ni point-virgule** — ce sont les séparateurs d'adresses). Volontairement simple et un peu plus strict que Vuelidate sur des cas exotiques (adresses entre guillemets, IP littérales) : §12 n° 6.
2. **`analyserDestinataires(personnes)`** → `{ destinataires, sansEmail }`. Garde : non-tableau → listes vides ; éléments non objets ignorés. Personnes **actives** seulement (`p.actif !== false`, même règle que `personnes.js`). Tri `nom` puis `prenom` (`localeCompare('fr')`) puis `id`. Pour chacune : `email = String(p.contact?.email ?? '').trim()` ; vide → `sansEmail` `ABSENTE` ; `!estEmailValide(email)` → `sansEmail` `INVALIDE` avec `emailSaisi` ; sinon `destinataires`. `nomComplet` = `` `${prenom} ${nom}`.trim() ``, repli « Personne sans nom ».
3. **`objetEmail(planning)`** → `'Planning du 13/07/2026 au 30/08/2026 (mise à jour du 07/10/2026 à 14:32)'` ; la parenthèse n'apparaît que si `dateMiseAJour(planning)` n'est pas `null` (même date que l'en-tête du PDF, `0012`). Dates via `dateUtil.formatDateFr`. `''` si pas de planning.
4. **`corpsEmail(planning)`** → texte destiné **à l'équipe** (jamais d'instruction pour l'expéditrice), lignes jointes par `\r\n` :
   ```
   Bonjour,

   Vous trouverez en pièce jointe le planning du 13/07/2026 au 30/08/2026 (mise à jour du 07/10/2026 à 14:32).

   Bonne journée,
   ```
   **Aucune donnée de santé ni nominative** : uniquement la période et la date de mise à jour.
5. **`construireUrlMailto({ adresses = [], objet = '', corps = '' })`** → `string`. `'mailto:?'` + paramètres non vides joints par `&`, dans l'ordre `bcc`, `subject`, `body` :
   - `bcc=` + `adresses.map(a => encodeURIComponent(a).replace(/%40/g, '@')).join(SEPARATEUR_ADRESSES_MAILTO)` (le `@` reste lisible, autorisé dans une requête d'URL) ;
   - `subject=` + `encodeURIComponent(objet)` ; `body=` + `encodeURIComponent(corps)` (espaces → `%20`, jamais `+` ; `\r\n` → `%0D%0A`).
   L'encodage systématique neutralise toute injection de paramètre (`?`, `&`, `=`, `#`, `%` dans une adresse importée) ; les retours à la ligne et séparateurs sont déjà refusés par `estEmailValide`.
6. **`preparerEnvoiEmail({ planning, personnes })`** → `EnvoiEmail`. `etat` : `'AUCUNE_PERSONNE'` si aucune personne active ; `'BLOQUE'` si `sansEmail.length > 0` ; sinon `'PRET'`. `adresses` : dédupliquées par `toLowerCase()` (deux personnes partageant une adresse → une seule fois), casse de la première occurrence conservée. `url` / `tropLong` calculés seulement en `PRET`. `urlSansAdresses = construireUrlMailto({ objet, corps })`. Ne lève jamais (planning absent → `objet`, `corps`, URL et `nomFichierPdf` vides).

Aucun objet `Date` ; aucun `new Date()`.

### 5.2 Réutilisé, non modifié

`dateMiseAJour` (`planning.js`), `titreDocumentDiffusion` (`diffusion.js`), `dateUtil.formatDateFr`.

### 5.3 `src/adaptateurs/pressePapiers.js` (**créer**) — E/S navigateur

Le dossier `adaptateurs/` accueille déjà les E/S navigateur (`lireGlyphesPdf.js`) ; ce n'est **pas** de la persistance (ADR 0005 non concerné).

```js
/**
 * Copie un texte dans le presse-papiers (API Clipboard asynchrone). Exige un
 * contexte sécurisé (https — GitHub Pages — ou localhost) et un geste
 * utilisateur (appel direct depuis un clic). Ne lève jamais.
 * @param {string} texte
 * @returns {Promise<boolean>} `true` si copié ; `false` si API absente, contexte non sécurisé ou refus.
 */
export async function copierTexte(texte) { … }
```

Règles : `false` si `!window.isSecureContext || !navigator.clipboard?.writeText` ; sinon `try { await navigator.clipboard.writeText(texte); return true; } catch { return false; }`. **Pas** de repli `document.execCommand('copy')` (obsolète) : le repli est la sélection manuelle (§6.2).

## 6. Composants

### 6.1 `src/views/DiffusionView.vue` (**modifier**)

- `h1` : « Imprimer ou envoyer le planning ».
- Dans `.diffusion-entete`, regrouper à droite (`.diffusion-entete-actions`, `display: flex`, `gap: t.$espace-3`) : bouton **icône seule** `btn btn-outline-primary diffusion-bouton-icone` (`PhEnvelopeSimple` 20, `aria-hidden`), `aria-label="Envoyer le planning par e-mail"`, `title` = même texte, suffixé de « (adresses à compléter) » quand `envoi.etat === 'BLOQUE'` ; puis le bouton « Imprimer » existant (inchangé, toujours à l'extrême droite). Le bouton e-mail n'est **jamais désactivé** (§12 n° 3).
- `.diffusion-explication` : texte du §2.1 (équivalent texte de l'icône).
- `computed envoi()` → `preparerEnvoiEmail({ planning: this.planning, personnes: this.personnes })` (`personnes` = `personnes.items`, déjà mappé).
- `data` : `modaleEnvoiVisible: false`, `navigationEnAttente: null`.
- `<ModaleEnvoiEmail :visible="modaleEnvoiVisible" :envoi="envoi" @fermeture="onFermetureModaleEnvoi" @completer-fiche="onCompleterFiche" @aller-equipe="onAllerEquipe" />`, placé dans le `v-else` (planning trouvé).
- **Navigation depuis la modale** (piège Bootstrap) : ne **jamais** changer de route modale ouverte (le fond grisé `modal-backdrop` et `body.modal-open` resteraient). `onCompleterFiche(personneId)` mémorise `navigationEnAttente = { name: 'equipe', query: { modifier: personneId, retour: planning.id } }` puis `modaleEnvoiVisible = false` ; `onFermetureModaleEnvoi()` remet `modaleEnvoiVisible = false` puis, si `navigationEnAttente`, fait le `$router.push` et la remet à `null`. `onAllerEquipe` : idem avec `{ name: 'equipe' }`.
- **Retour de l'Équipe** : au `mounted`, si `$route.query.envoi === '1'` et planning trouvé → `modaleEnvoiVisible = true` puis `$router.replace({ query: {} })` (pas de réouverture au F5).
- Bloc JSDoc d'en-tête : paragraphe « Envoi par e-mail (0027) ».

### 6.2 `src/components/diffusion/ModaleEnvoiEmail.vue` (**créer**)

Composant de présentation au-dessus de `ModaleBase` (n'accède **pas** au store ni au routeur ; calculs tous faits par `preparerEnvoiEmail`).

- Props : `visible` (Boolean, requis), `envoi` (Object `EnvoiEmail`, requis). Émet : `fermeture`, `completer-fiche` (`personneId`), `aller-equipe`.
- `ModaleBase` : `titre` = « Envoyer le planning par e-mail » (`PRET`, `AUCUNE_PERSONNE`) ou « Il manque des adresses e-mail » (`BLOQUE`) ; `@fermeture` → réinitialise l'état local puis `$emit('fermeture')`.
- **`PRET`** : phrase « Le message sera envoyé à N personne(s), en copie cachée (… sans voir les adresses des autres) : » + noms (`destinataires.nomComplet`, liste française « A, B et C ») ; `<ol>` des 3 étapes du §2.1 (nom du fichier = `envoi.nomFichierPdf`, objet = `envoi.objet`) ; encart `alert alert-info` (icône `PhInfo`) « Rien ne s'ouvre… » ; si `envoi.tropLong` : encart `alert alert-warning` « Il y a trop d'adresses pour les remplir automatiquement. Cliquez sur « Copier les adresses », puis collez-les dans le champ « Cci » (copie cachée) du message. » (l'encart « Rien ne s'ouvre… » est alors masqué) ; zone d'état `<p role="status" aria-live="polite">` (message de copie).
  - Pied : `button.btn.btn-outline-secondary` **« Copier les adresses »** (`PhCopy`) ; `button.btn.btn-outline-secondary` « Fermer » (`data-bs-dismiss="modal"`) ; **lien** `a.btn.btn-primary.modale-envoi-ouvrir` **« Ouvrir ma messagerie »** (`PhEnvelopeSimple`), `:href="envoi.tropLong ? envoi.urlSansAdresses : envoi.url"`, sans `target`. Un vrai lien (et non `window.location`) : aucun JavaScript, vérifiable en recette par son attribut `href`. Au clic, état : « Si votre messagerie ne s'est pas ouverte, utilisez « Copier les adresses ». »
  - **Copier** : `const ok = await copierTexte(envoi.adressesTexte)` ; succès → « N adresse(s) copiée(s). Collez-les dans le champ « Cci » de votre message. » ; échec → « La copie automatique n'a pas fonctionné. Sélectionnez les adresses ci-dessous et copiez-les (Ctrl+C). » + `<textarea readonly class="form-control">` contenant `adressesTexte`, `aria-label="Adresses de l'équipe"`, focus + `select()` après `$nextTick`.
- **`BLOQUE`** : paragraphe d'explication ; `<ul>` des `sansEmail` : nom en gras, puis « pas d'adresse e-mail » (`ABSENTE`) ou « adresse à corriger : « … » » (`INVALIDE`, valeur affichée par **interpolation**, jamais `v-html`) ; bouton `btn btn-outline-primary btn-sm` « Compléter la fiche » / « Corriger la fiche » (`PhPencilSimple`), `aria-label` « Compléter la fiche de Sophie Durand », `@click="$emit('completer-fiche', p.personneId)"`. Mention « Les personnes archivées ne sont pas concernées. » Pied : « Fermer » seul. **Aucun** bouton « Ouvrir ma messagerie » ni « Copier » (envoi impossible).
- **`AUCUNE_PERSONNE`** : phrase + bouton « Aller à l'équipe » (`PhUsers`) → `$emit('aller-equipe')`. Pied : « Fermer ».
- `watch visible` : à l'ouverture, réinitialiser le message d'état et masquer la zone de sélection manuelle.
- Styles scoped, tokens uniquement : liste des personnes à compléter (`display: flex`, `flex-wrap: wrap`, `gap: t.$espace-2`, bouton poussé à droite), boutons ≥ `t.$cible-cliquable-min`, `textarea` hauteur ~3 lignes.

### 6.3 `src/views/PlanningView.vue` (**modifier**)

Le `router-link` icône imprimante : `aria-label` et `title` → « Imprimer ou envoyer le planning ». Commentaire JSDoc « Impression (feature 0012) » complété d'une mention `0027`. Rien d'autre.

### 6.4 `src/views/EquipeView.vue` (**modifier**)

- `data` : `champInitial: 'prenom'`.
- `ouvrirAjout` / `ouvrirEdition` : remettre `champInitial = 'prenom'` (comportement actuel inchangé).
- **Lien profond** : méthode `ouvrirDepuisLien()`, appelée au `mounted` et par un `watch` sur `$route.query.modifier` : `id = $route.query.modifier` ; personne = `actifs.find(p => p.id === id)` ; si trouvée → `personneEnCours = personne`, `champInitial = 'email'`, `formulaireVisible = true` ; dans tous les cas, si `modifier` est présent, `$router.replace({ query: { ...$route.query, modifier: undefined } })` (pas de réouverture au F5). Id inconnu / archivé → rien (silencieux).
- **Lien de retour** : `computed planningRetour` = `plannings/byId($route.query.retour)` ; si défini, au-dessus de `.equipe-entete`, `router-link` `.equipe-retour` « Retour à l'envoi du planning » (`PhArrowLeft`) → `{ name: 'diffusion', params: { id }, query: { envoi: '1' } }`. Style calqué sur `.diffusion-retour` (souligné, couleur primaire, focus visible).
- Passer `:champ-initial="champInitial"` à `FormulairePersonne`.

### 6.5 `src/components/equipe/FormulairePersonne.vue` (**modifier**)

- Prop `champInitial: { type: String, default: 'prenom' }` (`'prenom' | 'email'`).
- `onAffichee()` : si `'email'` → focus `#personne-email` (`this.$el.querySelector` comme `focusPremierChampErrone`) et `v$.formulaire.contact.email.$touch()` (une adresse invalide affiche **aussitôt** son message ; un champ vide reste sans erreur : il est facultatif) ; sinon comportement actuel (prénom).
- Sous le champ e-mail, aide permanente `<p id="personne-email-aide" class="form-text">` : « Facultatif. Nécessaire pour recevoir le planning par e-mail. » ; `aria-describedby` = aide, + id d'erreur s'il y en a une.

### 6.6 Réutilisé tel quel

`ModaleBase` (focus piégé, Échap, retour du focus), store `plannings` / `personnes`, `titreDocumentDiffusion`, `dateMiseAJour`, routes existantes (aucune nouvelle route).

## 7. Règles de validation

Aucune nouvelle saisie. Le champ e-mail de la fiche garde sa règle Vuelidate (`email`, facultatif, message « Saisissez une adresse e-mail valide (ex. nom@exemple.fr). »). Au moment de l'envoi, `estEmailValide` (domaine) contrôle **toutes** les adresses des personnes actives, y compris celles venues d'une sauvegarde importée : **adresse invalide = bloquante**, signalée « adresse à corriger » (distincte de « pas d'adresse ») — §12 n° 6.

## 8. Points d'attention ergonomie

- **Vocabulaire** : « Envoyer le planning par e-mail », « Ouvrir ma messagerie », « Copier les adresses », « Compléter la fiche », « copie cachée (Cci) ». Jamais « mailto », « client de messagerie », « URL », « presse-papiers ».
- **Jamais un bouton désactivé muet** : l'enveloppe reste cliquable et explique pourquoi l'envoi est impossible et **quoi faire** (liens directs vers les fiches).
- **Une étape à la fois, dans l'ordre** : la modale rappelle que la pièce jointe n'est pas automatique, et le nom exact du fichier PDF pour le retrouver dans « Téléchargements ».
- **Repli toujours visible** pour les messageries en ligne (cas fréquent chez les non-informaticiens sans logiciel de messagerie configuré).
- **Boucle courte** : fiche complétée → « Retour à l'envoi du planning » → modale rouverte à jour.
- **Aucune instruction dans le corps du message** : rien à effacer avant d'envoyer, rien d'embarrassant ne part par erreur.
- **Accessibilité** : bouton icône avec `aria-label` + `title` ; équivalent texte dans le paragraphe d'explication ; zone d'état `role="status"` pour la copie ; `aria-label` explicite sur chaque « Compléter la fiche » (nom de la personne) ; focus rendu au déclencheur par `ModaleBase` ; cibles ≥ 44 px.
- **À arbitrer par `ui-ux`** : icône seule vs libellé pour l'enveloppe (§12 n° 1) ; ordre des boutons (enveloppe avant « Imprimer ») ; lisibilité de la liste des destinataires pour une grande équipe.

## 9. Étapes d'implémentation

**3 tâches, une par sous-agent `dev-front`** ([workflow](../docs/instructions/workflow-implementation.md)). **T1 et T2 en parallèle** (fichiers disjoints, contrats figés §5.1 et §6.4-6.5) ; **T3 après T1 et T2**.

```
T1 (domaine) ──┐
               ├── T3 (modale, diffusion, planning)
T2 (équipe) ───┘
```

### Tâche 1 — Module pur `envoiEmail.js`

**Fichiers** :
- `src/domain/envoiEmail.js` (**créer**) — §5.1 (constantes, typedefs, 6 fonctions, JSDoc FR).
- `docs/architecture/06-structure-du-code.md` (**modifier**) — sous `domain/`, après `diffusion.js` : `envoiEmail.js  # destinataires, objet, corps et lien mailto: de l'envoi du planning par e-mail [0027]`.

**Critères de sortie** : script jetable §11.1 (dossier temporaire de session, **jamais dans le dépôt**) entièrement vert ; aucun import `vue` / `vuex` / `@/domain/scheduling`, aucun `window` / `navigator` / `new Date` dans le module ; `npm run build` réussit.

### Tâche 2 — Équipe : lien profond vers la fiche, aide sur l'e-mail

**Fichiers** :
- `src/views/EquipeView.vue` (**modifier**) — §6.4.
- `src/components/equipe/FormulairePersonne.vue` (**modifier**) — §6.5.

**Critères de sortie** (navigateur) : `/#/equipe?modifier=<id d'une personne active>` ouvre sa fiche, curseur dans « Adresse e-mail », l'URL ne contient plus `modifier` ; une adresse invalide affiche son erreur immédiatement ; id inconnu → rien ; `?retour=<id planning existant>` affiche le lien de retour (absent sinon, et pour un id inconnu) ; « Ajouter une personne » et « Modifier » gardent le focus sur le prénom ; aide « Nécessaire pour recevoir le planning par e-mail » visible ; `npm run build` réussit.

### Tâche 3 — Modale d'envoi, écran de diffusion, libellé du planning

**Dépend de** : T1, T2.

**Fichiers** :
- `src/adaptateurs/pressePapiers.js` (**créer**) — §5.3.
- `src/components/diffusion/ModaleEnvoiEmail.vue` (**créer**) — §6.2.
- `src/views/DiffusionView.vue` (**modifier**) — §6.1.
- `src/views/PlanningView.vue` (**modifier**) — §6.3.
- `docs/architecture/06-structure-du-code.md` (**modifier**) — `adaptateurs/pressePapiers.js  # copie de texte (API Clipboard) [0027]` ; mention `modale d'envoi par e-mail [0027]` sur la ligne `components/diffusion/`.
- `docs/architecture/07-navigation-et-ecrans.md` (**modifier**) — ligne `/planning/:id/diffusion` : « Impression / export PDF, envoi par e-mail à l'équipe (messagerie de l'utilisatrice) | `0012`, `0027` ».

**Critères de sortie** : recette navigateur §11.2 ; `npm run build` réussit ; aucun `v-html` ; `ModaleEnvoiEmail` n'importe ni store ni routeur ; `package.json` inchangé.

## 10. Critères d'acceptation

**Domaine** (script jetable, §11.1)
- [x] Seules les personnes **actives** sont prises en compte ; une archivée sans e-mail ne bloque pas.
- [x] Personne active sans adresse → `ABSENTE` ; adresse mal formée (`marc.petit@orange`, `a b@x.fr`, `a@x.fr, b@y.fr`, `a@x.fr\nbcc:z@z.fr`) → `INVALIDE` ; l'envoi est `BLOQUE`.
- [x] Toutes les adresses valides → `PRET` ; adresses triées par nom puis prénom, dédupliquées sans tenir compte de la casse.
- [x] L'URL commence par `mailto:?bcc=`, contient les adresses avec `@` lisible, `subject=` et `body=` encodés (`%20`, `%0D%0A`, aucun `+`) ; une adresse contenant `&`, `?` ou `#` n'ajoute aucun paramètre (encodée `%26`, `%3F`, `%23`).
- [x] Objet « Planning du JJ/MM/AAAA au JJ/MM/AAAA (mise à jour du JJ/MM/AAAA à HH:mm) », sans parenthèse si aucune date ; corps sans nom de personne ni donnée de santé.
- [x] Au-delà de 2 000 caractères : `tropLong` vrai, `urlSansAdresses` ne contient pas `bcc=`.
- [x] Entrées vides / `null` / planning absent : aucune exception.

**Écrans** (navigateur, §11.2)
- [x] Écran de diffusion : titre « Imprimer ou envoyer le planning », enveloppe à gauche d'« Imprimer », infobulle « Envoyer le planning par e-mail », texte d'explication mentionnant l'enveloppe ; rien de tout cela à l'impression.
- [x] Planning : l'icône imprimante a pour infobulle « Imprimer ou envoyer le planning » et mène à l'écran de diffusion.
- [x] Équipe incomplète : clic sur l'enveloppe → « Il manque des adresses e-mail » listant chaque personne active concernée avec la bonne raison ; aucun moyen d'ouvrir la messagerie depuis cette fenêtre.
- [x] « Compléter la fiche » : la fenêtre se ferme proprement (plus de fond grisé), l'Équipe s'ouvre sur la fiche de la personne, curseur dans « Adresse e-mail » ; une adresse invalide y est déjà signalée.
- [x] Après enregistrement, « Retour à l'envoi du planning » ramène à la diffusion **et rouvre** la fenêtre d'envoi, à jour.
- [x] Équipe complète : la fenêtre liste les destinataires, les 3 étapes avec le nom exact du fichier PDF ; « Ouvrir ma messagerie » est un lien dont le `href` est l'URL attendue (Cci = adresses de l'équipe, objet, corps).
- [x] « Copier les adresses » copie `adresse1; adresse2; …` et l'annonce ; en cas d'échec de la copie, les adresses s'affichent sélectionnées avec la consigne Ctrl+C.
- [x] Équipe très nombreuse (URL trop longue) : avertissement visible, le lien n'embarque plus les adresses, la copie reste possible.
- [x] Clavier seul : enveloppe, boutons de la fenêtre, Échap ; le focus revient à l'enveloppe à la fermeture.
- [x] Aucune donnée modifiée (export JSON identique avant / après), aucune nouvelle clé de stockage, `schemaVersion` 6 ; aucune requête réseau ; `npm run build` réussit.

## 11. Vérification

### 11.1 Script jetable (T1)

Dans le dossier temporaire de session, **jamais dans le dépôt** : serveur Vite (`createServer` depuis `node_modules/vite`, `root` = projet, `server.middlewareMode: true`), `ssrLoadModule('/src/domain/envoiEmail.js')`, assertions, puis fermeture du serveur et suppression du script.

**Jeu d'essai** (ids **GUID** via `crypto.randomUUID()`, adresses fictives en `example.org`) :

| Personne | Statut | `actif` | `contact.email` |
|---|---|---|---|
| Claire Martin | Titulaire | oui | `claire.martin@example.org` |
| Sophie Durand | Titulaire | oui | `null` |
| Marc Petit | Titulaire | oui | `marc.petit@orange` (invalide) |
| Léa Roux | Remplaçante (`titulaireId` = Claire) | oui | `  Lea.Roux@Example.org ` (espaces, majuscules) |
| Zoé Blanc | Remplaçante | oui | `''` |
| Anne Vidal | Titulaire | **non** (archivée) | `null` |

Planning : `dateDebut '2026-07-13'`, `dateFin '2026-08-30'`, `genereLe = updatedAt = '2026-10-07T12:32:00.000Z'`.

- **S1 — bloqué** : `etat === 'BLOQUE'` ; `sansEmail` = Blanc (`ABSENTE`), Durand (`ABSENTE`), Petit (`INVALIDE`, `emailSaisi 'marc.petit@orange'`) dans cet ordre (tri par nom) ; Anne Vidal absente des deux listes ; `url === ''`.
- **S2 — prêt** : Sophie → `sophie.durand@example.org`, Marc → `marc.petit@example.org`, Zoé → `zoe.blanc@example.org` ; `etat === 'PRET'`, 5 destinataires (Blanc, Durand, Martin, Petit, Roux), adresse de Léa nettoyée `Lea.Roux@Example.org` ; `adressesTexte` séparé par `'; '` ; `url` commence par `mailto:?bcc=zoe.blanc@example.org,sophie.durand@example.org,` ; contient `&subject=Planning%20du%2013%2F07%2F2026%20au%2030%2F08%2F2026` et `%0D%0A` ; ne contient ni `+` ni espace.
- **S3 — doublon** : Zoé reçoit `CLAIRE.MARTIN@example.org` → 5 destinataires, 4 adresses.
- **S4 — injection** : Zoé `zoe&cc=pirate@example.org` (valide au sens du motif) → l'URL contient `zoe%26cc%3Dpirate@example.org`, **aucun** `&cc=` et **un seul** `&subject=` ; Zoé `zoe@example.org\r\nbcc: x@y.fr` → `INVALIDE`.
- **S5 — objet / corps** : objet exact `Planning du 13/07/2026 au 30/08/2026 (mise à jour du 07/10/2026 à 14:32)` (heure de Paris) ; planning sans `genereLe` ni `updatedAt` → `Planning du 13/07/2026 au 30/08/2026` ; le corps ne contient aucun prénom de l'équipe ; `nomFichierPdf === 'Idelia - Planning du 13-07-2026 au 30-08-2026.pdf'`.
- **S6 — trop long** : 80 personnes actives générées (`personne.n@cabinet-infirmier-example.org`) → `tropLong === true`, `urlSansAdresses` sans `bcc=`.
- **S7 — aucune personne / robustesse** : seulement Anne Vidal → `AUCUNE_PERSONNE` ; `preparerEnvoiEmail({ planning: null, personnes: null })`, `analyserDestinataires(undefined)`, `estEmailValide(42)` → aucune exception.
- **S8 — `estEmailValide`** : vrai pour `a@b.fr`, `prenom.nom+cabinet@example.org` ; faux pour `''`, `'a@b'`, `'a@@b.fr'`, `'a b@c.fr'`, `'a@b.fr;c@d.fr'`, `'a@b.f'`.

### 11.2 Recette navigateur (T2 puis T3)

1. `npx vite --port 5199 --strictPort` → http://localhost:5199/idelia/#/ ; injecter le jeu d'essai §11.1 (S1, `SaveDocument` `schemaVersion` 6 fabriqué dans le dossier temporaire de session) via Paramètres → « Restaurer », avec 1 tournée et un planning généré du 13/07 au 30/08/2026.
2. **Planning** : infobulle de l'imprimante « Imprimer ou envoyer le planning » → écran de diffusion.
3. **Diffusion** : titre, enveloppe, texte ; aperçu d'impression du navigateur : ni enveloppe ni texte.
4. **Bloqué** : enveloppe → liste Blanc / Durand / Petit et raisons. « Corriger la fiche » de Marc : plus de `.modal-backdrop` dans le DOM, `body` sans `modal-open`, fiche de Marc ouverte, focus dans `#personne-email`, erreur de format affichée. Corriger, enregistrer → « Retour à l'envoi du planning » → fenêtre rouverte, Marc n'y figure plus. Compléter Sophie et Zoé de la même façon.
5. **Prêt** : lire `href` de `a.modale-envoi-ouvrir` (un `mailto:` ne peut pas être suivi en recette automatisée : on vérifie l'URL construite) et le décoder (`decodeURIComponent`) : Cci, objet, corps attendus. Cliquer le lien ne doit pas quitter la page (vérifier l'URL de l'onglet).
6. **Copie** : Playwright — accorder `clipboard-read` / `clipboard-write`, cliquer « Copier les adresses », lire `navigator.clipboard.readText()` ; message d'état affiché. **Échec** : surcharger `navigator.clipboard.writeText = () => Promise.reject(new Error())` avant le clic → zone de texte sélectionnée + consigne Ctrl+C.
7. **Trop long** : injecter 80 personnes avec adresse (script de §11.1 S6) → avertissement, `href` sans `bcc=`.
8. **Clavier** : Tab jusqu'à l'enveloppe, Entrée, parcours des boutons, Échap → focus sur l'enveloppe.
9. **Données** : DevTools > Application : `localStorage['idelia:data']` identique hors fiches corrigées, aucune nouvelle clé ; onglet Réseau : aucune requête pendant l'envoi.
10. **Réel** (manuel, poste du cabinet) : cliquer « Ouvrir ma messagerie » avec la messagerie réellement utilisée (Outlook, Courrier Windows, Thunderbird, ou messagerie en ligne) ; vérifier la Cci, l'objet accentué, les retours à la ligne (§12 n° 5).
11. Relecture `ui-ux`, puis audit `security` (encodage `mailto:`, pas de `v-html`, aucune donnée de santé, presse-papiers en écriture seule).

## 12. Décisions à confirmer / risques

**Décisions prises (KISS, à valider par le porteur)**

1. **Emplacement : écran de diffusion uniquement**, bouton icône seule à gauche d'« Imprimer » ; l'imprimante du Planning devient « Imprimer ou envoyer le planning ». Raisons : l'envoi suit la création du PDF, qui se fait sur cet écran (étapes au même endroit) ; une seule implémentation ; barre du Planning déjà chargée (5 boutons). Icône seule conformément à la préférence du porteur (bouton secondaire d'en-tête), avec équivalent texte dans le paragraphe d'explication. *Alternative* : libellé « Envoyer par e-mail » visible, plus explicite pour la cible — à trancher par `ui-ux`.
2. **Destinataires : toutes les personnes actives** (titulaires et remplaçantes), et non les seules personnes affectées. Le planning concerne toute l'équipe (une remplaçante sans affectation doit savoir qu'elle n'est pas appelée, une titulaire doit voir qui la remplace) ; règle identique à celle de la roadmap (« tant que des personnes actives n'ont pas d'e-mail ») ; pas de surprise quand le planning change. Archivées exclues, même si elles figurent dans le planning (personne partie). *Limite connue* : `dateEntree` / `dateSortie` ne sont pas prises en compte (cohérent avec leur inertie actuelle, cf. `0031`).
3. **Blocage : bouton toujours actif + fenêtre d'information**, plutôt qu'un bouton désactivé : un bouton désactivé n'est ni focalisable ni lisible (son infobulle ne s'affiche pas toujours) et ne dit pas quoi faire ; la fenêtre explique, liste et mène à chaque fiche. L'infobulle signale en plus « (adresses à compléter) ».
4. **Copie cachée (Cci), sans choix** : les adresses (souvent personnelles, notamment celles des remplaçantes libérales) ne sont pas exposées aux autres destinataires (minimisation RGPD), et pas de « répondre à tous » involontaire. Le champ « À » reste vide : accepté par Outlook, Gmail, Thunderbird, Courrier ; la fenêtre explique « copie cachée ». *Alternative* : « À » (plus parlant, chacun voit qui a reçu) — une constante à changer dans `construireUrlMailto`.
5. **Séparateur d'adresses `,` dans le lien** (RFC 6068). *Risque* : certaines versions d'Outlook pour Windows n'acceptent que `;`. Constante `SEPARATEUR_ADRESSES_MAILTO` à basculer si la recette réelle (§11.2 étape 10) l'exige ; le repli « Copier les adresses » utilise déjà `; `, accepté partout.
6. **Adresse au format invalide = bloquante**, distinguée de « pas d'adresse » (« adresse à corriger »). Laisser partir un message avec une adresse fausse ferait croire que toute l'équipe est prévenue. Motif volontairement simple ; il peut refuser une adresse exotique acceptée par Vuelidate (entre guillemets, IP littérale) — improbable dans un cabinet ; si cela arrive, la fiche signale l'adresse sans erreur Vuelidate : à surveiller.
7. **Pas d'instruction dans le corps du message** (contrairement à la suggestion initiale) : un rappel « joignez le PDF » écrit dans le corps partirait chez toute l'équipe si l'expéditrice oublie de l'effacer. Le rappel (2-3 étapes + nom du fichier) est dans la fenêtre, avant d'ouvrir la messagerie ; le corps annonce « en pièce jointe », ce qui sert aussi d'aide-mémoire en relisant le brouillon.
8. **Rien n'est mémorisé** (ni « dernier envoi préparé le … », ni statut « Diffusé ») : on ne sait pas si le message est réellement parti (comme l'impression, `0012` §12 n° 1).
9. **Toujours passer par la fenêtre**, même quand tout est prêt (un clic de plus) : elle rappelle la pièce jointe, montre les destinataires et offre le repli de copie — indispensable quand aucune messagerie n'est configurée sur le poste (clic sans effet visible sinon).
10. **Lien profond Équipe** (`?modifier=`, `?retour=`, `?envoi=1`) plutôt qu'une édition dans la fenêtre d'envoi : Bootstrap ne gère pas les modales empilées ; la fiche complète reste l'unique lieu d'édition d'une personne.

**Risques**

- **Pas de messagerie configurée / messagerie en ligne** : le lien ne fait rien ou ouvre un logiciel non configuré. Parade : encart « Rien ne s'ouvre ? » + « Copier les adresses ».
- **Messagerie en ligne enregistrée comme gestionnaire `mailto:`** (Gmail dans Chrome) : le navigateur peut ouvrir la messagerie dans l'onglet courant ou un nouvel onglet selon sa configuration. Les données sont déjà enregistrées (persistance continue) ; à observer en recette réelle — si l'onglet Idelia est remplacé, ajouter `target="_blank" rel="noopener"` au lien.
- **Longueur d'URL** : ~2 000 caractères ≈ 50 adresses ; un cabinet en compte 5 à 15. Repli prévu (§6.2).
- **API Clipboard** : disponible en contexte sécurisé (GitHub Pages en https, `localhost` en dev) et sur geste utilisateur ; refus ou navigateur ancien → sélection manuelle prévue.
- **Accents dans l'objet** : encodés en UTF-8 (`encodeURIComponent`), bien gérés par les messageries actuelles ; à confirmer en recette réelle.
- **Navigation modale ouverte** : changer de route pendant que la modale Bootstrap est affichée laisserait le fond grisé ; d'où la navigation **après** l'événement `fermeture` (§6.1).
- **Aucun écart d'ADR** : aucun serveur ni service distant, aucune requête réseau (ADR 0002), rien de persisté (ADR 0005), logique dans `src/domain/` (règle d'or n° 10), aucune dépendance ni module Bootstrap ajoutés (ADR 0015). L'ADR 0009 mentionne la diffusion « par impression, export PDF ou partage » : l'envoi par e-mail en est le prolongement, sans modification nécessaire.

## 13. Retouches de recette (2026-10-14)

Après relecture `ui-ux` : étape 1 de la fenêtre « Si ce n'est pas déjà fait, enregistrez le planning en PDF : fermez cette fenêtre, cliquez sur « Imprimer », choisissez « Enregistrer au format PDF », puis revenez cliquer sur l'enveloppe. » ; « Cci » suivi de « (copie cachée) » ; message « trop d'adresses » reformulé et encart « Rien ne s'ouvre… » masqué dans ce cas ; explication de l'écran de diffusion qui nomme le bouton enveloppe. L'enveloppe reste en **icône seule** (préférence du porteur). Le motif d'adresse n'est pas restreint davantage : `encodeURIComponent` neutralise déjà toute tentative d'injection (audit `security`, point Faible).
