import { EngineError } from "./errors.js";
import type { TeamId } from "./model.js";
import { byTeamId } from "./random.js";

export type ScheduleErrorCode =
  | "NO_COURT"
  | "DUPLICATE_COURT"
  | "UNKNOWN_COURT"
  | "INVALID_DURATION"
  | "DUPLICATE_MATCH"
  | "UNKNOWN_MATCH"
  | "SAME_TEAM"
  | "CYCLE";

/** Thrown when a schedule cannot be built or changed. */
export class ScheduleError extends EngineError<ScheduleErrorCode> {}

/** A match to place on a court. */
export interface SchedulableMatch {
  readonly id: string;
  /** Teams known so far: a bracket match does not know its teams before earlier results. */
  readonly teams: readonly TeamId[];
  /** Matches that must end first, such as the matches feeding a bracket match. */
  readonly after?: readonly string[];
  /** Group the match belongs to (a pool): referees are taken from the same group first. */
  readonly group?: string;
}

/** Times are in minutes from any origin chosen by the caller (minutes since midnight, say). */
export interface ScheduleSettings {
  /** Court ids, in the order they are filled. */
  readonly courts: readonly string[];
  readonly start: number;
  /** Estimated duration of a match. */
  readonly matchMinutes: number;
  /** Time between two matches, on a court and for a team. */
  readonly breakMinutes: number;
}

export interface ScheduledMatch {
  readonly match: string;
  readonly court: string;
  readonly start: number;
  readonly end: number;
  /** Resting team that referees the match, when refereeing is on. */
  readonly referee?: TeamId;
  /** Set when the organizer moved the match: it never starts earlier, even with early starts. */
  readonly notBefore?: number;
}

function validateSettings(settings: ScheduleSettings): void {
  if (settings.courts.length === 0) throw new ScheduleError("NO_COURT", "at least one court");
  if (new Set(settings.courts).size !== settings.courts.length) {
    throw new ScheduleError("DUPLICATE_COURT", "each court must appear once");
  }
  const { start, matchMinutes, breakMinutes } = settings;
  const finite = [start, matchMinutes, breakMinutes].every(Number.isFinite);
  if (!finite || matchMinutes <= 0 || breakMinutes < 0) {
    throw new ScheduleError(
      "INVALID_DURATION",
      "the start must be a number, the match duration positive and the break not negative",
    );
  }
}

function indexMatches(matches: readonly SchedulableMatch[]): Map<string, SchedulableMatch> {
  const byId = new Map<string, SchedulableMatch>();
  for (const match of matches) {
    if (byId.has(match.id)) {
      throw new ScheduleError("DUPLICATE_MATCH", `match ${match.id} appears twice`);
    }
    if (new Set(match.teams).size !== match.teams.length) {
      throw new ScheduleError("SAME_TEAM", `match ${match.id} lists a team twice`);
    }
    byId.set(match.id, match);
  }
  for (const match of matches) {
    for (const id of match.after ?? []) {
      if (!byId.has(id)) {
        throw new ScheduleError("UNKNOWN_MATCH", `match ${match.id} waits for unknown match ${id}`);
      }
    }
  }
  return byId;
}

/** Earliest start on a court, then court order: the order the scoring table calls matches. */
const byStart =
  (courts: readonly string[]) =>
  (a: ScheduledMatch, b: ScheduledMatch): number =>
    a.start - b.start || courts.indexOf(a.court) - courts.indexOf(b.court);

/**
 * Places every match on a court, as early as possible: whenever a court frees up, it takes the
 * first match (in the given order) whose teams and earlier matches are done, preferring matches
 * whose teams did not play in the previous slot. A court never stays idle to avoid back-to-back
 * matches, so they only happen when no other match is ready.
 */
