# Schedule and courts

The organizer sets the courts, the start time, the estimated match duration and the break between two matches. The app generates a schedule that never puts a team in two places at once, avoids a team playing two matches in a row and spreads rest time.

## Planning

- Whenever a court frees up, it takes the next match that can start: its teams are free (break included) and the matches it waits for (the matches feeding a bracket match) are over. Matches keep their given order (pool rounds, bracket rounds) unless that would make a team play two matches in a row.
- A team plays two matches in a row only when no other match is ready for that court: a court never stays empty just to give a team more rest.
- A bracket match whose teams are not known yet is placed after the matches that feed it.

## During the day

- The schedule adjusts itself when a match ends early or late. A match that started keeps its real times, and a match still being played is expected to end no earlier than now. The other matches keep their court and their order on it, and start once their court, their teams and the matches they wait for are free, never before now. When the scoring table starts a match ahead of its turn, the matches it skipped on that court come after it.
- Whether a match can start before its planned time when everything ends early is a setting. Without it, planned times are only pushed back.
- The organizer can move a match to another court or time slot. The moved match never starts before its new time, even when early starts are allowed, and the matches around it then adjust.
- A court can be removed during the day: its remaining matches are spread over the other courts, the least loaded first, then the schedule adjusts.

## Refereeing

When the phase uses resting teams as referees, each match gets a team that plays no match at the same time and does not referee another one then. A team of the same pool is taken first, then the team that refereed the fewest matches so far. A match gets no referee when no team is free; matches that already started keep their referee. A bracket match only knows its teams once earlier results are in, so referees are best assigned again after each adjustment.

## Refused inputs

Scheduling refuses a call that cannot give a sound schedule: no court, a court listed twice or unknown, a duration or time that is not a number (match length, break, start, `now`, a removal or referee start time), a match listed twice in the matches or in the schedule, a match unknown to the schedule, a match between a team and itself, and matches that wait for each other in a cycle.
