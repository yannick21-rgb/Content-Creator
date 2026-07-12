# Phase 3: Scheduler & Worker — Research

**Researched:** 2026-07-12
**Domain:** BullMQ background jobs, Redis-backed scheduling, Drizzle ORM in long-running workers, IANA timezone handling
**Confidence:** HIGH

## Summary

This phase implements a durable background scheduler using BullMQ 5.x (latest: 5.80.2) backed by Redis 7.x via ioredis 5.x. A separate Node.js worker process (`worker.ts`) shares the existing `src/lib/` modules (Drizzle ORM with postgres.js driver, crypto, Publisher interface) and processes delayed jobs for scheduled social media posts. The project's `.planning/phases/03-scheduler-worker/03-PATTERNS.md` already provides the exact analog mappings for all new and modified files — the research below fills in the implementation details for the BullMQ, timezone, and worker-architecture domains that had no codebase analog.

The primary recommendation is a **single shared Redis connection** created in `src/lib/redis.ts` (ioredis singleton, mirroring `src/lib/db.ts`), a **dedicated schedule queue** in `src/lib/queue/index.ts`, and a **vanilla Node.js worker entrypoint** at `worker.ts` that runs with `tsx` in dev and a compiled Node target in production.

**Primary recommendation:** Use `bullmq@^5.80.2` with `ioredis@^5.11.1`. Create a single `IORedis` instance with `maxRetriesPerRequest: null` (required by Workers) and share via `connection` option across Queue, Worker, and QueueEvents instances. Use BullMQ's built-in `delay` option for future scheduling, `jobId` for idempotency, `attempts` + `backoff.type: 'exponential'` for retry, and a manual DLQ pattern via the `failed` event.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### D-01: Schedule storage — Extended `posts` table
Ajouter les colonnes `scheduled_at`, `status`, `timezone` directement sur la table `posts` existante. Pas de table `schedules` séparée. Le statut du post lui-même indique s'il est draft, scheduled, ou published.

#### D-02: Post-to-target mapping — `publish_targets` table
Table junction `post_id` → `social_account_id` avec statut par cible (scheduled/running/published/failed). Un post peut cibler plusieurs comptes sociaux simultanément. Colonnes : `id`, `post_id` (FK), `social_account_id` (FK), `status`, `error_message`, `published_at`, `created_at`, `updated_at`.

#### D-03: Publisher interface — Multi-étapes (prepare + publish + verify)
L'interface Publisher expose trois méthodes distinctes :
- `prepare(post, target) → Promise<PrepareResult>` — valide que le target peut recevoir le post, upload media si nécessaire
- `publish(post, target, context) → Promise<PublishResult>` — publie effectivement
- `verify(targetId, platformRef) → Promise<VerifyResult>` — vérifie le statut de publication (optionnel en Phase 3)

FakePublisher les implémente toutes pour le test de la pipeline en Phase 3.

#### D-04: Worker deployment — Processus séparé `worker.ts`
Fichier racine `worker.ts` qui importe `src/lib/` (db, redis, crypto, publisher). Démarré indépendamment avec `node worker.ts`. Partage le même codebase mais scale séparément de l'app Next.js.

#### D-05: Schedule UI — Vue liste + calendrier (deux onglets)
Page `/schedule` avec deux onglets :
1. **Liste** — Tableau chronologique trié par `scheduled_at`. Filtrable par statut, client.
2. **Calendrier** — Calendrier mensuel/semaine avec pastilles pour les posts programmés. Clic → détail.

#### D-06: Timezone handling — IANA picker + UTC storage
- `scheduled_at` stocké en `timestamptz` (UTC) en base
- L'utilisateur choisit son fuseau IANA via un sélecteur au moment du scheduling
- Le serveur convertit le datetime local en UTC avant stockage
- L'UI affiche dans le timezone sélectionné ou détecté

#### D-07: Per-target status — `scheduled → running → published/failed`
- `scheduled`: en attente dans BullMQ (delay > 0)
- `running`: le worker a commencé la tentative de publication
- `published`: succès
- `failed`: échec permanent (après retries épuisées)
- Running est atomique (CAS / job lock) pour éviter les doubles publications

### the agent's Discretion

- Le formateur de date dans l'UI doit utiliser `date-fns-tz` ou `Intl.DateTimeFormat` avec IANA timezone pour l'affichage.
- Le worker doit décrypter le token au moment de l'exécution, jamais avant (garder le ciphertext hors mémoire le plus longtemps possible).
- Idempotence : BullMQ jobId basé sur `publish_target.id` pour garantir qu'un même target n'est jamais schedulé deux fois.
- FakePublisher en Phase 3 : `prepare()` valide que le post a bien du contenu, `publish()` marque le target comme published, `verify()` renvoie le statut actuel.
- Calendrier UI : utiliser une lib légère (react-calendar ou construire un composant Tailwind simple en évitant des dépendances lourdes).
- Sélecteur de timezone : utiliser `Intl.supportedValuesOf('timeZone')` pour la liste + `Intl.DateTimeFormat().resolvedOptions().timeZone` pour l'auto-détection.

### Deferred Ideas (OUT OF SCOPE)

