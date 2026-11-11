"use client";

import { useState } from "react";
import { applyTheme, type Theme } from "@/client/theme";

/** Each option's thumbnail: a page colour, a heading line and two text lines. */
const OPTIONS: { theme: Theme; label: string; page: string; heading: string; text: string }[] = [
  { theme: "light", label: "Light", page: "#f4eee3", heading: "#2a1e16", text: "#d6c7b0" },
  { theme: "dark", label: "Dark", page: "#14100c", heading: "#f2e9da", text: "#3a2d23" },
  {
    theme: "system",
    label: "System",
    page: "linear-gradient(90deg, #f4eee3 50%, #14100c 50%)",
    heading: "#8a7a6a",
    text: "#8a7a6a",
  },
];

/**
 * Light, dark or system. Choosing one switches the page straight away and
 * stores it in the theme cookie for every later page load.
 */
export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <fieldset className="m-0 grid grid-cols-1 gap-3.5 border-0 p-0 sm:grid-cols-3">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((o) => {
        const on = o.theme === theme;
        return (
          <label
            key={o.theme}
            className={`flex cursor-pointer flex-col gap-3 rounded-2xl border bg-bg p-2.5 has-focus-visible:ring-2 has-focus-visible:ring-acc/40 ${on ? "border-acc ring-1 ring-acc" : "border-line"}`}
          >
            <span
              aria-hidden="true"
              className="relative block aspect-[16/10] overflow-hidden rounded-[10px]"
              style={{ background: o.page }}
            >
              <span className="absolute top-[18%] left-[12%] h-[9%] w-[46%] rounded" style={{ background: o.heading }} />
              <span className="absolute top-[34%] left-[12%] h-[6%] w-[70%] rounded" style={{ background: o.text }} />
              <span className="absolute top-[46%] left-[12%] h-[6%] w-[60%] rounded" style={{ background: o.text }} />
              <span className="absolute bottom-[14%] left-[12%] h-[16%] w-[30%] rounded-full bg-[#b0502a]" />
            </span>
            <span className="flex items-center justify-between px-1 pb-1">
              <span className="text-sm font-medium">{o.label}</span>
              <input
                type="radio"
                name="theme"
                value={o.theme}
                checked={on}
                onChange={() => choose(o.theme)}
                className="size-[18px] cursor-pointer accent-acc"
              />
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
