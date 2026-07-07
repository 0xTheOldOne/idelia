# ADR 0010 — Conventions de dates et de jours de semaine (ISO 8601)

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Une application de planning manipule intensément des dates et des jours de semaine. C'est la **source n°1 de bugs** : décalages de fuseau horaire, et confusion sur la numérotation des jours (`Date.getDay()` renvoie `0`=dimanche…`6`=samedi, ce qui casse une règle du type « ne pas travailler le mercredi »). Deux conceptions initiales ont divergé sur ce point : il faut trancher une convention unique.

## Décision

Conventions **uniques et obligatoires** dans tout le projet :

- **Jours de la semaine** : numérotation **ISO 8601** → `1`=Lundi, `2`=Mardi, `3`=Mercredi, `4`=Jeudi, `5`=Vendredi, `6`=Samedi, `7`=Dimanche. **Jamais** le `0-6` de `Date.getDay()` sans conversion explicite.
- **Dates calendaires** : chaînes `"YYYY-MM-DD"` (date pure, sans heure ni fuseau). **Interdit** dans le state persistant : les objets `Date`, et `new Date("YYYY-MM-DD")` (interprété en UTC minuit → décalage d'un jour selon le fuseau).
- **Heures** : chaînes `"HH:mm"` (format 24 h).
- **Horodatages techniques** (`createdAt`, `updatedAt`, `exportedAt`) : ISO 8601 UTC complet via `new Date().toISOString()`.

Toute manipulation de dates passe par un **utilitaire unique** (`dateUtil` : parse/format/addDays/diffDays/weekdayISO/rangeInclusive), testable, où la conversion `getDay()` → ISO 1-7 est faite **une seule fois**.

## Conséquences

- **Positives** : élimine une classe entière de bugs ; règles métier de jours off fiables ; sérialisation stable et lisible.
- **Négatives / compromis** : discipline à tenir ; un utilitaire de dates à écrire et maintenir (l'usage d'une lib légère type `dayjs` reste possible si justifié).
- **Suivi** : cette convention est rappelée dans `CLAUDE.md`, `docs/architecture/02-modele-de-domaine.md` et `docs/instructions/nommage-et-conventions.md` — elles doivent rester identiques.
