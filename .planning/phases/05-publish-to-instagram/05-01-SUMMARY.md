# Plan 05-01 Summary: InstagramPublisher + IG Container Flow

**Phase:** 5 — Publish to Instagram (incl. Carousels)
**Status:** Code complete — verification pending
**Date:** 2026-07-12

## Tasks Executed

### Implementation Tasks

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 5-1-1 | Update PublishPlatform type + schema constraint | `src/lib/publish/provider.ts` (added "instagram") + `src/lib/db/schema.ts` (platform check) | Complete |
| 5-1-2 | InstagramPublisher implementation | `src/lib/publish/instagram.ts` — implements `Publisher` for IG Container API | Complete |
| 5-1-3 | Update publisher factory + OAuth completion | `src/lib/publish/index.ts` (InstagramPublisher factory) + `src/lib/oauth/complete.ts` (IG account rows) | Complete |
| 5-1-4 | Update PublishModal for Instagram | `src/components/compose/PublishModal.tsx` — added tabs (FB/IG) | Complete |
| 5-1-5 | Add IG warnings in composer | `src/app/compose/new/page.tsx` — IG caption 2200 warning, fetch IG accounts | Complete |
| 5-1-6 | Update publish API endpoint | `src/app/api/posts/[id]/publish/route.ts` — accept "meta" + "instagram" accounts | Complete |
| 5-1-7 | Tests | `src/lib/publish/instagram.test.ts` — 10 unit tests | Complete |

### Files Created (2 new files)
- `src/lib/publish/instagram.ts` — InstagramPublisher adapter
- `src/lib/publish/instagram.test.ts` — Unit tests

### Files Modified (6 existing files)
- `src/lib/publish/provider.ts` — added `"instagram"` to `PublishPlatform`
- `src/lib/publish/index.ts` — factory returns `InstagramPublisher` for platform "instagram"
- `src/lib/db/schema.ts` — updated platform check constraint
- `src/lib/oauth/complete.ts` — creates IG `social_account` rows during Meta OAuth
- `src/components/compose/PublishModal.tsx` — added Instagram tab
- `src/app/compose/new/page.tsx` — fetches IG accounts, passes to PublishModal
- `src/app/api/posts/[id]/publish/route.ts` — validates "meta" + "instagram" accounts

## Verification Status

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript compile | Pending | `npx tsc` — no network |
| Unit tests | Pending | `npx vitest run src/lib/publish/instagram.test.ts` |
| Integration tests | Pending | Requires DB + network |
| Decisions respected | All 12 | D-01 through D-12 implemented |
| Worker unchanged | Confirmed | `worker.ts` unchanged — processes IG via `getPublisher("instagram")` |

## Decisions Applied

- D-01: Two-step publish (create container → publish) dans `publish()`
- D-02: media_type = IMAGE/VIDEO/CAROUSEL selon le contenu
- D-03: Carrousels créent d'abord les conteneurs enfants
- D-04: 5s setTimeout entre create et publish
- D-05: IG Business Accounts stockés avec platform: "instagram"
- D-06: platformAccountId = IG user ID, name = username
- D-07: Caption limitée à 2200 chars (prepare() + composer)
- D-08: JPEG vérifié dans prepare()
- D-09: Pas de validation d'aspect ratio (laissé à IG)
- D-10: Carrousels 2-10 items validé
- D-11: PublishModal avec onglets Facebook/Instagram
- D-12: Erreurs IG affichées dans PublishStatusView

## Verification Gates (Human Required)

Same as Phase 4 + verify Instagram flow:
1. `npm install` + Postgres + Redis + set env vars
2. `npx drizzle-kit push` (updated platform check)
3. `npm run build` + `npm run test`
4. Manual: connect Meta (with IG Business Account) → verify IG account created → compose post with image → Publish Now → select IG → verify container→publish flow
