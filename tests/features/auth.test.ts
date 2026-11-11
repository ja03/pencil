import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { db } from "@/server/db";
import { createUser, sessionCookieFor, signedIn, TEST_PASSWORD } from "../helpers/auth";
import { call, type CallResult } from "../helpers/request";

const SEVEN_DAYS = 7 * 24 * 60 * 60;

const newAccount = {
  username: "ada_writes",
  email: "ada@example.com",
  password: "analytical-engine",
};

/** The Set-Cookie header for the session cookie, split into its parts. */
function sessionCookie(res: CallResult) {
  const header = res.headers.getSetCookie().find((c) => c.startsWith("pencil_session="));
  if (!header) return undefined;
  const [pair, ...attrs] = header.split(";").map((p) => p.trim());
  return {
    value: pair.slice("pencil_session=".length),
    attrs: attrs.map((a) => a.toLowerCase()),
    /** Ready to send back as a `cookie` request header. */
    header: pair,
  };
}

function registerWith(body: unknown) {
  return call(register, { method: "POST", path: "/api/auth/register", body });
}

function loginWith(body: unknown) {
  return call(login, { method: "POST", path: "/api/auth/login", body });
}

function meWith(cookie?: string) {
  return call(me, { path: "/api/auth/me", headers: cookie ? { cookie } : {} });
}

