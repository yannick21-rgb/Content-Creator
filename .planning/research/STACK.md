# Stack Research

**Domain:** Multi-platform social media publishing & scheduling SaaS (agency-managed, real platform APIs: Meta Graph, LinkedIn, Google Gemini)
**Researched:** 2026-07-11
**Confidence:** HIGH for the core stack (versions verified against official sources/release feeds). MEDIUM for a few fast-moving libraries where only "latest" can be pinned (Better Auth, Zod, the `postgres` driver). LOW for anything not independently verified.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** (App Router) | `^15.5.19` | Web app shell + HTTP API (Route Handlers / Server Actions) for the agency dashboard | The dominant 2025/2026 React framework; App Router gives server components, route handlers for OAuth callbacks/CRUD, and one deployable unit. Stable, React 19 support. (Next 16 is in preview as of mid-2026 — adopt only once GA; 15.5.x is the current stable line.) |
| **React** | `^19` | UI rendering | Ships with Next 15; stable, required for new App Router features. |
| **TypeScript** | `^5.7` | Type safety across app + worker | Non-negotiable for a multi-module app (auth, oauth, media, scheduler). |
| **Node.js** | **24 LTS (Krypton)** | Runtime for app + worker | Active LTS since Oct 2025. The correct target for a greenfield 2026 project. (Node 22 is now Maintenance LTS — do not start new work on it.) |
| **PostgreSQL** | **18.x** (current stable major; 17.x also fine) | Primary relational database | Industry-standard relational store for clients/accounts/posts/schedules. v18 is the current stable major (released 2025-09-25, 18.4 minor as of May 2026). Use a managed provider (Neon, Supabase, Railway, or RDS) so you get backups + connection pooling. |
| **BullMQ** | `^5.79` | Background job queue + reliable delayed publishing | The de-facto standard Redis-backed queue for Node.js. Survives process restarts, supports delayed jobs (exact fit for "publish at future time"), retries with backoff, idempotency-friendly workers, and repeatable jobs. MIT-licensed, ~6.4M weekly downloads. **This is the riskiest infrastructural piece — see the dedicated section below.** |
| **Redis** | `7.x`+ (managed: Upstash / Redis Cloud / ElastiCache) | Backing store for BullMQ | Required by BullMQ. Use a managed Redis to avoid operating it yourself; Upstash Redis is the cheapest, pay-per-use option and is fully BullMQ-compatible. For local dev, `redis:7` via Docker. |
| **Drizzle ORM** | `^0.45.2` | Type-safe DB access | SQL-first TypeScript ORM, no codegen step, tiny runtime, great Postgres support. Pin to the stable `0.45.x` line (v1.0 is still RC as of mid-2026 — do not ship RC to prod). Pair with the `postgres` (postgres.js) driver. |
| **postgres** (postgres.js) | `^3.4` | Drizzle's Postgres driver | Drizzle's recommended driver; edge-friendly, supports Neon's HTTP pooler, no native binary. |
| **@google/genai** | latest (`npm i @google/genai`) | Gemini AI copy generation | The **current, GA, unified Google Gen AI SDK** (Gemini API + Vertex AI). The old `@google/generative-ai` is **deprecated and reached end-of-life on 2025-08-31** — do not use it. Use a current GA model (e.g. `gemini-2.5-flash` / `gemini-2.5-pro`; `gemini-3` series is available as preview/GA). |
| **@aws-sdk/client-s3** + **@aws-sdk/s3-request-presigner** | `^3.1069` (AWS SDK v3) | S3-compatible media storage | The modular AWS SDK v3. Works against **any** S3-compatible endpoint (AWS S3, Cloudflare R2, MinIO). Use presigned URLs for direct browser→storage uploads. Avoid the legacy `aws-sdk` v2 (maintenance mode). |
| **Cloudflare R2** (recommended) or **AWS S3** | — | Object storage for images/videos/carousels | R2 is S3-compatible with **zero egress fees** — large savings for a media-heavy app. If you prefer AWS-native, use S3 + CloudFront. For local dev, MinIO (S3-compatible). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Better Auth** | latest | Internal agency-team auth (email/password) | Self-hosted, TypeScript-first, inferred types, no per-seat cost. Handles team login/sessions; integrates cleanly with Next 15 + Drizzle. (Note: this is for the *internal team*, NOT for connecting client social accounts — see OAuth note below.) |
| **@tailwindcss/postcss** + **tailwindcss** | `^4` (v4.2.1 latest stable) | Styling | Tailwind v4 is CSS-first config, Oxide engine (5–100× faster builds). For Next.js use the PostCSS plugin (`@tailwindcss/postcss`), not the Vite plugin. |
| **shadcn/ui** | via CLI | Dashboard UI components | Copy-in Radix-based components styled with Tailwind v4. Best DX for an internal B2B dashboard. Not a versioned npm dep — add via `npx shadcn@latest add`. |
| **Zod** | latest (v3.23+/v4) | Runtime validation (env, API inputs, platform webhooks) | Validate every external boundary (OAuth callbacks, Meta/LinkedIn webhooks, request bodies). Also used to verify env vars at boot. |
| **ioredis** | `^5` | Redis client for BullMQ | BullMQ accepts a connection; pass an `ioredis` instance for connection tuning/TLS to managed Redis. |
| **Bull Board** (optional) | latest | Queue introspection UI | Inspect/sretry/publish delayed jobs in dev. Optional; Taskforce.sh is the paid production dashboard. |
| **node-cron** / `@nestjs/schedule` | — | Only if you need a *health/cleanup* cron | Do **not** use for the publish schedule itself — that belongs in BullMQ (see pitfalls). node-cron is fine for "purge old logs nightly." |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **drizzle-kit** | Migrations / schema introspection | `drizzle-kit generate` + `migrate`. Run via `npm run db:migrate`. |
| **ESLint / Prettier** | Lint + format | Standard for TS projects; use `eslint-config-next` for the Next app. |
| **Docker Compose** | Local Postgres + Redis + MinIO | Reproducible dev environment; mirrors managed prod services. |
| **TSC / tsx** | Run the worker in dev | Worker run via `tsx worker.ts` locally; `node` in prod after build. |
| **Vitest** | Unit/integration tests | Test publish handlers against a real Postgres (testcontainers) and a mocked platform API. |

