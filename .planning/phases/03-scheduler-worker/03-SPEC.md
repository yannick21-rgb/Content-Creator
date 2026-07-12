# Phase 3: Scheduler & Worker (reliability proof) — Specification

**Created:** 2026-07-12
**Ambiguity score:** 0.15 (gate: ≤ 0.20)
**Requirements:** 4 locked

## Goal

Team can schedule a post for a future date/time with correct IANA timezone handling, and a durable background worker (BullMQ, separate process) publishes due posts reliably and idempotently — proven via a FakePublisher adapter that exercises the full pipeline without real platform API credentials.

## Background

Phases 1 and 2 established the foundation: team auth, multi-client workspaces, OAuth token vault, post composition, and R2 media upload. The `posts` table exists with text/media content. The `social_account` table stores encrypted tokens.

Phase 3 adds the scheduling layer: extending the `posts` table with schedule fields, a `publish_targets` junction table for post-to-account routing with per-target status, a BullMQ-based worker process that picks up due jobs, and a Publisher adapter interface (prepare + publish + verify) with a FakePublisher implementation. The real publishing adapters (Meta, Instagram, LinkedIn) arrive in Phases 4–6 — Phase 3 proves the pipeline works end-to-end with a deterministic fake.

## Requirements

1. **Schedule a post for future date/time (SCHD-01)**: Team can schedule a composed post for a future date/time.
   - Current: `posts` table has text/media fields but no scheduling columns. No schedule API exists.
   - Target: `POST /api/posts/:id/schedule` accepts `{ scheduledAt: string, timezone: string }`, stores the datetime as UTC `timestamptz` in the extended `posts` table, creates `publish_targets` rows for selected social accounts, and enqueues a delayed BullMQ job.
   - Acceptance: A valid schedule request stores `scheduledAt` as UTC in the DB, creates `publish_targets` rows with status `scheduled`, and creates a delayed BullMQ job set to fire at the scheduled time. An invalid datetime or past datetime is rejected (400). Unauthenticated request is rejected (401).

2. **Background worker publishes due jobs (SCHD-02)**: A background worker (BullMQ, separate Node process) publishes due posts reliably and idempotently, surviving restarts without double-publishing.
   - Current: No worker exists. No queue infrastructure exists.
   - Target: A `worker.ts` process runs BullMQ Worker(s). When a delayed job's delay elapses, the worker picks it up, transitions status to `running`, calls the Publisher adapter (FakePublisher), and marks status `published` or `failed`. Job ID is derived from `publish_target.id` for idempotency. Failed jobs retry with exponential backoff (max 3 attempts) then land in the dead-letter queue.
   - Acceptance: A scheduled post publishes at (not before) its `scheduledAt` time (verified with a short delay in tests). Restarting the worker mid-execution does not cause a double-publish (idempotent via job ID). A permanently failing target eventually shows `failed` status with the error message stored.

