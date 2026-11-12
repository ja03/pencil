import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // The Prisma CLI (migrations, seed) only. In production the app talks to
  // Neon through its pooled connection string (DATABASE_URL), but migrations
  // need a session-level connection, so they use Neon's direct one when
  // DIRECT_URL is set. Locally and in CI there's no pooler: DATABASE_URL.
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
