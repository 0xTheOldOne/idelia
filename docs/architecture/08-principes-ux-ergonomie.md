# 08 — Principes d'ergonomie

**Idelia s'adresse à des personnes peu à l'aise avec l'informatique.** L'ergonomie n'est pas une finition : c'est une exigence structurante qui prime sur l'élégance technique. Ce document donne les principes ; la checklist opérationnelle de relecture est dans [`../instructions/accessibilite-ergonomie.md`](../instructions/accessibilite-ergonomie.md) (utilisée par l'agent `relecteur-ergonomie`).

## Les principes

1. **Langage humain, zéro jargon.** Libellés en français courant du métier (« Ajouter une personne », « Congés », « Générer le planning »). Jamais de termes techniques (« instance », « valider le formulaire », « erreur 500 »…).

2. **Une chose à la fois.** Chaque écran a un objectif clair et **une action principale** mise en avant. Les actions secondaires restent discrètes.

3. **Toujours savoir où l'on est.** Titre d'écran explicite, navigation persistante, état sélectionné visible. Pas d'écran « cul-de-sac » : toujours un retour évident.

4. **Feedback immédiat et compréhensible.** Toute action produit un retour clair : confirmation de succès, message d'erreur qui explique **quoi corriger** (pas seulement « champ invalide »), indicateur de chargement si une opération prend du temps (ex. génération).

5. **Tolérance à l'erreur.** On ne perd jamais une saisie. La validation guide sans punir (voir [`../instructions/formulaires-validation.md`](../instructions/formulaires-validation.md)). Les valeurs par défaut raisonnables réduisent l'effort.

6. **Réversibilité.** Confirmation avant toute action destructrice (suppression, réinitialisation, import qui remplace tout). Possibilité d'annuler quand c'est faisable. Préférer la **désactivation** (soft-delete) à la suppression définitive.

7. **Sécuriser les données de l'utilisateur.** Comme la vérité vit dans un seul navigateur ([ADR 0009](../adr/0009-workflow-referent-diffusion-lecture.md)), rappeler visiblement l'état de sauvegarde (« dernière sauvegarde le… ») et encourager l'export régulier. L'import qui écrase tout doit être explicite et confirmé.

8. **Ergonomie physique.** Cibles cliquables larges et bien espacées ; texte lisible ; contrastes suffisants. **Ne jamais transmettre une information par la seule couleur** (associer une icône, un libellé ou un motif) — indispensable pour les daltoniens et l'impression.

9. **Accessibilité de base.** Focus clavier visible, navigation au clavier possible, structure de titres cohérente, alternatives textuelles pour les icônes d'action. Une icône seule n'est jamais une action : elle est accompagnée d'un libellé ou d'un `aria-label`.

10. **Cohérence.** Mêmes patterns partout : un bouton « Ajouter » se comporte pareil sur tous les écrans ; une même icône = une même action (table « action → icône » de référence). La régularité rassure.

11. **Impression et diffusion lisibles.** Les vues destinées à être imprimées/exportées (planning diffusé, [ADR 0009](../adr/0009-workflow-referent-diffusion-lecture.md)) sont conçues pour le papier : lisibles en noir & blanc, sans dépendance à l'interactivité, avec les informations essentielles (qui, quoi, quand).

## Base de composants

**Bootstrap 5** ([ADR 0015](../adr/0015-bootstrap-librairie-composants-scss.md)) fournit une base de composants accessibles et cohérents (focus, ARIA, tailles confortables) qui **sert** ces principes. Attention : cette base ne dispense **pas** d'appliquer la [checklist](../instructions/accessibilite-ergonomie.md) — un composant Bootstrap mal utilisé (libellé manquant, information par la seule couleur, contraste insuffisant après thème) reste non conforme.

## Application concrète

- **Formulaires** : peu de champs visibles à la fois, groupés logiquement, avec des exemples/placeholders et des valeurs par défaut. Débounce des saisies ([ADR 0011](../adr/0011-validation-vuelidate-vue-debounce.md)) pour un retour fluide.
- **Planning** : conflits explicités en langage clair (« Claire est en congé ce jour-là »), erreurs dures visuellement distinctes des simples avertissements, cellule concernée surlignée.
- **Couleurs des personnes** : utilisées comme repère visuel, toujours doublées d'un nom.
