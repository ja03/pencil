"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { apiErrorOf } from "@/client/api";
import { selectCurrentUser } from "@/client/auth-slice";
import { visibleThreads } from "@/client/comment-threads";
import {
  useCreateCommentMutation,
  useDeleteCommentMutation,
  useEditCommentMutation,
  useGetCommentsInfiniteQuery,
} from "@/client/comments-api";
import { longDate, timeAgo } from "@/client/format";
import { useAppSelector } from "@/client/store";
import {
  COMMENT_MAX_LENGTH,
  type Comment,
  type CommentsResponse,
  type CommentThread,
} from "@/contracts/comments";
import { profilePath } from "@/contracts/users";
import { EmptyState } from "./empty-state";
import { useToast } from "./toaster";

const PILL =
  "label-mono flex h-11 cursor-pointer items-center rounded-full px-5 tracking-[0.1em] no-underline";
const QUIET_BUTTON =
  "cursor-pointer border-none bg-transparent px-0 py-1.5 text-[13px] font-medium text-mut hover:text-ink";

/** Who may change a comment: its author edits and deletes; the post's author deletes. */
type Permissions = (comment: Comment) => { mayEdit: boolean; mayDelete: boolean };

/** What a comment reports back once the reader has changed it. */
type ChangeHandlers = {
  onEdited: (comment: Comment) => void;
  onDeleted: (id: string) => void;
};

/**
 * A post's comments: the first page arrives rendered from the server, older
 * pages load on "Load more", and what the reader posts, edits or deletes
 * shows at once. Visitors and unverified readers can read everything and
 * get a prompt when they try to join in.
 */