---

## The Background Scheduler (the riskiest piece) — explicit recommendation

**Use BullMQ + Redis. Do NOT use node-cron, Agenda, or a database-table poll for the publish schedule. Do NOT reach for Temporal yet.**

Why BullMQ (verified consensus across 2026 sources: Bedrock Labs, CODERCOPS, DevVersus, Viprasol):
- A scheduled post is a **single discrete delayed job** ("publish post X at 2026-07-20T09:00:00Z"). BullMQ's delayed-job mechanism stores the job in Redis sorted by execution timestamp, so it **survives any number of process restarts** and fires regardless of whether the user is online.
- Failed publishes **retry with exponential backoff** — essential because Meta/LinkedIn rate limits and transient API errors are common.
- Multi-instance safe (atomic Redis dequeue) — you can run 2+ workers behind a load balancer without double-publishing.

Why NOT the alternatives:
- **node-cron / setInterval / browser timers** — in-process only; jobs are lost on restart and duplicate across instances. Unacceptable for "must publish even if offline."
- **Agenda (MongoDB)** — only if you already run MongoDB; weaker priority/rate-limiting and higher latency. You're on Postgres, so it adds a second datastore for no benefit.
- **Temporal** — durable workflow engine for *multi-step, long-running, human-in-the-loop* processes. Our publish flow is one API call, not a workflow. Temporal's operational weight (cluster or Cloud, new programming model) is overkill here. Reach for it only if scheduling evolves into multi-step orchestration with branching/failure recovery across days.

**Architecture:** the worker is a **separate long-lived Node process** (not inside Next.js). It shares the same TS codebase, Drizzle client, and Redis connection as the web app.

```typescript
// worker.ts  (run as its own process: `node dist/worker.js`)
import { Worker } from "bullmq";
import { redisConnection } from "./lib/redis";
import { publishPost } from "./jobs/publishPost";

new Worker(
  "publish",
  async (job) => {
    // Idempotency guard: if already published, return early.
    // (BullMQ may deliver a job twice on stalled-worker requeue.)
    const ok = await publishPost(job.data.postId);
    return ok;
  },
  {
    connection: redisConnection,
    concurrency: 4,
    removeOnComplete: { age: 86400, count: 1000 }, // DON'T keep forever — Redis fills up
    removeOnFail: { age: 7 * 86400 },
  }
);
```

