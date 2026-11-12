import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, UNKNOWN_CLIENT_IP } from "./client-ip";

function headers(xForwardedFor?: string): Headers {
  return new Headers(xForwardedFor === undefined ? {} : { "x-forwarded-for": xForwardedFor });
}

describe("clientIp", () => {
  it("reads a single X-Forwarded-For entry", () => {
    expect(clientIp(headers("203.0.113.7"))).toBe("203.0.113.7");
  });

  it("takes the rightmost entry, the one Render's proxy appended", () => {
    expect(clientIp(headers("10.0.0.1, 198.51.100.2, 203.0.113.7"))).toBe("203.0.113.7");
  });

  it("ignores entries a client prepends to spoof its address", () => {
    expect(clientIp(headers("1.2.3.4, 203.0.113.7"))).toBe(
      clientIp(headers("5.6.7.8, 203.0.113.7")),
    );
  });

  it("trims whitespace around the entry", () => {
    expect(clientIp(headers("1.2.3.4,   203.0.113.7  "))).toBe("203.0.113.7");
  });

  it("keeps IPv6 addresses intact", () => {
    expect(clientIp(headers("2001:db8::1"))).toBe("2001:db8::1");
  });

  it("falls back to one shared key when the header is missing", () => {
    expect(clientIp(headers())).toBe(UNKNOWN_CLIENT_IP);
  });

  it("falls back when the rightmost entry is empty", () => {
    expect(clientIp(headers("203.0.113.7, "))).toBe(UNKNOWN_CLIENT_IP);
    expect(clientIp(headers(""))).toBe(UNKNOWN_CLIENT_IP);
  });
});

describe("the one-time X-Forwarded-For log", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  // A fresh copy of the module, so each test starts with nothing logged yet.
  async function freshClientIp() {
    return (await import("./client-ip")).clientIp;
  }

  it("logs the raw header and the chosen address once in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const ip = await freshClientIp();

    ip(headers("1.2.3.4, 203.0.113.7"));
    ip(headers("198.51.100.2"));

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.join(" ")).toContain('"1.2.3.4, 203.0.113.7"');
    expect(info.mock.calls[0]?.join(" ")).toContain("203.0.113.7");
  });

  it("logs a missing header too, since that breaks the assumption", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    (await freshClientIp())(headers());

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]?.join(" ")).toContain(UNKNOWN_CLIENT_IP);
  });

  it("stays quiet outside production", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    (await freshClientIp())(headers("203.0.113.7"));

    expect(info).not.toHaveBeenCalled();
  });
});
