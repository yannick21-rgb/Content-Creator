# Architecture Research

**Domain:** Multi-platform social media publishing & scheduling SaaS (agency-focused)
**Researched:** 2026-07-11
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser SPA)                          │
│   Auth (internal team) · Client/Account mgmt · Composer · Calendar/Queue   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                 │ HTTPS (session/JWT)
┌───────────────────────────────▼──────────────────────────────────────────┐
│                           API / APP SERVER (Backend)                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────────┐  │
│  │ Auth       │ │ Client &   │ │ Post       │ │ Media Upload / Storage │  │
│  │ Service    │ │ Account    │ │ Composer   │ │ Service                │  │
│  │            │ │ Service    │ │ Service    │ │                        │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └───────────┬────────────┘  │
│        │              │              │                    │               │
│  ┌─────▼──────────────▼──────────────▼────────────────────▼────────────┐ │
│  │                  SCHEDULING DOMAIN (core)                            │ │
│  │  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────────┐  │ │
│  │  │ Post / Draft │   │ Publish Job  │   │ Dispatcher / Scheduler  │  │ │
│  │  │ Store        │   │ Store        │   │ (poll due, enqueue)     │  │ │
│  │  └──────────────┘   └──────┬───────┘   └────────────┬────────────┘  │ │
│  │                            │                        │                │ │
│  │                   ┌────────▼────────┐      ┌────────▼─────────────┐ │ │
│  │                   │  Queue / Outbox │◄─────│  Token Store          │ │ │
│  │                   │  (due post jobs)│      │  (OAuth, encrypted)  │ │ │
│  │                   └────────┬────────┘      └──────────────────────┘ │ │
│  └────────────────────────────┼────────────────────────────────────────┘ │
│                               │ (worker pulls due jobs)                    │
│  ┌────────────────────────────▼───────────────────────────────────────┐  │
│  │              PUBLISH WORKER (background, always-on)                  │  │
│  │   ┌─────────────────────────────────────────────────────────────┐  │  │
│  │   │  Publisher Registry (Adapter Pattern)                        │  │  │
│  │   │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │  │  │
│  │   │  │ Meta Adapter │  │ LinkedIn     │  │ Future: TikTok/X…  │  │  │  │
│  │   │  │ (Graph API)  │  │ Adapter      │  │                    │  │  │  │
│  │   │  └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘  │  │  │
│  │   └─────────┼──────────────────┼────────────────────┼─────────────┘  │  │
│  └─────────────┼──────────────────┼────────────────────┼────────────────┘ │
└────────────────┼──────────────────┼────────────────────┼──────────────────┘
                 │                  │                    │
        ┌────────▼───────┐ ┌────────▼───────┐  ┌─────────▼────────┐
        │ Meta Graph API │ │ LinkedIn API   │  │ Google Gemini API│
        │ (FB / IG)      │ │ (Posts API)    │  │ (copy generation) │
        └────────────────┘ └────────────────┘  └──────────────────┘
                 │                  │                    │
        ┌────────▼───────┐ ┌────────▼───────┐  ┌─────────▼────────┐
        │ OAuth token    │ │ OAuth token    │  │                   │
        │ refresh        │ │ refresh        │  │                   │
        └────────────────┘ └────────────────┘  └──────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Auth Service** | Authenticate internal agency team (email/password); issue session/JWT | Server session or JWT; bcrypt/argon2 password hashing |
