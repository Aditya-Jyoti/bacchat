# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml tsconfig.json ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

RUN pnpm prisma:generate

COPY src ./src

RUN pnpm run build

# ── Stage 2: run ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Carry over all node_modules from builder so prisma CLI is available for migrations
COPY package.json ./
COPY prisma ./prisma/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Migrations run first (idempotent), then start the compiled server
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/server.js"]
