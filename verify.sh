#!/usr/bin/env bash
# Project verify shim. Smurf agents call ONLY this script.
set -euo pipefail

# Run headless tests for the Tris game pure logic.
node test.js
