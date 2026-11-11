// Shared by the API and the client: image upload limits and response shape.

/** The largest image Pencil accepts: 5 MB. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** The image types Pencil stores, detected from the file's bytes on the server. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export const UPLOAD_TOO_LARGE = "Images must be 5 MB or smaller.";
export const UPLOAD_WRONG_TYPE = "Upload a JPEG, PNG or WebP image.";

/** An image stored in Pencil's storage. */
export type Upload = {
  /** Public address of the image, under Pencil's storage origin. */
  url: string;
  contentType: ImageType;
  /** Size in bytes. */
  size: number;
};

/** Body of `POST /api/uploads`. */
export type UploadResponse = { upload: Upload };

/**
 * A quick check before uploading, so an obviously wrong file fails without a
 * round trip. The server decides from the bytes, not from this.
 */
export function uploadProblemOf(file: { size: number; type: string }): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return UPLOAD_TOO_LARGE;
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return UPLOAD_WRONG_TYPE;
  return null;
}
