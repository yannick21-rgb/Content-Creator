# Phase 1: Foundation — Auth, Clients & Connections — Specification

**Created:** 2026-07-11
**Ambiguity score:** 0.17 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

An agency team member can sign in with email/password, manage isolated multi-client workspaces, and connect each client's Meta (Facebook/Instagram) and LinkedIn accounts via OAuth with tokens stored encrypted at rest (AES-256-GCM) and a "Reconnect required" state for expiring tokens — built as greenfield on the decided Next.js 15 + Drizzle + PostgreSQL + Better Auth stack.

## Background

The codebase is greenfield: no `package.json`, no `src/`, only planning artifacts (`ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`) and the stack research in `AGENTS.md` (`STACK.md`/`PROJECT.md`). Nothing of the application exists yet. Phase 1 is the first build phase and must establish: internal team authentication, client workspace isolation, and the OAuth connection + encrypted token-vault machinery for Meta and LinkedIn. Later phases (2 composer/media, 3 scheduler/worker, 4–6 publishing, 7 AI) depend on this foundation. External app-review risk (Meta Live-mode, LinkedIn Community Management) is real and unapproved apps are not available, so the connection flow must be provable via a dev mock provider while the real OAuth handshake is implemented for when credentials exist.

## Requirements

1. **Email/password signup (AUTH-01)**: A team member can register a new account with email and password.
   - Current: No application exists; no auth, no user table.
   - Target: `POST /api/auth/signup` creates a user via Better Auth; password stored hashed (never plaintext); record persisted in PostgreSQL.
   - Acceptance: Signup with a unique email creates a user row with a non-plaintext password hash; signing up with a duplicate email is rejected (e.g. 409); the stored password is not equal to the input.

2. **Email/password login (AUTH-01)**: A team member can log in with email and password.
   - Current: No login endpoint or session exists.
   - Target: `POST /api/auth/login` verifies credentials and issues a session.
   - Acceptance: Correct credentials return a session token/cookie; wrong password returns 401 and no session; non-existent email returns 401.

3. **Session persists across refresh (AUTH-02)**: An authenticated session survives a browser refresh.
   - Current: No session/cookie mechanism exists.
   - Target: A secure session cookie is set on login and validated on each request via Better Auth.
   - Acceptance: After login, a full page reload leaves the user authenticated (session still valid); a request with no/invalid cookie is treated as unauthenticated (redirect or 401).

4. **Create client workspace (CLNT-01)**: An authenticated team member can create a client workspace.
   - Current: No client entity or table exists.
   - Target: `POST /api/clients` creates a client (name + metadata) owned by the authenticated user; row persisted with a `client_id`.
   - Acceptance: An authenticated request creates a client that appears in the owner's client list; an unauthenticated request is rejected (401).

5. **Client isolation / scoped connections (CLNT-02)**: Each client's social accounts are isolated to that client.
   - Current: No client-scoped resource model exists.
   - Target: Every client-scoped resource (social accounts) carries a `client_id` FK; all reads/writes are scoped server-side to the active client.
   - Acceptance: A request scoped to client Y returns no rows for an account that belongs to client X; the DB FK prevents an account row without a valid client; cross-client read returns empty/403, never X's data.

6. **View & manage multiple clients (CLNT-03)**: The team can list, view, edit, and delete clients separately.
   - Current: No client management UI/API exists.
   - Target: `GET /api/clients` lists the user's clients; `GET/PATCH/DELETE /api/clients/:id` operate on one client.
   - Acceptance: Two clients list as distinct entries; editing client X does not alter client Y; deleting client X removes only X's scoped resources and its social accounts.

7. **Connect Meta (FB/IG) via OAuth + long-lived token (CONN-01)**: The team can connect a client's Facebook/Instagram via Meta OAuth with long-lived token exchange.
   - Current: No OAuth flow or token store exists.
   - Target: Meta authorization-code (PKCE) flow exchanges the code for a long-lived token; identity (page/account id) is fetched and persisted; a dev mock provider is supported so the flow is provable without an approved app.
   - Acceptance: Completing the Meta OAuth (or mock) flow stores an encrypted long-lived token and a retrievable page/account id; the connection shows "connected"; the mock path completes end-to-end without real app credentials.

8. **Connect LinkedIn via OAuth (CONN-02)**: The team can connect a client's LinkedIn account via OAuth.
   - Current: No LinkedIn OAuth flow exists.
   - Target: LinkedIn OAuth flow exchanges the code for a token; the LinkedIn profile id is fetched and persisted; mock provider supported.
   - Acceptance: Completing the LinkedIn OAuth (or mock) flow stores an encrypted token and a retrievable profile id; the connection shows "connected"; the mock path completes without real credentials.

