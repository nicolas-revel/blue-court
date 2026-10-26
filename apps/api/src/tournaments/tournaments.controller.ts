import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  type StoredTournament,
  type TournamentSummary,
  TournamentsService,
} from "./tournaments.service.js";

@Controller("tournaments")
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Post()
  create(@Body() body: unknown): Promise<StoredTournament> {
    return this.tournaments.create(body);
  }

  @Get()
  list(): Promise<TournamentSummary[]> {
    return this.tournaments.list();
  }

  @Get(":id")
  get(@Param("id") id: string): Promise<StoredTournament> {
    return this.tournaments.get(id);
  }
}
