import type { TeamId } from "./model.js";

/** Seeded pseudo-random generator (mulberry32) returning numbers in [0, 1). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy of `items` (Fisher-Yates), the same for the same seed. */
export function shuffle<T>(items: readonly T[], seed: number): T[] {
  const random = createRandom(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

/** Deterministic 32-bit draw value of a team for a seed (FNV-1a mixed with the seed). */
export function drawKey(seed: number, team: TeamId): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < team.length; i++) {
    hash ^= team.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  hash ^= hash >>> 15;
  return Math.imul(hash, 2246822507) >>> 0;
}

/** Orders team ids the same way everywhere, independently of the locale. */
export const byTeamId = (a: TeamId, b: TeamId) => (a < b ? -1 : a > b ? 1 : 0);
