import { coverGradientFor } from "@/client/cover";

/**
 * A post's cover image, or its generated gradient with the title's first
 * letter when it has none. Fills its parent, which sets size and rounding.
 */
export function PostCover({
  post,
  glyphClassName,
}: {
  post: { id: string; title: string; coverUrl: string | null };
  /** Size of the letter on a generated cover. */
  glyphClassName: string;
}) {
  if (post.coverUrl) {
    return (
      // Covers come from Pencil's own storage at any size; a plain img keeps
      // them out of the image optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.coverUrl} alt="" className="absolute inset-0 size-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden"
      style={{ background: coverGradientFor(post.id) }}
    >
      <span
        className={`absolute right-[4%] bottom-[-0.18em] font-serif leading-none text-[rgba(251,244,232,0.28)] ${glyphClassName}`}
      >
        {post.title.charAt(0).toUpperCase()}
      </span>
    </span>
  );
}