export function CommentsSection({
  postId,
  postAuthorId,
  initial,
  initialCount,
}: {
  postId: string;
  /** The post's author, who may delete any comment on it. */
  postAuthorId: string;
  /** The first page, rendered on the server. */
  initial: CommentsResponse;
  /** Comments and replies on the post when the page was rendered. */
  initialCount: number;
}) {
  const user = useAppSelector(selectCurrentUser);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [posted, setPosted] = useState<Comment[]>([]);
  const [edited, setEdited] = useState<Record<string, Comment>>({});
  const [deleted, setDeleted] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // Nothing is fetched until the reader asks for older comments.
  const [started, setStarted] = useState(false);
  const older = useGetCommentsInfiniteQuery(
    { postId, after: initial.nextCursor ?? "" },
    { skip: !started || !initial.nextCursor, initialPageParam: initial.nextCursor ?? "" },
  );
  const pages = [initial, ...(started ? (older.data?.pages ?? []) : [])];
  const threads = visibleThreads(pages, { posted, edited, deleted });
  // Only live comments can be deleted, and each was counted once.
  const count = Math.max(0, initialCount + posted.length - deleted.length);

  const permissions: Permissions = (comment) => {
    const mine = !!user && user.id === comment.author.id;
    return { mayEdit: mine, mayDelete: mine || (!!user && user.id === postAuthorId) };
  };
  const changes: ChangeHandlers = {
    onEdited: (comment) => setEdited((current) => ({ ...current, [comment.id]: comment })),
    onDeleted: (id) => {
      setDeleted((current) => (current.includes(id) ? current : [...current, id]));
      if (replyingTo === id) setReplyingTo(null);
    },
  };

  const failed = older.isError;
  const loading = started && older.isFetching;
  const hasMore = started ? older.hasNextPage || (!older.data && !failed) : !!initial.nextCursor;

  const loginHref = `/login?next=${encodeURIComponent(`${pathname}#comments`)}`;

  function loadMore() {
    if (!started) setStarted(true);
    else if (!older.data) void older.refetch();
    else void older.fetchNextPage();
  }

  function onPosted(comment: Comment) {
    setPosted((current) => [...current, comment]);
    if (comment.parentId) setReplyingTo(null);
  }

  /** Whether the reader may comment; if not, tells them how to. */
  function mayComment(): boolean {
    if (!user) {
      toast.info("Log in to join the conversation.", {
        key: "comment",
        action: { label: "Log in", onClick: () => router.push(loginHref) },
      });
      return false;
    }
    if (!user.emailVerified) {
      toast.info("Verify your email to comment.", { key: "comment" });
      return false;
    }
    return true;
  }

  function toggleReply(threadId: string) {
    if (replyingTo === threadId) setReplyingTo(null);
    else if (mayComment()) setReplyingTo(threadId);
  }

  return (
    <section
      id="comments"
      aria-labelledby="comments-title"
      className="flex w-full max-w-[760px] scroll-mt-24 flex-col gap-[22px]"
    >
      <h2
        id="comments-title"
        className="m-0 font-serif text-[26px] font-normal sm:text-[34px]"
      >
        Comments <span className="text-mut tabular-nums">{count}</span>
      </h2>

      {user?.emailVerified ? (
        <NewCommentForm
          postId={postId}
          label="Add a comment"
          placeholder="Say something kind and specific…"
          submitLabel="Post comment"
          onPosted={onPosted}
        />
      ) : (
        <JoinPrompt signedIn={!!user} loginHref={loginHref} />
      )}

      {threads.length === 0 ? (
        <EmptyState
          title="No comments yet"
          body="Start the conversation. Comments are plain text, up to 1,000 characters."
        />
      ) : (
        <ul aria-label="Comments" className="m-0 flex list-none flex-col p-0">
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              permissions={permissions}
              changes={changes}
              replying={replyingTo === thread.id}
              onToggleReply={() => toggleReply(thread.id)}
              replyForm={
                <NewCommentForm
                  postId={postId}
                  parentId={thread.id}
                  label={thread.deleted ? "Reply" : `Reply to @${thread.author.username}`}
                  placeholder="Write a reply…"
                  submitLabel="Reply"
                  autoFocus
                  onPosted={onPosted}
                  onCancel={() => setReplyingTo(null)}
                />
              }
            />
          ))}
        </ul>
      )}

      {(hasMore || failed) && (
        <div className="flex flex-col items-center gap-3">
          {failed && (
            <p role="status" className="label-mono m-0 text-center text-mut">
              Couldn&apos;t load more comments.
            </p>
          )}
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className={`${PILL} border border-line bg-transparent text-ink hover:bg-soft disabled:cursor-wait disabled:opacity-60`}
          >
            {loading ? "Loading comments…" : failed ? "Try again" : "Load more comments"}
          </button>
        </div>
      )}
    </section>
  );
}

/** What visitors and unverified readers see in place of the comment box. */
function JoinPrompt({ signedIn, loginHref }: { signedIn: boolean; loginHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surf p-4">
      <p className="m-0 text-[15px] leading-[1.5]">
        {signedIn
          ? "Verify your email to join the conversation."
          : "Log in to join the conversation."}
      </p>
      {!signedIn && (
        <div className="flex items-center gap-4">
          <Link href="/register" className="text-sm font-semibold text-ink">
            Create an account
          </Link>
          <Link href={loginHref} className={`${PILL} bg-btn text-on-btn`}>
            Log in
          </Link>
        </div>
      )}
    </div>
  );
}

