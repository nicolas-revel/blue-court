import type {
  MatchRules,
  Phase,
  PhaseFormat,
  Qualification,
  SetRules,
  Team,
  Tournament,
} from "./model.js";

export type ConfigErrorCode =
  | "NO_PHASE"
  | "DUPLICATE_PHASE"
  | "DUPLICATE_TEAM"
  | "INVALID_SEED"
  | "DUPLICATE_SEED"
  | "POINTS_TO_WIN"
  | "CAP_TOO_LOW"
  | "SETS_TO_WIN"
  | "SET_COUNT"
  | "DURATION"
  | "TIME_LIMIT"
  | "TIE_BREAK_SET"
  | "ODD_SETS_DRAW"
  | "RANKING_POINTS"
  | "DUPLICATE_TIE_BREAKER"
  | "POOL_COUNT"
  | "POOL_SIZE"
  | "TOO_FEW_TEAMS"
  | "QUALIFICATION_COUNT"
  | "QUALIFICATION_RANK";

export interface ConfigError {
  readonly code: ConfigErrorCode;
  /** English message; the UI translates errors by `code`. */
  readonly message: string;
  /** Where the faulty setting is, from the tournament root: ["phases", 0, "matchRules", "set"]. */
  readonly path: readonly (string | number)[];
}

export type ConfigValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly errors: readonly ConfigError[] };

type Path = readonly (string | number)[];
type Report = (code: ConfigErrorCode, message: string, path: Path) => void;

const isCount = (n: number, min: number) => Number.isInteger(n) && n >= min;
const isPositive = (n: number) => Number.isFinite(n) && n > 0;

function checkSet(rules: SetRules, path: Path, report: Report): void {
  if (!isCount(rules.pointsToWin, 1)) {
    report("POINTS_TO_WIN", "points to win a set must be a whole number from 1", [
      ...path,
      "pointsToWin",
    ]);
  }
  if (rules.cap !== undefined && !(Number.isInteger(rules.cap) && rules.cap > rules.pointsToWin)) {
    report("CAP_TOO_LOW", "the cap must be a whole number above the points to win", [
      ...path,
      "cap",
    ]);
  }
}

function checkMatchRules(rules: MatchRules, path: Path, report: Report): void {
  if (rules.kind === "timed") {
    if (!isPositive(rules.durationMinutes)) {
      report("DURATION", "a timed match needs a positive duration", [...path, "durationMinutes"]);
    }
    return;
  }
  checkSet(rules.set, [...path, "set"], report);
  if (rules.timeLimit !== undefined && !isPositive(rules.timeLimit.minutes)) {
    report("TIME_LIMIT", "a time limit must be positive", [...path, "timeLimit", "minutes"]);
  }
  if (rules.kind === "sets") {
    if (!(isCount(rules.setsToWin, 1) && rules.setsToWin <= 3)) {
      report("SETS_TO_WIN", "sets to win go from 1 to 3", [...path, "setsToWin"]);
    }
    if (rules.tieBreakSet !== undefined) {
      if (rules.setsToWin === 1) {
        report("TIE_BREAK_SET", "a one-set match has no deciding set", [...path, "tieBreakSet"]);
      }
      checkSet(rules.tieBreakSet, [...path, "tieBreakSet"], report);
    }
  } else {
    if (!isCount(rules.sets, 1)) {
      report("SET_COUNT", "a fixed-sets match needs at least 1 set", [...path, "sets"]);
    }
    if (rules.drawAllowed && rules.sets % 2 === 1) {
      report("ODD_SETS_DRAW", "an odd number of sets cannot end in a draw", [
        ...path,
        "drawAllowed",
      ]);
    }
  }
}

/** Number of pools a format plays in, when it is known before the phase starts. */
const poolsOf = (format: PhaseFormat): number | undefined =>
  format.kind === "pools" ? format.poolCount : undefined;

function checkFormat(format: PhaseFormat, teams: number, path: Path, report: Report): void {
  switch (format.kind) {
    case "pools":
      if (!(isCount(format.poolCount, 1) && format.poolCount <= Math.max(teams, 1))) {
        report("POOL_COUNT", `the number of pools goes from 1 to the ${teams} teams`, [
          ...path,
          "poolCount",
        ]);
      }
      return;
    case "levelPools":
      if (format.grouping.kind === "bands" && !isCount(format.grouping.poolSize, 2)) {
        report("POOL_SIZE", "a pool needs at least 2 teams", [...path, "grouping", "poolSize"]);
      }
      return;
    default:
      if (teams < 2) {
        report("TOO_FEW_TEAMS", "a bracket needs at least 2 teams", [...path, "kind"]);
      }
  }
}

