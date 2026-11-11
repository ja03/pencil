// Shared by the settings page (server) and its section nav (client).

export const SETTINGS_TABS = [
  { tab: "account", label: "Account" },
  { tab: "security", label: "Password & sign-in" },
  { tab: "appearance", label: "Appearance" },
] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number]["tab"];

/** A `?tab=` value as a settings section. Anything unknown opens Account. */
export function parseSettingsTab(value: string | string[] | undefined): SettingsTab {
  return SETTINGS_TABS.find((t) => t.tab === value)?.tab ?? "account";
}

/** The address of a settings section. Account is the bare page. */
export function settingsPath(tab: SettingsTab): string {
  return tab === "account" ? "/settings" : `/settings?tab=${tab}`;
}
