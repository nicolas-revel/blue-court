import type { Match, Phase, SetScore, TeamId, TieBreaker } from "./model.js";
import { isDecidingSet, type Side, setWinner, validateScore } from "./score.js";

export interface StandingRow {
  readonly team: TeamId;
  /** 1-based; teams still level after every tie-breaker share a rank. */
  readonly rank: number;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly rankingPoints: number;
  readonly setsWon: number;
  readonly setsLost: number;
  readonly pointsWon: number;
  readonly pointsLost: number;
}

export interface StandingsInput {
  readonly teams: readonly TeamId[];
  /** Matches of the pool; matches without a score are ignored. */
  readonly matches: readonly Match[];
  readonly phase: Pick<Phase, "matchRules" | "rankingPoints" | "tieBreakers">;
  /** Required when the tie-breakers include a random draw, so the draw is reproducible. */
  readonly seed?: number;
}

/** What one team gets from one match. */
interface MatchLine {
  readonly team: TeamId;
  readonly opponent: TeamId;
  readonly result: "win" | "draw" | "loss";
  readonly rankingPoints: number;
  readonly setsWon: number;
  readonly setsLost: number;
  readonly pointsWon: number;
  readonly pointsLost: number;
}

type Rules = StandingsInput["phase"];

const otherSide = (side: Side): Side => (side === "home" ? "away" : "home");

/** Both teams' lines for a played match, or an error if its score breaks the rules. */
function matchLines(match: Match, rules: Rules): readonly [MatchLine, MatchLine] {
  const score = match.score;
  if (score === undefined) throw new Error("unreachable: unplayed match");
  const validation = validateScore(rules.matchRules, score);
  if (!validation.valid) {
    const codes = validation.errors.map((e) => e.code).join(", ");
    throw new Error(`INVALID_SCORE: match ${match.id} has an invalid score (${codes})`);
  }
  const { outcome } = validation;
  const points = rules.rankingPoints;
  const matchRules = rules.matchRules;

  const totals = { home: { sets: 0, points: 0 }, away: { sets: 0, points: 0 } };
  let decidingSet = false;
  if (score.kind === "sets") {
    // Only finished sets count: the last set of a match stopped by time may not be.
    score.sets.forEach((set: SetScore, index) => {
      totals.home.points += set.home;
      totals.away.points += set.away;
      const winner = setWinner(matchRules, index, set);
      if (winner !== undefined) totals[winner].sets += 1;
    });
    // A tie-break win or loss needs the deciding set to have been played out.
    const last = score.sets.length - 1;
    const lastSet = score.sets[last];
    decidingSet =
      isDecidingSet(matchRules, last) &&
      lastSet !== undefined &&
      setWinner(matchRules, last, lastSet) !== undefined;
  } else if (score.kind === "timed") {
    totals.home.points = score.home;
    totals.away.points = score.away;
  } else if (matchRules.kind !== "timed") {
    // A forfeit counts as the shortest possible win, every set won to 0.
    const winner = otherSide(score.forfeitedBy);
    const sets = matchRules.kind === "sets" ? matchRules.setsToWin : matchRules.sets;
    totals[winner].sets = sets;
    totals[winner].points = sets * matchRules.set.pointsToWin;
  }

  const line = (side: Side): MatchLine => {
    const own = totals[side];
    const their = totals[otherSide(side)];
    const result = outcome === "draw" ? "draw" : outcome === side ? "win" : "loss";
    const forfeit = score.kind === "forfeit";
    const rankingPoints =
      result === "draw"
        ? points.draw
        : result === "win"
          ? forfeit
            ? points.forfeitWin
            : decidingSet
              ? points.tieBreakWin
              : points.win
          : forfeit
            ? points.forfeitLoss
            : decidingSet
              ? points.tieBreakLoss
              : points.loss;
    return {
      team: side === "home" ? match.home : match.away,
      opponent: side === "home" ? match.away : match.home,
      result,
      rankingPoints,
      setsWon: own.sets,
      setsLost: their.sets,
      pointsWon: own.points,
      pointsLost: their.points,
    };
  };
  return [line("home"), line("away")];
}

type Totals = Omit<StandingRow, "team" | "rank">;

