import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GET as unknownGet, POST as unknownPost } from "@/app/api/[...path]/route";
import { ApiError } from "@/server/http/errors";
import { parseJson, route } from "@/server/http/route";
import { call } from "../helpers/request";

// Every API failure leaves in one shape: { error: { code, message, fields? } }.

describe("unknown API routes", () => {
  it("return 404 in the error shape, for any method", async () => {
    for (const handler of [unknownGet, unknownPost]) {
      const res = await call(handler, {
        path: "/api/nope",
        params: { path: ["nope"] },
      });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: { code: "NOT_FOUND", message: expect.any(String) },
      });
    }
  });
});

describe("route handlers built with route()", () => {
  const echo = route(async (request) => {
    const input = await parseJson(request, z.object({ title: z.string().min(1) }));
    return Response.json(input);
  });

  it("return 400 with field errors when the body fails validation", async () => {
    const res = await call(echo, { method: "POST", body: { title: "" } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields)).toEqual(["title"]);
  });

  it("return 400 when the body is not JSON", async () => {
    const res = await call(echo, { method: "POST", body: "{not json" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.fields).toBeUndefined();
  });

  it("map a thrown ApiError to its status code", async () => {
    const taken = route(() => {
      throw new ApiError("CONFLICT", "That username is taken.", {
        username: ["That username is taken."],
      });
    });

    const res = await call(taken, { method: "POST" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: "CONFLICT",
        message: "That username is taken.",
        fields: { username: ["That username is taken."] },
      },
    });
  });

  it("return 500 without leaking the internal error message", async () => {
    const broken = route(() => {
      throw new Error("connection string postgres://secret");
    });

    const res = await call(broken);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL");
    expect(res.body.error.message).not.toContain("secret");
  });
});
