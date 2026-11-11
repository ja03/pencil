import { describe, expect, it } from "vitest";
import { parseSettingsTab, settingsPath } from "./settings-tabs";

describe("parseSettingsTab", () => {
  it.each(["account", "security", "appearance"] as const)("opens %s", (tab) => {
    expect(parseSettingsTab(tab)).toBe(tab);
  });

  it.each([undefined, "", "billing", ["security", "appearance"]])("opens account for %j", (value) => {
    expect(parseSettingsTab(value)).toBe("account");
  });
});

describe("settingsPath", () => {
  it("keeps Account at the bare page and puts the others in ?tab=", () => {
    expect(settingsPath("account")).toBe("/settings");
    expect(settingsPath("appearance")).toBe("/settings?tab=appearance");
  });
});
