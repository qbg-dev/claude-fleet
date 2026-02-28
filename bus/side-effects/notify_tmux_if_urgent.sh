#!/usr/bin/env bash
# notify_tmux_if_urgent.sh — Handle urgent priority messages.
# Previously sent tmux send-keys directly to target pane (bypassing the bus).
# Now: urgent messages are already in inbox.jsonl via notify_assignee.sh.
# The pre-tool-context-injector's inbox_scan.py surfaces them with priority.
# No additional action needed — inbox delivery + context injection is sufficient.
#
# This side-effect is kept as a no-op to avoid breaking schema.json registration.
# If bus-based urgency detection is ever needed, add bus_publish here instead.
set -euo pipefail

# Read and discard stdin (required by side-effect contract)
cat > /dev/null

exit 0