```typescript
// When a post is scheduled (in a Route Handler):
import { Queue } from "bullmq";
const publishQueue = new Queue("publish", { connection: redisConnection });

await publishQueue.add(
  "publish-post",
  { postId },
  { delay: scheduledAt.getTime() - Date.now(), jobId: postId, attempts: 5, backoff: { type: "exponential", delay: 60_000 } }
);
```

**Critical operational rules (from BullMQ post-mortems):**
1. **Make handlers idempotent.** BullMQ's stalled-job lock (default 30s) can requeue a job mid-run; a publish that runs twice must not double-post. Guard with a `status` column check + unique `jobId = postId`.
2. **Set `removeOnComplete` / `removeOnFail` retention.** Defaults are `false` → Redis memory grows unbounded. Configure counts/ages.
3. **Monitor the failed queue.** Alert when failed jobs accumulate. Add Bull Board in dev; Taskforce.sh or a dead-letter handler in prod.
4. **Pin Redis version.** BullMQ uses Lua scripts; don't blindly upgrade Redis majors without testing.
5. **Immediate publish** = enqueue with `delay: 0`. Keep one code path for both immediate and scheduled.

---

## OAuth Token Storage (encrypted at rest) — explicit recommendation

The app stores **client social-account** OAuth tokens (Meta page tokens, LinkedIn access/refresh tokens) that must be **encrypted at rest**. Better Auth handles *team* login only — platform tokens are a separate concern you implement with each platform's OAuth 2.0 authorization-code flow and persist yourself.

