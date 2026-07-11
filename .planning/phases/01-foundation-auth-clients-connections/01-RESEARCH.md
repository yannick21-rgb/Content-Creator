# Phase 1: Foundation — Auth, Clients & Connections - Research

**Researched:** 2026-07-11
**Domain:** Greenfield Next.js 15 (App Router) + React 19 + TypeScript + Node 24 foundation: internal team auth (Better Auth + Drizzle), isolated multi-client workspaces, OAuth connection flows (Meta/LinkedIn), AES-256-GCM encrypted token vault, reconnect state, and a dev mock OAuth provider.
**Confidence:** HIGH on stack/architecture/encryption patterns (verified against official Better Auth docs + npm registry + Node crypto API). MEDIUM on a few fast-moving lib pin details (Zod v4, drizzle-kit minor compatibility). LOW on exact external OAuth endpoint behavior for unapproved apps (deferred behind mock provider — by design).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions (Implementation Decisions D-01…D-08)
- **D-01:** Active client is selected via a **dropdown in the nav bar** (persistent selection), NOT URL routes or subdomain.
- **D-02:** Selection persists in a **server-readable cookie**; client scoping is applied server-side on every request, consistent with `client_id` FK isolation.
- **D-03:** Client onboarding: after login, if the user has no clients, redirect to a creation screen (no blank screen).
- **D-04:** Once a client is selected, the **default screen is that client's social-connections list** (Meta/LinkedIn) — the core of Phase 1.
- **D-05:** The dropdown shows **name + status badges** (connected-account count, "Reconnect required" state).
- **D-06:** On OAuth connect, the **active client id is embedded in the OAuth `state` param**; at callback the connection is bound to that client (target-confusion safe).
- **D-07:** If the active client is deleted → **auto-switch to the first remaining client**; if none remain, back to onboarding. Never a broken page.
- **D-08:** The dropdown includes a **search/filter** (client-side list) for many clients.

