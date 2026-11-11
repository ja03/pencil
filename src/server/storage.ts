import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

// Singleton: one S3 client per process (MinIO locally, Cloudflare R2 in
// production), kept on globalThis to survive dev hot reloads.
const globalForStorage = globalThis as unknown as { s3?: S3Client };

export function s3(): S3Client {
  const e = env();
  globalForStorage.s3 ??= new S3Client({
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    },
  });
  return globalForStorage.s3;
}

/**
 * A bucket policy letting anyone read (but not list or write) objects, so
 * uploaded images load straight from storage. Applied to MinIO by the seed;
 * on R2, public access is a bucket setting instead.
 */
export function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

/** True when the configured bucket exists and the credentials can reach it. */
export async function isBucketReachable(): Promise<boolean> {
  try {
    await s3().send(new HeadBucketCommand({ Bucket: env().S3_BUCKET }));
    return true;
  } catch {
    return false;
  }
}
