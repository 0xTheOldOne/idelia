# ADR 0019 — Lecture des PDF avec `pdfjs-dist`, chargé à la demande

- **Statut** : Accepté
- **Date** : 2026-10-09
- **Décideurs** : porteur du produit

## Contexte

Le cabinet exporte de son logiciel de facturation Vega une « Liste des séances sur une période » **au format PDF** (feature [0033](../../features/0033-feuille-de-route.md)). Idelia doit la lire pour repérer les relais matin / après-midi, **sans backend** ([ADR 0002](0002-application-frontend-sans-backend.md)) : le fichier contient des **données de santé** réelles et ne doit pas quitter le poste. Le PDF est un texte réel (pas une image), mais encodé glyphe par glyphe dans des flux compressés : le lire « à la main » est impraticable.

## Décision

Nous utilisons **`pdfjs-dist`** (Mozilla) dans le navigateur, avec les contraintes suivantes :

- **version exacte** dans `package.json` (sans `^`) : bibliothèque qui lit des fichiers externes, la montée de version est volontaire et contrôlée. Version retenue : **6.3.289** (publiée le 2026-08-29, dernière publiée plus de 2 semaines avant la décision) ;
- **chargement à la demande** : `import('pdfjs-dist')` dynamique au premier dépôt de fichier, worker importé par URL (`pdfjs-dist/build/pdf.worker.min.mjs?url`), compatible `base: '/idelia/'` ;
- **extraction de texte seulement** (`getTextContent()`), aucun rendu de page ;
- options durcies : `isEvalSupported: false`, `enableXfa: false`, `stopAtErrors: true`, `disableAutoFetch: true`, `disableStream: true`, `cMapUrl`/`standardFontDataUrl`/`wasmUrl` à `null` (aucune évaluation de code, aucune ressource distante) ; plafonds de 200 pages et 200 000 fragments (`PDF_TROP_COMPLEXE`) ;
- **isolée derrière un seul adaptateur**, `src/adaptateurs/lireGlyphesPdf.js` (hors `src/domain/`, [ADR 0008](0008-moteur-planification-module-pur.md), et hors `src/storage/`) ;
- **aucune donnée conservée** : rien n'est persisté ([ADR 0005](0005-persistance-localstorage-derriere-repository.md) non concerné), le document pdf.js est détruit après lecture.

## Conséquences

- **Positives** : lecture fiable des PDF réels ; rien ne quitte le poste ; le bundle principal reste inchangé (chunk pdf.js ≈ 430 kB et worker ≈ 1,2 Mo séparés, chargés seulement à l'usage) ; la bibliothèque est remplaçable en ne touchant qu'un fichier.
- **Négatives / compromis** : dépendance lourde à maintenir (suivre les alertes de sécurité pdf.js, montée de version manuelle) ; le **premier usage nécessite le réseau** pour charger le chunk et le worker (message dédié si indisponible) ; le serveur d'hébergement doit servir le `.mjs` avec un type MIME JavaScript.
- **Suivi** : si un poste ancien échoue avec la build moderne, basculer l'adaptateur sur `pdfjs-dist/legacy/build/pdf.mjs` (une ligne). Si Vega propose un export CSV, réévaluer la nécessité de lire des PDF.

## Alternatives considérées

- **Lecture PDF « à la main »** : flux compressés (FlateDecode), encodages de polices → fragile et coûteux.
- **OCR** : inutile, le PDF contient du texte réel ; lent et moins fiable.
- **Traitement côté serveur** : contraire à l'[ADR 0002](0002-application-frontend-sans-backend.md) et à la confidentialité des données de santé.
- **Export CSV depuis Vega** : non disponible à ce jour (à réévaluer).

## Liens

[ADR 0002](0002-application-frontend-sans-backend.md), [ADR 0005](0005-persistance-localstorage-derriere-repository.md), [ADR 0008](0008-moteur-planification-module-pur.md), feature [0033](../../features/0033-feuille-de-route.md).
