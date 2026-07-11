# Project Research Summary

**Project:** Content-Creator
**Domain:** Multi-platform social media publishing & scheduling SaaS (agency-managed; real platform APIs: Meta Graph, LinkedIn, Google Gemini)
**Researched:** 2026-07-11
**Confidence:** HIGH

## Executive Summary

Content-Creator is a B2B agency tool that connects clients' Facebook/Instagram/LinkedIn accounts, lets an internal team compose posts (text/image/video), generate AI copy via Gemini with per-client brand voice, and publish immediately or on a schedule via a reliable background worker. The competitive space (Buffer, Hootsuite, Later) is mature and the "publish + schedule" core is commoditized — our sharpest, lowest-cost differentiators are **isolated multi-client workspaces** and **per-client AI brand voice**, both of which we make core v1 capabilities (competitors gate or omit them). The defining engineering challenge is *not* the UI: it is a durable, offline-capable publish pipeline where each platform has a distinct media model, caption field, rate limit, and content-type support.

The research converges on one recommended approach: a **modular Next.js 15 monolith** (App Router for dashboard + HTTP API) plus a **separate always-on BullMQ worker process** for scheduling, a **Postgres+Drizzle** store, **Cloudflare R2** for media, and **envelope-encrypted OAuth tokens**. Publishing is built behind a **`Publisher` adapter interface** so platforms are staged one at a time (recommended first target: Meta/Facebook, since Instagram shares its OAuth + token infrastructure and LinkedIn carries the highest approval risk). The scheduler must be DB/queue-backed and idempotent — never a browser timer.

