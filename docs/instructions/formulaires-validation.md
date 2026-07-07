# Instructions — Formulaires & validation

Référence : [ADR 0011](../adr/0011-validation-vuelidate-vue-debounce.md). Les formulaires doivent être **clairs et non frustrants** pour un public non-technique ([architecture 08](../architecture/08-principes-ux-ergonomie.md)).

## Vuelidate

- Déclarer les règles de validation de façon **déclarative** (proche du composant qui les utilise).
- **Messages en français**, orientés correction : dire **ce qu'il faut faire**, pas seulement « invalide ».
  - ❌ « Champ invalide » → ✅ « L'heure de fin doit être après l'heure de début. »
- Valider ce qui a du sens métier, par exemple :
  - Personne : prénom et nom requis, couleur valide, quotité 0–100.
  - Tournée : `heureFin` > `heureDebut`, au moins un jour d'application, `nbPersonnesRequises` ≥ 1.
  - Absence : `dateFin` ≥ `dateDebut`.
- **Ne bloquer que ce qui doit l'être.** Afficher l'erreur au bon moment (après interaction sur le champ ou à la tentative de validation), pas dès l'affichage d'un formulaire vierge.

## vue-debounce

- Débouncer les saisies déclenchant un traitement coûteux (recherche, filtrage, recalcul, écriture) pour un retour fluide.
- Cohérent avec la **persistance débouncée** du store ([architecture 04](../architecture/04-gestion-etat-vuex.md)) : on évite d'écrire à chaque frappe.

## Patterns d'ergonomie

- **Peu de champs à la fois**, regroupés logiquement ; libellés explicites au-dessus des champs.
- **Valeurs par défaut raisonnables** (ex. quotité 100 %, créneau `JOURNEE`, statut `DEMANDE`) pour réduire l'effort.
- **Ne jamais perdre la saisie** : préserver le brouillon en cas d'erreur.
- **Action principale** du formulaire mise en avant ; « Annuler » clairement disponible.
- **Confirmation** avant les actions destructrices (suppression) — même hors formulaire.
- Placeholders/exemples utiles (`06:30`, `06 12 34 56 78`).

## Dates & heures

Utiliser les formats et utilitaires standard ([ADR 0010](../adr/0010-conventions-dates-et-jours-iso.md)) : dates `"YYYY-MM-DD"`, heures `"HH:mm"`, jours ISO 1-7. Les champs de saisie de date doivent produire/consommer ces formats via `src/domain/utils/dates.js`.
