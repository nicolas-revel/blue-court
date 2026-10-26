import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type ConfigErrorCode, validateMatchRules, validateTournament } from "./config.js";
import { FFVB_MATCH_RULES, FFVB_RANKING_POINTS, FFVB_TIE_BREAKERS } from "./ffvb.js";
import type {
  MatchRules,
  Phase,
  PhaseFormat,
  Qualification,
  SetRules,
  Tournament,
} from "./model.js";

/** FFVB rules, narrowed to "sets to win" so tests can spread and change them. */
const FFVB_SETS = (() => {
  if (FFVB_MATCH_RULES.kind !== "sets") throw new Error("FFVB rules play sets to win");
  return FFVB_MATCH_RULES;
})();

const phase = (
  id: string,
  format: PhaseFormat,
  qualification: Qualification,
  matchRules: MatchRules = FFVB_MATCH_RULES,
): Phase => ({
  id,
  name: id,
  format,
  matchRules,
  rankingPoints: FFVB_RANKING_POINTS,
  tieBreakers: FFVB_TIE_BREAKERS,
  qualification,
  refereeing: "restingTeam",
});

/** A club day: 16 teams in 4 pools, the top 2 of each pool in a full placement bracket. */
const clubDay = (): Tournament => ({
  id: "t",
  name: "Club day",
  seed: 42,
  teams: Array.from({ length: 16 }, (_, i) => ({
    id: `T${i + 1}`,
    name: `Team ${i + 1}`,
    ...(i < 4 ? { seed: i + 1 } : {}),
  })),
  phases: [
    phase(
      "pools",
      { kind: "pools", poolCount: 4, draw: "seeded" },
      { kind: "topPerPool", count: 2 },
    ),
    phase("finals", { kind: "fullPlacement" }, { kind: "all" }),
  ],
});

const codes = (t: Tournament) => {
  const result = validateTournament(t);
  return result.valid ? [] : result.errors.map((e) => e.code);
};

const withPhase = (t: Tournament, index: number, change: Partial<Phase>): Tournament => ({
  ...t,
  phases: t.phases.map((p, i) => (i === index ? { ...p, ...change } : p)),
});

describe("validateTournament", () => {
  it("accepts a club day with FFVB rules", () => {
    expect(validateTournament(clubDay())).toEqual({ valid: true });
  });

  it("names the code and the path of each faulty setting", () => {
    const t = withPhase(clubDay(), 0, {
      matchRules: { ...FFVB_SETS, set: { pointsToWin: 25, winByTwo: true, cap: 20 } },
    });
    expect(validateTournament(t)).toEqual({
      valid: false,
      errors: [
        {
          code: "CAP_TOO_LOW",
          message: "the cap must be a whole number above the points to win",
          path: ["phases", 0, "matchRules", "set", "cap"],
        },
      ],
    });
  });

  it("needs at least 2 teams", () => {
    expect(codes({ ...clubDay(), teams: [] })).toContain("TOO_FEW_TEAMS");
    expect(codes({ ...clubDay(), teams: clubDay().teams.slice(0, 1) })).toContain("TOO_FEW_TEAMS");
  });

  it("follows the qualified teams from phase to phase", () => {
    const t = withPhase(clubDay(), 0, { qualification: { kind: "topOverall", count: 1 } });
    expect(codes(t)).toEqual(["TOO_FEW_TEAMS"]);
  });

  it("checks the best teams at a rank against the pools", () => {
    const best = (rank: number, count: number): Tournament =>
      withPhase(clubDay(), 0, {
        qualification: { kind: "topPerPool", count: 2, bestAtRank: { rank, count } },
      });
    expect(codes(best(3, 4))).toEqual([]);
    expect(codes(best(2, 1))).toEqual(["QUALIFICATION_RANK"]);
    expect(codes(best(3, 5))).toEqual(["QUALIFICATION_COUNT"]);
  });

  it("only takes best teams from pools that have a team at that rank", () => {
    // 9 teams in 4 pools: sizes 3, 2, 2, 2, so a single pool has a 3rd-placed team.
    const nine = (rank: number, count: number): Tournament => {
      const t = clubDay();
      return {
        ...withPhase(t, 0, {
          qualification: { kind: "topPerPool", count: 1, bestAtRank: { rank, count } },
        }),
        teams: t.teams.slice(0, 9),
      };
    };
    expect(codes(nine(3, 1))).toEqual([]);
    expect(codes(nine(3, 2))).toEqual(["QUALIFICATION_COUNT"]);
    expect(codes(nine(4, 1))).toEqual(["QUALIFICATION_RANK", "QUALIFICATION_COUNT"]);
  });

  it("keeps checking the next phases after an invalid count", () => {
    const t = withPhase(
      withPhase(clubDay(), 0, { qualification: { kind: "topOverall", count: Number.NaN } }),
      1,
      { format: { kind: "pools", poolCount: 17, draw: "seeded" } },
    );
    expect(codes(t)).toEqual(["QUALIFICATION_COUNT", "POOL_COUNT"]);
  });

  it("leaves level pool qualification open until the pools exist", () => {
    const t = withPhase(clubDay(), 1, {
      format: { kind: "levelPools", grouping: { kind: "byRank" } },
      qualification: { kind: "topPerPool", count: 3 },
    });
    expect(codes(t)).toEqual([]);
  });
});

