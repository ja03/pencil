import { describe, expect, it } from "vitest";
import { POST as googleRoute } from "@/app/api/auth/google/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { GoogleSignIn } from "@/components/google-sign-in";
import { GoogleIdTokenVerifier, verifierForClientId } from "@/server/auth/google";
import { db } from "@/server/db";
import { createUser, TEST_PASSWORD } from "../helpers/auth";
import { fakeGoogle } from "../helpers/google";
import { call, type CallResult } from "../helpers/request";

let ip = 0;
/** A different client address per call, so the per-IP login limit doesn't get in the way. */
const freshIp = () => ({ "x-forwarded-for": `203.0.113.${(ip = (ip + 1) % 250)}` });

function signInWithGoogle(credential: unknown) {
  return call(googleRoute, {
    method: "POST",
    path: "/api/auth/google",
    headers: freshIp(),
    body: { credential },
  });
}

/** The session cookie a response set, ready to send back as a `cookie` header. */
function cookieOf(res: CallResult): string {
  const header = res.headers.getSetCookie().find((c) => c.startsWith("pencil_session="));
  if (!header) throw new Error("No session cookie was set.");
  return header.split(";")[0];
}

function meWith(cookie: string) {
  return call(me, { path: "/api/auth/me", headers: { cookie } });
}

describe("Google sign-in when it isn't configured", () => {
  it("hides the Google button", async () => {
    expect(await GoogleSignIn({ context: "signin" })).toBeNull();
    expect(verifierForClientId(undefined)).toBeNull();
  });

  it("answers 404 and creates nothing", async () => {
    const res = await signInWithGoogle("any-token");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(await db().user.count()).toBe(0);
  });
});

