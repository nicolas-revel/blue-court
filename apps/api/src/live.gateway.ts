import {
  type OnGatewayConnection,
  type OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { AuthService } from "./auth/auth.service.js";
import { readSessionToken } from "./auth/session-cookie.js";
import { webOrigin } from "./config.js";

const organizerRoom = (organizerId: string) => `organizer:${organizerId}`;
const sessionRoom = (sessionId: string) => `session:${sessionId}`;

interface SocketData {
  organizerId: string;
  sessionId: string;
}

/**
 * Pushes changes to connected screens (organizer, scoring table, venue display). CORS only binds
 * browsers, so the handshake itself must carry a valid session cookie, and each organizer only
 * hears about their own tournaments.
 */
@WebSocketGateway({ cors: { origin: webOrigin, credentials: true } })
export class LiveGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private readonly server: Server | undefined;

  constructor(private readonly auth: AuthService) {}

  afterInit(server: Server): void {
    server.use((socket, next) => {
      this.auth
        .check(readSessionToken(socket.handshake.headers.cookie))
        .then((signedIn) => {
          if (signedIn === undefined) return next(new Error("sign in first"));
          const data: SocketData = {
            organizerId: signedIn.organizer.id,
            sessionId: signedIn.sessionId,
          };
          socket.data = data;
          next();
        })
        .catch(next);
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    const { organizerId, sessionId } = socket.data as SocketData;
    await socket.join([organizerRoom(organizerId), sessionRoom(sessionId)]);
  }

  /** Sends an event to every screen the organizer has open. */
  toOrganizer(organizerId: string, event: string, payload: unknown): void {
    this.server?.to(organizerRoom(organizerId)).emit(event, payload);
  }

  /** Disconnects the screens opened with a session that just ended. */
  endSession(sessionId: string): void {
    this.server?.in(sessionRoom(sessionId)).disconnectSockets(true);
  }
}
