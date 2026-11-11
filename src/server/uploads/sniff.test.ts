import { describe, expect, it } from "vitest";
import { sniffImageType } from "./sniff";

const bytes = (...values: (number | string)[]) =>
  Uint8Array.from(
    values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, "JFIF");
const PNG = bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, "IHDR");
const WEBP = bytes("RIFF", 0x24, 0x00, 0x00, 0x00, "WEBP", "VP8 ");

describe("sniffImageType", () => {
  it.each([
    ["JPEG", JPEG, "image/jpeg"],
    ["PNG", PNG, "image/png"],
    ["WebP", WEBP, "image/webp"],
  ])("detects %s from its magic bytes", (_, file, type) => {
    expect(sniffImageType(file)).toBe(type);
  });

  it.each([
    ["an empty file", bytes()],
    ["text", bytes("hello, world")],
    ["a GIF", bytes("GIF89a", 0x01, 0x00)],
    ["an SVG", bytes('<svg xmlns="http://www.w3.org/2000/svg"/>')],
    ["a PDF", bytes("%PDF-1.7")],
    ["a RIFF file that isn't WebP", bytes("RIFF", 0x24, 0x00, 0x00, 0x00, "WAVE", "fmt ")],
    ["a truncated PNG signature", bytes(0x89, "PNG", 0x0d, 0x0a)],
    ["a truncated JPEG signature", bytes(0xff, 0xd8)],
    ["a WebP header cut short", bytes("RIFF", 0x24, 0x00, 0x00, 0x00, "WEB")],
  ])("rejects %s", (_, file) => {
    expect(sniffImageType(file)).toBeNull();
  });

  it("ignores what follows a valid signature", () => {
    const withJunk = new Uint8Array([...PNG, ...bytes("<script>alert(1)</script>")]);
    expect(sniffImageType(withJunk)).toBe("image/png");
  });

  it("only looks at the start of the file", () => {
    const jpegLater = new Uint8Array([0x00, ...JPEG]);
    expect(sniffImageType(jpegLater)).toBeNull();
  });
});
