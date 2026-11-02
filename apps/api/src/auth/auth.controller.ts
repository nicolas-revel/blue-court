import { Body, Controller, Get, HttpCode, Post, Res, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { LiveGateway } from "../live.gateway.js";
import { CurrentSession } from "./auth.guard.js";
import { AuthService, type NewSession, type Organizer, type SignedIn } from "./auth.service.js";
import { Public } from "./public.decorator.js";
import { sessionCookie } from "./session-cookie.js";

interface CookieResponse {
  setHeader(name: string, value: string): unknown;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly live: LiveGateway,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post("signup")
  async signUp(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<Organizer> {
    return this.started(await this.auth.signUp(body), response);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @HttpCode(200)
  @Post("login")
  async signIn(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<Organizer> {
    return this.started(await this.auth.signIn(body), response);
  }

  /** Ends the session, here and on the screens it opened. */
  @HttpCode(204)
  @Post("logout")
  async signOut(
    @CurrentSession() { sessionId }: SignedIn,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.auth.signOut(sessionId);
    this.live.endSession(sessionId);
    response.setHeader("Set-Cookie", sessionCookie("", 0));
  }

  @Get("me")
  me(@CurrentSession() { organizer }: SignedIn): Organizer {
    return organizer;
  }

  private started(session: NewSession, response: CookieResponse): Organizer {
    response.setHeader("Set-Cookie", sessionCookie(session.token, session.maxAgeSeconds));
    return session.organizer;
  }
}
