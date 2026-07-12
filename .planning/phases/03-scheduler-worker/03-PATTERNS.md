# Phase 3: Scheduler & Worker — Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 15 (new/modified)
**Analogs found:** 12 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/publish/provider.ts` | interface | CRUD (prepare+publish+verify) | `src/lib/oauth/provider.ts` | **exact** — same role (interface) |
| `src/lib/publish/fake.ts` | service (mock) | CRUD | `src/lib/oauth/mock.ts` | **exact** — same role (mock impl) |
| `src/lib/publish/index.ts` | factory | — | `src/lib/oauth/index.ts` | **exact** — same role (factory) |
| `src/lib/redis.ts` | config | — | `src/lib/db.ts` | **role-match** — both are connection singletons |
| `src/lib/queue/index.ts` | service | event-driven | `src/lib/oauth/complete.ts` | **partial** — service that orchestrates async work |
| `worker.ts` | entrypoint | event-driven | `src/middleware.ts` | **partial** — both are non-Next entrypoints (but very different) |
| `src/lib/db/schema.ts` (extend) | model | — | `src/lib/db/schema.ts` (existing) | **same file** — extending `posts` table + new `publish_targets` |
| `src/lib/posts.ts` (extend) | service | CRUD | `src/lib/posts.ts` (existing) | **same file** — adding schedule ops |
| `src/app/api/posts/[id]/schedule/route.ts` | controller | request-response | `src/app/api/posts/[id]/route.ts` | **exact** — route handler pattern |
| `src/app/api/schedules/route.ts` | controller | request-response | `src/app/api/posts/route.ts` | **exact** — route handler pattern |
| `src/lib/publish/fake.test.ts` | test | — | `src/lib/posts.test.ts` | **exact** — vitest + createAuthedUser pattern |
| Schedule UI page | component | request-response | `src/app/compose/new/page.tsx` | **role-match** — form-based page |
| Calendar/List UI components | component | request-response | `src/components/connections/ConnectionsView.tsx` | **role-match** — data-display component |
| Timezone picker component | component | request-response | `src/components/nav/ClientSwitcher.tsx` | **role-match** — selector input |
| `src/lib/crypto.ts` (reuse) | utility | — | (existing, unchanged) | **reuse as-is** |

## Pattern Assignments

### `src/lib/publish/provider.ts` (interface, CRUD)

**Analog:** `src/lib/oauth/provider.ts` — 30 lines, exact same role

**Full file — mirror this structure exactly:**

```typescript
// src/lib/oauth/provider.ts (lines 1–30)
export type Platform = "meta" | "linkedin";

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  longLived?: boolean;
}

export interface OAuthIdentity {
  platformAccountId: string;
  name: string;
}

