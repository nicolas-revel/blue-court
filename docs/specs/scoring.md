# Score entry

The scoring table remains the source of truth, but scores can also be entered from a phone.

- **Scoring table**: a screen listing ongoing matches by court, with fast set-by-set entry.
- **Phone entry** (tournament option): the referee or a captain enters the score with a code tied to the match or court. The scoring table validates or corrects it.
- **Live score** (option): point-by-point entry on a phone, so spectators can follow the ongoing match.
- Every correction is recorded and recomputes the rankings.
- Every entered score is checked against the phase rules (see [match-rules.md](match-rules.md#score-validation)). An invalid score is refused with a message naming the problem and the set.
- When a time limit stops a match, the scoring table marks it as stopped by time and enters the score of the unfinished set.
