# Feature Research: Multi-Platform Social Publishing & Scheduling SaaS for Agencies

**Domain:** Social media publishing/scheduling SaaS (agency-focused, FB / IG / LinkedIn, AI-assisted copy, scheduling)
**Researched:** 2026-07-11
**Confidence:** HIGH for competitor landscape and Meta API limits; MEDIUM for LinkedIn/agency-vendor specifics (vendor marketing sites + third-party API docs)

---

## Executive Context

The competitive field (Buffer, Hootsuite, Later, Sprout Social, plus agency-only vendors like Cloud Campaign, Brandlix, Social9) is mature. The "publishing + scheduling" core is commoditized — every tool does it. The differentiators for an *agency* tool are: **isolated multi-client workspaces, per-client AI brand voice, approval/client-facing flows, and white-label reporting.** Our PROJECT.md deliberately scopes v1 to internal-team-only, direct publishing, real platform APIs, and Gemini AI — so this research maps table stakes to *that* v1 and flags what is deliberately deferred.

**Critical cross-cutting finding:** Per-platform publishing is *not* uniform. Each network has a distinct media model, caption field name, rate limit, and content-type support. A single "post" object must be translated into N platform-specific payloads. This is the highest-effort area and should drive phase ordering (compose/storage first, then publish adapters one platform at a time).

---

## Feature Landscape

### Table Stakes (Users Expect These — Missing = Product Feels Broken)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-platform OAuth connection** (per client) | Every tool connects FB/IG/LinkedIn via OAuth; agencies assume one-click connect | HIGH | Meta Business/Graph API + LinkedIn API. Tokens expire → must refresh + store encrypted. LinkedIn org-page posting needs Community Management API approval. |
| **Post composer: text** | The absolute baseline; all tools support text | LOW | Per-platform char limits differ (IG caption 2200, Threads 500, LinkedIn commentary long, FB message long). |
| **Post composer: single image** | Standard post type | MEDIUM | Format differences: IG requires JPEG/PNG/WebP (no GIF/BMP/TIFF), pulls from public URL. LinkedIn requires binary upload. |
| **Post composer: video** | Expected by agencies | HIGH | Each platform = different upload protocol (URL-pull container, resumable, chunked ETag). Safe baseline: H.264 + AAC in MP4. Instagram Reels 3min/300MB, LinkedIn 500MB/30min, Facebook 45min/2GB. |
| **Post composer: carousel** | IG carousels especially requested | HIGH | **IG:** container model, 2–10 items, mix image+video allowed, must poll status. **LinkedIn: NO organic carousels via API** — only sponsored content. This is a hard blocker for "LinkedIn carousels" (see Pitfalls below). |
| **Direct (immediate) publish** | Users expect "publish now" | HIGH | Requires per-platform publish adapters. IG/FB/LinkedIn all differ. |
| **Scheduling + visual calendar** | Buffer/Later/Hootsuite all ship a calendar/queue | MEDIUM | Drag-and-drop calendar is now table stakes (Later popularized it; Buffer/Hootsuite caught up). Queue-based also acceptable. |
| **Reliable background scheduler** | Scheduled posts must fire when user is offline | HIGH | Not a browser timer — needs persistent worker + queue (PROJECT constraint). |
| **Media library** | Agencies reuse assets across posts/clients | MEDIUM | Later/Hootsuite both have it. Server-side storage + (for some platforms) pre-upload before publish. |
| **Client / account management** | Agency tool = multiple clients, each with own social accounts | MEDIUM | Isolated workspaces per client. This is *the* defining table-stakes feature that separates "agency tool" from "creator tool." |
| **AI copy assist** | Buffer AI, OwlyWriter (Hootsuite), Later Caption Writer all ship it | MEDIUM | Generate/rephrase captions + hooks. Now expected, not a differentiator by itself. Differentiator = *per-client brand voice* (see below). |
| **Internal team auth** | Tool users are the agency team | LOW | Email/password; PROJECT scopes to internal team only (no client login in v1). |

