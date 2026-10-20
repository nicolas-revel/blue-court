---
name: moteur-tests
description: Écrire ou modifier du code dans packages/engine avec ses tests unitaires et ses tests par propriété (fast-check). À utiliser pour toute fonction du moteur de tournoi.
---

# Coder dans le moteur

Le moteur (`packages/engine`) est une bibliothèque de fonctions pures : aucune dépendance runtime, aucun accès réseau, fichier ou base, aucune date ni aléa implicite.

## Règles de code

- Avant d'écrire une fonction, vérifier dans `src/index.ts` et les autres modules qu'elle n'existe pas déjà sous un autre nom. Réutiliser ou étendre plutôt que dupliquer.
- Fonctions pures, entrées en lecture seule (`readonly`), pas de mutation des arguments.
- L'aléa passe par une graine explicite (`seed`), jamais par `Math.random()`.
- Les erreurs métier sont des messages en français, compréhensibles par un organisateur.
- Un fichier par notion (`round-robin.ts`, `standings.ts`...), exporté depuis `src/index.ts`.
- Imports relatifs avec l'extension `.js`.

## Tests

Chaque fichier `x.ts` a son `x.test.ts` avec :

1. **Des exemples concrets** tirés du volley : un tournoi à 6 équipes, un tie-break serré, une égalité à trois.
2. **Des tests par propriété** (fast-check) pour chaque invariante. Exemples d'invariantes du domaine :
   - en poule, chaque paire d'équipes se rencontre exactement une fois ;
   - aucune équipe ne joue deux matchs sur le même créneau ;
   - un classement est une permutation des équipes engagées ;
   - en classement intégral, chaque équipe a une place unique entre 1 et N ;
   - un score valide a un vainqueur unique, sauf nul explicitement autorisé.
3. **Les cas limites** : 0, 1 ou 2 équipes, nombre impair, nombre non puissance de 2, égalités parfaites.

Lancer `pnpm --filter @blue-court/engine test` pendant le travail, puis `pnpm check` avant de pousser.
