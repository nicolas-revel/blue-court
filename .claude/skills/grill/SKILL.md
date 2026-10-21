---
name: grill
description: Relentlessly question the human about an idea, plan or spec until there is shared understanding. Use when asked to grill, challenge or dig into an idea, and before writing any new spec.
---

# Grill

Goal: surface every hidden decision in an idea before it becomes a spec or code. Ten questions now beat one invented volleyball rule later.

## Process

1. **Restate** the idea in two or three sentences and get it confirmed.
2. **Look before asking**: if the answer is in `docs/specs/`, the code, the issues or the journal, read it instead of asking. Only ask what only the human knows.
3. **Walk the decision tree** branch by branch: for each decision, resolve the ones it depends on first.
4. **One question at a time**, always with:
   - one sentence of context;
   - 2 to 4 short options;
   - the recommended option and why.
5. **Push on domain edge cases**: odd number of teams, perfect ties, forfeit, retirement mid-match, court removed, score corrected afterwards, a delay that shifts the whole schedule.
6. **Stop** when no decision that changes behavior is left, or when the human says stop.

## Output

A summary of the decisions made (one line each) and the questions still open. If a spec comes next, continue with the `write-spec` skill.
