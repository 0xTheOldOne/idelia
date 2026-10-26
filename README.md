<p align="center">
  <img src="public/logo.png" alt="Logo Idelia" width="200" />
</p>

# Idelia

**Idelia** aide un cabinet infirmier à établir ses plannings, en tenant compte des personnes, de leurs souhaits, des tournées et de leurs horaires, et des absences (congés, arrêts, maternité/paternité/naissance…).

L'application est pensée pour des personnes **peu à l'aise avec l'informatique** : l'ergonomie est une exigence de premier plan.

## En bref

- Application **100 % frontend** (Vue.js), **sans backend**, hébergée en site statique sur **GitHub Pages** : <https://0xtheoldone.github.io/idelia/>.
- Les données restent dans le navigateur ; la **sauvegarde** se fait dans un **fichier JSON** (écriture automatique sur Chrome/Edge, téléchargement ailleurs) qui sert aussi au partage.
- Le planning est construit en mode **hybride** : un moteur propose une répartition, puis l'utilisateur ajuste par glisser-déposer, avec détection des conflits en temps réel.
- Un **référent** tient le planning et le diffuse à l'équipe (impression, PDF, e-mail).

## Ce que fait l'application

| Écran | Fonctions |
|---|---|
| **Accueil** | Vue d'ensemble, actions rapides, état de la sauvegarde. |
| **Équipe** | Personnes (titulaires, remplaçantes rattachées), couleur, rythme mensuel, dates de présence, informations professionnelles, initiales Vega. |
| **Souhaits** | Préférences par personne (jours, repos, « un weekend sur X »…), souples ou impératives. |
| **Tournées** | Tournées complètes ou coupées, horaires par segment, icône de repère. |
| **Absences** | Congés, arrêts, maternité/paternité… en saisie directe. |
| **Planning** | Génération automatique (titulaires d'abord, puis remplaçantes), édition par glisser-déposer, souhaits non respectés signalés, fériés et vacances scolaires, récap mensuel par personne. |
| **Diffusion** | Planning imprimable façon papier du cabinet, PDF, préparation d'un e-mail à l'équipe. |
| **Feuille de route** | Import de la liste des séances Vega (PDF), répartition du soin de base entre infirmières, bilan « qui doit quoi » avec rétrocession. |
| **Paramètres** | Réglages du cabinet, sauvegarde automatique, mode sombre. |

## Statut

**v1 fonctionnelle** : features `0001` à `0038` livrées.

À venir (voir [`features/ROADMAP.md`](features/ROADMAP.md)) : page **Cabinet** (identité, logo), coordonnées des personnes, puis **modèles de contrats** et **contrats / avenants** générés par personne. L'historique des versions d'un planning est reporté en v2.

## Stack technique

Vite · Vue 3 (Options API) · Vuex · vue-router · SCSS + **Bootstrap 5** · Vuelidate · vue-debounce · @phosphor-icons/vue · pdf.js · **JavaScript pur (pas de TypeScript)**.

## Démarrage

Prérequis : **Node.js 22**.

```bash
npm install
npm run dev       # serveur de développement
npm run build     # build de production dans dist/
npm run preview   # sert le build localement
```

Le déploiement sur GitHub Pages est automatique à chaque push sur `main` ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).
