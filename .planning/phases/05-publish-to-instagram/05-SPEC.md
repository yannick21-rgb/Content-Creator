# Phase 5: Publish to Instagram (incl. Carousels) — Specification

**Created:** 2026-07-12
**Requirements:** extends PUBL-01, PUBL-02, PUBL-03 (Instagram coverage; no new IDs)

## Goal

Team can publish a composed post to one or more connected Instagram Business Accounts via the IG Container API, including multi-image carousels (2–10 items), reusing the Meta token store + worker behind the same adapter pipeline.

## Requirements

1. **InstagramPublisher adapter**: Implements `Publisher` for Meta Graph API IG Container endpoints.
   - Target: `InstagramPublisher` at `src/lib/publish/instagram.ts` with `prepare()` (validates caption ≤ 2200 chars, JPEG images, carousel 2–10 items), `publish()` (create IG container → wait → publish), `verify()` (check container status)
   - Acceptance: `InstagramPublisher` passes unit tests with mocked fetch

2. **IG Business Account storage**: Instagram accounts discovered during Meta OAuth stored as `social_account` rows with `platform: "instagram"`.
   - Target: During OAuth, for each page with `instagram_business_account`, create a `social_account` row with `platform: "instagram"`
   - Acceptance: After Meta OAuth, `social_account` table contains rows with `platform: 'instagram'`

3. **IG Carousel publishing**: Multi-image carousels (2–10 images) published via child containers + CAROUSEL container.
   - Target: Carousel media creates child containers first, then CAROUSEL container with `children` IDs, then publishes
   - Acceptance: Carousel with 3 images creates 3 child containers + 1 carousel container + 1 publish call

4. **Publish API + UI support**: Existing publish endpoint and PublishModal support Instagram accounts.
   - Target: POST /api/posts/[id]/publish accepts IG account IDs; PublishModal shows IG accounts alongside FB pages
   - Acceptance: Publishing to IG accounts creates publish_targets with platform "instagram"

5. **IG-specific validation**: Caption length (2200), image format (JPEG), carousel count (2-10) validated.
   - Target: Composer shows Instagram-specific warnings; InstagramPublisher.prepare() validates
   - Acceptance: Over-length caption, non-JPEG images, invalid carousel counts rejected by prepare()

## Boundaries

**In scope:**
- `InstagramPublisher` implementing `Publisher` for IG Container API
- Single image publishing (create IMAGE container → publish)
- Single video publishing (create VIDEO container → publish)
- Multi-image carousel publishing (create child containers → CAROUSEL container → publish)
- IG Business Account rows created during Meta OAuth
- PublishModal updated to include Instagram accounts
- IG caption length (2200) and JPEG format validation
- Carousel item count validation (2-10)
- Tests with mocked fetch

**Out of scope:**
- Facebook publishing — Phase 4
- LinkedIn publishing — Phase 6
- Instagram Stories / Reels
- Instagram Shopping / product tagging
- Hashtag generation or suggestion
- First-comment publishing
- Image format conversion (JPEG-only is an IG constraint)
- Aspect ratio validation
- IG rate-limit tracking (25/24h) — falls through to worker retry + error display

## Constraints

- Must implement `Publisher` interface exactly (prepare, publish, verify)
- Must use IG Container API (POST /{ig-id}/media + POST /{ig-id}/media_publish)
- Must reuse existing Meta OAuth token store (same Graph API token)
- No new npm dependencies
- Factory gating: `PUBLISHER_MODE` env var controls real vs fake

## Acceptance Criteria

- [ ] `InstagramPublisher.prepare()` rejects caption > 2200 chars
- [ ] `InstagramPublisher.prepare()` rejects non-JPEG images
- [ ] `InstagramPublisher.prepare()` rejects carousels with < 2 or > 10 items
- [ ] `InstagramPublisher.publish()` creates IMAGE container then publishes for single image
- [ ] `InstagramPublisher.publish()` creates child containers then CAROUSEL container for carousels
- [ ] `InstagramPublisher.publish()` waits between container creation and publishing
- [ ] `InstagramPublisher.publish()` returns success with platformRef from IG media ID
- [ ] `InstagramPublisher.publish()` returns error on IG API failure
- [ ] `InstagramPublisher.verify()` returns published status
- [ ] `PublishPlatform` type includes `"instagram"`
- [ ] `social_account_platform_check` constraint includes `'instagram'`
- [ ] Meta OAuth creates `social_account` rows with `platform: 'instagram'`
- [ ] `getPublisher("instagram")` with `PUBLISHER_MODE=real` returns `InstagramPublisher`
- [ ] PublishModal shows Instagram accounts in Phase 5
- [ ] Composer warns for IG caption > 2200 chars
- [ ] All unit tests pass: `src/lib/publish/instagram.test.ts`
