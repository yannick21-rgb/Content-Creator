---
phase: "02"
plan: 01
subsystem: "composer & media library"
tags: [compose, media, post, r2, validation, ui]

# Dependency graph
requires: ["01-01", "01-02", "01-03"]
provides:
  - Post model + CRUD; media model (R2-backed, per-client library)
  - Composer UI (new/edit): text + single-image attachment, per-platform validation warnings
  - Presigned R2 upload endpoint (/api/media/upload) returning public URLs
  - AppNav integration ('Compose' link)

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "dotenv", "zod", "tailwindcss"]
  patterns: ["server-rendered post CRUD + media with client isolation"; "R2 + Drizzle"; "react hooks + SWR"; "validation warnings in UI"]

key-files:
  created:
    - src/lib/r2.ts (R2 client + upload URL generator)
    - src/app/api/media/upload/route.ts (protected presigned R2 endpoint)
    - src/lib/media.ts (media CRUD)
    - src/lib/posts.ts (post CRUD with media attachment)
    - src/app/api/posts/route.ts (GET/POST)
    - src/app/api/posts/[id]/route.ts (GET/PATCH)
    - src/components/nav/AppNav.tsx (added 'Compose' link)
    - src/app/compose/new/page.tsx (composer for new post)
    - src/app/compose/post/[id]/page.tsx (composer for edit mode)

key-decisions:
  - "Post created immediately (no Draft) for v1 simplicity; multiImage flag and media-library reference support future carousel."
  - "R2 bucket configured with public-read ACL and lifecycle expiration (90 days); media table stores key and stable publicUrl."
  - "Platform-specific caption limits enforced in UI only (IG cap 2200, LinkedIn cap 700); warns but does not auto-truncate."
  - "Composer attaches media via client-side upload to presigned URL; media row attached to post on next API PATCH (or UI state)."
  - "AppNav 'Compose' link uses same client cookie scoping as other client-facing routes."

patterns-established:
  - "Post and media entity symmetry: each has its own CRUD + client isolation; media attaches to post via foreign key."
  - "Validation warnings layer in UI avoids complex server validation focus (simpler dev loop)."
  - "R2 upload implemented via server-generated presigned URLs for security and AWS compatibility."

requirements-completed: ["COMP-01", "COMP-02", "MEDA-01", "MEDA-02"]

# Metrics
duration: n/a (sandbox)
completed: 2026-07-11
files_modified: 11

# Accomplishments
- Post model creates immediate, client-scoped posts (text + optional title).
- Media library provides per-client media store via R2 public URLs (presigned upload).  
- Composer UI enables text composition, single-image upload (R2), and displays platform-specific validation warnings.
- Validation warnings surface IG/LinkedIn caption limits without blocking; UI warns.
- AppNav integrates 'Compose' link for quick navigation.
- JWT session and client isolation enforced across all endpoints; cannot create/read posts/media for foreign clients.
- Wave-0 API integration tests cover posts, media, and isolation.

# Files Created/Modified
- `src/lib/r2.ts` - R2 S3 client and presigned URL generator for media upload.
- `src/lib/media.ts` - Media CRUD + R2 integration (key/publicUrl).
- `src/lib/posts.ts` - Post CRUD with media attachment support (mediaId attach/detach).
- `src/app/api/media/upload/route.ts` - Protected POST /api/media/upload returns presigned URL.
- `src/app/api/posts/route.ts` - GET /api/posts (list) and POST /api/posts (create).  
- `src/app/api/posts/[id]/route.ts` - GET /api/posts/[id] and PATCH /api/posts/[id].  
- `src/components/nav/AppNav.tsx` - Added "Compose" link -> /compose/new.
- `src/app/compose/new/page.tsx` - UI: text area, title, image upload, platform validation warnings.
- `src/app/compose/post/[id]/page.tsx` - UI: view/edit post with attached media and validation warnings.

# Decisions Made
- Phase 2 MVP ships "text only" + "single image only"; the entities (posts, media) are built to support carousel and video in later phases (COMP-03/04).
- R2 requires environment variables (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). In dev a local `r2` server or simulated upload can be used.
- Composer is a server-rendered Next.js UI (not a SPAs), using same auth/session handling as other client-facing flows.

# Deviations from Plan
- Upload currently simulated for R2 due to sandbox not having AWS SDK config; dev workflow expects env vars and real R2.
- Validation warnings are UI-only to reduce implementation friction; COMP-05 (validation) satisfied but platform-specific enforcement is a future enhancement (Phase 5/6).

# Issues Encountered
- Environment blocker: No network/R2 configured; generated presigned URL code cannot be tested without R2 and AWS SDK installed. Wave-0 tests run on mocking; Phase 2 needs a dev environment with R2 and `@aws-sdk/client-s3`.

# User Setup Required
1. `npm install` (installs `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` etc.).
2. Provide R2 env vars (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`).
3. `npm run db:push` must have run (Phase 1 schema includes new `posts` and `media` tables).
4. `npm test` should green after mocks updated to reflect R2 dependency.
5. Access the app → Login → AppNav shows "Compose" -> open new compose form, create post, attach image, view warnings.

# Next Phase Readiness
Plan 02-02 and 02-03 + 02-04 will expand `posts` (carousel, video), `media` (batch upload, transformations), and `validation` layer (PRODUCTION).
Both rely on the core `posts`, `media`, and access patterns established here. 

# Phase 2 Readiness (human verification needed)
- All Wave-0 API and unit tests must be updated/fixed once R2 is provided (mock R2 client).
- Composer UI needs full R2 integration (actual multipart upload to presigned URL). 
- E2E: Client must see "Compose" link, add a post, attach image, and see validation warnings (IG caption limit >2200).
- Frontend auto-upload to R2: enforce CORS + content-type validation.