| **Client & Account Service** | CRUD for agency clients and their connected social accounts | Domain module over the DB |
| **Post Composer Service** | Build drafts (text, image, video, carousel), persist as `Post` records | Domain module + validation |
| **Media Storage** | Store uploaded images/videos; serve public URLs to platform APIs | S3 / S3-compatible bucket; DB stores metadata + URL |
| **AI Generation Service** | Gemini assist for copy/hooks/rephrase | Thin client wrapper around Gemini API; prompt templates |
| **Token Store** | Persist OAuth tokens per social account, encrypted at rest; refresh logic | DB table + envelope encryption (KMS or app key) |
| **Scheduling Domain** | Hold `PublishJob` (scheduled time, status, target accounts, platform status) | DB tables; the heart of the system |
| **Dispatcher / Scheduler** | Poll due jobs, enqueue to worker; recompute next run | In-process poller OR cron; uses DB as queue (see patterns) |
| **Queue / Outbox** | Durable buffer between scheduler and worker | Postgres `SELECT … FOR UPDATE SKIP LOCKED`, or BullMQ/Redis |
| **Publish Worker** | Pull due jobs, resolve adapter, publish, update status, retry | Always-on background process (separate from API server) |
| **Publisher Registry / Adapters** | Per-platform publishing logic behind a common interface | Adapter pattern (one class per platform) |
| **OAuth Callback Handler** | Exchange code for tokens; persist encrypted | Route on API server |

### Boundaries & Communication

- **Browser → API server:** synchronous HTTPS (composer, scheduling a post, viewing calendar).
- **API server → DB:** synchronous read/write.
- **API server → Queue:** a scheduled post writes a `PublishJob` row (status `SCHEDULED`); the dispatcher picks it up. No browser involvement at publish time.
- **Dispatcher → Worker:** decoupled. The worker is a separate process that polls the queue/DB. This is non-negotiable — **a browser timer cannot publish when the user is offline** (explicit project constraint).
- **Worker → Platform Adapters:** synchronous outbound HTTPS to Meta/LinkedIn/Gemini.
- **Worker → Token Store:** reads & refreshes tokens as needed before each publish call.

## Recommended Project Structure

A modular monolith keeps boundaries explicit without premature microservice split (agency scale does not need distributed services). Modules map 1:1 to the components above.

```
src/
├── auth/                 # internal team auth, session/JWT, password hashing
├── clients/              # client & social-account management
│   ├── accounts/         # per-client connected accounts (FK to token store)
│   └── oauth/            # OAuth callback handlers, scope config per platform
├── posts/                # composer domain: Post, Draft, media attachments
│   ├── media/            # upload, storage URL generation, validation
│   └── compose/          # validation, text/image/video/carousel modeling
├── publishing/           # THE CORE
│   ├── jobs/             # PublishJob entity, status machine, DB repo
│   ├── scheduler/        # dispatcher: poll due jobs, enqueue
│   ├── worker/           # worker process entrypoint (standalone runner)
│   ├── adapters/         # platform adapters (one file/folder each)
│   │   ├── meta/         # Graph API: FB page post + IG container flow
│   │   ├── linkedin/     # Posts API: ugc/post + asset upload
│   │   └── base.ts       # Publisher interface all adapters implement
│   └── tokens/           # encrypted token store + refresh
├── ai/                   # Gemini wrapper, prompt templates, streaming
├── shared/               # db client, encryption, logging, errors, config
└── server.ts             # wires HTTP routes to the above modules
```

### Structure Rationale

- **`publishing/` is the seam that matters most.** Scheduling, jobs, worker, adapters, and tokens all live together so the async publish pipeline is cohesive and easy to test end-to-end with a fake adapter.
- **`adapters/` are isolated behind `base.ts`.** Adding a platform = new folder + registry entry, no changes to scheduler/worker. This is what makes "stage one platform at a time" cheap.
- **`clients/oauth/` separate from `tokens/`.** OAuth handshake (code→token) differs per platform; token storage/refresh is shared. Keep the handshake near account management, the vault near publishing.
- **`ai/` is a leaf module**; composer and (optionally) the worker can call it, but it never calls publishing. Keeps Gemini dependency from leaking into the publish path.

## Architectural Patterns

### Pattern 1: Platform Adapter behind a common Publisher interface

**What:** Every social platform implements the same `Publisher` contract (`publish(job, account, media) → platformPostId`). The worker depends only on the interface, resolved via a registry keyed by platform name.

**When to use:** Always, for multi-platform publishing. This is the single most important structural decision in this domain.

