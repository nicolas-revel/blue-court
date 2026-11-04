import {
  FFVB_MATCH_RULES,
  FFVB_RANKING_POINTS,
  FFVB_TIE_BREAKERS,
  type Phase,
  type Team,
} from "@blue-court/engine";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import fc from "fast-check";
import { io } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { send, signUp, startTestApp, type TestApp } from "../testing/test-app.js";
import { TournamentsService } from "./tournaments.service.js";

const teams: Team[] = Array.from({ length: 4 }, (_, i) => ({
  id: `team${i + 1}`,
  name: `Team ${i + 1}`,
}));

const pools: Phase = {
  id: "pools",
  name: "Pools",
  format: { kind: "pools", poolCount: 1, draw: "seeded" },
  matchRules: FFVB_MATCH_RULES,
  rankingPoints: FFVB_RANKING_POINTS,
  tieBreakers: FFVB_TIE_BREAKERS,
  qualification: { kind: "all" },
  refereeing: "restingTeam",
};

describe("tournaments API", () => {
  let test: TestApp;
  let url: string;
  let cookie: string;

  beforeEach(async () => {
    test = await startTestApp();
    url = test.url;
    cookie = await signUp(url);
  });

  afterEach(async () => {
    await test.app.close();
  });

  const post = (body: unknown, as = cookie) => send(`${url}/tournaments`, "POST", body, as);
  const get = (path: string, as = cookie) => send(`${url}${path}`, "GET", undefined, as);

  it("answers the health check without an account", async () => {
    const response = await fetch(`${url}/health`);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("stores a valid tournament with a draw seed and reads it back", async () => {
    const created = await post({ name: "Club day", teams, phases: [pools] });
    expect(created.status).toBe(201);
    const tournament = await created.json();
    expect(tournament).toMatchObject({ name: "Club day", teams, phases: [pools] });
    expect(Number.isInteger(tournament.seed)).toBe(true);

    expect(await (await get("/tournaments")).json()).toEqual([
      { id: tournament.id, name: "Club day" },
    ]);
    expect(await (await get(`/tournaments/${tournament.id}`)).json()).toEqual(tournament);
  });

  it("keeps each organizer's tournaments to themselves", async () => {
    const tournament = await (await post({ name: "Mine", teams, phases: [pools] })).json();
    const other = await signUp(url);
    expect(await (await get("/tournaments", other)).json()).toEqual([]);
    expect((await get(`/tournaments/${tournament.id}`, other)).status).toBe(404);
  });

  it("only ever shows an organizer their own tournaments", async () => {
    const service = test.app.get(TournamentsService);
    // Each entry is the organizer who creates the next tournament.
    const creators = fc.array(fc.constantFrom("o1", "o2", "o3"), { maxLength: 12 });
    await fc.assert(
      fc.asyncProperty(creators, async (owners) => {
        test.db.tournaments.length = 0;
        const created = [];
        for (const owner of owners) {
          const { id } = await service.create(owner, { name: "T", teams, phases: [pools] });
          created.push({ id, owner });
        }
        for (const organizer of ["o1", "o2", "o3"]) {
          const mine = created.filter(({ owner }) => owner === organizer).map(({ id }) => id);
          const listed = (await service.list(organizer)).map(({ id }) => id);
          expect(listed.sort()).toEqual(mine.sort());
          for (const { id, owner } of created) {
            if (owner === organizer) expect((await service.get(organizer, id)).id).toBe(id);
            else await expect(service.get(organizer, id)).rejects.toThrow(NotFoundException);
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it("refuses every tournament route without a session", async () => {
    expect((await post({ name: "x", teams, phases: [pools] }, "")).status).toBe(401);
    expect((await get("/tournaments", "")).status).toBe(401);
    expect((await get("/tournaments/t1", "")).status).toBe(401);
    expect(test.db.tournaments).toEqual([]);
  });

  it("refuses settings the engine rejects, with its error codes", async () => {
    const response = await post({ name: "Too small", teams: teams.slice(0, 1), phases: [pools] });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors.map((error: { code: string }) => error.code)).toContain("TOO_FEW_TEAMS");
  });

  it("refuses a body that is not a tournament", async () => {
    expect((await post({ name: 3 })).status).toBe(400);
    expect((await post({ name: "x", teams: [null, null], phases: [null] })).status).toBe(400);
    expect((await post({ name: "x", teams: ["a", "b"], phases: [1] })).status).toBe(400);
    expect((await post({ name: "x", teams, phases: [{ id: "p" }] })).status).toBe(400);
  });

  it("names the malformed setting with the engine's code and path", async () => {
    const { set: _, ...noSet } = FFVB_MATCH_RULES as Extract<
      typeof FFVB_MATCH_RULES,
      { set: unknown }
    >;
    const response = await post({ name: "x", teams, phases: [{ ...pools, matchRules: noSet }] });
    expect(response.status).toBe(400);
    expect((await response.json()).errors).toEqual([
      {
        code: "MALFORMED",
        message: "expected an object",
        path: ["phases", 0, "matchRules", "set"],
      },
    ]);
  });

  it("answers any body with a stored tournament or a 400, never a crash", async () => {
    const service = test.app.get(TournamentsService);
    const team = fc.record({ id: fc.string(), name: fc.string() });
    // A valid phase with one setting replaced by any JSON value.
    const mutatedPhase = fc
      .tuple(fc.constantFrom(...Object.keys(pools)), fc.jsonValue())
      .map(([key, value]) => ({ ...pools, [key]: value }));
    const body = fc.oneof(
      fc.jsonValue(),
      fc.record({
        name: fc.string(),
        teams: fc.array(fc.oneof(team, fc.jsonValue()), { maxLength: 6 }),
        phases: fc.array(fc.oneof(fc.constant(pools), mutatedPhase, fc.jsonValue()), {
          maxLength: 3,
        }),
      }),
    );
    await fc.assert(
      fc.asyncProperty(body, async (input) => {
        try {
          const { seed } = await service.create("o1", input);
          expect(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 31).toBe(true);
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("answers 404 for an unknown tournament", async () => {
    expect((await get("/tournaments/nope")).status).toBe(404);
  });

  it("pushes new tournaments to their organizer's screens only", async () => {
    const connect = (as: string) => {
      const socket = io(url, { transports: ["websocket"], extraHeaders: { cookie: as } });
      return new Promise<typeof socket>((resolve) => socket.on("connect", () => resolve(socket)));
    };
    const mine = await connect(cookie);
    const theirs = await connect(await signUp(url));
    const heard: unknown[] = [];
    theirs.on("tournament.created", (event) => heard.push(event));
    const received = new Promise((resolve) => mine.on("tournament.created", resolve));
    const tournament = await (await post({ name: "Live", teams, phases: [pools] })).json();
    expect(await received).toEqual({ id: tournament.id, name: "Live" });
    expect(heard).toEqual([]);
    mine.close();
    theirs.close();
  });
});
