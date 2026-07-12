#!/usr/bash
# Local development bootstrap for Content-Creator.
#
# What it does:
#   1. Starts PostgreSQL + Redis via docker compose
#   2. Waits for both to become healthy
#   3. Runs the Drizzle migration (npm run db:push)
#   4. Launches the Next.js web app and the BullMQ worker
#
# Requirements:
#   - Docker + docker compose installed
#   - Node 24 + npm install already run
#   - .env.local present (copy from .env.example and fill secrets)
#
# Usage:
#   ./scripts/dev.sh            # start everything, Ctrl-C to stop
#   ./scripts/dev.sh --infra    # only bring up + migrate infra, then exit

set -euo pipefail

# --- colors -----------------------------------------------------------------
c_reset="\033[0m"; c_green="\033[0;32m"; c_yellow="\033[0;33m"; c_red="\033[0;31m"
info()  { echo -e "${c_green}[dev]${c_reset} $*"; }
warn()  { echo -e "${c_yellow}[dev]${c_reset} $*"; }
die()   { echo -e "${c_red}[dev]${c_reset} $*" >&2; exit 1; }

INFRA_ONLY=0
[ "${1:-}" = "--infra" ] && INFRA_ONLY=1

command -v docker >/dev/null 2>&1 || die "docker is required but not installed."
[ -f .env.local ] || warn ".env.local not found — copy .env.example and fill in secrets (BETTER_AUTH_SECRET, TOKEN_ENCRYPTION_KEY, etc.)"

# --- 1. start infra ---------------------------------------------------------
info "Starting PostgreSQL + Redis via docker compose…"
docker compose up -d postgres redis

# --- 2. wait for healthy ----------------------------------------------------
wait_healthy() {
  local name="$1" tries=30
  info "Waiting for $name to be healthy…"
  for ((i=0; i<tries; i++)); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then return 0; fi
    sleep 2
  done
  die "$name did not become healthy in time."
}
wait_healthy cc-postgres
wait_healthy cc-redis

# --- 3. migrate -------------------------------------------------------------
info "Running Drizzle migration (npm run db:push)…"
npm run db:push

if [ "$INFRA_ONLY" -eq 1 ]; then
  info "Infra is up and migrated. Start the app with:"
  info "  npm run dev        # web (terminal 1)"
  info "  npm run worker:dev # worker (terminal 2)"
  exit 0
fi

# --- 4. run web + worker ---------------------------------------------------
info "Launching web app (npm run dev) and worker (npm run worker:dev)…"
trap 'info "Stopping…"; kill 0' INT TERM
npm run dev &
WEB_PID=$!
npm run worker:dev &
WORKER_PID=$!
wait "$WEB_PID" "$WORKER_PID"
