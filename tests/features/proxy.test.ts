import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { createUser, sessionCookieFor } from "../helpers/auth";

async function visit(path: string, cookie?: string) {
  const request = new NextRequest(new URL(path, "http://localhost"), {
    headers: cookie ? { cookie } : {},
  });
  const res = await proxy(request);
  return { status: res.status, location: res.headers.get("location") };
}

describe("proxy (early redirects from the session cookie)", () => {
  it("sends visitors on signed-in-only pages to log in, remembering where they were", async () => {
    const res = await visit("/settings?tab=security");

    expect(res.status).toBe(307);
    const location = new URL(res.location!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/settings?tab=security");
  });

  it("lets signed-in users through to signed-in-only pages", async () => {
    const cookie = await sessionCookieFor(await createUser());

    expect((await visit("/settings", cookie)).location).toBeNull();
  });

  it("sends signed-in users away from the login and register pages", async () => {
    const cookie = await sessionCookieFor(await createUser());

    for (const path of ["/login", "/register"]) {
      const res = await visit(path, cookie);
      expect(res.status).toBe(307);
      expect(new URL(res.location!).pathname).toBe("/");
    }
  });

  it("treats an invalid token as signed out", async () => {
    const res = await visit("/login", "pencil_session=not-a-jwt");

    expect(res.location).toBeNull();
  });

  it("leaves public pages alone", async () => {
    expect((await visit("/")).location).toBeNull();
    expect((await visit("/settingsx")).location).toBeNull();
  });
});
