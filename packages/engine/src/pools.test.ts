import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FFVB_TIE_BREAKERS } from "./ffvb.js";
import type { Match, Team } from "./model.js";
import { buildLevelPools, drawPools, moveTeam, type PoolsError, rankAcrossPools } from "./pools.js";
import { roundRobin } from "./round-robin.js";
import type { StandingRow } from "./standings.js";

const seededTeams = (n: number): Team[] =>
  Array.from({ length: n }, (_, i) => ({ id: `S${i + 1}`, name: `Seed ${i + 1}`, seed: i + 1 }));
const unseededTeams = (n: number): Team[] =>
  Array.from({ length: n }, (_, i) => ({ id: `U${i + 1}`, name: `Team ${i + 1}` }));

/** A standings row with the given ranking points over `played` matches. */
const row = (team: string, rankingPoints: number, played = 3): StandingRow => ({
  team,
  rank: 0,
  played,
  wins: 0,
  draws: 0,
  losses: 0,
  rankingPoints,
  setsWon: 0,
  setsLost: 0,
  pointsWon: 0,
  pointsLost: 0,
});

describe("drawPools", () => {
  it("spreads seeds in a snake", () => {
    const pools = drawPools({ teams: seededTeams(8), poolCount: 2, draw: "seeded", seed: 1 });
    expect(pools).toEqual([
      ["S1", "S4", "S5", "S8"],
      ["S2", "S3", "S6", "S7"],
    ]);
  });

  it("puts one top seed in each pool, then draws the unseeded teams", () => {
    const teams = [...seededTeams(4), ...unseededTeams(8)];
    const pools = drawPools({ teams, poolCount: 4, draw: "seeded", seed: 7 });
    expect(pools.map((pool) => pool[0])).toEqual(["S1", "S2", "S3", "S4"]);
    expect(pools.every((pool) => pool.length === 3)).toBe(true);
    expect(drawPools({ teams, poolCount: 4, draw: "seeded", seed: 7 })).toEqual(pools);
  });

  it("makes pools that differ by at most one team when the count does not divide", () => {
    const pools = drawPools({ teams: unseededTeams(10), poolCount: 3, draw: "random", seed: 3 });
    expect(pools.map((pool) => pool.length).sort()).toEqual([3, 3, 4]);
  });

  it("feeds the round-robin to give each pool its matches", () => {
    const pools = drawPools({ teams: seededTeams(10), poolCount: 2, draw: "seeded", seed: 1 });
    const matches: Match[] = pools.flatMap((pool, p) =>
      roundRobin(pool)
        .flat()
        .map((pairing, i) => ({ id: `p${p}m${i}`, phaseId: "pools", ...pairing })),
    );
    expect(matches).toHaveLength(2 * 10);
    const keys = matches.map((m) => [m.home, m.away].sort().join("-"));
    expect(new Set(keys).size).toBe(matches.length);
  });

  it("ignores seeds in a random draw", () => {
    const teams = seededTeams(16);
    const draws = [1, 2, 3, 4, 5].map((seed) =>
      drawPools({ teams, poolCount: 4, draw: "random", seed }),
    );
    expect(draws.some((pools) => pools[0]?.[0] !== "S1")).toBe(true);
  });

  it("refuses a pool count out of range and duplicate teams", () => {
    const teams = unseededTeams(4);
    expect(() => drawPools({ teams: [], poolCount: 1, draw: "random", seed: 1 })).toThrow(
      "INVALID_POOL_COUNT",
    );
    for (const poolCount of [0, 5, 1.5]) {
      expect(() => drawPools({ teams, poolCount, draw: "random", seed: 1 })).toThrow(
        "INVALID_POOL_COUNT",
      );
    }
    expect(() =>
      drawPools({ teams: [...teams, ...teams], poolCount: 2, draw: "random", seed: 1 }),
    ).toThrow(expect.objectContaining({ code: "DUPLICATE_TEAM" }) as PoolsError);
  });
});

