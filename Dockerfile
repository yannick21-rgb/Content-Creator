# syntax=docker/dockerfile:1

# Multi-stage build for Content-Creator.
# Targets:
#   docker build --target web    -> Next.js app (web + API)
#   docker build --target worker -> BullMQ publish worker
# Both share the same base runtime; only the CMD differs.

# ---------- install dependencies ----------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- build the Next.js app ----------
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runtime base ----------
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Install prod deps only (tsx is a prod dep so the worker can run TS).
COPY package.json package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --production

# App artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/worker.ts ./worker.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src
RUN mkdir -p public

# ---------- web service ----------
FROM runner AS web
EXPOSE 3000
CMD ["npm", "run", "start"]

# ---------- worker service ----------
FROM runner AS worker
CMD ["npm", "run", "worker"]
