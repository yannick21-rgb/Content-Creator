---
status: testing
phase: 06-publish-to-linkedin
source: 06-01-SUMMARY.md
started: 2026-07-12T20:59:00Z
updated: 2026-07-12T20:59:00Z
---

## Current Test

number: 1
name: LinkedInPublisher.prepare() validates LinkedIn limits
expected: |
  Calling prepare() with valid text-only post returns ready: true.
  Calling prepare() with text + JPEG/PNG/GIF image returns ready: true.
  Calling prepare() with text > 700 chars returns errors containing "700 character limit".
  Calling prepare() with 2+ media items returns errors containing "does not support carousel".
  Calling prepare() with video returns errors about unsupported video.
  Calling prepare() with unsupported image format (e.g. webp) returns errors about JPEG/PNG/GIF.
awaiting: user response

## Tests

### 1. LinkedInPublisher.prepare() validates LinkedIn limits
expected: |
  Calling prepare() with valid text-only post returns ready: true.
  Calling prepare() with text + JPEG/PNG/GIF image returns ready: true.
  Calling prepare() with text > 700 chars returns errors containing "700 character limit".
  Calling prepare() with 2+ media items returns errors containing "does not support carousel".
  Calling prepare() with video returns errors about unsupported video.
  Calling prepare() with unsupported image format (e.g. webp) returns errors about JPEG/PNG/GIF.
result: [pending]

### 2. LinkedInPublisher.publish() text-only post
expected: |
  Calling publish() with a text-only post and valid LinkedIn user ID returns { success: true, platformRef: "urn:li:share:..." }.
  The fetch call to POST /rest/posts uses Authorization: Bearer, LinkedIn-Version: 202606, and X-Restli-Protocol-Version: 2.0.0 headers.
  The post body includes author URN, commentary text, visibility: PUBLIC, lifecycleState: PUBLISHED.
  The platformRef is read from the x-restli-id response header.
result: [pending]

### 3. LinkedInPublisher.publish() text + single image
expected: |
  Calling publish() with text + single JPEG image performs a multi-step flow:
  1. POST /rest/images?action=initializeUpload to get uploadUrl and image URN
  2. GET the image binary from public URL
  3. PUT binary to the LinkedIn uploadUrl (no Authorization header)
  4. POST /rest/posts with content.media.id set to the image URN
  Returns { success: true, platformRef: "urn:li:share:..." }.
result: [pending]

### 4. LinkedInPublisher.publish() media upload fallback
expected: |
  Calling publish() with text + single image where the image upload to LinkedIn fails
  still creates the post as text-only and returns { success: true, error: "published (media failed)" }.
result: [pending]

### 5. LinkedInPublisher.publish() error handling
expected: |
  Calling publish() with an invalid or expired token returns { success: false, error: "LinkedIn API error: 401 ..." } with serviceErrorCode included.
  Calling publish() without a LinkedIn user ID returns { success: false, error: "No LinkedIn user ID in target" }.
result: [pending]

### 6. LinkedInPublisher.verify() returns published
expected: |
  Calling verify() with any target ID and platformRef returns { status: "published", platformRef }.
result: [pending]

### 7. Factory returns LinkedInPublisher for "linkedin" platform
expected: |
  getPublisher("linkedin") with PUBLISHER_MODE=real returns a LinkedInPublisher instance.
  getPublisher("linkedin") with PUBLISHER_MODE=fake returns FakePublisher.
  The platform property of LinkedInPublisher is "linkedin".
result: [pending]

### 8. Publish route accepts "linkedin" accounts
expected: |
  The inArray filter in src/app/api/posts/[id]/publish/route.ts includes "linkedin" alongside "meta" and "instagram".
  Existing Meta and Instagram account filtering still works (backward compatible).
result: [pending]

### 9. PublishModal shows LinkedIn tab
expected: |
  PublishModal accepts a linkedinAccounts prop in its interface.
  The Tab type includes "linkedin" as a valid value.
  The tab bar shows "Linkedin (N)" button after the Instagram button.
  The currentAccounts mapping switches to linkedinAccounts when activeTab is "linkedin".
  hasAnyAccounts includes linkedinAccounts.length > 0.
result: [pending]

### 10. PublishModal reconnect badge for expiring tokens
expected: |
  LinkedIn accounts within 7 days of expiry show a red "Reconnect required" badge next to the account name.
  The account checkbox is disabled for reconnect-required accounts.
  A "Reconnect now →" link pointing to /clients is displayed under the disabled account.
  Non-expired LinkedIn accounts are selectable normally.
result: [pending]

### 11. Composer shows LinkedIn carousel unsupported notice
expected: |
  When 2+ media items are added, a yellow notice appears: "LinkedIn: Carousel posts are not supported on LinkedIn. Facebook and Instagram support carousels."
  The notice only shows when mediaCount >= 2.
result: [pending]

### 12. Composer fetches LinkedIn accounts on mount
expected: |
  On page mount, a fetch to /api/social-accounts?platform=linkedin is made alongside the existing meta and instagram fetches.
  linkedinAccounts state is passed to PublishModal.
  The "Publish Now" button is enabled if any LinkedIn accounts exist.
result: [pending]

### 13. Unit test suite passes
expected: |
  Running npx vitest run src/lib/publish/linkedin.test.ts passes all 16 tests covering:
  9 prepare tests (valid text, valid text+image, valid PNG, valid GIF, empty, over 700 chars, carousel, video, unsupported format)
  5 publish tests (text-only, text+image, auth error, media fallback, missing user ID)
  1 verify test (returns published status)
result: [pending]

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0
blocked: 0

## Gaps

(none yet)