### Differentiators (Competitive Advantage — Where We Compete)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Per-client AI brand voice** (Gemini learns each client's tone/voice) | Generic AI captions sound like everyone; per-client voice is the #1 agency differentiator cited by Brandlix/Social9/Antwork | MEDIUM-HIGH | Store a brand profile per client (voice, banned phrases, sample posts). Feed into Gemini prompts. Cheap to build, high perceived value. |
| **Automatic per-platform reformatting in one composer** | One draft → auto-adapted caption/hashtags/format per network | HIGH | Buffer/Later do "rewrite for platform" but still manual. A composer that transparently handles IG caption vs LinkedIn commentary vs FB message, and warns on char/format limits, removes user burden. |
| **Per-platform limit/format validation before publish** | Prevents failed publishes (wrong format, over limit, unsupported type) | MEDIUM | Validate against platform constraints (e.g., LinkedIn no organic carousel, IG no text-only, GIF rejected). Saves support tickets. |
| **AI first-comment + hashtag suggestions per platform** | IG first-comment hashtags, LinkedIn no-hashtag norms — platform-aware | MEDIUM | Buffer supports first comment (IG/FB best-effort). LinkedIn/TikTok don't. |
| **Bulk scheduling / CSV import** | Agencies batch a month of content | MEDIUM | Cited as a top time-saver across reviews. Add after core works. |
| **Per-client media organization** | Media library scoped to each client workspace | LOW-MEDIUM | Natural extension of client isolation; reduces cross-client leakage risk. |

### Anti-Features (Commonly Requested, Deliberately NOT in v1)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Client-side login / approval workflow** | Agencies often want clients to approve | PROJECT decision: direct publishing for v1; approval adds OAuth-for-clients + workflow state machine | Defer; direct publish now, add approval links later |
| **Analytics / reporting dashboards** | "How did posts perform?" | Out of scope per PROJECT; large build, needs each platform's insights API | Rely on native Meta/LinkedIn insights in v1 |
| **White-label branding / client portals** | Agencies love reselling under their brand | Significant UI theming + domain work; not core to publishing | Defer to v2; focus on functional publishing |
| **Social listening / unified inbox** | Hootsuite's differentiator | Entirely separate product surface (streams, mentions, DMs) | Out of scope |
| **Other networks (TikTok/X/YouTube/Pinterest)** | "Can it do everything?" | PROJECT scopes to FB/IG/LinkedIn; each new network = new adapter + approval | Start with one platform, add later |
| **Fine-grained team roles (admin/member)** | Governance | PROJECT: basic internal auth only | Single internal team role in v1 |
| **Content moderation / compliance review** | Brand safety | Out of scope; overlaps with deferred approval workflow | Defer |
| **Native mobile app** | "Schedule on the go" | PROJECT: web-first; mobile web suffices | Responsive web |

---

## Feature Dependencies

```
Client / Account Management
    └──requires──> Multi-platform OAuth connection (accounts belong to a client)
                        └──requires──> Secure token storage (encrypted at rest, refreshable)

Media Library
    └──enhances──> Post Composer (upload before/while composing)

Post Composer (text / image / video / carousel)
    └──requires──> Media Library (for image/video/carousel selection)
    └──requires──> Per-platform formatting layer (translate one draft → N payloads)
    └──enhances──> AI Copy Assist (generate/rephrase within composer)

AI Copy Assist
    └──enhances──> Post Composer
    └──requires──> Per-client brand voice profile (differentiator)

Direct Publish
    └──requires──> Post Composer
    └──requires──> Multi-platform OAuth connection
    └──requires──> Per-platform publish adapters (IG / FB / LinkedIn)

Scheduling + Calendar
    └──requires──> Post Composer
    └──requires──> Reliable Background Scheduler (worker + queue)
                        └──requires──> Direct Publish adapters (fires them at due time)

Per-platform formatting / validation layer
    └──conflicts──> "One generic post object for all platforms" (must be adapter-based)
```

