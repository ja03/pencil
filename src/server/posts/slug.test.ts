import { describe, expect, it } from "vitest";
import { firstFreeSlug, slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Notes toward an essay on walking", "notes-toward-an-essay-on-walking"],
    ["  Hello, World!  ", "hello-world"],
    ["React & Redux: a love story", "react-redux-a-love-story"],
    ["Café crème brûlée", "cafe-creme-brulee"],
    ["Top 10 tips", "top-10-tips"],
    ["snake_case and kebab-case", "snake-case-and-kebab-case"],
    ["مرحبا بالعالم", "مرحبا-بالعالم"],
    ["!!!", "post"],
    ["", "post"],
  ])("%j → %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("keeps long slugs to 80 characters, cut at a word boundary", () => {
    const slug = slugify("walking ".repeat(30));

    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(/^(walking-)*walking$/);
  });
});

describe("firstFreeSlug", () => {
  it("uses the base when it is free", () => {
    expect(firstFreeSlug("walking", ["walking-2", "running"])).toBe("walking");
  });

  it("adds -2 on the first collision", () => {
    expect(firstFreeSlug("walking", ["walking"])).toBe("walking-2");
  });

  it("counts up past every taken suffix", () => {
    expect(firstFreeSlug("walking", ["walking", "walking-2", "walking-3"])).toBe("walking-4");
  });

  it("fills a gap left by an earlier suffix", () => {
    expect(firstFreeSlug("walking", ["walking", "walking-3"])).toBe("walking-2");
  });

  it("isn't confused by slugs that only share a prefix", () => {
    expect(firstFreeSlug("walking", ["walking", "walking-tour", "walking-tour-2"])).toBe(
      "walking-2",
    );
  });
});