describe("validateMatchRules", () => {
  it("accepts FFVB rules and refuses impossible ones", () => {
    expect(validateMatchRules(FFVB_MATCH_RULES)).toEqual({ valid: true });
    const result = validateMatchRules({
      kind: "fixedSets",
      sets: 3,
      set: { pointsToWin: 0, winByTwo: true },
      drawAllowed: true,
      timeLimit: { minutes: 0 },
    });
    expect(result.valid ? [] : result.errors.map((e) => [e.code, e.path])).toEqual([
      ["POINTS_TO_WIN", ["set", "pointsToWin"]],
      ["TIME_LIMIT", ["timeLimit", "minutes"]],
      ["ODD_SETS_DRAW", ["drawAllowed"]],
    ]);
  });
});

const setRulesArb: fc.Arbitrary<SetRules> = fc
  .record({
    pointsToWin: fc.integer({ min: 1, max: 30 }),
    winByTwo: fc.boolean(),
    capGap: fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
  })
  .map(({ pointsToWin, winByTwo, capGap }) =>
    capGap === undefined
      ? { pointsToWin, winByTwo }
      : { pointsToWin, winByTwo, cap: pointsToWin + capGap },
  );

const timeLimitArb = fc.option(
  fc.integer({ min: 1, max: 60 }).map((minutes) => ({ minutes })),
  { nil: undefined },
);

const matchRulesArb: fc.Arbitrary<MatchRules> = fc.oneof(
  fc
    .record({
      setsToWin: fc.integer({ min: 1, max: 3 }),
      set: setRulesArb,
      tieBreakSet: fc.option(setRulesArb, { nil: undefined }),
      timeLimit: timeLimitArb,
    })
    .map(
      ({ setsToWin, set, tieBreakSet, timeLimit }): MatchRules => ({
        kind: "sets",
        setsToWin,
        set,
        ...(tieBreakSet && setsToWin > 1 ? { tieBreakSet } : {}),
        ...(timeLimit ? { timeLimit } : {}),
      }),
    ),
  fc
    .record({
      sets: fc.integer({ min: 1, max: 5 }),
      set: setRulesArb,
      draw: fc.boolean(),
      timeLimit: timeLimitArb,
    })
    .map(
      ({ sets, set, draw, timeLimit }): MatchRules => ({
        kind: "fixedSets",
        sets,
        set,
        drawAllowed: draw && sets % 2 === 0,
        ...(timeLimit ? { timeLimit } : {}),
      }),
    ),
  fc
    .record({ durationMinutes: fc.integer({ min: 1, max: 60 }), drawAllowed: fc.boolean() })
    .map((r): MatchRules => ({ kind: "timed", ...r })),
);

/** A valid tournament: pools, then a bracket or level pools for the qualified teams. */
const tournamentArb: fc.Arbitrary<Tournament> = fc
  .record({
    n: fc.integer({ min: 2, max: 32 }),
    poolShare: fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
    countShare: fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
    best: fc.boolean(),
    seeded: fc.integer({ min: 0, max: 32 }),
    next: fc.constantFrom<PhaseFormat["kind"]>(
      "singleElimination",
      "doubleElimination",
      "fullPlacement",
      "levelPools",
    ),
    rules: fc.tuple(matchRulesArb, matchRulesArb),
  })
  .map(({ n, poolShare, countShare, best, seeded, next, rules }): Tournament => {
    const poolCount = 1 + Math.floor(poolShare * Math.floor(n / 2));
    const count = 1 + Math.floor(countShare * Math.floor(n / poolCount));
    const left = n - count * poolCount;
    const bestAtRank =
      best && left > 0 ? { rank: count + 1, count: Math.min(poolCount, left) } : undefined;
    const qualified = count * poolCount + (bestAtRank?.count ?? 0);
    const kind = qualified < 2 ? "levelPools" : next;
    const format: PhaseFormat =
      kind === "levelPools"
        ? { kind, grouping: { kind: "bands", poolSize: 4 } }
        : kind === "singleElimination"
          ? { kind, consolation: true }
          : kind === "doubleElimination"
            ? { kind, grandFinalReset: true }
            : { kind: "fullPlacement" };
    return {
      id: "t",
      name: "Generated",
      seed: 1,
      teams: Array.from({ length: n }, (_, i) => ({
        id: `T${i + 1}`,
        name: `Team ${i + 1}`,
        ...(i < seeded ? { seed: i + 1 } : {}),
      })),
      phases: [
        phase(
          "pools",
          { kind: "pools", poolCount, draw: "seeded" },
          { kind: "topPerPool", count, ...(bestAtRank ? { bestAtRank } : {}) },
          rules[0],
        ),
        phase("next", format, { kind: "all" }, rules[1]),
      ],
    };
  });

