---
name: review-pr
description: Review a Blue Court PR or diff against the project checklist. Use before opening a PR and for the automated review in CI.
---

# PR review

Read the full diff, then check in this order. Only flag real problems, with file, line and a proposed fix.

## Blocking

- **Reimplementation**: a function, type or utility that already exists in the repo (or in an installed dependency) and is rewritten instead of reused.
- **Correctness**: does the code do what the issue and specs say? Look for a concrete case that breaks it (tie, odd number of teams, zero teams, boundary score).
- **Hard-coded rule**: a volleyball value (25 points, 3 sets, 2-point margin...) that should come from configuration.
- **Tests**: an invariant without a property-based test, a weakened or deleted test, an uncovered edge case.
- **Specs and journal**: behavior changed without updating `docs/specs/`, PR without a journal entry.

## Raise

- A mistake a lint rule could have prevented: propose the rule (`lint-rule` skill).

## Non-blocking

- Readability, naming, avoidable duplication.

End with a one-line verdict: "Ready to merge", "Ready after minor fixes" or "Needs rework", with the reason.
