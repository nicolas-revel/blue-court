import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  // Standalone output keeps the Docker image to the server and its traced dependencies.
  output: "standalone",
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  // Types are checked by `pnpm typecheck`, with the repository's TypeScript.
  typescript: { ignoreBuildErrors: true },
};

export default withNextIntl(config);
