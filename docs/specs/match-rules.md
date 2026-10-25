# Match rules and tie-breakers

Each phase has its own rules, prefilled with FFVB rules.

| Setting | Options |
| --- | --- |
| End of match | Sets to win (1, 2 or 3), fixed number of sets, or time limit |
| Maximum duration of a match in sets | Optional, for "sets to win" and "fixed sets" matches only (for example 2 sets to win, 20 minutes max). Unlike a timed match, the score stays set by set; the scoring table marks the match as stopped by time |
| Points per set | Any (15, 21, 25...), 2-point margin or not, optional cap |
| Tie-break set | Yes or no, number of points (rules of the deciding set, so only for "sets to win" matches with at least 2 sets to win) |
| Draw | Allowed or not, for fixed sets and timed matches (a "sets to win" match cannot end in a draw) |
| Ranking points | For a win, a loss, a win or loss in the deciding set, a draw, a win by forfeit and a forfeit. The deciding set is the last possible set of a "sets to win" match with at least 2 sets to win (3-2 when 3 sets are needed, 2-1 when 2 are); one-set matches and other formats have none |
| Pool tie-breakers | Order chosen among: wins, ranking points, set ratio, point ratio, head-to-head, random draw |
| Forfeit in ratios | A forfeit counts as the shortest possible win for the other team, every set won to 0 (3-0 and 25-0 per set under FFVB); a timed match counts as a win to 0 |
| Refereeing | Automatic assignment of a resting team, or none |

## Score validation

A score is accepted only if it can happen under the phase's rules; otherwise the scoring table gets an error naming the problem and the set.

- A set ends as soon as a team reaches the points to win with a 2-point margin (if required), or reaches the cap. Any score past that point is impossible.
- No set can be played once a team has won the match, and a match in sets is only complete when a team has won it (sets to win) or every set is played (fixed sets).
- **Time limit reached**: the last set may be unfinished. The team with more sets won takes the match; if sets are level, the team leading the unfinished set wins. If that is level too, the match is a draw when the phase allows it (fixed sets); otherwise the scoring table plays one more point and enters it. Total points never decide a match stopped by time.
- **Fixed sets, sets level, draw not allowed**: the team with more total points wins. If points are level too, the scoring table plays one more point.
- A forfeit is always valid and won by the other team.

## Pool standings

The standings are recomputed from the pool's validated scores; a match without a score is ignored, and an invalid score is refused.

- Each team's row shows matches played, wins, draws, losses, ranking points, sets won and lost, points won and lost.
- Only finished sets count in the set totals: the unfinished last set of a match stopped by time adds its points but no set. A forfeit counts as described in "Forfeit in ratios"; a forfeited timed match adds no points.
- A match stopped by time during the deciding set gives the ranking points of a regular win or loss: the tie-break points need the deciding set to be played out.
- A ratio is won over lost. A team that lost nothing is ahead of every team that lost something; a team with nothing won or lost has a ratio of 0.
- Tie-breakers are applied in the phase's order, only to the teams still level.
- **Head-to-head**: the ranking points earned in the matches between the level teams only (a mini-league when three or more are level). If that separates some of them, it is applied again within each smaller group still level, before moving to the next tie-breaker.
- **Random draw**: reproducible from a seed stored with the tournament, so the standings never change between two views. The seed is required when the phase uses a random draw.
- Teams still level after every tie-breaker share the same rank, and the next rank is skipped (1, 2, 2, 4). They are listed in a fixed order (by team id) that does not depend on how teams or matches were entered.
- The standings are refused, with a stable code, when a score is invalid (`INVALID_SCORE`), a match involves a team outside the pool (`UNKNOWN_TEAM`) or the same team on both sides (`SAME_TEAM`), a team is listed twice (`DUPLICATE_TEAM`), or a random draw has no seed (`SEED_REQUIRED`).

## FFVB defaults

| Setting | Default |
| --- | --- |
| End of match | First to 3 sets (best of five) |
| Points per set | 25, 2-point margin, no cap |
| Tie-break set | 15, 2-point margin |
| Draw | Not possible (sets to win) |
| Maximum duration of a match in sets | None |
| Ranking points | Win 3-0 or 3-1: 3 / 0; win 3-2: 2 / 1; win by forfeit: 3; forfeit: 0 |
| Pool tie-breakers | Ranking points, then set ratio, then point ratio |
