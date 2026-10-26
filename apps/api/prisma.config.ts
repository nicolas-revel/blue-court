import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // `prisma generate` needs no database, so the URL is only required by migrations.
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
