export interface Pairing<T> {
  home: T;
  away: T;
}

/**
 * Generates the rounds of a pool where every team plays every other team once
 * (circle method). With an odd number of teams, one team has a bye each round.
 */
export function roundRobin<T>(teams: readonly T[]): Pairing<T>[][] {
  if (new Set(teams).size !== teams.length) {
    throw new Error("Each team must appear only once");
  }
  if (teams.length < 2) return [];

  const BYE = Symbol("bye");
  const slots: (T | typeof BYE)[] = teams.length % 2 === 0 ? [...teams] : [...teams, BYE];
  const n = slots.length;
  const rounds: Pairing<T>[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const round: Pairing<T>[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = slots[i] ?? BYE;
      const b = slots[n - 1 - i] ?? BYE;
      if (a === BYE || b === BYE) continue;
      // Alternate sides so the fixed team is not always at home.
      round.push(r % 2 === 0 || i > 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(round);
    // Rotation: the first team stays fixed, the others shift by one.
    slots.splice(1, 0, ...slots.splice(-1));
  }
  return rounds;
}
