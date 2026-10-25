import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FFVB_MATCH_RULES } from "./ffvb.js";
import type { MatchRules, SetRules, SetScore } from "./model.js";
import { type Side, validateScore } from "./score.js";

const sets = (...scores: [number, number][]) => ({
  kind: "sets" as const,
  sets: scores.map(([home, away]) => ({ home, away })),
});
const codes = (rules: MatchRules, score: Parameters<typeof validateScore>[1]) => {
  const result = validateScore(rules, score);
  return result.valid ? [] : result.errors.map((e) => e.code);
};

const twoSetsTo21: MatchRules = {
  kind: "sets",
  setsToWin: 2,
  set: { pointsToWin: 21, winByTwo: true },
  tieBreakSet: { pointsToWin: 15, winByTwo: true },
  timeLimit: { minutes: 20 },
};
const twoFixedSets: MatchRules = {
  kind: "fixedSets",
  sets: 2,
  set: { pointsToWin: 25, winByTwo: true },
  drawAllowed: true,
};

describe("validateScore with sets to win", () => {
  it("accepts a 3-1 FFVB match and a 3-2 with a tie-break set to 15", () => {
    expect(validateScore(FFVB_MATCH_RULES, sets([25, 20], [23, 25], [25, 18], [30, 28]))).toEqual({
      valid: true,
      outcome: "home",
    });
    expect(
      validateScore(FFVB_MATCH_RULES, sets([25, 20], [23, 25], [25, 18], [20, 25], [13, 15])),
    ).toEqual({ valid: true, outcome: "away" });
  });

  it("rejects a set without a 2-point margin", () => {
    const result = validateScore(FFVB_MATCH_RULES, sets([25, 20], [25, 24], [25, 18]));
    expect(result).toEqual({
      valid: false,
      errors: [{ code: "SET_MARGIN", message: "set 2 must end with a 2-point margin", set: 2 }],
    });
  });

  it("rejects impossible set scores", () => {
    expect(codes(FFVB_MATCH_RULES, sets([27, 20], [25, 0], [25, 0]))).toEqual(["SET_OVERSHOOT"]);
    expect(codes(FFVB_MATCH_RULES, sets([20, 18], [25, 0], [25, 0]))).toEqual(["SET_INCOMPLETE"]);
    expect(codes(FFVB_MATCH_RULES, sets([-1, 25], [25, 0], [25, 0], [25, 0]))).toEqual([
      "INVALID_POINTS",
    ]);
    expect(codes(FFVB_MATCH_RULES, sets([25, 23], [25, 23], [25, 15], [25, 1]))).toEqual([
      "SETS_AFTER_END",
    ]);
    expect(codes(FFVB_MATCH_RULES, sets([25, 23], [25, 23]))).toEqual(["MATCH_INCOMPLETE"]);
    expect(codes(FFVB_MATCH_RULES, sets([25, 23], [23, 25], [25, 23], [23, 25], [25, 20]))).toEqual(
      ["SET_OVERSHOOT"],
    );
  });

  it("ends a capped set at the cap, even with a 1-point margin", () => {
    const capped: MatchRules = {
      kind: "sets",
      setsToWin: 1,
      set: { pointsToWin: 25, winByTwo: true, cap: 27 },
    };
    expect(validateScore(capped, sets([27, 26]))).toEqual({ valid: true, outcome: "home" });
    expect(validateScore(capped, sets([26, 28]))).toMatchObject({ valid: false });
    expect(codes(capped, sets([28, 26]))).toEqual(["SET_CAP"]);
  });

  it("only uses the tie-break set rules in the deciding set", () => {
    expect(validateScore(twoSetsTo21, sets([21, 15], [18, 21], [15, 12]))).toEqual({
      valid: true,
      outcome: "home",
    });
    expect(codes(twoSetsTo21, sets([15, 12], [21, 15]))).toEqual(["SET_INCOMPLETE"]);
  });

  it("decides a match stopped by time on sets, then on the set being played", () => {
    expect(
      validateScore(twoSetsTo21, { ...sets([21, 15], [18, 21], [12, 9]), endedByTime: true }),
    ).toEqual({ valid: true, outcome: "home" });
    expect(validateScore(twoSetsTo21, { ...sets([21, 15], [10, 8]), endedByTime: true })).toEqual({
      valid: true,
      outcome: "home",
    });
    expect(codes(twoSetsTo21, { ...sets([21, 15], [18, 21], [9, 9]), endedByTime: true })).toEqual([
      "DRAW_NOT_ALLOWED",
    ]);
    expect(codes(FFVB_MATCH_RULES, { ...sets([25, 15], [10, 8]), endedByTime: true })).toEqual([
      "NO_TIME_LIMIT",
    ]);
  });
});

