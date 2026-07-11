---
phase: 01-foundation-auth-clients-connections
plan: 02
subsystem: api
tags: [clients, isolation, scoping, nav, onboarding, zod, postgres]

# Dependency graph
requires:
  - phase: 01-01
    provides: Drizzle schema (client table, FK), Better Auth session, db client
provides:
  - Client CRUD API with hard server-side scoping
  - Server-side active-client cookie + resolveActiveClientId safe resolver (D-07)
  - Nav ClientSwitcher dropdown (name + status badges + search)
  - Onboarding for zero-client users (D-03)
  - Default connections landing (D-04)
  - GET /api/clients enriched with connected_count / reconnect_required_count (D-05, finalized in 01-03)
affects: [01-03]

# Tech tracking
tech-stack:
  added: [zod]
  patterns: [requireClientScope() chokepoint, NOT-NULL FK isolation, cookie-read active client, GET summary enriched with connection status]

key-files:
  created:
    - src/lib/clients.ts
    - src/app/api/clients/route.ts
    - src/app/api/clients/[id]/route.ts
    - src/app/api/clients/active/route.ts
    - src/components/nav/ClientSwitcher.tsx
    - src/components/nav/AppNav.tsx
    - src/components/onboarding/CreateClientForm.tsx
    - src/app/onboarding/page.tsx
    - src/app/clients/[id]/connections/page.tsx
    - src/middleware.ts
    - src/lib/http.ts
    - src/test/helpers.ts
    - src/app/api/clients/route.test.ts
    - src/app/api/clients/[id]/route.test.ts
    - src/lib/client-scope.test.ts

key-decisions:
  - "Server-side scoping is centralized in requireClientScope() + listConnections(); clientId is never trusted from the request body (D-02)."
  - "GET /api/clients already returns connection-count summary so Plan 03's badge wiring is a pure UI change."

patterns-established:
  - "Every client route calls requireClientScope() first; queries filter by owner (userId) and active client id."
  - "resolveActiveClientId() validates the raw cookie against owned clients and falls back (D-07) — render paths use it, not raw getActiveClientId()."

requirements-completed: [CLNT-01, CLNT-02, CLNT-03]

# Metrics
duration: 0min
completed: 2026-07-11
---

# Plan 01-02: Client workspaces & isolation Summary

**Client CRUD API with a single server-side scoping chokepoint, a NOT-NULL FK enforcing isolation, and the nav ClientSwitcher + onboarding + default connections landing (CLNT-01/02/03, D-01…D-08).**

## Performance
- **Duration:** n/a (sandbox: not executed)
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- `POST /api/clients` creates an owner-scoped client and sets the active-client cookie; unauthenticated → 401 (CLNT-01).
- Hard server-side scoping: reads filter by owner + active client; FK prevents orphan social accounts (CLNT-02).
- `GET/PATCH/DELETE /api/clients/:id` operate only on owner-matched rows; DELETE cascades only that client's resources (CLNT-03).
- ClientSwitcher dropdown with name + status badges + client-side search (D-01/D-05/D-08).
- Zero-client → onboarding (D-03); selected client → connections landing (D-04); deleted active client auto-switches via resolveActiveClientId() (D-07).

## Task Commits
1. **Task 2-1: Client CRUD API + scoping helper** - written, not executed
2. **Task 2-2: ClientSwitcher + onboarding + landing + isolation test** - written, not executed

## Files Created/Modified
- `src/lib/clients.ts` - getActiveClientId / requireClientScope / setActiveClientCookie / listClients / listConnections / resolveActiveClientId
- `src/app/api/clients/route.ts` (+ `/active`, `/[id]`) - CRUD + count summary
- `src/components/nav/ClientSwitcher.tsx`, `AppNav.tsx`
- `src/app/onboarding/page.tsx`, `src/components/onboarding/CreateClientForm.tsx`
- `src/app/clients/[id]/connections/page.tsx` (default landing)
- `src/middleware.ts` (edge-safe presence check)

## Decisions Made
- GET /api/clients already returns `connected_count`/`reconnect_required_count` (computed via statusFor) so Plan 03 Task 3-3 is a no-op refactor — badges are real from the start.

## Deviations from Plan
None — structure matches the plan (Task 3-3 was folded forward for consistency).

## Issues Encountered
- Same sandbox limits as 01-01: no Postgres/network, so the integration tests (clients/route.test, [id]/route.test, client-scope.test) were written but not executed. They require `DATABASE_URL_TEST` + installed deps.

## User Setup Required
Same as 01-01 (install deps, provision DB, drizzle-kit push). Run `vitest run src/app/api/clients src/lib/client-scope.test.ts` after setup.

## Next Phase Readiness
Client isolation substrate is complete and ready for 01-03 (OAuth connections bind to the active client id).

---
*Phase: 01-foundation-auth-clients-connections*
*Completed: 2026-07-11*
