import { Logger, type OnModuleDestroy } from "@nestjs/common";
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
const SESSION_PREFIX = "session:";
const sessionRoom = (sessionId: string) => `${SESSION_PREFIX}${sessionId}`;

/** How often expired sessions are purged and their screens disconnected. */
const SWEEP_EVERY_MS = 5 * 60 * 1000;

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
export class LiveGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  private readonly server: Server | undefined;

  private readonly logger = new Logger(LiveGateway.name);

  private readonly sweeper = setInterval(
    () =>
      void this.sweep().catch((error: unknown) =>
        this.logger.error(`session sweep failed: ${String(error)}`),
      ),
    SWEEP_EVERY_MS,
  );

  constructor(private readonly auth: AuthService) {}

  afterInit(server: Server): void {
    server.use((socket, next) => {
      // socket.io's CORS setting covers polling only: the WebSocket upgrade is checked here.
      // Browsers always send an Origin; other clients (tests, tools) have no cookie to abuse.
      const { origin } = socket.handshake.headers;
      if (origin !== undefined && origin !== webOrigin) return next(new Error("forbidden origin"));
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

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
  }

  /**
   * The session is checked at the handshake only, so sessions that expired or were deleted since
   * are found here, and their screens disconnected.
   */
  async sweep(now = new Date()): Promise<void> {
    const rooms = [...(this.server?.of("/").adapter.rooms.keys() ?? [])];
    const sessionIds = rooms
      .filter((room) => room.startsWith(SESSION_PREFIX))
      .map((room) => room.slice(SESSION_PREFIX.length));
    for (const sessionId of await this.auth.sweep(sessionIds, now)) this.endSession(sessionId);
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
