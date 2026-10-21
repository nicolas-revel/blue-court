# Blue Court

Gestionnaire de tournois de volley paramétrable. Projet public, développé avec une méthode assistée par IA : chaque fonctionnalité part d'une issue, se développe en PR, passe la CI et une revue.

## Où trouver quoi

- `docs/specs/` : la référence fonctionnelle. Lire le fichier concerné avant de coder. Si le code doit s'écarter des specs, modifier les specs dans la même PR.
- `docs/journal/` : journal de bord daté (ce que l'IA a fait, ce qui a été repris à la main, les décisions).
- `docs/methode.md` : la méthode de travail et le rôle de chaque élément du harness.
- `.claude/skills/` : `grill`, `creer-spec`, `implementer-issue`, `moteur-tests`, `regle-de-lint`, `specs-et-journal`, `revue-pr`.
- `packages/engine` : moteur de tournoi en TypeScript pur (aucune dépendance runtime, aucun accès base ou réseau).
- `apps/` : API NestJS et front Next.js, à venir.

## Commandes

- `pnpm install`
- `pnpm check` : lint, build, typecheck et tests, à lancer avant chaque push
- `pnpm lint:fix` : corrige le formatage et les imports (Biome)
- `pnpm build`, `pnpm typecheck`, `pnpm test` (à la racine, via Turborepo)
- `pnpm --filter @blue-court/engine test` pour le moteur seul

## Règles

- Toujours vérifier que quelque chose n'existe pas déjà (dans le moteur, les apps ou les dépendances installées) avant de l'implémenter. Réutiliser ou étendre plutôt que dupliquer.
- Tout est paramétrable : aucune règle de club codée en dur. Les règles FFVB sont des valeurs par défaut.
- Le moteur est une bibliothèque de fonctions pures, testée par des exemples et des tests par propriété (skill `moteur-tests`).
- Vocabulaire du domaine en français dans les specs, l'interface et les messages d'erreur ; identifiants de code en anglais.
- Une convention vérifiable par un outil devient une règle (Biome, plugin GritQL, test), pas une ligne de ce fichier : skill `regle-de-lint`. Biome impose déjà les extensions `.js`, l'absence de `!` non nul, et la pureté du moteur (aucun import externe, ni Node, ni console, ni aléa ou horloge).
- Nouvelle fonctionnalité : `grill` puis `creer-spec` avant le code.
- Une PR = une issue, en suivant le skill `implementer-issue`. `pnpm check` doit passer avant de pousser.

## Vocabulaire

- **Phase** : une étape du tournoi (poules, poules de niveau, élimination directe, double élimination, classement intégral).
- **Poule** : groupe où chacun rencontre tout le monde.
- **Exempt** : équipe qui ne joue pas à un tour faute d'adversaire.
- **Table de marque** : poste qui saisit et valide les scores.
