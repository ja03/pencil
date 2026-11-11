import type { ImageType } from "@/contracts/uploads";

// File type comes from the file's own bytes, never its name or the type the
// browser claims, so a renamed file can't slip through.

/** Bytes at `offset`, or undefined to match any byte (WebP's size field). */
type Signature = { type: ImageType; offset: number; bytes: (number | undefined)[] };

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

const SIGNATURES: Signature[] = [
  { type: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", offset: 0, bytes: [0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a] },
  // "RIFF", a 4-byte little-endian size, then "WEBP".
  {
    type: "image/webp",
    offset: 0,
    bytes: [...ascii("RIFF"), undefined, undefined, undefined, undefined, ...ascii("WEBP")],
  },
];

function matches(file: Uint8Array, { offset, bytes }: Signature): boolean {
  if (file.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => byte === undefined || file[offset + i] === byte);
}

/** The image type `file` starts with: JPEG, PNG or WebP; null for anything else. */
export function sniffImageType(file: Uint8Array): ImageType | null {
  return SIGNATURES.find((signature) => matches(file, signature))?.type ?? null;
}
