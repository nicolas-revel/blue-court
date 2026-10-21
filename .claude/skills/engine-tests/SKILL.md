---
name: engine-tests
description: Write or change code in packages/engine with its unit tests and property-based tests (fast-check). Use for any tournament engine function.
---

# Working in the engine

The engine (`packages/engine`) is a library of pure functions. Biome enforces its purity (no external import, no Node module, no `console`, no randomness or clock); keep the rest in mind:

## Code rules

- Before writing a function, check `src/index.ts` and the other modules that it does not already exist under another name. Reuse or extend instead of duplicating.
- Pure functions, read-only inputs (`readonly`), never mutate arguments.
- Randomness goes through an explicit `seed` parameter.
- Errors are typed values or `Error`s with an English message and a stable code; the UI translates them for organizers.
- One file per concept (`round-robin.ts`, `standings.ts`...), exported from `src/index.ts`.

## Tests

Every `x.ts` file has an `x.test.ts` with:

1. **Concrete examples** from volleyball: a 6-team tournament, a close tie-break, a three-way tie.
2. **Property-based tests** (fast-check) for each invariant. Examples of domain invariants:
   - in a pool, every pair of teams meets exactly once;
   - no team plays two matches in the same time slot;
   - a ranking is a permutation of the entered teams;
   - in a full placement bracket, every team has a unique place from 1 to N;
   - a valid score has a single winner, unless a draw is explicitly allowed.
3. **Edge cases**: 0, 1 or 2 teams, odd numbers, non-power-of-2 numbers, perfect ties.

Run `pnpm --filter @blue-court/engine test` while working, then `pnpm check` before pushing.
