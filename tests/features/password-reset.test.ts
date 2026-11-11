import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POST as forgotRoute } from "@/app/api/auth/forgot-password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as resendRoute } from "@/app/api/auth/resend-verification/route";
import { POST as resetRoute } from "@/app/api/auth/reset-password/route";
import { POST as verifyRoute } from "@/app/api/auth/verify-email/route";
import { GET as myPosts } from "@/app/api/me/posts/route";
import { EMAIL_LINK_REPLY } from "@/contracts/auth";
import { createUser, signedIn, TEST_PASSWORD } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { emailsTo, resetTokenFor, verificationTokenFor } from "../helpers/mail";
import { call } from "../helpers/request";

const HOUR = 60 * 60 * 1000;
const NEW_PASSWORD = "a-brand-new-password";

type Headers = Record<string, string>;

let ip = 0;
/** A different client address per call, so per-IP limits don't get in the way. */
const freshIp = () => ({ "x-forwarded-for": `198.51.100.${(ip = (ip + 1) % 250)}` });

function forgot(email: string, headers: Headers = freshIp()) {
  return call(forgotRoute, {
    method: "POST",
    path: "/api/auth/forgot-password",
    headers,
    body: { email },
  });
}

function reset(token: unknown, password: unknown = NEW_PASSWORD, headers: Headers = {}) {
  return call(resetRoute, {
    method: "POST",
    path: "/api/auth/reset-password",
    headers,
    body: { token, password },
  });
}

function logIn(email: string, password: string) {
  return call(login, {
    method: "POST",
    path: "/api/auth/login",
    headers: freshIp(),
    body: { email, password },
  });
}

const whoAmI = (cookie: string) => call(me, { path: "/api/auth/me", headers: { cookie } });

const sessionCookieOf = (res: { headers: globalThis.Headers }) =>
  res.headers
    .getSetCookie()
    .find((c) => c.startsWith("pencil_session="))
    ?.split(";")[0];

/** A user who asked for a reset link, and its token. */
async function withResetLink() {
  const user = await createUser({ verified: true });
  expect((await forgot(user.email)).status).toBe(202);
  return { user, token: await resetTokenFor(user.email) };
}

