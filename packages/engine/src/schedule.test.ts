import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { doubleElimination, singleElimination } from "./brackets.js";
import { roundRobin } from "./round-robin.js";
import {
  adjustSchedule,
  assignReferees,
  moveMatch,
  planSchedule,
  removeCourt,
  type SchedulableMatch,
  type ScheduledMatch,
  type ScheduleSettings,
} from "./schedule.js";

const teams = (n: number, prefix = "T") => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

/** Every match of a round-robin pool, round after round. */
const pool = (names: readonly string[], group: string): SchedulableMatch[] =>
  roundRobin(names).flatMap((round, r) =>
    round.map((p, i) => ({ id: `${group}:${r + 1}:${i + 1}`, teams: [p.home, p.away], group })),
  );

const settings = (courts: number, overrides: Partial<ScheduleSettings> = {}): ScheduleSettings => ({
  courts: teams(courts, "C"),
  start: 9 * 60,
  matchMinutes: 20,
  breakMinutes: 5,
  ...overrides,
});

const teamsOf = (matches: readonly SchedulableMatch[], entry: ScheduledMatch) =>
  matches.find((m) => m.id === entry.match)?.teams ?? [];

const overlap = (a: ScheduledMatch, b: ScheduledMatch) => a.start < b.end && b.start < a.end;

/** No team and no court is in two places at once, breaks included. */
function expectConsistent(
  matches: readonly SchedulableMatch[],
  schedule: readonly ScheduledMatch[],
  breakMinutes: number,
) {
  for (const a of schedule) {
    for (const b of schedule) {
      if (a === b || a.start > b.start || (a.start === b.start && a.match > b.match)) continue;
      const gap = b.start - a.end;
      if (a.court === b.court) expect(gap).toBeGreaterThanOrEqual(breakMinutes);
      if (teamsOf(matches, a).some((t) => teamsOf(matches, b).includes(t))) {
        expect(gap).toBeGreaterThanOrEqual(breakMinutes);
      }
    }
  }
  for (const m of matches) {
    const entry = schedule.find((e) => e.match === m.id);
    for (const id of m.after ?? []) {
      const before = schedule.find((e) => e.match === id);
      expect(before && entry && entry.start - before.end).toBeGreaterThanOrEqual(breakMinutes);
    }
  }
}

describe("planSchedule", () => {
  it("plays a 5-team pool on one court without back-to-back matches", () => {
    const matches = pool(teams(5), "A");
    const schedule = planSchedule({ matches, settings: settings(1) });
    expect(schedule.map((e) => e.start)).toEqual(
      Array.from({ length: 10 }, (_, i) => 540 + 25 * i),
    );
    for (let i = 1; i < schedule.length; i += 1) {
      const [previous, current] = [schedule[i - 1], schedule[i]];
      if (previous === undefined || current === undefined) continue;
      expect(teamsOf(matches, current).some((t) => teamsOf(matches, previous).includes(t))).toBe(
        false,
      );
    }
  });

  it("fills every court and keeps a team on one court at a time", () => {
    const matches = [...pool(teams(4, "A"), "A"), ...pool(teams(4, "B"), "B")];
    const schedule = planSchedule({ matches, settings: settings(2) });
    expect(schedule).toHaveLength(12);
    expect(schedule.filter((e) => e.start === 540).map((e) => e.court)).toEqual(["C1", "C2"]);
    expectConsistent(matches, schedule, 5);
  });

  it("waits for the matches that feed a bracket match", () => {
    const matches: SchedulableMatch[] = [
      { id: "final", teams: [], after: ["semi1", "semi2"] },
      { id: "semi1", teams: ["T1", "T4"] },
      { id: "semi2", teams: ["T2", "T3"] },
    ];
    const schedule = planSchedule({ matches, settings: settings(3) });
    expect(schedule).toEqual([
      { match: "semi1", court: "C1", start: 540, end: 560 },
      { match: "semi2", court: "C2", start: 540, end: 560 },
      { match: "final", court: "C1", start: 565, end: 585 },
    ]);
  });

  it("handles no match and a match whose teams are not known yet", () => {
    expect(planSchedule({ matches: [], settings: settings(2) })).toEqual([]);
    expect(planSchedule({ matches: [{ id: "final", teams: [] }], settings: settings(2) })).toEqual([
      { match: "final", court: "C1", start: 540, end: 560 },
    ]);
  });

  it("refuses bad settings and bad matches", () => {
    const matches = pool(teams(3), "A");
    const fails = (code: string, run: () => unknown) =>
      expect(run).toThrow(expect.objectContaining({ code }));
    fails("NO_COURT", () => planSchedule({ matches, settings: settings(0) }));
    fails("DUPLICATE_COURT", () =>
      planSchedule({ matches, settings: settings(1, { courts: ["C1", "C1"] }) }),
    );
    fails("INVALID_DURATION", () =>
      planSchedule({ matches, settings: settings(1, { matchMinutes: 0 }) }),
    );
    fails("INVALID_DURATION", () =>
      planSchedule({ matches, settings: settings(1, { breakMinutes: -1 }) }),
    );
    fails("DUPLICATE_MATCH", () =>
      planSchedule({ matches: [...matches, ...matches], settings: settings(1) }),
    );
    fails("SAME_TEAM", () =>
      planSchedule({ matches: [{ id: "m", teams: ["T1", "T1"] }], settings: settings(1) }),
    );
    fails("UNKNOWN_MATCH", () =>
      planSchedule({ matches: [{ id: "m", teams: [], after: ["x"] }], settings: settings(1) }),
    );
    fails("CYCLE", () =>
      planSchedule({
        matches: [
          { id: "a", teams: [], after: ["b"] },
          { id: "b", teams: [], after: ["a"] },
        ],
        settings: settings(1),
      }),
    );
  });
});

