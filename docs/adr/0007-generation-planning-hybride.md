# ADR 0007 — Génération de planning hybride (proposition + ajustement manuel)

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Établir un planning est le cœur de valeur d'Idelia. Trois approches possibles : entièrement **manuelle assistée**, entièrement **automatique**, ou **hybride**. L'automatique pur est le plus ambitieux mais rigide face aux cas non prévus ; le manuel pur n'apporte pas d'aide à la décision. Les utilisateurs sont non-informaticiens et doivent garder le contrôle.

## Décision

Idelia génère le planning en mode **hybride** : un **moteur propose** une répartition respectant au mieux les contraintes, puis l'utilisateur **ajuste manuellement par glisser-déposer**. Pendant l'ajustement, un **validateur recalcule les conflits en temps réel**. Génération et validation partagent **le même modèle de contraintes** (voir [ADR 0008](0008-moteur-planification-module-pur.md)).

Les affectations portent une origine (`AUTO`/`MANUEL`) et un état `verrouillee` : le moteur préserve ce que l'utilisateur a verrouillé lors d'une régénération.

## Conséquences

- **Positives** : bon compromis valeur/contrôle ; l'utilisateur reste maître ; robustesse aux cas particuliers (on ajuste au lieu de subir) ; cohérence garantie entre ce que propose le moteur et ce que signale la validation.
- **Négatives / compromis** : nécessite un moteur de contraintes et une UI d'édition (drag & drop) plus riches qu'un simple tableau ; complexité concentrée dans le module de planification.
- **Suivi** : voir la conception détaillée dans `docs/architecture/05-moteur-de-planification.md`.
