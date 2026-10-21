import type { MatchRules, RankingPoints, TieBreaker } from "./model.js";

/** Indoor FFVB rules: best of five sets to 25, tie-break set to 15, 2-point margin. */
export const FFVB_MATCH_RULES: MatchRules = Object.freeze({
  format: Object.freeze({ kind: "sets", setsToWin: 3 }),
  set: Object.freeze({ pointsToWin: 25, winByTwo: true }),
  tieBreakSet: Object.freeze({ pointsToWin: 15, winByTwo: true }),
  drawAllowed: false,
});

/** FFVB championship points: 3-0 or 3-1 gives 3-0, 3-2 gives 2-1. */
export const FFVB_RANKING_POINTS: RankingPoints = Object.freeze({
  win: 3,
  tieBreakWin: 2,
  tieBreakLoss: 1,
  loss: 0,
  draw: 0,
  forfeitLoss: 0,
});

/** FFVB order: ranking points, then set ratio, then point ratio. */
export const FFVB_TIE_BREAKERS: readonly TieBreaker[] = Object.freeze([
  "points",
  "setRatio",
  "pointRatio",
]);
