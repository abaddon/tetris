#!/usr/bin/env bash
set -euo pipefail
export PORT="${1:-3000}"
node test/integration.js
