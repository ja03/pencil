import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { requirePageUser } from "@/server/auth/page-guard";
import { db } from "@/server/db";
import { signedIn } from "../helpers/auth";
import { resetTokenFor } from "../helpers/mail";
import { redirectOf } from "../helpers/redirect";
import { call } from "../helpers/request";

/** The cookies a page sees when the browser sends `cookie`. */
const jar = (cookie?: string) =>
  new NextRequest("http://localhost/", { headers: cookie ? { cookie } : {} }).cookies;

const openPage = (next: string, cookie?: string) =>
  redirectOf(() => requirePageUser(jar(cookie), next));

describe("signed-in-only pages", () => {
  it("send a session from before a password reset to the session-expired screen", async () => {
    const { user, cookie } = await signedIn();
    await call(forgot, { method: "POST", path: "/api/auth/forgot-password", body: { email: user.email } });
    const res = await call(reset, {
      method: "POST",
      path: "/api/auth/reset-password",
      body: { token: await resetTokenFor(user.email), password: "a-brand-new-password" },
    });
    expect(res.status).toBe(200);

    expect(await openPage("/settings?tab=security", cookie)).toBe(
      `/session-expired?next=${encodeURIComponent("/settings?tab=security")}`,
    );
  });

  it("send a deleted user's session to the session-expired screen", async () => {
    const { user, cookie } = await signedIn();
    await db().user.delete({ where: { id: user.id } });

    expect(await openPage("/my-posts", cookie)).toBe("/session-expired?next=%2Fmy-posts");
  });

  it("send a visitor with no session to log in", async () => {
    expect(await openPage("/my-posts")).toBe("/login?next=%2Fmy-posts");
  });

  it("let a current session stay", async () => {
    const { user, cookie } = await signedIn();

    let seen: unknown;
    expect(await redirectOf(async () => (seen = await requirePageUser(jar(cookie), "/write")))).toBeNull();
    expect(seen).toMatchObject({ id: user.id });
  });
});