export function planSchedule(input: {
  readonly matches: readonly SchedulableMatch[];
  readonly settings: ScheduleSettings;
}): ScheduledMatch[] {
  const { matches, settings } = input;
  validateSettings(settings);
  indexMatches(matches);
  const { courts, matchMinutes, breakMinutes } = settings;
  const courtFree = new Map(courts.map((court) => [court, settings.start]));
  const lastEnd = new Map<TeamId, number>();
  const ends = new Map<string, number>();
  const out: ScheduledMatch[] = [];
  let remaining = [...matches];

  /** Earliest start allowed by the match's teams and earlier matches; undefined while waiting. */
  const earliest = (match: SchedulableMatch): number | undefined => {
    let time = Number.NEGATIVE_INFINITY;
    for (const id of match.after ?? []) {
      const end = ends.get(id);
      if (end === undefined) return undefined;
      time = Math.max(time, end + breakMinutes);
    }
    for (const team of match.teams) {
      const end = lastEnd.get(team);
      if (end !== undefined) time = Math.max(time, end + breakMinutes);
    }
    return time;
  };
  /** Shortest rest of the match's teams before `time`; a team that has not played is rested. */
  const rest = (match: SchedulableMatch, time: number) =>
    Math.min(
      Number.POSITIVE_INFINITY,
      ...match.teams.map((team) => time - (lastEnd.get(team) ?? Number.NEGATIVE_INFINITY)),
    );

  while (remaining.length > 0) {
    let court = courts[0] ?? "";
    for (const c of courts) {
      if ((courtFree.get(c) ?? 0) < (courtFree.get(court) ?? 0)) court = c;
    }
    const time = courtFree.get(court) ?? settings.start;
    const ready = remaining.filter((m) => {
      const at = earliest(m);
      return at !== undefined && at <= time;
    });
    if (ready.length === 0) {
      const starts = remaining.map(earliest).filter((t): t is number => t !== undefined);
      if (starts.length === 0) {
        throw new ScheduleError("CYCLE", "some matches wait for each other");
      }
      courtFree.set(court, Math.min(...starts));
      continue;
    }
    // A team rested if it sat out at least one match since its last one.
    const rested = ready.find((m) => rest(m, time) >= matchMinutes + breakMinutes);
    const pick = rested ?? ready.reduce((best, m) => (rest(m, time) > rest(best, time) ? m : best));
    const end = time + matchMinutes;
    out.push({ match: pick.id, court, start: time, end });
    ends.set(pick.id, end);
    for (const team of pick.teams) lastEnd.set(team, end);
    courtFree.set(court, end + breakMinutes);
    remaining = remaining.filter((m) => m !== pick);
  }
  return out.sort(byStart(courts));
}

/** Real times of a match that started; `end` is absent while it is being played. */
export interface ActualTimes {
  readonly match: string;
  readonly start: number;
  readonly end?: number;
}

/**
 * Moves the schedule to real times. Matches that started keep their real times; a match still
 * being played is expected to end at `now` at the earliest. Every other match keeps its court
 * and its order on the court, and starts once its court, its teams and its earlier matches are
 * free, never before `now`. With `earlyStart`, a match can start before its planned time when
 * everything ends early; without it, planned times are only pushed back.
 */
