import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";
import type { TournamentSummary } from "./tournaments.service.js";

/** Pushes tournament changes to connected screens (organizer, scoring table, venue display). */
@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" } })
export class TournamentsGateway {
  @WebSocketServer()
  private readonly server: Server | undefined;

  created(tournament: TournamentSummary): void {
    this.server?.emit("tournament.created", tournament);
  }
}