describe("adjustSchedule", () => {
  const matches = pool(teams(4), "A");
  const plan = planSchedule({ matches, settings: settings(1) });
  const first = plan[0]?.match ?? "";

  it("pushes the next matches back when a match ends late", () => {
    const adjusted = adjustSchedule({
      schedule: plan,
      matches,
      settings: settings(1),
      actual: [{ match: first, start: 540, end: 570 }],
      now: 570,
      earlyStart: false,
    });
    expect(adjusted.map((e) => e.start)).toEqual([540, 575, 600, 625, 650, 675]);
  });

  it("brings matches forward when a match ends early, only with early starts", () => {
    const run = (earlyStart: boolean) =>
      adjustSchedule({
        schedule: plan,
        matches,
        settings: settings(1),
        actual: [{ match: first, start: 540, end: 550 }],
        now: 550,
        earlyStart,
      }).map((e) => e.start);
    expect(run(true)).toEqual([540, 555, 580, 605, 630, 655]);
    expect(run(false)).toEqual([540, 565, 590, 615, 640, 665]);
  });

  it("expects a match still being played to end no earlier than now", () => {
    const adjusted = adjustSchedule({
      schedule: plan,
      matches,
      settings: settings(1),
      actual: [{ match: first, start: 545 }],
      now: 580,
      earlyStart: false,
    });
    expect(adjusted[0]).toMatchObject({ start: 545, end: 580 });
    expect(adjusted[1]?.start).toBe(585);
  });

  it("refuses unknown, duplicate or negative real times", () => {
    const run = (actual: { match: string; start: number; end?: number }[]) => () =>
      adjustSchedule({
        schedule: plan,
        matches,
        settings: settings(1),
        actual,
        now: 600,
        earlyStart: false,
      });
    expect(run([{ match: "x", start: 540 }])).toThrow(
      expect.objectContaining({ code: "UNKNOWN_MATCH" }),
    );
    expect(
      run([
        { match: first, start: 540 },
        { match: first, start: 545 },
      ]),
    ).toThrow(expect.objectContaining({ code: "DUPLICATE_MATCH" }));
    expect(run([{ match: first, start: 560, end: 550 }])).toThrow(
      expect.objectContaining({ code: "INVALID_DURATION" }),
    );
    expect(run([{ match: first, start: Number.NaN }])).toThrow(
      expect.objectContaining({ code: "INVALID_DURATION" }),
    );
    const twice = [...plan, ...plan.slice(0, 1)];
    expect(() =>
      adjustSchedule({
        schedule: twice,
        matches,
        settings: settings(1),
        actual: [],
        now: 540,
        earlyStart: false,
      }),
    ).toThrow(expect.objectContaining({ code: "DUPLICATE_MATCH" }));
  });
});

