# Phase 3: Scheduler & Worker — Validation

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^2 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run src/lib/publish/fake.test.ts` |
| Full suite command | `npx vitest run` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Test File | Status |
|--------|----------|-----------|-----------|--------|
| SCHD-01 | Schedule API stores `scheduledAt` as UTC, creates `publish_targets`, enqueues job | integration | `src/app/api/posts/__tests__/schedule.test.ts` | Planned (Task 3-4-2) |
| SCHD-02 | Worker transitions `running→published/failed`, idempotent on restart | unit | `src/lib/publish/fake.test.ts` | Planned (Task 3-4-1) |
| SCHD-03 | Schedule list API returns ordered results | integration | `src/app/api/schedules/__tests__/route.test.ts` | Planned (Task 3-4-2) |
| SCHD-04 | Timezone conversion: 09:00 America/New_York → 13:00 UTC | unit | `src/lib/timezone.test.ts` | Planned (Task 3-4-1) |
| — | FakePublisher: prepare + publish + verify roundtrip | unit | `src/lib/publish/fake.test.ts` | Planned (Task 3-4-1) |

## Sampling Rate

- **Per task commit:** `npx vitest run src/lib/publish/fake.test.ts src/lib/timezone.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verification

## Wave 0 Gaps

- [x] `src/lib/timezone.test.ts` — covers timezone conversion (SCHD-04)
- [x] `src/lib/publish/fake.test.ts` — covers FakePublisher (SCHD-02)
- [x] `src/app/api/posts/__tests__/schedule.test.ts` — covers schedule API (SCHD-01)
- [x] `src/app/api/schedules/__tests__/route.test.ts` — covers schedule list API (SCHD-03)
