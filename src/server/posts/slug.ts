// Slugs come from the title when a post is created and never change after,
// so shared links keep working when the title is edited.

const MAX_SLUG_LENGTH = 80;

/**
 * Turns a title into a URL-safe slug: lowercase letters and numbers (any
 * script) joined by hyphens, with Latin accents dropped ("Café" → "cafe").
 * Falls back to "post" when nothing usable is left.
 */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length === 0) return "post";
  if (slug.length <= MAX_SLUG_LENGTH) return slug;
  // Cut at a word boundary when there is one close enough.
  const cut = slug.slice(0, MAX_SLUG_LENGTH);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > MAX_SLUG_LENGTH / 2 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/, "");
}

/**
 * The first free slug among `base`, `base-2`, `base-3`, … given the slugs
 * already taken.
 */
export function firstFreeSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