**Trade-offs:** Slight up-front cost to define the interface; huge payoff in swappability and the ability to add/remove platforms without touching scheduling logic. Also enables a `FakePublisher` for tests and for proving the scheduler before any real API exists.

**Example:**
```typescript
interface PublishTarget {
  platform: "meta" | "linkedin";
  accountId: string;        // FK to connected account
  mediaRefs: string[];      // media IDs stored in media service
}

interface Publisher {
  // returns the platform's post id on success
  publish(job: PublishJob, target: PublishTarget, token: AccessToken): Promise<string>;
  // validate prerequisites (token scopes, account linkage) before scheduling
  preflight(target: PublishTarget, token: AccessToken): Promise<void>;
}

class PublisherRegistry {
  private adapters = new Map<string, Publisher>();
  register(p: Publisher) { this.adapters.set(p.platform, p); }
  get(platform: string) { return this.adapters.get(platform); }
}
```

### Pattern 2: Scheduler + Queue + Stateless Worker (decoupled execution)

**What:** Scheduling decisions are separated from execution. A dispatcher polls for due jobs (`WHERE status='SCHEDULED' AND scheduled_for <= NOW()`); a separate always-on worker process pulls jobs and publishes. The DB (or a real queue) is the durable buffer so publishes survive process restarts.

**When to use:** Required. The project constraint is explicit — *"scheduled posts must publish even if the user is offline — requires a persistent background worker/queue, not a browser timer."*

**Trade-offs:** More moving parts than `setTimeout`, but it's the only correct design for reliability. For agency scale, you do **not** need Kafka/Redis — use the database as the queue via `SELECT … FOR UPDATE SKIP LOCKED` (well-established pattern), or a lightweight Redis-backed queue (BullMQ) if Redis is already present.

**Example (DB-as-queue, SKIP LOCKED):**
```typescript
// worker loop
const due = await db.query(
  `UPDATE publish_jobs
   SET status = 'RUNNING', locked_by = $1, locked_at = NOW()
   WHERE id IN (
     SELECT id FROM publish_jobs
     WHERE status = 'SCHEDULED' AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT 50
     FOR UPDATE SKIP LOCKED
   )
   RETURNING *`,
  [workerId]
);
for (const job of due) await runJob(job);
```

### Pattern 3: Idempotent publish + status machine