9. **Encrypted token vault + reconnect state (CONN-03, CONN-04)**: OAuth tokens are encrypted at rest; expiring tokens surface "Reconnect required" with one-click re-auth.
   - Current: No token storage exists; no expiry handling exists.
   - Target: Access/refresh tokens are encrypted with AES-256-GCM (ciphertext + IV + auth tag in DB; master key from env). A connection is flagged "Reconnect required" when `expires_at` is within 7 days or already expired; a one-click re-auth URL re-initiates OAuth for that account.
   - Acceptance: A direct DB query of the token column shows ciphertext, not the plaintext token; no API endpoint returns a plaintext token; a token expiring in 3 days and an expired token both show "Reconnect required"; a valid token (expires > 7 days out) does not; the reconnect link re-starts the OAuth flow for that account.

## Boundaries

**In scope:**
- Email/password auth (signup, login, session) via Better Auth — internal agency team only.
- Client workspace CRUD with hard row-level isolation (`client_id` FK, server-side scoping).
- Meta (Facebook/Instagram) OAuth connection flow with long-lived token exchange + identity verification.
- LinkedIn OAuth connection flow with token exchange + identity verification.
- AES-256-GCM encrypted token storage (ciphertext + IV + tag; master key from env).
- "Reconnect required" state with one-click re-auth when token expires within 7 days or expired.
- A dev mock OAuth provider so connection flows are provable without approved apps.

**Out of scope:**
- Publishing posts to platforms — Phases 4–6 (PUBL-01/02/03).
- Composer UI and media library/upload — Phase 2 (COMP-*, MEDA-*).
- Scheduling and the background worker — Phase 3 (SCHD-*).
- KMS envelope encryption (AWS/GCP KMS) — deferred; Phase 1 uses AES-256-GCM with a master key from env (documented as an upgrade path).
- AI copy generation / brand voice — Phase 7 (AIGC-*).
- LinkedIn organic carousels, additional networks (TikTok/X/YouTube), analytics, client approval portals, fine-grained team roles — out of scope per REQUIREMENTS.md.
- Per-account publish-permission validation at connect time — connect verifies identity only; publish-scope checks land with publishing phases.

## Constraints

- Stack is fixed by research: Next.js 15 (App Router) + React 19 + TypeScript + Node 24 LTS; PostgreSQL via Drizzle ORM (`postgres` driver); Better Auth for internal auth (Drizzle adapter); AES-256-GCM via Node built-in `crypto` (no extra encryption dependency).
- OAuth flows use the authorization-code grant with PKCE for both Meta and LinkedIn.
- Client isolation is enforced at the data layer (FK + server-side scoping), not only UI filtering.
- Reconnect threshold is fixed at 7 days before `expires_at` (or already expired).
- The dev mock OAuth provider MUST support the same interface/state machine as the real provider so tests and local dev need no approved apps.
- All tokens are encrypted before persistence; plaintext tokens are never written to logs, API responses, or the database.

## Acceptance Criteria

- [ ] `POST /api/auth/signup` creates a user with a hashed (non-plaintext) password; duplicate email rejected.
- [ ] `POST /api/auth/login` returns a session for correct credentials and 401 for wrong credentials.
- [ ] A browser refresh after login leaves the user authenticated (valid session cookie).
- [ ] `POST /api/clients` (authenticated) creates a client that appears in the owner's list; unauthenticated request is 401.
- [ ] A request scoped to client Y cannot read or write client X's social accounts (FK + server-side scoping).
- [ ] Multiple clients list distinctly; editing/deleting one does not affect another; delete removes only that client's scoped resources.
- [ ] Meta OAuth (real or mock) stores an encrypted long-lived token + retrievable page/account id and shows "connected".
- [ ] LinkedIn OAuth (real or mock) stores an encrypted token + retrievable profile id and shows "connected".
- [ ] A direct DB query of the token column shows ciphertext, never plaintext; no API returns a plaintext token.
- [ ] A token expiring within 7 days or already expired shows "Reconnect required"; a valid (>7 days) token does not.
- [ ] The "Reconnect required" state exposes a one-click re-auth link that re-initiates OAuth for that account.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                  |
|--------------------|-------|------|--------|--------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Clear goal + 5 roadmap success criteria                |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | 9 in-scope reqs; later phases + v2 explicitly excluded |
| Constraint Clarity | 0.82  | 0.65 | ✓      | Stack fixed; OAuth PKCE; 7-day reconnect; mock provider|
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 11 pass/fail checkboxes; reconnect rule made concrete  |
| **Ambiguity**      | 0.17  | ≤0.20| ✓      | Gate passed                                            |

## Interview Log

| Round | Perspective     | Question summary                                      | Decision locked                                            |
|-------|-----------------|------------------------------------------------------|------------------------------------------------------------|
| 1     | Researcher      | How real must OAuth be in Phase 1?                   | Real OAuth flows + dev mock provider fallback              |
| 1     | Researcher      | How deep must a "connected" account be validated?    | Verify identity + persist retrievable account id          |
| 2     | Simplifier      | What rule triggers "Reconnect required"?             | Within 7 days of expiry (or already expired)              |
| 2     | Researcher      | How strictly is client isolation enforced?           | Hard row-level scoping via `client_id` FK + server-side   |

---

*Phase: 01-foundation-auth-clients-connections*
*Spec created: 2026-07-11*
*Next step: /gsd-discuss-phase 1 — implementation decisions (how to build what's specified above)*