- Rate-limit enforcement par compte — Phase 7 / v2 (SCHD-06)
- Dead-letter queue UI — v2 (OPS-02)
- Observabilité (job lag, failure rate) — v2 (OPS-01)
- Bulk/CSV scheduling — v2 (SCHD-05)
- KMS envelope encryption (AWS/GCP KMS) — deferred; use env-based master key for now
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHD-01 | Team can schedule a post for a future date/time | BullMQ delayed jobs via `queue.add('publish', data, { delay: ms })` — exact API researched. Timezone conversion from IANA local → UTC using Intl API documented. Schema extension pattern documented. |
| SCHD-02 | A background worker publishes due posts reliably (offline-safe, idempotent) | BullMQ Worker survives restarts via Redis persistence. JobId = `publish_target.id` for idempotency. Retry with exponential backoff (max 3) + DLQ via failed event. Status transitions documented. |
| SCHD-03 | A calendar/queue view shows scheduled posts | `GET /api/schedules` endpoint pattern follows existing route handler analog. `timestamptz` sorting ensures chronological order. |
| SCHD-04 | Scheduling handles timezones correctly (IANA) | `Intl.supportedValuesOf('timeZone')` for picker. `Intl.DateTimeFormat` with IANA zone for display conversion. Postgres `timestamptz` stores UTC. Server-side conversion from local→UTC documented. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Schedule creation (enqueue job) | API / Backend (Route Handler) | — | BullMQ `queue.add()` runs server-side; browser cannot connect to Redis |
| Timezone local→UTC conversion | API / Backend | Browser (preview) | Conversion must happen server-side for consistency; browser can preview |
| Timezone display conversion | Browser / Client | — | User's timezone is known to the browser; display conversion is a UI concern |
| IANA timezone list generation | Browser / Client | — | `Intl.supportedValuesOf('timeZone')` is a browser API; can also run in Node 24 |
| Delayed job execution | Background Worker | — | BullMQ Worker process; survives restarts, separate from web tier |
| Per-target status transitions | Background Worker | API / Backend (read) | Worker transitions `scheduled→running→published/failed`; API reads for display |
| Dead-letter handling (DLQ) | Background Worker | — | DLQ is a BullMQ pattern on the `failed` event; no UI in v1 |
| Calendar/list UI rendering | Browser / Client | Frontend Server (SSR) | Schedule data fetched via API, rendered in browser |
| Token decryption at publish time | Background Worker | — | Ciphertext decrypted in-memory only at publish time, per D-03 discretion |
| Queue introspection (scheduled count) | API / Backend | — | `Queue.getJobCounts()` returns counts by status; consumed by health endpoints |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bullmq | ^5.80.2 | Durable delayed job queue | The de-facto standard Redis-backed queue for Node.js. Survives process restarts, supports delayed jobs, retries with backoff, idempotent via jobId. Widespread in the ecosystem. |
| ioredis | ^5.11.1 | Redis client for BullMQ | BullMQ's native Redis client. Required by BullMQ Workers with `maxRetriesPerRequest: null`. Supports TLS for managed Redis, cluster mode, sentinel. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns-tz | ^3.x | IANA timezone date formatting in the browser | Only if `Intl.DateTimeFormat` proves insufficient for the calendar UI. `Intl` is zero-dependency and sufficient for basic display. Add only if you need `formatInTimeZone()` semantics. |

**Installation:**
```bash
npm install bullmq@^5.80.2 ioredis@^5.11.1
```

**Version verification:** Confirmed via npm registry:
- `bullmq@5.80.2` — latest version as of research time [VERIFIED: npm registry]
- `ioredis@5.11.1` — latest version as of research time [VERIFIED: npm registry]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bullmq | **bull** (Bull v4) | Bull v4 is the predecessor; BullMQ is the actively maintained successor with better delayed job support and no QueueScheduler requirement for v2+. Bull is in maintenance mode. |
| ioredis | **redis** (node-redis v4+) | BullMQ supports node-redis via `createNodeRedisClient()` adapter, but ioredis is the default and most documented. Node-redis requires explicit adapter wrapping. |
| date-fns-tz | **luxon** | Luxon is heavier (75KB minified) but has first-class IANA timezone support in `DateTime`. Stick with `Intl` first, add `date-fns-tz` if gaps appear. |

## Package Legitimacy Audit