### Dependency Notes

- **OAuth connection requires Client Management:** social accounts are owned by a client workspace, so client management must exist before/with connection flows.
- **Composer requires the formatting layer:** you cannot publish without translating the draft per platform. Build the adapter contract early even if only one platform is live.
- **Scheduler requires Direct Publish:** the background worker calls the same publish adapters a "Publish Now" button uses. Publish adapters are the shared substrate.
- **AI copy assist enhances (not blocks) composer:** can ship composer without AI, then layer AI. But per-client brand voice *requires* a stored brand profile, so it's a slightly larger unit.
- **LinkedIn organic carousel conflicts with the "carousels for all three" assumption:** LinkedIn API only supports carousels for *sponsored* content. v1 must either drop LinkedIn carousels or treat them as a known limitation. (See Pitfalls.)

---

## MVP Definition (v1 — aligned to PROJECT.md)

### Launch With (v1)

- [ ] **Client / account management** — agency manages multiple clients, each with isolated social accounts (defines the product as "agency tool")
- [ ] **Multi-platform OAuth connection** — start with ONE platform to de-risk (PROJECT decision: "start with one platform to validate flow"). Meta (IG+FB via Business) is the highest-value first target; LinkedIn is the highest-approval-risk.
- [ ] **Media library** — upload + store images/videos server-side
- [ ] **Post composer: text + single image + video** — the safe core set across all three platforms
- [ ] **AI copy assist (Gemini)** — generate/rephrase captions + hooks, with per-client brand voice
- [ ] **Direct publish** — to the validated platform(s)
- [ ] **Scheduling + calendar** — with a reliable background worker (not a browser timer)
- [ ] **Internal team auth** — email/password, internal only

### Add After Validation (v1.x)

- [ ] **Second/third platform adapter** — add LinkedIn (watch the carousels limitation) and the other Meta surface once the first flow is proven
- [ ] **Carousel support** — IG carousels first (fully supported via API); LinkedIn only if sponsored-content path is pursued
- [ ] **Bulk scheduling / CSV import** — top time-saver for agencies
- [ ] **Per-platform limit/format validation UI** — surface warnings before publish

### Future Consideration (v2+)

- [ ] **Client approval links / portals** — deferred workflow per PROJECT
- [ ] **White-label branding** — agency resale
- [ ] **Analytics / reporting** — per-client performance
- [ ] **Social listening / unified inbox**
- [ ] **Additional networks (TikTok/X/YouTube/Pinterest)**
- [ ] **Fine-grained team roles**

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Client / account management | HIGH | MEDIUM | P1 |
| OAuth connection (1 platform first) | HIGH | HIGH | P1 |
| Post composer (text/image/video) | HIGH | MEDIUM | P1 |
| Media library | HIGH | MEDIUM | P1 |
| Direct publish (validated platform) | HIGH | HIGH | P1 |
| Scheduling + calendar | HIGH | MEDIUM | P1 |
| Background scheduler worker | HIGH | HIGH | P1 |
| AI copy assist (Gemini) + brand voice | HIGH | MEDIUM | P1 |
| Per-platform formatting/validation layer | HIGH | HIGH | P1 (contract early) |
| Carousel (IG) | MEDIUM | HIGH | P2 |
| LinkedIn carousels | LOW (API-blocked organic) | HIGH | P3 / defer |
| Bulk scheduling / CSV | MEDIUM | MEDIUM | P2 |
| Client approval workflow | MEDIUM | HIGH | P3 |
| White-label | MEDIUM | HIGH | P3 |
| Analytics / reporting | MEDIUM | HIGH | P3 |
| Social listening / inbox | LOW (out of scope) | HIGH | P3 |

**Priority key:** P1 = must have for launch · P2 = should have, add when possible · P3 = nice to have / future

---

## Competitor Feature Analysis

