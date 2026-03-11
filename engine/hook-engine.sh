#!/usr/bin/env bash
# hook-engine.sh — Bash shim that delegates to the TypeScript hook engine.
# Claude Code settings call this via "bash hook-engine.sh" on hook events.
# The actual logic lives in hook-engine.ts (runs via bun).
exec bun "$(dirname "$0")/hook-engine.ts"
