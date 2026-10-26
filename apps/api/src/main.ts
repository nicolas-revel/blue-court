import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { webOrigin } from "./config.js";

const app = await NestFactory.create(AppModule);
app.enableCors({ origin: webOrigin });
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 4000));
