# Pencil

A multi-author blog: one Next.js app serving both the UI and a REST API, on Postgres (with pgvector), S3-compatible storage and SMTP email. The full spec is [issue #1](https://github.com/ja03/pencil/issues/1).

## Run it

```bash
docker compose up
```

This starts the app on <http://localhost:3000> along with Postgres (host port 5433), MinIO (<http://localhost:9001>, `pencil` / `pencil-secret`) and Mailpit (<http://localhost:8025>), then runs migrations and the seed.

The seed adds published demo posts and four verified demo authors, so publishing works straight away. Log in as `lina.k@pencil.local` (or `omar.h`, `devnotes`, `sara.m` at `pencil.local`) with the password `pencil-demo`.

## Develop

```bash
cp .env.example .env
docker compose up -d postgres minio mailpit
npm install
npx prisma migrate deploy
npm run db:seed   # creates the bucket and lets browsers read uploaded images
npm run dev
```

## Google sign-in

"Continue with Google" appears on the login and register pages only when `GOOGLE_CLIENT_ID` is set on the server, so it is off locally and in tests. In Google Cloud, create an OAuth client of type "Web application" and add the site's address (for example `https://pencil.onrender.com`) as an authorized JavaScript origin; no redirect URI or client secret is needed. The browser gets an ID token from Google and `POST /api/auth/google` verifies it against Google's keys.

## AI recommendations

"Recommended for you" and "More like this" pick posts by meaning when `GEMINI_API_KEY` is set in `.env` (or on the server). Each post is embedded with Gemini `gemini-embedding-001` after it is published, and again when its title, description or tags change. Without a key, recommendations use tag overlap.

Posts published before the key was set, or whose embedding failed, have no vector yet. To embed them:

```bash
npm run embeddings:backfill
```

It only touches published posts missing a vector, so it is safe to run again.

## Test

Tests call the REST route handlers against the real services from `docker compose`, using a separate `pencil_test` database and `pencil-test` bucket. Emails the app sends are read back from Mailpit's API.

```bash
docker compose up -d postgres minio mailpit
npm test
```

CI runs `npm audit`, lint, typecheck and the tests with coverage on every push and pull request.
