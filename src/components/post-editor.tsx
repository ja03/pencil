"use client";

import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { apiErrorOf } from "@/client/api";
import { selectCurrentUser } from "@/client/auth-slice";
import {
  useCreatePostMutation,
  usePublishPostMutation,
  useUpdatePostMutation,
} from "@/client/posts-api";
import { useAppSelector } from "@/client/store";
import type { UploadError } from "@/client/upload-image";
import { useLeaveGuard } from "@/client/use-leave-guard";
import type { FieldErrors } from "@/contracts/api-error";
import { isAllowedLinkHref } from "@/contracts/post-content";
import { DESCRIPTION_MAX_LENGTH, postInputs, TITLE_MAX_LENGTH, type Post } from "@/contracts/posts";
import { IMAGE_TYPES } from "@/contracts/uploads";
import { CoverField } from "./cover-field";
import { ImageUploads, insertUploadedImage, type ImageUploadHandlers } from "./image-uploads";
import { TagInput } from "./tag-input";
import { useToast } from "./toaster";
import { VerifyBanner } from "./verify-banner";

const label = "label-mono text-[10px] tracking-[0.1em] text-mut";
const button =
  "label-mono h-11 cursor-pointer rounded-full px-[18px] tracking-[0.1em] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60";

/** Each save's toast replaces the previous save's, so a stale error doesn't linger. */
const SAVE_TOAST = { key: "post-save" };

const VERIFY_TO_PUBLISH = "Verify your email to publish. You can keep writing drafts until then.";

/**
 * The post editor: title, description and rich content, saved as a draft
 * through the REST API and published when ready. Pencil doesn't autosave, so
 * it warns before leaving with unsaved changes and reports every save,
 * publish or failure with a toast. Images (cover and inline) upload as soon
 * as they're picked; the post stores their addresses when it's saved.
 */
