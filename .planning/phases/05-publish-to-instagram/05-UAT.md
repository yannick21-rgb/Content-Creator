---
status: testing
phase: 05-publish-to-instagram
source: 05-01-SUMMARY.md
started: 2026-07-12T12:00:00Z
updated: 2026-07-12T12:00:00Z
---

## Current Test

number: 1
name: InstagramPublisher — single image
expected: |
  given a post with a single image and "instagram" platform,
  InstagramPublisher.publish() creates a media container
  via POST /{ig-user-id}/media (media_type=IMAGE)
  then publishes via POST /{ig-user-id}/media_publish.
  Returns { success: true, platform: "instagram", platformPostId: "..." }.
awaiting: user response

## Tests

### 1. InstagramPublisher — single image
expected: InstagramPublisher.publish() creates IMAGE container then publishes. Returns success.
result: [pending]

### 2. InstagramPublisher — single video
expected: InstagramPublisher.publish() creates VIDEO container then publishes. Returns success.
result: [pending]

### 3. InstagramPublisher — carousel (2-10 images)
expected: InstagramPublisher.publish() creates child IMAGE containers first, then CAROUSEL container, then publishes. Returns success.
result: [pending]

### 4. InstagramPublisher — carousel rejected (1 or 11+ items)
expected: InstagramPublisher.publish() with 1 or 11 child media returns an error "Carousel requires between 2 and 10 media items".
result: [pending]

### 5. InstagramPublisher — carousel rejected (video in carousel)
expected: InstagramPublisher.publish() with a video in carousel children returns error "Carousel children must all be images (IG restriction)".
result: [pending]

### 6. InstagramPublisher — text-only post fails
expected: InstagramPublisher.publish() with no media returns error "Instagram requires at least one media item".
result: [pending]

### 7. InstagramPublisher — caption > 2200 chars rejected
expected: InstagramPublisher.prepare() with caption > 2200 chars returns error "Instagram caption must be 2200 characters or fewer".
result: [pending]

### 8. InstagramPublisher — non-JPEG carousel image rejected
expected: If a carousel child media has contentType != "image/jpeg", prepare() returns error "Carousel images must be JPEG".
result: [pending]

### 9. PublishModal — Facebook / Instagram tabs
expected: When composing a post with both FB and IG accounts connected, the PublishModal shows two tabs: "Facebook" and "Instagram". Selecting each tab shows the accounts for that platform.
result: [pending]

### 10. Composer — IG caption warning
expected: On /compose/new, entering text > 2200 chars shows a yellow warning: "Instagram: caption limit is 2200 characters". Entering <= 2200 chars hides it.
result: [pending]

### 11. Composer — IG accounts fetched
expected: On /compose/new page load, IG accounts are fetched alongside FB accounts. Both are passed to PublishModal.
result: [pending]

### 12. OAuth — IG Business Account stored as social_account
expected: After connecting a Meta page that has a linked IG Business Account, the OAuth completion handler creates a row in social_accounts with platform: "instagram", platformAccountId set to the IG user ID, name set to the IG username.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps
