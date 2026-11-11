# syntax=docker/dockerfile:1

# One image for local (`docker compose up`) and production (Render).
# Migrations run when the container starts, so the Prisma CLI ships in the
# runtime stage along with the rest of node_modules.

FROM node:26-bookworm-slim AS base
# OpenSSL for Prisma's schema engine (used by `prisma migrate deploy`).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, so the schema must be present.
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && exec npx next start"]
