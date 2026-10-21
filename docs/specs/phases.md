# Tournament phases

A tournament is a **sequence of phases**. Each phase has its format, its match rules (see [match-rules.md](match-rules.md)) and a qualification rule for the next one (everyone, the top 2 of each pool plus optionally the 4 best third-placed teams, or the top N of the phase's overall ranking).

| Phase format | How it works | Settings | Matches per team |
| --- | --- | --- | --- |
| Pools (*poules*) | Everyone plays everyone in their pool | Number of pools | Pool size minus 1 |
| Level pools (*poules de niveau*) | New pools built from the previous ranking | Pool size | Pool size minus 1 |
| Single elimination | The loser is out | Consolation bracket or not | Varies |
| Double elimination | Winners and losers brackets, out after 2 losses | Grand final reset or not (the winners bracket finalist gets a second chance if it loses the final) | 2 minimum |
| Full placement bracket (*classement intégral*) | Winners go one way, losers the other; every team ends with a unique place | None | log2(N), i.e. 4 for 16 teams |

When teams at the same rank are compared across pools (the best third-placed teams), they are ordered with the phase's tie-breakers.

Typical club format: pools in the morning, then level pools or a full placement bracket in the afternoon.

## Cross-cutting rules

- When the number of teams is not a power of 2, the app suggests byes.
- The organizer can manually correct any generated pool or bracket; the following phases are recomputed.
