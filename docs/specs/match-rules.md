# Match rules and tie-breakers

Each phase has its own rules, prefilled with FFVB rules.

| Setting | Options |
| --- | --- |
| End of match | Sets to win (1, 2 or 3), fixed number of sets, or time limit |
| Time limit on sets | Optional maximum duration for a match played in sets (for example 2 sets to win, 20 minutes max) |
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
- **Time limit reached**: the last set may be unfinished. The team with more sets won takes the match; if sets are level, the team leading the unfinished set wins. If that is level too, the match is a draw when the phase allows it (fixed sets); otherwise the scoring table plays one more point and enters it.
- **Fixed sets, sets level, draw not allowed**: the team with more total points wins. If points are level too, the scoring table plays one more point.
- A forfeit is always valid and won by the other team.

## FFVB defaults

| Setting | Default |
| --- | --- |
| End of match | First to 3 sets (best of five) |
| Points per set | 25, 2-point margin, no cap |
| Tie-break set | 15, 2-point margin |
| Draw | Not possible (sets to win) |
| Time limit on sets | None |
| Ranking points | Win 3-0 or 3-1: 3 / 0; win 3-2: 2 / 1; win by forfeit: 3; forfeit: 0 |
| Pool tie-breakers | Ranking points, then set ratio, then point ratio |
