import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse } from "./errors";

type Handler<Ctx> = (request: NextRequest, context: Ctx) => Promise<Response> | Response;

/**
 * Wraps a route handler so every failure leaves as the shared error JSON:
 * ApiError → its code, ZodError → 400 with field errors, anything else → 500
 * with a generic message (details go to the server log only).
 */
export function route<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Next signals things like "bail out of prerendering" by throwing; let
      // those through instead of turning them into a 500.
      unstable_rethrow(error);
      if (error instanceof ApiError) {
        return errorResponse(error.code, error.message, error.fields, error.headers);
      }
      if (error instanceof z.ZodError) {
        return errorResponse(
          "VALIDATION_FAILED",
          "Some fields are invalid.",
          fieldErrors(error),
        );
      }
      console.error(error);
      return errorResponse("INTERNAL", "Something went wrong. Please try again.");
    }
  };
}

/** The largest JSON body any route accepts. A long post is well under this. */
export const MAX_BODY_BYTES = 2 * 1024 * 1024;

const TOO_LARGE = "Request body is too large.";

/** Reads the JSON body and validates it; throws a 400 when either step fails. */
export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    throw new ApiError("VALIDATION_FAILED", TOO_LARGE);
  }
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
    throw new ApiError("VALIDATION_FAILED", TOO_LARGE);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION_FAILED", "Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}
