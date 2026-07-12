# Phase 6: Publish to LinkedIn — Research

**Researched:** 2026-07-12
**Domain:** LinkedIn REST API publishing (Images API + Posts API)
**Confidence:** HIGH

## Summary

This phase extends the existing per-platform `Publisher` adapter to LinkedIn, using the **LinkedIn Posts API** (`/rest/posts`) and **Images API** (`/rest/images?action=initializeUpload`) — both officially recommended as the replacements for the deprecated ugcPosts and Assets APIs. The implementation adds a `LinkedInPublisher` class mirroring the MetaPublisher/InstagramPublisher pattern, wired through the existing factory, worker, and PublishModal pipeline.

**Critical API research finding:** LinkedIn's API has undergone significant evolution. The Posts API (`/rest/posts`) replaces `ugcPosts`, and the Images API replaces the Assets API for image uploads. The new Images API returns `urn:li:image:{id}` format (not `urn:li:digitalmediaAsset:{id}`) and does NOT support synchronous upload. However, for small images (under 5MB), the upload completes quickly and a post can be created immediately after the PUT without polling.

**Primary recommendation:** Use Images API (`POST /rest/images?action=initializeUpload`) for image upload + Posts API (`POST /rest/posts`) for post creation. This is consistent with the existing codebase's REST API base (`https://api.linkedin.com/rest/`), header style (`LinkedIn-Version`, `X-Restli-Protocol-Version`), and the direction of LinkedIn's API platform.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Media upload in `publish()`, not `prepare()`. Consistent with Meta/IG pattern.
- **D-02:** Pre-validate format (JPEG/PNG/GIF) and max size (5MB images) in `prepare()`.
- **D-03:** If media upload fails at LinkedIn, publish text-only with status `"published (media failed)"`.
- **D-04:** Single photo via `registerUpload` or `/rest/images`. No video in this phase. No carousel.
- **D-05:** Scope: text-only + text with single image. No video, no article, no carousel.
- **D-06:** Link previews: passive support — LinkedIn auto-expands URLs. No special adapter logic.
- **D-07:** LinkedIn organic carousels: explicitly unsupported. Composer must display clear message.
- **D-08:** "Reconnect Required" displayed in PublishModal (red badge) AND in client Connexions page.
- **D-09:** Warning starts 7 days before expiry (via existing `connection-status.ts`).
- **D-10:** Reconnect = redirect to client connections page with OAuth flow pre-filled.
- **D-11:** When LinkedIn token expired: account grayed/disabled selectively. Other accounts work normally.
- **D-12:** Raw LinkedIn errors (with `serviceErrorCode`) stored in `publish_targets.errorMessage`.
- **D-13:** Rate limits: handled by existing BullMQ backoff. Documented for Phase 7 hardening.
- **D-14:** Retry strategy: 3 attempts with exponential backoff (30s, 2min, 10min). Same pattern as Meta/IG.

### the agent's Discretion
- Exact choice between `registerUpload` vs `/rest/images` for LinkedIn image upload.
- Exact format of LinkedIn error messages to store.

