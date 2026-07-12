# Phase 3: Scheduler & Worker (reliability proof) — Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase implements the durable scheduling and background worker infrastructure. The team can compose a post (Phase 2), schedule it for a future date/time with correct timezone handling, and a background worker (BullMQ, separate process) publishes due posts reliably and idempotently — proven via a FakePublisher adapter.

This phase does NOT connect to real social platform APIs — that's Phases 4-6 (Meta, Instagram, LinkedIn). All publishing is proven with a fake adapter in this phase.

Key integration points with existing phases:
- `posts` table (Phase 2) — extended with schedule columns
- `social_account` table (Phase 1) — publish targets reference this; tokens decrypted at publish time
- `client` table (Phase 1) — all scheduling is scoped per-client
- `crypto.ts` (Phase 1) — decrypt social_account tokens for fake publishing
- `src/middleware.ts` (Phase 1) — protect schedule routes
- Pattern: `OAuthProvider` interface (Phase 1) — Publisher interface mirrors this design

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**4 requirements are locked.** See `03-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `03-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from ROADMAP):**
- SCHD-01: Team can schedule a post for a future date/time
- SCHD-02: A background worker publishes due posts reliably (offline-safe, idempotent)
- SCHD-03: A calendar/queue view shows scheduled posts
- SCHD-04: Scheduling handles timezones correctly (IANA)

**Out of scope:**
- Real platform API publishing — Phase 4-6 (PUBL-01/02/03)
- Per-account rate-limit enforcement — Phase 7 / v2
- Dead-letter / retry UI — v2 (OPS-02)
- Observability (job lag, failure rate) — v2 (OPS-01)
- Bulk/CSV scheduling — v2 (SCHD-05)
- Per-account rate-limit enforcement across multi-client fan-out — v2 (SCHD-06)

</spec_lock>

<decisions>
## Implementation Decisions

### D-01: Schedule storage — Extended `posts` table
Ajouter les colonnes `scheduled_at`, `status`, `timezone` directement sur la table `posts` existante. Pas de table `schedules` séparée. Le statut du post lui-même indique s'il est draft, scheduled, ou published.

### D-02: Post-to-target mapping — `publish_targets` table
Table junction `post_id` → `social_account_id` avec statut par cible (scheduled/running/published/failed). Un post peut cibler plusieurs comptes sociaux simultanément. Colonnes : `id`, `post_id` (FK), `social_account_id` (FK), `status`, `error_message`, `published_at`, `created_at`, `updated_at`.

### D-03: Publisher interface — Multi-étapes (prepare + publish + verify)
L'interface Publisher expose trois méthodes distinctes :
- `prepare(post, target) → Promise<PrepareResult>` — valide que le target peut recevoir le post, upload media si nécessaire
- `publish(post, target, context) → Promise<PublishResult>` — publie effectivement
- `verify(targetId, platformRef) → Promise<VerifyResult>` — vérifie le statut de publication (optionnel en Phase 3)

FakePublisher les implémente toutes pour le test de la pipeline en Phase 3.

### D-04: Worker deployment — Processus séparé `worker.ts`
Fichier racine `worker.ts` qui importe `src/lib/` (db, redis, crypto, publisher). Démarré indépendamment avec `node worker.ts`. Partage le même codebase mais scale séparément de l'app Next.js.

### D-05: Schedule UI — Vue liste + calendrier (deux onglets)
Page `/schedule` avec deux onglets :
1. **Liste** — Tableau chronologique trié par `scheduled_at`. Filtrable par statut, client.
2. **Calendrier** — Calendrier mensuel/semaine avec pastilles pour les posts programmés. Clic → détail.

### D-06: Timezone handling — IANA picker + UTC storage
- `scheduled_at` stocké en `timestamptz` (UTC) en base
- L'utilisateur choisit son fuseau IANA via un sélecteur au moment du scheduling
- Le serveur convertit le datetime local en UTC avant stockage
- L'UI affiche dans le timezone sélectionné ou détecté

### D-07: Per-target status — `scheduled → running → published/failed`
- `scheduled`: en attente dans BullMQ (delay > 0)
- `running`: le worker a commencé la tentative de publication
- `published`: succès
- `failed`: échec permanent (après retries épuisées)
- Running est atomique (CAS / job lock) pour éviter les doubles publications

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec & roadmap
- `.planning/phases/03-scheduler-worker/03-SPEC.md` — **Locked requirements** (4) + boundaries + acceptance criteria. MUST read before planning.
- `.planning/ROADMAP.md` §Phase 3 — goal, success criteria, dependency (Phase 2), requirement mapping.
- `.planning/REQUIREMENTS.md` — v1 requirements SCHD-01/02/03/04 + Out-of-Scope table.

