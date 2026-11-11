import type { NextRequest } from "next/server";
import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE, type UploadResponse } from "@/contracts/uploads";
import { requireUser } from "@/server/auth/service";
import { ApiError } from "@/server/http/errors";
import { readBody, route } from "@/server/http/route";
import { fileError, uploadImage } from "@/server/uploads/service";

/** Room for the multipart boundaries and headers around a 5 MB file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

const NOT_A_FORM = "Send the image as multipart/form-data in a field named file.";

/** The bytes of the `file` field in a multipart body, read with a size cap. */
async function imageFrom(request: NextRequest): Promise<Uint8Array> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new ApiError("VALIDATION_FAILED", NOT_A_FORM);
  }
  const body = await readBody(request, MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES, () =>
    fileError(UPLOAD_TOO_LARGE),
  );
  let form: FormData;
  try {
    form = await new Response(body as BodyInit, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new ApiError("VALIDATION_FAILED", NOT_A_FORM);
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw fileError("Choose an image to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw fileError(UPLOAD_TOO_LARGE);
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * POST /api/uploads: store a cover or inline image (JPEG, PNG or WebP, up to
 * 5 MB) and return its public URL. Uploads always go through the API; the
 * browser never writes to storage directly.
 */
export const POST = route(async (request: NextRequest) => {
  const user = await requireUser(request.cookies);
  const bytes = await imageFrom(request);
  const body: UploadResponse = { upload: await uploadImage(user, bytes) };
  return Response.json(body, { status: 201 });
});
