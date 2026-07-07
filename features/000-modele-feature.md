# Feature NNN — Nom de la feature

> Gabarit. Copier ce fichier en `NNN-NomDeLaFeature.md` et remplir chaque section. Supprimer les sections non pertinentes plutôt que de les laisser vides.

- **Statut** : À faire | En cours | Fait
- **Dépend de** : (features prérequises, ex. `001`, `002`)
- **ADR liés** : (ex. [0005](../docs/adr/0005-persistance-localstorage-derriere-repository.md))

## 1. Contexte & objectif

Pourquoi cette feature ? Quel besoin utilisateur elle sert ? Résultat attendu en 2-3 phrases.

## 2. Écrans concernés

Quelles routes/écrans ([architecture 07](../docs/architecture/07-navigation-et-ecrans.md)) sont créés ou modifiés. Décrire brièvement l'expérience visée (l'utilisateur non-technique).

## 3. Modèle de données touché

Entités/champs concernés ([architecture 02](../docs/architecture/02-modele-de-domaine.md) / [03](../docs/architecture/03-modele-de-donnees.md)). Impact éventuel sur `schemaVersion` et migrations.

## 4. Store (Vuex)

Modules/getters/actions/mutations à créer ou modifier ([architecture 04](../docs/architecture/04-gestion-etat-vuex.md)). Ce qui est persisté vs volatile.

## 5. Domaine (logique pure)

Fonctions dans `src/domain/` à créer/réutiliser (ex. utilitaires, moteur). **Aucune logique métier dans les composants.**

## 6. Composants

Composants Vue à créer/réutiliser (`views/` et `components/`), avec leur responsabilité. Citer l'existant réutilisé.

## 7. Règles de validation

Contraintes de saisie (Vuelidate) et messages FR ([instructions](../docs/instructions/formulaires-validation.md)).

## 8. Points d'attention ergonomie

Ce qui doit être particulièrement soigné pour le public non-technique ([architecture 08](../docs/architecture/08-principes-ux-ergonomie.md) / [checklist](../docs/instructions/accessibilite-ergonomie.md)).

## 9. Étapes d'implémentation

Découpage en étapes vérifiables, dans l'ordre.

1. …
2. …

## 10. Critères d'acceptation

Liste testable **à la main** de ce qui doit fonctionner pour considérer la feature terminée.

- [ ] …
- [ ] …

## 11. Vérification

Comment tester la feature de bout en bout (lancer l'app, parcours utilisateur, cas limites).

## 12. Décisions à confirmer / risques

Questions ouvertes, choix laissés au développeur, écarts éventuels avec un ADR (à remonter).
