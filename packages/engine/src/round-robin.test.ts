import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { roundRobin } from "./round-robin.js";

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

describe("roundRobin", () => {
  it("renvoie aucun tour pour moins de 2 équipes", () => {
    expect(roundRobin([])).toEqual([]);
    expect(roundRobin(["A"])).toEqual([]);
  });

  it("génère 5 tours de 3 matchs pour 6 équipes", () => {
    const rounds = roundRobin(["A", "B", "C", "D", "E", "F"]);
    expect(rounds).toHaveLength(5);
    expect(rounds.every((r) => r.length === 3)).toBe(true);
  });

  it("refuse une équipe en double", () => {
    expect(() => roundRobin(["A", "A"])).toThrow();
  });

  it("fait se rencontrer chaque paire exactement une fois, sans qu'une équipe joue deux fois par tour", () => {
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
