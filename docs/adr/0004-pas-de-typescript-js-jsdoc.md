# ADR 0004 — Pas de TypeScript ; JavaScript pur documenté en JSDoc

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Le typage statique aide sur les gros projets, mais ajoute de la configuration, une étape de compilation supplémentaire et une charge cognitive. Le projet vise la simplicité et une prise en main facile.

## Décision

Nous écrivons l'application en **JavaScript pur, sans TypeScript**. Le **typage est documenté via JSDoc** (`@typedef`, `@param`, `@returns`), en particulier pour :
- les entités du domaine (`docs/architecture/02-modele-de-domaine.md`) ;
- les structures du moteur de planification (`Input`, `Planning`, `Contrainte`, `Violation`…).

## Conséquences

- **Positives** : outillage minimal, pas d'étape de typecheck ; accessible ; l'éditeur exploite tout de même les JSDoc pour l'autocomplétion et le survol.
- **Négatives / compromis** : pas de garantie de types à la compilation ; les erreurs de forme se détectent au runtime → d'où l'importance des validations d'import et des JSDoc soignées sur le domaine et le moteur.
- **Suivi** : soigner les `@typedef` partagés ; envisager `jsconfig.json` + `checkJs` léger si le besoin de sûreté grandit (nouvel ADR le cas échéant).
