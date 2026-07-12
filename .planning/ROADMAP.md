# Roadmap: Content-Creator

## Overview

Content-Creator is an agency tool to generate, schedule, and publish content to clients' Facebook, Instagram, and LinkedIn accounts from one dashboard. The roadmap follows a **dependency-driven, one-platform-at-a-time** path (per research) inside a **Vertical MVP** mode: each phase delivers a coherent, verifiable capability, and the publish pipeline is proven with a fake adapter before any real API friction. Phases 1–3 build the foundation (auth, isolated clients, encrypted token vault, composer, media, durable scheduler). Phase 4 lands the first end-to-end publish vertical (Meta/Facebook) through a per-platform adapter; Phases 5–6 extend that same adapter pipeline to Instagram (incl. carousels) and LinkedIn. Phase 7 layers the AI differentiator (Gemini per-client brand voice) and operational hardening. External app-review risk is front-loaded: OAuth connections are built in Phase 1 and platform reviews are submitted in parallel with the build.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, ...): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation — Auth, Clients & Connections** - Team sign-in, isolated multi-client workspaces, and OAuth token vault with encrypted storage + reconnect state (implemented 2026-07-11; build/test/DB verification pending — sandbox has no network/Postgres)
- [x] **Phase 2: Composer & Media Library** - Compose text/image posts with per-platform validation; upload media via R2 presigned URLs (implemented 2026-07-12; verification pending)
- [ ] **Phase 3: Scheduler & Worker (reliability proof)** - Schedule posts with correct timezones; durable background worker publishes due jobs idempotently (proven via FakePublisher)
- [ ] **Phase 4: Publish to Meta (Facebook)** - First real per-platform adapter; immediate publish to connected Meta accounts with tracked status (first vertical MVP)
- [ ] **Phase 5: Publish to Instagram (incl. carousels)** - Extends the adapter pipeline to Instagram, incl. multi-image carousels and IG container flow
- [ ] **Phase 6: Publish to LinkedIn** - Extends the adapter pipeline to LinkedIn with first-class 60-day re-auth
- [ ] **Phase 7: AI (Gemini) & Hardening** - Per-client brand-voice copy generation plus recovery/observability/rate-limit hardening

## Phase Details

### Phase 1: Foundation — Auth, Clients & Connections
**Goal**: Agency team can sign in, manage isolated client workspaces, and connect each client's social accounts via OAuth with tokens stored encrypted and a reconnect state for expiring tokens.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, CLNT-01, CLNT-02, CLNT-03, CONN-01, CONN-02, CONN-03, CONN-04
**Success Criteria** (what must be TRUE):
  1. A team member can sign up and log in with email/password and stays logged in after a browser refresh.
  2. A team member can create a client workspace and view/manage multiple clients separately.
  3. Within a client workspace, the team can connect that client's Facebook/Instagram (Meta OAuth) and LinkedIn accounts, scoped to that client only (isolation).
  4. Connected accounts show a "Reconnect required" state when a token nears expiry, with a one-click re-auth path.
  5. OAuth tokens are encrypted at rest (no plaintext tokens retrievable through the app; verifiable in storage).
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — Walking skeleton + team auth (AUTH-01, AUTH-02): scaffold Next.js + Drizzle + Better Auth, signup/login with SPEC-exact paths, session survives refresh, full DB schema + [BLOCKING] drizzle-kit push (pending).
- [x] 01-02-PLAN.md — Client workspaces & isolation (CLNT-01/02/03): client CRUD API, server-side scoping helper, nav ClientSwitcher (active-client cookie), onboarding, default connections landing.
- [x] 01-03-PLAN.md — OAuth connections + encrypted vault + reconnect (CONN-01/02/03/04): OAuthProvider (mock + real Meta/LinkedIn), AES-256-GCM vault, connect/callback/reconnect endpoints, "Reconnect required" state.
**UI hint**: yes

### Phase 2: Composer & Media Library
**Goal**: Team can compose posts (text, single image, video, IG carousel) with per-platform limit validation and upload media to a public CDN-ready library.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-05, MEDA-01, MEDA-02

Plans:
- [x] 02-01-PLAN.md — Post CRUD + R2 media upload + Composer UI (COMP-01, COMP-02, COMP-05, MEDA-01, MEDA-02)
**Success Criteria** (what must be TRUE):
  1. Team composes a post with text and optionally adds a single image, a video, or an Instagram carousel (2–10 images).
  2. Team uploads media via presigned URLs and the media appears in a per-client media library.
  3. Uploaded media resolves to a stable public CDN URL reachable by platforms at publish time.
  4. The composer warns when content exceeds per-platform caption length/format limits and shows platform-specific guidance.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Scheduler & Worker (reliability proof)
**Goal**: Team can schedule posts for future times with correct timezone handling, and a durable background worker publishes due posts reliably and idempotently (proven with a fake adapter).
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SCHD-01, SCHD-02, SCHD-03, SCHD-04
**Success Criteria** (what must be TRUE):
  1. Team schedules a post for a future date/time in their local timezone, and the scheduled time is stored/displayed correctly across IANA timezones.
  2. A calendar/queue view lists scheduled posts with their status.
  3. A background worker (not a browser timer) publishes due jobs even with no user online, without double-posting on retry (idempotent).
  4. The publish pipeline tracks a clear per-target status through scheduled → running → published/failed (state machine proven via FakePublisher).
