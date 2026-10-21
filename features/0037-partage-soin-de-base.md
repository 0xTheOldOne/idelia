# Feature 0037 — Partage du soin de base seulement

- **Statut** : Terminé
- **Dépend de** : `0034` (reversements par cas), `0035` (bilan), `0036` (rétrocession, virements entre titulaires)

## 1. Contexte & objectif

Jusqu'ici, le total d'un patient vu par plusieurs infirmières le même jour était partagé **par passage**. La règle réelle du cabinet est différente :

- chaque passage est payé à l'infirmière qui l'a fait (à sa titulaire si c'est une remplaçante) ;
- **seul le soin de base (BSA, BSB, BSC) est partagé**, à parts égales entre les **infirmières distinctes** du jour ;
- IFI, AMI, majorations, IK restent à celle qui les a faits ;
- la rétrocession d'une remplaçante s'applique **uniquement sur la part de BS**, pas sur l'IF.

Cas listés par l'utilisatrice, tous couverts :

| Cas | Résultat |
|---|---|
| Titulaire A + sa remplaçante | même compte : A reçoit tout et reverse à la remplaçante sa moitié de BS, moins la rétrocession |
| Titulaire A puis titulaire B | A donne la moitié du BS à B |
| Titulaire A + remplaçante de B | A donne la moitié du BS à B, qui la reverse à sa remplaçante, moins la rétrocession |
| Remplaçante de A + remplaçante de B | via les deux titulaires, même règle |
| 3 infirmières distinctes | BS partagé en 3 |
| A deux fois + B | BS partagé en 2 (par infirmière, pas par passage) |

## 2. Décisions

- **Montant du BS** : la cotation Vega est tronquée (« BSB1+IFI1 (… ») et ne donne qu'un montant par ligne. Le BS est donc isolé par les tarifs NGAP `TARIFS_BS_CENTIMES` (BSA 13,00 · BSB 18,20 · BSC 28,70 €) × coefficient, vérifiés sur les totaux de pied de page du PDF Vega. À mettre à jour si les tarifs changent.
- **Centimes indivisibles** : ils restent à l'infirmière qui a facturé le BS (Σ parts = total).
- **Ligne inférieure au tarif de son BS** : lecture douteuse, le cas est traité comme un montant illisible (non compté, signalé).
- **Rétrocession** : inchangée dans `fluxComptes.js`. L'écart d'une infirmière vaut désormais `BS facturé − sa part de BS`, donc la rétrocession ne porte que sur le BS.
- L'affichage reste un **ajustement** du reversement habituel (choix confirmé).

### Question en suspens (2026-10-21)

Soulevée par le cas « TroisDoublons » (FC matin + soir, LR une fois) : quand une infirmière passe deux fois et une autre une fois, faut-il diviser le BS **par infirmière** (règle actuelle → FC → LR 9,10 €) ou **par passage** (les soins du matin sont souvent plus lourds) ? L'équipe n'a pas tranché : **aucune évolution** tant qu'elle n'a pas décidé. La question est affichée dans l'onglet « Règles de calcul ».

## 2 bis. Onglet « Règles de calcul »

Troisième onglet de l'écran de résultat (`src/components/feuilleDeRoute/ReglesCalcul.vue`, statique) : patients concernés, qui reçoit l'argent, ce qui est partagé (tableau des tarifs BS), partage du BS, les 7 cas avec exemple chiffré, rétrocession, bilan, cas non calculés ou signalés. Les montants d'exemple sont calculés avec `TARIFS_BS_CENTIMES` et `partsRetrocession` (IFI 2,75 € et taux 11 % en exemple), pour rester alignés sur le calcul.

## 3. Fichiers

- `src/domain/feuilleDeRoute/detecterRelais.js` : `TARIFS_BS_CENTIMES`, `montantBsCentimes(cotation)`, nouvelle `repartir`, champs `bsCentimes` / `partBsCentimes` (remplacent `partParPassageCentimes`).
- `src/components/feuilleDeRoute/ListeRelais.vue` : « Soin de base X partagé entre N infirmières, soit Y chacune. »
- `src/components/feuilleDeRoute/BilanPeriode.vue` : infobulle « Ce qui lui revient ».
- `docs/architecture/09-feuille-de-route-vega.md` : règle, tarifs, exemples de référence.

## 4. Vérification

Script jetable (scratchpad) : 1 BS + 2 IF, AMI en plus sur le passage BS, 3 infirmières (centime restant), même infirmière deux fois, ligne sous le tarif, invariants du bilan (Σ soldes = 0, Σ parts = total). Exemple réel : FC 20,95 · FC 2,75 · LR 2,75 → FC → LR 9,10 € (6,07 € avec l'ancienne règle).
