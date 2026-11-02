import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { webOrigin } from "./config.js";
import { proxyHops } from "./proxy-hops.js";

const app = await NestFactory.create<NestExpressApplication>(AppModule);
// Rate limits key on the client's address. Behind Caddy on the server, set TRUST_PROXY_HOPS=1 so
// it comes from X-Forwarded-For; without a proxy, trusting that header would let clients forge it.
app.set("trust proxy", proxyHops(process.env.TRUST_PROXY_HOPS));
app.enableCors({ origin: webOrigin, credentials: true });
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 4000));
