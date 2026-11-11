import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  /** Shown under the field until there is an error. */
  hint?: ReactNode;
  /** Marks the field invalid. Empty strings mark it without a message. */
  errors?: string[];
  /** Rendered before the input inside its border, e.g. "@". */
  prefix?: string;
  /** Rendered beside the label, e.g. a "Forgot password?" link. */
  aside?: ReactNode;
};

/** A labelled input with its hint or inline errors, as drawn in the UI Design. */
export function FormField({ id, label, hint, errors, prefix, aside, ...input }: Props) {
  const invalid = (errors?.length ?? 0) > 0;
  const error = errors?.find(Boolean);
  const describedBy = error ? `${id}-error` : hint && !invalid ? `${id}-hint` : undefined;
  const border = invalid ? "border-err-ink" : "border-line";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        {aside}
      </div>
      <div
        className={`flex h-12 items-center overflow-hidden rounded-xl border bg-surf focus-within:ring-2 focus-within:ring-acc/40 ${border}`}
      >
        {prefix && <span className="pr-1 pl-3.5 text-[15px] text-mut">{prefix}</span>}
        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none ${prefix ? "pr-3.5" : "px-3.5"}`}
          {...input}
        />
      </div>
      {error ? (
        <span id={`${id}-error`} className="text-xs text-err-ink">
          {error}
        </span>
      ) : (
        hint &&
        !invalid && (
          <span id={`${id}-hint`} className="text-xs leading-normal text-mut">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

export function SubmitButton({ children, pending }: { children: ReactNode; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="label-mono mt-1 h-12 cursor-pointer rounded-full bg-btn text-xs tracking-[0.1em] text-on-btn transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-xl bg-err-bg px-3.5 py-3 text-sm leading-normal text-err-ink">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="mt-px flex-none">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.5" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function AuthHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label-mono tracking-[0.1em] text-acc">{eyebrow}</span>
      <h1 className="m-0 font-serif text-4xl leading-[1.05] font-normal tracking-tight sm:text-5xl">
        {title}
      </h1>
    </div>
  );
}
