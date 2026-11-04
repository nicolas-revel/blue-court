import { randomInt } from "node:crypto";
import { type Phase, type Team, validateTournament } from "@blue-court/engine";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import { LiveGateway } from "../live.gateway.js";
import { PrismaService } from "../prisma.service.js";

export interface NewTournament {
  readonly name: string;
  readonly teams: readonly Team[];
  readonly phases: readonly Phase[];
}

export interface TournamentSummary {
  readonly id: string;
  readonly name: string;
}

export interface StoredTournament extends TournamentSummary, NewTournament {
  readonly seed: number;
}

const isObject = (body: unknown): body is Record<string, unknown> =>
  typeof body === "object" && body !== null && !Array.isArray(body);

/** Seeds fit the database's 32-bit integer column; `randomInt` excludes this bound. */
const SEED_LIMIT = 2 ** 31;

const toStored = (row: {
  id: string;
  organizerId: string;
  name: string;
  teams: Prisma.JsonValue;
  phases: Prisma.JsonValue;
  seed: number;
}): StoredTournament => ({
  id: row.id,
  name: row.name,
  // Only tournaments checked by the engine are stored, so the JSON has the engine's shapes.
  teams: row.teams as unknown as Team[],
  phases: row.phases as unknown as Phase[],
  seed: row.seed,
});

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveGateway,
  ) {}

  /** Checks the settings with the engine, then stores the tournament with its draw seed. */
  async create(organizerId: string, body: unknown): Promise<StoredTournament> {
    if (!isObject(body)) {
      throw new BadRequestException({ message: "a tournament needs a name, teams and phases" });
    }
    const seed = randomInt(SEED_LIMIT);
    // The engine checks every setting's shape, so any exception here is an engine bug (a 500).
    const validation = validateTournament({ ...body, id: "new", seed });
    if (!validation.valid) {
      throw new BadRequestException({ message: "invalid tournament", errors: validation.errors });
    }
    // Only a body with the engine's shapes passes its validation.
    const valid = body as unknown as NewTournament;
    const row = await this.prisma.tournament.create({
      data: {
        name: valid.name,
        teams: valid.teams as unknown as Prisma.InputJsonValue,
        phases: valid.phases as unknown as Prisma.InputJsonValue,
        seed,
        organizerId,
      },
    });
    const tournament = toStored(row);
    this.live.toOrganizer(organizerId, "tournament.created", {
      id: tournament.id,
      name: tournament.name,
    });
    return tournament;
  }

  /** The organizer's tournaments, newest first. */
  async list(organizerId: string): Promise<TournamentSummary[]> {
    return this.prisma.tournament.findMany({
      where: { organizerId },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Another organizer's tournament is answered as not found, so its existence stays private. */
  async get(organizerId: string, id: string): Promise<StoredTournament> {
    const row = await this.prisma.tournament.findFirst({ where: { id, organizerId } });
    if (row === null) {
      throw new NotFoundException(`tournament ${id} does not exist`);
    }
    return toStored(row);
  }
}
