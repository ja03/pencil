import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as resendRoute } from "@/app/api/auth/resend-verification/route";
import { POST as verifyRoute } from "@/app/api/auth/verify-email/route";
import { POST as commentRoute } from "@/app/api/posts/[id]/comments/route";
import { PUT as likeRoute } from "@/app/api/posts/[id]/like/route";
import { POST as publishRoute } from "@/app/api/posts/[id]/publish/route";
import { EMAIL_LINK_REPLY } from "@/contracts/auth";
import { db } from "@/server/db";
import { createUser, signedIn } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { emailsTo, verificationTokenFor } from "../helpers/mail";
import { draftBy, publishedBy, type Author } from "../helpers/posts";
import { call } from "../helpers/request";

const HOUR = 60 * 60 * 1000;

type Headers = Record<string, string>;

let ip = 0;
/** A different client address per call, so per-IP limits don't get in the way. */
const freshIp = () => ({ "x-forwarded-for": `203.0.113.${(ip = (ip + 1) % 250)}` });

/** Registers a new account through the API; returns its email and session headers. */
async function registerAccount() {
  const suffix = randomUUID().slice(0, 8);
  const email = `new-${suffix}@example.com`;
  const res = await call(register, {
    method: "POST",
    path: "/api/auth/register",
    headers: freshIp(),
    body: { username: `new_${suffix}`, email, password: "a-long-password" },
  });
  expect(res.status).toBe(201);
  const cookie = res.headers.getSetCookie()[0].split(";")[0];
  return { email, headers: { cookie } as Headers, id: res.body.user.id as string };
}

function verify(token: unknown, headers: Headers = {}) {
  return call(verifyRoute, {
    method: "POST",
    path: "/api/auth/verify-email",
    headers,
    body: { token },
  });
}

function resend(email: string, headers: Headers = freshIp()) {
  return call(resendRoute, {
    method: "POST",
    path: "/api/auth/resend-verification",
    headers,
    body: { email },
  });
}

const verifiedAt = async (id: string) =>
  (await db().user.findUniqueOrThrow({ where: { id } })).emailVerifiedAt;

describe("verification email on register", () => {
  it("sends a link to the new address that opens the confirm page", async () => {
    const { email } = await registerAccount();

    const [message] = await emailsTo(email);
    expect(message.Subject).toBe("Verify your email for Pencil");
    const token = await verificationTokenFor(email);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("stores only a hash of the token", async () => {
    const { email } = await registerAccount();
    const token = await verificationTokenFor(email);

    const rows = await db().emailToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toContain(token);
  });

  it("starts the account unverified", async () => {
    const { headers } = await registerAccount();

    const res = await call(me, { path: "/api/auth/me", headers });
    expect(res.body.user.emailVerified).toBe(false);
  });
});

describe("POST /api/auth/verify-email", () => {
  it("verifies the account and returns the signed-in user", async () => {
    const { email, headers, id } = await registerAccount();

    const res = await verify(await verificationTokenFor(email), headers);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id, emailVerified: true });
    expect(await verifiedAt(id)).toBeInstanceOf(Date);
    const after = await call(me, { path: "/api/auth/me", headers });
    expect(after.body.user.emailVerified).toBe(true);
  });

  it("works signed out, e.g. on another device", async () => {
    const { email, id } = await registerAccount();

    const res = await verify(await verificationTokenFor(email));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
    expect(await verifiedAt(id)).toBeInstanceOf(Date);
  });

  it("rejects a link that was already used", async () => {
    const { email } = await registerAccount();
    const token = await verificationTokenFor(email);
    expect((await verify(token)).status).toBe(200);

    const again = await verify(token);

    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("lets only one of two simultaneous uses through", async () => {
    const { email } = await registerAccount();
    const token = await verificationTokenFor(email);

    const statuses = (await Promise.all([verify(token), verify(token)])).map((r) => r.status);

    expect(statuses.sort()).toEqual([200, 400]);
  });

  it("accepts a link until 24 hours have passed, then rejects it", async () => {
    const time = fakeClock();
    const early = await registerAccount();
    const late = await registerAccount();
    const earlyToken = await verificationTokenFor(early.email);
    const lateToken = await verificationTokenFor(late.email);

    time.advance(24 * HOUR - 1000);
    expect((await verify(earlyToken)).status).toBe(200);

    time.advance(1000);
    const expired = await verify(lateToken);
    expect(expired.status).toBe(400);
    expect(await verifiedAt(late.id)).toBeNull();
  });

  it("rejects unknown and missing tokens with the shared error shape", async () => {
    const unknown = await verify("not-a-real-token");
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.message).toMatch(/expired or was already used/);

    const missing = await verify("");
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.token).toBeDefined();
  });
});

