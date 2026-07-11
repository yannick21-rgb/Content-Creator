// Vitest setup: wire the test database before any test imports the app's db client.
// Vitest already loads .env/.env.local (Vite env loading), so DATABASE_URL_TEST and
// DATABASE_URL are present. We point the app's DATABASE_URL at the test database.
const testUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (testUrl) {
  process.env.DATABASE_URL = testUrl;
}