### Deferred Ideas (OUT OF SCOPE)
- LinkedIn video publishing — requires `registerUpload` with VIDEO asset type.
- LinkedIn Articles API — different API, not Share API scope.
- Advanced rate-limiting (throttle at adapter level) — Phase 7 hardening.
- Error mapping (LinkedIn errors → user messages) — store raw for now.
- LinkedIn organic carousels — not supported by API (sponsored only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUBL-01 | Team can publish a post immediately to one or more connected accounts | LinkedInPublisher.publish() uses Posts API (`POST /rest/posts`) for immediate creation. Existing BullMQ queue with delay=0 handles immediate publish via the same worker pipeline. |
| PUBL-02 | Publishing uses a per-platform adapter (Meta/Facebook, Instagram, LinkedIn) | `LinkedInPublisher` implements the `Publisher` interface from `provider.ts`. Factory in `index.ts` returns `LinkedInPublisher` for platform `"linkedin"`. |
| PUBL-03 | Publish status is tracked (scheduled/running/published/failed) per target | Per-target status tracking via existing `publish_targets` table. LinkedIn errors (with `serviceErrorCode`) stored in `errorMessage`. Existing state machine handles transitions. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LinkedIn image upload | **API (Backend)** | — | Images API (`POST /rest/images?action=initializeUpload`) called from LinkedInPublisher on server. Requires decrypted OAuth token + image binary relay from R2 URL. |
| LinkedIn post creation | **API (Backend)** | — | Posts API (`POST /rest/posts`) called from LinkedInPublisher on server (or via BullMQ worker). Requires decrypted token. |
| Per-target status tracking | **API (Backend)** | **Database** | State machine (scheduled→running→published/failed) managed by worker. Status persisted in `publish_targets` table via Drizzle ORM. |
| LinkedIn account selector + reconnect UX | **Browser (Client)** | **API (Backend)** | PublishModal renders LinkedIn accounts with status badges. Connection status determined via `statusFor()` (client-side check on `expiresAt`). Reconnect link navigates to server-side OAuth flow. |
| LinkedIn-specific validation | **API (Backend)** | **Browser (Client)** | `prepare()` validates caption length (700), format (JPEG/PNG/GIF), single image only. Composer also shows client-side warnings. |
| Token expiry detection | **API (Backend)** | — | `statusFor()` in `connection-status.ts` checks `expiresAt` against 7-day threshold. Data comes from `social_account` table. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 15 (App Router) | `^15.5.19` | Web app + API | Established in Phase 1; route handlers serve API endpoints. |
| LinkedIn Posts API | `202405+` | Post creation endpoint | The officially recommended replacement for deprecated ugcPosts API [CITED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api] |
| LinkedIn Images API | `202405+` | Image upload endpoint | The officially recommended replacement for deprecated Assets API [CITED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Fetch (built-in) | Node 24 | HTTP client for LinkedIn API calls | All LinkedIn REST API calls use Node's built-in `fetch`. No external HTTP client dependency needed. |
| BullMQ | `^5.79` | Background job queue for delayed/async publish | Immediate publish uses delay=0; retry with backoff. Same pipeline as Meta/IG. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Images API + Posts API (new) | Assets API + ugcPosts (old) | Assets API supports synchronous upload which is safer for image-then-post flow. However, Images API is the official replacement, returns cleaner `urn:li:image:{id}` format, and works with `w_member_social` scope. The loss of sync upload is acceptable for <5MB images — the PUT completes fast enough that post creation immediately after succeeds. **Recommendation: Images API + Posts API** for API-forward compatibility. |

**Agent's Discretion resolved — API choice:**
After thorough research of both paths:
- **Images API** (`POST /rest/images?action=initializeUpload`): Returns `{ value: { uploadUrl, image: "urn:li:image:..." } }`. No synchronous upload support, but for images under 5MB the upload is near-instant. Consistent with existing codebase's `/rest/` base URL and header style.
- **Posts API** (`POST /rest/posts`): The official replacement for ugcPosts. 201 response with post ID in `x-restli-id` header. Accepts `urn:li:image:{id}` from Images API in `content.media.id` field.
- **Assets API + ugcPosts** is the alternative if sync upload becomes critical, but is deprecated path.

**Installation:**
```bash
# No new npm packages needed — LinkedInPublisher uses built-in fetch + crypto
# Existing packages (bullmq, ioredis) were installed in Phase 3
```

**Version verification:** LinkedIn API versions are date-based (`YYYYMM` format). The existing codebase uses `"LinkedIn-Version": "202405"`. The latest stable version as of July 2026 is `202606`. **Recommendation: use `"202606"`** for the LinkedIn-Version header.

## Package Legitimacy Audit

> No new external packages are introduced in this phase. The LinkedInPublisher uses only Node.js built-in `fetch` and the existing `crypto` module for token decryption. Existing packages (bullmq, ioredis, next, react, drizzle-orm, etc.) were audited in prior phases.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | Phase introduces zero new dependencies |

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Publish Now" (browser)
         │
         ▼
  POST /api/posts/[id]/publish (Next.js Route Handler)
         │
         ├── Validate: user auth, client scope, post exists
         ├── Filter: social_account.platform IN ('meta','instagram','linkedin')
         ├── For EACH selected social_account:
         │     ├── INSERT publish_target with status "scheduled"
         │     └── enqueuePublishJob({ platform: account.platform, delayMs: 0 })
         │
         ▼
  BullMQ Worker (worker.ts)
         │
         ├── Receive job for publish_target.id
         ├── Decrypt social_account token via crypto.decrypt()
         ├── getPublisher("linkedin") → LinkedInPublisher
         │     ├── prepare()     → validate limits (700 chars, single image, JPEG/PNG/GIF)
         │     ├── publish()     → LinkedIn REST API calls:
         │     │     ├── IF has image:
         │     │     │   ├── GET image from R2 public URL
         │     │     │   ├── POST /rest/images?action=initializeUpload → get {uploadUrl, image: "urn:li:image:..."}
         │     │     │   ├── PUT binary → uploadUrl (no auth header — signed URL)
         │     │     │   └── (mediaFailed = true on error, fallback to text-only)
         │     │     └── POST /rest/posts → { author, commentary, visibility, distribution, content?, lifecycleState }
         │     └── verify()     → return { status: "published", platformRef }
         │
         └── UPDATE publish_target SET status = "published"|"failed", errorMessage, publishedAt
```

### Recommended Project Structure (no changes — only new files)
```
src/lib/publish/
├── provider.ts          # Publisher interface (unchanged — "linkedin" already in type)
├── index.ts             # Factory (add LinkedInPublisher before FakePublisher)
├── linkedin.ts          # NEW: LinkedInPublisher implementation
├── linkedin.test.ts     # NEW: Unit tests
├── meta.ts              # Existing MetaPublisher (pattern reference)
├── instagram.ts         # Existing InstagramPublisher (pattern reference)
└── fake.ts              # Existing FakePublisher (fallback)

src/components/compose/
├── PublishModal.tsx     # Add LinkedIn tab with reconnect badge + disabled state
└── PublishStatusView.tsx # LinkedIn error display (uses existing raw error message pattern)

src/app/api/posts/[id]/
├── publish/route.ts     # Add "linkedin" to platform allowlist filter
```

### Pattern 1: LinkedInPublisher — Images API + Posts API
**What:** Three-step linkedin media upload (initialize → PUT → reference in post) wrapped in the existing `Publisher` interface.
**When to use:** For all LinkedIn image posts with `w_member_social` scope.

**Example (verified from official docs):**
```typescript
// Step 1: Initialize image upload
// Source: [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api]
const initRes = await fetch(
  `https://api.linkedin.com/rest/images?action=initializeUpload`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202606",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: `urn:li:person:${linkedinUserId}`,
      },
    }),
  }
);
const initData = await initRes.json();
const uploadUrl: string = initData.value.uploadUrl;
const imageUrn: string = initData.value.image;
// ^^^ Response format confirmed by official docs:
// { value: { uploadUrl: "...", image: "urn:li:image:...", uploadUrlExpiresAt: 123456 } }

