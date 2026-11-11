import { z } from "zod";
import { ApiError } from "./errors";

/**
 * A post id from the URL. Anything that isn't a post id can't be a post, so
 * it's a 404 rather than a validation error.
 */
export async function postIdParam(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new ApiError("NOT_FOUND", "That post doesn't exist.");
  return parsed.data;
}
