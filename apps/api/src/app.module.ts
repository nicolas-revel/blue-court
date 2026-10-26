import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { PrismaService } from "./prisma.service.js";
import { TournamentsController } from "./tournaments/tournaments.controller.js";
import { TournamentsGateway } from "./tournaments/tournaments.gateway.js";
import { TournamentsService } from "./tournaments/tournaments.service.js";

@Module({
  controllers: [HealthController, TournamentsController],
  providers: [PrismaService, TournamentsService, TournamentsGateway],
})
export class AppModule {}
