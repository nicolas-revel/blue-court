import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { secureCookies, webOrigin } from "./config.js";
import { proxyHops } from "./proxy-hops.js";

const app = await NestFactory.create<NestExpressApplication>(AppModule);
// Rate limits key on the client's address. Behind Caddy on the server, set TRUST_PROXY_HOPS=1 so
// it comes from X-Forwarded-For; without a proxy, trusting that header would let clients forge it.
const hops = proxyHops(process.env.TRUST_PROXY_HOPS);
app.set("trust proxy", hops);
if (hops === 0 && secureCookies) {
  new Logger("Bootstrap").warn(
    "WEB_ORIGIN is HTTPS but TRUST_PROXY_HOPS is 0: behind a proxy, every visitor shares one " +
      "rate-limit bucket. Set TRUST_PROXY_HOPS=1 behind Caddy (docs/deployment.md).",
  );
}
app.enableCors({ origin: webOrigin, credentials: true });
app.enableShutdownHooks();
await app.listen(Number(process.env.PORT ?? 4000));
