import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import { call } from "../helpers/request";

describe("GET /api/health", () => {
  it("reports ok when the database (with pgvector) and storage are reachable", async () => {
    const res = await call(GET, { path: "/api/health" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      checks: { database: "ok", storage: "ok" },
    });
  });
});
