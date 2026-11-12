import { describe, expect, it } from "vitest";
import { USERNAME_PATTERN } from "@/contracts/auth";
import { usernameBase, usernameCandidate, usernameCandidates } from "./google-username";

describe("usernameBase", () => {
  it.each([
    ["ada@example.com", "ada"],
    ["Ada.Lovelace+blog@example.com", "ada_lovelace_blog"],
    ["..ada--@example.com", "ada"],
    ["x@example.com", "x_user"],
    ["@example.com", "user"],
    ["a.very.long.local.part.indeed@example.com", "a_very_long_local_pa"],
  ])("%s → %s", (email, expected) => {
    const base = usernameBase(email);
    expect(base).toBe(expected);
    expect(base).toMatch(USERNAME_PATTERN);
  });
});

describe("usernameCandidate", () => {
  it("tries the base first, then numbered versions that still fit", () => {
    expect(usernameCandidate("ada", 1)).toBe("ada");
    expect(usernameCandidate("ada", 2)).toBe("ada2");
    expect(usernameCandidate("a_very_long_local_pa", 2)).toBe("a_very_long_local_p2");
    expect(usernameCandidate("a_very_long_local_pa", 10)).toBe("a_very_long_local_10");
  });

  it("lists candidates in order", () => {
    expect(usernameCandidates("ada", 1, 3)).toEqual(["ada", "ada2", "ada3"]);
  });
});