describe("POST /api/auth/forgot-password", () => {
  it("emails a known account a link to the reset page", async () => {
    const user = await createUser();

    const res = await forgot(user.email);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ message: EMAIL_LINK_REPLY });
    const [message] = await emailsTo(user.email);
    expect(message.Subject).toBe("Reset your Pencil password");
    expect(await resetTokenFor(user.email)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("matches the email however it was typed", async () => {
    const user = await createUser();

    await forgot(`  ${user.email.toUpperCase()} `);

    expect(await emailsTo(user.email)).toHaveLength(1);
  });

  it("gives identical responses for known and unknown emails, and emails nobody for an unknown one", async () => {
    const known = await createUser();
    const unknown = `nobody-${randomUUID().slice(0, 8)}@example.com`;

    const [knownRes, unknownRes] = await Promise.all([forgot(known.email), forgot(unknown)]);

    expect(unknownRes.status).toBe(knownRes.status);
    expect(unknownRes.body).toEqual(knownRes.body);
    expect(unknownRes.headers.get("content-type")).toBe(knownRes.headers.get("content-type"));
    expect(unknownRes.headers.getSetCookie()).toEqual(knownRes.headers.getSetCookie());
    expect(await emailsTo(known.email)).toHaveLength(1);
    expect(await emailsTo(unknown)).toHaveLength(0);
  });

  it("allows 3 per hour per email, with the same 429 for known and unknown emails", async () => {
    const time = fakeClock();
    const known = (await createUser()).email;
    const unknown = `nobody-${randomUUID().slice(0, 8)}@example.com`;

    for (const email of [known, unknown]) {
      for (let i = 0; i < 3; i++) expect((await forgot(email)).status).toBe(202);
    }
    const [knownBlocked, unknownBlocked] = await Promise.all([forgot(known), forgot(unknown)]);

    expect(knownBlocked.status).toBe(429);
    expect(knownBlocked.body).toEqual(unknownBlocked.body);
    expect(knownBlocked.headers.get("retry-after")).toBe(unknownBlocked.headers.get("retry-after"));
    expect(await emailsTo(known)).toHaveLength(3);

    time.advance(HOUR);
    expect((await forgot(known)).status).toBe(202);
  });

  it("limits one client address to 10 an hour across emails", async () => {
    const headers = freshIp();
    for (let i = 0; i < 10; i++) {
      expect((await forgot(`someone-${i}@example.com`, headers)).status).toBe(202);
    }

    const blocked = await forgot("someone-else@example.com", headers);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });

  it("rejects an invalid email with 400", async () => {
    const res = await forgot("not-an-email");
    expect(res.status).toBe(400);
    expect(res.body.error.fields.email).toBeDefined();
  });
});

describe("POST /api/auth/reset-password", () => {
  it("sets the new password and signs this browser in", async () => {
    const { user, token } = await withResetLink();

    const res = await reset(token);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email });
    const fresh = sessionCookieOf(res);
    expect(fresh).toBeDefined();
    expect((await whoAmI(fresh!)).body.user.id).toBe(user.id);

    expect((await logIn(user.email, NEW_PASSWORD)).status).toBe(200);
    expect((await logIn(user.email, TEST_PASSWORD)).status).toBe(401);
  });

  it("logs out every session from before the reset", async () => {
    const { user, cookie } = await signedIn({ verified: true });
    await forgot(user.email);
    expect((await whoAmI(cookie)).status).toBe(200);

    expect((await reset(await resetTokenFor(user.email))).status).toBe(200);

    const after = await whoAmI(cookie);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe("UNAUTHENTICATED");
    const posts = await call(myPosts, { path: "/api/me/posts", headers: { cookie } });
    expect(posts.status).toBe(401);
  });

  it("works once", async () => {
    const { user, token } = await withResetLink();
    expect((await reset(token)).status).toBe(200);

    const again = await reset(token, "yet-another-password");

    expect(again.status).toBe(400);
    expect(again.body.error.message).toMatch(/expired or was already used/);
    expect((await logIn(user.email, NEW_PASSWORD)).status).toBe(200);
  });

  it("lets only one of two simultaneous uses through", async () => {
    const { token } = await withResetLink();

    const statuses = (await Promise.all([reset(token), reset(token)])).map((r) => r.status);

    expect(statuses.sort()).toEqual([200, 400]);
  });

  it("works until 1 hour has passed, then is rejected", async () => {
    const time = fakeClock();
    const early = await withResetLink();
    const late = await withResetLink();

    time.advance(HOUR - 1000);
    expect((await reset(early.token)).status).toBe(200);

    time.advance(1000);
    expect((await reset(late.token)).status).toBe(400);
    expect((await logIn(late.user.email, TEST_PASSWORD)).status).toBe(200);
  });

  it("only accepts the newest link sent to the user", async () => {
    const { user, token: first } = await withResetLink();
    await forgot(user.email);
    const second = await resetTokenFor(user.email);

    expect(second).not.toBe(first);
    expect((await reset(first)).status).toBe(400);
    expect((await reset(second)).status).toBe(200);
  });

  it("doesn't use up the link when the new password is rejected", async () => {
    const { user, token } = await withResetLink();

    const short = await reset(token, "short");
    expect(short.status).toBe(400);
    expect(short.body.error.fields.password).toEqual(["Use at least 8 characters."]);

    expect((await reset(token)).status).toBe(200);
    expect((await logIn(user.email, NEW_PASSWORD)).status).toBe(200);
  });

  it("doesn't accept an email verification link, nor a reset link for verifying", async () => {
    const { user, token } = await withResetLink();
    const unverified = await createUser();
    await call(resendRoute, {
      method: "POST",
      path: "/api/auth/resend-verification",
      headers: freshIp(),
      body: { email: unverified.email },
    });
    const verifyToken = await verificationTokenFor(unverified.email);

    const verifyWithReset = await call(verifyRoute, {
      method: "POST",
      path: "/api/auth/verify-email",
      body: { token },
    });
    expect(verifyWithReset.status).toBe(400);
    expect((await reset(verifyToken)).status).toBe(400);

    // Neither failed attempt used the links up.
    expect((await reset(token)).status).toBe(200);
    expect((await logIn(user.email, NEW_PASSWORD)).status).toBe(200);
  });

  it("rejects unknown and missing tokens with the shared error shape", async () => {
    const unknown = await reset("not-a-real-token");
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("VALIDATION_FAILED");

    const missing = await reset("");
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.token).toBeDefined();
  });
});
