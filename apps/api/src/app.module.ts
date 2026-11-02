import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthController } from "./auth/auth.controller.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { AuthService } from "./auth/auth.service.js";
import { HealthController } from "./health.controller.js";
import { LiveGateway } from "./live.gateway.js";
import { PrismaService } from "./prisma.service.js";
import { TournamentsController } from "./tournaments/tournaments.controller.js";
import { TournamentsService } from "./tournaments/tournaments.service.js";

@Module({
  imports: [
    // Sign-up and sign-in only (see AuthController): 10 attempts per minute and per address.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  controllers: [HealthController, AuthController, TournamentsController],
  providers: [
    PrismaService,
    AuthService,
    LiveGateway,
    TournamentsService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