describe("moveMatch and removeCourt", () => {
  const matches = [...pool(teams(4, "A"), "A"), ...pool(teams(4, "B"), "B")];
  const plan = planSchedule({ matches, settings: settings(2) });

  it("moves a match to another court and time", () => {
    const last = plan.at(-1);
    if (last === undefined) throw new Error("empty plan");
    const moved = moveMatch(plan, last.match, { court: "C3", start: 600 }, ["C1", "C2", "C3"]);
    expect(moved.find((e) => e.match === last.match)).toMatchObject({
      court: "C3",
      start: 600,
      end: 620,
      notBefore: 600,
    });
    const courts = ["C1", "C2"];
    expect(() => moveMatch(plan, "x", { court: "C1", start: 0 }, courts)).toThrow(
      expect.objectContaining({ code: "UNKNOWN_MATCH" }),
    );
    expect(() => moveMatch(plan, last.match, { court: "C9", start: 0 }, courts)).toThrow(
      expect.objectContaining({ code: "UNKNOWN_COURT" }),
    );
    expect(() => moveMatch(plan, last.match, { court: "C1", start: Number.NaN }, courts)).toThrow(
      expect.objectContaining({ code: "INVALID_DURATION" }),
    );
  });

  it("keeps a moved match at its new time, even with early starts", () => {
    const first = plan[0];
    if (first === undefined) throw new Error("empty plan");
    const moved = moveMatch(plan, first.match, { court: first.court, start: 700 }, ["C1", "C2"]);
    const adjusted = adjustSchedule({
      schedule: moved,
      matches,
      settings: settings(2),
      actual: [],
      now: 540,
      earlyStart: true,
    });
    expect(adjusted.find((e) => e.match === first.match)?.start).toBe(700);
  });

  it("keeps a bracket match after its feeders when a feeder is moved later", () => {
    const matches: SchedulableMatch[] = [
      { id: "semi1", teams: ["T1", "T4"] },
      { id: "semi2", teams: ["T2", "T3"] },
      { id: "final", teams: [], after: ["semi1", "semi2"] },
    ];
    const plan = planSchedule({ matches, settings: settings(2) });
    // semi2 now comes after the final on court 1, and semi1 runs late.
    const moved = moveMatch(plan, "semi2", { court: "C1", start: 600 }, ["C1", "C2"]);
    const adjusted = adjustSchedule({
      schedule: moved,
      matches,
      settings: settings(2),
      actual: [{ match: "semi1", start: 540, end: 650 }],
      now: 650,
      earlyStart: false,
    });
    const at = (id: string) => adjusted.find((e) => e.match === id);
    expect(at("semi2")).toMatchObject({ court: "C1", start: 655, end: 675 });
    expect(at("final")?.start).toBe(680);
  });

  it("spreads the matches of a removed court over the others", () => {
    const from = 590;
    const removed = removeCourt({ schedule: plan, court: "C2", courts: ["C1", "C2"], from });
    expect(removed.filter((e) => e.court === "C2").every((e) => e.start < from)).toBe(true);
    const adjusted = adjustSchedule({
      schedule: removed,
      matches,
      settings: settings(2),
      actual: plan.filter((e) => e.start < from).map((e) => ({ ...e })),
      now: from,
      earlyStart: false,
    });
    expect(adjusted.filter((e) => e.start >= from).every((e) => e.court === "C1")).toBe(true);
    expectConsistent(matches, adjusted, 5);
    expect(() => removeCourt({ schedule: plan, court: "C1", courts: ["C1"], from })).toThrow(
      expect.objectContaining({ code: "NO_COURT" }),
    );
    expect(() => removeCourt({ schedule: plan, court: "C9", courts: ["C1", "C2"], from })).toThrow(
      expect.objectContaining({ code: "UNKNOWN_COURT" }),
    );
    expect(() =>
      removeCourt({ schedule: plan, court: "C2", courts: ["C1", "C2"], from: Number.NaN }),
    ).toThrow(expect.objectContaining({ code: "INVALID_DURATION" }));
    expect(() => assignReferees({ schedule: plan, matches, from: Number.NaN })).toThrow(
      expect.objectContaining({ code: "INVALID_DURATION" }),
    );
  });
});

