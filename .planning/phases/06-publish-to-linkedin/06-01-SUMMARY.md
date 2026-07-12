---
phase: "06"
plan: 01
subsystem: publish
tags: ["linkedin", "publisher", "publish", "adapter"]
key-files:
  - src/lib/publish/linkedin.ts
  - src/lib/publish/index.ts
  - src/app/api/posts/[id]/publish/route.ts
  - src/components/compose/PublishModal.tsx
  - src/app/compose/new/page.tsx
  - src/lib/publish/linkedin.test.ts
metrics:
  files_created: 2
  files_modified: 4
  tests: 16
  tests_passed: 16
---

# Plan 06-01 SUMMARY: LinkedIn Publisher Implementation

## Objective

Implement the LinkedIn per-platform `Publisher` adapter, enabling immediate publish of text and text+single-image posts to connected LinkedIn accounts. Surface 60-day token expiry with reconnect badges in PublishModal and disable expired tokens gracefully.

## Commits

| # | Task | Key Files | Description |
|---|------|-----------|-------------|
| 1 | LinkedInPublisher implementation | `src/lib/publish/linkedin.ts` | LinkedInPublisher with prepare/publish/verify, LinkedIn Images API + Posts API |
| 2 | Factory wiring | `src/lib/publish/index.ts` | Added LinkedInPublisher before FakePublisher fallback |
| 3 | Publish route update | `src/app/api/posts/[id]/publish/route.ts` | Added "linkedin" to platform allowlist filter |
| 4 | PublishModal LinkedIn tab | `src/components/compose/PublishModal.tsx` | LinkedIn tab with reconnect badge, disabled expired tokens, "Reconnect now" link |
| 5 | Composer updates | `src/app/compose/new/page.tsx` | LinkedIn accounts fetch, carousel unsupported notice, publish button fixed |
| 6 | Unit tests | `src/lib/publish/linkedin.test.ts` | 16 tests covering prepare/publish/verify with mocked fetch |

## Deliverables

- `src/lib/publish/linkedin.ts` — `LinkedInPublisher` implementing `Publisher`
  - `prepare()` validates: text ≤ 700 chars, single image only, JPEG/PNG/GIF format, no video, no carousel
  - `publish()` uses LinkedIn Images API (`POST /rest/images?action=initializeUpload`) for image upload + Posts API (`POST /rest/posts`) for post creation
  - `publish()` falls back to text-only with `"published (media failed)"` on image upload failure (D-03)
  - `publish()` reads post ID from `x-restli-id` response header
  - `publish()` uses `Authorization: Bearer`, `LinkedIn-Version: 202606`, `X-Restli-Protocol-Version: 2.0.0` headers
  - `verify()` returns published status
- `src/lib/publish/index.ts` — factory returns `LinkedInPublisher` for `"linkedin"` when `PUBLISHER_MODE=real`
- `src/app/api/posts/[id]/publish/route.ts` — platform allowlist includes `"linkedin"`
- `src/components/compose/PublishModal.tsx` — LinkedIn tab with account selector, reconnect badges (D-08), disabled expired tokens (D-11), reconnect link (D-10)
- `src/app/compose/new/page.tsx` — LinkedIn accounts fetched on mount, carousel unsupported notice for 2+ media (D-07), publish button enabled with any LinkedIn accounts
- `src/lib/publish/linkedin.test.ts` — 16 unit tests across prepare/publish/verify

## Deviations

- None. All decisions D-01 through D-14 from 06-CONTEXT.md are respected.
- Used Images API (`/rest/images?action=initializeUpload`) + Posts API (`/rest/posts`) per research recommendation.
- No schema changes needed — `social_account.platform` already includes `'linkedin'`, `PublishPlatform` type already has `"linkedin"`.
- Token decryption uses existing `crypto.ts` (AES-256-GCM).

## Verification

- `npx vitest run src/lib/publish/linkedin.test.ts` — 16/16 tests passing
- `LinkedInPublisher` implements `Publisher` interface (type-checked)
- `worker.ts` unchanged — already generic, calls `getPublisher("linkedin")`
- Backward compatible: Facebook/Instagram publish flows are unaffected

## Self-Check: PASSED

- [x] LinkedInPublisher implements Publisher interface (prepare + publish + verify)
- [x] prepare() validates text ≤ 700 chars
- [x] prepare() validates single image only (no carousel, no video)
- [x] prepare() validates JPEG/PNG/GIF format only
- [x] prepare() rejects carousel posts (2+ media)
- [x] publish() uses LinkedIn Images API for upload
- [x] publish() creates post via Posts API with author URN, commentary, PUBLIC visibility
- [x] publish() attaches image via content.media.id when upload succeeds
- [x] publish() falls back to text-only with "published (media failed)" on image failure
- [x] publish() uses Bearer auth + LinkedIn-Version headers
- [x] publish() includes raw serviceErrorCode in error on failure
- [x] verify() returns published status with platformRef
- [x] Factory returns LinkedInPublisher for "linkedin" in real mode
- [x] Publish route accepts "linkedin" platform accounts
- [x] PublishModal shows LinkedIn tab with reconnect badges
- [x] Expired LinkedIn tokens are disabled in selector
- [x] Composer shows carousel unsupported notice for 2+ media items
- [x] Composer fetches LinkedIn accounts on mount
- [x] All 16 tests pass

## Open Items

- Full E2E verification requires: `npm install`, `npx drizzle-kit push`, `npm run build`, real LinkedIn API access with approved app
- LinkedIn app-review risk: publishing will fail with 403 if app not approved for `w_member_social`
- LinkedIn-Version `"202606"` may need fallback to `"202405"` if 400 errors occur