**Recommended pattern: application-level envelope encryption with AES-256-GCM.**
- Encrypt each token with `aes-256-gcm` (Node's built-in `crypto` — no extra dependency) using a **data key**.
- Wrap the data key with a **KMS** (AWS KMS / GCP KMS) or **HashiCorp Vault Transit** — this is envelope encryption, the industry standard for token vaults.
- Store only the **ciphertext + IV + auth tag + wrapped key** in PostgreSQL (e.g. a `social_account` table with `access_token_encrypted`, `refresh_token_encrypted` columns).
- The **master/KEK** lives in the secrets manager / KMS, never in the DB or app bundle.
- Decrypt in-memory only at publish time; never log plaintext tokens.

Minimal-viable alternative if no KMS yet: AES-256-GCM with a 32-byte key from `TOKEN_ENCRYPTION_KEY` env var (e.g. `openssl rand -base64 32`), rotated via env. Treat the key as a secret; this is a stepping stone to KMS, not the final design.

**Do NOT:** store tokens in plaintext, in `.env` files committed anywhere, or rely solely on "the DB is encrypted at the disk level" (that protects against disk theft, not against an app-level SQL injection or a backup leak — you need field-level encryption). PostgreSQL's `pgcrypto` (`pgp_sym_encrypt`) is a viable DB-level alternative but app-level encryption is more portable and testable.

*Confidence: HIGH on the AES-256-GCM / envelope-encryption pattern (established security practice). MEDIUM on exact library choice — Node built-in `crypto` is sufficient; a KMS is recommended but depends on your cloud provider.*

---

## Installation

```bash
# --- Web app + API (Next.js) ---
npm install next@^15.5.19 react@^19 react-dom@^19

# --- DB ---
npm install drizzle-orm@^0.45.2 postgres@^3.4
npm install -D drizzle-kit@latest typescript@^5.7 @types/node @types/react @types/react-dom

# --- Background scheduler (shared by app + worker) ---
npm install bullmq@^5.79 ioredis@^5

# --- Media storage (S3-compatible) ---
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

# --- AI ---
npm install @google/genai

# --- Auth (internal team) ---
npm install better-auth

# --- UI / validation ---
npm install tailwindcss@^4 @tailwindcss/postcss zod
npx shadcn@latest init   # adds Radix-based components

# --- Worker runtime (dev) ---
npm install -D tsx
```

Local infra (Docker Compose): `postgres:18`, `redis:7`, `minio/minio` (S3-compatible stand-in for R2).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js (App Router) | **Remix / SvelteKit** | If you strongly prefer their data-loading model; Next is still the larger ecosystem for this domain. |
| Next.js Route Handlers (for API) | **Hono** or **Fastify** as a separate API service | If you want the API decoupled from the web build (e.g. multiple frontends, stricter service boundaries). Hono is the lighter modern TS-native pick; Fastify if you want maximum plugin maturity. The publish worker stays a plain Node process either way. |
| BullMQ + Redis | **Temporal** | Only if publishing becomes a multi-step durable workflow (approval gates, cross-day branching, compensating actions). Today it's one API call — BullMQ is correct. |
| BullMQ + Redis | **Agenda (MongoDB)** | Only if you already run MongoDB and want to avoid adding Redis. Not recommended here (Postgres-only stack). |
| PostgreSQL + Drizzle | **Prisma** | If your team is less SQL-fluent and values Prisma's migration tooling/Studio. Prisma 7 closed most perf gaps. Either is fine; we prefer Drizzle's no-codegen TS schema and smaller footprint. |
| Cloudflare R2 | **AWS S3 + CloudFront** | If you're already all-in on AWS or need S3-only features (Object Lock, SSE-KMS, Transfer Acceleration — R2 lacks these as of 2026). |
| Better Auth | **Auth.js (NextAuth v5)** / **Clerk** | Auth.js if you're already invested in its ecosystem (but type augmentation is manual); Clerk if you want hosted UI and don't mind per-MAU pricing. Better Auth wins for free, self-hosted, TS-first DX. |
| @google/genai | @google/generative-ai | **Never** — deprecated, EOL 2025-08-31. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@google/generative-ai` | Deprecated; end-of-life 2025-08-31; no new Gemini 2.0+ features | `@google/genai` |
| `aws-sdk` v2 | Maintenance mode; monolithic, slower | `@aws-sdk/client-s3` (v3, modular) |
| node-cron / setInterval for the publish schedule | In-process; jobs lost on restart; duplicates across instances; not reliable | BullMQ delayed jobs |
| Agenda (MongoDB) | Adds a second datastore you don't need; weaker than BullMQ for this workload | BullMQ + Redis |
| Temporal (for v1) | Operational overkill for a single-step publish; cluster/Cloud + new model | BullMQ; revisit if workflow needs emerge |
| Prisma **if** you pick Drizzle (and vice-versa) | Mixing ORMs doubles maintenance; pick one per service | Standardize on Drizzle (recommended) |
| Plaintext token storage / disk-only encryption | Vulnerable to SQLi/backup leaks; fails compliance | AES-256-GCM envelope encryption |
| Tailwind v3 config (`tailwind.config.js` + PostCSS `tailwindcss` plugin) | v4 changed the plugin model; old setup breaks | Tailwind v4 + `@tailwindcss/postcss` |
| Next.js 16 (preview) for greenfield prod | Still in preview as of mid-2026; wait for GA | Next.js 15.5.x stable |
| Node 22 (Maintenance LTS) for new projects | Maintenance LTS, EOL Apr 2027; shorter runway | Node 24 LTS |

---

## Stack Patterns by Variant

**If you want the simplest deployable unit (recommended for v1):**
- Next.js 15 (App Router) serves the dashboard **and** the HTTP API (Route Handlers for OAuth callbacks, post CRUD, Gemini calls, presigned-URL issuance).
- A **separate `worker.ts` process** runs BullMQ Workers + the scheduler. Both share `lib/` (db, redis, crypto, platform clients).
- Deploy: one web service + one worker service (or one container running both via a process manager / two replicas).
- Because: minimizes moving parts, single language/codebase, Next handles auth UI + API.

**If you want a decoupled API service (larger team / multiple clients):**
- Frontend: Next.js 15 (static/dynamic dashboard only).
- API service: **Hono** (or Fastify) as a standalone Node server (REST), owning all business logic, OAuth, Gemini, media signing.
- Worker: same Hono service's `worker` entrypoint (BullMQ), or a sibling process.
- Because: clean service boundary; the API can be reused by future mobile/native clients; isolates heavy publish logic from the UI deploy.

**Media upload flow (both variants):**
1. Client requests an upload; server returns a **presigned PUT URL** (`@aws-sdk/s3-request-presigner`) scoped to a unique key.
2. Browser uploads directly to R2/S3 (no bytes through your server).
3. Server stores the object key + metadata in Postgres; the publish job fetches a **presigned GET URL** (or the platform's own upload step) when posting to Meta/LinkedIn.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next `^15.5` | react `^19`, react-dom `^19` | React 19 is the supported line for Next 15. |
| next `^15.5` | node `>=20` (use **24 LTS**) | Node 24 is the Active LTS target; Next 15 supports 20+. |
| drizzle-orm `^0.45` | postgres `^3.4`, drizzle-kit (matching) | Do not mix Drizzle 1.0-rc with 0.45 schema; pin the 0.45 line for prod. |
| bullmq `^5.79` | ioredis `^5`, redis `7.x`+ | Pin Redis major; BullMQ uses Lua scripts. |
| @aws-sdk/client-s3 `^3.1069` | @aws-sdk/s3-request-presigner (same minor) | Keep both on the same v3 minor to avoid type drift. R2: avoid SDK versions that force checksum algos incompatible with R2 (known breakage around v3.729 — stay current). |
| better-auth (latest) | drizzle-orm adapter (`better-auth/adapters/drizzle`) | Use the Drizzle adapter for Postgres; align schema with Better Auth's expected tables. |
| tailwindcss `^4` | @tailwindcss/postcss | Do NOT use the old `tailwindcss` PostCSS plugin with v4. |
| @google/genai (latest) | Node 24, ESM/TS | Single `GoogleGenAI` client; uses `GEMINI_API_KEY` env by default. |

---

## Sources

- **Gemini SDK** (HIGH): [ai.google.dev/gemini-api/docs/migrate](https://ai.google.dev/gemini-api/docs/migrate) — `@google/genai` is GA; `@google/generative-ai` deprecated/EOL 2025-08-31. [github.com/googleapis/js-genai](https://github.com/googleapis/nodejs-genai) + [npmjs.com/package/@google/genai](https://www.npmjs.com/package/@google/genai).
- **BullMQ** (HIGH): [bullmq.io](https://bullmq.io/) + [docs.bullmq.io/changelog](https://docs.bullmq.io/changelog) (latest 5.79.x, MIT). Consensus articles (2026): Bedrock Labs "Background jobs web app architecture in 2026", CODERCOPS "Background Jobs in 2026: BullMQ, Inngest, or Temporal?", DevVersus "BullMQ vs Temporal (2026)", Viprasol "Background Job Processing".
- **Next.js / React** (HIGH): [github.com/vercel/next.js/releases v15.5.19](https://github.com/vercel/next.js/releases/tag/v15.5.19) (2026-06-01), [nextjs.org/blog/next-15](https://nextjs.org/blog/next-15) (React 19 stable). Next 16 noted as preview (16.3.0-preview.5).
- **Node.js LTS** (HIGH): [nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases) + [github.com/nodejs/release](https://github.com/nodejs/release) — Node 24 (Krypton) Active LTS since 2025-10-28; Node 22 Maintenance LTS.
- **PostgreSQL** (HIGH): [postgresql.org/docs/release/18.4](https://www.postgresql.org/docs/18/release-18.html) — v18 released 2025-09-25; 18.4 minor May 2026; v19 in beta.
- **Drizzle ORM** (HIGH/MEDIUM): [npmjs.com/package/drizzle-orm](https://www.npmjs.com/package/drizzle-orm) (0.45.2 stable, Mar 2026; v1.0 RC mid-2026 — pin 0.45.x for prod). Comparisons: nodewire.net "Prisma vs Drizzle ORM 2026", bytebase.com, dev.to "Drizzle vs Prisma in 2026".
- **Better Auth** (HIGH on choice / MEDIUM on version): [better-auth.com](https://better-auth.com/) + [better-auth Next.js guide](https://www.better-auth.com/docs/examples/next-js). 100K weekly downloads by 2026; TypeScript-first, self-hosted.
- **Tailwind v4** (HIGH): [tailwindcss.com/blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) (v4.0 Jan 2025; 4.2.1 latest stable) + [installation docs](https://tailwindcss.com/docs/installation/using-vite).
- **AWS SDK v3 / R2** (HIGH): [developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3) + [npmjs.com/package/@aws-sdk/client-s3](https://registry.npmjs.org/%40aws-sdk%2Fclient-s3) (3.1069.0, Jun 2026). R2 vs S3: codercops.com "Cloudflare R2 vs AWS S3 in 2026".
- **OAuth token encryption** (HIGH on pattern / MEDIUM on library): established practice — AES-256-GCM field-level encryption + KMS envelope encryption (AWS KMS / GCP KMS / Vault Transit). Node built-in `crypto` module. *Flag: the specific "best library" search was rate-limited; the pattern itself is well-established and not contested.*

---

*Stack research for: Content-Creator — multi-platform social media publishing & scheduling SaaS*
*Researched: 2026-07-11*
