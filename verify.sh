#!/usr/bin/env bash
# Project verify shim. Smurf agents call ONLY this script.
set -euo pipefail

# 1. Pure-logic tests (no server needed)
node test.js

# 1b. AI perf regression (no server needed; skips gracefully if shared/ai not yet merged)
node test/ai-perf.test.js

# 1c. Leaderboard bot-exclusion regression across all difficulties (no server needed)
node test/leaderboard-bot-exclusion.test.js

# 2. Install dependencies (idempotent)
npm install --no-audit --no-fund --silent

# 3. Start server on an ephemeral port; capture actual port from stdout.
#    Use an isolated DATA_DIR so the leaderboard top-10 isn't polluted
#    by prior verify runs (each integration test creates fresh winnerX_<ts> users).
SERVER_PID=""
TMPLOG=$(mktemp)
TMPDATA=$(mktemp -d)

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$TMPLOG"
  rm -rf "$TMPDATA"
}
trap cleanup EXIT

PORT=0 DATA_DIR="$TMPDATA" node server/index.js >"$TMPLOG" 2>&1 &
SERVER_PID=$!

ACTUAL_PORT=""
for i in $(seq 1 50); do
  sleep 0.1
  if grep -q "listening on :" "$TMPLOG" 2>/dev/null; then
    ACTUAL_PORT=$(grep "listening on :" "$TMPLOG" | head -1 | sed 's/.*listening on ://')
    break
  fi
done

if [ -z "$ACTUAL_PORT" ]; then
  echo "ERROR: server did not start in time" >&2
  cat "$TMPLOG" >&2
  exit 1
fi

# 4. Run integration smoke test
PORT="$ACTUAL_PORT" node test/integration.js
