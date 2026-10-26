import { EngineError } from "./errors.js";
import type { Match, MatchRules, TeamId } from "./model.js";
import { validateScore } from "./score.js";

export type BracketErrorCode =
  | "TOO_FEW_TEAMS"
  | "DUPLICATE_TEAM"
  | "WRONG_TEAMS"
  | "INVALID_SCORE"
  | "NO_WINNER"
  | "UNKNOWN_MATCH"
  | "DUPLICATE_MATCH"
  | "NOT_PLAYABLE"
  | "INVALID_BRACKET";

/** Thrown when a bracket cannot be built or advanced. */
export class BracketError extends EngineError<BracketErrorCode> {}

/** Where a side of a bracket match comes from. */
export type BracketSlot =
  | { readonly kind: "team"; readonly team: TeamId }
  /** No opponent: the other side goes through without playing. */
  | { readonly kind: "bye" }
  | { readonly kind: "winner"; readonly match: string }
  | { readonly kind: "loser"; readonly match: string };

export interface BracketMatch {
  readonly id: string;
  /** "main", "consolation", or the places a full placement sub-bracket decides ("places-5-8"). */
  readonly bracket: string;
  /** 1-based round within the whole bracket. */
  readonly round: number;
  readonly home: BracketSlot;
  readonly away: BracketSlot;
  /** Final places this match gives, when it decides any. */
  readonly places?: { readonly winner?: number; readonly loser?: number };
  /**
   * Played only when that earlier match was won by that side (a grand final reset); otherwise it
   * is skipped and keeps that match's winner and loser.
   */
  readonly onlyIf?: { readonly match: string; readonly wonBy: "home" | "away" };
}

export interface BracketInput {
  /** Teams in seed order, best first: the top seeds get the byes. */
  readonly teams: readonly TeamId[];
}

/** Bracket positions of seeds 1..size, so that seeds 1 and 2 can only meet in the final. */
function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((seed) => [seed, n + 1 - seed]);
  }
  return order;
}

/** First-round slots: teams by seed, byes for the missing seeds up to the next power of 2. */
function firstSlots(teams: readonly TeamId[]): BracketSlot[] {
  if (teams.length < 2) throw new BracketError("TOO_FEW_TEAMS", "a bracket needs at least 2 teams");
  if (new Set(teams).size !== teams.length) {
    throw new BracketError("DUPLICATE_TEAM", "each team must appear once");
  }
  let size = 2;
  while (size < teams.length) size *= 2;
  return seedOrder(size).map((seed) => {
    const team = teams[seed - 1];
    return team === undefined ? { kind: "bye" } : { kind: "team", team };
  });
}

/**
 * Plays `slots` (a power of 2) down to a winner. Without `splitLosers`, the losers of each round
 * share the place after the teams still in; with it, they play on for the places below.
 */
function build(
  out: BracketMatch[],
  slots: readonly BracketSlot[],
  options: { bracket: string; round: number; firstPlace?: number; splitLosers: boolean },
): void {
  const { bracket, round, firstPlace, splitLosers } = options;
  const winners: BracketSlot[] = [];
  const losers: BracketSlot[] = [];
  const final = slots.length === 2;
  for (let i = 0; i < slots.length; i += 2) {
    const id = `${bracket}:${round}:${i / 2 + 1}`;
    const home = slots[i] ?? { kind: "bye" };
    const away = slots[i + 1] ?? { kind: "bye" };
    const places =
      firstPlace === undefined
        ? undefined
        : final
          ? { winner: firstPlace, loser: firstPlace + 1 }
          : splitLosers
            ? undefined
            : { loser: firstPlace + slots.length / 2 };
    out.push({ id, bracket, round, home, away, ...(places ? { places } : {}) });
    winners.push({ kind: "winner", match: id });
    losers.push({ kind: "loser", match: id });
  }
  if (final) return;
  const winnersBracket =
    splitLosers && firstPlace !== undefined
      ? `places-${firstPlace}-${firstPlace + winners.length - 1}`
      : bracket;
  build(out, winners, { ...options, bracket: winnersBracket, round: round + 1 });
  if (splitLosers && firstPlace !== undefined) {
    const lowest = firstPlace + slots.length / 2;
    build(out, losers, {
      ...options,
      bracket: `places-${lowest}-${lowest + losers.length - 1}`,
      round: round + 1,
      firstPlace: lowest,
    });
  }
}

/**
 * Single elimination: the loser is out. Losers of the same round share a place (no match for
 * 3rd place). With a consolation bracket, the first-round losers play their own bracket.
 */
