# Plan 04-01 Summary: MetaPublisher + Immediate Publish Flow

**Phase:** 4 — Publish to Meta (Facebook)
**Status:** Code complete — verification pending
**Date:** 2026-07-12

## Tasks Executed

### Implementation Tasks

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4-1-1 | MetaPublisher implementation | `src/lib/publish/meta.ts` — implements `Publisher` interface for Meta Graph API | Complete |
| 4-1-2 | Meta pages helper + OAuth enhancement | `src/lib/publish/meta-pages.ts` (getMetaPages) + `src/lib/oauth/meta.ts` (fetchIdentityWithPages) + `src/lib/oauth/complete.ts` (per-page social_account rows) | Complete |
| 4-1-3 | Meta app review status helper | `src/lib/meta-app-review.ts` (checkMetaAppReview + canPublishWithReviewStatus) | Complete |
| 4-1-4 | Update publisher factory | `src/lib/publish/index.ts` — gated via `PUBLISHER_MODE=real` env var | Complete |
| 4-2-1 | Publish API endpoint | `src/app/api/posts/[id]/publish/route.ts` — POST, validates post + accounts, creates publish_targets, enqueues BullMQ job | Complete |
| 4-2-2 | Publish status endpoint | `src/app/api/posts/[id]/publish-status/route.ts` — GET, returns per-target status with aggregates | Complete |
| 4-3-1 | PublishModal component | `src/components/compose/PublishModal.tsx` — Facebook account selector modal | Complete |
| 4-3-2 | PublishStatusView component | `src/components/compose/PublishStatusView.tsx` — per-target status with 3s polling | Complete |
| 4-3-3 | Update compose page | `src/app/compose/new/page.tsx` — added "Publish Now" button (grayed when no FB accounts), modal integration | Complete |
| 4-3-4 | Post detail page | `src/app/compose/post/[id]/page.tsx` — post detail with publish status display | Complete |
| 4-4-1 | Unit tests | `src/lib/publish/meta.test.ts` — MetaPublisher prepare/publish/verify tests with mocked fetch | Complete |
| 4-4-2 | Integration tests | `src/app/api/posts/__tests__/publish.test.ts` — API endpoint auth/validation/error tests | Complete |

### Files Created (8 new files)
- `src/lib/publish/meta.ts` — MetaPublisher adapter
- `src/lib/publish/meta-pages.ts` — getMetaPages helper
- `src/lib/meta-app-review.ts` — App review check
- `src/app/api/posts/[id]/publish/route.ts` — Publish endpoint
- `src/app/api/posts/[id]/publish-status/route.ts` — Status endpoint
- `src/components/compose/PublishModal.tsx` — Publish modal UI
- `src/components/compose/PublishStatusView.tsx` — Status view component
- `src/app/compose/post/[id]/page.tsx` — Post detail page

### Files Modified (4 existing files)
- `src/lib/publish/index.ts` — Updated factory for MetaPublisher
- `src/lib/oauth/meta.ts` — Added fetchIdentityWithPages()
- `src/lib/oauth/complete.ts` — Added per-page social_account creation
- `src/app/compose/new/page.tsx` — Added Publish Now button + modal

### Test Files (2 new files)
- `src/lib/publish/meta.test.ts` — 7 unit tests
- `src/app/api/posts/__tests__/publish.test.ts` — 4 integration tests

## Verification Status

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript compile | Pending | `npx tsc` — no network to install deps in sandbox |
| Unit tests | Pending | `npx vitest run src/lib/publish/meta.test.ts` — requires DB/network |
| Integration tests | Pending | `npx vitest run src/app/api/posts/__tests__/publish.test.ts` — requires DB/network |
| Phase 4 requirements | Coded | PUBL-01 (immediate publish), PUBL-02 (per-platform adapter), PUBL-03 (per-target tracking) |
| Decisions respected | All 14 | D-01 through D-14 implemented as specified in CONTEXT.md |
| Worker unchanged | Confirmed | `worker.ts` unchanged — processes Meta jobs via `getPublisher("meta")` |

## Requirements Coverage

| Requirement | Coverage |
|-------------|----------|
| PUBL-01 (Immediate publish) | `POST /api/posts/[id]/publish` + PublishModal + BullMQ delay=0 |
| PUBL-02 (Per-platform adapter) | `MetaPublisher` implementing `Publisher` + factory gating via `PUBLISHER_MODE=real` |
| PUBL-03 (Per-target status) | `publish_targets` status tracking + `GET /api/posts/[id]/publish-status` + `PublishStatusView` polling |

## Decisions Applied

- D-01: Media upload in publish(), not prepare()
- D-02: Media via public R2 URL (photo: `url=`, video: `file_url=`)
- D-03: Videos use public URL via file_url
- D-04: Text-only fallback with "published (media failed)" if media fails
- D-05: Empty selector — user actively chooses Facebook accounts
- D-06: Facebook only in Phase 4 selector
- D-07: Separate selectors for publish vs schedule
- D-08: Button grayed with tooltip when no FB accounts
- D-09: Button at end of composer alongside Schedule
- D-10: Modal on click with checkbox selector
- D-11: Toast (via router redirect) + post detail view with polling
- D-12: Double mechanism: preventive banner + error detection
- D-13: App review check at OAuth time via Meta API
- D-14: Let Meta gate in dev mode — app does not block UI

## Verification Gates (Human Required)

1. `npm install` in a networked environment
2. Provision Postgres + `npx drizzle-kit push`
3. Provision Redis
4. Set `META_CLIENT_ID`, `META_CLIENT_SECRET`, `PUBLISHER_MODE=real` for real Meta publishing
5. `npm run build` (Next + TS compile)
6. `npm run test` (vitest: all Phase 4 tests)
7. Manual: create client → connect Meta → compose post → click Publish Now → select FB page → confirm → verify target transitions to running→published
