#!/bin/bash
# Deferred delivery of a tmux message after busy-wait.
# Usage: deliver-tmux-msg.sh <pane_id> <msg_file>
# Waits 15s, then force-delivers regardless of pane state.
# The message is already in BMS inbox — this is a convenience push.

PANE_ID="$1"
MSG_FILE="$2"

[ ! -f "$MSG_FILE" ] && exit 0

sleep 15

# Force-deliver — message is already in BMS inbox, this is best-effort
BUF_NAME="force-$(date +%s)-$$"
tmux load-buffer -b "$BUF_NAME" "$MSG_FILE" 2>/dev/null || { rm -f "$MSG_FILE"; exit 0; }
tmux paste-buffer -b "$BUF_NAME" -t "$PANE_ID" -d 2>/dev/null
sleep 0.5
tmux send-keys -t "$PANE_ID" -H 0d 2>/dev/null
rm -f "$MSG_FILE"
tmux delete-buffer -b "$BUF_NAME" 2>/dev/null
