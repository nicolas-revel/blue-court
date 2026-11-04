import type {
  LevelPoolGrouping,
  MatchRules,
  Phase,
  PhaseFormat,
  PoolDraw,
  Qualification,
  RankingPoints,
  SetRules,
  Team,
  TieBreaker,
  TimeLimit,
  Tournament,
} from "./model.js";

/**
 * Shape checks for settings that come from outside the engine (JSON sent to the API), so that a
 * missing or mistyped setting is reported with its path instead of making the engine throw. They
 * only check types; whether a well-typed value can work is `config.ts`'s job.
 */

export type Path = readonly (string | number)[];
export type ShapeReport = (message: string, path: Path) => void;
/** Reports every place where `value` departs from the shape; true when it fits. */
export type Shape = (value: unknown, path: Path, report: ShapeReport) => boolean;

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Own properties only, so that a key such as `constructor` never reads the prototype. */
const field = (record: Readonly<Record<string, unknown>>, key: string): unknown =>
  Object.hasOwn(record, key) ? record[key] : undefined;

const primitive =
  (type: "string" | "number" | "boolean"): Shape =>
  (value, path, report) => {
    if (typeof value === type) return true;
    report(`expected a ${type}`, path);
    return false;
  };

const string = primitive("string");
/** Any number, NaN included: whether it is a usable count is a configuration error, not a shape. */
const number = primitive("number");
const boolean = primitive("boolean");

const oneOf =
  (...values: readonly string[]): Shape =>
  (value, path, report) => {
    if (typeof value === "string" && values.includes(value)) return true;
    report(`expected one of ${values.join(", ")}`, path);
    return false;
  };

/** Every value of the union `T` must be listed, so a value added to the model is accepted here. */
const literal = <T extends string>(values: Readonly<Record<T, true>>): Shape =>
  oneOf(...Object.keys(values));

const optional =
  (shape: Shape): Shape =>
  (value, path, report) =>
    value === undefined || shape(value, path, report);

const list =
  (item: Shape): Shape =>
  (value, path, report) => {
    if (!Array.isArray(value)) {
      report("expected a list", path);
      return false;
    }
    let fits = true;
    for (const [i, element] of value.entries()) fits = item(element, [...path, i], report) && fits;
    return fits;
  };

/** Every key of `T` needs a shape, so a setting added to the model cannot be forgotten here. */
type Fields<T> = { readonly [K in keyof T]-?: Shape };

function checkFields(
  record: Readonly<Record<string, unknown>>,
  fields: Readonly<Record<string, Shape>>,
  path: Path,
  report: ShapeReport,
): boolean {
  let fits = true;
  for (const [key, shape] of Object.entries(fields)) {
    fits = shape(field(record, key), [...path, key], report) && fits;
  }
  return fits;
}

const object =
  <T>(fields: Fields<T>): Shape =>
  (value, path, report) => {
    if (!isRecord(value)) {
      report("expected an object", path);
      return false;
    }
    return checkFields(value, fields, path, report);
  };

/** A union told apart by its `kind`: each variant gives the shapes of its other fields. */
function variants<T extends { readonly kind: string }>(
  cases: {
    readonly [K in T["kind"]]: Fields<Omit<Extract<T, { readonly kind: K }>, "kind">>;
  },
): Shape {
  const byKind = new Map<string, Readonly<Record<string, Shape>>>(Object.entries(cases));
  const kind = oneOf(...byKind.keys());
  return (value, path, report) => {
    if (!isRecord(value)) {
      report("expected an object", path);
      return false;
    }
    const k = field(value, "kind");
    const fields = typeof k === "string" ? byKind.get(k) : undefined;
    if (fields === undefined) {
      kind(k, [...path, "kind"], report);
      return false;
    }
    return checkFields(value, fields, path, report);
  };
}

export const TEAM = object<Team>({ id: string, name: string, seed: optional(number) });

const SET_RULES = object<SetRules>({
  pointsToWin: number,
  winByTwo: boolean,
  cap: optional(number),
});
const TIME_LIMIT = optional(object<TimeLimit>({ minutes: number }));

export const MATCH_RULES = variants<MatchRules>({
  sets: {
    setsToWin: number,
    set: SET_RULES,
    tieBreakSet: optional(SET_RULES),
    timeLimit: TIME_LIMIT,
  },
  fixedSets: { sets: number, set: SET_RULES, drawAllowed: boolean, timeLimit: TIME_LIMIT },
  timed: { durationMinutes: number, drawAllowed: boolean },
});

const PHASE_FORMAT = variants<PhaseFormat>({
  pools: { poolCount: number, draw: literal<PoolDraw>({ seeded: true, random: true }) },
  levelPools: {
    grouping: variants<LevelPoolGrouping>({ byRank: {}, bands: { poolSize: number } }),
  },
  singleElimination: { consolation: boolean },
  doubleElimination: { grandFinalReset: boolean },
  fullPlacement: {},
});

const RANKING_POINTS = object<RankingPoints>({
  win: number,
  tieBreakWin: number,
  tieBreakLoss: number,
  loss: number,
  draw: number,
  forfeitWin: number,
  forfeitLoss: number,
});

const QUALIFICATION = variants<Qualification>({
  all: {},
  topPerPool: {
    count: number,
    bestAtRank: optional(object<{ rank: number; count: number }>({ rank: number, count: number })),
  },
  topOverall: { count: number },
});

export const PHASE = object<Phase>({
  id: string,
  name: string,
  format: PHASE_FORMAT,
  matchRules: MATCH_RULES,
  rankingPoints: RANKING_POINTS,
  tieBreakers: list(
    literal<TieBreaker>({
      wins: true,
      rankingPoints: true,
      setRatio: true,
      pointRatio: true,
      headToHead: true,
      random: true,
    }),
  ),
  qualification: QUALIFICATION,
  refereeing: literal<Phase["refereeing"]>({ restingTeam: true, none: true }),
});

/** Teams and phases are lists here; each one is checked on its own by `config.ts`. */
const anyList = list(() => true);
export const TOURNAMENT = object<Tournament>({
  id: string,
  name: string,
  seed: number,
  teams: anyList,
  phases: anyList,
});
