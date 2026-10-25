import type { MatchRules, MatchScore, SetRules, SetScore } from "./model.js";

export type Side = "home" | "away";

export type MatchOutcome = Side | "draw";

export type ScoreErrorCode =
  | "SCORE_KIND"
  | "INVALID_POINTS"
  | "SET_INCOMPLETE"
  | "SET_MARGIN"
  | "SET_OVERSHOOT"
  | "SET_CAP"
  | "TOO_MANY_SETS"
  | "SETS_AFTER_END"
  | "MATCH_INCOMPLETE"
  | "NO_TIME_LIMIT"
  | "DRAW_NOT_ALLOWED";

export interface ScoreError {
  readonly code: ScoreErrorCode;
  /** English message; the UI translates errors by `code`. */
  readonly message: string;
  /** 1-based number of the set the error is about. */
  readonly set?: number;
}

export type ScoreValidation =
  | { readonly valid: true; readonly outcome: MatchOutcome }
  | { readonly valid: false; readonly errors: readonly ScoreError[] };

type SetState =
  | { readonly state: "won"; readonly winner: Side }
  | { readonly state: "unfinished"; readonly leader: Side | undefined }
  | { readonly state: "invalid"; readonly error: ScoreError };

const isPoints = (n: number) => Number.isInteger(n) && n >= 0;

const leaderOf = (home: number, away: number): Side | undefined =>
  home > away ? "home" : away > home ? "away" : undefined;

const error = (code: ScoreErrorCode, message: string, set?: number): ScoreError =>
  set === undefined ? { code, message } : { code, message, set };

const invalid = (code: ScoreErrorCode, message: string, set: number): SetState => ({
  state: "invalid",
  error: error(code, message, set),
});

const fail = (...errors: ScoreError[]): ScoreValidation => ({ valid: false, errors });

/** Where a set stands under its rules: won, still being played, or impossible. */
function setState(rules: SetRules, score: SetScore, set: number): SetState {
  const { home, away } = score;
  if (!isPoints(home) || !isPoints(away)) {
    return invalid("INVALID_POINTS", `set ${set} points must be whole numbers from 0`, set);
  }
  const high = Math.max(home, away);
  const gap = Math.abs(home - away);
  const leader = leaderOf(home, away);
  const { pointsToWin, winByTwo, cap } = rules;
  const overshoot = invalid(
    "SET_OVERSHOOT",
    `set ${set} should have ended before reaching this score`,
    set,
  );

  if (cap !== undefined && high > cap) {
    return invalid("SET_CAP", `set ${set} cannot go past ${cap} points`, set);
  }
  if (high < pointsToWin) return { state: "unfinished", leader };
  if (leader === undefined && !winByTwo) return overshoot;
  if (leader === undefined) return high === cap ? overshoot : { state: "unfinished", leader };
  if (!winByTwo) return high === pointsToWin ? { state: "won", winner: leader } : overshoot;
  if (high === pointsToWin) {
    return gap >= 2 || cap === high
      ? { state: "won", winner: leader }
      : { state: "unfinished", leader };
  }
  if (gap === 2) return { state: "won", winner: leader };
  if (gap > 2) return overshoot;
  return high === cap ? { state: "won", winner: leader } : { state: "unfinished", leader };
}

/**
 * Tells whether a score is possible under the match rules of its phase, and who won.
 * A forfeit is always valid and won by the other team.
 */
export function validateScore(rules: MatchRules, score: MatchScore): ScoreValidation {
  if (score.kind === "forfeit") {
    return { valid: true, outcome: score.forfeitedBy === "home" ? "away" : "home" };
  }
  if (rules.kind === "timed") {
    if (score.kind !== "timed")
      return fail(error("SCORE_KIND", "a timed match has a single score"));
    if (!isPoints(score.home) || !isPoints(score.away)) {
      return fail(error("INVALID_POINTS", "points must be whole numbers from 0"));
    }
    const leader = leaderOf(score.home, score.away);
    if (leader !== undefined) return { valid: true, outcome: leader };
    return rules.drawAllowed
      ? { valid: true, outcome: "draw" }
      : fail(error("DRAW_NOT_ALLOWED", "this match cannot end in a draw"));
  }
  if (score.kind !== "sets") return fail(error("SCORE_KIND", "this match is scored set by set"));
  return validateSets(rules, score);
}

function validateSets(
  rules: Exclude<MatchRules, { kind: "timed" }>,
  score: Extract<MatchScore, { kind: "sets" }>,
): ScoreValidation {
  const endedByTime = score.endedByTime === true;
  const toWin = rules.kind === "sets" ? rules.setsToWin : undefined;
  const maxSets = rules.kind === "sets" ? 2 * rules.setsToWin - 1 : rules.sets;
  const rulesFor = (index: number): SetRules =>
    rules.kind === "sets" && rules.setsToWin >= 2 && index === maxSets - 1 && rules.tieBreakSet
      ? rules.tieBreakSet
      : rules.set;

  if (score.sets.length === 0) return fail(error("MATCH_INCOMPLETE", "the match is not over"));
  const errors: ScoreError[] = [];
  if (endedByTime && rules.timeLimit === undefined) {
    errors.push(error("NO_TIME_LIMIT", "this match has no time limit"));
  }

  const wins = { home: 0, away: 0 };
  const points = { home: 0, away: 0 };
  let currentLeader: Side | undefined;
  const decided = () => toWin !== undefined && (wins.home >= toWin || wins.away >= toWin);

  score.sets.forEach((setScore, index) => {
    const set = index + 1;
    if (decided()) {
      errors.push(error("SETS_AFTER_END", `set ${set} was played after the match was won`, set));
      return;
    }
    if (index >= maxSets) {
      errors.push(error("TOO_MANY_SETS", `this match has at most ${maxSets} sets`, set));
      return;
    }
    const state = setState(rulesFor(index), setScore, set);
    if (state.state === "invalid") {
      errors.push(state.error);
      return;
    }
    points.home += setScore.home;
    points.away += setScore.away;
    if (state.state === "won") {
      wins[state.winner] += 1;
    } else if (endedByTime && index === score.sets.length - 1) {
      currentLeader = state.leader;
    } else {
      const { pointsToWin } = rulesFor(index);
      errors.push(
        Math.max(setScore.home, setScore.away) < pointsToWin
          ? error("SET_INCOMPLETE", `set ${set} must reach ${pointsToWin} points`, set)
          : error("SET_MARGIN", `set ${set} must end with a 2-point margin`, set),
      );
    }
  });
  if (errors.length > 0) return fail(...errors);

  if (toWin !== undefined && decided()) {
    return { valid: true, outcome: wins.home > wins.away ? "home" : "away" };
  }
  if (!endedByTime && (toWin !== undefined || score.sets.length < maxSets)) {
    return fail(error("MATCH_INCOMPLETE", "the match is not over"));
  }

  const leader =
    leaderOf(wins.home, wins.away) ??
    (endedByTime
      ? currentLeader
      : rules.kind === "fixedSets" && !rules.drawAllowed
        ? leaderOf(points.home, points.away)
        : undefined);
  if (leader !== undefined) return { valid: true, outcome: leader };
  return rules.kind === "fixedSets" && rules.drawAllowed
    ? { valid: true, outcome: "draw" }
    : fail(error("DRAW_NOT_ALLOWED", "this match cannot end in a draw"));
}