function ThreadItem({
  thread,
  permissions,
  changes,
  replying,
  onToggleReply,
  replyForm,
}: {
  thread: CommentThread;
  permissions: Permissions;
  changes: ChangeHandlers;
  replying: boolean;
  onToggleReply: () => void;
  replyForm: ReactNode;
}) {
  const nested = "ml-6 border-l border-line pl-4 sm:ml-12";
  return (
    <li className="motion-rise flex flex-col gap-3.5 border-t border-line py-5">
      {thread.deleted ? (
        <DeletedCommentView />
      ) : (
        <CommentView comment={thread} {...permissions(thread)} {...changes}>
          <button
            type="button"
            onClick={onToggleReply}
            aria-expanded={replying}
            className={QUIET_BUTTON}
          >
            Reply
          </button>
        </CommentView>
      )}
      {thread.replies.length > 0 && (
        <ul
          aria-label={
            thread.deleted ? "Replies to a deleted comment" : `Replies to @${thread.author.username}`
          }
          className="m-0 flex list-none flex-col gap-4 p-0"
        >
          {thread.replies.map((reply) => (
            <li key={reply.id} className={`motion-rise ${nested}`}>
              <CommentView comment={reply} small {...permissions(reply)} {...changes} />
            </li>
          ))}
        </ul>
      )}
      {replying && !thread.deleted && <div className={`motion-fade ${nested}`}>{replyForm}</div>}
    </li>
  );
}

