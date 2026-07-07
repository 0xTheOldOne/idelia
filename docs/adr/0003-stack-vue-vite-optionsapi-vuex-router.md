# ADR 0003 — Stack : Vite + Vue 3 (Options API) + Vuex + vue-router

- **Statut** : Accepté
- **Date** : 2026-07-07

## Contexte

Il faut choisir l'outillage et les briques de base de la SPA. Le projet doit rester simple, maintenable, et cohérent d'un bout à l'autre. Choix cadrés par les préférences de l'équipe.

## Décision

Nous utilisons :
- **Vite** comme outil de build et serveur de dev.
- **Vue 3** avec l'**Options API** (pas la Composition API), pour une structure de composant explicite et homogène.
- **Vuex** comme store d'état centralisé (pas Pinia).
- **vue-router** pour la navigation entre écrans.

## Conséquences

- **Positives** : démarrage/HMR rapides (Vite) ; structure de composants uniforme et lisible (Options API) ; un seul modèle mental d'état partagé (Vuex).
- **Négatives / compromis** : Vuex est en mode maintenance côté écosystème (Pinia est l'orientation moderne de Vue) ; l'Options API est parfois plus verbeuse que la Composition API pour la logique réutilisable — compensé en plaçant la logique métier dans `src/domain/`.
- **Suivi** : cohérence à faire respecter (voir [instructions composants Vue](../instructions/composants-vue.md) et [Vuex](../instructions/etat-vuex.md)). Une éventuelle migration Pinia ferait l'objet d'un nouvel ADR.

## Alternatives considérées

- **Composition API / `<script setup>`** : écartée pour homogénéité et simplicité de lecture pour l'équipe.
- **Pinia** : écartée au profit de Vuex par choix d'équipe.