describe("assignReferees", () => {
  it("takes a resting team of the same pool", () => {
    const matches = [...pool(teams(3, "A"), "A"), ...pool(teams(3, "B"), "B")];
    const schedule = assignReferees({
      schedule: planSchedule({ matches, settings: settings(2) }),
      matches,
    });
    for (const entry of schedule) {
      const match = matches.find((m) => m.id === entry.match);
      expect(entry.referee).toBeDefined();
      expect(match?.teams).not.toContain(entry.referee);
      expect(entry.referee?.[0]).toBe(match?.group);
    }
  });

  it("leaves a match without referee when every team plays", () => {
    const matches: SchedulableMatch[] = [{ id: "m", teams: ["T1", "T2"] }];
    const [entry] = assignReferees({
      schedule: planSchedule({ matches, settings: settings(1) }),
      matches,
    });
    expect(entry?.referee).toBeUndefined();
  });
});

const scheduleArb = fc.record({
  pools: fc.array(fc.integer({ min: 2, max: 7 }), { minLength: 1, maxLength: 4 }),
  courts: fc.integer({ min: 1, max: 4 }),
  breakMinutes: fc.integer({ min: 0, max: 10 }),
});

const poolsOf = (sizes: readonly number[]) =>
  sizes.flatMap((size, p) => pool(teams(size, `P${p}-`), `P${p}`));