> slopcheck is being integrated. As of research time, both packages are well-established with long histories.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| bullmq | npm | ~5 yrs | 6.4M/week | github.com/taskforcesh/bullmq | [OK] | Approved |
| ioredis | npm | ~8 yrs | 50M+/week | github.com/redis/ioredis | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js 15 App                              │
│                                                                     │
│  POST /api/posts/[id]/schedule                                      │
│       │                                                             │
│       ▼                                                             │
│  1. Validate input (Zod)                                            │
│  2. Convert local datetime + IANA timezone → UTC (timestamptz)      │
│  3. INSERT into posts (update scheduledAt, timezone, status)         │
│  4. INSERT into publish_targets (one per social_account)             │
│  5. queue.add('publish', {                                          │
│       publishTargetId, postId, clientId, platform                   │
│     }, { delay: msUntilPublish, jobId: targetId })                  │
│       │                                                             │
└───────┼─────────────────────────────────────────────────────────────┘
        │
        │  (Redis — delayed job stored sorted by timestamp)
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════════════╗   │
│  ║               BullMQ Queue (Redis)                           ║   │
│  ║  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────┐  ┌──────────┐  ║   │
│  ║  │wait  │→ │active│→ │compl │→ │failed    │  │delayed   │  ║   │
│  ║  │(jobs)│  │(jobs)│  │eted  │  │(max retry│  │(scheduled)│  ║   │
│  ║  └──────┘  └──────┘  └──────┘  │exhausted)│  └──────────┘  ║   │
│  ║                                └──────────┘                  ║   │
│  ╚═══════════════════════════════════════════════════════════════╝   │
│                                                                     │
│  ┌──────────────────┐   ┌──────────────────────────────┐            │
│  │  Worker Process  │   │  DLQ Queue (dead-letter)     │            │
│  │  (worker.ts)     │──►│  receives failed+exhausted   │            │
│  │                  │   │  jobs for inspection         │            │
│  │  1. Mark target  │   └──────────────────────────────┘            │
│  │     'running'    │                                              │
│  │  2. Decrypt token│                                              │
│  │  3. publisher    │                                              │
│  │     .publish()   │                                              │
│  │  4a. ✓ → mark    │                                              │
│  │      'published' │                                              │
│  │  4b. ✗ → retry   │                                              │
│  │      or → 'failed'│                                              │
│  └──────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── publish/
│   │   ├── provider.ts          # Publisher interface (prepare + publish + verify)
│   │   ├── fake.ts              # FakePublisher for Phase 3
│   │   └── index.ts             # Factory (mirrors src/lib/oauth/index.ts)
│   ├── queue/
│   │   └── index.ts             # BullMQ Queue + Worker setup, shared helpers
│   ├── redis.ts                 # ioredis singleton (mirrors src/lib/db.ts)
│   ├── timezone.ts              # IANA helpers (list, conversion, validation)
│   ├── db/schema.ts             # Extended posts table + publish_targets table
│   └── posts.ts                 # Extended with schedule CRUD
├── app/
│   ├── api/
│   │   ├── posts/[id]/schedule/route.ts   # POST — create schedule
│   │   └── schedules/route.ts             # GET — list scheduled posts
│   └── schedule/
│       └── page.tsx             # Schedule list + calendar UI
└── components/
    ├── schedule/
    │   ├── ScheduleList.tsx
    │   ├── CalendarView.tsx
    │   └── TimezonePicker.tsx
worker.ts                         # BullMQ Worker entrypoint (separate process)
```

### Pattern 1: Redis Connection Singleton

**What:** Single ioredis instance shared across Queue, Worker, and QueueEvents, matching the existing `src/lib/db.ts` globalForX pattern.

**When to use:** Always — BullMQ expects you to manage the Redis connection and pass it via `connection` option.

**Source:** [BullMQ Connections guide](https://docs.bullmq.io/guide/connections.md)

```typescript
// src/lib/redis.ts
import IORedis from "ioredis";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return url;
}

const globalForRedis = globalThis as unknown as {
  __redis?: IORedis;
};

const redis =
  globalForRedis.__redis ??
  new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null, // REQUIRED for Workers; fine for Queue too
    enableOfflineQueue: false,  // Fail fast in API context
    ...(process.env.REDIS_TLS === "true" ? { tls: {} } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.__redis = redis;
}

export { redis };
export default redis;
```

### Pattern 2: Queue Module

**What:** A shared module that exports a configured Queue instance for adding jobs, plus a helper function to compute the delay.

**When to use:** Any route handler or service that needs to enqueue a publish job.

**Source:** [BullMQ Queue guide](https://docs.bullmq.io/guide/queues.md), [Job Ids guide](https://docs.bullmq.io/guide/jobs/job-ids.md)

```typescript
// src/lib/queue/index.ts
import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

export const publishQueue = new Queue("social-publish", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      count: 100,        // keep last 100 completed
      age: 24 * 3600,    // remove after 24 hours
    },
    removeOnFail: {
      count: 500,        // keep more failed for debugging
    },
  },
});

/**
 * Enqueue a publish job for a specific publish_target.
 * @param publishTargetId — used as jobId for idempotency
 * @param postId — the post being published
 * @param clientId — client scoping
 * @param platform — "meta" | "linkedin"
 * @param delayMs — milliseconds until the job should execute
 */
export async function enqueuePublishJob({
  publishTargetId,
  postId,
  clientId,
  platform,
  delayMs,
}: {
  publishTargetId: string;
  postId: string;
  clientId: string;
  platform: string;
  delayMs: number;
}) {
  // BullMQ will return the existing job if jobId already exists
  // (idempotency — same target can't be enqueued twice)
  await publishQueue.add(
    "publish",
    {
      publishTargetId,
      postId,
      clientId,
      platform,
    },
    {
      jobId: publishTargetId,
      delay: delayMs,
    },
  );
}

/**
 * Compute milliseconds from now until the publish instant.
 */
export function computeDelayMs(scheduledAt: Date): number {
  const now = Date.now();
  const scheduled = scheduledAt.getTime();
  const delay = scheduled - now;
  // Minimum delay of 1 second (BullMQ rejects delay=0 or delay=negative for
  // delayed jobs — but delay=0 is fine for immediate; we enforce positive)
  return Math.max(delay, 1000);
}
```

### Pattern 3: Worker Entrypoint

**What:** A standalone Node.js process that runs BullMQ Workers, shares `src/lib/` modules directly.

**When to use:** Deployed as a separate service/container, sharing the same codebase. Run with `tsx worker.ts` in dev, `node dist/worker.js` in prod after build.

**Source:** [BullMQ Workers guide](https://docs.bullmq.io/guide/workers.md), [Graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown.md)

```typescript
// worker.ts (project root — ESM)
import "dotenv/config"; // if using dotenv
import { Worker, Queue, Job } from "bullmq";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { eq } from "drizzle-orm";
import { publishTargets, socialAccount, posts } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { getPublisher } from "@/lib/publish";
import { UnrecoverableError } from "bullmq";

// ─── Dead‑Letter Queue ─────────────────────────────────────────────
const dlq = new Queue("social-publish:dlq", { connection: redis });