describe("POST /api/auth/register", () => {
  it("creates the account, signs it in and never returns the password", async () => {
    const res = await registerWith(newAccount);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        username: "ada_writes",
        email: "ada@example.com",
        emailVerified: false,
      },
    });
    expect(JSON.stringify(res.body)).not.toContain(newAccount.password);

    const cookie = sessionCookie(res);
    expect(cookie?.value).toBeTruthy();
    expect((await meWith(cookie!.header)).body.user.username).toBe("ada_writes");
  });

  it("stores the password as a bcrypt hash", async () => {
    await registerWith(newAccount);

    const row = await db().user.findUniqueOrThrow({ where: { username: "ada_writes" } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.passwordHash).not.toContain(newAccount.password);
  });

  it("stores the email lowercased and trimmed", async () => {
    const res = await registerWith({ ...newAccount, email: "  Ada@Example.COM " });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("ada@example.com");
  });

  it.each([
    ["too short", "ab"],
    ["too long", "a".repeat(21)],
    ["uppercase letters", "Ada_Writes"],
    ["a hyphen", "ada-writes"],
    ["a space", "ada writes"],
  ])("rejects a username with %s", async (_, username) => {
    const res = await registerWith({ ...newAccount, username });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(res.body.error.fields)).toEqual(["username"]);
    expect(await db().user.count()).toBe(0);
  });

  it.each([
    ["3 characters", "abc"],
    ["20 characters", "a_1".repeat(6) + "zz"],
  ])("accepts a username of exactly %s", async (_, username) => {
    const res = await registerWith({ ...newAccount, username });
    expect(res.status).toBe(201);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await registerWith({ ...newAccount, password: "1234567" });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ password: ["Use at least 8 characters."] });
  });

  it("accepts a password of exactly 8 characters", async () => {
    const res = await registerWith({ ...newAccount, password: "12345678" });
    expect(res.status).toBe(201);
  });

  it("rejects an invalid email and missing fields with field errors", async () => {
    const res = await registerWith({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual([
      "email",
      "password",
      "username",
    ]);
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("returns 409 with a username field error when the username is taken", async () => {
    await createUser({ username: "ada_writes" });

    const res = await registerWith(newAccount);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect(res.body.error.fields).toEqual({ username: ["That username is taken."] });
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("returns 409 with an email field error when the email is taken, ignoring case", async () => {
    await createUser({ email: "ada@example.com" });

    const res = await registerWith({ ...newAccount, email: "ADA@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.error.fields).toEqual({
      email: ["An account with that email already exists."],
    });
  });

  it("reports both fields when the username and email are both taken", async () => {
    await createUser({ username: "ada_writes" });
    await createUser({ email: "ada@example.com" });

    const res = await registerWith(newAccount);

    expect(res.status).toBe(409);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["email", "username"]);
  });

  it("creates only one account when the same signup is sent twice at once", async () => {
    const results = await Promise.all([registerWith(newAccount), registerWith(newAccount)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await db().user.count()).toBe(1);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in with the right password and sets a 7-day httpOnly cookie", async () => {
    const user = await createUser({ email: "ada@example.com" });

    const res = await loginWith({ email: "ada@example.com", password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: user.id,
      username: user.username,
      email: "ada@example.com",
      emailVerified: false,
    });
    const cookie = sessionCookie(res);
    expect(cookie?.attrs).toEqual(
      expect.arrayContaining(["httponly", "path=/", "samesite=lax", `max-age=${SEVEN_DAYS}`]),
    );
    expect((await meWith(cookie!.header)).status).toBe(200);
  });

  it("matches the email regardless of case", async () => {
    await createUser({ email: "ada@example.com" });

    const res = await loginWith({ email: "Ada@Example.com", password: TEST_PASSWORD });

    expect(res.status).toBe(200);
  });

  it("marks the cookie Secure when the request came over HTTPS", async () => {
    await createUser({ email: "ada@example.com" });

    const res = await call(login, {
      method: "POST",
      path: "/api/auth/login",
      headers: { "x-forwarded-proto": "https" },
      body: { email: "ada@example.com", password: TEST_PASSWORD },
    });

    expect(sessionCookie(res)?.attrs).toContain("secure");
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await createUser({ email: "ada@example.com" });

    const wrongPassword = await loginWith({ email: "ada@example.com", password: "nope-nope" });
    const unknownEmail = await loginWith({ email: "bob@example.com", password: TEST_PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
      expect(sessionCookie(res)).toBeUndefined();
    }
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("returns 400 when the email or password is missing", async () => {
    const res = await loginWith({ email: "ada@example.com" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(["password"]);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const { headers } = await signedIn();

    const res = await call(logout, { method: "POST", path: "/api/auth/logout", headers });

    expect(res.status).toBe(204);
    const cookie = sessionCookie(res);
    expect(cookie?.value).toBe("");
    expect(cookie?.attrs).toEqual(expect.arrayContaining(["httponly", "path=/", "max-age=0"]));
  });

  it("succeeds when nobody is signed in", async () => {
    const res = await call(logout, { method: "POST", path: "/api/auth/logout" });

    expect(res.status).toBe(204);
  });
});

describe("GET /api/auth/me (the current-user check every protected handler uses)", () => {
  it("returns the signed-in user", async () => {
    const { user, cookie } = await signedIn({ verified: true });

    const res = await meWith(cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, emailVerified: true });
  });

  it("returns 401 without a session cookie", async () => {
    const res = await meWith();

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for a tampered token", async () => {
    const { cookie } = await signedIn();
    const [header, payload, signature] = cookie.split(".");
    const tampered = `${header}.${payload}.${signature.slice(0, -4)}AAAA`;

    expect((await meWith(tampered)).status).toBe(401);
  });

  it("returns 401 once the 7-day session has expired", async () => {
    const user = await createUser();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const res = await meWith(await sessionCookieFor(user, eightDaysAgo));

    expect(res.status).toBe(401);
  });

  it("returns 401 when the user's tokenVersion has moved on (stale session)", async () => {
    const { user, cookie } = await signedIn();
    expect((await meWith(cookie)).status).toBe(200);

    await db().user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    const res = await meWith(cookie);
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({
      code: "UNAUTHENTICATED",
      message: "Your session has expired. Please log in again.",
    });
  });

  it("returns 401 when the user no longer exists", async () => {
    const { user, cookie } = await signedIn();
    await db().user.delete({ where: { id: user.id } });

    expect((await meWith(cookie)).status).toBe(401);
  });
});
