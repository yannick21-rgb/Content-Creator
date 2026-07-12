---
status: testing
phase: 02-composer-media-library
source: 02-01-SUMMARY.md
started: 2026-07-12T00:35:00Z
updated: 2026-07-12T00:35:00Z
---

## Current Test

number: 1
name: AppNav shows Compose link
expected: |
  After logging in as a team member, the navigation bar shows a "Compose" link.
  Clicking it navigates to /compose/new.
awaiting: user response

## Tests

### 1. AppNav shows Compose link
expected: After logging in, the nav shows a "Compose" link. Clicking it navigates to /compose/new.
result: [pending]

### 2. Create a text-only post
expected: On /compose/new, fill in the "Post Text" field and click "Save Post". The app saves the post and redirects to /compose/post/{id}, showing the saved text.
result: [pending]

### 3. Platform validation warnings
expected: Enter text exceeding 2200 characters. A yellow warning box appears below the text area, showing warnings like "IG: 2200 char limit" and "LinkedIn: 700 char limit".
result: [pending]

### 4. Edit an existing post
expected: On /compose/post/{id}, modify the text and click "Save". The page reloads with updated text and shows "Saved" confirmation.
result: [pending]

### 5. Media upload returns presigned URL
expected: POST /api/media/upload with contentType and fileName returns {"success": true, "presignedUrl": "...", "publicUrl": "...", "key": "..."}.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

[none yet]