export interface OAuthProvider {
  platform: Platform;
  getScopes(): string[];
  getAuthorizeUrl(p: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string;
  exchangeCode(p: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<OAuthToken>;
  fetchIdentity(accessToken: string): Promise<OAuthIdentity>;
}
```

**Key pattern to copy:**
- Export types and interface in a single small file
- Well-typed parameter objects (inline `p: { ... }`)
- Return types defined as exported interfaces
- `Promise<...>` for all async methods
- No logic — just contract

---

### `src/lib/publish/fake.ts` (service — mock, CRUD)

**Analog:** `src/lib/oauth/mock.ts` — 42 lines, exact same role

**Full file — mirror this structure exactly:**

```typescript
// src/lib/oauth/mock.ts (lines 1–42)
import { randomBytes } from "crypto";
import type { OAuthProvider, OAuthToken, OAuthIdentity, Platform } from "./provider";

export class MockOAuthProvider implements OAuthProvider {
  constructor(public platform: Platform) {}

  getScopes(): string[] {
    return ["mock"];
  }

  getAuthorizeUrl(p: { state: string }): string {
    return `/api/clients/__PLACEHOLDER__/connections/${this.platform}/mock-authorize?state=${p.state}`;
  }

  async exchangeCode(p: { code: string }): Promise<OAuthToken> {
    if (!p.code.startsWith("MOCK_")) {
      throw new Error("Mock provider expects a MOCK_ code");
    }
    const rand = randomBytes(6).toString("hex");
    return {
      accessToken: `mock-access-${this.platform}-${rand}`,
      refreshToken: `mock-refresh-${this.platform}-${rand}`,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      longLived: true,
    };
  }

  async fetchIdentity(accessToken: string): Promise<OAuthIdentity> {
    const rand = randomBytes(6).toString("hex");
    return {
      platformAccountId: `mock-${this.platform}-id-${rand}`,
      name: `Mock ${this.platform === "meta" ? "Meta" : "LinkedIn"} Account`,
    };
  }
}
```

**Key pattern to copy:**
- `implements Publisher` (not `OAuthProvider`)
- Constructor takes identifying parameters: `constructor(public platform: Platform)`
- Deterministic mock data with random suffix for uniqueness
- Throw on invalid input (`if (!p.code.startsWith("MOCK_"))`)
- Async methods returning `Promise<...>`
- No external API calls — fully self-contained
- Comment header explaining purpose

---

### `src/lib/publish/index.ts` (factory)

**Analog:** `src/lib/oauth/index.ts` — 15 lines, exact same role

**Full file — mirror this structure exactly:**

```typescript
// src/lib/oauth/index.ts (lines 1–15)
import type { OAuthProvider, Platform } from "./provider";
import { MockOAuthProvider } from "./mock";
import { MetaOAuthProvider } from "./meta";
import { LinkedInOAuthProvider } from "./linkedin";

export function getProvider(platform: Platform): OAuthProvider {
  const mode = process.env.OAUTH_PROVIDER_MODE ?? "mock";
  if (mode === "real") {
    if (platform === "meta") return new MetaOAuthProvider();
    return new LinkedInOAuthProvider();
  }
  return new MockOAuthProvider(platform);
}
```

**Key pattern to copy:**
- Single exported factory function `getPublisher()`
- Environment-based gating: `process.env.PUBLISHER_MODE ?? "fake"`
- Import type for return type, concrete classes for instantiation
- Defaults to mock/fake (zero config for dev/test)
- Simple if/else — no complex DI container

---

### `src/lib/redis.ts` (config/connection)

**Analog:** `src/lib/db.ts` — 25 lines, role-match (connection singleton)

**Full file to mirror:**

```typescript
// src/lib/db.ts (lines 1–25)
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./db/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Reuse a single postgres client across hot reloads in dev to avoid exhausting
// connections.
const globalForDb = globalThis as unknown as {
  __pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__pgClient ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });
export { client as pgClient };
```

**Key pattern to copy:**
- Global singleton pattern to survive hot reloads (`globalForX`)
- Connection string loaded from `process.env`
- Guard: throw at import time if missing env var
- Max connection limit
- Named exports: `export const redis = new Redis(...)` and `export { client as redisClient }`

---

### `src/app/api/posts/[id]/route.ts` (route handler, request-response)

**Pattern for all new route handlers — this is THE canonical pattern:**

```typescript
// src/app/api/posts/[id]/route.ts (lines 1–51, full file)
import { NextRequest, NextResponse } from "next/server";
import { requireUser, getActiveClientId } from "@/lib/clients";
import { getPost, updatePost } from "@/lib/posts";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const { id } = await params;
    const post = await getPost({ id, clientId: activeClientId });

    if (!post) {
      return NextResponse.json({ error: "Post not found or access denied" }, { status: 404 });
    }

