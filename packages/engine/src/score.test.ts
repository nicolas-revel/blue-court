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

describe("validateScore properties", () => {
  it("gives every generated finished match exactly the team that won the most sets", () => {
    const arb = fc
      .record({
        setsToWin: fc.integer({ min: 1, max: 3 }),
        set: setRulesArb,
        winner: fc.constantFrom<Side>("home", "away"),
        lostSets: fc.nat(),
        order: fc.array(fc.boolean(), { maxLength: 10 }),
      })
      .chain(({ setsToWin, set, winner, lostSets, order }) => {
        const loser: Side = winner === "home" ? "away" : "home";
        const losses = lostSets % setsToWin;
        // The winner always takes the last set; the others are shuffled.
        const others = [...Array(setsToWin - 1).fill(winner), ...Array(losses).fill(loser)];
        const sorted = others
          .map((side, i) => ({ side, key: order[i] ?? false }))
          .sort((a, b) => Number(a.key) - Number(b.key))
          .map((x) => x.side as Side);
        const winners = [...sorted, winner];
        const rules: MatchRules = { kind: "sets", setsToWin, set };
        return fc
          .tuple(...winners.map((w) => wonSet(set, w)))
          .map((scores) => ({ rules, winner, scores }));
      });

    fc.assert(
      fc.property(arb, ({ rules, winner, scores }) => {
        expect(validateScore(rules, { kind: "sets", sets: scores })).toEqual({
          valid: true,
          outcome: winner,
        });
      }),
    );
  });

  it("never finds a winner in a fixed-sets match whose sets and points are level", () => {
    fc.assert(
      fc.property(setRulesArb, fc.integer({ min: 1, max: 3 }), (set, half) => {
        const won = Array.from({ length: half }, () => ({ home: set.pointsToWin, away: 0 }));
        const lost = won.map(({ home, away }) => ({ home: away, away: home }));
        const rules: MatchRules = { kind: "fixedSets", sets: 2 * half, set, drawAllowed: false };
        const result = validateScore(rules, { kind: "sets", sets: [...won, ...lost] });
        expect(result.valid ? result.outcome : "invalid").toBe("invalid");
      }),
    );
  });
});
