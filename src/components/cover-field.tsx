"use client";

import { useRef, useState } from "react";
import { coverGradientFor } from "@/client/cover";
import { uploadImage, UploadError } from "@/client/upload-image";
import { IMAGE_TYPES } from "@/contracts/uploads";

const chip =
  "label-mono rounded-full bg-[rgba(28,21,16,0.6)] px-2.5 py-1.5 text-[10px] text-[#FBF4E8]";
const action =
  "h-10 cursor-pointer rounded-full border-none bg-[#FBF4E8] px-3.5 text-[13px] font-medium text-[#241A13] disabled:cursor-wait disabled:opacity-70";

/**
 * The editor's cover: the post's generated gradient until the author uploads
 * an image, which then shows in its place with Replace and Remove. The image
 * uploads as soon as it's picked; saving the post stores its address.
 */
export function CoverField({
  postId,
  coverUrl,
  onChange,
  onError,
  errors,
}: {
  /** Picks the generated gradient; null before the first save. */
  postId: string | null;
  coverUrl: string | null;
  onChange(url: string | null): void;
  onError(error: UploadError): void;
  errors?: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  // Upload progress from 0 to 1, or null when nothing is uploading.
  const [progress, setProgress] = useState<number | null>(null);
  const uploading = progress !== null;

  async function upload(file: File) {
    setProgress(0);
    try {
      const { url } = await uploadImage(file, setProgress);
      onChange(url);
    } catch (error) {
      onError(error instanceof UploadError ? error : new UploadError("Couldn't upload the cover."));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`relative flex aspect-[4/3] items-end justify-between gap-2.5 overflow-hidden rounded-[18px] p-4 sm:aspect-[21/8] ${errors ? "ring-2 ring-err-ink" : ""}`}
        style={coverUrl ? undefined : { background: coverGradientFor(postId ?? "") }}
      >
        {coverUrl && (
          // Covers come from Pencil's own storage; a plain img keeps them out of the optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="Cover image" className="absolute inset-0 size-full object-cover" />
        )}
        <span className={`relative ${chip}`}>
          {progress !== null
            ? `Uploading cover… ${Math.round(progress * 100)}%`
            : coverUrl
              ? "Cover"
              : "Cover · generated until you upload one"}
        </span>
        <div className="relative flex flex-none gap-2">
          {coverUrl && !uploading && (
            <button type="button" onClick={() => onChange(null)} className={action}>
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className={action}
          >
            {uploading ? "Uploading…" : coverUrl ? "Replace" : "Upload cover"}
          </button>
        </div>
        {progress !== null && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1 bg-acc transition-[width]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        aria-label="Cover image"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear it so picking the same file again still fires a change.
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <p className={`m-0 text-xs ${errors ? "text-err-ink" : "text-mut"}`} role={errors ? "alert" : undefined}>
        {errors?.[0] ?? "JPEG, PNG or WebP, up to 5 MB."}
      </p>
    </div>
  );
}
