import "reflect-metadata";
import type { AddressInfo } from "node:net";
import {
  FFVB_MATCH_RULES,
  FFVB_RANKING_POINTS,
  FFVB_TIE_BREAKERS,
  type Phase,
  type Team,
} from "@blue-court/engine";
import { BadRequestException, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import fc from "fast-check";
import { io } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";
import { PrismaService } from "../prisma.service.js";
import { TournamentsService } from "./tournaments.service.js";

interface Row {
  id: string;
  name: string;
  teams: unknown;
  phases: unknown;
  seed: number;
  createdAt: Date;
}

/** Just enough of the Prisma client for the tournament routes, kept in memory. */
function memoryPrisma() {
  const rows: Row[] = [];
  return {
    tournament: {
      create: async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => {
        const row = { ...data, id: `t${rows.length + 1}`, createdAt: new Date() };
        rows.push(row);
        return row;
      },
      findMany: async () => rows.map(({ id, name }) => ({ id, name })).reverse(),
      findUnique: async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id) ?? null,
    },
    $disconnect: async () => {},
  };
}

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
  let app: INestApplication;
  let url: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(memoryPrisma())
      .compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    url = `http://localhost:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: unknown) =>
    fetch(`${url}/tournaments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("answers the health check", async () => {
    const response = await fetch(`${url}/health`);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("stores a valid tournament with a draw seed and reads it back", async () => {
    const created = await post({ name: "Club day", teams, phases: [pools] });
    expect(created.status).toBe(201);
    const tournament = await created.json();
    expect(tournament).toMatchObject({ name: "Club day", teams, phases: [pools] });
    expect(Number.isInteger(tournament.seed)).toBe(true);

    expect(await (await fetch(`${url}/tournaments`)).json()).toEqual([
      { id: tournament.id, name: "Club day" },
    ]);
    expect(await (await fetch(`${url}/tournaments/${tournament.id}`)).json()).toEqual(tournament);
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

  it("answers any body with a stored tournament or a 400, never a crash", async () => {
    const service = app.get(TournamentsService);
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
          const { seed } = await service.create(input);
          expect(Number.isInteger(seed) && seed >= 0 && seed < 2 ** 31).toBe(true);
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("answers 404 for an unknown tournament", async () => {
    expect((await fetch(`${url}/tournaments/nope`)).status).toBe(404);
  });

  it("pushes new tournaments to connected screens", async () => {
    const socket = io(url, { transports: ["websocket"] });
    await new Promise<void>((resolve) => socket.on("connect", resolve));
    const received = new Promise((resolve) => socket.on("tournament.created", resolve));
    const tournament = await (await post({ name: "Live", teams, phases: [pools] })).json();
    expect(await received).toEqual({ id: tournament.id, name: "Live" });
    socket.close();
  });
});