### the agent's Discretion
- Layout of connection cards; exact encryption key-rotation mechanism (env-based); any technical detail not covered above (research/planning territory).

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Team member can sign up and log in with email/password | Better Auth `emailAndPassword` + Drizzle adapter (§Standard Stack, §Code Examples). Password hashed via scrypt (Node-native); duplicate-email rejected. |
| AUTH-02 | Session persists across browser refresh | Better Auth cookie-based sessions stored in DB; `auth.api.getSession({ headers })` in server components (§Code Examples). |
| CLNT-01 | Team can create a client workspace | `POST /api/clients` Route Handler; `client` table with FK to `user` (§Architecture Patterns). |
| CLNT-02 | Client social accounts isolated to that client | `social_account.client_id` FK (NOT NULL) + server-side scoping from active-client cookie (§Don't Hand-Roll, §Common Pitfalls). |
| CLNT-03 | View/manage multiple clients separately | `GET/PATCH/DELETE /api/clients/:id`; delete cascades scoped resources (§Architecture Patterns). |
| CONN-01 | Connect client Meta (FB/IG) via OAuth + long-lived token | `OAuthProvider` interface + Meta impl (authorize → PKCE exchange → long-lived exchange `fb_exchange_token` → identity fetch) (§Architecture Patterns). |
| CONN-02 | Connect client LinkedIn via OAuth | Same `OAuthProvider` interface + LinkedIn impl (§Architecture Patterns). |
| CONN-03 | OAuth tokens encrypted at rest (AES-256-GCM) | `crypto` AES-256-GCM; ciphertext+IV+tag in DB; key from `TOKEN_ENCRYPTION_KEY` env (§Code Examples). |
| CONN-04 | Expiring tokens surface "Reconnect required" + one-click re-auth | Computed `connectionStatus` (expires within 7 days or expired → reconnect); reconnect URL re-inits OAuth for that account (§Architecture Patterns). |

</phase_requirements>

## Summary

Phase 1 establishes the entire security + isolation substrate that every later phase depends on. It is a **walking skeleton**: the thinnest end-to-end slice that proves (1) internal team auth with a refresh-surviving session, (2) hard client isolation via `client_id` FK + server-side scoping, (3) one encrypted OAuth connect flow that actually stores a retrievable identity + ciphertext token, and (4) a "Reconnect required" state with a one-click re-auth link.

The fixed stack (AGENTS.md / STACK.md) is authoritative: **Next.js 15.5 App Router + React 19 + TypeScript 5.7 + Node 24 LTS**, **PostgreSQL + Drizzle ORM 0.45** (`postgres.js` driver), **Better Auth** (Drizzle adapter) for internal team auth, **AES-256-GCM via Node built-in `crypto`** for token vault. This phase does **not** need BullMQ/Redis, R2/AWS SDK, or Gemini — those are Phases 2–7. The dev mock OAuth provider MUST implement the **same `OAuthProvider` interface** as the real Meta/LinkedIn providers so the full connect→encrypt→persist→"connected" path is provable with zero approved-app credentials.

**Primary recommendation:** Build the `OAuthProvider` abstraction first; ship Phase 1 with `OAUTH_PROVIDER_MODE=mock` as the default so all of CONN-01/02/03/04 are demonstrable and testable today, while the real Meta/LinkedIn exchange code is written behind the same interface (gated on credentials + app-review readiness per PITFALL 6). Encrypt tokens at the boundary, never return plaintext, and scope every client resource by the active-client cookie read on the server.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Team email/password auth + session | API/Backend (Better Auth) | Browser (session cookie) | Better Auth issues/validates the cookie server-side; browser only stores/replays the cookie. |
| Client workspace CRUD + isolation | API/Backend + Database | Browser (nav dropdown/cookie) | `client_id` FK + server-side scoping enforced in Route Handlers/db layer; client never trusts UI filtering. |
| OAuth connection flow (Meta/LinkedIn) | API/Backend (Route Handlers) | External (platform OAuth) | App initiates/completes the authorization-code+PKCE exchange; platforms are external dependencies. |
| Encrypted token vault | API/Backend (Node `crypto`) | Database (storage only) | Encryption/decryption is app logic; DB is a dumb ciphertext store (never sees plaintext at rest). |
| Reconnect state | API/Backend (computed status) | Browser (badge + link) | Status derived server-side from `expires_at`; UI only renders it. |
| Dev mock OAuth provider | API/Backend (provider abstraction) | — | Same `OAuthProvider` contract as real; in-memory, no external call. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **next** | `^15.5.19` | App shell + Route Handlers + Server Components | App Router gives server components, route handlers for auth/OAuth/CRUD, one deployable unit. (Next 16.2.10 exists but is preview — do NOT use; STACK pins 15.5.x stable.) `[VERIFIED: npm registry]` `[CITED: nextjs.org/blog/next-15]` |
| **react** / **react-dom** | `^19` (19.2.7) | UI rendering | Ships with Next 15; required for App Router. `[VERIFIED: npm registry]` |
| **typescript** | `^5.7` | Type safety | STACK pins 5.7.x; TS 7.x is a newer major with possible breaking changes — pin 5.7 for safety. `[VERIFIED: npm registry]` (5.7 line exists) |
| **better-auth** | `1.6.23` | Internal team auth (email/password + sessions) | TypeScript-first, self-hosted, Drizzle adapter, cookie sessions. `[VERIFIED: npm registry]` `[CITED: better-auth.com/docs/installation]` |
| **@better-auth/drizzle-adapter** | `1.6.23` | Better Auth ↔ Drizzle/Postgres bridge | Official Better Auth docs install this **separate** package (`npm i @better-auth/drizzle-adapter`); the `better-auth/adapters/drizzle` subpath ALSO exists and works. Recommend the separate package per official docs. `[VERIFIED: npm registry]` `[CITED: better-auth.com/docs/adapters/drizzle]` |
| **drizzle-orm** | `^0.45.2` | Type-safe DB access | SQL-first, no codegen, tiny runtime. Pin 0.45.x (v1.0 is RC). `[VERIFIED: npm registry]` |
| **postgres** (postgres.js) | `^3.4` (3.4.9) | Drizzle Postgres driver | Recommended driver; no native binary; Neon HTTP pooler compatible. `[VERIFIED: npm registry]` |
| **drizzle-kit** | `^0.31` (0.31.10) | Migrations / schema | `drizzle-kit generate` + `migrate`. Pair with drizzle-orm 0.45. `[VERIFIED: npm registry]` (MEDIUM: confirm 0.31 ↔ 0.45 minor alignment at install) |
| **zod** | `^4` (4.4.3) | Runtime validation of API inputs/env | Validate every external boundary. `[VERIFIED: npm registry]` (MEDIUM: Zod v4 API differs from v3 — if a dep needs v3 types, pin `^3.23`) |
| **tailwindcss** + **@tailwindcss/postcss** | `^4` | Styling (nav dropdown, connections UI) | Tailwind v4 CSS-first + Oxide; use `@tailwindcss/postcss` plugin (NOT old `tailwindcss` PostCSS plugin). `[VERIFIED: npm registry]` `[CITED: tailwindcss.com/blog/tailwindcss-v4]` |
| **@aws-sdk/... / bullmq / @google/genai** | — | NOT in Phase 1 | Deferred to Phases 2–7 (media, scheduler, AI). Do not install now. |

### Supporting (dev only)
| Library | Version | Purpose |
|---------|---------|---------|
| **vitest** | latest (v3) | Unit/integration tests for crypto, scoping, OAuth flows. `[VERIFIED: npm registry]` (MEDIUM: exact major) |
| **@types/node, @types/react, @types/react-dom** | matching | Types. |
| **shadcn/ui** (via `npx shadcn@latest add`) | — | B2B dashboard components (nav, cards, dropdown). Not a versioned dep. |

**Installation (Phase 1 scope only):**
```bash
npm install next@^15.5.19 react@^19 react-dom@^19
npm install better-auth @better-auth/drizzle-adapter
npm install drizzle-orm@^0.45.2 postgres@^3.4
npm install zod@^4
npm install -D typescript@^5.7 @types/node @types/react @types/react-dom drizzle-kit@^0.31 tailwindcss@^4 @tailwindcss/postcss vitest
```

**Version verification note:** All core versions above were confirmed present on the npm registry on 2026-07-11. `next@15.5.19` and `typescript@5.7` both exist. `better-auth` and `@better-auth/drizzle-adapter` are at 1.6.23 (aligned). Do NOT run `npm i next@latest` (pulls 16.x preview).

## Package Legitimacy Audit

> Protocol: cross-ecosystem confusion check. `slopcheck` v0.6.1 was executed but it queries **PyPI (Python registry)** and produced false `[SLOP]` verdicts for npm-only packages (`@better-auth/drizzle-adapter`, `@tailwindcss/postcss`, `drizzle-orm`, `react-dom`). These are **false positives** — the tool checked the wrong ecosystem. All packages below were re-verified against **npm (the correct registry)** where they exist with real published versions. Per the package-legitimacy protocol, verification must occur on the correct ecosystem registry; npm verification stands.

| Package | Registry | Age | Downloads | Source Repo | slopcheck (PyPI) | Disposition |
|---------|----------|-----|-----------|-------------|------------------|-------------|
| next | npm | 2+ yrs | very high | vercel/next.js | `[OK]` (pypi coincidental) | Approved (pin 15.5.x) |
| react / react-dom | npm | years | very high | facebook/react | `[SLOP]` (PyPI false) | Approved — npm-verified |
| typescript | npm | years | high | microsoft/TypeScript | `[OK]` | Approved (pin 5.7) |
| better-auth | npm | ~2 yrs | ~100K+/wk | better-auth/better-auth | `[OK]` | Approved |
| @better-auth/drizzle-adapter | npm | ~2 yrs | matches better-auth | better-auth/better-auth | `[SLOP]` (PyPI false) | Approved — npm-verified |
| drizzle-orm | npm | years | high | drizzle-team/drizzle-orm | `[SLOP]` (PyPI false) | Approved (pin 0.45) |
| postgres | npm | years | high | porsager/postgres | `[OK]` | Approved |
| drizzle-kit | npm | years | high | drizzle-team/drizzle-kit | `[ERR]` (PyPI unreachable) | Approved — npm-verified |
| zod | npm | years | very high | colinhacks/zod | `[OK]` | Approved (v4) |
| tailwindcss | npm | years | very high | tailwindlabs/tailwindcss | `[OK]` | Approved (v4) |
| @tailwindcss/postcss | npm | ~1 yr | high | tailwindlabs/tailwindcss | `[SLOP]` (PyPI false) | Approved — npm-verified |

**Packages removed due to slopcheck [SLOP]:** none (all PyPI `[SLOP]` are false positives; npm verification supersedes).
**Packages flagged [SUS]:** none.
**Caveat:** `slopcheck` is a PyPI-oriented tool and is **not suitable for npm packages**; it was run only to satisfy the gate and its npm-relevant signals are inverted. The authoritative check is `npm view <pkg> version`, which passed for every package.

## Architecture Patterns

### System Architecture Diagram (Phase 1 walking skeleton)

```
┌──────────────────────────────────────────────────────────────────────┐
│ BROWSER (Server Components + Client Components)                        │
│  Nav: client dropdown (cookie) · Onboarding · Connections list         │
└───────────────┬───────────────────────────────┬──────────────────────┘
                │ HTTPS + session cookie          │ fetch /api/...
┌───────────────▼───────────────────────────────▼──────────────────────┐
│ NEXT.JS 15 APP ROUTER (one process)                                    │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────────────┐  │
│  │ /api/auth/[...]│  │ /api/clients   │  │ /api/clients/[id]/       │  │
│  │ (Better Auth   │  │ (CRUD, scoped  │  │   connections/{meta,     │  │
│  │  handler)      │  │  to session)   │  │   linkedin}/{start,cb})  │  │
│  └───────┬───────┘  └───────┬────────┘  └───────────┬─────────────┘  │
│          │                  │                       │                  │
│  ┌───────▼──────────────────▼───────────────────────▼─────────────┐   │
│  │ lib/                                                              │   │
│  │  auth.ts (betterAuth) · db.ts (drizzle) · crypto.ts (AES-GCM)   │   │
│  │  oauth/provider.ts (interface) · oauth/meta.ts · oauth/linkedin │   │
│  │  oauth/mock.ts · clients.ts (active-client scoping)             │   │
│  └───────┬──────────────────┬───────────────────────┬─────────────┘   │
└──────────┼──────────────────┼───────────────────────┼─────────────────┘
           │                  │                       │
   ┌───────▼──────┐   ┌───────▼───────┐       ┌───────▼──────────────┐
   │ PostgreSQL   │   │ OAuthProvider │       │ External OAuth       │
   │ user,session,│   │ (mock in dev) │       │ Meta / LinkedIn      │
   │ client,      │   │               │       │ (real, behind flag)  │
   │ social_account│  │               │       │                      │
   │ (ciphertext) │   └───────────────┘       └──────────────────────┘
   └──────────────┘
```

Data flow for connect (mock or real — identical state machine):
```
UI "Connect Meta" → GET /connections/meta/start?clientId=Y
  → server: generate state (CSRF) + PKCE verifier/challenge, stash in oauth_state (or signed cookie)
  → redirect to provider.authorizeUrl(state, codeChallenge, redirectUri)
    [MOCK: redirects to /connections/meta/mock-authorize which auto-issues a code]
Provider consent → redirect to /connections/meta/callback?code=..&state=..
  → server: verify state; provider.exchangeCode(code, verifier) → token
    [META: also exchange short→long-lived via fb_exchange_token]
  → provider.fetchIdentity(token) → { platformAccountId, name }
  → crypto.encrypt(token) → store social_account(client_id=Y, platform, platformAccountId,
       access_token_encrypted, expires_at)
  → UI shows "connected"
```

### Recommended Project Structure (Phase 1)
```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/route.ts        # Better Auth catch-all (toNextJsHandler)
│   │   ├── auth/signup/route.ts          # thin wrapper → auth.api.signUpEmail (SPEC path)
│   │   ├── auth/login/route.ts           # thin wrapper → auth.api.signInEmail  (SPEC path)
│   │   ├── clients/route.ts              # GET list / POST create (CLNT-01)
│   │   ├── clients/[id]/route.ts         # GET/PATCH/DELETE one (CLNT-03)
│   │   └── clients/[id]/connections/
│   │       ├── meta/start/route.ts       # begin Meta OAuth (D-06 embeds clientId in state)
│   │       ├── meta/callback/route.ts    # complete Meta OAuth
│   │       ├── linkedin/start/route.ts
│   │       ├── linkedin/callback/route.ts
│   │       └── [accountId]/reconnect/route.ts  # one-click re-auth URL (CONN-04)
│   ├── (auth)/login/page.tsx             # login form (client component)
│   ├── onboarding/page.tsx               # first-client creation (D-03)
│   └── clients/[id]/connections/page.tsx # default landing; lists connections + status badges
├── components/
│   ├── nav/ClientSwitcher.tsx            # dropdown + search + status badges (D-01,D-05,D-08)
│   └── connections/ConnectionCard.tsx    # connected / reconnect-required states
├── lib/
│   ├── auth.ts                           # betterAuth instance (Drizzle adapter, email/password)
│   ├── auth-client.ts                    # createAuthClient (React hooks)
│   ├── db.ts                             # drizzle client (postgres.js)
│   ├── db/schema.ts                      # user, session, client, social_account, oauth_state
│   ├── crypto.ts                         # AES-256-GCM encrypt/decrypt (+ key from env)
│   ├── clients.ts                        # getActiveClientId() from cookie; requireClientScope()
│   └── oauth/
│       ├── provider.ts                   # OAuthProvider interface (shared by all)
│       ├── meta.ts                       # real Meta impl
│       ├── linkedin.ts                   # real LinkedIn impl
│       ├── mock.ts                       # dev mock impl (same interface)
│       └── index.ts                      # factory: OAUTH_PROVIDER_MODE → impl
└── middleware.ts                         # (optional) redirect unauthenticated → /login
```

### Pattern 1: Better Auth server instance + Next.js handler
**What:** One `betterAuth` instance (Drizzle adapter, `emailAndPassword.enabled`, `session`). A catch-all route mounts `toNextJsHandler(auth)`; thin wrappers at `/api/auth/signup` and `/api/auth/login` call `auth.api.signUpEmail` / `auth.api.signInEmail` so the SPEC's exact paths work while the Better Auth client SDK keeps `/api/auth/*`.
**When to use:** Always — internal team auth.
**Example:**
```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }), // pg for Postgres
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  // BETTER_AUTH_SECRET from env (required, 32+ bytes)
});

// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
export const { GET, POST } = toNextJsHandler(auth);

// Thin wrapper honoring SPEC paths (AUTH-01):
// src/app/api/auth/signup/route.ts
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await auth.api.signUpEmail({ body, headers: req.headers, asResponse: true });
  return NextResponse.json(res.body ?? {}, { status: res.status, headers: res.headers });
}
```
**Source:** `[CITED: better-auth.com/docs/installation]`, `[CITED: better-auth.com/docs/authentication/email-password]`, `[CITED: better-auth.com/docs/adapters/drizzle]`

### Pattern 2: Server-side client scoping via active-client cookie
**What:** A `clientId` is read from a server-readable cookie on every request; all client-scoped queries filter by it. The DB enforces the hard guarantee with a NOT-NULL FK.
**When to use:** Every client-scoped resource (social accounts). This is the core of CLNT-02.
**Example:**
```typescript
// src/lib/clients.ts
import { cookies } from "next/headers";
import { db } from "./db";
import { socialAccounts } from "./db/schema";
import { and, eq } from "drizzle-orm";

export async function getActiveClientId(): Promise<string | null> {
  const store = await cookies();
  return store.get("active_client_id")?.value ?? null;
}

// Always scope reads; never trust the client to pass the right id in the body alone:
export async function listConnections(clientId: string) {
  return db.select().from(socialAccounts)
    .where(eq(socialAccounts.clientId, clientId)); // hard server-side scoping
}
```
The `social_account.client_id` column is `notNull()` + FK → a row without a valid client is rejected by Postgres (CLNT-02 acceptance: "the DB FK prevents an account row without a valid client").

### Pattern 3: OAuthProvider interface (real + mock share it)
**What:** Both real and mock providers implement one interface so the connect flow is provider-agnostic.
**When to use:** Always — required by SPEC ("mock provider MUST support the same interface/state machine").
**Example:**
```typescript
// src/lib/oauth/provider.ts
export interface OAuthToken { accessToken: string; refreshToken?: string; expiresAt?: Date; longLived?: boolean; }
export interface OAuthIdentity { platformAccountId: string; name: string; }
export interface OAuthProvider {
  platform: "meta" | "linkedin";
  getAuthorizeUrl(p: { state: string; codeChallenge: string; redirectUri: string }): string;
  exchangeCode(p: { code: string; codeVerifier: string; redirectUri: string }): Promise<OAuthToken>;
  fetchIdentity(accessToken: string): Promise<OAuthIdentity>;
  getScopes(): string[];
}
```
Mock impl returns a deterministic fake `code`, exchanges to a fake long-lived token, and returns a fake identity — exercising the **exact same** encrypt→store→"connected" path. (CONN-01/02 mock coverage.)

### Pattern 4: AES-256-GCM token vault (boundary encryption)
**What:** Encrypt tokens right before persistence; decrypt only at use. Store `iv`, `authTag`, `ciphertext`. Key from env.
**When to use:** Every token write/read. Never log plaintext; never return it via API.
**Example:** see §Code Examples.

### Anti-Patterns to Avoid
- **Trusting UI filtering for isolation:** filtering client lists in the browser is NOT isolation. Always scope server-side by `client_id` from the cookie (CLNT-02).
- **Storing the short-lived Meta token:** must exchange short→long-lived before persisting (PITFALL 2). The Meta provider's `exchangeCode` must do this internally.
- **Returning plaintext tokens:** no API endpoint may serialize the token value; the vault decrypts only for internal use (CONN-03, PITFALL 14).
- **Assuming LinkedIn gives a refresh token:** standard access likely has none — design for re-auth (PITFALL 1). Store `expires_at`; surface reconnect.
- **Using Better Auth's social providers for client connections:** Better Auth social login is for *team* login. Client social accounts are a separate, self-implemented concern (STACK.md).
- **SKIP the mock:** building only the real flow blocks all testing until app review lands (PITFALL 6). Ship mock-first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email/password auth + sessions | Custom password hashing, session store, cookie logic | **Better Auth** (Drizzle adapter) | scrypt hashing, DB sessions, CSRF-safe cookies, refresh — all solved; reinventing risks OWASP violations. |
| DB access / migrations | Raw `pg` queries + manual migrations | **Drizzle ORM + drizzle-kit** | Type-safe schema, generated migrations; FK constraints enforced. |
| AES-GCM encryption | Custom cipher modes / ECB / own IV handling | **Node `crypto` (aes-256-gcm)** | Industry-standard AEAD; nonce + auth tag built in. Do NOT use `aes-256-cbc` without HMAC. |
| PKCE / OAuth state | Ad-hoc CSRF tokens + verifier | **`crypto.randomBytes` + S256 challenge** per RFC 7636 | Standard, replay-safe; the provider interface owns it. |
| Client isolation | Per-request WHERE injected manually everywhere | **`requireClientScope()` helper + NOT-NULL FK** | Single chokepoint prevents accidental cross-client reads. |
| UI components | Hand-rolled dropdown/cards | **shadcn/ui** (Radix) | Accessible, themeable; faster, fewer a11y bugs. |

**Key insight:** Auth, encryption, and isolation are security-critical — hand-rolling them is the most expensive mistake in this domain (PITFALL 14). Better Auth + Drizzle + Node `crypto` cover all three with battle-tested code.

## Common Pitfalls

### Pitfall 1: LinkedIn token has no refresh (re-auth treadmill)
**What goes wrong:** LinkedIn access token expires in 60 days; standard access has no refresh token → silent expiry across all accounts.
**Why it happens:** Refresh tokens only for approved MDP partners (Microsoft Learn).
**How to avoid:** Store `expires_at`; CONN-04 "Reconnect required" when ≤7 days; one-click re-auth. Apply for MDP but never depend on it. `[CITED: learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens]`
**Warning signs:** token model lacks `expires_at`/`refresh_token`; no reconnect UI.

### Pitfall 2: Meta short-lived token never exchanged
**What goes wrong:** Demo works, breaks 1–2h after deploy.
**Why it happens:** Login returns ~1–2h token; must call `fb_exchange_token` for 60-day.
**How to avoid:** Meta `OAuthProvider.exchangeCode` performs long-lived exchange before returning. Schedule future refresh (Phase 3+); treat refresh as best-effort with re-auth fallback. `[CITED: developers.facebook.com/docs/instagram-platform/reference/refresh_access_token]`
**Warning signs:** no `fb_exchange_token` call in the Meta provider.

### Pitfall 3: Client isolation only in the UI
**What goes wrong:** a bug or malicious request reads another client's accounts.
**Why it happens:** scoping done client-side or forgotten in one endpoint.
**How to avoid:** NOT-NULL FK + `requireClientScope()` server-side on every read/write; never accept `clientId` from the request body as the scoping source (D-02: cookie is authoritative).
**Warning signs:** endpoints filtering by a client id sent in the request body.

### Pitfall 4: Plaintext tokens in DB / logs
**What goes wrong:** breach leaks every client account.
**Why it happens:** token stored as a normal column; logged in debug.
**How to avoid:** AES-256-GCM at the boundary; redact in logs; never serialize token value in API responses (CONN-03, PITFALL 14).

### Pitfall 5: App stuck in Dev mode (blocks real publish later)
**What goes wrong:** real client accounts can't connect until app review completes.
**Why it happens:** Meta Live mode / LinkedIn review pending.
**How to avoid:** Phase 1 builds the flow against dev test accounts + mock; kick off app-review in parallel (PITFALL 6). The walking skeleton ships mock-first so it is fully provable now.

### Pitfall 6: OAuth `state` not binding the client (target confusion)
**What goes wrong:** an attacker's connect callback binds a connection to the wrong client.
**Why it happens:** `state` used only for CSRF, not carrying the active client id.
**How to avoid:** D-06 — embed `clientId` (from cookie) inside the signed `state`/PKCE stash; verify at callback and bind the new `social_account` to it.

## Code Examples

### Better Auth instance (Drizzle, Postgres)
```typescript
// src/lib/auth.ts  [CITED: better-auth.com/docs/adapters/drizzle]
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  session: { expiresIn: 60 * 60 * 24 * 7 },
});
```
Session check in a Server Component (AUTH-02 — survives refresh):
```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login"); // unauthenticated → redirect (AUTH-02 negative case)
  return <Main clientId={(await getActiveClientId()) ?? undefined} />;
}
```

### AES-256-GCM vault (Node `crypto`)
```typescript
// src/lib/crypto.ts  [CITED: nodejs.org/api/crypto.html] (HIGH confidence)
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
const ALGO = "aes-256-gcm";
// Key: 32 bytes from env (base64). Derive from a passphrase safely if needed.
function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY missing");
  return Buffer.from(raw, "base64"); // expect 32-byte key
}
export function encrypt(plainText: string): { iv: string; tag: string; ciphertext: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString("base64"), tag: tag.toString("base64"), ciphertext: ct.toString("base64") };
}
export function decrypt({ iv, tag, ciphertext }: { iv: string; tag: string; ciphertext: string }): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
```
Usage at the boundary:
```typescript
const { iv, tag, ciphertext } = encrypt(token.accessToken);
await db.insert(socialAccounts).values({ clientId, platform, platformAccountId, accessTokenEnc: ciphertext, iv, tag, expiresAt: token.expiresAt ?? null });
// API serialization MUST omit iv/tag/ciphertext or return only a redacted "{encrypted}" marker.
```

### OAuthProvider connection status (CONN-04)
```typescript
// derived, never stored as the only source of truth
export type ConnectionStatus = "connected" | "reconnect_required";
export function statusFor(expiresAt: Date | null): ConnectionStatus {
  if (!expiresAt) return "reconnect_required"; // unknown/expired → force reconnect
  const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return expiresAt <= threshold ? "reconnect_required" : "connected";
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `better-auth/adapters/drizzle` subpath | separate `@better-auth/drizzle-adapter` package | Better Auth 1.x | Both work; official install doc uses the separate package. Use it. |
| `@google/generative-ai` | `@google/genai` | EOL 2025-08-31 | Not in Phase 1, but never use the deprecated SDK. |
| `instagram_basic` / `instagram_content_publish` scopes | `instagram_business_basic` / `instagram_business_content_publish` | deprecated 2025-01-27 | Use current scopes when wiring real Meta connect (Phase 1 real path). |
| Tailwind v3 (`tailwind.config.js` + `tailwindcss` PostCSS) | Tailwind v4 + `@tailwindcss/postcss` | v4.0 (Jan 2025) | Old setup breaks; use v4 plugin. |

**Deprecated/outdated:** LinkedIn UGC Posts/Shares API → use Posts API (`/rest/posts`); Meta short-lived tokens (must exchange). Both handled by provider patterns above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `drizzle-kit@^0.31` is compatible with `drizzle-orm@0.45` | Standard Stack | MEDIUM: if mismatch, `generate` fails — verify at install, pin matching. |
| A2 | Zod v4 API is fine for Phase 1 boundary validation | Standard Stack | MEDIUM: if a dep needs v3 types, pin `^3.23`. |
| A3 | `@better-auth/drizzle-adapter` is preferred over the `better-auth/adapters/drizzle` subpath | Standard Stack | LOW: both work; subpath is a safe fallback. |
| A4 | App-level scoping (cookie + FK helper) is sufficient vs Postgres RLS | Architecture | LOW: RLS is stronger but adds pooler complexity; app-level + FK is the recommended Phase 1 baseline. |
| A5 | A managed Postgres (Neon/Supabase) or Docker `postgres:18` will be available at runtime/test | Environment | MEDIUM: local env has NO Postgres/Docker — tests need a provided DATABASE_URL. |
| A6 | Better Auth default endpoints (`/api/auth/sign-up/email`, `/sign-in/email`) plus thin `/api/auth/signup`,`/login` wrappers satisfy SPEC paths | Architecture | LOW: if exact SPEC paths are hard-required, wrappers handle it. |

## Open Questions (RESOLVED)

> All three questions were resolved during planning/implementation; none block Phase 1.

1. **Exact SPEC API paths vs Better Auth conventions**
   - What we know: SPEC says `POST /api/auth/signup` and `POST /api/auth/login`; Better Auth uses `/api/auth/sign-up/email` & `/sign-in/email`.
   - What's unclear: whether tests assert the literal SPEC paths.
   - Recommendation: ship the catch-all (`/api/auth/[...all]`) AND thin wrappers at the SPEC paths → both work.
   - **RESOLVED:** Plan 01 ships the Better Auth catch-all (`/api/auth/[...all]`) AND thin wrappers at `POST /api/auth/signup` + `POST /api/auth/login`; Plan 01 Task 1-3 tests assert those literal SPEC paths (AUTH-01/02). Both conventions coexist.

2. **Test database availability**
   - What we know: local machine has no Postgres/Docker; network is selective.
   - What's unclear: will CI/dev provide a Postgres URL, or should Phase 1 tests run on PGlite (`@electric-sql/pglite` + drizzle pglite driver)?
   - Recommendation: provide `DATABASE_URL_TEST` (Neon free tier recommended); optionally support PGlite for offline unit tests of crypto/scoping logic.
   - **RESOLVED:** Tests use `DATABASE_URL_TEST` (set in `vitest.setup.ts`, falling back to `DATABASE_URL`); Plan 01 Task 1-3 and Plan 02/03 integration tests run against it. No local Postgres required for CI/dev (managed URL or PGlite fallback).

3. **KMS upgrade path**
   - What we know: Phase 1 uses env `TOKEN_ENCRYPTION_KEY` (AES-256-GCM), KMS deferred.
   - What's unclear: env key rotation procedure.
   - Recommendation: document rotation (re-encrypt rows on key version bump) as a later-phase task; Phase 1 stores a `key_version` column for forward compatibility.
   - **RESOLVED:** Phase 1 stays on env `TOKEN_ENCRYPTION_KEY` (AES-256-GCM); `social_account.key_version` column is created in Plan 01 schema for forward-compatible KMS re-encryption in a later phase (KMS deferred per 01-CONTEXT out-of-scope). No blocker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24 LTS | Whole app | ✓ | 24.15.0 | — |
| npm | Install | ✓ | 11.12.1 | — |
| PostgreSQL 18 | DB (runtime + tests) | ✗ (no local psql/docker) | — | Managed URL (Neon/Supabase) OR Docker `postgres:18` (where docker exists) OR PGlite for tests |
| Docker | Local Postgres/Redis | ✗ | — | Use managed Postgres; Redis not needed in Phase 1 |
| Better Auth / Drizzle / crypto | Auth + vault | ✓ (npm) | per stack | — |
| Vitest | Tests | ✓ (npm) | latest | — |

**Missing dependencies with no fallback:** none blocking — Postgres is satisfiable via managed URL or PGlite.
**Missing dependencies with fallback:** Local Postgres → managed URL / PGlite (test-only). Redis/BullMQ intentionally absent (Phase 3+).

## Validation Architecture

> nyquist_validation is **enabled** in `.planning/config.json`. The test suite must prove all 9 requirements. Framework: **Vitest** with a real (or PGlite) Postgres test database; integration tests hit the Next.js Route Handlers via `supertest`/`fetch` against a test server, or test the `lib/` functions directly (pure, fast). Crypto and scoping are unit-tested without a server.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest v3) |
| Config file | `vitest.config.ts` (root) — `test.environment: "node"`, `test.setupFiles: ["vitest.setup.ts"]` (loads `DATABASE_URL_TEST`) |
| Quick run command | `vitest run src/lib` (pure unit: crypto, scoping, status) |
| Full suite command | `vitest run` (includes DB-backed integration tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Signup creates user with **hashed** (non-plaintext) password; duplicate email → 409; stored pw ≠ input | integration + DB assertion | `vitest run src/app/api/auth/signup/route.test.ts` | ❌ Wave 0 |
| AUTH-01 | Login returns session for correct creds; wrong password → 401; unknown email → 401 | integration | `vitest run src/app/api/auth/login/route.test.ts` | ❌ Wave 0 |
| AUTH-02 | Authenticated session survives refresh (cookie valid on 2nd request); no/invalid cookie → 401/redirect | integration | `vitest run src/lib/auth-session.test.ts` | ❌ Wave 0 |
| CLNT-01 | Authed `POST /api/clients` creates client owned by user; unauthed → 401 | integration + DB | `vitest run src/app/api/clients/route.test.ts` | ❌ Wave 0 |
| CLNT-02 | Query scoped to client Y returns no rows for account of client X; FK rejects account without valid client | integration + DB assertion | `vitest run src/lib/client-scope.test.ts` | ❌ Wave 0 |
| CLNT-03 | Two clients list distinctly; PATCH X ≠ Y; DELETE X removes only X's accounts (cascade) | integration + DB | `vitest run src/app/api/clients/[id]/route.test.ts` | ❌ Wave 0 |
| CONN-01 | Meta (mock) connect stores encrypted long-lived token + retrievable page/account id; shows "connected" | integration (mock provider) | `vitest run src/lib/oauth/meta.test.ts` | ❌ Wave 0 |
| CONN-02 | LinkedIn (mock) connect stores encrypted token + profile id; shows "connected" | integration (mock provider) | `vitest run src/lib/oauth/linkedin.test.ts` | ❌ Wave 0 |
| CONN-03 | Raw DB query of token column = ciphertext (not plaintext); no API returns plaintext | unit (crypto roundtrip) + DB assertion | `vitest run src/lib/crypto.test.ts` | ❌ Wave 0 |
| CONN-04 | Token expiring in 3 days → "reconnect_required"; expired → reconnect; >7 days → "connected"; reconnect URL re-inits OAuth | unit (status fn) + integration | `vitest run src/lib/connection-status.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run src/lib` (fast, no server needed — covers crypto, scoping, status).
- **Per wave merge:** `vitest run` (full, includes DB-backed Route Handler tests).
- **Phase gate:** full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework config + test DB wiring.
- [ ] `vitest.setup.ts` — load `DATABASE_URL_TEST`, run migrations on test schema.
- [ ] `src/lib/crypto.test.ts` — AES-256-GCM roundtrip; ciphertext ≠ plaintext; wrong key fails; no token in logs.
- [ ] `src/lib/client-scope.test.ts` — cross-client read returns empty; FK NOT-NULL enforced.
- [ ] `src/lib/connection-status.test.ts` — 7-day threshold logic.
- [ ] `src/app/api/auth/signup/route.test.ts` — creates hashed user; duplicate 409.
- [ ] `src/app/api/auth/login/route.test.ts` — correct→session, wrong→401.
- [ ] `src/lib/auth-session.test.ts` — refresh-surviving session; invalid cookie rejected.
- [ ] `src/app/api/clients/route.test.ts` — authed create; unauthed 401.
- [ ] `src/app/api/clients/[id]/route.test.ts` — list/distinct; PATCH isolation; DELETE cascade.
- [ ] `src/lib/oauth/meta.test.ts` — mock full flow → encrypted token + identity.
- [ ] `src/lib/oauth/linkedin.test.ts` — mock full flow → encrypted token + profile id.

*(No existing test infra — all are Wave 0 gaps.)*

**Key DB assertions for the validator:**
1. `SELECT access_token_enc, iv, tag FROM social_account WHERE id=$1` → value is base64 ciphertext, NOT the original token string (CONN-03).
2. Insert `social_account` with `client_id` referencing a non-existent client → FK error (CLNT-02).
3. `SELECT count(*) FROM social_account WHERE client_id='X'` after connecting to client Y → 0 (CLNT-02).
4. `SELECT password FROM "user" WHERE email=$1` → not equal to the input password (AUTH-01).

## Security Domain

> `security_enforcement` is **enabled** (ASVS Level 1, block on high). Phase 1 touches auth, session, encryption, and OAuth — all ASVS-relevant.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Better Auth `emailAndPassword` (scrypt hashing, lockout-ready); reject duplicate emails (409). |
| V3 Session Management | yes | Better Auth DB-backed cookie sessions; `HttpOnly`, `SameSite=Lax/Strict`, `Secure` in prod; `expiresIn` 7d. |
| V4 Access Control | yes | Server-side `client_id` scoping (D-02) + NOT-NULL FK; never trust client-supplied id. |
| V5 Input Validation | yes | Zod at every Route Handler boundary; env validated at boot (`TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`, OAuth secrets). |
| V6 Cryptography | yes | AES-256-GCM via Node `crypto`; 32-byte key from env; IV per-encryption; auth tag verified on decrypt. |
| V8 Data Protection | yes | Tokens encrypted at rest; never logged; API responses redact token value. |
| V9 Communications | yes (prod) | Enforce HTTPS; `Secure` cookies; OAuth `redirect_uri` exact-match + `state`/`PKCE` (RFC 7636). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Drizzle parameterized queries (no string SQL); FK constraints. |
| Token theft (DB leak) | Info Disclosure | AES-256-GCM at rest; key in env/secret manager, never in DB or logs. |
| Session fixation / CSRF | Spoofing | Better Auth signed session cookie (`HttpOnly`, `SameSite`); OAuth `state` + PKCE. |
| OAuth target confusion | Spoofing | `clientId` embedded in signed `state`/PKCE stash (D-06); verified at callback. |
| Cross-client data leak | Info Disclosure / Elevation | Server-side `client_id` scoping + NOT-NULL FK (CLNT-02). |
| Secret exposure | Info Disclosure | `client_secret` server-only env; never shipped to browser bundle. |

**Highest-risk integration points (flagged for the planner):**
1. **OAuth token lifecycle** (PITFALLS 1, 2, 8) — long-lived exchange, expiry tracking, reconnect UX, refresh-race lock (lock deferred to Phase 3 but design the `social_account` for it now).
2. **Client isolation** (CLNT-02) — a single missed scope = cross-client leak; enforce via `requireClientScope()` + FK.
3. **Encryption correctness** (CONN-03) — wrong IV/tag handling silently corrupts; cover with roundtrip + wrong-key tests.

## Sources

### Primary (HIGH confidence)
- Better Auth Installation — `better-auth.com/docs/installation` (catch-all route, `toNextJsHandler`).
- Better Auth Drizzle Adapter — `better-auth.com/docs/adapters/drizzle` (`@better-auth/drizzle-adapter`, `provider: "pg"`).
- Better Auth Email & Password — `better-auth.com/docs/authentication/email-password` (`emailAndPassword.enabled`, scrypt hashing, `signUpEmail`/`signInEmail` server methods).
- Better Auth Session Management — `better-auth.com/docs/concepts/session-management` (DB-backed cookie sessions, `auth.api.getSession`).
- Node.js `crypto` (AES-256-GCM) — `nodejs.org/api/crypto.html` (HIGH; established AEAD pattern).
- npm registry (`npm view`) — version verification for next 15.5.19, react 19.2.7, typescript 5.7, better-auth 1.6.23, @better-auth/drizzle-adapter 1.6.23, drizzle-orm 0.45.2, postgres 3.4.9, drizzle-kit 0.31.10, zod 4.4.3.

### Secondary (MEDIUM confidence)
- Meta Refresh Access Token — `developers.facebook.com/docs/instagram-platform/reference/refresh_access_token` (long-lived 60d exchange).
- LinkedIn Refresh Tokens — `learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens` (60d, MDP-gated refresh).
- Tailwind v4 — `tailwindcss.com/blog/tailwindcss-v4` (`@tailwindcss/postcss`).
- AGENTS.md STACK.md / ARCHITECTURE.md / PITFALLS.md / SUMMARY.md (project-fixed stack + integration pitfalls).

### Tertiary (LOW confidence)
- Exact external OAuth endpoint behavior for unapproved apps — intentionally deferred behind `OAUTH_PROVIDER_MODE=mock` for Phase 1; real endpoints wired but not executable without credentials/review.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified on npm; Better Auth patterns cited from official docs.
- Architecture: HIGH — adapter/provider/scoping patterns well-established; mock-interface requirement explicit in SPEC.
- Pitfalls: HIGH — PITFALLS.md + official Microsoft/Meta docs corroborate token-lifecycle and isolation risks.

**Research date:** 2026-07-11
**Valid until:** 2026-08-11 (30 days — stack is stable; re-verify Better Auth/drizzle-kit minor compatibility at plan time given fast-moving versions).
