import { describe, expect, it } from "vitest";
import { hashToken, newToken } from "./token";

describe("newToken", () => {
  it("makes a URL-safe 256-bit token and its hash", () => {
    const { token, tokenHash } = newToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toBe(hashToken(token));
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => newToken().token));
    expect(tokens.size).toBe(100);
  });
});

describe("hashToken", () => {
  it("is a stable hex SHA-256 that doesn't contain the token", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hashToken("abc")).not.toContain("abc");
  });
});
