# ADR 0015 — Utiliser Bootstrap 5 comme librairie de composants, intégrée en SCSS

- **Statut** : Accepté — **amende** l'[ADR 0012](0012-style-scss.md)
- **Date** : 2026-07-07

## Contexte

L'[ADR 0012](0012-style-scss.md) a retenu **SCSS** comme langage de style et **écarté** les frameworks CSS (dont Bootstrap) pour garder la maîtrise du rendu. À l'usage, construire **à la main** l'ensemble des composants accessibles et cohérents dont l'application a besoin (boutons, champs, modales, tableaux, navigation, grille, utilitaires d'espacement…) est **coûteux et risqué** — précisément là où l'ergonomie pour un public non-technique ne doit pas être sacrifiée.

Or **Bootstrap 5 est distribué en SCSS** et entièrement personnalisable via des variables : l'utiliser n'entre donc **pas** en conflit avec le choix « SCSS », il l'outille.

## Décision

Nous utilisons **Bootstrap 5** comme **base de composants et d'utilitaires**, avec les modalités suivantes :

1. **Intégration par le source SCSS** de Bootstrap, **personnalisé par nos tokens** ([instructions style-scss](../instructions/style-scss.md)) : nos variables de design surchargent les variables Bootstrap **avant** son import → une seule source de vérité pour le thème.
2. **Bootstrap « pur »** : on utilise ses **classes utilitaires** et le **markup de ses composants** directement dans les templates. **Pas de wrapper Vue** (ex. `bootstrap-vue-next`).
3. **Interactions** : pour les rares composants interactifs (modale, dropdown, offcanvas, collapse, tooltip), on utilise la **JS de Bootstrap** (importée par composant) **ou** un comportement **Vue simple** — on préfère Vue pour les bascules triviales.
4. **Icônes** : on **reste sur Phosphor** ([ADR 0013](0013-icones-phosphor.md)), **pas** Bootstrap Icons.
5. Le choix **SCSS** de l'[ADR 0012](0012-style-scss.md) **reste valable** ; seul son **rejet de Bootstrap est levé**.

## Conséquences

- **Positives** : composants **accessibles et cohérents** prêts à l'emploi (sert directement l'ergonomie, [architecture 08](../architecture/08-principes-ux-ergonomie.md)) ; grille et utilitaires ; développement plus rapide ; **entièrement thémable** via nos tokens ; écosystème **mature et stable**.
- **Négatives / compromis** :
  - Poids ajouté → **mitigation** : n'importer que les modules SCSS nécessaires (pas tout Bootstrap) et la JS par composant.
  - Style « Bootstrap » reconnaissable → **mitigation** : thématiser via les tokens.
  - Risque de **doublon** entre utilitaires Bootstrap et SCSS maison → discipline : privilégier Bootstrap pour ce qu'il couvre, SCSS maison pour le spécifique.
  - Cohabitation JS impérative de Bootstrap ↔ réactivité Vue → préférer Vue pour les cas simples.
- **Suivi** : cadrer l'intégration et l'ordre d'import dans [instructions style-scss](../instructions/style-scss.md) ; **mapper tokens ↔ variables Bootstrap** dès la feature `001` ([ROADMAP](../../features/ROADMAP.md)).

## Alternatives considérées

- **`bootstrap-vue-next`** (wrapper Vue 3) : écarté — encore en maturation, dépendance susceptible de décrocher ; le markup Bootstrap direct suffit.
- **Tailwind** : écarté — utilitaires purs sans composants prêts, n'adresse pas le besoin de composants accessibles clés en main.
- **Continuer 100 % SCSS maison** : écarté — coût et risque ergonomique trop élevés (motif de cet ADR).
