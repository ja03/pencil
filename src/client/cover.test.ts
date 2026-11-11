import { describe, expect, it } from "vitest";
import { COVER_GRADIENTS, coverGradientFor } from "./cover";

describe("coverGradientFor", () => {
  it("always gives the same post the same gradient", () => {
    const id = "01936f0e-1234-7000-8000-00000000abcd";

    expect(coverGradientFor(id)).toBe(coverGradientFor(id));
  });

  it("returns one of the designed gradients", () => {
    expect(COVER_GRADIENTS).toContain(coverGradientFor("anything"));
  });

  it("spreads posts across the gradients", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `01936f0e-1234-7000-8000-${String(i).padStart(12, "0")}`);

    const used = new Set(ids.map(coverGradientFor));

    expect(used.size).toBe(COVER_GRADIENTS.length);
  });
});
