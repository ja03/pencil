import { afterAll, afterEach, beforeEach } from "vitest";
import { backgroundTasksSettled } from "@/server/background";
import { setClock } from "@/server/clock";
import { db } from "@/server/db";
import { setEmbeddingProvider } from "@/server/embeddings/provider";
import { resetRateLimiters } from "@/server/rate-limit/limits";
import { resetDatabase } from "../helpers/db";

beforeEach(async () => {
  await resetDatabase();
  resetRateLimiters();
});

afterEach(async () => {
  // Let emails a test triggered finish before the next test wipes the database.
  await backgroundTasksSettled();
  setClock();
  setEmbeddingProvider();
});

afterAll(async () => {
  await db().$disconnect();
});
