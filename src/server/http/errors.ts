import {
  ERROR_STATUS,
  type ApiErrorBody,
  type ErrorCode,
  type FieldErrors,
} from "@/contracts/api-error";

/**
 * Thrown by services (or handlers) to end a request with a specific error.
 * The route wrapper turns it into the shared error JSON.
 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldErrors,
    /** Extra response headers, such as `Retry-After` on a 429. */
    readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  fields?: FieldErrors,
  headers?: HeadersInit,
): Response {
  const body: ApiErrorBody = { error: { code, message, ...(fields && { fields }) } };
  return Response.json(body, { status: ERROR_STATUS[code], headers });
}
