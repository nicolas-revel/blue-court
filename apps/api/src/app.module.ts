import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthController } from "./auth/auth.controller.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { AuthService } from "./auth/auth.service.js";
import { HealthController } from "./health.controller.js";
import { LiveGateway } from "./live.gateway.js";
import { Mailer } from "./mail/mailer.js";
import { PrismaService } from "./prisma.service.js";
import { TournamentsController } from "./tournaments/tournaments.controller.js";
import { TournamentsService } from "./tournaments/tournaments.service.js";

/** Attempts allowed per address on each public auth route (docs/specs/accounts.md). */
const AUTH_ATTEMPTS = { ttl: 60_000, limit: 10 };

@Module({
  imports: [
    // Applied to sign-up, sign-in and password reset only (see AuthController).
    ThrottlerModule.forRoot([AUTH_ATTEMPTS]),
  ],
  controllers: [HealthController, AuthController, TournamentsController],
  providers: [
    PrismaService,
    AuthService,
    Mailer,
    LiveGateway,
    TournamentsService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
