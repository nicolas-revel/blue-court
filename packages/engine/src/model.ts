import type { Pairing } from "./round-robin.js";

export type TeamId = string;

export interface Team {
  readonly id: TeamId;
  readonly name: string;
  /** 1 is the strongest seed. */
  readonly seed?: number;
}

export interface SetRules {
  readonly pointsToWin: number;
  readonly winByTwo: boolean;
  /** Score at which the set ends even without a 2-point margin. */
  readonly cap?: number;
}

/** Optional cap on a match played in sets, to keep the schedule on time. */
export interface TimeLimit {
  readonly minutes: number;
}

/** How a match ends. Only the variants where a draw can happen say whether it is allowed. */
export type MatchRules =
  /** The first team to win `setsToWin` sets wins the match. */
  | {
      readonly kind: "sets";
      readonly setsToWin: number;
      readonly set: SetRules;
      /** Rules of the deciding set (see `RankingPoints.tieBreakWin`), when they differ. */
      readonly tieBreakSet?: SetRules;
      readonly timeLimit?: TimeLimit;
    }
  /** Every set is played, so an even number of sets can end in a draw. */
  | {
      readonly kind: "fixedSets";
      readonly sets: number;
      readonly set: SetRules;
      readonly drawAllowed: boolean;
      readonly timeLimit?: TimeLimit;
    }
  /** A single score after a fixed duration. */
  | { readonly kind: "timed"; readonly durationMinutes: number; readonly drawAllowed: boolean };

export interface RankingPoints {
  readonly win: number;
  /**
   * Win in the deciding set, the last possible set of a "sets to win" match with at least 2
   * sets to win (3-2 when 3 sets are needed, 2-1 when 2 are). One-set matches and other
   * formats have no deciding set and use `win` and `loss`.
   */
  readonly tieBreakWin: number;
  /** Loss in the deciding set, see `tieBreakWin`. */
  readonly tieBreakLoss: number;
  readonly loss: number;
  readonly draw: number;
  /** For the team whose opponent forfeited. */
  readonly forfeitWin: number;
  /** For the team that forfeited. */
  readonly forfeitLoss: number;
}

export type TieBreaker =
  | "wins"
  | "rankingPoints"
  | "setRatio"
  | "pointRatio"
  | "headToHead"
  | "random";

export type PhaseFormat =
  | { readonly kind: "pools"; readonly poolCount: number }
  /** Pools rebuilt from the previous phase's ranking. */
  | { readonly kind: "levelPools"; readonly poolSize: number }
  | { readonly kind: "singleElimination"; readonly consolation: boolean }
  | { readonly kind: "doubleElimination"; readonly grandFinalReset: boolean }
  /** Every team plays log2(N) matches and gets a unique place. */
  | { readonly kind: "fullPlacement" };

export type Qualification =
  /** Every team goes to the next phase. */
  | { readonly kind: "all" }
  /** The top `count` of each pool, plus optionally the best teams at a given rank. */
  | {
      readonly kind: "topPerPool";
      readonly count: number;
      readonly bestAtRank?: { readonly rank: number; readonly count: number };
    }
  /** The top `count` of the phase's overall ranking, for brackets or a cut after level pools. */
  | { readonly kind: "topOverall"; readonly count: number };

export interface Phase {
  readonly id: string;
  readonly name: string;
  readonly format: PhaseFormat;
  readonly matchRules: MatchRules;
  readonly rankingPoints: RankingPoints;
  /** Applied in order until teams are separated. */
  readonly tieBreakers: readonly TieBreaker[];
  /** Who goes to the next phase. */
  readonly qualification: Qualification;
  /** Whether a resting team is assigned to referee each match. */
  readonly refereeing: "restingTeam" | "none";
}

export interface Tournament {
  readonly id: string;
  readonly name: string;
  readonly teams: readonly Team[];
  readonly phases: readonly Phase[];
}

export interface SetScore {
  readonly home: number;
  readonly away: number;
}

export type MatchScore =
  | {
      readonly kind: "sets";
      readonly sets: readonly SetScore[];
      /** The time limit stopped the match: the last set may be unfinished. */
      readonly endedByTime?: boolean;
    }
  | { readonly kind: "timed"; readonly home: number; readonly away: number }
  | { readonly kind: "forfeit"; readonly forfeitedBy: "home" | "away" };

export interface Match extends Pairing<TeamId> {
  readonly id: string;
  readonly phaseId: string;
  /** Absent until the match is played. */
  readonly score?: MatchScore;
}
