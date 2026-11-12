import { z } from "zod";

// Local and production differ only by these values (see .env.example).
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /**
   * Public base address images are served from: the bucket's URL on MinIO
   * locally, the R2 public bucket URL or custom domain in production. Post
   * images must sit under it.
   */
  S3_PUBLIC_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Signs session JWTs. At least 32 characters; rotating it logs everyone out. */
  SESSION_SECRET: z.string().min(32),
  /** bcrypt cost factor. Tests lower it to keep hashing fast. */
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  /**
   * Public address of the app, used to build links in emails (never the
   * request's Host header, which a client can forge).
   */
  APP_URL: z
    .url()
    .default("http://localhost:3000")
    .transform((url) => url.replace(/\/+$/, "")),
  /** SMTP server for all email: Mailpit locally, Mailtrap in production. */
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  /** Empty for Mailpit, which takes mail without logging in. */
  SMTP_USER: z.string().optional().transform((v) => v || undefined),
  SMTP_PASS: z.string().optional().transform((v) => v || undefined),
  MAIL_FROM: z.string().min(1).default("Pencil <no-reply@pencil.local>"),
  /**
   * Gemini API key for recommendations by meaning. Unset (or blank) means
   * recommendations fall back to tag overlap.
   */
  GEMINI_API_KEY: z.string().optional().transform((v) => v || undefined),
  /**
   * OAuth client id for "Continue with Google". Unset (or blank) means Google
   * sign-in is off: the button is hidden and its endpoint answers 404.
   */
  GOOGLE_CLIENT_ID: z.string().optional().transform((v) => v || undefined),
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
