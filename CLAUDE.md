# Blue Court

Gestionnaire de tournois de volley paramétrable. Projet public, développé avec une méthode assistée par IA : chaque fonctionnalité part d'une issue, se développe en PR, passe la CI et une revue.

## Où trouver quoi

- `docs/specs/` : la référence fonctionnelle. Lire le fichier concerné avant de coder. Si le code doit s'écarter des specs, modifier les specs dans la même PR.
- `docs/journal/` : journal de bord daté (ce que l'IA a fait, ce qui a été repris à la main, les décisions).
- `packages/engine` : moteur de tournoi en TypeScript pur (aucune dépendance runtime, aucun accès base ou réseau).
- `apps/` : API NestJS et front Next.js, à venir.

## Commandes

- `pnpm install`
- `pnpm build`, `pnpm typecheck`, `pnpm test` (à la racine, via Turborepo)
- `pnpm --filter @blue-court/engine test` pour le moteur seul

## Règles

- Tout est paramétrable : aucune règle de club codée en dur. Les règles FFVB sont des valeurs par défaut.
- Le moteur est une bibliothèque de fonctions pures. Chaque fonction a des tests unitaires et, dès qu'il y a une invariante (chaque paire se rencontre une fois, classement total...), un test par propriété avec fast-check.
- Vocabulaire du domaine en français dans les specs, l'interface et les messages d'erreur ; identifiants de code en anglais.
- Imports relatifs avec l'extension `.js` (ESM, `moduleResolution: NodeNext`).
- Une PR = une issue. Lancer `pnpm build && pnpm typecheck && pnpm test` avant de pousser.

## Vocabulaire

- **Phase** : une étape du tournoi (poules, poules de niveau, élimination directe, double élimination, classement intégral).
- **Poule** : groupe où chacun rencontre tout le monde.
- **Exempt** : équipe qui ne joue pas à un tour faute d'adversaire.
- **Table de marque** : poste qui saisit et valide les scores.
