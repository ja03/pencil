# Deploying Pencil

Pencil runs on Render as one Docker container: the image from the repo's `Dockerfile`, built by Render. Production uses Neon for Postgres, Cloudflare R2 for images and Mailtrap for email. They're set only through environment variables, so production runs the same code paths as local and CI. Only the values differ.

```
push to main ──► CI `check` (audit, lint, typecheck, tests, E2E) ──► CI `deploy` ──► Render deploy hook
                                                                                      │
                                       container start: prisma migrate deploy ──► next start
```

- **Deploys come from CI only.** `render.yaml` sets `autoDeployTrigger: off`. The `deploy` job in `.github/workflows/ci.yml` runs on pushes to `main`, after `check` passes. It calls the service's deploy hook with `ref=<commit SHA>`, so Render builds exactly the commit that passed. If any step of `check` fails, `deploy` doesn't run.
- **Migrations run when the container starts,** before `next start` (`CMD` in the `Dockerfile`). The Prisma CLI ships in the runtime stage. If a migration fails, the container exits, the health check never passes, and Render keeps the previous deploy serving.
- **Health check:** `/api/health` answers 200 only when both the database and the bucket can be reached.

## One-time setup

Pick one region for everything. `render.yaml` uses Render's `frankfurt`, so create the Neon project in AWS `eu-central-1` (Frankfurt) too.

### 1. Neon (Postgres)

1. Create a project with Postgres 17 in AWS Frankfurt.
2. In **Connection details**, copy two connection strings:
   - **Pooled** (the host contains `-pooler`): this is `DATABASE_URL`, used by the app.
   - **Direct** (turn pooling off): this is `DIRECT_URL`, used by `prisma migrate deploy`, which needs a session-level connection the pooler doesn't give.
   Keep `?sslmode=require` on both.
3. Nothing else is needed: the first migration runs `CREATE EXTENSION IF NOT EXISTS vector`, and Neon supports pgvector.

### 2. Cloudflare R2 (images)

1. Create a bucket, for example `pencil`. This is `S3_BUCKET`.
2. **Settings → Public access:** turn on the `r2.dev` subdomain, or connect a custom domain. That URL (no trailing slash) is `S3_PUBLIC_URL`. Browsers load images from it, and post content may only point at images under it.
3. **R2 → Manage API tokens → Create API token** with **Object Read & Write**, scoped to this bucket. This gives you `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`.
4. `S3_ENDPOINT` is `https://<account id>.r2.cloudflarestorage.com`, and `S3_REGION` is `auto`.
5. **Lifecycle rule for incomplete multipart uploads:** R2 buckets come with a default rule that aborts multipart uploads 7 days after they start. Check that it's still there under **Settings → Object lifecycle rules**. If it's missing, add a rule that aborts incomplete multipart uploads after 7 days, either in the dashboard or with the script below. The script needs an R2 token with **Admin Read & Write**, because the Object token can't change bucket settings:

   ```bash
   S3_ENDPOINT=... S3_BUCKET=pencil S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
   S3_PUBLIC_URL=... DATABASE_URL=unused SESSION_SECRET=unused-unused-unused-unused-unused \
     npm run storage:lifecycle
   ```

   The script replaces the bucket's lifecycle configuration with that single rule and prints the result. MinIO doesn't support this rule, so the script is for R2 only.

### 3. Mailtrap (email)

Use **Email Sending → SMTP**. The Email Testing sandbox catches mail instead of delivering it, so people could never open their verification links.

1. Add and verify a sending domain. `MAIL_FROM` must use it, for example `Pencil <no-reply@your-domain>`.
2. From the domain's SMTP settings: `SMTP_HOST=live.smtp.mailtrap.io`, `SMTP_USER=api`, `SMTP_PASS=<the API token>`.
3. `SMTP_PORT` is `2525`, which `render.yaml` already sets. **Free Render services can't connect out on ports 25, 465 or 587,** so don't use Mailtrap's default 587. The mailer upgrades port 2525 with STARTTLS.

### 4. Render (the service)

1. **New → Blueprint**, pick this repository, and Render reads `render.yaml`. It asks for every variable marked `sync: false`:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled connection string |
   | `DIRECT_URL` | Neon direct connection string |
   | `S3_ENDPOINT` | `https://<account id>.r2.cloudflarestorage.com` |
   | `S3_BUCKET` | the R2 bucket name |
   | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | the R2 Object Read & Write token |
   | `S3_PUBLIC_URL` | the bucket's `r2.dev` URL or custom domain |
   | `APP_URL` | the service's URL, e.g. `https://pencil.onrender.com` (you may need to fill this in after the first deploy shows the URL) |
   | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | from Mailtrap |
   | `GEMINI_API_KEY` | optional; blank means recommendations use tag overlap |
   | `GOOGLE_CLIENT_ID` | optional; blank hides "Continue with Google". Add `APP_URL` as an authorized JavaScript origin on the OAuth client |

   `SESSION_SECRET` is generated by Render, and `S3_REGION` and `SMTP_PORT` have fixed values.
2. Once the service exists, open **Settings → Deploy hook** and copy the URL.
3. In GitHub, go to **Settings → Secrets and variables → Actions** and add a repository secret `RENDER_DEPLOY_HOOK_URL` with that URL. You can also add it as a secret on the `production` environment, which the `deploy` job uses. Until the secret exists, `deploy` passes with a warning and deploys nothing.

The Blueprint creates the service and deploys it once. After that, only CI deploys it.

### 5. Seed (optional)

The production database starts empty. To load the demo authors and posts, run the seed once from your machine with the production values in the environment (`DATABASE_URL`, `DIRECT_URL`, the `S3_*` values and `SESSION_SECRET`):

```bash
npx prisma db seed
```

R2 has no bucket policies, so the seed warns that it couldn't set a public-read policy and carries on. Public access comes from the bucket setting in step 2.

## After the first deploy

- **Check the client-IP assumption.** Rate limits key on the rightmost `X-Forwarded-For` entry (`src/server/http/client-ip.ts`). The first time a process reads that header in production, for example on the first login, register or comment, it logs one line:

  ```
  [client-ip] first X-Forwarded-For in this process: "203.0.113.7"; rate limits key on "203.0.113.7"
  ```

  Log in once, then search the Render logs for `[client-ip]`. The address it keys on should be your own public IP. If it isn't (for example, it's a Render-internal address, or `"unknown"`), rate limits are keyed on the wrong value and the helper needs to change.
- **Free tier:** the service spins down after 15 minutes without traffic, so the first request afterwards takes about a minute. Rate-limit counters live in memory, so they reset whenever it spins down or redeploys.