describe("validateScore with a fixed number of sets", () => {
  it("refuses a score with no set, even when stopped by time", () => {
    expect(codes(twoFixedSets, sets())).toEqual(["MATCH_INCOMPLETE"]);
    expect(codes(twoFixedSets, { ...sets(), endedByTime: true })).toEqual(["MATCH_INCOMPLETE"]);
  });

  it("allows a 1-1 draw when the phase allows it", () => {
    expect(validateScore(twoFixedSets, sets([25, 20], [18, 25]))).toEqual({
      valid: true,
      outcome: "draw",
    });
    expect(codes(twoFixedSets, sets([25, 20]))).toEqual(["MATCH_INCOMPLETE"]);
    expect(codes(twoFixedSets, sets([25, 20], [25, 20], [25, 20]))).toEqual(["TOO_MANY_SETS"]);
  });

  it("breaks a 1-1 on total points when draws are not allowed", () => {
    const noDraw: MatchRules = { ...twoFixedSets, drawAllowed: false };
    expect(validateScore(noDraw, sets([25, 20], [23, 25]))).toEqual({
      valid: true,
      outcome: "home",
    });
    expect(codes(noDraw, sets([25, 20], [20, 25]))).toEqual(["DRAW_NOT_ALLOWED"]);
  });
});

describe("validateScore with timed matches and forfeits", () => {
  const timed: MatchRules = { kind: "timed", durationMinutes: 12, drawAllowed: false };

  it("reads a single score and applies the draw setting", () => {
    expect(validateScore(timed, { kind: "timed", home: 14, away: 17 })).toEqual({
      valid: true,
      outcome: "away",
    });
    expect(codes(timed, { kind: "timed", home: 12, away: 12 })).toEqual(["DRAW_NOT_ALLOWED"]);
    expect(
      validateScore({ ...timed, drawAllowed: true }, { kind: "timed", home: 12, away: 12 }),
    ).toEqual({ valid: true, outcome: "draw" });
  });

  it("rejects a score of the wrong kind", () => {
    expect(codes(timed, sets([25, 20]))).toEqual(["SCORE_KIND"]);
    expect(codes(FFVB_MATCH_RULES, { kind: "timed", home: 1, away: 0 })).toEqual(["SCORE_KIND"]);
  });

  it("gives a forfeit to the other team, whatever the rules", () => {
    expect(validateScore(timed, { kind: "forfeit", forfeitedBy: "home" })).toEqual({
      valid: true,
      outcome: "away",
    });
  });
});

const setRulesArb: fc.Arbitrary<SetRules> = fc
  .record({
    pointsToWin: fc.integer({ min: 5, max: 30 }),
    winByTwo: fc.boolean(),
    capExtra: fc.option(fc.integer({ min: 1, max: 5 }), { nil: undefined }),
  })
  .map(({ pointsToWin, winByTwo, capExtra }) =>
    capExtra === undefined
      ? { pointsToWin, winByTwo }
      : { pointsToWin, winByTwo, cap: pointsToWin + capExtra },
  );

/** A finished set won by `winner` under `rules`. */
const wonSet = (rules: SetRules, winner: Side): fc.Arbitrary<SetScore> => {
  const { pointsToWin: p, winByTwo, cap } = rules;
  const regular = fc
    .integer({ min: 0, max: winByTwo ? p - 2 : p - 1 })
    .map((loser) => [p, loser] as const);
  const extended = fc
    .integer({ min: 1, max: cap === undefined ? 10 : cap - p })
    .map((extra) => [p + extra, p + extra - 2] as const);
  const atCap = cap === undefined ? undefined : fc.constant([cap, cap - 1] as const);
  const choices = winByTwo ? [regular, extended, ...(atCap ? [atCap] : [])] : [regular];
  return fc
    .oneof(...choices)
    .map(([w, l]) => (winner === "home" ? { home: w, away: l } : { home: l, away: w }));
};

const other = (side: Side): Side => (side === "home" ? "away" : "home");

/** Who wins each set of a finished match: the winner takes the last set, the rest is shuffled. */
const setWinnersArb = (setsToWin: number, winner: Side): fc.Arbitrary<Side[]> =>
  fc
    .integer({ min: 0, max: setsToWin - 1 })
    .chain((losses) =>
      fc.shuffledSubarray(
        [...Array(setsToWin - 1).fill(winner), ...Array(losses).fill(other(winner))] as Side[],
        { minLength: setsToWin - 1 + losses },
      ),
    )
    .map((sides) => [...sides, winner]);

