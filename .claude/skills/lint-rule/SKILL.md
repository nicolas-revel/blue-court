---
name: lint-rule
description: Turn a project convention into an automatically checked rule (Biome, GritQL plugin, test) instead of text in CLAUDE.md. Use whenever a new convention appears or a review flags a recurring mistake.
---

# Encode a convention as a rule

A rule checked by a tool beats a sentence in `CLAUDE.md`: it cannot be forgotten, it blocks CI and it costs no context. `CLAUDE.md` only keeps what no tool can check (intent, vocabulary, process).

## Pick the tool, in this order

1. **Existing Biome rule**: look it up (`npx biome explain <rule>`) and enable it in `biome.json`, with an `overrides` entry if it only applies to one folder.
2. **GritQL plugin** in `biome-plugins/*.grit` for a project-specific forbidden code pattern, wired in `biome.json` (`plugins` or `overrides[].plugins`). The error message says what to do instead.
3. **TypeScript** (`tsconfig.base.json`) for anything about typing.
4. **Test** for an architectural invariant no linter can express.
5. **CLAUDE.md** only if none of the above fits, in one line.

## Steps

1. Write a temporary file that breaks the convention and check that the rule flags it (`npx biome lint <file>`), then delete it.
2. Check that `pnpm check` passes on the existing code; fix the code if the rule reveals real violations.
3. Remove the now-useless sentence from `CLAUDE.md`, and list the rule in `docs/method.md`.
