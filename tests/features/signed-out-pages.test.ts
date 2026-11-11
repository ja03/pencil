import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { leaveIfSignedIn } from "@/components/signed-out-only";
import { proxy } from "@/proxy";
import { db } from "@/server/db";
import { signedIn, TEST_PASSWORD } from "../helpers/auth";
import { redirectOf } from "../helpers/redirect";
import { call } from "../helpers/request";

const SIGNED_OUT_ONLY = ["/login", "/register"];

/**
 * Opens a login/register page the way a browser would: the proxy runs first,
 * then the page's own signed-in check. Returns where the visitor was sent, or
 * null when the page renders.
 */
async function open(path: string, cookie: string): Promise<string | null> {
  const request = new NextRequest(new URL(path, "http://localhost"), { headers: { cookie } });
  const early = (await proxy(request)).headers.get("location");
  if (early) return new URL(early).pathname;

  return redirectOf(() => leaveIfSignedIn(request.cookies));
}

describe("login and register pages with a stale session", () => {
  it("lets a deleted user's cookie open them", async () => {
    const { user, cookie } = await signedIn();
    await db().user.delete({ where: { id: user.id } });

    for (const path of SIGNED_OUT_ONLY) {
      expect(await open(path, cookie)).toBeNull();
    }
  });

  it("lets a cookie with a bumped tokenVersion open /login and log in again", async () => {
    const { user, cookie } = await signedIn();
    await db().user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });

    for (const path of SIGNED_OUT_ONLY) {
      expect(await open(path, cookie)).toBeNull();
    }

    const res = await call(login, {
      method: "POST",
      path: "/api/auth/login",
      headers: { cookie },
      body: { email: user.email, password: TEST_PASSWORD },
    });
    expect(res.status).toBe(200);
    const fresh = res.headers
      .getSetCookie()
      .find((c) => c.startsWith("pencil_session="))!
      .split(";")[0];

    const whoAmI = await call(me, { path: "/api/auth/me", headers: { cookie: fresh } });
    expect(whoAmI.status).toBe(200);
    expect(whoAmI.body.user.id).toBe(user.id);
    // With the fresh session, the login page sends them home again.
    expect(await open("/login", fresh)).toBe("/");
  });
});

describe("login and register pages with a valid session", () => {
  it("sends the visitor home", async () => {
    const { cookie } = await signedIn();

    for (const path of SIGNED_OUT_ONLY) {
      expect(await open(path, cookie)).toBe("/");
    }
  });
});
