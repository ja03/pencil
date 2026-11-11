import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { createUser, TEST_PASSWORD } from "../helpers/auth";
import { fakeClock } from "../helpers/clock";
import { call } from "../helpers/request";

const MINUTE = 60_000;
const EMAIL = "ada@example.com";

function loginFrom(ip: string, body: unknown) {
  return call(login, {
    method: "POST",
    path: "/api/auth/login",
    headers: { "x-forwarded-for": ip },
    body,
  });
}

function wrongPasswordFrom(ip: string, email = EMAIL) {
  return loginFrom(ip, { email, password: "not-the-password" });
}

let registered = 0;
function registerFrom(ip: string) {
  registered += 1;
  return call(register, {
    method: "POST",
    path: "/api/auth/register",
    headers: { "x-forwarded-for": ip },
    body: {
      username: `writer_${registered}`,
      email: `writer${registered}@example.com`,
      password: "analytical-engine",
    },
  });
}

async function times<T>(n: number, attempt: (i: number) => Promise<T>): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < n; i++) results.push(await attempt(i));
  return results;
}

function expectRateLimited(res: Awaited<ReturnType<typeof call>>) {
  expect(res.status).toBe(429);
  expect(res.body).toEqual({
    error: { code: "RATE_LIMITED", message: expect.any(String) },
  });
  expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
}

let time: ReturnType<typeof fakeClock>;

beforeEach(async () => {
  time = fakeClock();
  await createUser({ email: EMAIL });
});

describe("login rate limit per IP", () => {
  it("answers the 6th attempt within a minute from one IP with 429", async () => {
    const first5 = await times(5, () => wrongPasswordFrom("203.0.113.7"));
    expect(first5.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);

    const sixth = await wrongPasswordFrom("203.0.113.7");
    expectRateLimited(sixth);
    expect(Number(sixth.headers.get("retry-after"))).toBeLessThanOrEqual(60);
  });

  it("blocks even the right password once the limit is hit", async () => {
    await times(5, () => wrongPasswordFrom("203.0.113.7"));

    expectRateLimited(await loginFrom("203.0.113.7", { email: EMAIL, password: TEST_PASSWORD }));
  });

  it("counts invalid requests too", async () => {
    await times(5, () => loginFrom("203.0.113.7", { email: "not-an-email" }));

    expectRateLimited(await wrongPasswordFrom("203.0.113.7"));
  });

  it("lets the IP try again once the minute has passed", async () => {
    await times(5, () => wrongPasswordFrom("203.0.113.7"));
    time.advance(MINUTE - 1);
    expectRateLimited(await wrongPasswordFrom("203.0.113.7"));

    time.advance(1);
    const res = await loginFrom("203.0.113.7", { email: EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });

  it("doesn't slow down other IPs", async () => {
    await times(5, () => wrongPasswordFrom("203.0.113.7"));

    const res = await loginFrom("198.51.100.2", { email: EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });

  it("keys on the rightmost X-Forwarded-For entry, so spoofed entries don't help", async () => {
    await times(5, (i) => wrongPasswordFrom(`10.0.0.${i}, 203.0.113.7`));

    expectRateLimited(await wrongPasswordFrom("10.0.0.99, 203.0.113.7"));
  });
});

describe("login rate limit per email", () => {
  it("applies across IPs with a looser limit", async () => {
    // 10 attempts, each from a different IP, so no per-IP limit is reached.
    const first10 = await times(10, (i) => wrongPasswordFrom(`198.51.100.${i}`));
    expect(first10.every((r) => r.status === 401)).toBe(true);

    expectRateLimited(await wrongPasswordFrom("198.51.100.200"));
  });

  it("matches the email however it is capitalised", async () => {
    await times(10, (i) => wrongPasswordFrom(`198.51.100.${i}`, i % 2 ? EMAIL : "ADA@example.com"));

    expectRateLimited(await wrongPasswordFrom("198.51.100.200", "Ada@Example.com"));
  });

  it("doesn't block other accounts", async () => {
    await times(10, (i) => wrongPasswordFrom(`198.51.100.${i}`));
    const other = await createUser();

    const res = await loginFrom("198.51.100.200", {
      email: other.email,
      password: TEST_PASSWORD,
    });
    expect(res.status).toBe(200);
  });

  it("resets after 15 minutes", async () => {
    await times(10, (i) => wrongPasswordFrom(`198.51.100.${i}`));
    time.advance(15 * MINUTE - 1);
    expectRateLimited(await wrongPasswordFrom("198.51.100.200"));

    time.advance(1);
    const res = await loginFrom("198.51.100.201", { email: EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
  });
});

describe("register rate limit per IP", () => {
  it("answers the 11th sign-up within an hour from one IP with 429", async () => {
    const first10 = await times(10, () => registerFrom("203.0.113.7"));
    expect(first10.map((r) => r.status)).toEqual(Array(10).fill(201));

    expectRateLimited(await registerFrom("203.0.113.7"));
    expect((await registerFrom("198.51.100.2")).status).toBe(201);
  });

  it("lets the IP sign up again once the hour has passed", async () => {
    await times(10, () => registerFrom("203.0.113.7"));
    time.advance(60 * MINUTE - 1);
    expectRateLimited(await registerFrom("203.0.113.7"));

    time.advance(1);
    expect((await registerFrom("203.0.113.7")).status).toBe(201);
  });
});
