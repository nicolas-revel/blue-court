export {
  BracketError,
  type BracketErrorCode,
  type BracketInput,
  type BracketMatch,
  type BracketSlot,
  bracketPlaces,
  doubleElimination,
  fullPlacement,
  type ResolvedBracketMatch,
  resolveBracket,
  singleElimination,
} from "./brackets.js";
export { EngineError } from "./errors.js";
export { FFVB_MATCH_RULES, FFVB_RANKING_POINTS, FFVB_TIE_BREAKERS } from "./ffvb.js";
export type {
  LevelPoolGrouping,
  Match,
  MatchRules,
  MatchScore,
  Phase,
  PhaseFormat,
  PoolDraw,
  Qualification,
  RankingPoints,
  SetRules,
  SetScore,
  Team,
  TeamId,
  TieBreaker,
  TimeLimit,
  Tournament,
} from "./model.js";
export {
  buildLevelPools,
  type CrossPoolInput,
  drawPools,
  type LevelPoolsInput,
  moveTeam,
  type PoolDrawInput,
  type PoolPlacement,
  type Pools,
  PoolsError,
  type PoolsErrorCode,
  rankAcrossPools,
} from "./pools.js";
export { type Pairing, roundRobin } from "./round-robin.js";
export {
  type ActualTimes,
  adjustSchedule,
  assignReferees,
  moveMatch,
  planSchedule,
  removeCourt,
  type SchedulableMatch,
  type ScheduledMatch,
  ScheduleError,
  type ScheduleErrorCode,
  type ScheduleSettings,
} from "./schedule.js";
export {
  type MatchOutcome,
  type ScoreError,
  type ScoreErrorCode,
  type ScoreValidation,
  type Side,
  validateScore,
} from "./score.js";
export {
  computeStandings,
  type StandingRow,
  StandingsError,
  type StandingsErrorCode,
  type StandingsInput,
} from "./standings.js";