export function PostEditor({
  initial,
  initialTags = [],
  imageBase,
}: {
  initial: Post | null;
  /** Tags for a new post, such as the one a tag page's "Write with this tag" passes. */
  initialTags?: string[];
  /** Public address of Pencil's storage; post images must sit under it. */
  imageBase: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const verified = useAppSelector(selectCurrentUser)?.emailVerified ?? false;
  const [createPost] = useCreatePostMutation();
  const [updatePost] = useUpdatePostMutation();
  const [publishPost] = usePublishPostMutation();

  const [postId, setPostId] = useState(initial?.id ?? null);
  const published = initial?.status === "published";
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tags, setTags] = useState(initial?.tags ?? initialTags);
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? null);
  // Inline images still uploading; they join the content when they finish.
  const [uploads, setUploads] = useState(0);
  const [fields, setFields] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  // Every edit bumps `version`; a save records the version it sent, so edits
  // made while a save is in flight still count as unsaved.
  const [version, setVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const dirty = version !== savedVersion;
  const changed = useCallback(() => setVersion((v) => v + 1), []);
  // The server's own rules, so an image from another site is caught before saving.
  const { createPostInput } = useMemo(() => postInputs({ imageBase }), [imageBase]);

  // The editor is created once, so these must never change: they use only a
  // state setter and the toast API, both stable.
  const [uploadHandlers] = useState<ImageUploadHandlers>(() => ({
    onBusyChange: (delta) => setUploads((n) => n + delta),
    onError: (error: UploadError) => toast.error(error.message, { key: "image-upload" }),
  }));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        strike: false,
        underline: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["mailto"],
          isAllowedUri: (url) => isAllowedLinkHref(url),
        },
      }),
      Image,
      ImageUploads.configure({ imageBase, handlers: uploadHandlers }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: initial?.content ?? "",
    editorProps: {
      attributes: {
        class: "post-prose",
        "aria-label": "Post content",
        "aria-multiline": "true",
        role: "textbox",
      },
    },
    onUpdate: changed,
  });

  // The latest `save`, for a toast's Retry button created by an earlier render.
  const saveRef = useRef<() => Promise<Post | null>>(async () => null);

  /** Saves the post; resolves to the saved post, or null when it wasn't saved. */
  const save = useCallback(async (): Promise<Post | null> => {
    if (!editor || saving) return null;
    const body = { title, description, tags, coverUrl, content: editor.getJSON() };
    // Same schema the API validates with, so most mistakes show before a round trip.
    const parsed = createPostInput.safeParse(body);
    if (!parsed.success) {
      setFields(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      toast.error("Fix the highlighted fields, then save again.", SAVE_TOAST);
      return null;
    }
    setFields({});
    setSaving(true);
    const sentVersion = version;
    try {
      const { post } = postId
        ? await updatePost({ id: postId, ...body }).unwrap()
        : await createPost(body).unwrap();
      if (!postId) {
        setPostId(post.id);
        // Stay mounted (cursor and undo history intact); just give the draft its URL.
        window.history.replaceState(null, "", `/write/${post.id}`);
      }
      setSavedVersion(sentVersion);
      toast.success(post.status === "published" ? "Changes saved." : "Draft saved.", SAVE_TOAST);
      return post;
    } catch (error) {
      const apiError = apiErrorOf(error);
      if (apiError?.fields) setFields(apiError.fields);
      if (apiError?.code === "UNAUTHENTICATED") {
        toast.error("Your session has expired. Log in in another tab, then save again.", SAVE_TOAST);
      } else if (apiError) {
        toast.error(apiError.message, SAVE_TOAST);
      } else {
        toast.error("Couldn't save your draft. Check your connection.", {
          ...SAVE_TOAST,
          action: { label: "Retry", onClick: () => void saveRef.current() },
        });
      }
      return null;
    } finally {
      setSaving(false);
    }
  }, [
    editor,
    saving,
    title,
    description,
    tags,
    coverUrl,
    createPostInput,
    version,
    postId,
    updatePost,
    createPost,
    toast,
  ]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Cmd/Ctrl+S saves instead of opening the browser's "Save page" dialog.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  /** Saves any unsaved changes, then publishes and opens the post. */
  async function publish() {
    if (!verified) {
      toast.error(VERIFY_TO_PUBLISH, SAVE_TOAST);
      return;
    }
    if (saving || publishing) return;
    let id = postId;
    if (dirty || !id) {
      id = (await save())?.id ?? null;
      if (!id) return;
    }
    setPublishing(true);
    try {
      const { post } = await publishPost(id).unwrap();
      toast.success("Published. It's in the feed now.", SAVE_TOAST);
      router.push(`/posts/${post.slug}`);
    } catch (error) {
      const apiError = apiErrorOf(error);
      toast.error(apiError?.message ?? "Couldn't publish. Check your connection.", SAVE_TOAST);
      setPublishing(false);
    }
  }

  const { pendingHref, stay } = useLeaveGuard(dirty);

  const status = publishing
    ? "Publishing…"
    : saving
    ? "Saving…"
    : uploads > 0
    ? "Uploading image…"
    : dirty
      ? "Unsaved changes"
      : postId
        ? "All changes saved"
        : "Not saved yet";

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      {!published && <VerifyBanner message={VERIFY_TO_PUBLISH} />}
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surf px-3 py-2.5 sm:px-8 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Back to Pencil"
            className="flex size-11 flex-none items-center justify-center rounded-full border border-line text-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </Link>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={label}>{published ? "Published" : "Draft"}</span>
            <span role="status" className="flex items-center gap-1.5 text-[13px]">
              {dirty && !saving && (
                <span aria-hidden="true" className="size-[7px] rounded-full bg-dot" />
              )}
              {status}
            </span>
          </div>
        </div>
        {published ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !editor}
            className={`${button} bg-btn text-on-btn`}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || publishing || !editor}
              className={`${button} border border-line bg-transparent text-ink`}
            >
              {saving && !publishing ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => void publish()}
              disabled={saving || publishing || !editor}
              // Not `disabled` when unverified: it stays focusable and says why on click.
              aria-disabled={!verified || undefined}
              className={`${button} ${verified ? "bg-btn text-on-btn" : "cursor-not-allowed bg-line text-mut"}`}
            >
              {publishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto box-border flex w-full max-w-[820px] flex-col gap-[26px] px-4 pt-6 pb-16 sm:px-8 sm:pt-12 sm:pb-24">
        <CoverField
          postId={postId}
          coverUrl={coverUrl}
          onChange={(url) => {
            setCoverUrl(url);
            changed();
          }}
          onError={uploadHandlers.onError}
          errors={fields.coverUrl}
        />

        <Field id="title" label="Title" count={title.length} max={TITLE_MAX_LENGTH} errors={fields.title}>
          <input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              changed();
            }}
            placeholder="Give it a title"
            maxLength={TITLE_MAX_LENGTH}
            aria-invalid={fields.title ? true : undefined}
            aria-describedby={fields.title ? "title-error" : undefined}
            className={`w-full border-b bg-transparent pt-1.5 pb-3 font-serif text-[32px] leading-[1.1] text-ink outline-none placeholder:text-mut/60 sm:text-5xl ${fields.title ? "border-err-ink" : "border-line focus:border-acc"}`}
          />
        </Field>

        <Field
          id="description"
          label="Description"
          hint="(optional)"
          count={description.length}
          max={DESCRIPTION_MAX_LENGTH}
          errors={fields.description}
        >
          <textarea
            id="description"
            rows={2}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              changed();
            }}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="A line or two for cards and link previews. Left empty, the start of your post is used."
            aria-invalid={fields.description ? true : undefined}
            aria-describedby={fields.description ? "description-error" : undefined}
            className={`resize-y rounded-xl border bg-surf px-3.5 py-3 text-[15px] leading-[1.55] text-ink outline-none placeholder:text-mut focus:ring-2 focus:ring-acc/40 ${fields.description ? "border-err-ink" : "border-line"}`}
          />
        </Field>

        <TagInput
          tags={tags}
          onChange={(next) => {
            setTags(next);
            changed();
          }}
          errors={fields.tags}
        />

        <div className="flex flex-col gap-1.5">
          <div
            className={`mt-1 flex flex-col overflow-hidden rounded-[18px] border bg-surf focus-within:ring-2 focus-within:ring-acc/40 ${fields.content ? "border-err-ink" : "border-line"}`}
          >
            <Toolbar
              editor={editor}
              onInsertImage={(file) =>
                editor &&
                void insertUploadedImage(
                  editor,
                  file,
                  editor.state.selection.from,
                  uploadHandlers,
                )
              }
            />
            <div className="px-[18px] py-[18px] sm:px-9 sm:py-7">
              <EditorContent editor={editor} />
            </div>
          </div>
          {fields.content?.[0] && (
            <span id="content-error" role="alert" className="text-xs text-err-ink">
              {fields.content[0]}
            </span>
          )}
        </div>
      </main>

      <LeaveDialog
        open={pendingHref !== null}
        saving={saving}
        onStay={stay}
        onLeave={() => {
          const href = pendingHref!;
          stay();
          router.push(href);
        }}
        onSave={async () => {
          const href = pendingHref!;
          if (await save()) {
            stay();
            router.push(href);
          }
        }}
      />
    </div>
  );
}