**What:** Every `PublishJob` has an explicit status (`SCHEDULED → RUNNING → PUBLISHED | FAILED`), a per-platform status sub-state (critical for Meta's async container flow), and an idempotency key. The worker is designed to be **at-least-once**: if it runs twice, the result is the same.

**When to use:** Mandatory for any queue-based worker. Queues deliver at-least-once; crashes/retries mean a job may execute more than once.

**Trade-offs:** Requires modeling platform async states (see Meta below) and guarding against double-publish (e.g., store the returned platform post ID; if already present, treat as success). Worth it — prevents duplicate posts to a client's followers.

**Example (Meta IG async state tracked on the job):**
```typescript
// IG publishing is NOT synchronous: create container → poll → publish → poll again
async publish(job, target, token) {
  const containerId = await meta.createContainer(target, job.media, token);
  await meta.waitForStatus(containerId, "FINISHED", token); // poll ≤5 min
  const postId = await meta.publishContainer(target, containerId, token);
  // status_code may still be IN_PROGRESS; poll until PUBLISHED or ERROR
  await meta.waitForStatus(containerId, "PUBLISHED", token);
  return postId;
}
```

### Pattern 4: Encrypted token vault with lazy refresh

**What:** OAuth tokens are stored encrypted at rest (envelope encryption or app-managed key). Before each publish, the worker checks expiry and refreshes via the platform's refresh endpoint; the refreshed token is re-encrypted and saved.

**When to use:** Always — project constraint: *"OAuth access tokens expire and must be refreshable/stored securely (encrypted at rest)."*

**Trade-offs:** Never store raw tokens in plaintext or in default ORM logs. Refresh failures must flip the connected account to a "reconnect required" state and surface in the UI — a disconnected account is a normal, expected condition, not an exception.

## Data Flow

### Request Flow (compose & schedule)

```
Agency user (browser)
   │  fills composer, picks accounts + schedule time
   ▼
API: POST /posts  ──► Post Composer Service
   │                     │ validates text/media/carousel
   │                     ▼
   │                Media Service (ensure uploaded, get public URL)
   │                     ▼
   │                PublishJob created (status=SCHEDULED, scheduled_for set)
   │                     ▼
   └──────────────► Response 200 (post + job ids)
                              (no publish happens yet)
```

### Publish Flow (scheduled → live) — the critical path

```
[Dispatcher, every few seconds]
   │  SELECT due jobs (SKIP LOCKED), mark RUNNING
   ▼
[Queue / Outbox]
   │  worker polls
   ▼
[Publish Worker]
   │  1. Load PublishJob + targets
   │  2. For each target: resolve adapter via Registry
   │  3. Load token from Token Store; refresh if expiring
   │  4. adapter.publish(job, target, token)
   │        ├─ Meta: createContainer → upload → poll status → media_publish → poll PUBLISHED
   │        └─ LinkedIn: registerUpload → upload asset → POST /posts (PUBLISHED)
   │  5. On success: set job status=PUBLISHED, store platform post id + URL
   │  6. On transient failure: retry w/ exponential backoff (job stays RUNNING→SCHEDULED)
   │  7. On permanent failure: status=FAILED, move to dead-letter, alert UI
   ▼
Platform APIs (Meta Graph / LinkedIn)  ◄── post now live on client's account
```

### AI Generation Flow

```
Composer UI  ──► API /ai/generate  ──► AI Service  ──► Gemini API
                  (prompt: write hook,            (streams text back)
                   rephrase, vary tone)
```
Note: AI is a **synchronous helper** in the compose path, not in the publish path. It never blocks or participates in scheduled publishing. (Generation could be cached on the Post draft.)

### State Management (within backend)

```
PublishJob (DB)  ◄── single source of truth for scheduling state
   │
   ├─ status: SCHEDULED | RUNNING | PUBLISHED | FAILED
   ├─ scheduled_for: timestamptz
   ├─ per-target sub-state: { platform, accountId, platformStatus, platformPostId, error }
   └─ retry_count, next_retry_at
```
The worker drives state transitions; the UI only reads it. This avoids two writers racing on publish state.

## Key Data Flows Summary

1. **Compose → Schedule:** user action creates a `Post` + `PublishJob` (status `SCHEDULED`). No external calls except media upload + optional AI.
2. **Dispatch:** time-based trigger moves `SCHEDULED → RUNNING` and enqueues.
3. **Publish:** worker resolves adapter, refreshes token, calls platform, records `PUBLISHED`/`FAILED`. Meta is multi-step async; LinkedIn is asset-upload-then-post.
4. **Retry/DLQ:** failed jobs retry with backoff; permanent failures go to a dead-letter view the team can inspect and replay.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–25 clients, few hundred posts/mo (v1 target) | Single app server + single worker + Postgres as queue. Monolith is correct. No Redis/Kafka needed. |
| 25–200 clients | Run 2+ worker instances (idempotency + SKIP LOCKED keeps them safe). Consider BullMQ/Redis if job volume or retry load grows. Add per-account rate-limit awareness (Meta: ~100 posts/24h per IG account). |
| 200+ clients / high volume | Partition `SKIP LOCKED` scan by account or shard; add metrics (job lag, failure rate by platform); consider dedicated media CDN; webhook-based status instead of polling for Meta. |

### Scaling Priorities

1. **First bottleneck:** Meta's per-account rate limit (100 posts/24h) and container expiry (24h). Mitigation: enforce limit client-side before scheduling; never create IG containers hours ahead — create them at publish time, not schedule time.
2. **Second bottleneck:** worker throughput during peak posting windows (e.g., 9am). Mitigation: backoff + multiple workers; pre-warm media URLs so they're public at publish time.

## Anti-Patterns

### Anti-Pattern 1: Browser-timer / in-process scheduling

**What people do:** schedule a `setTimeout`/`node-cron` inside the web server process to publish later.
**Why it's wrong:** if the server restarts, the user closes the tab, or the process crashes, the post never publishes. Violates the explicit reliability constraint.
**Do this instead:** a separate always-on worker process reads due jobs from a durable store. Scheduling logic lives outside any request lifecycle.

### Anti-Pattern 2: Creating platform media containers at schedule time

**What people do:** when a post is scheduled, immediately call Meta to create the IG container.
**Why it's wrong:** IG containers expire after 24h. A post scheduled 3 days out would have a dead container. Also wastes API quota.
**Do this instead:** store only media URLs + post definition at schedule time; create the container during the worker's publish step, immediately before `media_publish`.

### Anti-Pattern 3: Tightly coupling scheduler to a specific platform

**What people do:** bake Meta/LinkedIn calls directly into the dispatcher loop.
**Why it's wrong:** adding the next platform requires editing the core scheduler; high risk of regression in the publish pipeline.
**Do this instead:** Adapter pattern (Pattern 1). The scheduler/worker know nothing about platforms — only the `Publisher` interface.

### Anti-Pattern 4: Non-idempotent publish

**What people do:** publish and assume one execution; on retry, publish again.
**Why it's wrong:** queues are at-least-once. A retry or crash-replay can double-post to a client's followers — embarrassing and hard to undo.
**Do this instead:** store the returned platform post ID; guard with idempotency key; treat "already published" as success.

### Anti-Pattern 5: Storing OAuth tokens in plaintext

**What people do:** save access/refresh tokens in a normal DB column.
**Why it's wrong:** a DB leak or careless log dumps every client's social account. Violates the encryption-at-rest constraint.
**Do this instead:** encrypt tokens (envelope encryption or app key); exclude from logs/serializers; rotate the app key; surface "reconnect required" on refresh failure rather than throwing.

## Integration Points

### External Services

| Service | Integration Pattern | Notes (verified, HIGH confidence) |
|---------|---------------------|-------|
| **Meta Graph API (Facebook + Instagram)** | REST, OAuth 2.0 (Meta Business). Page tokens for FB; IG Business account + linked Page token for IG. | IG publishing is **async**: `POST /{ig-user}/media` → upload (`image_url` or `rupload.facebook.com` for video) → poll `GET /{container}?fields=status_code` → `POST /{ig-user}/media_publish`. Container `status_code`: `IN_PROGRESS/FINISHED/ERROR/EXPIRED/PUBLISHED`. Containers expire in 24h. Limit ~100 posts/24h per IG account. Carousels = multiple `is_carousel_item` containers + one carousel container. |
| **LinkedIn API (Posts API)** | REST, OAuth 2.0, scope `w_member_social`. Headers `Linkedin-Version: YYYYMM` + `X-Restli-Protocol-Version: 2.0.0`. | Replaces legacy `ugcPosts`. Image posts require asset upload first: register upload (`/assets?action=registerUpload`) → PUT binary to the returned upload URL → reference `asset` URN in the post. Lifecycle includes `PUBLISH_REQUESTED`/`PUBLISH_FAILED`. Create org posts via `w_organization_social` if posting as a company page. |
| **Google Gemini** | REST/SDK, API key or service account. | Synchronous copy generation; invoked only in compose path. Not in publish path. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Browser ↔ API server | HTTPS (session/JWT) | All interactive actions |
| API server ↔ PublishJob store | Direct DB | Write on schedule; read for calendar |
| Dispatcher ↔ Worker | Queue / DB poll | Decoupled; worker is a separate process |
| Worker ↔ Adapters | In-process call (registry) | Adapter chosen by `target.platform` |
| Worker ↔ Token Store | Direct read/refresh | Refresh + re-encrypt before each publish |
| Composer ↔ AI Service | Synchronous call | Helper only; never blocks publish |

## Suggested Build Order (dependencies drive sequence)

The architecture's key property: **platform integrations are staged behind the `Publisher` interface**, so you validate the whole async pipeline with one real adapter, then add the rest cheaply. Recommended phases:

1. **Foundation + Auth + Client/Account CRUD (no publishing).**
   - Establishes DB, auth, client & connected-account tables, media storage.
   - No external platform calls yet. De-risks the domain model.

2. **Composer + `PublishJob` model + Media storage.**
   - Build posts (text/image/video/carousel), upload media, persist `PublishJob` with `scheduled_for`.
   - Still no real publishing — jobs sit in `SCHEDULED`.

3. **Scheduler + Worker + Token Store + `FakePublisher`.**
   - Prove the **reliability** architecture: dispatcher polls, worker publishes via a no-op/fake adapter, status machine + retries work. This validates the hardest constraint (offline publishing) *before* any platform friction.
   - Token store built (encrypted) but only exercised by the real adapter next.

4. **ONE real adapter — recommend Meta Graph (Facebook Page post) first.**
   - Rationale: Meta is the agency's primary channel and shares the OAuth app + token infrastructure with Instagram (IG requires the linked FB Page token anyway). A Facebook *Page* post is the simplest Meta path (publish via `image_url`/`message`, no binary container upload like IG video). This proves: OAuth handshake → token store → worker → real API → `PUBLISHED` status, end to end.
   - **Why not LinkedIn first:** LinkedIn is arguably lower approval-friction, so if Meta Business approval is the blocking risk the project flags, you can swap step 4 to LinkedIn to validate the pipeline, then return to Meta. Either way: **one platform only** in this phase.

5. **Second Meta surface — Instagram (including carousels).**
   - Reuses the same token store + worker; only adds the async container flow (Pattern 3) behind the Meta adapter. IG carousels are the product differentiator, so they come right after the FB validation.

6. **LinkedIn adapter.**
   - Asset-upload-then-post flow behind the same interface. Lowest risk once the pipeline exists.

7. **Hardening:** retries/backoff tuning, rate-limit enforcement, dead-letter UI, token-reconnect UX, observability.

**Dependency chain:** Auth → Clients/Accounts → Composer/Media → PublishJob model → Scheduler/Worker/TokenStore (+FakePublisher) → *one* real adapter → other adapters → hardening. Each phase is independently shippable and de-risks the next.

## Sources

- Meta — Instagram Content Publishing (official): https://developers.facebook.com/docs/instagram-platform/content-publishing (HIGH — official docs; container flow, status codes, 24h expiry, 100/24h limit)
- Meta — IG Container reference: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-container/ (HIGH — official; status_code values)
- Meta — Resumable video uploads: https://developers.facebook.com/docs/instagram-platform/content-publishing/resumable-uploads/ (HIGH — official; rupload.facebook.com flow)
- LinkedIn — Share on LinkedIn (ugcPosts / Posts API): https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin (HIGH — official; w_member_social, headers)
- LinkedIn — Posts API (replaces ugcPosts): https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api (HIGH — official; lifecycle states, migration)
- LinkedIn — Post Schema: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/post-api-schema (HIGH — official; PUBLISH_REQUESTED/PUBLISH_FAILED)
- Background jobs / scheduler patterns: https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs (MEDIUM-HIGH — multiple sources agree on idempotency, queue-based load leveling, at-least-once)
- Cron vs workers vs queues: https://docs.railway.com/guides/cron-workers-queues (MEDIUM-HIGH — SKIP LOCKED / Postgres-as-queue noted as viable for smaller systems)
- Distributed job scheduler design (SKIP LOCKED, next_run_time indexing, idempotency): https://www.systemdesignsandbox.com/learn/design-job-scheduler (MEDIUM-HIGH — design reference)

---

*Architecture research for: multi-platform social publishing/scheduling SaaS*
*Researched: 2026-07-11*
