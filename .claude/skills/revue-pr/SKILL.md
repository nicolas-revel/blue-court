---
name: revue-pr
description: Relire une PR ou un diff de Blue Court selon la grille du projet. À utiliser avant d'ouvrir une PR et pour la revue automatique en CI.
---

# Revue de PR

Relire le diff complet, puis vérifier dans cet ordre. Ne signaler que des problèmes réels, avec le fichier, la ligne et une correction proposée.

## Bloquant

- **Correction** : le code fait-il ce que disent l'issue et les specs ? Chercher un cas concret qui casse (égalité, nombre impair, 0 équipe, score limite).
- **Règle codée en dur** : une valeur de volley (25 points, 3 sets, 2 points d'écart...) qui devrait venir de la configuration.
- **Pureté du moteur** : dépendance runtime, `Math.random()`, `Date.now()`, mutation d'un argument, accès I/O dans `packages/engine`.
- **Tests** : invariante sans test par propriété, test affaibli ou supprimé, cas limite non couvert.
- **Specs et journal** : comportement modifié sans mise à jour de `docs/specs/`, PR sans entrée de journal.

## Non bloquant

- Lisibilité, nommage (identifiants en anglais, messages en français), duplication évitable.

Terminer par un verdict en une ligne : « Prête à fusionner », « Prête après corrections mineures » ou « À reprendre », avec la raison.
