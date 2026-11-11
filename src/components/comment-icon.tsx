/** "1 comment", "3 comments". */
export function commentsLabel(count: number): string {
  return `${count} ${count === 1 ? "comment" : "comments"}`;
}

/** A speech bubble. */
export function CommentIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}