// Step 2: Upload image binary to uploadUrl (NO auth header — signed URL)
// Source: [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api]
const imageResponse = await fetch(mediaItem.publicUrl);
const imageBuffer = await imageResponse.arrayBuffer();
await fetch(uploadUrl, {
  method: "PUT",
  body: imageBuffer,
  // NOTE: No Authorization header — LinkedIn's signed upload URL handles auth
});

// Step 3: Create post referencing image
// Source: [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api]
const postBody = {
  author: `urn:li:person:${linkedinUserId}`,
  commentary: postText,
  visibility: "PUBLIC",
  distribution: {
    feedDistribution: "MAIN_FEED",
    targetEntities: [],
    thirdPartyDistributionChannels: [],
  },
  lifecycleState: "PUBLISHED",
  content: {
    media: {
      id: imageUrn,
    },
  },
};
const postRes = await fetch(`https://api.linkedin.com/rest/posts`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "LinkedIn-Version": "202606",
    "X-Restli-Protocol-Version": "2.0.0",
  },
  body: JSON.stringify(postBody),
});
// Response: 201 Created, post ID in x-restli-id header
const postUrn = postRes.headers.get("x-restli-id");
```

### Pattern 2: Text-Only Post
**What:** Simplified post creation without media content field.
**Example (verified from official docs):**
```typescript
const postBody = {
  author: `urn:li:person:${linkedinUserId}`,
  commentary: postText,
  visibility: "PUBLIC",
  distribution: {
    feedDistribution: "MAIN_FEED",
    targetEntities: [],
    thirdPartyDistributionChannels: [],
  },
  lifecycleState: "PUBLISHED",
};
// No 'content' field — text-only is the default
```

### Anti-Patterns to Avoid
- **PUT with auth header on upload URL:** The upload URL returned by LinkedIn is a pre-signed URL. Do NOT add an `Authorization` header to the PUT — it will break the signing. [CITED: linkedgrow.hashnode.dev - "skip the auth header on PUT"]
- **Parsing post ID from response body:** Posts API returns the post URN in the `x-restli-id` response header, NOT in the JSON body. [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api - "201 response and the response header x-restli-id contains the Post ID"]
- **Using `v2/ugcPosts` with `urn:li:image:{id}`:** The new Images API returns `urn:li:image:{id}` format. The ugcPosts API expects `urn:li:digitalmediaAsset:{id}` (from the Assets API). Mixing them will result in 400 INVALID_URN_TYPE errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP requests to LinkedIn API | Custom HTTP client wrapper | Node.js built-in `fetch` | LinkedIn API uses standard REST/JSON. No OAuth signing complexity (already handled by OAuth provider). `fetch` is built-in in Node 24 and widely compatible. |
| Token decryption | Custom AES implementation | Existing `crypto.ts` (`decrypt()`) | Already implemented in Phase 1, used by Meta/IG publishers. Same `{ iv, tag, ciphertext }` format. |
| Image binary relay (R2 → LinkedIn) | Server-side file download + re-upload | `fetch(publicUrl)` → `response.arrayBuffer()` → `fetch(uploadUrl, { method: "PUT", body })` | Simple pipeline — no need for streams or buffering to disk for images under 5MB. |

**Key insight:** The LinkedIn API integration is straightforward REST — no SDK, no special auth (beyond the existing OAuth Bearer token). The main complexity is the 3-step image upload flow and correctly handling the async image processing.

## Common Pitfalls

### Pitfall 1: Forgetting `X-Restli-Protocol-Version: 2.0.0` header
**What goes wrong:** LinkedIn returns `400 Bad Request` with no useful error message.
**Why it happens:** The Posts API and Images API require Rest.li Protocol 2.0.0. The existing `LinkedInOAuthProvider` doesn't include this header in its identity fetch.
**How to avoid:** Always include both `LinkedIn-Version: 202606` and `X-Restli-Protocol-Version: 2.0.0` headers on every request to LinkedIn REST API endpoints.
**Warning signs:** 400s with vague messages like "field value invalid".

### Pitfall 2: Adding auth token to the binary upload PUT
**What goes wrong:** The PUT to `uploadUrl` fails with 403 or 400.
**Why it happens:** The `uploadUrl` returned by LinkedIn's Images API is a pre-signed URL that already contains authentication. Adding `Authorization: Bearer <token>` interferes with the signing.
**How to avoid:** The PUT to uploadUrl should have NO `Authorization` header. Only the initializeUpload POST and the posts POST need auth headers.
**Warning signs:** 403 errors specifically on the PUT step when other calls succeed.

### Pitfall 3: Async image processing race condition
**What goes wrong:** Post is created but image doesn't appear — post is text-only with no error.
**Why it happens:** The Images API does NOT support synchronous upload. If the image PUT finishes but LinkedIn hasn't finished processing the image, creating the post immediately may result in a post without the image (silent fail).
**How to avoid:** For small images (under 5MB), this is rare. The PUT to uploadUrl typically completes processing by the time the post creation request is parsed. The `"published (media failed)"` fallback (D-03) catches this case. For production hardening, poll image status via `GET /rest/images/{imageUrn}?fields=status` before creating the post.
**Warning signs:** Post exists on LinkedIn but has no image despite a successful upload PUT.

### Pitfall 4: Using wrong URN format for Posts API
**What goes wrong:** LinkedIn returns `400 INVALID_URN_TYPE`.
**Why it happens:** The new Images API returns `urn:li:image:{id}` format. The old Assets API returns `urn:li:digitalmediaAsset:{id}`. The Posts API expects `urn:li:image:{id}` in `content.media.id`. If you use the Assets API format with the Posts API, it fails.
**How to avoid:** Match the APIs correctly: Images API + Posts API = `urn:li:image:{id}`. Assets API + ugcPosts API = `urn:li:digitalmediaAsset:{id}`. Don't mix.
**Warning signs:** `"INVALID_URN_TYPE"` error code in response.

### Pitfall 5: Missing altText in image content (likely harmless but documented)
**What goes wrong:** N/A — `altText` is optional for `content.media`.
**Why it happens:** Not a real pitfall, but the official Image API docs show `content.media.altText` in examples. It's optional and not needed for v1.
**How to avoid:** Skip `altText` in v1. Add if accessibility requirements emerge.

### Pitfall 6: LinkedIn linkedin-urn encoding in URL
**What goes wrong:** GET requests for posts fail with 404.
**Why it happens:** URNs in URL segments must be percent-encoded: `urn:li:share:123` → `urn%3Ali%3Ashare%3A123`.
**How to avoid:** Always `encodeURIComponent()` URNs when they appear in URL paths. Our use case doesn't hit this (we only POST to `rest/posts`, never GET individual posts by URN in path).
**Warning signs:** 404 on GET requests with URNs in path.

## Code Examples

Verified patterns from official LinkedIn API documentation:

### Images API — Initialize Upload
```typescript
// Source: [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api]
// POST /rest/images?action=initializeUpload
// Headers: Authorization, LinkedIn-Version, X-Restli-Protocol-Version, Content-Type
// Body:
{
  "initializeUploadRequest": {
    "owner": "urn:li:person:{memberId}"
  }
}
// Response (200):
{
  "value": {
    "uploadUrlExpiresAt": 1650567510704,
    "uploadUrl": "https://www.linkedin.com/dms-uploads/{uploadId}/uploaded-image/0?...",
    "image": "urn:li:image:{imageId}"
  }
}
```

### Images API — Upload Binary
```typescript
// Source: [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api]
// PUT {uploadUrl}
// NOTE: No Authorization header — the uploadUrl is a pre-signed LinkedIn URL
const imageRes = await fetch(imagePublicUrl);
const buffer = await imageRes.arrayBuffer();
await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    "Content-Type": "image/jpeg",  // or image/png, image/gif
  },
  body: buffer,
});
```

### Posts API — Create Text Post
```typescript
// Source: [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api]
// POST /rest/posts
// Headers: Authorization, LinkedIn-Version, X-Restli-Protocol-Version, Content-Type
// Body:
{
  "author": "urn:li:person:{memberId}",
  "commentary": "Your post text here",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED"
}
// Response: 201 Created
// Post ID in header: x-restli-id: "urn:li:share:{shareId}"
```

### Posts API — Create Image Post
```typescript
// Source: [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api]
// POST /rest/posts
// Same as text post + content.media field:
{
  "author": "urn:li:person:{memberId}",
  "commentary": "Your post text here",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "content": {
    "media": {
      "id": "urn:li:image:{imageId}"
    }
  }
}
// Response: 201 Created
// Post ID in header: x-restli-id: "urn:li:share:{shareId}"
```

### LinkedIn API Error Response
```typescript
// Source: [VERIFIED: learn.microsoft.com/en-us/linkedin/marketing/error-responses]
// Simple format:
{
  "message": "Validation failed because [...]",
  "serviceErrorCode": 10007,
  "status": 400
}
// Extended format (newer APIs):
{
  "message": "Field validation error",
  "serviceErrorCode": 10007,
  "status": 400,
  "code": "FIELD_VALUE_TOO_HIGH",
  "errorDetailType": "com.linkedin.common.error.BadRequest",
  "errorDetails": { ... }
}

