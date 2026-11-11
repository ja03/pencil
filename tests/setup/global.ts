import { execFileSync } from "node:child_process";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { publicReadPolicy } from "../../src/server/storage";
import { testEnv } from "./env";

// Runs once before the whole suite: bring the test database to the latest
// migration and make sure the test bucket exists and serves images publicly.
export default async function setup() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, ...testEnv },
    stdio: "pipe",
  });

  const s3 = new S3Client({
    endpoint: testEnv.S3_ENDPOINT,
    region: testEnv.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: testEnv.S3_ACCESS_KEY_ID,
      secretAccessKey: testEnv.S3_SECRET_ACCESS_KEY,
    },
  });
  try {
    await s3.send(new HeadBucketCommand({ Bucket: testEnv.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: testEnv.S3_BUCKET }));
  }
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: testEnv.S3_BUCKET,
      Policy: publicReadPolicy(testEnv.S3_BUCKET),
    }),
  );
  s3.destroy();
}
