#!/usr/bin/env bash
# liveness-heartbeat.sh — Touch a timestamp file on every hook fire.
# Registered on PostToolUse + UserPromptSubmit so the watchdog has a
# reliable "last activity" signal without parsing scrollback.
#
# File: ~/.claude-ops/state/watchdog-runtime/{worker}/liveness
# Contains: epoch timestamp of last activity

WORKER="${WORKER_NAME:-}"
[ -z "$WORKER" ] && exit 0

RUNTIME_DIR="${HOME}/.claude-ops/state/watchdog-runtime/${WORKER}"
mkdir -p "$RUNTIME_DIR" 2>/dev/null || true

date +%s > "$RUNTIME_DIR/liveness"
exit 0
