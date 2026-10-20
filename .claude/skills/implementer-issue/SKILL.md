---
name: implementer-issue
description: Implémenter une issue GitHub de Blue Court de bout en bout, des specs à la PR. À utiliser dès qu'on demande de traiter, coder ou livrer une issue.
---

# Implémenter une issue

Une issue = une branche = une PR. Suivre les étapes dans l'ordre.

1. **Lire l'issue** et ses critères d'acceptation. Lire le ou les fichiers de `docs/specs/` qu'elle cite.
2. **Lever les ambiguïtés avant de coder.** Si l'issue ou les specs laissent un choix ouvert qui change le comportement, poser la question à l'humain avec une option recommandée. Ne pas inventer de règle de volley.
3. **Chercher ce qui existe déjà** avant d'écrire la moindre fonction : parcourir `packages/engine/src/index.ts` et les modules voisins, chercher par mots-clés du domaine (`rg -i "poule|classement|ranking"`), relire les issues et PR liées. Si une fonction, un type ou un utilitaire couvre déjà le besoin, même en partie, le réutiliser ou l'étendre plutôt que d'en créer un nouveau. Noter dans la PR ce qui a été trouvé et réutilisé.
4. **Créer la branche** `issue-<numéro>-<sujet-court>` depuis `main` à jour.
5. **Écrire les tests d'abord** (voir le skill `moteur-tests` pour le moteur). Les lancer et vérifier qu'ils échouent pour la bonne raison.
6. **Implémenter** le minimum qui fait passer les tests. Pas de fonctionnalité hors issue.
7. **Vérifier** : `pnpm check` (lint, build, typecheck, tests). Tout doit passer.
8. **Mettre à jour specs et journal** (skill `specs-et-journal`) : specs si le comportement réel diffère ou se précise, une entrée de journal dans tous les cas.
9. **Relire son propre diff** avec le skill `revue-pr` avant d'ouvrir la PR.
10. **Ouvrir la PR** avec le modèle `.github/pull_request_template.md`, `Closes #<numéro>` dans la description.

## Garde-fous

- Ne jamais désactiver, sauter ou affaiblir un test pour faire passer la CI.
- Ne jamais coder en dur une règle de club : tout réglage passe par la configuration de la phase ou du tournoi.
- Si la tâche dépasse l'issue (refactor large, nouvelle dépendance runtime), s'arrêter et proposer une nouvelle issue.