/** Checks a qualification rule and returns how many teams go to the next phase, when known. */
function checkQualification(
  qualification: Qualification,
  format: PhaseFormat,
  teams: number,
  path: Path,
  report: Report,
): number {
  switch (qualification.kind) {
    case "all":
      return teams;
    case "topOverall":
      if (!(isCount(qualification.count, 1) && qualification.count <= teams)) {
        report("QUALIFICATION_COUNT", `between 1 and the ${teams} teams can qualify`, [
          ...path,
          "count",
        ]);
      }
      return Math.min(qualification.count, teams);
    case "topPerPool": {
      // Level pools only know their number of pools once the previous ranking is in.
      const pools = poolsOf(format);
      const { count, bestAtRank } = qualification;
      const extra = bestAtRank?.count ?? 0;
      if (!isCount(count, 1) || (pools !== undefined && count * pools + extra > teams)) {
        report("QUALIFICATION_COUNT", `at most the ${teams} teams can qualify`, [...path, "count"]);
      }
      if (bestAtRank !== undefined) {
        if (!(isCount(bestAtRank.rank, 1) && bestAtRank.rank > count)) {
          report("QUALIFICATION_RANK", "the best teams are taken at a rank below the qualified", [
            ...path,
            "bestAtRank",
            "rank",
          ]);
        }
        if (!isCount(bestAtRank.count, 1) || (pools !== undefined && bestAtRank.count > pools)) {
          report("QUALIFICATION_COUNT", "at most one team per pool at that rank", [
            ...path,
            "bestAtRank",
            "count",
          ]);
        }
      }
      return pools === undefined ? teams : Math.min(count * pools + extra, teams);
    }
  }
}

function checkPhase(phase: Phase, teams: number, path: Path, report: Report): number {
  checkMatchRules(phase.matchRules, [...path, "matchRules"], report);
  for (const [key, value] of Object.entries(phase.rankingPoints)) {
    if (!Number.isFinite(value)) {
      report("RANKING_POINTS", "ranking points must be numbers", [...path, "rankingPoints", key]);
    }
  }
  if (new Set(phase.tieBreakers).size !== phase.tieBreakers.length) {
    report("DUPLICATE_TIE_BREAKER", "each tie-breaker can be used once", [...path, "tieBreakers"]);
  }
  checkFormat(phase.format, teams, [...path, "format"], report);
  return checkQualification(
    phase.qualification,
    phase.format,
    teams,
    [...path, "qualification"],
    report,
  );
}

function checkTeams(teams: readonly Team[], report: Report): void {
  const ids = new Set<string>();
  const seeds = new Set<number>();
  for (const [i, team] of teams.entries()) {
    if (ids.has(team.id)) report("DUPLICATE_TEAM", `team ${team.id} appears twice`, ["teams", i]);
    ids.add(team.id);
    if (team.seed === undefined) continue;
    if (!isCount(team.seed, 1)) {
      report("INVALID_SEED", "a seed is a whole number from 1", ["teams", i, "seed"]);
    } else if (seeds.has(team.seed)) {
      report("DUPLICATE_SEED", `seed ${team.seed} is given twice`, ["teams", i, "seed"]);
    }
    seeds.add(team.seed);
  }
}

/** Match rules on their own, for a phase being edited. */
export function validateMatchRules(rules: MatchRules): ConfigValidation {
  const errors: ConfigError[] = [];
  checkMatchRules(rules, [], (code, message, path) => errors.push({ code, message, path }));
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Checks a tournament before it starts: settings that type-check but can never work. Each
 * phase is checked with the number of teams the previous one qualifies.
 */
export function validateTournament(tournament: Tournament): ConfigValidation {
  const errors: ConfigError[] = [];
  const report: Report = (code, message, path) => errors.push({ code, message, path });
  checkTeams(tournament.teams, report);
  if (tournament.phases.length === 0) report("NO_PHASE", "a tournament needs a phase", ["phases"]);
  const ids = new Set<string>();
  let teams = tournament.teams.length;
  for (const [i, phase] of tournament.phases.entries()) {
    if (ids.has(phase.id)) {
      report("DUPLICATE_PHASE", `phase ${phase.id} appears twice`, ["phases", i, "id"]);
    }
    ids.add(phase.id);
    teams = checkPhase(phase, teams, ["phases", i], report);
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
