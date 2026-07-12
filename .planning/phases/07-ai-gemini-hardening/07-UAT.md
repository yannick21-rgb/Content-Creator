---
status: complete
phase: 07-ai-gemini-hardening
source: 07-RESEARCH.md, 07-UI-SPEC.md, 07-CONTEXT.md
started: 2026-07-12T22:40:00Z
updated: 2026-07-12T22:55:00Z
---

## Current Test

number: 0
name: Complete
type: none

expected: |
  All 10 UAT tests passed. Phase 07 UAT complete.

awaiting: none

## Tests

### 1. AI Provider Factory
type: unit
expected: |
  getAiProvider() with AI_MODE=mock returns MockAiProvider instance
  The returned instance has generate() and improve() methods
  MockAiProvider.generate() accepts options with platform and tone
  MockAiProvider.improve() accepts text and options
result: pass

### 2. Gemini API Provider
type: unit
expected: |
  GeminiAiProvider.generate() accepts post, platform, tone, length options
  Calls the Gemini API with the correct model (gemini-2.5-flash)
  Includes the tone and brand voice in the system prompt
  Returns content, platform, tone, length, generatedAt
  GeminiAiProvider.improve() works similarly
result: pass

### 3. Brand Voice CRUD
type: integration
expected: |
  GET /api/clients/[id]/brand-voice returns empty tone "professional" if none set
  PUT /api/clients/[id]/brand-voice creates brand voice with tone and styleGuidelines
  PUT /api/clients/[id]/brand-voice updates existing brand voice
  brand voice is correctly applied to system prompt for Gemini generation
result: pass

### 4. AI Generation Route
type: integration
expected: |
  POST /api/ai/generate with valid body returns AI-generated content
  The route correctly fetches brand voice profile for the client
  Includes the correct platform, tone, and length options for the AI provider
  Returns proper error handling for AI failures
result: pass

### 5. Composer AI Buttons
type: ui
expected: |
  Composer page shows "Générer" button when textarea is empty
  Composer page shows "Améliorer" button when textarea has text
  The buttons open the AI Modal with correct initial text
  Generated content can be inserted into the textarea
  Improved content can be inserted into the textarea
result: pass

### 6. AI Modal Component
expected: |
  Modal correctly shows platform, tone, and length options
  Options can be selected and saved
  User can generate AI content without instructions
  User can improve existing text
  Result can be used via "Insérer" or "Utiliser comme amélioration"
result: pass

### 7. Rate Limiting on Publish
expected: |
  POST /api/posts/[id]/publish respects per-platform, per-hour rate limits
  If rate limit exceeded, returns 429 with resetTime
  Rate limits are stored in Redis by client/platform
result: pass

### 8. Retry Button on Failed Publish
expected: |
  PublishStatusView shows Retry button for failed targets
  Retry button re-submits the publish job for the failed target
  Retry state shows loading while trying
  Retry operation updates the publish status
result: pass

### 9. Health Check Endpoint
expected: |
  GET /api/health returns JSON with status: "ok"
  Includes timestamp, redis status, version, and uptime
  Returns 200 status code
result: pass

### 10. Cold Start Smoke Test
expected: |
  Kill any running server/service. Clear ephemeral state (temp DBs, caches, lock files)
  Start the application from scratch
  Server boots without errors
  Any seed/migration completes
  A primary query (health check) returns live data
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- YAML format for plan-phase --gaps consumption -->

---
UAT Verifiable: No existing UAT for Phase 07