function sumLines(lines: readonly MatchLine[]): Totals {
  const totals = {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    rankingPoints: 0,
    setsWon: 0,
    setsLost: 0,
    pointsWon: 0,
    pointsLost: 0,
  };
  for (const line of lines) {
    totals.played += 1;
    totals.wins += line.result === "win" ? 1 : 0;
    totals.draws += line.result === "draw" ? 1 : 0;
    totals.losses += line.result === "loss" ? 1 : 0;
    totals.rankingPoints += line.rankingPoints;
    totals.setsWon += line.setsWon;
    totals.setsLost += line.setsLost;
    totals.pointsWon += line.pointsWon;
    totals.pointsLost += line.pointsLost;
  }
  return totals;
}

/** Won over lost; a team that lost nothing is ahead of every team that lost something. */
const ratio = (won: number, lost: number) =>
  lost === 0 ? (won === 0 ? 0 : Number.POSITIVE_INFINITY) : won / lost;

/** Deterministic 32-bit hash of a team for a seeded draw (FNV-1a mixed with the seed). */
function drawKey(seed: number, team: TeamId): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < team.length; i++) {
    hash ^= team.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  hash ^= hash >>> 15;
  return Math.imul(hash, 2246822507) >>> 0;
}

/**
 * Ranks a pool from its played matches, applying the phase's tie-breakers in order.
 * Head-to-head compares the ranking points earned in matches between the tied teams only,
 * and is applied again within any smaller group it leaves level.
 */
export function computeStandings(input: StandingsInput): StandingRow[] {
  const { teams, matches, phase, seed } = input;
  if (new Set(teams).size !== teams.length)
    throw new Error("DUPLICATE_TEAM: each team must appear once");
  const known = new Set(teams);
  const lines: MatchLine[] = [];
  for (const match of matches) {
    if (!known.has(match.home) || !known.has(match.away)) {
      throw new Error(`UNKNOWN_TEAM: match ${match.id} involves a team outside the pool`);
    }
    if (match.home === match.away) {
      throw new Error(`SAME_TEAM: match ${match.id} has the same team on both sides`);
    }
    if (match.score !== undefined) lines.push(...matchLines(match, phase));
  }
  if (phase.tieBreakers.includes("random") && seed === undefined) {
    throw new Error("SEED_REQUIRED: a random draw tie-breaker needs a seed");
  }

  const byTeam = new Map<TeamId, MatchLine[]>(teams.map((team) => [team, []]));
  for (const line of lines) byTeam.get(line.team)?.push(line);
  const linesOf = (team: TeamId) => byTeam.get(team) ?? [];
  const totals = new Map(teams.map((team) => [team, sumLines(linesOf(team))]));
  const get = (team: TeamId) => totals.get(team) ?? sumLines([]);

  const key = (criterion: TieBreaker, team: TeamId, group: readonly TeamId[]): number => {
    const t = get(team);
    switch (criterion) {
      case "wins":
        return t.wins;
      case "rankingPoints":
        return t.rankingPoints;
      case "setRatio":
        return ratio(t.setsWon, t.setsLost);
      case "pointRatio":
        return ratio(t.pointsWon, t.pointsLost);
      case "headToHead":
        return linesOf(team)
          .filter((l) => group.includes(l.opponent))
          .reduce((sum, l) => sum + l.rankingPoints, 0);
      case "random":
        return drawKey(seed ?? 0, team);
    }
  };

  /** Splits a level group into ordered subgroups, best first, then breaks each further. */
  const rankGroup = (group: readonly TeamId[], index: number): TeamId[][] => {
    const criterion = phase.tieBreakers[index];
    if (group.length <= 1 || criterion === undefined) return [[...group]];
    const keyed = group.map((team) => ({ team, value: key(criterion, team, group) }));
    const values = [...new Set(keyed.map((k) => k.value))].sort((a, b) => b - a);
    const buckets = values.map((v) => keyed.filter((k) => k.value === v).map((k) => k.team));
    const again = criterion === "headToHead" && buckets.length > 1;
    return buckets.flatMap((bucket) => rankGroup(bucket, again ? index : index + 1));
  };

  const rows: StandingRow[] = [];
  for (const group of rankGroup(teams, 0)) {
    const rank = rows.length + 1;
    for (const team of group) rows.push({ team, rank, ...get(team) });
  }
  return rows;
}
