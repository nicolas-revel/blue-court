---
name: regle-de-lint
description: Transformer une convention du projet en règle vérifiée automatiquement (Biome, plugin GritQL, test) plutôt qu'en texte dans CLAUDE.md. À utiliser dès qu'une nouvelle convention apparaît ou qu'une revue relève une erreur récurrente.
---

# Encoder une convention en règle

Une règle vérifiée par un outil vaut mieux qu'une phrase dans `CLAUDE.md` : elle ne s'oublie pas, elle bloque la CI et elle ne coûte rien en contexte. `CLAUDE.md` garde seulement ce qu'aucun outil ne peut vérifier (intentions, vocabulaire, déroulé).

## Choisir l'outil, dans cet ordre

1. **Règle Biome existante** : chercher dans la liste des règles (`npx biome explain <règle>`) et l'activer dans `biome.json`, avec un `overrides` si elle ne vaut que pour un dossier.
2. **Plugin GritQL** dans `biome-plugins/*.grit` pour un motif de code interdit propre au projet, branché dans `biome.json` (`plugins` ou `overrides[].plugins`). Message d'erreur en français qui dit quoi faire à la place.
3. **TypeScript** (`tsconfig.base.json`) pour ce qui relève du typage.
4. **Test** pour une invariante d'architecture qu'aucun linter n'exprime.
5. **CLAUDE.md** seulement si rien de tout cela ne convient, en une ligne.

## Étapes

1. Écrire un fichier temporaire qui viole la convention et vérifier que la règle le signale (`npx biome lint <fichier>`), puis le supprimer.
2. Vérifier que `pnpm check` passe sur le code existant ; corriger le code si la règle révèle de vraies violations.
3. Retirer de `CLAUDE.md` la phrase devenue inutile, et lister la règle dans `docs/methode.md`.
