import { randomUUID } from "node:crypto";
import type { CurrentUser } from "@/contracts/auth";
import type { ImageRules } from "@/contracts/post-content";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_TOO_LARGE,
  UPLOAD_WRONG_TYPE,
  type ImageType,
  type Upload,
} from "@/contracts/uploads";
import { ApiError } from "@/server/http/errors";
import * as storage from "./repository";
import { sniffImageType } from "./sniff";

const EXTENSIONS: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A 400 tied to the form's `file` field. */
export function fileError(message: string): ApiError {
  return new ApiError("VALIDATION_FAILED", message, { file: [message] });
}

/**
 * Stores an image for a cover or inline use. Any signed-in user may upload,
 * verified or not, since drafts need images too. The type comes from the
 * bytes; the file's name and claimed type are ignored. Uploads that never end
 * up in a post are kept (no cleanup job).
 */
export async function uploadImage(user: CurrentUser, bytes: Uint8Array): Promise<Upload> {
  if (bytes.length > MAX_UPLOAD_BYTES) throw fileError(UPLOAD_TOO_LARGE);
  const contentType = sniffImageType(bytes);
  if (!contentType) throw fileError(UPLOAD_WRONG_TYPE);

  const key = `images/${user.id}/${randomUUID()}.${EXTENSIONS[contentType]}`;
  await storage.putImage(key, bytes, contentType);
  return { url: storage.publicUrlOf(key), contentType, size: bytes.length };
}

/**
 * The image rule posts are held to: images and covers must sit in Pencil's
 * storage. The editor gets the same rule so it can check before saving.
 */
export function storageImageRules(): ImageRules {
  return { imageBase: storage.publicBaseUrl() };
}
