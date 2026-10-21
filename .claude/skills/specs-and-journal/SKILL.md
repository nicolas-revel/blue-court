---
name: specs-and-journal
description: Update docs/specs and add an entry to the Blue Court build journal. Use at the end of every issue, or when a functional decision is made.
---

# Specs and build journal

## Specs (`docs/specs/`)

- Specs describe the intended behavior, without implementation details.
- If the code departs from or clarifies the specs (a tie-breaker rule made precise, an edge case settled), update the relevant file **in the same PR**.
- A question still open goes in `out-of-scope.md`, under "Open questions".

## Journal (`docs/journal/YYYY-MM-DD.md`)

The journal is public: it shows how the project is built with AI. One entry per PR, added to the day's file (create it if missing):

```markdown
## <PR title> (#<issue number>)

- **Done by the AI**: what the agent produced (code, tests, specs).
- **Taken over by hand**: what the human corrected or decided, and why.
- **Decisions**: functional or technical choices made along the way.
- **What got stuck**: agent mistakes, ambiguities, wasted time. Stay honest; that is the point of the journal.
```

Keep it factual and short: 3 to 6 lines per entry.
