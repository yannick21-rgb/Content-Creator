import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    // DB-backed integration tests need a real Postgres (DATABASE_URL_TEST).
    // Use `vitest run src/lib` for the fast, DB-less unit tests.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
