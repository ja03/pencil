import { PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/server/env";
import { s3 } from "@/server/storage";

// All storage access for uploads: one S3 client, MinIO locally and R2 in
// production. Objects are never overwritten (every key is new), so they can
// be cached forever.

/** Stores `bytes` at `key` as a publicly readable image. */
export async function putImage(key: string, bytes: Uint8Array, contentType: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: env().S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      ContentLength: bytes.length,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

/** Where browsers load the object at `key` from. */
export function publicUrlOf(key: string): string {
  return `${env().S3_PUBLIC_URL}/${key}`;
}

/** The base address every stored image sits under. */
export function publicBaseUrl(): string {
  return env().S3_PUBLIC_URL;
}
