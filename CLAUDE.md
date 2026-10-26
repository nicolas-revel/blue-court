# Blue Court

A configurable volleyball tournament manager. Public project, built with an AI-assisted method: every feature starts from an issue, is developed in a PR, passes CI and a review.

## Where things are

- `docs/specs/`: the functional source of truth. Read the relevant file before coding. If the code must depart from the specs, update the specs in the same PR.
- `docs/journal/`: dated build journal (what the AI did, what was taken over by hand, decisions).
- `docs/method.md`: the working method and the role of each harness component.
- `.claude/skills/`: `grill`, `write-spec`, `implement-issue`, `engine-tests`, `lint-rule`, `specs-and-journal`, `review-pr`.
- `packages/engine`: tournament engine in pure TypeScript.
- `apps/api`: NestJS API (PostgreSQL through Prisma, WebSocket gateway).
- `apps/web`: Next.js front end (Tailwind, shadcn/ui, PWA), UI in French through `messages/fr.json`.
- `docs/deployment.md`: Docker Compose, locally and on the VPS behind Caddy.

## Commands

- `pnpm install`
- `pnpm check`: lint, build, typecheck and tests; run before every push
- `pnpm lint:fix`: fixes formatting and imports (Biome)
- `pnpm --filter @blue-court/engine test` for the engine only

## Rules

- Always check that something does not already exist (in the engine, the apps or installed dependencies) before implementing it. Reuse or extend instead of duplicating.
- Everything is configurable: no hard-coded club rule. FFVB rules are defaults.
- The engine is a library of pure functions, tested with examples and property-based tests (`engine-tests` skill).
- Everything in the repo is in English (code, docs, specs, commits). Only the product UI is in French, through translations.
- A convention a tool can check becomes a rule (Biome, GritQL plugin, test), not a line in this file: `lint-rule` skill. Biome already enforces `.js` import extensions, no non-null `!`, and engine purity (no external import, no Node, no console, no randomness or clock).
- New feature: `grill` then `write-spec` before code.
- One PR = one issue, following the `implement-issue` skill. `pnpm check` must pass before pushing.

## Domain vocabulary

French UI terms in parentheses.

- **Phase**: one stage of the tournament (pools, level pools, single elimination, double elimination, full placement bracket).
- **Pool** (*poule*): a group where everyone plays everyone.
- **Level pools** (*poules de niveau*): pools rebuilt from a previous ranking.
- **Full placement bracket** (*classement intégral*): bracket where every team plays log2(N) matches and gets a unique place.
- **Bye** (*exempt*): a team that does not play in a round for lack of an opponent.
- **Scoring table** (*table de marque*): the desk that enters and validates scores.
