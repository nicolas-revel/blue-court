import { describe, expect, expectTypeOf, it } from "vitest";
import { FFVB_MATCH_RULES, FFVB_RANKING_POINTS, FFVB_TIE_BREAKERS } from "./ffvb.js";
import type { Match, MatchRules, Phase, PhaseFormat, Tournament } from "./model.js";
import type { Pairing } from "./round-robin.js";

const teams = ["A", "B", "C", "D", "E", "F", "G", "H"].map((name, i) => ({
  id: `team-${i + 1}`,
  name: `Team ${name}`,
  seed: i + 1,
}));

describe("tournament model", () => {
  it("expresses a typical club day: pools in the morning, level pools in the afternoon", () => {
    const morning: Phase = {
      id: "morning",
      name: "Morning pools",
      format: { kind: "pools", poolCount: 2 },
      matchRules: {
        kind: "fixedSets",
        sets: 2,
        set: { pointsToWin: 21, winByTwo: true },
        drawAllowed: true,
      },
      rankingPoints: { ...FFVB_RANKING_POINTS, draw: 2 },
      tieBreakers: FFVB_TIE_BREAKERS,
      qualification: { kind: "all" },
    };
    const afternoon: Phase = {
      id: "afternoon",
      name: "Level pools",
      format: { kind: "levelPools", poolSize: 4 },
      matchRules: FFVB_MATCH_RULES,
      rankingPoints: FFVB_RANKING_POINTS,
      tieBreakers: ["wins", "setRatio", "pointRatio", "headToHead"],
      qualification: { kind: "all" },
    };
    const tournament: Tournament = {
      id: "christmas-2026",
      name: "Christmas tournament",
      teams,
      phases: [morning, afternoon],
    };

    expect(tournament.phases.map((p) => p.format.kind)).toEqual(["pools", "levelPools"]);
    expect(tournament.teams).toHaveLength(8);
  });

  it("has exactly the phase formats of the specs", () => {
    expectTypeOf<PhaseFormat["kind"]>().toEqualTypeOf<
      "pools" | "levelPools" | "singleElimination" | "doubleElimination" | "fullPlacement"
    >();
  });

  it("expresses timed matches and capped sets", () => {
    const timed: MatchRules = { kind: "timed", durationMinutes: 12, drawAllowed: true };
    const capped: MatchRules = {
      kind: "sets",
      setsToWin: 2,
      set: { pointsToWin: 25, winByTwo: true, cap: 27 },
      tieBreakSet: { pointsToWin: 15, winByTwo: false },
    };
    expect([timed.kind, capped.kind]).toEqual(["timed", "sets"]);
  });

  it("expresses qualification per pool, overall, or for everyone", () => {
    const rules: Phase["qualification"][] = [
      { kind: "all" },
      { kind: "topPerPool", count: 2, bestAtRank: { rank: 3, count: 4 } },
      { kind: "topOverall", count: 8 },
    ];
    expect(rules.map((q) => q.kind)).toEqual(["all", "topPerPool", "topOverall"]);
  });

  it("records set scores, timed scores and forfeits", () => {
    const played: Match[] = [
      {
        id: "m1",
        phaseId: "morning",
        home: "team-1",
        away: "team-2",
        score: {
          kind: "sets",
          sets: [
            { home: 25, away: 20 },
            { home: 23, away: 25 },
            { home: 15, away: 13 },
          ],
        },
      },
      {
        id: "m2",
        phaseId: "morning",
        home: "team-3",
        away: "team-4",
        score: { kind: "timed", home: 12, away: 12 },
      },
      {
        id: "m3",
        phaseId: "morning",
        home: "team-5",
        away: "team-6",
        score: { kind: "forfeit", forfeitedBy: "away" },
      },
      { id: "m4", phaseId: "morning", home: "team-7", away: "team-8" },
    ];
    expect(played.filter((m) => m.score === undefined)).toHaveLength(1);
  });

  it("only accepts draw and tie-break settings where they make sense", () => {
    expectTypeOf<Extract<MatchRules, { kind: "sets" }>>().not.toHaveProperty("drawAllowed");
    expectTypeOf<Extract<MatchRules, { kind: "fixedSets" }>>().not.toHaveProperty("tieBreakSet");
    expectTypeOf<Extract<MatchRules, { kind: "timed" }>>().not.toHaveProperty("set");
  });

  it("builds matches on the existing round-robin pairing", () => {
    expectTypeOf<Match>().toMatchTypeOf<Pairing<string>>();
  });
});

describe("FFVB defaults", () => {
  it("plays best of five sets to 25, with a tie-break set to 15, both with a 2-point margin", () => {
    expect(FFVB_MATCH_RULES).toEqual({
      kind: "sets",
      setsToWin: 3,
      set: { pointsToWin: 25, winByTwo: true },
      tieBreakSet: { pointsToWin: 15, winByTwo: true },
    });
  });

  it("awards 3-2-1-0 ranking points depending on the set score", () => {
    expect(FFVB_RANKING_POINTS).toEqual({
      win: 3,
      tieBreakWin: 2,
      tieBreakLoss: 1,
      loss: 0,
      draw: 0,
      forfeitWin: 3,
      forfeitLoss: 0,
    });
  });

  it("cannot be mutated by accident", () => {
    expect(Object.isFrozen(FFVB_MATCH_RULES)).toBe(true);
    expect(Object.isFrozen(FFVB_RANKING_POINTS)).toBe(true);
    expect(Object.isFrozen(FFVB_TIE_BREAKERS)).toBe(true);
  });
});
