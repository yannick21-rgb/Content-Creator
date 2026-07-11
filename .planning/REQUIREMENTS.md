# Requirements: Content-Creator

**Defined:** 2026-07-11
**Core Value:** One workspace where an agency team can generate, schedule, and publish content to all client social accounts without leaving the app.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Auth (internal team)

- [ ] **AUTH-01**: Team member can sign up and log in with email and password
- [ ] **AUTH-02**: User session persists across browser refresh

### Clients (isolated workspaces)

- [ ] **CLNT-01**: Team can create a client workspace
- [ ] **CLNT-02**: Team can connect a client's social accounts scoped to that client (isolation)
- [ ] **CLNT-03**: Team can view and manage multiple clients separately

### Connections (OAuth + token vault)

- [ ] **CONN-01**: Team can connect a client's Facebook/Instagram via Meta OAuth with long-lived token exchange
- [ ] **CONN-02**: Team can connect a client's LinkedIn via OAuth
- [ ] **CONN-03**: OAuth tokens are stored encrypted at rest (AES-256-GCM)
- [ ] **CONN-04**: Expiring tokens surface a "Reconnect required" state with one-click re-auth

### Composer

- [ ] **COMP-01**: Team can compose a post with text
- [ ] **COMP-02**: Team can add a single image to a post
- [ ] **COMP-03**: Team can add a video to a post
- [ ] **COMP-04**: Team can compose an Instagram carousel (multi-image, 2-10 items)
- [ ] **COMP-05**: Composer validates per-platform limits (caption length, format) and warns

### Media

- [ ] **MEDA-01**: Team can upload media to a library via presigned URLs (R2)
- [ ] **MEDA-02**: Media is served at a public CDN URL reachable by platforms at publish time

### AI (Gemini)

- [ ] **AIGC-01**: Team can generate or improve post copy via Gemini
- [ ] **AIGC-02**: Per-client AI brand-voice profile guides generation

### Publishing

- [ ] **PUBL-01**: Team can publish a post immediately to one or more connected accounts
- [ ] **PUBL-02**: Publishing uses a per-platform adapter (Meta/Facebook, Instagram, LinkedIn)
- [ ] **PUBL-03**: Publish status is tracked (scheduled/running/published/failed) per target

### Scheduling

- [ ] **SCHD-01**: Team can schedule a post for a future date/time
- [ ] **SCHD-02**: A background worker publishes due posts reliably (offline-safe, idempotent)
- [ ] **SCHD-03**: A calendar/queue view shows scheduled posts
- [ ] **SCHD-04**: Scheduling handles timezones correctly (IANA)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Scheduling (advanced)

- **SCHD-05**: Bulk/CSV scheduling across clients and accounts
- **SCHD-06**: Per-account rate-limit enforcement and backoff across multi-client fan-out

### AI

- **AIGC-03**: AI suggests first-comment and hashtags per platform
- **AIGC-04**: Auto-extract brand voice from client website

### Operations

- **OPS-01**: Observability (job lag, failure rate) for the worker
- **OPS-02**: Dead-letter / retry UI for failed publishes

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Client approval / portals | Direct publishing chosen for v1 |
| LinkedIn organic carousels | Not supported via API (sponsored only) — ship IG carousels |
| Additional networks (TikTok, X, YouTube, Pinterest) | Only FB/IG/LinkedIn in v1 |
| Analytics / reporting | Deferred to v2+ |
| Native mobile app | Web-first |
| Fine-grained team roles (admin/member) | Basic internal team auth only |
| White-label | Deferred |
| Social listening / inbox | Deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| CLNT-01 | Phase 1 | Pending |
| CLNT-02 | Phase 1 | Pending |
| CLNT-03 | Phase 1 | Pending |
| CONN-01 | Phase 1 | Pending |
| CONN-02 | Phase 1 | Pending |
| CONN-03 | Phase 1 | Pending |
| CONN-04 | Phase 1 | Pending |
| MEDA-01 | Phase 2 | Pending |
| MEDA-02 | Phase 2 | Pending |
| COMP-01 | Phase 2 | Pending |
| COMP-02 | Phase 2 | Pending |
| COMP-03 | Phase 2 | Pending |
| COMP-04 | Phase 2 | Pending |
| COMP-05 | Phase 2 | Pending |
| SCHD-01 | Phase 3 | Pending |
| SCHD-02 | Phase 3 | Pending |
| SCHD-03 | Phase 3 | Pending |
| SCHD-04 | Phase 3 | Pending |
| PUBL-01 | Phase 4 | Pending |
| PUBL-02 | Phase 4 | Pending |
| PUBL-03 | Phase 4 | Pending |
| AIGC-01 | Phase 7 | Pending |
| AIGC-02 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

**Phase structure (Vertical MVP, dependency-driven):**
- Phase 1: Auth, Clients & Connections (AUTH-01/02, CLNT-01/02/03, CONN-01/02/03/04)
- Phase 2: Composer & Media (COMP-01..05, MEDA-01/02)
- Phase 3: Scheduler & Worker (SCHD-01..04)
- Phase 4: Publish to Meta (PUBL-01/02/03) — establishes per-platform adapter + immediate publish
- Phase 5: Publish to Instagram — extends PUBL-01/02/03 (Instagram coverage; no new IDs)
- Phase 6: Publish to LinkedIn — extends PUBL-01/02/03 (LinkedIn coverage; no new IDs)
- Phase 7: AI (Gemini) & Hardening (AIGC-01/02)

Note: Publishing (PUBL-01/02/03) is delivered progressively across Phases 4–6; the IDs are tracked under Phase 4 (the phase that establishes the capability). Phases 5–6 complete multi-platform coverage.

---
*Requirements defined: 2026-07-11*
*Last updated: 2026-07-11 after roadmap creation (7-phase structure)*
