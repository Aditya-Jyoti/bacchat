FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm prisma:generate

# Copy application files
COPY . .

# Build TypeScript
RUN pnpm run build

# Expose port
EXPOSE 3000

# Run migrations and start
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm start"]
