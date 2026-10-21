import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { roundRobin } from "./round-robin.js";

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

describe("roundRobin", () => {
  it("returns no rounds for fewer than 2 teams", () => {
    expect(roundRobin([])).toEqual([]);
    expect(roundRobin(["A"])).toEqual([]);
  });

  it("generates 5 rounds of 3 matches for 6 teams", () => {
    const rounds = roundRobin(["A", "B", "C", "D", "E", "F"]);
    expect(rounds).toHaveLength(5);
    expect(rounds.every((r) => r.length === 3)).toBe(true);
  });

  it("rejects a duplicated team", () => {
    expect(() => roundRobin(["A", "A"])).toThrow();
  });

  it("makes every pair meet exactly once, with no team playing twice in a round", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 24 }), (n) => {
        const teams = Array.from({ length: n }, (_, i) => i);
        const rounds = roundRobin(teams);
        const seen = new Set<string>();

        for (const round of rounds) {
          const playing = round.flatMap((m) => [m.home, m.away]);
          expect(new Set(playing).size).toBe(playing.length);
          for (const m of round) {
            expect(m.home).not.toBe(m.away);
            const key = pairKey(m.home, m.away);
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
        }
        expect(seen.size).toBe((n * (n - 1)) / 2);
        expect(rounds).toHaveLength(n % 2 === 0 ? n - 1 : n);
      }),
    );
  });
});
