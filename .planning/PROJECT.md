# Content-Creator

## What This Is

A web application for social media agencies to create, AI-generate, schedule, and publish posts across Facebook, Instagram, and LinkedIn for multiple clients — all from a single dashboard. The agency team composes posts (text, images, videos, carousels), gets AI help writing the copy, connects each client's social accounts via OAuth, and publishes immediately or on a schedule.

## Core Value

One workspace where an agency team can generate, schedule, and publish content to all client social accounts without leaving the app or juggling native platforms.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Agency team can sign in (email/password), internal team only
- [ ] Agency can manage multiple clients, each with their own social accounts
- [ ] Team can connect a client's Facebook/Instagram accounts via OAuth (Meta Business / Graph API)
- [ ] Team can connect a client's LinkedIn account via OAuth (LinkedIn API)
- [ ] Team can compose a post with text, single image, video, or carousel
- [ ] AI (Gemini) assists writing/rephrasing post copy and hooks
- [ ] Team can publish a post immediately to one or more connected accounts
- [ ] Team can schedule a post to publish at a future date/time
- [ ] A scheduler reliably publishes due scheduled posts in the background
- [ ] Media (images/videos) are uploaded and stored for use in posts

### Out of Scope

- Client-side login / post approval workflow — direct publishing chosen for v1
- Other networks (TikTok, X/Twitter, YouTube, Pinterest) — only FB/IG/LinkedIn
- Analytics, reporting, and engagement dashboards
- Native mobile app — web-first
- Fine-grained team roles/permissions (admin vs member) — basic internal team auth only
- Content moderation / compliance review tooling

## Context

- Built for a social media agency managing content for several clients, not a solo creator.
- Publishing uses the platforms' real APIs from v1: Meta Graph API (Facebook + Instagram via Meta Business accounts/page tokens) and LinkedIn API (share/w_member_social). Both require OAuth and issued access tokens.
- AI copy generation uses Google Gemini (consistent with the referenced AI Studio behavior).
- Tool users are the internal agency team; clients do not log into the tool.
- Supported media: text, single image, video, and carousels (Instagram carousels especially).

## Constraints

- **Real API integration**: LinkedIn API access typically requires an approved developer application; Meta requires a Business account and page tokens. This is the highest-risk area and should be staged (start with one platform to validate the publish flow).
- **Token lifecycle**: OAuth access tokens expire and must be refreshable/stored securely (encrypted at rest).
- **Scheduling reliability**: scheduled posts must publish even if the user is offline — requires a persistent background worker/queue, not a browser timer.
- **Media storage**: videos and carousels need server-side storage and (for some platforms) upload to the platform before publishing.
- **Web app**: browser-based front end + server backend (stack to be finalized during research).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Direct publishing, no client approval | Agency publishes on behalf of clients without sign-off step in v1 | — Pending |
| Real platform APIs from v1 | User wants functional publishing, not mocks | — Pending |
| Gemini for AI generation | Matches referenced AI Studio behavior | — Pending |
| Internal team auth only | Clients don't use the tool directly | — Pending |
| Start with one platform to validate flow | Reduces risk of LinkedIn/Meta approval blockers | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-11 after initialization*