describe("schedule properties", () => {
  it("places every match once, never two at a time for a team or a court", () => {
    fc.assert(
      fc.property(scheduleArb, ({ pools, courts, breakMinutes }) => {
        const matches = poolsOf(pools);
        const schedule = planSchedule({ matches, settings: settings(courts, { breakMinutes }) });
        expect(schedule.map((e) => e.match).sort()).toEqual(matches.map((m) => m.id).sort());
        expectConsistent(matches, schedule, breakMinutes);
      }),
    );
  });

  it("only plays a team back-to-back when no rested match was ready", () => {
    fc.assert(
      fc.property(scheduleArb, ({ pools, courts, breakMinutes }) => {
        const matches = poolsOf(pools);
        const s = settings(courts, { breakMinutes });
        const schedule = planSchedule({ matches, settings: s });
        const slot = s.matchMinutes + s.breakMinutes;
        const lastEnd = (team: string, time: number) =>
          Math.max(
            Number.NEGATIVE_INFINITY,
            ...schedule
              .filter((e) => e.end <= time && teamsOf(matches, e).includes(team))
              .map((e) => e.end),
          );
        const rested = (m: SchedulableMatch, time: number) =>
          m.teams.every((t) => time - lastEnd(t, time) >= slot);
        for (const entry of schedule) {
          // Matches placed before this one: earlier, or at the same time on an earlier court.
          const before = schedule.slice(0, schedule.indexOf(entry));
          const ready = (m: SchedulableMatch, time: number) =>
            m.teams.every((t) =>
              before.every((e) => !teamsOf(matches, e).includes(t) || e.end + breakMinutes <= time),
            );
          const match = matches.find((m) => m.id === entry.match);
          if (match === undefined || rested(match, entry.start)) continue;
          // Matches not started yet at that time, which this court could have taken instead.
          const waiting = matches.filter(
            (m) => !before.some((e) => e.match === m.id) && m.id !== entry.match,
          );
          expect(waiting.some((m) => ready(m, entry.start) && rested(m, entry.start))).toBe(false);
        }
      }),
    );
  });

  it("keeps a consistent schedule after random delays", () => {
    fc.assert(
      fc.property(
        scheduleArb,
        fc.array(fc.integer({ min: -10, max: 20 }), { minLength: 30, maxLength: 30 }),
        fc.boolean(),
        ({ pools, courts, breakMinutes }, delays, earlyStart) => {
          const matches = poolsOf(pools);
          const s = settings(courts, { breakMinutes });
          const plan = planSchedule({ matches, settings: s });
          // The first half of the matches are played, each off by a random delay.
          let schedule = plan;
          const actual: { match: string; start: number; end: number }[] = [];
          const played = plan.slice(0, Math.floor(plan.length / 2));
          for (const [i, entry] of played.entries()) {
            const current = schedule.find((e) => e.match === entry.match) ?? entry;
            const end = current.start + s.matchMinutes + (delays[i % delays.length] ?? 0);
            actual.push({ match: entry.match, start: current.start, end });
            schedule = adjustSchedule({
              schedule: plan,
              matches,
              settings: s,
              actual,
              // Time only moves forward, even when this match ended before an earlier one.
              now: Math.max(s.start, ...actual.map((a) => a.end)),
              earlyStart,
            });
          }
          const now = Math.max(s.start, ...actual.map((a) => a.end));
          expectConsistent(
            matches,
            schedule.filter((e) => !actual.some((a) => a.match === e.match)),
            breakMinutes,
          );
          for (const entry of schedule) {
            const real = actual.find((a) => a.match === entry.match);
            if (real !== undefined)
              expect(entry).toMatchObject({ start: real.start, end: real.end });
            else {
              expect(entry.start).toBeGreaterThanOrEqual(now);
              if (!earlyStart) {
                expect(entry.start).toBeGreaterThanOrEqual(
                  plan.find((e) => e.match === entry.match)?.start ?? 0,
                );
              }
            }
          }
        },
      ),
    );
  });

  it("never gives a referee a match it plays or two matches at once", () => {
    fc.assert(
      fc.property(scheduleArb, ({ pools, courts, breakMinutes }) => {
        const matches = poolsOf(pools);
        const schedule = assignReferees({
          schedule: planSchedule({ matches, settings: settings(courts, { breakMinutes }) }),
          matches,
        });
        for (const entry of schedule) {
          if (entry.referee === undefined) continue;
          for (const other of schedule) {
            if (!overlap(entry, other)) continue;
            expect(teamsOf(matches, other)).not.toContain(entry.referee);
            if (other !== entry) expect(other.referee).not.toBe(entry.referee);
          }
        }
      }),
    );
  });

  it("moves a match without touching the others", () => {
    fc.assert(
      fc.property(scheduleArb, fc.nat(), fc.integer({ min: 0, max: 600 }), (input, pick, start) => {
        const s = settings(input.courts + 1, { breakMinutes: input.breakMinutes });
        const plan = planSchedule({ matches: poolsOf(input.pools), settings: s });
        const entry = plan[pick % plan.length];
        if (entry === undefined) return;
        const court = s.courts[pick % s.courts.length] ?? "C1";
        const moved = moveMatch(plan, entry.match, { court, start }, s.courts);
        expect(moved.find((e) => e.match === entry.match)).toEqual({
          ...entry,
          court,
          start,
          end: start + entry.end - entry.start,
          notBefore: start,
        });
        expect(moved.filter((e) => e.match !== entry.match)).toEqual(
          plan.filter((e) => e.match !== entry.match),
        );
      }),
    );
  });

  it("empties a removed court from `from` on and balances the others", () => {
    fc.assert(
      fc.property(
        scheduleArb,
        fc.nat(),
        fc.integer({ min: 0, max: 400 }),
        (input, pick, offset) => {
          const s = settings(input.courts + 1, { breakMinutes: input.breakMinutes });
          const plan = planSchedule({ matches: poolsOf(input.pools), settings: s });
          const court = s.courts[pick % s.courts.length] ?? "C1";
          const from = s.start + offset;
          const removed = removeCourt({ schedule: plan, court, courts: s.courts, from });
          const later = (e: ScheduledMatch) => e.start >= from;
          expect(removed.some((e) => e.court === court && later(e))).toBe(false);
          // Every match is kept once, at its time; only the court of moved matches changes.
          expect(removed.map(({ court: _c, ...rest }) => rest)).toEqual(
            plan.map(({ court: _c, ...rest }) => rest),
          );
          for (const [i, e] of removed.entries()) {
            if (plan[i]?.court !== court || !later(e)) expect(e).toEqual(plan[i]);
          }
          // Each moved match went to the least loaded court, so the spread of the loads grows
          // to at most one.
          const others = s.courts.filter((c) => c !== court);
          const spread = (schedule: readonly ScheduledMatch[]) => {
            const loads = others.map(
              (c) => schedule.filter((e) => e.court === c && later(e)).length,
            );
            return Math.max(...loads) - Math.min(...loads);
          };
          const moved = plan.some((e) => e.court === court && later(e));
          if (moved) expect(spread(removed)).toBeLessThanOrEqual(Math.max(1, spread(plan)));
        },
      ),
    );
  });

  it("stays consistent after moving a match, pools and brackets alike", () => {
    fc.assert(
      fc.property(
        scheduleArb,
        fc.integer({ min: 2, max: 16 }),
        fc.boolean(),
        fc.nat(),
        fc.integer({ min: 0, max: 600 }),
        fc.boolean(),
        (input, n, double, pick, offset, earlyStart) => {
          const matches = [...poolsOf(input.pools), ...bracketMatches(n, double)];
          const s = settings(input.courts, { breakMinutes: input.breakMinutes });
          const plan = planSchedule({ matches, settings: s });
          expectConsistent(matches, plan, s.breakMinutes);
          const entry = plan[pick % plan.length];
          if (entry === undefined) return;
          const court = s.courts[pick % s.courts.length] ?? "C1";
          const moved = moveMatch(plan, entry.match, { court, start: s.start + offset }, s.courts);
          const adjusted = adjustSchedule({
            schedule: moved,
            matches,
            settings: s,
            actual: [],
            now: s.start,
            earlyStart,
          });
          expect(adjusted.map((e) => e.match).sort()).toEqual(plan.map((e) => e.match).sort());
          expect(adjusted.find((e) => e.match === entry.match)?.start).toBeGreaterThanOrEqual(
            s.start + offset,
          );
          expectConsistent(matches, adjusted, s.breakMinutes);
        },
      ),
    );
  });

  it("picks referees from the pool first, then the least used, and keeps earlier ones", () => {
    fc.assert(
      fc.property(scheduleArb, fc.integer({ min: 0, max: 300 }), (input, offset) => {
        const matches = poolsOf(input.pools);
        const s = settings(input.courts, { breakMinutes: input.breakMinutes });
        const first = assignReferees({ schedule: planSchedule({ matches, settings: s }), matches });
        const from = s.start + offset;
        const schedule = assignReferees({ schedule: first, matches, from });
        const allTeams = [...new Set(matches.flatMap((m) => m.teams))];
        const groupOf = (team: string) => matches.find((m) => m.teams.includes(team))?.group;
        const ordered = [...schedule].sort((a, b) => a.start - b.start);
        for (const [i, entry] of ordered.entries()) {
          if (entry.start < from) {
            expect(entry).toEqual(first.find((e) => e.match === entry.match));
            continue;
          }
          const done = ordered.slice(0, i);
          const busy = new Set(
            ordered.filter((o) => overlap(o, entry)).flatMap((o) => teamsOf(matches, o)),
          );
          for (const o of done)
            if (overlap(o, entry) && o.referee !== undefined) busy.add(o.referee);
          const free = allTeams.filter((t) => !busy.has(t));
          if (entry.referee === undefined) {
            expect(free).toEqual([]);
            continue;
          }
          const group = matches.find((m) => m.id === entry.match)?.group;
          const sameGroup = free.filter((t) => groupOf(t) === group);
          const tier = sameGroup.length > 0 ? sameGroup : free;
          expect(tier).toContain(entry.referee);
          const duties = (team: string) => done.filter((o) => o.referee === team).length;
          for (const t of tier) expect(duties(t)).toBeGreaterThanOrEqual(duties(entry.referee));
        }
      }),
    );
  });
});

/** A bracket's matches: known teams, and the matches each one waits for. */
function bracketMatches(n: number, double: boolean): SchedulableMatch[] {
  const names = teams(n, "K");
  const bracket = double
    ? doubleElimination({ teams: names, grandFinalReset: true })
    : singleElimination({ teams: names, consolation: true });
  return bracket.map((m) => {
    const sides = [m.home, m.away];
    return {
      id: m.id,
      teams: sides.flatMap((side) => (side.kind === "team" ? [side.team] : [])),
      after: [
        ...sides.flatMap((side) =>
          side.kind === "winner" || side.kind === "loser" ? [side.match] : [],
        ),
        ...(m.onlyIf ? [m.onlyIf.match] : []),
      ],
    };
  });
}