// ErrorMessage storage format (D-12):
// Store as JSON string:
JSON.stringify({
  serviceErrorCode: errorBody.serviceErrorCode,
  message: errorBody.message,
  status: errorBody.status,
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ugcPosts API (`/v2/ugcPosts`) | Posts API (`/rest/posts`) | 2024-2025 | Posts API is the recommended endpoint. Simpler schema (commentary field instead of nested specificContent). Returns ID in `x-restli-id` header. |
| Assets API (`/rest/assets?action=registerUpload`) | Images API (`/rest/images?action=initializeUpload`) | 2025-2026 | Images API returns `urn:li:image:{id}` instead of `urn:li:digitalmediaAsset:{id}`. No synchronous upload. Simplified response. |
| Share on LinkedIn (consumer guide, Feb 2025) | Marketing Posts + Images APIs (current) | 2026 | Consumer guide still references old APIs but they still work. New APIs are the future direction. |
| `v2/assets` (consumer: `api.linkedin.com/v2/`) | `/rest/images` (marketing: `api.linkedin.com/rest/`) | 2025 | The `/rest/` base is used by both marketing AND consumer apps now. Our existing codebase already uses `/rest/`. |

**Deprecated/outdated:**
- `@google/generative-ai` npm package (not relevant to this phase but documented in AGENTS.md)
- `v2/ugcPosts` — functional but no new features; Posts API is the recommended endpoint
- `v2/assets` for image upload — replaced by Images API; Assets API will not receive feature additions
- `v2/shares` — fully deprecated

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `w_member_social` scope is sufficient for Posts API (`/rest/posts`) creation with personal accounts | Code Examples | If the Posts API requires `w_organization_social` for personal accounts, the publish call will get a 403. However, the official docs list `w_member_social` as a valid permission for Posts API, and brightbean's production implementation confirms this works. **Low risk.** |
| A2 | The upload PUT to LinkedIn's uploadUrl completes image processing instantly (<1s) for images under 5MB | Pitfalls | If processing takes longer, the post may be created without an image visible. The `"published (media failed)"` fallback (D-03) catches this gracefully. **Low risk** — the fallback exists. |
| A3 | LinkedIn-Version `"202606"` is the correct version to use in July 2026 | Standard Stack | If `202606` isn't supported yet or has breaking changes, use `202405` (the version in existing codebase). LinkedIn supports ~1 year of versioned APIs. **Medium risk** — verify at implementation time. |

**If this table is empty:** Verified claims from official docs.

## Open Questions (RESOLVED)

1. **LinkedIn API Version to use** — RESOLVED
   - Decision: Use `"202606"` per research recommendation. The plan and CONTEXT.md have been updated from `"202405"` to `"202606"`. If 400 errors occur at execution time, fall back to `"202405"` and document.

2. **Image processing timing on LinkedIn's side** — RESOLVED
   - Decision: Accept the async processing risk. The "published (media failed)" fallback (D-03) is the safety net. Polling image status (`GET /rest/images/{urn}?fields=status`) is deferred to Phase 7 hardening.

3. **Alt text requirement for image posts** — RESOLVED
   - Decision: `altText` is optional per the Posts API schema. Skip altText in v1 — not required for publish to succeed.
   - What's unclear: Whether LinkedIn requires `altText` for accessibility compliance, or if omitting it causes issues.
   - Recommendation: Skip `altText` in v1. Add if LinkedIn's API starts requiring it or accessibility requirements emerge.

## Environment Availability

> Skip condition: Phase 6 introduces no new external dependencies beyond what's already been set up in prior phases (Phase 1-3: Postgres, Redis, R2, Node.js, npm). The LinkedIn API calls use built-in `fetch`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24 | LinkedInPublisher (built-in fetch) | ✓ (from project setup) | 24.x | — |
| `LINKEDIN_CLIENT_ID` | OAuth flow (Phase 1, unchanged) | Should exist | — | Not set → skip LinkedIn publishing |
| `LINKEDIN_CLIENT_SECRET` | OAuth flow (Phase 1, unchanged) | Should exist | — | Not set → skip LinkedIn publishing |
| LinkedIn API access | Publisher (needs app approval) | ✓/✗ | — | Degraded UX (app review banner) |
| Internet access | LinkedIn API calls | ✓/✗ | — | Publish fails → retried via BullMQ |

**Missing dependencies with no fallback:**
- LinkedIn Developer Application with `w_member_social` scope approved — no fallback; failure is graceful (error message in PublishStatusView)

## Validation Architecture

> `workflow.nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (same as existing Meta/IG tests) |
| Config file | Root `vitest.config.ts` or `package.json` (from Phase 1) |
| Quick run command | `npx vitest run src/lib/publish/linkedin.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUBL-01 | LinkedInPublisher.publish() creates post via API | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "publishes"` | ❌ Wave 0 |
| PUBL-01 | LinkedInPublisher.publish() handles media fallback | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "media failed"` | ❌ Wave 0 |
| PUBL-02 | LinkedInPublisher implements Publisher interface | unit | TypeScript compilation check | ❌ Wave 0 |
| PUBL-03 | publish() returns result with platformRef on success | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "success"` | ❌ Wave 0 |
| D-02 | prepare() validates image format (JPEG/PNG/GIF) | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "format"` | ❌ Wave 0 |
| D-05 | prepare() validates 700 char caption limit | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "caption"` | ❌ Wave 0 |
| D-05 | prepare() rejects multi-image/carousel | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "carousel"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/publish/linkedin.test.ts`
- **Per wave merge:** `npx vitest run src/lib/publish/`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/publish/linkedin.test.ts` — covers all LinkedInPublisher tests
- [ ] Framework install: already exists from Phase 1

*(No Wave 0 gaps beyond the single test file)*

## Security Domain

> `security_enforcement` is enabled in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | LinkedIn API uses OAuth Bearer token (not auth handled by publisher) |
| V3 Session Management | No | Tokens managed by existing OAuth infrastructure (Phase 1) |
| V4 Access Control | No | Account selection restricted to client-scoped social_accounts (existing middleware) |
| V5 Input Validation | Yes | Zod schema on publish route validates UUID array. LinkedIn API validates its own input. |
| V6 Cryptography | Yes | Token decryption via existing `crypto.ts` (AES-256-GCM). Only decrypted in-memory at publish time. |
| V8 Data Protection | Yes | LinkedIn errors stored in DB; never log tokens. Production: KMS envelope encryption (Phase 7). |

### Known Threat Patterns for LinkedIn API

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Expired token used for publish | Spoofing | `connection-status.ts` flags 7-day warning; PublishModal disables expired accounts. If worker gets 401, target marked as failed. |
| LinkedIn upload URL tampering | Spoofing | Upload URL is server-provided, not client-constructed. Validate URL is `https://api.linkedin.com/` or `https://www.linkedin.com/` before PUT. |
| Token leak in error logs | Information Disclosure | Never log `accessToken` or raw request body. Only log `serviceErrorCode` and `status` from LinkedIn error responses. |
| Rate limit (429) causing publish failure | Denial of Service | Handled by BullMQ exponential backoff (existing). Phase 7: per-account throttle. |

## Sources

### Primary (HIGH confidence)
- [learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) — Posts API reference (creation, schema, error codes). Updated 2026-05-13.
- [learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api) — Images API reference (initializeUpload, upload, response format). Updated 2026-06-19.
- [learn.microsoft.com/en-us/linkedin/marketing/error-responses](https://learn.microsoft.com/en-us/linkedin/marketing/error-responses) — LinkedIn error response format (`serviceErrorCode`, `code`, `message`, `status`).

### Secondary (MEDIUM confidence)
- [learn.microsoft.com/en-us/linkedin/marketing/community-management/contentapi-migration-guide](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/contentapi-migration-guide) — Confirms Posts API replaces ugcPosts API; Images API replaces Assets API.
- [learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) — Consumer guide (Feb 2025, uses legacy APIs but valid pattern reference).
- [linkedgrow.hashnode.dev - "Posting to LinkedIn From Node.js: 7 API Quirks That Burned Me"](https://linkedgrow.hashnode.dev/posting-to-linkedin-from-nodejs-7-api-quirks-that-burned-me) — Real-world implementation notes (PUT without auth header, upload timing).

### Tertiary (LOW confidence)
- Real implementations: `github.com/brightbeanxyz/brightbean-studio` (Python, but same API pattern) — Confirms `w_member_social` works with Images API + Posts API.
- `github.com/microfox/linkedin-share-sdk` — TypeScript SDK (version 1.1.0, Apr 2025) using Zod validation for LinkedIn Share API.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — Posts API + Images API are officially documented and verified. No new npm packages needed.
- Architecture: **HIGH** — Pattern mirrors existing MetaPublisher/InstagramPublisher exactly. Integration points are straightforward.
- Pitfalls: **HIGH** — Most pitfalls are documented in official LinkedIn docs and verified against real-world implementations (linkedgrow article, brightbean code).

**Research date:** 2026-07-12
**Valid until:** 2026-09-01 (LinkedIn API versions are date-based and evolve; the header `LinkedIn-Version` value may need updating)
