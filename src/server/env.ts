import { z } from "zod";

// Local and production differ only by these values (see .env.example).
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

let parsed: Env | undefined;

/**
 * Validated server environment. Read lazily so `next build` can import
 * server modules without production secrets present.
 */
export function env(): Env {
  parsed ??= schema.parse(process.env);
  return parsed;
}