describe("POST /api/auth/google", () => {
  it("creates a verified account with a username from the email and signs it in", async () => {
    const google = fakeGoogle();

    const res = await signInWithGoogle(
      google.token({ googleId: "g-ada", email: "Ada.Lovelace@example.com" }),
    );

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: expect.any(String),
      username: "ada_lovelace",
      email: "ada.lovelace@example.com",
      emailVerified: true,
      hasPassword: false,
      googleLinked: true,
    });
    expect(JSON.stringify(res.body)).not.toContain("g-ada");
    const row = await db().user.findUniqueOrThrow({ where: { id: res.body.user.id } });
    expect(row.googleId).toBe("g-ada");
    expect(row.passwordHash).toBeNull();
    const current = await meWith(cookieOf(res));
    expect(current.body.user).toMatchObject({ id: row.id, hasPassword: false, googleLinked: true });
    expect(JSON.stringify(current.body)).not.toContain("g-ada");
  });

  it("adds a number when the username is taken", async () => {
    const google = fakeGoogle();
    await createUser({ username: "ada" });
    await createUser({ username: "ada2" });

    const res = await signInWithGoogle(google.token({ googleId: "g-ada", email: "ada@example.com" }));

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("ada3");
  });

  it("keeps a generated username within the username rules", async () => {
    const google = fakeGoogle();
    await createUser({ username: "a_very_long_local_pa" });

    const short = await signInWithGoogle(google.token({ googleId: "g-1", email: "x@example.com" }));
    const long = await signInWithGoogle(
      google.token({ googleId: "g-2", email: "a.very.long.local.part.indeed@example.com" }),
    );

    expect(short.body.user.username).toBe("x_user");
    expect(long.body.user.username).toBe("a_very_long_local_p2");
  });

  it("signs a returning Google user in to the same account", async () => {
    const google = fakeGoogle();
    const first = await signInWithGoogle(google.token({ googleId: "g-ada", email: "ada@example.com" }));

    const again = await signInWithGoogle(google.token({ googleId: "g-ada", email: "ada@example.com" }));

    expect(again.status).toBe(200);
    expect(again.body.user.id).toBe(first.body.user.id);
    expect(await db().user.count()).toBe(1);
  });

  it("links a verified password account with the same email instead of duplicating it", async () => {
    const google = fakeGoogle();
    const existing = await createUser({ email: "ada@example.com", verified: true });

    const res = await signInWithGoogle(google.token({ googleId: "g-ada", email: "ada@example.com" }));

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(existing.id);
    expect(await db().user.count()).toBe(1);
    const row = await db().user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(row.googleId).toBe("g-ada");
    // They can still log in with their password too.
    const withPassword = await call(login, {
      method: "POST",
      path: "/api/auth/login",
      headers: freshIp(),
      body: { email: "ada@example.com", password: TEST_PASSWORD },
    });
    expect(withPassword.status).toBe(200);
    // Both ways in show up on the current user, with neither secret.
    for (const body of [res.body, withPassword.body, (await meWith(cookieOf(withPassword))).body]) {
      expect(body.user).toMatchObject({ hasPassword: true, googleLinked: true });
      expect(JSON.stringify(body)).not.toContain("g-ada");
      expect(JSON.stringify(body)).not.toContain(row.passwordHash!);
    }
  });

  it("doesn't link an existing account when Google hasn't verified the email", async () => {
    const google = fakeGoogle();
    const existing = await createUser({ email: "ada@example.com", verified: true });

    const res = await signInWithGoogle(
      google.token({ googleId: "g-impostor", email: "ada@example.com", emailVerified: false }),
    );

    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie()).toEqual([]);
    const row = await db().user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(row.googleId).toBeNull();
    expect(row.passwordHash).toBe(existing.passwordHash);
    expect(await db().user.count()).toBe(1);
  });

  it("doesn't create an account for an email Google hasn't verified", async () => {
    const google = fakeGoogle();

    const res = await signInWithGoogle(
      google.token({ googleId: "g-new", email: "new@example.com", emailVerified: false }),
    );

    expect(res.status).toBe(403);
    expect(await db().user.count()).toBe(0);
  });

  it("takes over an unverified account: the squatter's cookie gets 401 and the password is removed", async () => {
    const google = fakeGoogle();
    // Someone registers the address without owning it, and is signed in.
    const registered = await call(register, {
      method: "POST",
      path: "/api/auth/register",
      headers: freshIp(),
      body: { username: "squatter", email: "ada@example.com", password: "i-do-not-own-this" },
    });
    expect(registered.status).toBe(201);
    const squatterCookie = cookieOf(registered);
    const loggedIn = await call(login, {
      method: "POST",
      path: "/api/auth/login",
      headers: freshIp(),
      body: { email: "ada@example.com", password: "i-do-not-own-this" },
    });
    const loginCookie = cookieOf(loggedIn);
    expect((await meWith(loginCookie)).status).toBe(200);

    // The address's real owner signs in with Google.
    const res = await signInWithGoogle(google.token({ googleId: "g-ada", email: "ada@example.com" }));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: registered.body.user.id, emailVerified: true });
    expect((await meWith(squatterCookie)).status).toBe(401);
    expect((await meWith(loginCookie)).status).toBe(401);
    expect((await meWith(cookieOf(res))).status).toBe(200);
    const row = await db().user.findUniqueOrThrow({ where: { id: registered.body.user.id } });
    expect(row.passwordHash).toBeNull();
    expect(row.googleId).toBe("g-ada");
    const oldPassword = await call(login, {
      method: "POST",
      path: "/api/auth/login",
      headers: freshIp(),
      body: { email: "ada@example.com", password: "i-do-not-own-this" },
    });
    expect(oldPassword.status).toBe(401);
  });

  it("refuses an email already linked to a different Google account", async () => {
    const google = fakeGoogle();
    await signInWithGoogle(google.token({ googleId: "g-first", email: "ada@example.com" }));

    const res = await signInWithGoogle(google.token({ googleId: "g-second", email: "ada@example.com" }));

    expect(res.status).toBe(409);
    expect(await db().user.count()).toBe(1);
  });

  it("answers 401 for a token Google doesn't vouch for", async () => {
    fakeGoogle();

    const res = await signInWithGoogle("forged-token");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(await db().user.count()).toBe(0);
  });

  it("answers 400 without a credential", async () => {
    fakeGoogle();

    const res = await signInWithGoogle("");

    expect(res.status).toBe(400);
    expect(res.body.error.fields.credential).toBeDefined();
  });
});

describe("GoogleIdTokenVerifier", () => {
  it("rejects a token that isn't a JWT, without calling Google", async () => {
    expect(await new GoogleIdTokenVerifier("client-id").verify("not-a-jwt")).toBeNull();
  });
});
