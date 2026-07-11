---
phase: 01
slug: foundation-auth-clients-connections
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (v3) |
| **Config file** | `vitest.config.ts` (root) — `test.environment: "node"`, `test.setupFiles: ["vitest.setup.ts"]` |
| **Quick run command** | `vitest run src/lib` (pure unit: crypto, scoping, status) |
| **Full suite command** | `vitest run` (includes DB-backed Route Handler integration tests) |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `vitest run src/lib`
- **After every plan wave:** Run `vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-01 | T-01-01 / — | Password never stored plaintext | unit+integration | `vitest run src/app/api/auth/signup/route.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUTH-01 | T-01-02 / — | Wrong creds → 401, no session | integration | `vitest run src/app/api/auth/login/route.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 01 | 1 | AUTH-02 | T-01-03 / — | Session cookie valid across refresh | integration | `vitest run src/lib/auth-session.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01 | 2 | CLNT-01 | T-01-04 / — | Authed create; unauthed → 401 | integration | `vitest run src/app/api/clients/route.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 01 | 2 | CLNT-02 | T-01-05 / — | Cross-client read empty; FK NOT-NULL | integration+DB | `vitest run src/lib/client-scope.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-03 | 01 | 2 | CLNT-03 | T-01-06 / — | PATCH isolation; DELETE cascade | integration+DB | `vitest run src/app/api/clients/[id]/route.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 01 | 3 | CONN-01 | T-01-07 / — | Encrypted token + identity persisted | integration(mock) | `vitest run src/lib/oauth/meta.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 01 | 3 | CONN-02 | T-01-08 / — | Encrypted token + profile id | integration(mock) | `vitest run src/lib/oauth/linkedin.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-03 | 01 | 3 | CONN-03 | T-01-09 / — | Ciphertext in DB; never plaintext API | unit+DB | `vitest run src/lib/crypto.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-04 | 01 | 3 | CONN-04 | T-01-10 / — | 7-day reconnect threshold + re-auth URL | unit+integration | `vitest run src/lib/connection-status.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — framework config + test DB wiring.
- [ ] `vitest.setup.ts` — load `DATABASE_URL_TEST`, run migrations on test schema.
- [ ] `src/lib/crypto.test.ts` — AES-256-GCM roundtrip; ciphertext ≠ plaintext; wrong key fails; no token in logs.
- [ ] `src/lib/client-scope.test.ts` — cross-client read empty; FK NOT-NULL enforced.
- [ ] `src/lib/connection-status.test.ts` — 7-day threshold logic.
- [ ] `src/app/api/auth/signup/route.test.ts` — creates hashed user; duplicate 409.
- [ ] `src/app/api/auth/login/route.test.ts` — correct→session, wrong→401.
- [ ] `src/lib/auth-session.test.ts` — refresh-surviving session; invalid cookie rejected.
- [ ] `src/app/api/clients/route.test.ts` — authed create; unauthed 401.
- [ ] `src/app/api/clients/[id]/route.test.ts` — list/distinct; PATCH isolation; DELETE cascade.
- [ ] `src/lib/oauth/meta.test.ts` — mock full flow → encrypted token + identity.
- [ ] `src/lib/oauth/linkedin.test.ts` — mock full flow → encrypted token + profile id.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser refresh keeps user authenticated | AUTH-02 | Session-cookie behavior best confirmed in real browser | Log in, hard-refresh, confirm still authenticated |
| "Reconnect required" badge renders with one-click re-auth | CONN-04 | UI state rendering | Connect mock account, backdate `expires_at`, confirm badge + link |

*All other behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
