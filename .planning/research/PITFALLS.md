# Pitfalls Research

**Domain:** Multi-platform social media publishing & scheduling SaaS (agency-focused) — LinkedIn, Facebook, Instagram via real platform APIs
**Researched:** 2026-07-11
**Confidence:** HIGH for platform API behaviors (verified against Microsoft Learn / Meta for Developers official docs + corroborating 2026 practitioner sources). MEDIUM on one item: Instagram long-lived token *auto-refresh* reliability in production (official endpoint exists but real-world failures reported — see Pitfall 2).

---

## Critical Pitfalls

### Pitfall 1: LinkedIn token refresh is gated behind MDP partner approval

**What goes wrong:**
Your integration silently stops publishing to LinkedIn after ~60 days because the access token expired and there is no way to programmatically refresh it. For an agency managing dozens of client LinkedIn accounts, this means a recurring, manual re-authentication treadmill that scales linearly with account count.

**Why it happens:**
LinkedIn issues access tokens valid for **60 days**. Programmatic **refresh tokens exist ONLY for approved Marketing Developer Platform (MDP) partners**. Standard API access that grants `w_member_social` (posting on a user's behalf) does **not** reliably include a refresh token — so without MDP status, the only recovery is the user going through the OAuth consent screen again. (Source: Microsoft Learn "Refresh Tokens with OAuth2.0" — refresh tokens are "for all approved Marketing Developer Platform (MDP) partners"; corroborated by practitioner write-ups noting standard access requires re-auth every 60 days, "no exceptions.")

**How to avoid:**
- Build the architecture as if refresh is **never** available: store `expires_at`, proactively warn the agency when a connection nears expiry (e.g., 7-day warning), and make "Reconnect LinkedIn" a first-class, one-click flow exposed in the UI per connected account.
- Apply for MDP / Community Management App Review early, but **do not depend on approval** landing before launch — design for re-auth regardless.
- Track refresh-token issuance time separately; LinkedIn refresh tokens have a fixed **365-day** lifetime that does *not* extend on use (Microsoft Learn), so even with MDP you must still plan for eventual re-auth.

**Warning signs:**
- You assumed "OAuth gives me a refresh_token" and your token model has no re-auth UI.
- Token storage has only `access_token` + `expires_in`, no `refresh_token` field or `refresh_expires_at`.
- Publishing starts working in tests, then fails ~60 days later with `401`/`expired_token` with no code change.

**Phase to address:** Phase 1 (OAuth & Account Connection) — the token model, expiry tracking, and re-auth UX must be designed here, not retrofitted.

---

### Pitfall 2: Using Meta's short-lived token directly (forgetting the long-lived exchange)

**What goes wrong:**
You complete the Meta/Facebook OAuth flow, get a token, and everything works in the demo. Exactly **1–2 hours later** every call returns `OAuthException` and publishing is dead. This is the single most common first-integration failure on the Meta side.

**Why it happens:**
Meta issues a **short-lived token (~1–2 hours)** by default from the login flow. Most tutorials stop there. You must perform a **second exchange** (`GET /oauth/access_token?grant_type=fb_exchange_token&...`) to get a **long-lived token (60 days)**, then periodically call `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token` to reset the 60-day clock. (Source: Meta for Developers "Refresh Access Token"; dev.to Meta OAuth walkthrough.)

**How to avoid:**
- The OAuth callback handler must **immediately** exchange the short-lived token for a long-lived one before persisting.
- Schedule an automated refresh **every 30–45 days** (not at 59) so transient failures don't push you past expiry.
- Persist `expires_at` (absolute timestamp) and surface a "token expiring soon" state.
- **Reliability caveat (MEDIUM confidence):** Practitioner reports (StackOverflow, 2023–2025) show the IG refresh endpoint sometimes returns opaque errors ("Sorry, this content isn't available right now") depending on app config / missing `instagram_business_basic` permission. **Treat refresh as best-effort, not guaranteed** — always keep a re-auth fallback path. Never let a failed silent refresh go unnoticed.

**Warning signs:**
- Your token store has no step that calls `fb_exchange_token`.
- Tokens "work in dev" then break overnight in staging/prod.
- No scheduled refresh job exists.

**Phase to address:** Phase 1 (OAuth & Account Connection) for the exchange + refresh job; re-auth fallback in Phase 5 (Connection Health & Recovery).

---

### Pitfall 3: Scheduling with browser/client-side timers instead of a persistent worker

**What goes wrong:**
Scheduled posts never publish (or publish only while someone has the tab open). The "scheduler" was implemented with `setTimeout`/`setInterval` in the frontend or a per-request in-memory queue that dies when the server restarts.

**Why it happens:**
Scheduling is mentally modeled as "set a timer." But the publish action must run when **no user is present** and survive deploys, crashes, and scaling to multiple app instances. LinkedIn and Instagram have **no native server-side scheduling** (LinkedIn explicitly: "API does not natively support scheduled posts" — you must build your own queue). The project constraint already flags this, but it is the #1 architectural mistake in this domain.

**How to avoid:**
- Use a **persistent background worker + durable job store** (database table or queue such as Redis/BullMQ). The browser only *creates* the scheduled job record; the worker *executes* it.
- Separate the **scheduler/coordinator** (polls for due jobs) from **executors/workers** (publish). Use a message queue for distribution.
- Make publish **idempotent**: a job has a `status` (pending → publishing → published/failed) and a unique key so a retry or double-trigger can never double-post.
- For multi-instance deploys, use **leader election or row-level locking** so exactly one worker claims a due job (distributed-cron "run exactly once" problem).
- Add a **heartbeat / dead-man's-switch monitor**: if the worker hasn't pinged health in N minutes, alert. Silent worker death is the classic failure here.

**Warning signs:**
- Scheduling logic lives in frontend code or in a request handler's local scope.
- No `status` column on scheduled posts; no job queue; no healthcheck.
- "It works when I test it with the window open" — but no verification that it fires unattended.

**Phase to address:** Phase 3 (Scheduler / Background Worker) — this is the core deliverable of that phase.

---

### Pitfall 4: Instagram media not publicly accessible at publish time

**What goes wrong:**
Container creation or publish fails with an opaque error, or the post goes out with broken/empty media. Root cause: the media URL you passed to the Instagram Graph API is on a private bucket, behind a signed/expiring URL, on localhost, or behind a firewall Meta's servers can't reach.

**Why it happens:**
Meta **cURLs the media URL at publish time** — it must be hosted on a **publicly accessible server**. This is explicitly stated in Meta's Content Publishing docs ("We cURL media used in publishing attempts, so the media must be hosted on a publicly accessible server at the time of the attempt"). Common mistake: uploading to S3 with a private/ACL-restricted URL or a short-lived presigned URL that expires before the (possibly scheduled, days-later) publish fires.

**How to avoid:**
- Store publish media on a **public CDN** (e.g., S3 + CloudFront, public object URL) and use that stable public URL in the API call.
- If you must keep media private at rest, copy it to a public, time-unbounded URL **at publish time** (inside the worker), not at compose time.
- Validate the URL returns `200` with correct `Content-Type` (e.g., `image/jpeg`, `video/mp4`) from a server-side fetch before submitting to Meta.

**Warning signs:**
- Media URLs are presigned/expiring or behind auth.
- Publish works in local dev (where files are served locally) but fails in prod.
- Errors reference `status_code: ERROR` on the media container with no detail.

**Phase to address:** Phase 2 (Single-platform Publish MVP) for the public-URL requirement; Phase 4 (Media Pipeline) for the storage/URL strategy.

---

### Pitfall 5: Creating the Instagram media container too early (before publish time)

**What goes wrong:**
For scheduled posts, you create the IG container (and possibly publish) at *compose* time, then the post "is scheduled," but at the due time nothing happens or it fails — or worse, the container expired and the publish is rejected.

**Why it happens:**
Instagram publishing is a **two-step container model**: `POST /{ig-user-id}/media` creates a container, you must **poll** `GET /{container-id}?fields=status_code` until `FINISHED`, then `POST /{ig-user-id}/media_publish`. Containers are short-lived and the media URL must be live *at publish time*. You cannot reliably pre-create a container days ahead for a future-scheduled post.

**How to avoid:**
- The scheduler worker must perform the **full create → poll → publish sequence at the due time**, not at compose time. Persist only the post content + public media URL in the job; build the container when executing.
- For video/Reels, **poll until `FINISHED`** (can take seconds to minutes) before calling `media_publish`; handle `status_code: ERROR` and timeouts explicitly.
- Use `upload_type=resumable` for large videos (Facebook Login for Business flow) to survive network interruptions.

**Warning signs:**
- Your "schedule" flow calls `media_publish` immediately and just records a timestamp.
- No polling loop / status check between container creation and publish.
- Scheduled Reels/videos fail more often than images.

**Phase to address:** Phase 2 (Publish MVP) for the container flow; Phase 3 (Scheduler) for "execute at due time, not compose time."

---

### Pitfall 6: App stuck in Development mode / app review never completed

**What goes wrong:**
Everything works for the agency's own test accounts, but publishing to **real client accounts fails or is blocked**. The Meta app is still in Development mode (only added Testers can use it) or the LinkedIn/Meta app review was never submitted/approved.

**Why it happens:**
Both platforms require **app review before production use**:
- **Meta:** Development mode allows only manually-added Testers. To serve real users you must complete App Review and switch to Live mode. Each publishing permission (e.g., `instagram_business_content_publish`, `pages_manage_posts`) is a **separate submission**, documented at **2–4 weeks per submission**.
- **LinkedIn:** Requires Community Management / MDP App Review with a **screencast demo** of actual usage. Common rejection reasons: use case overlaps LinkedIn's own paid products, intent to resell data, weak privacy policy, or an unclear demo. No published decision timeline (can be weeks–months).

This is the **highest external-risk area** because it's a gatekeeper you don't control. The PROJECT.md already recommends staging (start with one platform) — this pitfall is why.

**How to avoid:**
- **Start with ONE platform** (recommended: Instagram/Facebook via Meta, since LinkedIn review is stricter) to validate the full publish flow before committing to both.
- Begin app-review submissions **in parallel with build**, not after — the clock is long and independent of your dev speed.
- Keep the app in Dev mode with real test accounts (a real Business Page + Professional IG account you control) so you can build/test end-to-end while review is pending.
- Design connection states to include "pending review / limited" so the product degrades gracefully, not silently.

**Warning signs:**
- "Works for me but not for the client" — classic Dev-mode limitation.
- No app-review submission exists yet and launch is close.
- You assumed OAuth alone = production access.

**Phase to address:** Phase 1 (OAuth) to set up Dev-mode test accounts; Phase 2 (Publish MVP) scoped to validated single platform; app-review tracked as an ongoing workstream from Phase 0/1.

---

### Pitfall 7: Assuming one content model fits all platforms

**What goes wrong:**
You build a single "post" object (text + one image + caption) and try to push it identically to LinkedIn, Facebook, and Instagram. Publishing fails or content is silently truncated/mangled on one or more platforms.

**Why it happens:**
Each platform has **distinct constraints** the others don't share:
- **LinkedIn:** ~3000 char limit; supports text, single image, video, and **document/PDF carousels** (native image-carousel via API is limited — documents are the carousel mechanism). Outbound links in the body are reach-penalized. `@mentions` use a special `urn:li:...` format, not raw `@name`.
- **Instagram:** Caption max **2200 chars**; **JPEG only** for images (no PNG/JPS/MPO); video must be MP4 H.264/HEVC; **Reels require 9:16, 5–90s, Business account** (Creator accounts are NOT supported for content publishing via API); carousels up to **10 items**; **25 posts per 24h** per business account; max **30 hashtags**.
- **Facebook:** Highest char ceiling (~63k); Page access token; supports link previews natively.

A LinkedIn-optimized post (with a link and @mention) is invalid/ineffective on Instagram, and vice versa.

**How to avoid:**
- Model content **per-platform** with a validation layer: store a shared draft, then transform/validate into a platform-specific payload at publish time, rejecting/trimming with clear user feedback.
- Provide **per-platform pre-publish validation** (char count, hashtag count, aspect ratio, duration, format, item count) in the compose UI — show "Instagram: 0/2200, 2/30 hashtags, 9:16 OK."
- Never silently truncate; warn the user.

**Warning signs:**
- One `Post` schema with a single `text` and `mediaUrl` sent to all platforms.
- No validation that errors before the user hits "schedule."
- Posts that publish on one network but 400/422 on another with no explanation to the user.

**Phase to address:** Phase 2 (Publish MVP) for the first platform's validation; Phase 5 (Multi-platform Expansion) for the per-platform transform/validate layer.

---

### Pitfall 8: Token refresh race conditions across workers

**What goes wrong:**
With multiple worker instances, two workers refresh the same account's token concurrently; one overwrites the other's newly issued tokens, and subsequent requests fail with `invalid_grant`. This is sporadic, load-dependent, and hard to reproduce.

**Why it happens:**
Token refresh is triggered by many events (scheduled sync, webhook, user "sync now", retry-after-401). Without coordination, concurrent refreshes for the same connection clobber each other. (Source: Nango's LinkedIn `invalid_grant` post-mortem — refresh-token concurrency is called out as a subtle, highly load-dependent bug class.)

**How to avoid:**
- Wrap refresh in a **per-connection distributed lock / single-flight**: only one refresh runs per connection at a time; other requests await the in-flight result.
- Write `(access_token, refresh_token, expires_at)` **atomically**.
- On `invalid_grant`/expiry, **stop retrying and trigger re-auth** — don't loop refresh attempts.

**Warning signs:**
- Intermittent `invalid_grant` errors under load with no code changes.
- Token store updated by multiple services without locking.

**Phase to address:** Phase 1 (OAuth) for the lock design; Phase 3 (Scheduler) where concurrent workers appear.

---

### Pitfall 9: Page Publishing Authorization (PPA) silently blocks Instagram publishing

**What goes wrong:**
You have a valid token and a connected IG Professional account, but publishing is blocked with no obvious error. The connected Facebook Page requires **Page Publishing Authorization (PPA)** that was never completed.

**Why it happens:**
An IG professional account connected to a Page that requires PPA **cannot be published to until PPA is completed**. Meta docs note: "there's no way for you to determine if an app user's Page requires PPA," so you can't detect it programmatically — you can only advise users preemptively.

**How to avoid:**
- In the connect flow, **explicitly instruct clients to complete PPA** before/at connection time (link + checklist step).
- When a publish fails with an authorization-type error, surface a specific, actionable message: "This Page requires Page Publishing Authorization — complete it here, then reconnect."

**Warning signs:**
- Publish fails only for *some* client accounts while others work identically.
- Error references page publishing permission/authorization.

**Phase to address:** Phase 1 (OAuth connect flow) for the preemptive instruction; Phase 5 (Recovery) for the actionable error.

---

### Pitfall 10: Using deprecated APIs / scopes

**What goes wrong:**
Your integration breaks because you're calling an endpoint or requesting a scope Meta/LinkedIn has retired.

**Why it happens:**
- **LinkedIn:** The legacy **UGC Posts** and **Shares** APIs are deprecated; the **Posts API (`/rest/posts`)** is the only recommended publishing endpoint since 2024. Building on UGC/Shares is building on a sunset.
- **Instagram:** The older scopes `instagram_basic` and `instagram_content_publish` were **deprecated on 2025-01-27**, replaced by `instagram_business_basic` and `instagram_business_content_publish`. Apps still referencing old scope names will fail review/submission.

**How to avoid:**
- Pin to current API versions and **subscribe to platform changelogs/breaking-change policies** (LinkedIn has a published Breaking Change Policy; Meta versions Graph API with a published sunset timetable).
- Use the current scope names; add a lint/check in code review for deprecated identifiers.
- Budget for periodic API-version bumps (Meta retires old Graph versions on a schedule).

**Warning signs:**
- Endpoints like `/ugcPosts` or `/vX.Y/shares` in code.
- Scope strings `instagram_basic` / `instagram_content_publish` anywhere.

**Phase to address:** Phase 1 (OAuth scopes) and Phase 2 (Publish endpoints) — correct from the start; add a "API version currency" check in Phase 5.

---

### Pitfall 11: Underestimating rate limits (and hard cooldowns)

**What goes wrong:**
Bulk scheduling (e.g., an agency queuing a week of content for 20 clients at once) triggers platform throttling: publishes fail, and on LinkedIn you get a **24-hour cooldown**, not a gradual throttle — so one overage can halt all LinkedIn publishing for a day.

**Why it happens:**
Per-platform limits differ sharply and are enforced per **account**, not per app:
- **LinkedIn:** ~**100 API calls per user per day** for post-creation endpoints; exceeding triggers a **24-hour cooldown**.
- **Instagram:** **200 calls per user per hour** (Business Use Case); plus **25 posts per 24h** per business account via Graph API (carousels count as 1 post).
- **Facebook:** per-page/per-app limits via Graph API.

A naive scheduler firing all due jobs simultaneously will blow these instantly.

**How to avoid:**
- Make the publish worker **rate-limit-aware**: a per-account token-bucket / delay queue so no single connected account exceeds its window.
- Honor `429` / `Retry-After` with **exponential backoff + requeue** (don't drop the job).
- **Spread** scheduled publishes; avoid publishing 50 posts for one account in the same minute.
- Reduce API calls via caching and requesting only needed fields; prefer webhooks over polling where the platform supports it (note: IG publish completion still requires polling the container).

**Warning signs:**
- No per-account throttling; jobs fire concurrently regardless of platform.
- `429` responses aren't handled with backoff (posts just fail).
- You assumed "rate limit" means "slightly slower," not "hard 24h ban."

**Phase to address:** Phase 3 (Scheduler) for throttling/backoff; Phase 5 (Scale) for multi-account fan-out.

---

### Pitfall 12: Timezone mishandling for scheduled posts

**What goes wrong:**
A post scheduled for "9 AM Monday" goes live at the wrong hour (or day) because the intended timezone was lost — stored as a naive datetime, interpreted in server UTC, or shifted by a DST transition.

**Why it happens:**
The publish time is the user's intent in *their* timezone, but the worker fires in UTC. With no native scheduling on LinkedIn/IG, **your scheduler is the single source of truth for "when."** A mistake here posts off-hours (low reach) or crosses a day boundary (missed campaign window).

**How to avoid:**
- Store scheduled time as **absolute UTC + explicit IANA timezone** (e.g., `2026-08-04T09:00:00-04:00[America/New_York]`). Compute the UTC trigger instant at schedule-create time using the timezone.
- Render the user's local time back to them for confirmation ("Publishes Aug 4, 9:00 AM EDT").
- Use a timezone library (don't hand-roll DST math). Recompute on edit.

**Warning signs:**
- Datetime stored without timezone info.
- Server-local time used as the publish trigger.
- "It published an hour off" complaints after DST changes.

**Phase to address:** Phase 3 (Scheduler) — timezone handling is core to correct firing.

---

### Pitfall 13: Opaque platform errors with no user-facing fallback

**What goes wrong:**
An Instagram container returns `status_code: ERROR` (or LinkedIn returns a generic failure) with **no detail**, the post is marked "published" or silently dropped, and the agency doesn't know it failed until the client complains.

**Why it happens:**
Platform error responses are frequently non-specific (Meta community threads show `status_code: ERROR` with no `error_message` field for certain server/SSL/format issues). If your code treats "no exception" as "success," failures hide.

**How to avoid:**
- Treat **any non-`FINISHED`/non-success** container or API response as a failure; move the job to a **`failed` state** that retains the post copy + media references.
- Log the raw request/response (token-scoped, redacted) for debugging; surface a **generic but actionable** message to the user ("Publishing to Instagram failed — check the media format/size and retry").
- Provide a **"Retry" / "Reschedule"** action from the failed state; never discard content on failure.

**Warning signs:**
- Jobs transition straight to "done" without verifying the platform's success status.
- No failure state; failures look like successes in the UI.
- No raw-error logging for post-mortems.

**Phase to address:** Phase 2 (Publish MVP) for status verification; Phase 5 (Recovery) for retry/reschedule UX.

---

### Pitfall 14: Insecure token / secret handling

**What goes wrong:**
A `client_secret` is bundled in frontend code (exposed via browser devtools), or access/refresh tokens are stored in plaintext in the database and leak in a breach — compromising every connected client account simultaneously.

**Why it happens:**
OAuth `client_secret` must stay **server-side only**. Tokens are bearer credentials; if stolen they act as the user. Multi-client agency tools are high-value targets because one leaked store = many client accounts compromised.

**How to avoid:**
- `client_id`/`client_secret` in server environment/secret manager — **never** shipped to the browser.
- Encrypt tokens **at rest** (envelope encryption / KMS) in the database; the app decrypts per-request.
- Scope tokens per `(client_account, platform)` connection; isolate so a bug can't cross accounts.
- Detect token revocation (user/admin revoked app, or LinkedIn revoked for policy) and force re-auth promptly.

**Warning signs:**
- `client_secret` appears in frontend bundle or repo.
- Tokens stored as plain text columns.
- No encryption-at-rest for credential data.

**Phase to address:** Phase 1 (OAuth) — security model is foundational and expensive to retrofit.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use short-lived Meta token directly (skip long-lived exchange) | Faster first publish in dev | Hard break ~1–2h after deploy; emergency fix needed | Never in prod; dev-only while building the exchange |
| Single global OAuth token for the agency instead of per-client connections | Simpler auth | Can't represent multiple clients; one revoke breaks all; violates "agency per-client" model | Never — required to be per-client by product design |
| Pre-create IG container at compose time for scheduled posts | Simpler scheduler | Container expires; publish fails at due time | Never — create at publish time |
| Lazy re-auth UX (only a raw error page) | Less UI work | Agencies lose days; accounts silently go stale; churn | Never — first-class "Reconnect" is required |
| Assume refresh token always available (LinkedIn) | Simpler token logic | 60-day silent expiry across all accounts | Never — design for re-auth regardless of MDP status |
| Skip per-account rate limiting | Faster scheduler build | 24h LinkedIn cooldown / 429 storms on bulk schedule | MVP only if single account + low volume; add before multi-client |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **LinkedIn OAuth** | Treating it like a standard 3-legged flow with guaranteed refresh token | Expect 60-day access tokens; build re-auth; apply for MDP; use Posts API (`/rest/posts`), not deprecated UGC/Shares |
| **LinkedIn publishing** | Expecting native scheduling | Build your own durable queue/worker — LinkedIn has no server-side scheduling |
| **Meta / Facebook Login** | Persisting the short-lived (1–2h) token | Immediately exchange for long-lived (60d); schedule refresh every 30–45 days |
| **Instagram Graph API** | Passing private/S3/presigned media URLs | Host media on a public, stable CDN URL reachable by Meta's servers |
| **Instagram publishing** | Calling `media_publish` without polling container to `FINISHED` | Create container → poll `status_code` until `FINISHED` → publish; handle `ERROR` |
| **Instagram connection** | Forgetting PPA requirement | Instruct clients to complete Page Publishing Authorization during connect |
| **Scope names** | Using `instagram_basic` / `instagram_content_publish` (removed Jan 2025) | Use `instagram_business_basic` / `instagram_business_content_publish` |
| **App review** | Assuming OAuth = production access | Submit Meta App Review (Live mode) + LinkedIn Community Management review early; dev-mode only allows testers |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Concurrent publish storms | `429` floods, LinkedIn 24h cooldown, dropped posts | Per-account token-bucket throttle + backoff queue in worker | >~25 IG posts/24h per account, or >100 LinkedIn calls/user/day |
| Single-worker scheduler | Missed jobs when worker is down/deployed | Leader election + standby workers + durable job store | As soon as you care about reliability / run >1 instance |
| Polling IG containers in a tight loop | Rate limit exhaustion, wasted calls | Poll with backoff; respect processing time; cap attempts + timeout | High volume of video/Reel publishes |
| No job dedup / idempotency | Duplicate posts after retry or crash-restart | Unique job key + status state machine; claim-with-lock | First retry or multi-instance deploy |
| Unbounded media storage | Disk/cloud cost growth, slow listings | Lifecycle-expire published media; keep only what's needed for retry/repost | Months of operation across many clients |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `client_secret` in frontend bundle | Full app impersonation; token minting by attackers | Server-side secret manager only; never ship to browser |
| Tokens stored plaintext | Breach compromises all client accounts at once | Encrypt at rest (KMS/envelope); decrypt per-request |
| Single shared token for all clients | One revoke/leak breaks every client; no isolation | Per `(client, platform)` connection; scoped storage |
| Ignoring token revocation signals | Stale tokens retried forever; account shown "connected" when dead | Detect `401`/revoke; flip to "needs reconnect"; notify |
| Public media URL leaks private content | Client drafts/images exposed via guessable URLs | Use unguessable CDN keys + appropriate object permissions; don't put private drafts on public URLs meant only for platform fetch |
| Logging tokens / full secrets | Logs become credential store | Redact tokens/secrets in all logging |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Connected" shown green even when token near expiry or PPA incomplete | Agency believes it's publishing; posts silently fail | Show connection health: "Expires in 12 days — Reconnect" / "PPA required" |
| No per-platform validation feedback | User discovers truncation/format failure only after a failed publish | Live char/hashtag/aspect-ratio/format checks per platform in composer |
| Re-auth is a raw error page | Agency can't easily fix; account goes stale for weeks | One-click "Reconnect [Platform]" button per account with guided steps |
| Scheduled post "disappears" on failure | Lost copy; client post missed | Failed state retains content + media; offer Retry/Reschedule |
| No confirmation of local publish time | Posts fire at wrong hour/day | Show "Publishes Aug 4, 9:00 AM EDT" using stored timezone |

---

## "Looks Done But Isn't" Checklist

- [ ] **OAuth connected:** Verify the stored token is **long-lived** (Meta exchanged; LinkedIn expiry tracked) — not a 1–2h short-lived token that will break tonight.
- [ ] **Account "live":** Confirm the Meta app is in **Live mode with approved review** (not Dev mode limited to testers) and LinkedIn app review is submitted/approved.
- [ ] **Media publishable:** For Instagram, media URL is **publicly reachable by Meta** (not presigned/private/local) and stable until publish time.
- [ ] **Scheduled post:** Driven by a **persistent worker + durable job**, not a browser/`setTimeout` timer; has a `status` state machine; is **idempotent**.
- [ ] **Container timing:** IG container is created **at publish time** (worker polls to `FINISHED` then publishes), not pre-built at compose time.
- [ ] **Token refresh:** Automated refresh job exists for Meta; **re-auth fallback** exists for both (LinkedIn especially).
- [ ] **PPA:** Client's Page Publishing Authorization considered/completed where required.
- [ ] **Scopes current:** Using `instagram_business_*` (not removed `instagram_basic/_content_publish`); LinkedIn Posts API (not UGC/Shares).
- [ ] **Rate limits:** Worker throttles per account and handles `429`/cooldown with backoff — not fire-and-forget.
- [ ] **Timezone:** Scheduled time stored as UTC + IANA timezone, rendered back to user.
- [ ] **Failure handling:** Non-success platform response → `failed` state retaining content, not silent success.
- [ ] **Secrets:** `client_secret` server-side; tokens encrypted at rest; no secrets in logs.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| LinkedIn token expired (no refresh) | MEDIUM (per account, manual re-auth) | Detect `401`/expiry → mark account "needs reconnect" → user clicks Reconnect → re-run OAuth; retain scheduled posts, requeue after re-auth |
| Meta token expired | LOW–MEDIUM | Attempt `refresh_access_token`; if fails, prompt re-auth; existing long-lived exchange should prevent most cases |
| IG publish `status_code: ERROR` | LOW | Keep post in `failed` with content+media; show actionable message; user edits media/format and Retries |
| Rate-limit cooldown (LinkedIn 24h) | HIGH (wait + backlog) | Backoff + requeue with delay; notify agency; stagger future publishes; consider per-account quota guardrails |
| PPA block | LOW–MEDIUM | Surface specific PPA instruction + link; on completion, Reconnect and Retry |
| Container created too early / expired | LOW | Re-run full create→poll→publish at next worker tick; do not pre-build containers |
| Worker crash / missed jobs | MEDIUM | Durable job store + leader election; on recovery, claim due-and-overdue jobs with a max-age policy (fire immediately or skip) |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1 LinkedIn refresh gated / re-auth | Phase 1 OAuth & Account Connection | Token model stores `refresh_expires_at`; re-auth UI exists per account; 60-day warning fires in test |
| P2 Meta short-lived token | Phase 1 OAuth | OAuth callback exchanges for long-lived; automated 30–45d refresh job runs in staging |
| P3 Browser-timer scheduling | Phase 3 Scheduler/Worker | Scheduled post fires with no user present; idempotency test (double-trigger → one publish) |
| P4 Public media URL | Phase 2 Publish MVP + Phase 4 Media | Publish from prod-like env with CDN URL; private-URL attempt is rejected pre-submit |
| P5 IG container at publish time | Phase 2 Publish MVP | Scheduled Reel publishes correctly days later; polling loop verified |
| P6 Dev mode / app review | Phase 0/1 + Phase 2 | Real client account publishes only after Live mode + review; dev test accounts work pre-review |
| P7 One content model | Phase 2 (first platform) + Phase 5 (multi) | Per-platform validation rejects over-limit/format-mismatched content with user feedback |
| P8 Refresh race conditions | Phase 1 + Phase 3 | Concurrent refresh of one account yields single valid token; lock verified under load |
| P9 PPA silent block | Phase 1 connect + Phase 5 recovery | Connect flow instructs PPA; failure yields actionable PPA message |
| P10 Deprecated APIs/scopes | Phase 1 + Phase 2 | No deprecated endpoints/scopes in code; API-version currency check in CI |
| P11 Rate limits | Phase 3 + Phase 5 | Bulk schedule of N accounts throttles per-account; 429 → backoff, no drops |
| P12 Timezone | Phase 3 Scheduler | Post scheduled "9 AM EDT" fires at correct UTC instant; DST case tested |
| P13 Opaque errors | Phase 2 + Phase 5 | Non-success → `failed` state retains content; raw error logged; Retry works |
| P14 Insecure tokens | Phase 1 OAuth | `client_secret` absent from frontend; tokens encrypted at rest; secret scan passes |

---

## Sources

- **LinkedIn — Refresh Tokens with OAuth2.0** (Microsoft Learn, updated 2025-05-31): refresh tokens only for approved MDP partners; access token 60d, refresh token fixed 365d non-extending. https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens
- **LinkedIn — Community Management App Review** (Microsoft Learn, updated 2026-02-11): screencast demo requirements, rejection retention rights. https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review
- **LinkedIn — Posts API / no native scheduling** (ConnectSafely 2026-05-16): `/rest/posts` replaces UGC/Shares; 100 calls/user/day with 24h cooldown; "API does not natively support scheduled posts." https://connectsafely.ai/articles/linkedin-post-api-integration-guide-2026
- **LinkedIn OAuth refresh concurrency** (Nango blog, 2026-04-01): `invalid_grant` root causes, race conditions, single-flight/lock fix. https://nango.dev/blog/linkedin-oauth-refresh-token-invalid-grant
- **LinkedIn standard access = no refresh** (adriennevermorel.com, 2026-03-27): "if you have standard API access... someone has to log in and re-authenticate every 60 days. No exceptions." https://adriennevermorel.com/notes/linkedin-ads-oauth-token-management/
- **Meta — Content Publishing (Instagram)** (Meta for Developers, updated 2026-06-30): container model, public media requirement, PPA, host URLs, resumable upload. https://developers.facebook.com/docs/instagram-platform/content-publishing/
- **Meta — Refresh Access Token (Instagram)** (Meta for Developers, updated 2025-07-17): long-lived IG token refresh endpoint, 60-day reset, must be unexpired. https://developers.facebook.com/documentation/instagram-platform/reference/refresh_access_token/
- **Meta — Instagram Graph API scopes deprecated Jan 2025** (Postproxy / Phyllo 2026): `instagram_basic`/`instagram_content_publish` → `instagram_business_basic`/`instagram_business_content_publish`. https://postproxy.dev/blog/post-to-instagram-via-api/
- **Meta — IG rate limits / 25 posts per 24h / JPEG only** (Phyllo, wpsocialninja, 2026). https://www.getphyllo.com/post/how-to-use-instagram-api-to-post-photos-on-instagram
- **Meta OAuth short-lived vs long-lived** (dev.to, 2026-03-15): 1–2h short-lived default; `fb_exchange_token` for 60d; refresh before expiry. https://dev.to/alex97po/meta-oauth-short-lived-vs-long-lived-tokens-and-why-your-token-expires-after-1-hour-4609
- **IG refresh real-world failures** (StackOverflow, 2023–2025): refresh endpoint occasionally returns opaque errors — treat refresh as best-effort. https://stackoverflow.com/questions/79364644/instagram-graph-api-refresh-long-lived-access-token
- **Distributed cron / exactly-once / idempotency** (System Design Sandbox; Archon cron patterns; Railway cron/workers guide, 2026): leader election, row locking, separate coordinator from workers, heartbeat monitoring. https://www.systemdesignsandbox.com/learn/cron-architecture  •  https://archon-eight.vercel.app/devops/cron-patterns  •  https://docs.railway.com/guides/cron-workers-queues
- **Background jobs architecture 2026** (Bedrock Labs; praveentn backend patterns): producer-consumer, scheduled-task pattern, retry/backoff, idempotency. https://bedrocklabs.co/blog/background-jobs-web-app-bullmq-temporal-2026

---

*Pitfalls research for: Content-Creator (multi-platform social publishing/scheduling SaaS)*
*Researched: 2026-07-11*
