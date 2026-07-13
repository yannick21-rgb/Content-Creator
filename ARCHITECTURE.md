# Content-Creator Architecture

## Overview

A web application for social media agencies to create, AI-generate, schedule, and
publish posts across Facebook, Instagram, and LinkedIn for multiple clients —
all from a single dashboard.

```
browser → Next.js App Router (web + API) → Postgres / Redis
        ↓
     BullMQ Worker (background publish)
        ↓
     Meta / LinkedIn / Instagram APIs
```

## Service topology

Two processes share the same codebase and config:

| Process  | Entry point           | Responsibility                              |
|----------|-----------------------|---------------------------------------------|
| **Web**  | `next dev` / `next start` | Dashboard UI, API routes (CRUD, OAuth, AI, media presign), auth (Better Auth) |
| **Worker** | `tsx worker.ts`    | BullMQ job processing: delayed publish, token refresh sweep, dead-letter queue |

Both connect to the same Postgres (database) and Redis (job queue + rate
limiting) instances.

## Directory layout

```
src/
  app/                    # Next.js App Router
    (app)/                # Authenticated routes (dashboard, compose, etc.)
    api/                  # Route Handlers (backend API)
      ai/generate/        #   Generate post copy (Gemini / mock)
      clients/            #   CRUD + brand-voice + OAuth connections
      health/             #   GET /api/health (DB + Redis)
      media/upload/       #   S3/R2 presigned-upload URL
      posts/              #   CRUD, schedule, publish
    api/auth/             # Better Auth endpoints (auto-generated)
  lib/                    # Shared library (web + worker)
    ai/                   #   AiProvider interface + MockAiProvider + Gemini
    db/                   #   Drizzle ORM schema + connection
    oauth/                #   OAuth providers (Meta, LinkedIn, Mock) + refresh
    publish/              #   Publisher interface + Meta, LinkedIn, Instagram, Fake
    auth.ts               #   Better Auth instance + config
    clients.ts            #   Client-scoped helpers
    connection-status.ts  #   Token expiry state machine
    crypto.ts             #   AES-256-GCM token vault
    kms.ts                #   Envelope encryption (wrapped DEK per row)
    media.ts              #   Media upload helpers (S3/R2 presign)
    posts.ts              #   Post CRUD helpers
    queue.ts              #   BullMQ queue helpers
    rate-limit.ts         #   Shared Redis rate limiter
    redis.ts              #   Redis client
    r2.ts                 #   S3-compatible client (Cloudflare R2 / MinIO)
    schema.ts             #   Drizzle schema (all tables)
worker.ts                 #   BullMQ worker (publish + token-refresh sweep)
```

## Data flow

### 1. Client creation
```
UI → POST /api/clients → db.client (user-scoped)
```

### 2. OAuth connection (Meta / LinkedIn / Instagram)
```
UI → /connections/{platform}/start
   → generate PKCE state → store in oauth_state (10 min TTL)
   → redirect to provider consent (or mock-authorize)
User authorizes → callback (code + state)
   → validate state (CSRF + client binding)
   → exchangeCode → fetchIdentity → encryptTokenPair → social_account
```

### 3. Compose & schedule
```
UI → POST /api/posts (draft)
   → POST /api/posts/{id}/schedule (enqueue BullMQ delayed job)
   → POST /api/posts/{id}/publish (enqueue immediate job)
```

### 4. Background publish (worker)
```
Worker picks job → db read post + target + social_account
   → getValidAccessToken (auto-refresh if near expiry)
   → publisher.publish (Meta / LinkedIn / IG Graph API)
   → on success: mark target "published"
   → on failure: retry ×3 (exponential backoff), then DLQ
```

### 5. Token refresh (CONN-04)
- **Proactive**: before every publish, `getValidAccessToken` refreshes if
  `expiresAt` is within 7 days.
- **Reactive**: on auth error (401 / "expired"), worker does a hard refresh and
  retries once.
- **Sweep**: daily BullMQ job (`token-refresh-sweep`) refreshes all accounts
  within 14 days of expiry.

## Security

| Layer          | Mechanism                                     |
|----------------|-----------------------------------------------|
| Auth           | Better Auth (email/password, sessions)        |
| Rate limiting  | Redis counter (publish: 10/h per account; auth: 30/60s per IP) |
| Token vault    | AES-256-GCM (per-token IV/tag, envelope-encrypted DEK) |
| Keystore       | KEK from env (`TOKEN_ENCRYPTION_KEY`), per-row wrapped DEK |
| Validation     | Zod at every external boundary                |
| HTTP security  | HSTS, CSP, X-Frame-Options, nosniff           |

## Deployment

See [Dockerfile](./Dockerfile) for multi-stage builds:

```bash
# Web service
docker build --target web -t content-creator-web .

# Worker service
docker build --target worker -t content-creator-worker .
```

Required **env vars**:

| Variable                  | Purpose                               |
|---------------------------|---------------------------------------|
| `DATABASE_URL`            | Postgres connection string            |
| `REDIS_URL`               | Redis (BullMQ)                        |
| `TOKEN_ENCRYPTION_KEY`    | Base64-encoded 32-byte key (encryption) |
| `BETTER_AUTH_URL`         | Base URL for auth redirects           |
| `BETTER_AUTH_SECRET`      | Auth session secret                   |
| `OAUTH_PROVIDER_MODE`     | `mock` (default) or `real`            |
| `PUBLISHER_MODE`          | `fake` (default) or `real`            |
| `AI_MODE`                 | `mock` (default) or `gemini`          |
| `META_CLIENT_ID` / `META_CLIENT_SECRET` | Meta App (when `real`)  |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn App (when `real`) |
| `GEMINI_API_KEY`          | Google Gemini (when `gemini`)         |

## Remaining for production go-live

- [ ] Real Meta + LinkedIn OAuth approval and credential setup
- [ ] Real API publish validation (Meta, LinkedIn, Instagram)
- [ ] Real Gemini validation
- [ ] KMS-envelope integration (AWS KMS / GCP KSM / Vault) for KEK
- [ ] Observability / error tracking (Sentry)
- [ ] E2E tests against a live Postgres