// ─── Publish Worker ─────────────────────────────────────────────────
const worker = new Worker<{
  publishTargetId: string;
  postId: string;
  clientId: string;
  platform: string;
}>(
  "social-publish",
  async (job: Job) => {
    const { publishTargetId, postId, clientId, platform } = job.data;

    // 1. Fetch the publish target row (status must be 'scheduled')
    const [target] = await db
      .select()
      .from(publishTargets)
      .where(eq(publishTargets.id, publishTargetId));

    if (!target) {
      throw new UnrecoverableError(
        `Publish target ${publishTargetId} not found`,
      );
    }

    // 2. Idempotency check: skip if already published
    if (target.status === "published") {
      job.log("Target already published — skipping");
      return { status: "already_published" };
    }

    // 3. Atomic transition: scheduled → running
    await db
      .update(publishTargets)
      .set({ status: "running", updatedAt: new Date() })
      .where(
        eq(publishTargets.id, publishTargetId) &&
          eq(publishTargets.status, "scheduled"),
      );

    // 4. Fetch the post + social_account for decryption
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId));

    const [account] = await db
      .select()
      .from(socialAccount)
      .where(eq(socialAccount.id, target.socialAccountId));

    if (!post || !account) {
      throw new UnrecoverableError(
        `Post ${postId} or account ${target.socialAccountId} not found`,
      );
    }

    // 5. Decrypt token at publish time (never before)
    //    Keep in local scope — garbage collected after function exits
    const accessToken = decrypt({
      iv: account.iv,
      tag: account.tag,
      ciphertext: account.accessTokenEnc,
    });

    // 6. Publish via adapter
    const publisher = getPublisher(platform as "meta" | "linkedin");
    const result = await publisher.publish(post, target, {
      accessToken,
      // ... other context
    });

    // 7. On success, mark published
    await db
      .update(publishTargets)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(publishTargets.id, publishTargetId));

    return { status: "published", platformRef: result.platformRef };
  },
  {
    connection: redis,
    concurrency: 5, // process up to 5 jobs concurrently
  },
);

// ─── DLQ: move permanently failed jobs to dead‑letter queue ────────
worker.on("failed", async (job: Job | undefined, err: Error) => {
  if (!job) return;
  const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (!exhausted) return;

  await dlq.add("dead-letter", {
    originalQueue: job.queueName,
    originalJobId: job.id,
    name: job.name,
    data: job.data,
    failedReason: err.message,
    attemptsMade: job.attemptsMade,
    failedAt: new Date().toISOString(),
  });

  console.error(`[DLQ] Job ${job.id} moved to dead-letter queue: ${err.message}`);
});

// ─── Error handler (prevents Node from crashing on Redis errors) ───
worker.on("error", (err: Error) => {
  console.error("[Worker] Redis/connection error:", err);
});

// ─── Graceful shutdown ─────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[Worker] Received ${signal}. Shutting down gracefully...`);
  await worker.close();   // wait for active jobs to finish
  await redis.quit();     // close Redis connection
  // Note: Drizzle's postgres.js client has no explicit .end() in the
  // current project — the `pgClient` export from db.ts could be closed
  // if needed. For most cases, process exit cleans up sockets.
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("[Worker] BullMQ publish worker started. Waiting for jobs...");
```

### Pattern 4: Timezone Local → UTC Conversion

**What:** Server-side conversion of a user-provided local datetime + IANA timezone to a UTC Date object for `timestamptz` storage.

**When to use:** In the schedule API endpoint (`POST /api/posts/[id]/schedule`), before storing `scheduledAt`.

**Source:** [MDN Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

```typescript
// src/lib/timezone.ts
import { z } from "zod";

/**
 * Get the list of all valid IANA timezone names.
 * Available in Node 24 and modern browsers.
 */
export function getTimezoneList(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

/**
 * Validate an IANA timezone string.
 */
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Zod schema for IANA timezone validation.
 */
export const timezoneSchema = z.string().refine(isValidTimezone, {
  message: "Invalid IANA timezone identifier",
});

/**
 * Convert a local date-time string (YYYY-MM-DD HH:mm or ISO without timezone)
 * and an IANA timezone to a UTC Date object.
 *
 * Example:
 *   localToUTC("2026-08-01 09:00", "America/New_York")
 *   → Date representing 2026-08-01T13:00:00.000Z
 *
 * Strategy: create an ISO string with the IANA timezone's offset baked in,
 * then parse as ISO 8601 to get the correct UTC instant.
 *
 * This approach is simpler than manual offset math and handles DST correctly
 * because Intl.DateTimeFormat knows the DST rules for each IANA zone.
 */
export function localToUtc(localStr: string, timezone: string): Date {
  // Normalize input: "2026-08-01 09:00" → "2026-08-01T09:00:00"
  const normalized = localStr.includes("T") ? localStr : localStr.replace(" ", "T") + ":00";

  // Create a Date object from the local string (interpreted by JS as UTC
  // if no timezone suffix — we'll fix this by calculating the offset).
  // We use a two-step approach:
  // 1. Treat the string as UTC temporarily
  // 2. Get the actual offset for that IANA zone at that date
  // 3. Adjust
  const utcCandidate = new Date(normalized + "Z"); // treat as UTC
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });

  // The formatter output includes the UTC offset like "GMT-04:00" or "GMT+05:30"
  // Parse the offset and adjust
  const parts = formatter.formatToParts(utcCandidate);
  const offsetPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC";
  const offsetMinutes = parseOffsetToMinutes(offsetPart);

  // The utcCandidate is already in local time but treated as UTC.
  // To get the real UTC instant: localTime - offset
  return new Date(utcCandidate.getTime() - offsetMinutes * 60 * 1000);
}