export function singleElimination(input: BracketInput & { readonly consolation: boolean }) {
  const slots = firstSlots(input.teams);
  const out: BracketMatch[] = [];
  build(out, slots, { bracket: "main", round: 1, firstPlace: 1, splitLosers: false });
  if (input.consolation && slots.length >= 4) {
    const losers = out
      .filter((m) => m.bracket === "main" && m.round === 1)
      .map((m): BracketSlot => ({ kind: "loser", match: m.id }));
    build(out, losers, { bracket: "consolation", round: 2, splitLosers: false });
  }
  return out;
}

/**
 * Full placement bracket (classement intégral): winners go one way, losers the other, until
 * every team has a unique place. With 2^k teams, every team plays k matches.
 */
export function fullPlacement(input: BracketInput): BracketMatch[] {
  const out: BracketMatch[] = [];
  const slots = firstSlots(input.teams);
  build(out, slots, {
    bracket: `places-1-${slots.length}`,
    round: 1,
    firstPlace: 1,
    splitLosers: true,
  });
  return out;
}

/**
 * Double elimination: a team is out after its second loss. Winners bracket losers drop into the
 * losers bracket in reverse order, so that the second-round losers never meet a team they already
 * played (except with 4 slots, where that round is the losers final; later rematches cannot always
 * be avoided). The winners bracket champion meets the losers bracket champion in the grand final;
 * with a reset, a second final is played if the losers bracket champion wins the first.
 */
export function doubleElimination(
  input: BracketInput & { readonly grandFinalReset: boolean },
): BracketMatch[] {
  const slots = firstSlots(input.teams);
  const size = slots.length;
  const out: BracketMatch[] = [];
  const slot = (kind: "winner" | "loser", match: BracketMatch): BracketSlot => ({
    kind,
    match: match.id,
  });

  const winnersRounds: BracketMatch[][] = [];
  let current = slots;
  for (let round = 1; current.length > 1; round += 1) {
    const matches: BracketMatch[] = [];
    for (let i = 0; i < current.length; i += 2) {
      matches.push({
        id: `winners:${round}:${i / 2 + 1}`,
        bracket: "winners",
        round,
        home: current[i] ?? { kind: "bye" },
        away: current[i + 1] ?? { kind: "bye" },
      });
    }
    out.push(...matches);
    winnersRounds.push(matches);
    current = matches.map((m) => slot("winner", m));
  }
  const winnersFinal = winnersRounds.at(-1)?.[0];
  if (winnersFinal === undefined) throw new Error("unreachable: empty bracket");

  // Losers bracket: odd rounds pair the survivors, even rounds take the next winners bracket losers.
  let survivors = (winnersRounds[0] ?? []).map((m) => slot("loser", m));
  let eliminated = 0;
  let losersRoundNo = 1;
  const addLosersRound = (pairs: [BracketSlot, BracketSlot][]) => {
    eliminated += pairs.length;
    const matches = pairs.map(([home, away], i) => ({
      id: `losers:${losersRoundNo}:${i + 1}`,
      bracket: "losers",
      // The id counts losers bracket rounds; `round` counts the whole bracket, one round later.
      round: losersRoundNo + 1,
      home,
      away,
      places: { loser: size - eliminated + 1 },
    }));
    out.push(...matches);
    losersRoundNo += 1;
    survivors = matches.map((m) => slot("winner", m));
  };
  for (const dropping of winnersRounds.slice(1)) {
    if (survivors.length > 1) {
      const pairs: [BracketSlot, BracketSlot][] = [];
      for (let i = 0; i < survivors.length; i += 2) {
        pairs.push([survivors[i] ?? { kind: "bye" }, survivors[i + 1] ?? { kind: "bye" }]);
      }
      addLosersRound(pairs);
    }
    const reversed = [...dropping].reverse();
    addLosersRound(
      survivors.map((s, i): [BracketSlot, BracketSlot] => {
        const drop = reversed[i];
        return [s, drop === undefined ? { kind: "bye" } : slot("loser", drop)];
      }),
    );
  }
  const losersChampion = survivors[0] ?? slot("loser", winnersFinal);

  const finalRound = Math.max(winnersRounds.length, losersRoundNo) + 1;
  const final: BracketMatch = {
    id: "final:1:1",
    bracket: "final",
    round: finalRound,
    home: slot("winner", winnersFinal),
    away: losersChampion,
    ...(input.grandFinalReset ? {} : { places: { winner: 1, loser: 2 } }),
  };
  out.push(final);
  if (input.grandFinalReset) {
    out.push({
      id: "final:2:1",
      bracket: "final",
      round: finalRound + 1,
      home: final.home,
      away: final.away,
      places: { winner: 1, loser: 2 },
      onlyIf: { match: final.id, wonBy: "away" },
    });
  }
  return out;
}

