# ADR 0023 — Éditeur de texte riche avec `quill@2`, chargé à la demande

- **Statut** : Accepté
- **Date** : 2026-10-26
- **Décideurs** : porteur du projet (choix de Quill confirmé le 2026-10-26), rédaction par l'agent architecte

## Contexte

Les modèles de contrats ([0041](../../features/0041-modeles-de-contrats.md)) et leur lecture ([0042](../../features/0042-documents-contractuels.md)) demandent un **texte mis en forme** (titres, gras, listes, alignement) contenant des **champs non éditables** (marqueurs remplacés par les données de la personne ou du cabinet). Contraintes en jeu :

- public **non technique** : une barre d'outils claire, pas de syntaxe à connaître ;
- **KISS** (règle n° 12) : une seule bibliothèque, sans wrapper ni écosystème d'extensions ;
- **aucun backend** ([ADR 0002](0002-application-frontend-sans-backend.md)) : le contenu est stocké dans le navigateur ([ADR 0005](0005-persistance-localstorage-derriere-repository.md)) ;
- **pas de `v-html`** sur du contenu utilisateur (risque XSS), donc pas de HTML stocké ;
- **mode sombre** ([ADR 0022](0022-theme-sombre-css-custom-properties.md)) et icônes Phosphor ([ADR 0013](0013-icones-phosphor.md)).

## Décision

Nous utilisons **`quill` 2.x** (Delta JSON), avec les contraintes suivantes :

- **version exacte** dans `package.json` (sans `^`) : **2.0.3** (publiée le 2024-11-30, dernière 2.x stable, publiée depuis plus de 2 semaines) ; montée de version volontaire et contrôlée ;
- **sans wrapper Vue** (`vue-quill`, `@vueup/vue-quill` écartés : dépendance en plus, souvent en retard sur Quill, orientés Composition API) ;
- **chargée à la demande** : `import()` dynamique et routes paresseuses, pour que le bundle principal reste inchangé ; **isolée** derrière un seul adaptateur, `src/adaptateurs/editeurRiche.js` (hors `src/domain/`, [ADR 0008](0008-moteur-planification-module-pur.md)), à l'image de pdf.js ([ADR 0019](0019-lecture-pdf-pdfjs.md)) ;
- thème **core** seulement : `quill.core.css` structurel, aucune icône Quill ; barre d'outils écrite en Vue avec icônes Phosphor, couleurs par les tokens ([ADR 0022](0022-theme-sombre-css-custom-properties.md)) ;
- **liste blanche `formats`** (gras, italique, souligné, titre, liste, alignement, `marqueur`), collage compris ;
- contenu stocké en **Delta JSON**, jamais en HTML, validé à l'import ;
- rendu en lecture par Quill en `readOnly` ([0042](../../features/0042-documents-contractuels.md)), jamais par `v-html` ;
- champs = **blot embed** `marqueur` `{ cle }`.

## Conséquences

- **Positives** : bundle principal inchangé ; Delta manipulable comme un JSON, donc domaine testable sans DOM ; collage nettoyé ; une seule bibliothèque, remplaçable en ne touchant qu'un fichier.
- **Négatives / compromis** : dépendance à suivre (alertes de sécurité) ; réseau nécessaire au premier usage pour charger le chunk (message d'erreur et « Réessayer ») ; rendu Quill (classes `ql-*`) à styler nous-mêmes ; Quill 2 jeune sur certains points (embeds, sélection et focus).
- **Suivi** : réévaluer si Quill n'est plus maintenu.
- **Variante retenue (tâche 4)** : `quill/core` (sans thèmes ni modules d'interface) avec enregistrement explicite des formats `bold`, `italic`, `underline`, `header` (limité aux niveaux 1 et 2), `list`, `align` et du blot `marqueur` ; chunk d'édition d'environ 57 kB (hors navigateur, ~15 kB gzip) en plus de quelques chunks partagés de Quill.

## Alternatives considérées

- **`contenteditable` maison et `execCommand`** : API obsolète, comportement fragile selon les navigateurs.
- **TipTap / ProseMirror** : plus lourd, écosystème orienté Composition API et extensions.
- **CKEditor / TinyMCE** : lourds, licences, services en ligne.
- **Textarea Markdown** : inadapté au public visé.
- **HTML stocké et `v-html`** : risque XSS.

## Liens

[ADR 0002](0002-application-frontend-sans-backend.md), [ADR 0005](0005-persistance-localstorage-derriere-repository.md), [ADR 0008](0008-moteur-planification-module-pur.md), [ADR 0013](0013-icones-phosphor.md), [ADR 0019](0019-lecture-pdf-pdfjs.md), [ADR 0022](0022-theme-sombre-css-custom-properties.md), features [0041](../../features/0041-modeles-de-contrats.md), [0042](../../features/0042-documents-contractuels.md).
