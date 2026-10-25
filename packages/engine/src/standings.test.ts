import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FFVB_MATCH_RULES, FFVB_RANKING_POINTS, FFVB_TIE_BREAKERS } from "./ffvb.js";
import type { Match, MatchScore, Phase } from "./model.js";
import { roundRobin } from "./round-robin.js";
import { computeStandings, type StandingsError, type StandingsInput } from "./standings.js";

const ffvb: StandingsInput["phase"] = {
  matchRules: FFVB_MATCH_RULES,
  rankingPoints: FFVB_RANKING_POINTS,
  tieBreakers: FFVB_TIE_BREAKERS,
};

let nextId = 0;
const match = (home: string, away: string, score?: MatchScore): Match => ({
  id: `m${++nextId}`,
  phaseId: "pool",
  home,
  away,
  ...(score ? { score } : {}),
});
const sets = (...scores: [number, number][]): MatchScore => ({
  kind: "sets",
  sets: scores.map(([home, away]) => ({ home, away })),
});
const timed = (home: number, away: number): MatchScore => ({ kind: "timed", home, away });
const order = (rows: ReturnType<typeof computeStandings>) => rows.map((r) => r.team);

describe("computeStandings", () => {
  it("reproduces the reference Tournoi Plus tournament (6 teams, 15 timed matches)", () => {
    const phase: Pick<Phase, "matchRules" | "rankingPoints" | "tieBreakers"> = {
      matchRules: { kind: "timed", durationMinutes: 8, drawAllowed: true },
      rankingPoints: { ...FFVB_RANKING_POINTS, win: 2, draw: 1, loss: 0, forfeitWin: 2 },
      tieBreakers: ["rankingPoints", "pointRatio", "headToHead"],
    };
    const matches = [
      match("10a", "9b", timed(9, 5)),
      match("9a", "9c", timed(6, 17)),
      match("10b", "Lehrer", timed(8, 16)),
      match("9a", "10a", timed(12, 12)),
      match("Lehrer", "9b", timed(20, 4)),
      match("9c", "10b", timed(11, 11)),
      match("10a", "Lehrer", timed(9, 10)),
      match("10b", "9a", timed(8, 13)),
      match("9b", "9c", timed(12, 10)),
      match("10b", "10a", timed(9, 11)),
      match("9c", "Lehrer", timed(7, 15)),
      match("9a", "9b", timed(13, 9)),
      match("9c", "10a", timed(9, 15)),
      match("9b", "10b", timed(11, 13)),
      match("Lehrer", "9a", timed(9, 14)),
    ];
    const rows = computeStandings({
      teams: ["9a", "9b", "9c", "10a", "10b", "Lehrer"],
      matches,
      phase,
    });
    expect(
      rows.map((r) => [r.rank, r.team, r.played, r.pointsWon, r.pointsLost, r.rankingPoints]),
    ).toEqual([
      [1, "Lehrer", 5, 70, 42, 8],
      [2, "10a", 5, 56, 45, 7],
      [3, "9a", 5, 58, 55, 7],
      [4, "9c", 5, 54, 59, 3],
      [5, "10b", 5, 49, 62, 3],
      [6, "9b", 5, 41, 65, 2],
    ]);
  });

  it("gives 3-2 wins the tie-break points and ranks on set ratio, then point ratio", () => {
    const rows = computeStandings({
      teams: ["A", "B", "C"],
      matches: [
        match("A", "B", sets([25, 20], [20, 25], [25, 20], [20, 25], [15, 10])),
        match("B", "C", sets([25, 10], [25, 10], [25, 10])),
        match("C", "A", sets([25, 20], [25, 20], [25, 20])),
      ],
      phase: ffvb,
    });
    expect(rows.map((r) => [r.team, r.rankingPoints, r.setsWon, r.setsLost])).toEqual([
      ["B", 4, 5, 3],
      ["C", 3, 3, 3],
      ["A", 2, 3, 5],
    ]);
  });

  it("counts a forfeit as the shortest possible win with every set to 0", () => {
    const [winner, loser] = computeStandings({
      teams: ["A", "B"],
      matches: [match("A", "B", { kind: "forfeit", forfeitedBy: "away" })],
      phase: ffvb,
    });
    expect(winner).toMatchObject({ team: "A", rankingPoints: 3, setsWon: 3, pointsWon: 75 });
    expect(loser).toMatchObject({ team: "B", rankingPoints: 0, setsLost: 3, pointsLost: 75 });
  });

  it("breaks a head-to-head tie between two teams", () => {
    // Points: A 6, B 3, C 3, D 6. A and D are level; D beat A.
    const phase = { ...ffvb, tieBreakers: ["rankingPoints", "headToHead"] as const };
    const win = sets([25, 0], [25, 0], [25, 0]);
    const rows = computeStandings({
      teams: ["D", "C", "B", "A"],
      matches: [
        match("A", "B", win),
        match("A", "C", win),
        match("C", "B", win),
        match("B", "D", win),
        match("D", "A", win),
        match("D", "C", win),
      ],
      phase,
    });
    expect(order(rows)).toEqual(["D", "A", "C", "B"]);
  });

  it("splits a three-way tie with a head-to-head mini-league, then the next tie-breaker", () => {
    // A, B and C have 6 points. Among them, A beat B and C, and B-C is not played yet, so
    // head-to-head puts A first and leaves B and C level: the set ratio separates them.
    const phase = { ...ffvb, tieBreakers: ["rankingPoints", "headToHead", "setRatio"] as const };
    const win = sets([25, 0], [25, 0], [25, 0]);
    const winDroppingASet = sets([25, 0], [0, 25], [25, 0], [25, 0]);
    const rows = computeStandings({
      teams: ["E", "D", "C", "B", "A"],
      matches: [
        match("A", "B", win),
        match("A", "C", win),
        match("B", "D", winDroppingASet),
        match("B", "E", win),
        match("C", "D", win),
        match("C", "E", win),
        match("D", "A", win),
        match("E", "A", win),
        match("D", "E"),
      ],
      phase,
    });
    // Sets: C 6:3, B 6:4; D 4:6, E 3:6.
    expect(order(rows)).toEqual(["A", "C", "B", "D", "E"]);
  });

  it("applies head-to-head again within a group the mini-league leaves level", () => {
    // A, B, C and D have 9 points. Their mini-league gives A 9, B 4, C 4, D 1, so B and C
    // stay level; their own match (B won 3-2) then puts B ahead.
    const phase = { ...ffvb, tieBreakers: ["rankingPoints", "headToHead"] as const };
    const win = sets([25, 0], [25, 0], [25, 0]);
    const win32 = sets([25, 0], [25, 0], [0, 25], [0, 25], [15, 0]);
    const rows = computeStandings({
      teams: ["G", "F", "E", "D", "C", "B", "A"],
      matches: [
        match("A", "B", win),
        match("A", "C", win),
        match("A", "D", win),
        match("B", "C", win32),
        match("B", "D", win32),
        match("C", "D", win),
        match("B", "E", win),
        match("B", "F", win32),
        match("C", "E", win),
        match("C", "G", win32),
        match("D", "E", win),
        match("D", "F", win),
        match("D", "G", win32),
      ],
      phase,
    });
    expect(rows.slice(0, 4).map((r) => r.rankingPoints)).toEqual([9, 9, 9, 9]);
    expect(order(rows)).toEqual(["A", "B", "C", "D", "G", "F", "E"]);
  });

  it("moves to the next tie-breaker when head-to-head is a cycle", () => {
    // A beat B, B beat C, C beat A: head-to-head leaves all three level.
    const phase = { ...ffvb, tieBreakers: ["rankingPoints", "headToHead", "setRatio"] as const };
    const rows = computeStandings({
      teams: ["A", "B", "C"],
      matches: [
        match("A", "B", sets([25, 0], [0, 25], [25, 0], [25, 0])),
        match("B", "C", sets([25, 0], [25, 0], [25, 0])),
        match("C", "A", sets([25, 0], [25, 0], [25, 0])),
      ],
      phase,
    });
    // Sets: B 4:3, C 3:3, A 3:4.
    expect(order(rows)).toEqual(["B", "C", "A"]);
  });

  it("counts only finished sets of a match stopped by time, with no tie-break points", () => {
    const phase = {
      ...ffvb,
      matchRules: {
        kind: "sets",
        setsToWin: 3,
        set: { pointsToWin: 25, winByTwo: true },
        tieBreakSet: { pointsToWin: 15, winByTwo: true },
        timeLimit: { minutes: 40 },
      },
    } as const satisfies StandingsInput["phase"];
    const stopped = (...scores: [number, number][]): MatchScore =>
      ({
        ...sets(...scores),
        endedByTime: true,
      }) as MatchScore;
    const fifth = computeStandings({
      teams: ["A", "B"],
      matches: [match("A", "B", stopped([25, 20], [20, 25], [25, 20], [20, 25], [10, 8]))],
      phase,
    });
    expect(fifth[0]).toMatchObject({ team: "A", rankingPoints: 3, setsWon: 2, setsLost: 2 });
    expect(fifth[0]).toMatchObject({ pointsWon: 100, pointsLost: 98 });
    expect(fifth[1]).toMatchObject({ team: "B", rankingPoints: 0 });

    // Time ran out right after a set was won: that set counts.
    const third = computeStandings({
      teams: ["A", "B"],
      matches: [match("A", "B", stopped([25, 20], [20, 25], [25, 10]))],
      phase,
    });
    expect(third[0]).toMatchObject({ team: "A", setsWon: 2, setsLost: 1 });
  });

  it("counts a forfeit under fixed sets and timed rules", () => {
    const forfeit: MatchScore = { kind: "forfeit", forfeitedBy: "away" };
    const [fixedWinner] = computeStandings({
      teams: ["A", "B"],
      matches: [match("A", "B", forfeit)],
      phase: {
        ...ffvb,
        matchRules: {
          kind: "fixedSets",
          sets: 2,
          set: { pointsToWin: 25, winByTwo: true },
          drawAllowed: true,
        },
      },
    });
    expect(fixedWinner).toMatchObject({ team: "A", setsWon: 2, pointsWon: 50, rankingPoints: 3 });
    const [timedWinner, timedLoser] = computeStandings({
      teams: ["A", "B"],
      matches: [match("A", "B", forfeit)],
      phase: { ...ffvb, matchRules: { kind: "timed", durationMinutes: 8, drawAllowed: true } },
    });
    expect(timedWinner).toMatchObject({ team: "A", setsWon: 0, pointsWon: 0, rankingPoints: 3 });
    expect(timedLoser).toMatchObject({ team: "B", pointsLost: 0, rankingPoints: 0 });
  });

  it("handles pools of zero and one team", () => {
    expect(computeStandings({ teams: [], matches: [], phase: ffvb })).toEqual([]);
    expect(computeStandings({ teams: ["A"], matches: [], phase: ffvb })).toEqual([
      expect.objectContaining({ team: "A", rank: 1, played: 0, rankingPoints: 0 }),
    ]);
  });

  it("sums head-to-head over every match between the level teams", () => {
    // A and B have 5 points. They met twice: A won 3-0 (3-0 points), B won 3-2 (2-1), so
    // head-to-head gives A 4, B 2.
    const phase = { ...ffvb, tieBreakers: ["rankingPoints", "headToHead"] as const };
    const win = sets([25, 0], [25, 0], [25, 0]);
    const win32 = sets([25, 0], [25, 0], [0, 25], [0, 25], [15, 0]);
    const rows = computeStandings({
      teams: ["C", "B", "A"],
      matches: [
        match("A", "B", win),
        match("B", "A", win32),
        match("B", "C", win),
        match("C", "A", win32),
      ],
      phase,
    });
    expect(rows.slice(0, 2).map((r) => r.rankingPoints)).toEqual([5, 5]);
    expect(order(rows)).toEqual(["A", "B", "C"]);
  });

  it("puts a team that lost no set ahead, and treats nothing won or lost as 0", () => {
    // A: 3 won, 0 lost. B: 0 won, 3 lost. C: nothing played. B and C both have a ratio of 0.
    const phase = { ...ffvb, tieBreakers: ["setRatio"] as const };
    const rows = computeStandings({
      teams: ["C", "B", "A"],
      matches: [match("A", "B", sets([25, 0], [25, 0], [25, 0]))],
      phase,
    });
    expect(rows[0]?.team).toBe("A");
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 2]);
  });

  it("shares a rank when every tie-breaker is level, and ignores unplayed matches", () => {
    const rows = computeStandings({
      teams: ["A", "B", "C"],
      matches: [match("A", "B"), match("B", "C")],
      phase: ffvb,
    });
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("separates level teams with a reproducible random draw", () => {
    const phase = { ...ffvb, tieBreakers: ["rankingPoints", "random"] as const };
    const input = { teams: ["A", "B", "C", "D"], matches: [], phase, seed: 42 };
    const first = computeStandings(input);
    expect(first.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(computeStandings(input)).toEqual(first);
    expect(() => computeStandings({ teams: input.teams, matches: [], phase })).toThrow(
      "SEED_REQUIRED",
    );
  });

  it("refuses invalid scores, unknown teams, same-team matches and duplicates", () => {
    const base = { teams: ["A", "B"], phase: ffvb };
    expect(() => computeStandings({ ...base, matches: [match("A", "B", sets([25, 24]))] })).toThrow(
      "INVALID_SCORE",
    );
    expect(() => computeStandings({ ...base, matches: [match("A", "Z", sets([25, 0]))] })).toThrow(
      "UNKNOWN_TEAM",
    );
    expect(() => computeStandings({ ...base, teams: ["A", "A"], matches: [] })).toThrow(
      "DUPLICATE_TEAM",
    );
    expect(() => computeStandings({ ...base, matches: [match("A", "A")] })).toThrow("SAME_TEAM");
    expect(() => computeStandings({ ...base, matches: [match("A", "A")] })).toThrow(
      expect.objectContaining({ code: "SAME_TEAM" }) as StandingsError,
    );
  });
});

/** A full round-robin pool with a random winner and set score for every match. */
const poolArb = fc.integer({ min: 2, max: 8 }).chain((n) => {
  const teams = Array.from({ length: n }, (_, i) => `T${i}`);
  const pairings = roundRobin(teams).flat();
  const scoreArb: fc.Arbitrary<MatchScore> = fc.oneof(
    fc
      .tuple(fc.boolean(), fc.integer({ min: 0, max: 2 }), fc.integer({ min: 0, max: 23 }))
      .map(([homeWins, lost, loser]) => {
        const won: [number, number] = homeWins ? [25, loser] : [loser, 25];
        const lostSet: [number, number] = homeWins ? [loser, 25] : [25, loser];
        // A fifth set is the tie-break set, played to 15.
        const short = Math.min(loser, 13);
        const last: [number, number] = lost === 2 ? (homeWins ? [15, short] : [short, 15]) : won;
        return sets(...Array(lost).fill(lostSet), won, won, last);
      }),
    fc
      .constantFrom<"home" | "away">("home", "away")
      .map((side): MatchScore => ({ kind: "forfeit", forfeitedBy: side })),
  );
  return fc.tuple(...pairings.map(() => scoreArb), fc.integer()).map(([...rest]) => {
    const seed = rest.pop() as number;
    const scores = rest as MatchScore[];
    const matches = pairings.map((p, i) => match(p.home, p.away, scores[i]));
    return { teams, matches, seed };
  });
});

const timedPoolArb = fc.integer({ min: 2, max: 8 }).chain((n) => {
  const teams = Array.from({ length: n }, (_, i) => `T${i}`);
  const pairings = roundRobin(teams).flat();
  const scoreArb = fc
    .tuple(fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 20 }))
    .map(([home, away]) => timed(home, away));
  return fc.tuple(...pairings.map(() => scoreArb)).map((scores) => ({
    teams,
    matches: pairings.map((p, i) => match(p.home, p.away, scores[i])),
  }));
});

