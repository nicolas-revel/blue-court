import { describe, expect, expectTypeOf, it } from "vitest";
import { FFVB_MATCH_RULES, FFVB_RANKING_POINTS, FFVB_TIE_BREAKERS } from "./ffvb.js";
import type { Match, Phase, Tournament } from "./model.js";
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
        ...FFVB_MATCH_RULES,
        format: { kind: "fixedSets", sets: 2 },
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

  it("expresses every phase format of the specs", () => {
    const formats: Phase["format"][] = [
      { kind: "pools", poolCount: 4 },
      { kind: "levelPools", poolSize: 4 },
      { kind: "singleElimination", consolation: true },
      { kind: "doubleElimination", grandFinalReset: false },
      { kind: "fullPlacement" },
    ];
    expect(new Set(formats.map((f) => f.kind)).size).toBe(5);
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

  it("builds matches on the existing round-robin pairing", () => {
    expectTypeOf<Match>().toMatchTypeOf<Pairing<string>>();
  });
});

describe("FFVB defaults", () => {
  it("plays best of five sets to 25, with a tie-break set to 15, both with a 2-point margin", () => {
    expect(FFVB_MATCH_RULES).toEqual({
      format: { kind: "sets", setsToWin: 3 },
      set: { pointsToWin: 25, winByTwo: true },
      tieBreakSet: { pointsToWin: 15, winByTwo: true },
      drawAllowed: false,
    });
  });

  it("awards 3-2-1-0 ranking points depending on the set score", () => {
    expect(FFVB_RANKING_POINTS).toEqual({
      win: 3,
      tieBreakWin: 2,
      tieBreakLoss: 1,
      loss: 0,
      draw: 0,
      forfeitLoss: 0,
    });
  });

  it("cannot be mutated by accident", () => {
    expect(Object.isFrozen(FFVB_MATCH_RULES)).toBe(true);
    expect(Object.isFrozen(FFVB_RANKING_POINTS)).toBe(true);
    expect(Object.isFrozen(FFVB_TIE_BREAKERS)).toBe(true);
  });
});