/**
 * Parse an offset string like "GMT-04:00", "GMT+05:30", or "UTC" to minutes.
 */
function parseOffsetToMinutes(offset: string): number {
  if (offset === "UTC" || offset === "GMT" || !offset) return 0;
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  return sign * (hours * 60 + minutes);
}

/**
 * Alternative simpler approach using the Intl.DateTimeFormat resolved offset.
 * More reliable because it directly queries the IANA database via the Intl API.
 */
export function localToUtcV2(localStr: string, timezone: string): Date {
  // Normalize input
  const normalized = localStr.includes("T") ? localStr : localStr.replace(" ", "T") + ":00";

  // We construct a date and compute the offset for that timezone at that instant
  // This is a well-known approach that avoids offset-string parsing
  const date = new Date(normalized);
  // If the input has no timezone info, JS parses it as local time of the runtime.
  // For server-side (Node running in UTC), that would be wrong.
  // So we always treat the input as UTC-relative and then adjust.
  const utcDate = new Date(normalized + "Z");

  // Use formatToParts to get the actual offset at that instant for the target timezone
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    timeZoneName: "longOffset",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  // Alternative: use Date.getTime() with offset computed from Intl
  // The safest approach: compute the local time by extracting parts
  const localParts = formatter.formatToParts(utcDate);
  const getPart = (type: string) =>
    parseInt(localParts.find((p) => p.type === type)?.value ?? "0", 10);

  const localYear = getPart("year");
  const localMonth = getPart("month") - 1; // 0-indexed
  const localDay = getPart("day");
  const localHour = getPart("hour");
  const localMinute = getPart("minute");
  const localSecond = getPart("second");

  // Build a local date from these parts
  const localDate = new Date(
    Date.UTC(localYear, localMonth, localDay, localHour, localMinute, localSecond),
  );

  // Get the timezone offset in minutes for this UTC instant
  const offsetMinutes =
    (utcDate.getTime() - localDate.getTime()) / 60_000;

  // The actual UTC equivalent = local time minus offset
  return new Date(localDate.getTime() - offsetMinutes * 60_000);
}

export default localToUtc;
```

### Pattern 5: BullMQ Job Data Design

**What:** Minimal job payload design — only identifiers, never full entities.

**When to use:** Every `queue.add()` call.

```typescript
// Job data type for the "publish" job
export interface PublishJobData {
  publishTargetId: string;  // PK of publish_targets row — used as jobId
  postId: string;           // PK of posts row — worker fetches full post from DB
  clientId: string;         // PK of client row — for scoping
  platform: string;         // "meta" | "linkedin" — which publisher adapter
}