### Stack & architecture (greenfield decisions)
- `AGENTS.md` → `STACK.md` — BullMQ + Redis for durable scheduling; separate worker process; `ioredis` for Redis client.
- `AGENTS.md` → `PROJECT.md` — core value, constraints (scheduling reliability, token lifecycle).

### Existing code patterns (from Phases 1-2)
- `src/lib/oauth/provider.ts` — `OAuthProvider` interface pattern to mirror for `Publisher` interface
- `src/lib/oauth/mock.ts` — Mock provider pattern to mirror for `FakePublisher`
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt (used by worker at publish time via `decrypt()`)
- `src/lib/db/schema.ts` — All existing tables, especially `posts` (target for extension) and `social_account` (with encrypted tokens)
- `src/lib/db.ts` — Shared DB connection (reused by worker)
- `src/lib/clients.ts` — `requireUser()`, `getActiveClientId()` patterns
- `src/lib/posts.ts` — Existing post CRUD (will be extended)
- `src/app/api/posts/` — Route handler pattern for API
- `src/middleware.ts` — Auth middleware pattern
- Drizzle migration pattern: `drizzle/` directory, `drizzle-kit generate`

### Dependencies to add
- `bullmq` ^5.79
- `ioredis` ^5

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/db/schema.ts` — exists; will add `scheduledAt`, `timezone`, `status` to `posts` table + new `publish_targets` table
- `src/lib/db.ts` — shared DB connection; worker will reuse
- `src/lib/crypto.ts` — `decrypt()` used by worker at publish time
- `src/lib/posts.ts` — existing CRUD; add schedule-related operations
- `src/lib/clients.ts` — `requireUser()`, `getActiveClientId()`
- `src/lib/http.ts` — `HttpError` + `errorResponse()`
- `src/lib/media.ts` — media by URL for publish
- `src/app/api/posts/` — extend with schedule endpoints (POST /api/posts/[id]/schedule, GET /api/posts/scheduled)
- `src/app/api/posts/route.ts` — pattern for route handlers

### Established Patterns
- `OAuthProvider` interface in `src/lib/oauth/provider.ts` → mirror for `Publisher` interface
- `MockOAuthProvider` in `src/lib/oauth/mock.ts` → mirror for `FakePublisher`
- Provider factory `src/lib/oauth/index.ts` → mirror for Publisher factory
- Route handler pattern: `GET/POST/PATCH/DELETE(req, {params})` with try/catch + `HttpError`
- Drizzle ORM with `postgres` driver
- Vitest with `createAuthedUser` / `cleanupTestData`
- Single `schema.ts` file with all tables

### Integration Points
- `posts` table — add `scheduledAt timestamptz`, `timezone text`, `status text` columns
- New `publish_targets` table — `post_id` → `social_account_id` with per-target status
- BullMQ queue in `src/lib/queue/` — module to create/manage queue and worker
- Redis connection in `src/lib/redis.ts` — ioredis instance for BullMQ
- Publisher interface in `src/lib/publish/provider.ts`
- FakePublisher in `src/lib/publish/fake.ts`
- Worker entrypoint: `worker.ts` at project root
- Migration: `drizzle-kit generate` after schema changes

</code_context>

<specifics>
## Specific Ideas

- Le formateur de date dans l'UI doit utiliser `date-fns-tz` ou `Intl.DateTimeFormat` avec IANA timezone pour l'affichage.
- Le worker doit décrypter le token au moment de l'exécution, jamais avant (garder le ciphertext hors mémoire le plus longtemps possible).
- Idempotence : BullMQ jobId basé sur `publish_target.id` pour garantir qu'un même target n'est jamais schedulé deux fois.
- FakePublisher en Phase 3 : `prepare()` valide que le post a bien du contenu, `publish()` marque le target comme published, `verify()` renvoie le statut actuel.
- Calendrier UI : utiliser une lib légère (react-calendar ou construire un composant Tailwind simple en évitant des dépendances lourdes).
- Sélecteur de timezone : utiliser `Intl.supportedValuesOf('timeZone')` pour la liste + `Intl.DateTimeFormat().resolvedOptions().timeZone` pour l'auto-détection.

</specifics>

<deferred>
## Deferred Ideas

- Rate-limit enforcement par compte — Phase 7 / v2 (SCHD-06)
- Dead-letter queue UI — v2 (OPS-02)
- Observabilité (job lag, failure rate) — v2 (OPS-01)
- Bulk/CSV scheduling — v2 (SCHD-05)
- KMS envelope encryption (AWS/GCP KMS) — deferred; use env-based master key for now

</deferred>

---

*Phase: 03-scheduler-worker*
*Context gathered: 2026-07-12*
