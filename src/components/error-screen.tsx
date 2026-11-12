import type { ReactNode } from "react";

const action =
  "label-mono inline-flex h-[46px] cursor-pointer items-center rounded-full px-5 tracking-[0.1em] no-underline";

/** The filled button on an error screen. */
export const primaryAction = `${action} border-0 bg-btn text-on-btn hover:opacity-85`;
/** The outlined button on an error screen. */
export const secondaryAction = `${action} border border-line bg-transparent text-ink hover:bg-soft`;

/**
 * The 404 and 500 pages from the UI Design: a big status code, a headline, a
 * line of explanation and what to do next. It has no hooks, so the error
 * boundaries (Client Components) and the not-found page (a Server Component)
 * can both render it.
 */
export function ErrorScreen({
  code,
  eyebrow,
  title,
  body,
  actions,
  reference,
}: {
  code: "404" | "500";
  eyebrow: string;
  title: string;
  body: string;
  /** The buttons; style them with `primaryAction` and `secondaryAction`. */
  actions: ReactNode;
  /** An id that matches the server's log entry, shown so readers can report it. */
  reference?: string;
}) {
  return (
    <main className="mx-auto box-border w-full max-w-[1280px] px-4 pt-4 pb-14 sm:px-10 sm:pt-6 sm:pb-24">
      <section className="relative flex flex-col items-center gap-[18px] overflow-hidden rounded-[20px] border border-line bg-surf px-5 pt-12 pb-9 text-center sm:rounded-[28px] sm:px-12 sm:pt-24 sm:pb-16">
        <span className="label-mono inline-flex items-center rounded-full border border-line px-3.5 py-[7px] tracking-[0.1em] text-mut">
          {eyebrow}
        </span>
        <p
          aria-hidden="true"
          className="m-0 font-serif text-[120px] leading-[0.85] tracking-[-0.05em] text-acc sm:text-[240px]"
        >
          {code}
        </p>
        <h1 className="m-0 max-w-[620px] font-serif text-[30px] leading-[1.1] font-normal tracking-[-0.01em] sm:text-[44px]">
          {title}
        </h1>
        <p className="m-0 max-w-[480px] text-base leading-[1.6] text-mut">{body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2.5">{actions}</div>
        {reference && (
          <p className="mt-2 mb-0 font-mono text-[11px] tracking-[0.06em] text-mut">
            Error reference: {reference}
          </p>
        )}
        <svg
          aria-hidden="true"
          viewBox="0 0 600 90"
          className="mt-6 w-full max-w-[560px] text-acc opacity-60"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        >
          <path d="M10 70 C80 40 120 80 190 55 S300 30 340 60" />
          <path d="M340 60 L380 28 L392 40 L352 72 Z" />
          <path d="M352 72 L338 80 L340 60" />
          <path d="M430 60 h20 M470 60 h20 M510 60 h20 M550 60 h20" />
        </svg>
      </section>
    </main>
  );
}

/** The 500 page's words, shared by the route and global error boundaries. */
export function serverErrorCopy(reference: string | undefined) {
  return {
    code: "500",
    eyebrow: "Something went wrong",
    title: "We smudged something on our side.",
    body: reference
      ? "It isn't you. Try again in a moment; if it keeps happening, the error reference below helps us find it."
      : "It isn't you. Try again in a moment.",
    reference,
  } as const;
}

/** The digest Next attaches to server errors, matching the server's log entry. */
export function errorReference(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) return undefined;
  return typeof error.digest === "string" && error.digest ? error.digest : undefined;
}
