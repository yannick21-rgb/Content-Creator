# Phase 6: Publish to LinkedIn — VALIDATION

> Generated from 06-RESEARCH.md §Validation Architecture.

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (same as existing Meta/IG tests) |
| Config file | Root `vitest.config.ts` or `package.json` (from Phase 1) |
| Quick run command | `npx vitest run src/lib/publish/linkedin.test.ts` |
| Full suite command | `npx vitest run` |

## Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUBL-01 | LinkedInPublisher.publish() creates post via API | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "publishes"` | ❌ Wave 0 |
| PUBL-01 | LinkedInPublisher.publish() handles media fallback | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "media failed"` | ❌ Wave 0 |
| PUBL-02 | LinkedInPublisher implements Publisher interface | unit | TypeScript compilation check | ❌ Wave 0 |
| PUBL-03 | publish() returns result with platformRef on success | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "success"` | ❌ Wave 0 |
| D-02 | prepare() validates image format (JPEG/PNG/GIF) | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "format"` | ❌ Wave 0 |
| D-05 | prepare() validates 700 char caption limit | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "caption"` | ❌ Wave 0 |
| D-05 | prepare() rejects multi-image/carousel | unit | `npx vitest run src/lib/publish/linkedin.test.ts -t "carousel"` | ❌ Wave 0 |

## Sampling Rate

- **Per task commit:** `npx vitest run src/lib/publish/linkedin.test.ts`
- **Per wave merge:** `npx vitest run src/lib/publish/`
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Wave 0 Gaps

- [ ] `src/lib/publish/linkedin.test.ts` — covers all LinkedInPublisher tests
- [ ] Framework install: already exists from Phase 1

*(No Wave 0 gaps beyond the single test file)*
