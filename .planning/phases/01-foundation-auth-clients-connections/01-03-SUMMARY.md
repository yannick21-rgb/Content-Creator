---
phase: 01-foundation-auth-clients-connections
plan: 03
subsystem: auth
tags: [oauth, encryption, aes-256-gcm, meta, linkedin, reconnect, connection-status]

# Dependency graph
requires:
  - phase: 01-01
    provides: schema (social_account, oauth_state), auth, db client
  - phase: 01-02
    provides: client scoping helpers, connections landing, nav switcher
provides:
  - OAuthProvider abstraction (mock + real Meta/LinkedIn) selected by OAUTH_PROVIDER_MODE
  - AES-256-GCM token vault (encrypt/decrypt, TOKEN_ENCRYPTION_KEY)
  - connect/callback/reconnect endpoints with PKCE + state-CSRF + client binding (D-06)
  - "Reconnect required" state via statusFor 7-day rule (CONN-04)
  - ConnectionCard UI + nav badges wired to real per-client connection summary (D-05)
affects: [phase-4, phase-5, phase-6]

# Tech tracking
tech-stack:
  added: []
  patterns: [OAuthProvider interface shared by mock/real; encrypt at boundary before insert; status computed server-side; token fields never serialized]

key-files:
  created:
    - src/lib/crypto.ts
    - src/lib/connection-status.ts
    - src/lib/oauth/provider.ts
    - src/lib/oauth/mock.ts
    - src/lib/oauth/meta.ts
    - src/lib/oauth/linkedin.ts
    - src/lib/oauth/index.ts
    - src/lib/oauth/pkce.ts
    - src/lib/oauth/start.ts
    - src/lib/oauth/callback.ts
    - src/lib/oauth/complete.ts
    - src/app/api/clients/[id]/connections/meta/start/route.ts
    - src/app/api/clients/[id]/connections/meta/callback/route.ts
    - src/app/api/clients/[id]/connections/meta/mock-authorize/route.ts
    - src/app/api/clients/[id]/connections/linkedin/start/route.ts
    - src/app/api/clients/[id]/connections/linkedin/callback/route.ts
    - src/app/api/clients/[id]/connections/linkedin/mock-authorize/route.ts
    - src/app/api/clients/[id]/connections/[accountId]/reconnect/route.ts
    - src/app/api/clients/[id]/connections/route.ts
    - src/components/connections/ConnectionCard.tsx
    - src/lib/crypto.test.ts
    - src/lib/connection-status.test.ts
    - src/lib/oauth/meta.test.ts
    - src/lib/oauth/linkedin.test.ts
  modified:
    - src/app/api/clients/route.ts (GET returns connected_count + reconnect_required_count)
    - src/components/nav/ClientSwitcher.tsx (real badges from summary)
    - src/app/clients/[id]/connections/page.tsx (renders ConnectionCards)

key-decisions:
  - "Mock provider implements the SAME OAuthProvider interface/state machine as real, so the full connect→encrypt→persist→'connected' path is provable with zero approved-app credentials (PITFALL 6)."
  - "Meta exchangeCode performs the fb_exchange_token long-lived swap before persistence (PITFALL 2); LinkedIn treats 60-day token as non-refreshable (PITFALL 1)."
  - "oauthState stores the PKCE verifier + clientId server-side; the clientId embedded in state binds the new connection to the active client (D-06)."

patterns-established:
  - "completeOAuthConnection(): verify state → exchange → fetchIdentity → encrypt → insert socialAccount. Single boundary for encryption."
  - "GET /api/clients/[id]/connections omits iv/tag/ciphertext; GET /api/clients carries only counts (CONN-03)."

requirements-completed: [CONN-01, CONN-02, CONN-03, CONN-04]

# Metrics
duration: n/a (offline sandbox — code written, not executed)
completed: 2026-07-11
---

# Phase 01 Plan 03 Summary

**OAuth connection + encrypted token-vault vertical slice: OAuthProvider abstraction (mock + real Meta/LinkedIn), AES-256-GCM vault, connect/callback/reconnect endpoints with PKCE + client binding, and the "Reconnect required" state with one-click re-auth.**

## Performance

- **Duration:** n/a (sandbox)
- **Started:** 2026-07-11
- **Completed:** 2026-07-11
- **Tasks:** 3 (3-1 provider+vault+status+unit tests, 3-2 endpoints+UI+integration tests, 3-3 nav badges from real summary)
- **Files modified:** 24

## Accomplishments
- `src/lib/crypto.ts` — AES-256-GCM via Node `crypto`; unique IV per encryption; key from `TOKEN_ENCRYPTION_KEY` (32-byte base64); throws if missing.
- `src/lib/oauth/*` — `OAuthProvider` interface, `MockOAuthProvider` (both platforms), `MetaOAuthProvider` (long-lived exchange), `LinkedInOAuthProvider`, factory by `OAUTH_PROVIDER_MODE`, `completeOAuthConnection` (verify→exchange→identity→encrypt→persist).
- Connect/callback/reconnect routes for Meta + LinkedIn with PKCE (S256) + state-CSRF + client binding (D-06); mock-authorize handlers bounce back with a fixed code so the whole flow runs without an approved app.
- `statusFor()` 7-day reconnect rule (CONN-04); `ConnectionCard` renders connected / reconnect-required with a one-click re-auth link.
- `GET /api/clients` now returns `connected_count` + `reconnect_required_count`; `ClientSwitcher` renders real badges (D-05, closes I-01).

## Files Created/Modified
- `src/lib/crypto.ts`, `src/lib/connection-status.ts`, `src/lib/oauth/*` - vault + provider pipeline.
- 7 OAuth route files + `connections/route.ts` + `reconnect/route.ts`.
- `src/components/connections/ConnectionCard.tsx` + nav badge wiring (Task 3-3).
- Tests: crypto roundtrip, status threshold, mock Meta/LinkedIn full flow → encrypted token persisted.

## Decisions Made
- Reused `completeOAuthConnection` for both platforms; the only difference is the provider selected by the factory.
- Connection summary computed server-side from `social_account` + `statusFor` is the single source of truth for nav badges (no client-side guessing).

## Deviations from Plan
None - plan executed as written (code-complete; DB/test gates unrun in sandbox — see Plan 01-01 Environment note).

## Issues Encountered
- Same sandbox limitation: no `npm install` / Postgres / `vitest`. The mock Meta/LinkedIn integration tests (`src/lib/oauth/meta.test.ts`, `linkedin.test.ts`) run against `DATABASE_URL_TEST` once a DB is available.

## User Setup Required
After install + `drizzle-kit push`:
`npm test` → `src/lib/crypto.test.ts`, `src/lib/connection-status.test.ts`, `src/lib/oauth/meta.test.ts`, `src/lib/oauth/linkedin.test.ts` green.
Manual: select client → Connections → "Connect Meta (mock)" → card shows "connected"; backdate `expires_at` to +3d → badge flips to "Reconnect required" with one-click re-auth.

## Next Phase Readiness
Phase 4 (publish to Meta) consumes the decrypted tokens stored here (decrypt only at publish time). The `social_account` row + `OAuthProvider` pattern are the contract for later platform adapters.
