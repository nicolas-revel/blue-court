---
name: implement-issue
description: Implement a Blue Court GitHub issue end to end, from specs to PR. Use whenever asked to work on, code or ship an issue.
---

# Implement an issue

One issue = one branch = one PR. Follow the steps in order.

1. **Read the issue** and its acceptance criteria. Read the `docs/specs/` file or files it links.
2. **Resolve ambiguity before coding.** If the issue or specs leave a behavior-changing choice open, ask the human with a recommended option. Never invent a volleyball rule.
3. **Search for what already exists** before writing any function: go through `packages/engine/src/index.ts` and neighboring modules, search by domain keywords (`rg -i "pool|ranking|bracket"`), reread related issues and PRs. If a function, type or utility already covers the need, even partly, reuse or extend it instead of creating a new one. Note in the PR what was found and reused.
4. **Create the branch** `issue-<number>-<short-topic>` from an up-to-date `main`.
5. **Write the tests first** (see the `engine-tests` skill for the engine). Run them and check they fail for the right reason.
6. **Implement** the minimum that makes the tests pass. No feature outside the issue.
7. **Check**: `pnpm check` (lint, build, typecheck, tests). Everything must pass.
8. **Update specs and journal** (`specs-and-journal` skill): specs if actual behavior differs or gets clarified, a journal entry in every case.
9. **Review your own diff** with the `review-pr` skill before opening the PR.
10. **Open the PR** with `.github/pull_request_template.md`, with `Closes #<number>` in the description.

## Guardrails

- Never disable, skip or weaken a test to make CI pass.
- Never hard-code a club rule: every setting goes through phase or tournament configuration.
- If the task outgrows the issue (large refactor, new runtime dependency), stop and propose a new issue.
