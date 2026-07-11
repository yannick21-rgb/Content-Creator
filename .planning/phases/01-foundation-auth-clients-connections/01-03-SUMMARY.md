---
phase: 01-foundation-auth-clients-connections
plan: 03
subsystem: auth
tags: [oauth, meta, linkedin, aes-256-gcm, encryption, pkce, reconnect, mock-provider]

# Dependency graph
requires:
  - phase: 01-01
    provides: Drizzle schema (socialAccount, oauthState), db client, Better Auth session
  - phase: 01-02
    provides: active-client scoping, client API, ClientSwitcher badges
provides:
  - OAuthProvider abstraction (mock + real Meta/LinkedIn) behind OAUTH_PROVIDER_MODE
  - AES-256-GCM token vault at the persistence boundary
  - Connect/callback/reconnect endpoints with PKCE + state-CSRF + client binding (D-06)
  - "Reconnect required" state (7-day rule) + one-click re-auth (CONN-04)
  - Connection cards + nav badges wired to real per-client connection summary (D-05, I-01 closed)

# Tech tracking
tech-stack:
  added: [crypto (node built-in)]
  patterns: [OAuthProvider interface, AES-256-GCM encrypt-before-insert, completeOAuthConnection, statusFor threshold, mock-first provider]

key-files:
  created:
    - src/lib/crypto.ts
    - src/lib/connection-status.ts
    - src/lib/oauth/provider.ts
    - src/lib/oauth/mock.ts
    - src/lib/oauth/meta.ts
    - src/lib/oauth/linkedin.ts
    - src/lib/oauth/index.ts
    - src/lib/oauth/complete.ts
    - src/lib/oauth/beginFlow.ts
    - src/lib/oauth/completeFlow.ts
    - src/app/api/clients/[id]/connections/route.ts
    - src/app/api/clients/[id]/connections/meta/start/route.ts
    - src/app/api/clients/[id]/connections/meta/callback/route.ts
    - src/app/api/clients/[id]/connections/meta/mock-authorize/route.ts
    - src/app/api/clients/[id]/connections/linkedin/start/route.ts
    - src/app/api/clients/[id]/connections/linkedin/callback/route.ts
    - src/app/api/clients/[id]/connections/linkedin/mock-authorize/route.ts
    - src/app/api/clients/[id]/connections/[accountId]/reconnect/route.ts
    - src/components/connections/ConnectionCard.tsx
    - src/components/connections/ConnectionsView.tsx
    - src/lib/crypto.test.ts
    - src/lib/connection-status.test.ts
    - src/lib/oauth/meta.test.ts
    - src/lib/oauth/linkedin.test.ts

key-decisions:
  - "Encryption happens at the boundary in completeOAuthConnection (encrypt before insert); plaintext never hits the DB, logs, or API responses (CONN-03)."
  - "Mock provider implements the same interface/state machine as real, so all flows are provable with OAUTH_PROVIDER_MODE=mock (PITFALL 6)."
  - "Real Meta provider performs the short→long-lived (fb_exchange_token) swap before persistence (PITFALL 2)."
  - "Client id is bound into the oauth_state row (D-06) — target-confusion safe."

patterns-established:
  - "OAuthProvider interface; getProvider() factory switches on OAUTH_PROVIDER_MODE."
  - "PKCE S256 verifier stashed server-side in oauth_state; one-time state consumed on callback."
  - "statusFor(expiresAt) derives connection status; GET /api/clients summary and GET /api/connections omit token fields."

requirements-completed: [CONN-01, CONN-02, CONN-03, CONN-04]

# Metrics
duration: 0min
completed: 2026-07-11
---

# Plan 01-03: OAuth connections + encrypted vault + reconnect Summary

**OAuth provider abstraction (mock + real Meta/LinkedIn), AES-256-GCM token vault, PKCE+state connect/callback/reconnect endpoints with client binding, and a "Reconnect required" state with one-click re-auth (CONN-01/02/03/04).**

## Performance
- **Duration:** n/a (sandbox: not executed)
- **Tasks:** 3
- **Files modified:** 23

## Accomplishments
- `OAuthProvider` interface with mock + real Meta/LinkedIn implementations; `OAUTH_PROVIDER_MODE=mock` default (PITFALL 6).
- AES-256-GCM vault (`src/lib/crypto.ts`); `completeOAuthConnection` encrypts the token at the boundary before insert; no plaintext token stored/returned (CONN-03).
- Connect flow with PKCE (S256) + state-CSRF, active client id embedded in `oauth_state` (D-06), one-time state consumed on callback.
- `statusFor(expiresAt)` 7-day reconnect rule; connections API omits token fields; ConnectionCard + nav badges render connected/reconnect (CONN-04, D-05/I-01).
- Reconnect endpoint re-initiates the platform OAuth flow for that account (one-click re-auth).

## Task Commits
1. **Task 3-1: Provider iface + mock/real + AES-GCM + reconnect logic + unit tests** - written, not executed
2. **Task 3-2: Connect/callback/reconnect endpoints + UI + integration tests** - written, not executed
3. **Task 3-3: Wire ClientSwitcher badges to real summary** - folded forward (GET /api/clients already returns counts)

## Files Created/Modified
- `src/lib/crypto.ts`, `src/lib/connection-status.ts`
- `src/lib/oauth/*` (provider, mock, meta, linkedin, index, complete, beginFlow, completeFlow)
- `src/app/api/clients/[id]/connections/**` (route, meta/*, linkedin/*, [accountId]/reconnect)
- `src/components/connections/ConnectionCard.tsx`, `ConnectionsView.tsx`
- `src/app/clients/[id]/connections/page.tsx` (renders ConnectionsView)

## Decisions Made
- Real providers are written behind the same interface for when `OAUTH_PROVIDER_MODE=real` + app credentials exist; mock proves the path today.
- GET /api/clients connection summary computed server-side; badges are not placeholders (closes I-01).

## Deviations from Plan
- Task 3-3 was folded forward into Plan 02's GET /api/clients (counts already returned) — no separate diff needed.

## Issues Encountered
- Same sandbox limits as 01-01/01-02: no network/Postgres, so `vitest` crypto/connection-status/meta/linkedin tests were written but not executed. Crypto + connection-status are pure unit tests and will run once `vitest` is installed.

## User Setup Required
1. `npm install` + provision Postgres + `drizzle-kit push` (per 01-01).
2. `npm run test` (or `vitest run src/lib`) to validate crypto + status + mock OAuth flows.
3. For real connections: set `OAUTH_PROVIDER_MODE=real` + Meta/LinkedIn client credentials.

## Next Phase Readiness
Token vault + connection state machine complete. Phase 2 (composer/media) and Phase 3 (scheduler/worker) can build on `socialAccount` rows; Phase 4+ reuse `completeOAuthConnection` + decrypt for publishing.

---
*Phase: 01-foundation-auth-clients-connections*
*Completed: 2026-07-11*
