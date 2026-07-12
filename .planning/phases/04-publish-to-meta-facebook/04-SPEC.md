# Phase 4: Publish to Meta (Facebook) — Specification

**Created:** 2026-07-12
**Ambiguity score:** 0.2775 (gate: ≤ 0.20) — accepted by user via skip-interview
**Requirements:** 5 locked

## Goal

Team can publish a composed post immediately to one or more connected Facebook pages via the per-platform Publisher adapter, with per-target publish status tracked through the existing state machine (scheduled → running → published/failed).

## Background

The project's publish pipeline is fully scaffolded through Phase 3: a `Publisher` interface with `prepare/publish/verify` methods, a `FakePublisher` default implementation, a BullMQ queue with `enqueuePublishJob()`, a worker process that decrypts tokens and calls the publisher, and a `publish_targets` table with per-target status tracking. No platform-specific publisher exists yet. Meta OAuth (`src/lib/oauth/meta.ts`) exchanges codes for long-lived tokens and fetches a single page identity via `/me/accounts`, but only stores the user token; per-page page tokens are not captured, and no `MetaPublisher` adapter implements the `Publisher` interface. The composer (`src/app/compose/new/page.tsx`) has a "Schedule" button but no "Publish Now" button. No immediate-publish API endpoint exists. The post detail view (`/compose/post/[id]`) does not exist yet.

## Requirements

1. **MetaPublisher adapter**: A `MetaPublisher` class implements the `Publisher` interface for the Meta Graph API.
   - Current: Only `FakePublisher` exists — no platform-specific publisher
   - Target: `MetaPublisher` at `src/lib/publish/meta.ts` implements `prepare()` (validates text length ≤ 63,206 chars, media presence), `publish()` (calls Meta Graph API endpoints to upload media and publish feed posts), and `verify()` (returns published status from Meta post ID)
   - Acceptance: `MetaPublisher` passes all unit tests with mocked fetch; `getPublisher("meta")` returns `MetaPublisher` when `PUBLISHER_MODE=real`

2. **Per-page Facebook token storage**: OAuth connection with Meta creates one `social_account` row per Facebook page, storing the page-scoped token.
   - Current: Meta OAuth stores one `social_account` with the user-level long-lived token and only the first page's identity
   - Target: `getMetaPages()` at `src/lib/publish/meta-pages.ts` fetches all pages via `GET /me/accounts?fields=id,name,access_token`; Meta OAuth completion creates one `social_account` per page with encrypted page token, page ID as `platformAccountId`, and page name as `name`
   - Acceptance: After Meta OAuth connects, the `social_account` table contains one row per Facebook page, each with a distinct `platformAccountId` matching a Facebook page ID

3. **Immediate publish API**: `POST /api/posts/[id]/publish` accepts a list of Facebook page IDs and initiates immediate publish.
   - Current: Only `POST /api/posts/[id]/schedule` exists for delayed publish; no immediate-publish endpoint
   - Target: `POST /api/posts/[id]/publish` validates the post belongs to the active client, validates all `socialAccountIds` are Meta pages belonging to that client, creates `publish_targets` rows with status "scheduled", enqueues BullMQ jobs with delay=0, and returns 201 with target IDs
   - Acceptance: Sending a valid POST to the endpoint creates `publish_targets` rows, enqueues BullMQ jobs, and returns 201; sending with non-Meta account IDs returns 404; unauthenticated requests return 401

4. **Per-target publish status UI**: A post detail view shows live publish status per Facebook page with 3-second polling.
   - Current: No `/compose/post/[id]` page exists; no publish status display
   - Target: `GET /api/posts/[id]/publish-status` returns per-target statuses with `socialAccountName`, `status`, `errorMessage`, `publishedAt`, and aggregate flags `allPublished`/`anyFailed`; `PublishStatusView` component polls this endpoint and renders color-coded status badges per target, stopping when all targets resolve
   - Acceptance: Status endpoint returns correct per-target data; component renders badges for scheduled/running/published/failed; polling stops after all targets reach terminal state (published/failed)

5. **Publish UI in composer**: The compose page has a "Publish Now" button that opens a Facebook account selector modal.
   - Current: Composer has "Schedule" button only; no publish affordance
   - Target: "Publish Now" button at end of composer, grayed out with tooltip when no Facebook pages connected; `PublishModal` shows Facebook account checkboxes, confirms publish, shows "Publishing..." toast, then redirects to post detail view
   - Acceptance: Button is grayed when client has no Facebook accounts; clicking it opens modal with Facebook-only account list; confirming publishes via the API and redirects to `/compose/post/[id]` with status polling active

## Boundaries

**In scope:**
- `MetaPublisher` class implementing `Publisher` (prepare, publish, verify)
- `getMetaPages()` helper to fetch all pages via Meta Graph API
- Per-page `social_account` rows created during Meta OAuth completion
- `POST /api/posts/[id]/publish` endpoint for immediate publish
- `GET /api/posts/[id]/publish-status` endpoint for per-target status
- "Publish Now" button in composer (grayed when no FB pages connected)
- `PublishModal` component with Facebook account selector and confirm
- `PublishStatusView` component with 3-second polling
- Post detail page at `/compose/post/[id]`
- Meta app review status check (`checkMetaAppReview`) callable at OAuth time
- Text-only posts, single-image posts, multi-image posts, and video posts published to Facebook feed
- Text-only fallback when media upload fails ("published (media failed)")
- Media upload via public R2 URL (no server-side media processing)

