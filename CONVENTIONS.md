# Conventions

## TypeScript

- Strict mode enabled (`strict: true` in tsconfig).
- Prefer `interface` over `type` for public APIs; use `type` for unions.
- All functions are `async` when they perform I/O.
- Imports use the `@/` path alias (maps to `src/`).

## Naming

| Context       | Convention  | Example                        |
|---------------|-------------|--------------------------------|
| Files (src)   | kebab-case  | `connection-status.ts`         |
| Next routes   | snake-case (dir) | `[accountId]/reconnect/route.ts` |
| DB tables     | snake_case  | `social_account`               |
| DB columns    | snake_case  | `access_token_enc`             |
| TypeScript    | camelCase   | `getValidAccessToken`          |
| Classes       | PascalCase  | `MetaOAuthProvider`            |
| Zod schemas   | `[name]Schema` | `publishSchema`             |

## Project structure

- **Route handlers** (`src/app/api/`) are thin — they validate the request
  (`zod`), call helpers from `src/lib/`, and return `NextResponse`.
- **Business logic** lives in `src/lib/`, never in route handlers.
- **Shared libs** are used by both the web process and the worker.
- **Drizzle schema** in `src/lib/db/schema.ts` is the single source of truth.

## OAuth providers

Each provider implements `OAuthProvider` (interface in
`src/lib/oauth/provider.ts`) and is instantiated by `getProvider()`.

- Mock mode (`OAUTH_PROVIDER_MODE=mock`) is the default — no approved app
  needed. The mock provider at `src/lib/oauth/mock.ts` simulates the full PKCE
  flow with deterministic tokens.
- Real mode requires `META_CLIENT_ID/SECRET` or `LINKEDIN_CLIENT_ID/SECRET`.

## Database

- All migrations via `drizzle-kit push` (dev) or generated SQL in `drizzle/`
  (production deploy).
- Encrypted token fields (`access_token_enc`, `refresh_token_enc`) have
  matching `_iv` and `_tag` columns for independent GCM nonces.
- Foreign keys cascade on delete (client → social_account → posts, etc.).

## Testing

- `npm run test:unit` — unit tests only (fast, `src/lib/`).
- `npm test` — all tests including DB-backed integration tests.
- Tests use the real Postgres (`DATABASE_URL_TEST`).
- Vitest with `vi.mock` for external SDKs (@google/genai, etc.).
- OAuth tests use `MockOAuthProvider` — no real platform credentials.

## Error handling

- Route handlers catch `HttpError` (from `@/lib/clients`) and return JSON
- Worker throws `UnrecoverableError` for non-retryable failures
- All publish errors are logged and moved to the dead-letter queue (DLQ) after
  3 attempts

## Environment variables

- `.env` — shared defaults (committed)
- `.env.local` — local overrides (git-ignored)
- `.env.example` — documentation template
- Every secret has a `_unset_` default check at the boundary
