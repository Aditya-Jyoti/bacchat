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

COPY package.json ./
COPY prisma ./prisma/
# Route source files are needed at runtime so swagger-jsdoc can parse @openapi comments
COPY src/routes ./src/routes
COPY --from=builder /app/node_modules ./node_modules
# Compiled code resolves '../generated/prisma' relative to dist/config/,
# so the generated client must land at dist/generated/, not src/generated/
COPY --from=builder /app/src/generated ./dist/generated
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/server.js"]