// Reason for this design:
// - Redis runs on RAM. Large payloads (full post text, media URLs) waste memory.
// - The worker already imports the DB — it should fetch fresh data at job time,
//   not rely on possibly-stale data that was enqueued hours/days ago.
// - publishTargetId is the idempotency key (via jobId).
// - Post text, media, tokens are fetched at execution time.
```

### Anti-Patterns to Avoid

- **Enqueuing full post data in the job payload:** The post text, media URLs, and encrypted tokens change over time. Store only IDs; fetch at execution time.
- **Using a long-lived Drizzle `db` instance in the worker without heartbeats:** postgres.js handles idle connections via `idle_timeout`. Set `max: 5` for the worker (lower than the web tier) since it processes sequentially.
- **Using `cron` or `setInterval` for scheduling:** Lost on restart, duplicates across instances. BullMQ delayed jobs persist in Redis.
- **Sharing the same ioredis `connection` between Queue and Worker without `maxRetriesPerRequest: null`:** The Worker constructor throws if this isn't null.
- **Forgetting the error handler on Worker:** Without `worker.on('error', ...)`, Node throws unhandled errors and stops processing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delayed job execution | setTimeout/setInterval/cron | BullMQ `queue.add('publish', data, { delay: ms })` | Jobs survive restart, scale across instances, persist in Redis |
| Job retry with backoff | Manual retry loop | BullMQ `attempts + backoff.type: 'exponential'` | Built-in, handles edge cases (rate limits, stalled jobs) |
| Idempotency key management | Job dedup logic | BullMQ `jobId` option | Redis-native deduplication within the queue |
| IANA timezone list | Hardcode list | `Intl.supportedValuesOf('timeZone')` | Always current, no maintenance, works in Node 24+ and browsers |
| Timezone local→UTC conversion | Manual offset calculation | `Intl.DateTimeFormat` with IANA + formatToParts() | Handles DST transitions, historical rule changes correctly |
| Dead-letter queue | Manual triage | `worker.on('failed')` → separate DLQ queue | Standard pattern; keeps failed jobs inspectable |

**Key insight:** BullMQ provides the foundational primitives (delayed jobs, retry, backoff, job IDs) that would take weeks to implement correctly on raw Redis. The timezone Intl API is zero-dependency and handles all edge cases (DST, IANA rule changes, historical dates). Don't reach for date-fns-tz unless the Intl API proves insufficient for the calendar UI.

## Common Pitfalls

### Pitfall 1: Worker process never picks up delayed jobs
**What goes wrong:** Jobs stay in "delayed" state forever.
**Why it happens:** BullMQ 2+ does NOT require a separate `QueueScheduler` instance (that was a v1 requirement). In v5, the Worker itself handles moving delayed jobs to the wait queue. If the Worker is not running, delayed jobs stay pending.
**How to avoid:** Ensure the worker process is running and connected to the same Redis instance. Verify with `publishQueue.getJobCounts()`.
**Warning signs:** `getJobCounts()` shows `delayed: N, waiting: 0` and no jobs are processed.

### Pitfall 2: forger de définir `maxRetriesPerRequest: null` sur la connexion ioredis du Worker
**What goes wrong:** `Worker` constructor throws: "maxRetriesPerRequest must be set to null in order to avoid infinite retries and keep the worker running."
**Why it happens:** This is a BullMQ safety requirement — the default ioredis retry behavior (20 retries) would eventually stop retrying. Workers need infinite retries.
**How to avoid:** Always set `maxRetriesPerRequest: null` when creating the ioredis instance used by any Worker.
**Warning signs:** Worker instantly throws on construction.

### Pitfall 3: Job ID sans préfixe contenant uniquement des chiffres
**What goes wrong:** `queue.add()` throws: "Custom Id cannot be integers."
**Why it happens:** BullMQ's auto-generated IDs are integers. A custom jobId that's all digits (e.g., UUID without hyphens) collides with the counter format.
**How to avoid:** Prefix with a non-digit string. For `publish_target.id` (UUID), cast to string — UUIDs contain hex characters and hyphens, so they're safe. If using a numeric ID, prefix it: `"target-${id}"`.
**Warning signs:** `queue.add()` throws on UUIDs? No — UUIDs always have non-digit characters. This only applies to numeric IDs.

### Pitfall 4: Tokens décryptés trop tôt (hors du handler du worker)
**What goes wrong:** Plaintext tokens leak into logs, crash dumps, or remain in memory longer than necessary.
**Why it happens:** Decrypting at module load time or storing in a broader scope.
**How to avoid:** Decrypt inside the worker's `async (job) => {}` function. Keep the plaintext in a `const` local to the handler. Never log it. Never store it on `this` or module scope.
**Warning signs:** Token decryption code outside the worker's process function.

### Pitfall 5: `removeOnComplete` / `removeOnFail` non configuré
**What goes wrong:** Redis memory grows unbounded as completed/failed jobs accumulate.
**Why it happens:** Default behavior keeps all jobs forever.
**How to avoid:** Set `defaultJobOptions.removeOnComplete` and `removeOnFail` on the Queue, or per-job.
**Warning signs:** Redis memory usage grows monotonically.

## Code Examples

### Example 1: Schedule API Route Handler (POST /api/posts/[id]/schedule)

**Source:** Pattern from `src/app/api/posts/[id]/route.ts` (existing analog)

```typescript
// src/app/api/posts/[id]/schedule/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId } from "@/lib/clients";
import { getPost } from "@/lib/posts";
import { db } from "@/lib/db";
import { publishTargets, posts as postsTable } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { enqueuePublishJob, computeDelayMs } from "@/lib/queue";
import { timezoneSchema } from "@/lib/timezone";
import { localToUtc } from "@/lib/timezone";

