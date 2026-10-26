import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";
import { webOrigin } from "../config.js";
import type { TournamentSummary } from "./tournaments.service.js";

/** Pushes tournament changes to connected screens (organizer, scoring table, venue display). */
@WebSocketGateway({ cors: { origin: webOrigin } })
export class TournamentsGateway {
  @WebSocketServer()
  private readonly server: Server | undefined;

  created(tournament: TournamentSummary): void {
    this.server?.emit("tournament.created", tournament);
  }
}