describe("computeStandings properties", () => {
  const phase = { ...ffvb, tieBreakers: [...FFVB_TIE_BREAKERS, "headToHead", "random"] as const };

  it("ranks every team exactly once, with ranks from 1 that never go down", () => {
    fc.assert(
      fc.property(poolArb, ({ teams, matches, seed }) => {
        const rows = computeStandings({ teams, matches, phase, seed });
        expect([...order(rows)].sort()).toEqual([...teams].sort());
        expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
        for (let i = 1; i < rows.length; i++) {
          expect((rows[i - 1]?.rankingPoints ?? 0) >= (rows[i]?.rankingPoints ?? 0)).toBe(true);
        }
      }),
    );
  });

  it("balances wins and losses, and every team plays n - 1 matches", () => {
    fc.assert(
      fc.property(poolArb, ({ teams, matches, seed }) => {
        const rows = computeStandings({ teams, matches, phase, seed });
        const total = (f: (r: (typeof rows)[number]) => number) =>
          rows.reduce((s, r) => s + f(r), 0);
        expect(total((r) => r.wins)).toBe(total((r) => r.losses));
        expect(total((r) => r.setsWon)).toBe(total((r) => r.setsLost));
        expect(rows.every((r) => r.played === teams.length - 1)).toBe(true);
      }),
    );
  });

  it("balances results in timed pools with draws", () => {
    const timedPhase = {
      matchRules: { kind: "timed", durationMinutes: 8, drawAllowed: true },
      rankingPoints: { ...FFVB_RANKING_POINTS, win: 2, draw: 1, loss: 0 },
      tieBreakers: ["wins", "pointRatio"],
    } as const satisfies StandingsInput["phase"];
    fc.assert(
      fc.property(timedPoolArb, ({ teams, matches }) => {
        const rows = computeStandings({ teams, matches, phase: timedPhase });
        const total = (f: (r: (typeof rows)[number]) => number) =>
          rows.reduce((s, r) => s + f(r), 0);
        expect(total((r) => r.wins)).toBe(total((r) => r.losses));
        expect(total((r) => r.draws) % 2).toBe(0);
        expect(total((r) => r.pointsWon)).toBe(total((r) => r.pointsLost));
        // With wins as the first tie-breaker, wins never go up down the table.
        for (let i = 1; i < rows.length; i++) {
          expect((rows[i - 1]?.wins ?? 0) >= (rows[i]?.wins ?? 0)).toBe(true);
        }
      }),
    );
  });

  it("orders two teams level on ranking points by their direct match", () => {
    const h2hPhase = { ...ffvb, tieBreakers: ["rankingPoints", "headToHead"] as const };
    fc.assert(
      fc.property(poolArb, ({ teams, matches }) => {
        const rows = computeStandings({ teams, matches, phase: h2hPhase });
        for (const points of new Set(rows.map((r) => r.rankingPoints))) {
          const level = rows.filter((r) => r.rankingPoints === points);
          if (level.length !== 2) continue;
          const [first, second] = level.map((r) => r.team);
          const direct = matches.find(
            (m) =>
              [m.home, m.away].includes(first ?? "") && [m.home, m.away].includes(second ?? ""),
          );
          const score = direct?.score;
          if (direct === undefined || score === undefined) continue;
          const winner =
            score.kind === "forfeit"
              ? score.forfeitedBy === "home"
                ? direct.away
                : direct.home
              : score.kind === "sets" &&
                  score.sets.filter((x) => x.home > x.away).length >
                    score.sets.filter((x) => x.away > x.home).length
                ? direct.home
                : direct.away;
          expect(first).toBe(winner);
        }
      }),
    );
  });

  it("does not depend on the order of matches or teams", () => {
    fc.assert(
      fc.property(poolArb, ({ teams, matches, seed }) => {
        const rows = computeStandings({ teams, matches, phase, seed });
        const shuffled = computeStandings({
          teams: [...teams].reverse(),
          matches: [...matches].reverse(),
          phase,
          seed,
        });
        expect(shuffled).toEqual(rows);
      }),
    );
  });
});