describe("POST /api/auth/resend-verification", () => {
  it("emails an unverified account a new link, and only the newest link works", async () => {
    const { email, id } = await registerAccount();
    const first = await verificationTokenFor(email);

    const res = await resend(email);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ message: EMAIL_LINK_REPLY });
    expect(await emailsTo(email)).toHaveLength(2);
    const second = await verificationTokenFor(email);
    expect(second).not.toBe(first);
    expect((await verify(first)).status).toBe(400);
    expect((await verify(second)).status).toBe(200);
    expect(await verifiedAt(id)).toBeInstanceOf(Date);
  });

  it("gives the same reply for unknown and already-verified emails, and sends nothing", async () => {
    const known = await registerAccount();
    const verified = await createUser({ verified: true });
    const unknown = `nobody-${randomUUID().slice(0, 8)}@example.com`;

    const replies = await Promise.all([resend(known.email), resend(verified.email), resend(unknown)]);

    for (const res of replies) {
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ message: EMAIL_LINK_REPLY });
    }
    expect(await emailsTo(verified.email)).toHaveLength(0);
    expect(await emailsTo(unknown)).toHaveLength(0);
    expect(await emailsTo(known.email)).toHaveLength(2);
  });

  it("allows 3 per hour per email, the same for known and unknown emails", async () => {
    const time = fakeClock();
    const known = (await registerAccount()).email;
    const unknown = `nobody-${randomUUID().slice(0, 8)}@example.com`;

    for (const email of [known, unknown]) {
      for (let i = 0; i < 3; i++) expect((await resend(email)).status).toBe(202);
    }
    const [knownBlocked, unknownBlocked] = await Promise.all([resend(known), resend(unknown)]);

    expect(knownBlocked.status).toBe(429);
    expect(knownBlocked.body).toEqual(unknownBlocked.body);
    expect(knownBlocked.headers.get("retry-after")).toBe(unknownBlocked.headers.get("retry-after"));
    // The register email plus three resends; the blocked one sent nothing.
    expect(await emailsTo(known)).toHaveLength(4);

    time.advance(HOUR);
    expect((await resend(known)).status).toBe(202);
  });

  it("limits one client address to 10 an hour across emails", async () => {
    const headers = freshIp();
    for (let i = 0; i < 10; i++) {
      expect((await resend(`someone-${i}@example.com`, headers)).status).toBe(202);
    }

    const blocked = await resend("someone-else@example.com", headers);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });

  it("rejects an invalid email with 400", async () => {
    const res = await resend("not-an-email");
    expect(res.status).toBe(400);
    expect(res.body.error.fields.email).toBeDefined();
  });
});

describe("after verifying", () => {
  it("lets the user publish, like and comment, which were 403 before", async () => {
    const account = await registerAccount();
    const author = await signedIn({ verified: true });
    const others = await publishedBy(author, "Someone else's essay");
    const draft = await draftBy({ headers: account.headers } as Author, "My first post");

    const attempt = () =>
      Promise.all([
        call(publishRoute, {
          method: "POST",
          path: `/api/posts/${draft.id}/publish`,
          headers: account.headers,
          params: { id: draft.id },
        }),
        call(likeRoute, {
          method: "PUT",
          path: `/api/posts/${others.id}/like`,
          headers: account.headers,
          params: { id: others.id },
        }),
        call(commentRoute, {
          method: "POST",
          path: `/api/posts/${others.id}/comments`,
          headers: { ...freshIp(), ...account.headers },
          body: { body: "Lovely piece." },
          params: { id: others.id },
        }),
      ]);

    expect((await attempt()).map((r) => r.status)).toEqual([403, 403, 403]);

    await verify(await verificationTokenFor(account.email));

    expect((await attempt()).map((r) => r.status)).toEqual([200, 200, 201]);
  });
});
