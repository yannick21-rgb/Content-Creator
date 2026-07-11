# Walking Skeleton — Content-Creator

**Phase:** 1
**Generated:** 2026-07-11

## Capability Proven End-to-End

A signed-in agency team member can sign up with email/password and see their own email on a dashboard page — exercising the full stack: Next.js 15 App Router (UI) → Better Auth (server) → PostgreSQL via Drizzle (real DB write on signup + real session read on dashboard) → secure session cookie round-trip. This is the thinnest vertical slice that proves every later phase's architectural substrate (auth, DB, encryption key, client scoping, OAuth abstraction) is real and runnable.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15.5 App Router + React 19 + TypeScript 5.7 | Single deployable unit; server components read session, route handlers own API + OAuth callbacks. Pinned to 15.5.x stable (NOT 16 preview). |
| Runtime | Node.js 24 LTS | Active LTS target; STACK.md fixed. |
| Data layer | PostgreSQL 18 + Drizzle ORM 0.45 (`postgres` driver) | Type-safe schema, generated migrations via drizzle-kit, FK enforcement for client isolation. |
| Auth (internal team) | Better Auth + Drizzle adapter, email/password, DB-backed session cookie | Self-hosted, scrypt password hashing, CSRF-safe `HttpOnly` session cookie; satisfies AUTH-01/02. |
| Token vault | Node `crypto` AES-256-GCM, 32-byte key from `TOKEN_ENCRYPTION_KEY` env | Industry-standard AEAD; no extra dependency; key never in DB/logs. (KMS envelope encryption deferred.) |
| OAuth abstraction | `OAuthProvider` interface + `meta` / `linkedin` / `mock` impls, selected by `OAUTH_PROVIDER_MODE` (default `mock`) | Real flows written behind same contract; mock proves connect→encrypt→persist→"connected" with zero approved-app credentials (PITFALL 6). |
| Client isolation | Active-client id in a server-readable cookie + `client_id` NOT-NULL FK + `requireClientScope()` server-side helper | Hard row-level isolation (CLNT-02), not UI-only filtering (PITFALL 3). |
| Styling | Tailwind v4 (`@tailwindcss/postcss`) + shadcn/ui | B2B dashboard components; v4 CSS-first engine. |
| Directory layout | `src/app` (routes/handlers), `src/lib` (auth, db, crypto, clients, oauth), `src/components` (nav, connections) | One codebase, clear module boundaries; reused by Phases 2–7. |
| Local run | `npm run dev` (Next) + `npx drizzle-kit push` against `DATABASE_URL` | Documented full-stack run proves the skeleton. |

## Stack Touched in Phase 1

- [x] Project scaffold (Next 15, TS, Tailwind v4, ESLint, Vitest, deps installed)
- [x] Routing — real routes: `/login` (form), `/dashboard` (server component reading session), root redirect
- [x] Database — real write (Better Auth inserts `user` on signup) AND real read (Better Auth reads `session` to render dashboard)
- [x] UI — interactive login/signup form wired to the API via Better Auth client SDK
- [x] Run command — `npm run dev` serves the full stack; `npx drizzle-kit push` creates all tables

## Out of Scope (Deferred to Later Slices)

- Client workspace CRUD UI + nav `ClientSwitcher` dropdown (Phase 1 Plan 02)
- OAuth connect/reconnect UI + encrypted token persistence (Phase 1 Plan 03)
- Publishing, composer, media library, scheduler/worker, AI copy (Phases 2–7)
- Real Meta/LinkedIn live credentials & app-review gating (mock provider proves the path)
- KMS envelope encryption (env key only in Phase 1; `key_version` column forward-compatible)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 1 Plan 02: Client workspaces & isolation (CLNT-01/02/03) — nav dropdown, onboarding, server-side scoping.
- Phase 1 Plan 03: OAuth connections + encrypted vault + reconnect (CONN-01/02/03/04) — OAuthProvider, AES-256-GCM vault, reconnect state.
- Phase 2: Composer & Media Library (COMP-*, MEDA-*).
- Phase 3: Scheduler & Worker (SCHD-*).
- Phase 4–6: Publish to Meta / Instagram / LinkedIn (PUBL-*).
- Phase 7: AI (Gemini) & Hardening (AIGC-*).
