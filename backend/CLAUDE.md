# CLAUDE.md — Bacchat Backend

## Stack
Express + TypeScript + Prisma + PostgreSQL. Package manager: pnpm.

## Project structure conventions
- Routes → src/routes/[resource].ts
- Middleware → src/middleware/
- Services (business logic) → src/services/
- Utils (pure functions) → src/utils/
- All routes mounted in src/server.ts under /v1 prefix

## Rules
- Never use raw SQL — always use Prisma client
- All routes must use the `validate` middleware from src/middleware/validator.ts for input validation
- All protected routes must use `authenticate` middleware from src/middleware/auth.ts
- User IDs are UUIDs (strings), not integers — ignore integer examples in BACKEND_SPEC.md
- Token denylist for logout: implement as a `revoked_tokens` Prisma model, NOT Redis
- Always return `{ error: "message" }` for errors — no `message` field on errors
- Swagger JSDoc comments on every route

## Do not
- Do not change src/utils/jwt.ts, src/utils/password.ts, src/utils/token.ts
- Do not change src/middleware/validator.ts
- Do not change src/config/database.ts or src/config/swagger.ts
- Do not remove the email verification flow from auth — keep it, just also align with spec


Maintain a log file and only append to it everything that you are doing