The dominant risks are external and outside our control: **platform app review gates** (Meta Live mode, LinkedIn Community Management/MDP — weeks to months, no guaranteed timeline) and **token-expiry/re-auth treadmill** (Meta 60-day long-lived tokens needing refresh; LinkedIn 60-day access tokens with no reliable refresh for standard access). Mitigation is architectural and must be built in Phase 1, not retrofitted: per-client encrypted token vault, long-lived exchange + auto-refresh for Meta, first-class "Reconnect" UX for both, and submission of app reviews **in parallel with the build**. The second risk class is correctness of the async publish pipeline (IG's two-step container model, idempotency, public media URLs, timezones) — proven with a `FakePublisher` before any real API friction.

## Key Findings

### Recommended Stack

A TypeScript-green, server-side stack. Next.js 15.5 (App Router) serves the dashboard and HTTP API (Route Handlers for OAuth callbacks, post CRUD, Gemini, presigned URLs). A **separate `worker.ts` process** runs BullMQ workers; both share `lib/` (db, redis, crypto, platform clients). Node 24 LTS runtime, PostgreSQL 18 (managed), Redis 7 (managed, e.g. Upstash) backing BullMQ, Drizzle ORM 0.45 with the `postgres.js` driver. Media in Cloudflare R2 (S3-compatible, zero egress) via `@aws-sdk/client-s3` presigned URLs. AI via `@google/genai` (the GA SDK — `@google/generative-ai` is EOL). Internal team auth via Better Auth; Tailwind v4 + shadcn/ui for the dashboard; Zod at every boundary.

**Core technologies:**
- **Next.js 15.5 (App Router) + React 19 + TypeScript 5.7**: one deployable dashboard+API unit; required for the agency console.
- **Node.js 24 LTS (Krypton)**: correct greenfield target; Node 22 is Maintenance LTS only.
- **PostgreSQL 18 + Drizzle ORM 0.45.2 + postgres.js**: relational store; SQL-first, no codegen, tiny runtime. (Pin Drizzle 0.45.x — v1.0 is RC.)
- **BullMQ 5.79 + Redis 7 + ioredis**: the riskiest-but-correct piece — durable delayed jobs survive restarts, retry with backoff, multi-instance safe. **Do NOT use node-cron/Agenda/Temporal for the schedule.**
- **Cloudflare R2 + @aws-sdk/client-s3 v3**: S3-compatible media with zero egress; presigned PUT for direct browser upload.
- **@google/genai (Gemini)**: GA copy generation; invoked only in the compose path, never the publish path.
- **Better Auth (latest)**: internal team login only — platform OAuth tokens are a separate, self-implemented concern.
- **AES-256-GCM envelope encryption (Node `crypto` + KMS/Vault)**: OAuth tokens encrypted at rest. (No extra dependency; KMS recommended but env-key is an MVP stepping stone.)
- **Tailwind v4 + @tailwindcss/postcss + shadcn/ui + Zod**: B2B dashboard DX; validate every external boundary.

### Expected Features

FEATURES.md maps table stakes to our scoped v1 (internal-team-only, direct publishing, real APIs, Gemini) and flags deliberate deferrals. The critical cross-cutting finding: **per-platform publishing is not uniform** — one "post" object must translate into N platform-specific payloads; this is the highest-effort area and should drive phase ordering (compose/storage first, then publish adapters one platform at a time).

**Must have (table stakes):**
- Client/account management (isolated multi-client workspaces) — defines the product as an *agency* tool, not a creator tool.
- Multi-platform OAuth connection (start with ONE platform to de-risk) + secure token storage.
- Post composer: text + single image + video; media library; visual calendar/scheduling.
- Reliable background scheduler (worker + queue, not browser timer); direct publish; internal team auth; AI copy assist (Gemini) with per-client brand voice.

**Should have (competitive — differentiators):**
- Per-client AI brand voice (Gemini learns each client's tone) — our #1 differentiator, cheap to build.
- Automatic per-platform reformatting + limit/format validation in the composer (warns on char/format limits).
- AI first-comment/hashtag suggestions per platform; per-client media organization; bulk/CSV scheduling (add after core works).

**Defer (v2+):**
- Client approval/portals, white-label, analytics/reporting, social listening/inbox, additional networks (TikTok/X/YouTube/Pinterest), fine-grained team roles, native mobile.
- **LinkedIn organic carousels: NOT supported via API** (only sponsored) — ship IG carousels in v1, treat LinkedIn carousels as a known limitation.

### Architecture Approach

A modular monolith with explicit boundaries; `publishing/` is the seam that matters most (jobs, scheduler, worker, adapters, tokens co-located). The publish pipeline follows four patterns: (1) **Platform Adapter** behind a common `Publisher` interface resolved by registry — adding a platform is a new folder, no scheduler changes; (2) **Scheduler + durable Queue + stateless Worker** — dispatcher polls due jobs (`SKIP LOCKED` or BullMQ), separate always-on worker executes; (3) **Idempotent publish + status machine** (`SCHEDULED → RUNNING → PUBLISHED | FAILED` + per-target sub-state) so retries never double-post; (4) **Encrypted token vault with lazy refresh** surfacing "reconnect required" on failure. Meta IG is a multi-step async container flow (create → poll `FINISHED` → publish → poll `PUBLISHED`); LinkedIn is asset-upload-then-post. AI is a synchronous compose-path helper only.

**Major components:**
1. **Auth + Client/Account Service** — internal team login; per-client connected social accounts + encrypted token store.
2. **Post Composer + Media Service** — drafts (text/image/video/carousel), uploads to R2, public CDN URLs for platform fetch.
3. **Scheduling Domain + Worker + Adapters** — the core: `PublishJob` store, dispatcher, BullMQ worker, per-platform `Publisher` adapters, retry/backoff, dead-letter.

### Critical Pitfalls

The top pitfalls (full list + per-phase mapping in PITFALLS.md). These must be designed in from the start, not fixed later:

1. **Browser-timer / in-process scheduling (PITFALL 3)** — posts never publish offline; violates the core reliability constraint. → persistent worker + durable job store + idempotency + health monitor.
2. **Meta short-lived token never exchanged (PITFALL 2)** — demo works, breaks 1–2h after deploy. → OAuth callback immediately exchanges for long-lived (60d) + auto-refresh every 30–45d; treat refresh as best-effort with re-auth fallback.
3. **LinkedIn refresh gated behind MDP approval (PITFALL 1)** — 60-day silent expiry, no reliable programmatic refresh for standard access. → store `expires_at`, 7-day warning, first-class "Reconnect LinkedIn" per account; apply for MDP but never depend on it.
4. **IG media not public / container built too early (PITFALLS 4 & 5)** — Meta cURLs media at publish time (must be public, stable URL); IG containers expire in 24h (build at publish time, poll to `FINISHED`). → public CDN URL; worker creates container at due time, never at compose time.
5. **App stuck in Dev mode / review never done (PITFALL 6)** — highest external risk. → start with ONE platform; submit Meta Live-mode + LinkedIn Community Management review **in parallel with the build**; dev test accounts for end-to-end build.
6. **One content model for all platforms (PITFALL 7) + rate limits (PITFALL 11)** — per-platform char/format/field differences; LinkedIn 24h cooldown on overage. → per-platform transform/validate layer; worker throttles per account + honors 429/backoff.

## Implications for Roadmap

Research strongly recommends a **dependency-driven, one-platform-at-a-time** phase structure. The adapter interface means we validate the entire async pipeline with a `FakePublisher` before any real API, then add Meta → IG → LinkedIn cheaply. Phase ordering below follows ARCHITECTURE.md's build order, with pits called out per phase.

### Phase 1: Foundation + Auth + Client/Account CRUD + OAuth Token Vault
**Rationale:** Establishes the domain model and the security substrate everything else depends on. The token vault + expiry/refresh/re-auth model and the long-lived exchange MUST be designed here (Pitfalls 1, 2, 8, 14) — retrofitting encryption and re-auth UX is expensive.
**Delivers:** Next.js 15 app shell, Postgres+Drizzle schema, Better Auth (internal team), client/account tables, encrypted `social_account` token store (AES-256-GCM), Meta OAuth callback that performs long-lived exchange, LinkedIn OAuth scaffold, dev-mode test accounts, app-review submissions kicked off in parallel.
**Addresses:** Client/account management; multi-platform OAuth (scaffold); internal team auth.
**Avoids:** P1 (LinkedIn re-auth), P2 (Meta short-lived token), P8 (refresh race/lock), P9 (PPA instruction), P10 (current scopes), P14 (insecure tokens), P6 (dev-mode/review workstream).
**Stack:** Next.js 15.5, Node 24, Postgres 18, Drizzle 0.45, Better Auth, Zod, crypto envelope encryption.

### Phase 2: Composer + Media Library + PublishJob Model
**Rationale:** Builds the content domain and durable job record(s) with no real publishing yet — de-risks the data model. Media must land on a public CDN URL (Pitfall 4) so it's reachable by Meta at publish time.
**Delivers:** Post composer (text/image/video; carousel model stubbed), media upload to R2 via presigned URLs, `PublishJob` entity (status, `scheduled_for`, per-target sub-state, idempotency key), calendar/queue UI.
**Addresses:** Post composer (text/image/video), media library, scheduling + calendar (UI), per-client media organization.
**Avoids:** P4 (public media URL strategy), P7 partial (first-platform validation contract).
**Stack:** R2 + @aws-sdk/client-s3, Drizzle, Zod.

### Phase 3: Scheduler + Worker + Token Store + FakePublisher (reliability proof)
**Rationale:** Proves the hardest constraint — offline publishing — before any platform friction. Validate dispatcher polling, worker execution, status machine, idempotency, retries, and timezone handling against a no-op adapter.
**Delivers:** BullMQ worker process, dispatcher (poll due jobs / SKIP LOCKED), idempotent publish + status machine, exponential backoff, dead-letter shape, health/heartbeat monitor, UTC+IANA timezone handling, rate-limit-aware throttle scaffolding.
**Addresses:** Reliable background scheduler (the core P1 deliverable).
**Avoids:** P3 (browser-timer), P12 (timezone), P11 (throttle/backoff skeleton), P13 (failed-state shape).
**Stack:** BullMQ 5.79 + Redis 7 + ioredis, `FakePublisher`.

### Phase 4: ONE Real Adapter — Meta (Facebook Page post) first
**Rationale:** Meta is the agency's primary channel and shares OAuth/token infra with Instagram (IG needs the linked FB Page token anyway). A Facebook *Page* post is the simplest Meta path (publish via `message`/`image_url`, no binary container upload). If Meta Business approval is the blocking risk, swap to LinkedIn to validate the pipeline, then return — but **one platform only**.
**Delivers:** Meta adapter implementing `Publisher`, end-to-end OAuth→token store→worker→Graph API→`PUBLISHED`, per-platform validation layer for Meta, PPA instruction in connect flow.
**Addresses:** Direct publish (Meta/FB), per-platform formatting/validation (contract).
**Avoids:** P2 (refresh job live), P5 (container-at-publish-time for IG next phase), P6 (Live-mode validation), P7, P10, P13.
**Stack:** BullMQ worker, Meta Graph API, token vault (live).

### Phase 5: Second Meta Surface — Instagram (incl. carousels)
**Rationale:** Reuses the same token store + worker; adds only the async container flow behind the Meta adapter. IG carousels are a stated differentiator, so they follow immediately after FB validation.
**Delivers:** IG container flow (create → poll `FINISHED` → publish → poll `PUBLISHED`), video/Reels resumable upload, IG carousels (2–10 items), IG-specific validation (JPEG-only, 2200-char caption, 25/24h limit).
**Addresses:** IG publishing, Instagram carousels (P2 differentiator), per-platform validation UI.
**Avoids:** P4 (public media URL), P5 (container at publish time), P7 (IG limits), P11 (IG rate limit).

### Phase 6: LinkedIn Adapter
**Rationale:** Lowest risk once the pipeline exists — asset-upload-then-post behind the same interface. Highest approval risk, so it comes after Meta is proven; carries the re-auth UX load (Pitfall 1).
**Delivers:** LinkedIn Posts API adapter (`/rest/posts`, `w_member_social`/`w_organization_social`), asset register-upload flow, org-page posting, 60-day expiry warning + one-click Reconnect, no organic carousels (documented limitation).
**Addresses:** LinkedIn publishing; LinkedIn carousels explicitly deferred (API-blocked).
**Avoids:** P1 (re-auth), P7 (LinkedIn limits/field names), P10 (Posts API not UGC/Shares), P11 (LinkedIn cooldown).

### Phase 7: Hardening + Differentiators + v1.x additions
**Rationale:** Once all three platforms publish reliably, layer the competitive differentiators and operational hardening. AI brand voice is a slightly larger unit (needs stored brand profile) so it lands here or parallel to Phase 2+.
**Delivers:** Per-client AI brand voice (Gemini prompt profiles), AI first-comment/hashtag per platform, bulk/CSV scheduling, dead-letter/retry UI, token-reconnect UX polish, observability (job lag, failure rate), per-account rate-limit enforcement across multi-client fan-out.
**Addresses:** AI copy assist + brand voice (differentiator), bulk scheduling, per-platform validation UI, recovery UX.
**Avoids:** remaining P11 (multi-account fan-out), P13 (recovery UX), UX pitfalls.

### Phase Ordering Rationale

- **Dependencies drive sequence:** Auth → Clients/Accounts → Composer/Media → PublishJob → Scheduler/Worker/TokenStore (+FakePublisher) → *one* real adapter → other adapters → hardening. Each phase is independently shippable and de-risks the next.
- **Adapter interface enables staging:** proving the pipeline with `FakePublisher` (Phase 3) isolates "did we build scheduling correctly?" from "did the platform reject us?" — the latter is the riskier, slower-to-debug class.
- **External risk is front-loaded:** submitting app reviews in Phase 1 and building against dev test accounts means the long, uncontrollable approval clock runs while we build, rather than after.
- **Security is foundational:** encryption-at-rest, long-lived exchange, and re-auth UX cannot be retrofitted cheaply — they are Phase 1 concerns, not Phase 5 cleanups.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-plan-phase --research-phase`):
- **Phase 4 (Meta adapter):** real Graph API field/permission specifics, video resumable upload, exact scope strings, PPA edge cases — needs API-reference research during planning.
- **Phase 5 (Instagram):** container polling semantics, Reels constraints, carousel item limits, `status_code` error taxonomies — high interplay with Pitfalls 4/5/13.
- **Phase 6 (LinkedIn):** Posts API lifecycle, asset upload, Community Management/MDP review prep (screencast), org vs member posting — highest external-approval risk.
- **Phase 1 (OAuth/token vault):** KMS vs env-key decision, exact envelope-encryption implementation, refresh-token concurrency lock design.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Composer/Media):** well-trodden S3 presigned-upload + Drizzle schema patterns.
- **Phase 3 (Scheduler/Worker):** BullMQ delayed-job + idempotency + SKIP LOCKED are established, documented patterns (see STACK.md/PITFALLS.md sources).
- **Phase 7 (Hardening):** backoff/DLQ/observability are standard queue-operations practices.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against official release feeds (Next 15.5.19, Node 24 LTS, Postgres 18.4, BullMQ 5.79, Drizzle 0.45.2, @google/genai GA). MEDIUM only on fast-moving libs (Better Auth, Zod) where "latest" is pinned, and on OAuth encryption library choice (pattern HIGH, exact KMS MEDIUM). |
| Features | HIGH | Competitor landscape + Meta API limits from multiple 2025–2026 reviews and official docs. MEDIUM on LinkedIn/agency-vendor specifics (vendor marketing + third-party API docs). |
| Architecture | HIGH | Patterns (adapter, queue+worker, idempotency, encrypted vault) are well-established, corroborated by Azure Architecture, Railway, and System Design Sandbox references. |
| Pitfalls | HIGH | Platform API behaviors verified against Microsoft Learn + Meta for Developers official docs plus 2026 practitioner post-mortems (Nango, dev.to, StackOverflow). MEDIUM only on IG long-lived token auto-refresh real-world reliability. |

**Overall confidence:** HIGH — the stack, architecture, and pitfalls are well-corroborated by official sources; the main residual uncertainties are external (app-review timelines) and implementation-detail-level (exact API field names), both scoped into research-flagged phases.

### Gaps to Address

- **App-review timeline uncertainty:** Meta Live-mode + LinkedIn Community Management/MDP review have no guaranteed schedule (weeks–months). Handle by submitting in Phase 1 and building against dev test accounts; design connection states to degrade gracefully ("pending review / limited").
- **LinkedIn refresh availability:** Standard access likely has NO programmatic refresh (re-auth every 60d). Confirm MDP status early; regardless, ship re-auth UX as the safety net (Pitfall 1).
- **Exact platform field/limit specifics:** per-platform caption fields (`caption`/`commentary`/`message`), aspect ratios, hashtag caps, and `429`/cooldown semantics need verification against live API during Phases 4–6 (research-flagged).
- **Media public-URL strategy:** decide R2 public bucket vs CloudFront vs time-of-publish copy; affects PITFALL 4. Resolve in Phase 2/4.
- **Gemini model choice:** `gemini-2.5-flash`/`pro` GA vs `gemini-3` preview — pin a GA model for v1; revisit when 3-series is stable.

## Sources

### Primary (HIGH confidence)
- Meta for Developers — Instagram Content Publishing / Container / Resumable Uploads / Refresh Access Token (official): container model, public-media requirement, PPA, 24h expiry, 25/24h limit, long-lived refresh.
- Microsoft Learn — LinkedIn Posts API, Refresh Tokens w/ OAuth2.0, Community Management App Review (official): `/rest/posts` replaces UGC/Shares, 60d token, MDP-gated refresh, screencast review.
- Next.js / React / Node.js / PostgreSQL / Drizzle / BullMQ / Tailwind v4 / Better Auth release channels (official): version pins verified against release feeds.
- @google/genai migration docs (official): `@google/generative-ai` deprecated/EOL 2025-08-31.

### Secondary (MEDIUM confidence)
- 2026 practitioner sources: Bedrock Labs, CODERCOPS, DevVersus, Viprasol (BullMQ vs Temporal/Inngest); Nango LinkedIn `invalid_grant` post-mortem; dev.to Meta OAuth walkthrough; ConnectSafely LinkedIn 2026 guide; Postproxy / Phyllo (per-platform capability matrix, deprecated scopes).
- Competitor feature reviews 2025–2026 (RateTheTool, StackFYI, Conbersa, Clarigital, Libril): Buffer/Hootsuite/Later feature parity and gaps.
- Agency-vendor feature sets (Cloud Campaign, Brandlix, Social9, Antwork): differentiator positioning (per-client voice, white-label).

### Tertiary (LOW confidence)
- IG long-lived token auto-refresh real-world reliability (StackOverflow 2023–2025): treat refresh as best-effort; keep re-auth fallback.
- Specific "best" KMS library choice for envelope encryption: pattern established; exact provider left to cloud decision.

---

*Research completed: 2026-07-11*
*Ready for roadmap: yes*
