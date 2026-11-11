// Seed data for local development (`docker compose up` runs this after
// migrating). Must stay idempotent: it runs on every container start.
// Later tickets add verified demo users and posts here.
import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { db } from "../src/server/db";
import { env } from "../src/server/env";
import { s3 } from "../src/server/storage";

async function ensureBucket() {
  const Bucket = env().S3_BUCKET;
  for (let attempt = 1; ; attempt++) {
    try {
      await s3().send(new HeadBucketCommand({ Bucket }));
      return;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) {
        await s3().send(new CreateBucketCommand({ Bucket }));
        console.log(`Created bucket ${Bucket}.`);
        return;
      }
      // Storage may still be starting; retry for ~30 seconds.
      if (attempt >= 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function main() {
  await ensureBucket();
  console.log("Seed complete.");
}

main()
  .finally(() => db().$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
