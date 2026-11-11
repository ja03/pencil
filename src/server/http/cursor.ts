import { z } from "zod";

/**
 * Where a row sits in a list ordered newest first by a timestamp: when the
 * post was published, or when the comment was written. `id` breaks ties
 * between rows from the same millisecond.
 */
export type KeysetPosition = { at: Date; id: string };

// A cursor is the last row's position, base64url-encoded so clients treat it
// as opaque. Keyset paging on (timestamp, id) means rows added while someone
// pages land above their cursor: no duplicates and no skips.

const SEPARATOR = "|";
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function encodeCursor({ at, id }: KeysetPosition): string {
  return Buffer.from(`${at.toISOString()}${SEPARATOR}${id}`).toString("base64url");
}

/** The position in a cursor, or null when it isn't one this server issued. */
export function decodeCursor(cursor: string): KeysetPosition | null {
  if (!BASE64URL.test(cursor)) return null;
  const parts = Buffer.from(cursor, "base64url").toString("utf8").split(SEPARATOR);
  if (parts.length !== 2) return null;
  const [instant, id] = parts;
  if (!ISO_INSTANT.test(instant) || !z.uuid().safeParse(id).success) return null;
  const at = new Date(instant);
  if (Number.isNaN(at.getTime()) || at.toISOString() !== instant) return null;
  return { at, id };
}

/** `?cursor=` on list endpoints: absent for the first page, else a cursor we issued. */
export const cursorParam = z
  .string()
  .optional()
  .transform((value, ctx): KeysetPosition | null => {
    if (value === undefined) return null;
    const position = decodeCursor(value);
    if (position) return position;
    ctx.issues.push({ code: "custom", message: "That page cursor isn't valid.", input: value });
    return z.NEVER;
  });
