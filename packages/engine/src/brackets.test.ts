import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type BracketMatch,
  bracketPlaces,
  doubleElimination,
  fullPlacement,
  resolveBracket,
  singleElimination,
} from "./brackets.js";
import { FFVB_MATCH_RULES } from "./ffvb.js";
import type { Match, MatchRules, MatchScore } from "./model.js";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `T${i + 1}`);
const win: MatchScore = {
  kind: "sets",
  sets: [
    { home: 25, away: 10 },
    { home: 25, away: 10 },
    { home: 25, away: 10 },
  ],
};
const loss: MatchScore = {
  kind: "sets",
  sets: [
    { home: 10, away: 25 },
    { home: 10, away: 25 },
    { home: 10, away: 25 },
  ],
};

/** Plays every match as it becomes playable; `homeWins` picks each winner. */
function play(
  bracket: readonly BracketMatch[],
  homeWins: (home: string, away: string, index: number) => boolean,
) {
  const played: Match[] = [];
  for (;;) {
    const resolved = resolveBracket(bracket, played, FFVB_MATCH_RULES);
    const next = resolved.find(
      (r) => r.playable && r.winner === undefined && typeof r.home === "string",
    );
    if (next === undefined || typeof next.home !== "string" || typeof next.away !== "string") {
      return { resolved, played };
    }
    played.push({
      id: next.match.id,
      phaseId: "finals",
      home: next.home,
      away: next.away,
      score: homeWins(next.home, next.away, played.length) ? win : loss,
    });
  }
}

/** The better seed (lower number) always wins. */
const favorites = (home: string, away: string) => Number(home.slice(1)) < Number(away.slice(1));

describe("singleElimination", () => {
  it("seeds an 8-team bracket so the top 2 can only meet in the final", () => {
    const bracket = singleElimination({ teams: teams(8), consolation: false });
    const firstRound = bracket.filter((m) => m.round === 1);
    expect(firstRound.map((m) => [m.home, m.away])).toEqual([
      [
        { kind: "team", team: "T1" },
        { kind: "team", team: "T8" },
      ],
      [
        { kind: "team", team: "T4" },
        { kind: "team", team: "T5" },
      ],
      [
        { kind: "team", team: "T2" },
        { kind: "team", team: "T7" },
      ],
      [
        { kind: "team", team: "T3" },
        { kind: "team", team: "T6" },
      ],
    ]);
    const { resolved } = play(bracket, favorites);
    expect(bracketPlaces(resolved)).toEqual([
      { team: "T1", place: 1 },
      { team: "T2", place: 2 },
      { team: "T4", place: 3 },
      { team: "T3", place: 3 },
      { team: "T8", place: 5 },
      { team: "T5", place: 5 },
      { team: "T7", place: 5 },
      { team: "T6", place: 5 },
    ]);
  });

  it("gives the byes to the top seeds when the count is not a power of 2", () => {
    const bracket = singleElimination({ teams: teams(6), consolation: false });
    const firstRound = resolveBracket(bracket, [], FFVB_MATCH_RULES).filter(
      (r) => r.match.round === 1,
    );
    expect(firstRound.filter((r) => !r.playable).map((r) => r.winner)).toEqual(["T1", "T2"]);
    expect(firstRound.filter((r) => r.playable)).toHaveLength(2);
  });

  it("sends the first-round losers to a consolation bracket", () => {
    const bracket = singleElimination({ teams: teams(8), consolation: true });
    const { resolved } = play(bracket, favorites);
    const consolationTeams = resolved
      .filter((r) => r.match.bracket === "consolation" && r.match.round === 2)
      .flatMap((r) => [r.home, r.away]);
    expect(consolationTeams.sort()).toEqual(["T5", "T6", "T7", "T8"]);
    const final = resolved.filter((r) => r.match.bracket === "consolation").at(-1);
    expect(final?.winner).toBe("T5");
  });

  it("refuses fewer than 2 teams and duplicates", () => {
    expect(() => singleElimination({ teams: ["A"], consolation: false })).toThrow("TOO_FEW_TEAMS");
    expect(() => singleElimination({ teams: ["A", "A"], consolation: false })).toThrow(
      "DUPLICATE_TEAM",
    );
  });
});