/**
 * A bracket match once earlier results are known. A team is `undefined` while it depends on an
 * unplayed match, and `null` when there is none (a bye, or the loser of a bye).
 */
export interface ResolvedBracketMatch {
  readonly match: BracketMatch;
  readonly home: TeamId | null | undefined;
  readonly away: TeamId | null | undefined;
  readonly winner: TeamId | null | undefined;
  readonly loser: TeamId | null | undefined;
  /** Both teams are known: the match has to be played. */
  readonly playable: boolean;
}

/**
 * Advances a bracket from the played matches (matched by id). A side facing a bye goes through
 * without playing; elimination matches need a winner, so a draw is refused.
 */
export function resolveBracket(
  bracket: readonly BracketMatch[],
  played: readonly Match[],
  rules: MatchRules,
): ResolvedBracketMatch[] {
  const ids = new Set(bracket.map((m) => m.id));
  const scores = new Map<string, Match>();
  for (const m of played) {
    if (!ids.has(m.id))
      throw new BracketError("UNKNOWN_MATCH", `match ${m.id} is not in the bracket`);
    if (scores.has(m.id))
      throw new BracketError("DUPLICATE_MATCH", `match ${m.id} is entered twice`);
    scores.set(m.id, m);
  }
  const resolved = new Map<string, ResolvedBracketMatch>();
  const out: ResolvedBracketMatch[] = [];
  const record = (entry: ResolvedBracketMatch) => {
    resolved.set(entry.match.id, entry);
    out.push(entry);
  };
  // Matches come in play order: a side can only come from a match listed before it.
  const earlier = (id: string) => {
    const match = resolved.get(id);
    if (match === undefined) {
      throw new BracketError(
        "INVALID_BRACKET",
        `match ${id} must come before the matches it feeds`,
      );
    }
    return match;
  };
  const teamOf = (slot: BracketSlot): TeamId | null | undefined => {
    switch (slot.kind) {
      case "team":
        return slot.team;
      case "bye":
        return null;
      case "winner":
        return earlier(slot.match).winner;
      case "loser":
        return earlier(slot.match).loser;
    }
  };
  for (const match of bracket) {
    const home = teamOf(match.home);
    const away = teamOf(match.away);
    const base = { match, home, away };
    const condition = match.onlyIf && earlier(match.onlyIf.match);
    const wonBy = condition && (condition.winner === condition.home ? "home" : "away");
    const skipped =
      condition !== undefined &&
      (typeof condition.winner !== "string" || wonBy !== match.onlyIf?.wonBy);
    const playable = !skipped && typeof home === "string" && typeof away === "string";
    if (!playable && scores.get(match.id)?.score !== undefined) {
      throw new BracketError("NOT_PLAYABLE", `match ${match.id} cannot be played yet`);
    }
    if (condition !== undefined && skipped) {
      // Not played: waiting on the deciding match, or keeping its result.
      record({ ...base, winner: condition.winner, loser: condition.loser, playable: false });
    } else if (home === undefined || away === undefined) {
      // Waiting on an earlier match; a side known to be empty still cannot decide alone.
      record({ ...base, winner: undefined, loser: undefined, playable: false });
    } else if (home === null || away === null) {
      record({ ...base, winner: home ?? away, loser: null, playable: false });
    } else {
      const result = scores.get(match.id);
      let winner: TeamId | undefined;
      if (result?.score !== undefined) {
        if (result.home !== home || result.away !== away) {
          throw new BracketError("WRONG_TEAMS", `match ${match.id} is ${home} against ${away}`);
        }
        const validation = validateScore(rules, result.score);
        if (!validation.valid) {
          throw new BracketError("INVALID_SCORE", `match ${match.id} has an invalid score`);
        }
        if (validation.outcome === "draw") {
          throw new BracketError("NO_WINNER", `match ${match.id} needs a winner`);
        }
        winner = validation.outcome === "home" ? home : away;
      }
      const loser = winner === undefined ? undefined : winner === home ? away : home;
      record({ ...base, winner, loser, playable: true });
    }
  }
  return out;
}

/** Final places known so far, best first. Teams sharing a place are listed by bracket order. */
export function bracketPlaces(
  resolved: readonly ResolvedBracketMatch[],
): { readonly team: TeamId; readonly place: number }[] {
  const places: { team: TeamId; place: number }[] = [];
  for (const { match, winner, loser } of resolved) {
    if (match.places?.winner !== undefined && typeof winner === "string") {
      places.push({ team: winner, place: match.places.winner });
    }
    if (match.places?.loser !== undefined && typeof loser === "string") {
      places.push({ team: loser, place: match.places.loser });
    }
  }
  return places.sort((a, b) => a.place - b.place);
}