/** A finished "sets to win" match, with an optional tie-break set and time limit. */
const finishedMatchArb = fc
  .record({
    setsToWin: fc.integer({ min: 1, max: 3 }),
    set: setRulesArb,
    tieBreakSet: fc.option(setRulesArb, { nil: undefined }),
    timeLimit: fc.boolean(),
    winner: fc.constantFrom<Side>("home", "away"),
  })
  .chain(({ setsToWin, set, tieBreakSet, timeLimit, winner }) => {
    const rules: Extract<MatchRules, { kind: "sets" }> = {
      kind: "sets",
      setsToWin,
      set,
      ...(tieBreakSet ? { tieBreakSet } : {}),
      ...(timeLimit ? { timeLimit: { minutes: 20 } } : {}),
    };
    const rulesFor = (index: number) =>
      setsToWin >= 2 && index === 2 * setsToWin - 2 && tieBreakSet ? tieBreakSet : set;
    return setWinnersArb(setsToWin, winner).chain((winners) =>
      fc
        .tuple(...winners.map((w, i) => wonSet(rulesFor(i), w)))
        .map((scores) => ({ rules, winner, scores, rulesFor })),
    );
  });

/** A set still being played: nobody has reached the points to win. */
const unfinishedSet = (rules: SetRules): fc.Arbitrary<SetScore> =>
  fc.record({
    home: fc.integer({ min: 0, max: rules.pointsToWin - 1 }),
    away: fc.integer({ min: 0, max: rules.pointsToWin - 1 }),
  });

const sum = (scores: readonly SetScore[], side: Side) =>
  scores.reduce((total, score) => total + score[side], 0);

describe("validateScore properties", () => {
  it("gives every finished match to the team that won the most sets, tie-break set included", () => {
    fc.assert(
      fc.property(finishedMatchArb, ({ rules, winner, scores }) => {
        expect(validateScore(rules, { kind: "sets", sets: scores })).toEqual({
          valid: true,
          outcome: winner,
        });
      }),
    );
  });

  it("rejects any set played after the match is won", () => {
    fc.assert(
      fc.property(finishedMatchArb, ({ rules, scores }) => {
        const extra = { home: rules.set.pointsToWin, away: 0 };
        expect(codes(rules, { kind: "sets", sets: [...scores, extra] })).toEqual([
          "SETS_AFTER_END",
        ]);
      }),
    );
  });

  it("rejects a set pushed past the score where it ended", () => {
    fc.assert(
      fc.property(finishedMatchArb, ({ rules, scores, rulesFor }) => {
        const first = scores[0] as SetScore;
        const { pointsToWin } = rulesFor(0);
        const winner: Side = first.home > first.away ? "home" : "away";
        const bumped = { ...first, [winner]: pointsToWin + 1, [other(winner)]: 0 } as SetScore;
        const errors = codes(rules, { kind: "sets", sets: [bumped, ...scores.slice(1)] });
        expect(["SET_OVERSHOOT", "SET_CAP"]).toContain(errors[0]);
      }),
    );
  });

  it("decides a match stopped by time on sets won, then on the unfinished set", () => {
    const arb = fc
      .record({
        setsToWin: fc.integer({ min: 2, max: 3 }),
        set: setRulesArb,
        homeSets: fc.nat(),
        awaySets: fc.nat(),
      })
      .chain(({ setsToWin, set, homeSets, awaySets }) => {
        const home = homeSets % setsToWin;
        const away = awaySets % setsToWin;
        const winners: Side[] = [...Array(home).fill("home"), ...Array(away).fill("away")];
        const rules: MatchRules = { kind: "sets", setsToWin, set, timeLimit: { minutes: 20 } };
        return fc
          .tuple(fc.tuple(...winners.map((w) => wonSet(set, w))), unfinishedSet(set))
          .map(([done, current]) => ({ rules, home, away, done, current }));
      });

    fc.assert(
      fc.property(arb, ({ rules, home, away, done, current }) => {
        const result = validateScore(rules, {
          kind: "sets",
          sets: [...done, current],
          endedByTime: true,
        });
        const expected =
          home !== away
            ? home > away
              ? "home"
              : "away"
            : current.home !== current.away
              ? current.home > current.away
                ? "home"
                : "away"
              : "invalid";
        expect(result.valid ? result.outcome : "invalid").toBe(expected);
      }),
    );
  });

  it("decides level fixed sets on total points when draws are not allowed", () => {
    const arb = fc
      .record({ set: setRulesArb, half: fc.integer({ min: 1, max: 3 }) })
      .chain(({ set, half }) => {
        const winners: Side[] = [...Array(half).fill("home"), ...Array(half).fill("away")];
        return fc
          .tuple(...winners.map((w) => wonSet(set, w)))
          .map((scores) => ({ set, half, scores }));
      });

    fc.assert(
      fc.property(arb, ({ set, half, scores }) => {
        const rules: MatchRules = { kind: "fixedSets", sets: 2 * half, set, drawAllowed: false };
        const result = validateScore(rules, { kind: "sets", sets: scores });
        const home = sum(scores, "home");
        const away = sum(scores, "away");
        const expected = home === away ? "invalid" : home > away ? "home" : "away";
        expect(result.valid ? result.outcome : "invalid").toBe(expected);
      }),
    );
  });
});
