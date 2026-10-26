# Tournament phases

A tournament is a **sequence of phases**. Each phase has its format, its match rules (see [match-rules.md](match-rules.md)) and a qualification rule for the next one (everyone, the top 2 of each pool plus optionally the 4 best third-placed teams, or the top N of the phase's overall ranking).

| Phase format | How it works | Settings | Matches per team |
| --- | --- | --- | --- |
| Pools (*poules*) | Everyone plays everyone in their pool | Number of pools, seeded or random draw | Pool size minus 1 |
| Level pools (*poules de niveau*) | New pools built from the previous ranking | By rank, or by bands of a maximum pool size | Pool size minus 1 |
| Single elimination | The loser is out | Consolation bracket or not | Varies |
| Double elimination | Winners and losers brackets, out after 2 losses | Grand final reset or not (the winners bracket finalist gets a second chance if it loses the final) | 2 minimum |
| Full placement bracket (*classement intégral*) | Winners go one way, losers the other; every team ends with a unique place | None | log2(N), i.e. 4 for 16 teams |

When teams at the same rank are compared across pools (the best third-placed teams), they are ordered with the phase's tie-breakers.

Typical club format: pools in the morning, then level pools or a full placement bracket in the afternoon.

## Pool draw

- **Seeded draw** (default): seeded teams are dealt in a snake by seed (1 is the strongest): pool 1, 2, 3, then 3, 2, 1, and so on, so the top seeds are never in the same pool. Unseeded teams are then drawn at random and dealt the same way.
- **Random draw**: every team is drawn at random, seeds are ignored.
- The draw is reproducible: it uses a seed stored with the tournament, so the same tournament always gives the same pools.
- When the number of teams does not divide evenly, pool sizes differ by at most one team.
- The number of pools goes from 1 to the number of teams, so a draw needs at least one team.

## Level pools

- **By rank**: all 1st-placed teams together, all 2nd-placed together, and so on. A level pool never holds two teams from the same previous pool.
- **By bands**: the overall ranking across pools is cut into consecutive bands. Bands are as even as possible and never larger than the pool size, larger bands first (13 teams in pools of 4: 4, 3, 3, 3). Since bands are even, a band of a single team (which plays no match) only happens when a single team is left in the phase.
- **Overall ranking across pools**: teams are ordered by their position in their pool, then teams at the same position are compared with the phase's tie-breakers. Head-to-head is skipped since they did not meet. Wins and ranking points are averaged per match played, so teams from pools of different sizes compare fairly; set and point ratios are used as is. Teams still level are listed by team id.

## Cross-cutting rules

- When the number of teams is not a power of 2, the app suggests byes.
- The organizer can manually correct any generated pool or bracket, for example by moving a team to another pool; the following phases are recomputed.
- A pool that a move leaves empty is kept, so the organizer can fill it again.
