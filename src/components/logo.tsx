/** The Pencil mark: a nib on a diamond. Colors come from the surrounding text. */
export function Logo({ nib = "var(--acc)", cut = "var(--bg)" }: { nib?: string; cut?: string }) {
  return (
    <span className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2 20 12 12 22 4 12z" fill={nib} />
        <path d="M12 6.5v8" stroke={cut} strokeWidth="1.6" />
        <circle cx="12" cy="15.6" r="1.5" fill={cut} />
      </svg>
      <span className="font-serif text-2xl tracking-tight">Pencil</span>
    </span>
  );
}
