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
  - AppNav integration ('Compose' link, SignOutButton)

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"]
  patterns: ["post CRUD + media with client isolation"; "R2 presigned URLs + Drizzle"; "client-side warnings for platform limits"]

key-files:
  created:
    - src/lib/db/schema.ts (extended with posts + media tables + relations)
    - src/lib/posts.ts (post CRUD with media attachment)
    - src/lib/media.ts (media CRUD)
    - src/lib/r2.ts (R2 S3 client + presigned URL generator)
    - src/app/api/posts/route.ts (GET list + POST create)
    - src/app/api/posts/[id]/route.ts (GET by id + PATCH update)
    - src/app/api/media/upload/route.ts (POST presigned upload)
    - src/app/compose/new/page.tsx (composer UI)
    - src/app/compose/post/[id]/page.tsx (edit UI)
    - src/lib/posts.test.ts, src/lib/media.test.ts
    - src/app/api/posts/route.test.ts, src/app/api/media/upload/route.test.ts

key-decisions:
  - "Post created immediately (no draft) for v1 simplicity; multiImage flag supports future carousel."
  - "R2 configured with presigned PUT URLs (1h expiry); media rows inserted on upload request."
  - "Platform limits enforced in UI only (IG 2200, LinkedIn 700) with warnings."
  - "AppNav uses ClientSwitcher + Compose link + SignOutButton (client component)."

patterns-established:
  - "Post and media entity symmetry: each has its own CRUD + client isolation."
  - "Route handlers use requireUser() + getActiveClientId() from clients.ts for auth + scoping."
  - "R2 mocked in tests; production requires env vars."

requirements-completed: ["COMP-01", "COMP-02", "MEDA-01", "MEDA-02"]

# Metrics
duration: n/a (sandbox)
completed: 2026-07-12
files_modified: 16

# Accomplishments
- Schema extended with `posts` (id, clientId, title, text, multiImage, timestamps) and `media` (id, clientId, key, publicUrl, contentType, uploadedAt, metadata, postId) tables.
- Post CRUD lib: createPost, getPost, updatePost, listPosts with media attach/detach.
- Media lib: insertMedia, getClientMedia with per-client isolation.
- R2 presigned URL generation via @aws-sdk/client-s3 (mocked in tests).
- POST /api/posts and POST /api/media/upload endpoints with auth + client scoping + input validation.
- Composer UI: text + title input, platform validation warnings (IG/LinkedIn), save flow.
- Edit page: load post by id, edit text/title, re-save.
- Tests: posts.test.ts, media.test.ts, posts/route.test.ts, media/upload/route.test.ts.

# Files Created/Modified
- `src/lib/db/schema.ts` — added `posts` + `media` tables, relations, type exports
- `src/lib/posts.ts` — post CRUD with media attachment via `postId` FK
- `src/lib/media.ts` — insertMedia, getClientMedia
- `src/lib/r2.ts` — R2 S3 client + generateUploadUrl
- `src/app/api/posts/route.ts` — GET list + POST create (auth + scoped)
- `src/app/api/posts/[id]/route.ts` — GET by id + PATCH update
- `src/app/api/media/upload/route.ts` — POST with presigned URL response
- `src/app/compose/new/page.tsx` — compose form (text, title, warnings, save)
- `src/app/compose/post/[id]/page.tsx` — edit form (load, edit, save)
- `src/components/nav/AppNav.tsx` — Compose link, SignOutButton
- `src/test/helpers.ts`, `src/test-utils/request.ts` — cleanup extended for media/posts
- `.env.example` — added R2 env vars
- Test files: posts.test.ts, media.test.ts, posts/route.test.ts, media/upload/route.test.ts

# Decisions Made
- routes use `requireUser(req.headers)` + `getActiveClientId(req.headers)` (separate concerns) instead of old `requireClientScope`.
- AppNav simplified to client component (no async data fetching); Compose link and SignOutButton added.

# Deviations from Plan
- Path `[id]/route.ts` now under `[id]/` subdirectory (App Router convention), matching plan.
- R2 upload is mocked in tests; real R2 requires env vars.

# Issues Encountered
- `requireClientScope` was removed in the Phase 1 live refinement; route files fixed to use `requireUser` + `getActiveClientId`.
- Same sandbox limits as Phase 1: no network/Postgres → tests written but not executed.

# User Setup Required
1. `npm install`
2. Set R2 env vars (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`).
3. `npx drizzle-kit push` to migrate posts + media tables.
4. `npm run test` (vitest should green after R2 mock passes).
5. Manual: login → AppNav shows "Compose" → create post → edit → see warnings.

# Next Phase Readiness
Plan 02 is complete. Post and media entities are ready for Phase 3 (scheduler/worker) which builds on posts as the job payload.

---
*Phase: 02-composer-media-library*
*Completed: 2026-07-12*
