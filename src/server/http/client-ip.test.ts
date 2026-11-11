import { describe, expect, it } from "vitest";
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
