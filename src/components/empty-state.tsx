import Link from "next/link";

/**
 * The card shown where a list has nothing in it yet: a pencil sketch, a
 * title, a line of explanation and an optional next step.
 */
export function EmptyState({
  title,
  body,
  action,
  level = 3,
}: {
  title: string;
  body: string;
  action?: { href: string; label: string };
  /** The title's heading level, one below the section it sits in. */
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="motion-fade flex flex-col gap-3.5 rounded-[22px] border border-line bg-surf p-7 sm:max-w-[420px]">
      <div
        aria-hidden="true"
        className="flex h-[120px] items-center justify-center rounded-[14px] border border-dashed border-line bg-bg"
      >
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-acc">
          <rect x="14" y="12" width="36" height="48" rx="3" />
          <path d="M22 24h20M22 32h20M22 40h12" />
          <path d="M46 44 L60 30 L64 34 L50 48 Z" />
          <path d="M50 48 L44 50 L46 44" />
        </svg>
      </div>
      <Heading className="m-0 font-serif text-[26px] leading-[1.15] font-normal break-words">
        {title}
      </Heading>
      <p className="m-0 text-sm leading-[1.6] text-mut">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="label-mono flex h-11 items-center self-start rounded-full bg-btn px-[18px] tracking-[0.1em] text-on-btn no-underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
