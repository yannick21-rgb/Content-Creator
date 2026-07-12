// Polyfill globalThis.crypto for Node 18 (Better Auth depends on it; it's
// natively available since Node 19). This polyfill is safe on Node 20+ too.
import { webcrypto } from "crypto";
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto as Crypto;
}

// Explicitly load .env and .env.local so env vars are present before any module
// import (Vite's env loading may not set process.env in all Vitest modes).
import dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

// Wire the test database — DATABASE_URL_TEST overrides DATABASE_URL when set.
const testUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
}