export function adjustSchedule(input: {
  readonly schedule: readonly ScheduledMatch[];
  readonly matches: readonly SchedulableMatch[];
  readonly settings: ScheduleSettings;
  readonly actual: readonly ActualTimes[];
  readonly now: number;
  readonly earlyStart: boolean;
}): ScheduledMatch[] {
  const { schedule, settings, now } = input;
  validateSettings(settings);
  const times = [now, ...input.actual.flatMap((a) => [a.start, a.end ?? a.start])];
  if (!times.every(Number.isFinite)) {
    throw new ScheduleError("INVALID_DURATION", "now and real times must be numbers");
  }
  const byId = indexMatches(input.matches);
  const { courts, matchMinutes, breakMinutes } = settings;
  const planned = new Map(schedule.map((entry) => [entry.match, entry]));
  for (const entry of schedule) {
    if (!byId.has(entry.match)) {
      throw new ScheduleError("UNKNOWN_MATCH", `match ${entry.match} is not in the matches`);
    }
    if (!courts.includes(entry.court)) {
      throw new ScheduleError("UNKNOWN_COURT", `match ${entry.match} is on unknown court`);
    }
  }
  const real = new Map<string, ActualTimes>();
  for (const times of input.actual) {
    if (!planned.has(times.match)) {
      throw new ScheduleError("UNKNOWN_MATCH", `match ${times.match} is not in the schedule`);
    }
    if (real.has(times.match)) {
      throw new ScheduleError("DUPLICATE_MATCH", `match ${times.match} has two real times`);
    }
    if (times.end !== undefined && times.end < times.start) {
      throw new ScheduleError("INVALID_DURATION", `match ${times.match} ends before it starts`);
    }
    real.set(times.match, times);
  }

  const courtFree = new Map<string, number>();
  const teamFree = new Map<TeamId, number>();
  const ends = new Map<string, number>();
  const out: ScheduledMatch[] = [];
  const place = (entry: ScheduledMatch, start: number, end: number) => {
    out.push({ ...entry, start, end });
    ends.set(entry.match, end);
    const free = end + breakMinutes;
    courtFree.set(entry.court, Math.max(courtFree.get(entry.court) ?? free, free));
    for (const team of byId.get(entry.match)?.teams ?? []) {
      teamFree.set(team, Math.max(teamFree.get(team) ?? free, free));
    }
  };

  const ordered = [...schedule].sort(byStart(courts));
  for (const entry of ordered) {
    const times = real.get(entry.match);
    if (times !== undefined) {
      place(entry, times.start, times.end ?? Math.max(times.start + matchMinutes, now));
    }
  }
  // Planned order, except that a match waits until the matches it waits for are placed.
  let pending = ordered.filter((entry) => !real.has(entry.match));
  while (pending.length > 0) {
    const entry = pending.find((e) =>
      (byId.get(e.match)?.after ?? []).every((id) => ends.has(id) || !planned.has(id)),
    );
    if (entry === undefined) throw new ScheduleError("CYCLE", "some matches wait for each other");
    pending = pending.filter((e) => e !== entry);
    const match = byId.get(entry.match);
    const waits = (match?.after ?? []).map(
      (id) => (ends.get(id) ?? Number.NEGATIVE_INFINITY) + breakMinutes,
    );
    const start = Math.max(
      now,
      input.earlyStart ? Number.NEGATIVE_INFINITY : entry.start,
      entry.notBefore ?? Number.NEGATIVE_INFINITY,
      courtFree.get(entry.court) ?? Number.NEGATIVE_INFINITY,
      ...(match?.teams ?? []).map((team) => teamFree.get(team) ?? Number.NEGATIVE_INFINITY),
      ...waits,
    );
    place(entry, start, start + matchMinutes);
  }
  return out.sort(byStart(courts));
}

/**
 * Moves a match to another court or time, as the organizer decides. The match keeps its
 * duration and never starts before the new time, even with early starts; run `adjustSchedule`
 * afterwards to shift the matches around it.
 */
export function moveMatch(
  schedule: readonly ScheduledMatch[],
  match: string,
  to: { readonly court: string; readonly start: number },
  courts: readonly string[],
): ScheduledMatch[] {
  if (!courts.includes(to.court)) {
    throw new ScheduleError("UNKNOWN_COURT", `court ${to.court} is not in the courts`);
  }
  if (!Number.isFinite(to.start)) {
    throw new ScheduleError("INVALID_DURATION", "the new start must be a number");
  }
  const entry = schedule.find((e) => e.match === match);
  if (entry === undefined) {
    throw new ScheduleError("UNKNOWN_MATCH", `match ${match} is not in the schedule`);
  }
  const moved = {
    ...entry,
    court: to.court,
    start: to.start,
    end: to.start + entry.end - entry.start,
    notBefore: to.start,
  };
  return schedule.map((e) => (e === entry ? moved : e));
}

/**
 * Takes a court out of the schedule from `from` on: its matches planned from then are spread
 * over the remaining courts, the least loaded first, keeping their planned times; run
 * `adjustSchedule` afterwards with the remaining courts to fit them in.
 */
