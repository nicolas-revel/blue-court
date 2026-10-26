import { EngineError } from "./errors.js";
import type { LevelPoolGrouping, PoolDraw, Team, TeamId, TieBreaker } from "./model.js";
import { byTeamId, shuffle } from "./random.js";
import { rowValue, type StandingRow } from "./standings.js";

export type PoolsErrorCode =
  | "INVALID_POOL_COUNT"
  | "INVALID_POOL_SIZE"
  | "DUPLICATE_TEAM"
  | "UNKNOWN_TEAM"
  | "UNKNOWN_POOL"
  | "SEED_REQUIRED";

/** Thrown when pools cannot be drawn, rebuilt or corrected. */
export class PoolsError extends EngineError<PoolsErrorCode> {}

/** Pools as lists of team ids, in pool order. */
export type Pools = readonly (readonly TeamId[])[];

export interface PoolDrawInput {
  readonly teams: readonly Team[];
  readonly poolCount: number;
  readonly draw: PoolDraw;
  /** Draws the unseeded teams (or every team in a random draw), so the draw is reproducible. */
  readonly seed: number;
}

function assertUnique(teams: readonly TeamId[]) {
  if (new Set(teams).size !== teams.length) {
    throw new PoolsError("DUPLICATE_TEAM", "each team must appear once");
  }
}

/** Deals teams in a snake (1, 2, 3, 3, 2, 1...), so pool sizes differ by at most one. */
function snake(order: readonly TeamId[], poolCount: number): TeamId[][] {
  const pools: TeamId[][] = Array.from({ length: poolCount }, () => []);
  order.forEach((team, i) => {
    const round = Math.floor(i / poolCount);
    const slot = i % poolCount;
    pools[round % 2 === 0 ? slot : poolCount - 1 - slot]?.push(team);
  });
  return pools;
}

/**
 * Splits the teams into the first pools. A seeded draw spreads seeded teams in a snake by
 * seed (1 is the strongest), then deals the unseeded teams drawn at random; a random draw
 * ignores seeds.
 */
export function drawPools(input: PoolDrawInput): TeamId[][] {
  const { teams, poolCount, draw, seed } = input;
  assertUnique(teams.map((t) => t.id));
  if (!Number.isInteger(poolCount) || poolCount < 1 || poolCount > teams.length) {
    throw new PoolsError(
      "INVALID_POOL_COUNT",
      "the number of pools must be from 1 to the number of teams",
    );
  }
  const ids = (list: readonly Team[]) => list.map((t) => t.id);
  if (draw === "random") return snake(shuffle(ids(teams), seed), poolCount);
  const seeded = teams
    .filter((t) => t.seed !== undefined)
    .sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0) || byTeamId(a.id, b.id));
  const unseeded = teams.filter((t) => t.seed === undefined);
  return snake([...ids(seeded), ...shuffle(ids(unseeded), seed)], poolCount);
}

/** Moves a team to another pool (0-based), as a manual correction by the organizer. */
export function moveTeam(pools: Pools, team: TeamId, toPool: number): TeamId[][] {
  if (!pools.some((pool) => pool.includes(team))) {
    throw new PoolsError("UNKNOWN_TEAM", `team ${team} is in no pool`);
  }
  if (!Number.isInteger(toPool) || toPool < 0 || toPool >= pools.length) {
    throw new PoolsError("UNKNOWN_POOL", `there is no pool ${toPool}`);
  }
  return pools.map((pool, i) => {
    const others = pool.filter((t) => t !== team);
    return i === toPool ? [...others, team] : others;
  });
}

/** A team's place in its pool, and in the ranking across pools. */
export interface PoolPlacement {
  readonly team: TeamId;
  /** 0-based index of the team's pool. */
  readonly pool: number;
  /** 1-based position in its pool's standings. */
  readonly position: number;
}

export interface CrossPoolInput {
  /** Each pool's standings, as returned by `computeStandings`. */
  readonly standings: readonly (readonly StandingRow[])[];
  readonly tieBreakers: readonly TieBreaker[];
  /** Required when the tie-breakers include a random draw. */
  readonly seed?: number;
}

/**
 * Ranks every team across pools: by position in its pool first, then teams at the same
 * position are compared with the tie-breakers. Head-to-head is skipped (they did not meet),
 * and wins and ranking points are averaged per match so pools of different sizes compare fairly.
 */
export function rankAcrossPools(input: CrossPoolInput): PoolPlacement[] {
  const { standings, tieBreakers, seed } = input;
  if (tieBreakers.includes("random") && seed === undefined) {
    throw new PoolsError("SEED_REQUIRED", "a random draw tie-breaker needs a seed");
  }
  const rows = standings.flatMap((pool, index) =>
    pool.map((row, i) => ({ row, placement: { team: row.team, pool: index, position: i + 1 } })),
  );
  assertUnique(rows.map((r) => r.row.team));
  const perMatch = (value: number, played: number) => (played === 0 ? 0 : value / played);
  // Head-to-head is skipped; wins and ranking points are compared per match.
  const key = (criterion: TieBreaker, row: StandingRow): number =>
    criterion === "headToHead"
      ? 0
      : rowValue(
          criterion,
          {
            ...row,
            wins: perMatch(row.wins, row.played),
            rankingPoints: perMatch(row.rankingPoints, row.played),
          },
          seed,
        );
  const compare = (a: StandingRow, b: StandingRow) => {
    for (const criterion of tieBreakers) {
      const ka = key(criterion, a);
      const kb = key(criterion, b);
      if (ka !== kb) return kb > ka ? 1 : -1;
    }
    return byTeamId(a.team, b.team);
  };
  return rows
    .sort((a, b) => a.placement.position - b.placement.position || compare(a.row, b.row))
    .map((r) => r.placement);
}

export interface LevelPoolsInput extends CrossPoolInput {
  readonly grouping: LevelPoolGrouping;
}

/** Rebuilds pools from the previous pools' standings, best level first. */
export function buildLevelPools(input: LevelPoolsInput): TeamId[][] {
  const { grouping } = input;
  if (
    grouping.kind === "bands" &&
    (!Number.isInteger(grouping.poolSize) || grouping.poolSize < 2)
  ) {
    throw new PoolsError("INVALID_POOL_SIZE", "a level pool needs at least 2 teams");
  }
  const ranking = rankAcrossPools(input);
  if (grouping.kind === "byRank") {
    const pools: TeamId[][] = [];
    for (const { team, position } of ranking) {
      const pool = pools[position - 1] ?? [];
      pool.push(team);
      pools[position - 1] = pool;
    }
    // With uneven pools the last positions can hold a single team, who would play no match:
    // those teams join the level pool above. Positions only get smaller, so they are at the end.
    const firstLone = pools.findIndex((pool) => pool.length < 2);
    if (firstLone === -1) return pools;
    const lone = pools.slice(firstLone).flat();
    const kept = pools.slice(0, firstLone);
    const above = kept.at(-1);
    if (above === undefined) return [lone];
    above.push(...lone);
    return kept;
  }
  if (ranking.length === 0) return [];
  // Bands are as even as possible and never larger than the pool size; larger bands come first.
  const count = Math.ceil(ranking.length / grouping.poolSize);
  const base = Math.floor(ranking.length / count);
  const larger = ranking.length % count;
  const pools: TeamId[][] = [];
  let start = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (i < larger ? 1 : 0);
    pools.push(ranking.slice(start, start + size).map((p) => p.team));
    start += size;
  }
  return pools;
}
