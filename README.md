# Pencil

A multi-author blog: one Next.js app serving both the UI and a REST API, on Postgres (with pgvector), S3-compatible storage and SMTP email. The full spec is [issue #1](https://github.com/ja03/pencil/issues/1).

## Run it

```bash
docker compose up
```

This starts the app on <http://localhost:3000> along with Postgres (host port 5433), MinIO (<http://localhost:9001>, `pencil` / `pencil-secret`) and Mailpit (<http://localhost:8025>), then runs migrations and the seed.

## Develop

```bash
cp .env.example .env
docker compose up -d postgres minio mailpit
npm install
npx prisma migrate deploy
npm run dev
```

## Test

Tests call the REST route handlers against the real services from `docker compose`, using a separate `pencil_test` database and `pencil-test` bucket.

```bash
docker compose up -d postgres minio
npm test
```

CI runs `npm audit`, lint, typecheck and the tests with coverage on every push and pull request.
