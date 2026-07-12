# Phase 3: Scheduler & Worker — Summary

**Plan:** 03-01 (single plan, Wave 1)
**Status:** Implemented — pending verification (no network/Postgres/Redis in sandbox)

## Tasks Executed

| Task | Description | Status |
|------|-------------|--------|
| 3-1-1 | Install BullMQ + ioredis, extend schema (posts + publish_targets) | ✅ Schema updated + migration SQL written |
| 3-1-2 | Redis connection singleton (src/lib/redis.ts) | ✅ Written |
| 3-1-3 | Publisher interface + FakePublisher + factory (src/lib/publish/) | ✅ Written |
| 3-1-4 | Queue module (src/lib/queue/index.ts) | ✅ Written |
| 3-1-5 | Timezone utilities (src/lib/timezone.ts) | ✅ Written |
| 3-2-1 | Posts lib extension (getScheduledPosts, getPostWithTargets) | ✅ Written |
| 3-2-2 | Schedule API (POST /api/posts/[id]/schedule) | ✅ Written — includes client scoping for social accounts |
| 3-2-3 | Schedules list API (GET /api/schedules) | ✅ Written |
| 3-2-4 | Worker entrypoint (worker.ts) | ✅ Written |
| 3-3-1 | Timezone picker component | ✅ Written |
| 3-3-2 | Schedule UI (list + calendar tabs) | ✅ Written |
| 3-4-1 | Tests: timezone.test.ts + fake.test.ts | ✅ Written |
| 3-4-2 | Integration tests: schedule.test.ts + route.test.ts | ✅ Written |

## Files Created (17)

- `src/lib/redis.ts` — ioredis singleton (globalForX pattern, maxRetriesPerRequest: null)
- `src/lib/timezone.ts` — IANA utilities (localToUtc, formatInTimezone, timezoneSchema)
- `src/lib/publish/provider.ts` — Publisher interface (prepare + publish + verify)
- `src/lib/publish/fake.ts` — FakePublisher (deterministic mock)
- `src/lib/publish/index.ts` — getPublisher() factory
- `src/lib/queue/index.ts` — BullMQ queue + enqueuePublishJob + computeDelayMs
- `src/app/api/posts/[id]/schedule/route.ts` — POST schedule endpoint
- `src/app/api/schedules/route.ts` — GET schedules list
- `worker.ts` — BullMQ Worker process (separate process)
- `src/app/schedule/page.tsx` — Schedule UI page (list + calendar tabs)
- `src/components/schedule/TimezonePicker.tsx` — IANA timezone picker with auto-detect
- `src/components/schedule/ScheduleList.tsx` — Chronological list table
- `src/components/schedule/CalendarView.tsx` — Month calendar view
- `src/lib/timezone.test.ts` — Timezone conversion tests
- `src/lib/publish/fake.test.ts` — FakePublisher tests
- `src/app/api/posts/__tests__/schedule.test.ts` — Schedule API integration tests
- `src/app/api/schedules/__tests__/route.test.ts` — Schedule list API integration tests

## Files Modified (6)

- `src/lib/db/schema.ts` — Added scheduledAt/timezone/status to posts, new publish_targets table
- `src/lib/posts.ts` — Added getScheduledPosts, getPostWithTargets
- `package.json` — Added bullmq + ioredis deps, worker:dev + worker scripts
- `src/middleware.ts` — Added /schedule to protected routes
- `src/components/nav/AppNav.tsx` — Added Schedule link
- `.env.example` — Added REDIS_URL, REDIS_TLS, PUBLISHER_MODE

## Migration

- `drizzle/0001_add_schedule_support.sql` — Adds publish_targets table + posts columns

## Decisions Implemented

| Decision | Implementation |
|----------|---------------|
| D-01: Extend posts table | Added scheduledAt (timestamptz), timezone (text), status (text, default "draft") |
| D-02: publish_targets table | Junction table with post_id FK, social_account_id FK, status with check constraint, error_message, published_at |
| D-03: Publisher multi-step | Interface with prepare() + publish() + verify(); FakePublisher implements all three |
| D-04: Separate worker.ts | Standalone BullMQ Worker process, shares src/lib/ |
| D-05: List + Calendar tabs | Two-tab UI on /schedule page |
| D-06: IANA picker + UTC storage | localToUtc conversion server-side, TimezonePicker client-side |
| D-07: scheduled → running → published/failed | Per-target status state machine enforced by DB check constraint + worker transitions |

## Requirements Covered

- ✅ **SCHD-01**: POST /api/posts/[id]/schedule — stores UTC, creates publish_targets, enqueues BullMQ delayed job
- ✅ **SCHD-02**: worker.ts — BullMQ Worker with idempotency (jobId), retry (3 attempts, exponential backoff), DLQ, status transitions
- ✅ **SCHD-03**: GET /api/schedules + /schedule page with list + calendar tabs, per-target status badges
- ✅ **SCHD-04**: localToUtc conversion, Intl-based timezone picker, formatInTimezone display, timestamptz storage

## Verification Gates (Human — requires networked env)

1. `npm install` (bullmq, ioredis)
2. `npx drizzle-kit push` or run drizzle/0001_add_schedule_support.sql manually on Postgres
3. Set `REDIS_URL` env var (or `docker run -d -p 6379:6379 redis:7`)
4. `npm run build` (verify TS compile)
5. `npm run test` (vitest: all tests including new Phase 3 tests)
6. Manual: create client → compose post → schedule via POST route → verify DB + BullMQ job → run worker → verify status
