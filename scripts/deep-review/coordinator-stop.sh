#!/usr/bin/env bash
# Coordinator Stop hook — unblocks verifier FIFOs when review is complete.
# Only fires verifiers if review.done exists (coordinator finished normally).
# Exit 0 = allow stop.
set -euo pipefail

# Resolve session dir
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_DIR_FILE="${SCRIPT_DIR}/session-dir.txt"
if [ ! -f "$SESSION_DIR_FILE" ]; then
  echo "ERROR: session-dir.txt not found" >&2
  exit 0
fi
SESSION_DIR="$(cat "$SESSION_DIR_FILE")"

# Only trigger verifiers if coordinator completed normally
if [ -f "$SESSION_DIR/review.done" ]; then
  echo "[hook] Coordinator completed. Unblocking verifier FIFOs..."
  for fifo in "$SESSION_DIR"/fifo-verifier-*; do
    [ -p "$fifo" ] && echo "go" > "$fifo" &
  done
  wait 2>/dev/null || true
  echo "[hook] Verifiers unblocked."
else
  echo "[hook] Coordinator stopped without review.done — verifiers NOT triggered."
fi

exit 0