3. **Calendar/queue view shows scheduled posts (SCHD-03)**: A `/schedule` page shows scheduled posts with their status, filterable by status and client.
   - Current: No schedule view exists. Only `/compose` shows posts.
   - Target: `GET /api/schedules` returns scheduled posts for the active client with their publish targets and per-target statuses. The UI has two tabs: a chronological list and a calendar view (month/week). Each entry shows title, scheduled time (converted to the user's timezone), and status badges per target.
   - Acceptance: The list tab shows upcoming scheduled posts ordered by `scheduledAt`. The calendar tab renders a monthly grid with dots/badges for scheduled days. Status badges show `scheduled` / `running` / `published` / `failed` per target. Changing the active client updates the view. Unauthenticated access is redirected to login.

4. **Timezone handling per IANA (SCHD-04)**: Scheduling handles IANA timezones correctly.
   - Current: No timezone handling exists anywhere in the codebase.
   - Target: The schedule form includes an IANA timezone selector (auto-detected to browser default, overridable). `scheduledAt` is stored as `timestamptz` (UTC). The server converts the user-provided local datetime to UTC using the IANA timezone. All displays convert UTC back to the user's timezone for display.
   - Acceptance: Scheduling "2026-08-01 09:00 America/New_York" stores the correct UTC equivalent (2026-08-01 13:00 UTC). The same post viewed from America/Los_Angeles shows 06:00. Scheduling with an invalid timezone name is rejected. The auto-detected browser timezone is offered as default.

## Boundaries

**In scope:**
- Extend `posts` table with `scheduledAt`, `timezone`, `status` columns.
- New `publish_targets` table (post_id → social_account_id with per-target status, error_message, published_at).
- BullMQ queue setup in `src/lib/queue/` — global queue for all publish jobs.
- Redis connection module `src/lib/redis.ts` (ioredis).
- Worker entrypoint `worker.ts` at project root (separate process).
- Publisher adapter interface in `src/lib/publish/provider.ts` (prepare + publish + verify).
- FakePublisher implementation in `src/lib/publish/fake.ts`.
- Schedule API endpoints under `/api/posts/:id/schedule` (create) and `/api/schedules` (list).
- Schedule UI page with list + calendar tabs at `/schedule`.
- IANA timezone picker component + UTC storage + display conversion.
- Per-target status state machine: scheduled → running → published/failed.
- BullMQ retry with exponential backoff (max 3) + dead-letter queue.
- Idempotency via BullMQ jobId derived from `publish_target.id`.
- Migration (drizzle-kit generate) for schema changes.

**Out of scope:**
- Real platform API publishing — Phases 4–6 (PUBL-01/02/03).
- Per-account rate-limit enforcement — Phase 7 / v2 (SCHD-06).
- Dead-letter / retry UI — v2 (OPS-02).
- Observability (job lag, failure rate) — v2 (OPS-01).
- Bulk/CSV scheduling — v2 (SCHD-05).
- Recurring / repeating schedules — v2.
- KMS envelope encryption — deferred (use env-based master key from Phase 1).
- LinkedIn organic carousels, additional networks, analytics, client approval portals.
- Fine-grained team roles — basic internal auth only.

## Constraints

- Stack is fixed: Next.js 15 (App Router) + React 19 + TypeScript + Node 24 LTS; PostgreSQL via Drizzle ORM (`postgres` driver); BullMQ 5.x + Redis 7.x; ioredis 5.x for Redis connectivity.
- Worker runs as a **separate Node process** (`worker.ts`) sharing `src/lib/` via direct imports.
- Publisher interface MUST mirror the established `OAuthProvider` interface pattern (interface → concrete implementations → factory).
- FakePublisher MUST be deterministic and require no external credentials.
- BullMQ jobId MUST derive from `publish_target.id` to guarantee idempotency.
- `scheduledAt` is always stored as `timestamptz` (PostgreSQL stores in UTC).
- Per-target status transitions are: `scheduled` → `running` → `published` / `failed`.
- Retry strategy: exponential backoff, max 3 attempts, then dead-letter queue.
- IANA timezone list is generated from `Intl.supportedValuesOf('timeZone')` — no external dependency.
- All schedule API endpoints require authentication and active-client scoping (same pattern as Phases 1-2).

## Acceptance Criteria

- [ ] `POST /api/posts/:id/schedule` (valid future datetime + IANA timezone) stores `scheduledAt` as UTC, creates `publish_targets` rows with status `scheduled`, enqueues a BullMQ delayed job.
- [ ] `POST /api/posts/:id/schedule` with past datetime or invalid timezone returns 400.
- [ ] Unauthenticated schedule request returns 401.
- [ ] BullMQ job fires at (not before) the scheduled time and transitions status to `running` → `published`.
- [ ] Worker restart during execution does not cause double-publish (idempotent).
- [ ] A failing target (simulated by FakePublisher) goes `running` → `failed` after max retries, error message stored.
- [ ] `GET /api/schedules` returns scheduled posts for active client with per-target status.
- [ ] Calendar tab renders a monthly grid with dots for scheduled days.
- [ ] List tab shows scheduled posts ordered by `scheduledAt`.
- [ ] Timezone display converts correctly: scheduling 09:00 America/New_York stores 13:00 UTC; displays as 06:00 America/Los_Angeles.
- [ ] Browser timezone is auto-detected as default in the timezone picker.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                  |
|--------------------|-------|------|--------|--------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | Clear goal + 4 roadmap success criteria                |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | 4 in-scope reqs; explicit out-of-scope for P4-6/v2    |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Stack fixed; IANA/UTC; FakePublisher; BullMQ jobId     |
| Acceptance Criteria| 0.90  | 0.70 | ✓      | 11 pass/fail checkboxes; idempotency tested concretely |
| **Ambiguity**      | 0.15  | ≤0.20| ✓      | Gate passed                                            |

## Interview Log

| Round | Perspective     | Question summary                                      | Decision locked                                            |
|-------|-----------------|------------------------------------------------------|------------------------------------------------------------|
| 1     | User discussion | Schedule storage → extend posts vs separate table?   | Extended `posts` table (D-01)                              |
| 1     | User discussion | Post-to-target mapping → junction table or JSON?     | `publish_targets` table (D-02)                             |
| 1     | User discussion | Publisher interface → single publish() or multi-step?| Multi-step: prepare + publish + verify (D-03)              |
| 1     | User discussion | Worker deployment → separate process or in-process?  | Separate `worker.ts` process (D-04)                        |
| 1     | User discussion | Schedule UI → list, calendar, or both?               | List + calendar (two tabs) (D-05)                          |
| 1     | User discussion | Timezone → IANA picker, UTC, or auto-detect?         | IANA picker + UTC storage (D-06)                           |
| 1     | User discussion | Status state machine → which states?                 | scheduled → running → published/failed (D-07)              |

---

*Phase: 03-scheduler-worker*
*Spec created: 2026-07-12*
*Next step: /gsd-plan-phase 3 — create executable plan*
