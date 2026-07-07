# 03 — Modèle de données (document de sauvegarde JSON)

Le **SaveDocument** est la représentation canonique de l'état d'Idelia : c'est ce qui est stocké (via `storageRepository`, [ADR 0005](../adr/0005-persistance-localstorage-derriere-repository.md)) et ce qui est exporté/importé ([ADR 0006](../adr/0006-sauvegarde-partage-par-export-import-json.md)). Les entités qu'il contient sont décrites dans [`02-modele-de-domaine.md`](02-modele-de-domaine.md).

## Structure racine

```jsonc
{
  "schemaVersion": 1,              // entier, en tête : pilote les migrations
  "meta": {
    "app": "Idelia",
    "appVersion": "1.0.0",
    "exportedAt": "2026-07-07T09:30:00.000Z",
    "generator": "idelia-web"
  },
  "cabinet": { /* ParametresCabinet (singleton) */ },
  "personnes": [ /* Personne[] (preferences imbriquées) */ ],
  "tournees":  [ /* Tournee[] */ ],
  "absences":  [ /* Absence[] (à plat, avec personneId) */ ],
  "plannings": [ /* Planning[] (affectations imbriquées) */ ]
}
```

## Exemple concret (extrait)

```json
{
  "schemaVersion": 1,
  "meta": { "app": "Idelia", "appVersion": "1.0.0", "exportedAt": "2026-07-07T09:30:00.000Z", "generator": "idelia-web" },
  "cabinet": {
    "nomCabinet": "Cabinet des Tilleuls",
    "joursOuverture": [1, 2, 3, 4, 5, 6],
    "creneauxActifs": ["MATIN", "APRES_MIDI"],
    "reposHebdoMin": 2, "maxJoursConsecutifs": 6, "premierJourSemaine": 1,
    "couleursParDefaut": ["#2E86AB", "#E4572E", "#5B8C5A", "#B5179E"],
    "updatedAt": "2026-07-01T08:00:00.000Z"
  },
  "personnes": [
    {
      "id": "p-3f2a", "prenom": "Claire", "nom": "Martin",
      "statut": "TITULAIRE", "actif": true, "couleur": "#2E86AB",
      "quotite": 100, "dateEntree": "2019-09-01", "dateSortie": null,
      "contact": { "email": null, "telephone": "0600000000" },
      "ordreAffichage": 1, "notes": "",
      "preferences": [
        { "id": "pref-1", "type": "JOUR_OFF_RECURRENT", "nature": "DURE", "actif": true,
          "params": { "joursSemaine": [3] }, "libelle": "Pas le mercredi",
          "createdAt": "2026-07-01T08:00:00.000Z", "updatedAt": "2026-07-01T08:00:00.000Z" },
        { "id": "pref-2", "type": "CRENEAU_OFF", "nature": "SOUPLE", "poids": 8, "actif": true,
          "params": { "creneaux": ["APRES_MIDI"] }, "libelle": "Éviter les après-midis",
          "createdAt": "2026-07-01T08:00:00.000Z", "updatedAt": "2026-07-01T08:00:00.000Z" }
      ],
      "createdAt": "2026-07-01T08:00:00.000Z", "updatedAt": "2026-07-01T08:00:00.000Z"
    }
  ],
  "tournees": [
    {
      "id": "t-1", "nom": "Tournée Nord", "code": "N", "secteur": "Nord",
      "creneau": "MATIN", "heureDebut": "06:30", "heureFin": "12:00",
      "joursApplication": [1, 2, 3, 4, 5, 6], "nbPersonnesRequises": 1,
      "couleur": "#5B8C5A", "archivee": false,
      "dateDebutValidite": null, "dateFinValidite": null, "ordreAffichage": 1, "notes": "",
      "createdAt": "2026-07-01T08:00:00.000Z", "updatedAt": "2026-07-01T08:00:00.000Z"
    }
  ],
  "absences": [
    {
      "id": "a-1", "personneId": "p-3f2a", "type": "CONGE_PAYE",
      "dateDebut": "2026-07-20", "dateFin": "2026-07-31", "creneau": "JOURNEE",
      "statut": "VALIDE", "commentaire": "Vacances d'été",
      "demandeLe": "2026-06-01T10:00:00.000Z", "decideLe": "2026-06-03T09:00:00.000Z",
      "createdAt": "2026-06-01T10:00:00.000Z", "updatedAt": "2026-06-03T09:00:00.000Z"
    }
  ],
  "plannings": [
    {
      "id": "pl-1", "nom": "Semaine 28 - 2026",
      "dateDebut": "2026-07-06", "dateFin": "2026-07-12",
      "statut": "BROUILLON", "referentId": "p-3f2a", "publieLe": null,
      "parametresGeneration": { "seed": 1 },
      "affectations": [
        { "id": "af-1", "personneId": "p-3f2a", "tourneeId": "t-1",
          "date": "2026-07-06", "creneau": "MATIN", "origine": "AUTO",
          "verrouillee": false, "commentaire": "",
          "createdAt": "2026-07-05T18:00:00.000Z", "updatedAt": "2026-07-05T18:00:00.000Z" }
      ],
      "createdAt": "2026-07-05T18:00:00.000Z", "updatedAt": "2026-07-05T18:00:00.000Z"
    }
  ]
}
```

## Sérialisation / désérialisation

Deux fonctions pures centralisent la conversion état ↔ document, dans `src/domain/schema.js` :

- `toSaveDocument(rootState) → SaveDocument`
- `fromSaveDocument(doc) → rootState`

Elles sont la **seule** frontière de (dé)sérialisation. Le plugin de persistance et l'export/import les utilisent.

## Règles d'import (ordre impératif)

1. **Refuser** un `schemaVersion` **supérieur** à `CURRENT_SCHEMA_VERSION` (un build ancien ne doit pas corrompre un fichier récent).
2. **Migrer** si `schemaVersion` < courant (voir ci-dessous).
3. **Valider** structure + intégrité référentielle (`verifierIntegrite(doc)`) — signaler les orphelins et bloquer si incohérent.
4. **Remplacer atomiquement** l'état (`REPLACE_ALL`) puis persister immédiatement.

## Versionnement & migrations

- `CURRENT_SCHEMA_VERSION` et le pipeline vivent dans `src/storage/migrations.js`.
- `MIGRATIONS = { 1: v1→v2, 2: v2→v3, … }` : `migrate(doc)` applique les migrations **séquentiellement** jusqu'à la version courante.
- `migrate()` est appelée **à la fois** dans `storageRepository.load()` (état persistant ancien) et à l'import (vieux fichiers).
- Toute évolution de la forme des données ⇒ **bump** de `schemaVersion` + fonction de migration.

## Intégrité référentielle

`verifierIntegrite(doc)` (dans `src/domain/schema.js`) vérifie que chaque `personneId` / `tourneeId` / `referentId` résout vers une entité existante. Utilisée avant tout `REPLACE_ALL` (import et chargement).
