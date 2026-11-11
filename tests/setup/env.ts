// Environment for the test suite: the `docker compose` services, but a
// separate database and bucket so tests can wipe them freely.
// Override with TEST_DATABASE_URL / TEST_S3_ENDPOINT (CI sets these).
const S3_ENDPOINT = process.env.TEST_S3_ENDPOINT ?? "http://localhost:9000";
const S3_BUCKET = "pencil-test";

export const testEnv = {
  NODE_ENV: "test",
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ??
    "postgresql://pencil:pencil@localhost:5433/pencil_test",
  S3_ENDPOINT,
  S3_REGION: "us-east-1",
  S3_BUCKET,
  S3_PUBLIC_URL: `${S3_ENDPOINT}/${S3_BUCKET}`,
  S3_ACCESS_KEY_ID: process.env.TEST_S3_ACCESS_KEY_ID ?? "pencil",
  S3_SECRET_ACCESS_KEY: process.env.TEST_S3_SECRET_ACCESS_KEY ?? "pencil-secret",
  S3_FORCE_PATH_STYLE: "true",
  SESSION_SECRET: "test-session-secret-0123456789-abcdefghijkl",
  // The lowest bcrypt cost, so hashing doesn't dominate test time.
  BCRYPT_ROUNDS: "4",
} as const;
