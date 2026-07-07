# Instructions — Checklist accessibilité & ergonomie

Checklist opérationnelle, utilisée notamment par l'agent `relecteur-ergonomie`. Elle décline les principes de [architecture 08](../architecture/08-principes-ux-ergonomie.md). Public cible : **personnes peu à l'aise avec l'informatique**.

## Clarté & langage

- [ ] Libellés en français courant, **zéro jargon** informatique.
- [ ] Titre d'écran explicite ; l'utilisateur sait où il est.
- [ ] Une **action principale** clairement identifiable par écran.
- [ ] Icônes toujours accompagnées d'un libellé ou d'un `aria-label`.

## Feedback & erreurs

- [ ] Chaque action donne un **retour immédiat** (succès / erreur / chargement).
- [ ] Messages d'erreur qui expliquent **comment corriger**.
- [ ] Aucune perte de saisie en cas d'erreur.
- [ ] Opérations longues (génération) : indicateur de progression.

## Sécurité & réversibilité

- [ ] **Confirmation** avant toute action destructrice (suppression, réinitialisation, import qui remplace tout).
- [ ] Désactivation (soft-delete) préférée à la suppression définitive.
- [ ] État de **sauvegarde** visible (« dernière sauvegarde le… ») et export facilement accessible.

## Ergonomie physique

- [ ] Cibles cliquables larges (~44px) et bien espacées.
- [ ] Texte lisible (taille confortable, hauteur de ligne suffisante).
- [ ] **Contraste** suffisant (viser WCAG AA).
- [ ] **Jamais** d'information transmise par la seule couleur (doubler icône/libellé/motif).

## Accessibilité clavier & structure

- [ ] **Focus visible** partout (outline non supprimé sans alternative).
- [ ] Navigation possible **au clavier** (Tab, Entrée, Échap pour fermer une modale).
- [ ] Structure de **titres** cohérente (h1 → h2 → …).
- [ ] Champs de formulaire correctement **étiquetés** (`label` associé).
- [ ] Modales : focus piégé, fermeture au clavier, retour du focus à l'ouvrant.

## Cohérence

- [ ] Mêmes patterns d'interaction partout ; une icône = une action.
- [ ] Couleurs de personnes toujours doublées du nom.

## Impression / diffusion

- [ ] Les vues de diffusion (planning) sont **lisibles en noir & blanc**.
- [ ] Informations essentielles présentes sans interactivité (qui / quoi / quand).
- [ ] `@media print` prévu pour ces vues.

## Sortie de relecture

Classer chaque écart en **bloquant / important / mineur**, avec emplacement (fichier + zone), problème vu **côté utilisateur**, et recommandation concrète.
