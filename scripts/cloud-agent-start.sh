#!/usr/bin/env bash
# Per-boot Cloud Agent start: local Upstash REST stand-in, then Next.js dev server.
set -euo pipefail

cd "$(dirname "$0")/.."

export UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL:-http://127.0.0.1:8079}"
export UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN:-local-dev}"
export DEV_UPSTASH_PORT="${DEV_UPSTASH_PORT:-8079}"
export DEV_UPSTASH_TOKEN="${DEV_UPSTASH_TOKEN:-$UPSTASH_REDIS_REST_TOKEN}"

if ! curl -sf -o /dev/null "http://127.0.0.1:${DEV_UPSTASH_PORT}/health"; then
  node scripts/dev-upstash-rest.mjs >> /tmp/dev-upstash.log 2>&1 &
  ready=0
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 25 30; do
    if curl -sf -o /dev/null "http://127.0.0.1:${DEV_UPSTASH_PORT}/health"; then
      ready=1
      break
    fi
    sleep 0.2
  done
  if [ "$ready" -ne 1 ]; then
    echo "Local Upstash REST server did not become ready. See /tmp/dev-upstash.log" >&2
    exit 1
  fi
fi

if curl -sf -o /dev/null "http://127.0.0.1:3000"; then
  echo "Next.js dev server already listening on port 3000"
  exit 0
fi

exec npm run dev -- --hostname 0.0.0.0 --port 3000