| Feature | Buffer | Hootsuite | Later | Our v1 Approach |
|---------|--------|-----------|-------|------------------|
| Multi-platform connect | Yes (11 platforms) | Yes (enterprise) | Yes (visual-first) | Yes — FB/IG/LinkedIn, one at a time |
| Post composer (text/img/video) | Yes | Yes | Yes | Yes |
| Carousels | IG yes | Yes | IG yes | IG yes; LinkedIn blocked (organic) |
| Visual calendar | Yes (list/queue) | Yes | Yes (best-in-class grid) | Yes (calendar view) |
| AI caption assist | Yes (Buffer AI) | Yes (OwlyWriter) | Yes (Caption Writer) | Yes (Gemini) + per-client voice |
| Media library | No (light) | Yes | Yes | Yes |
| Client workspaces | Agency plan only | Enterprise | Agency plan | Yes (core, not paid-upgrade gated) |
| Approval workflow | Team plan | All plans | Advanced | Deferred (direct publish v1) |
| Analytics | Basic | Deep | Moderate | Out of scope v1 |
| White-label | No | Enterprise | No | Deferred v2 |
| Per-client AI brand voice | No (generic) | No | No (tone presets) | **Yes — differentiator** |

**Takeaway:** Competitors gate client workspaces and AI-brand-voice behind higher tiers or don't offer them. Making client isolation + per-client AI voice a *core* v1 capability is our sharpest, lowest-cost differentiator.

---

## Critical Pitfall Flags (for PITFALLS.md / roadmap)

1. **LinkedIn organic carousels are NOT supported via API** (only sponsored content). The PROJECT.md line "carousels (Instagram carousels especially)" implies LinkedIn carousels too — this must be corrected or scoped. v1 should ship IG carousels and treat LinkedIn carousels as a known limitation.
2. **LinkedIn org-page posting needs Community Management API approval** — individual-member posting is the accessible path; plan accordingly.
3. **IG requires Business/Creator account + media via public URL** (URL-pull model); LinkedIn requires **binary upload** (no URL-pull). The media layer must support both push and pull.
4. **Per-platform caption fields differ:** `caption` (IG), `text` (Threads/FB-ish), `commentary` (LinkedIn), `message` (FB). One field name cannot serve all.
5. **Rate limits differ:** IG 50–100 posts/24h; LinkedIn ~200 calls/hr; Facebook 30 Reels/day/page. The scheduler must enforce per-platform rate limits, especially for future-dated batches.

---

## Sources

- Competitor feature landscape (HIGH confidence — multiple 2025–2026 reviews agree):
  - RateTheTool — Buffer vs Hootsuite vs Later 2026 (2026-06-18)
  - StackFYI — Buffer vs Hootsuite vs Later 2026 (2026-03-29)
  - Conbersa — Scheduling Tools Comparison (2026-02-27)
  - Clarigital/Codex — Social Media Scheduling Tools (2026-04-06)
  - Libril — Buffer vs Hootsuite vs Later 2025 (2025-08-06)
- Agency-vendor feature sets (MEDIUM confidence — vendor marketing):
  - Cloud Campaign, Brandlix, Social9, Antwork, So-me.studio, Apaya, Outstand (white-label/agency positioning)
- Platform API constraints (HIGH for Meta, MEDIUM for LinkedIn — official docs + third-party):
  - Meta Developer Docs — Instagram Content Publishing (official, current)
  - Postproxy — Carousel Posts across IG/LinkedIn/Threads via API (2026-02-13)
  - Postproxy — Publish Video to Every Platform via API (2026-02-13)
  - SocialAPI.ai — Posts overview / LinkedIn (per-platform capability matrix)
  - Publora Docs — Platform Limits (format/rate-limit reference)

---
*Feature research for: multi-platform social publishing & scheduling SaaS (agency, FB/IG/LinkedIn, AI-assisted)*
*Researched: 2026-07-11*