/** Each mutation breaks one rule of a valid tournament. */
const mutations: readonly [ConfigErrorCode, (t: Tournament) => Tournament][] = [
  ["NO_PHASE", (t) => ({ ...t, phases: [] })],
  ["DUPLICATE_PHASE", (t) => ({ ...t, phases: t.phases.map((p) => ({ ...p, id: "same" })) })],
  ["DUPLICATE_TEAM", (t) => ({ ...t, teams: [...t.teams, ...t.teams.slice(0, 1)] })],
  [
    "INVALID_SEED",
    (t) => ({ ...t, teams: t.teams.map((team, i) => (i === 0 ? { ...team, seed: 0 } : team)) }),
  ],
  ["DUPLICATE_SEED", (t) => ({ ...t, teams: t.teams.map((team) => ({ ...team, seed: 1 })) })],
  [
    "POINTS_TO_WIN",
    (t) =>
      withPhase(t, 0, {
        matchRules: { ...FFVB_SETS, set: { pointsToWin: 0, winByTwo: true } },
      }),
  ],
  [
    "CAP_TOO_LOW",
    (t) =>
      withPhase(t, 0, {
        matchRules: { ...FFVB_SETS, set: { pointsToWin: 25, winByTwo: true, cap: 25 } },
      }),
  ],
  ["SETS_TO_WIN", (t) => withPhase(t, 0, { matchRules: { ...FFVB_SETS, setsToWin: 4 } })],
  ["TIE_BREAK_SET", (t) => withPhase(t, 0, { matchRules: { ...FFVB_SETS, setsToWin: 1 } })],
  [
    "TIME_LIMIT",
    (t) => withPhase(t, 0, { matchRules: { ...FFVB_SETS, timeLimit: { minutes: -5 } } }),
  ],
  [
    "SET_COUNT",
    (t) =>
      withPhase(t, 0, {
        matchRules: {
          kind: "fixedSets",
          sets: 0,
          set: { pointsToWin: 25, winByTwo: true },
          drawAllowed: false,
        },
      }),
  ],
  [
    "ODD_SETS_DRAW",
    (t) =>
      withPhase(t, 0, {
        matchRules: {
          kind: "fixedSets",
          sets: 3,
          set: { pointsToWin: 25, winByTwo: true },
          drawAllowed: true,
        },
      }),
  ],
  [
    "DURATION",
    (t) =>
      withPhase(t, 0, { matchRules: { kind: "timed", durationMinutes: 0, drawAllowed: true } }),
  ],
  [
    "RANKING_POINTS",
    (t) => withPhase(t, 0, { rankingPoints: { ...FFVB_RANKING_POINTS, win: Number.NaN } }),
  ],
  ["DUPLICATE_TIE_BREAKER", (t) => withPhase(t, 0, { tieBreakers: ["wins", "setRatio", "wins"] })],
  [
    "POOL_COUNT",
    (t) =>
      withPhase(t, 0, {
        format: { kind: "pools", poolCount: t.teams.length + 1, draw: "seeded" },
        qualification: { kind: "all" },
      }),
  ],
  [
    "POOL_SIZE",
    (t) =>
      withPhase(t, 1, { format: { kind: "levelPools", grouping: { kind: "bands", poolSize: 1 } } }),
  ],
  ["TOO_FEW_TEAMS", (t) => ({ ...t, teams: [] })],
  [
    "TOO_FEW_TEAMS",
    (t) =>
      withPhase(withPhase(t, 0, { qualification: { kind: "topOverall", count: 1 } }), 1, {
        format: { kind: "fullPlacement" },
      }),
  ],
  [
    "QUALIFICATION_COUNT",
    (t) => withPhase(t, 0, { qualification: { kind: "topOverall", count: t.teams.length + 1 } }),
  ],
  [
    "QUALIFICATION_RANK",
    (t) =>
      withPhase(t, 0, {
        qualification: { kind: "topPerPool", count: 1, bestAtRank: { rank: 1, count: 1 } },
      }),
  ],
];

describe("configuration properties", () => {
  it("accepts every generated valid tournament", () => {
    fc.assert(
      fc.property(tournamentArb, (t) => {
        expect(codes(t)).toEqual([]);
      }),
    );
  });

  it("accepts every generated valid match rules", () => {
    fc.assert(
      fc.property(matchRulesArb, (rules) => {
        expect(validateMatchRules(rules)).toEqual({ valid: true });
      }),
    );
  });

  it("rejects each broken rule with its code", () => {
    fc.assert(
      fc.property(tournamentArb, fc.constantFrom(...mutations), (t, [code, mutate]) => {
        expect(codes(mutate(t))).toContain(code);
      }),
    );
  });
});