describe("moveTeam", () => {
  const pools = [
    ["A", "B", "C"],
    ["D", "E", "F"],
  ];

  it("moves a team to another pool without changing the input", () => {
    expect(moveTeam(pools, "B", 1)).toEqual([
      ["A", "C"],
      ["D", "E", "F", "B"],
    ]);
    expect(pools[0]).toEqual(["A", "B", "C"]);
    expect(moveTeam(pools, "B", 0)).toEqual([
      ["A", "C", "B"],
      ["D", "E", "F"],
    ]);
  });

  it("refuses an unknown team or pool", () => {
    expect(() => moveTeam(pools, "Z", 0)).toThrow("UNKNOWN_TEAM");
    expect(() => moveTeam(pools, "A", 2)).toThrow("UNKNOWN_POOL");
  });
});

describe("rankAcrossPools", () => {
  it("orders by position in pool, then compares same positions per match", () => {
    // Pool 1 has 5 teams (4 matches each), pool 2 has 4 (3 matches each). Among the 2nd-placed
    // teams, B has more points in total than G (9 vs 7) but fewer per match (2.25 vs 2.33).
    const standings = [
      [row("A", 12, 4), row("B", 9, 4), row("C", 6, 4), row("D", 3, 4), row("E", 0, 4)],
      [row("F", 10), row("G", 7), row("H", 3), row("I", 1)],
    ];
    const ranking = rankAcrossPools({ standings, tieBreakers: FFVB_TIE_BREAKERS });
    expect(ranking.map((p) => p.team)).toEqual(["F", "A", "G", "B", "C", "H", "D", "I", "E"]);
    expect(ranking[0]).toEqual({ team: "F", pool: 1, position: 1 });
  });

  it("needs a seed for a random draw", () => {
    expect(() => rankAcrossPools({ standings: [[row("A", 3)]], tieBreakers: ["random"] })).toThrow(
      "SEED_REQUIRED",
    );
  });
});

describe("buildLevelPools", () => {
  const standings = [
    [row("A", 9), row("B", 6), row("C", 3), row("D", 0)],
    [row("E", 8), row("F", 7), row("G", 2), row("H", 1)],
    [row("I", 7), row("J", 5), row("K", 4), row("L", 0)],
  ];

  it("puts all 1st-placed teams together, all 2nd-placed together, and so on", () => {
    const pools = buildLevelPools({
      standings,
      tieBreakers: FFVB_TIE_BREAKERS,
      grouping: { kind: "byRank" },
    });
    expect(pools).toEqual([
      ["A", "E", "I"],
      ["F", "B", "J"],
      ["K", "C", "G"],
      ["H", "D", "L"],
    ]);
  });

  it("cuts the overall ranking into bands no larger than the pool size", () => {
    const pools = buildLevelPools({
      standings: [...standings, [row("M", 1, 0)]],
      tieBreakers: FFVB_TIE_BREAKERS,
      grouping: { kind: "bands", poolSize: 4 },
    });
    expect(pools.map((pool) => pool.length)).toEqual([4, 3, 3, 3]);
    expect(pools[0]).toEqual(["A", "E", "I", "M"]);
  });

  it("refuses a pool size under 2", () => {
    expect(() =>
      buildLevelPools({
        standings,
        tieBreakers: FFVB_TIE_BREAKERS,
        grouping: { kind: "bands", poolSize: 1 },
      }),
    ).toThrow("INVALID_POOL_SIZE");
  });

  it("handles no teams", () => {
    const empty = { standings: [], tieBreakers: FFVB_TIE_BREAKERS };
    expect(buildLevelPools({ ...empty, grouping: { kind: "byRank" } })).toEqual([]);
    expect(buildLevelPools({ ...empty, grouping: { kind: "bands", poolSize: 4 } })).toEqual([]);
  });
});