function Field({
  id,
  label: text,
  hint,
  count,
  max,
  errors,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  count: number;
  max: number;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={label}>
        {text} {hint && <span className="tracking-normal normal-case">{hint}</span>}
      </label>
      {children}
      <div className="flex justify-between gap-3 text-xs">
        <span id={`${id}-error`} className="text-err-ink">
          {errors?.[0]}
        </span>
        <span className="flex-none text-mut" aria-hidden="true">
          {count} / {max}
        </span>
      </div>
    </div>
  );
}

type Tool = {
  glyph: string;
  label: string;
  className: string;
  isActive: (e: Editor) => boolean;
  run: (e: Editor) => void;
};

const TOOLS: Tool[] = [
  { glyph: "B", label: "Bold", className: "text-[15px] font-bold", isActive: (e) => e.isActive("bold"), run: (e) => e.chain().focus().toggleBold().run() },
  { glyph: "I", label: "Italic", className: "font-serif text-base italic", isActive: (e) => e.isActive("italic"), run: (e) => e.chain().focus().toggleItalic().run() },
  { glyph: "H2", label: "Heading 2", className: "text-[13px] font-semibold", isActive: (e) => e.isActive("heading", { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { glyph: "H3", label: "Heading 3", className: "text-[13px] font-semibold", isActive: (e) => e.isActive("heading", { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { glyph: "•", label: "Bulleted list", className: "text-lg font-semibold", isActive: (e) => e.isActive("bulletList"), run: (e) => e.chain().focus().toggleBulletList().run() },
  { glyph: "1.", label: "Numbered list", className: "text-[13px] font-semibold", isActive: (e) => e.isActive("orderedList"), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { glyph: "“", label: "Quote", className: "font-serif text-[22px]", isActive: (e) => e.isActive("blockquote"), run: (e) => e.chain().focus().toggleBlockquote().run() },
  { glyph: "</>", label: "Code block", className: "font-mono text-xs font-medium", isActive: (e) => e.isActive("codeBlock"), run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { glyph: "Link", label: "Link", className: "text-[13px] font-medium", isActive: (e) => e.isActive("link"), run: toggleLink },
];

function toggleLink(editor: Editor) {
  if (editor.isActive("link")) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  const input = window.prompt("Link address", "https://")?.trim();
  if (!input || input === "https://") return;
  const href = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`;
  if (!isAllowedLinkHref(href)) {
    window.alert("Links must start with http://, https:// or mailto:.");
    return;
  }
  const chain = editor.chain().focus().extendMarkRange("link");
  if (editor.state.selection.empty) {
    chain.insertContent({ type: "text", text: input, marks: [{ type: "link", attrs: { href } }] }).run();
  } else {
    chain.setLink({ href }).run();
  }
}

const toolClass =
  "h-10 min-w-10 flex-none cursor-pointer rounded-[10px] px-2 text-ink hover:bg-soft disabled:cursor-default disabled:opacity-50";

function Toolbar({
  editor,
  onInsertImage,
}: {
  editor: Editor | null;
  /** Uploads the picked file and inserts it at the cursor. */
  onInsertImage(file: File): void;
}) {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? TOOLS.map((tool) => tool.isActive(e)) : []),
  });
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div role="toolbar" aria-label="Formatting" className="flex gap-0.5 overflow-x-auto border-b border-line p-1.5">
      {TOOLS.map((tool, i) => (
        <button
          key={tool.label}
          type="button"
          aria-label={tool.label}
          aria-pressed={active?.[i] ?? false}
          disabled={!editor}
          // Keep the selection in the editor while clicking.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor && tool.run(editor)}
          className={`${toolClass} ${active?.[i] ? "bg-soft" : "bg-transparent"} ${tool.className}`}
        >
          {tool.glyph}
        </button>
      ))}
      <button
        type="button"
        aria-label="Insert image"
        disabled={!editor}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => fileInput.current?.click()}
        className={`${toolClass} bg-transparent text-[13px] font-medium`}
      >
        Image
      </button>
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Clear it so picking the same file again still fires a change.
          event.target.value = "";
          for (const file of files) onInsertImage(file);
        }}
      />
    </div>
  );
}

function LeaveDialog({
  open,
  saving,
  onStay,
  onLeave,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  onStay: () => void;
  onLeave: () => void;
  onSave: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="leave-title"
      aria-describedby="leave-body"
      // Esc closes the dialog; staying is the safe default.
      onClose={onStay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onStay();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[440px] rounded-[22px] border border-line bg-surf p-7 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop:bg-[rgba(20,12,8,0.55)]"
    >
      <div className="flex flex-col gap-3.5">
        <h2 id="leave-title" className="m-0 font-serif text-[28px] font-normal">
          Leave without saving?
        </h2>
        <p id="leave-body" className="m-0 text-[15px] leading-[1.6] text-mut">
          You have unsaved changes. Pencil doesn&apos;t autosave, so they&apos;ll be lost if you
          leave now.
        </p>
        <div className="mt-1.5 flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            onClick={onLeave}
            className="h-11 cursor-pointer rounded-full border border-line bg-transparent px-[18px] text-sm font-medium text-err-ink"
          >
            Leave anyway
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            autoFocus
            className="h-11 cursor-pointer rounded-full bg-btn px-[18px] text-sm font-semibold text-on-btn disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** The editor's shape while the post (or the page's request data) loads. */
export function EditorSkeleton() {
  const bar = "rounded-lg bg-soft";
  return (
    <div aria-busy="true" aria-label="Loading your post" className="flex min-h-dvh flex-col bg-bg">
      <div className="h-[73px] border-b border-line bg-surf" />
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-4 pt-6 sm:px-8 sm:pt-12">
        <span className={`${bar} h-12 w-4/5`} />
        <span className={`${bar} h-20 w-full`} />
        <span className={`${bar} h-80 w-full rounded-[18px]`} />
      </div>
    </div>
  );
}
