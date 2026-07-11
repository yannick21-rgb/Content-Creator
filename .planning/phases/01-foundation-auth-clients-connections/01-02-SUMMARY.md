---
phase: 01-foundation-auth-clients-connections
plan: 02
subsystem: api
tags: [clients, isolation, nav, onboarding, drizzle, zod]

# Dependency graph
requires:
  - phase: 01-01
    provides: db client, auth/session, full schema (client/social_account), auth helpers
provides:
  - Client CRUD API with hard server-side scoping
  - requireClientScope()-style chokepoint (requireUser + assertClientOwned)
  - Nav ClientSwitcher dropdown (active-client cookie, status badges, search)
  - Onboarding for zero-client users + default connections landing (D-01…D-08)
  - resolveActiveClientId() stale-cookie-safe resolver (D-07)
affects: [01-03, phase-2+]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-side client scoping from active-client cookie; FK cascade delete; nav dropdown persists selection in httpOnly cookie]

key-files:
  created:
    - src/lib/clients.ts
    - src/app/api/clients/route.ts
    - src/app/api/clients/[id]/route.ts
    - src/app/api/clients/active/route.ts
    - src/components/nav/ClientSwitcher.tsx
    - src/components/nav/AppNav.tsx
    - src/app/onboarding/page.tsx
    - src/app/onboarding/OnboardingForm.tsx
    - src/app/clients/[id]/connections/page.tsx
    - src/middleware.ts
    - src/app/api/clients/route.test.ts
    - src/app/api/clients/[id]/route.test.ts
    - src/lib/client-scope.test.ts

key-decisions:
  - "requireUser()/getActiveClientId()/setActiveClientCookie() accept optional route request/response for testability; server components use the next/headers default path."
  - "Client scoping NEVER trusts a clientId from the request body — only the [id] param validated against owner, and the active-client cookie."

patterns-established:
  - "Every client route: requireUser(req.headers) → assertClientOwned(id, userId) before any read/write."
  - "resolveActiveClientId() validates the cookie against listClients(userId) and falls back to first remaining client (D-07)."

requirements-completed: [CLNT-01, CLNT-02, CLNT-03]

# Metrics
duration: n/a (offline sandbox — code written, not executed)
completed: 2026-07-11
---

# Phase 01 Plan 02 Summary

**Isolated multi-client workspace vertical slice: client CRUD API with hard server-side scoping, nav ClientSwitcher dropdown, onboarding, and the default connections landing (D-01…D-08).**

## Performance

- **Duration:** n/a (sandbox)
- **Started:** 2026-07-11
- **Completed:** 2026-07-11
- **Tasks:** 2 (2-1 CRUD + scoping, 2-2 nav + onboarding + landing + isolation test)
- **Files modified:** 13

## Accomplishments
- `src/lib/clients.ts` centralizes scoping: `requireUser`, `assertClientOwned`, `listClients`, `listConnections`, `getActiveClientId`, `setActiveClientCookie`, and `resolveActiveClientId` (D-07 stale-cookie-safe).
- `POST /api/clients` creates an owner-scoped client and sets the active-client cookie; `GET` lists only the owner's clients; `GET/PATCH/DELETE /api/clients/[id]` are scoped by owner and cascade only that client's resources.
- `ClientSwitcher` dropdown reads `/api/clients`, shows name + search (D-08), and selects the active client via the `/api/clients/active` endpoint.
- Onboarding redirects zero-client users to create a client; once selected, the default landing is `/clients/[id]/connections` (D-03, D-04).
- Middleware does a lightweight session-presence redirect for protected routes.

## Files Created/Modified
- `src/lib/clients.ts` - scoping chokepoint (PITFALL 3 mitigation).
- `src/app/api/clients/route.ts` (+ `/active`) and `src/app/api/clients/[id]/route.ts` - CRUD.
- `src/components/nav/ClientSwitcher.tsx`, `AppNav.tsx` - nav.
- `src/app/onboarding/*`, `src/app/clients/[id]/connections/page.tsx` - UX.
- Tests: client CRUD + cross-client isolation + FK enforcement.

## Decisions Made
- Connection-count badges on the switcher are wired to the real summary in Plan 03 (Task 3-3); for Plan 02 the dropdown already renders the structure.

## Deviations from Plan
None - plan executed as written (code-complete; DB/test gates unrun in sandbox — see Plan 01-01 Environment note).

## Issues Encountered
- Same sandbox limitation as Plan 01-01: `npm install` / Postgres / `vitest` unavailable here. Tests are written to run against `DATABASE_URL_TEST` once available.

## User Setup Required
After install + `drizzle-kit push`:
`npm test` → `src/app/api/clients/route.test.ts`, `[id]/route.test.ts`, `src/lib/client-scope.test.ts` green.
Manual: sign up → onboarding (zero clients) → create client → dropdown shows it → select → connections page → refresh keeps active client.

## Next Phase Readiness
Plan 03 adds the OAuth connect/reconnect endpoints + AES vault + real connection badges on top of the `client`/`social_account` tables and `listConnections`/`resolveActiveClientId` helpers built here.