    return NextResponse.json(post, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const { id } = await params;
    const { text, title, mediaIds } = await req.json();

    const updated = await updatePost({ id, clientId: activeClientId, text, title, mediaIds });
    if (!updated) {
      return NextResponse.json({ error: "Post not found or access denied" }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
```

**Also from `src/app/api/posts/route.ts` (lines 1–44) — the base pattern with validation:**

```typescript
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUser(req.headers);
    const activeClientId = await getActiveClientId(req.headers);
    if (!activeClientId) {
      return NextResponse.json({ error: "No active client" }, { status: 400 });
    }
    const { text, title } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Post text is required" }, { status: 400 });
    }

    const post = await createPost({ text, title, clientId: activeClientId, mediaIds: [] });
    return NextResponse.json(post, { status: 201 });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
}
```

**Key patterns every route handler follows:**
1. `try/catch` at the top-level of each exported function
2. `requireUser(req.headers)` as first call — throws `HttpError(401)` if unauthenticated
3. `getActiveClientId(req.headers)` immediately after — returns null if no active client
4. Guard: `if (!activeClientId) return NextResponse.json({ error: "No active client" }, { status: 400 })`
5. `const { id } = await params` — params is a `Promise<{ id: string }>` (Next 15 App Router)
6. Entity not found: `return NextResponse.json({ error: "Post not found or access denied" }, { status: 404 })`
7. Success: `return NextResponse.json(data, { status: 200|201 })`
8. Catch: `if (e instanceof HttpError)` for 401/404, otherwise `throw e` (let Next.js handle 500)

---

### `src/lib/db/schema.ts` — extending `posts` table + new `publish_targets`

**Current `posts` table (lines 128–138):**
```typescript
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => client.id, { onDelete: "cascade" }),
  title: text("title"),
  text: text("text").notNull(),
  multiImage: boolean("multi_image").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Current `socialAccount` table (lines 83–109) — used as pattern for `publish_targets`:**
```typescript
export const socialAccount = pgTable(
  "social_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformAccountId: text("platform_account_id").notNull(),
    name: text("name"),
    accessTokenEnc: text("access_token_enc").notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    expiresAt: timestamp("expires_at"),
    keyVersion: integer("key_version").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("social_account_platform_check", sql`${table.platform} IN ('meta', 'linkedin')`),
  ],
);
```

**Post-relations pattern (lines 188–194):**
```typescript
export const postsRelations = relations(posts, ({ one, many }) => ({
  client: one(client, {
    fields: [posts.clientId],
    references: [client.id],
  }),
  media: many(media),
}));
```

**Type exports pattern (lines 219–222):**
```typescript
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
```

**Key patterns for schema additions:**
- `uuid("id").primaryKey().defaultRandom()` for all PKs
- FKs use `.references(() => otherTable.id, { onDelete: "cascade" })`
- `timestamp("column_name").notNull().defaultNow()` for timestamps
- New columns on `posts`: `scheduledAt: timestamp("scheduled_at", { withTimezone: true })`, `timezone: text("timezone")`, `status: text("status").default("draft")`
- New `publish_targets` table: FK to `posts.id` + FK to `socialAccount.id` + status text + error_message text + published_at timestamp
- Type exports at bottom: `export type PublishTarget = typeof publishTargets.$inferSelect`
- Relations at bottom using `relations()` function

---

### Test pattern

**Analog:** `src/lib/posts.test.ts` (111 lines)

**Key structure to copy for `src/lib/publish/fake.test.ts`:**

```typescript
// src/lib/posts.test.ts (lines 1–111) — canonical test pattern
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { posts, client as clientTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createPost, getPost, updatePost, listPosts } from "./posts";
import { createAuthedUser, cleanupTestData } from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import type { Cookie } from "@/test-utils/request";

describe("posts lib", () => {
  let cookie: Cookie;
  let createdClient: { id: string; name: string; userId: string };
  let secondClient: { id: string; name: string; userId: string };

  beforeAll(async () => {
    await cleanupTestData();
    const auth = await createAuthedUser("posts-test@test.com");
    cookie = auth.cookie;
    createdClient = await createClientFor(cookie, "Posts Test Client");
    const auth2 = await createAuthedUser("posts-test-2@test.com");
    secondClient = await createClientFor(auth2.cookie, "Second Client");
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("creates a post with text only", async () => {
    const result = await createPost({
      text: "Hello world",
      clientId: createdClient.id,
    });
    expect(result.id).toBeDefined();
    const [row] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, result.id));
    expect(row.text).toBe("Hello world");
    expect(row.clientId).toBe(createdClient.id);
  });

  // ... more tests with client-scoping patterns
});
```

**Key patterns:**
- `describe` / `it` / `expect` from vitest
- `beforeAll`: `cleanupTestData()` + `createAuthedUser(email)` + `createClientFor(cookie, name)`
- `afterAll`: `cleanupTestData()`
- Test helpers from `@/test-utils/request` and `@/test-utils/clients-helper`
- Cookie type from `@/test-utils/request`
- SQL verification: query the DB directly to confirm writes
- Client-scoping: create TWO clients to prove isolation

**Also: `src/lib/crypto.test.ts` (lines 1–42) — unit test pattern (no DB):**

```typescript
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "@/lib/crypto";

describe("AES-256-GCM vault (CONN-03)", () => {
  it("roundtrips plaintext", () => {
    const secret = "meta-access-token-abc123";
    const enc = encrypt(secret);
    expect(decrypt(enc)).toBe(secret);
  });
  // ... more focused assertions
});
```

---

### Worker entrypoint pattern — `src/lib/oauth/completeFlow.ts`

**Pattern for orchestration logic (lines 1–61):**

```typescript
export async function completeOAuthCallback(
  req: NextRequest,
  platform: Platform,
  clientId: string,
) {
  try {
    // ... validate inputs
    const [stored] = await db
      .select()
      .from(oauthState)
      .where(eq(oauthState.state, state));
    if (!stored) {
      return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }
    // ... call service
    await completeOAuthConnection({...});
    return NextResponse.redirect(...);
  } catch (e) {
    return errorResponse(e);
  }
}
```

**And `src/lib/oauth/complete.ts` (lines 1–76) — service-layer pattern (imports db, crypto, provider factory):**

```typescript
import { db } from "../db";
import { oauthState, socialAccount } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { getProvider } from "./index";
import { encrypt } from "../crypto";
import type { Platform } from "./provider";

export async function completeOAuthConnection(params: CompleteParams) {
  // Read state from DB
  // Validate (expiry, state match, code verifier match)
  // Call provider: const provider = getProvider(platform);
  // Encrypt at boundary: const accessEnc = encrypt(token.accessToken);
  // Persist: db.insert(socialAccount).values({...}).returning()
}
```

---

### `src/lib/clients.ts` — `requireUser()` and `getActiveClientId()` (core auth pattern)

**Full file (lines 1–136) — key extracts:**

```typescript
// Authentication guard — used in EVERY route handler
export async function requireUser(reqHeaders?: Headers): Promise<string> {
  const h = reqHeaders ?? (await headers());
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user?.id) {
    throw new HttpError(401, "Unauthenticated");
  }
  return session.user.id;
}

// Active client resolution — used in EVERY route handler
export async function getActiveClientId(reqHeaders?: Headers): Promise<string | null> {
  if (reqHeaders) return activeClientFromHeaders(reqHeaders);
  const store = await cookies();
  return store.get(ACTIVE_CLIENT_COOKIE)?.value ?? null;
}

// Error class
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
```

---

### `src/lib/http.ts` — `errorResponse()` helper (lines 1–17)

```typescript
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", issues: e.issues },
      { status: 400 },
    );
  }
  console.error(e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

---

### `src/lib/crypto.ts` — `encrypt()` and `decrypt()` (full file, 48 lines)

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}

export function encrypt(plainText: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ct.toString("base64"),
  };
}

export function decrypt({ iv, tag, ciphertext }: EncryptedPayload): string {
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
```

**Worker publish will use:** `const token = decrypt({ iv: row.iv, tag: row.tag, ciphertext: row.accessTokenEnc })`

---

### Package.json — exact content (39 lines)

```json
{
  "name": "content-creator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:push": "drizzle-kit push",
    "db:generate": "drizzle-kit generate",
    "test": "vitest run",
    "test:unit": "vitest run src/lib",
    "typecheck": "tsc --noEmit",
    // Phase 3 additions:
    // "worker:dev": "tsx watch worker.ts",
    // "worker": "node dist/worker.js"
  },
  "dependencies": {
    "next": "^15.5.19",
    "react": "^19",
    "react-dom": "^19",
    "better-auth": "1.6.23",
    "@better-auth/drizzle-adapter": "1.6.23",
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4",
    "zod": "^4",
    "swr": "^2",
    "@aws-sdk/client-s3": "^3.1069",
    "@aws-sdk/s3-request-presigner": "^3.1069"
    // Phase 3 additions:
    // "bullmq": "^5.79",
    // "ioredis": "^5"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "drizzle-kit": "^0.31",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "vitest": "^2"
  }
}
```

---

### Vitest config (19 lines)

```typescript
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
```

**`vitest.setup.ts` (7 lines):**
```typescript
const testUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
}
```

---

### Drizzle config (12 lines)

```typescript
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

## Shared Patterns

### Authentication (apply to ALL route handlers)
**Source:** `src/lib/clients.ts` lines 34–41 (`requireUser`) and 44–48 (`getActiveClientId`)
**Usage in every handler:**
```typescript
const userId = await requireUser(req.headers);
const activeClientId = await getActiveClientId(req.headers);
if (!activeClientId) {
  return NextResponse.json({ error: "No active client" }, { status: 400 });
}
```

### Error handling in route handlers (apply to ALL route handlers)
**Source:** `src/app/api/posts/[id]/route.ts` lines 6–11 and 21–26, also `src/lib/http.ts` lines 5–17
**Two valid patterns:**

**Pattern A (inline — for simple handlers):**
```typescript
try {
  // ... handler logic
} catch (e) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  throw e;
}
```

**Pattern B (errorResponse helper — for complex handlers):**
```typescript
import { errorResponse } from "@/lib/http";
// ...
try {
  // ... handler logic
} catch (e) {
  return errorResponse(e);
}
```

### DB query patterns (apply to ALL service files)
**Source:** `src/lib/posts.ts` lines 1–87

| Operation | Pattern |
|-----------|---------|
| Insert | `db.insert(table).values({...}).returning()` |
| Select one | `db.query.table.findFirst({ where: and(eq(...), eq(...)) })` |
| Select many | `db.query.table.findMany({ where: eq(...), orderBy: ..., with: {...} })` |
| Update | `db.update(table).set({...}).where(and(eq(...), eq(...))).returning()` |
| Delete | `db.delete(table).where(eq(..., ...))` |

### Imports path alias
**Source:** `vitest.config.ts` line 7, `tsconfig.json`
```typescript
import { db } from "@/lib/db";          // not ../../lib/db
import { posts } from "@/lib/db/schema";  // aliased via @ -> src/
```

### Test data setup and teardown (apply to ALL new tests)
```typescript
import { createAuthedUser, cleanupTestData } from "@/test-utils/request";
import { createClientFor } from "@/test-utils/clients-helper";
import type { Cookie } from "@/test-utils/request";
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md / external patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/queue/index.ts` | service | event-driven (BullMQ) | No existing queue infrastructure |
| `worker.ts` | entrypoint | event-driven | No existing worker process |
| Schedule UI (`/schedule` page + components) | component | request-response | No existing schedule UI; compose page is closest analog |
| Timezone picker component | component | request-response | No existing IANA timezone selector; `ClientSwitcher` is closest selector pattern |

---

**Analog search scope:** `src/lib/`, `src/app/api/`, `src/components/`, `src/lib/oauth/`, `src/test-utils/`
**Files scanned:** 42 source files, 8 test/infra files
**Pattern extraction date:** 2026-07-12
