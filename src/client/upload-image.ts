import type { ApiErrorBody } from "@/contracts/api-error";
import { uploadProblemOf, type Upload, type UploadResponse } from "@/contracts/uploads";

/** Why an upload failed, in words for a toast. */
export class UploadError extends Error {
  constructor(
    message: string,
    /** True when the session has expired, so the author should log in again. */
    readonly unauthenticated = false,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Uploads an image through `POST /api/uploads` and resolves to where it is
 * stored. Uses XMLHttpRequest rather than fetch, because only XHR reports
 * upload progress. Rejects with an UploadError.
 */
export function uploadImage(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<Upload> {
  const problem = uploadProblemOf(file);
  if (problem) return Promise.reject(new UploadError(problem));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status === 201) {
        resolve((xhr.response as UploadResponse).upload);
        return;
      }
      const error = (xhr.response as ApiErrorBody | null)?.error;
      if (error?.code === "UNAUTHENTICATED") {
        reject(new UploadError("Your session has expired. Log in in another tab, then try again.", true));
      } else {
        reject(new UploadError(error?.message ?? "Couldn't upload the image. Please try again."));
      }
    };
    xhr.onerror = () => reject(new UploadError("Couldn't upload the image. Check your connection."));
    const form = new FormData();
    form.set("file", file);
    xhr.send(form);
  });
}
