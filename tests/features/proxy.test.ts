import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { db } from "@/server/db";
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

  it("leaves the login and register pages to the pages themselves, even for a valid token", async () => {
    // The proxy can't tell a valid session from a stale one without the
    // database, so the signed-in redirect happens in the page (`SignedOutOnly`).
    const cookie = await sessionCookieFor(await createUser());

    for (const path of ["/login", "/register"]) {
      expect((await visit(path, cookie)).location).toBeNull();
    }
  });

  it("judges a token by its signature and expiry alone, never the database", async () => {
    const live = await createUser();
    const gone = await createUser();
    const liveCookie = await sessionCookieFor(live);
    const goneCookie = await sessionCookieFor(gone);
    await db().user.delete({ where: { id: gone.id } });

    // A deleted user's token is still signed and unexpired, so it passes here
    // exactly like a live one; the page's own check is what turns it away.
    expect((await visit("/settings", goneCookie)).location).toBeNull();
    expect((await visit("/settings", liveCookie)).location).toBeNull();
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