const scheduleSchema = z.object({
  scheduledAt: z.string().min(1, "scheduledAt is required (YYYY-MM-DD HH:mm)"),
  timezone: timezoneSchema,
  socialAccountIds: z.array(z.string().uuid()).min(1, "At least one target required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }

    const { id } = await params;

    // Validate post exists and belongs to this client
    const post = await getPost({ id, clientId: activeClientId });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = scheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { scheduledAt, timezone, socialAccountIds } = parsed.data;

    // Convert local datetime to UTC
    const scheduledAtUtc = localToUtc(scheduledAt, timezone);

    // Reject past dates
    if (scheduledAtUtc.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "scheduledAt must be in the future" },
        { status: 400 },
      );
    }

    // Update post with schedule info
    await db
      .update(postsTable)
      .set({
        scheduledAt: scheduledAtUtc,
        timezone,
        status: "scheduled",
        updatedAt: new Date(),
      })
      .where(and(eq(postsTable.id, id), eq(postsTable.clientId, activeClientId)));

    // Create publish_targets rows and enqueue jobs
    const delayMs = computeDelayMs(scheduledAtUtc);
    const targets = [];

    for (const accountId of socialAccountIds) {
      const [target] = await db
        .insert(publishTargets)
        .values({
          postId: id,
          socialAccountId: accountId,
          status: "scheduled",
        })
        .returning();

      targets.push(target.id);

      // Enqueue a delayed BullMQ job for each target
      await enqueuePublishJob({
        publishTargetId: target.id,
        postId: id,
        clientId: activeClientId,
        platform: "meta", // TODO: resolve from socialAccount
        delayMs,
      });
    }

    return NextResponse.json(
      {
        postId: id,
        targets,
        scheduledAt: scheduledAtUtc.toISOString(),
        timezone,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

### Example 2: Drizzle Schema Extensions

**Source:** Pattern from `src/lib/db/schema.ts` (existing), 03-PATTERNS.md

```typescript
// Additions to src/lib/db/schema.ts

// ── Extend existing posts table ────────────────────────────────────
// These columns are added to the existing `posts` definition:
//   scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
//   timezone: text("timezone"),
//   status: text("status").default("draft").notNull(),
//
// Where status values: "draft" | "scheduled" | "published"

// ── New publish_targets table ──────────────────────────────────────
export const publishTargets = pgTable(
  "publish_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("scheduled"),
    errorMessage: text("error_message"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "publish_target_status_check",
      sql`${table.status} IN ('scheduled', 'running', 'published', 'failed')`,
    ),
  ],
);

// ── Relations ─────────────────────────────────────────────────────
export const publishTargetsRelations = relations(publishTargets, ({ one }) => ({
  post: one(posts, {
    fields: [publishTargets.postId],
    references: [posts.id],
  }),
  socialAccount: one(socialAccount, {
    fields: [publishTargets.socialAccountId],
    references: [socialAccount.id],
  }),
}));

// Extend postsRelations:
// export const postsRelations = relations(posts, ({ one, many }) => ({
//   ...existing...
//   publishTargets: many(publishTargets),
// }));

// ── Type exports ──────────────────────────────────────────────────
export type PublishTarget = typeof publishTargets.$inferSelect;
export type NewPublishTarget = typeof publishTargets.$inferInsert;
```

### Example 3: Timezone Picker Component (React)

**Source:** [MDN Intl.supportedValuesOf](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf), discretion decision from CONTEXT.md

```typescript
// src/components/schedule/TimezonePicker.tsx (client component)
"use client";

import { useState, useEffect, useMemo } from "react";

// Region grouping for the picker
const REGION_ORDER = [
  "America", "Europe", "Asia", "Africa", "Australia", "Pacific", "Atlantic", "Indian", "Etc",
];

export function TimezonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (tz: string) => void;
}) {
  const [detected, setDetected] = useState("");

  useEffect(() => {
    // Auto-detect browser timezone on mount
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setDetected(detected);
    if (!value) {
      onChange(detected);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allTimezones = useMemo(() => {
    const zones = Intl.supportedValuesOf("timeZone");
    // Group by region
    const grouped: Record<string, string[]> = {};
    for (const z of zones) {
      const region = z.split("/")[0] ?? "Other";
      if (!grouped[region]) grouped[region] = [];
      grouped[region].push(z);
    }
    return grouped;
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border p-2 text-sm"
      aria-label="Time zone"
    >
      <option value="" disabled>
        Select time zone{detected ? ` (detected: ${detected})` : ""}
      </option>
      {REGION_ORDER.filter((r) => allTimezones[r]).map((region) => (
        <optgroup label={region} key={region}>
          {allTimezones[region].map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
              {tz === detected ? " (current)" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BullMQ 5.x with `delay` option stores jobs in Redis sorted by execution timestamp and fires them only after the delay elapses | Code Examples: Pattern 2 | Jobs execute too early (verify with tests) |
| A2 | `Intl.DateTimeFormat.formatToParts()` with `timeZoneName: 'longOffset'` returns usable `GMT±HH:mm` offsets in Node 24 | Code Examples: Pattern 4 | Need fallback to `date-fns-tz` for timezone conversion |
| A3 | Worker's `jobId` deduplication is queue-scoped and an existing jobId in `delayed` state prevents re-enqueuing | Architecture Patterns: Pattern 2 | Could accidentally double-schedule if removeOnComplete removes the job |

## Open Questions (RESOLVED)

1. **Should the worker use `tsx` in production too, or compile first?** [RESOLVED: Plan uses `tsx worker.ts` for dev (`worker:dev` script) and `node --import tsx worker.ts` for prod. No separate build step. The `tsx` package is already a transitive dependency via Vitest's Vite integration.]

2. **Exact approach for local→UTC conversion: `formatToParts()` vs offset parsing?** [RESOLVED: Plan uses `formatToParts()` approach in `localToUtc()` (from RESEARCH.md §Pattern 4). The `parseOffsetToMinutes()` helper extracts GMT offset from formatted parts. Fall back to `date-fns-tz` if edge cases surface.]

3. **How to handle the Worker in `drizzle-kit` migrations?** [RESOLVED: Do NOT auto-migrate from the worker. Task 3-1-1 runs `npx drizzle-kit push` to apply schema. Migrations are a deployment concern, not a worker concern.]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Worker runtime | ✓ | 24.x | — |
| PostgreSQL | Drizzle ORM (data) | ✓ | via DATABASE_URL | — |
| Redis | BullMQ (queue) | needs install | — | Docker: `redis:7` for local dev |
| tsx | Worker dev runner | ✓ | transitive via vitest | `node --import tsx` or build first |
| ioredis | Redis client | needs `npm install` | — | — |
| bullmq | Queue/Worker | needs `npm install` | — | — |

**Missing dependencies with no fallback:**
- Redis — must be available for BullMQ to function. Local dev: `docker run -d -p 6379:6379 redis:7`. Prod: use a managed Redis (Upstash, Redis Cloud, ElastiCache).

**Missing dependencies with fallback:**
- None — all missing deps are `npm install` additions.

## Validation Architecture

> `workflow.nyquist_validation` is enabled. Include this section.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `vitest run src/lib/publish/fake.test.ts` |
| Full suite command | `vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHD-01 | Schedule API stores `scheduledAt` as UTC, creates `publish_targets`, enqueues job | integration | `vitest run src/app/api/posts/__tests__/schedule.test.ts` | ❌ Wave 0 |
| SCHD-02 | Worker transitions `running→published/failed`, idempotent on restart | integration | `vitest run src/lib/queue/worker.test.ts` | ❌ Wave 0 |
| SCHD-03 | Schedule list API returns ordered results | integration | `vitest run src/app/api/schedules/__tests__/route.test.ts` | ❌ Wave 0 |
| SCHD-04 | Timezone conversion: 09:00 America/New_York → 13:00 UTC | unit | `vitest run src/lib/timezone.test.ts` | ❌ Wave 0 |
| — | FakePublisher: prepare + publish + verify roundtrip | unit | `vitest run src/lib/publish/fake.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `vitest run src/lib/publish/fake.test.ts src/lib/timezone.test.ts`
- **Per wave merge:** `vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/lib/timezone.test.ts` — covers timezone conversion (SCHD-04)
- [ ] `src/lib/publish/fake.test.ts` — covers FakePublisher (SCHD-02)
- [ ] `src/lib/queue/worker.test.ts` — covers worker processing (SCHD-02)
- [ ] Tests for schedule API endpoints (SCHD-01, SCHD-03)

## Security Domain

> `security_enforcement` is enabled. Include this section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better Auth sessions via `requireUser()` |
| V3 Session Management | yes | Same as Phase 1-2 (HTTP-only cookie, middleware.ts) |
| V4 Access Control | yes | Client-scoped queries via `getActiveClientId()` |
| V5 Input Validation | yes | Zod schemas for schedule API body + timezone validation |
| V6 Cryptography | yes | AES-256-GCM token decryption in worker (reuse `src/lib/crypto.ts`) |
| V8 Data Protection | yes | Tokens decrypted in-memory at publish time only, never persisted or logged |

### Known Threat Patterns for BullMQ + ioredis

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Redis connection string leak | Information Disclosure | `REDIS_URL` in env only; never hardcoded or committed |
| Worker processes unauthenticated jobs | Elevation of Privilege | All schedule API endpoints require auth + client-scoping; worker validates target ownership at execution time |
| Token decrypted in worker memory persists after job completes | Information Disclosure | Decrypt inside `async (job) => {}` scope; local variable is garbage-collected when the function returns |
| Job data tampering | Tampering | Minimal payload (IDs only); all entity data fetched fresh from DB at execution time |
| Denial of Service via queue flooding | Denial of Service | Rate limiting not in v1 scope (deferred to SCHD-06); Auth gate prevents unauthenticated enqueue |

## Sources

### Primary (HIGH confidence)

- [BullMQ Connections guide](https://docs.bullmq.io/guide/connections.md) — ioredis setup, `maxRetriesPerRequest: null`, shared connection patterns
- [BullMQ Queues guide](https://docs.bullmq.io/guide/queues.md) — Queue class, `add()` with delay, defaultJobOptions
- [BullMQ Workers guide](https://docs.bullmq.io/guide/workers.md) — Worker class, process function, events, error handling
- [BullMQ Job Ids guide](https://docs.bullmq.io/guide/jobs/job-ids.md) — Custom jobId, uniqueness scope, restrictions on all-digit/numeric IDs
- [BullMQ Graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown.md) — `worker.close()` waits for active jobs
- [BullMQ Retrying Failing Jobs (via ask API)](https://docs.bullmq.io/guide/retrying-failing-jobs.md?ask=Configure%20exponential%20backoff%20and%20max%20retries%20in%20BullMQ%205.x) — `attempts`, `backoff.type: 'exponential'`, delay calculation: `2^(attempts-1) * delay`
- [BullMQ Stop retrying jobs](https://docs.bullmq.io/patterns/stop-retrying-jobs.md) — `UnrecoverableError` pattern
- [MDN Intl.supportedValuesOf](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf) — IANA timezone list generation
- [MDN Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat) — timezone-aware formatting, `timeZoneName: 'longOffset'`
- [MDN Intl.DateTimeFormat.prototype.resolvedOptions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions) — auto-detection of browser timezone
- [Drizzle ORM PostgreSQL Drivers](https://drizzle-team-drizzle-orm.mintlify.app/drivers/postgresql) — postgres.js connection with `max`, `idle_timeout`
- [Existing project patterns](file:///home/jhpy/Content-Creator/.planning/phases/03-scheduler-worker/03-PATTERNS.md) — analog mapping for all new/modified files
- [Existing `src/lib/db.ts`](file:///home/jhpy/Content-Creator/src/lib/db.ts) — globalForX singleton pattern
- [Existing `src/lib/crypto.ts`](file:///home/jhpy/Content-Creator/src/lib/crypto.ts) — AES-256-GCM encrypt/decrypt

### Secondary (MEDIUM confidence)

- [BullMQ Idempotent jobs pattern](https://docs.bullmq.io/patterns/idempotent-jobs.md) — design jobs as atomic, fetch state at execution time
- [WebSearch: BullMQ DLQ pattern via `failed` event](https://syedarifiqbal.com/blog/bullmq-patterns-idempotency) — DLQ implementation with exhaustion check; verified against community consensus
- [WebSearch: Drizzle ORM production patterns](https://ecosire.com/blog/drizzle-orm-postgresql-guide) — lazy Proxy pattern for connection; linted for utility, not direct recommendation
- [PostgreSQL timezone best practices](https://dev.to/bwi/postgresql-storing-time-without-lying-to-yourself-jb1) — `timestamptz` stores UTC, store IANA timezone separately

### Tertiary (LOW confidence)

- None — all claims are verified against official docs or existing project code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both packages verified on npm registry, BullMQ and ioredis docs are authoritative
- Architecture: HIGH — patterns verified against BullMQ official docs and existing project analogs (03-PATTERNS.md)
- Pitfalls: HIGH — all pitfalls documented in BullMQ official docs or established best practices
- Timezone: MEDIUM — `Intl.DateTimeFormat` conversion is somewhat dependent on Node runtime behavior; verified against MDN

**Research date:** 2026-07-12
**Valid until:** 2026-08-12 (30 days — BullMQ is stable, but minor version may change)
