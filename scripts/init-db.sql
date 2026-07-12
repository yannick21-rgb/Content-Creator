-- Runs once on first container start (PostgreSQL entrypoint).
-- Creates the test database used by the Vitest suite (DATABASE_URL_TEST).
SELECT 'CREATE DATABASE content_creator_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'content_creator_test')\gexec
