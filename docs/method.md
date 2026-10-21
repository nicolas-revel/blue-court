# Method: building Blue Court with AI

Blue Court is built with Claude Code. This repo shows the method as much as the product: everything that guides the agent is versioned here.

## The work loop

1. **Specs** (`docs/specs/`): the intended behavior, written with the human before code. The agent first grills the human (`grill` skill), one question at a time, then writes the spec (`write-spec` skill).
2. **Issue**: one feature, its acceptance criteria, a link to the specs.
3. **Agent**: Claude Code works the issue with the `implement-issue` skill: search for existing code, tests first, minimal code, checks.
4. **Automatic guardrails**: formatting on every edit (hook), lint rules, CI (lint, build, typecheck, tests), PR review by Claude.
5. **Human review**: the human reads, decides, merges.
6. **Journal** (`docs/journal/`): what the AI did, what was taken over by hand, what got stuck.

## The harness

| Component | Role |
| --- | --- |
| `CLAUDE.md` | Conventions, commands and domain vocabulary, read by the agent every session |
| `.claude/skills/grill` | Question the human until no decision stays implicit |
| `.claude/skills/write-spec` | Write the spec and split it into vertical issues |
| `.claude/skills/implement-issue` | The full path from an issue to a PR |
| `.claude/skills/engine-tests` | Pure engine rules and property-based tests |
| `.claude/skills/lint-rule` | Turn a convention into a checked rule instead of text |
| `.claude/skills/specs-and-journal` | Keep specs and the journal up to date |
| `.claude/skills/review-pr` | The review checklist, used by the agent and by CI |
| `biome.json` + `biome-plugins/` | Checked rules: `.js` extensions, no non-null `!`, engine with no dependency, no Node, no console, no randomness or clock |
| `.claude/settings.json` | Agent permissions and hooks (formatting, install in cloud sessions) |
| `.github/workflows/ci.yml` | Lint, build, typecheck, tests on every PR |
| `.github/workflows/claude-review.yml` | Automatic review of every PR by Claude |
| `.github/pull_request_template.md` | Reminds about reused code, specs, journal and checks |

## Rules rather than text

Every convention a tool can check is encoded as a lint rule or a test, and removed from `CLAUDE.md`. The agent cannot forget it, CI blocks it, and `CLAUDE.md` stays short: it only carries what no tool can check (intent, vocabulary, process).

## Why property-based tests

A tournament engine has many invariants (every pair meets once, every team gets a unique place...). A property-based test checks the invariant on hundreds of generated cases: the best safety net for agent-written code, which can pass hand-written examples and still miss an edge case.

## Language

Everything in the repo is in English, including the harness. Benchmarks show Claude performs close to its English level in French (about 97 to 98% on Anthropic's multilingual evaluations), so this is a choice of professional convention and audience more than of model performance.
