import { db } from "@/server/db";

/** True when Postgres answers and the pgvector extension is installed. */
export async function isDatabaseReady(): Promise<boolean> {
  try {
    const rows = await db().$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    return rows.length === 1;
  } catch {
    return false;
  }
}
