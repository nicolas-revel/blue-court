export interface Pairing<T> {
  home: T;
  away: T;
}

/**
 * Génère les tours d'une poule où chaque équipe rencontre toutes les autres une fois
 * (méthode du cercle). Avec un nombre impair d'équipes, une équipe est exempte à chaque tour.
 */
export function roundRobin<T>(teams: readonly T[]): Pairing<T>[][] {
  if (new Set(teams).size !== teams.length) {
    throw new Error("Chaque équipe ne doit apparaître qu'une fois");
  }
  if (teams.length < 2) return [];

  const BYE = Symbol("exempt");
  const slots: (T | typeof BYE)[] = teams.length % 2 === 0 ? [...teams] : [...teams, BYE];
  const n = slots.length;
  const rounds: Pairing<T>[][] = [];

  for (let r = 0; r < n - 1; r++) {
    const round: Pairing<T>[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = slots[i] ?? BYE;
      const b = slots[n - 1 - i] ?? BYE;
      if (a === BYE || b === BYE) continue;
      // On alterne le côté pour que l'équipe fixe ne reçoive pas toujours.
      round.push(r % 2 === 0 || i > 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(round);
    // Rotation : la première équipe reste fixe, les autres tournent d'un cran.
    slots.splice(1, 0, ...slots.splice(-1));
  }
  return rounds;
}
