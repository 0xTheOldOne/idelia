# ADR 0022 — Schéma du chemin de l'argent avec `mermaid`, chargé à la demande

- **Statut** : Accepté
- **Date** : 2026-10-21
- **Décideurs** : porteur du produit

## Contexte

Le bilan de la feuille de route (features [0035](../../features/0035-bilan-reversements.md) et [0036](../../features/0036-retrocession-flux-bilan.md)) liste des virements et des rétrocessions. Les infirmières, peu à l'aise avec les chiffres, lisent mal une liste de montants : un **schéma** montrant qui vire à qui est bien plus parlant. Tout se passe dans le navigateur ([ADR 0002](0002-application-frontend-sans-backend.md)). Règle 12 (KISS) : une dépendance doit être justifiée ; ici, la mise en page automatique de flèches entre des nœuds est coûteuse à écrire à la main, et le schéma n'est qu'un complément du texte en toutes lettres affiché juste en dessous.

## Décision

Nous utilisons **`mermaid`** dans le navigateur, avec les contraintes suivantes :

- **version exacte** dans `package.json` (sans `^`) : **11.17.2** (publiée le 2026-08-25, dernière 11.x publiée plus de 2 semaines avant la décision). La montée de version est volontaire et contrôlée ;
- **chargement à la demande** : `import('mermaid')` dynamique, dans **un seul adaptateur** (`src/adaptateurs/dessinerSchemaMermaid.js`), uniquement depuis l'écran Feuille de route ; la bibliothèque est chargée et initialisée une seule fois ;
- **configuration durcie** : `startOnLoad: false`, `securityLevel: 'strict'`, `htmlLabels: false` (à la racine **et** dans `flowchart`), `suppressErrorRendering: true`, liste `secure` par défaut conservée, thème `neutral` ;
- **texte généré uniquement par le domaine** : le module pur `src/domain/feuilleDeRoute/schemaFlux.js` produit la définition. Les **libellés sont échappés** en une seule passe (`"` `<` `>` `#` `;` `` ` `` `|` remplacés par leurs entités Mermaid `#quot;`, `#lt;`…, retours à la ligne et caractères de contrôle en espace, 60 caractères maximum). Les **couleurs** sont en **liste blanche** `#RRGGBB` : toute autre valeur est ignorée (pas de ligne `style`). Les identifiants de nœuds (`n0`, `n1`…) sont techniques ; aucun GUID, aucune donnée patient ne sort dans le texte ;
- **insertion du SVG sans `innerHTML` et sans assouplir la CSP** (`style-src 'self'`, inchangée) : la CSP bloque les `<style>` et les attributs `style="…"` du SVG renvoyé par `mermaid.render`. L'adaptateur `src/adaptateurs/insererSvgSecurise.js` retire donc les styles du texte SVG avant toute analyse (le navigateur signale une violation dès qu'il analyse un style, même dans un document inerte), analyse le reste avec `DOMParser` (`image/svg+xml`), **rejette** tout `<script>`, `foreignObject`, `iframe`, `object`, `embed`, attribut `on*` ou lien `javascript:` (défense en profondeur, en plus de `securityLevel: 'strict'`), puis insère le nœud par `document.importNode` + `replaceChildren` (**plus aucun `innerHTML`**). Les styles sont réappliqués par le **CSSOM**, autorisé par la CSP : feuilles extraites dans une feuille constructible (`new CSSStyleSheet()` + `replaceSync`, `@import` supprimé, ajoutée à `document.adoptedStyleSheets`, retirée au rendu suivant et au démontage du composant) ; styles d'éléments par `element.style.setProperty(…)` (valeurs `url(…)` ignorées) ;
- le **texte en toutes lettres** reste affiché sous le schéma comme équivalent complet (accessibilité, échec de chargement, impression).

## Conséquences

- **Positives** : schéma lisible sans coût de mise en page ; le bundle principal reste inchangé (mermaid et ses dépendances dans des chunks séparés, chargés seulement à l'affichage d'un bilan) ; la bibliothèque est remplaçable en ne touchant qu'un adaptateur et un composant.
- **Négatives / compromis** : dépendance lourde (taille des chunks relevée au build) ; le **premier affichage nécessite le réseau** pour charger les chunks (même limite que pdf.js, [ADR 0019](0019-lecture-pdf-pdfjs.md)) : message clair si indisponible ; suivi des alertes de sécurité de mermaid et montée de version manuelle ; `npm audit` signale à la date de décision un avis **faible** sur `katex` (dépendance de mermaid, rendu mathématique non souhaité ici : Mermaid l'active sur les séquences `$$…$$` des libellés, donc `echapperLibelleMermaid` transforme `$` en `#36;` pour fermer cette surface, un nom comme `$$x$$` n'atteint jamais KaTeX ; le correctif de l'avis reste à prendre à la montée majeure), dont le correctif impose mermaid 12 : à réévaluer à la prochaine montée de version majeure.
- **Limite connue** : `mermaid.render` insère lui-même ses `<style>` et attributs `style` dans le document pendant le calcul de la mise en page ; la CSP les bloque et le navigateur journalise des violations « Refused to apply inline style » dans la console (sans effet visible : le SVG final est stylé par notre réapplication CSSOM). Les supprimer imposerait d'assouplir la CSP ou de modifier mermaid : non retenu.
- **Défense en profondeur** : échappement + liste blanche + `securityLevel: 'strict'` + `htmlLabels: false` + entrée entièrement produite par le domaine. À faire auditer (agent `security`).

## Alternatives considérées

- **SVG dessiné à la main** : mise en page des flèches coûteuse et fragile.
- **D3 / bibliothèque de graphes** : plus lourd, plus bas niveau.
- **Texte seul** : moins lisible pour le public cible.
- **Image générée côté serveur** : contraire à l'[ADR 0002](0002-application-frontend-sans-backend.md).

## Liens

[ADR 0002](0002-application-frontend-sans-backend.md), [ADR 0008](0008-moteur-planification-module-pur.md), [ADR 0019](0019-lecture-pdf-pdfjs.md), feature [0036](../../features/0036-retrocession-flux-bilan.md).