describe("fullPlacement", () => {
  it("gives 8 teams a unique place after 3 matches each", () => {
    const bracket = fullPlacement({ teams: teams(8) });
    const { resolved, played } = play(bracket, favorites);
    expect(bracketPlaces(resolved)).toEqual(teams(8).map((team, i) => ({ team, place: i + 1 })));
    for (const team of teams(8)) {
      expect(played.filter((m) => m.home === team || m.away === team)).toHaveLength(3);
    }
  });

  it("places 6 teams from 1 to 6, the byes ending up last", () => {
    const { resolved } = play(fullPlacement({ teams: teams(6) }), favorites);
    expect(bracketPlaces(resolved).map((p) => p.place)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

const bracketOf8 = () => singleElimination({ teams: teams(8), consolation: false });

describe("doubleElimination", () => {
  it("sends winners bracket losers to the losers bracket and places 8 teams", () => {
    const bracket = doubleElimination({ teams: teams(8), grandFinalReset: false });
    expect(bracket.filter((m) => m.bracket === "winners")).toHaveLength(7);
    expect(bracket.filter((m) => m.bracket === "losers")).toHaveLength(6);
    // Winners bracket round 2 losers meet the losers bracket survivors in reverse order.
    const drop = bracket.filter((m) => m.bracket === "losers" && m.id.startsWith("losers:2:"));
    expect(drop.map((m) => m.away)).toEqual([
      { kind: "loser", match: "winners:2:2" },
      { kind: "loser", match: "winners:2:1" },
    ]);
    const { resolved } = play(bracket, favorites);
    expect(bracketPlaces(resolved)).toEqual([
      { team: "T1", place: 1 },
      { team: "T2", place: 2 },
      { team: "T3", place: 3 },
      { team: "T4", place: 4 },
      { team: "T5", place: 5 },
      { team: "T6", place: 5 },
      { team: "T8", place: 7 },
      { team: "T7", place: 7 },
    ]);
  });

  it("plays the reset only when the losers bracket champion wins the grand final", () => {
    const bracket = doubleElimination({ teams: teams(4), grandFinalReset: true });
    const reset = (resolved: ReturnType<typeof resolveBracket>) =>
      resolved.find((r) => r.match.id === "final:2:1");

    const kept = play(bracket, favorites);
    expect(reset(kept.resolved)?.playable).toBe(false);
    expect(kept.played.map((m) => m.id)).not.toContain("final:2:1");
    expect(bracketPlaces(kept.resolved).slice(0, 2)).toEqual([
      { team: "T1", place: 1 },
      { team: "T2", place: 2 },
    ]);

    // T2 loses the winners bracket final to T1, then wins every match after it.
    let meetings = 0;
    const comeback = play(bracket, (home, away) => {
      if (home !== "T2" && away !== "T2") return favorites(home, away);
      const t2Wins = !(home === "T1" || away === "T1") || meetings++ > 0;
      return t2Wins === (home === "T2");
    });
    expect(comeback.played.map((m) => m.id)).toContain("final:2:1");
    expect(bracketPlaces(comeback.resolved).slice(0, 2)).toEqual([
      { team: "T2", place: 1 },
      { team: "T1", place: 2 },
    ]);
  });

  it("refuses a score for a reset that is not played", () => {
    const bracket = doubleElimination({ teams: teams(2), grandFinalReset: true });
    const { played } = play(bracket, favorites);
    const extra: Match = { id: "final:2:1", phaseId: "finals", home: "T1", away: "T2", score: win };
    expect(() => resolveBracket(bracket, [...played, extra], FFVB_MATCH_RULES)).toThrow(
      expect.objectContaining({ code: "NOT_PLAYABLE" }),
    );
  });
});

describe("resolveBracket", () => {
  const bracket = singleElimination({ teams: teams(2), consolation: false });

  it("waits for a score before naming a winner", () => {
    const [final] = resolveBracket(bracket, [], FFVB_MATCH_RULES);
    expect(final).toMatchObject({ home: "T1", away: "T2", winner: undefined, playable: true });
  });

  it("refuses a draw, an invalid score and the wrong teams", () => {
    const id = bracket[0]?.id ?? "";
    const drawable: MatchRules = {
      kind: "fixedSets",
      sets: 2,
      set: { pointsToWin: 25, winByTwo: true },
      drawAllowed: true,
    };
    const level: MatchScore = {
      kind: "sets",
      sets: [
        { home: 25, away: 10 },
        { home: 10, away: 25 },
      ],
    };
    const match = (score: MatchScore, home = "T1"): Match => ({
      id,
      phaseId: "finals",
      home,
      away: "T2",
      score,
    });
    expect(() => resolveBracket(bracket, [match(level)], drawable)).toThrow("NO_WINNER");
    expect(() => resolveBracket(bracket, [match(level)], FFVB_MATCH_RULES)).toThrow(
      "INVALID_SCORE",
    );
    expect(() => resolveBracket(bracket, [match(win, "T3")], FFVB_MATCH_RULES)).toThrow(
      "WRONG_TEAMS",
    );
  });

  it("refuses scores for unknown, duplicate or not yet playable matches", () => {
    const eight = singleElimination({ teams: teams(8), consolation: false });
    const entry = (id: string, home: string, away: string): Match => ({
      id,
      phaseId: "finals",
      home,
      away,
      score: win,
    });
    expect(() => resolveBracket(eight, [entry("nope", "T1", "T8")], FFVB_MATCH_RULES)).toThrow(
      "UNKNOWN_MATCH",
    );
    const first = entry("main:1:1", "T1", "T8");
    expect(() => resolveBracket(eight, [first, first], FFVB_MATCH_RULES)).toThrow(
      "DUPLICATE_MATCH",
    );
    expect(() => resolveBracket(eight, [entry("main:3:1", "T1", "T2")], FFVB_MATCH_RULES)).toThrow(
      "NOT_PLAYABLE",
    );
    const bye = singleElimination({ teams: teams(3), consolation: false });
    expect(() => resolveBracket(bye, [entry("main:1:1", "T1", "T2")], FFVB_MATCH_RULES)).toThrow(
      "NOT_PLAYABLE",
    );
  });

  it("refuses a bracket whose matches are out of order", () => {
    expect(() => resolveBracket([...bracketOf8()].reverse(), [], FFVB_MATCH_RULES)).toThrow(
      "INVALID_BRACKET",
    );
  });
});

const bracketArb = fc.record({
  n: fc.integer({ min: 2, max: 24 }),
  picks: fc.array(fc.boolean(), { minLength: 64, maxLength: 64 }),
});
const nextPowerOf2 = (n: number) => 2 ** Math.ceil(Math.log2(n));

describe("bracket properties", () => {
  it("gives every team of a full placement bracket a unique place from 1 to N", () => {
    fc.assert(
      fc.property(bracketArb, ({ n, picks }) => {
        const { resolved, played } = play(
          fullPlacement({ teams: teams(n) }),
          (_h, _a, i) => picks[i % picks.length] ?? true,
        );
        const places = bracketPlaces(resolved);
        expect(places.map((p) => p.place)).toEqual(teams(n).map((_, i) => i + 1));
        expect(places.map((p) => p.team).sort()).toEqual(teams(n).sort());
        const rounds = Math.log2(nextPowerOf2(n));
        for (const team of teams(n)) {
          const count = played.filter((m) => m.home === team || m.away === team).length;
          expect(count).toBeLessThanOrEqual(rounds);
          if (n === nextPowerOf2(n)) expect(count).toBe(rounds);
        }
      }),
    );
  });

  it("only lets the top 2^j seeds meet once 2^j teams are left, when favorites win", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 32 }), (n) => {
        const size = nextPowerOf2(n);
        const { resolved } = play(
          singleElimination({ teams: teams(n), consolation: false }),
          favorites,
        );
        const seedOf = (team: string | null | undefined) =>
          typeof team === "string" ? Number(team.slice(1)) : undefined;
        for (const r of resolved) {
          // In round r, `left` teams are still in: seed s meets seed left + 1 - s.
          const left = size / 2 ** (r.match.round - 1);
          const [home, away] = [seedOf(r.home), seedOf(r.away)];
          if (home !== undefined && away !== undefined) expect(home + away).toBe(left + 1);
          const alone = home ?? away;
          if (alone !== undefined && (home === undefined || away === undefined)) {
            expect(left + 1 - alone).toBeGreaterThan(n);
          }
        }
      }),
    );
  });

  it("crowns one champion, places everyone, and gives the byes to the top seeds", () => {
    fc.assert(
      fc.property(bracketArb, fc.boolean(), ({ n, picks }, consolation) => {
        const bracket = singleElimination({ teams: teams(n), consolation });
        const { resolved, played } = play(bracket, (_h, _a, i) => picks[i % picks.length] ?? true);
        const places = bracketPlaces(resolved);
        expect(places.filter((p) => p.place === 1)).toHaveLength(1);
        expect(places.map((p) => p.team).sort()).toEqual(teams(n).sort());
        const byes = nextPowerOf2(n) - n;
        const firstRoundTeams = played
          .filter((m) => m.id.startsWith("main:1:"))
          .flatMap((m) => [m.home, m.away]);
        expect(teams(n).filter((t) => !firstRoundTeams.includes(t))).toEqual(
          teams(n).slice(0, byes),
        );
        // The consolation bracket only holds teams that lost in the first round.
        const firstRoundLosers = resolved
          .filter((r) => r.match.bracket === "main" && r.match.round === 1)
          .map((r) => r.loser);
        const consolationMatches = resolved.filter((x) => x.match.bracket === "consolation");
        const consolationIds = consolationMatches.map((r) => r.match.id);
        for (const r of consolationMatches) {
          if (r.match.round === 2) {
            for (const team of [r.home, r.away]) {
              if (typeof team === "string") expect(firstRoundLosers).toContain(team);
            }
          } else {
            // Later rounds only take winners of consolation matches.
            for (const slot of [r.match.home, r.match.away]) {
              expect(slot.kind).toBe("winner");
              if (slot.kind === "winner") expect(consolationIds).toContain(slot.match);
            }
          }
        }
      }),
    );
  });

  it("knocks every team but the finalists out after exactly 2 losses", () => {
    fc.assert(
      fc.property(bracketArb, fc.boolean(), ({ n, picks }, grandFinalReset) => {
        const { resolved, played } = play(
          doubleElimination({ teams: teams(n), grandFinalReset }),
          (_h, _a, i) => picks[i % picks.length] ?? true,
        );
        const places = bracketPlaces(resolved);
        expect(places.map((p) => p.team).sort()).toEqual(teams(n).sort());
        expect(places.filter((p) => p.place === 1)).toHaveLength(1);
        // Shared places leave no gap: a place is one more than the teams ranked above it.
        for (const p of places) {
          expect(p.place).toBe(places.filter((q) => q.place < p.place).length + 1);
        }
        const losses = (team: string) =>
          resolved.filter((r) => r.playable && r.loser === team).length;
        for (const { team, place } of places) {
          if (place === 1) expect(losses(team)).toBeLessThanOrEqual(1);
          else if (place === 2 && !grandFinalReset) expect([1, 2]).toContain(losses(team));
          else expect(losses(team)).toBe(2);
        }
        // A reset is only played when the losers bracket champion won the first final.
        const final = resolved.find((r) => r.match.id === "final:1:1");
        const resetPlayed = played.some((m) => m.id === "final:2:1");
        expect(resetPlayed).toBe(grandFinalReset && final?.winner === final?.away);
      }),
    );
  });
});
