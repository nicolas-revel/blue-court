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

/** How a match ends. Only the variants where a draw can happen say whether it is allowed. */
export type MatchRules =
  /** The first team to win `setsToWin` sets wins the match. */
  | {
      readonly kind: "sets";
      readonly setsToWin: number;
      readonly set: SetRules;
      /** Rules of the deciding set, when it differs from the other sets. */
      readonly tieBreakSet?: SetRules;
    }
  /** Every set is played, so an even number of sets can end in a draw. */
  | {
      readonly kind: "fixedSets";
      readonly sets: number;
      readonly set: SetRules;
      readonly drawAllowed: boolean;
    }
  /** A single score after a fixed duration. */
  | { readonly kind: "timed"; readonly durationMinutes: number; readonly drawAllowed: boolean };

export interface RankingPoints {
  readonly win: number;
  /** Win in the deciding set. */
  readonly tieBreakWin: number;
  /** Loss in the deciding set. */
  readonly tieBreakLoss: number;
  readonly loss: number;
  readonly draw: number;
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
    };

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
  | { readonly kind: "sets"; readonly sets: readonly SetScore[] }
  | { readonly kind: "timed"; readonly home: number; readonly away: number }
  | { readonly kind: "forfeit"; readonly forfeitedBy: "home" | "away" };

export interface Match extends Pairing<TeamId> {
  readonly id: string;
  readonly phaseId: string;
  /** Absent until the match is played. */
  readonly score?: MatchScore;
}
