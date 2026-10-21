---
name: write-spec
description: Write or evolve a Blue Court functional spec in docs/specs, then split it into issues. Use for any new feature or behavior change, before code.
---

# Write a spec

## Process

1. **Understand the request** and find the `docs/specs/` file or files involved.
2. **Explore what exists**: neighboring specs, engine code, open issues. A spec must not contradict or duplicate another one.
3. **Grill the human** with the `grill` skill until the behavior is unambiguous.
4. **Write the spec** in `docs/specs/<topic>.md` (create the file or extend the existing one, and list it in `docs/specs/README.md`) using this outline:

   ```markdown
   # <Topic>

   <One or two sentences: what the organizer or player can do.>

   ## Behavior
   ## Settings (parameters and FFVB defaults)
   ## Edge cases
   ## Examples (concrete tournaments, with numbers)
   ## Out of scope
   ```

   Describe behavior, never implementation. Every setting has a default.
5. **Get the spec approved** by the human, in a dedicated PR or in the feature's PR.
6. **Split into vertical issues**: each issue delivers one end-to-end testable behavior, with acceptance criteria and a link to the spec section. Propose the split to the human before creating the issues.