export function removeCourt(input: {
  readonly schedule: readonly ScheduledMatch[];
  readonly court: string;
  readonly courts: readonly string[];
  readonly from: number;
}): ScheduledMatch[] {
  const { schedule, court, from } = input;
  const remaining = input.courts.filter((c) => c !== court);
  if (!input.courts.includes(court)) {
    throw new ScheduleError("UNKNOWN_COURT", `court ${court} is not in the courts`);
  }
  if (remaining.length === 0) throw new ScheduleError("NO_COURT", "at least one court must stay");
  const load = new Map(
    remaining.map((c) => [c, schedule.filter((e) => e.court === c && e.start >= from).length]),
  );
  const moved = new Map<string, string>();
  const toMove = schedule
    .filter((e) => e.court === court && e.start >= from)
    .sort((a, b) => a.start - b.start);
  for (const entry of toMove) {
    let target = remaining[0] ?? court;
    for (const c of remaining) if ((load.get(c) ?? 0) < (load.get(target) ?? 0)) target = c;
    load.set(target, (load.get(target) ?? 0) + 1);
    moved.set(entry.match, target);
  }
  return schedule.map((e) => {
    const target = moved.get(e.match);
    return target === undefined ? e : { ...e, court: target };
  });
}

/**
 * Gives each match from `from` on a referee: a team that plays no match overlapping it and does
 * not referee another one at the same time, taken from the match's group first, then the team
 * with the fewest matches refereed so far, then by id. Earlier matches keep their referee. A
 * match gets no referee when no team is free.
 */
export function assignReferees(input: {
  readonly schedule: readonly ScheduledMatch[];
  readonly matches: readonly SchedulableMatch[];
  readonly from?: number;
}): ScheduledMatch[] {
  const byId = indexMatches(input.matches);
  const from = input.from ?? Number.NEGATIVE_INFINITY;
  const teams = [...new Set(input.matches.flatMap((m) => m.teams))].sort(byTeamId);
  const groupsOf = new Map<TeamId, Set<string>>();
  for (const m of input.matches) {
    if (m.group === undefined) continue;
    for (const team of m.teams) {
      const groups = groupsOf.get(team) ?? new Set<string>();
      groups.add(m.group);
      groupsOf.set(team, groups);
    }
  }
  const overlaps = (a: ScheduledMatch, b: ScheduledMatch) => a.start < b.end && b.start < a.end;
  const teamsOf = (entry: ScheduledMatch) => byId.get(entry.match)?.teams ?? [];

  const ordered = [...input.schedule].sort((a, b) => a.start - b.start);
  const duties = new Map<TeamId, number>();
  const out: ScheduledMatch[] = [];
  const assigned = new Map<ScheduledMatch, ScheduledMatch>();
  for (const entry of ordered) {
    if (entry.start < from) {
      out.push(entry);
      assigned.set(entry, entry);
      if (entry.referee !== undefined) {
        duties.set(entry.referee, (duties.get(entry.referee) ?? 0) + 1);
      }
      continue;
    }
    const busy = new Set<TeamId>();
    for (const other of ordered) {
      if (!overlaps(entry, other)) continue;
      for (const team of teamsOf(other)) busy.add(team);
    }
    for (const done of out) if (overlaps(entry, done) && done.referee) busy.add(done.referee);
    const group = byId.get(entry.match)?.group;
    const inGroup = (team: TeamId) =>
      group !== undefined && groupsOf.get(team)?.has(group) ? 0 : 1;
    const free = teams.filter((team) => !busy.has(team));
    const referee = free.sort(
      (a, b) =>
        inGroup(a) - inGroup(b) || (duties.get(a) ?? 0) - (duties.get(b) ?? 0) || byTeamId(a, b),
    )[0];
    const { referee: _previous, ...rest } = entry;
    const result = referee === undefined ? rest : { ...rest, referee };
    if (referee !== undefined) duties.set(referee, (duties.get(referee) ?? 0) + 1);
    out.push(result);
    assigned.set(entry, result);
  }
  return input.schedule.map((entry) => assigned.get(entry) ?? entry);
}
