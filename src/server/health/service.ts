import type { HealthResponse } from "@/contracts/health";
import { ApiError } from "@/server/http/errors";
import { isBucketReachable } from "@/server/storage";
import { isDatabaseReady } from "./repository";

/** Checks every dependency the app needs; throws 503 naming any that are down. */
export async function checkHealth(): Promise<HealthResponse> {
  const [database, storage] = await Promise.all([isDatabaseReady(), isBucketReachable()]);
  const down = [!database && "database", !storage && "storage"].filter(Boolean);
  if (down.length > 0) {
    throw new ApiError("SERVICE_UNAVAILABLE", `Unavailable: ${down.join(", ")}.`);
  }
  return { status: "ok", checks: { database: "ok", storage: "ok" } };
}