const drawArb = fc
  .record({
    seeded: fc.integer({ min: 0, max: 12 }),
    unseeded: fc.integer({ min: 0, max: 20 }),
    draw: fc.constantFrom("seeded" as const, "random" as const),
    seed: fc.integer(),
  })
  .filter(({ seeded, unseeded }) => seeded + unseeded >= 1)
  .chain((r) =>
    fc.integer({ min: 1, max: r.seeded + r.unseeded }).map((poolCount) => ({
      ...r,
      poolCount,
      teams: [...seededTeams(r.seeded), ...unseededTeams(r.unseeded)],
    })),
  );

/** Pools of 2 to 6 teams with random ranking points, as standings sorted by those points. */
const standingsArb = fc
  .array(fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 2, maxLength: 6 }), {
    minLength: 1,
    maxLength: 6,
  })
  .map((pools) =>
    pools.map((points, p) =>
      [...points].sort((a, b) => b - a).map((pts, i) => row(`P${p}T${i}`, pts, points.length - 1)),
    ),
  );

describe("pool properties", () => {
  it("draws every team exactly once, in pools that differ by at most one team", () => {
    fc.assert(
      fc.property(drawArb, ({ teams, poolCount, draw, seed }) => {
        const pools = drawPools({ teams, poolCount, draw, seed });
        expect(pools).toHaveLength(poolCount);
        expect(pools.flat().sort()).toEqual(teams.map((t) => t.id).sort());
        const sizes = pools.map((pool) => pool.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        expect(drawPools({ teams, poolCount, draw, seed })).toEqual(pools);
      }),
    );
  });

  it("never puts two of the top seeds in the same pool", () => {
    fc.assert(
      fc.property(drawArb, ({ teams, poolCount, seed }) => {
        const pools = drawPools({ teams, poolCount, draw: "seeded", seed });
        const top = teams.filter((t) => (t.seed ?? Infinity) <= poolCount).map((t) => t.id);
        const poolOf = (id: string) => pools.findIndex((pool) => pool.includes(id));
        expect(new Set(top.map(poolOf)).size).toBe(top.length);
      }),
    );
  });

  it("keeps every team when moving one, and puts it in the target pool", () => {
    fc.assert(
      fc.property(drawArb, fc.nat(), fc.nat(), ({ teams, poolCount, seed }, t, p) => {
        const pools = drawPools({ teams, poolCount, draw: "random", seed });
        const team = teams[t % teams.length]?.id ?? "";
        const moved = moveTeam(pools, team, p % poolCount);
        expect(moved.flat().sort()).toEqual(pools.flat().sort());
        expect(moved[p % poolCount]).toContain(team);
      }),
    );
  });

  it("builds level pools from every team exactly once", () => {
    fc.assert(
      fc.property(standingsArb, fc.integer({ min: 2, max: 8 }), (standings, poolSize) => {
        const all = standings
          .flat()
          .map((r) => r.team)
          .sort();
        const byRank = buildLevelPools({
          standings,
          tieBreakers: FFVB_TIE_BREAKERS,
          grouping: { kind: "byRank" },
        });
        expect(byRank.flat().sort()).toEqual(all);
        // A level pool by rank never holds two teams from the same first pool.
        for (const pool of byRank) {
          const origins = pool.map((team) => team.split("T")[0]);
          expect(new Set(origins).size).toBe(pool.length);
        }
        const bands = buildLevelPools({
          standings,
          tieBreakers: FFVB_TIE_BREAKERS,
          grouping: { kind: "bands", poolSize },
        });
        expect(bands.flat()).toEqual(
          rankAcrossPools({ standings, tieBreakers: FFVB_TIE_BREAKERS }).map((p) => p.team),
        );
        const sizes = bands.map((pool) => pool.length);
        expect(Math.max(...sizes)).toBeLessThanOrEqual(poolSize);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      }),
    );
  });
});
