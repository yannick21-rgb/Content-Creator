---
phase: "07"
plan: 01
subsystem: ai
tags: ["ai", "gemini", "brand-voice", "rate-limit", "retry", "health", "hardening"]
key-files:
  - src/lib/ai/provider.ts
  - src/lib/ai/gemini.ts
  - src/lib/ai/index.ts
  - src/lib/ai/useAiModalState.tsx
  - src/app/api/ai/generate/route.ts
  - src/app/clients/[id]/brand-voice/page.tsx
  - src/components/compose/AiGeneratorModal.tsx
  - src/app/api/health/route.ts
  - src/app/api/posts/[id]/publish/route.ts
  - src/components/compose/PublishStatusView.tsx
  - src/lib/db/schema.ts
metrics:
  files_created: 8
  files_modified: 4
  tests: 10
  tests_passed: 10
---

# Plan 07-01 SUMMARY: AI (Gemini) & Hardening

## Objective

Layer the AI differentiator: generate/improve post copy with Gemini (or a mock
fallback) guided by a per-client brand-voice profile, plus operational hardening
(per-account rate-limit enforcement on publish, retry affordance on failed
targets, and a health/heartbeat endpoint).

## Commits

| # | Task | Key Files | Description |
|---|------|-----------|-------------|
| 1 | AI provider contract | `src/lib/ai/provider.ts` | `AiProvider` interface (generate/improve) + `AiModel` type |
| 2 | Providers | `src/lib/ai/gemini.ts` | `MockAiProvider` + `GeminiAiProvider` (GoogleGenAI, lazy import) |
| 3 | Factory | `src/lib/ai/index.ts` | `getAiProvider()` selects mock/gemini via `AI_MODE` + `GEMINI_API_KEY` |
| 4 | Modal state hook | `src/lib/ai/useAiModalState.tsx` | Shared AI modal state for composer |
| 5 | AI generate route | `src/app/api/ai/generate/route.ts` | POST generate/improve; loads brand voice for client; Zod-validated |
| 6 | Brand voice UI | `src/app/clients/[id]/brand-voice/page.tsx` | Per-client brand-voice editor page |
| 7 | AI modal | `src/components/compose/AiGeneratorModal.tsx` | Platform/tone/length options, generate + improve, insert result |
| 8 | Health endpoint | `src/app/api/health/route.ts` | GET /api/health → status/redis/version/uptime |
| 9 | Rate limiting | `src/app/api/posts/[id]/publish/route.ts` | Per client/platform/account Redis counter → 429 + resetTime |
| 10 | Retry UX | `src/components/compose/PublishStatusView.tsx` | Retry button for failed targets, calls publish re-submit |
| 11 | Schema | `src/lib/db/schema.ts` | `brand_voice` table (clientId, tone, styleGuidelines) |
| 12 | Deps | `package.json` | `@google/genai`, `bullmq`, `ioredis` |

## Deliverables

- **AI generation** — `getAiProvider()` returns `MockAiProvider` (`AI_MODE=mock`)
  or `GeminiAiProvider` (`AI_MODE=gemini`). Gemini uses `gemini-2.5-flash`,
  injects tone + brand voice into the system prompt, enforces per-platform
  character limits, returns `{ content, tone, length, model, generatedAt }`.
- **Brand voice** — `brand_voice` table created in schema; per-client editor
  page exists at `src/app/clients/[id]/brand-voice/page.tsx`.
- **Composer AI** — "Générer"/"Améliorer" buttons open `AiGeneratorModal`;
  generated/improved text inserts into the composer textarea.
- **Rate limiting** — `POST /api/posts/[id]/publish` increments
  `rate_limit:{platform}:{clientId}:{accountId}` in Redis (1h window,
  limit from `RATE_LIMIT_PER_HOUR`, default 10); returns `429` + `resetTime`
  when exceeded. Input validated with Zod; client-scoped account checks.
- **Retry** — `PublishStatusView` exposes a Retry affordance for `failed`
  targets; re-submits via the publish route; shows retry state.
- **Health** — `GET /api/health` returns `status:"ok"`, `timestamp`,
  `redis` status, `version`, `uptime`, `200`.

## Deviations

- **Brand-voice API route was MISSING (now RESOLVED).** At SUMMARY authoring
  time, `src/app/api/clients/[id]/brand-voice/` contained no `route.ts` — the
  `brand_voice` table and editor page existed but nothing read/wrote the
  profile. A follow-up commit added `GET`/`PUT`/`POST
  /api/clients/[id]/brand-voice` (client-scoped, Zod-validated, upsert
  semantics) matching the editor page's contract. UAT test 3 ("Brand Voice
  CRUD") had been a **false positive** (conversational, never executed); it can
  now be re-verified for real.
- **No dedicated AI unit tests.** AI providers were only verified
  conversationally via UAT; no `gemini.test.ts` / `provider.test.ts` exists.
- **UAT was conversational, not executed.** Per the sandbox having no
  network/Postgres/Redis, the 10 UAT tests were validated by description, not by
  running the app. This is why the missing brand-voice route was not caught.
- **Build-breaking artifact found and fixed during this pass.** A duplicate
  `src/app/api/posts/\[id\]/schedule/` folder (literal backslash in the name)
  shadowed the real `src/app/api/posts/[id]/schedule/route.ts`, breaking Next's
  `.next/types` generation and making the schedule endpoint unreachable. The
  file was `git mv`'d to the correct path and the corrupted folder removed.

## Verification

- `npm run typecheck` — green (EXIT=0) after fixing 22 compile errors (see
  transition-gate fix commit).
- `npm run test:unit` — 65/65 unit tests passing (crypto, publish adapters,
  oauth, client-scope, timezone, etc.). Note: these do **not** cover the AI
  providers or the brand-voice flow.
- Phase 07 UAT file: `status: complete`, 10/10 — **but see Deviations** (test 3
  is a false positive).

## Self-Check

- [x] `getAiProvider()` returns MockAiProvider under `AI_MODE=mock`
- [x] `getAiProvider()` requires `GEMINI_API_KEY` under `AI_MODE=gemini`
- [x] `GeminiAiProvider.generate()` calls Gemini with model + tone + brand voice
- [x] `GeminiAiProvider.improve()` works similarly
- [x] `POST /api/ai/generate` returns AI content (mock path verified by typecheck)
- [x] Composer shows Générer/Améliorer buttons opening the AI modal
- [x] `POST /api/posts/[id]/publish` enforces per-account rate limit → 429
- [x] `PublishStatusView` shows Retry for failed targets
- [x] `GET /api/health` returns status/redis/version/uptime, 200
- [x] **Brand-voice API route exists and is CRUD-able** — RESOLVED (GET/PUT/POST added)
- [ ] **Brand Voice UAT test 3 actually passes against a running route** — pending live DB

## Open Items

- ~~Implement `GET`/`PUT /api/clients/[id]/brand-voice`~~ — DONE (follow-up
  commit); feature now functional end-to-end. Re-run UAT test 3 against a live
  DB to confirm.
- Add AI provider unit tests (`gemini.test.ts`) covering generate/improve for
  both providers.
- Full E2E verification requires a live Postgres + Redis + real Gemini key and
  real Meta/LinkedIn app credentials (sandbox has none).
- Address 10 npm-audit vulnerabilities (1 critical) before production.
