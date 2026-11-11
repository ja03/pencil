import type { ReactNode } from "react";

type Tone = "mail" | "success" | "expired";

const ICON_STYLE: Record<Tone, string> = {
  mail: "bg-acc/15 text-acc",
  success: "bg-pub-bg text-ok",
  expired: "bg-err-bg text-err-ink",
};

function Icon({ tone }: { tone: Tone }) {
  switch (tone) {
    case "mail":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3.5 6.5 12 13l8.5-6.5" />
        </svg>
      );
    case "success":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      );
    case "expired":
      return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
  }
}

/** Shared look of the primary action on a message screen, link or button. */
export const PRIMARY_ACTION =
  "label-mono flex h-12 w-full cursor-pointer items-center justify-center rounded-full bg-btn text-xs tracking-[0.1em] text-on-btn no-underline transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60";

/** Shared look of the inline link or button in a message screen's footnote. */
export const SECONDARY_ACTION =
  "cursor-pointer bg-transparent p-0 text-sm font-medium text-acc underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-60";

/**
 * An auth screen that tells the user something rather than asking for input
 * (check your email, you're verified, this link expired), as drawn in the UI
 * Design: an icon, a heading, a paragraph, then the actions.
 */
export function AuthMessage({
  tone,
  title,
  children,
  actions,
  busy,
}: {
  tone: Tone;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
}) {
  return (
    <section aria-labelledby="auth-message-title" aria-busy={busy || undefined} className="flex flex-col gap-[22px]">
      <span
        aria-hidden="true"
        className={`flex size-16 items-center justify-center rounded-full ${ICON_STYLE[tone]}`}
      >
        <Icon tone={tone} />
      </span>
      <div className="flex flex-col gap-2.5">
        <h1
          id="auth-message-title"
          className="m-0 font-serif text-4xl leading-[1.05] font-normal tracking-tight sm:text-5xl"
        >
          {title}
        </h1>
        <div role="status" className="m-0 text-[15px] leading-[1.6] break-words text-mut">
          {children}
        </div>
      </div>
      {actions}
    </section>
  );
}