**Out of scope:**
- Instagram publishing — Phase 5 (carousel flow, IG container API)
- LinkedIn publishing — Phase 6 (different API, 60-day re-auth)
- Scheduled publishing via the UI — Phase 3 already handles this via the "Schedule" button
- Carousel/multi-image container flow for Instagram — Phase 5
- Rate-limit enforcement per account — Phase 7 / v2 (SCHD-06)
- Dead-letter queue UI — v2 (OPS-02)
- Automatic token refresh before publish — left to agent's discretion for this phase
- Direct API call to MetaPublisher (bypassing worker) — left to agent's discretion; worker with delay=0 is the default path
- Instagram Business Account discovery or connection — the existing OAuth scopes include `instagram_business_basic` but actual IG publishing is Phase 5
- Facebook page creation or management — pages must already exist and be manageable by the authenticating user

## Constraints

- Must use the existing `Publisher` interface from `src/lib/publish/provider.ts` — no new publish method signatures
- Must use the existing BullMQ queue/worker for publish processing (worker.ts) — consistency with the scheduler pipeline
- Must use the existing `publish_targets` table for per-target status — no new status tables
- Page tokens must be stored encrypted at rest using the existing `crypto.ts` (AES-256-GCM)
- Factory gating: `PUBLISHER_MODE` env var controls fake vs real; default is `fake`
- Meta Graph API v22.0 (matching existing `src/lib/oauth/meta.ts`)
- Media must be accessible at a public URL (R2 presigned URL or direct CDN URL) — Meta must be able to fetch them
- No new npm dependencies beyond what's already in package.json

## Acceptance Criteria

- [ ] `MetaPublisher.prepare()` rejects text > 63,206 characters and posts with no text and no media
- [ ] `MetaPublisher.publish()` calls Meta Graph API `/feed` (text), `/photos` (single image), or `/videos` with `file_url`; returns `{ success, platformRef }`
- [ ] `MetaPublisher.publish()` returns "published (media failed)" error when media upload fails but text succeeds (D-04)
- [ ] `getMetaPages(userToken)` returns all pages from `/me/accounts` with id, name, and pageToken
- [ ] Meta OAuth completion creates one `social_account` per Facebook page with encrypted page token
- [ ] `POST /api/posts/[id]/publish` creates publish_targets and enqueues a BullMQ job per target
- [ ] `POST /api/posts/[id]/publish` rejects non-Meta account IDs with 404
- [ ] `GET /api/posts/[id]/publish-status` returns per-target statuses with aggregate flags
- [ ] "Publish Now" button is grayed when client has 0 Facebook pages
- [ ] "Publish Now" opens modal with Facebook-only account checkboxes
- [ ] Confirming publish in modal redirects to `/compose/post/[id]` with status polling
- [ ] PublishStatusView shows color-coded status badges (scheduled=blue, running=yellow, published=green, failed=red)
- [ ] PublishStatusView stops polling when all targets are published or any target failed
- [ ] `getPublisher("meta")` with `PUBLISHER_MODE=real` returns `MetaPublisher`
- [ ] `getPublisher("meta")` with `PUBLISHER_MODE=fake` (or unset) returns `FakePublisher`
- [ ] All unit tests pass: `src/lib/publish/meta.test.ts`, `src/app/api/posts/__tests__/publish.test.ts`

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                              |
|--------------------|-------|------|--------|------------------------------------|
| Goal Clarity       | 0.75  | 0.75 | ✓      | Clear from roadmap + CONTEXT.md    |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | Explicit Facebook-only scope       |
| Constraint Clarity | 0.60  | 0.65 | ⚠      | Page token fetch timing (OAuth vs publish) and rate-limit strategy not pinned — planner should treat as assumption |
| Acceptance Criteria| 0.70  | 0.70 | ✓      | 16 pass/fail criteria covering all requirements |
| **Ambiguity**      | 0.2775| ≤0.20| ⚠      | Accepted via skip-interview; constraint clarity below minimum — planner must treat as assumption |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

**Flagged assumptions:**
1. **Page token fetch timing**: The exact strategy for acquiring page tokens is split between OAuth-time fetch (Task 4-1-2) and potential publish-time refresh. The planner may find that fetching pages at OAuth time is sufficient or that a just-in-time strategy is more reliable. Either approach satisfies constraints.
2. **Rate-limit handling**: No per-account rate-limit enforcement in this phase. Meta API rate-limit errors will surface as per-target `failed` statuses. If Meta returns rate-limit errors, the worker's exponential backoff (3 retries) applies, but no account-level rate-limit tracking is built.

## Interview Log

| Round | Perspective     | Question summary              | Decision locked                         |
|-------|-----------------|------------------------------|-----------------------------------------|
| —     | (skipped)       | User chose to skip interview | SPEC.md written from ROADMAP + REQUIREMENTS + existing CONTEXT.md; unresolved dimensions flagged as ⚠ assumptions |

---

*Phase: 04-publish-to-meta-facebook*
*Spec created: 2026-07-12*
*Next step: /gsd-discuss-phase 4 — implementation decisions (how to build what's specified above)*
