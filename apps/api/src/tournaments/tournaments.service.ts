import { randomInt } from "node:crypto";
import {
  type ConfigValidation,
  type Phase,
  type Team,
  type Tournament,
  validateTournament,
} from "@blue-court/engine";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.service.js";
import { TournamentsGateway } from "./tournaments.gateway.js";

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

/** Teams and phases are objects with an id; the engine checks the rest of their settings. */
const isListWithIds = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { id?: unknown }).id === "string",
  );

const isNewTournament = (body: unknown): body is NewTournament => {
  if (typeof body !== "object" || body === null) return false;
  const { name, teams, phases } = body as Record<string, unknown>;
  return typeof name === "string" && isListWithIds(teams) && isListWithIds(phases);
};

/** Seeds fit the database's 32-bit integer column; `randomInt` excludes this bound. */
const SEED_LIMIT = 2 ** 31;

const logger = new Logger("TournamentsService");

/**
 * The engine trusts the shapes it is given, so a team or phase missing a nested setting makes
 * it throw a TypeError. That is answered as a 400 but logged as an error, since an engine bug looks
 * the same (#23 moves this check into the engine);
 * any other error stays a 500.
 */
const validate = (tournament: Tournament): ConfigValidation => {
  try {
    return validateTournament(tournament);
  } catch (error) {
    if (error instanceof TypeError) {
      logger.error(`tournament refused as malformed: ${error.message}`, error.stack);
      throw new BadRequestException({ message: "a team or phase is malformed" });
    }
    throw error;
  }
};

const toStored = (row: {
  id: string;
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
    private readonly gateway: TournamentsGateway,
  ) {}

  /** Checks the settings with the engine, then stores the tournament with its draw seed. */
  async create(body: unknown): Promise<StoredTournament> {
    if (!isNewTournament(body)) {
      throw new BadRequestException({ message: "a tournament needs a name, teams and phases" });
    }
    const seed = randomInt(SEED_LIMIT);
    const validation = validate({ ...body, id: "new", seed });
    if (!validation.valid) {
      throw new BadRequestException({ message: "invalid tournament", errors: validation.errors });
    }
    const row = await this.prisma.tournament.create({
      data: {
        name: body.name,
        teams: body.teams as unknown as Prisma.InputJsonValue,
        phases: body.phases as unknown as Prisma.InputJsonValue,
        seed,
      },
    });
    const tournament = toStored(row);
    this.gateway.created({ id: tournament.id, name: tournament.name });
    return tournament;
  }

  async list(): Promise<TournamentSummary[]> {
    return this.prisma.tournament.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: string): Promise<StoredTournament> {
    const row = await this.prisma.tournament.findUnique({ where: { id } });
    if (row === null) throw new NotFoundException(`tournament ${id} does not exist`);
    return toStored(row);
  }
}
