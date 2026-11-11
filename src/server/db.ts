import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

// Singleton: one client (and connection pool) per process, kept on
// globalThis so dev hot reloads reuse it instead of opening new pools.
const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

export function db(): PrismaClient {
  globalForDb.prisma ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: env().DATABASE_URL }),
  });
  return globalForDb.prisma;
}