**Plans**: TBD
**UI hint**: yes

### Phase 4: Publish to Meta (Facebook)
**Goal**: Team can publish immediately to a client's connected Meta (Facebook) account via the per-platform adapter, with tracked status — completing the first end-to-end publish vertical.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PUBL-01, PUBL-02, PUBL-03
**Success Criteria** (what must be TRUE):
   1. Team publishes a post immediately to one or more connected Meta/Facebook accounts.
   2. Publishing flows through a per-platform `Publisher` adapter interface (Meta adapter) — architecture supports adding more platforms without scheduler changes.
   3. Each publish target shows tracked status (scheduled/running/published/failed) and failures are reported per target.
   4. Meta tokens are exchanged for long-lived tokens and refreshed where possible; the connection degrades gracefully if app review is pending.
**Plans**: 1 plan
Plans:
- [x] 04-01-PLAN.md — MetaPublisher adapter, per-page Facebook tokens, OAuth enhancement, publish API endpoint, PublishModal UI, publish status view with polling, tests.
**UI hint**: yes

### Phase 5: Publish to Instagram (incl. carousels)
**Goal**: Team can publish to a client's connected Instagram account, including multi-image carousels, reusing the Meta token store + worker behind the same adapter pipeline.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: (extends PUBL-01, PUBL-02, PUBL-03 — Instagram coverage; no new requirement IDs)
**Success Criteria** (what must be TRUE):
   1. Team publishes an image or video post to Instagram via the same adapter pipeline (IG container flow created at publish time, not compose time).
   2. Team publishes an Instagram carousel (2–10 images) to a connected IG account.
   3. IG-specific limits (caption length 2200, JPEG format, 25/24h) are validated in the composer and respected at publish.
   4. Publish status per IG target is tracked and IG failures are surfaced per target.
**Plans**: 1 plan
Plans:
- [x] 05-01-PLAN.md — InstagramPublisher adapter, IG container flow (single + carousel), OAuth IG account storage, PublishModal tabs, validation, tests.
**UI hint**: yes

### Phase 6: Publish to LinkedIn
**Goal**: Team can publish to a client's connected LinkedIn account via the LinkedIn adapter, with first-class re-auth for the 60-day token expiry.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: (extends PUBL-01, PUBL-02, PUBL-03 — LinkedIn coverage; no new requirement IDs)
**Success Criteria** (what must be TRUE):
   1. Team publishes a post (text/media) to a connected LinkedIn account via the adapter.
   2. LinkedIn's 60-day token expiry is surfaced with a one-click "Reconnect LinkedIn" path; publishing degrades gracefully when the token has expired.
   3. Publish status per LinkedIn target is tracked and failures are surfaced per target.
   4. LinkedIn organic carousels are documented as unsupported; the composer/UX communicates this clearly.
**Plans**: 1 plan
Plans:
- [ ] 06-01-PLAN.md — LinkedInPublisher adapter, factory wiring, publish route update, PublishModal LinkedIn tab with reconnect state, composer carousel notice, tests.
**UI hint**: yes

### Phase 7: AI (Gemini) & Hardening
**Goal**: Team can generate/improve copy with Gemini guided by a per-client brand-voice profile, plus operational hardening (recovery UX, observability, per-account rate-limit enforcement).
**Mode:** mvp
**Depends on**: Phase 2 (compose path) and Phase 4–6 (publishing)
**Requirements**: AIGC-01, AIGC-02
**Success Criteria** (what must be TRUE):
  1. Team generates or improves post copy via Gemini directly in the composer.
  2. A per-client brand-voice profile guides Gemini's tone, and the team can set/edit that profile per client.
  3. Failed publishes surface a recovery/retry affordance and the worker enforces per-account rate limits across multi-client fan-out.
  4. Job lag / failure rate is observable (health/heartbeat) so scheduled-publishing reliability can be monitored.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation — Auth, Clients & Connections | 3/3 | Code complete (pending verification) | - |
| 2. Composer & Media Library | 1/1 | Code complete (pending verification) | - |
| 3. Scheduler & Worker (reliability proof) | 1/1 | Code complete (pending verification) | - |
| 4. Publish to Meta (Facebook) | 1/1 | Code complete (pending verification) | - |
| 5. Publish to Instagram (incl. carousels) | 1/1 | Code complete (pending verification) | - |
| 6. Publish to LinkedIn | 0/1 | Not started | - |
| 7. AI (Gemini) & Hardening | 0/0 | Not started | - |

## Coverage Note

Publishing (PUBL-01/PUBL-02/PUBL-03) is delivered progressively across Phases 4–6: the per-platform `Publisher` adapter architecture and immediate-publish capability are established in **Phase 4 (Meta)**, then extended platform-by-platform in **Phase 5 (Instagram)** and **Phase 6 (LinkedIn)**. The PUBL requirement IDs are tracked under Phase 4 as the phase that establishes the capability; Phases 5–6 complete multi-platform coverage. All 25 v1 requirements map to exactly one phase (no orphans, no duplicates).
