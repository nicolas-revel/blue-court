import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentSession } from "../auth/auth.guard.js";
import type { SignedIn } from "../auth/auth.service.js";
import {
  type StoredTournament,
  type TournamentSummary,
  TournamentsService,
} from "./tournaments.service.js";

/** An organizer's own tournaments. */
@Controller("tournaments")
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Post()
  create(
    @CurrentSession() { organizer }: SignedIn,
    @Body() body: unknown,
  ): Promise<StoredTournament> {
    return this.tournaments.create(organizer.id, body);
  }

  @Get()
  list(@CurrentSession() { organizer }: SignedIn): Promise<TournamentSummary[]> {
    return this.tournaments.list(organizer.id);
  }

  @Get(":id")
  get(
    @CurrentSession() { organizer }: SignedIn,
    @Param("id") id: string,
  ): Promise<StoredTournament> {
    return this.tournaments.get(organizer.id, id);
  }
}
