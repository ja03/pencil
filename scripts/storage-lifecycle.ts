// Sets the bucket's lifecycle rule: abort multipart uploads still incomplete
// after 7 days, so abandoned parts stop costing storage. For the production
// bucket on R2 only: MinIO rejects this rule. Run it with the R2 settings in
// the environment and a token that has Admin Read & Write:
//
//   npm run storage:lifecycle
//
// R2 buckets already have an equivalent default rule; this makes the rule
// explicit and restores it if it was removed. It replaces the bucket's whole
// lifecycle configuration, so it is safe to run again. See docs/deploy.md.
import "dotenv/config";
import {
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
} from "@aws-sdk/client-s3";
import { env } from "../src/server/env";
import { s3 } from "../src/server/storage";

const ABORT_AFTER_DAYS = 7;

async function main() {
  const Bucket = env().S3_BUCKET;
  await s3().send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: "abort-incomplete-multipart-uploads",
            Status: "Enabled",
            Filter: { Prefix: "" },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: ABORT_AFTER_DAYS },
          },
        ],
      },
    }),
  );
  const { Rules } = await s3().send(new GetBucketLifecycleConfigurationCommand({ Bucket }));
  console.log(`Lifecycle rules on ${Bucket}:`);
  console.log(JSON.stringify(Rules, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
