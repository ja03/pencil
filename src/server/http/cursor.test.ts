import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

const position = {
  at: new Date("2026-03-01T09:00:00.123Z"),
  id: "01936f0e-1234-7000-8000-00000000abcd",
};

describe("page cursors", () => {
  it("decode back to the position they were made from", () => {
    expect(decodeCursor(encodeCursor(position))).toEqual(position);
  });

  it("are safe to put in a URL as they are", () => {
    expect(encodeCursor(position)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ["an empty string", ""],
    ["text that isn't base64url", "not a cursor!"],
    ["base64url of something else", Buffer.from("hello").toString("base64url")],
    ["a bad date", Buffer.from(`yesterday|${position.id}`).toString("base64url")],
    ["a bad id", Buffer.from("2026-03-01T09:00:00.123Z|42").toString("base64url")],
    ["extra parts", Buffer.from(`2026-03-01T09:00:00.123Z|${position.id}|x`).toString("base64url")],
  ])("reject %s", (_, cursor) => {
    expect(decodeCursor(cursor)).toBeNull();
  });
});