function Avatar({ letter, small = false }: { letter: string; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full bg-soft font-serif ${small ? "size-[30px] text-sm" : "size-9 text-base"}`}
    >
      {letter}
    </span>
  );
}

/** What is left of a deleted comment whose replies are still there. */
function DeletedCommentView() {
  return (
    <article className="flex items-center gap-3">
      <Avatar letter="" />
      <p className="m-0 text-[15px] text-mut italic">[comment deleted]</p>
    </article>
  );
}

/**
 * One comment: avatar, author, when, and the text as written, marked when
 * it was edited. Its author can edit it in place; its author and the post's
 * author can delete it, after a confirmation.
 */
function CommentView({
  comment,
  small = false,
  mayEdit,
  mayDelete,
  onEdited,
  onDeleted,
  children,
}: {
  comment: Comment;
  small?: boolean;
  mayEdit: boolean;
  mayDelete: boolean;
  /** Actions that come before Edit and Delete, such as Reply. */
  children?: ReactNode;
} & ChangeHandlers) {
  const toast = useToast();
  const [editComment] = useEditCommentMutation();
  const [deleteComment, { isLoading: deleting }] = useDeleteCommentMutation();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function confirmDelete() {
    try {
      await deleteComment(comment.id).unwrap();
      toast.success("Comment deleted.", { key: "comment" });
      onDeleted(comment.id);
    } catch (failure) {
      const apiError = apiErrorOf(failure);
      if (apiError?.code === "NOT_FOUND") {
        // Already gone, e.g. deleted in another tab.
        toast.success("That comment was already deleted.", { key: "comment" });
        onDeleted(comment.id);
      } else {
        toast.error(apiError?.message ?? "Couldn't delete the comment. Please try again.", {
          key: "comment",
        });
        setConfirming(false);
      }
    }
  }

  const actions = confirming ? (
    <div role="group" aria-label="Delete this comment?" className="motion-fade flex flex-wrap items-center gap-4">
      <span className="text-[13px] text-ink">Delete this comment?</span>
      <button
        type="button"
        onClick={confirmDelete}
        disabled={deleting}
        className={`${QUIET_BUTTON} font-semibold text-err-ink hover:text-err-ink disabled:cursor-wait disabled:opacity-60`}
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={deleting}
        className={QUIET_BUTTON}
      >
        Cancel
      </button>
    </div>
  ) : (
    (children || mayEdit || mayDelete) && (
      <div className="flex gap-4">
        {children}
        {mayEdit && (
          <button type="button" onClick={() => setEditing(true)} className={QUIET_BUTTON}>
            Edit
          </button>
        )}
        {mayDelete && (
          <button type="button" onClick={() => setConfirming(true)} className={QUIET_BUTTON}>
            Delete
          </button>
        )}
      </div>
    )
  );

  return (
    <article className="flex gap-3">
      <Avatar letter={comment.author.username.charAt(0).toUpperCase()} small={small} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[13px]">
          <Link
            href={profilePath(comment.author.username)}
            className="font-semibold text-ink no-underline hover:underline"
          >
            @{comment.author.username}
          </Link>
          <time
            dateTime={comment.createdAt}
            title={longDate(comment.createdAt)}
            className="text-mut"
            // Relative times can tick over between the server render and hydration.
            suppressHydrationWarning
          >
            {timeAgo(comment.createdAt)}
          </time>
          {comment.editedAt && (
            <time
              dateTime={comment.editedAt}
              title={`Edited ${longDate(comment.editedAt)}`}
              className="text-mut"
            >
              edited
            </time>
          )}
        </p>
        {editing ? (
          <CommentForm
            label="Edit your comment"
            placeholder="Say something kind and specific…"
            submitLabel="Save"
            savingLabel="Saving…"
            initialBody={comment.body}
            autoFocus
            save={async (body) => (await editComment({ id: comment.id, body }).unwrap()).comment}
            onSaved={(saved) => {
              setEditing(false);
              onEdited(saved);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <p className="m-0 text-[15px] leading-[1.6] break-words whitespace-pre-wrap">
              {comment.body}
            </p>
            {actions}
          </>
        )}
      </div>
    </article>
  );
}

/** The box for a new comment or a reply, posted through the API. */
function NewCommentForm({
  postId,
  parentId = null,
  onPosted,
  ...rest
}: {
  postId: string;
  parentId?: string | null;
  label: string;
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onPosted: (comment: Comment) => void;
  onCancel?: () => void;
}) {
  const [create] = useCreateCommentMutation();
  return (
    <CommentForm
      {...rest}
      savingLabel="Posting…"
      clearOnSave
      save={async (body) => (await create({ postId, body, parentId }).unwrap()).comment}
      onSaved={onPosted}
    />
  );
}

/**
 * The box for writing a comment: a new one, a reply, or new text for an
 * existing one. Cmd/Ctrl+Enter saves it.
 */
function CommentForm({
  label,
  placeholder,
  submitLabel,
  savingLabel,
  initialBody = "",
  clearOnSave = false,
  autoFocus = false,
  save,
  onSaved,
  onCancel,
}: {
  label: string;
  placeholder: string;
  submitLabel: string;
  savingLabel: string;
  initialBody?: string;
  /** Empty the box after saving, ready for the next comment. */
  clearOnSave?: boolean;
  autoFocus?: boolean;
  save: (body: string) => Promise<Comment>;
  onSaved: (comment: Comment) => void;
  onCancel?: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const [isLoading, setLoading] = useState(false);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);

  // The server trims, so the trimmed text is what counts against the limit.
  const length = body.trim().length;
  const tooLong = length > COMMENT_MAX_LENGTH;
  const canSend = length > 0 && !tooLong && !isLoading;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    setError(null);
    setLoading(true);
    try {
      const comment = await save(body);
      if (clearOnSave) setBody("");
      onSaved(comment);
    } catch (failure) {
      const apiError = apiErrorOf(failure);
      const fieldError = apiError?.fields?.body?.[0] ?? apiError?.fields?.parentId?.[0];
      if (fieldError) setError(fieldError);
      else {
        toast.error(apiError?.message ?? "Couldn't save your comment. Please try again.", {
          key: "comment",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surf p-4"
    >
      <label htmlFor={`${id}-body`} className="label-mono text-mut">
        {label}
      </label>
      <textarea
        id={`${id}-body`}
        rows={3}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          setError(null);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-invalid={tooLong || !!error}
        aria-describedby={`${id}-count${error ? ` ${id}-error` : ""}`}
        className="min-h-[72px] resize-y border-none bg-transparent font-sans text-[15px] leading-[1.6] text-ink outline-none placeholder:text-mut"
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="m-0 text-[13px] text-err-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span
          id={`${id}-count`}
          className={`text-xs tabular-nums ${tooLong ? "font-semibold text-err-ink" : "text-mut"}`}
        >
          {length} / {COMMENT_MAX_LENGTH}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={`${PILL} border border-line bg-transparent text-ink hover:bg-soft`}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSend}
            className={`${PILL} border-none bg-btn text-on-btn disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isLoading ? savingLabel : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
