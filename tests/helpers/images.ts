import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { env } from "@/server/env";
import { s3 } from "@/server/storage";

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** The first bytes of each supported format; enough for sniffing. */
export const IMAGE_BYTES = {
  png: Uint8Array.from([0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, ...ascii("IHDR")]),
  jpeg: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...ascii("JFIF")]),
  webp: Uint8Array.from([...ascii("RIFF"), 0x24, 0, 0, 0, ...ascii("WEBPVP8 ")]),
};

/** `head` followed by zeros, `size` bytes in all. */
export function padded(head: Uint8Array, size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set(head.subarray(0, size));
  return bytes;
}

/** A multipart body with `bytes` in the `file` field, as the editor sends it. */
export function imageForm(bytes: Uint8Array, name = "photo.png", type = "image/png"): FormData {
  const form = new FormData();
  form.set("file", new File([bytes as BlobPart], name, { type }));
  return form;
}

/** The storage key of a public upload URL. */
export function keyOf(url: string): string {
  return url.slice(`${env().S3_PUBLIC_URL}/`.length);
}

/** The stored object's bytes and type, read straight from the bucket. */
export async function storedObject(key: string) {
  const object = await s3().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
  return {
    contentType: object.ContentType,
    bytes: new Uint8Array(await object.Body!.transformToByteArray()),
  };
}

/** Keys stored under `prefix`. */
export async function storedKeys(prefix: string): Promise<string[]> {
  const list = await s3().send(
    new ListObjectsV2Command({ Bucket: env().S3_BUCKET, Prefix: prefix }),
  );
  return (list.Contents ?? []).map((o) => o.Key!);
}
