import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { webOrigin } from "./config.js";

const app = await NestFactory.create<NestExpressApplication>(AppModule);
// On the server, Caddy is the one hop in front of the API: rate limits use the client's address.
app.set("trust proxy", 1);
app.enableCors({ origin: webOrigin, credentials: true });
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 4000));
