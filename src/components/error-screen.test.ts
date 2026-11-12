import { describe, expect, it } from "vitest";
import { errorReference, serverErrorCopy } from "./error-screen";

describe("errorReference", () => {
  it("reads the digest Next attaches to server errors", () => {
    expect(errorReference(Object.assign(new Error("x"), { digest: "7f3a91c2" }))).toBe("7f3a91c2");
  });

  it("is undefined for errors without one", () => {
    expect(errorReference(new Error("x"))).toBeUndefined();
    expect(errorReference(Object.assign(new Error("x"), { digest: "" }))).toBeUndefined();
    expect(errorReference("boom")).toBeUndefined();
    expect(errorReference(null)).toBeUndefined();
  });
});

describe("serverErrorCopy", () => {
  it("mentions the reference only when there is one", () => {
    expect(serverErrorCopy("abc").body).toContain("error reference");
    expect(serverErrorCopy(undefined).body).not.toContain("reference");
  });
});
